class Queue {
  constructor() { this.items = new Map(); this.head = 0; this.tail = 0; }
  enqueue(value) { this.items.set(this.tail++, value); return this.size; }
  dequeue() { if (this.isEmpty()) return undefined; const value = this.items.get(this.head); this.items.delete(this.head++); if (this.isEmpty()) this.head = this.tail = 0; return value; }
  peek() { return this.items.get(this.head); }
  get size() { return this.tail - this.head; }
  isEmpty() { return this.size === 0; }
}
module.exports = Queue;
