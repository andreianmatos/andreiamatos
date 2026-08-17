const CONFIG = {
    floatsEnabled: true,
    /** Width as a fraction of the shorter screen edge (`vmin`). Same on every device. */
    pieces: { minScale: 0.15, maxScale: 0.26 },
    paths: { items: 'main/' },
    /** Movimento flutuante: vx/vy por frame (~60fps). Lento — menu, não dança. */
    drift: {
        vMax: 0.28,
        damping: 0.9997,
        minSpeed: 0.02,
        nudge: 0.04,
        /** Only a few pieces drift, and slowly. */
        moveChance: 0.28,
    },
    /** Zona livre à volta do título / nav (px). */
    titleKeepoutPad: 28,
};

const FLOATS_MANIFEST = 'main/floats.json';
const SIZE_PRESETS = {
    'very-small': 0.08,
    small: 0.12,
    medium: 0.18,
    big: 0.28,
    'very-big': 0.36,
    huge: 0.55,
    enormous: 0.82,
    giant: 2.05,
};
const FLOATS_FALLBACK_ITEMS = [
    { file: 'flower_photo.png', size: 'very-big' },
    { file: 'painted_flower.png', size: 'big' },
    { file: 'photo_book.png', size: 'very-big' },
    { file: 'angel_fuller.jpeg', size: 'big' },
    { file: 'anjo.png', size: 'medium' },
    { file: 'flor.png', size: 'big' },
    { file: 'laco.png', size: 'big' },
    { file: 'heart.png', size: 'medium' },
    { file: 'heartlil.png', size: 'small' },
    { file: '10.png', size: 'big' },
    { file: 'drawn_butterfly.png', size: 'medium' },
    { file: 'drawn_heart.png', size: 'medium' },
    { file: 'dr9.png', size: 'medium' },
    { file: '6.png', size: 'medium' },
    { file: 'ceramic_infinitepuzzle.png', size: 'big' },
    { file: 'ceramic_butterfly.png', size: 'small' },
    { file: '1.png', size: 'small' },
    { file: '7.png', size: 'small' },
    { file: 'ph__2.png', size: 'big' },
    { file: 'ceramic_jar.png', size: 'small' },
    { file: 'ceramic_jar2.png', size: 'small' },
    { file: 'hands.png', size: 'medium' },
    { file: 'drawings.png', size: 'big' },
];

function pageDirectoryPath() {
    let p = window.location.pathname;
    if (p.endsWith('/')) return p;
    if (/\.html?$/i.test(p)) return p.replace(/\/[^/]*$/, '/');
    return `${p}/`;
}

function encodeAssetPath(relativePath) {
    return relativePath.replace(/^\//, '').split('/').map(encodeURIComponent).join('/');
}

function resolveAssetUrl(relativePath) {
    const clean = encodeAssetPath(relativePath);
    if (window.location.protocol === 'file:') return clean;
    return `${window.location.origin}${pageDirectoryPath()}${clean}`;
}

/** Go Live vs site em produção: tentar pasta da página e depois raiz do domínio (CNAME / index na raiz). */
function candidateAssetUrls(relativePath) {
    const clean = encodeAssetPath(relativePath);
    if (window.location.protocol === 'file:') return [clean];
    const primary = resolveAssetUrl(relativePath);
    const atRoot = `${window.location.origin}/${clean}`;
    return primary === atRoot ? [primary] : [primary, atRoot];
}

function normalizeSizeKey(size) {
    return String(size || '')
        .trim()
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/\s+/g, '-');
}

function scaleFromSizeWord(size, presets, fallback) {
    if (typeof size === 'number' && Number.isFinite(size) && size > 0) return size;
    const table = presets && typeof presets === 'object' ? presets : SIZE_PRESETS;
    const key = normalizeSizeKey(size);
    if (key && Number.isFinite(table[key])) return table[key];
    const asNum = Number(key);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    return fallback;
}

async function loadJsonAsset(relativePath) {
    for (const url of candidateAssetUrls(relativePath)) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch (_) {
            /* file:// or missing */
        }
    }
    return null;
}

let floatCountRange = { min: 5, max: 9, mobileMin: 3, mobileMax: 5 };
let floatGiantRange = { min: 1, max: 3, mobileMin: 1, mobileMax: 2 };

