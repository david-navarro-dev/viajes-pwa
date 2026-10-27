// Visor de documentos a pantalla completa (imágenes y PDF).
// Empieza mostrando el documento entero ajustado a la pantalla; se amplía pellizcando
// o con doble toque (útil para los QR). Los PDF se dibujan con PDF.js, también sin conexión.

let pdfjsP = null;
function pdfjs() {
  if (!pdfjsP) pdfjsP = import('../vendor/pdfjs/pdf.mjs').then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
    return m;
  });
  return pdfjsP;
}

const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>';
const PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Abre el visor. files: [{ name, type, blob }], index: el que se muestra primero. */
export function openViewer(files, index = 0) {
  let i = index, zoom = null, urls = [], token = 0;
  const ov = document.createElement('div');
  ov.className = 'viewer-ov';
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `<div class="vw-top"><button class="vw-btn" data-vw="close" aria-label="Cerrar">${X}</button>
      <div class="vw-title"><b></b><span></span></div>
      <button class="vw-btn" data-vw="share" aria-label="Compartir o abrir en otra app">${SHARE}</button></div>
    <div class="vw-stage"><div class="vw-content"></div><div class="vw-loading">Cargando…</div></div>
    <div class="vw-bottom">${files.length > 1 ? `<button class="vw-btn" data-vw="prev" aria-label="Anterior">${PREV}</button>` : '<span></span>'}
      <span class="vw-hint">Pellizca o toca dos veces para ampliar</span>
      ${files.length > 1 ? `<button class="vw-btn" data-vw="next" aria-label="Siguiente">${NEXT}</button>` : '<span></span>'}</div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add('vw-open');
  const stage = ov.querySelector('.vw-stage'), content = ov.querySelector('.vw-content'), loading = ov.querySelector('.vw-loading');

  const close = () => {
    token++; zoom?.destroy(); urls.forEach(u => URL.revokeObjectURL(u));
    document.removeEventListener('keydown', onKey);
    ov.classList.add('out'); document.documentElement.classList.remove('vw-open');
    setTimeout(() => ov.remove(), 180);
  };
  const onKey = e => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight' && files.length > 1) show(i + 1);
    if (e.key === 'ArrowLeft' && files.length > 1) show(i - 1);
  };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', async e => {
    const b = e.target.closest('[data-vw]'); if (!b) return;
    const a = b.dataset.vw;
    if (a === 'close') close();
    if (a === 'prev') show(i - 1);
    if (a === 'next') show(i + 1);
    if (a === 'share') share(files[i]);
  });

  async function show(n) {
    i = (n + files.length) % files.length;
    const f = files[i], my = ++token;
    ov.querySelector('.vw-title b').textContent = f.name;
    ov.querySelector('.vw-title span').textContent = files.length > 1 ? `${i + 1} de ${files.length}` : '';
    zoom?.destroy(); zoom = null; content.innerHTML = ''; content.style.transform = ''; loading.hidden = false; loading.textContent = 'Cargando…';
    const W = stage.clientWidth, H = stage.clientHeight;
    try {
      let w, h;
      if (f.type.startsWith('image/')) {
        const u = URL.createObjectURL(f.blob); urls.push(u);
        const img = new Image(); img.src = u; img.alt = f.name; img.draggable = false;
        await img.decode();
        if (my !== token) return;
        const r = Math.min(W / img.naturalWidth, H / img.naturalHeight, 4);
        w = img.naturalWidth * r; h = img.naturalHeight * r;
        img.style.width = w + 'px'; img.style.height = h + 'px';
        content.appendChild(img);
      } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const lib = await pdfjs();
        const base = new URL('../vendor/pdfjs/', import.meta.url).href;
        const doc = await lib.getDocument({ data: new Uint8Array(await f.blob.arrayBuffer()), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise;
        if (my !== token) return;
        const gap = 10, dpr = Math.min(window.devicePixelRatio || 1, 3);
        w = W; h = 0;
        const pages = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const vp1 = page.getViewport({ scale: 1 });
          const cssW = W, cssH = vp1.height * (W / vp1.width);
          // resolución extra para que el zoom (QR) siga nítido
          const scale = Math.min((W / vp1.width) * dpr * 2, 2400 / vp1.width);
          const vp = page.getViewport({ scale });
          const c = document.createElement('canvas');
          c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
          content.appendChild(c);
          pages.push({ page, vp, c });
          h += cssH + (p > 1 ? gap : 0);
        }
        content.style.gap = gap + 'px';
        // dibuja la primera página enseguida y el resto después
        for (const [k, pg] of pages.entries()) {
          if (my !== token) return;
          await pg.page.render({ canvasContext: pg.c.getContext('2d'), viewport: pg.vp }).promise;
          if (k === 0) loading.hidden = true;
        }
      } else {
        loading.textContent = 'Este tipo de archivo no se puede ver aquí. Usa «Compartir» para abrirlo en otra app.';
        return;
      }
      if (my !== token) return;
      loading.hidden = true;
      content.style.width = w + 'px'; content.style.height = h + 'px';
      zoom = new Zoomer(stage, content, w, h);
    } catch (err) {
      if (my !== token) return;
      loading.hidden = false;
      loading.textContent = 'No se pudo mostrar el archivo: ' + (err?.message || err) + '. Usa «Compartir» para abrirlo en otra app.';
    }
  }

  async function share(f) {
    const file = new File([f.blob], f.name, { type: f.type });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: f.name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const u = URL.createObjectURL(f.blob); urls.push(u); window.open(u, '_blank', 'noopener');
  }

  show(i);
  return close;
}

/* Zoom y desplazamiento con dedos, ratón o rueda. El contenido empieza ajustado (escala 1). */
class Zoomer {
  constructor(stage, el, w, h) {
    Object.assign(this, { stage, el, w, h, s: 1, x: 0, y: 0, pts: new Map(), last: null, tap: null, vel: null, raf: 0 });
    this.W = stage.clientWidth; this.H = stage.clientHeight;
    this.clamp(); this.apply();
    this.on = [
      ['pointerdown', e => this.down(e)], ['pointermove', e => this.move(e)],
      ['pointerup', e => this.up(e)], ['pointercancel', e => this.up(e)],
      ['wheel', e => this.wheel(e), { passive: false }],
    ];
    this.on.forEach(([t, f, o]) => stage.addEventListener(t, f, o));
    this.onResize = () => { this.W = stage.clientWidth; this.H = stage.clientHeight; this.clamp(); this.apply(); };
    addEventListener('resize', this.onResize);
  }
  destroy() { this.on.forEach(([t, f, o]) => this.stage.removeEventListener(t, f, o)); removeEventListener('resize', this.onResize); cancelAnimationFrame(this.raf); }
  apply() { this.el.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.s})`; }
  clamp() {
    const cw = this.w * this.s, ch = this.h * this.s;
    this.x = cw <= this.W ? (this.W - cw) / 2 : Math.min(0, Math.max(this.W - cw, this.x));
    this.y = ch <= this.H ? (this.H - ch) / 2 : Math.min(0, Math.max(this.H - ch, this.y));
  }
  zoomAt(ns, cx, cy) {
    ns = Math.min(6, Math.max(1, ns));
    this.x = cx - (cx - this.x) * (ns / this.s); this.y = cy - (cy - this.y) * (ns / this.s); this.s = ns;
    this.clamp(); this.apply();
  }
  pos(e) { const r = this.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }; }
  down(e) {
    this.stage.setPointerCapture?.(e.pointerId);
    cancelAnimationFrame(this.raf); this.vel = null;
    this.pts.set(e.pointerId, this.pos(e));
    if (this.pts.size === 2) {
      const [a, b] = [...this.pts.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: this.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, x: this.x, y: this.y };
    }
    this.last = this.pos(e); this.start = this.last;
  }
  move(e) {
    if (!this.pts.has(e.pointerId)) return;
    const p = this.pos(e); this.pts.set(e.pointerId, p);
    if (this.pts.size >= 2 && this.pinch) {
      const [a, b] = [...this.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ns = Math.min(6, Math.max(1, this.pinch.s * d / this.pinch.d));
      this.x = mx - (this.pinch.mx - this.pinch.x) * (ns / this.pinch.s);
      this.y = my - (this.pinch.my - this.pinch.y) * (ns / this.pinch.s);
      this.s = ns; this.clamp(); this.apply();
      return;
    }
    if (this.pts.size === 1 && this.last) {
      const dx = p.x - this.last.x, dy = p.y - this.last.y, dt = Math.max(1, p.t - this.last.t);
      this.x += dx; this.y += dy; this.clamp(); this.apply();
      this.vel = { x: dx / dt, y: dy / dt };
      this.last = p;
    }
  }
  up(e) {
    if (!this.pts.has(e.pointerId)) return;
    const p = this.pos(e);
    this.pts.delete(e.pointerId);
    if (this.pts.size < 2) this.pinch = null;
    if (this.pts.size === 1) { this.last = [...this.pts.values()][0]; return; }
    // doble toque: ampliar en el punto o volver al ajuste
    const moved = this.start ? Math.hypot(p.x - this.start.x, p.y - this.start.y) : 99;
    if (moved < 10 && p.t - this.start.t < 300) {
      if (this.tap && p.t - this.tap.t < 320 && Math.hypot(p.x - this.tap.x, p.y - this.tap.y) < 30) {
        this.tap = null; this.animateTo(this.s > 1.2 ? 1 : 2.5, p.x, p.y); return;
      }
      this.tap = p;
    }
    // inercia suave al soltar
    if (this.vel && performance.now() - this.last.t < 80) this.fling();
  }
  fling() {
    let { x: vx, y: vy } = this.vel, prev = performance.now();
    const step = t => {
      const dt = t - prev; prev = t;
      this.x += vx * dt; this.y += vy * dt; this.clamp(); this.apply();
      vx *= Math.pow(0.95, dt / 16); vy *= Math.pow(0.95, dt / 16);
      if (Math.hypot(vx, vy) > 0.02) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  animateTo(ns, cx, cy) {
    const s0 = this.s, x0 = this.x, y0 = this.y, t0 = performance.now();
    // destino calculado igual que zoomAt
    const tmp = { s: s0, x: x0, y: y0 };
    this.zoomAt(ns, cx, cy); const end = { s: this.s, x: this.x, y: this.y };
    Object.assign(this, tmp); this.apply();
    const step = t => {
      const k = Math.min(1, (t - t0) / 220), e = 1 - Math.pow(1 - k, 3);
      this.s = s0 + (end.s - s0) * e; this.x = x0 + (end.x - x0) * e; this.y = y0 + (end.y - y0) * e; this.apply();
      if (k < 1) this.raf = requestAnimationFrame(step); else { this.clamp(); this.apply(); }
    };
    this.raf = requestAnimationFrame(step);
  }
  wheel(e) {
    e.preventDefault();
    const p = this.pos(e);
    if (e.ctrlKey || e.metaKey) this.zoomAt(this.s * Math.exp(-e.deltaY / 200), p.x, p.y);
    else { this.x -= e.deltaX; this.y -= e.deltaY; this.clamp(); this.apply(); }
  }
}
