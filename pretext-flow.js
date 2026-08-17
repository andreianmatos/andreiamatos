/**
 * Pretext: nav + info on the same page; texto desvia dos ícones a flutuar.
 */

function isInfoOpen() {
  return document.body?.classList.contains('info-open');
}

function isWorksOpen() {
  return document.body?.classList.contains('works-open');
}

function isFlowOpen() {
  return isInfoOpen() || isWorksOpen();
}

function currentNav() {
  if (isWorksOpen()) return 'works';
  if (isInfoOpen()) return 'about';
  return 'home';
}

const TEXT_RUNS = [
  {
    text: 'Andreia Matos',
    className: 'pretext-name',
    el: 'button',
    nav: 'home',
  },
  { text: ' · ', className: 'pretext-plain', el: 'span' },
  {
    text: 'pt',
    className: 'pretext-nav-link',
    el: 'button',
    lang: 'pt',
  },
  { text: ' : ', className: 'pretext-plain', el: 'span' },
  {
    text: 'en',
    className: 'pretext-nav-link',
    el: 'button',
    lang: 'en',
  },
  { text: ' · ', className: 'pretext-plain', el: 'span' },
  {
    text: 'index',
    className: 'pretext-nav-link',
    el: 'button',
    nav: 'home',
    i18n: 'nav.home',
  },
  { text: ' · ', className: 'pretext-plain', el: 'span' },
  {
    text: 'about',
    className: 'pretext-nav-link',
    el: 'button',
    nav: 'about',
    i18n: 'nav.about',
  },
  { text: ' · ', className: 'pretext-plain', el: 'span' },
  {
    text: 'works',
    className: 'pretext-nav-link',
    el: 'button',
    nav: 'works',
    i18n: 'nav.works',
  },
];

const TEXT_BIO_RUNS = [
  {
    text: 'Computer scientist and artist.',
    className: 'pretext-blurb',
    el: 'span',
    i18n: 'bio.line',
  },
];

const TEXT_CONTACT_RUNS = [
  {
    text: 'Contact at ',
    className: 'pretext-label',
    el: 'span',
    i18n: 'contact.at',
  },
  {
    text: 'andreiangmatos@gmail.com',
    className: 'pretext-tool-link',
    el: 'a',
    href: 'mailto:andreiangmatos@gmail.com',
  },
  { text: ' or ', className: 'pretext-plain', el: 'span', i18n: 'contact.or' },
  {
    text: '@andreiangmatos',
    className: 'pretext-tool-link',
    el: 'a',
    href: 'https://www.instagram.com/andreiangmatos/',
    target: '_blank',
    rel: 'noopener',
  },
];

const TEXT_CV_BIRTH_RUNS = [
  {
    text: 'born 1999 in Viseu, based in Lisboa',
    className: 'pretext-meta',
    el: 'span',
    i18n: 'cv.birth',
  },
];

let globalLH = 24;
let bioLH = 24;
let contactLH = 24;
let cvBirthLH = 24;
let modRef = null;
let mouseX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
let mouseY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
let rafPending = false;
let layoutWantNav = false;
let fontsDirty = true;
let mouseSkewRaf = null;
let infoGlyphCache = [];
let lastGlyphScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
let holdMouseSkew = false;
let lastLayoutWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
const PASS_RADIUS = 62;
const PASS_FORCE = 11;
const PASS_EASE = 0.34;
/** Avanço horizontal após cada fragmento (canvas vs DOM + respiro entre runs). */
const FRAG_GAP_PX = 1.5;
const INTER_FRAG_EM = 0.16;

function interFragmentGapPx(mount) {
  const em = parseFloat(getComputedStyle(mount).fontSize) || 16;
  return FRAG_GAP_PX + em * INTER_FRAG_EM;
}

function layoutWidth() {
  return document.documentElement.clientWidth || window.innerWidth;
}

function isRealLayoutWidthChange() {
  const w = layoutWidth();
  if (w < 60) return false;
  if (Math.abs(w - lastLayoutWidth) < 8) return false;
  lastLayoutWidth = w;
  return true;
}

