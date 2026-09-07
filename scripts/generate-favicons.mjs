import sharp from "sharp";
import fs from "fs";

const SRC = "public/brand/logo_full.png";
const OUT = "public";
const BG = { r: 2, g: 6, b: 23 }; // #020617 (manifest background_color / app dark bg)

/** Resize the raw transparent glyph to exactly W x W (aspect ~1.006 → negligible) */
const glyph = (size) => sharp(SRC).resize(size, size, { fit: "fill" });

/** Glyph composited onto a solid brand-background square (with ~8% breathing room) */
async function appIcon(size) {
  const inset = Math.round(size * 0.06);
  const glyphSize = size - inset * 2;
  const bg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: BG.r, g: BG.g, b: BG.b, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const g = await glyph(glyphSize).png().toBuffer();
  return sharp(bg)
    .composite([{ input: g, left: inset, top: inset }])
    .png()
    .toBuffer();
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4); // image count
  let offset = 6 + 16 * entries.length;
  const dir = [];
  const blobs = [];
  for (const { size, buf } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    dir.push(e);
    blobs.push(buf);
  }
  return Buffer.concat([header, ...dir, ...blobs]);
}

(async () => {
  // Transparent PNGs for the browser tab (light + dark themes both fine)
  for (const s of [16, 32]) {
    fs.writeFileSync(`${OUT}/favicon-${s}x${s}.png`, await glyph(s).png().toBuffer());
    console.log(`favicon-${s}x${s}.png ✓`);
  }

  // Multi-size classic .ico (PNG-compressed entries — supported by modern browsers)
  const ico = buildIco([
    { size: 16, buf: await glyph(16).png().toBuffer() },
    { size: 32, buf: await glyph(32).png().toBuffer() },
    { size: 48, buf: await glyph(48).png().toBuffer() },
  ]);
  fs.writeFileSync(`${OUT}/favicon.ico`, ico);
  console.log("favicon.ico ✓");

  // Solid-background squares for PWA manifest + iOS home screen
  for (const s of [192, 512]) {
    fs.writeFileSync(`${OUT}/icon-${s}x${s}.png`, await appIcon(s));
    console.log(`icon-${s}x${s}.png ✓`);
  }
  fs.writeFileSync(`${OUT}/apple-touch-icon.png`, await appIcon(180));
  console.log("apple-touch-icon.png ✓");
})();
