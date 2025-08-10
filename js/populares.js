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

// Parámetros de URL válidos
const validPeriods = ['all', 'year', '6months', 'month', 'week'];
const validSorts = ['likes', 'comments', 'engagement'];

// Elementos DOM
const contenido = document.getElementById('contenido');
const currentFilterSpan = document.getElementById('current-filter');
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

function convertHashtagsToLinks(text, isLightbox = false) {
  if (!text) return '';
  const linkClass = isLightbox ? 'tag-link-lightbox' : 'tag-link';
  return text.replace(/#([a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9_]+)/gi, (match, tag) => {
    return `<a href="../?tag=${encodeURIComponent(tag)}" class="${linkClass} text-instagram-600 hover:text-instagram-800 underline" data-tag="${tag}">${match}</a>`;
  });
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
    
    // Query for popular photos with Bluesky stats
    const query = `
      SELECT i.*, bic.like_count, bic.comment_count, bic.repost_count, bic.last_updated,
             ia.is_appropriate, ia.description as ai_description, ia.tags as ai_tags
      FROM imagenes i
      JOIN bluesky_interactions_cache bic ON i.id = bic.image_id
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
    currentFilterSpan.textContent = `${periodText[currentPeriod]} • ${sortText[currentSort]}`;
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
  grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2';
  
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
  card.className = 'photo-card relative bg-white dark:bg-instagram-800 rounded-lg shadow-sm overflow-hidden transform transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer';
  
  const filename = photo.path;
  const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
  const fullPath = `/files/${photo.path}`;
  
  // Add rank badge for top photos
  let rankBadge = '';
  if (index < 3) {
    const colors = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-600'];
    const icons = ['fa-trophy', 'fa-medal', 'fa-medal'];
    rankBadge = `
      <div class="absolute top-2 left-2 ${colors[index]} text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10">
        <i class="fas ${icons[index]}"></i>
        <span>#${index + 1}</span>
      </div>
    `;
  } else if (index < 10) {
    rankBadge = `
      <div class="absolute top-2 left-2 bg-instagram-600 text-white text-xs px-2 py-1 rounded-full z-10">
        #${index + 1}
      </div>
    `;
  }
  
  card.innerHTML = `
    ${rankBadge}
    <div class="aspect-square relative overflow-hidden">
      <img 
        data-src="${fullPath}" 
        alt="${DOMPurify.sanitize(photo.ai_description || photo.description || '')}"
        class="w-full h-full object-cover opacity-0 transition-opacity duration-300 lazy-image"
        loading="lazy"
      >
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      
      <!-- Stats overlay -->
      <div class="absolute bottom-2 left-2 right-2 text-white text-xs">
        <div class="flex justify-between items-end">
          <div class="flex gap-3">
            ${(photo.like_count || 0) > 0 ? `
              <span class="flex items-center gap-1">
                <i class="fa-regular fa-heart"></i>
                <span>${photo.like_count}</span>
              </span>
            ` : ''}
            ${(photo.comment_count || 0) > 0 ? `
              <span class="flex items-center gap-1">
                <i class="fa-regular fa-comment"></i>
                <span>${photo.comment_count}</span>
              </span>
            ` : ''}
            ${(photo.repost_count || 0) > 0 ? `
              <span class="flex items-center gap-1">
                <i class="fa-solid fa-retweet"></i>
                <span>${photo.repost_count}</span>
              </span>
            ` : ''}
          </div>
          <div class="text-right">
            <div class="text-xs opacity-75">${formatDate(photo.date)}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Photo info -->
    <div class="p-3">
      <div class="text-sm font-medium mb-1 line-clamp-2">
        ${DOMPurify.sanitize(photo.description ? convertHashtagsToLinks(photo.description.split('\n')[0]) : 'Sin descripción')}
      </div>
      <div class="text-xs text-instagram-500">
        Por ${DOMPurify.sanitize(photo.author || 'Desconocido')}
      </div>
    </div>
  `;
  
  // Add click handler - redirect to main gallery with photo ID
  card.addEventListener('click', () => {
    window.location.href = `../#${telegramId}`;
  });
  
  return card;
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
  
  // Period filters
  document.querySelectorAll('.period-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.period-filter').forEach(b => b.classList.remove('period-active', 'bg-instagram-100', 'dark:bg-instagram-700'));
      e.target.classList.add('period-active', 'bg-instagram-100', 'dark:bg-instagram-700');
      currentPeriod = e.target.dataset.period;
      applyFilters();
      toggleSidebar();
    });
  });
  
  // Sort filters
  document.querySelectorAll('.sort-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.sort-filter').forEach(b => b.classList.remove('sort-active', 'bg-instagram-100', 'dark:bg-instagram-700'));
      e.target.classList.add('sort-active', 'bg-instagram-100', 'dark:bg-instagram-700');
      currentSort = e.target.dataset.sort;
      applyFilters();
      toggleSidebar();
    });
  });
  
  // View toggles
  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      if (contenido) contenido.classList.remove('list-view');
      gridViewBtn.classList.add('view-toggle-active');
      if (listViewBtn) listViewBtn.classList.remove('view-toggle-active');
    });
  }
  
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      if (contenido) contenido.classList.add('list-view');
      listViewBtn.classList.add('view-toggle-active');
      if (gridViewBtn) gridViewBtn.classList.remove('view-toggle-active');
    });
  }
  
  // Scroll to top on title click
  const scrollTopTitle = document.getElementById('scrollTopTitle');
  if (scrollTopTitle) {
    scrollTopTitle.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    getFiltersFromURL();
    applyFilters();
  });
});
