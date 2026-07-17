(() => {
  const CONFIG_URL = '/data/editorial-collections.json';
  const TELEGRAM_TOPIC = 'https://t.me/AldeaPucela/27202/27203';
  const state = {
    collections: [],
    photos: [],
    activeCollection: null,
    activePhotos: [],
    currentPhotoIndex: -1,
    returnUrl: null,
    returnScrollY: 0,
    socialRequestId: 0,
    isTransitioning: false,
    transitionToken: 0
  };

  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const photoId = photo => String(photo.path || '').replace(/\.(?:jpe?g|png|webp)$/i, '');
  const photoPath = photo => `/files/${encodeURIComponent(photo.path)}`;

  function track(action, name = '', value) {
    window._paq = window._paq || [];
    const event = ['trackEvent', 'Miradas', action, name];
    if (Number.isFinite(value)) event.push(value);
    window._paq.push(event);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        // Firefox puede bloquear la Clipboard API aunque el navegador la exponga.
      }
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('No se pudo copiar al portapapeles');
  }

  async function shareOrCopy(payload) {
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return false;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return false;
    }

    await copyToClipboard(payload.url);
    alert('URL copiada al portapapeles');
    return true;
  }

  function parseTags(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.map(normalize) : [];
    } catch (error) {
      return [];
    }
  }

  function loadPhotos(db) {
    const result = db.exec(`
      SELECT i.id, i.path, i.author, i.description, i.date,
             ia.description AS ai_description, ia.tags AS ai_tags,
             ia.is_appropriate
      FROM imagenes i
      LEFT JOIN image_analysis ia ON ia.image_id = i.id
      WHERE ia.is_appropriate = 1 OR ia.is_appropriate IS NULL
      ORDER BY i.date DESC
    `);
    if (!result.length) return [];
    const columns = result[0].columns;
    return result[0].values.map(row => {
      const photo = Object.fromEntries(columns.map((column, index) => [column, row[index]]));
      photo.tags = parseTags(photo.ai_tags);
      return photo;
    });
  }

  function photosForCollection(collection) {
    const rules = new Set((collection.matchTags || []).map(normalize));
    const included = new Set((collection.manualInclude || []).map(String));
    const excluded = new Set((collection.manualExclude || []).map(String));
    return state.photos.filter(photo => {
      const id = photoId(photo);
      if (excluded.has(id)) return false;
      if (included.has(id)) return true;
      return photo.tags.some(tag => rules.has(tag));
    });
  }

  function coverFor(collection, photos) {
    return state.photos.find(photo => photoId(photo) === String(collection.coverPhotoId)) || photos[0];
  }

  function collectionHref(collection) {
    return `/miradas/${encodeURIComponent(collection.slug)}/`;
  }

  function renderOverview() {
    const overview = document.getElementById('editorialOverview');
    const grid = document.getElementById('editorialCollectionGrid');
    if (!overview || !grid) return;
    const published = state.collections.filter(collection => collection.published);
    grid.innerHTML = '';

    published.forEach((collection, index) => {
      const photos = photosForCollection(collection);
      const cover = coverFor(collection, photos);
      if (!cover) return;
      const link = document.createElement('a');
      link.href = collectionHref(collection);
      link.className = `editorial-collection-link ${collection.featured ? 'is-featured' : ''}`;
      link.setAttribute('aria-label', `${collection.title}, ${photos.length.toLocaleString('es-ES')} fotos`);
      link.style.setProperty('--editorial-order', index);
      link.innerHTML = DOMPurify.sanitize(`
        <img src="${photoPath(cover)}" alt="${cover.ai_description || collection.title}" loading="${collection.featured ? 'eager' : 'lazy'}">
        <span class="editorial-collection-shade"></span>
        <span class="editorial-collection-copy">
          <span class="editorial-collection-kicker">${photos.length.toLocaleString('es-ES')} fotos</span>
          <strong>${collection.title}</strong>
          <span>${collection.description}</span>
          <span class="editorial-open-label">Explorar <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        </span>
      `);
      link.addEventListener('click', () => track('Abrir colección', collection.slug, photos.length));
      grid.appendChild(link);
    });

    overview.hidden = false;
    document.title = 'Miradas de Valladolid - Fotos de Valladolid - Aldea Pucela';
    track('Ver índice', 'miradas');
  }

  function setUploadContext(collection) {
    const buttons = [
      document.getElementById('editorialUploadButton'),
      document.getElementById('editorialInvitationButton')
    ].filter(Boolean);
    buttons.forEach(button => {
      button.dataset.uploadTitle = 'Añade tu foto a esta colección';
      button.dataset.uploadPrompt = collection.prompt;
      button.dataset.uploadTag = collection.contributionTag;
      button.dataset.uploadCollection = collection.slug;
    });
  }

  function renderDetail(collection) {
    const detail = document.getElementById('editorialDetail');
    const grid = document.getElementById('editorialPhotoGrid');
    if (!detail || !grid) return;
    const photos = photosForCollection(collection);
    const cover = coverFor(collection, photos);
    if (!cover || !photos.length) throw new Error('La colección no tiene fotografías');

    state.activeCollection = collection;
    state.activePhotos = photos;
    document.getElementById('editorialHeroImage').src = photoPath(cover);
    document.getElementById('editorialHeroImage').alt = cover.ai_description || collection.title;
    document.getElementById('editorialTitle').textContent = collection.title;
    document.getElementById('editorialDescription').textContent = collection.description;
    document.getElementById('editorialCount').textContent = `${photos.length.toLocaleString('es-ES')} fotos`;
    document.getElementById('editorialPrompt').textContent = collection.prompt;
    document.getElementById('editorialTag').textContent = collection.contributionTag;
    setUploadContext(collection);

    grid.innerHTML = '';
    photos.forEach((photo, index) => {
      const link = document.createElement('a');
      link.href = `/f/${encodeURIComponent(photoId(photo))}/`;
      link.className = 'editorial-photo-link';
      link.dataset.photoIndex = String(index);
      link.setAttribute('aria-label', photo.description ? `Abrir foto: ${photo.description}` : 'Abrir foto');
      const image = document.createElement('img');
      image.src = photoPath(photo);
      image.alt = photo.ai_description || photo.description || '';
      image.loading = 'lazy';
      link.appendChild(image);
      grid.appendChild(link);
    });

    detail.hidden = false;
    document.title = `${collection.title} - Miradas de Valladolid`;
    track('Ver colección', collection.slug, photos.length);
  }

  function formatDate(value) {
    return window.galleryLightboxMotion?.formatDate(value) || '';
  }

  function setLightboxNavigation(index, locked = false) {
    const previous = document.getElementById('editorialPreviousPhoto');
    const next = document.getElementById('editorialNextPhoto');
    if (previous) previous.disabled = locked || index <= 0;
    if (next) next.disabled = locked || index >= state.activePhotos.length - 1;
  }

  function closeCommentsPanel() {
    const panel = document.getElementById('bluesky-comments-panel');
    const panelInner = document.getElementById('bluesky-comments-panel-inner');
    if (!panel || !panelInner) return;
    panel.classList.remove('pointer-events-auto');
    panelInner.classList.remove('translate-y-0', 'opacity-100');
    panelInner.classList.add('translate-y-full', 'opacity-0');
  }

  async function openCommentsPanel() {
    const photo = state.activePhotos[state.currentPhotoIndex];
    const panel = document.getElementById('bluesky-comments-panel');
    const panelInner = document.getElementById('bluesky-comments-panel-inner');
    const comments = document.getElementById('bluesky-comments');
    if (!photo || !panel || !panelInner || !comments) return;

    comments.innerHTML = '<div class="text-center text-instagram-500 py-4">Cargando comentarios...</div>';
    panel.classList.add('pointer-events-auto');
    panelInner.classList.remove('translate-y-full', 'opacity-0');
    panelInner.classList.add('translate-y-0', 'opacity-100');
    if (typeof window.loadBlueskyComments === 'function') {
      const canonicalUrl = `${window.location.origin}/f/${encodeURIComponent(photoId(photo))}/`;
      await window.loadBlueskyComments(canonicalUrl);
    }
  }

  async function updateSocialActions(photo) {
    const requestId = ++state.socialRequestId;
    const likesLink = document.getElementById('editorialLightboxLikes');
    const likesCount = likesLink?.querySelector('span');
    const commentsButton = document.getElementById('editorialLightboxComments');
    const commentsCount = document.getElementById('editorialLightboxCommentsCount');
    if (!likesLink || !commentsButton || !commentsCount) return;

    likesLink.hidden = true;
    commentsButton.hidden = true;
    commentsCount.hidden = true;
    likesLink.removeAttribute('href');
    if (typeof window.getBlueskyThreadStats !== 'function') return;

    const canonicalUrl = `${window.location.origin}/f/${encodeURIComponent(photoId(photo))}/`;
    const stats = await window.getBlueskyThreadStats(canonicalUrl);
    if (requestId !== state.socialRequestId || state.activePhotos[state.currentPhotoIndex] !== photo || !stats?.threadUrl) return;

    const likeCount = Number(stats.likeCount) || 0;
    const commentCount = Number(stats.commentCount) || 0;
    likesLink.href = stats.threadUrl;
    likesLink.hidden = false;
    likesLink.setAttribute('aria-label', `Ver y dar me gusta en Bluesky (${likeCount})`);
    if (likesCount) likesCount.textContent = String(likeCount);
    commentsButton.hidden = false;
    commentsButton.setAttribute('aria-label', `Ver o añadir comentarios (${commentCount})`);
    commentsCount.textContent = String(commentCount);
    commentsCount.hidden = commentCount <= 0;
  }

  async function renderLightboxPhoto(index, direction = 0) {
    const photo = state.activePhotos[index];
    if (!photo || state.isTransitioning) return;
    const lightbox = document.getElementById('editorialLightbox');
    const media = document.getElementById('editorialLightboxMedia');
    const currentImage = document.getElementById('editorialLightboxImage');
    if (!lightbox || !media || !currentImage) return;

    const token = ++state.transitionToken;
    state.isTransitioning = true;
    setLightboxNavigation(state.currentPhotoIndex, true);

    closeCommentsPanel();
    state.currentPhotoIndex = index;
    window.galleryLightboxMotion?.preloadAdjacent(state.activePhotos, index, photoPath);
    const id = photoId(photo);
    const src = photoPath(photo);
    const alt = photo.ai_description || photo.description || '';
    const description = document.getElementById('editorialLightboxDescription');
    description.textContent = photo.description || '';
    description.closest('.editorial-lightbox-info')?.classList.toggle(
      'is-description-empty',
      !String(photo.description || '').trim()
    );
    document.getElementById('editorialLightboxDate').textContent = formatDate(photo.date);
    const author = document.getElementById('editorialLightboxAuthor');
    author.href = `https://t.me/AldeaPucela/27202/${encodeURIComponent(id)}`;
    author.querySelector('span').textContent = `Compartida por ${photo.author || 'Anónimo'}`;
    document.getElementById('editorialLightboxDownload').href = photoPath(photo);
    window.history.replaceState({ editorialLightbox: true, photoId: id }, '', `/f/${encodeURIComponent(id)}/`);
    updateSocialActions(photo);

    const motion = window.galleryLightboxMotion;
    if (!motion) {
      currentImage.src = src;
      currentImage.alt = alt;
    } else {
      await motion.transition({
        stage: media,
        image: currentImage,
        src,
        alt,
        direction,
        isActive: () => token === state.transitionToken && !lightbox.hidden
      });
    }

    if (token !== state.transitionToken) return;
    state.isTransitioning = false;
    setLightboxNavigation(index);
  }

  function openLightbox(index) {
    if (!state.activePhotos[index] || !window.openEditorialGalleryLightbox) return;
    window.openEditorialGalleryLightbox(state.activePhotos, index);
    track('Abrir foto', state.activeCollection?.slug || '', index + 1);
  }

  function closeLightbox({ updateHistory = true } = {}) {
    const lightbox = document.getElementById('editorialLightbox');
    if (!lightbox || lightbox.hidden) return;
    const returnUrl = state.returnUrl || collectionHref(state.activeCollection);
    const returnScrollY = state.returnScrollY;
    state.transitionToken += 1;
    state.isTransitioning = false;
    state.socialRequestId += 1;
    closeCommentsPanel();
    lightbox.classList.remove('is-open');
    document.body.classList.remove('dialog-open');
    if (updateHistory) window.history.replaceState({}, '', returnUrl);
    window.setTimeout(() => {
      lightbox.hidden = true;
      const currentImage = document.getElementById('editorialLightboxImage');
      document.querySelectorAll('.editorial-lightbox-image').forEach(image => {
        if (image !== currentImage) image.remove();
      });
      if (currentImage) {
        currentImage.className = 'editorial-lightbox-image';
        currentImage.src = '';
      }
      window.requestAnimationFrame(() => window.scrollTo({ top: returnScrollY, behavior: 'auto' }));
    }, 180);
  }

  async function shareCurrentPhoto() {
    const photo = state.activePhotos[state.currentPhotoIndex];
    if (!photo) return;
    const url = `${window.location.origin}/f/${encodeURIComponent(photoId(photo))}/`;
    const payload = { title: 'Foto de Valladolid', text: photo.description || '', url };
    try {
      await shareOrCopy(payload);
      track('Compartir foto', state.activeCollection?.slug || '');
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la foto', error);
    }
  }

  async function shareCollection() {
    if (!state.activeCollection) return;
    const url = `${window.location.origin}${collectionHref(state.activeCollection)}`;
    const payload = { title: state.activeCollection.title, text: state.activeCollection.description, url };
    try {
      await shareOrCopy(payload);
      track('Compartir colección', state.activeCollection.slug);
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la colección', error);
    }
  }

  function setupInteractions() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleSidebar = () => {
      const opens = sidebar?.classList.contains('translate-x-full');
      sidebar?.classList.toggle('translate-x-full', !opens);
      overlay?.classList.toggle('opacity-0', !opens);
      overlay?.classList.toggle('pointer-events-none', !opens);
      document.getElementById('menuToggle')?.setAttribute('aria-expanded', String(opens));
    };
    document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('closeSidebar')?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    document.getElementById('editorialPhotoGrid')?.addEventListener('click', event => {
      const link = event.target.closest('.editorial-photo-link');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openLightbox(Number(link.dataset.photoIndex));
    });
    document.querySelectorAll('[data-editorial-close]').forEach(control => control.addEventListener('click', () => closeLightbox()));
    document.getElementById('editorialPreviousPhoto')?.addEventListener('click', () => renderLightboxPhoto(state.currentPhotoIndex - 1, -1));
    document.getElementById('editorialNextPhoto')?.addEventListener('click', () => renderLightboxPhoto(state.currentPhotoIndex + 1, 1));
    window.galleryLightboxMotion?.addSwipe(document.getElementById('editorialLightboxMedia'), {
      onPrevious: () => renderLightboxPhoto(state.currentPhotoIndex - 1, -1),
      onNext: () => renderLightboxPhoto(state.currentPhotoIndex + 1, 1),
      onDismiss: closeLightbox,
      canNavigate: () => !state.isTransitioning && !document.getElementById('editorialLightbox')?.hidden
    });
    document.getElementById('editorialLightboxShare')?.addEventListener('click', shareCurrentPhoto);
    document.getElementById('editorialLightboxComments')?.addEventListener('click', openCommentsPanel);
    document.getElementById('close-bluesky-comments')?.addEventListener('click', closeCommentsPanel);
    document.getElementById('bluesky-comments-panel')?.addEventListener('click', event => {
      if (event.target.id === 'bluesky-comments-panel') closeCommentsPanel();
    });
    document.getElementById('shareEditorialCollection')?.addEventListener('click', shareCollection);
    document.addEventListener('keydown', event => {
      const lightbox = document.getElementById('editorialLightbox');
      if (lightbox?.hidden) return;
      const commentsPanel = document.getElementById('bluesky-comments-panel-inner');
      const commentsOpen = commentsPanel?.classList.contains('translate-y-0');
      if (event.key === 'Escape') {
        if (commentsOpen) {
          closeCommentsPanel();
          return;
        }
        closeLightbox();
      }
      if (commentsOpen) return;
      if (event.key === 'ArrowLeft') renderLightboxPhoto(state.currentPhotoIndex - 1, -1);
      if (event.key === 'ArrowRight') renderLightboxPhoto(state.currentPhotoIndex + 1, 1);
    });
    window.addEventListener('popstate', () => {
      const lightbox = document.getElementById('editorialLightbox');
      if (lightbox && !lightbox.hidden) closeLightbox({ updateHistory: false });
    });
  }

  async function init() {
    try {
      setupInteractions();
      const [configResponse, db] = await Promise.all([
        fetch(CONFIG_URL),
        window.databaseManager.getDatabase()
      ]);
      if (!configResponse.ok) throw new Error('No se pudo cargar la configuración editorial');
      state.collections = await configResponse.json();
      state.photos = loadPhotos(db);
      window.updateTotalPhotosCount?.(state.photos.length);
      document.getElementById('editorialLoading').hidden = true;

      const slug = document.body.dataset.collectionSlug;
      if (slug) {
        const collection = state.collections.find(item => item.slug === slug && item.published);
        if (!collection) throw new Error('Colección no encontrada');
        renderDetail(collection);
      } else {
        renderOverview();
      }
    } catch (error) {
      console.error('Error cargando Miradas:', error);
      document.getElementById('editorialLoading').hidden = true;
      document.getElementById('editorialError').hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
