const mergeSort = (items, compare = (a, b) => a - b) => {
  if (items.length < 2) return [...items];
  const middle = Math.floor(items.length / 2), left = mergeSort(items.slice(0, middle), compare), right = mergeSort(items.slice(middle), compare), output = [];
  let first = 0, second = 0;
  while (first < left.length && second < right.length) output.push(compare(left[first], right[second]) <= 0 ? left[first++] : right[second++]);
  return output.concat(left.slice(first), right.slice(second));
};
module.exports = { mergeSort };