function wantsMouseSkew() {
  return typeof window !== 'undefined' && !wantsReducedMotion();
}

function passRadius() {
  const coarse =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarse ? 96 : PASS_RADIUS;
}

function wantsReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Top-aligned rows vs same-y baseline: shift (px) to apply to fragments next to .pretext-name */
const baselineShiftCache = new Map();

function measureBaselineShiftVsName(className, mount) {
  if (className === 'pretext-name') return 0;
  if (baselineShiftCache.has(className)) return baselineShiftCache.get(className);

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;align-items:baseline;flex-direction:row;visibility:hidden;position:absolute;left:-9999px;top:0;white-space:nowrap';
  const nameEl = document.createElement('span');
  nameEl.className = 'pretext-name';
  nameEl.textContent = 'Andreia Matos';
  const probe = document.createElement('span');
  probe.className = className;
  probe.textContent = 'Mg';
  wrap.appendChild(nameEl);
  wrap.appendChild(probe);
  mount.appendChild(wrap);
  const nt = nameEl.getBoundingClientRect().top;
  const pt = probe.getBoundingClientRect().top;
  mount.removeChild(wrap);
  const shift = Math.round(pt - nt);
  baselineShiftCache.set(className, shift);
  return shift;
}

function collectTopsWithName(lines) {
  const byTop = new Map();
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].top;
    if (!byTop.has(t)) byTop.set(t, []);
    byTop.get(t).push(lines[i]);
  }
  const tops = new Set();
  for (const arr of byTop.values()) {
    if (arr.some((x) => x.run.className === 'pretext-name')) {
      tops.add(arr[0].top);
    }
  }
  return tops;
}

function subtractInterval(seg, o) {
  const { l, r } = seg;
  const ol = o.left;
  const or = o.right;
  if (or <= l || ol >= r) return [seg];
  const out = [];
  if (ol > l) out.push({ l, r: Math.min(r, ol) });
  if (or < r) out.push({ l: Math.max(l, or), r });
  return out.filter((s) => s.r - s.l > 40);
}

function bestSegmentForY(textRect, cy, obstacles) {
  let segs = [{ l: textRect.left, r: textRect.right }];
  for (const o of obstacles) {
    if (o.bottom <= cy || o.top >= cy) continue;
    if (o.right <= textRect.left || o.left >= textRect.right) continue;
    segs = segs.flatMap((s) => subtractInterval(s, o));
  }
  if (segs.length === 0) return null;
  segs.sort((a, b) => b.r - b.l - (a.r - a.l));
  return segs[0];
}

function buildCanvasFont(cs) {
  const family = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  const st = cs.fontStyle === 'normal' ? '' : `${cs.fontStyle} `;
  return `${st}${cs.fontWeight} ${cs.fontSize} "${family}"`.trim();
}

function measureRunClass(mount, className) {
  const wrap = document.createElement('div');
  wrap.className = 'pretext-line-row';
  wrap.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0';
  const inner = document.createElement('span');
  inner.className = className;
  inner.textContent = 'Mg';
  wrap.appendChild(inner);
  mount.appendChild(wrap);
  const cs = getComputedStyle(inner);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const lh = parseFloat(cs.lineHeight);
  const lineHeightPx = Number.isFinite(lh) && lh > 0 ? lh : fontSize * 1.86;
  const canvasFont = buildCanvasFont(cs);
  mount.removeChild(wrap);
  return { lineHeightPx, canvasFont };
}

/** Extra vertical stride so rows do not overlap (subpixel LH, descenders, baseline shift vs name). */
function maxDownwardBaselineShiftVsName(mount, runs) {
  let max = 0;
  for (const run of runs) {
    if (run.className === 'pretext-name') continue;
    const s = measureBaselineShiftVsName(run.className, mount);
    if (s > max) max = s;
  }
  return max;
}

