// =============================================================================
// MetaPulse Composer & Mockup Live Controller
// =============================================================================

const ComposerState = {
  mediaFiles: [], // Array de URLs locales/públicas
  selectedWatermarkId: null,
  activePreview: 'fb'
};

function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mp4|mov|webm|avi|m4v|mkv)$/i.test(clean);
}

function setInputValue(id, val = '') {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setElementDisplay(id, display = 'none') {
  const el = document.getElementById(id);
  if (el) el.style.display = display;
}

function setElementText(id, text = '') {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElementHtml(id, html = '') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setElementSrc(id, src = '') {
  const el = document.getElementById(id);
  if (el) el.src = src;
}

function setCheckboxState(id, checked = false) {
  const el = document.getElementById(id);
  if (el) el.checked = checked;
}

function renderCarouselSlideItem(s) {
  return `
    <div style="background:var(--bg-surface); padding:8px 10px; border-radius:4px; border-left:3px solid var(--primary); font-size:0.78rem;">
      <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--primary); margin-bottom:2px;">
        <span>Slide ${s.slideNumber}: ${s.headline || ''}</span>
      </div>
      <div style="color:var(--text-secondary); margin-bottom:3px;">${s.subtext || ''}</div>
      <div style="font-size:0.72rem; color:var(--text-muted); font-style:italic;">📸 Visual: ${s.visualIdea || ''}</div>
    </div>
  `;
}

function formatProductDetailsText(data) {
  if (!data) return '';
  const details = [];
  if (data.brand) details.push(`Marca: ${data.brand}`);
  if (data.origin) details.push(`Origen: ${data.origin}`);
  if (data.flavorNotes) details.push(`Notas de sabor: ${data.flavorNotes}`);
  if (data.description) details.push(data.description);
  return details.join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
  const postContent = document.getElementById('post-content');
  const postTitle = document.getElementById('post-title');
  const counterFb = document.getElementById('counter-fb');
  const counterIg = document.getElementById('counter-ig');
  const mediaDropzone = document.getElementById('media-dropzone');
  const mediaFileInput = document.getElementById('media-file-input');
  const mediaPreviewGrid = document.getElementById('media-preview-grid');
  const btnSubmitPost = document.getElementById('btn-submit-post');
  const btnSubmitText = document.getElementById('btn-submit-post-text');
  const btnClearComposer = document.getElementById('btn-clear-composer');
  const btnResetComposerTop = document.getElementById('btn-reset-composer-top');

  // Preview elements
  const mockFbText = document.getElementById('mock-fb-text');
  const mockIgText = document.getElementById('mock-ig-text');
  const mockStoryText = document.getElementById('mock-story-text');
  const mockFbMedia = document.getElementById('mock-fb-media');
  const mockIgMedia = document.getElementById('mock-ig-media');
  const mockStoryMedia = document.getElementById('mock-story-media');
  const mockFbName = document.getElementById('mock-fb-name');
  const mockIgName = document.getElementById('mock-ig-name');
  const mockIgNameBody = document.getElementById('mock-ig-name-body');
  const mockStoryName = document.getElementById('mock-story-name');

  // 1. Actualización de contadores de caracteres y vista previa en tiempo real
  function updateLivePreviews() {
    const text = postContent.value;
    const fbLen = text.length;
    const igLen = text.length;

    // Contadores
    counterFb.textContent = `FB: ${fbLen}`;
    counterIg.textContent = `IG: ${igLen} / 2200`;
    if (igLen > 2200) {
      counterIg.classList.add('text-rose');
    } else {
      counterIg.classList.remove('text-rose');
    }

    // Texto en maquetas
    const defaultText = 'Escribe tu texto en el composer para verlo aquí...';
    mockFbText.textContent = text || defaultText;
    mockIgText.textContent = text || defaultText;
    if (text) {
      mockStoryText.textContent = text;
      mockStoryText.style.display = 'block';
    } else {
      mockStoryText.style.display = 'none';
    }

    // Nombres de usuario en maquetas desde AppState
    const pageName = AppState.config.pageName || 'Mi Negocio / Página';
    const igUsername = AppState.config.instagramUsername || 'mi_cuenta_oficial';

    mockFbName.textContent = pageName;
    mockIgName.textContent = igUsername;
    mockIgNameBody.textContent = igUsername;
    mockStoryName.textContent = igUsername;

    // Actualización de Media en maquetas
    if (ComposerState.mediaFiles.length > 0) {
      const firstMedia = ComposerState.mediaFiles[0];
      const isVideo = isVideoUrl(firstMedia);

      const mediaHtml = isVideo
        ? `<video src="${firstMedia}" controls autoplay muted loop style="width:100%;height:100%;object-fit:cover;"></video>`
        : `<img src="${firstMedia}" alt="Preview">`;

      mockFbMedia.innerHTML = mediaHtml;
      mockIgMedia.innerHTML = mediaHtml;
      mockStoryMedia.innerHTML = mediaHtml;
    } else {
      mockFbMedia.innerHTML = '<div class="media-placeholder">Sin imagen seleccionada</div>';
      mockIgMedia.innerHTML = '<div class="media-placeholder">Sin imagen seleccionada</div>';
      mockStoryMedia.innerHTML = '<div class="media-placeholder">Imagen de Historia (9:16)</div>';
    }
  }

  window.updateComposerPreviews = updateLivePreviews;
  window.updateLivePreviews = updateLivePreviews;

  // 5. Pestañas de Vista Previa (Facebook / Instagram / Story)
  function switchPreviewTab(target) {
    document.querySelectorAll('.preview-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.preview === target);
    });
    document.querySelectorAll('.mockup').forEach(m => {
      m.classList.toggle('active', m.id === `mockup-${target}`);
    });
    ComposerState.activePreview = target;
  }

  // 6. Subida de Archivos Multimedia (Drag & Drop + Input)
  function buildUploadFormData(files) {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const activeAccountSelect = document.getElementById('global-account-select');
    if (activeAccountSelect?.value) {
      formData.append('account_id', activeAccountSelect.value);
      const opt = activeAccountSelect.options[activeAccountSelect.selectedIndex];
      if (opt) {
        formData.append('account_name', opt.dataset.name || '');
      }
    }
    return formData;
  }

  function applyUploadedMediaFiles(items) {
    items.forEach(item => ComposerState.mediaFiles.push(item.url));
    renderMediaPreviews();
    updateLivePreviews();
    if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
    if (window.loadMediaGallery) window.loadMediaGallery();
    const wmBtn = document.getElementById('btn-watermark-overlay');
    if (wmBtn) wmBtn.style.display = 'inline-flex';
    if (typeof window.syncStorySectionsVisibility === 'function') {
      window.syncStorySectionsVisibility();
    }
  }

  async function handleFileUpload(files) {
    const formData = buildUploadFormData(files);
    showToast('Subiendo archivo(s) multimedia...', 'info');

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (json.success && json.data) {
        applyUploadedMediaFiles(json.data);
        showToast('Archivos subidos correctamente', 'success');
      } else {
        showToast('Error subiendo media: ' + (json.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión al subir: ' + err.message, 'error');
    }
  }

  function handleComposerClipboardPaste(e) {
    const targetTag = e.target?.tagName?.toLowerCase();
    if (targetTag === 'textarea' || (targetTag === 'input' && e.target?.type !== 'file')) {
      const hasFiles = e.clipboardData?.files && e.clipboardData.files.length > 0;
      if (!hasFiles) return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      handleFileUpload(imageFiles);
      showToast('📋 Imagen pegada desde el portapapeles y cargada al Composer', 'success');
    }
  }

  function renderMediaPreviews() {
    mediaPreviewGrid.innerHTML = '';
    ComposerState.mediaFiles.forEach((url, idx) => {
      const isVideo = isVideoUrl(url);
      const div = document.createElement('div');
      div.className = 'media-preview-item';
      div.innerHTML = `
        ${isVideo ? `<video src="${url}"></video>` : `<img src="${url}" alt="media">`}
        <button class="media-remove-btn" title="Eliminar" data-index="${idx}">&times;</button>
      `;
      div.querySelector('.media-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        ComposerState.mediaFiles.splice(idx, 1);
        renderMediaPreviews();
        updateLivePreviews();
        if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
      });
      mediaPreviewGrid.appendChild(div);
    });
    if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
  }

  window.renderMediaPreviews = renderMediaPreviews;
  window.setComposerMedia = function(urls) {
    ComposerState.mediaFiles = Array.isArray(urls) ? [...urls] : [urls];
    renderMediaPreviews();
    updateLivePreviews();
    if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
  };

  // 6.b Generador Directo de Imágenes IA (Flux / Pollinations / Gemini)
  const chkUseAiImage = document.getElementById('chk-use-ai-image');
  const aiImageControls = document.getElementById('ai-image-controls');
  const btnTriggerDirectImage = document.getElementById('btn-trigger-direct-image');
  const aiImageFormatSelect = document.getElementById('ai-image-format-select');
  const chkUseBaseImage = document.getElementById('chk-use-base-image');
  const btnRedesignWithFlux = document.getElementById('btn-redesign-with-flux');
  const btnCreateAdPoster = document.getElementById('btn-create-ad-poster');
  const btnCampinaFlyerTrigger = document.getElementById('btn-campina-flyer-trigger');
  const btnKmarketDesignerTrigger = document.getElementById('btn-kmarket-designer-trigger');

  function updateBaseImageVisibility() {
    const hasMedia = ComposerState.mediaFiles.length > 0;
    const brand = (AppState.config?.pageName || '').toLowerCase();
    const isCampina = brand.includes('campiña') || brand.includes('cabaña');
    const isKmarket = brand.includes('kmarket');

    setElementDisplay('lbl-use-base-image', hasMedia ? 'flex' : 'none');
    if (chkUseBaseImage && hasMedia) chkUseBaseImage.checked = true;

    setElementDisplay('btn-campina-flyer-trigger', (hasMedia && isCampina) ? 'inline-flex' : 'none');
    setElementDisplay('btn-kmarket-designer-trigger', (hasMedia && isKmarket) ? 'inline-flex' : 'none');
    setElementDisplay('btn-create-ad-poster', (hasMedia && !isCampina && !isKmarket) ? 'inline-flex' : 'none');
    setElementDisplay('btn-watermark-overlay', 'inline-flex');
  }

  function buildDirectAiImagePayload(finalPrompt, baseImageUrl, format) {
    const isKmarket = (AppState.config?.pageName || '').toLowerCase().includes('kmarket');
    if (isKmarket && (baseImageUrl || finalPrompt)) {
      const productName = finalPrompt.length > 50 ? '' : finalPrompt;
      const scannedData = currentScannedProduct !== undefined ? currentScannedProduct : null;
      return {
        endpoint: '/api/ai/kmarket-designer-poster',
        payload: { baseImageUrl, productName, extraNotes: '', scannedData }
      };
    }
    return {
      endpoint: '/api/ai/generate-image',
      payload: {
        prompt: finalPrompt || 'Korean product advertising poster 4:5',
        format,
        model: 'gemini-3.1-flash-image',
        baseImageUrl
      }
    };
  }

  function resolveShouldUseBaseImage(forceUseBase) {
    if (forceUseBase !== null) return forceUseBase;
    return Boolean(chkUseBaseImage?.checked && ComposerState.mediaFiles.length > 0);
  }

  function setDirectImageButtonsLoading(loading, hasBase) {
    if (btnTriggerDirectImage) {
      btnTriggerDirectImage.disabled = loading;
      btnTriggerDirectImage.innerHTML = loading ? '⚡ Creando con Gemini Flash Lite...' : '✨ Generar Imagen Ahora';
    }
    if (btnRedesignWithFlux) {
      btnRedesignWithFlux.disabled = loading;
      btnRedesignWithFlux.textContent = loading ? '⚡ Rediseñando...' : '🎨 Rediseñar Foto';
    }
    if (loading) {
      showToast(hasBase ? 'Diseñando afiche publicitario con Gemini Flash Lite...' : 'Generando imagen con Gemini Flash Lite (Económico)...', 'info');
    }
  }

  async function generateDirectAiImage(customPrompt = '', forceUseBase = null) {
    const postTitleVal = document.getElementById('post-title')?.value || '';
    const postContentVal = document.getElementById('post-content')?.value || '';
    const format = aiImageFormatSelect?.value || 'feed';

    const finalPrompt = customPrompt || postTitleVal || postContentVal.slice(0, 120);
    if (!finalPrompt.trim() && ComposerState.mediaFiles.length === 0) {
      showToast('Escribe el título o producto de tu post, o sube una imagen de base', 'error');
      return;
    }

    const shouldUseBase = resolveShouldUseBaseImage(forceUseBase);
    const baseImageUrl = (shouldUseBase && ComposerState.mediaFiles.length > 0) ? ComposerState.mediaFiles[0] : null;

    setDirectImageButtonsLoading(true, Boolean(baseImageUrl));

    try {
      const { endpoint, payload } = buildDirectAiImagePayload(finalPrompt, baseImageUrl, format);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success && json.data?.url) {
        ComposerState.mediaFiles = [json.data.url];
        renderMediaPreviews();
        updateLivePreviews();
        updateBaseImageVisibility();

        const wmBtn = document.getElementById('btn-watermark-overlay');
        if (wmBtn) wmBtn.style.display = 'inline-flex';

        showToast('¡Afiche publicitario creado con éxito con tu Diseñador Senior!', 'success');
      } else {
        showToast('Error generando imagen: ' + (json.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error conectando con el generador: ' + err.message, 'error');
    } finally {
      setDirectImageButtonsLoading(false, false);
    }
  }

  window.generateDirectAiImage = generateDirectAiImage;

  function bindDirectAiControls() {
    const savedUseAi = localStorage.getItem('metapulse_use_flux_image') === 'true';
    if (chkUseAiImage) {
      chkUseAiImage.checked = savedUseAi;
      if (aiImageControls) aiImageControls.style.display = savedUseAi ? 'flex' : 'none';

      chkUseAiImage.addEventListener('change', () => {
        const active = chkUseAiImage.checked;
        localStorage.setItem('metapulse_use_flux_image', active ? 'true' : 'false');
        if (aiImageControls) aiImageControls.style.display = active ? 'flex' : 'none';
        if (active) {
          showToast('Generador de imágenes Gemini 3 Pro activado', 'info');
        }
      });
    }

    if (btnTriggerDirectImage) {
      btnTriggerDirectImage.addEventListener('click', () => {
        generateDirectAiImage();
      });
    }

    if (btnRedesignWithFlux) {
      btnRedesignWithFlux.addEventListener('click', () => {
        if (ComposerState.mediaFiles.length === 0) {
          showToast('Sube primero una imagen para usarla de base', 'error');
          return;
        }
        generateDirectAiImage('', true);
      });
    }

    if (btnCreateAdPoster) {
      btnCreateAdPoster.addEventListener('click', async () => {
        if (ComposerState.mediaFiles.length === 0) {
          showToast('Sube primero una foto para convertirla en póster', 'error');
          return;
        }

        const postTitleVal = document.getElementById('post-title')?.value.trim() || '';
        const postContentVal = document.getElementById('post-content')?.value.trim() || '';
        const currentImage = ComposerState.mediaFiles[0];

        btnCreateAdPoster.disabled = true;
        btnCreateAdPoster.textContent = '⚡ Creando Póster...';
        showToast('Generando diseño publicitario 4:5 con tipografía nítida...', 'info');

        try {
          let headline = postTitleVal;
          if (!headline && postContentVal) {
            const firstLine = postContentVal.split('\n')[0].replace(/[#*]/g, '').trim();
            headline = firstLine.slice(0, 35);
          }

          const res = await fetch('/api/media/create-ad-poster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imagePath: currentImage,
              headline: headline || 'PRODUCTO DESTACADO'
            })
          });

          const json = await res.json();
          if (json.success && json.data?.relativeUrl) {
            ComposerState.mediaFiles = [json.data.relativeUrl];
            renderMediaPreviews();
            updateLivePreviews();
            updateBaseImageVisibility();

            const wmBtn = document.getElementById('btn-watermark-overlay');
            if (wmBtn) wmBtn.style.display = 'inline-flex';

            showToast('¡Póster publicitario 4:5 creado con tipografía nítida en español!', 'success');
          } else {
            showToast('Error: ' + (json.error || 'No se pudo crear el póster'), 'error');
          }
        } catch (err) {
          showToast('Error creando póster: ' + err.message, 'error');
        } finally {
          btnCreateAdPoster.disabled = false;
          btnCreateAdPoster.textContent = '✨ Convertir a Póster Publicitario 4:5';
        }
      });
    }
  }

  // Flyer y Modales de Marca de Agua
  const modalCampinaFlyer = document.getElementById('modal-campina-flyer');
  const btnCloseCampinaFlyer = document.getElementById('btn-close-campina-flyer');
  const btnCancelCampinaFlyer = document.getElementById('btn-cancel-campina-flyer');
  const btnSubmitCampinaFlyer = document.getElementById('btn-submit-campina-flyer');
  const closeCampinaModal = () => { if (modalCampinaFlyer) modalCampinaFlyer.style.display = 'none'; };

  const modalKmarketDesigner = document.getElementById('modal-kmarket-designer');
  const btnCloseKmarketDesigner = document.getElementById('btn-close-kmarket-designer');
  const btnCancelKmarketDesigner = document.getElementById('btn-cancel-kmarket-designer');
  const btnSubmitKmarketDesigner = document.getElementById('btn-submit-kmarket-designer');
  const closeKmarketModal = () => { if (modalKmarketDesigner) modalKmarketDesigner.style.display = 'none'; };

  const btnWatermarkOverlay = document.getElementById('btn-watermark-overlay');
  const chkAlsoShareStory = document.getElementById('chk-also-share-story');
  const storyTimingBox = document.getElementById('story-timing-box');

  function bindFlyerAndWatermarkControls() {
    if (btnCloseCampinaFlyer) btnCloseCampinaFlyer.addEventListener('click', closeCampinaModal);
    if (btnCancelCampinaFlyer) btnCancelCampinaFlyer.addEventListener('click', closeCampinaModal);

    if (btnCampinaFlyerTrigger) {
      btnCampinaFlyerTrigger.addEventListener('click', () => {
        if (ComposerState.mediaFiles.length === 0) {
          showToast('Sube primero tu foto real de La Campiña para maquetar el flyer', 'error');
          return;
        }

        const postTitleVal = document.getElementById('post-title')?.value.trim();
        const postContentVal = document.getElementById('post-content')?.value.trim();
        const defaultHeadline = postTitleVal || (postContentVal ? postContentVal.split('\n')[0].replace(/[#*!¡]/g, '').trim().slice(0, 36) : 'TU DESCANSO EN LA NATURALEZA');

        const headlineInput = document.getElementById('campina-flyer-headline');
        if (headlineInput && !headlineInput.value) headlineInput.value = defaultHeadline.toUpperCase();

        modalCampinaFlyer.style.display = 'flex';
      });
    }

    if (btnSubmitCampinaFlyer) {
      btnSubmitCampinaFlyer.addEventListener('click', async () => {
        const currentImage = ComposerState.mediaFiles[0];
        if (!currentImage) {
          showToast('No hay imagen base seleccionada', 'error');
          return;
        }

        const headline = document.getElementById('campina-flyer-headline')?.value.trim();
        const subline = document.getElementById('campina-flyer-subline')?.value.trim();
        const badgeText = document.getElementById('campina-flyer-badge')?.value.trim();
        const style = document.getElementById('campina-flyer-style')?.value || 'editorial';

        btnSubmitCampinaFlyer.disabled = true;
        btnSubmitCampinaFlyer.textContent = '⚡ Maquetando Flyer...';

        try {
          const res = await fetch('/api/media/create-campina-flyer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imagePath: currentImage,
              headline,
              subline,
              badgeText,
              style
            })
          });

          const json = await res.json();
          if (json.success && json.data?.relativeUrl) {
            ComposerState.mediaFiles = [json.data.relativeUrl];
            renderMediaPreviews();
            updateLivePreviews();
            updateBaseImageVisibility();
            closeCampinaModal();
            showToast('¡Flyer editorial 4:5 creado con éxito sobre tu foto real! ($0)', 'success');
          } else {
            showToast('Error: ' + (json.error || 'No se pudo maquetar el flyer'), 'error');
          }
        } catch (err) {
          showToast('Error maquetando: ' + err.message, 'error');
        } finally {
          btnSubmitCampinaFlyer.disabled = false;
          btnSubmitCampinaFlyer.textContent = '🌲 Crear Flyer Editorial 4:5 ($0)';
        }
      });
    }

    if (btnCloseKmarketDesigner) btnCloseKmarketDesigner.addEventListener('click', closeKmarketModal);
    if (btnCancelKmarketDesigner) btnCancelKmarketDesigner.addEventListener('click', closeKmarketModal);

    if (btnKmarketDesignerTrigger) {
      btnKmarketDesignerTrigger.addEventListener('click', () => {
        if (ComposerState.mediaFiles.length === 0) {
          showToast('Sube primero la foto de referencia del producto de Kmarket', 'error');
          return;
        }

        const postTitleVal = document.getElementById('post-title')?.value.trim() || '';
        const prodNameInput = document.getElementById('kmarket-designer-prod-name');
        if (prodNameInput && !prodNameInput.value) prodNameInput.value = postTitleVal;

        modalKmarketDesigner.style.display = 'flex';
      });
    }

    if (btnSubmitKmarketDesigner) {
      btnSubmitKmarketDesigner.addEventListener('click', async () => {
        const currentImage = ComposerState.mediaFiles[0];
        const productName = document.getElementById('kmarket-designer-prod-name')?.value.trim();
        const extraNotes = document.getElementById('kmarket-designer-notes')?.value.trim();

        if (!productName) {
          showToast('Por favor escribe el nombre del producto', 'error');
          return;
        }

        btnSubmitKmarketDesigner.disabled = true;
        btnSubmitKmarketDesigner.textContent = '🎨 Diseñando Afiche con Gemini Flash Lite...';
        showToast('Enviando tu foto e instrucción a Gemini Flash Lite...', 'info');

        try {
          const res = await fetch('/api/ai/kmarket-designer-poster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              baseImageUrl: currentImage,
              productName,
              extraNotes
            })
          });

          const json = await res.json();
          if (json.success && json.data?.url) {
            ComposerState.mediaFiles = [json.data.url];
            renderMediaPreviews();
            updateLivePreviews();
            updateBaseImageVisibility();
            closeKmarketModal();
            showToast('¡Afiche publicitario 4:5 creado con éxito por el Diseñador Senior!', 'success');
          } else {
            showToast('Error: ' + (json.error || 'No se pudo generar la imagen'), 'error');
          }
        } catch (err) {
          showToast('Error conectando: ' + err.message, 'error');
        } finally {
          btnSubmitKmarketDesigner.disabled = false;
          btnSubmitKmarketDesigner.textContent = '🎨 Generar con Diseñador Senior (API Gemini)';
        }
      });
    }

    if (btnWatermarkOverlay) {
      btnWatermarkOverlay.addEventListener('click', () => {
        if (typeof window.openInteractiveStampModal === 'function') {
          window.openInteractiveStampModal();
        } else {
          const modal = document.getElementById('modal-interactive-stamp');
          if (modal) {
            modal.style.display = 'flex';
            modal.style.zIndex = '99999';
          }
        }
      });
    }

    if (chkAlsoShareStory && storyTimingBox) {
      chkAlsoShareStory.addEventListener('change', () => {
        storyTimingBox.style.display = chkAlsoShareStory.checked ? 'block' : 'none';
        if (typeof window.syncStorySectionsVisibility === 'function') {
          window.syncStorySectionsVisibility();
        }
      });
    }
  }

  function getSelectedPlatforms() {
    const platforms = [];
    if (document.getElementById('platform-fb')?.checked) platforms.push('facebook');
    if (document.getElementById('platform-ig')?.checked) platforms.push('instagram');
    return platforms;
  }

  function getStoryMusicPayload(postType) {
    if (!window.StoryMusicState?.enabled || !window.StoryMusicState?.selectedTrack) return null;
    return {
      audio_url: window.StoryMusicState.selectedTrack.streamUrl,
      start_time: window.StoryMusicState.startTime || 0,
      duration: window.StoryMusicState.duration || 15,
      add_music_sticker: (postType === 'story') ? Boolean(window.StoryMusicState.addSticker) : false,
      song_title: window.StoryMusicState.selectedTrack.title || '',
      song_artist: window.StoryMusicState.selectedTrack.artist || ''
    };
  }

  function buildPostSubmissionPayload() {
    const content = postContent.value.trim();
    const title = postTitle.value.trim();
    const platforms = getSelectedPlatforms();

    if (platforms.length === 0) {
      return { error: 'Debes seleccionar al menos una plataforma (Facebook o Instagram)' };
    }
    if (!content && ComposerState.mediaFiles.length === 0) {
      return { error: 'Escribe texto o sube una imagen/video para tu publicación' };
    }

    const postType = document.querySelector('input[name="post_type"]:checked')?.value || 'feed';
    const scheduleOption = document.querySelector('input[name="schedule_option"]:checked')?.value || 'next_slot';

    let customSchedule = null;
    if (scheduleOption === 'custom') {
      customSchedule = document.getElementById('custom-schedule-datetime')?.value;
      if (!customSchedule) {
        return { error: 'Selecciona la fecha y hora de publicación' };
      }
    }

    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const accountSelect = document.getElementById('global-account-select');
    const accountId = activeAcc?.pageId || accountSelect?.value || '';
    const accountName = activeAcc?.pageName || (accountSelect?.options[accountSelect?.selectedIndex]?.dataset?.name) || '';

    const alsoShareStory = Boolean(chkAlsoShareStory?.checked && postType !== 'story');
    const storyStrategy = document.querySelector('input[name="story_strategy"]:checked')?.value || 'single';
    const storyTimingRule = document.querySelector('input[name="story_schedule_timing"]:checked')?.value || 'same_time';
    const storyCustomDatetime = document.getElementById('story-custom-datetime')?.value || null;
    const chkMonthlyEl = document.getElementById('chk-story-monthly-extension');
    const storyMonthlyExtension = chkMonthlyEl ? Boolean(chkMonthlyEl.checked) : true;
    const musicConfigPayload = getStoryMusicPayload(postType);

    return {
      payload: {
        title,
        content,
        platforms,
        post_type: postType,
        media_urls: ComposerState.mediaFiles,
        schedule_type: scheduleOption,
        scheduled_at: customSchedule,
        accountId,
        accountName,
        also_share_story: alsoShareStory,
        story_strategy: storyStrategy,
        story_timing_rule: storyTimingRule,
        story_custom_datetime: storyCustomDatetime,
        story_monthly_extension: storyMonthlyExtension,
        music_config: (postType === 'story' || postType === 'feed') ? musicConfigPayload : null,
        story_music_config: alsoShareStory ? musicConfigPayload : null
      }
    };
  }

  function handlePostSubmissionSuccess(message) {
    showToast(message || '¡Publicación procesada con éxito!', 'success');
    resetComposerFormState();
    loadDashboardStatus();
    navigateToTab('queue');
  }

  async function handlePostSubmission() {
    const { payload, error } = buildPostSubmissionPayload();
    if (error) {
      showToast(error, 'error');
      return;
    }

    btnSubmitPost.disabled = true;
    showToast('Procesando solicitud de publicación...', 'info');

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (json.success) {
        handlePostSubmissionSuccess(json.message);
      } else {
        showToast('Error: ' + (json.error || 'No se pudo guardar la publicación'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión: ' + err.message, 'error');
    } finally {
      btnSubmitPost.disabled = false;
    }
  }

  // =========================================================================
  // REINICIO INTEGRAL DEL PROCESO: COMPOSER + ASISTENTE IA COPY
  // =========================================================================
  function resetAiModalState() {
    setInputValue('ai-topic', '');
    setInputValue('ai-tone', 'engaging');
    setInputValue('ai-goal', 'engagement');
    setInputValue('ai-custom-inst', '');

    setInputValue('carousel-topic', '');
    setInputValue('carousel-slides-count', '6');
    setInputValue('carousel-goal', 'saves');
    setElementHtml('carousel-results-box', '');
    setElementDisplay('carousel-results-box', 'none');

    setInputValue('humanize-input-text', '');
    setElementDisplay('humanize-audit-box', 'none');
    setInputValue('humanize-output-text', '');
    setElementHtml('humanize-issues-list', '');
    const humanizeScore = document.getElementById('humanize-score-badge');
    if (humanizeScore) {
      humanizeScore.textContent = '100/100';
      humanizeScore.style.background = 'var(--primary)';
    }

    setInputValue('kmarket-scan-file-input', '');
    setElementSrc('kmarket-scan-img', '');
    setElementDisplay('kmarket-scan-img', 'none');
    setElementDisplay('kmarket-scan-placeholder', 'block');
    setElementText('kmarket-scan-status', 'Sube la foto del empaque para investigar marca, ingredientes y notas de sabor.');
    setInputValue('kmarket-prod-name', '');
    setInputValue('kmarket-prod-desc', '');
    setElementDisplay('kmarket-image-prompt-box', 'none');
    setInputValue('kmarket-image-prompt-text', '');
    setElementDisplay('kmarket-ai-img-preview', 'none');
    setElementSrc('kmarket-ai-img-result', '');
    kmarketScannedImagePath = '';
    currentScannedProduct = null;

    setInputValue('campina-bg-file-input', '');
    setElementSrc('campina-bg-img', '');
    setElementDisplay('campina-bg-img', 'none');
    setElementDisplay('campina-bg-placeholder', 'block');
    setElementText('campina-bg-status', 'Adjunta la foto real que deseas usar como base para el afiche 4:5.');
    setCheckboxState('chk-campina-respect-bg', true);
    setElementDisplay('campina-extra-elements-wrap', 'none');
    setInputValue('campina-extra-elements', '');
    setInputValue('campina-format', 'reel');
    setInputValue('campina-date', '');
    setInputValue('campina-theme', '');
    setInputValue('campina-typography-style', 'auto');
    setInputValue('campina-brand-treatment', 'auto');
    setInputValue('campina-color-palette', 'auto');
    setInputValue('campina-poster-reference', 'auto');
    setElementDisplay('campina-art-analysis-card', 'none');
    setElementHtml('campina-art-analysis-text', '');
    setElementHtml('campina-art-vibe-tag', '');
    setElementDisplay('campina-slogan-alternatives-wrap', 'none');
    setElementHtml('campina-slogan-pills', '');
    setInputValue('campina-hero-headline', '');
    setInputValue('campina-subline-headline', '');
    setElementDisplay('campina-image-prompt-box', 'none');
    setInputValue('campina-image-prompt-text', '');
    setElementDisplay('campina-ai-img-preview', 'none');
    setElementSrc('campina-ai-img-result', '');
    campinaBackgroundImagePath = '';

    setInputValue('ai-generated-text', '');
    setElementDisplay('ai-result-box', 'none');
    setElementDisplay('btn-apply-ai-copy', 'none');

    const aiModalEl = document.getElementById('ai-modal');
    if (aiModalEl) {
      aiModalEl.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea').forEach(el => {
        el.value = '';
      });
      aiModalEl.style.display = 'none';
    }

    if (typeof switchAiModalTab === 'function') {
      const brand = (AppState.config?.pageName || '').toLowerCase();
      if (brand.includes('kmarket')) {
        switchAiModalTab('kmarket');
      } else if (brand.includes('campiña') || brand.includes('cabaña')) {
        switchAiModalTab('campina');
      } else {
        switchAiModalTab('general');
      }
    }
  }

  function resetComposerMediaState() {
    setInputValue('media-file-input', '');
    ComposerState.mediaFiles = [];
    ComposerState.selectedWatermarkId = null;
    renderMediaPreviews();

    setCheckboxState('chk-use-ai-image', false);
    setElementDisplay('ai-image-controls', 'none');
    setCheckboxState('chk-use-base-image', false);
    setElementDisplay('lbl-use-base-image', 'none');
    setInputValue('ai-image-format-select', 'feed');

    setElementDisplay('btn-watermark-overlay', 'inline-flex');
    setElementDisplay('btn-campina-flyer-trigger', 'none');
    setElementDisplay('btn-kmarket-designer-trigger', 'none');
    setElementDisplay('btn-create-ad-poster', 'none');
  }

  function resetComposerStoryState() {
    if (chkAlsoShareStory) chkAlsoShareStory.checked = false;
    if (storyTimingBox) storyTimingBox.style.display = 'none';
    const defaultStrat = document.querySelector('input[name="story_strategy"][value="single"]');
    if (defaultStrat) {
      defaultStrat.checked = true;
      defaultStrat.dispatchEvent(new Event('change'));
    }
    const defaultTiming = document.querySelector('input[name="story_schedule_timing"][value="same_time"]');
    if (defaultTiming) {
      defaultTiming.checked = true;
      defaultTiming.dispatchEvent(new Event('change'));
    }
    setInputValue('story-custom-datetime', '');
    setElementDisplay('story-custom-datetime-wrap', 'none');
    setCheckboxState('chk-story-monthly-extension', true);
  }

  function resetComposerMusicState() {
    if (typeof window.resetStoryMusic === 'function') {
      window.resetStoryMusic();
    } else {
      setCheckboxState('chk-story-music-enabled', false);
      setElementDisplay('story-music-drawer', 'none');
    }
    setInputValue('music-search-input', '');
    setInputValue('jamendo-search-input', '');
    setInputValue('story-audio-file-input', '');
    setInputValue('music-trim-slider', '0');
    setCheckboxState('chk-music-sticker', true);
    setElementDisplay('story-active-music-panel', 'none');
    setElementDisplay('story-video-success-box', 'none');
  }

  function resetComposerScheduleState() {
    const nextSlotRadio = document.querySelector('input[name="schedule_option"][value="next_slot"]');
    if (nextSlotRadio) {
      nextSlotRadio.checked = true;
      document.querySelectorAll('.schedule-radio').forEach(sr => {
        sr.classList.toggle('active', sr.querySelector('input')?.value === 'next_slot');
      });
    }
    setElementDisplay('custom-date-container', 'none');
    setInputValue('custom-schedule-datetime', '');
    if (btnSubmitText) btnSubmitText.textContent = 'Agendar en Próximo Slot';
    window._editingScheduledPostId = null;
  }

  function resetComposerFlyerModals() {
    if (typeof closeCampinaModal === 'function') closeCampinaModal();
    setInputValue('campina-flyer-headline', '');
    setInputValue('campina-flyer-subline', '');
    setInputValue('campina-flyer-badge', '');
    setInputValue('campina-flyer-style', 'editorial');

    if (typeof closeKmarketModal === 'function') closeKmarketModal();
    setInputValue('kmarket-designer-prod-name', '');
    setInputValue('kmarket-designer-notes', '');

    setElementDisplay('modal-interactive-stamp', 'none');
  }

  function resetComposerFormState() {
    setInputValue('post-content', '');
    setInputValue('post-title', '');

    setElementText('counter-fb', 'FB: 0');
    if (counterIg) {
      counterIg.textContent = 'IG: 0 / 2200';
      counterIg.classList.remove('text-rose');
    }

    const chkFb = document.getElementById('platform-fb');
    if (chkFb) {
      chkFb.checked = true;
      chkFb.closest('.platform-checkbox')?.classList.add('active');
    }
    const chkIg = document.getElementById('platform-ig');
    if (chkIg) {
      chkIg.checked = true;
      chkIg.closest('.platform-checkbox')?.classList.add('active');
    }

    const feedRadio = document.querySelector('input[name="post_type"][value="feed"]');
    if (feedRadio) {
      feedRadio.checked = true;
      document.querySelectorAll('.radio-pill').forEach(pill => {
        const inp = pill.querySelector('input[name="post_type"]');
        pill.classList.toggle('active', inp?.value === 'feed');
      });
    }

    resetComposerMediaState();
    resetComposerStoryState();
    resetComposerMusicState();
    resetComposerScheduleState();
    resetComposerFlyerModals();

    const composerPane = document.getElementById('tab-composer');
    if (composerPane) {
      composerPane.querySelectorAll('input[type="text"], input[type="datetime-local"], textarea').forEach(el => {
        el.value = '';
      });
    }

    switchPreviewTab('fb');
    updateLivePreviews();
    if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
    if (typeof window.syncStorySectionsVisibility === 'function') window.syncStorySectionsVisibility();
  }

  function resetComposerProcess(silent = false) {
    resetComposerFormState();
    resetAiModalState();
    if (!silent) {
      showToast('Proceso reiniciado: Composer y Asistente IA en blanco', 'info');
    }
  }

  window.resetComposerProcess = resetComposerProcess;
  window.resetAiModalState = resetAiModalState;
  window.resetComposerFormState = resetComposerFormState;

  function bindResetControls() {
    if (btnClearComposer) {
      btnClearComposer.addEventListener('click', () => {
        resetComposerProcess();
      });
    }
    if (btnResetComposerTop) {
      btnResetComposerTop.addEventListener('click', () => {
        resetComposerProcess();
      });
    }
    if (btnResetAiModal) {
      btnResetAiModal.addEventListener('click', () => {
        resetAiModalState();
        showToast('Asistente IA restablecido y en blanco', 'info');
      });
    }
  }

  // ==========================================
  // MODAL ASISTENTE IA & GENERADOR ESPECIALIZADO
  // ==========================================
  const aiModal = document.getElementById('ai-modal');
  const btnOpenAiModal = document.getElementById('btn-open-ai-modal');
  const btnCloseAiModal = document.getElementById('btn-close-ai-modal');
  const btnCancelAi = document.getElementById('btn-cancel-ai');
  const btnResetAiModal = document.getElementById('btn-reset-ai-modal');
  const btnGenerateAiCopy = document.getElementById('btn-generate-ai-copy');
  const btnGenerateKmarketAi = document.getElementById('btn-generate-kmarket-ai');
  const btnGenerateCampinaAi = document.getElementById('btn-generate-campina-ai');
  const aiGeneratedText = document.getElementById('ai-generated-text');
  const btnApplyAiCopy = document.getElementById('btn-apply-ai-copy');
  const btnCopyImagePrompt = document.getElementById('btn-copy-image-prompt');
  const kmarketImagePromptText = document.getElementById('kmarket-image-prompt-text');

  function switchAiModalTab(mode) {
    document.querySelectorAll('.preview-tab[data-ai-mode]').forEach(t => {
      t.classList.toggle('active', t.dataset.aiMode === mode);
    });
    document.querySelectorAll('.ai-mode-pane').forEach(p => {
      p.style.display = 'none';
      p.classList.remove('active');
    });

    const activePane = document.getElementById(`ai-pane-${mode}`);
    if (activePane) {
      activePane.style.display = 'block';
      activePane.classList.add('active');
    }
    if (mode === 'kmarket' && typeof syncKmarketModalThumb === 'function') {
      syncKmarketModalThumb();
    }
    if (mode === 'campina' && typeof syncCampinaModalThumb === 'function') {
      syncCampinaModalThumb();
    }
  }

  const closeAi = () => { if (aiModal) aiModal.style.display = 'none'; };

  async function handleGenerateAiGeneralCopy() {
    const topic = document.getElementById('ai-topic')?.value.trim();
    const tone = document.getElementById('ai-tone')?.value;
    const goal = document.getElementById('ai-goal')?.value;
    const customInstructions = document.getElementById('ai-custom-inst')?.value.trim();

    if (!topic) {
      showToast('Por favor describe brevemente de qué trata tu post', 'error');
      return;
    }

    btnGenerateAiCopy.disabled = true;
    btnGenerateAiCopy.innerHTML = '<span>⚡ Generando con Gemini...</span>';

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          tone,
          goal,
          customInstructions,
          brandName: AppState.config ? AppState.config.pageName : ''
        })
      });
      const json = await res.json();

      if (json.success && json.data) {
        if (aiGeneratedText) aiGeneratedText.value = json.data.fullPost;
        setElementDisplay('ai-result-box', 'block');
        setElementDisplay('btn-apply-ai-copy', 'inline-flex');
        showToast('¡Copy generado con éxito!', 'success');
      } else {
        showToast('Error: ' + (json.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión con IA: ' + err.message, 'error');
    } finally {
      btnGenerateAiCopy.disabled = false;
      btnGenerateAiCopy.innerHTML = '<span>✨ Generar Copy y Hashtags con Gemini</span>';
    }
  }

  async function handleGenerateKmarketAiPromptAndCopy() {
    const prodName = document.getElementById('kmarket-prod-name')?.value.trim();
    const prodDesc = document.getElementById('kmarket-prod-desc')?.value.trim();

    if (!prodName) {
      showToast('Ingresa el nombre del producto (ej: Ramen Buldak, Bebida Milkis...)', 'error');
      return;
    }

    btnGenerateKmarketAi.disabled = true;
    btnGenerateKmarketAi.innerHTML = '<span>⚡ Generando Prompt 4:5 y Copy con Gemini...</span>';

    try {
      const res = await fetch('/api/ai/kmarket-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: prodName, description: prodDesc })
      });
      const json = await res.json();

      if (json.success && json.data) {
        if (kmarketImagePromptText) kmarketImagePromptText.value = json.data.masterImagePrompt;
        setElementDisplay('kmarket-image-prompt-box', 'block');

        if (aiGeneratedText) aiGeneratedText.value = json.data.postCopy;
        setElementDisplay('ai-result-box', 'block');
        setElementDisplay('btn-apply-ai-copy', 'inline-flex');

        showToast('¡Prompt 4:5 y Copy generados exitosamente!', 'success');
      } else {
        showToast('Error: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      btnGenerateKmarketAi.disabled = false;
      btnGenerateKmarketAi.innerHTML = '<span>🛒 Generar Prompt 4:5 + Copy Kmarket</span>';
    }
  }

  async function handleCopyKmarketImagePrompt() {
    if (!kmarketImagePromptText?.value) return;
    try {
      await navigator.clipboard.writeText(kmarketImagePromptText.value);
      showToast('📋 ¡Prompt copiado al portapapeles! Pégalo en Gemini / Midjourney', 'success');
      btnCopyImagePrompt.textContent = '✅ ¡Copiado!';
      setTimeout(() => { btnCopyImagePrompt.textContent = '📋 Copiar Prompt'; }, 2500);
    } catch (error_) {
      console.warn('[Composer] Fallback copia manual prompt:', error_);
      kmarketImagePromptText.select();
      showToast('Texto seleccionado. Presiona Ctrl+C para copiar', 'info');
    }
  }

  function bindAiModalGeneralControls() {
    document.querySelectorAll('.preview-tab[data-ai-mode]').forEach(tab => {
      tab.addEventListener('click', () => {
        switchAiModalTab(tab.dataset.aiMode);
      });
    });

    if (btnOpenAiModal) {
      btnOpenAiModal.addEventListener('click', () => {
        if (aiModal) aiModal.style.display = 'flex';
        const brand = (AppState.config?.pageName || '').toLowerCase();
        if (brand.includes('kmarket')) {
          switchAiModalTab('kmarket');
        } else if (brand.includes('campiña') || brand.includes('cabaña')) {
          switchAiModalTab('campina');
        } else {
          switchAiModalTab('general');
        }
      });
    }

    if (btnCloseAiModal) btnCloseAiModal.addEventListener('click', closeAi);
    if (btnCancelAi) btnCancelAi.addEventListener('click', closeAi);

    if (btnGenerateAiCopy) {
      btnGenerateAiCopy.addEventListener('click', handleGenerateAiGeneralCopy);
    }

    if (btnGenerateKmarketAi) {
      btnGenerateKmarketAi.addEventListener('click', handleGenerateKmarketAiPromptAndCopy);
    }

    if (btnCopyImagePrompt) {
      btnCopyImagePrompt.addEventListener('click', handleCopyKmarketImagePrompt);
    }

    if (btnApplyAiCopy) {
      btnApplyAiCopy.addEventListener('click', () => {
        postContent.value = aiGeneratedText.value;
        updateLivePreviews();
        closeAi();
        showToast('Copy insertado en el editor', 'success');
      });
    }
  }

  // =======================================================
  // ESCÁNER INTELIGENTE DE PRODUCTO KMARKET (Visión + Búsqueda)
  // =======================================================
  let kmarketScannedImagePath = '';
  let currentScannedProduct = null;
  const kmarketScanFileInput = document.getElementById('kmarket-scan-file-input');
  const btnScanProductAuto = document.getElementById('btn-scan-product-auto');
  const btnGenerateKmarketDirectPoster = document.getElementById('btn-generate-kmarket-direct-poster');
  const btnModalGenerateFlux = document.getElementById('btn-modal-generate-flux-image');
  const kmarketScanImg = document.getElementById('kmarket-scan-img');
  const kmarketScanPlaceholder = document.getElementById('kmarket-scan-placeholder');
  const kmarketScanStatus = document.getElementById('kmarket-scan-status');
  const modalImgPreview = document.getElementById('kmarket-ai-img-preview');
  const modalImgResult = document.getElementById('kmarket-ai-img-result');

  function updateKmarketPreviewDisplay(previewUrl, statusText) {
    if (kmarketScanImg) {
      kmarketScanImg.src = previewUrl;
      kmarketScanImg.style.display = 'block';
    }
    if (kmarketScanPlaceholder) kmarketScanPlaceholder.style.display = 'none';
    if (kmarketScanStatus) kmarketScanStatus.textContent = statusText;
  }

  async function uploadKmarketScanFile(file) {
    try {
      const localPreview = URL.createObjectURL(file);
      updateKmarketPreviewDisplay(localPreview, `Subiendo foto de "${file.name}"...`);
    } catch (_blobErr) {
      // Ignorar si URL.createObjectURL no está soportado
    }

    const formData = new FormData();
    formData.append('files', file);

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData
    });
    const json = await res.json();

    if (json.success && json.data?.length > 0) {
      const uploadedUrl = json.data[0].url || json.data[0].filepath;
      kmarketScannedImagePath = uploadedUrl;
      updateKmarketPreviewDisplay(uploadedUrl, `Foto lista. Presiona "Escanear e Investigar Producto".`);

      if (!ComposerState.mediaFiles.includes(uploadedUrl)) {
        ComposerState.mediaFiles.unshift(uploadedUrl);
        renderMediaPreviews();
        updateLivePreviews();
      }
      showToast('Foto cargada. Ahora presiona "Escanear e Investigar Producto"', 'info');
    } else {
      throw new Error(json.error || 'Desconocido');
    }
  }

  function applyScannedProductData(data) {
    currentScannedProduct = data;
    if (data.name) setInputValue('kmarket-prod-name', data.name);
    setInputValue('kmarket-prod-desc', formatProductDetailsText(data));

    if (data.masterImagePrompt) {
      setInputValue('kmarket-image-prompt-text', data.masterImagePrompt);
      setElementDisplay('kmarket-image-prompt-box', 'block');
    }

    if (data.suggestedCopy) {
      setInputValue('ai-generated-text', data.suggestedCopy);
      setElementDisplay('ai-result-box', 'block');
      setElementDisplay('btn-apply-ai-copy', 'inline-flex');
    }

    setElementHtml('kmarket-scan-status', `✅ Identificado: <strong>${data.name || 'Producto'}</strong> (${data.brand || 'Corea'}).`);
  }

  async function handleScanProductAuto() {
    const targetPath = kmarketScannedImagePath || (ComposerState.mediaFiles?.length > 0 ? ComposerState.mediaFiles[0] : null);
    if (!targetPath) {
      showToast('Primero selecciona o sube una foto del empaque del producto', 'warning');
      return;
    }

    btnScanProductAuto.disabled = true;
    btnScanProductAuto.textContent = '🔍 Investigando producto...';
    if (kmarketScanStatus) kmarketScanStatus.textContent = 'Gemini está analizando el empaque e investigando ingredientes y notas de sabor...';
    showToast('Investigando producto en internet con Gemini...', 'info');

    try {
      const res = await fetch('/api/ai/scan-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: targetPath })
      });
      const json = await res.json();
      if (json.success && json.data) {
        applyScannedProductData(json.data);
        showToast('¡Producto investigado con éxito! Ficha y Copy listos.', 'success');
      } else {
        showToast('Error investigando producto: ' + (json.error || 'Error desconocido'), 'error');
        if (kmarketScanStatus) kmarketScanStatus.textContent = 'No se pudo identificar: ' + (json.error || '');
      }
    } catch (err) {
      showToast('Error de conexión: ' + err.message, 'error');
      if (kmarketScanStatus) kmarketScanStatus.textContent = 'Error de conexión: ' + err.message;
    } finally {
      btnScanProductAuto.disabled = false;
      btnScanProductAuto.textContent = '🔍 Escanear e Investigar Producto';
    }
  }

  async function handleGenerateKmarketDirectPoster() {
    const prodName = document.getElementById('kmarket-prod-name')?.value.trim();
    const prodDesc = document.getElementById('kmarket-prod-desc')?.value.trim();
    const targetImg = kmarketScannedImagePath || (ComposerState.mediaFiles && ComposerState.mediaFiles.length > 0 ? ComposerState.mediaFiles[0] : null);

    if (!targetImg) {
      showToast('Sube la foto del producto para que el diseñador la use como referencia', 'warning');
      return;
    }

    btnGenerateKmarketDirectPoster.disabled = true;
    btnGenerateKmarketDirectPoster.innerHTML = '<span>⚡ Diseñando Afiche 4:5...</span>';
    showToast('Diseñando afiche publicitario 4:5 con Gemini Flash Lite...', 'info');

    try {
      const res = await fetch('/api/ai/kmarket-designer-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImageUrl: targetImg,
          productName: prodName,
          extraNotes: prodDesc || '',
          scannedData: currentScannedProduct
        })
      });
      const json = await res.json();
      if (json.success && json.data?.url) {
        ComposerState.mediaFiles = [json.data.url];
        renderMediaPreviews();
        updateLivePreviews();

        if (modalImgResult) modalImgResult.src = json.data.url;
        if (modalImgPreview) modalImgPreview.style.display = 'block';

        showToast('¡Afiche 4:5 generado y cargado al Composer!', 'success');
      } else {
        showToast('Error generando afiche: ' + (json.error || 'Desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btnGenerateKmarketDirectPoster.disabled = false;
      btnGenerateKmarketDirectPoster.innerHTML = '<span>🎨 Generar Afiche 4:5 Ahora</span>';
    }
  }

  async function handleOpenGeminiWebFloating() {
    const prodName = document.getElementById('kmarket-prod-name')?.value.trim() || 'este producto';
    const promptToCopy = `necesito que te comportes como un diseñador grafico senior experto en marketing. hacer una imagen publicitaria de este producto (${prodName}) de dimensiones 4:5 vertical para instagram , usar una fuente similar a la del producto, pero dinamica y el subtitulo con una fuente de menor tamaño pero tambien elegante y un diseño similar para poner el titulo de lo que es, buscar info online del producto e imagenes de referencia de este mismo (es decir no usar exactamente la imagen que te di) . Todo texto en español. No hacer referencia a ninguna tienda en especial. ni poner nada como comprar ahora . no dar tanto enfasis a lo de "sabor coreano" ni a la marca, si es que, solo de manera pequeña`;

    try {
      await navigator.clipboard.writeText(promptToCopy);
      showToast('📋 ¡Prompt copiado al portapapeles! Abre Gemini Web, adjunta la foto y pega (Ctrl+V).', 'success');
    } catch (_clipErr) {
      // Ignorar si el navegador bloquea acceso asíncrono al portapapeles sin foco
    }

    window.open('https://gemini.google.com', 'GeminiWebAssistant', 'width=760,height=880,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes,noopener,noreferrer');
  }

  function bindKmarketControls() {
    if (kmarketScanImg) {
      kmarketScanImg.onerror = () => {
        kmarketScanImg.style.display = 'none';
        if (kmarketScanPlaceholder) kmarketScanPlaceholder.style.display = 'block';
      };
    }

    if (kmarketScanFileInput) {
      kmarketScanFileInput.addEventListener('change', async () => {
        if (!kmarketScanFileInput.files || kmarketScanFileInput.files.length === 0) return;
        try {
          await uploadKmarketScanFile(kmarketScanFileInput.files[0]);
        } catch (err) {
          showToast('Error subiendo foto: ' + err.message, 'error');
          if (kmarketScanStatus) kmarketScanStatus.textContent = 'Error subiendo foto.';
        }
      });
    }

    if (btnScanProductAuto) {
      btnScanProductAuto.addEventListener('click', handleScanProductAuto);
    }

    if (btnGenerateKmarketDirectPoster) {
      btnGenerateKmarketDirectPoster.addEventListener('click', handleGenerateKmarketDirectPoster);
    }

    if (btnModalGenerateFlux && btnGenerateKmarketDirectPoster) {
      btnModalGenerateFlux.addEventListener('click', () => {
        btnGenerateKmarketDirectPoster.click();
      });
    }

    const btnOpenGeminiWebFloating = document.getElementById('btn-open-gemini-web-floating');
    if (btnOpenGeminiWebFloating) {
      btnOpenGeminiWebFloating.addEventListener('click', handleOpenGeminiWebFloating);
    }
  }

  // =======================================================
  // FOTO DE FONDO & GENERADOR DE AFICHES CABAÑAS LA CAMPIÑA
  // =======================================================
  let campinaBackgroundImagePath = '';
  const campinaBgFileInput = document.getElementById('campina-bg-file-input');
  const btnSelectCampinaBg = document.getElementById('btn-select-campina-bg');
  const btnUseComposerBg = document.getElementById('btn-use-composer-bg');
  const campinaBgImg = document.getElementById('campina-bg-img');
  const campinaBgPlaceholder = document.getElementById('campina-bg-placeholder');
  const campinaBgStatus = document.getElementById('campina-bg-status');
  const campinaImagePromptText = document.getElementById('campina-image-prompt-text');
  const btnCopyCampinaImagePrompt = document.getElementById('btn-copy-campina-image-prompt');
  const btnOpenGeminiWebCampina = document.getElementById('btn-open-gemini-web-campina');
  const btnGenerateCampinaDirectPoster = document.getElementById('btn-generate-campina-direct-poster');
  const btnModalGenerateCampinaImage = document.getElementById('btn-modal-generate-campina-image');
  const btnGenerateCampinaEditorialFlyer = document.getElementById('btn-generate-campina-editorial-flyer');
  const chkCampinaRespectBg = document.getElementById('chk-campina-respect-bg');
  const campinaExtraElements = document.getElementById('campina-extra-elements');
  const campinaHeroHeadline = document.getElementById('campina-hero-headline');
  const campinaSublineHeadline = document.getElementById('campina-subline-headline');
  const campinaTypographyStyle = document.getElementById('campina-typography-style');
  const campinaBrandTreatment = document.getElementById('campina-brand-treatment');
  const campinaColorPalette = document.getElementById('campina-color-palette');
  const campinaPosterReference = document.getElementById('campina-poster-reference');
  const campinaArtVibeTag = document.getElementById('campina-art-vibe-tag');
  const campinaArtAnalysisText = document.getElementById('campina-art-analysis-text');
  const campinaTypoVibeBadge = document.getElementById('campina-typo-vibe-badge');
  const campinaTypoDesc = document.getElementById('campina-typo-desc');
  const campinaSloganAlternativesWrap = document.getElementById('campina-slogan-alternatives-wrap');
  const campinaSloganPills = document.getElementById('campina-slogan-pills');
  const campinaAiImgResult = document.getElementById('campina-ai-img-result');

  const campinaTypoDescriptions = {
    auto: {
      name: '✨ Auto-detectar',
      desc: 'La IA detecta automáticamente si el tema es quincho, escapada de pareja o naturaleza y selecciona la fuente ideal.',
      badgeColor: 'rgba(59, 130, 246, 0.15)',
      textColor: '#3b82f6'
    },
    rustic_timber: {
      name: '🪵 Rústico Noble',
      desc: 'Tipografía display robusta inspirada en rótulos tallados en madera noble o forja rústica. Bisel cálido y sombra natural proyectada.',
      badgeColor: 'rgba(217, 119, 6, 0.15)',
      textColor: '#d97706'
    },
    kinfolk_luxury: {
      name: '✨ Serif Boutique',
      desc: 'Serif de altísimo contraste con ligaduras refinadas y elegancia editorial contemporánea. Tono blanco marfil y resplandor sutil.',
      badgeColor: 'rgba(168, 85, 247, 0.15)',
      textColor: '#a855f7'
    },
    natgeo_adventure: {
      name: '🏔️ Bold Naturaleza',
      desc: 'Sans-serif condensada monumental, mayúsculas geométricas de gran peso visual, trazo limpio y sombra arquitectónica sólida.',
      badgeColor: 'rgba(16, 185, 129, 0.15)',
      textColor: '#10b981'
    },
    botanical_minimal: {
      name: '🌿 Botánica Zen',
      desc: 'Sans-serif geométrica refinada, ligera y sumamente espaciada (letter-spacing amplio). Elegancia zen y máximo respiro visual.',
      badgeColor: 'rgba(14, 165, 233, 0.15)',
      textColor: '#0ea5e9'
    },
    patria_heritage: {
      name: '🇨🇱 Tradición Chilena',
      desc: 'Tipografía display con carácter de imprenta tradicional chilena estilizada. Remates firmes, calidez campestre y celebración auténtica.',
      badgeColor: 'rgba(239, 68, 68, 0.15)',
      textColor: '#ef4444'
    }
  };

  const campinaTreatmentDescriptions = {
    auto: '✨ Auto-acabado: La IA analiza el estilo y escoge pincelada gestual, pan de oro o madera tallada según el ambiente.',
    brush_stroke: '🖌️ Trazo de autor: Pincelada orgánica viva ("dry brushstroke") en tonos cálidos que subraya y dinamiza el eslogan.',
    gold_foil: '⚜️ Pan de oro: Letras con textura de foil dorado en relieve, bisel pulido y brillo cálido Kinfolk.',
    timber_burn: '🪵 Madera tallada 3D: Rótulo con volumen de pirograbado o bajo relieve rústico y textura de veta de madera.',
    editorial_lockup: '📐 Lockup editorial: Composición con filetes geométricos finos, micro-divisores y equilibrio de revista de diseño.',
    solar_rim: '☀️ Golden rim: Retroiluminación solar en las aristas superiores del texto, fusionándolo con la luz del bosque.'
  };

  function updateCampinaTypoInfo(styleKey) {
    const info = campinaTypoDescriptions[styleKey] || campinaTypoDescriptions.auto;
    if (campinaTypoVibeBadge) {
      campinaTypoVibeBadge.textContent = info.name;
      campinaTypoVibeBadge.style.background = info.badgeColor;
      campinaTypoVibeBadge.style.color = info.textColor;
    }
    if (campinaTypoDesc) {
      const treatmentVal = campinaBrandTreatment?.value || 'auto';
      const treatmentText = treatmentVal !== 'auto'
        ? `<br><span style="color:var(--text-secondary); font-weight:500;">${campinaTreatmentDescriptions[treatmentVal] || ''}</span>`
        : '';
      campinaTypoDesc.innerHTML = `${info.desc}${treatmentText}`;
    }
  }

  function collectCampinaContentParams() {
    return {
      theme: document.getElementById('campina-theme')?.value.trim() || '',
      format: document.getElementById('campina-format')?.value || 'reel',
      targetDate: document.getElementById('campina-date')?.value.trim() || '',
      heroHeadline: campinaHeroHeadline?.value?.trim() || '',
      sublineHeadline: campinaSublineHeadline?.value?.trim() || '',
      respectBackground: chkCampinaRespectBg ? chkCampinaRespectBg.checked : true,
      extraElements: campinaExtraElements?.value?.trim() || '',
      typographyStyle: campinaTypographyStyle?.value || 'auto',
      brandTreatment: campinaBrandTreatment?.value || 'auto',
      colorPalette: campinaColorPalette?.value || 'auto',
      posterReference: campinaPosterReference?.value || 'auto'
    };
  }

  function highlightMasterPromptUpdate() {
    if (!campinaImagePromptText) return;
    campinaImagePromptText.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
    campinaImagePromptText.style.borderColor = 'var(--success)';
    campinaImagePromptText.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.4)';
    setTimeout(() => {
      campinaImagePromptText.style.borderColor = '';
      campinaImagePromptText.style.boxShadow = '';
    }, 600);
  }

  let campinaPromptDebounceTimer = null;
  async function syncCampinaMasterPromptLive() {
    if (!campinaImagePromptText) return;

    try {
      const params = collectCampinaContentParams();
      params.theme = params.theme || 'Descanso en la naturaleza';

      const res = await fetch('/api/ai/campina-refresh-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const json = await res.json();
      if (json.success && json.data?.masterImagePrompt) {
        campinaImagePromptText.value = json.data.masterImagePrompt;
        setElementDisplay('campina-image-prompt-box', 'block');
        highlightMasterPromptUpdate();
      }
    } catch (e) {
      console.warn('[Campina] Error sincronizando prompt maestro en vivo:', e.message);
    }
  }

  function triggerCampinaPromptDebounced() {
    clearTimeout(campinaPromptDebounceTimer);
    campinaPromptDebounceTimer = setTimeout(() => {
      syncCampinaMasterPromptLive();
    }, 450);
  }

  function renderCampinaSloganAlternatives(alternatives = []) {
    if (!campinaSloganAlternativesWrap || !campinaSloganPills) return;
    if (!alternatives || alternatives.length === 0) {
      campinaSloganAlternativesWrap.style.display = 'none';
      return;
    }

    campinaSloganPills.innerHTML = '';
    alternatives.forEach((alt) => {
      const item = document.createElement('div');
      item.style.cssText = 'padding:6px 10px; background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:all 0.15s ease;';

      const styleInfo = campinaTypoDescriptions[alt.style] || { name: alt.style, badgeColor: 'rgba(255,255,255,0.08)', textColor: '#E2E8F0' };

      item.innerHTML = `
        <div style="flex:1; min-width:0; padding-right:8px;">
          <strong style="font-size:0.78rem; color:var(--text-primary); display:block; margin-bottom:1px;">${alt.hero}</strong>
          <div style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${alt.subline}</div>
        </div>
        <span class="badge" style="font-size:0.65rem; background:${styleInfo.badgeColor}; color:${styleInfo.textColor}; flex-shrink:0;">${styleInfo.name}</span>
      `;

      item.addEventListener('mouseenter', () => {
        item.style.borderColor = 'var(--primary)';
        item.style.background = 'rgba(59, 130, 246, 0.08)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.borderColor = 'var(--border-subtle)';
        item.style.background = 'var(--bg-secondary)';
      });

      item.addEventListener('click', async () => {
        if (campinaHeroHeadline) campinaHeroHeadline.value = alt.hero;
        if (campinaSublineHeadline) campinaSublineHeadline.value = alt.subline;
        if (campinaTypographyStyle && alt.style) {
          campinaTypographyStyle.value = alt.style;
          updateCampinaTypoInfo(alt.style);
        }
        await syncCampinaMasterPromptLive();
        showToast(`✨ Eslogan "${alt.hero}" transferido al Prompt Maestro de Gemini`, 'success');
      });

      campinaSloganPills.appendChild(item);
    });

    campinaSloganAlternativesWrap.style.display = 'block';
  }

  function syncCampinaModalThumb() {
    if (ComposerState.mediaFiles && ComposerState.mediaFiles.length > 0) {
      campinaBackgroundImagePath = ComposerState.mediaFiles[0];
      if (campinaBgImg) {
        campinaBgImg.src = campinaBackgroundImagePath;
        campinaBgImg.style.display = 'block';
      }
      if (campinaBgPlaceholder) campinaBgPlaceholder.style.display = 'none';
      if (campinaBgStatus) campinaBgStatus.innerHTML = 'Foto sincronizada desde el editor. Lista como base escénica.';
    }
  }

  function updateCampinaBgPreview(url, fileName) {
    campinaBackgroundImagePath = url;
    if (campinaBgImg) {
      campinaBgImg.src = url;
      campinaBgImg.style.display = 'block';
    }
    setElementDisplay('campina-bg-placeholder', 'none');
    if (campinaBgStatus) {
      campinaBgStatus.innerHTML = `✅ Foto de fondo lista (<strong>${fileName}</strong>).`;
    }

    if (!ComposerState.mediaFiles.includes(url)) {
      ComposerState.mediaFiles.unshift(url);
      renderMediaPreviews();
      updateLivePreviews();
    }
  }

  async function handleCampinaBgFileUpload() {
    if (!campinaBgFileInput?.files?.length) return;
    const file = campinaBgFileInput.files[0];

    try {
      const localPreview = URL.createObjectURL(file);
      if (campinaBgImg) {
        campinaBgImg.src = localPreview;
        campinaBgImg.style.display = 'block';
      }
      setElementDisplay('campina-bg-placeholder', 'none');
    } catch (_blobErr) {
      // Ignorar si URL.createObjectURL no está disponible en este entorno
    }

    setElementText('campina-bg-status', `Subiendo foto "${file.name}"...`);

    const formData = new FormData();
    formData.append('files', file);

    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
      const json = await res.json();
      if (json.success && json.data?.length > 0) {
        const uploadedUrl = json.data[0].url || json.data[0].filepath;
        updateCampinaBgPreview(uploadedUrl, file.name);
        showToast('Foto de fondo cargada exitosamente', 'success');
      } else {
        showToast('Error al subir: ' + (json.error || 'Desconocido'), 'error');
        setElementText('campina-bg-status', 'Error al subir foto.');
      }
    } catch (err) {
      showToast('Error subiendo foto: ' + err.message, 'error');
      setElementText('campina-bg-status', 'Error al subir foto.');
    }
  }

  function renderCampinaArtAnalysis(ana, referenceName) {
    if (!ana) return;
    setElementDisplay('campina-art-analysis-card', 'block');
    if (campinaArtVibeTag) {
      campinaArtVibeTag.textContent = referenceName || ana.movement || 'Dirección de Arte IA';
    }
    if (!campinaArtAnalysisText) return;

    let html = '';
    if (ana.concept) html += `<strong>Concepto Visual:</strong> ${ana.concept}<br>`;
    if (ana.colorVibe || ana.rationale) html += `<strong>Paleta Cromática:</strong> ${ana.colorVibe || ana.rationale}<br>`;
    if (ana.colors) {
      html += `<div style="display:flex; gap:6px; margin-top:5px; align-items:center; flex-wrap:wrap;">`;
      html += `<span style="font-size:0.68rem; color:var(--text-muted); font-weight:600;">Tonos:</span>`;
      const colorEntries = [ana.colors.primary, ana.colors.accent, ana.colors.contrast].filter(Boolean);
      for (const color of colorEntries) {
        html += `<span style="display:inline-flex; align-items:center; gap:3px; padding:2px 6px; border-radius:4px; font-size:0.65rem; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15);"><span style="width:10px; height:10px; border-radius:2px; background:${color}; display:inline-block;"></span> ${color}</span>`;
      }
      html += `</div>`;
    }
    campinaArtAnalysisText.innerHTML = html;
  }

  function applyCampinaGeneratedContent(data) {
    if (aiGeneratedText) aiGeneratedText.value = data.content || '';
    setElementDisplay('ai-result-box', 'block');
    setElementDisplay('btn-apply-ai-copy', 'inline-flex');

    if (data.heroHeadline && campinaHeroHeadline && !campinaHeroHeadline.value.trim()) {
      campinaHeroHeadline.value = data.heroHeadline;
    }
    if (data.sublineHeadline && campinaSublineHeadline && !campinaSublineHeadline.value.trim()) {
      campinaSublineHeadline.value = data.sublineHeadline;
    }

    if (data.typographyStyle && (!campinaTypographyStyle?.value || campinaTypographyStyle.value === 'auto')) {
      updateCampinaTypoInfo(data.typographyStyle);
    }

    if (data.artDirectionAnalysis) {
      renderCampinaArtAnalysis(data.artDirectionAnalysis, data.posterReferenceName);
    }

    if (data.sloganAlternatives) {
      renderCampinaSloganAlternatives(data.sloganAlternatives);
    }

    if (data.masterImagePrompt) {
      if (campinaImagePromptText) campinaImagePromptText.value = data.masterImagePrompt;
      setElementDisplay('campina-image-prompt-box', 'block');
    }
  }

  async function handleGenerateCampinaContent() {
    const params = collectCampinaContentParams();
    if (!params.theme) {
      showToast('Ingresa el tema o enfoque (ej: Asado en quincho privado, descanso en suites...)', 'error');
      return;
    }

    btnGenerateCampinaAi.disabled = true;
    btnGenerateCampinaAi.innerHTML = '<span>⚡ Generando Guión, Copy, Prompt y Eslogans con Gemini...</span>';

    try {
      const res = await fetch('/api/ai/campina-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const json = await res.json();

      if (json.success && json.data) {
        applyCampinaGeneratedContent(json.data);
        showToast('¡Guión, Copy, Prompt 4:5 y Eslogans generados con éxito!', 'success');
      } else {
        showToast('Error: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      btnGenerateCampinaAi.disabled = false;
      btnGenerateCampinaAi.innerHTML = '<span>🏡 Generar Guión, Copy + Prompt 4:5</span>';
    }
  }

  async function handleCopyCampinaPrompt() {
    if (!campinaImagePromptText?.value) return;
    try {
      await navigator.clipboard.writeText(campinaImagePromptText.value);
      showToast('📋 ¡Prompt copiado al portapapeles! Pégalo en Gemini / Midjourney', 'success');
      btnCopyCampinaImagePrompt.textContent = '✅ ¡Copiado!';
      setTimeout(() => { btnCopyCampinaImagePrompt.textContent = '📋 Copiar Prompt'; }, 2500);
    } catch (error_) {
      console.warn('[Campina] Fallback copia manual prompt:', error_);
      campinaImagePromptText.select();
      showToast('Texto seleccionado. Presiona Ctrl+C para copiar', 'info');
    }
  }

  async function handleOpenGeminiWebCampina() {
    const promptToCopy = campinaImagePromptText?.value || document.getElementById('campina-theme')?.value || 'Afiche publicitario 4:5 para Cabañas La Campiña';
    try {
      await navigator.clipboard.writeText(promptToCopy);
      showToast('📋 ¡Prompt copiado! Abre Gemini Web, adjunta tu foto de fondo y pega (Ctrl+V)', 'success');
    } catch (_clipErr) {
      // Ignorar si el navegador bloquea acceso asíncrono al portapapeles
    }

    window.open('https://gemini.google.com', 'GeminiWebCampina', 'width=760,height=880,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes,noopener,noreferrer');
  }

  function buildCampinaPosterPayload(targetImg) {
    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const accountSelect = document.getElementById('global-account-select');
    return {
      baseImageUrl: targetImg,
      theme: document.getElementById('campina-theme')?.value.trim() || 'Escapada de descanso en la naturaleza',
      targetDate: document.getElementById('campina-date')?.value.trim() || '',
      heroHeadline: campinaHeroHeadline?.value?.trim() || '',
      sublineHeadline: campinaSublineHeadline?.value?.trim() || '',
      respectBackground: chkCampinaRespectBg ? chkCampinaRespectBg.checked : true,
      extraElements: campinaExtraElements?.value?.trim() || '',
      typographyStyle: campinaTypographyStyle?.value || 'auto',
      brandTreatment: campinaBrandTreatment?.value || 'auto',
      colorPalette: campinaColorPalette?.value || 'auto',
      posterReference: campinaPosterReference?.value || 'auto',
      customPrompt: campinaImagePromptText?.value || '',
      account_id: activeAcc?.pageId || accountSelect?.value || ''
    };
  }

  function applyCampinaPosterResult(url, successMsg) {
    ComposerState.mediaFiles = [url];
    renderMediaPreviews();
    updateLivePreviews();
    if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();

    if (campinaAiImgResult) campinaAiImgResult.src = url;
    setElementDisplay('campina-ai-img-preview', 'block');
    setElementDisplay('campina-image-prompt-box', 'block');

    showToast(successMsg, 'success');
  }

  async function handleGenerateCampinaDirectPoster() {
    const targetImg = campinaBackgroundImagePath || (ComposerState.mediaFiles?.length > 0 ? ComposerState.mediaFiles[0] : null);

    if (!targetImg) {
      showToast('Sube una foto de fondo real (quincho, cabaña, jardín) para que Gemini la use como escenografía', 'warning');
      return;
    }

    if (btnGenerateCampinaDirectPoster) {
      btnGenerateCampinaDirectPoster.disabled = true;
      btnGenerateCampinaDirectPoster.innerHTML = '<span>⚡ Diseñando Afiche 4:5 con Gemini...</span>';
    }
    showToast('Diseñando afiche publicitario 4:5 con Gemini sobre la foto de fondo...', 'info');

    try {
      const payload = buildCampinaPosterPayload(targetImg);
      const res = await fetch('/api/ai/campina-designer-poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success && json.data?.url) {
        applyCampinaPosterResult(json.data.url, '¡Afiche publicitario 4:5 generado y cargado al editor!');
      } else {
        showToast('Error generando afiche: ' + (json.error || 'Desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión: ' + err.message, 'error');
    } finally {
      if (btnGenerateCampinaDirectPoster) {
        btnGenerateCampinaDirectPoster.disabled = false;
        btnGenerateCampinaDirectPoster.innerHTML = '<span>🎨 Generar con Gemini</span>';
      }
    }
  }

  function buildCampinaEditorialFlyerPayload(targetImg) {
    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const accountSelect = document.getElementById('global-account-select');
    const headline = campinaHeroHeadline?.value?.trim() || 'DESCONEXIÓN TOTAL';
    const subline = campinaSublineHeadline?.value?.trim() || 'Quinchos privados • Cabañas y suites • Algarrobo';
    const typographyStyle = (campinaTypographyStyle?.value && campinaTypographyStyle.value !== 'auto')
      ? campinaTypographyStyle.value
      : 'rustic_timber';

    return {
      baseImageUrl: targetImg,
      headline,
      subline,
      badgeText: 'CABAÑAS LA CAMPIÑA • ALGARROBO',
      style: 'editorial',
      typographyStyle,
      brandTreatment: campinaBrandTreatment?.value || 'auto',
      colorPalette: campinaColorPalette?.value || 'auto',
      posterReference: campinaPosterReference?.value || 'auto',
      account_id: activeAcc?.pageId || accountSelect?.value || ''
    };
  }

  async function handleGenerateCampinaEditorialFlyer() {
    const targetImg = campinaBackgroundImagePath || (ComposerState.mediaFiles && ComposerState.mediaFiles.length > 0 ? ComposerState.mediaFiles[0] : null);
    if (!targetImg) {
      showToast('Sube una foto de fondo real (quincho, cabaña, jardín) para crear el afiche editorial', 'warning');
      return;
    }

    if (btnGenerateCampinaEditorialFlyer) {
      btnGenerateCampinaEditorialFlyer.disabled = true;
      btnGenerateCampinaEditorialFlyer.innerHTML = '<span>⚡ Componiendo Afiche Editorial...</span>';
    }
    showToast('Componiendo afiche editorial 4:5 sobre tu foto 100% real...', 'info');

    try {
      const payload = buildCampinaEditorialFlyerPayload(targetImg);
      const res = await fetch('/api/media/create-campina-flyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success && json.data?.url) {
        applyCampinaPosterResult(json.data.url, '¡Afiche editorial 100% real compuesto y cargado al editor!');
      } else {
        showToast('Error componiendo afiche: ' + (json.error || 'Desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión: ' + err.message, 'error');
    } finally {
      if (btnGenerateCampinaEditorialFlyer) {
        btnGenerateCampinaEditorialFlyer.disabled = false;
        btnGenerateCampinaEditorialFlyer.innerHTML = '<span>📐 Afiche Editorial (Foto 100% Real)</span>';
      }
    }
  }

  async function handleSyncCampinaWeb() {
    const btnSync = document.getElementById('btn-sync-campina-web');
    if (!btnSync) return;
    btnSync.disabled = true;
    btnSync.textContent = '🔄 Escaneando...';
    try {
      const res = await fetch('/api/ai/scrape-campina', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('✅ Información sincronizada con www.cabanaslacampina.cl', 'success');
        loadDashboardStatus();
      } else {
        showToast('Error sincronizando: ' + json.error, 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      btnSync.disabled = false;
      btnSync.textContent = '🔄 Sincronizar Web';
    }
  }

  function bindCampinaStyleAndPromptInputs() {
    if (campinaTypographyStyle) {
      campinaTypographyStyle.addEventListener('change', () => {
        updateCampinaTypoInfo(campinaTypographyStyle.value);
        syncCampinaMasterPromptLive();
      });
    }

    if (campinaBrandTreatment) {
      campinaBrandTreatment.addEventListener('change', () => {
        updateCampinaTypoInfo(campinaTypographyStyle?.value || 'auto');
        syncCampinaMasterPromptLive();
      });
    }

    if (campinaColorPalette) {
      campinaColorPalette.addEventListener('change', syncCampinaMasterPromptLive);
    }

    if (campinaPosterReference) {
      campinaPosterReference.addEventListener('change', syncCampinaMasterPromptLive);
    }

    const campinaThemeInput = document.getElementById('campina-theme');
    const campinaDateInput = document.getElementById('campina-date');
    if (campinaThemeInput) campinaThemeInput.addEventListener('input', triggerCampinaPromptDebounced);
    if (campinaDateInput) campinaDateInput.addEventListener('input', triggerCampinaPromptDebounced);
    if (campinaHeroHeadline) campinaHeroHeadline.addEventListener('input', triggerCampinaPromptDebounced);
    if (campinaSublineHeadline) campinaSublineHeadline.addEventListener('input', triggerCampinaPromptDebounced);
    if (campinaExtraElements) campinaExtraElements.addEventListener('input', triggerCampinaPromptDebounced);
  }

  function bindCampinaActionButtons() {
    const btnSyncCampinaWeb = document.getElementById('btn-sync-campina-web');
    if (btnSyncCampinaWeb) btnSyncCampinaWeb.addEventListener('click', handleSyncCampinaWeb);

    if (campinaBgImg) {
      campinaBgImg.onerror = () => {
        campinaBgImg.style.display = 'none';
        setElementDisplay('campina-bg-placeholder', 'block');
      };
    }

    if (chkCampinaRespectBg) {
      chkCampinaRespectBg.addEventListener('change', () => {
        setElementDisplay('campina-extra-elements-wrap', chkCampinaRespectBg.checked ? 'none' : 'block');
        syncCampinaMasterPromptLive();
      });
    }

    if (btnSelectCampinaBg && campinaBgFileInput) {
      btnSelectCampinaBg.addEventListener('click', () => { campinaBgFileInput.click(); });
    }

    if (btnUseComposerBg) {
      btnUseComposerBg.addEventListener('click', () => {
        if (ComposerState.mediaFiles?.length > 0) {
          syncCampinaModalThumb();
          showToast('Foto del editor vinculada como fondo para el afiche', 'info');
        } else {
          showToast('No hay ninguna foto cargada en el editor aún', 'warning');
        }
      });
    }

    if (campinaBgFileInput) campinaBgFileInput.addEventListener('change', handleCampinaBgFileUpload);
    if (btnGenerateCampinaAi) btnGenerateCampinaAi.addEventListener('click', handleGenerateCampinaContent);
    if (btnCopyCampinaImagePrompt) btnCopyCampinaImagePrompt.addEventListener('click', handleCopyCampinaPrompt);
    if (btnOpenGeminiWebCampina) btnOpenGeminiWebCampina.addEventListener('click', handleOpenGeminiWebCampina);
    if (btnGenerateCampinaDirectPoster) btnGenerateCampinaDirectPoster.addEventListener('click', handleGenerateCampinaDirectPoster);
    if (btnModalGenerateCampinaImage) btnModalGenerateCampinaImage.addEventListener('click', handleGenerateCampinaDirectPoster);
    if (btnGenerateCampinaEditorialFlyer) btnGenerateCampinaEditorialFlyer.addEventListener('click', handleGenerateCampinaEditorialFlyer);
  }

  function bindCampinaControls() {
    bindCampinaStyleAndPromptInputs();
    bindCampinaActionButtons();
  }

  // =========================================================================
  // INSTAGRAM SKILLS 2026: CARRUSEL & HUMANIZADOR
  // =========================================================================
  const btnHumanizeComposer = document.getElementById('btn-humanize-composer');
  const btnGenerateCarousel = document.getElementById('btn-generate-carousel');
  const btnRunHumanize = document.getElementById('btn-run-humanize');
  const btnApplyHumanized = document.getElementById('btn-apply-humanized');

  async function handleHumanizeComposer() {
    const currentText = postContent.value.trim();
    if (!currentText) {
      showToast('Escribe primero un borrador en el editor para auditarlo', 'error');
      return;
    }

    btnHumanizeComposer.disabled = true;
    btnHumanizeComposer.textContent = '🔍 Auditando...';

    try {
      const res = await fetch('/api/ai/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: currentText })
      });
      const json = await res.json();

      if (json.success && json.data) {
        const d = json.data;
        let reportMsg = `Diagnóstico 2026: ${d.score}/100 pts.\n`;
        if (d.issues && d.issues.length > 0) {
          reportMsg += `\n⚠️ Observaciones encontradas:\n- ${d.issues.join('\n- ')}\n`;
        } else {
          reportMsg += '\n✅ ¡Texto impecable! Gancho óptimo y sin rastros de bot.\n';
        }
        reportMsg += '\n¿Deseas aplicar la versión humanizada nativa 2026?';

        if (confirm(reportMsg)) {
          postContent.value = d.humanized;
          updateLivePreviews();
          showToast('¡Texto humanizado y optimizado aplicado!', 'success');
        }
      }
    } catch (err) {
      showToast('Error auditando: ' + err.message, 'error');
    } finally {
      btnHumanizeComposer.disabled = false;
      btnHumanizeComposer.textContent = '🔍 Auditar / Humanizar (Anti-IA)';
    }
  }



  function displayCarouselResults(d) {
    const container = document.getElementById('carousel-results-box');
    if (!container) return;
    container.style.display = 'block';
    const slidesHtml = (d.slides || []).map(renderCarouselSlideItem).join('');

    container.innerHTML = `
      <div style="background:var(--bg-surface-subtle); padding:10px 12px; border-radius:var(--radius-xs); border:1px solid var(--border-subtle); margin-bottom:10px;">
        <h4 style="margin:0 0 8px 0; font-size:0.95rem; color:var(--text-primary);">📑 ${d.title}</h4>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:10px;">🎵 Audio recomendado: <strong>${d.recommendedAudio || 'Instrumental'}</strong></div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${slidesHtml}
        </div>
      </div>
    `;

    if (aiGeneratedText) aiGeneratedText.value = d.caption || '';
    setElementDisplay('ai-result-box', 'block');
    setElementDisplay('btn-apply-ai-copy', 'inline-flex');
  }

  async function handleGenerateCarousel() {
    const topic = document.getElementById('carousel-topic')?.value.trim();
    const slidesCount = document.getElementById('carousel-slides-count')?.value;
    const goal = document.getElementById('carousel-goal')?.value;

    if (!topic) {
      showToast('Ingresa el tema para el carrusel', 'error');
      return;
    }

    btnGenerateCarousel.disabled = true;
    btnGenerateCarousel.innerHTML = '<span>⚡ Planificando Diapositivas...</span>';

    try {
      const res = await fetch('/api/ai/plan-carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, slidesCount, goal })
      });
      const json = await res.json();

      if (json.success && json.data) {
        displayCarouselResults(json.data);
        showToast('¡Plan de carrusel generado con éxito!', 'success');
      } else {
        showToast('Error: ' + json.error, 'error');
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      btnGenerateCarousel.disabled = false;
      btnGenerateCarousel.innerHTML = '<span>📑 Planificar Carrusel con Metodología 2026</span>';
    }
  }

  function renderHumanizeAuditResults(d) {
    setElementDisplay('humanize-audit-box', 'block');
    const scoreBadge = document.getElementById('humanize-score-badge');
    if (scoreBadge) {
      scoreBadge.textContent = `${d.score}/100 pts`;
      let badgeBg = '#ef4444';
      if (d.score >= 80) {
        badgeBg = '#10b981';
      } else if (d.score >= 50) {
        badgeBg = '#f59e0b';
      }
      scoreBadge.style.background = badgeBg;
    }

    const list = document.getElementById('humanize-issues-list');
    if (list) {
      list.innerHTML = (d.issues && d.issues.length > 0)
        ? d.issues.map(iss => `<li>${iss}</li>`).join('')
        : '<li style="color:#10b981;">✅ ¡Texto limpio, sin guiones largos ni frases de robot!</li>';
    }

    setInputValue('humanize-output-text', d.humanized || '');
  }

  async function handleRunHumanize() {
    const text = document.getElementById('humanize-input-text')?.value.trim();
    if (!text) {
      showToast('Pega un texto para auditar', 'error');
      return;
    }

    btnRunHumanize.disabled = true;
    btnRunHumanize.innerHTML = '<span>⚡ Auditando con Reglas 2026...</span>';

    try {
      const res = await fetch('/api/ai/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: text })
      });
      const json = await res.json();

      if (json.success && json.data) {
        renderHumanizeAuditResults(json.data);
        showToast('Auditoría completada', 'success');
      }
    } catch (err) {
      showToast('Error auditando: ' + err.message, 'error');
    } finally {
      btnRunHumanize.disabled = false;
      btnRunHumanize.innerHTML = '<span>🔍 Auditar y Humanizar Texto</span>';
    }
  }

  function handleApplyHumanized() {
    const outText = document.getElementById('humanize-output-text')?.value.trim();
    if (outText) {
      postContent.value = outText;
      updateLivePreviews();
      closeAi();
      showToast('Texto humanizado insertado en el editor', 'success');
    }
  }

  function bindHumanizerAndCarouselControls() {
    if (btnHumanizeComposer) {
      btnHumanizeComposer.addEventListener('click', handleHumanizeComposer);
    }
    if (btnGenerateCarousel) {
      btnGenerateCarousel.addEventListener('click', handleGenerateCarousel);
    }
    if (btnRunHumanize) {
      btnRunHumanize.addEventListener('click', handleRunHumanize);
    }
    if (btnApplyHumanized) {
      btnApplyHumanized.addEventListener('click', handleApplyHumanized);
    }
  }

  function bindBasicComposerControls() {
    postContent.addEventListener('input', updateLivePreviews);

    // Selección de Plataformas
    document.querySelectorAll('.platform-checkbox').forEach(cb => {
      const input = cb.querySelector('input');
      cb.addEventListener('click', (e) => {
        if (e.target !== input) {
          input.checked = !input.checked;
        }
        cb.classList.toggle('active', input.checked);
      });
    });

    // Formato del Post (Radio Pills)
    document.querySelectorAll('input[name="post_type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.radio-pill').forEach(pill => {
          pill.classList.toggle('active', pill.querySelector('input').checked);
        });
        switchPreviewTab(radio.value === 'story' ? 'story' : 'fb');
        if (typeof window.syncStorySectionsVisibility === 'function') {
          window.syncStorySectionsVisibility();
        }
      });
    });

    // Opciones de Programación
    document.querySelectorAll('input[name="schedule_option"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.schedule-radio').forEach(sr => {
          sr.classList.toggle('active', sr.querySelector('input').checked);
        });

        const customContainer = document.getElementById('custom-date-container');
        const val = radio.value;

        if (val === 'custom') {
          if (customContainer) customContainer.style.display = 'block';
          if (btnSubmitText) btnSubmitText.textContent = 'Agendar Fecha Específica';
        } else if (val === 'now') {
          if (customContainer) customContainer.style.display = 'none';
          if (btnSubmitText) btnSubmitText.textContent = 'Publicar Inmediatamente en Meta';
        } else {
          if (customContainer) customContainer.style.display = 'none';
          if (btnSubmitText) btnSubmitText.textContent = 'Agendar en Próximo Slot Libre';
        }
      });
    });

    // Pestañas de Vista Previa
    document.querySelectorAll('.preview-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        switchPreviewTab(tab.dataset.preview);
      });
    });

    // Subida de Archivos Multimedia
    if (mediaDropzone) {
      mediaDropzone.addEventListener('click', () => mediaFileInput?.click());
      mediaDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mediaDropzone.style.borderColor = 'var(--accent-cyan)';
      });
      mediaDropzone.addEventListener('dragleave', () => {
        mediaDropzone.style.borderColor = 'var(--border-color)';
      });
      mediaDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        mediaDropzone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileUpload(e.dataTransfer.files);
        }
      });
    }

    if (mediaFileInput) {
      mediaFileInput.addEventListener('change', () => {
        if (mediaFileInput.files && mediaFileInput.files.length > 0) {
          handleFileUpload(mediaFileInput.files);
        }
      });
    }

    // Pegado directo de imágenes
    document.addEventListener('paste', handleComposerClipboardPaste);

    // Hashtags Rápidos
    document.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        if (!postContent.value.includes(tag)) {
          postContent.value = postContent.value ? `${postContent.value} ${tag}` : tag;
          updateLivePreviews();
        }
      });
    });

    // Estrategia de Historias
    document.querySelectorAll('input[name="story_strategy"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.story-strategy-selector .radio-pill').forEach(pill => {
          pill.classList.toggle('active', pill.querySelector('input').checked);
        });

        const strat = radio.value;
        setElementDisplay('story-single-timing-wrap', strat === 'single' ? 'block' : 'none');
        setElementDisplay('story-drip3-info-wrap', strat === 'drip3' ? 'block' : 'none');
        setElementDisplay('story-evergreen-info-wrap', strat === 'evergreen' ? 'block' : 'none');
      });
    });

    document.querySelectorAll('input[name="story_schedule_timing"]').forEach(radio => {
      radio.addEventListener('change', () => {
        setElementDisplay('story-custom-datetime-wrap', radio.value === 'custom' ? 'block' : 'none');
      });
    });

    if (btnSubmitPost) {
      btnSubmitPost.addEventListener('click', handlePostSubmission);
    }
  }

  // Abrir Modal IA pre-llenado desde el Radar Proactivo
  window.openAiModalWithPreset = function(accountType, topic, format) {
    if (aiModal) aiModal.style.display = 'flex';
    if (accountType === 'kmarket') {
      switchAiModalTab('kmarket');
      setInputValue('kmarket-prod-name', topic);
      document.getElementById('btn-generate-kmarket-ai')?.click();
    } else if (accountType === 'campina') {
      switchAiModalTab('campina');
      setInputValue('campina-theme', topic);
      setInputValue('campina-format', format || 'reel');
      document.getElementById('btn-generate-campina-ai')?.click();
    } else {
      switchAiModalTab('general');
      setInputValue('ai-topic', topic);
      document.getElementById('btn-generate-ai-copy')?.click();
    }
  };

  function applyLoadedPostFormat(targetType) {
    const formatRadio = document.querySelector(`input[name="post_type"][value="${targetType}"]`);
    if (formatRadio) {
      formatRadio.checked = true;
      document.querySelectorAll('.radio-pill').forEach(pill => {
        pill.classList.toggle('active', pill.querySelector('input')?.value === targetType);
      });
      switchPreviewTab(targetType === 'story' ? 'story' : 'fb');
    }
  }

  function applyLoadedPostPlatforms(platforms) {
    let plats = ['facebook', 'instagram'];
    try {
      plats = Array.isArray(platforms) ? platforms : JSON.parse(platforms || '["facebook","instagram"]');
    } catch (_) {
      // Usar plataformas por defecto
    }
    const chkFb = document.getElementById('platform-fb');
    const chkIg = document.getElementById('platform-ig');
    if (chkFb) {
      chkFb.checked = plats.includes('facebook');
      chkFb.closest('.platform-checkbox')?.classList.toggle('active', chkFb.checked);
    }
    if (chkIg) {
      chkIg.checked = plats.includes('instagram');
      chkIg.closest('.platform-checkbox')?.classList.toggle('active', chkIg.checked);
    }
  }

  function applyLoadedPostSchedule(scheduledAt) {
    if (!scheduledAt) return;
    const customRadio = document.querySelector('input[name="schedule_option"][value="custom"]');
    if (customRadio) {
      customRadio.checked = true;
      document.querySelectorAll('.schedule-radio').forEach(sr => {
        sr.classList.toggle('active', sr.querySelector('input')?.value === 'custom');
      });
    }
    setElementDisplay('custom-date-container', 'block');

    const dtInput = document.getElementById('custom-schedule-datetime');
    if (dtInput) {
      if (typeof window.toChileDatetimeLocalValue === 'function') {
        dtInput.value = window.toChileDatetimeLocalValue(scheduledAt);
      } else {
        const d = new Date(scheduledAt);
        if (!Number.isNaN(d.getTime())) {
          dtInput.value = d.toISOString().slice(0, 16);
        }
      }
    }
    if (btnSubmitText) btnSubmitText.textContent = 'Re-agendar en Meta';
  }

  function applyLoadedPostAccount(accountId) {
    if (!accountId) return;
    const accSelect = document.getElementById('global-account-select');
    if (accSelect) {
      accSelect.value = accountId;
      accSelect.dispatchEvent(new Event('change'));
    }
    if (typeof window.setActiveAccountById === 'function') {
      window.setActiveAccountById(accountId);
    }
  }

  // Cargar una publicación existente directamente en el Redactor
  window.loadPostIntoComposer = function(post) {
    if (!post) return;

    if (postTitle) postTitle.value = post.title || '';
    if (postContent) postContent.value = post.content || '';

    applyLoadedPostFormat(post.post_type || 'feed');
    applyLoadedPostPlatforms(post.platforms);

    let media = [];
    try {
      media = Array.isArray(post.media_urls) ? post.media_urls : JSON.parse(post.media_urls || '[]');
    } catch (_) {
      // Ignorar error de parsing
    }
    ComposerState.mediaFiles = [...media];

    applyLoadedPostSchedule(post.scheduled_at);
    applyLoadedPostAccount(post.account_id);

    if (typeof navigateToTab === 'function') {
      navigateToTab('composer');
    }

    renderMediaPreviews();
    updateLivePreviews();
    if (typeof window.syncStorySectionsVisibility === 'function') {
      window.syncStorySectionsVisibility();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    window._editingScheduledPostId = post.id;
  };

  // Inicialización modular de controles
  bindBasicComposerControls();
  bindDirectAiControls();
  bindFlyerAndWatermarkControls();
  bindResetControls();
  bindAiModalGeneralControls();
  bindKmarketControls();
  bindCampinaControls();
  bindHumanizerAndCarouselControls();
});
