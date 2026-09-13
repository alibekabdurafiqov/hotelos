'use strict';
/**
 * Spins up the broker and all four microservices as separate child processes
 * so the whole system can be started with a single command:
 *   npm start
 * Each stays a genuinely separate OS process - they only ever talk to each
 * other through broker.js over WebSocket, never through direct function calls.
 */
const { spawn } = require('child_process');
const path = require('path');

const targets = [
  { name: 'broker', file: 'broker/broker.js' },
  { name: 'reception', file: 'services/reception.js' },
  { name: 'housekeeping', file: 'services/housekeeping.js' },
  { name: 'roomservice', file: 'services/roomservice.js' },
  { name: 'maintenance', file: 'services/maintenance.js' },
];

const children = [];

function startOne({ name, file }, delayMs) {
  setTimeout(() => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], {
      stdio: 'inherit',
      env: process.env,
    });
    children.push(child);
    child.on('exit', (code) => {
      console.log(`[start] "${name}" chiqib ketdi (kod: ${code})`);
    });
  }, delayMs);
}

// Broker starts first; services start ~400ms later so it's already listening
// (each service also auto-reconnects on its own, so this is just to keep the
// startup log tidy, not a hard requirement).
startOne(targets[0], 0);
targets.slice(1).forEach((t) => startOne(t, 400));

function shutdown() {
  console.log('\n[start] Barcha servislar to\'xtatilmoqda...');
  for (const child of children) child.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