function parseCountRange(raw, fallback = { min: 5, max: 9, mobileMin: 3, mobileMax: 5 }) {
    if (raw == null) return { ...fallback };
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        const n = Math.max(0, Math.round(raw));
        return { min: n, max: n, mobileMin: n, mobileMax: n };
    }
    if (typeof raw !== 'object') return { ...fallback };
    const min = Math.max(0, Math.round(Number(raw.min ?? fallback.min)));
    const max = Math.max(min, Math.round(Number(raw.max ?? fallback.max)));
    const mob = raw.mobile && typeof raw.mobile === 'object' ? raw.mobile : null;
    const mobileMin = Math.max(0, Math.round(Number(mob?.min ?? raw.mobileMin ?? fallback.mobileMin)));
    const mobileMax = Math.max(mobileMin, Math.round(Number(mob?.max ?? raw.mobileMax ?? fallback.mobileMax)));
    return { min, max, mobileMin, mobileMax };
}

function pickAppearCount(total) {
    const r = floatCountRange;
    const useMobile = isMobile();
    let min = useMobile ? r.mobileMin : r.min;
    let max = useMobile ? r.mobileMax : r.max;
    min = Math.max(1, Math.min(min, total));
    max = Math.max(min, Math.min(max, total));
    return min + ((Math.random() * (max - min + 1)) | 0);
}

function pickGiantCount(available) {
    if (available <= 0) return 0;
    const r = floatGiantRange;
    const useMobile = isMobile();
    let min = useMobile ? r.mobileMin : r.min;
    let max = useMobile ? r.mobileMax : r.max;
    min = Math.max(0, Math.min(min, available));
    max = Math.max(min, Math.min(max, available));
    return min + ((Math.random() * (max - min + 1)) | 0);
}

async function loadFloatPieceDefs() {
    const data = await loadJsonAsset(FLOATS_MANIFEST);
    floatCountRange = parseCountRange(data?.count ?? data?.appear);
    floatGiantRange = parseCountRange(data?.giants, {
        min: 1,
        max: 3,
        mobileMin: 1,
        mobileMax: 2,
    });
    const presets = { ...SIZE_PRESETS, ...(data?.sizes || {}) };
    const defaultSize = data?.defaultSize || 'medium';
    const defaultScale = scaleFromSizeWord(defaultSize, presets, SIZE_PRESETS.medium);
    const items = Array.isArray(data?.items) && data.items.length
        ? data.items
        : FLOATS_FALLBACK_ITEMS;
    return items
        .map((item) => {
            const file = typeof item === 'string' ? item : item?.file;
            if (!file || /\.json$/i.test(file)) return null;
            const size = typeof item === 'string' ? defaultSize : item.size ?? defaultSize;
            const maxWord =
                typeof item === 'string'
                    ? size
                    : item.max ?? item.augment ?? item.upTo ?? size;
            const scale = scaleFromSizeWord(size, presets, defaultScale);
            const maxScale = Math.max(
                scale,
                scaleFromSizeWord(maxWord, presets, scale)
            );
            return {
                file,
                scale,
                maxScale,
                move: typeof item === 'object' ? item.move : undefined,
                speed: typeof item === 'object' ? item.speed : undefined,
            };
        })
        .filter(Boolean);
}

function viewportWidth() {
    return document.documentElement.clientWidth || window.innerWidth;
}

function viewportHeight() {
    return document.documentElement.clientHeight || window.innerHeight;
}

/** Layout size — ignores the mobile URL bar (visualViewport / innerHeight jitter). */
function screenVmin() {
    return Math.min(viewportWidth(), viewportHeight());
}

function piecePixelWidth(scale) {
    return screenVmin() * scale;
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
    }
    return arr;
}

function lerpScale(a, b, t) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return lo + (hi - lo) * t;
}

function canWash(def) {
    return (def?.maxScale || 0) >= SIZE_PRESETS.enormous - 0.001;
}

function isSizedGiant(def) {
    return (def?.scale || 0) >= SIZE_PRESETS.giant - 0.001;
}

function planFloatLayout(defs) {
    const preferred = defs.filter((d) => isSizedGiant(d));
    const giantPool = shuffleInPlace(
        preferred.length ? preferred.slice() : defs.filter((d) => canWash(d))
    );
    const giantN = pickGiantCount(giantPool.length);
    const giants = giantPool.slice(0, giantN);
    const giantSet = new Set(giants);
    const rest = shuffleInPlace(defs.filter((d) => !giantSet.has(d)));
    const n = pickAppearCount(defs.length);
    const restN = Math.max(0, Math.min(rest.length, n - giants.length));
    const mobile = isMobile();
    const picked = giants
        .map((def) => ({ def, role: 'wash' }))
        .concat(rest.slice(0, restN).map((def) => ({ def, role: null })));

    return picked.map((slot, i) => {
        const def = slot.def;
        const base = def.scale || 0.18;
        const max = def.maxScale || base;
        if (slot.role === 'wash' || (i === 0 && canWash(def))) {
            const hi = Math.min(max, 2.15);
            const lo = Math.min(hi, Math.max(base, SIZE_PRESETS.enormous));
            return {
                def,
                role: 'wash',
                washIndex: i,
                scale: lerpScale(lo, hi, 0.35 + Math.random() * 0.65),
                move: false,
            };
        }
        const restI = i - giants.length;
        if (restI <= (mobile ? 0 : 1)) {
            return {
                def,
                role: 'anchor',
                scale: lerpScale(base, Math.min(max, 0.42), 0.4 + Math.random() * 0.6),
                move: false,
            };
        }
        if (restI <= (mobile ? 2 : 4)) {
            return {
                def,
                role: 'floater',
                scale: lerpScale(base, Math.min(max, 0.32), Math.random()),
                move: Math.random() < 0.55,
                speed: 0.35 + Math.random() * 0.55,
            };
        }
        return {
            def,
            role: 'accent',
            scale: lerpScale(Math.min(base, max), Math.min(max, 0.18), Math.random() * 0.5),
            move: Math.random() < 0.3,
            speed: 0.55 + Math.random() * 0.7,
        };
    });
}

