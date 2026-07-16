(() => {
  const NEWSLETTER_URL = 'https://aldeapucela.org/boletin/';
  const INSERT_AFTER_PHOTOS = 30;
  const JOINED_STORAGE_KEY = 'aldea-fotos:newsletter-joined';
  const CONTENT_SELECTOR = '#contenido, #editorialCollectionGrid, #editorialPhotoGrid';
  const ITEM_SELECTOR = '.photo-card, .editorial-collection-link, .editorial-photo-link';
  let ctaSequence = 0;
  let refreshQueued = false;

  function track(action, placement) {
    window._paq = window._paq || [];
    window._paq.push(['trackEvent', 'Boletín', action, placement]);
    if (placement === 'entre-recientes') {
      window._paq.push(['trackEvent', 'Recorrido galería', action, 'boletin:foto-30']);
    }
  }

  function hasJoinedNewsletter() {
    try {
      return window.localStorage.getItem(JOINED_STORAGE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function rememberNewsletterClick() {
    try {
      window.localStorage.setItem(JOINED_STORAGE_KEY, '1');
    } catch (error) {
      // La navegación al boletín sigue funcionando sin almacenamiento local.
    }
    document.querySelectorAll('[data-newsletter-content-cta]').forEach(cta => cta.remove());
  }

  function createCta({ placement, contextual = false }) {
    const cta = document.createElement('section');
    const titleId = `newsletterCtaTitle${++ctaSequence}`;
    cta.className = `newsletter-cta${contextual ? ' newsletter-cta--contextual' : ''}`;
    cta.dataset.newsletterContentCta = placement;
    cta.setAttribute('aria-labelledby', titleId);
    cta.innerHTML = `
      <span class="newsletter-cta-mark" aria-hidden="true"><i class="fa-regular fa-envelope"></i></span>
      <div class="newsletter-cta-copy">
        <h3 id="${titleId}">Nuevas fotos, una vez a la semana</h3>
        <p>También debates, noticias y eventos de Aldea Pucela.</p>
      </div>
      <a class="newsletter-cta-button" href="${NEWSLETTER_URL}" data-newsletter-placement="${placement}">Apúntame <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
    `;

    const link = cta.querySelector('a');
    link?.addEventListener('click', () => {
      rememberNewsletterClick();
      track('Clic', placement);
    });
    observeImpression(cta, placement);
    return cta;
  }

  function observeImpression(cta, placement) {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      track('Impresión', placement);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(cta);
  }

  function isVisible(element) {
    return !element.hidden
      && !element.classList.contains('hidden')
      && !element.closest('[hidden], .hidden');
  }

  function renderEditorialCta() {
    const detail = document.getElementById('editorialDetail');
    const detailGrid = document.getElementById('editorialPhotoGrid');
    if (detail && detailGrid && isVisible(detail)) {
      const photos = [...detailGrid.querySelectorAll('.editorial-photo-link')].filter(isVisible);
      if (photos.length) detailGrid.appendChild(createCta({ placement: 'final-coleccion', contextual: true }));
      return true;
    }

    const overview = document.getElementById('editorialOverview');
    const collectionGrid = document.getElementById('editorialCollectionGrid');
    if (overview && collectionGrid && isVisible(overview)) {
      const collections = [...collectionGrid.querySelectorAll('.editorial-collection-link')].filter(isVisible);
      if (collections.length) collectionGrid.appendChild(createCta({ placement: 'final-miradas', contextual: true }));
      return true;
    }
    return false;
  }

  function renderGalleryCta() {
    const content = document.getElementById('contenido');
    if (!content) return;
    const allPhotos = [...content.querySelectorAll('.photo-card')];
    const visiblePhotos = allPhotos.filter(isVisible);
    if (!visiblePhotos.length) return;

    const params = new URLSearchParams(window.location.search);
    const hasQueryFilter = ['tag', 'element', 'search'].some(key => params.has(key));
    const hasHiddenPhotos = allPhotos.some(photo => !isVisible(photo));
    const isPopular = window.location.pathname.startsWith('/populares');
    const useContextualEnd = !isPopular && (hasQueryFilter || hasHiddenPhotos);

    if (useContextualEnd || visiblePhotos.length < INSERT_AFTER_PHOTOS) {
      content.appendChild(createCta({ placement: 'final-resultados', contextual: true }));
      return;
    }

    visiblePhotos[INSERT_AFTER_PHOTOS - 1].after(createCta({
      placement: isPopular ? 'entre-populares' : 'entre-recientes'
    }));
  }

  function refreshContentCtas() {
    document.querySelectorAll('[data-newsletter-content-cta]').forEach(cta => cta.remove());
    if (hasJoinedNewsletter()) return;
    if (!renderEditorialCta()) renderGalleryCta();
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      refreshContentCtas();
    });
  }

  function mutationNeedsRefresh(mutation) {
    if (mutation.type === 'attributes') {
      return mutation.attributeName === 'class' && mutation.target.matches(ITEM_SELECTOR);
    }
    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes]
      .filter(node => node.nodeType === Node.ELEMENT_NODE);
    if (!changedNodes.length) return false;
    return changedNodes.some(node => {
      if (node.matches?.('[data-newsletter-content-cta]')) return false;
      return node.matches?.(ITEM_SELECTOR) || node.querySelector?.(ITEM_SELECTOR);
    });
  }

  function setupContentObserver() {
    const containers = document.querySelectorAll(CONTENT_SELECTOR);
    if (!containers.length) return;
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutationNeedsRefresh)) scheduleRefresh();
    });
    containers.forEach(container => observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    }));
    scheduleRefresh();
  }

  function setupMenuTracking() {
    document.querySelectorAll('[data-newsletter-menu-link]').forEach(link => {
      link.addEventListener('click', () => {
        rememberNewsletterClick();
        track('Clic', 'menu');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupMenuTracking();
    setupContentObserver();
  });

  window.refreshNewsletterCtas = scheduleRefresh;
})();
