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
      if (description.includes(searchTerm)) {
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
    contenido.innerHTML = `<div class="text-center py-20 text-instagram-500">No hay fotos que contengan "${text}"</div>`;
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
function convertHashtagsToLinks(text) {
  if (!text) return '';
  return text.replace(/#(\w+)/g, (match, tag) => {
    const normalizedTag = tag.toLowerCase();
    return `<a href="?tag=${normalizedTag}" class="text-instagram-600 dark:text-instagram-400 hover:underline" onclick="filterByTag(event, '${normalizedTag}')">#${tag}</a>`;
  });
}

// Filter photos by tag
function filterByTag(event, tag) {
  event.preventDefault();
  event.stopPropagation();
  
  // Close lightbox if open
  closeLightbox();
  
  const normalizedTag = tag.toLowerCase();
  
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
      if (description.includes('#' + normalizedTag)) {
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
    contenido.innerHTML = `<div class="text-center py-20 text-instagram-500">No hay fotos con la etiqueta #${tag}</div>`;
  }

  // Show tag filter indicator
  const tagFilter = document.getElementById('tagFilter');
  const tagName = document.getElementById('tagName');
  tagName.textContent = `#${tag}`;
  tagFilter.classList.remove('hidden');
}

// Clear tag filter
function clearTagFilter() {
  const url = new URL(window.location);
  url.searchParams.delete('tag');
  window.history.pushState({}, '', url);
  
  document.querySelectorAll('.date-group, .photo-card').forEach(el => {
    el.classList.remove('hidden');
  });

  // Hide tag filter indicator and title
  document.getElementById('tagFilter').classList.add('hidden');
  document.getElementById('tagTitle').classList.add('hidden');
}

// DOM Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxDesc = document.getElementById('lightbox-desc');
const lightboxAutor = document.getElementById('lightbox-autor').querySelector('span');
const lightboxFecha = document.getElementById('lightbox-fecha').querySelector('span');
const lightboxLicense = document.getElementById('lightbox-license');
const filterToggle = document.getElementById('filterToggle');
const dateFilterBar = document.getElementById('dateFilterBar');
const tagsFilterBar = document.getElementById('tagsFilterBar');
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');
const contenidoEl = document.getElementById('contenido');
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

// Toggle filter bars
filterToggle.addEventListener('click', () => {
  dateFilterBar.classList.toggle('hidden');
  tagsFilterBar.classList.toggle('hidden');
});

// Toggle view modes (grid vs list)
gridViewBtn.addEventListener('click', () => {
  contenidoEl.classList.remove('list-view');
  gridViewBtn.classList.add('view-toggle-active');
  listViewBtn.classList.remove('view-toggle-active');
});

listViewBtn.addEventListener('click', () => {
  contenidoEl.classList.add('list-view');
  listViewBtn.classList.add('view-toggle-active');
  gridViewBtn.classList.remove('view-toggle-active');
});

