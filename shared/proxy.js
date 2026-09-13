'use strict';
/**
 * Simple HTTP proxy helper for reverse proxying to microservices
 */

const http = require('http');

function proxyRequest(req, res, targetHost, targetPort, logger) {
  const forwardUrl = new URL(req.url, `http://${targetHost}:${targetPort}`);
  const fullPath = forwardUrl.pathname + forwardUrl.search;
  
  if (logger) {
    logger.info(`[PROXY] ${req.method} ${req.url} -> ${targetHost}:${targetPort}${fullPath}`);
  }
  
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: fullPath,
    method: req.method,
    headers: {
      ...req.headers,
      'host': `${targetHost}:${targetPort}`,
    },
    timeout: 5000,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    if (logger) {
      logger.info(`[PROXY] Response ${proxyRes.statusCode} from ${targetHost}:${targetPort}${fullPath}`);
    }
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (logger) {
      logger.error(`[PROXY] Error proxying to ${targetHost}:${targetPort}: ${err.message}`);
    }
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad Gateway: ' + err.message }));
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    if (logger) {
      logger.error(`[PROXY] Timeout connecting to ${targetHost}:${targetPort}`);
    }
    res.writeHead(504, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Gateway Timeout' }));
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

module.exports = { proxyRequest };
