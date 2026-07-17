(() => {
  let root;
  let state = { items: [], index: -1, returnUrl: '', returnScrollY: 0, transitioning: false };
  let editorialCollectionsPromise;

  const normalizeEditorialValue = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  function findEditorialCollection(photo) {
    if (!editorialCollectionsPromise) {
      editorialCollectionsPromise = fetch('/data/editorial-collections.json')
        .then(response => response.ok ? response.json() : [])
        .catch(() => []);
    }
    return editorialCollectionsPromise.then(collections => {
      let tags = [];
      try { tags = Array.isArray(photo.tags) ? photo.tags : JSON.parse(photo.tags || '[]'); } catch (_) { tags = []; }
      const normalizedTags = new Set(tags.map(normalizeEditorialValue));
      return collections
        .filter(collection => collection.published)
        .sort((first, second) => Number(second.featured) - Number(first.featured))
        .find(collection => {
          if ((collection.manualExclude || []).map(String).includes(String(photo.id))) return false;
          if ((collection.manualInclude || []).map(String).includes(String(photo.id))) return true;
          return (collection.matchTags || []).some(tag => normalizedTags.has(normalizeEditorialValue(tag)));
        });
    });
  }

  function mount() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'lightbox';
    root.className = 'lightbox fixed inset-0 z-50 bg-black/90 flex items-center justify-center overflow-auto';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Fotografía');
    root.innerHTML = `
      <div class="lightbox-frame relative w-full max-w-4xl">
        <button id="lightbox-close" class="absolute -top-12 right-4 text-white bg-black/50 rounded-full w-12 h-12 flex items-center justify-center" type="button" aria-label="Cerrar foto"><i class="fa-solid fa-xmark text-xl" aria-hidden="true"></i></button>
        <div class="lightbox-surface bg-black overflow-hidden relative">
          <div class="lightbox-media relative max-w-full">
            <button id="prevPhoto" class="fixed sm:absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-3 rounded-full z-10" type="button" aria-label="Foto anterior"><i class="fa-solid fa-chevron-left text-xl" aria-hidden="true"></i></button>
            <button id="nextPhoto" class="fixed sm:absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-3 rounded-full z-10" type="button" aria-label="Foto siguiente"><i class="fa-solid fa-chevron-right text-xl" aria-hidden="true"></i></button>
            <div class="lightbox-motion-stage relative overflow-hidden"><img id="lightbox-img" class="lightbox-img lightbox-motion-image w-full max-h-[70vh] object-contain mx-auto" src="" alt=""></div>
          </div>
          <div class="lightbox-info bg-white dark:bg-instagram-800 p-4">
            <div class="flex justify-between items-center mb-3">
              <div class="flex items-center gap-1" aria-label="Acciones de la foto">
                <a id="lightbox-likes" href="" target="_blank" rel="noopener noreferrer" class="lightbox-action" title="Ver y dar me gusta en Bluesky" aria-label="Ver y dar me gusta en Bluesky" hidden><i class="fa-regular fa-heart text-xl" aria-hidden="true"></i><span class="text-base">0</span></a>
                <button id="lightbox-chat-btn" type="button" class="lightbox-action" title="Ver o añadir comentarios" aria-label="Ver o añadir comentarios" hidden><i class="fa-regular fa-comment text-xl" aria-hidden="true"></i><span id="lightbox-comments-count" class="text-base" hidden></span></button>
                <button id="lightbox-share" class="lightbox-action" type="button" title="Compartir foto" aria-label="Compartir foto"><i class="fa-solid fa-share-nodes text-xl" aria-hidden="true"></i></button>
                <a id="lightbox-download" href="" download class="lightbox-action" title="Descargar foto" aria-label="Descargar foto"><i class="fa-solid fa-download text-xl" aria-hidden="true"></i></a>
              </div>
              <a class="text-xs text-instagram-500 hover:text-instagram-700" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
            </div>
            <div id="lightbox-desc" class="text-sm mb-3"></div>
            <div class="flex items-center text-sm"><div id="lightbox-autor" class="flex items-center text-instagram-500"><i class="fa-regular fa-user mr-2" aria-hidden="true"></i><a target="_blank" rel="noopener noreferrer"></a></div><div id="lightbox-fecha" class="flex items-center ml-4 text-instagram-500"><i class="fa-regular fa-calendar mr-2" aria-hidden="true"></i><span></span></div></div>
          </div>
        </div>
      </div>
      <div id="bluesky-comments-panel" class="fixed inset-0 z-[90] flex items-end justify-center pointer-events-none"><div id="bluesky-comments-panel-inner" class="relative w-full max-w-2xl pointer-events-auto transition-transform duration-300 translate-y-full opacity-0 bg-instagram-50 dark:bg-instagram-900 rounded-t-lg shadow-2xl border border-instagram-200 dark:border-instagram-700 max-h-[70vh] overflow-y-auto"><button id="close-bluesky-comments" class="absolute top-2 right-2 text-instagram-500 bg-white dark:bg-instagram-800 rounded-full w-11 h-11 flex items-center justify-center shadow" type="button" aria-label="Cerrar comentarios"><i class="fa-solid fa-xmark text-lg" aria-hidden="true"></i></button><div id="bluesky-comments" class="p-4"></div></div></div>`;
    document.body.append(root);
    bind();
    return root;
  }

  const el = selector => root.querySelector(selector);
  const photoUrl = photo => `${window.location.origin}/f/${encodeURIComponent(photo.id)}/`;
  const isOpen = () => root && root.classList.contains('active');

  function renderDescription(description) {
    const value = String(description || '');
    if (typeof window.convertDescriptionToLinks !== 'function' || !window.DOMPurify) return value;
    return window.DOMPurify.sanitize(
      window.convertDescriptionToLinks(value, true),
      { ADD_ATTR: ['data-tag', 'target', 'rel'] }
    );
  }

  function renderEditorialCollectionLink(photo) {
    const description = el('#lightbox-desc');
    root.querySelector('#lightbox-mirada-context')?.remove();
    description.dataset.miradaPhotoId = String(photo.id);
    void findEditorialCollection(photo).then(collection => {
      if (!collection || description.dataset.miradaPhotoId !== String(photo.id)) return;
      const link = document.createElement('a');
      link.id = 'lightbox-mirada-context';
      link.className = 'lightbox-mirada-context';
      link.href = `/miradas/${encodeURIComponent(collection.slug)}/`;
      link.setAttribute('aria-label', `Ver la mirada ${collection.title}`);
      link.innerHTML = `<span class="lightbox-mirada-context-label">Parte de</span><span class="lightbox-mirada-context-title"></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i>`;
      link.querySelector('.lightbox-mirada-context-title').textContent = collection.title;
      description.insertAdjacentElement('afterend', link);
    });
  }

  function setNavigation() {
    const previous = el('#prevPhoto');
    const next = el('#nextPhoto');
    previous.disabled = state.transitioning || state.index <= 0;
    next.disabled = state.transitioning || state.index >= state.items.length - 1;
  }

  function closeComments() {
    el('#bluesky-comments-panel')?.classList.remove('pointer-events-auto');
    el('#bluesky-comments-panel-inner')?.classList.remove('translate-y-0', 'opacity-100');
    el('#bluesky-comments-panel-inner')?.classList.add('translate-y-full', 'opacity-0');
  }

  async function populateSocial(photo) {
    const likes = el('#lightbox-likes');
    const comments = el('#lightbox-chat-btn');
    const count = el('#lightbox-comments-count');
    let social = photo.social || {};
    if (!social.threadUrl && typeof window.getBlueskyThreadStats === 'function') {
      social = await window.getBlueskyThreadStats(photoUrl(photo)) || {};
    }
    if (state.items[state.index] !== photo) return;
    const hasThread = Boolean(social.threadUrl);
    likes.hidden = !hasThread;
    comments.hidden = !hasThread;
    if (hasThread) {
      likes.href = social.threadUrl;
      likes.querySelector('span').textContent = String(Number(social.likeCount) || 0);
      likes.setAttribute('aria-label', `Ver y dar me gusta en Bluesky (${Number(social.likeCount) || 0})`);
      const commentCount = Number(social.commentCount) || 0;
      count.textContent = String(commentCount);
      count.hidden = commentCount === 0;
      comments.setAttribute('aria-label', `Ver o añadir comentarios (${commentCount})`);
    }
  }

  async function show(index, direction = 0) {
    if (state.transitioning || index < 0 || index >= state.items.length) return;
    const photo = state.items[index];
    state.transitioning = true;
    state.index = index;
    closeComments();
    setNavigation();
    el('#lightbox-desc').innerHTML = renderDescription(photo.description);
    el('#lightbox-desc').closest('.lightbox-info').classList.toggle('is-description-empty', !String(photo.description || '').trim());
    renderEditorialCollectionLink(photo);
    const author = el('#lightbox-autor a');
    author.textContent = photo.author || 'Anónimo';
    author.href = photo.authorUrl || '';
    el('#lightbox-fecha span').textContent = window.galleryLightboxMotion?.formatDate(photo.date) || '';
    const download = el('#lightbox-download');
    download.href = photo.src;
    download.download = photo.filename || '';
    window.history.replaceState({ galleryLightbox: true, photoId: photo.id }, '', `/f/${encodeURIComponent(photo.id)}/`);
    window.galleryLightboxMotion?.preloadAdjacent(state.items, index, item => item.src);
    void populateSocial(photo);
    const image = el('#lightbox-img');
    await (window.galleryLightboxMotion?.transition({ stage: el('.lightbox-motion-stage'), image, src: photo.src, alt: photo.alt || '', direction, isActive: isOpen }) || Promise.resolve());
    state.transitioning = false;
    setNavigation();
  }

  function open(items, index, { returnUrl = `${location.pathname}${location.search}`, returnScrollY = scrollY } = {}) {
    mount();
    if (!items[index]) return;
    state = { items, index: -1, returnUrl, returnScrollY, transitioning: false };
    root.hidden = false;
    root.classList.add('active');
    document.body.classList.add('dialog-open');
    document.body.style.overflow = 'hidden';
    window.history.pushState({ galleryLightbox: true }, '', location.href);
    el('#lightbox-close').focus();
    void show(index);
  }

  function close() {
    if (!isOpen()) return;
    root.classList.remove('active');
    document.body.classList.remove('dialog-open');
    document.body.style.overflow = '';
    closeComments();
    window.history.replaceState({}, '', state.returnUrl);
    requestAnimationFrame(() => scrollTo({ top: state.returnScrollY, behavior: 'auto' }));
    setTimeout(() => { if (!isOpen()) { root.hidden = true; el('#lightbox-img').src = ''; } }, 180);
  }

  async function share() {
    const photo = state.items[state.index];
    if (!photo) return;
    const payload = { title: 'Foto de Valladolid - Aldea Pucela', text: photo.description || '', url: photoUrl(photo) };
    const copyText = payload.text.trim()
      ? `Mira esta foto de Valladolid de Aldea Pucela\n\n"${payload.text.trim()}"\n\n${payload.url}`
      : `Mira esta foto de Valladolid de Aldea Pucela\n\n${payload.url}`;
    try {
      if (navigator.share) await navigator.share(payload);
      else throw new Error('Web Share no disponible');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard API no disponible');
        await navigator.clipboard.writeText(copyText);
      } catch (_) {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        textarea.style.cssText = 'position:fixed;opacity:0';
        document.body.append(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
      }
      alert('URL copiada al portapapeles');
    }
  }

  function bind() {
    el('#lightbox-close').addEventListener('click', close);
    el('#prevPhoto').addEventListener('click', () => void show(state.index - 1, -1));
    el('#nextPhoto').addEventListener('click', () => void show(state.index + 1, 1));
    el('#lightbox-share').addEventListener('click', () => void share());
    el('#lightbox-chat-btn').addEventListener('click', async () => {
      const photo = state.items[state.index]; if (!photo) return;
      const panel = el('#bluesky-comments-panel'); const inner = el('#bluesky-comments-panel-inner');
      el('#bluesky-comments').innerHTML = '<div class="text-center text-instagram-500 py-4">Cargando comentarios...</div>';
      panel.classList.add('pointer-events-auto'); inner.classList.remove('translate-y-full', 'opacity-0'); inner.classList.add('translate-y-0', 'opacity-100');
      await window.loadBlueskyComments?.(photoUrl(photo));
    });
    el('#close-bluesky-comments').addEventListener('click', closeComments);
    el('#bluesky-comments-panel').addEventListener('click', event => { if (event.target === el('#bluesky-comments-panel')) closeComments(); });
    root.addEventListener('click', event => { if (event.target === root) close(); });
    document.addEventListener('keydown', event => {
      if (!isOpen()) return;
      if (event.key === 'Escape') return el('#bluesky-comments-panel-inner').classList.contains('translate-y-0') ? closeComments() : close();
      if (event.key === 'ArrowLeft') void show(state.index - 1, -1);
      if (event.key === 'ArrowRight') void show(state.index + 1, 1);
    });
    window.galleryLightboxMotion?.addSwipe(el('.lightbox-motion-stage'), { onPrevious: () => void show(state.index - 1, -1), onNext: () => void show(state.index + 1, 1), onDismiss: close, canNavigate: () => isOpen() && !state.transitioning });
  }

  window.galleryPhotoLightbox = { open, close, isOpen };
})();
