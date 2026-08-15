const CONFIG = {
    /** Off for now — set true to bring back drifting cut-outs on index. */
    floatsEnabled: false,
    pieces: { minScale: 0.055, maxScale: 0.1 },
    /** Largura ≈ min(vw,vh) * escala — no telemóvel o ecrã estreito pede escalas maiores. */
    piecesMobile: { minScale: 0.16, maxScale: 0.26 },
    workFloats: { minScale: 0.055, maxScale: 0.09 },
    workFloatsMobile: { minScale: 0.14, maxScale: 0.22 },
    paths: { items: 'main/items/' },
    /** Movimento flutuante: vx/vy por frame (~60fps). Lento — menu, não dança. */
    drift: {
        vMax: 0.28,
        damping: 0.9997,
        minSpeed: 0.02,
        nudge: 0.04,
    },
    /** Zona livre à volta do título / nav (px). */
    titleKeepoutPad: 28,
};

const WORK_FLOATS = [
    { path: 'work/ceramics.png', href: 'https://andreianmatos.github.io/ceramics', label: 'ceramics' },
    { path: 'work/images.png', href: 'https://andreianmatos.github.io/images', label: 'images' },
    { path: 'work/drawings.png', href: 'https://andreianmatos.github.io/drawings', label: 'drawings' },
    { path: 'work/videos.gif', href: 'https://andreianmatos.github.io/videos', label: 'videos' },
    { path: 'work/writings.png', href: 'writings.html', label: 'writings' },
];

/** Recortes na raiz de `main/items/` (a pasta `no/` não entra nos floats). Acrescenta aqui ficheiros novos. */
const ITEM_PIECE_FILES = [
    '1.png',
    '2.png',
    '3.png',
    '4.png',
    '5.png',
    '7.png',
    '8.png',
    '9.png',
];

function pageDirectoryPath() {
    let p = window.location.pathname;
    if (p.endsWith('/')) return p;
    if (/\.html?$/i.test(p)) return p.replace(/\/[^/]*$/, '/');
    return `${p}/`;
}

