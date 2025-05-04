/*
  Script principal
*/

// URL handling functions
function getPhotoIdFromUrl() {
    const hash = window.location.hash;
    return hash ? hash.slice(1) : null;
}

function updateUrl(photoId) {
    const url = new URL(window.location);
    if (photoId) {
        url.hash = photoId;
    } else {
        url.hash = '';
    }
    window.history.pushState(null, '', url);
}

// Search photos by text
function searchPhotos(text) {
  if (!text.trim()) {
    clearSearch();
    return;
  }

  const searchTerm = text.toLowerCase().trim();
  
  // Update URL
  const url = new URL(window.location);
  url.searchParams.set('search', searchTerm);
  window.history.pushState({}, '', url);
  
  // Filter photos
  let foundPhotos = false;
  document.querySelectorAll('.date-group').forEach(group => {
    let hasVisiblePhotos = false;
    group.querySelectorAll('.photo-card').forEach(card => {
      const description = (card.dataset.description || '').toLowerCase();
      const imgElement = card.querySelector('img');
      const aiDescription = imgElement ? imgElement.alt.toLowerCase() : '';
      const aiTags = card.dataset.aiTags ? JSON.parse(card.dataset.aiTags) : [];
      
      // Search in normal description, AI description and AI tags
      if (description.includes(searchTerm) || 
          aiDescription.includes(searchTerm) || 
          aiTags.some(tag => tag.toLowerCase().includes(searchTerm))) {
        card.classList.remove('hidden');
        hasVisiblePhotos = true;
        foundPhotos = true;
      } else {
        card.classList.add('hidden');
      }
    });
    group.classList.toggle('hidden', !hasVisiblePhotos);
  });

  // Show no results message if no photos found
  const contenido = document.getElementById('contenido');
  if (!foundPhotos) {
    // Use textContent to prevent XSS from the search term
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'text-center py-20 text-instagram-500';
    noResultsDiv.textContent = `No hay fotos que contengan "${text}"`;
    if (contenido) contenido.innerHTML = ''; // Clear previous content
    if (contenido) contenido.appendChild(noResultsDiv);
  }

  // Show search filter indicator
  const searchFilter = document.getElementById('searchFilter');
  document.getElementById('searchTerm').textContent = text;
  searchFilter.classList.remove('hidden');
}

// Clear search
function clearSearch() {
  const url = new URL(window.location);
  url.searchParams.delete('search');
  window.history.pushState({}, '', url);
  
  document.querySelectorAll('.date-group, .photo-card').forEach(el => {
    el.classList.remove('hidden');
  });

  // Hide search filter indicator
  document.getElementById('searchFilter').classList.add('hidden');
  document.getElementById('searchInput').value = '';
}

// Convert hashtags to links
function convertHashtagsToLinks(text, isLightbox = false) {
  if (!text) return '';
  return text.replace(/#([áéíóúüñÁÉÍÓÚÜÑa-zA-Z0-9_]+)/g, (match, tag) => {
    const normalizedTag = tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (isLightbox) {
      // For lightbox, add data-tag and class, remove onclick
      return `<a href="?tag=${normalizedTag}" class="tag-link-lightbox text-instagram-600 dark:text-instagram-400 hover:underline" data-tag="${normalizedTag}">${match}</a>`;
    } else {
      // For main page grid/list view, keep onclick
      return `<a href="?tag=${normalizedTag}" class="tag-link text-instagram-600 dark:text-instagram-400 hover:underline" data-tag="${normalizedTag}">${match}</a>`;
    }
  });
}

// Filter photos by tag
function filterByTag(event, tag, fromSidebar = false) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Close lightbox if open
  closeLightbox();
  
  const normalizedTag = tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  
  // Update URL and title
  const url = new URL(window.location);
  url.searchParams.set('tag', normalizedTag);
  window.history.pushState({}, '', url);
  
  // Show tag filter UI
  const tagTitle = document.getElementById('tagTitle');
  tagTitle.querySelector('span').textContent = '#' + tag;
  tagTitle.classList.remove('hidden');
  
  // Filter visible photos and check if any found
  let foundPhotos = false;
  document.querySelectorAll('.date-group').forEach(group => {
    let hasVisiblePhotos = false;
    group.querySelectorAll('.photo-card').forEach(card => {
      const description = (card.dataset.description || '').toLowerCase();
      const normalizedDescription = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedDescription.includes('#' + normalizedTag)) {
        card.classList.remove('hidden');
        hasVisiblePhotos = true;
        foundPhotos = true;
      } else {
        card.classList.add('hidden');
      }
    });
    group.classList.toggle('hidden', !hasVisiblePhotos);
  });

  // Show no results message if no photos found
  const contenido = document.getElementById('contenido');
  if (!foundPhotos) {
    // Use textContent to prevent XSS from the tag name
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'text-center py-20 text-instagram-500';
    noResultsDiv.textContent = `No hay fotos con la etiqueta #${tag}`;
    if (contenido) contenido.innerHTML = ''; // Clear previous content
    if (contenido) contenido.appendChild(noResultsDiv);
  }

  // Show tag filter indicator
  const tagFilter = document.getElementById('tagFilter');
  const tagName = document.getElementById('tagName');
  tagName.textContent = `#${tag}`;
  tagFilter.classList.remove('hidden');
  
  // Close sidebar only if coming from sidebar
  if (fromSidebar) {
    toggleSidebar();
  }
}

// Clear tag filter
function clearTagFilter() {
  const url = new URL(window.location);
  url.searchParams.delete('tag');
  url.searchParams.delete('element');  // Also clear element parameter
  window.history.pushState({}, '', url);
  
  document.querySelectorAll('.date-group, .photo-card').forEach(el => {
    el.classList.remove('hidden');
  });

  // Hide tag filter indicator and title
  document.getElementById('tagFilter').classList.add('hidden');
  document.getElementById('tagTitle').classList.add('hidden');
}

