```javascript
/* Vanilla ImageLightbox for Blogger (no jQuery) + swipe + slide animation
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

  const SELECTOR = '.post-body a[href] img';

  // If your image URLs sometimes include querystrings, consider:
  // const ALLOWED = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
  const ALLOWED = /\.(png|jpe?g|gif|webp)$/i;

  const opts = {
    animationSpeed: 250,   // ms
    preloadNext: true,
    enableKeyboard: true,
    quitOnEnd: false,
    quitOnImgClick: false,
    quitOnDocClick: true,

    // swipe/drag tuning
    swipeThresholdPx: 50,  // minimum drag distance to trigger navigation
    clickDeadzonePx: 8,    // treat tiny drags as taps
  };

  /** @type {HTMLAnchorElement[]} */
  let links = [];
  let index = -1;
  let isOpen = false;
  let isAnimating = false;

  // UI
  let overlay, imgEl, closeBtn, captionEl, loadingEl, navEl, arrowL, arrowR;

  // Drag/swipe state
  let pointerDown = false;
  let dragStartX = 0;
  let lastX = 0;
  let baseLeftPx = 0;   // left position at drag start (in px)
  let dragDx = 0;       // startX - currentX

  // Feature detection
  const hasPointer = 'PointerEvent' in window;
  const supportTouch = 'ontouchstart' in window;

  function removeEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function findLinks() {
    const imgs = Array.from(document.querySelectorAll(SELECTOR));
    const anchors = imgs
      .map(img => img.closest('a'))
      .filter(Boolean)
      .filter(a => ALLOWED.test(a.getAttribute('href') || ''));
    return Array.from(new Set(anchors));
  }

  function getVendorProp(prop) {
  // returns the correct style property name supported by this browser
  var style = (document.body || document.documentElement).style;
  if (('Webkit' + prop) in style) return 'Webkit' + prop;
  if (('Moz' + prop) in style) return 'Moz' + prop;
  if (('O' + prop) in style) return 'O' + prop;
  if (prop.toLowerCase() in style) return prop.toLowerCase();
  return prop.toLowerCase();
}

var transformProp = getVendorProp('Transform');
var transitionProp = getVendorProp('Transition');

function setTranslateX(el, px, seconds) {
  if (!el) return;
  el.style.transform = 'translateX(' + px + 'px)';
  el.style.transition = 'transform ' + seconds + 's linear';
}

  function viewportBox() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

function positionImage() {
  if (!imgEl || !imgEl.naturalWidth) return;

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var maxW = vw * 0.8;
  var maxH = vh * 0.9;

  var w = imgEl.naturalWidth;
  var h = imgEl.naturalHeight;

  if (w > maxW || h > maxH) {
    var scale = (w / h > maxW / maxH) ? (w / maxW) : (h / maxH);
    w = w / scale;
    h = h / scale;
  }

  imgEl.style.width = w + 'px';
  imgEl.style.height = h + 'px';
  imgEl.style.position = 'fixed';
  imgEl.style.left = ((vw - w) / 2) + 'px';
  imgEl.style.top = ((vh - h) / 2) + 'px';
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

  function buildUI() {
    overlay = document.createElement('div');
    overlay.id = 'imagelightbox-overlay';
    document.body.appendChild(overlay);

    imgEl = document.createElement('img');
    imgEl.id = 'imagelightbox';
    // start invisible; we'll animate in on load
    imgEl.style.opacity = '0';
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
    closeBtn.addEventListener('touchend', (e) => { e.preventDefault(); quit(); }, { passive: false });

    arrowL.addEventListener('click', () => step(-1));
    arrowR.addEventListener('click', () => step(1));

    if (opts.quitOnDocClick) {
      overlay.addEventListener('click', quit);
    }

    // Tap image: previous/next by half, unless quitOnImgClick
    imgEl.addEventListener('click', (e) => {
      // If the user dragged, we suppress click (handled in pointerup)
      if (Math.abs(lastX - dragStartX) > opts.clickDeadzonePx) return;

      e.preventDefault();
      if (opts.quitOnImgClick) return quit();

      const rect = imgEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      step(x < rect.width / 2 ? -1 : 1);
    });

    // swipe/drag events
    bindDragEvents();

    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const buttons = Array.from(navEl.querySelectorAll('button'));
      const idx = buttons.indexOf(btn);
      if (idx >= 0) switchTo(idx, idx < index ? 'left' : 'right');
    });

    if (opts.enableKeyboard) {
      document.addEventListener('keyup', onKeyUp);
    }

    window.addEventListener('resize', positionImage);
  }

  function destroyUI() {
    window.removeEventListener('resize', positionImage);
    if (opts.enableKeyboard) document.removeEventListener('keyup', onKeyUp);

    unbindDragEvents();

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

  function loadCurrent(direction /* 'left' | 'right' | null */) {
    const a = links[index];
    if (!a || !imgEl) return;

    const href = a.getAttribute('href');
    if (!href) return;

    isAnimating = true;
    showLoading();
    removeEl(captionEl);

    // prepare for slide-in
    const dir = direction === 'left' ? 1 : direction === 'right' ? -1 : 0;
    if (canTransform) {
      setTranslateX(imgEl, -100 * dir, 0); // start slightly offset
    }

    const loader = new Image();
    loader.onload = function () {
      imgEl.src = href;

      requestAnimationFrame(() => {
        positionImage();

        // fade + slide to center
        imgEl.style.opacity = '1';
        if (canTransform) {
          // animate from offset to 0
          setTranslateX(imgEl, 0, opts.animationSpeed / 1000);
        }

        // finish
        setTimeout(() => {
          hideLoading();
          showCaption();
          setNavActive();
          preloadNext();
          if (arrowL) arrowL.style.display = 'block';
          if (arrowR) arrowR.style.display = 'block';
          isAnimating = false;
        }, opts.animationSpeed);
      });
    };
    loader.onerror = function () {
      hideLoading();
      quit();
    };
    loader.src = href;
  }

  function animateOutThenLoad(nextIndex, direction /* 'left' | 'right' */) {
    if (!imgEl) return;

    const dir = direction === 'left' ? 1 : -1;

    // animate out
    if (canTransform) {
      setTranslateX(imgEl, 100 * dir, opts.animationSpeed / 1000);
    }
    imgEl.style.opacity = '0';

    setTimeout(() => {
      index = nextIndex;
      loadCurrent(direction);
    }, opts.animationSpeed);
  }

  function step(delta) {
    if (!isOpen || isAnimating) return;
    if (links.length < 2) return;

    const next = index + delta;

    if (opts.quitOnEnd && (next < 0 || next >= links.length)) {
      return quit();
    }

    let newIndex = next;
    if (newIndex < 0) newIndex = links.length - 1;
    if (newIndex >= links.length) newIndex = 0;

    const direction = delta < 0 ? 'left' : 'right';
    animateOutThenLoad(newIndex, direction);
  }

  function switchTo(newIndex, direction) {
    if (!isOpen || isAnimating) return;
    if (newIndex === index) return;

    animateOutThenLoad(newIndex, direction || (newIndex < index ? 'left' : 'right'));
  }

  function openAt(i) {
    links = findLinks();
    if (!links.length) return;

    index = Math.max(0, Math.min(i, links.length - 1));
    isOpen = true;

    buildUI();
    loadCurrent(null);
  }

  function quit() {
    if (!isOpen) return;
    isOpen = false;
    destroyUI();
    index = -1;
    isAnimating = false;
  }

  // ---------- Swipe / Drag ----------
  function isPrimaryPointer(e) {
    // mouse (button 0) or touch/pen primary
    if (e.pointerType) return e.isPrimary !== false;
    return true;
  }

  function getPageXFromEvent(e) {
    if (e.touches && e.touches[0]) return e.touches[0].pageX;
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].pageX;
    return e.pageX;
  }

  function onDown(e) {
    if (!isOpen || !imgEl || isAnimating) return;
    if (hasPointer && e.pointerType === 'mouse' && e.button !== 0) return;
    if (hasPointer && !isPrimaryPointer(e)) return;

    pointerDown = true;
    dragStartX = getPageXFromEvent(e);
    lastX = dragStartX;
    dragDx = 0;

    // base left for non-transform fallback; here we use transform, but keep state anyway
    const left = parseFloat(imgEl.style.left || '0');
    baseLeftPx = isFinite(left) ? left : 0;

    // cancel transitions while dragging
    if (canTransform) setTranslateX(imgEl, 0, 0);
  }

  function onMove(e) {
    if (!pointerDown || !isOpen || !imgEl || isAnimating) return;

    // prevent page scroll while swiping on image
    if (supportTouch) e.preventDefault();

    lastX = getPageXFromEvent(e);
    dragDx = dragStartX - lastX; // same sign as old plugin: start - current

    // follow finger: move image opposite direction so it "drags"
    if (canTransform) {
      setTranslateX(imgEl, -dragDx, 0);
    }
  }

  function onUp(e) {
    if (!pointerDown || !isOpen || !imgEl || isAnimating) return;
    pointerDown = false;

    const abs = Math.abs(dragDx);

    if (abs > opts.swipeThresholdPx) {
      // old logic: dragDx > 0 => moved finger left => go RIGHT (next)
      step(dragDx > 0 ? 1 : -1);
      dragDx = 0;
      return;
    }

    // snap back
    if (canTransform) {
      setTranslateX(imgEl, 0, opts.animationSpeed / 1000);
    }
    dragDx = 0;
  }

  let bound = false;
  function bindDragEvents() {
    if (!imgEl || bound) return;
    bound = true;

    if (hasPointer) {
      imgEl.addEventListener('pointerdown', onDown);
      imgEl.addEventListener('pointermove', onMove, { passive: false });
      imgEl.addEventListener('pointerup', onUp);
      imgEl.addEventListener('pointercancel', onUp);
    } else {
      // Touch fallback
      imgEl.addEventListener('touchstart', onDown, { passive: true });
      imgEl.addEventListener('touchmove', onMove, { passive: false });
      imgEl.addEventListener('touchend', onUp);
      imgEl.addEventListener('touchcancel', onUp);

      // Mouse fallback
      imgEl.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  }

  function unbindDragEvents() {
    if (!imgEl || !bound) return;
    bound = false;

    if (hasPointer) {
      imgEl.removeEventListener('pointerdown', onDown);
      imgEl.removeEventListener('pointermove', onMove);
      imgEl.removeEventListener('pointerup', onUp);
      imgEl.removeEventListener('pointercancel', onUp);
    } else {
      imgEl.removeEventListener('touchstart', onDown);
      imgEl.removeEventListener('touchmove', onMove);
      imgEl.removeEventListener('touchend', onUp);
      imgEl.removeEventListener('touchcancel', onUp);

      imgEl.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
  }
  // ---------------------------------

  function bindClicks() {
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
    bindClicks();
  });
})();
```