// Open lightbox with photo details
function openLightbox(imgSrc, data) {
  // Get all visible photos for navigation
  visiblePhotos = Array.from(document.querySelectorAll('.photo-card:not(.hidden)')).map(card => ({
    path: card.querySelector('img').dataset.src,
    data: {
      description: card.dataset.description,
      author: card.querySelector('.font-medium').textContent.trim(),
      date: card.querySelector('.text-xs').dataset.originalDate, // Use original date from data attribute
      path: card.querySelector('img').dataset.src
    }
  }));
  
  // Find current photo index
  currentPhotoIndex = visiblePhotos.findIndex(photo => photo.path === imgSrc);
  
  // Update navigation buttons
  updateNavigationButtons();
  
  lightboxImg.src = imgSrc;
  lightboxDesc.innerHTML = data.description ? convertHashtagsToLinks(data.description) : '';

  // Create Telegram URL
  const filename = data.path.split('/').pop();
  const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
  const telegramUrl = `https://t.me/AldeaPucela/27202/${telegramId}`;
  updateUrl(telegramId);
  
  // Set author name with link to Telegram
  const lightboxAutorDiv = document.getElementById('lightbox-autor');
  lightboxAutorDiv.innerHTML = `
    <i class="fa-regular fa-user mr-2"></i>
    <a href="${telegramUrl}" target="_blank" class="hover:text-instagram-700">${data.author}</a>
  `;
  
  // Set download link  
  const downloadLink = document.getElementById('lightbox-download');
  downloadLink.href = imgSrc;
  downloadLink.download = data.path.split('/').pop();
  
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
  
  // Add license without "Ver original" link
  lightboxLicense.innerHTML = `
    <a class="text-instagram-500 hover:text-instagram-700" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank">CC BY-SA 4.0</a>
  `;
  
  const shareButton = document.getElementById('lightbox-share');
  shareButton.onclick = (e) => {
    e.stopPropagation();
    sharePhoto(telegramId, data.description);
  };

  // Update chat and download links
  const chatLink = document.getElementById('lightbox-chat');
  chatLink.href = telegramUrl;
  const downloadButton = document.getElementById('lightbox-download');
  downloadButton.href = imgSrc;
  downloadButton.download = data.path.split('/').pop();

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
document.getElementById('prevPhoto').addEventListener('click', (e) => {
  e.stopPropagation();
  showPrevPhoto();
});

document.getElementById('nextPhoto').addEventListener('click', (e) => {
  e.stopPropagation();
  showNextPhoto();
});

// Update keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  
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

// Close lightbox
function closeLightbox() {
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
  updateUrl('');
  setTimeout(() => {
    lightboxImg.src = '';
  }, 300);
}

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
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
initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` }).then(async SQL => {
  try {
    const response = await fetch('fotos.db');
    const buffer = await response.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buffer));
    
    // Load tags from cache
    const tagsResponse = await fetch('tags-cache.json');
    const tagsData = await tagsResponse.json();
    
    // Add tags to the filter bar
    const tagsFilterBar = document.querySelector('#tagsFilterBar > div');
    tagsData.tags.forEach(({tag}) => {
      const tagBtn = document.createElement('button');
      tagBtn.className = 'py-1 px-2 text-sm font-medium text-instagram-500 hover:text-instagram-600';
      tagBtn.dataset.tag = tag.substring(1); // Remove # from tag
      tagBtn.textContent = tag;
      tagBtn.onclick = (e) => {
        e.preventDefault();
        filterByTag(e, tag.substring(1));
      };
      tagsFilterBar.appendChild(tagBtn);
    });

    // Continue with existing query for photos
    const res = db.exec("SELECT *, date(date) as fecha_grupo FROM imagenes ORDER BY date DESC");
    
    const contenido = document.getElementById('contenido');
    contenido.innerHTML = '';

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
      
      // Process data and group by date
      const grupos = rows.reduce((acc, row) => {
        const data = Object.fromEntries(cols.map((col, i) => [col, row[i]]));
        const fecha = data.fecha_grupo;
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(data);
        return acc;
      }, {});

      // Add date filters to the filter bar
      const dateFilters = document.querySelector('#dateFilterBar > div');
      Object.keys(grupos).forEach(fecha => {
        const dateBtn = document.createElement('button');
        dateBtn.className = 'py-1 px-2 text-sm font-medium';
        dateBtn.dataset.filter = fecha;
        dateBtn.textContent = new Date(fecha).toLocaleDateString('es', {
          day: 'numeric',
          month: 'short'
        });
        dateFilters.appendChild(dateBtn);
      });

      // Date filter functionality
      const filterButtons = document.querySelectorAll('#dateFilterBar button');
      filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          // Update active state
          filterButtons.forEach(b => b.classList.remove('date-filter-active'));
          btn.classList.add('date-filter-active');
          
          // Filter content
          const filter = btn.dataset.filter;
          document.querySelectorAll('.date-group').forEach(group => {
            if (filter === 'all' || group.dataset.date === filter) {
              group.classList.remove('hidden');
            } else {
              group.classList.add('hidden');
            }
          });
        });
      });

      // Create observer for lazy loading
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.onload = () => img.classList.add('opacity-100');
            observer.unobserve(img);
          }
        });
      }, {
        rootMargin: '100px 0px',
        threshold: 0.1
      });

      // Render photo groups by date
      Object.entries(grupos).forEach(([fecha, fotos]) => {
        const grupo = document.createElement('div');
        grupo.className = 'date-group mb-8';
        grupo.dataset.date = fecha;
        
        // Date header
        const fechaHeader = document.createElement('div');
        fechaHeader.className = 'sticky top-[60px] bg-white/90 dark:bg-instagram-800/90 backdrop-blur-sm py-2 px-4 mb-4 font-medium text-sm border-b border-instagram-200 dark:border-instagram-700 z-10';
        fechaHeader.textContent = new Date(fecha).toLocaleDateString('es', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Photo grid
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-4 px-2';

        // Create photo cards
        fotos.forEach(data => {
          const item = document.createElement('div');
          item.className = 'photo-card bg-white dark:bg-instagram-800 rounded-sm shadow-sm overflow-hidden transform transition-transform hover:shadow-md active:scale-[0.98] cursor-pointer';
          
          // Extract filename to create Telegram link
          const filename = data.path;
          const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
          
          // Add dataset attributes for finding photos by ID
          item.dataset.photoId = telegramId;
          item.dataset.description = data.description || '';
          
          // Update the path to point to files directory
          const fullPath = getImagePath(data.path);
          data.path = fullPath;
          
          item.onclick = () => openLightbox(fullPath, data);
          
          const telegramUrl = `https://t.me/AldeaPucela/27202/${telegramId}`;
          
          // Store photo data if it matches URL
          if (photoIdFromUrl === telegramId) {
            photoToOpen = { path: fullPath, data };
          }

          // Simple grid photo layout with details only shown in list view
          item.innerHTML = `
            <div class="photo-card-image relative pb-[100%] bg-instagram-100 dark:bg-instagram-700">
              <img data-src="${fullPath}" alt="${data.description || ''}" 
                   class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300">
            </div>
            <div class="photo-details p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-sm flex items-center">
                  <i class="fa-regular fa-user text-instagram-400 mr-2"></i>
                  <a href="${telegramUrl}" target="_blank" class="hover:text-instagram-700">${data.author}</a>
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
              ${data.description ? `<p class="text-sm text-instagram-500 line-clamp-2">${convertHashtagsToLinks(data.description)}</p>` : ''}
              <div class="mt-2 flex justify-between items-center text-instagram-400 text-lg">
                <div class="actions" onclick="event.stopPropagation()">
                  <button type="button" class="share-button hover:text-instagram-600 mr-3" 
                          onclick="sharePhoto('${telegramId}', '${data.description?.replace(/'/g, "\\'")}')" 
                          title="Compartir">
                    <i class="fa-solid fa-share-nodes"></i>
                  </button>
                  <a href="${fullPath}" download class="text-instagram-500 hover:text-instagram-700 mr-3" title="Descargar foto">
                    <i class="fa-solid fa-download"></i>
                  </a>
                  <a href="${telegramUrl}" target="_blank" class="text-instagram-500 hover:text-instagram-700" title="Comentar en Telegram">
                    <i class="fa-regular fa-comment"></i>
                  </a>
                </div>
                <a class="text-xs text-instagram-400 hover:text-instagram-700" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank">CC BY-SA 4.0</a>
              </div>
            </div>`;

          // Observe image for lazy loading
          const img = item.querySelector('img');
          imageObserver.observe(img);
          
          grid.appendChild(item);
        });

        grupo.appendChild(fechaHeader);
        grupo.appendChild(grid);
        contenido.appendChild(grupo);
      });

      // Check URL parameters and handle based on order:
      // 1. First apply tag filter if present
      const tagParam = urlParams.get('tag');
      if (tagParam) {
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
      contenido.innerHTML = '<div class="text-center py-20 text-instagram-500">No hay fotos para mostrar</div>';
    }
  } catch (error) {
    console.error('Error al cargar la galería:', error);
    contenido.innerHTML = '<div class="text-center py-20 text-instagram-500">Error al cargar la galería</div>';
  }
});

