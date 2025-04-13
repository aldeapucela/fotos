// URL handling functions
function getPhotoIdFromUrl() {
    const hash = window.location.hash;
    return hash ? hash.slice(1) : null;
}

function updateUrl(photoId) {
    if (photoId) {
        window.history.pushState(null, '', `#${photoId}`);
    } else {
        window.history.pushState(null, '', window.location.pathname);
    }
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
  lightboxImg.src = imgSrc;
  lightboxDesc.innerHTML = data.description ? convertHashtagsToLinks(data.description) : '';
  lightboxAutor.textContent = data.author;
  
  // Set download link
  const downloadLink = document.getElementById('lightbox-download');
  downloadLink.href = imgSrc;
  downloadLink.download = data.path.split('/').pop();
  
  // Format date nicely
  const photoDate = new Date(data.date);
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
  const filename = data.path.split('/').pop();
  const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
  const telegramUrl = `https://t.me/AldeaPucela/27202/${telegramId}`;
  updateUrl(telegramId);
  
  // Add license with link and Telegram original link
  lightboxLicense.innerHTML = `
    <div class="flex justify-between items-center">
      <a href="${telegramUrl}" target="_blank" class="text-instagram-500 hover:text-instagram-700">
        <i class="fa-brands fa-telegram mr-1"></i> Ver original
      </a>
      <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank">
        <i class="fa-brands fa-creative-commons mr-1"></i>
        <i class="fa-brands fa-creative-commons-by mr-1"></i>
        <i class="fa-brands fa-creative-commons-sa mr-1"></i>
        CC BY-SA 4.0
      </a>
    </div>
  `;
  
  const shareButton = document.getElementById('lightbox-share');
  shareButton.onclick = (e) => {
    e.stopPropagation();
    sharePhoto(window.location.href, data.description);
  };

  const downloadButton = document.getElementById('lightbox-download');
  downloadButton.href = imgSrc;
  
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

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
        const data = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
        data.path = getImagePath(data.path); // Update path to use /files/
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
          item.className = 'photo-card bg-white dark:bg-instagram-800 rounded-lg shadow-sm overflow-hidden transform transition-transform hover:shadow-md active:scale-[0.98]';
          item.onclick = () => openLightbox(data.path, data);
          item.dataset.description = data.description || '';
          
          // Extract filename to create Telegram link
          const filename = data.path.split('/').pop();
          const telegramId = filename.replace('.jpg', '').replace('.png', '').replace('.jpeg', '');
          const telegramUrl = `https://t.me/AldeaPucela/27202/${telegramId}`;
          
          // Store photo data if it matches URL
          if (photoIdFromUrl === telegramId) {
            photoToOpen = { path: data.path, data };
          }

          // Simple grid photo layout with details only shown in list view
          item.innerHTML = `
            <div class="photo-card-image relative pb-[100%] bg-instagram-100 dark:bg-instagram-700">
              <img data-src="${data.path}" alt="${data.description || ''}" 
                   class="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-300">
            </div>
            <div class="photo-details p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-sm flex items-center">
                  <i class="fa-regular fa-user text-instagram-400 mr-2"></i>
                  ${data.author}
                </div>
                <div class="text-xs text-instagram-500">
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
                          onclick="sharePhoto('${window.location.origin}${window.location.pathname}#${telegramId}')" 
                          title="Compartir">
                    <i class="fa-solid fa-share-nodes"></i>
                  </button>
                  <a href="${data.path}" download class="text-instagram-500 hover:text-instagram-700 mr-3" title="Descargar foto">
                    <i class="fa-solid fa-download"></i>
                  </a>
                  <a href="${telegramUrl}" target="_blank" class="text-instagram-500 hover:text-instagram-700" title="Ver original en Telegram">
                    <i class="fa-brands fa-telegram"></i>
                  </a>
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

      // Open photo if direct URL was used
      if (photoToOpen) {
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
let startY;
lightbox.addEventListener('touchstart', (e) => {
  startY = e.touches[0].clientY;
});

lightbox.addEventListener('touchmove', (e) => {
  const currentY = e.touches[0].clientY;
  const diff = currentY - startY;
  if (Math.abs(diff) > 100) {
    closeLightbox();
  }
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

// Add share functionality
function sharePhoto(url, description = '') {
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
  const shareText = `Mira esta colección de fotos de Valladolid con #${tag} en Aldea Pucela\n\n`;

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