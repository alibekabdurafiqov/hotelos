'use strict';

function ts() {
  return new Date().toISOString();
}

function makeLogger(serviceName) {
  return {
    info: (msg, extra) =>
      console.log(`[${ts()}] [${serviceName}] INFO  ${msg}`, extra !== undefined ? extra : ''),
    warn: (msg, extra) =>
      console.warn(`[${ts()}] [${serviceName}] WARN  ${msg}`, extra !== undefined ? extra : ''),
    error: (msg, err) =>
      console.error(`[${ts()}] [${serviceName}] ERROR ${msg}`, err ? (err.stack || err) : ''),
  };
}

module.exports = { makeLogger };
