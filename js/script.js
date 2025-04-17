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
  return text.replace(/#([áéíóúüñÁÉÍÓÚÜÑa-zA-Z0-9_]+)/g, (match, tag) => {
    const normalizedTag = tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return `<a href="?tag=${normalizedTag}" class="text-instagram-600 dark:text-instagram-400 hover:underline" onclick="filterByTag(event, '${normalizedTag}')">${match}</a>`;
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
    contenido.innerHTML = `<div class="text-center py-20 text-instagram-500">No hay fotos con la etiqueta #${tag}</div>`;
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
    contenido.innerHTML = `<div class="text-center py-20 text-instagram-500">No hay fotos que contengan el elemento "${element}"</div>`;
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
const lightboxAutor = document.getElementById('lightbox-autor').querySelector('span');
const lightboxFecha = document.getElementById('lightbox-fecha').querySelector('span');
const lightboxLicense = document.getElementById('lightbox-license');
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

  lightboxDesc.innerHTML = data.description ? convertHashtagsToLinks(data.description) : '';

  // Create Telegram URL
  const filename = data.path?.split('/').pop() || '';
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

      // Add date filters to the date dropdown
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

        Object.keys(grupos).forEach(fecha => {
          const dateBtn = document.createElement('button');
          dateBtn.className = 'w-full text-left py-1.5 px-3 text-sm rounded hover:bg-instagram-100 dark:hover:bg-instagram-600 text-instagram-500';
          dateBtn.dataset.filter = fecha;
          dateBtn.textContent = new Date(fecha).toLocaleDateString('es', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
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
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 sm:gap-1 px-2';

        // Create photo cards
        fotos.forEach(data => {
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
              <img data-src="${fullPath}" alt="${data.ai_description || data.description || ''}" 
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
                  ${isAppropriate ? `
                    <a href="${fullPath}" download class="text-instagram-500 hover:text-instagram-700 mr-3" title="Descargar foto">
                      <i class="fa-solid fa-download"></i>
                    </a>
                  ` : ''}
                  <a href="${telegramUrl}" target="_blank" class="text-instagram-500 hover:text-instagram-700" title="Comentar en Telegram">
                    <i class="fa-regular fa-comment"></i>
                  </a>
                </div>
                <a class="text-xs text-instagram-400 hover:text-instagram-700" href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank">CC BY-SA 4.0</a>
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
        contenido.appendChild(grupo);
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

// Sidebar functionality
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const menuToggle = document.getElementById('menuToggle');
const closeSidebar = document.getElementById('closeSidebar');

function toggleSidebar() {
  sidebar.classList.toggle('active');
  sidebarOverlay.classList.toggle('active');
  document.body.classList.toggle('overflow-hidden');
  
  // Close dropdowns when closing sidebar
  if (!sidebar.classList.contains('active')) {
    dateDropdown.classList.add('hidden');
    tagDropdown.classList.add('hidden');
    dateDropdownButton.querySelector('.fa-chevron-down').style.transform = '';
    tagDropdownButton.querySelector('.fa-chevron-down').style.transform = '';
  }
}

menuToggle.addEventListener('click', toggleSidebar);
closeSidebar.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

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

function toggleDropdown(dropdown, button) {
  const isOpen = dropdown.classList.contains('hidden');
  
  // Close other dropdown first
  if (dropdown === dateDropdown) {
    tagDropdown.classList.add('hidden');
    tagDropdownButton.querySelector('.fa-chevron-down').style.transform = '';
  } else {
    dateDropdown.classList.add('hidden');
    dateDropdownButton.querySelector('.fa-chevron-down').style.transform = '';
  }
  
  // Toggle current dropdown
  dropdown.classList.toggle('hidden');
  button.querySelector('.fa-chevron-down').style.transform = isOpen ? 'rotate(180deg)' : '';
}

dateDropdownButton.addEventListener('click', () => toggleDropdown(dateDropdown, dateDropdownButton));
tagDropdownButton.addEventListener('click', () => toggleDropdown(tagDropdown, tagDropdownButton));

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!dateDropdownButton.contains(e.target) && !dateDropdown.contains(e.target)) {
    dateDropdown.classList.add('hidden');
    dateDropdownButton.querySelector('.fa-chevron-down').style.transform = '';
  }
  if (!tagDropdownButton.contains(e.target) && !tagDropdown.contains(e.target)) {
    tagDropdown.classList.add('hidden');
    tagDropdownButton.querySelector('.fa-chevron-down').style.transform = '';
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