/**
 * Populares.js - Funcionalidad para la página de fotos más populares
 */

// Variables globales
let currentPeriod = 'all';
let currentSort = 'likes';
let allPhotos = [];
let filteredPhotos = [];
let currentPhotoIndex = 0;
let visiblePhotos = [];
let popularReturnUrl = null;
let popularReturnScrollY = null;
let currentPopularPhoto = null;
let isPopularLightboxSliding = false;

// Parámetros de URL válidos
const validPeriods = ['all', 'year', '6months', 'month', 'week'];
const validSorts = ['likes', 'comments', 'engagement'];

// Elementos DOM
const contenido = document.getElementById('contenido');
const currentFilterSpan = document.getElementById('current-filter');
const popularFilterStatus = document.getElementById('popular-filter-status');
const statsInfo = document.getElementById('stats-info');

// Sidebar elements
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// View toggle elements
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');

/**
 * Utility functions
 */
function timeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}${months === 1 ? ' mes' : ' meses'}`;
  const years = Math.floor(days / 365);
  return `${years}${years === 1 ? ' año' : ' años'}`;
}

function formatDate(dateString) {
  const date = new Date(dateString.replace(' ', 'T'));
  return date.toLocaleDateString('es', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function convertDescriptionToLinks(text, isLightbox = false) {
  if (!text) return '';
  const linkClass = isLightbox ? 'tag-link-lightbox' : 'tag-link';
  const linkColor = 'text-instagram-600 hover:text-instagram-800 underline';
  return text.replace(/https?:\/\/[^\s<>()]+|#([a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9_]+)/gi, (match, tag) => {
    if (/^https?:\/\//i.test(match)) {
      const trailingPunctuation = match.match(/[.,!?;:]+$/)?.[0] || '';
      const url = trailingPunctuation ? match.slice(0, -trailingPunctuation.length) : match;
      const safeUrl = DOMPurify.sanitize(url, { ALLOWED_URI_REGEXP: /^(?:(?:https?):\/\/)/i });
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="${linkColor}">foto original</a>${trailingPunctuation}`;
    }

    return `<a href="../?tag=${encodeURIComponent(tag)}" class="${linkClass} text-instagram-600 hover:text-instagram-800 underline" data-tag="${tag}">${match}</a>`;
  });
}

function convertHashtagsToLinks(text, isLightbox = false) {
  return convertDescriptionToLinks(text, isLightbox);
}

/**
 * Database functions
 */
async function loadPopularPhotos() {
  try {
    if (!window.databaseManager) {
      throw new Error('DatabaseManager no está cargado');
    }

    const db = await window.databaseManager.getDatabase();
    const totalResult = db.exec('SELECT COUNT(*) AS total FROM imagenes');
    if (totalResult.length > 0) {
      window.updateTotalPhotosCount?.(totalResult[0].values[0][0]);
    }
    
    // Query for popular photos with Bluesky stats
    const query = `
      SELECT i.*, bic.like_count, bic.comment_count, bic.repost_count, bic.last_updated, bp.post_id,
             ia.is_appropriate, ia.description as ai_description, ia.tags as ai_tags
      FROM imagenes i
      JOIN bluesky_interactions_cache bic ON i.id = bic.image_id
      JOIN bluesky_posts bp ON i.id = bp.image_id
      LEFT JOIN image_analysis ia ON i.id = ia.image_id
      WHERE (ia.is_appropriate = 1 OR ia.is_appropriate IS NULL)
        AND (bic.like_count > 0 OR bic.comment_count > 0 OR bic.repost_count > 0)
      ORDER BY (bic.like_count + bic.comment_count * 2 + bic.repost_count) DESC, bic.like_count DESC
    `;

    const result = db.exec(query);
    
    if (result.length === 0) {
      showNoResults();
      return;
    }

    const cols = result[0].columns;
    const rows = result[0].values;
    
    // Convert to objects
    allPhotos = rows.map(row => {
      const data = Object.fromEntries(cols.map((col, i) => [col, row[i]]));
      // Calculate engagement score
      data.engagement_score = (data.like_count || 0) + (data.comment_count || 0) * 2 + (data.repost_count || 0);
      return data;
    });

    console.log(`📊 Cargadas ${allPhotos.length} fotos populares`);
    
    // Apply initial filters
    applyFilters();
    
  } catch (error) {
    console.error('Error cargando fotos populares:', error);
    showError();
  }
}

