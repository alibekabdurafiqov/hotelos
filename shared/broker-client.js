'use strict';
/**
 * Broker client used by every microservice. Wraps Node's native global
 * WebSocket (available since Node 21+, stable in the Node 22 used here) -
 * no external ws/socket.io dependency required.
 *
 * A service NEVER imports another service's code or calls its HTTP port
 * directly - this is the one and only channel to the rest of HotelOS.
 */

const BROKER_URL = process.env.HOTELOS_BROKER_URL || 'ws://localhost:7000';

function connectToBroker({ serviceName, logger }) {
  const handlers = new Map(); // event -> [callback,...]
  let socket = null;
  let ready = false;
  const pendingSends = [];

  function open() {
    socket = new WebSocket(`${BROKER_URL}/?role=service&name=${encodeURIComponent(serviceName)}`);

    socket.addEventListener('open', () => {
      ready = true;
      logger.info('Brokerga ulandi');
      const events = [...handlers.keys()];
      if (events.length > 0) {
        socket.send(JSON.stringify({ type: 'subscribe', events }));
      }
      while (pendingSends.length > 0) {
        socket.send(pendingSends.shift());
      }
    });

    socket.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (_err) {
        return;
      }
      if (msg.type === 'event' && handlers.has(msg.event)) {
        for (const cb of handlers.get(msg.event)) {
          try {
            cb(msg.payload, msg);
          } catch (err) {
            logger.error(`"${msg.event}" hodisasini qayta ishlashda xatolik`, err);
          }
        }
      }
    });

    socket.addEventListener('close', () => {
      ready = false;
      logger.warn('Broker bilan ulanish uzildi, 2s dan keyin qayta urinish...');
      setTimeout(open, 2000);
    });

    socket.addEventListener('error', () => {
      // 'close' will fire right after and trigger the reconnect loop
    });
  }

  open();

  return {
    on(event, callback) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(callback);
      if (ready) {
        socket.send(JSON.stringify({ type: 'subscribe', events: [event] }));
      }
      return this;
    },
    publish(event, payload) {
      const frame = JSON.stringify({ type: 'publish', event, payload });
      if (ready) {
        socket.send(frame);
      } else {
        pendingSends.push(frame);
      }
    },
  };
}

module.exports = { connectToBroker };