// Filter photos by AI-detected element
function filterByElement(element) {
  // Close lightbox if open
  closeLightbox();
  
  // Update URL and title
  const url = new URL(window.location);
  url.searchParams.set('element', element);
  window.history.pushState({}, '', url);
  
  // Show element filter UI
  const tagTitle = document.getElementById('tagTitle');
  tagTitle.querySelector('span').textContent = element;
  tagTitle.classList.remove('hidden');
  
  // Filter visible photos and check if any found
  let foundPhotos = false;
  document.querySelectorAll('.date-group').forEach(group => {
    let hasVisiblePhotos = false;
    group.querySelectorAll('.photo-card').forEach(card => {
      const aiTags = card.dataset.aiTags ? JSON.parse(card.dataset.aiTags) : [];
      if (aiTags.some(tag => tag.toLowerCase() === element.toLowerCase())) {
        card.classList.remove('hidden');
        hasVisiblePhotos = true;
        foundPhotos = true;
      } else {
        card.classList.add('hidden');
      }
    });
    group.classList.toggle('hidden', !hasVisiblePhotos);
  });

  // Show no results message if no photos found
  const contenido = document.getElementById('contenido');
  if (!foundPhotos) {
    // Use textContent to prevent XSS from the element name
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'text-center py-20 text-instagram-500';
    noResultsDiv.textContent = `No hay fotos que contengan el elemento "${element}"`;
    if (contenido) contenido.innerHTML = ''; // Clear previous content
    if (contenido) contenido.appendChild(noResultsDiv);
  }

  // Show element filter indicator
  const tagFilter = document.getElementById('tagFilter');
  const tagName = document.getElementById('tagName');
  tagName.textContent = element;
  tagFilter.classList.remove('hidden');
}

// DOM Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxDesc = document.getElementById('lightbox-desc');
const lightboxAutorEl = document.getElementById('lightbox-autor');
const lightboxAutor = lightboxAutorEl ? lightboxAutorEl.querySelector('span') : null;
const lightboxFechaEl = document.getElementById('lightbox-fecha');
const lightboxFecha = lightboxFechaEl ? lightboxFechaEl.querySelector('span') : null;
const lightboxLicense = document.getElementById('lightbox-license');

// Helper: run only if lightbox exists
function ifLightbox(fn) {
  if (lightbox) fn();
}
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const contenido = document.getElementById('contenido');
const contenidoEl = contenido; // Para compatibilidad con código previo

function safeSetContenido(html) {
  if (!contenido) {
    console.warn("Elemento #contenido no existe en esta página. No se puede actualizar el contenido principal.");
    return;
  }
  contenido.innerHTML = html;
}

const searchInput = document.getElementById('searchInput');

// Variables para la navegación de fotos
let currentPhotoIndex = 0;
let visiblePhotos = [];

// Add search input event listener
if (searchInput) {
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchPhotos(e.target.value);
    }, 300); // Debounce search for better performance
  });
}

// Toggle view modes (grid vs list)
if (gridViewBtn) {
  gridViewBtn.addEventListener('click', () => {
    contenidoEl.classList.remove('list-view');
    gridViewBtn.classList.add('view-toggle-active');
    if (listViewBtn) listViewBtn.classList.remove('view-toggle-active');
  });
}

if (listViewBtn) {
  listViewBtn.addEventListener('click', () => {
    contenidoEl.classList.add('list-view');
    listViewBtn.classList.add('view-toggle-active');
    if (gridViewBtn) gridViewBtn.classList.remove('view-toggle-active');
  });
}

