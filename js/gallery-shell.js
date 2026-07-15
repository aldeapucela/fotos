(() => {
  const VIEW_STORAGE_KEY = 'aldea-fotos:view-mode';

  function getStoredViewMode() {
    try {
      const mode = window.localStorage.getItem(VIEW_STORAGE_KEY);
      return mode === 'list' ? 'list' : 'grid';
    } catch (error) {
      return 'grid';
    }
  }

  function setGalleryView(mode, { persist = true } = {}) {
    const selectedMode = mode === 'list' ? 'list' : 'grid';
    const content = document.getElementById('contenido');
    const gridButton = document.getElementById('gridViewBtn');
    const listButton = document.getElementById('listViewBtn');

    content?.classList.toggle('list-view', selectedMode === 'list');
    gridButton?.classList.toggle('view-toggle-active', selectedMode === 'grid');
    listButton?.classList.toggle('view-toggle-active', selectedMode === 'list');
    gridButton?.setAttribute('aria-pressed', String(selectedMode === 'grid'));
    listButton?.setAttribute('aria-pressed', String(selectedMode === 'list'));

    if (persist) {
      try {
        window.localStorage.setItem(VIEW_STORAGE_KEY, selectedMode);
      } catch (error) {
        // La galería sigue funcionando si el almacenamiento está deshabilitado.
      }
    }
  }

  function updateTotalPhotosCount(total) {
    const count = document.getElementById('totalPhotosCount');
    const fallback = document.getElementById('totalPhotosFallback');
    if (!count || !Number.isFinite(Number(total))) return;

    count.textContent = `${Number(total).toLocaleString('es-ES')} fotos`;
    fallback?.remove();
  }

  window.setGalleryView = setGalleryView;
  window.updateTotalPhotosCount = updateTotalPhotosCount;

  function keepFocusInside(container, event) {
    if (event.key !== 'Tab' || !container) return;
    const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')]
      .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function isOpen(element) {
    return Boolean(element && !element.hidden && (element.classList.contains('is-open') || element.classList.contains('flex')));
  }

  document.addEventListener('DOMContentLoaded', () => {
    setGalleryView(getStoredViewMode(), { persist: false });

    document.querySelectorAll('#scrollTopBrand, #scrollTopTitle').forEach(control => {
      control.addEventListener('click', event => {
        if (control.matches('a')) event.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    const searchToggle = document.getElementById('searchToggle');
    const menuToggle = document.getElementById('menuToggle');
    const searchInput = document.getElementById('searchInput');
    searchToggle?.addEventListener('click', event => {
      event.stopPropagation();
      menuToggle?.click();
      window.setTimeout(() => searchInput?.focus(), 180);
    });

    const dialog = document.getElementById('licenseInfoDialog');
    const openButton = document.getElementById('licenseInfoButton');
    const closeControls = dialog?.querySelectorAll('[data-license-close]') || [];
    const closeButton = dialog?.querySelector('.license-dialog-close');

    const closeDialog = () => {
      if (!dialog || dialog.hidden) return;
      dialog.classList.remove('is-open');
      window.setTimeout(() => {
        dialog.hidden = true;
        document.body.classList.remove('dialog-open');
        openButton?.focus();
      }, 160);
    };

    openButton?.addEventListener('click', () => {
      if (!dialog) return;
      dialog.hidden = false;
      document.body.classList.add('dialog-open');
      window.requestAnimationFrame(() => {
        dialog.classList.add('is-open');
        closeButton?.focus();
      });
    });

    closeControls.forEach(control => control.addEventListener('click', closeDialog));

    const uploadDialog = document.getElementById('uploadDialog');
    const uploadButtons = document.querySelectorAll('.uploadPhotoBtn');
    const uploadCloseControls = uploadDialog?.querySelectorAll('[data-upload-close]') || [];
    const uploadCloseButton = uploadDialog?.querySelector('#closeUploadDialog');
    const uploadTitle = uploadDialog?.querySelector('#uploadDialogTitle');
    const uploadPrompt = uploadDialog?.querySelector('#uploadDialogPrompt');
    const uploadContext = uploadDialog?.querySelector('#uploadDialogContext');
    const uploadTag = uploadDialog?.querySelector('#uploadDialogTag');
    const copyUploadTag = uploadDialog?.querySelector('#copyUploadTag');
    const copyUploadTagStatus = uploadDialog?.querySelector('#copyUploadTagStatus');
    const uploadTelegramLink = uploadDialog?.querySelector('#uploadTelegramLink') || uploadDialog?.querySelector('.upload-dialog-primary');
    const defaultUploadTitle = uploadTitle?.textContent || '';
    const defaultUploadPrompt = uploadPrompt?.textContent || '';
    let uploadTrigger = null;

    const closeUploadDialog = () => {
      if (!uploadDialog || uploadDialog.hidden) return;
      uploadDialog.classList.remove('is-open');
      window.setTimeout(() => {
        uploadDialog.hidden = true;
        document.body.classList.remove('dialog-open');
        uploadTrigger?.focus();
      }, 160);
    };

    uploadButtons.forEach(button => button.addEventListener('click', event => {
      if (!uploadDialog) return;
      event.preventDefault();
      uploadTrigger = event.currentTarget;
      const contextualTag = uploadTrigger.dataset.uploadTag || '';
      if (uploadTitle) uploadTitle.textContent = uploadTrigger.dataset.uploadTitle || defaultUploadTitle;
      if (uploadPrompt) uploadPrompt.textContent = uploadTrigger.dataset.uploadPrompt || defaultUploadPrompt;
      if (uploadContext) uploadContext.hidden = !contextualTag;
      if (uploadTag) uploadTag.textContent = contextualTag;
      if (copyUploadTagStatus) copyUploadTagStatus.textContent = '';
      window._paq = window._paq || [];
      window._paq.push(['trackEvent', 'Participación', 'Abrir diálogo', uploadTrigger.dataset.uploadCollection || 'general']);
      uploadDialog.hidden = false;
      document.body.classList.add('dialog-open');
      window.requestAnimationFrame(() => {
        uploadDialog.classList.add('is-open');
        uploadCloseButton?.focus();
      });
    }));

    copyUploadTag?.addEventListener('click', () => {
      const tag = uploadTag?.textContent?.trim();
      if (!tag) return;
      if (copyUploadTagStatus) copyUploadTagStatus.textContent = `${tag} copiada`;
      copyUploadTag.classList.add('is-copied');
      window.setTimeout(() => copyUploadTag.classList.remove('is-copied'), 1200);
      window._paq = window._paq || [];
      window._paq.push(['trackEvent', 'Participación', 'Copiar etiqueta', tag]);

      const copyPromise = navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(tag)
        : Promise.reject(new Error('Clipboard API no disponible'));
      copyPromise.catch(() => {
        if (copyUploadTagStatus) copyUploadTagStatus.textContent = `No se pudo copiar. Escribe ${tag} en tu mensaje.`;
      });
    });

    uploadTelegramLink?.addEventListener('click', () => {
      window._paq = window._paq || [];
      window._paq.push(['trackEvent', 'Participación', 'Abrir Telegram', uploadTrigger?.dataset.uploadCollection || 'general']);
    });

    uploadCloseControls.forEach(control => control.addEventListener('click', closeUploadDialog));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isOpen(dialog)) closeDialog();
      if (event.key === 'Escape' && isOpen(uploadDialog)) closeUploadDialog();
      if (isOpen(dialog)) keepFocusInside(dialog, event);
      if (isOpen(uploadDialog)) keepFocusInside(uploadDialog, event);
    });
  });
})();
