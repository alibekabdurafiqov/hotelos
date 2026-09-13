'use strict';
/**
 * Small, dependency-free validation helpers.
 * Every service validates external input with these before acting on it (NFR-01).
 */

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPositiveNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function requireString(obj, field, { maxLen = 200 } = {}) {
  const v = obj ? obj[field] : undefined;
  if (!isNonEmptyString(v)) {
    throw new ValidationError(`"${field}" majburiy va bo'sh bo'lmagan matn bo'lishi kerak`);
  }
  if (v.length > maxLen) {
    throw new ValidationError(`"${field}" juda uzun (maksimal ${maxLen} belgi)`);
  }
  return v.trim();
}

function requireEnum(obj, field, allowedValues) {
  const v = obj ? obj[field] : undefined;
  if (!allowedValues.includes(v)) {
    throw new ValidationError(
      `"${field}" quyidagilardan biri bo'lishi kerak: ${allowedValues.join(', ')}`
    );
  }
  return v;
}

function requireNumber(obj, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const v = obj ? obj[field] : undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ValidationError(`"${field}" raqam bo'lishi kerak`);
  }
  if (v < min || v > max) {
    throw new ValidationError(`"${field}" ${min} va ${max} oralig'ida bo'lishi kerak`);
  }
  return v;
}

function requireRoomNumber(obj, field, validRoomNumbers) {
  const v = obj ? obj[field] : undefined;
  if (typeof v !== 'string' && typeof v !== 'number') {
    throw new ValidationError(`"${field}" xona raqami bo'lishi kerak`);
  }
  const asString = String(v);
  if (!validRoomNumbers.includes(asString)) {
    throw new ValidationError(`"${field}": ${asString} - mavjud bo'lmagan xona raqami`);
  }
  return asString;
}

function requireArray(obj, field) {
  const v = obj ? obj[field] : undefined;
  if (!Array.isArray(v)) {
    throw new ValidationError(`"${field}" ro'yxat (array) bo'lishi kerak`);
  }
  return v;
}

module.exports = {
  ValidationError,
  isNonEmptyString,
  isPositiveNumber,
  requireString,
  requireEnum,
  requireNumber,
  requireRoomNumber,
  requireArray,
};