// Open lightbox with photo details
function openLightbox(imgSrc, data) {
  // Obtener filename y telegramId para la URL canónica y Telegram
  const filename = data.path?.split('/').pop() || '';
  const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
  const canonicalUrl = window.location.origin + window.location.pathname + '#' + telegramId;
  const blueskyDiv = document.getElementById('bluesky-comments');
  const commentsBtn = document.getElementById('lightbox-chat-btn');
  const commentsBadge = document.getElementById('lightbox-comments-count');
  if (blueskyDiv) {
    blueskyDiv.innerHTML = '';
    blueskyDiv.style.display = 'none';
  }
  if (commentsBadge) {
    commentsBadge.textContent = '';
    commentsBadge.style.display = 'none';
  }
  // Consultar el número de comentarios y actualizar el badge
  if (typeof loadBlueskyComments === 'function' && commentsBadge && commentsBtn) {
    loadBlueskyComments(canonicalUrl, true).then(async (result) => {
      let commentCount, likeCount, threadUrl;
      if (typeof result === 'object' && result !== null) {
        commentCount = result.commentCount;
        likeCount = result.likeCount;
        threadUrl = result.threadUrl;
      } else {
        commentCount = typeof result === 'number' ? result : 0;
        likeCount = 0;
        threadUrl = null;
      }
      // Update comments badge
      if (typeof commentCount === 'number' && commentCount > 0) {
        commentsBadge.textContent = commentCount;
        commentsBadge.style.display = '';
        commentsBadge.classList.remove('bg-instagram-500','text-white','rounded-full','min-w-[1.2em]','px-1','h-5','flex','items-center','justify-center');
      } else {
        commentsBadge.textContent = '';
        commentsBadge.style.display = 'none';
      }

      // Hide or show the comments icon depending on threadUrl
      if (threadUrl) {
        commentsBtn.style.display = '';
      } else {
        commentsBtn.style.display = 'none';
      }

      // Add likes count and link to thread
      let likesEl = document.getElementById('lightbox-likes-count');
      if (!likesEl) {
        likesEl = document.createElement('a');
        likesEl.id = 'lightbox-likes-count';
        likesEl.className = 'flex items-center gap-1 text-instagram-500 hover:text-instagram-700 text-xl';
        commentsBtn.parentNode.insertBefore(likesEl, commentsBtn.nextSibling);
      }
      if (threadUrl) {
        likesEl.href = threadUrl;
        likesEl.target = '_blank';
        likesEl.rel = 'noopener noreferrer';
        likesEl.style.display = '';
        likesEl.innerHTML = `<i class="fa-regular fa-heart"></i> <span class="text-base">${likeCount}</span>`;
      } else {
        likesEl.removeAttribute('href');
        likesEl.innerHTML = `<i class="fa-regular fa-heart"></i> <span class="text-base">0</span>`;
        likesEl.style.display = 'none';
      }
    });
  }
  // Evento para mostrar/ocultar comentarios al hacer clic
  if (commentsBtn && blueskyDiv) {
    commentsBtn.onclick = async () => {
      if (blueskyDiv.style.display === 'none' || blueskyDiv.innerHTML === '') {
        blueskyDiv.innerHTML = '<div class="text-center text-instagram-500 py-4">Cargando comentarios...</div>';
        blueskyDiv.style.display = '';
        await loadBlueskyComments(canonicalUrl);
        // --- BLOQUE NUEVO: Evitar cierre del lightbox al hacer scroll/touch en comentarios ---
        ['touchstart', 'touchmove', 'wheel'].forEach(ev => {
          blueskyDiv.addEventListener(ev, function(e) {
            e.stopPropagation();
          }, { passive: false });
        });
        // --- FIN BLOQUE NUEVO ---
      } else {
        blueskyDiv.style.display = 'none';
      }
    };
  }

  // Get all visible photos for navigation
  visiblePhotos = Array.from(document.querySelectorAll('.photo-card:not(.hidden)')).map(card => {
    // Check if the photo is appropriate
    const isAppropriate = !card.querySelector('[data-inappropriate="true"]');
    const imgElement = card.querySelector('img');
    
    return {
      path: isAppropriate && imgElement ? imgElement.dataset.src : '',
      data: {
        description: card.dataset.description,
        ai_description: imgElement ? imgElement.alt : '',
        author: card.querySelector('.font-medium a')?.textContent?.trim() || card.querySelector('.font-medium')?.textContent?.trim(),
        date: card.querySelector('.text-xs')?.dataset?.originalDate,
        path: isAppropriate && imgElement ? imgElement.dataset.src : '',
        is_appropriate: isAppropriate
      }
    };
  }).filter(photo => photo.data !== null);
  
  // Find current photo index
  currentPhotoIndex = visiblePhotos.findIndex(photo => photo.path === imgSrc);
  
  // Update navigation buttons
  updateNavigationButtons();
  
  // Only proceed with lightbox
  const lightboxContent = document.querySelector('.lightbox-content');
  if (data.is_appropriate !== 0) {
    lightboxImg.src = imgSrc;
    lightboxImg.alt = data.ai_description || data.description || '';
    lightboxImg.style.display = 'block';
    document.querySelector('.inappropriate-content')?.remove();
  } else {
    // Show inappropriate content message
    lightboxImg.style.display = 'none';
    const inappropriateDiv = document.querySelector('.inappropriate-content') || document.createElement('div');
    inappropriateDiv.className = 'inappropriate-content flex flex-col items-center justify-center text-center p-4 bg-instagram-200 dark:bg-instagram-700';
    inappropriateDiv.innerHTML = `
      <i class="fa-solid fa-eye-slash text-3xl mb-2 text-instagram-500"></i>
      <p class="text-sm text-instagram-500">Foto oculta porque puede tener contenido no adecuado</p>
    `;
    lightboxContent.insertBefore(inappropriateDiv, lightboxImg);
  }

  // Sanitize the description HTML before inserting it (pass true for isLightbox)
  const descriptionHtml = data.description ? convertHashtagsToLinks(data.description, true) : '';
  lightboxDesc.innerHTML = DOMPurify.sanitize(descriptionHtml, { ADD_ATTR: ['data-tag'] }); // Allow data-tag attribute

  // Add delegated event listener for tag links within the lightbox description
  lightboxDesc.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-link-lightbox')) {
      e.preventDefault(); // Prevent default link navigation
      e.stopPropagation(); // Stop event bubbling
      const tag = e.target.dataset.tag;
      if (tag) {
        filterByTag(e, tag); // Call filterByTag without 'fromSidebar'
      }
    }
  });

  // Create Telegram URL
  const telegramUrl = `https://t.me/AldeaPucela/27202/${telegramId}`;
  updateUrl(telegramId);
  
  // Set author name with link to Telegram
  const lightboxAutorDiv = document.getElementById('lightbox-autor');
  // Use textContent for the author name to prevent XSS, construct link safely
  lightboxAutorDiv.innerHTML = ''; // Clear previous content
  const iconUser = document.createElement('i');
  iconUser.className = 'fa-regular fa-user mr-2';
  lightboxAutorDiv.appendChild(iconUser);
  const authorLink = document.createElement('a');
  authorLink.href = telegramUrl;
  authorLink.target = '_blank';
  authorLink.rel = 'noopener noreferrer'; // Security: Prevent tabnabbing
  authorLink.className = 'hover:text-instagram-700';
  authorLink.textContent = data.author; // Use textContent for safety
  lightboxAutorDiv.appendChild(authorLink);
  
  // Set download link  
  const downloadLink = document.getElementById('lightbox-download');
  if (data.is_appropriate !== 0 && data.path) {
    downloadLink.href = imgSrc;
    downloadLink.download = data.path.split('/').pop();
    downloadLink.style.display = 'inline-block';
  } else {
    downloadLink.style.display = 'none';
  }
  
  // Parse and format date properly
  let photoDate;
  try {
    // Handle ISO string format from SQLite
    photoDate = new Date(data.date.replace(' ', 'T')); // Convert SQLite datetime to ISO format
    if (isNaN(photoDate.getTime())) { // If still invalid, try parsing parts
      const [datePart, timePart] = data.date.split(' ');
      const [year, month, day] = datePart.split('-');
      const [hour, minute, second] = (timePart || '00:00:00').split(':');
      photoDate = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
    }
  } catch (e) {
    console.error('Error parsing date:', data.date);
    photoDate = new Date(); // Fallback to current date if parsing fails
  }

  const formattedDate = window.innerWidth <= 640 
    ? photoDate.toLocaleString('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : photoDate.toLocaleDateString('es', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  
  lightboxFecha.textContent = formattedDate;
  
  // Add license link safely
  lightboxLicense.innerHTML = ''; // Clear previous content
  const licenseLink = document.createElement('a');
  licenseLink.className = 'text-instagram-500 hover:text-instagram-700';
  licenseLink.href = 'https://creativecommons.org/licenses/by-sa/4.0/deed.es';
  licenseLink.target = '_blank';
  licenseLink.rel = 'noopener noreferrer'; // Security: Prevent tabnabbing
  licenseLink.textContent = 'CC BY-SA 4.0';
  lightboxLicense.appendChild(licenseLink);
  
  const shareButton = document.getElementById('lightbox-share');
  shareButton.onclick = (e) => {
    e.stopPropagation();
    sharePhoto(telegramId, data.description);
  };


  // Update download link
  const downloadButton = document.getElementById('lightbox-download');
  if (data.is_appropriate !== 0 && data.path) {
    downloadButton.href = imgSrc;
    downloadButton.download = data.path.split('/').pop();
    downloadButton.style.display = 'inline-block';
  } else {
    downloadButton.style.display = 'none';
  }

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Update navigation buttons visibility
function updateNavigationButtons() {
  const prevButton = document.getElementById('prevPhoto');
  const nextButton = document.getElementById('nextPhoto');
  
  prevButton.classList.toggle('hidden', currentPhotoIndex <= 0);
  nextButton.classList.toggle('hidden', currentPhotoIndex >= visiblePhotos.length - 1);
}

// Navigate to previous photo
function showPrevPhoto() {
  if (currentPhotoIndex > 0) {
    currentPhotoIndex--;
    const photo = visiblePhotos[currentPhotoIndex];
    openLightbox(photo.path, photo.data);
  }
}

// Navigate to next photo
function showNextPhoto() {
  if (currentPhotoIndex < visiblePhotos.length - 1) {
    currentPhotoIndex++;
    const photo = visiblePhotos[currentPhotoIndex];
    openLightbox(photo.path, photo.data);
  }
}

// Add navigation event listeners
const prevPhotoBtn = document.getElementById('prevPhoto');
if (prevPhotoBtn) {
  prevPhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showPrevPhoto();
  });
}