function syncMetricsForRuns(mount, runs, setGlobalLH, opts = {}) {
  const lines = mount;
  const cs = getComputedStyle(lines);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const lh = parseFloat(cs.lineHeight);
  const baseLH = Number.isFinite(lh) && lh > 0 ? lh : fontSize * 1.86;
  let maxLH = baseLH;
  for (const run of runs) {
    const m = measureRunClass(lines, run.className);
    run.lineHeightPx = m.lineHeightPx;
    run.canvasFont = m.canvasFont;
    if (m.lineHeightPx > maxLH) maxLH = m.lineHeightPx;
  }
  const shiftPad = opts.skipNameShift ? 0 : maxDownwardBaselineShiftVsName(mount, runs);
  const subpixelPad = 4;
  setGlobalLH(Math.max(22, Math.ceil(maxLH) + shiftPad + subpixelPad));
}

function syncGlobalMetrics(mount) {
  syncMetricsForRuns(mount, TEXT_RUNS, (v) => {
    globalLH = v;
  });
}

function prepareRunsFor(mod, runs) {
  const { prepareWithSegments } = mod;
  for (const run of runs) {
    if (!run.text || !run.canvasFont) continue;
    if (
      run.__pretextSrc === run.text &&
      run.__pretextFont === run.canvasFont &&
      run.prepared
    ) {
      continue;
    }
    try {
      run.prepared = prepareWithSegments(run.text, run.canvasFont);
      run.__pretextSrc = run.text;
      run.__pretextFont = run.canvasFont;
    } catch (_) {
      run.prepared = null;
      run.__pretextSrc = '';
      run.__pretextFont = '';
    }
    run.cursor = { segmentIndex: 0, graphemeIndex: 0 };
  }
}

function currentLang() {
  return typeof window.getSiteLang === 'function' ? window.getSiteLang() : document.documentElement.lang || 'pt';
}

function tRun(key, fallback) {
  return typeof window.tSite === 'function' ? window.tSite(key) : fallback;
}

function syncRunI18n(runs) {
  for (const run of runs) {
    if (!run.i18n) continue;
    const next = tRun(run.i18n, run.text);
    if (next === run.text) continue;
    run.text = next;
    run.prepared = null;
    run.__pretextSrc = '';
  }
}

function resetRunCursors(runs) {
  for (const run of runs) {
    run.cursor = { segmentIndex: 0, graphemeIndex: 0 };
  }
}

function getObstaclesForMain() {
  return [];
}

function getObstaclesForContactPanel() {
  return [];
}

function getObstaclesForCvPanel() {
  return [];
}

function prepareAllPretextRuns(mod) {
  syncRunI18n(TEXT_RUNS);
  syncRunI18n(TEXT_BIO_RUNS);
  syncRunI18n(TEXT_CONTACT_RUNS);
  syncRunI18n(TEXT_CV_BIRTH_RUNS);
  prepareRunsFor(mod, TEXT_RUNS);
  prepareRunsFor(mod, TEXT_BIO_RUNS);
  prepareRunsFor(mod, TEXT_CONTACT_RUNS);
  prepareRunsFor(mod, TEXT_CV_BIRTH_RUNS);
}

function applyFontMetricsIfNeeded() {
  const mainMount = document.getElementById('pretext-lines');
  if (!mainMount || !modRef) return false;
  if (fontsDirty) {
    baselineShiftCache.clear();
    syncGlobalMetrics(mainMount);

    const bioMount = document.getElementById('info-bio-lines');
    if (bioMount) {
      syncMetricsForRuns(bioMount, TEXT_BIO_RUNS, (v) => {
        bioLH = v;
      }, { skipNameShift: true });
    }
    const cpm = document.getElementById('contact-pretext-lines');
    if (cpm) {
      syncMetricsForRuns(cpm, TEXT_CONTACT_RUNS, (v) => {
        contactLH = v;
      }, { skipNameShift: true });
    }
    const vbm = document.getElementById('cv-pretext-birth');
    if (vbm) {
      syncMetricsForRuns(vbm, TEXT_CV_BIRTH_RUNS, (v) => {
        cvBirthLH = v;
      }, { skipNameShift: true });
    }

    fontsDirty = false;
  }
  prepareAllPretextRuns(modRef);
  return true;
}