// Handle lightbox gestures
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

// Close lightbox when clicking outside the content
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
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
  if (!tag) return;
  
  const url = `${window.location.origin}${window.location.pathname}?tag=${tag}`;
  const shareText = `Mira esta colección de fotos de Valladolid de #${tag} en Aldea Pucela\n\n`;

  if (navigator.share) {
    navigator.share({
      url: url,
      title: `Fotos con #${tag} - Aldea Pucela`,
      text: shareText
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(shareText + url).then(() => {
      alert('URL copiada al portapapeles');
    }).catch(console.error);
  }
}

// Search bar toggle
const searchToggle = document.getElementById('searchToggle');
const searchBar = document.getElementById('searchBar');

searchToggle.addEventListener('click', () => {
  searchBar.classList.toggle('hidden');
  if (!searchBar.classList.contains('hidden')) {
    searchInput.focus();
  }
});

// Close search bar when clicking outside
document.addEventListener('click', (e) => {
  if (!searchBar.classList.contains('hidden') && 
      !searchBar.contains(e.target) && 
      !searchToggle.contains(e.target)) {
    searchBar.classList.add('hidden');
  }
});

// Upload dialog functionality
const uploadDialog = document.getElementById('uploadDialog');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const closeUploadDialog = document.getElementById('closeUploadDialog');

uploadPhotoBtn.addEventListener('click', (e) => {
  e.preventDefault();
  uploadDialog.classList.remove('hidden');
  uploadDialog.classList.add('flex');
});

closeUploadDialog.addEventListener('click', () => {
  uploadDialog.classList.remove('flex');
  uploadDialog.classList.add('hidden');
});

// Close dialog when clicking outside
uploadDialog.addEventListener('click', (e) => {
  if (e.target === uploadDialog) {
    uploadDialog.classList.remove('flex');
    uploadDialog.classList.add('hidden');
  }
});

// On page load, check both tag and photo ID
window.addEventListener('load', () => {
    const tagParam = urlParams.get('tag');
    const photoIdFromUrl = getPhotoIdFromUrl();
    
    // Apply tag filter first if present
    if (tagParam) {
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