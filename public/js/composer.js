// =============================================================================
// MetaPulse Composer & Mockup Live Controller
// =============================================================================

const ComposerState = {
  mediaFiles: [], // Array de URLs locales/públicas
  selectedWatermarkId: null,
  activePreview: 'fb'
};

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
      const isVideo = firstMedia.match(/\.(mp4|mov|webm)$/i);

      const mediaHtml = isVideo
        ? `<video src="${firstMedia}" controls autoplay muted loop></video>`
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

  postContent.addEventListener('input', updateLivePreviews);
  window.updateComposerPreviews = updateLivePreviews;

  // 2. Selección de Plataformas (Checkboxes con estilo)
  document.querySelectorAll('.platform-checkbox').forEach(cb => {
    const input = cb.querySelector('input');
    cb.addEventListener('click', (e) => {
      if (e.target !== input) {
        input.checked = !input.checked;
      }
      cb.classList.toggle('active', input.checked);
    });
  });

  // 3. Formato del Post (Radio Pills)
  document.querySelectorAll('input[name="post_type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.radio-pill').forEach(pill => {
        pill.classList.toggle('active', pill.querySelector('input').checked);
      });
      // Si seleccionó story, cambiar preview a story
      if (radio.value === 'story') {
        switchPreviewTab('story');
      } else {
        switchPreviewTab('fb');
      }
    });
  });

  // 4. Opciones de Programación
  document.querySelectorAll('input[name="schedule_option"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.schedule-radio').forEach(sr => {
        sr.classList.toggle('active', sr.querySelector('input').checked);
      });

      const customContainer = document.getElementById('custom-date-container');
      const val = radio.value;

      if (val === 'custom') {
        customContainer.style.display = 'block';
        btnSubmitText.textContent = 'Agendar Fecha Específica';
      } else if (val === 'now') {
        customContainer.style.display = 'none';
        btnSubmitText.textContent = 'Publicar Inmediatamente en Meta';
      } else {
        customContainer.style.display = 'none';
        btnSubmitText.textContent = 'Agendar en Próximo Slot Libre';
      }
    });
  });

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

  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchPreviewTab(tab.dataset.preview);
    });
  });

  // 6. Subida de Archivos Multimedia (Drag & Drop + Input)
  mediaDropzone.addEventListener('click', () => mediaFileInput.click());

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

  mediaFileInput.addEventListener('change', () => {
    if (mediaFileInput.files && mediaFileInput.files.length > 0) {
      handleFileUpload(mediaFileInput.files);
    }
  });

  async function handleFileUpload(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    const activeAccountSelect = document.getElementById('global-account-select');
    if (activeAccountSelect && activeAccountSelect.value) {
      formData.append('account_id', activeAccountSelect.value);
      const opt = activeAccountSelect.options[activeAccountSelect.selectedIndex];
      if (opt) {
        formData.append('account_name', opt.getAttribute('data-name') || '');
      }
    }

    showToast('Subiendo archivo(s) multimedia...', 'info');

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (json.success && json.data) {
        json.data.forEach(item => {
          ComposerState.mediaFiles.push(item.url);
        });
        renderMediaPreviews();
        updateLivePreviews();
        if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
        if (window.loadMediaGallery) window.loadMediaGallery();
        showToast('Archivos subidos correctamente', 'success');

        const wmBtn = document.getElementById('btn-watermark-overlay');
        if (wmBtn) wmBtn.style.display = 'inline-flex';

        const storySection = document.getElementById('story-cross-share-section');
        if (storySection) {
          storySection.style.display = 'block';
        }
      } else {
        showToast('Error subiendo media: ' + (json.error || 'Error desconocido'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión al subir: ' + err.message, 'error');
    }
  }

  // Pegado directo de imágenes (Ctrl+V) desde el portapapeles (ej: copiado desde Gemini Web)
  document.addEventListener('paste', (e) => {
    // Si el usuario está pegando texto en un input o textarea, dejar pasar el evento normalmente
    const targetTag = e.target?.tagName?.toLowerCase();
    if (targetTag === 'textarea' || (targetTag === 'input' && e.target?.type !== 'file')) {
      const hasFiles = e.clipboardData?.files && e.clipboardData.files.length > 0;
      if (!hasFiles) return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      handleFileUpload(imageFiles);
      showToast('📋 Imagen pegada desde el portapapeles y cargada al Composer', 'success');
    }
  });

  function renderMediaPreviews() {
    mediaPreviewGrid.innerHTML = '';
    ComposerState.mediaFiles.forEach((url, idx) => {
      const isVideo = url.match(/\.(mp4|mov|webm)$/i);
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
  }

  window.renderMediaPreviews = renderMediaPreviews;
  window.setComposerMedia = function(urls) {
    ComposerState.mediaFiles = Array.isArray(urls) ? [...urls] : [urls];
    renderMediaPreviews();
    updateLivePreviews();
    if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
  };

  // 6.b Generador Directo de Imágenes IA (Flux / Pollinations)
  const chkUseAiImage = document.getElementById('chk-use-ai-image');
  const aiImageControls = document.getElementById('ai-image-controls');
  const btnTriggerDirectImage = document.getElementById('btn-trigger-direct-image');
  const aiImageFormatSelect = document.getElementById('ai-image-format-select');
  const lblUseBaseImage = document.getElementById('lbl-use-base-image');
  const chkUseBaseImage = document.getElementById('chk-use-base-image');
  const btnRedesignWithFlux = document.getElementById('btn-redesign-with-flux');
  const btnCreateAdPoster = document.getElementById('btn-create-ad-poster');
  const btnCampinaFlyerTrigger = document.getElementById('btn-campina-flyer-trigger');
  const btnKmarketDesignerTrigger = document.getElementById('btn-kmarket-designer-trigger');

  function updateBaseImageVisibility() {
    const hasMedia = ComposerState.mediaFiles.length > 0;
    const brand = AppState.config ? (AppState.config.pageName || '') : '';
    const isCampina = brand.toLowerCase().includes('campiña') || brand.toLowerCase().includes('cabaña');
    const isKmarket = brand.toLowerCase().includes('kmarket');

    if (lblUseBaseImage) lblUseBaseImage.style.display = hasMedia ? 'flex' : 'none';
    if (chkUseBaseImage && hasMedia) chkUseBaseImage.checked = true;

    if (btnCampinaFlyerTrigger) {
      btnCampinaFlyerTrigger.style.display = (hasMedia && isCampina) ? 'inline-flex' : 'none';
    }
    if (btnKmarketDesignerTrigger) {
      btnKmarketDesignerTrigger.style.display = (hasMedia && isKmarket) ? 'inline-flex' : 'none';
    }
    if (btnCreateAdPoster) {
      btnCreateAdPoster.style.display = (hasMedia && !isCampina && !isKmarket) ? 'inline-flex' : 'none';
    }
  }

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

  async function generateDirectAiImage(customPrompt = '', forceUseBase = null) {
    const postTitleVal = document.getElementById('post-title')?.value || '';
    const postContentVal = document.getElementById('post-content')?.value || '';
    const format = aiImageFormatSelect?.value || 'feed';

    const finalPrompt = customPrompt || postTitleVal || postContentVal.slice(0, 120);
    if (!finalPrompt.trim() && !ComposerState.mediaFiles.length) {
      showToast('Escribe el título o producto de tu post, o sube una imagen de base', 'error');
      return;
    }

    // Verificar si se usará la imagen actual como base (Image-to-Image)
    const shouldUseBase = forceUseBase !== null ? forceUseBase : (chkUseBaseImage?.checked && ComposerState.mediaFiles.length > 0);
    const baseImageUrl = shouldUseBase && ComposerState.mediaFiles.length > 0 ? ComposerState.mediaFiles[0] : null;

    if (btnTriggerDirectImage) {
      btnTriggerDirectImage.disabled = true;
      btnTriggerDirectImage.innerHTML = '⚡ Creando con Gemini Flash Lite...';
    }
    if (btnRedesignWithFlux) {
      btnRedesignWithFlux.disabled = true;
      btnRedesignWithFlux.textContent = '⚡ Rediseñando...';
    }

    if (baseImageUrl) {
      showToast('Diseñando afiche publicitario con Gemini Flash Lite...', 'info');
    } else {
      showToast('Generando imagen con Gemini Flash Lite (Económico)...', 'info');
    }

    try {
      const isKmarket = (AppState.config?.pageName || '').toLowerCase().includes('kmarket');
      const endpoint = (isKmarket && (baseImageUrl || finalPrompt))
        ? '/api/ai/kmarket-designer-poster'
        : '/api/ai/generate-image';

      const payload = endpoint === '/api/ai/kmarket-designer-poster'
        ? { baseImageUrl, productName: (finalPrompt.length > 50 ? '' : finalPrompt), extraNotes: '', scannedData: (typeof currentScannedProduct !== 'undefined' ? currentScannedProduct : null) }
        : { prompt: finalPrompt || 'Korean product advertising poster 4:5', format, model: 'gemini-3.1-flash-image', baseImageUrl };

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
      if (btnTriggerDirectImage) {
        btnTriggerDirectImage.disabled = false;
        btnTriggerDirectImage.innerHTML = '✨ Generar Imagen Ahora';
      }
      if (btnRedesignWithFlux) {
        btnRedesignWithFlux.disabled = false;
        btnRedesignWithFlux.textContent = '🎨 Rediseñar Foto';
      }
    }
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

  // Creador de Póster Publicitario 4:5 (Sharp + Overlays Vectoriales)
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

  // =========================================================================
  // MODALES ESPECIALIZADOS: CABAÑAS LA CAMPIÑA Y KMARKET ALGARROBO
  // =========================================================================

  // A. Cabañas La Campiña: Maquetador Editorial 4:5 sobre Foto Real ($0)
  const modalCampinaFlyer = document.getElementById('modal-campina-flyer');
  const btnCloseCampinaFlyer = document.getElementById('btn-close-campina-flyer');
  const btnCancelCampinaFlyer = document.getElementById('btn-cancel-campina-flyer');
  const btnSubmitCampinaFlyer = document.getElementById('btn-submit-campina-flyer');

  const closeCampinaModal = () => { if (modalCampinaFlyer) modalCampinaFlyer.style.display = 'none'; };
  if (btnCloseCampinaFlyer) btnCloseCampinaFlyer.addEventListener('click', closeCampinaModal);
  if (btnCancelCampinaFlyer) btnCancelCampinaFlyer.addEventListener('click', closeCampinaModal);

  if (btnCampinaFlyerTrigger) {
    btnCampinaFlyerTrigger.addEventListener('click', () => {
      if (ComposerState.mediaFiles.length === 0) {
        showToast('Sube primero tu foto real de La Campiña para maquetar el flyer', 'error');
        return;
      }

      // Pre-llenar con titular o texto del post
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

  // B. Kmarket Algarrobo: Diseñador Gráfico Senior 4:5 (Gemini 3 Pro)
  const modalKmarketDesigner = document.getElementById('modal-kmarket-designer');
  const btnCloseKmarketDesigner = document.getElementById('btn-close-kmarket-designer');
  const btnCancelKmarketDesigner = document.getElementById('btn-cancel-kmarket-designer');
  const btnSubmitKmarketDesigner = document.getElementById('btn-submit-kmarket-designer');

  const closeKmarketModal = () => { if (modalKmarketDesigner) modalKmarketDesigner.style.display = 'none'; };
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

  window.generateDirectAiImage = generateDirectAiImage;

  // 7. Chips de Hashtags Rápidos
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      if (!postContent.value.includes(tag)) {
        postContent.value = postContent.value ? `${postContent.value} ${tag}` : tag;
        updateLivePreviews();
      }
    });
  });

  // 8. Botón de Estampar Marca de Agua en Composer
  const btnWatermarkOverlay = document.getElementById('btn-watermark-overlay');
  if (btnWatermarkOverlay) {
    btnWatermarkOverlay.addEventListener('click', async () => {
      if (ComposerState.mediaFiles.length === 0) {
        showToast('Debes tener al menos una imagen subida', 'error');
        return;
      }
      showToast('Aplicando logotipo/marca de agua...', 'info');
      try {
        const targetImage = ComposerState.mediaFiles[0];
        const res = await fetch('/api/watermark/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePath: targetImage,
            position: 'bottom-right',
            opacity: 0.85,
            scalePercent: 18
          })
        });
        const json = await res.json();
        if (json.success && json.data) {
          ComposerState.mediaFiles[0] = json.data.relativeUrl;
          renderMediaPreviews();
          updateLivePreviews();
          showToast('¡Logotipo estampado con éxito!', 'success');
        } else {
          showToast('Error aplicando marca de agua: ' + (json.error || 'Asegúrate de subir un logo primero'), 'error');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  // Control de compartir también como Historia (Story 9:16)
  const chkAlsoShareStory = document.getElementById('chk-also-share-story');
  const storyTimingBox = document.getElementById('story-timing-box');
  const storyCustomDatetimeWrap = document.getElementById('story-custom-datetime-wrap');

  if (chkAlsoShareStory && storyTimingBox) {
    chkAlsoShareStory.addEventListener('change', () => {
      storyTimingBox.style.display = chkAlsoShareStory.checked ? 'block' : 'none';
    });
  }

  document.querySelectorAll('input[name="story_schedule_timing"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (storyCustomDatetimeWrap) {
        storyCustomDatetimeWrap.style.display = radio.value === 'custom' ? 'block' : 'none';
      }
    });
  });

  // 9. Enviar / Agendar Publicación
  btnSubmitPost.addEventListener('click', async () => {
    const content = postContent.value.trim();
    const title = postTitle.value.trim();
    const platforms = [];

    if (document.getElementById('platform-fb').checked) platforms.push('facebook');
    if (document.getElementById('platform-ig').checked) platforms.push('instagram');

    if (platforms.length === 0) {
      showToast('Debes seleccionar al menos una plataforma (Facebook o Instagram)', 'error');
      return;
    }

    if (!content && ComposerState.mediaFiles.length === 0) {
      showToast('Escribe texto o sube una imagen/video para tu publicación', 'error');
      return;
    }

    const postTypeRadio = document.querySelector('input[name="post_type"]:checked');
    const postType = postTypeRadio ? postTypeRadio.value : 'feed';

    const scheduleOptionRadio = document.querySelector('input[name="schedule_option"]:checked');
    const scheduleOption = scheduleOptionRadio ? scheduleOptionRadio.value : 'next_slot';

    let customSchedule = null;
    if (scheduleOption === 'custom') {
      customSchedule = document.getElementById('custom-schedule-datetime').value;
      if (!customSchedule) {
        showToast('Selecciona la fecha y hora de publicación', 'error');
        return;
      }
    }

    const alsoShareStory = Boolean(chkAlsoShareStory?.checked && postType !== 'story');
    const storyTimingRule = document.querySelector('input[name="story_schedule_timing"]:checked')?.value || 'same_time';
    const storyCustomDatetime = document.getElementById('story-custom-datetime')?.value || null;

    btnSubmitPost.disabled = true;
    showToast('Procesando solicitud de publicación...', 'info');

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          platforms,
          post_type: postType,
          media_urls: ComposerState.mediaFiles,
          schedule_type: scheduleOption,
          scheduled_at: customSchedule,
          also_share_story: alsoShareStory,
          story_timing_rule: storyTimingRule,
          story_custom_datetime: storyCustomDatetime
        })
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || '¡Publicación procesada con éxito!', 'success');
        // Limpiar composer
        postContent.value = '';
        postTitle.value = '';
        if (chkAlsoShareStory) chkAlsoShareStory.checked = false;
        if (storyTimingBox) storyTimingBox.style.display = 'none';
        ComposerState.mediaFiles = [];
        renderMediaPreviews();
        updateLivePreviews();
        loadDashboardStatus();
        navigateToTab('queue');
      } else {
        showToast('Error: ' + (json.error || 'No se pudo guardar la publicación'), 'error');
      }
    } catch (err) {
      showToast('Error de conexión: ' + err.message, 'error');
    } finally {
      btnSubmitPost.disabled = false;
    }
  });

  // Limpiar Composer
  btnClearComposer.addEventListener('click', () => {
    postContent.value = '';
    postTitle.value = '';
    if (chkAlsoShareStory) chkAlsoShareStory.checked = false;
    if (storyTimingBox) storyTimingBox.style.display = 'none';
    postTitle.value = '';
    ComposerState.mediaFiles = [];
    renderMediaPreviews();
    updateLivePreviews();
    showToast('Composer limpiado', 'info');
  });

  // ==========================================
  // MODAL ASISTENTE IA & GENERADOR ESPECIALIZADO
  // ==========================================
  const aiModal = document.getElementById('ai-modal');
  const btnOpenAiModal = document.getElementById('btn-open-ai-modal');
  const btnCloseAiModal = document.getElementById('btn-close-ai-modal');
  const btnCancelAi = document.getElementById('btn-cancel-ai');
  const btnGenerateAiCopy = document.getElementById('btn-generate-ai-copy');
  const btnGenerateKmarketAi = document.getElementById('btn-generate-kmarket-ai');
  const btnGenerateCampinaAi = document.getElementById('btn-generate-campina-ai');
  const aiResultBox = document.getElementById('ai-result-box');
  const aiGeneratedText = document.getElementById('ai-generated-text');
  const btnApplyAiCopy = document.getElementById('btn-apply-ai-copy');
  const btnCopyImagePrompt = document.getElementById('btn-copy-image-prompt');
  const kmarketImagePromptBox = document.getElementById('kmarket-image-prompt-box');
  const kmarketImagePromptText = document.getElementById('kmarket-image-prompt-text');

  // Función para cambiar de pestaña en el Modal IA
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
  }

  document.querySelectorAll('.preview-tab[data-ai-mode]').forEach(tab => {
    tab.addEventListener('click', () => {
      switchAiModalTab(tab.dataset.aiMode);
    });
  });

  // Abrir Modal adaptado a la cuenta activa
  btnOpenAiModal.addEventListener('click', () => {
    aiModal.style.display = 'flex';
    const brand = AppState.config ? (AppState.config.pageName || '') : '';
    if (brand.toLowerCase().includes('kmarket')) {
      switchAiModalTab('kmarket');
    } else if (brand.toLowerCase().includes('campiña') || brand.toLowerCase().includes('cabaña')) {
      switchAiModalTab('campina');
    } else {
      switchAiModalTab('general');
    }
  });

  const closeAi = () => { aiModal.style.display = 'none'; };
  btnCloseAiModal.addEventListener('click', closeAi);
  btnCancelAi.addEventListener('click', closeAi);

  // 1. Generador General
  if (btnGenerateAiCopy) {
    btnGenerateAiCopy.addEventListener('click', async () => {
      const topic = document.getElementById('ai-topic').value.trim();
      const tone = document.getElementById('ai-tone').value;
      const goal = document.getElementById('ai-goal').value;
      const customInstructions = document.getElementById('ai-custom-inst').value.trim();

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
          aiGeneratedText.value = json.data.fullPost;
          aiResultBox.style.display = 'block';
          btnApplyAiCopy.style.display = 'inline-flex';
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
    });
  }

  // 2. Generador Especializado Kmarket (Diseño 4:5 + Copy)
  if (btnGenerateKmarketAi) {
    btnGenerateKmarketAi.addEventListener('click', async () => {
      const prodName = document.getElementById('kmarket-prod-name').value.trim();
      const prodDesc = document.getElementById('kmarket-prod-desc').value.trim();

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
          // Mostrar Prompt Maestro de Imagen
          kmarketImagePromptText.value = json.data.masterImagePrompt;
          kmarketImagePromptBox.style.display = 'block';

          // Mostrar Copy del Post
          aiGeneratedText.value = json.data.postCopy;
          aiResultBox.style.display = 'block';
          btnApplyAiCopy.style.display = 'inline-flex';

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
    });
  }

  // Copiar Prompt de Imagen al portapapeles
  if (btnCopyImagePrompt) {
    btnCopyImagePrompt.addEventListener('click', async () => {
      if (!kmarketImagePromptText.value) return;
      try {
        await navigator.clipboard.writeText(kmarketImagePromptText.value);
        showToast('📋 ¡Prompt copiado al portapapeles! Pégalo en Gemini / Midjourney', 'success');
        btnCopyImagePrompt.textContent = '✅ ¡Copiado!';
        setTimeout(() => { btnCopyImagePrompt.textContent = '📋 Copiar Prompt'; }, 2500);
      } catch (e) {
        kmarketImagePromptText.select();
        document.execCommand('copy');
        showToast('📋 ¡Prompt copiado al portapapeles!', 'success');
      }
    });
  }

  // =======================================================
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

  // Si la imagen falla al cargar, evitar que muestre el ícono de imagen rota
  if (kmarketScanImg) {
    kmarketScanImg.onerror = () => {
      kmarketScanImg.style.display = 'none';
      if (kmarketScanPlaceholder) kmarketScanPlaceholder.style.display = 'block';
    };
  }

  // Si ya hay foto en el Composer al abrir la pestaña de Kmarket, sincronizarla
  function syncKmarketModalThumb() {
    if (ComposerState.mediaFiles && ComposerState.mediaFiles.length > 0) {
      kmarketScannedImagePath = ComposerState.mediaFiles[0];
      if (kmarketScanImg) {
        kmarketScanImg.src = kmarketScannedImagePath;
        kmarketScanImg.style.display = 'block';
      }
      if (kmarketScanPlaceholder) kmarketScanPlaceholder.style.display = 'none';
      if (kmarketScanStatus) kmarketScanStatus.textContent = 'Foto cargada desde el Composer. Lista para escanear.';
    }
  }

  // Al seleccionar foto local
  if (kmarketScanFileInput) {
    kmarketScanFileInput.addEventListener('change', async () => {
      if (!kmarketScanFileInput.files || kmarketScanFileInput.files.length === 0) return;
      const file = kmarketScanFileInput.files[0];

      // 1. Mostrar preview local INMEDIATO para evitar cualquier símbolo de imagen rota
      try {
        const localPreviewUrl = URL.createObjectURL(file);
        if (kmarketScanImg) {
          kmarketScanImg.src = localPreviewUrl;
          kmarketScanImg.style.display = 'block';
        }
        if (kmarketScanPlaceholder) kmarketScanPlaceholder.style.display = 'none';
      } catch (_) {}

      if (kmarketScanStatus) kmarketScanStatus.textContent = `Subiendo foto de ${file.name}...`;

      const formData = new FormData();
      formData.append('files', file);

      try {
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData
        });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const uploadedUrl = json.data[0].url || json.data[0].filepath;
          kmarketScannedImagePath = uploadedUrl;
          if (kmarketScanImg) {
            kmarketScanImg.src = uploadedUrl;
            kmarketScanImg.style.display = 'block';
          }
          if (kmarketScanPlaceholder) kmarketScanPlaceholder.style.display = 'none';
          if (kmarketScanStatus) {
            kmarketScanStatus.innerHTML = `✅ Foto lista (${file.name}). Haz clic en <strong>"Escanear e Investigar Producto"</strong>.`;
          }

          // Sincronizar también con Composer para que no se pierda
          if (!ComposerState.mediaFiles.includes(uploadedUrl)) {
            ComposerState.mediaFiles.unshift(uploadedUrl);
            renderMediaPreviews();
            updateLivePreviews();
          }

          showToast('Foto cargada. Presiona "Escanear e Investigar Producto".', 'success');
        } else {
          showToast('Error al subir: ' + (json.error || 'Error desconocido'), 'error');
          if (kmarketScanStatus) kmarketScanStatus.textContent = 'Error subiendo foto.';
        }
      } catch (err) {
        showToast('Error subiendo foto: ' + err.message, 'error');
        if (kmarketScanStatus) kmarketScanStatus.textContent = 'Error subiendo foto.';
      }
    });
  }

  // 1. Escanear e Investigar Producto en Internet
  if (btnScanProductAuto) {
    btnScanProductAuto.addEventListener('click', async () => {
      const targetPath = kmarketScannedImagePath || (ComposerState.mediaFiles && ComposerState.mediaFiles.length > 0 ? ComposerState.mediaFiles[0] : null);
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
          const d = json.data;
          currentScannedProduct = d; // Guardar datos para enriquecer el afiche 4:5

          // Rellenar ficha del producto
          const nameInput = document.getElementById('kmarket-prod-name');
          const descInput = document.getElementById('kmarket-prod-desc');
          if (nameInput) nameInput.value = d.productName || '';
          if (descInput) descInput.value = d.details || '';

          // Rellenar Copy del Post
          if (aiGeneratedText) aiGeneratedText.value = d.copyPost || '';
          if (aiResultBox) aiResultBox.style.display = 'block';
          if (btnApplyAiCopy) btnApplyAiCopy.style.display = 'inline-flex';

          if (kmarketScanStatus) {
            kmarketScanStatus.innerHTML = `<strong class="text-emerald">✅ ${d.brand || ''} - ${d.productName || ''}</strong> (${d.category || ''})`;
          }

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
    });
  }

  // 2. Generar Afiche Publicitario 4:5 Ahora (Gemini Flash Lite)
  if (btnGenerateKmarketDirectPoster) {
    btnGenerateKmarketDirectPoster.addEventListener('click', async () => {
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
            extraNotes: '',
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
    });
  }

  // Botón secundario en caja de prompt maestro
  if (btnModalGenerateFlux && btnGenerateKmarketDirectPoster) {
    btnModalGenerateFlux.addEventListener('click', () => {
      btnGenerateKmarketDirectPoster.click();
    });
  }

  // Botón para abrir Gemini Web en ventana auxiliar compacta
  const btnOpenGeminiWebFloating = document.getElementById('btn-open-gemini-web-floating');
  if (btnOpenGeminiWebFloating) {
    btnOpenGeminiWebFloating.addEventListener('click', async () => {
      const prodName = document.getElementById('kmarket-prod-name')?.value.trim() || 'este producto';
      const promptToCopy = `necesito que te comportes como un diseñador grafico senior experto en marketing. hacer una imagen publicitaria de este producto (${prodName}) de dimensiones 4:5 vertical para instagram , usar una fuente similar a la del producto, pero dinamica y el subtitulo con una fuente de menor tamaño pero tambien elegante y un diseño similar para poner el titulo de lo que es, buscar info online del producto e imagenes de referencia de este mismo (es decir no usar exactamente la imagen que te di) . Todo texto en español. No hacer referencia a ninguna tienda en especial. ni poner nada como comprar ahora . no dar tanto enfasis a lo de "sabor coreano" ni a la marca, si es que, solo de manera pequeña`;

      try {
        await navigator.clipboard.writeText(promptToCopy);
        showToast('📋 ¡Prompt copiado al portapapeles! Abre Gemini Web, adjunta la foto y pega (Ctrl+V).', 'success');
      } catch (_) {}

      window.open('https://gemini.google.com', 'GeminiWebAssistant', 'width=760,height=880,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes');
    });
  }

  // Sincronizar información en vivo con www.cabanaslacampina.cl
  const btnSyncCampinaWeb = document.getElementById('btn-sync-campina-web');
  if (btnSyncCampinaWeb) {
    btnSyncCampinaWeb.addEventListener('click', async () => {
      btnSyncCampinaWeb.disabled = true;
      btnSyncCampinaWeb.textContent = '🔄 Escaneando...';
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
        btnSyncCampinaWeb.disabled = false;
        btnSyncCampinaWeb.textContent = '🔄 Sincronizar Web';
      }
    });
  }

  // 3. Generador Especializado La Campiña (Reels & Fechas)
  if (btnGenerateCampinaAi) {
    btnGenerateCampinaAi.addEventListener('click', async () => {
      const theme = document.getElementById('campina-theme').value.trim();
      const format = document.getElementById('campina-format').value;
      const targetDate = document.getElementById('campina-date').value.trim();

      if (!theme) {
        showToast('Ingresa el tema o enfoque (ej: Asado en quincho privado, descanso en suites...)', 'error');
        return;
      }

      btnGenerateCampinaAi.disabled = true;
      btnGenerateCampinaAi.innerHTML = '<span>⚡ Generando Guión y Copy con Gemini...</span>';

      try {
        const res = await fetch('/api/ai/campina-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme, format, targetDate })
        });
        const json = await res.json();

        if (json.success && json.data) {
          aiGeneratedText.value = json.data.content;
          aiResultBox.style.display = 'block';
          btnApplyAiCopy.style.display = 'inline-flex';
          showToast('¡Guión y Copy para La Campiña generados con éxito!', 'success');
        } else {
          showToast('Error: ' + json.error, 'error');
        }
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      } finally {
        btnGenerateCampinaAi.disabled = false;
        btnGenerateCampinaAi.innerHTML = '<span>🏡 Generar Guión y Copy La Campiña</span>';
      }
    });
  }

  // Aplicar texto generado en el editor
  btnApplyAiCopy.addEventListener('click', () => {
    postContent.value = aiGeneratedText.value;
    updateLivePreviews();
    closeAi();
    showToast('Copy insertado en el editor', 'success');
  });

  // Abrir Modal IA pre-llenado desde el Radar Proactivo
  window.openAiModalWithPreset = function(accountType, topic, format) {
    aiModal.style.display = 'flex';
    if (accountType === 'kmarket') {
      switchAiModalTab('kmarket');
      document.getElementById('kmarket-prod-name').value = topic;
      document.getElementById('btn-generate-kmarket-ai').click();
    } else if (accountType === 'campina') {
      switchAiModalTab('campina');
      document.getElementById('campina-theme').value = topic;
      document.getElementById('campina-format').value = format || 'reel';
      document.getElementById('btn-generate-campina-ai').click();
    } else {
      switchAiModalTab('general');
      document.getElementById('ai-topic').value = topic;
      document.getElementById('btn-generate-ai-copy').click();
    }
  };
  // =========================================================================
  // INSTAGRAM SKILLS 2026: CARRUSEL & HUMANIZADOR
  // =========================================================================

  // 1. Botón Auditar / Humanizar en el Header del Composer
  const btnHumanizeComposer = document.getElementById('btn-humanize-composer');
  if (btnHumanizeComposer) {
    btnHumanizeComposer.addEventListener('click', async () => {
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
    });
  }

  // 2. Generador de Carrusel Slide a Slide
  const btnGenerateCarousel = document.getElementById('btn-generate-carousel');
  if (btnGenerateCarousel) {
    btnGenerateCarousel.addEventListener('click', async () => {
      const topic = document.getElementById('carousel-topic').value.trim();
      const slidesCount = document.getElementById('carousel-slides-count').value;
      const goal = document.getElementById('carousel-goal').value;

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
          const d = json.data;
          const container = document.getElementById('carousel-results-box');
          container.style.display = 'block';

          container.innerHTML = `
            <div style="background:var(--bg-surface-subtle); padding:10px 12px; border-radius:var(--radius-xs); border:1px solid var(--border-subtle); margin-bottom:10px;">
              <h4 style="margin:0 0 8px 0; font-size:0.95rem; color:var(--text-primary);">📑 ${d.title}</h4>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:10px;">🎵 Audio recomendado: <strong>${d.recommendedAudio || 'Instrumental'}</strong></div>
              <div style="display:flex; flex-direction:column; gap:8px;">
                ${(d.slides || []).map(s => `
                  <div style="background:var(--bg-surface); padding:8px 10px; border-radius:4px; border-left:3px solid var(--primary); font-size:0.78rem;">
                    <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--primary); margin-bottom:2px;">
                      <span>Slide ${s.slideNumber}: ${s.headline || ''}</span>
                    </div>
                    <div style="color:var(--text-secondary); margin-bottom:3px;">${s.subtext || ''}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted); font-style:italic;">📸 Visual: ${s.visualIdea || ''}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;

          aiGeneratedText.value = d.caption || '';
          aiResultBox.style.display = 'block';
          btnApplyAiCopy.style.display = 'inline-flex';
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
    });
  }

  // 3. Humanizador en el Modal de IA
  const btnRunHumanize = document.getElementById('btn-run-humanize');
  const btnApplyHumanized = document.getElementById('btn-apply-humanized');
  if (btnRunHumanize) {
    btnRunHumanize.addEventListener('click', async () => {
      const text = document.getElementById('humanize-input-text').value.trim();
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
          const d = json.data;
          document.getElementById('humanize-audit-box').style.display = 'block';
          const scoreBadge = document.getElementById('humanize-score-badge');
          if (scoreBadge) {
            scoreBadge.textContent = `${d.score}/100 pts`;
            scoreBadge.style.background = d.score >= 80 ? '#10b981' : d.score >= 50 ? '#f59e0b' : '#ef4444';
          }

          const list = document.getElementById('humanize-issues-list');
          if (list) {
            list.innerHTML = (d.issues || []).length > 0
              ? d.issues.map(iss => `<li>${iss}</li>`).join('')
              : '<li style="color:#10b981;">✅ ¡Texto limpio, sin guiones largos ni frases de robot!</li>';
          }

          const outEl = document.getElementById('humanize-output-text');
          if (outEl) outEl.value = d.humanized;
          showToast('Auditoría completada', 'success');
        }
      } catch (err) {
        showToast('Error auditando: ' + err.message, 'error');
      } finally {
        btnRunHumanize.disabled = false;
        btnRunHumanize.innerHTML = '<span>🔍 Auditar y Humanizar Texto</span>';
      }
    });
  }

  if (btnApplyHumanized) {
    btnApplyHumanized.addEventListener('click', () => {
      const outText = document.getElementById('humanize-output-text').value.trim();
      if (outText) {
        postContent.value = outText;
        updateLivePreviews();
        closeAi();
        showToast('Texto humanizado insertado en el editor', 'success');
      }
    });
  }
});

