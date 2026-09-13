'use strict';
/**
 * Qabul Servisi (Reception Service)
 * ---------------------------------
 * Responsibilities (TZ 3.1 / SRS FR-01, FR-02):
 *   - check-in: room assignment algorithm
 *   - check-out: billing algorithm, publishes room.checked_out
 *   - owns the room inventory (Array) and guest records (Map)
 *
 * Publishes: room.checked_out
 * Subscribes: room.status_changed (keep the authoritative room list in sync
 *             with housekeeping - this one IS in the SRS 3.6 table),
 *             room_service.status_changed (add delivered charges to the
 *             guest's folio) and maintenance.reported / maintenance.resolved
 *             (keep "texnik_xizmatda" status in sync). The latter two are a
 *             small, deliberate, documented extension of the SRS 3.6 table -
 *             see README "Talqin eslatmalari" for the reasoning.
 */

const { createJsonServer } = require('../shared/http-json');
const { connectToBroker } = require('../shared/broker-client');
const { makeLogger } = require('../shared/logger');
const { Mutex } = require('../shared/mutex');
const { seedRooms, ROOM_TYPES } = require('../data/rooms');
const {
  requireString,
  requireEnum,
  requireNumber,
  requireRoomNumber,
  requireArray,
  ValidationError,
} = require('../shared/validate');

const PORT = process.env.RECEPTION_PORT || 7001;
const logger = makeLogger('reception');

const rooms = seedRooms(); // Array - room inventory (FR-08)
const guestRecords = new Map(); // Map: xona_raqami -> mehmon ma'lumoti (FR-08)
const roomAssignmentLock = new Mutex();

const broker = connectToBroker({ serviceName: 'reception', logger });

function publicRoom(r) {
  // Never expose guest PII through the room list - only operational fields (NFR-03).
  return {
    number: r.number,
    floor: r.floor,
    type: r.type,
    status: r.status,
    occupied: r.occupied,
    proximity: r.proximity,
  };
}

/**
 * FR-01 xona tayinlash algoritmi.
 * Ustuvorlik tartibi: tur mosligi (qat'iy) -> faqat "toza" -> eng uzoq toza ->
 * qavat afzalligi (ixtiyoriy) -> yaqinlik afzalligi (ixtiyoriy, oxirgi hal qiluvchi).
 */
function assignRoom({ roomType, floorPreference, proximityPreference }) {
  let candidates = rooms.filter((r) => r.type === roomType && r.status === 'toza' && !r.occupied);

  if (candidates.length === 0) {
    const altType = ROOM_TYPES.find(
      (t) => t !== roomType && rooms.some((r) => r.type === t && r.status === 'toza' && !r.occupied)
    );
    const err = new ValidationError('Hozircha mos xona mavjud emas');
    err.statusCode = 409;
    err.alternative = altType
      ? { message: `Muqobil xona turi mavjud: ${altType}`, suggestedType: altType }
      : { message: 'Hozircha hech qanday xona bo\'sh emas - kutish ro\'yxatiga qo\'shildi', waitlisted: true };
    throw err;
  }

  // Eng uzoq toza: lastCleanedAt eng kichik (eng ilgari tozalangan) -> eng yuqori ustuvorlik.
  candidates = [...candidates].sort((a, b) => a.lastCleanedAt - b.lastCleanedAt);

  if (floorPreference !== undefined && floorPreference !== null) {
    const onPreferredFloor = candidates.filter((r) => r.floor === floorPreference);
    if (onPreferredFloor.length > 0) candidates = onPreferredFloor;
  }

  if (proximityPreference !== undefined && proximityPreference !== null && candidates.length > 1) {
    candidates = [...candidates].sort(
      (a, b) => Math.abs(a.proximity - proximityPreference) - Math.abs(b.proximity - proximityPreference)
    );
  }

  return candidates[0];
}

function computeBill({ room, nights, serviceCharges, extraCharges, discount }) {
  const asosiy = room.nightlyRate * nights;
  const xizmatJami = serviceCharges.reduce((sum, c) => sum + c.amount, 0);
  const qoshimchaJami = extraCharges.reduce((sum, c) => sum + c.amount, 0);
  let jami = asosiy + xizmatJami + qoshimchaJami - (discount || 0);
  if (jami < 0) jami = 0; // never invoice a negative total
  return {
    asosiyNarx: asosiy,
    xizmatJami,
    qoshimchaJami,
    chegirma: discount || 0,
    jamiSumma: Math.round(jami * 100) / 100,
  };
}