const nextPhotoBtn = document.getElementById('nextPhoto');
if (nextPhotoBtn) {
  nextPhotoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showNextPhoto();
  });
}

// Update keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox || !lightbox.classList.contains('active')) return;
  
  switch (e.key) {
    case 'ArrowLeft':
      showPrevPhoto();
      break;
    case 'ArrowRight':
      showNextPhoto();
      break;
    case 'Escape':
      closeLightbox();
      break;
  }
});

// Handle touch gestures for navigation
let startX;
let startY;
let isDragging = false;
const MIN_SWIPE_DISTANCE = 50;

ifLightbox(() => {
  lightbox.addEventListener('touchstart', (e) => {
    // Solo registramos el inicio del toque si es un solo dedo
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      isDragging = true;
    }
  });
});

// Close lightbox
function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
  updateUrl('');
  setTimeout(() => {
    if (lightboxImg) lightboxImg.src = '';
  }, 300);
}

ifLightbox(() => {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
});

// Gestos táctiles para el lightbox
// Touch gesture variables and handlers already defined below

// Check for tag filter in URL
const urlParams = new URLSearchParams(window.location.search);
const tagParam = urlParams.get('tag');
if (tagParam) {
  setTimeout(() => filterByTag(new Event('click'), tagParam), 500);
}

// Check for search param in URL
const searchParam = urlParams.get('search');
if (searchParam) {
  setTimeout(() => {
    searchInput.value = searchParam;
    searchPhotos(searchParam);
  }, 500);
}

