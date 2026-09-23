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
  const background = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: BG.r, g: BG.g, b: BG.b, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const glyphBuffer = await glyph(glyphSize).png().toBuffer();
  return sharp(background)
    .composite([{ input: glyphBuffer, left: inset, top: inset }])
    .png()
    .toBuffer();
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4); // image count
  let offset = 6 + 16 * entries.length;
  const dirEntries = [];
  const blobs = [];
  for (const { size, buf } of entries) {
    const dirEntry = Buffer.alloc(16);
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    dirEntry.writeUInt8(0, 2); // palette
    dirEntry.writeUInt8(0, 3); // reserved
    dirEntry.writeUInt16LE(1, 4); // color planes
    dirEntry.writeUInt16LE(32, 6); // bits per pixel
    dirEntry.writeUInt32LE(buf.length, 8);
    dirEntry.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirEntries.push(dirEntry);
    blobs.push(buf);
  }
  return Buffer.concat([header, ...dirEntries, ...blobs]);
}

(async () => {
  // Transparent PNGs for the browser tab (light + dark themes both fine)
  for (const size of [16, 32]) {
    fs.writeFileSync(`${OUT}/favicon-${size}x${size}.png`, await glyph(size).png().toBuffer());
    console.log(`favicon-${size}x${size}.png ✓`);
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
  for (const size of [192, 512]) {
    fs.writeFileSync(`${OUT}/icon-${size}x${size}.png`, await appIcon(size));
    console.log(`icon-${size}x${size}.png ✓`);
  }
  fs.writeFileSync(`${OUT}/apple-touch-icon.png`, await appIcon(180));
  console.log("apple-touch-icon.png ✓");
})();
