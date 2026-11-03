// Returns the first matching index in a sorted array, or -1.
const binarySearch = (items, target, compare = (a, b) => a - b) => {
  let low = 0, high = items.length - 1, found = -1;
  while (low <= high) { const middle = Math.floor((low + high) / 2), order = compare(items[middle], target); if (order < 0) low = middle + 1; else { if (order === 0) found = middle; high = middle - 1; } }
  return found;
};
const linearSearchAll = (items, predicate) => { const matches = []; for (let index = 0; index < items.length; index++) if (predicate(items[index], index)) matches.push(items[index]); return matches; };
module.exports = { binarySearch, linearSearchAll };
