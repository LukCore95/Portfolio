/* Vanilla ImageLightbox for Blogger (no jQuery)
   Targets: .post-body a[href] > img
   Creates:
   - #imagelightbox (img)
   - #imagelightbox-overlay
   - #imagelightbox-close
   - .imagelightbox-arrow-left/.imagelightbox-arrow-right
   - #imagelightbox-nav (buttons)
   - #imagelightbox-loading
   - #imagelightbox-caption
*/
(function () {
  'use strict';
   console.log('[Lightbox] script loaded');

  const SELECTOR = '.post-body a[href] img';
  const ALLOWED = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

  const opts = {
    animationSpeed: 250,
    preloadNext: true,
    enableKeyboard: true,
    quitOnEnd: false,
    quitOnImgClick: false,
    quitOnDocClick: true,
  };

  /** @type {HTMLAnchorElement[]} */
  let links = [];
  let index = -1;
  let isOpen = false;

  let overlay, imgEl, closeBtn, captionEl, loadingEl, navEl, arrowL, arrowR;

  function q(id) { return document.getElementById(id); }
  function removeEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function findLinks() {
    const imgs = Array.from(document.querySelectorAll(SELECTOR));
    const anchors = imgs
      .map(img => img.closest('a'))
      .filter(Boolean)
      .filter(a => ALLOWED.test(a.getAttribute('href') || ''));
    // de-dup (same node repeated)
    return Array.from(new Set(anchors));
  }

  function buildUI() {
    // overlay
    overlay = document.createElement('div');
    overlay.id = 'imagelightbox-overlay';
    document.body.appendChild(overlay);

    // image
    imgEl = document.createElement('img');
    imgEl.id = 'imagelightbox';
    document.body.appendChild(imgEl);

    // close
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'imagelightbox-close';
    closeBtn.title = 'Close';
    document.body.appendChild(closeBtn);

    // arrows
    arrowL = document.createElement('button');
    arrowL.type = 'button';
    arrowL.className = 'imagelightbox-arrow imagelightbox-arrow-left';

    arrowR = document.createElement('button');
    arrowR.type = 'button';
    arrowR.className = 'imagelightbox-arrow imagelightbox-arrow-right';

    document.body.appendChild(arrowL);
    document.body.appendChild(arrowR);

    // nav
    navEl = document.createElement('div');
    navEl.id = 'imagelightbox-nav';
    for (let i = 0; i < links.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      navEl.appendChild(b);
    }
    document.body.appendChild(navEl);

    // events
    closeBtn.addEventListener('click', quit);
    closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); quit(); }, { passive: false });

    arrowL.addEventListener('click', () => step(-1));
    arrowR.addEventListener('click', () => step(1));

    // clicking overlay closes (optional)
    if (opts.quitOnDocClick) {
      overlay.addEventListener('click', quit);
    }

    // clicking image (optional quit / else step by side)
    imgEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (opts.quitOnImgClick) return quit();
      // emulate old behavior: click left half = prev, right half = next
      const rect = imgEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      step(x < rect.width / 2 ? -1 : 1);
    });

    // nav clicks
    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const buttons = Array.from(navEl.querySelectorAll('button'));
      const idx = buttons.indexOf(btn);
      if (idx >= 0) switchTo(idx);
    });

    // keyboard
    if (opts.enableKeyboard) {
      document.addEventListener('keyup', onKeyUp);
    }

    // resize reposition
    window.addEventListener('resize', positionImage);
  }

  function destroyUI() {
    window.removeEventListener('resize', positionImage);
    if (opts.enableKeyboard) document.removeEventListener('keyup', onKeyUp);

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

  function preloadNext() {
    if (!opts.preloadNext || links.length === 0) return;
    const nextIndex = (index + 1) % links.length;
    const href = links[nextIndex].getAttribute('href');
    if (!href) return;
    const pre = new Image();
    pre.src = href;
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

    const next = index + delta;

    if (opts.quitOnEnd) {
      if (next < 0 || next >= links.length) return quit();
    }

    // wrap
    let newIndex = next;
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

    // small fade
    imgEl.style.opacity = '0';

    const loader = new Image();
    loader.onload = function () {
      imgEl.src = href;
      // once src set, ensure natural sizes available shortly
      requestAnimationFrame(() => {
        positionImage();
        hideLoading();
        showCaption();
        setNavActive();
        preloadNext();
        // arrows visible
        if (arrowL) arrowL.style.display = 'block';
        if (arrowR) arrowR.style.display = 'block';
      });
    };
    loader.onerror = function () {
      hideLoading();
      // keep old image, or quit
      // Here: quit to avoid stuck state
      quit();
    };
    loader.src = href;
  }

  function openAt(i) {
    links = findLinks();
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

  function bindClicks() {
    // event delegation: clicking an eligible anchor should open
    document.addEventListener('click', function (e) {
      const a = e.target.closest('.post-body a[href]');
      if (!a) return;

      const href = a.getAttribute('href') || '';
      const hasImg = !!a.querySelector('img');
      if (!hasImg) return;
      if (!ALLOWED.test(href)) return;

      e.preventDefault();

      const currentLinks = findLinks();
      const idx = currentLinks.indexOf(a);
      openAt(idx >= 0 ? idx : 0);
    });
  }

   document.addEventListener('DOMContentLoaded', function () {
     console.log('[Lightbox] DOMContentLoaded');
     bindClicks();
   });
})();
