class PriorityQueue {
  constructor(compare) { this.items = []; this.compare = compare; }
  get size() { return this.items.length; }
  isEmpty() { return this.size === 0; }
  peek() { return this.items[0]; }
  enqueue(value) {
    this.items.push(value); let index = this.size - 1;
    while (index > 0) { const parent = Math.floor((index - 1) / 2); if (this.compare(this.items[index], this.items[parent]) >= 0) break; [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]]; index = parent; }
    return this.size;
  }
  dequeue() {
    if (this.isEmpty()) return undefined;
    const first = this.items[0], last = this.items.pop();
    if (this.size) {
      this.items[0] = last; let index = 0;
      while (true) { const left = index * 2 + 1, right = left + 1; let best = index; if (left < this.size && this.compare(this.items[left], this.items[best]) < 0) best = left; if (right < this.size && this.compare(this.items[right], this.items[best]) < 0) best = right; if (best === index) break; [this.items[index], this.items[best]] = [this.items[best], this.items[index]]; index = best; }
    }
    return first;
  }
}
module.exports = PriorityQueue;