function slotPositions(count) {
    const vw = contentScrollWidth();
    const vh = viewportHeight();
    const cols = 3;
    const rows = 2;
    const slots = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === 0 && c === 0) continue;
            slots.push({
                x: ((c + 0.1 + Math.random() * 0.45) * vw) / cols,
                y: ((r + 0.12 + Math.random() * 0.4) * vh) / rows,
            });
        }
    }
    shuffleInPlace(slots);
    const out = [];
    for (let i = 0; i < count; i++) out.push(slots[i % slots.length]);
    return out;
}

function placeWashItem(item, washIndex = 0) {
    const vw = contentScrollWidth();
    const vh = viewportHeight();
    const nx = (vw - item.w) / 2;
    const ny = (vh - item.h) / 2;
    const spreads = [
        { x: 0, y: 0 },
        { x: -0.28, y: 0.16 },
        { x: 0.3, y: -0.14 },
        { x: -0.1, y: -0.26 },
        { x: 0.16, y: 0.22 },
    ];
    const off = spreads[washIndex % spreads.length];
    const jitterX = (Math.random() - 0.5) * vw * 0.08;
    const jitterY = (Math.random() - 0.5) * vh * 0.08;
    item.x = nx + off.x * vw + jitterX;
    item.y = ny + off.y * vh + jitterY;
    clampPiecePos(item);
}

function pickMotion(scale, opts = {}) {
    if (prefersReducedMotion()) {
        return { moves: false, speedMul: 0, vx: 0, vy: 0 };
    }
    const tooBig = scale >= 1.35;
    const moves =
        opts.move === true
            ? true
            : opts.move === false || tooBig
              ? false
              : Math.random() < CONFIG.drift.moveChance;
    if (!moves) return { moves: false, speedMul: 0, vx: 0, vy: 0 };
    const sizeSlow = Math.max(0.22, 1.08 - scale * 0.55);
    const speedMul =
        typeof opts.speed === 'number' && opts.speed > 0
            ? opts.speed
            : sizeSlow * (0.28 + Math.random() * 2.5);
    const v = CONFIG.drift.vMax * speedMul;
    return {
        moves: true,
        speedMul,
        vx: (Math.random() - 0.5) * 2 * v,
        vy: (Math.random() - 0.5) * 2 * v,
    };
}

function clampPiecePos(item) {
    const maxX = contentScrollWidth() - item.w;
    const maxY = contentScrollHeight() - item.h;
    if (maxX < 0) item.x = Math.max(maxX, Math.min(0, item.x));
    else item.x = Math.max(0, Math.min(maxX, item.x));
    if (maxY < 0) item.y = Math.max(maxY, Math.min(0, item.y));
    else item.y = Math.max(0, Math.min(maxY, item.y));
}

function contentScrollWidth() {
    return document.documentElement.clientWidth || window.innerWidth;
}

function contentScrollHeight() {
    return Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
        window.innerHeight
    );
}

function titleKeepoutRect() {
    const pad = isMobile() ? 16 : CONFIG.titleKeepoutPad;
    const layer = document.getElementById('drawings-layer');
    const mount = document.getElementById('pretext-lines');
    const vw = contentScrollWidth();
    const vh = viewportHeight();
    const fallback = {
        left: 0,
        top: 0,
        right: Math.min(vw * 0.72, 360) + pad,
        bottom: Math.min(vh * 0.2, 96) + pad,
    };
    if (!layer) return fallback;
    const lr = layer.getBoundingClientRect();
    const rows = mount?.querySelectorAll('.pretext-line-row');
    if (!rows?.length) return fallback;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    rows.forEach((row) => {
        const r = row.getBoundingClientRect();
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
    });
    return {
        left: Math.max(0, left - lr.left - pad),
        top: Math.max(0, top - lr.top - pad),
        right: Math.min(vw * 0.85, right - lr.left + pad),
        bottom: Math.min(Math.max(72, vh * 0.28), bottom - lr.top + pad),
    };
}

