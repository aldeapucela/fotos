(() => {
  const MIRADAS_AFTER_PHOTOS = 60;
  const POPULAR_AFTER_PHOTOS = 90;
  const UPLOAD_AFTER_PHOTOS = 150;
  const COLLECTIONS_URL = '/data/editorial-collections.json';
  const MIRADAS_SEEN_KEY = 'aldea-fotos:miradas-seen';
  const POPULAR_VISITED_KEY = 'aldea-fotos:populares-visited-session';
  const UPLOAD_OPENED_KEY = 'aldea-fotos:upload-opened-session';
  const SEEN_FOR_DAYS = 30;
  const PROMO_SELECTOR = '[data-gallery-journey-promo]';
  let collectionsPromise;
  let popularPhotosPromise;
  let refreshQueued = false;
  let renderVersion = 0;

  function isRecentGallery() {
    return window.location.pathname === '/' || window.location.pathname === '/index.html';
  }

  function hasActiveFilter(photos) {
    const params = new URLSearchParams(window.location.search);
    const hasQueryFilter = ['tag', 'element', 'search'].some(key => params.has(key));
    const hasHiddenPhotos = photos.some(photo => photo.hidden
      || photo.classList.contains('hidden')
      || photo.closest('[hidden], .hidden'));
    return hasQueryFilter || hasHiddenPhotos;
  }

  function readSessionFlag(key) {
    try {
      return window.sessionStorage.getItem(key) === '1';
    } catch (error) {
      return false;
    }
  }

  function setSessionFlag(key) {
    try {
      window.sessionStorage.setItem(key, '1');
    } catch (error) {
      // La interacción sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }

  function readRecentlySeen() {
    try {
      const cutoff = Date.now() - (SEEN_FOR_DAYS * 24 * 60 * 60 * 1000);
      const stored = JSON.parse(window.localStorage.getItem(MIRADAS_SEEN_KEY) || '[]');
      return Array.isArray(stored)
        ? stored.filter(item => item && item.slug && Number(item.seenAt) >= cutoff)
        : [];
    } catch (error) {
      return [];
    }
  }

  function rememberCollection(slug) {
    try {
      const seen = readRecentlySeen().filter(item => item.slug !== slug);
      seen.push({ slug, seenAt: Date.now() });
      window.localStorage.setItem(MIRADAS_SEEN_KEY, JSON.stringify(seen));
    } catch (error) {
      // El enlace sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
  }

  function track(action, type, position, destination = '') {
    window._paq = window._paq || [];
    const label = [type, `foto-${position}`, destination].filter(Boolean).join(':');
    window._paq.push(['trackEvent', 'Recorrido galería', action, label]);
  }

  function observeImpression(promo, type, position, destination) {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      track('Impresión', type, position, destination);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(promo);
  }

  function loadCollections() {
    if (!collectionsPromise) {
      collectionsPromise = fetch(COLLECTIONS_URL)
        .then(response => {
          if (!response.ok) throw new Error(`No se pudieron cargar las Miradas (${response.status})`);
          return response.json();
        })
        .then(collections => collections.filter(collection => collection.published));
    }
    return collectionsPromise;
  }

  function chooseCollection(collections) {
    if (!collections.length) return null;
    const seenSlugs = new Set(readRecentlySeen().map(item => item.slug));
    const ordered = [...collections].sort((first, second) => Number(second.featured) - Number(first.featured));
    const unseen = ordered.filter(collection => !seenSlugs.has(collection.slug));
    if (unseen.length) return unseen[0];
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    return ordered[week % ordered.length];
  }

  function loadPopularPhotos() {
    if (!popularPhotosPromise) {
      popularPhotosPromise = window.databaseManager.getDatabase().then(database => {
        const result = database.exec(`
          SELECT i.id, i.path, i.description, bic.like_count, bic.comment_count
          FROM imagenes i
          JOIN bluesky_interactions_cache bic ON i.id = bic.image_id
          LEFT JOIN image_analysis ia ON i.id = ia.image_id
          WHERE (ia.is_appropriate = 1 OR ia.is_appropriate IS NULL)
            AND (bic.like_count > 0 OR bic.comment_count > 0 OR bic.repost_count > 0)
          ORDER BY (bic.like_count + bic.comment_count * 2 + bic.repost_count) DESC,
                   bic.like_count DESC
          LIMIT 3
        `);
        if (!result.length) return [];
        const columns = result[0].columns;
        return result[0].values.map(row => Object.fromEntries(
          columns.map((column, index) => [column, row[index]])
        ));
      });
    }
    return popularPhotosPromise;
  }

  function createMiradasPromo(collection) {
    const promo = document.createElement('a');
    promo.className = 'editorial-stream-promo';
    promo.dataset.galleryJourneyPromo = 'miradas';
    promo.dataset.editorialPromo = collection.slug;
    promo.href = `/miradas/${encodeURIComponent(collection.slug)}/`;
    promo.setAttribute('aria-label', `Explorar la mirada ${collection.title}`);

    const media = document.createElement('span');
    media.className = 'editorial-stream-promo-media';
    const image = document.createElement('img');
    image.src = `/files/${encodeURIComponent(collection.coverPhotoId)}.jpg`;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    media.appendChild(image);

    const copy = document.createElement('span');
    copy.className = 'editorial-stream-promo-copy';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'editorial-stream-promo-eyebrow';
    eyebrow.innerHTML = '<i class="fa-regular fa-compass" aria-hidden="true"></i> Miradas';
    const title = document.createElement('strong');
    title.textContent = collection.title;
    const description = document.createElement('span');
    description.className = 'editorial-stream-promo-description';
    description.textContent = collection.description;
    const action = document.createElement('span');
    action.className = 'editorial-stream-promo-action';
    action.innerHTML = 'Explorar esta mirada <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';

    copy.append(eyebrow, title, description, action);
    promo.append(media, copy);
    promo.addEventListener('click', () => {
      rememberCollection(collection.slug);
      track('Clic', 'miradas', MIRADAS_AFTER_PHOTOS, collection.slug);
    });
    observeImpression(promo, 'miradas', MIRADAS_AFTER_PHOTOS, collection.slug);
    return promo;
  }

  function createPopularPromo(photos) {
    const promo = document.createElement('a');
    promo.className = 'popular-stream-promo';
    promo.dataset.galleryJourneyPromo = 'populares';
    promo.href = '/populares/';
    promo.setAttribute('aria-label', 'Ver las fotos populares');

    const copy = document.createElement('span');
    copy.className = 'popular-stream-promo-copy';
    copy.innerHTML = `
      <span class="popular-stream-promo-eyebrow"><i class="fa-solid fa-fire" aria-hidden="true"></i> Lo más visto</span>
      <strong>Las fotos que están llamando la atención</strong>
      <span class="popular-stream-promo-description">Descubre las favoritas de la comunidad.</span>
      <span class="popular-stream-promo-action">Ver todas las populares <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
    `;

    const mosaic = document.createElement('span');
    mosaic.className = 'popular-stream-promo-mosaic';
    photos.forEach(photo => {
      const image = document.createElement('img');
      image.src = `/files/${encodeURIComponent(photo.path)}`;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      mosaic.appendChild(image);
    });

    promo.append(copy, mosaic);
    promo.addEventListener('click', () => {
      setSessionFlag(POPULAR_VISITED_KEY);
      track('Clic', 'populares', POPULAR_AFTER_PHOTOS, 'listado');
    });
    observeImpression(promo, 'populares', POPULAR_AFTER_PHOTOS, 'listado');
    return promo;
  }

  function createUploadPromo() {
    const promo = document.createElement('section');
    promo.className = 'upload-stream-promo';
    promo.dataset.galleryJourneyPromo = 'subir-foto';
    promo.setAttribute('aria-labelledby', 'uploadStreamPromoTitle');
    promo.innerHTML = `
      <span class="upload-stream-promo-mark" aria-hidden="true"><i class="fa-solid fa-camera"></i></span>
      <span class="upload-stream-promo-copy">
        <strong id="uploadStreamPromoTitle">La ciudad también se ve a través de ti</strong>
        <span>Comparte una foto y suma tu mirada de Valladolid.</span>
      </span>
      <button class="upload-stream-promo-action" type="button">Compartir una foto <i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i></button>
    `;

    const button = promo.querySelector('button');
    button?.addEventListener('click', () => {
      setSessionFlag(UPLOAD_OPENED_KEY);
      track('Clic', 'subir-foto', UPLOAD_AFTER_PHOTOS, 'dialogo');
      document.querySelector('.bottom-navigation .uploadPhotoBtn')?.click();
      promo.remove();
    });
    observeImpression(promo, 'subir-foto', UPLOAD_AFTER_PHOTOS, 'dialogo');
    return promo;
  }

  function insertAfterPhoto(photos, position, promo) {
    if (photos.length < position || !promo) return;
    photos[position - 1].after(promo);
  }

  async function renderPromos() {
    const version = ++renderVersion;
    document.querySelectorAll(PROMO_SELECTOR).forEach(promo => promo.remove());
    if (!isRecentGallery()) return;

    const content = document.getElementById('contenido');
    if (!content || content.classList.contains('list-view')) return;
    const photos = [...content.querySelectorAll('.photo-card')];
    if (hasActiveFilter(photos)) return;

    try {
      const [collections, popularPhotos] = await Promise.all([
        photos.length >= MIRADAS_AFTER_PHOTOS ? loadCollections() : Promise.resolve([]),
        photos.length >= POPULAR_AFTER_PHOTOS && !readSessionFlag(POPULAR_VISITED_KEY)
          ? loadPopularPhotos()
          : Promise.resolve([])
      ]);
      if (version !== renderVersion) return;

      const currentPhotos = [...content.querySelectorAll('.photo-card')];
      if (hasActiveFilter(currentPhotos) || content.classList.contains('list-view')) return;

      const collection = chooseCollection(collections);
      if (collection) insertAfterPhoto(currentPhotos, MIRADAS_AFTER_PHOTOS, createMiradasPromo(collection));
      if (popularPhotos.length) insertAfterPhoto(currentPhotos, POPULAR_AFTER_PHOTOS, createPopularPromo(popularPhotos));
      if (!readSessionFlag(UPLOAD_OPENED_KEY)) {
        insertAfterPhoto(currentPhotos, UPLOAD_AFTER_PHOTOS, createUploadPromo());
      }
    } catch (error) {
      console.warn('No se pudo completar el recorrido de la galería.', error);
    }
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      renderPromos();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const content = document.getElementById('contenido');
    if (!content || !isRecentGallery()) return;
    const observer = new MutationObserver(mutations => {
      const needsRefresh = mutations.some(mutation => {
        if (mutation.type === 'attributes') return mutation.target.matches('.photo-card, #contenido');
        return [...mutation.addedNodes, ...mutation.removedNodes].some(node =>
          node.nodeType === Node.ELEMENT_NODE
          && !node.matches?.(PROMO_SELECTOR)
          && (node.matches?.('.photo-card') || node.querySelector?.('.photo-card'))
        );
      });
      if (needsRefresh) scheduleRefresh();
    });
    observer.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
    scheduleRefresh();
  });
})();
