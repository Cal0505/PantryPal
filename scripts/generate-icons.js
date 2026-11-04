import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b, a = 255) {
  // Simple PNG generator with solid color and scanner bars in center
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc((rowSize + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      
      // Determine if pixel is inside barcode box or scanner beam
      const cx = x / width;
      const cy = y / height;
      
      let pr = r;
      let pg = g;
      let pb = b;
      let pa = a;

      // Dark blue-slate background (#0f172a)
      pr = 15;
      pg = 23;
      pb = 42;

      // Inner scanner target box (between 25% and 75%)
      if (cx >= 0.25 && cx <= 0.75 && cy >= 0.25 && cy <= 0.75) {
        // Red laser line in the middle
        if (Math.abs(cy - 0.5) <= 0.02) {
          pr = 239;
          pg = 68;
          pb = 68;
        } else {
          // Barcode stripes
          const stripePos = (cx - 0.25) / 0.5; // 0 to 1
          const stripeIndex = Math.floor(stripePos * 14);
          const isBar = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0][stripeIndex];
          if (isBar) {
            pr = 241;
            pg = 245;
            pb = 249;
          } else {
            pr = 30;
            pg = 41;
            pb = 59;
          }
        }
      }

      rawData[pixelOffset] = pr;
      rawData[pixelOffset + 1] = pg;
      rawData[pixelOffset + 2] = pb;
      rawData[pixelOffset + 3] = pa;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 15, 23, 42));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 15, 23, 42));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, 15, 23, 42));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 15, 23, 42));
fs.writeFileSync('public/favicon.ico', createPNG(32, 32, 15, 23, 42));

console.log('Successfully generated PWA icons in /public');
