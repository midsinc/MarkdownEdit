const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });

// --- App Icon SVG ---
function createAppIconSVG(size) {
  const s = size;
  const r = Math.round(s * 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6C63FF"/>
      <stop offset="100%" style="stop-color:#3B82F6"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#A78BFA"/>
      <stop offset="100%" style="stop-color:#60A5FA"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${s}" height="${s}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <rect x="${s*0.02}" y="${s*0.02}" width="${s*0.96}" height="${s*0.96}" rx="${r*0.9}" ry="${r*0.9}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="${Math.max(1, s*0.015)}"/>
  <text x="${s*0.5}" y="${s*0.58}"
    font-family="'Segoe UI','SF Pro Display','Helvetica Neue',Arial,sans-serif"
    font-weight="800"
    font-size="${s*0.52}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-${s*0.02}">M</text>
  <polygon points="${s*0.5},${s*0.88} ${s*0.42},${s*0.76} ${s*0.58},${s*0.76}" fill="url(#accent)"/>
  <text x="${s*0.72}" y="${s*0.78}"
    font-family="'Segoe UI','SF Pro Display','Helvetica Neue',Arial,sans-serif"
    font-weight="700"
    font-size="${s*0.18}"
    fill="rgba(255,255,255,0.85)"
    text-anchor="middle"
    dominant-baseline="central">d</text>
</svg>`;
}

// --- File Icon SVG ---
function createFileIconSVG(size) {
  const s = size;
  const margin = s * 0.08;
  const foldSize = s * 0.22;
  const w = s - margin * 2;
  const h = s - margin * 2;
  const x = margin;
  const y = margin;
  const r = s * 0.04;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="docbg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f8f9fa"/>
      <stop offset="100%" style="stop-color:#e9ecef"/>
    </linearGradient>
    <linearGradient id="fold2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#dee2e6"/>
      <stop offset="100%" style="stop-color:#ced4da"/>
    </linearGradient>
    <linearGradient id="badge2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6C63FF"/>
      <stop offset="100%" style="stop-color:#3B82F6"/>
    </linearGradient>
  </defs>
  <path d="M${x+r},${y} L${x+w-foldSize},${y} L${x+w},${y+foldSize} L${x+w},${y+h-r} Q${x+w},${y+h} ${x+w-r},${y+h} L${x+r},${y+h} Q${x},${y+h} ${x},${y+h-r} L${x},${y+r} Q${x},${y} ${x+r},${y} Z"
    fill="url(#docbg2)" stroke="#adb5bd" stroke-width="${Math.max(1, s*0.015)}"/>
  <path d="M${x+w-foldSize},${y} L${x+w-foldSize},${y+foldSize} L${x+w},${y+foldSize} Z"
    fill="url(#fold2)" stroke="#adb5bd" stroke-width="${Math.max(1, s*0.012)}"/>
  <rect x="${x+w*0.12}" y="${y+h*0.28}" width="${w*0.55}" height="${Math.max(2, s*0.03)}" rx="${Math.max(1, s*0.01)}" fill="#ced4da"/>
  <rect x="${x+w*0.12}" y="${y+h*0.38}" width="${w*0.7}" height="${Math.max(2, s*0.03)}" rx="${Math.max(1, s*0.01)}" fill="#dee2e6"/>
  <rect x="${x+w*0.12}" y="${y+h*0.48}" width="${w*0.45}" height="${Math.max(2, s*0.03)}" rx="${Math.max(1, s*0.01)}" fill="#dee2e6"/>
  <rect x="${x+w*0.15}" y="${y+h*0.6}" width="${w*0.7}" height="${h*0.28}" rx="${Math.max(2, s*0.04)}" fill="url(#badge2)"/>
  <text x="${s*0.5}" y="${y+h*0.76}"
    font-family="'Segoe UI','SF Pro Display','Helvetica Neue',Arial,sans-serif"
    font-weight="800"
    font-size="${s*0.2}"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="${s*0.01}">MD</text>
</svg>`;
}

// --- Build ICO from PNG buffers ---
function createIco(pngBuffers) {
  // ICO format: ICONDIR header + ICONDIRENTRY array + image data
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * count;

  // Calculate total size
  let totalImageSize = 0;
  for (const buf of pngBuffers) totalImageSize += buf.length;

  const ico = Buffer.alloc(dirSize + totalImageSize);

  // ICONDIR header
  ico.writeUInt16LE(0, 0);      // Reserved
  ico.writeUInt16LE(1, 2);      // Type: 1 = ICO
  ico.writeUInt16LE(count, 4);  // Number of images

  let offset = dirSize;
  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i];
    const entryOffset = headerSize + i * entrySize;

    // Parse PNG to get dimensions
    // PNG header: 8 bytes signature, then IHDR chunk (4 len + 4 type + 4 width + 4 height)
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);

    // ICONDIRENTRY
    ico.writeUInt8(width >= 256 ? 0 : width, entryOffset);      // Width (0 = 256)
    ico.writeUInt8(height >= 256 ? 0 : height, entryOffset + 1); // Height (0 = 256)
    ico.writeUInt8(0, entryOffset + 2);                           // Color palette
    ico.writeUInt8(0, entryOffset + 3);                           // Reserved
    ico.writeUInt16LE(1, entryOffset + 4);                        // Color planes
    ico.writeUInt16LE(32, entryOffset + 6);                       // Bits per pixel
    ico.writeUInt32LE(png.length, entryOffset + 8);               // Image size
    ico.writeUInt32LE(offset, entryOffset + 12);                  // Image offset

    png.copy(ico, offset);
    offset += png.length;
  }

  return ico;
}

async function generateIcons() {
  console.log('Generating app icons...');

  const sizes = [16, 32, 48, 64, 128, 256];
  const appPngBuffers = [];

  for (const size of sizes) {
    const svg = createAppIconSVG(size);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    appPngBuffers.push(buf);
    console.log(`  App icon ${size}x${size}`);
  }

  // 512px PNG for general use
  const svg512 = createAppIconSVG(512);
  await sharp(Buffer.from(svg512)).png().toFile(path.join(buildDir, 'icon.png'));
  console.log('  icon.png (512x512)');

  // Create ICO
  const appIco = createIco(appPngBuffers);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), appIco);
  console.log('  icon.ico');

  // File type icons
  console.log('Generating file type icons...');
  const filePngBuffers = [];

  for (const size of sizes) {
    const svg = createFileIconSVG(size);
    const buf = await sharp(Buffer.from(svg)).png().toBuffer();
    filePngBuffers.push(buf);
    console.log(`  File icon ${size}x${size}`);
  }

  const fileIco = createIco(filePngBuffers);
  fs.writeFileSync(path.join(buildDir, 'md-file-icon.ico'), fileIco);
  console.log('  md-file-icon.ico');

  console.log('\nAll icons generated in build/');
}

generateIcons().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