// Initialize SQL.js and load the database
initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}` }).then(async SQL => {
  try {
    const response = await fetch('/fotos.db');
    const buffer = await response.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));
    
    // Load tags from cache
    const tagsResponse = await fetch('/tags-cache.json');
    const tagsData = await tagsResponse.json();
    
    // Add tags to the sidebar filters (in tag dropdown)
    const tagDropdownContainer = document.querySelector('#tagDropdown .space-y-1');
    if (tagDropdownContainer) {
      tagsData.tags.forEach(({tag}) => {
        const tagBtn = document.createElement('button');
        tagBtn.className = 'w-full text-left py-1.5 px-3 text-sm rounded hover:bg-instagram-100 dark:hover:bg-instagram-600 text-instagram-500';
        tagBtn.dataset.tag = tag.substring(1); // Remove # from tag
        tagBtn.textContent = tag;
        tagBtn.onclick = (e) => {
          e.preventDefault();
          filterByTag(e, tag.substring(1), true);
        };
        tagDropdownContainer.appendChild(tagBtn);
      });
    }

    // Continue with existing query for photos
    const res = db.exec(`
      SELECT i.*, date(i.date) as fecha_grupo, 
             ia.is_appropriate, 
             ia.description as ai_description,
             ia.tags as ai_tags 
      FROM imagenes i 
      LEFT JOIN image_analysis ia ON i.id = ia.image_id 
      ORDER BY i.date DESC
    `);
    
    const contenido = document.getElementById('contenido');
    if (contenido) contenido.innerHTML = '';

    // Ensure paths point to /files/ subdirectory
    function getImagePath(path) {
      return path.startsWith('/') ? `/files${path}` : `/files/${path}`;
    }

    // Check for direct photo access from URL
    const photoIdFromUrl = getPhotoIdFromUrl();
    let photoToOpen = null;

    if (res.length > 0) {
      const cols = res[0].columns;
      const rows = res[0].values;
      
      // Agrupar datos por semana (lunes a domingo)
      function getWeekRange(dateStr) {
        const d = new Date(dateStr);
        const day = d.getDay(); // 0 (domingo) ... 6 (sábado)
        // Calcular el lunes de la semana
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        monday.setHours(0,0,0,0);
        // Calcular el domingo de la semana
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23,59,59,999);
        return {
          start: monday,
          end: sunday,
          key: `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}_${sunday.getFullYear()}-${String(sunday.getMonth()+1).padStart(2,'0')}-${String(sunday.getDate()).padStart(2,'0')}`,
          label: (() => {
            const diaInicio = monday.getDate();
            const mesInicio = monday.toLocaleString('es', {month:'long'});
            const diaFin = sunday.getDate();
            const mesFin = sunday.toLocaleString('es', {month:'long'});
            const anio = sunday.getFullYear();
            if (monday.getMonth() === sunday.getMonth()) {
              return `${diaInicio} - ${diaFin} ${mesFin} ${anio}`;
            } else {
              return `${diaInicio} ${mesInicio} - ${diaFin} ${mesFin} ${anio}`;
            }
          })()
        };
      }
      // Agrupar por semana
      const grupos = rows.reduce((acc, row) => {
        const data = Object.fromEntries(cols.map((col, i) => [col, row[i]]));
        if (data.is_appropriate === 0) {
          data.description = "Descripción no disponible";
        }
        const week = getWeekRange(data.fecha_grupo);
        if (!acc[week.key]) acc[week.key] = {label: week.label, fotos: []};
        acc[week.key].fotos.push(data);
        return acc;
      }, {});

      // Add week filters to the date dropdown
      const dateFiltersContainer = document.querySelector('#dateDropdown .space-y-1');
      if (dateFiltersContainer) {
        // Definir función para resetear filtros de fecha
        function resetDateFilter() {
          // Update active state
          document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('filter-active'));
          document.querySelector('[data-filter="all"]').classList.add('filter-active');
          
          // Show all date groups
          document.querySelectorAll('.date-group').forEach(group => {
            group.classList.remove('hidden');
          });
          
          // Close sidebar after selection
          toggleSidebar();
        }

        // Add click handler to "Todas las fechas" button
        const allDatesBtn = document.querySelector('[data-filter="all"]');
        if (allDatesBtn) {
          allDatesBtn.onclick = resetDateFilter;
        }

        Object.entries(grupos).forEach(([semanaKey, semanaObj]) => {
          const dateBtn = document.createElement('button');
          dateBtn.className = 'w-full text-left py-1.5 px-3 text-sm rounded hover:bg-instagram-100 dark:hover:bg-instagram-600 text-instagram-500';
          dateBtn.dataset.filter = semanaKey;
          dateBtn.textContent = semanaObj.label;
          dateBtn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('filter-active'));
            dateBtn.classList.add('filter-active');
            
            // Filter content
            const filter = dateBtn.dataset.filter;
            document.querySelectorAll('.date-group').forEach(group => {
              if (filter === 'all' || group.dataset.date === filter) {
                group.classList.remove('hidden');
              } else {
                group.classList.add('hidden');
              }
            });
            
            // Close sidebar after selection
            toggleSidebar();
          });
          dateBtn.addEventListener('click', () => {
            // Show date filter indicator
            const dateFilter = document.getElementById('dateFilter');
            const dateNameEl = document.getElementById('dateName');
            dateNameEl.textContent = dateBtn.textContent;
            dateFilter.classList.remove('hidden');
          });
          dateFiltersContainer.appendChild(dateBtn);
        });
      }

      // Create observer for lazy loading
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (!img.dataset.inappropriate) {
              img.src = img.dataset.src;
              // Precarga contadores Bluesky (likes/comentarios)
              try {
                // Extraer la URL canónica igual que en openLightbox
                const card = img.closest('.photo-card');
                if (card) {
                  const filename = img.dataset.src?.split('/').pop() || '';
                  const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
                  const canonicalUrl = window.location.origin + window.location.pathname + '#' + telegramId;
                  window._blueskyCountersCache = window._blueskyCountersCache || {};
                  const countersCache = window._blueskyCountersCache;
                  // Solo si no está ya en caché
                  if (!countersCache[canonicalUrl] && typeof loadBlueskyComments === 'function') {
                    loadBlueskyComments(canonicalUrl, true).then(result => {
                      let commentCount, likeCount, threadUrl;
                      if (typeof result === 'object' && result !== null) {
                        commentCount = result.commentCount;
                        likeCount = result.likeCount;
                        threadUrl = result.threadUrl;
                      } else {
                        commentCount = typeof result === 'number' ? result : 0;
                        likeCount = 0;
                        threadUrl = null;
                      }
                      countersCache[canonicalUrl] = { commentCount, likeCount, threadUrl };
                      // Actualizar dinámicamente los iconos en la tarjeta
                      const actions = document.querySelector(`.actions[data-photo-id='${telegramId}'] .bluesky-icons`);
                      if (actions) {
                        let html = '';
                        if (likeCount > 0) {
                          html += `<span class="ml-1 text-instagram-500 flex items-center" title="Me gusta en Bluesky"><i class="fa-regular fa-heart mr-1"></i><span>${likeCount}</span></span>`;
                        }
                        if (commentCount > 0) {
                          html += `<a href="${threadUrl || '#'}" target="_blank" rel="noopener noreferrer" class="ml-3 text-instagram-500 hover:text-instagram-700 flex items-center" title="Ver comentarios en Bluesky"><i class="fa-regular fa-comment"></i><span class="ml-1">${commentCount}</span></a>`;
                        }
                        actions.innerHTML = html;
                      }
                    }).catch(()=>{});
                  }
                }
              } catch (e) { /* noop */ }
              img.onload = () => img.classList.add('opacity-100');
            }
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '100px 0px',
        threshold: 0.1
      });

      // Render photo groups by date
      Object.entries(grupos).forEach(([semanaKey, semanaObj]) => {
        const grupo = document.createElement('div');
        grupo.className = 'date-group mb-8';
        grupo.dataset.date = semanaKey;
        
        // Semana header
        const fechaHeader = document.createElement('div');
        fechaHeader.className = 'sticky top-[60px] bg-white/90 dark:bg-instagram-800/90 backdrop-blur-sm py-2 px-4 mb-4 font-medium text-sm border-b border-instagram-200 dark:border-instagram-700 z-10';
        fechaHeader.textContent = semanaObj.label;
        
        // Photo grid
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 sm:gap-1 px-2';

        // Create photo cards
        semanaObj.fotos.forEach(data => {
          const item = document.createElement('div');
          item.className = 'photo-card bg-white dark:bg-instagram-800 rounded-sm shadow-sm overflow-hidden transform transition-transform hover:shadow-md active:scale-[0.98]';
          
          // Extract filename to create Telegram link
          const filename = data.path;
          const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
          
          // Add dataset attributes for finding photos by ID
          item.dataset.photoId = telegramId;
          item.dataset.description = data.description || '';
          item.dataset.aiTags = data.ai_tags || '[]';
          
          // Update the path to point to files directory
          const fullPath = getImagePath(data.path);
          data.path = fullPath;
          
          // Check if image is appropriate (check specifically for 0)
          const isAppropriate = data.is_appropriate !== 0;
          
          // Only add click handler if the image is appropriate
          if (isAppropriate) {
            item.onclick = () => openLightbox(fullPath, data);
            item.classList.add('cursor-pointer');
          } else {
            item.style.cursor = 'not-allowed';
          }
          
          const telegramUrl = `https://t.me/AldeaPucela/27202/${telegramId}`;
          
          // Store photo data if it matches URL
          if (photoIdFromUrl === telegramId && isAppropriate) {
            photoToOpen = { path: fullPath, data };
          }

          // Create photo card HTML
          const photoCardHtml = isAppropriate ? `
            <div class="photo-card-image relative pb-[100%] bg-instagram-100 dark:bg-instagram-700">
              <img loading="lazy" data-src="${fullPath}" alt="${data.ai_description || data.description || ''}" 
                   class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300">
            </div>
          ` : `
            <div class="photo-card-image relative pb-[100%] bg-instagram-100 dark:bg-instagram-700">
              <div class="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-center p-4 bg-instagram-200 dark:bg-instagram-700">
                <i class="fa-solid fa-eye-slash text-3xl mb-2 text-instagram-500"></i>
                <p class="text-sm text-instagram-500">Foto oculta porque puede tener contenido no adecuado</p>
              </div>
            </div>
          `;

          item.innerHTML = `
            ${photoCardHtml}
            <div class="photo-details p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-sm flex items-center">
                  <i class="fa-regular fa-user text-instagram-400 mr-2"></i>
                  <a href="${telegramUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-instagram-700">${data.author}</a>
                </div>
                <div class="text-xs text-instagram-500" data-original-date="${data.date}">
                  <i class="fa-regular fa-clock mr-1"></i>
                  ${window.innerWidth <= 640 
                    ? new Date(data.date).toLocaleString('es', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : new Date(data.date).toLocaleTimeString('es', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                  }
                </div>
              </div>
              ${data.description ? `<p class="text-sm text-instagram-500 line-clamp-2">${DOMPurify.sanitize(convertHashtagsToLinks(data.description, false))}</p>` : ''} 
              <div class="mt-2 flex justify-between items-center text-instagram-400 text-lg">
                <div class="actions" data-photo-id="${telegramId}">
                  <button type="button" class="share-button hover:text-instagram-600 mr-3" 
                          class="share-button hover:text-instagram-600 mr-3" data-telegram-id="${telegramId}" data-description="${encodeURIComponent(data.description || '')}" 
                          title="Compartir">
                    <i class="fa-solid fa-share-nodes"></i>
                  </button>
                  ${isAppropriate ? `
                    <a href="${fullPath}" download class="text-instagram-500 hover:text-instagram-700 mr-3" title="Descargar foto">
                      <i class="fa-solid fa-download"></i>
                    </a>
                  ` : ''}
                  <span class="bluesky-icons"></span>
                  
                </div>
                <a class="text-xs text-instagram-400 hover:text-instagram-700" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
              </div>`;

          // If image is inappropriate, mark it
          if (!isAppropriate) {
            const img = item.querySelector('img');
            if (img) {
              img.dataset.inappropriate = 'true';
            }
          }

          // Observe image for lazy loading
          const img = item.querySelector('img');
          if (img && isAppropriate) {
            imageObserver.observe(img);
          }
          
          grid.appendChild(item);
        });

        grupo.appendChild(fechaHeader);
        grupo.appendChild(grid);
        if (contenido) contenido.appendChild(grupo);
      });

      // Check URL parameters and handle based on order:
      // 1. First apply tag or element filter if present
      const tagParam = urlParams.get('tag');
      const elementParam = urlParams.get('element');
      if (elementParam) {
        filterByElement(elementParam);
      } else if (tagParam) {
        filterByTag(new Event('click'), tagParam);
      }
      
      // 2. Then check search param
      const searchParam = urlParams.get('search');
      if (searchParam) {
        searchInput.value = searchParam;
        searchPhotos(searchParam);
      }
      
      // 3. Finally, open photo if direct URL was used 
      if (photoToOpen) {
        // Small delay to ensure filters are applied first
        setTimeout(() => {
          openLightbox(photoToOpen.path, photoToOpen.data);
        }, 100);
      }

    } else {
      safeSetContenido('<div class="text-center py-20 text-instagram-500">No hay fotos para mostrar</div>');
    }
  } catch (error) {
    console.error('Error al cargar la galería:', error);
    safeSetContenido('<div class=\"text-center py-20 text-instagram-500\">Error al cargar la galería</div>');
  }
});