function queueLayout() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    const doNav = layoutWantNav;
    layoutWantNav = false;
    if (!applyFontMetricsIfNeeded()) return;
    if (doNav) runLayout();
    else patchMainPretextNavAria();
    runBioLayout();
    runContactLayout();
    runCvBirthLayout();
    wrapInfoStaticGlyphs();
    sizeWorksBoxes();
    cacheInfoGlyphs();
    applyInfoMouseSkew();
  });
}

function scheduleLayout() {
  layoutWantNav = true;
  queueLayout();
}

function scheduleInfoLayout() {
  queueLayout();
}

function centerLineGroups(lines, textRect) {
  const byTop = new Map();
  for (let i = 0; i < lines.length; i++) {
    const y = lines[i].top;
    if (!byTop.has(y)) byTop.set(y, []);
    byTop.get(y).push(i);
  }
  for (const indices of byTop.values()) {
    const first = lines[indices[0]];
    if (first.segL == null || first.segR == null) continue;
    const { segL, segR } = first;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    for (const i of indices) {
      const L = lines[i];
      minLeft = Math.min(minLeft, L.left);
      maxRight = Math.max(maxRight, L.left + L.w);
    }
    const contentW = maxRight - minLeft;
    const segW = segR - segL;
    const segLeftLocal = segL - textRect.left;
    const delta = segLeftLocal + (segW - contentW) / 2 - minLeft;
    for (const i of indices) {
      lines[i].left += delta;
    }
  }
}

function alignLineGroups(lines, textRect, alignMode) {
  if (alignMode === 'center') {
    centerLineGroups(lines, textRect);
    return;
  }
  if (alignMode !== 'left') return;
  const byTop = new Map();
  for (let i = 0; i < lines.length; i++) {
    const y = lines[i].top;
    if (!byTop.has(y)) byTop.set(y, []);
    byTop.get(y).push(i);
  }
  for (const indices of byTop.values()) {
    const first = lines[indices[0]];
    if (first.segL == null || first.segR == null) continue;
    const { segL } = first;
    let minLeft = Infinity;
    for (const i of indices) {
      minLeft = Math.min(minLeft, lines[i].left);
    }
    const segLeftLocal = segL - textRect.left;
    const delta = segLeftLocal - minLeft;
    for (const i of indices) {
      lines[i].left += delta;
    }
  }
}

