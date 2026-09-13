'use strict';
/**
 * Simple HTTP proxy helper for reverse proxying to microservices
 */

const http = require('http');

function proxyRequest(req, res, targetHost, targetPort) {
  const forwardUrl = new URL(req.url, `http://${targetHost}:${targetPort}`);
  
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: forwardUrl.pathname + forwardUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      'host': `${targetHost}:${targetPort}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'Bad Gateway: ' + err.message }));
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
}

module.exports = { proxyRequest };