/**
 * URL functions
 */
function updateURLWithFilters() {
  // Construir los parámetros de URL basados en los filtros actuales
  const params = new URLSearchParams();
  
  // Solo añadir parámetros si no son los valores por defecto
  if (currentPeriod !== 'all') {
    params.set('period', currentPeriod);
  }
  
  if (currentSort !== 'likes') {
    params.set('sort', currentSort);
  }
  
  // Actualizar la URL sin recargar la página
  const newURL = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.pushState({ path: newURL }, '', newURL);
}

function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  
  // Obtener y validar el período desde la URL
  const periodParam = params.get('period');
  if (periodParam && validPeriods.includes(periodParam)) {
    currentPeriod = periodParam;
  }
  
  // Obtener y validar el tipo de ordenación desde la URL
  const sortParam = params.get('sort');
  if (sortParam && validSorts.includes(sortParam)) {
    currentSort = sortParam;
  }
  
  // Actualizar la UI para reflejar los filtros de la URL
  document.querySelectorAll('.period-filter').forEach(btn => {
    btn.classList.remove('period-active', 'bg-instagram-100', 'dark:bg-instagram-700');
    if (btn.dataset.period === currentPeriod) {
      btn.classList.add('period-active', 'bg-instagram-100', 'dark:bg-instagram-700');
    }
  });
  
  document.querySelectorAll('.sort-filter').forEach(btn => {
    btn.classList.remove('sort-active', 'bg-instagram-100', 'dark:bg-instagram-700');
    if (btn.dataset.sort === currentSort) {
      btn.classList.add('sort-active', 'bg-instagram-100', 'dark:bg-instagram-700');
    }
  });
}

/**
 * Filter functions
 */
function applyFilters() {
  let photos = [...allPhotos];
  
  // Apply period filter
  if (currentPeriod !== 'all') {
    const now = new Date();
    const cutoffDate = new Date();
    
    if (currentPeriod === 'year') {
      cutoffDate.setFullYear(now.getFullYear() - 1);
    } else if (currentPeriod === '6months') {
      cutoffDate.setMonth(now.getMonth() - 6);
    } else if (currentPeriod === 'month') {
      cutoffDate.setMonth(now.getMonth() - 1);
    } else if (currentPeriod === 'week') {
      cutoffDate.setDate(now.getDate() - 7);
    }
    
    photos = photos.filter(photo => {
      const photoDate = new Date(photo.date.replace(' ', 'T'));
      return photoDate >= cutoffDate;
    });
  }
  
  // Apply sort
  photos.sort((a, b) => {
    if (currentSort === 'likes') {
      return (b.like_count || 0) - (a.like_count || 0);
    } else if (currentSort === 'comments') {
      return (b.comment_count || 0) - (a.comment_count || 0);
    } else if (currentSort === 'engagement') {
      return b.engagement_score - a.engagement_score;
    }
    return 0;
  });
  
  filteredPhotos = photos;
  
  // Update UI
  updateFilterDisplay();
  updateStatsInfo();
  renderPhotos();
  
  // Update URL to reflect current filters
  updateURLWithFilters();
}

function updateFilterDisplay() {
  const periodText = {
    'all': 'Todo el tiempo',
    'year': 'Último año',
    '6months': 'Últimos 6 meses',
    'month': 'Último mes',
    'week': 'Última semana'
  };
  
  const sortText = {
    'likes': 'Más likes',
    'comments': 'Más comentarios',
    'engagement': 'Más interacción'
  };
  
  if (currentFilterSpan) {
    currentFilterSpan.textContent = `${periodText[currentPeriod]} · ${sortText[currentSort]}`;
  }

  if (popularFilterStatus) {
    popularFilterStatus.hidden = currentPeriod === 'all' && currentSort === 'likes';
  }
}

function updateStatsInfo() {
  if (!statsInfo) return;
  
  const totalStats = filteredPhotos.reduce((acc, photo) => {
    acc.likes += photo.like_count || 0;
    acc.comments += photo.comment_count || 0;
    acc.reposts += photo.repost_count || 0;
    return acc;
  }, { likes: 0, comments: 0, reposts: 0 });
  
  if (filteredPhotos.length === 0) {
    statsInfo.textContent = 'No hay fotos populares en este período';
  } else {
    statsInfo.innerHTML = `
      <strong>${filteredPhotos.length}</strong> fotos • 
      <strong>${totalStats.likes}</strong> likes • 
      <strong>${totalStats.comments}</strong> comentarios • 
      <strong>${totalStats.reposts}</strong> reposts
    `;
  }
}