function layoutRunsIntoMount(mount, runs, lhStride, options) {
  const {
    obstacleGetter,
    alignMode = 'center',
    useNameBaseline = true,
    useMouseSkew = true,
    splitGlyphs = false,
  } = options;

  if (!mount || !modRef) return;

  const textRect = mount.getBoundingClientRect();
  if (textRect.width < 60) {
    return;
  }

  const obstacles = obstacleGetter();
  const { layoutNextLineRange, materializeLineRange } = modRef;
  resetRunCursors(runs);

  const lines = [];
  let y = 0;
  let xOffset = 0;
  let runIndex = 0;
  const maxH = Math.max(window.innerHeight * 6, 6000);
  const mouseBias = useMouseSkew ? ((mouseX / window.innerWidth - 0.5) * 28) | 0 : 0;
  let guard = 0;

  while (y < maxH && guard++ < 12000) {
    if (runIndex >= runs.length) break;

    const run = runs[runIndex];
    const prepared = run.prepared;
    if (!prepared || !run.text) {
      runIndex++;
      continue;
    }

    let cursor = run.cursor;
    const cy = textRect.top + y + lhStride * 0.52;
    const seg = bestSegmentForY(textRect, cy, obstacles);
    if (!seg) {
      y += lhStride;
      xOffset = 0;
      continue;
    }

    const fragmentLeft = seg.l + xOffset;
    if (fragmentLeft >= seg.r - 32) {
      y += lhStride;
      xOffset = 0;
      continue;
    }

    let width = seg.r - fragmentLeft + mouseBias;
    width = Math.max(36, Math.min(width, textRect.width * 1.3));

    const range = layoutNextLineRange(prepared, cursor, width);
    if (range == null) {
      runIndex++;
      continue;
    }

    const line = materializeLineRange(prepared, range);
    const prev = { ...cursor };
    cursor = range.end;
    run.cursor = cursor;

    if (prev.segmentIndex === cursor.segmentIndex && prev.graphemeIndex === cursor.graphemeIndex) break;

    if (line.text.length === 0) {
      y += lhStride;
      xOffset = 0;
      continue;
    }

    const leftPx = fragmentLeft - textRect.left;
    const canvasW =
      typeof line.width === 'number' && line.width > 0 && Number.isFinite(line.width) ? line.width : 0;
    const domW = measureDomFragmentWidth(mount, run, line.text);
    /* Avanço horizontal: confiar no DOM. O canvas do Pretext costuma *exagerar* o negrito vs
       o texto renderizado → max(canvas, dom) deixava vazio grande entre o nome e o " · ". */
    const w = domW > 0.5 ? domW : Math.max(canvasW, 1);

    lines.push({
      text: line.text,
      left: leftPx,
      top: y,
      w,
      run,
      segL: seg.l,
      segR: seg.r,
    });

    xOffset += w + interFragmentGapPx(mount);

    const moreInRun = layoutNextLineRange(prepared, cursor, 1e9) !== null;
    if (!moreInRun) {
      runIndex++;
    }
  }

  alignLineGroups(lines, textRect, alignMode);

  const topsWithName = useNameBaseline ? collectTopsWithName(lines) : new Set();

  const contentH = y + lhStride * 2;
  mount.style.minHeight = `${Math.max(contentH, lhStride * 2)}px`;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < lines.length; i++) {
    const item = lines[i];
    const row = document.createElement('div');
    row.className = 'pretext-line-row';
    let topPx = item.top;
    if (useNameBaseline && topsWithName.has(item.top) && item.run.className !== 'pretext-name') {
      topPx += measureBaselineShiftVsName(item.run.className, mount);
    }
    const rowId = lhStride > 0 ? (item.top / lhStride) | 0 : 0;
    const skew =
      useMouseSkew && !wantsReducedMotion()
        ? (((mouseX / window.innerWidth - 0.5) * 2.5 * (rowId % 3)) | 0)
        : 0;
    row.style.top = `${topPx}px`;
    row.style.left = `${item.left}px`;
    row.style.transform = `translateX(${skew}px)`;
    const inner = createInnerEl(item.run, item.text);
    if (splitGlyphs) wrapTextAsGlyphs(inner);
    row.appendChild(inner);
    frag.appendChild(row);
  }
  mount.replaceChildren(frag);
}