// ---- Broker subscriptions ----------------------------------------------

broker.on('room_service.status_changed', ({ roomNumber, newStatus, charge }) => {
  if (newStatus !== 'yetkazildi' || !charge) return;
  const guest = guestRecords.get(roomNumber);
  if (!guest) return;
  guest.serviceCharges.push(charge);
  logger.info(`${roomNumber} xonasiga xona xizmati to'lovi qo'shildi: ${charge.amount}`);
});

broker.on('room.status_changed', ({ roomNumber, newStatus }) => {
  const room = rooms.find((r) => r.number === roomNumber);
  // A room already put back into service by maintenance should not be
  // silently overwritten by a stale housekeeping update.
  if (room && room.status !== 'texnik_xizmatda') room.status = newStatus;
});

broker.on('maintenance.reported', ({ roomNumber }) => {
  const room = rooms.find((r) => r.number === roomNumber);
  if (room) room.status = 'texnik_xizmatda';
});

broker.on('maintenance.resolved', ({ roomNumber }) => {
  const room = rooms.find((r) => r.number === roomNumber);
  if (room && room.status === 'texnik_xizmatda') {
    room.status = room.occupied ? 'toza' : 'iflos';
  }
});

// ---- HTTP API ------------------------------------------------------------

const { server, route } = createJsonServer(logger);

route('GET', '/rooms', async () => ({ body: rooms.map(publicRoom) }));

route('GET', '/guests/:number', async ({ params }) => {
  const number = requireRoomNumber(params, 'number', rooms.map((r) => r.number));
  const guest = guestRecords.get(number);
  if (!guest) return { status: 404, body: { error: 'Bu xonada faol mehmon yo\'q' } };
  return { body: guest };
});

route('POST', '/checkin', async ({ body }) => {
  const guestName = requireString(body, 'guestName', { maxLen: 120 });
  const roomType = requireEnum(body, 'roomType', ROOM_TYPES);
  const nights = requireNumber(body, 'nights', { min: 1, max: 60 });
  const floorPreference =
    body.floorPreference !== undefined && body.floorPreference !== null
      ? requireNumber(body, 'floorPreference', { min: 1, max: 2 })
      : null;
  const proximityPreference =
    body.proximityPreference !== undefined && body.proximityPreference !== null
      ? requireNumber(body, 'proximityPreference', { min: 0, max: 100 })
      : null;

  // Serialize assignment to eliminate the double-booking race condition (BRD risk / TS-06).
  const release = await roomAssignmentLock.lock();
  let room;
  try {
    room = assignRoom({ roomType, floorPreference, proximityPreference });
    room.occupied = true;
    guestRecords.set(room.number, {
      guestName,
      nights,
      checkInAt: new Date().toISOString(),
      serviceCharges: [],
    });
  } finally {
    release();
  }

  logger.info(`Check-in: ${guestName} -> xona ${room.number}`);
  return { status: 201, body: { room: publicRoom(room), guestName, nights } };
});

route('POST', '/checkout/:number', async ({ params, body }) => {
  const number = requireRoomNumber(params, 'number', rooms.map((r) => r.number));
  const room = rooms.find((r) => r.number === number);
  const guest = guestRecords.get(number);
  if (!guest) {
    return { status: 409, body: { error: 'Bu xonada faol mehmon yo\'q, check-out qilib bo\'lmaydi' } };
  }
  const extraCharges = body.extraCharges !== undefined ? requireArray(body, 'extraCharges') : [];
  for (const c of extraCharges) {
    requireString(c, 'label', { maxLen: 80 });
    requireNumber(c, 'amount', { min: 0, max: 100000 });
  }
  const discount =
    body.discount !== undefined && body.discount !== null
      ? requireNumber(body, 'discount', { min: 0, max: 100000 })
      : 0;

  const bill = computeBill({
    room,
    nights: guest.nights,
    serviceCharges: guest.serviceCharges,
    extraCharges,
    discount,
  });

  guestRecords.delete(number);
  room.occupied = false;
  room.status = 'iflos';

  broker.publish('room.checked_out', { roomNumber: number, time: new Date().toISOString() });
  logger.info(`Check-out: xona ${number}, jami=${bill.jamiSumma}`);

  return { body: { roomNumber: number, bill } };
});

server.listen(PORT, () => logger.info(`Qabul Servisi http://localhost:${PORT} portida ishlamoqda`));
