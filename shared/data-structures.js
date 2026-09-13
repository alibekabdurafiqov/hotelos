'use strict';
/**
 * Data structures explicitly required by SRS 3.8 (FR-08):
 *   - Priority queue (binary min-heap) -> used by Maintenance service
 *   - FIFO queue (array based)         -> used by Housekeeping & Room Service
 *
 * Guest records use a plain Map (room number -> guest info), and the room
 * inventory is a plain Array - see data/rooms.js and services/reception.js.
 */

/** Simple FIFO queue. */
class Queue {
  constructor() {
    this._items = [];
  }
  enqueue(item) {
    this._items.push(item);
  }
  dequeue() {
    return this._items.shift();
  }
  peek() {
    return this._items[0];
  }
  get size() {
    return this._items.length;
  }
  toArray() {
    return [...this._items];
  }
}

/**
 * Binary min-heap based priority queue.
 * Lower `priorityKey` (compared with the comparator) is served first.
 * Used for maintenance requests: (urgencyRank, timestamp) so that
 * Kritik > Yuqori > Normal > Past, and FIFO order breaks ties (SRS FR-03).
 */
class PriorityQueue {
  constructor(compareFn) {
    // compareFn(a, b) < 0  => a has higher priority (comes first)
    this._heap = [];
    this._compare = compareFn;
  }

  get size() {
    return this._heap.length;
  }

  push(item) {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
  }

  pop() {
    if (this._heap.length === 0) return undefined;
    const top = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._bubbleDown(0);
    }
    return top;
  }

  peek() {
    return this._heap[0];
  }

  toArray() {
    // Returns a snapshot sorted by priority (does not mutate the heap).
    return [...this._heap].sort(this._compare);
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this._compare(this._heap[index], this._heap[parent]) < 0) {
        [this._heap[index], this._heap[parent]] = [this._heap[parent], this._heap[index]];
        index = parent;
      } else {
        break;
      }
    }
  }

  _bubbleDown(index) {
    const n = this._heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < n && this._compare(this._heap[left], this._heap[smallest]) < 0) smallest = left;
      if (right < n && this._compare(this._heap[right], this._heap[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      [this._heap[index], this._heap[smallest]] = [this._heap[smallest], this._heap[index]];
      index = smallest;
    }
  }
}

module.exports = { Queue, PriorityQueue };
