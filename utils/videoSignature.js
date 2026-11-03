// Bounded container-header checks, not media decoding or malware scanning.
// Format references: https://mp4ra.org/registered-types/brands
// https://www.webmproject.org/docs/container/
const vint = (bytes, offset, maximum = 8) => {
  if (offset >= bytes.length) return null;
  let length = 1, marker = 0x80;
  while (length <= maximum && !(bytes[offset] & marker)) { length++; marker >>= 1; }
  if (length > maximum || offset + length > bytes.length) return null;
  let value = bytes[offset] & (marker - 1);
  for (let index = 1; index < length; index++) value = value * 256 + bytes[offset + index];
  return Number.isSafeInteger(value) ? { length, value } : null;
};
module.exports = (bytes, mime) => {
  if (mime === "video/mp4") {
    if (bytes.length < 16 || bytes.toString("ascii", 4, 8) !== "ftyp") return false;
    const size = bytes.readUInt32BE(0);
    if (size < 16 || size > bytes.length || size > 4096 || size % 4) return false;
    const brands = [bytes.toString("ascii", 8, 12)];
    for (let offset = 16; offset < size; offset += 4) brands.push(bytes.toString("ascii", offset, offset + 4));
    return brands.some(brand => /^(isom|iso[1-9]|mp4[12]|avc1|dash|M4V )$/.test(brand));
  }
  if (mime !== "video/webm" || bytes.length < 5 || bytes.readUInt32BE(0) !== 0x1a45dfa3) return false;
  const header = vint(bytes, 4);
  if (!header) return false;
  const end = 4 + header.length + header.value;
  if (end > bytes.length || end > 4096) return false;
  let offset = 4 + header.length, webm = false;
  while (offset < end) {
    const id = vint(bytes, offset, 4);
    if (!id) return false;
    const identifier = bytes.readUIntBE(offset, id.length);
    offset += id.length;
    const size = vint(bytes, offset);
    if (!size || offset + size.length + size.value > end) return false;
    offset += size.length;
    if (identifier === 0x4282) {
      if (bytes.toString("ascii", offset, offset + size.value) !== "webm") return false;
      webm = true;
    }
    offset += size.value;
  }
  return webm;
};
