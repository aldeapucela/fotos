(() => {
  const imageCache = new Map();
  const MOTION_CLASSES = [
    'is-outgoing-next',
    'is-incoming-next',
    'is-outgoing-previous',
    'is-incoming-previous'
  ];

  function preload(src) {
    if (!src) return Promise.resolve(false);
    if (imageCache.has(src)) return imageCache.get(src);

    const promise = new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = success => {
        if (settled) return;
        settled = true;
        resolve(success);
      };
      const finishLoadedImage = () => {
        if (typeof image.decode === 'function') {
          image.decode().catch(() => {}).finally(() => finish(true));
        } else {
          finish(true);
        }
      };
      image.onload = finishLoadedImage;
      image.onerror = () => finish(false);
      image.src = src;
      if (image.complete) {
        if (image.naturalWidth > 0) finishLoadedImage();
        else finish(false);
      }
    });

    imageCache.set(src, promise);
    return promise;
  }

  function preloadAdjacent(items, index, getSource = item => item?.path) {
    [index - 1, index + 1].forEach(adjacentIndex => {
      const item = items[adjacentIndex];
      if (item) void preload(getSource(item));
    });
  }

  function formatDate(value) {
    if (!value) return '';
    const normalized = typeof value === 'string' ? value.trim().replace(' ', 'T') : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || '';
    const month = part('month').replace('.', '').toLocaleLowerCase('es-ES');
    return `${part('day')} ${month} ${part('year')}`.trim();
  }

  function waitForAnimation(image) {
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        image.removeEventListener('animationend', finish);
        resolve();
      };
      image.addEventListener('animationend', finish, { once: true });
      window.setTimeout(finish, 240);
    });
  }

  async function transition({ stage, image, src, alt = '', direction = 0, onCommit, isActive }) {
    if (!stage || !image || !src) return false;
    const ready = await preload(src);
    if (isActive && !isActive()) return false;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!direction || reduceMotion || !ready || !image.getAttribute('src')) {
      image.src = src;
      image.alt = alt;
      onCommit?.();
      return true;
    }

    const movement = direction > 0 ? 'next' : 'previous';
    const incoming = image.cloneNode(false);
    incoming.removeAttribute('id');
    incoming.classList.remove(...MOTION_CLASSES);
    incoming.classList.add('lightbox-motion-image', `is-incoming-${movement}`);
    incoming.src = src;
    incoming.alt = alt;

    image.classList.add('lightbox-motion-image', `is-outgoing-${movement}`);
    stage.appendChild(incoming);
    onCommit?.();
    await waitForAnimation(incoming);

    if (isActive && !isActive()) {
      image.classList.remove(...MOTION_CLASSES);
      incoming.remove();
      return false;
    }
    image.src = src;
    image.alt = alt;
    image.classList.remove(...MOTION_CLASSES);
    incoming.remove();
    return !isActive || isActive();
  }

  function addSwipe(stage, { onPrevious, onNext, onDismiss, canNavigate = () => true, threshold = 52 } = {}) {
    if (!stage) return () => {};
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pointerId = null;

    const onPointerDown = event => {
      if (!event.isPrimary || !canNavigate()) return;
      startX = event.clientX;
      startY = event.clientY;
      pointerId = event.pointerId;
      tracking = true;
      stage.setPointerCapture?.(pointerId);
    };
    const onPointerUp = event => {
      if (!tracking || event.pointerId !== pointerId) return;
      tracking = false;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (deltaY >= threshold && Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
        onDismiss?.();
        return;
      }
      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return;
      if (deltaX > 0) onPrevious?.();
      else onNext?.();
    };
    const cancel = event => {
      if (event.pointerId === pointerId) tracking = false;
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', cancel);
    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', cancel);
    };
  }

  window.galleryLightboxMotion = { addSwipe, formatDate, preload, preloadAdjacent, transition };
})();
