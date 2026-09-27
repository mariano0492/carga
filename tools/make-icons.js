// Genera los íconos PNG de la app sin dependencias: una barra con discos
// en rosa sobre el fondo bordó oscuro. Uso: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0e, 0x06, 0x09];
const PINK = [0xe6, 0x73, 0xac];
const WINE = [0x66, 0x00, 0x33];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
// Rectángulo redondeado en coordenadas normalizadas (0–1)
function inRRect(u, v, x, y, w, h, r) {
  if (u < x || u > x + w || v < y || v > y + h) return false;
  const cx = Math.min(Math.max(u, x + r), x + w - r), cy = Math.min(Math.max(v, y + r), y + h - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}
// scale < 1 deja margen para íconos "maskable" (zona segura de Android)
function barbell(scale) {
  return (x, y, size) => {
    const u = (x + .5) / size, v = (y + .5) / size;
    const s = (a) => .5 + (a - .5) * scale;
    const S = (a) => a * scale;
    const shapes = [
      [s(.20), s(.30), S(.09), S(.40), S(.03), PINK],    // disco grande izq.
      [s(.71), s(.30), S(.09), S(.40), S(.03), PINK],    // disco grande der.
      [s(.30), s(.36), S(.06), S(.28), S(.025), PINK],   // disco chico izq.
      [s(.64), s(.36), S(.06), S(.28), S(.025), PINK],   // disco chico der.
      [s(.14), s(.475), S(.72), S(.05), S(.02), WINE],   // barra (detrás de los discos)
    ];
    for (const [x0, y0, w, h, r, col] of shapes) if (inRRect(u, v, x0, y0, w, h, r)) return col;
    return BG;
  };
}
const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const [name, size, scale] of [['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, .78], ['apple-touch-icon.png', 180, .9]]) {
  const draw = barbell(scale);
  fs.writeFileSync(path.join(out, name), png(size, (x, y) => draw(x, y, size)));
  console.log('icons/' + name);
}
