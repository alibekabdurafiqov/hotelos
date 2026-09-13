'use strict';
/**
 * Tozalash Servisi (Housekeeping Service)
 * ----------------------------------------
 * TZ 3.2 / SRS FR-04.
 * Subscribes: room.checked_out -> pushes the room onto a FIFO cleaning queue.
 * Publishes:  room.status_changed on every transition
 *             Iflos -> Tozalanmoqda -> Toza
 */

const { createJsonServer } = require('../shared/http-json');
const { connectToBroker } = require('../shared/broker-client');
const { makeLogger } = require('../shared/logger');
const { Queue } = require('../shared/data-structures');
const { requireRoomNumber, ValidationError } = require('../shared/validate');

const PORT = process.env.HOUSEKEEPING_PORT || 7002;
const logger = makeLogger('housekeeping');
const broker = connectToBroker({ serviceName: 'housekeeping', logger });

const STATUS_FLOW = ['iflos', 'tozalanmoqda', 'toza'];

// FIFO queue (FR-08) of rooms awaiting/undergoing cleaning.
const cleaningQueue = new Queue();
// roomNumber -> current cleaning status (only tracked while in the workflow)
const roomStatus = new Map();

function publishStatus(roomNumber, newStatus) {
  roomStatus.set(roomNumber, newStatus);
  broker.publish('room.status_changed', { roomNumber, newStatus });
  logger.info(`Xona ${roomNumber}: holat -> ${newStatus}`);
}

broker.on('room.checked_out', ({ roomNumber }) => {
  cleaningQueue.enqueue(roomNumber);
  publishStatus(roomNumber, 'iflos');
});

const { server, route } = createJsonServer(logger);

route('GET', '/queue', async () => ({
  body: cleaningQueue.toArray().map((roomNumber) => ({
    roomNumber,
    status: roomStatus.get(roomNumber) || 'iflos',
  })),
}));

// Staff calls this to advance a room to the next cleaning stage.
route('POST', '/advance/:number', async ({ params }) => {
  const inQueueNumbers = cleaningQueue.toArray();
  const number = requireRoomNumber(params, 'number', inQueueNumbers.length ? inQueueNumbers : ['__none__']);
  const current = roomStatus.get(number);
  const currentIndex = STATUS_FLOW.indexOf(current);
  if (currentIndex === -1 || currentIndex === STATUS_FLOW.length - 1) {
    throw new ValidationError('Bu xona tozalash navbatida emas yoki allaqachon toza');
  }
  const nextStatus = STATUS_FLOW[currentIndex + 1];
  publishStatus(number, nextStatus);

  if (nextStatus === 'toza') {
    // Cleaning finished - remove it from the active queue.
    const idx = cleaningQueue._items.indexOf(number);
    if (idx !== -1) cleaningQueue._items.splice(idx, 1);
    roomStatus.delete(number);
  }
  return { body: { roomNumber: number, status: nextStatus } };
});

server.listen(PORT, () => logger.info(`Tozalash Servisi http://localhost:${PORT} portida ishlamoqda`));
