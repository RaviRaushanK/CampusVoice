export default class Stack {
  constructor(limit = 50) { if (!Number.isInteger(limit) || limit < 1) throw new Error("Stack limit must be a positive integer."); this.limit = limit; this.clear(); }
  push(value) { const index = (this.start + this.count) % this.limit; this.items[index] = value; if (this.count === this.limit) this.start = (this.start + 1) % this.limit; else this.count++; return this.size; }
  pop() { if (this.isEmpty()) return undefined; const index = (this.start + --this.count) % this.limit, value = this.items[index]; this.items[index] = undefined; return value; }
  peek() { return this.isEmpty() ? undefined : this.items[(this.start + this.count - 1) % this.limit]; }
  get size() { return this.count; }
  isEmpty() { return this.count === 0; }
  clear() { this.items = new Array(this.limit); this.start = 0; this.count = 0; }
}