function overlapsKeepout(x, y, w, h, k) {
    return x < k.right && x + w > k.left && y < k.bottom && y + h > k.top;
}

function pushOutOfTitleKeepout(item, k) {
    if (!overlapsKeepout(item.x, item.y, item.w, item.h, k)) return;
    const toRight = k.right - item.x;
    const toBottom = k.bottom - item.y;
    if (toRight <= toBottom) {
        item.x = k.right;
        item.vx = Math.abs(item.vx) || CONFIG.drift.minSpeed;
    } else {
        item.y = k.bottom;
        item.vy = Math.abs(item.vy) || CONFIG.drift.minSpeed;
    }
}

function getLayerLocalPoint(e, layer) {
    const r = layer.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

let floatingItems = [];

function isMobile() {
    return window.matchMedia('(max-width: 800px)').matches;
}

function notifyPretextDirty() {
    window.dispatchEvent(new Event('pretext-dirty'));
}

const PANEL_FADE_OUT_MS = 220;
const PANEL_HEIGHT_FALLBACK_MS = 700;
const cvCloseTimers = { fade: null, height: null };
const contactCloseTimers = { fade: null, height: null };

function clearCvCloseTimers() {
    if (cvCloseTimers.fade) clearTimeout(cvCloseTimers.fade);
    if (cvCloseTimers.height) clearTimeout(cvCloseTimers.height);
    cvCloseTimers.fade = null;
    cvCloseTimers.height = null;
}

function clearContactCloseTimers() {
    if (contactCloseTimers.fade) clearTimeout(contactCloseTimers.fade);
    if (contactCloseTimers.height) clearTimeout(contactCloseTimers.height);
    contactCloseTimers.fade = null;
    contactCloseTimers.height = null;
}

function prefersReducedMotion() {
    return (
        typeof window.matchMedia !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

function setCvPanelOpen(open) {
    const panel = document.getElementById('cv-inline');
    if (!panel) return;
    clearCvCloseTimers();
    if (open) {
        panel.classList.remove('panel-fading-out');
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        document.body.classList.add('cv-open');
        const btn = document.getElementById('cv-inline-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => notifyPretextDirty());
        return;
    }
    if (!panel.classList.contains('is-open')) return;
    if (prefersReducedMotion()) {
        panel.classList.remove('is-open', 'panel-fading-out');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('cv-open');
        const btn = document.getElementById('cv-inline-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        requestAnimationFrame(() => notifyPretextDirty());
        return;
    }
    let finished = false;
    const finalize = () => {
        if (finished) return;
        finished = true;
        clearCvCloseTimers();
        panel.classList.remove('panel-fading-out');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('cv-open');
        const btn = document.getElementById('cv-inline-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        requestAnimationFrame(() => notifyPretextDirty());
    };

    const onFadeEnd = (e) => {
        if (e.target !== panel || e.propertyName !== 'opacity') return;
        if (finished) return;
        panel.removeEventListener('transitionend', onFadeEnd);
        clearTimeout(cvCloseTimers.fade);
        cvCloseTimers.fade = null;
        if (!panel.classList.contains('is-open')) return;
        panel.classList.remove('is-open');
        const onHeightEnd = (ev) => {
            if (ev.target !== panel || ev.propertyName !== 'max-height') return;
            panel.removeEventListener('transitionend', onHeightEnd);
            clearTimeout(cvCloseTimers.height);
            cvCloseTimers.height = null;
            finalize();
        };
        panel.addEventListener('transitionend', onHeightEnd);
        cvCloseTimers.height = setTimeout(() => {
            panel.removeEventListener('transitionend', onHeightEnd);
            finalize();
        }, PANEL_HEIGHT_FALLBACK_MS);
    };

    panel.addEventListener('transitionend', onFadeEnd);
    panel.classList.add('panel-fading-out');
    cvCloseTimers.fade = setTimeout(() => {
        panel.removeEventListener('transitionend', onFadeEnd);
        if (finished || !panel.classList.contains('panel-fading-out')) return;
        onFadeEnd({ target: panel, propertyName: 'opacity' });
    }, PANEL_FADE_OUT_MS + 140);
}

function setContactPanelOpen(open) {
    const panel = document.getElementById('contact-inline');
    if (!panel) return;
    clearContactCloseTimers();
    if (open) {
        panel.classList.remove('panel-fading-out');
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        document.body.classList.add('contact-open');
        const btn = document.getElementById('contact-inline-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => notifyPretextDirty());
        return;
    }
    if (!panel.classList.contains('is-open')) return;
    if (prefersReducedMotion()) {
        panel.classList.remove('is-open', 'panel-fading-out');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('contact-open');
        const btn = document.getElementById('contact-inline-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        requestAnimationFrame(() => notifyPretextDirty());
        return;
    }
    let finished = false;
    const finalize = () => {
        if (finished) return;
        finished = true;
        clearContactCloseTimers();
        panel.classList.remove('panel-fading-out');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('contact-open');
        const btn = document.getElementById('contact-inline-toggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        requestAnimationFrame(() => notifyPretextDirty());
    };

    const onFadeEnd = (e) => {
        if (e.target !== panel || e.propertyName !== 'opacity') return;
        if (finished) return;
        panel.removeEventListener('transitionend', onFadeEnd);
        clearTimeout(contactCloseTimers.fade);
        contactCloseTimers.fade = null;
        if (!panel.classList.contains('is-open')) return;
        panel.classList.remove('is-open');
        const onHeightEnd = (ev) => {
            if (ev.target !== panel || ev.propertyName !== 'max-height') return;
            panel.removeEventListener('transitionend', onHeightEnd);
            clearTimeout(contactCloseTimers.height);
            contactCloseTimers.height = null;
            finalize();
        };
        panel.addEventListener('transitionend', onHeightEnd);
        contactCloseTimers.height = setTimeout(() => {
            panel.removeEventListener('transitionend', onHeightEnd);
            finalize();
        }, PANEL_HEIGHT_FALLBACK_MS);
    };

    panel.addEventListener('transitionend', onFadeEnd);
    panel.classList.add('panel-fading-out');
    contactCloseTimers.fade = setTimeout(() => {
        panel.removeEventListener('transitionend', onFadeEnd);
        if (finished || !panel.classList.contains('panel-fading-out')) return;
        onFadeEnd({ target: panel, propertyName: 'opacity' });
    }, PANEL_FADE_OUT_MS + 140);
}

function setPanelOpen(panelId, bodyClass, open) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const already = panel.classList.contains('is-open');
    if (open === already) return;
    if (open) {
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        document.body.classList.add(bodyClass);
    } else {
        panel.classList.remove('is-open', 'panel-fading-out');
        panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove(bodyClass);
    }
}

const WORKS_IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
const WORKS_THUMB_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
let worksThumbsPromise = null;

function encodeAssetPath(path) {
    return String(path)
        .split('/')
        .filter((part) => part.length > 0)
        .map((part) => encodeURIComponent(part))
        .join('/');
}

function probeImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

function isLocalHost() {
    const host = location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '';
}

function imageNamesFromListingHtml(html) {
    const names = [];
    const re = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(html))) {
        const href = match[1].replace(/&amp;/g, '&').split('?')[0].split('#')[0];
        const name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
        if (!name || name === '..' || name.startsWith('.')) continue;
        if (WORKS_IMAGE_RE.test(name)) names.push(name);
    }
    return [...new Set(names)];
}

async function listWorksFolderImages(dir) {
    if (!isLocalHost()) return [];
    try {
        const res = await fetch(`${encodeAssetPath(dir)}/`, { cache: 'no-store' });
        if (!res.ok) return [];
        const text = await res.text();
        const trimmed = text.trimStart();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) return [];
        return imageNamesFromListingHtml(text);
    } catch {
        return [];
    }
}

async function loadWorksThumbsIndex() {
    try {
        const res = await fetch('works/thumbs.json', { cache: 'no-store' });
        if (!res.ok) return {};
        const data = await res.json();
        return data && typeof data === 'object' ? data : {};
    } catch {
        return {};
    }
}

async function findWorksThumb(dir, index) {
    const fromIndex = index[dir];
    const known = [
        ...(await listWorksFolderImages(dir)),
        ...(Array.isArray(fromIndex) ? fromIndex : fromIndex ? [fromIndex] : []),
    ];
    const encodedDir = encodeAssetPath(dir);
    const tried = new Set();
    for (const name of known) {
        if (!WORKS_IMAGE_RE.test(name) || tried.has(name)) continue;
        tried.add(name);
        const hit = await probeImage(`${encodedDir}/${encodeURIComponent(name)}`);
        if (hit) return hit;
    }
    for (const ext of WORKS_THUMB_EXTS) {
        const name = `thumb.${ext}`;
        if (tried.has(name)) continue;
        tried.add(name);
        const hit = await probeImage(`${encodedDir}/${name}`);
        if (hit) return hit;
    }
    return null;
}

function applyWorksThumb(entry, url) {
    let img = entry.querySelector(':scope > .works-thumb');
    if (!url) {
        img?.remove();
        return;
    }
    if (!img) {
        img = document.createElement('img');
        img.className = 'works-thumb';
        img.alt = '';
        entry.insertBefore(img, entry.firstChild);
    }
    img.src = url;
}

function initWorksThumbs() {
    if (worksThumbsPromise) return worksThumbsPromise;
    worksThumbsPromise = (async () => {
        const entries = document.querySelectorAll('#works-inline .works-entry[data-thumb]');
        if (!entries.length) return;
        const index = await loadWorksThumbsIndex();
        await Promise.all(
            [...entries].map(async (entry) => {
                const dir = (entry.dataset.thumb || '').replace(/\\/g, '/').replace(/\/+$/, '');
                if (!dir) return;
                applyWorksThumb(entry, await findWorksThumb(dir, index));
            })
        );
    })();
    return worksThumbsPromise;
}

function setSiteView(view) {
    if (view === 'index') view = 'home';
    if (view === 'info') view = 'about';
    setPanelOpen('info-inline', 'info-open', view === 'about');
    setPanelOpen('works-inline', 'works-open', view === 'works');
    if (view === 'works') void initWorksThumbs();
    if (view === 'home') {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }
    if (location.hash) {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
    syncSiteNavCurrent(view);
    window.dispatchEvent(new Event('site-view-change'));
}

function syncSiteNavCurrent(view) {
    const nav =
        view ||
        (document.body.classList.contains('works-open')
            ? 'works'
            : document.body.classList.contains('info-open')
              ? 'about'
              : 'home');
    document.querySelectorAll('.pretext-nav-link[data-nav]').forEach((el) => {
        const current = el.dataset.nav === nav;
        el.classList.toggle('is-current', current);
        if (current) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
    });
}
window.setSiteView = setSiteView;

function loadImageUrl(url, opts = {}) {
    return new Promise((res) => {
        const img = new Image();
        img.decoding = 'async';
        if (opts.priority) img.fetchPriority = 'high';
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = url;
    });
}

async function loadAssetImage(relativePath, opts = {}) {
    for (const url of candidateAssetUrls(relativePath)) {
        const img = await loadImageUrl(url, opts);
        if (img) return img;
    }
    return null;
}

function attachPointerHandlers(container, item) {
    const onMove = (e) => {
        if (!item.isDragging) return;
        const layer = document.getElementById('drawings-layer');
        if (!layer) return;
        const { x: lx, y: ly } = getLayerLocalPoint(e, layer);
        item.x = lx - item.dragOffsetX;
        item.y = ly - item.dragOffsetY;
        item.dragMoved = Math.max(
            item.dragMoved,
            Math.hypot(e.clientX - item.dragStartX, e.clientY - item.dragStartY)
        );
        if (item.el?.style) {
            item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
        }
        notifyPretextDirty();
    };

    container.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') item.isHovered = true;
    });
    container.addEventListener('pointerleave', () => {
        item.isHovered = false;
    });

    container.onpointerdown = (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        const layer = document.getElementById('drawings-layer');
        if (!layer) return;
        const { x: lx, y: ly } = getLayerLocalPoint(e, layer);
        item.isDragging = true;
        item.dragMoved = 0;
        item.dragStartX = e.clientX;
        item.dragStartY = e.clientY;
        item.dragDownAt = Date.now();
        item.pointerType = e.pointerType;
        container.setPointerCapture(e.pointerId);
        item.dragOffsetX = lx - item.x;
        item.dragOffsetY = ly - item.y;
    };
    container.addEventListener('dragstart', (e) => e.preventDefault());
    container.addEventListener('selectstart', (e) => e.preventDefault());
    container.onpointermove = onMove;
    container.onpointerup = () => {
        item.isDragging = false;
        const slop = item.pointerType === 'touch' || isMobile() ? 22 : 12;
        const tap = item.linkHref && item.dragMoved < slop && Date.now() - item.dragDownAt < 900;
        if (tap) {
            const h = item.linkHref;
            if (/^https?:\/\//i.test(h)) {
                window.open(h, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = h;
            }
        }
    };
    container.onpointercancel = () => {
        item.isDragging = false;
    };
}

function createPieceElement(imgObj, parent, opts = {}) {
    const { extraClass = '', linkHref = null, label = '', scale: scaleOpt, role = '', washIndex = 0 } = opts;
    const range = CONFIG.pieces;
    const mn = opts.minScale ?? range.minScale;
    const mx = opts.maxScale ?? range.maxScale;

    const container = document.createElement('div');
    container.className = `drawing-item${extraClass ? ` ${extraClass}` : ''}${role ? ` is-${role}` : ''}`;
    const imgEl = document.createElement('img');
    imgEl.src = imgObj.src;
    imgEl.alt = label;
    imgEl.decoding = 'async';
    imgEl.draggable = false;
    imgEl.setAttribute('draggable', 'false');
    container.appendChild(imgEl);

    const scale =
        typeof opts.fixedScale === 'number'
            ? opts.fixedScale
            : scaleOpt ?? mn + Math.random() * (mx - mn);
    const w = piecePixelWidth(scale);
    const ratio =
        imgObj.naturalWidth > 0 ? imgObj.naturalHeight / imgObj.naturalWidth : 1;
    const h = w * ratio;
    container.style.setProperty('--piece-scale', String(scale));
    container.style.width = `${w}px`;
    if (role === 'wash') {
        container.style.setProperty('--wash-z', String(washIndex));
        container.style.zIndex = String(washIndex);
    } else {
        container.style.zIndex = String(Math.round((1.35 - Math.min(scale, 1.3)) * 14));
    }

    const motion = pickMotion(scale, opts);
    const item = {
        el: container,
        x: 0,
        y: 0,
        vx: motion.vx,
        vy: motion.vy,
        moves: motion.moves,
        speedMul: motion.speedMul,
        isDragging: false,
        isHovered: false,
        physicsReady: false,
        scale,
        ratio,
        w,
        h,
        role,
        linkHref,
        dragMoved: 0,
        dragStartX: 0,
        dragStartY: 0,
        dragDownAt: 0,
        pointerType: 'mouse',
    };

    if (role === 'wash') {
        placeWashItem(item, washIndex);
    } else if (typeof opts.x === 'number' && typeof opts.y === 'number') {
        item.x = opts.x - w * 0.35;
        item.y = opts.y - h * 0.35;
        const keepout = titleKeepoutRect();
        if (scale < 0.45) pushOutOfTitleKeepout(item, keepout);
        clampPiecePos(item);
    } else {
        const docW = contentScrollWidth();
        const docH = contentScrollHeight();
        const maxX = Math.max(10, docW - w - 10);
        const maxY = Math.max(10, docH - h - 10);
        const keepout = titleKeepoutRect();
        item.x = Math.random() * maxX + 10;
        item.y = Math.random() * maxY + 10;
        for (let i = 0; i < 40 && overlapsKeepout(item.x, item.y, w, h, keepout); i++) {
            item.x = Math.random() * maxX + 10;
            item.y = Math.random() * maxY + 10;
        }
        clampPiecePos(item);
        if (scale < 0.45) pushOutOfTitleKeepout(item, keepout);
        clampPiecePos(item);
    }

    container.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
    if (label) container.title = label;
    attachPointerHandlers(container, item);

    parent.appendChild(container);
    floatingItems.push(item);
    return container;
}

function markItemPhysicsReady(el) {
    const item = floatingItems.find((it) => it.el === el);
    if (item) item.physicsReady = true;
}

async function initFloating() {
    const layer = document.getElementById('drawings-layer');
    if (!layer) return;

    const pieceDefs = await loadFloatPieceDefs();
    if (!pieceDefs.length) return;

    const plans = planFloatLayout(pieceDefs);
    const washCount = plans.filter((p) => p.role === 'wash').length;
    const slots = slotPositions(Math.max(0, plans.length - washCount));
    const staggerMs = isMobile() ? 0 : 48;
    let slotI = 0;
    plans.forEach((plan, index) => {
        const file = plan.def.file;
        const slot = plan.role === 'wash' ? null : slots[slotI++];
        const priority = plan.role === 'wash' || index < 4;
        void loadAssetImage(`${CONFIG.paths.items}${file}`, { priority }).then((img) => {
            if (!img) return;
            createPieceElement(img, layer, {
                label: file.replace(/\.[^.]+$/i, '').replace(/_/g, ' '),
                fixedScale: plan.scale,
                move: plan.move,
                speed: plan.speed,
                role: plan.role,
                washIndex: plan.washIndex,
                x: slot?.x,
                y: slot?.y,
            });
            const el = floatingItems[floatingItems.length - 1]?.el;
            if (!el) return;
            const reveal = () => {
                el.classList.add('appeared');
                markItemPhysicsReady(el);
            };
            if (staggerMs === 0) reveal();
            else setTimeout(reveal, index * staggerMs);
        });
    });
}

function updatePhysics() {
    if (
        document.body.classList.contains('works-open') ||
        document.body.classList.contains('info-open')
    ) {
        requestAnimationFrame(updatePhysics);
        return;
    }

    const bufferZone = 40;

    floatingItems.forEach((item) => {
        if (!item.physicsReady) {
            if (item.el?.style) {
                item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
            }
            return;
        }
        if (item.moves && !item.isDragging && !item.isHovered) {
            item.x += item.vx;
            item.y += item.vy;

            const itemW = item.w;
            const itemH = item.h;
            const maxX = contentScrollWidth() - itemW;
            const maxY = contentScrollHeight() - itemH;

            if (maxX > 0) {
                if (item.x < bufferZone) {
                    const factor = item.x / bufferZone;
                    item.vx = Math.abs(item.vx) * (0.3 + factor * 0.7);
                    item.x = Math.max(0, item.x);
                }
                if (item.x > maxX - bufferZone) {
                    const factor = (maxX - item.x) / bufferZone;
                    item.vx = -Math.abs(item.vx) * (0.3 + factor * 0.7);
                    item.x = Math.min(maxX, item.x);
                }
            }
            if (maxY > 0) {
                if (item.y < bufferZone) {
                    const factor = item.y / bufferZone;
                    item.vy = Math.abs(item.vy) * (0.3 + factor * 0.7);
                    item.y = Math.max(0, item.y);
                }
                if (item.y > maxY - bufferZone) {
                    const factor = (maxY - item.y) / bufferZone;
                    item.vy = -Math.abs(item.vy) * (0.3 + factor * 0.7);
                    item.y = Math.min(maxY, item.y);
                }
            }

            clampPiecePos(item);

            const damp = CONFIG.drift.damping;
            item.vx *= damp;
            item.vy *= damp;

            const minV = CONFIG.drift.minSpeed * (item.speedMul || 1);
            if (Math.abs(item.vx) < minV && Math.abs(item.vy) < minV) {
                const n = CONFIG.drift.nudge * (item.speedMul || 1);
                item.vx += (Math.random() - 0.5) * 2 * n;
                item.vy += (Math.random() * 2 - 1) * n;
            }
        }

        if (item.el?.style) {
            item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
        }
    });

    requestAnimationFrame(updatePhysics);
}

function rescaleFloatingItems() {
    const keepout = titleKeepoutRect();
    floatingItems.forEach((item) => {
        const w = piecePixelWidth(item.scale || 0.18);
        const h = w * (item.ratio || 1);
        item.w = w;
        item.h = h;
        if (item.el?.style) item.el.style.width = `${w}px`;
        clampPiecePos(item);
        if (item.scale < 0.45) pushOutOfTitleKeepout(item, keepout);
        clampPiecePos(item);
        if (item.el?.style) {
            item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
        }
    });
}

function toggleCollapsible(element) {
    const content = element.nextElementSibling;
    if (!content?.classList.contains('content')) return;
    const willOpen = !content.classList.contains('is-open');
    content.classList.toggle('is-open', willOpen);
    element.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    requestAnimationFrame(() => notifyPretextDirty());
}

function initCvInline() {
    const panel = document.getElementById('info-inline');
    const textBlock = document.querySelector('.text-block');
    if (!panel || !textBlock || textBlock.dataset.cvDeleg) return;
    textBlock.dataset.cvDeleg = '1';

    panel.querySelectorAll('.content').forEach((el) => el.style.removeProperty('display'));

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        setSiteView('home');
    });

    panel.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'max-height') {
            notifyPretextDirty();
        }
    });

    const worksPanel = document.getElementById('works-inline');
    if (worksPanel) {
        worksPanel.addEventListener('transitionend', (e) => {
            if (e.propertyName === 'max-height') {
                notifyPretextDirty();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCvInline();
    setSiteView('home');
    document.addEventListener('click', (e) => {
        const langBtn = e.target.closest?.('[data-lang]');
        if (langBtn && typeof window.setSiteLang === 'function') {
            e.preventDefault();
            window.setSiteLang(langBtn.dataset.lang);
            return;
        }
        const btn = e.target.closest?.('[data-nav]');
        if (!btn) return;
        const nav = btn.dataset.nav;
        if (nav) {
            e.preventDefault();
            setSiteView(nav);
        }
    });
    if (!CONFIG.floatsEnabled || !document.getElementById('drawings-layer')) return;
    if (prefersReducedMotion()) {
        CONFIG.drift.vMax = 0;
        CONFIG.drift.minSpeed = 0;
        CONFIG.drift.nudge = 0;
    }
    let viewportTimer = 0;
    let lastLayoutWidth = viewportWidth();
    const onViewportChange = () => {
        window.clearTimeout(viewportTimer);
        viewportTimer = window.setTimeout(() => {
            const w = viewportWidth();
            if (w < 60 || Math.abs(w - lastLayoutWidth) < 8) return;
            lastLayoutWidth = w;
            rescaleFloatingItems();
        }, 280);
    };
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });
    updatePhysics();
    void (async () => {
        await initFloating();
    })();
});