/**
 * Render functions
 */
function renderPhotos() {
  if (!contenido) return;
  
  if (filteredPhotos.length === 0) {
    showNoResults();
    return;
  }
  
  contenido.innerHTML = '';
  
  // Create grid
  const grid = document.createElement('div');
  grid.className = 'grid gallery-photo-grid';
  
  filteredPhotos.forEach((photo, index) => {
    const photoCard = createPhotoCard(photo, index);
    grid.appendChild(photoCard);
  });
  
  contenido.appendChild(grid);
  
  // Set up lazy loading
  setupLazyLoading();
}

function createPhotoCard(photo, index) {
  const card = document.createElement('div');
  card.className = 'photo-card';
  
  const filename = photo.path;
  const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
  const fullPath = `/files/${photo.path}`;
  
  const safeDescription = DOMPurify.sanitize(photo.description || '');
  const safeAuthor = DOMPurify.sanitize(photo.author || 'Desconocido');
  const telegramUrl = `https://t.me/AldeaPucela/27202/${encodeURIComponent(telegramId)}`;
  card.dataset.photoId = telegramId;
  card._photoData = photo;

  const compactStats = (photo.like_count || photo.comment_count) ? `
    <span class="popular-photo-stats" aria-label="${photo.like_count || 0} likes y ${photo.comment_count || 0} comentarios">
      ${(photo.like_count || 0) > 0 ? `<span><i class="fa-regular fa-heart" aria-hidden="true"></i>${photo.like_count}</span>` : ''}
      ${(photo.comment_count || 0) > 0 ? `<span><i class="fa-regular fa-comment" aria-hidden="true"></i>${photo.comment_count}</span>` : ''}
    </span>` : '';
  const descriptionMarkup = safeDescription
    ? `<p class="photo-list-description line-clamp-2">${safeDescription}</p>`
    : '';

  card.innerHTML = `
    <a href="/f/${encodeURIComponent(telegramId)}/" aria-label="Abrir foto popular" class="photo-card-image block relative overflow-hidden">
      <img 
        data-src="${fullPath}" 
        alt="${DOMPurify.sanitize(photo.ai_description || photo.description || '')}"
        class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300 lazy-image"
        loading="lazy"
      >
      ${compactStats}
    </a>
    <div class="photo-details">
      ${descriptionMarkup}
      <p class="photo-list-meta">
        <span class="photo-list-date">${formatDate(photo.date)}</span>
        <span class="photo-list-separator" aria-hidden="true">·</span>
        <a class="photo-provenance" href="${telegramUrl}" target="_blank" rel="noopener noreferrer" title="Ver mensaje original en Telegram">Compartida por <span>${safeAuthor}</span></a>
      </p>
    </div>
  `;
  
  return card;
}

function getPopularPhotoId(photo) {
  return photo.path.replace(/\.(?:jpe?g|png)$/i, '');
}

