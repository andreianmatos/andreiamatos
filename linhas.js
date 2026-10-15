const PAGES_MANIFEST = 'works/drawings/Linhas/pages.json';
const PAGE_SIZE = { width: 561, height: 726 };

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function updatePos(flip, index) {
    const pos = document.getElementById('book-pos');
    const prev = document.getElementById('book-prev');
    const next = document.getElementById('book-next');
    const n = flip.getPageCount();
    const i = Math.max(0, Math.min(index, n - 1));
    const left = i % 2 === 0 ? i : i - 1;
    const spreads = Math.max(1, Math.ceil(n / 2));
    const spread = Math.floor(left / 2) + 1;
    if (pos) pos.textContent = `${spread} / ${spreads}`;
    if (prev) prev.disabled = left <= 0;
    if (next) next.disabled = left + 1 >= n - 1;
}

async function loadPages() {
    const res = await fetch(PAGES_MANIFEST, { cache: 'no-store' });
    if (!res.ok) throw new Error('pages missing');
    const data = await res.json();
    let pages = Array.isArray(data?.pages) ? data.pages.filter(Boolean) : [];
    if (pages.length >= 3) pages = pages.slice(1, -1);
    if (!pages.length) throw new Error('no pages');
    return pages;
}

function fitBookHost(host) {
    const stage = host.parentElement?.getBoundingClientRect();
    if (!stage) return;
    const ratio = PAGE_SIZE.height / PAGE_SIZE.width;
    const pad = 8;
    const availW = Math.max(160, stage.width - pad);
    const availH = Math.max(200, stage.height - pad);
    const pageW = Math.min(availW / 2, availH / ratio);
    host.style.width = `${Math.round(pageW * 2)}px`;
    host.style.height = `${Math.round(pageW * ratio)}px`;
}

async function initBook() {
    const host = document.getElementById('book');
    if (!host || typeof St === 'undefined' || !St.PageFlip) return;

    let pages;
    try {
        pages = await loadPages();
    } catch (_) {
        window.location.replace('works/drawings/Linhas/linhas.pdf');
        return;
    }

    fitBookHost(host);
    const flip = new St.PageFlip(host, {
        width: PAGE_SIZE.width,
        height: PAGE_SIZE.height,
        size: 'stretch',
        minWidth: 180,
        maxWidth: 900,
        minHeight: 240,
        maxHeight: 1200,
        drawShadow: true,
        flippingTime: reducedMotion() ? 1 : 860,
        usePortrait: false,
        autoSize: false,
        maxShadowOpacity: 0.32,
        showCover: false,
        mobileScrollSupport: false,
        swipeDistance: 36,
        startZIndex: 2,
        useMouseEvents: true,
        showPageCorners: true,
    });

    flip.loadFromImages(pages);
    updatePos(flip, 0);

    flip.on('flip', (e) => updatePos(flip, e.data));
    flip.on('init', (e) => updatePos(flip, e.data?.page ?? 0));

    document.getElementById('book-prev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        flip.turnToPrevPage();
    });
    document.getElementById('book-next')?.addEventListener('click', (e) => {
        e.stopPropagation();
        flip.turnToNextPage();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            flip.turnToNextPage();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            flip.turnToPrevPage();
        } else if (e.key === 'Home') {
            e.preventDefault();
            flip.turnToPage(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            flip.turnToPage(flip.getPageCount() - 1);
        }
    });

    let fitTimer = 0;
    window.addEventListener('resize', () => {
        window.clearTimeout(fitTimer);
        fitTimer = window.setTimeout(() => {
            fitBookHost(host);
            flip.update();
        }, 120);
    });
}

document.addEventListener('click', (e) => {
    const langBtn = e.target.closest?.('[data-lang]');
    if (langBtn && typeof window.setSiteLang === 'function') {
        e.preventDefault();
        window.setSiteLang(langBtn.dataset.lang);
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBook);
} else {
    initBook();
}
