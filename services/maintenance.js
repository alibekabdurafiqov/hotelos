'use strict';
/**
 * Texnik Xizmat Servisi (Maintenance Service)
 * ---------------------------------------------
 * TZ 3.4 / SRS FR-03.
 * Data structure: binary-heap priority queue, keyed by (urgencyRank, vaqt) so
 * Kritik > Yuqori > Normal > Past, and FIFO breaks ties at equal urgency.
 * Publishes: maintenance.reported, maintenance.resolved
 */

const { createJsonServer } = require('../shared/http-json');
const { connectToBroker } = require('../shared/broker-client');
const { makeLogger } = require('../shared/logger');
const { PriorityQueue } = require('../shared/data-structures');
const { requireString, requireEnum, ValidationError } = require('../shared/validate');

const PORT = process.env.MAINTENANCE_PORT || 7004;
const logger = makeLogger('maintenance');
const broker = connectToBroker({ serviceName: 'maintenance', logger });

const URGENCY_RANK = { kritik: 0, yuqori: 1, normal: 2, past: 3 };
const URGENCY_VALUES = Object.keys(URGENCY_RANK);

function compareIssues(a, b) {
  if (a.urgencyRank !== b.urgencyRank) return a.urgencyRank - b.urgencyRank;
  return a.reportedAtMs - b.reportedAtMs; // FIFO tie-break
}

const issueQueue = new PriorityQueue(compareIssues);
const issuesById = new Map(); // id -> issue (kept even after being popped, for status/history)
let nextIssueId = 1;

// Simple round-robin / least-loaded technician pool.
const technicians = [
  { name: 'Aziz', openCount: 0 },
  { name: 'Bekzod', openCount: 0 },
  { name: 'Davron', openCount: 0 },
];

function assignTechnician() {
  const tech = [...technicians].sort((a, b) => a.openCount - b.openCount)[0];
  tech.openCount += 1;
  return tech.name;
}

function releaseTechnician(name) {
  const tech = technicians.find((t) => t.name === name);
  if (tech && tech.openCount > 0) tech.openCount -= 1;
}

const { server, route } = createJsonServer(logger);

route('GET', '/issues', async () => ({
  body: issueQueue.toArray().map((i) => ({
    id: i.id,
    roomNumber: i.roomNumber,
    description: i.description,
    urgency: i.urgency,
    assignedTo: i.assignedTo,
    reportedAt: i.reportedAt,
  })),
}));

route('POST', '/issues', async ({ body }) => {
  const roomNumber = requireString(body, 'roomNumber', { maxLen: 10 });
  const description = requireString(body, 'description', { maxLen: 300 });
  const urgency = requireEnum(body, 'urgency', URGENCY_VALUES);

  const id = String(nextIssueId++);
  const reportedAtMs = Date.now();
  const assignedTo = assignTechnician();
  const issue = {
    id,
    roomNumber,
    description,
    urgency,
    urgencyRank: URGENCY_RANK[urgency],
    reportedAtMs,
    reportedAt: new Date(reportedAtMs).toISOString(),
    assignedTo,
  };
  issueQueue.push(issue);
  issuesById.set(id, issue);

  broker.publish('maintenance.reported', {
    issueId: id,
    roomNumber,
    urgency,
    assignedTo,
  });
  logger.info(`Yangi muammo #${id} xona ${roomNumber} (${urgency}) -> ${assignedTo}`);
  return { status: 201, body: issue };
});

route('POST', '/issues/:id/resolve', async ({ params }) => {
  const issue = issuesById.get(params.id);
  if (!issue) throw new ValidationError('Bunday muammo topilmadi');
  if (issue.resolved) throw new ValidationError('Bu muammo allaqachon yopilgan');

  issue.resolved = true;
  releaseTechnician(issue.assignedTo);
  // Rebuild the heap without the resolved issue (small N - simplest correct approach).
  const remaining = issueQueue.toArray().filter((i) => i.id !== issue.id);
  while (issueQueue.size > 0) issueQueue.pop();
  for (const i of remaining) issueQueue.push(i);

  broker.publish('maintenance.resolved', { issueId: issue.id, roomNumber: issue.roomNumber });
  logger.info(`Muammo #${issue.id} yopildi (xona ${issue.roomNumber})`);
  return { body: issue };
});

server.listen(PORT, () => logger.info(`Texnik Xizmat Servisi http://localhost:${PORT} portida ishlamoqda`));
