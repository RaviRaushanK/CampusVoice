class LinkedList {
  constructor(values = []) { this.head = null; this.tail = null; this.count = 0; for (const value of values) this.append(value); }
  append(value) { const node = { value, next: null }; if (this.tail) this.tail.next = node; else this.head = node; this.tail = node; this.count++; return this; }
  find(predicate) { for (let node = this.head; node; node = node.next) if (predicate(node.value)) return node.value; return undefined; }
  *[Symbol.iterator]() { for (let node = this.head; node; node = node.next) yield node.value; }
  toArray() { return [...this]; }
  get size() { return this.count; }
  isEmpty() { return this.count === 0; }
}
module.exports = LinkedList;