function openPopularLightbox(photo, { updateHistory = true } = {}) {
  const lightbox = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-img');
  if (!lightbox || !image || !photo) return;

  const photoId = getPopularPhotoId(photo);
  const fullPath = `/files/${photo.path}`;
  const canonicalUrl = `${window.location.origin}/f/${encodeURIComponent(photoId)}/`;
  const blueskyUrl = photo.post_id
    ? `https://bsky.app/profile/fotos.aldeapucela.org/post/${encodeURIComponent(photo.post_id)}`
    : '';
  currentPopularPhoto = photo;
  visiblePhotos = [...filteredPhotos];
  currentPhotoIndex = visiblePhotos.findIndex(item => getPopularPhotoId(item) === photoId);

  image.src = fullPath;
  image.alt = photo.ai_description || photo.description || '';

  const description = document.getElementById('lightbox-desc');
  if (description) {
    description.innerHTML = DOMPurify.sanitize(convertDescriptionToLinks(photo.description || '', true), {
      ADD_ATTR: ['data-tag', 'target', 'rel']
    });
  }

  const author = document.getElementById('lightbox-autor');
  if (author) {
    author.innerHTML = '';
    const icon = document.createElement('i');
    icon.className = 'fa-regular fa-user mr-2';
    icon.setAttribute('aria-hidden', 'true');
    const authorLink = document.createElement('a');
    authorLink.href = `https://t.me/AldeaPucela/27202/${encodeURIComponent(photoId)}`;
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';
    authorLink.textContent = photo.author || 'Desconocido';
    author.append(icon, authorLink);
  }

  const date = document.querySelector('#lightbox-fecha span');
  if (date) date.textContent = formatDate(photo.date);

  const download = document.getElementById('lightbox-download');
  if (download) {
    download.href = fullPath;
    download.download = photo.path;
  }

  const likesLink = document.getElementById('lightbox-likes');
  const likes = likesLink?.querySelector('span');
  const comments = document.getElementById('lightbox-comments-count');
  if (likes) likes.textContent = photo.like_count || 0;
  if (likesLink) {
    likesLink.href = blueskyUrl;
    likesLink.hidden = !blueskyUrl;
    likesLink.setAttribute('aria-label', `Ver y dar me gusta en Bluesky (${photo.like_count || 0})`);
  }
  if (comments) {
    comments.textContent = photo.comment_count || 0;
    comments.hidden = !(photo.comment_count > 0);
  }
  const commentsButton = document.getElementById('lightbox-chat-btn');
  if (commentsButton) {
    commentsButton.hidden = !blueskyUrl;
    commentsButton.setAttribute('aria-label', `Ver o añadir comentarios (${photo.comment_count || 0})`);
  }

  const share = document.getElementById('lightbox-share');
  if (share) {
    share.onclick = event => {
      event.stopPropagation();
      if (navigator.share) {
        navigator.share({ title: 'Foto de Valladolid', text: photo.description || '', url: canonicalUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(canonicalUrl).catch(() => {});
      }
    };
  }

  document.getElementById('prevPhoto')?.classList.toggle('hidden', currentPhotoIndex <= 0);
  document.getElementById('nextPhoto')?.classList.toggle('hidden', currentPhotoIndex >= visiblePhotos.length - 1);
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (updateHistory) {
    if (!popularReturnUrl) {
      popularReturnUrl = `${window.location.pathname}${window.location.search}`;
      popularReturnScrollY = window.scrollY;
      window.history.pushState({ popularLightbox: true, photoId, galleryScrollY: popularReturnScrollY }, '', `/f/${encodeURIComponent(photoId)}/`);
    } else {
      window.history.replaceState({ popularLightbox: true, photoId }, '', `/f/${encodeURIComponent(photoId)}/`);
    }
  }
}

function closePopularLightbox({ updateHistory = true } = {}) {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox?.classList.contains('active')) return;
  lightbox.classList.remove('active');
  closePopularCommentsPanel();
  document.body.style.overflow = '';
  const returnScrollY = popularReturnScrollY ?? window.history.state?.galleryScrollY;
  window.setTimeout(() => {
    const image = document.getElementById('lightbox-img');
    if (image) image.src = '';
  }, 300);

  if (updateHistory && popularReturnUrl) {
    window.history.replaceState({}, '', popularReturnUrl);
    popularReturnUrl = null;
  }
  if (Number.isFinite(returnScrollY)) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo({ top: returnScrollY, behavior: 'auto' }));
    });
  }
  popularReturnScrollY = null;
}

async function openPopularCommentsPanel() {
  if (!currentPopularPhoto) return;
  const panel = document.getElementById('bluesky-comments-panel');
  const panelInner = document.getElementById('bluesky-comments-panel-inner');
  const comments = document.getElementById('bluesky-comments');
  if (!panel || !panelInner || !comments) return;

  comments.innerHTML = '<div class="text-center text-instagram-500 py-4">Cargando comentarios...</div>';
  panel.classList.add('pointer-events-auto');
  panelInner.classList.remove('translate-y-full', 'opacity-0');
  panelInner.classList.add('translate-y-0', 'opacity-100');

  const photoId = getPopularPhotoId(currentPopularPhoto);
  const canonicalUrl = `${window.location.origin}/f/${encodeURIComponent(photoId)}/`;
  if (typeof window.loadBlueskyComments === 'function') {
    await window.loadBlueskyComments(canonicalUrl);
  }
}