// Handle lightbox gestures
ifLightbox(() => {
  lightbox.addEventListener('touchstart', (e) => {
    // Solo registramos el inicio del toque si es un solo dedo
    if (e.touches.length === 1) {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      isDragging = true;
    }
  });
  lightbox.addEventListener('touchmove', (e) => {
    // Solo manejamos el gesto de deslizar si es un solo dedo
    if (e.touches.length === 1 && isDragging) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;
      
      if (Math.abs(diffX) > Math.abs(diffY)) {
        // Navegación horizontal
        if (Math.abs(diffX) > MIN_SWIPE_DISTANCE) {
          if (diffX > 0 && currentPhotoIndex > 0) {
            showPrevPhoto();
            isDragging = false;
          } else if (diffX < 0 && currentPhotoIndex < visiblePhotos.length - 1) {
            showNextPhoto();
            isDragging = false;
          }
        }
      } else if (Math.abs(diffY) > MIN_SWIPE_DISTANCE) {
        // Cerrar solo con deslizamiento vertical
        closeLightbox();
        isDragging = false;
      }
    }
  });
  lightbox.addEventListener('touchend', () => {
    isDragging = false;
  });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const photoId = getPhotoIdFromUrl();
  if (!photoId) {
    closeLightbox();
  }
});

// Add general share functionality
function shareGeneral() {
    const url = window.location.href;
    const shareText = `Mira esta colección de fotos de Valladolid de Aldea Pucela\n\n`;
    
    if (navigator.share) {
        navigator.share({
        url: url,
        title: 'Fotos de Valladolid - Aldea Pucela',
        text: shareText
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(shareText + url).then(() => {
        alert('URL copiada al portapapeles');
        }).catch(console.error);
    }
    }

// Add share functionality
function sharePhoto(photoId, description = '') {
  const url = `${window.location.origin}${window.location.pathname}#${photoId}`;
  const shareText = description 
    ? `Mira esta foto de Valladolid de Aldea Pucela\n\n"${description}"\n\n`
    : `Mira esta foto de Valladolid de Aldea Pucela\n\n`;

  if (navigator.share) {
    navigator.share({
      url: url,
      title: 'Foto de Valladolid - Aldea Pucela',
      text: shareText
    }).catch(console.error);
  } else {
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(shareText + ' ' + url).then(() => {
      alert('URL copiada al portapapeles');
    }).catch(console.error);
  }
}

// Add share functionality for tag collection
function shareTagCollection() {
  const tag = new URLSearchParams(window.location.search).get('tag');
  const element = new URLSearchParams(window.location.search).get('element');
  
  if (!tag && !element) return;
  
  let url, shareText, title;
  
  if (tag) {
    url = `${window.location.origin}${window.location.pathname}?tag=${tag}`;
    shareText = `Mira esta colección de fotos de Valladolid con #${tag} en Aldea Pucela\n\n`;
    title = `Fotos con #${tag} - Aldea Pucela`;
  } else {
    url = `${window.location.origin}${window.location.pathname}?element=${element}`;
    shareText = `Mira esta colección de fotos de Valladolid que contienen "${element}" en Aldea Pucela\n\n`;
    title = `Fotos que contienen ${element} - Aldea Pucela`;
  }

  if (navigator.share) {
    navigator.share({
      url: url,
      title: title,
      text: shareText
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(shareText + url).then(() => {
      alert('URL copiada al portapapeles');
    }).catch(console.error);
  }
}

// Upload dialog functionality
const uploadDialog = document.getElementById('uploadDialog');
const uploadPhotoBtns = document.getElementsByClassName('uploadPhotoBtn'); // Renombrado a plural para claridad
const closeUploadDialog = document.getElementById('closeUploadDialog');

// Solo si existe el diálogo de subida
if (uploadDialog) {
  // Iterar sobre todos los botones con la clase 'uploadPhotoBtn'
  for (let i = 0; i < uploadPhotoBtns.length; i++) {
    uploadPhotoBtns[i].addEventListener('click', (e) => {
      e.preventDefault();
      uploadDialog.classList.remove('hidden');
      uploadDialog.classList.add('flex');
    });
  }

  // Listener para cerrar con el botón de cerrar
  if (closeUploadDialog) {
    closeUploadDialog.addEventListener('click', () => {
      uploadDialog.classList.add('hidden');
      uploadDialog.classList.remove('flex');
    });
  }

  // Añadir funcionalidad para cerrar el diálogo haciendo clic fuera de él
  uploadDialog.addEventListener('click', (e) => {
    // Si el clic fue directamente sobre el fondo del diálogo (no en sus hijos)
    if (e.target === uploadDialog) {
      uploadDialog.classList.add('hidden');
      uploadDialog.classList.remove('flex');
    }
  });

  // Evitar que el clic dentro del contenido del diálogo lo cierre
  const uploadDialogContent = uploadDialog.querySelector('div'); // Asumiendo que el contenido está en un div
  if (uploadDialogContent) {
    uploadDialogContent.addEventListener('click', (e) => {
      e.stopPropagation(); // Detiene la propagación del evento al contenedor padre (uploadDialog)
    });
  }
}

// On page load, check both tag and photo ID
window.addEventListener('load', () => {
    const tagParam = urlParams.get('tag');
    const elementParam = urlParams.get('element');
    const photoIdFromUrl = getPhotoIdFromUrl();
    
    // Apply tag or element filter first if present
    if (elementParam) {
        filterByElement(elementParam);
    } else if (tagParam) {
        filterByTag(new Event('click'), tagParam);
    }
    
    // Then wait a bit for photos to load and open lightbox if needed
    if (photoIdFromUrl) {
        setTimeout(() => {
            const photoCard = document.querySelector(`[data-photo-id="${photoIdFromUrl}"]`);
            if (photoCard) {
                const imgSrc = photoCard.querySelector('img').dataset.src;
                const data = {
                    description: photoCard.dataset.description,
                    author: photoCard.querySelector('.font-medium').textContent.trim(),
                    date: photoCard.querySelector('.text-xs').dataset.originalDate,
                    path: imgSrc
                };
                openLightbox(imgSrc, data);
            }
        }, 500);
    }
});

// Delegación de eventos para enlaces de hashtags

document.addEventListener('click', function(e) {
  const tagLink = e.target.closest('a.tag-link');
  if (tagLink) {
    e.preventDefault();
    const tag = tagLink.dataset.tag;
    filterByTag(e, tag);
  }
});

// Delegación de eventos para botones de compartir foto

document.addEventListener('click', function(e) {
  // Detener propagación en clicks dentro de .actions
  const actionsDiv = e.target.closest('.actions');
  if (actionsDiv && actionsDiv.contains(e.target)) {
    e.stopPropagation();
  }

  // Compartir foto
  const shareBtn = e.target.closest('button.share-button');
  if (shareBtn) {
    e.preventDefault();
    const telegramId = shareBtn.dataset.telegramId;
    const description = decodeURIComponent(shareBtn.dataset.description || '');
    sharePhoto(telegramId, description);
  }
});

// Event listeners migrados desde onclick inline

// Compartir general (varios botones)
const shareGeneralBtn1 = document.getElementById('shareGeneralBtn1');
if (shareGeneralBtn1) shareGeneralBtn1.addEventListener('click', shareGeneral);
const shareGeneralBtn2 = document.getElementById('shareGeneralBtn2');
if (shareGeneralBtn2) shareGeneralBtn2.addEventListener('click', shareGeneral);

// Compartir colección de tags
const shareTagCollectionBtn = document.getElementById('shareTagCollectionBtn');
if (shareTagCollectionBtn) shareTagCollectionBtn.addEventListener('click', shareTagCollection);

// Limpiar filtro de tag
const clearTagFilterBtn = document.getElementById('clearTagFilterBtn');
if (clearTagFilterBtn) clearTagFilterBtn.addEventListener('click', clearTagFilter);

// Limpiar búsqueda
const clearSearchBtn = document.getElementById('clearSearchBtn');
if (clearSearchBtn) clearSearchBtn.addEventListener('click', clearSearch);

// Cerrar lightbox
const lightboxCloseBtn = document.getElementById('lightbox-close');
if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);

// Sidebar functionality
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');

function toggleSidebar() {
  if (!sidebar || !sidebarOverlay) return;
  sidebar.classList.toggle('active');
  sidebarOverlay.classList.toggle('active');
  document.body.classList.toggle('overflow-hidden');
  // Close dropdowns when closing sidebar
  if (!sidebar.classList.contains('active')) {
    if (dateDropdown) dateDropdown.classList.add('hidden');
    if (tagDropdown) tagDropdown.classList.add('hidden');
    if (dateDropdownButton) {
      const icon = dateDropdownButton.querySelector('.fa-chevron-down');
      if (icon) icon.style.transform = '';
    }
    if (tagDropdownButton) {
      const icon = tagDropdownButton.querySelector('.fa-chevron-down');
      if (icon) icon.style.transform = '';
    }
  }
}

if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
if (closeSidebar) closeSidebar.addEventListener('click', toggleSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

// Close sidebar with escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sidebar.classList.contains('active')) {
    toggleSidebar();
  }
});

// Dropdown functionality
const dateDropdownButton = document.getElementById('dateDropdownButton');
const tagDropdownButton = document.getElementById('tagDropdownButton');
const dateDropdown = document.getElementById('dateDropdown');
const tagDropdown = document.getElementById('tagDropdown');

// Definir dateDropdownOptions solo si existe dateDropdown
const dateDropdownOptions = dateDropdown ? dateDropdown.querySelectorAll('[data-filter]') : null;
// Definir tagDropdownOptions solo si existe tagDropdown
const tagDropdownOptions = tagDropdown ? tagDropdown.querySelectorAll('[data-filter]') : null;

function toggleDropdown(dropdown, button) {
  if (!dropdown || !button) return;
  const isOpen = dropdown.classList.contains('hidden');
  // Close other dropdown first
  if (dropdown === dateDropdown) {
    if (tagDropdown) tagDropdown.classList.add('hidden');
    if (tagDropdownButton) {
      const icon = tagDropdownButton.querySelector('.fa-chevron-down');
      if (icon) icon.style.transform = '';
    }
  } else {
    if (dateDropdown) dateDropdown.classList.add('hidden');
    if (dateDropdownButton) {
      const icon = dateDropdownButton.querySelector('.fa-chevron-down');
      if (icon) icon.style.transform = '';
    }
  }
  // Toggle current dropdown
  dropdown.classList.toggle('hidden');
  const icon = button.querySelector('.fa-chevron-down');
  if (icon) icon.style.transform = isOpen ? 'rotate(180deg)' : '';
}

if (dateDropdownButton && dateDropdown) {
  dateDropdownButton.addEventListener('click', () => toggleDropdown(dateDropdown, dateDropdownButton));
}

if (tagDropdownButton && tagDropdown) {
  tagDropdownButton.addEventListener('click', () => toggleDropdown(tagDropdown, tagDropdownButton));
}

if (dateDropdownOptions && dateDropdownOptions.forEach) {
  dateDropdownOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      if (dateDropdownButton && dateDropdown) {
        dateDropdownButton.textContent = e.target.textContent;
        dateDropdown.classList.add('hidden');
        // Reset chevron
        const icon = dateDropdownButton.querySelector('.fa-chevron-down');
        if (icon) icon.style.transform = '';
      }
    });
  });
}

