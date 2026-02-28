<script type="text/javascript">
(function () {
  'use strict';

  var SELECTOR = '.post-body a[href] img';
  var ALLOWED = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

  var opts = {
    animationSpeed: 250,
    preloadNext: true,
    enableKeyboard: true,
    quitOnEnd: false,
    quitOnImgClick: false,
    quitOnDocClick: true,
    swipeThresholdPx: 50,
    clickDeadzonePx: 8
  };

  var links = [];
  var index = -1;
  var isOpen = false;
  var isAnimating = false;

  var overlay = null, imgEl = null, closeBtn = null, captionEl = null, loadingEl = null, navEl = null, arrowL = null, arrowR = null;

  var pointerDown = false;
  var dragStartX = 0;
  var lastX = 0;
  var dragDx = 0;

  var hasPointer = !!window.PointerEvent;
  var supportTouch = ('ontouchstart' in window);

  function removeEl(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }

  function findLinks() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    var anchors = [];
    var seen = [];
    for (var i = 0; i < imgs.length; i++) {
      var a = imgs[i].closest ? imgs[i].closest('a') : null;
      if (!a) continue;
      var href = a.getAttribute('href') || '';
      if (!ALLOWED.test(href)) continue;
      if (seen.indexOf(a) === -1) {
        seen.push(a);
        anchors.push(a);
      }
    }
    return anchors;
  }

  function setTranslateX(el, px, seconds) {
    if (!el) return;
    el.style.transform = 'translateX(' + px + 'px)';
    el.style.transition = 'transform ' + seconds + 's linear';
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

    var a = links[index];
    var img = a ? a.querySelector('img') : null;
    var alt = (img && img.getAttribute && img.getAttribute('alt')) ? img.getAttribute('alt') : '';
    var text = (alt && alt.replace(/\s+/g, ' ').trim()) ? alt : 'No Caption';

    captionEl = document.createElement('div');
    captionEl.id = 'imagelightbox-caption';
    captionEl.appendChild(document.createTextNode(text));
    document.body.appendChild(captionEl);
  }

  function setNavActive() {
    if (!navEl) return;
    var buttons = navEl.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      if (i === index) buttons[i].classList.add('active');
      else buttons[i].classList.remove('active');
    }
  }

  function preloadNext() {
    if (!opts.preloadNext || links.length === 0) return;
    var nextIndex = (index + 1) % links.length;
    var href = links[nextIndex].getAttribute('href');
    if (!href) return;
    var pre = new Image();
    pre.src = href;
  }

  function onKeyUp(e) {
    if (!isOpen) return;
    if (e.keyCode === 27) quit();
    else if (e.keyCode === 37) step(-1);
    else if (e.keyCode === 39) step(1);
  }

  function buildUI() {
    overlay = document.createElement('div');
    overlay.id = 'imagelightbox-overlay';
    document.body.appendChild(overlay);

    imgEl = document.createElement('img');
    imgEl.id = 'imagelightbox';
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
    for (var i = 0; i < links.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      navEl.appendChild(b);
    }
    document.body.appendChild(navEl);

    closeBtn.onclick = function () { quit(); };

    arrowL.onclick = function () { step(-1); };
    arrowR.onclick = function () { step(1); };

    if (opts.quitOnDocClick) {
      overlay.onclick = function () { quit(); };
    }

    imgEl.onclick = function (e) {
      // suppress click if it was a drag
      if (Math.abs(lastX - dragStartX) > opts.clickDeadzonePx) return;
      if (opts.quitOnImgClick) return quit();

      var rect = imgEl.getBoundingClientRect();
      var x = (e.clientX || 0) - rect.left;
      step(x < rect.width / 2 ? -1 : 1);
    };

    bindDragEvents();

    navEl.onclick = function (e) {
      var target = e.target;
      if (!target || target.tagName !== 'BUTTON') return;
      var buttons = navEl.querySelectorAll('button');
      var idx = -1;
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i] === target) { idx = i; break; }
      }
      if (idx >= 0) switchTo(idx, idx < index ? 'left' : 'right');
    };

    if (opts.enableKeyboard) document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', positionImage);
  }

  function destroyUI() {
    window.removeEventListener('resize', positionImage);
    if (opts.enableKeyboard) document.removeEventListener('keyup', onKeyUp);
    unbindDragEvents();

    removeEl(overlay); removeEl(imgEl); removeEl(closeBtn);
    removeEl(arrowL); removeEl(arrowR); removeEl(navEl);
    removeEl(captionEl); removeEl(loadingEl);

    overlay = imgEl = closeBtn = captionEl = loadingEl = navEl = arrowL = arrowR = null;
  }

  function loadCurrent(direction) {
    var a = links[index];
    if (!a || !imgEl) return;

    var href = a.getAttribute('href');
    if (!href) return;

    isAnimating = true;
    showLoading();
    removeEl(captionEl);

    var dir = (direction === 'left') ? 1 : (direction === 'right') ? -1 : 0;
    setTranslateX(imgEl, -100 * dir, 0);

    var loader = new Image();
    loader.onload = function () {
      imgEl.src = href;

      setTimeout(function () {
        positionImage();
        imgEl.style.opacity = '1';
        setTranslateX(imgEl, 0, opts.animationSpeed / 1000);

        setTimeout(function () {
          hideLoading();
          showCaption();
          setNavActive();
          preloadNext();
          if (arrowL) arrowL.style.display = 'block';
          if (arrowR) arrowR.style.display = 'block';
          isAnimating = false;
        }, opts.animationSpeed);
      }, 0);
    };
    loader.onerror = function () { hideLoading(); quit(); };
    loader.src = href;
  }

  function animateOutThenLoad(nextIndex, direction) {
    var dir = (direction === 'left') ? 1 : -1;
    setTranslateX(imgEl, 100 * dir, opts.animationSpeed / 1000);
    imgEl.style.opacity = '0';
    setTimeout(function () { index = nextIndex; loadCurrent(direction); }, opts.animationSpeed);
  }

  function step(delta) {
    if (!isOpen || isAnimating) return;
    if (links.length < 2) return;

    var next = index + delta;

    if (opts.quitOnEnd && (next < 0 || next >= links.length)) return quit();

    var newIndex = next;
    if (newIndex < 0) newIndex = links.length - 1;
    if (newIndex >= links.length) newIndex = 0;

    animateOutThenLoad(newIndex, delta < 0 ? 'left' : 'right');
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

  function getPageXFromEvent(e) {
    if (e.touches && e.touches[0]) return e.touches[0].pageX;
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].pageX;
    return e.pageX;
  }

  function onDown(e) {
    if (!isOpen || !imgEl || isAnimating) return;
    if (hasPointer && e.pointerType === 'mouse' && e.button !== 0) return;

    pointerDown = true;
    dragStartX = getPageXFromEvent(e);
    lastX = dragStartX;
    dragDx = 0;
    setTranslateX(imgEl, 0, 0);
  }

  function onMove(e) {
    if (!pointerDown || !isOpen || !imgEl || isAnimating) return;

    if (supportTouch && e.preventDefault) e.preventDefault();

    lastX = getPageXFromEvent(e);
    dragDx = dragStartX - lastX;
    setTranslateX(imgEl, -dragDx, 0);
  }

  function onUp() {
    if (!pointerDown || !isOpen || !imgEl || isAnimating) return;
    pointerDown = false;

    var abs = Math.abs(dragDx);
    if (abs > opts.swipeThresholdPx) {
      step(dragDx > 0 ? 1 : -1);
      dragDx = 0;
      return;
    }

    setTranslateX(imgEl, 0, opts.animationSpeed / 1000);
    dragDx = 0;
  }

  var bound = false;

  function bindDragEvents() {
    if (!imgEl || bound) return;
    bound = true;

    if (hasPointer) {
      imgEl.addEventListener('pointerdown', onDown);
      imgEl.addEventListener('pointermove', onMove, { passive: false });
      imgEl.addEventListener('pointerup', onUp);
      imgEl.addEventListener('pointercancel', onUp);
    } else {
      imgEl.addEventListener('touchstart', onDown, { passive: true });
      imgEl.addEventListener('touchmove', onMove, { passive: false });
      imgEl.addEventListener('touchend', onUp);
      imgEl.addEventListener('touchcancel', onUp);

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

  function bindClicks() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.post-body a[href]') : null;
      if (!a) return;

      var href = a.getAttribute('href') || '';
      if (!a.querySelector('img')) return;
      if (!ALLOWED.test(href)) return;

      e.preventDefault();

      var current = findLinks();
      var idx = current.indexOf(a);
      openAt(idx >= 0 ? idx : 0);
    });
  }

  document.addEventListener('DOMContentLoaded', bindClicks);
})();
</script>
