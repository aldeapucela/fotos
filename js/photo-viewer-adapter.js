(() => {
  function idFromPath(path = '') {
    return String(path).split('/').pop().replace(/\.(?:jpe?g|png|webp)$/i, '');
  }

  function toPhoto(data, src) {
    const id = idFromPath(data.path || src);
    return {
      id,
      src,
      filename: String(data.path || src).split('/').pop(),
      alt: data.ai_description || data.description || '',
      description: data.description || '',
      author: data.author || 'Anónimo',
      authorUrl: `https://t.me/AldeaPucela/27202/${encodeURIComponent(id)}`,
      date: data.date,
      social: data.post_id ? {
        threadUrl: `https://bsky.app/profile/fotos.aldeapucela.org/post/${encodeURIComponent(data.post_id)}`,
        likeCount: data.like_count,
        commentCount: data.comment_count
      } : undefined
    };
  }

  function retireLegacyLightbox() {
    document.querySelectorAll('#lightbox, #editorialLightbox').forEach(legacy => {
      legacy.querySelectorAll('[id]').forEach(node => { node.id = `legacy-${node.id}`; });
      legacy.id = 'legacy-lightbox';
      legacy.hidden = true;
      legacy.classList.remove('active', 'is-open');
    });
  }

  retireLegacyLightbox();

  if (document.body.dataset.galleryView === 'recent') {
    window.openLightbox = function openSharedRecentLightbox(imgSrc, data) {
      const cards = Array.from(document.querySelectorAll('.photo-card:not(.hidden)'))
        .filter(card => card._photoData && card._photoPath)
        .map(card => toPhoto(card._photoData, card._photoPath));
      const index = cards.findIndex(photo => photo.src === imgSrc);
      window.galleryPhotoLightbox.open(cards, Math.max(index, 0));
    };
  }

  if (document.body.dataset.galleryView === 'popular') {
    window.openPopularLightbox = function openSharedPopularLightbox(photo) {
      const items = Array.from(document.querySelectorAll('.photo-card'))
        .filter(card => card._photoData)
        .map(card => toPhoto(card._photoData, `/files/${card._photoData.path}`));
      const activeId = idFromPath(photo.path);
      const index = items.findIndex(item => item.id === activeId);
      window.galleryPhotoLightbox.open(items, Math.max(index, 0));
    };
  }

  window.openEditorialGalleryLightbox = function openSharedEditorialLightbox(photos, index) {
    const items = photos.map(photo => toPhoto(photo, `/files/${encodeURIComponent(photo.path)}`));
    window.galleryPhotoLightbox.open(items, index);
  };
})();