if (tagDropdownOptions && tagDropdownOptions.forEach) {
  tagDropdownOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      if (tagDropdownButton && tagDropdown) {
        tagDropdownButton.textContent = e.target.textContent;
        tagDropdown.classList.add('hidden');
        // Reset chevron
        const icon = tagDropdownButton.querySelector('.fa-chevron-down');
        if (icon) icon.style.transform = '';
      }
    });
  });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!sidebar) return;
  if (sidebar.classList.contains('active')) {
    if (
      !sidebar.contains(e.target) &&
      (!menuToggle || !menuToggle.contains(e.target)) &&
      (!closeSidebar || !closeSidebar.contains(e.target))
    ) {
      toggleSidebar();
    }
  }
  // Close dropdowns if clicking outside
  if (
    dateDropdown &&
    !dateDropdown.contains(e.target) &&
    dateDropdownButton &&
    !dateDropdownButton.contains(e.target)
  ) {
    dateDropdown.classList.add('hidden');
    const icon = dateDropdownButton.querySelector('.fa-chevron-down');
    if (icon) icon.style.transform = '';
  }
  if (
    tagDropdown &&
    !tagDropdown.contains(e.target) &&
    tagDropdownButton &&
    !tagDropdownButton.contains(e.target)
  ) {
    tagDropdown.classList.add('hidden');
    const icon = tagDropdownButton.querySelector('.fa-chevron-down');
    if (icon) icon.style.transform = '';
  }
});

