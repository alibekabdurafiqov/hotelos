'use strict';
const http = require('http');
const { ValidationError } = require('./validate');

/**
 * Very small routing + JSON body helper built on Node's built-in http module.
 * Not a framework - just enough structure to keep each service's code readable
 * without pulling in Express (keeps the project dependency-free, see NFR-06).
 */
function createJsonServer(logger) {
  const routes = []; // { method, pattern: RegExp, paramNames, handler }

  function route(method, path, handler) {
    const paramNames = [];
    const pattern = new RegExp(
      '^' +
        path
          .split('/')
          .map((seg) => {
            if (seg.startsWith(':')) {
              paramNames.push(seg.slice(1));
              return '([^/]+)';
            }
            return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          })
          .join('/') +
        '$'
    );
    routes.push({ method: method.toUpperCase(), pattern, paramNames, handler });
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      const MAX = 1024 * 1024; // 1MB cap - basic protection against abuse
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX) {
          reject(new ValidationError('So\'rov tanasi juda katta'));
          req.destroy();
          return;
        }
        data += chunk;
      });
      req.on('end', () => {
        if (!data) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch (_err) {
          reject(new ValidationError('Noto\'g\'ri JSON formati'));
        }
      });
      req.on('error', reject);
    });
  }

  function send(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    });
    res.end(body);
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      send(res, 204, {});
      return;
    }
    const url = new URL(req.url, 'http://localhost');
    const match = routes.find(
      (r) => r.method === req.method && r.pattern.test(url.pathname)
    );
    if (!match) {
      send(res, 404, { error: 'Topilmadi' });
      return;
    }
    const groups = url.pathname.match(match.pattern).slice(1);
    const params = {};
    match.paramNames.forEach((name, i) => {
      params[name] = groups[i];
    });

    try {
      const body = req.method === 'GET' ? {} : await readBody(req);
      const result = await match.handler({ params, query: url.searchParams, body });
      send(res, result && result.status ? result.status : 200, (result && result.body) || result || {});
    } catch (err) {
      if (err instanceof ValidationError) {
        const payload = { error: err.message };
        if (err.alternative) payload.alternative = err.alternative;
        send(res, err.statusCode, payload);
        return;
      }
      // Never leak internal error details / stack traces to the client (NFR-04).
      logger.error('Kutilmagan xatolik so\'rovni qayta ishlashda', err);
      send(res, 500, { error: 'Ichki server xatosi. Iltimos keyinroq urinib ko\'ring.' });
    }
  });

  return { server, route };
}

module.exports = { createJsonServer };
