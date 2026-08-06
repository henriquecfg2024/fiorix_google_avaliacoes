const fs = require('fs');
const path = require('path');

// Basic 1x1 PNG blue pixel expanded buffer or minimal valid PNG header with #002B49 fill
function createMinimalPng(width, height) {
  // We can write a simple SVG to PNG or valid PNG buffer
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#002B49"/>
    <rect x="${width*0.1}" y="${height*0.1}" width="${width*0.8}" height="${height*0.8}" rx="${width*0.2}" fill="#1e3a8a"/>
    <text x="50%" y="58%" font-family="Arial, sans-serif" font-weight="900" font-size="${width*0.5}px" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">F</text>
  </svg>`;
  return svg;
}

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), createMinimalPng(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), createMinimalPng(512, 512));
console.log('Icons generated!');
