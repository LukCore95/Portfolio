<script type="text/javascript">
(function () {
  'use strict';

  console.log('[Lightbox] init script start');

  const CLICK_SCOPE_SELECTOR = '.post-body, .post';
  const ALLOWED = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

  let links = [];
  let index = -1;
  let isOpen = false;

  let overlay, imgEl, closeBtn, captionEl, loadingEl, navEl, arrowL, arrowR;

  function removeEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function findLinks() {
    const scopes = Array.from(document.querySelectorAll(CLICK_SCOPE_SELECTOR));
    const anchors = scopes.flatMap(scope => Array.from(scope.querySelectorAll('a[href]')));

    const filtered = anchors
      .filter(a => a.querySelector('img'))
      .filter(a => ALLOWED.test(a.getAttribute('href') || ''));

    return Array.from(new Set(filtered));
  }

  function buildUI() {
    overlay = document.createElement('div');
    overlay.id = 'imagelightbox-overlay';
    document.body.appendChild(overlay);

    imgEl = document.createElement('img');
    imgEl.id = 'imagelightbox';
    document.body.appendChild(imgEl);

    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'imagelightbox-close';
    closeBtn.title = 'Close';
    document.body.appendChild(closeBtn);

    arrowL = document.createElement('button');
    arrowL.type = 'button';
    arrowL.className = 'imagelightbox-arrow imagelightbox-arrow-left';

    arrowR = document.createElement('button');
    arrowR.type = 'button';
    arrowR.className = 'imagelightbox-arrow imagelightbox-arrow-right';

    document.body.appendChild(arrowL);
    document.body.appendChild(arrowR);

    navEl = document.createElement('div');
    navEl.id = 'imagelightbox-nav';
    for (let i = 0; i < links.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      navEl.appendChild(b);
    }
    document.body.appendChild(navEl);

    closeBtn.addEventListener('click', quit);
    arrowL.addEventListener('click', () => step(-1));
    arrowR.addEventListener('click', () => step(1));

    overlay.addEventListener('click', quit);

    imgEl.addEventListener('click', (e) => {
      e.preventDefault();
      const rect = imgEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      step(x < rect.width / 2 ? -1 : 1);
    });

    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const buttons = Array.from(navEl.querySelectorAll('button'));
      const idx = buttons.indexOf(btn);
      if (idx >= 0) switchTo(idx);
    });

    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', positionImage);
  }

  function destroyUI() {
    window.removeEventListener('resize', positionImage);
    document.removeEventListener('keyup', onKeyUp);

    removeEl(overlay);
    removeEl(imgEl);
    removeEl(closeBtn);
    removeEl(arrowL);
    removeEl(arrowR);
    removeEl(navEl);
    removeEl(captionEl);
    removeEl(loadingEl);

    overlay = imgEl = closeBtn = captionEl = loadingEl = navEl = arrowL = arrowR = null;
  }

  function onKeyUp(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') quit();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  }

  function showLoading() {
    removeEl(loadingEl);
    loadingEl = document.createElement('div');
    loadingEl.id = 'imagelightbox-loading';
    loadingEl.innerHTML = '<div></div>';
    document.body.appendChild(loadingEl);
  }

  function hideLoading() {
    removeEl(loadingEl);
    loadingEl = null;
  }

  function showCaption() {
    removeEl(captionEl);

    const a = links[index];
    const img = a ? a.querySelector('img') : null;
    const alt = img && img.hasAttribute('alt') ? img.getAttribute('alt') : '';
    const text = alt && alt.trim() ? alt : 'No Caption';

    captionEl = document.createElement('div');
    captionEl.id = 'imagelightbox-caption';
    captionEl.textContent = text;
    document.body.appendChild(captionEl);
  }

  function setNavActive() {
    if (!navEl) return;
    const buttons = Array.from(navEl.querySelectorAll('button'));
    buttons.forEach((b, i) => b.classList.toggle('active', i === index));
  }

  function positionImage() {
    if (!imgEl || !imgEl.naturalWidth) return;

    const maxW = window.innerWidth * 0.8;
    const maxH = window.innerHeight * 0.9;

    let w = imgEl.naturalWidth;
    let h = imgEl.naturalHeight;

    if (w > maxW || h > maxH) {
      const scale = (w / h > maxW / maxH) ? (w / maxW) : (h / maxH);
      w = w / scale;
      h = h / scale;
    }

    imgEl.style.width = `${w}px`;
    imgEl.style.height = `${h}px`;
    imgEl.style.position = 'fixed';
    imgEl.style.left = `${(window.innerWidth - w) / 2}px`;
    imgEl.style.top = `${(window.innerHeight - h) / 2}px`;
    imgEl.style.opacity = '1';
  }

  function step(delta) {
    if (!isOpen) return;
    if (links.length < 2) return;

    let newIndex = index + delta;
    if (newIndex < 0) newIndex = links.length - 1;
    if (newIndex >= links.length) newIndex = 0;

    switchTo(newIndex);
  }

  function switchTo(newIndex) {
    if (!isOpen) return;
    if (newIndex === index) return;
    index = newIndex;
    loadCurrent();
  }

  function loadCurrent() {
    const a = links[index];
    if (!a) return;

    const href = a.getAttribute('href');
    if (!href) return;

    showLoading();
    removeEl(captionEl);

    imgEl.style.opacity = '0';

    const loader = new Image();
    loader.onload = function () {
      imgEl.src = href;
      requestAnimationFrame(() => {
        positionImage();
        hideLoading();
        showCaption();
        setNavActive();
        if (arrowL) arrowL.style.display = 'block';
        if (arrowR) arrowR.style.display = 'block';
      });
    };
    loader.onerror = function () {
      hideLoading();
      quit();
    };
    loader.src = href;
  }

  function openAt(i) {
    links = findLinks();
    console.log('[Lightbox] links found:', links.length);
    if (!links.length) return;

    index = Math.max(0, Math.min(i, links.length - 1));
    isOpen = true;

    buildUI();
    loadCurrent();
  }

  function quit() {
    if (!isOpen) return;
    isOpen = false;
    destroyUI();
    index = -1;
  }

  // CAPTURE: przechwytuje klik zanim inne skrypty go zablokują
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (!a.querySelector('img')) return;
    if (!a.closest(CLICK_SCOPE_SELECTOR)) return;

    const href = a.getAttribute('href') || '';
    if (!ALLOWED.test(href)) return;

    console.log('[Lightbox] click:', href);

    e.preventDefault();
    e.stopPropagation();

    const current = findLinks();
    const idx = current.indexOf(a);
    openAt(idx >= 0 ? idx : 0);
  }, true);

  console.log('[Lightbox] handler attached');
})();
</script>
