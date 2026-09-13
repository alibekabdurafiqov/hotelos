'use strict';
/**
 * HotelOS Message Broker
 * ----------------------
 * The ONLY component every service and the dashboard are allowed to talk to.
 * Services never call each other directly (see TZ 1-bo'lim, "Asosiy qoida").
 *
 * Responsibilities:
 *   1. Accept WebSocket connections from services (role=service) and from the
 *      operations dashboard (role=dashboard).
 *   2. Maintain a pub/sub table: event name -> set of subscriber connections.
 *   3. Relay published events to subscribers, stamping them with a server time.
 *   4. Serve the static dashboard HTML/JS (so the whole demo is one process
 *      away from a browser tab - "bitta buyruq bilan ishga tushishi", NFR-06).
 *   5. Gate dashboard connections behind a token (NFR-02) and never forward
 *      sensitive fields (services are responsible for not publishing them -
 *      see NFR-03 and each service's serialize* helpers).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { attachWebSocketServer } = require('../shared/ws-server');
const { makeLogger } = require('../shared/logger');

const PORT = process.env.BROKER_PORT || 7000;
const ADMIN_TOKEN = process.env.HOTELOS_ADMIN_TOKEN || 'hotelos-admin';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const logger = makeLogger('broker');

// event name -> Set<connection>
const subscriptions = new Map();
// track role/name per connection for logging & cleanup
const connectionMeta = new WeakMap();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let filePath = url.pathname === '/' ? '/dashboard.html' : url.pathname;
  const fullPath = path.join(PUBLIC_DIR, filePath);

  // Basic path traversal protection (NFR-01 style hygiene, even for static files).
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

function subscribe(conn, events) {
  for (const evt of events) {
    if (!subscriptions.has(evt)) subscriptions.set(evt, new Set());
    subscriptions.get(evt).add(conn);
  }
}

function unsubscribeAll(conn) {
  for (const set of subscriptions.values()) {
    set.delete(conn);
  }
}

function publish(fromConn, event, payload) {
  const meta = connectionMeta.get(fromConn) || {};
  const envelope = JSON.stringify({
    type: 'event',
    event,
    payload,
    from: meta.name || 'unknown',
    ts: new Date().toISOString(),
  });
  const subs = subscriptions.get(event);
  logger.info(`EVENT ${event} <- ${meta.name || '?'} -> ${subs ? subs.size : 0} obunachi(lar)`);
  if (!subs) return;
  for (const conn of subs) {
    conn.send(envelope);
  }
}

attachWebSocketServer(httpServer, (conn, requestUrl) => {
  const role = requestUrl.searchParams.get('role');
  const name = requestUrl.searchParams.get('name') || 'anon';
  const token = requestUrl.searchParams.get('token');

  if (role === 'dashboard') {
    if (token !== ADMIN_TOKEN) {
      logger.warn(`Panel ulanishi rad etildi (noto'g'ri token)`);
      conn.send(JSON.stringify({ type: 'auth_error', message: 'Noto\'g\'ri token' }));
      conn.close();
      return;
    }
  } else if (role !== 'service') {
    conn.close();
    return;
  }

  connectionMeta.set(conn, { role, name });
  logger.info(`Ulandi: role=${role} name=${name}`);

  conn.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (_err) {
      return; // silently ignore malformed frames - never trust external input
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'subscribe' && Array.isArray(msg.events)) {
      subscribe(conn, msg.events);
      conn.send(JSON.stringify({ type: 'subscribed', events: msg.events }));
    } else if (msg.type === 'publish' && typeof msg.event === 'string') {
      publish(conn, msg.event, msg.payload);
    }
  });

  conn.on('close', () => {
    logger.info(`Uzildi: role=${role} name=${name}`);
    unsubscribeAll(conn);
  });
});

httpServer.listen(PORT, () => {
  logger.info(`Broker ishga tushdi: http://localhost:${PORT} (WebSocket ham shu portda)`);
  logger.info(`Dashboard tokeni: ${ADMIN_TOKEN} (HOTELOS_ADMIN_TOKEN orqali o'zgartiring)`);
});