// Close sidebar on search
if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchPhotos(e.target.value);
      toggleSidebar();
    }
  });
}

// Update date filter to close sidebar
document.addEventListener('DOMContentLoaded', () => {
  const dateFilters = document.querySelectorAll('[data-filter]');
  dateFilters.forEach(button => {
    const originalClick = button.onclick;
    button.onclick = (e) => {
      if (originalClick) originalClick(e);
      toggleSidebar();
    };
  });
});

// Clear date filter
const clearDateFilterBtn = document.getElementById('clearDateFilterBtn');
if (clearDateFilterBtn) clearDateFilterBtn.addEventListener('click', () => {
  // Reset to all dates
  const allDatesBtn = document.querySelector('[data-filter="all"]');
  if (allDatesBtn) allDatesBtn.click();
  // Hide date filter indicator
  const dateFilter = document.getElementById('dateFilter');
  if (dateFilter) dateFilter.classList.add('hidden');
});

// --- Funciones para etiquetas/index.html y elementos/index.html ---

// Cargar etiquetas en etiquetas/index.html
async function loadTags() {
  try {
    const tagsList = document.getElementById('tags-list');
    if (!tagsList) return;
    const response = await fetch('/tags-cache.json');
    const data = await response.json();
    data.tags.forEach(({tag, count, latest_photos}) => {
      const tagEl = document.createElement('a');
      tagEl.href = `/?tag=${tag.substring(1)}`;
      tagEl.className = 'tag-card bg-white dark:bg-instagram-800 rounded-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5';
      tagEl.onclick = (e) => {
        e.preventDefault();
        window.location.href = tagEl.href;
      };
      // Collage de fotos
      const photoCollage = latest_photos.length > 0 
        ? `<div class=\"photo-collage\">\n${latest_photos.map(photo => `\n<img src=\"/files/${photo}\" loading=\"lazy\" class=\"opacity-60 transition-opacity duration-300\" alt=\"\">`).join('')}\n</div>`
        : '';
      tagEl.innerHTML = `
        <div class="p-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-lg font-medium text-instagram-600 dark:text-instagram-400">${tag}</span>
              <span class="ml-2 text-sm text-instagram-500">${count} foto${count !== 1 ? 's' : ''}</span>
            </div>
            <i class="fa-solid fa-chevron-right text-instagram-400"></i>
          </div>
        </div>
        ${photoCollage}
      `;
      tagsList.appendChild(tagEl);
    });
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

// Cargar elementos en elementos/index.html
async function loadElements() {
  try {
    const elementsList = document.getElementById('elements-list');
    if (!elementsList) return;
    const response = await fetch('/ai-tags-cache.json');
    const data = await response.json();
    data.tags.forEach(({tag, count, latest_photos}) => {
      const elementEl = document.createElement('a');
      elementEl.href = `/?element=${encodeURIComponent(tag)}`;
      elementEl.className = 'element-card bg-white dark:bg-instagram-800 rounded-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5';
      elementEl.onclick = (e) => {
        e.preventDefault();
        window.location.href = elementEl.href;
      };
      // Collage de fotos
      const photoCollage = latest_photos.length > 0 
        ? `<div class=\"photo-collage\">\n${latest_photos.map(photo => `\n<img src=\"/files/${photo}\" loading=\"lazy\" class=\"opacity-60 transition-opacity duration-300\" alt=\"\">`).join('')}\n</div>`
        : '';
      elementEl.innerHTML = `
        <div class="p-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-lg font-medium text-instagram-600 dark:text-instagram-400">${tag}</span>
              <span class="ml-2 text-sm text-instagram-500">${count} foto${count !== 1 ? 's' : ''}</span>
            </div>
            <i class="fa-solid fa-chevron-right text-instagram-400"></i>
          </div>
        </div>
        ${photoCollage}
      `;
      elementsList.appendChild(elementEl);
    });
  } catch (error) {
    console.error('Error loading elements:', error);
  }
}

// Ejecutar solo en la página correcta cuando el DOM esté listo

document.addEventListener('DOMContentLoaded', function () {
  // Scroll suave al top al hacer click en el h1
  var scrollTitle = document.getElementById('scrollTopTitle');
  if (scrollTitle) {
    scrollTitle.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (document.getElementById('tags-list')) {
    loadTags();
  }
  if (document.getElementById('elements-list')) {
    loadElements();
  }
});