function closePopularCommentsPanel() {
  const panel = document.getElementById('bluesky-comments-panel');
  const panelInner = document.getElementById('bluesky-comments-panel-inner');
  if (!panel || !panelInner) return;
  panel.classList.remove('pointer-events-auto');
  panelInner.classList.remove('translate-y-0', 'opacity-100');
  panelInner.classList.add('translate-y-full', 'opacity-0');
}

function transitionToPopularPhoto(direction, updatePhoto) {
  if (isPopularLightboxSliding || typeof updatePhoto !== 'function') return;
  const lightbox = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-img');
  if (!image || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    updatePhoto();
    return;
  }

  isPopularLightboxSliding = true;
  lightbox?.classList.add('is-sliding');
  const outClass = direction > 0 ? 'lightbox-slide-out-left' : 'lightbox-slide-out-right';
  const inClass = direction > 0 ? 'lightbox-slide-in-right' : 'lightbox-slide-in-left';
  image.classList.add(outClass);

  window.setTimeout(() => {
    if (!lightbox?.classList.contains('active')) {
      image.classList.remove(outClass);
      lightbox?.classList.remove('is-sliding');
      isPopularLightboxSliding = false;
      return;
    }

    updatePhoto();
    image.classList.remove(outClass);
    image.classList.add(inClass);

    window.setTimeout(() => {
      image.classList.remove(inClass);
      lightbox?.classList.remove('is-sliding');
      isPopularLightboxSliding = false;
    }, 220);
  }, 120);
}

function showAdjacentPopularPhoto(direction) {
  const nextIndex = currentPhotoIndex + direction;
  if (nextIndex < 0 || nextIndex >= visiblePhotos.length) return;
  const photo = visiblePhotos[nextIndex];
  transitionToPopularPhoto(direction, () => {
    currentPhotoIndex = nextIndex;
    openPopularLightbox(photo);
  });
}

function setupLazyLoading() {
  const lazyImages = document.querySelectorAll('.lazy-image');
  
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.onload = () => img.classList.add('opacity-100');
        imageObserver.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px'
  });
  
  lazyImages.forEach(img => imageObserver.observe(img));
}


/**
 * UI Helper functions
 */
function showNoResults() {
  if (contenido) {
    contenido.innerHTML = `
      <div class="text-center py-20">
        <i class="fa-regular fa-heart text-6xl text-instagram-300 mb-4"></i>
        <h3 class="text-xl font-medium text-instagram-500 mb-2">No hay fotos populares</h3>
        <p class="text-instagram-400">No se encontraron fotos con interacciones en este período</p>
        <div class="mt-6">
          <button id="view-all-photos-btn" class="bg-instagram-600 text-white px-4 py-2 rounded hover:bg-instagram-700">
            Ver todas las fotos
          </button>
        </div>
      </div>
    `;
    
    // Add event listener for the button
    const viewAllBtn = document.getElementById('view-all-photos-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        window.location.href = '../';
      });
    }
  }
}

function showError() {
  if (contenido) {
    contenido.innerHTML = `
      <div class="text-center py-20">
        <i class="fa-solid fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
        <h3 class="text-xl font-medium text-instagram-500 mb-2">Error cargando fotos</h3>
        <p class="text-instagram-400">Hubo un problema al cargar las fotos populares</p>
        <div class="mt-6">
          <button id="retry-btn" class="bg-instagram-600 text-white px-4 py-2 rounded hover:bg-instagram-700">
            Reintentar
          </button>
        </div>
      </div>
    `;
    
    // Add event listener for the retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        location.reload();
      });
    }
  }
}

/**
 * Sidebar functions
 */
function toggleSidebar() {
  if (!sidebar || !sidebarOverlay) return;
  
  const isOpen = sidebar.classList.contains('translate-x-0');
  
  if (isOpen) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('translate-x-full');
    sidebarOverlay.classList.remove('opacity-100', 'pointer-events-auto');
    sidebarOverlay.classList.add('opacity-0', 'pointer-events-none');
  } else {
    sidebar.classList.remove('translate-x-full');
    sidebar.classList.add('translate-x-0');
    sidebarOverlay.classList.remove('opacity-0', 'pointer-events-none');
    sidebarOverlay.classList.add('opacity-100', 'pointer-events-auto');
  }
}