function resolveAssetUrl(relativePath) {
    const clean = relativePath.replace(/^\//, '');
    if (window.location.protocol === 'file:') return clean;
    return `${window.location.origin}${pageDirectoryPath()}${clean}`;
}

/** Go Live vs site em produção: tentar pasta da página e depois raiz do domínio (CNAME / index na raiz). */
function candidateAssetUrls(relativePath) {
    const clean = relativePath.replace(/^\//, '');
    if (window.location.protocol === 'file:') return [clean];
    const primary = resolveAssetUrl(relativePath);
    const atRoot = `${window.location.origin}/${clean}`;
    return primary === atRoot ? [primary] : [primary, atRoot];
}

function viewportWidth() {
    return window.visualViewport?.width ?? window.innerWidth;
}

function viewportHeight() {
    return window.visualViewport?.height ?? window.innerHeight;
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

function setSiteView(view) {
    setPanelOpen('info-inline', 'info-open', view === 'info');
    setPanelOpen('works-inline', 'works-open', view === 'works');
    if (location.hash) {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
    requestAnimationFrame(() => notifyPretextDirty());
}
window.setSiteView = setSiteView;

function loadImageUrl(url) {
    return new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = url;
    });
}

async function loadAssetImage(relativePath) {
    for (const url of candidateAssetUrls(relativePath)) {
        const img = await loadImageUrl(url);
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
    const { extraClass = '', linkHref = null, label = '' } = opts;
    const m = isMobile();
    const isWork = /\bwork-float\b/.test(extraClass);
    let mn;
    let mx;
    if (isWork) {
        mn = m ? CONFIG.workFloatsMobile.minScale : CONFIG.workFloats.minScale;
        mx = m ? CONFIG.workFloatsMobile.maxScale : CONFIG.workFloats.maxScale;
    } else {
        mn = m ? CONFIG.piecesMobile.minScale : CONFIG.pieces.minScale;
        mx = m ? CONFIG.piecesMobile.maxScale : CONFIG.pieces.maxScale;
    }

    const container = document.createElement('div');
    container.className = `drawing-item${extraClass ? ` ${extraClass}` : ''}`;
    const imgEl = document.createElement('img');
    imgEl.src = imgObj.src;
    imgEl.alt = label;
    imgEl.draggable = false;
    container.appendChild(imgEl);

    const scale = mn + Math.random() * (mx - mn);
    const vw = viewportWidth();
    const refW = m ? Math.min(vw, viewportHeight()) : vw;
    let w = refW * scale;
    if (m && isWork) w = Math.max(48, w);
    const ratio =
        imgObj.naturalWidth > 0 ? imgObj.naturalHeight / imgObj.naturalWidth : 1;
    const h = w * ratio;
    container.style.width = `${w}px`;

    const docW = contentScrollWidth();
    const docH = contentScrollHeight();
    const maxX = Math.max(10, docW - w - 10);
    const maxY = Math.max(10, docH - h - 10);
    const keepout = titleKeepoutRect();
    let x = Math.random() * maxX + 10;
    let y = Math.random() * maxY + 10;
    for (let i = 0; i < 40 && overlapsKeepout(x, y, w, h, keepout); i++) {
        x = Math.random() * maxX + 10;
        y = Math.random() * maxY + 10;
    }
    if (overlapsKeepout(x, y, w, h, keepout)) {
        x = Math.min(maxX, Math.max(10, keepout.right + 8));
        y = Math.min(maxY, Math.max(10, keepout.bottom + 8));
    }
    const item = {
        el: container,
        x,
        y,
        vx: (Math.random() - 0.5) * 2 * CONFIG.drift.vMax,
        vy: (Math.random() - 0.5) * 2 * CONFIG.drift.vMax,
        isDragging: false,
        isHovered: false,
        /** Drift só depois de visível — evita saltos quando o fade-in atrasa. */
        physicsReady: false,
        scale,
        ratio,
        w,
        h,
        linkHref,
        dragMoved: 0,
        dragStartX: 0,
        dragStartY: 0,
        dragDownAt: 0,
        pointerType: 'mouse',
    };

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

    const results = await Promise.all(
        ITEM_PIECE_FILES.map((f) => loadAssetImage(`${CONFIG.paths.items}${f}`))
    );
    const loaded = results.filter(Boolean);
    loaded.sort(() => Math.random() - 0.5);

    const staggerMs = isMobile() ? 0 : 48;
    const pieces = isMobile() ? loaded.slice(0, 4) : loaded;
    pieces.forEach((img, index) => {
        createPieceElement(img, layer, {});
        const el = floatingItems[floatingItems.length - 1]?.el;
        if (!el) return;
        const reveal = () => {
            el.classList.add('appeared');
            markItemPhysicsReady(el);
        };
        if (staggerMs === 0) {
            reveal();
        } else {
            setTimeout(reveal, index * staggerMs);
        }
    });
}

async function initWorkFloats() {
    const layer = document.getElementById('drawings-layer');
    if (!layer) return;

    const staggerMs = isMobile() ? 0 : 52;
    const baseDelay = isMobile() ? 0 : 100;
    const loaded = await Promise.all(
        WORK_FLOATS.map(async (def) => {
            const img = await loadAssetImage(def.path);
            return img ? { img, def } : null;
        })
    );
    loaded.forEach((entry, index) => {
        if (!entry) return;
        const { img, def } = entry;
        createPieceElement(img, layer, {
            extraClass: 'work-float',
            linkHref: def.href,
            label: def.label,
        });
        const el = floatingItems[floatingItems.length - 1]?.el;
        if (!el) return;
        const reveal = () => {
            el.classList.add('appeared');
            markItemPhysicsReady(el);
        };
        if (staggerMs === 0) {
            reveal();
        } else {
            setTimeout(reveal, baseDelay + index * staggerMs);
        }
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
    const keepout = titleKeepoutRect();

    floatingItems.forEach((item) => {
        if (!item.physicsReady) {
            if (item.el?.style) {
                item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
            }
            return;
        }
        if (!item.isDragging && !item.isHovered) {
            item.x += item.vx;
            item.y += item.vy;

            const itemW = item.w;
            const itemH = item.h;
            const maxX = contentScrollWidth() - itemW;
            const maxY = contentScrollHeight() - itemH;

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

            item.x = Math.max(0, Math.min(maxX, item.x));
            item.y = Math.max(0, Math.min(maxY, item.y));

            pushOutOfTitleKeepout(item, keepout);
            item.x = Math.max(0, Math.min(maxX, item.x));
            item.y = Math.max(0, Math.min(maxY, item.y));

            const damp = CONFIG.drift.damping;
            item.vx *= damp;
            item.vy *= damp;

            const minV = CONFIG.drift.minSpeed;
            if (Math.abs(item.vx) < minV && Math.abs(item.vy) < minV) {
                const n = CONFIG.drift.nudge;
                item.vx += (Math.random() - 0.5) * 2 * n;
                item.vy += (Math.random() - 0.5) * 2 * n;
            }
        }

        if (item.el?.style) {
            item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
        }
    });

    requestAnimationFrame(updatePhysics);
}

function rescaleFloatingItems() {
    const m = isMobile();
    const vw = viewportWidth();
    const refW = m ? Math.min(vw, viewportHeight()) : vw;
    const keepout = titleKeepoutRect();
    const docW = contentScrollWidth();
    const docH = contentScrollHeight();
    floatingItems.forEach((item) => {
        const isWork = item.el?.classList.contains('work-float');
        let w = refW * (item.scale || 0.1);
        if (m && isWork) w = Math.max(48, w);
        const h = w * (item.ratio || 1);
        item.w = w;
        item.h = h;
        if (item.el) item.el.style.width = `${w}px`;
        const maxX = Math.max(0, docW - w);
        const maxY = Math.max(0, docH - h);
        item.x = Math.max(0, Math.min(maxX, item.x));
        item.y = Math.max(0, Math.min(maxY, item.y));
        pushOutOfTitleKeepout(item, keepout);
        item.x = Math.max(0, Math.min(maxX, item.x));
        item.y = Math.max(0, Math.min(maxY, item.y));
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
        setSiteView('index');
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
    setSiteView('index');
    if (!CONFIG.floatsEnabled || !document.getElementById('drawings-layer')) return;
    if (prefersReducedMotion()) {
        CONFIG.drift.vMax = 0;
        CONFIG.drift.minSpeed = 0;
        CONFIG.drift.nudge = 0;
    }
    let viewportTimer = 0;
    const onViewportChange = () => {
        window.clearTimeout(viewportTimer);
        viewportTimer = window.setTimeout(() => {
            rescaleFloatingItems();
            notifyPretextDirty();
        }, 160);
    };
    window.addEventListener('resize', onViewportChange, { passive: true });
    window.addEventListener('orientationchange', onViewportChange, { passive: true });
    window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
    updatePhysics();
    void (async () => {
        await initFloating();
        await initWorkFloats();
    })();
});