function patchMainPretextNavAria() {
  const nav = currentNav();
  document.querySelectorAll('.pretext-nav-link[data-nav]').forEach((el) => {
    const current = el.dataset.nav === nav;
    el.classList.toggle('is-current', current);
    if (current) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  const lang = currentLang();
  document.querySelectorAll('.pretext-nav-link[data-lang]').forEach((el) => {
    const current = el.dataset.lang === lang;
    el.classList.toggle('is-current', current);
    if (current) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
}

function runBioLayout() {
  const panel = document.getElementById('info-inline');
  const mount = document.getElementById('info-bio-lines');
  if (!mount) return;
  if (!panel?.classList.contains('is-open')) {
    mount.replaceChildren();
    mount.style.minHeight = '';
    return;
  }
  layoutRunsIntoMount(mount, TEXT_BIO_RUNS, bioLH, {
    obstacleGetter: getObstaclesForContactPanel,
    alignMode: 'left',
    useNameBaseline: false,
    useMouseSkew: false,
    splitGlyphs: true,
  });
}

function runContactLayout() {
  const panel = document.getElementById('info-inline');
  const mount = document.getElementById('contact-pretext-lines');
  if (!mount) return;
  if (!panel?.classList.contains('is-open')) {
    mount.replaceChildren();
    mount.style.minHeight = '';
    return;
  }
  layoutRunsIntoMount(mount, TEXT_CONTACT_RUNS, contactLH, {
    obstacleGetter: getObstaclesForContactPanel,
    alignMode: 'left',
    useNameBaseline: false,
    useMouseSkew: false,
    splitGlyphs: true,
  });
}

function runCvBirthLayout() {
  const cvPanel = document.getElementById('info-inline');
  const mount = document.getElementById('cv-pretext-birth');
  if (!mount) return;
  if (!cvPanel?.classList.contains('is-open')) {
    mount.replaceChildren();
    mount.style.minHeight = '';
    return;
  }
  layoutRunsIntoMount(mount, TEXT_CV_BIRTH_RUNS, cvBirthLH, {
    obstacleGetter: getObstaclesForCvPanel,
    alignMode: 'left',
    useNameBaseline: false,
    useMouseSkew: false,
    splitGlyphs: true,
  });
}

function wrapInfoStaticGlyphs() {
  if (!isFlowOpen()) return;
  const root = isWorksOpen()
    ? document.getElementById('works-inline')
    : document.getElementById('info-inline');
  if (!root) return;
  const targets = isWorksOpen()
    ? root.querySelectorAll('.works-section, .works-title, .works-meta, .works-year')
    : root.querySelectorAll('.info-flow');
  targets.forEach((el) => {
    if (el.querySelector('.pretext-glyph')) return;
    wrapTextAsGlyphs(el);
  });
}

function wrapTextAsGlyphs(el) {
  const raw = el.textContent ?? '';
  if (!raw) return;
  el.textContent = '';
  for (const ch of raw) {
    const s = document.createElement('span');
    s.className = 'pretext-glyph';
    s.textContent = ch === ' ' ? '\u00a0' : ch;
    el.appendChild(s);
  }
}

function measureNowrapWidth(el) {
  if (!el) return 0;
  const prev = el.style.whiteSpace;
  el.style.whiteSpace = 'nowrap';
  const w = el.scrollWidth;
  el.style.whiteSpace = prev;
  return w;
}

function sizeWorksBoxes() {
  if (!isFlowOpen()) return;
  const root = isWorksOpen()
    ? document.getElementById('works-inline')
    : document.getElementById('info-inline');
  if (!root) return;
  const list = root.querySelector('.works-list');
  if (!list) return;
  if (isWorksOpen()) {
    list.querySelectorAll('.works-entry').forEach((entry) => {
      entry.style.width = '';
      entry.style.maxWidth = '100%';
    });
    return;
  }
  const avail = list.clientWidth;
  list.querySelectorAll('.works-entry').forEach((entry) => {
    if (avail < 40) {
      if (entry.style.width) entry.style.width = '';
      return;
    }
    const cs = getComputedStyle(entry);
    const chrome =
      (parseFloat(cs.paddingLeft) || 0) +
      (parseFloat(cs.paddingRight) || 0) +
      (parseFloat(cs.borderLeftWidth) || 0) +
      (parseFloat(cs.borderRightWidth) || 0);
    let inner = 0;
    entry.querySelectorAll('.works-title, .works-meta, .works-year').forEach((line) => {
      inner = Math.max(inner, measureNowrapWidth(line));
    });
    const w = Math.min(Math.ceil(inner + chrome + 1), avail);
    const next = `${Math.max(w, chrome + 8)}px`;
    if (entry.style.width !== next) entry.style.width = next;
    if (entry.style.maxWidth !== '100%') entry.style.maxWidth = '100%';
  });
}

function cacheInfoGlyphs() {
  infoGlyphCache = [];
  const roots = [document.getElementById('pretext-lines')];
  if (isWorksOpen()) roots.push(document.getElementById('works-inline'));
  else if (isInfoOpen()) roots.push(document.getElementById('info-inline'));
  for (let r = 0; r < roots.length; r++) {
    const root = roots[r];
    if (!root) continue;
    const nodes = root.querySelectorAll('.pretext-glyph');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      el.style.transform = '';
      el.style.removeProperty('text-shadow');
      const box = el.getBoundingClientRect();
      infoGlyphCache.push({
        el,
        x: box.left + box.width * 0.5,
        y: box.top + box.height * 0.5,
        tx: 0,
        ty: 0,
      });
    }
  }
  lastGlyphScrollY = window.scrollY;
}

function applyInfoMouseSkew() {
  if (holdMouseSkew || !wantsMouseSkew()) {
    mouseSkewRaf = null;
    return;
  }
  if (infoGlyphCache.length === 0) cacheInfoGlyphs();
  const radius = passRadius();
  const r2 = radius * radius;
  let moving = false;
  for (let i = 0; i < infoGlyphCache.length; i++) {
    const g = infoGlyphCache[i];
    const dx = g.x - mouseX;
    const dy = g.y - mouseY;
    const d2 = dx * dx + dy * dy;
    let tx = 0;
    let ty = 0;
    if (d2 < r2) {
      const d = Math.sqrt(d2) || 1;
      const t = 1 - d / radius;
      const e = t * t * t;
      tx = (dx / d) * PASS_FORCE * e;
      ty = (dy / d) * PASS_FORCE * 0.35 * e;
    }
    g.tx += (tx - g.tx) * PASS_EASE;
    g.ty += (ty - g.ty) * PASS_EASE;
    if (Math.abs(g.tx) > 0.08 || Math.abs(g.ty) > 0.08) {
      moving = true;
      g.el.style.transform = `translate(${g.tx.toFixed(2)}px, ${g.ty.toFixed(2)}px)`;
    } else {
      g.tx = 0;
      g.ty = 0;
      if (g.el.style.transform) g.el.style.transform = '';
    }
  }
  if (moving && mouseSkewRaf == null) {
    mouseSkewRaf = requestAnimationFrame(() => {
      mouseSkewRaf = null;
      applyInfoMouseSkew();
    });
  }
}

function requestInfoMouseSkew() {
  if (mouseSkewRaf != null) return;
  mouseSkewRaf = requestAnimationFrame(() => {
    mouseSkewRaf = null;
    applyInfoMouseSkew();
  });
}

function createInnerEl(run, text) {
  if (run.el === 'a') {
    const a = document.createElement('a');
    a.className = run.className;
    a.textContent = text;
    if (run.href) a.setAttribute('href', run.href);
    if (run.target) a.setAttribute('target', run.target);
    if (run.rel) a.setAttribute('rel', run.rel);
    return a;
  }
  if (run.el === 'button') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = run.className;
    b.textContent = text;
    if (run.id) b.id = run.id;
    if (run.nav) {
      b.dataset.nav = run.nav;
      if (run.className.includes('pretext-nav-link') && run.nav === currentNav()) {
        b.classList.add('is-current');
        b.setAttribute('aria-current', 'page');
      }
    }
    if (run.lang) {
      b.dataset.lang = run.lang;
      if (run.lang === currentLang()) {
        b.classList.add('is-current');
        b.setAttribute('aria-current', 'true');
      }
    }
    return b;
  }
  const s = document.createElement('span');
  s.className = run.className;
  s.textContent = text;
  return s;
}

/** Largura real no DOM (canvas do Pretext subestima negrito, botões e espaços). */
function measureDomFragmentWidth(mount, run, text) {
  if (!text.length) return 0;
  const wrap = document.createElement('div');
  wrap.className = 'pretext-line-row';
  wrap.style.cssText =
    'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;pointer-events:none';
  const inner = createInnerEl(run, text);
  wrap.appendChild(inner);
  mount.appendChild(wrap);
  const w = inner.getBoundingClientRect().width;
  mount.removeChild(wrap);
  return w;
}

function runLayout() {
  const mount = document.getElementById('pretext-lines');
  if (!mount || !modRef) return;

  layoutRunsIntoMount(mount, TEXT_RUNS, globalLH, {
    obstacleGetter: getObstaclesForMain,
    alignMode: 'left',
    useNameBaseline: true,
    useMouseSkew: false,
    splitGlyphs: true,
  });

  patchMainPretextNavAria();

  const outer = mount.closest('.pretext-fit-outer');
  mount.style.transform = '';
  if (outer) outer.style.height = '';

  window.dispatchEvent(new CustomEvent('pretext-layout-done'));
}

function plainFallback(mount) {
  mount.textContent = TEXT_RUNS.map((r) => r.text).join('');
}

async function boot() {
  const mount = document.getElementById('pretext-lines');
  if (!mount) return;
  if (!mount.textContent.trim()) plainFallback(mount);

  try {
    await document.fonts.ready;
  } catch (_) {
    /* ignore */
  }

  let mod;
  try {
    mod = await import('https://esm.sh/@chenglou/pretext@0.0.5');
  } catch (e) {
    return;
  }
  modRef = mod;
  fontsDirty = true;

  lastLayoutWidth = layoutWidth();

  window.addEventListener(
    'resize',
    () => {
      if (!isRealLayoutWidthChange()) return;
      fontsDirty = true;
      scheduleLayout();
    },
    { passive: true }
  );
  window.addEventListener(
    'orientationchange',
    () => {
      window.setTimeout(() => {
        if (!isRealLayoutWidthChange()) return;
        fontsDirty = true;
        scheduleLayout();
      }, 280);
    },
    { passive: true }
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      holdMouseSkew = false;
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!wantsMouseSkew()) return;
      requestInfoMouseSkew();
    },
    { passive: true }
  );
  window.addEventListener(
    'pointerdown',
    (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!wantsMouseSkew()) return;
      requestInfoMouseSkew();
    },
    { passive: true }
  );
  mount.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
      const langBtn = el?.closest('[data-lang]');
      if (langBtn && mount.contains(langBtn)) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.setSiteLang === 'function') window.setSiteLang(langBtn.dataset.lang);
        return;
      }
      const btn = el?.closest('[data-nav]');
      if (!btn || !mount.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const nav = btn.dataset.nav;
      if (nav && typeof window.setSiteView === 'function') {
        holdMouseSkew = true;
        window.setSiteView(nav);
      }
    },
    true
  );
  function onWindowScrollForLayout() {
    const y = window.scrollY;
    const dy = y - lastGlyphScrollY;
    lastGlyphScrollY = y;
    if (dy && infoGlyphCache.length) {
      for (let i = 0; i < infoGlyphCache.length; i++) {
        infoGlyphCache[i].y -= dy;
      }
      requestInfoMouseSkew();
    }
  }
  window.addEventListener('scroll', onWindowScrollForLayout, { passive: true, capture: true });
  window.addEventListener(
    'scrollend',
    () => {
      if (isFlowOpen() || document.getElementById('pretext-lines')) cacheInfoGlyphs();
    },
    { passive: true, capture: true }
  );
  window.addEventListener('pretext-dirty', scheduleLayout);
  window.addEventListener('site-view-change', () => {
    holdMouseSkew = true;
    patchMainPretextNavAria();
    scheduleInfoLayout();
  });
  window.addEventListener('site-lang-change', () => {
    fontsDirty = true;
    scheduleLayout();
  });

  const roWidths = new WeakMap();
  const roNav = new ResizeObserver((entries) => {
    let widthChanged = false;
    for (const entry of entries) {
      const w = entry.contentRect.width;
      const prev = roWidths.get(entry.target);
      if (prev == null) {
        roWidths.set(entry.target, w);
        continue;
      }
      if (Math.abs(w - prev) >= 8) {
        roWidths.set(entry.target, w);
        widthChanged = true;
      }
    }
    if (widthChanged) scheduleLayout();
  });
  roNav.observe(mount);
  const tb = document.querySelector('.text-block');
  if (tb) roNav.observe(tb);

  const roInfo = new ResizeObserver(() => scheduleInfoLayout());
  const infoPanel = document.getElementById('info-inline');
  if (infoPanel) roInfo.observe(infoPanel);
  const contactPretext = document.getElementById('contact-pretext-lines');
  if (contactPretext) roInfo.observe(contactPretext);
  const bioPretext = document.getElementById('info-bio-lines');
  if (bioPretext) roInfo.observe(bioPretext);
  const birthPretext = document.getElementById('cv-pretext-birth');
  if (birthPretext) roInfo.observe(birthPretext);
  const worksPanel = document.getElementById('works-inline');
  if (worksPanel) roInfo.observe(worksPanel);

  scheduleLayout();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