/**
 * Event listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  // Get filters from URL before loading photos
  getFiltersFromURL();
  
  // Load photos
  loadPopularPhotos();
  
  // Sidebar controls
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
  if (closeSidebar) closeSidebar.addEventListener('click', toggleSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

  contenido?.addEventListener('click', event => {
    const link = event.target.closest('.photo-card-image');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const card = link.closest('.photo-card');
    if (!card?._photoData) return;
    event.preventDefault();
    openPopularLightbox(card._photoData);
  });

  document.getElementById('lightbox-close')?.addEventListener('click', () => closePopularLightbox());
  document.getElementById('lightbox')?.addEventListener('click', event => {
    if (event.target.id === 'lightbox') closePopularLightbox();
  });
  document.getElementById('lightbox-chat-btn')?.addEventListener('click', event => {
    event.stopPropagation();
    openPopularCommentsPanel();
  });
  document.getElementById('close-bluesky-comments')?.addEventListener('click', event => {
    event.stopPropagation();
    closePopularCommentsPanel();
  });
  document.getElementById('bluesky-comments-panel')?.addEventListener('click', event => {
    if (event.target.id === 'bluesky-comments-panel') closePopularCommentsPanel();
  });
  document.getElementById('prevPhoto')?.addEventListener('click', event => {
    event.stopPropagation();
    showAdjacentPopularPhoto(-1);
  });
  document.getElementById('nextPhoto')?.addEventListener('click', event => {
    event.stopPropagation();
    showAdjacentPopularPhoto(1);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const commentsPanel = document.getElementById('bluesky-comments-panel-inner');
      if (commentsPanel?.classList.contains('translate-y-0')) {
        closePopularCommentsPanel();
        return;
      }
      closePopularLightbox();
    }
    if (event.key === 'ArrowLeft') showAdjacentPopularPhoto(-1);
    if (event.key === 'ArrowRight') showAdjacentPopularPhoto(1);
  });
  
  // Period filters
  document.querySelectorAll('.period-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.period-filter').forEach(b => b.classList.remove('period-active', 'bg-instagram-100', 'dark:bg-instagram-700'));
      btn.classList.add('period-active', 'bg-instagram-100', 'dark:bg-instagram-700');
      currentPeriod = btn.dataset.period;
      applyFilters();
      toggleSidebar();
    });
  });
  
  // Sort filters
  document.querySelectorAll('.sort-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.sort-filter').forEach(b => b.classList.remove('sort-active', 'bg-instagram-100', 'dark:bg-instagram-700'));
      btn.classList.add('sort-active', 'bg-instagram-100', 'dark:bg-instagram-700');
      currentSort = btn.dataset.sort;
      applyFilters();
      toggleSidebar();
    });
  });

  document.getElementById('edit-popular-filters')?.addEventListener('click', () => {
    toggleSidebar();
    window.setTimeout(() => document.querySelector('.period-filter.period-active')?.focus(), 180);
  });

  document.getElementById('reset-popular-filters')?.addEventListener('click', () => {
    currentPeriod = 'all';
    currentSort = 'likes';
    document.querySelectorAll('.period-filter').forEach(btn => {
      btn.classList.toggle('period-active', btn.dataset.period === currentPeriod);
      btn.classList.toggle('bg-instagram-100', btn.dataset.period === currentPeriod);
      btn.classList.toggle('dark:bg-instagram-700', btn.dataset.period === currentPeriod);
    });
    document.querySelectorAll('.sort-filter').forEach(btn => {
      btn.classList.toggle('sort-active', btn.dataset.sort === currentSort);
      btn.classList.toggle('bg-instagram-100', btn.dataset.sort === currentSort);
      btn.classList.toggle('dark:bg-instagram-700', btn.dataset.sort === currentSort);
    });
    applyFilters();
  });
  
  // View toggles
  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      window.setGalleryView?.('grid');
    });
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      window.setGalleryView?.('list');
    });
  }
  
  // Share button
  const shareBtn = document.getElementById('shareGeneralBtn2');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'Fotos Más Populares - Aldea Pucela',
          text: 'Las fotos más populares de Valladolid' + 
                (currentPeriod !== 'all' || currentSort !== 'likes' ? 
                ' (' + currentFilterSpan.textContent + ')' : ''),
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        // TODO: Show toast notification
      }
    });
  }
  
  // Handle browser back/forward navigation
  window.addEventListener('popstate', () => {
    if (document.getElementById('lightbox')?.classList.contains('active')) {
      closePopularLightbox({ updateHistory: false });
      popularReturnUrl = null;
      return;
    }
    getFiltersFromURL();
    applyFilters();
  });
});
