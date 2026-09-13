'use strict';
/**
 * Minimal async mutex. Used by the Reception service to serialize room
 * assignment so two concurrent check-ins can never grab the same room
 * (BRD 8-bo'lim risk: "Race condition (bir vaqtda xona holatini yangilash)",
 * exercised by TS-06 and documented as the Task 4 debugging example).
 */
class Mutex {
  constructor() {
    this._locked = false;
    this._waiting = [];
  }

  lock() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve(this._makeRelease());
      } else {
        this._waiting.push(resolve);
      }
    });
  }

  _makeRelease() {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this._waiting.length > 0) {
        const next = this._waiting.shift();
        next(this._makeRelease());
      } else {
        this._locked = false;
      }
    };
  }
}

module.exports = { Mutex };
