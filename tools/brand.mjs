// Tripfolio · generador de la marca (iconos e imágenes de arranque).
// Uso: node tools/brand.mjs  → escribe icons/*.png y icons/logo.svg (necesita Playwright).
import { writeFileSync, mkdirSync } from 'node:fs';

export const BG = '#121012';
const MAP = 'M12.6 24.4 L24.3 19.4 L38.7 24.8 L50.4 19.9 L50.4 49.6 L38.7 54.5 L24.3 49.1 L12.6 54.1 Z';
const PIN = 'M32 8.5 a10 10 0 0 1 10 10 c0 7.8 -10 15.5 -10 15.5 s-10 -7.7 -10 -15.5 a10 10 0 0 1 10 -10z';

export function defs(p = 'tf') {
  return `<defs>
<linearGradient id="${p}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C2A2E"/><stop offset=".5" stop-color="#151315"/><stop offset="1" stop-color="#0B0A0B"/></linearGradient>
<linearGradient id="${p}s" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#FFD25A"/><stop offset=".35" stop-color="#FF9440"/><stop offset=".68" stop-color="#FF5A5F"/><stop offset="1" stop-color="#D9459C"/></linearGradient>
<linearGradient id="${p}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB25A"/><stop offset="1" stop-color="#FF4F6A"/></linearGradient>
<linearGradient id="${p}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="${p}f" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>`;
}

// Símbolo (mapa plegado + pin) en una rejilla de 64. `cut` es el color de los cortes (fondo).
export function glyph(p = 'tf', cut = BG) {
  return `<g class="tf-map"><path d="${MAP}" fill="url(#${p}s)" opacity=".5" filter="url(#${p}f)"/>
<path d="${MAP}" fill="url(#${p}s)" stroke="url(#${p}s)" stroke-width="2" stroke-linejoin="round"/>
<path d="${MAP}" fill="url(#${p}h)"/>
<path d="M24.3 19.4 V49.1 M38.7 24.8 V54.5" stroke="${cut}" stroke-width="2.4" opacity=".55"/></g>
<ellipse class="tf-shadow" cx="32" cy="35.6" rx="4.6" ry="1.4" fill="${cut}" opacity=".5"/>
<g class="tf-pin"><path d="${PIN}" fill="url(#${p}p)" stroke="${cut}" stroke-width="3.2" paint-order="stroke"/>
<path d="${PIN}" fill="url(#${p}h)"/><circle cx="32" cy="18.5" r="3.4" fill="#F7F1EE"/></g>`;
}

// Icono completo. rounded=false para iOS/maskable (el sistema recorta). scale reduce el símbolo (zona segura).
export function icon({ size = 512, rounded = false, scale = 1 } = {}) {
  const tr = scale === 1 ? '' : ` transform="translate(32 32) scale(${scale}) translate(-32 -32)"`;
  const rx = rounded ? 14.5 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${defs()}
<rect width="64" height="64" rx="${rx}" fill="url(#tft)"/>
${rounded ? '<rect x=".6" y=".6" width="62.8" height="62.8" rx="14" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.2"/>' : ''}
<g${tr}>${glyph('tf', '#141214')}</g></svg>`;
}

// Tamaños de pantalla de iPhone (puntos CSS y escala) para apple-touch-startup-image.
export const SCREENS = [
  [375, 667, 2], [414, 896, 2], [375, 812, 3], [414, 896, 3], [390, 844, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(import.meta.url)('playwright');
  const out = new URL('../icons/', import.meta.url).pathname;
  mkdirSync(out, { recursive: true });
  writeFileSync(out + 'logo.svg', icon({ size: 64, rounded: true }));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shot = async (svg, w, h, file, bg = 'transparent') => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${w}px;height:${h}px">${svg}</body></html>`);
    await page.screenshot({ path: out + file, omitBackground: bg === 'transparent' });
  };
  await shot(icon({ size: 180 }), 180, 180, 'apple-touch-icon.png');
  await shot(icon({ size: 192, rounded: true }), 192, 192, 'icon-192.png');
  await shot(icon({ size: 512, rounded: true }), 512, 512, 'icon-512.png');
  await shot(icon({ size: 512, scale: 0.8 }), 512, 512, 'icon-maskable-512.png');
  await shot(icon({ size: 64, rounded: true }), 64, 64, 'favicon-64.png');
  // Arranque iOS: fondo liso del color de la app (la animación aparece encima al cargar).
  for (const [w, h, s] of SCREENS) await shot('', w * s, h * s, `startup-${w * s}x${h * s}.png`, BG);
  await browser.close();
  console.log('ok');
}
