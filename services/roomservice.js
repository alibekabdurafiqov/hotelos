'use strict';
/**
 * Xona Xizmati Servisi (Room Service)
 * ------------------------------------
 * TZ 3.3 / SRS FR-05.
 * Publishes: room_service.order_created, room_service.status_changed
 * Status flow: qabul_qilindi -> tayyorlanmoqda -> yetkazilmoqda -> yetkazildi
 * On "yetkazildi" the charge is included in the event payload so Reception
 * can add it to the guest's folio (see reception.js notes on this extension).
 */

const { createJsonServer } = require('../shared/http-json');
const { connectToBroker } = require('../shared/broker-client');
const { makeLogger } = require('../shared/logger');
const { Queue } = require('../shared/data-structures');
const { requireString, requireArray, requireNumber, ValidationError } = require('../shared/validate');

const PORT = process.env.ROOMSERVICE_PORT || 7003;
const logger = makeLogger('roomservice');
const broker = connectToBroker({ serviceName: 'roomservice', logger });

const STATUS_FLOW = ['qabul_qilindi', 'tayyorlanmoqda', 'yetkazilmoqda', 'yetkazildi'];

const orders = new Map(); // orderId -> order
const pendingQueue = new Queue(); // FIFO (FR-08) - kitchen processing order
let nextOrderId = 1;

function total(items) {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

const { server, route } = createJsonServer(logger);

route('GET', '/orders', async () => ({ body: [...orders.values()] }));

route('POST', '/orders', async ({ body }) => {
  const roomNumber = requireString(body, 'roomNumber', { maxLen: 10 });
  const items = requireArray(body, 'items');
  if (items.length === 0) throw new ValidationError('Buyurtmada kamida bitta mahsulot bo\'lishi kerak');
  for (const it of items) {
    requireString(it, 'name', { maxLen: 80 });
    requireNumber(it, 'price', { min: 0, max: 1000 });
    requireNumber(it, 'qty', { min: 1, max: 20 });
  }

  const id = String(nextOrderId++);
  const order = {
    id,
    roomNumber,
    items,
    total: total(items),
    status: STATUS_FLOW[0],
    createdAt: new Date().toISOString(),
  };
  orders.set(id, order);
  pendingQueue.enqueue(id);

  broker.publish('room_service.order_created', {
    orderId: id,
    roomNumber,
    items: items.map((it) => ({ name: it.name, qty: it.qty })), // no price/PII needed downstream
  });
  logger.info(`Yangi buyurtma #${id} - xona ${roomNumber}`);
  return { status: 201, body: order };
});

route('POST', '/orders/:id/advance', async ({ params }) => {
  const order = orders.get(params.id);
  if (!order) throw new ValidationError('Bunday buyurtma topilmadi');
  const idx = STATUS_FLOW.indexOf(order.status);
  if (idx === STATUS_FLOW.length - 1) {
    throw new ValidationError('Buyurtma allaqachon yetkazilgan');
  }
  order.status = STATUS_FLOW[idx + 1];

  const eventPayload = { orderId: order.id, roomNumber: order.roomNumber, newStatus: order.status };
  if (order.status === 'yetkazildi') {
    eventPayload.charge = { label: `Xona xizmati buyurtmasi #${order.id}`, amount: order.total };
    const qi = pendingQueue._items.indexOf(order.id);
    if (qi !== -1) pendingQueue._items.splice(qi, 1);
  }
  broker.publish('room_service.status_changed', eventPayload);
  logger.info(`Buyurtma #${order.id}: holat -> ${order.status}`);
  return { body: order };
});

server.listen(PORT, () => logger.info(`Xona Xizmati Servisi http://localhost:${PORT} portida ishlamoqda`));
