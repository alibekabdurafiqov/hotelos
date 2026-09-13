'use strict';
/**
 * Simplified demo inventory: 2 floors, 10 rooms (BRD 5-bo'lim: to'liq 120 xona shart emas).
 * ROOM_TYPES: bir_kishilik (single), ikki_kishilik (double), lyuks (suite),
 *             nogironlarga_moslashtirilgan (accessible)
 * proximity: smaller number = closer to the lift/stairs core.
 */

const ROOM_TYPES = ['bir_kishilik', 'ikki_kishilik', 'lyuks', 'nogironlarga_moslashtirilgan'];
const ROOM_STATUSES = ['toza', 'iflos', 'tozalanmoqda', 'texnik_xizmatda'];

const now = Date.now();
// lastCleanedAt is staggered so "eng uzoq toza" (longest continuously clean) is deterministic in the demo.
const rooms = [
  { number: '101', floor: 1, type: 'bir_kishilik', nightlyRate: 45, proximity: 1, lastCleanedAt: now - 9 * 3600e3 },
  { number: '102', floor: 1, type: 'bir_kishilik', nightlyRate: 45, proximity: 3, lastCleanedAt: now - 4 * 3600e3 },
  { number: '103', floor: 1, type: 'ikki_kishilik', nightlyRate: 65, proximity: 2, lastCleanedAt: now - 7 * 3600e3 },
  { number: '104', floor: 1, type: 'ikki_kishilik', nightlyRate: 65, proximity: 5, lastCleanedAt: now - 2 * 3600e3 },
  { number: '105', floor: 1, type: 'nogironlarga_moslashtirilgan', nightlyRate: 65, proximity: 1, lastCleanedAt: now - 6 * 3600e3 },
  { number: '201', floor: 2, type: 'bir_kishilik', nightlyRate: 45, proximity: 1, lastCleanedAt: now - 8 * 3600e3 },
  { number: '202', floor: 2, type: 'ikki_kishilik', nightlyRate: 65, proximity: 2, lastCleanedAt: now - 5 * 3600e3 },
  { number: '203', floor: 2, type: 'lyuks', nightlyRate: 120, proximity: 4, lastCleanedAt: now - 10 * 3600e3 },
  { number: '204', floor: 2, type: 'lyuks', nightlyRate: 120, proximity: 6, lastCleanedAt: now - 1 * 3600e3 },
  { number: '205', floor: 2, type: 'ikki_kishilik', nightlyRate: 65, proximity: 3, lastCleanedAt: now - 3 * 3600e3 },
];

function seedRooms() {
  // status is set separately (mutable at runtime) so each service run starts fresh
  return rooms.map((r) => ({ ...r, status: 'toza', occupied: false }));
}

module.exports = { ROOM_TYPES, ROOM_STATUSES, seedRooms };
