/**
 * batchScheduler.js - MetaPulse Suite
 * Manejador del Importador y Programador en Lote (Batch Autopilot)
 * Procesa afiches de Gemini Web, estampa el sello oficial de Kmarket,
 * redacta los copies con formato oficial y los agenda en slots libres del calendario.
 * 
 * Funcionalidades añadidas:
 * - Selección de estrategias de historias (Single, Drip 3, Evergreen) y extensión mensual (Campiña)
 * - Estampado individual de logo con el modal interactivo en cada afiche
 * - Selector de música y renderizador FFmpeg para convertir afiches en videos MP4 con audio real
 */

(function () {
  let currentBatchItems = [];

  // Estado del modal de música para el lote
  const batchMusicState = {
    currentItemId: null,
    selectedTrack: null,
    format: 'feed',
    duration: 15,
    startTime: 0,
    catalog: [],
    audioPlayer: new Audio(),
    isPlaying: false
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  window.openBatchModal = function openBatchModal() {
    const modal = getEl('modal-batch-autopilot');
    if (!modal) return;
    if (typeof window.updateActiveAccountBadges === 'function') {
      window.updateActiveAccountBadges();
    }
    modal.style.display = 'flex';
    resetBatchViews();
  };

  window.closeBatchModal = function closeBatchModal() {
    const modal = getEl('modal-batch-autopilot');
    if (!modal) return;
    modal.style.display = 'none';
    closeBatchMusicModal();
  };

  function resetBatchViews() {
    currentBatchItems = [];
    const stepUpload = getEl('batch-step-upload');
    const stepProcessing = getEl('batch-step-processing');
    const stepReview = getEl('batch-step-review');
    const btnConfirmSchedule = getEl('btn-confirm-batch-schedule');
    const itemsContainer = getEl('batch-items-container');
    const fileInput = getEl('batch-file-input');

    if (stepUpload) stepUpload.style.display = 'block';
    if (stepProcessing) stepProcessing.style.display = 'none';
    if (stepReview) stepReview.style.display = 'none';
    if (btnConfirmSchedule) btnConfirmSchedule.style.display = 'none';
    if (itemsContainer) itemsContainer.innerHTML = '';
    if (fileInput) fileInput.value = '';
  }

  // Delegación de eventos para apertura y cierre de modales
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-open-batch-autopilot') || e.target.closest('#btn-planner-batch-autopilot')) {
      e.preventDefault();
      openBatchModal();
    }
    if (e.target.closest('#btn-close-batch-modal') || e.target.closest('#btn-cancel-batch')) {
      e.preventDefault();
      closeBatchModal();
    }
    if (e.target.closest('#btn-batch-add-more')) {
      e.preventDefault();
      const fileInput = getEl('batch-file-input');
      if (fileInput) fileInput.click();
    }
    if (e.target.closest('#btn-confirm-batch-schedule')) {
      e.preventDefault();
      confirmAndScheduleBatch();
    }

    // Modal de música en lote: cerrar o cancelar
    if (e.target.closest('#btn-close-batch-music-modal') || e.target.closest('#btn-cancel-batch-music')) {
      e.preventDefault();
      closeBatchMusicModal();
    }
  });

  // Manejo de opciones de historias en lote (Toggle general, estrategias y timings)
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'batch-chk-create-stories') {
      const detailsBox = getEl('batch-story-config-details');
      if (detailsBox) detailsBox.style.display = e.target.checked ? 'block' : 'none';
    }

    if (e.target && e.target.name === 'batch_story_strategy') {
      const strategy = e.target.value;
      // Actualizar pills activas
      document.querySelectorAll('input[name="batch_story_strategy"]').forEach(radio => {
        const pill = radio.closest('.radio-pill');
        if (pill) pill.classList.toggle('active', radio.checked);
      });

      const singleWrap = getEl('batch-story-single-timing-wrap');
      const drip3Info = getEl('batch-story-drip3-info');
      const evergreenInfo = getEl('batch-story-evergreen-info');

      if (singleWrap) singleWrap.style.display = strategy === 'single' ? 'block' : 'none';
      if (drip3Info) drip3Info.style.display = strategy === 'drip3' ? 'block' : 'none';
      if (evergreenInfo) evergreenInfo.style.display = strategy === 'evergreen' ? 'block' : 'none';
    }

    if (e.target && e.target.name === 'batch_story_timing') {
      document.querySelectorAll('input[name="batch_story_timing"]').forEach(radio => {
        const pill = radio.closest('.radio-pill');
        if (pill) pill.classList.toggle('active', radio.checked);
      });
    }

    if (e.target && e.target.name === 'batch_video_format') {
      batchMusicState.format = e.target.value;
      document.querySelectorAll('input[name="batch_video_format"]').forEach(radio => {
        const pill = radio.closest('.radio-pill');
        if (pill) pill.classList.toggle('active', radio.checked);
      });
    }
  });

  // Inicialización de Drag & Drop y file input
  function setupFileInputs() {
    const dropzone = getEl('batch-dropzone');
    const fileInput = getEl('batch-file-input');

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = '#4f46e5';
          dropzone.style.background = 'rgba(99, 102, 241, 0.08)';
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = 'var(--primary)';
          dropzone.style.background = 'rgba(99, 102, 241, 0.03)';
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          handleBatchFiles(Array.from(files));
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          handleBatchFiles(Array.from(files));
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFileInputs);
  } else {
    setupFileInputs();
  }

  /**
   * Envía las imágenes seleccionadas al backend para estampar sellos,
   * analizar con visión y generar copies en lote.
   */
  async function handleBatchFiles(files) {
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      if (typeof showToast === 'function') showToast('Por favor selecciona archivos de imagen válidos (JPG, PNG, WebP).', 'warning');
      return;
    }

    const stepUpload = getEl('batch-step-upload');
    const stepProcessing = getEl('batch-step-processing');
    const stepReview = getEl('batch-step-review');
    const btnConfirmSchedule = getEl('btn-confirm-batch-schedule');

    if (stepUpload) stepUpload.style.display = 'none';
    if (stepReview) stepReview.style.display = 'none';
    if (stepProcessing) stepProcessing.style.display = 'block';

    const progressTitle = getEl('batch-progress-title');
    const progressSub = getEl('batch-progress-sub');
    if (progressTitle) progressTitle.textContent = `Procesando lote de ${validImages.length} afiches...`;
    if (progressSub) progressSub.textContent = 'Estampando sellos oficiales Kmarket, redactando copies y calculando slots libres...';

    try {
      const formData = new FormData();
      validImages.forEach(file => {
        formData.append('files', file);
      });

      const res = await fetch('/api/batch/process-images', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();

      if (json.success && json.items && json.items.length > 0) {
        currentBatchItems = json.items.map(item => ({
          ...item,
          originalImageUrl: item.imageUrl,
          isVideo: false,
          post_type: 'feed'
        }));

        renderReviewCards(currentBatchItems);

        if (stepProcessing) stepProcessing.style.display = 'none';
        if (stepReview) stepReview.style.display = 'block';
        if (btnConfirmSchedule) btnConfirmSchedule.style.display = 'inline-flex';

        if (typeof showToast === 'function') {
          showToast(`¡Lote procesado con éxito! Se redactaron ${json.items.length} publicaciones.`, 'success');
        }
      } else {
        throw new Error(json.error || 'No se pudo procesar el lote de imágenes');
      }
    } catch (err) {
      console.error('[Batch Autopilot Error]', err);
      if (typeof showToast === 'function') showToast('Error al procesar lote: ' + err.message, 'error');
      if (stepProcessing) stepProcessing.style.display = 'none';
      if (stepUpload) stepUpload.style.display = 'block';
    }
  }

  /**
   * Renderiza las tarjetas interactivas de revisión para cada publicación
   * Incluye estampar logo interactivo y poner música / convertir a video
   */
  function renderReviewCards(items) {
    const itemsContainer = getEl('batch-items-container');
    const reviewSummary = getEl('batch-review-summary');
    if (!itemsContainer) return;
    itemsContainer.innerHTML = '';

    if (reviewSummary) {
      reviewSummary.textContent = `${items.length} publicaciones listas para agendar`;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'card batch-post-card';
      card.dataset.itemId = item.id;
      card.style.border = '1px solid var(--border-subtle)';
      card.style.borderRadius = '10px';
      card.style.background = 'var(--bg-surface)';
      card.style.padding = '16px';
      card.style.display = 'grid';
      card.style.gridTemplateColumns = '150px 1fr';
      card.style.gap = '16px';
      card.style.alignItems = 'start';

      let formattedDatetime = '';
      if (item.scheduledAt) {
        try {
          const d = new Date(item.scheduledAt);
          if (!isNaN(d.getTime())) {
            const parts = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Santiago',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).formatToParts(d);
            const p = {};
            parts.forEach(x => { p[x.type] = x.value; });
            formattedDatetime = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
          }
        } catch (_) {
          formattedDatetime = item.scheduledAt.slice(0, 16);
        }
      }

      const isVideo = Boolean(item.isVideo);
      const isStory = item.post_type === 'story';

      let mediaHtml = '';
      if (isVideo) {
        mediaHtml = `<video src="${item.imageUrl}" autoplay loop muted playsinline class="batch-card-thumb-video" style="width:100%; height:100%; object-fit:${isStory ? 'contain' : 'cover'};"></video>`;
      } else {
        mediaHtml = `<img src="${item.imageUrl}" alt="${escapeHtml(item.productName)}" class="batch-card-thumb-img" style="width:100%; height:100%; object-fit:${isStory ? 'contain' : 'cover'};">`;
      }

      const backdropHtml = isStory
        ? `<div style="position:absolute; inset:0; background:url('${item.originalImageUrl || item.imageUrl}') center/cover no-repeat; filter:blur(10px) brightness(0.6); transform:scale(1.2);"></div>`
        : '';

      const badgeHtml = isVideo
        ? `<div class="batch-card-status-badge" style="position:absolute; bottom:6px; right:6px; background:linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:700; z-index:2;">🎬 ${isStory ? 'Historia 16:9' : 'Video Feed'} 🎵</div>`
        : (isStory
            ? `<div class="batch-card-status-badge" style="position:absolute; bottom:6px; right:6px; background:linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:4px; font-weight:700; z-index:2;">📲 Historia 16:9</div>`
            : `<div class="batch-card-status-badge" style="position:absolute; bottom:6px; right:6px; background:rgba(16,185,129,0.9); color:#fff; font-size:0.65rem; padding:2px 5px; border-radius:4px; font-weight:600; z-index:2;">Feed 4:5 ✅</div>`);

      card.innerHTML = `
        <!-- Columna Izquierda: Imagen/Video con acciones rápidas -->
        <div style="display:flex; flex-direction:column; gap:8px; align-items:center;">
          <div class="batch-card-media-wrap" style="position:relative; width:100%; border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle); background:#0f172a; aspect-ratio:${isStory ? '9/16' : '4/5'}; display:flex; align-items:center; justify-content:center; transition:all 0.2s ease;">
            ${backdropHtml}
            <div style="position:relative; z-index:1; width:100%; height:100%; display:flex; align-items:center; justify-content:center; ${isStory ? 'padding:6px;' : ''}">
              ${mediaHtml}
            </div>
            <div style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.75); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700; z-index:2;">
              #${index + 1}
            </div>
            ${badgeHtml}
          </div>

          <!-- Selector de Formato: Post Feed (4:5) vs Historia (16:9) -->
          <div style="width:100%; display:grid; grid-template-columns: 1fr 1fr; gap:4px; background:rgba(15,23,42,0.6); padding:3px; border-radius:6px; border:1px solid rgba(255,255,255,0.08);">
            <button type="button" class="btn btn-xs btn-format-feed" data-id="${item.id}" style="font-size:0.7rem; padding:3px 2px; font-weight:${!isStory ? '700' : '400'}; background:${!isStory ? 'var(--primary, #3b82f6)' : 'transparent'}; color:${!isStory ? '#fff' : 'var(--text-secondary)'}; border:none; border-radius:4px; cursor:pointer;" title="Publicar como post de feed (4:5)">
              📱 Feed
            </button>
            <button type="button" class="btn btn-xs btn-format-story" data-id="${item.id}" style="font-size:0.7rem; padding:3px 2px; font-weight:${isStory ? '700' : '400'}; background:${isStory ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'transparent'}; color:${isStory ? '#fff' : 'var(--text-secondary)'}; border:none; border-radius:4px; cursor:pointer;" title="Publicar como historia vertical 16:9 (sin recortes)">
              📲 Historia
            </button>
          </div>

          <!-- Botones de Acción Multimedia -->
          <div style="width:100%; display:flex; flex-direction:column; gap:6px;">
            <button type="button" class="btn btn-secondary btn-xs btn-batch-stamp-logo" data-id="${item.id}" style="width:100%; font-size:0.75rem; padding:4px 6px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:600;" title="Estampar o reubicar logotipo en esta imagen">
              <span>🎨 Estampar Logo</span>
            </button>

            <button type="button" class="btn btn-secondary btn-xs btn-batch-add-music" data-id="${item.id}" style="width:100%; font-size:0.75rem; padding:4px 6px; display:flex; align-items:center; justify-content:center; gap:5px; font-weight:600; background:linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(139,92,246,0.12) 100%); border-color:rgba(236,72,153,0.4); color:var(--text-primary);" title="Añadir música y convertir en video MP4">
              <span>${isVideo ? '🎵 Cambiar Música' : (isStory ? '🎵 Música & Video 16:9' : '🎵 Poner Música & Video')}</span>
            </button>

            ${isVideo ? `
              <button type="button" class="btn btn-secondary btn-xs btn-batch-revert-image" data-id="${item.id}" style="width:100%; font-size:0.7rem; padding:3px 5px; display:flex; align-items:center; justify-content:center; gap:4px; color:var(--text-secondary);" title="Volver a la imagen fija original">
                <span>↩ Volver a Imagen</span>
              </button>
            ` : ''}
          </div>

          <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; font-weight:600; color:var(--text-primary); margin-top:4px;">
            <input type="checkbox" class="batch-item-toggle" checked data-id="${item.id}">
            <span>Programar</span>
          </label>
        </div>

        <!-- Columna Derecha: Datos editables (Producto, Fecha/Hora, Copy) -->
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div>
              <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; display:block;">Nombre del Producto:</label>
              <input type="text" class="form-control batch-item-title" value="${escapeHtml(item.productName)}" style="font-size:0.85rem; padding:6px 10px;">
            </div>
            <div>
              <label class="form-label" style="font-size:0.75rem; margin-bottom:4px; display:block;">Fecha y Hora de Publicación (Slot):</label>
              <input type="datetime-local" class="form-control batch-item-datetime" value="${formattedDatetime}" style="font-size:0.85rem; padding:6px 10px;">
            </div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <label class="form-label" style="font-size:0.75rem; margin:0;">Texto del Post (Fórmula Oficial Kmarket):</label>
              <span class="text-muted batch-char-counter" style="font-size:0.72rem;">${(item.content || '').length} caracteres</span>
            </div>
            <textarea class="form-control batch-item-content" rows="6" style="font-size:0.82rem; line-height:1.45; font-family:inherit; resize:vertical;">${escapeHtml(item.content || '')}</textarea>
          </div>
        </div>
      `;

      // Contador de caracteres
      const textarea = card.querySelector('.batch-item-content');
      const counter = card.querySelector('.batch-char-counter');
      if (textarea && counter) {
        textarea.addEventListener('input', () => {
          counter.textContent = `${textarea.value.length} caracteres`;
        });
      }

      // Selector de formato: Feed vs Historia
      const btnFeed = card.querySelector('.btn-format-feed');
      if (btnFeed) {
        btnFeed.addEventListener('click', () => {
          if (item.post_type !== 'feed') {
            item.post_type = 'feed';
            renderReviewCards(currentBatchItems);
          }
        });
      }
      const btnStory = card.querySelector('.btn-format-story');
      if (btnStory) {
        btnStory.addEventListener('click', () => {
          if (item.post_type !== 'story') {
            item.post_type = 'story';
            renderReviewCards(currentBatchItems);
          }
        });
      }

      // Checkbox de habilitar post
      const toggle = card.querySelector('.batch-item-toggle');
      if (toggle) {
        toggle.addEventListener('change', () => {
          card.style.opacity = toggle.checked ? '1' : '0.45';
        });
      }

      // Botón Estampar Logo
      const btnStamp = card.querySelector('.btn-batch-stamp-logo');
      if (btnStamp) {
        btnStamp.addEventListener('click', () => {
          handleStampLogoForCard(item.id);
        });
      }

      // Botón Poner Música
      const btnMusic = card.querySelector('.btn-batch-add-music');
      if (btnMusic) {
        btnMusic.addEventListener('click', () => {
          openBatchMusicModal(item.id);
        });
      }

      // Botón Volver a Imagen
      const btnRevert = card.querySelector('.btn-batch-revert-image');
      if (btnRevert) {
        btnRevert.addEventListener('click', () => {
          handleRevertToImage(item.id);
        });
      }

      itemsContainer.appendChild(card);
    });
  }

  /**
   * Abre el modal interactivo de estampado de logo para un ítem específico
   */
  function handleStampLogoForCard(itemId) {
    const item = currentBatchItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.imageUrl.match(/\.(mp4|mov|webm)$/i)) {
      if (typeof showToast === 'function') {
        showToast('El archivo actual es un video con música. Si deseas estamparle el logo, haz clic en "Volver a Imagen", estámpalo y luego vuelve a generar el video.', 'warning');
      }
      return;
    }

    if (typeof window.openInteractiveStampModal === 'function') {
      window.openInteractiveStampModal(item.imageUrl, (stampedUrl) => {
        item.imageUrl = stampedUrl;
        if (!item.originalImageUrl) item.originalImageUrl = stampedUrl;

        // Actualizar vista previa en el DOM directamente
        const itemsContainer = getEl('batch-items-container');
        if (itemsContainer) {
          const card = itemsContainer.querySelector(`.batch-post-card[data-item-id="${item.id}"]`);
          if (card) {
            const imgEl = card.querySelector('.batch-card-thumb-img');
            if (imgEl) imgEl.src = stampedUrl;
            const statusBadge = card.querySelector('.batch-card-status-badge');
            if (statusBadge) {
              statusBadge.textContent = 'Logo Estampado ✅';
              statusBadge.style.background = 'rgba(37,99,235,0.9)';
            }
          }
        }

        if (typeof showToast === 'function') {
          showToast('¡Logo estampado con éxito en la imagen!', 'success');
        }
      });
    } else {
      if (typeof showToast === 'function') showToast('Módulo de estampar logo no disponible.', 'error');
    }
  }

  /**
   * Restaura la imagen fija original si el usuario no desea el video generado
   */
  function handleRevertToImage(itemId) {
    const item = currentBatchItems.find(i => i.id === itemId);
    if (!item || !item.originalImageUrl) return;

    item.imageUrl = item.originalImageUrl;
    item.isVideo = false;
    delete item.musicConfig;
    renderReviewCards(currentBatchItems);

    if (typeof showToast === 'function') {
      showToast('Se restableció la imagen original del afiche.', 'info');
    }
  }

  // =========================================================================
  // CONTROLADOR DEL MODAL DE MÚSICA & VIDEO PARA EL LOTE
  // =========================================================================

  function openBatchMusicModal(itemId) {
    const item = currentBatchItems.find(i => i.id === itemId);
    if (!item) return;

    batchMusicState.currentItemId = itemId;
    batchMusicState.format = item.post_type === 'story' ? 'story' : 'feed';
    batchMusicState.duration = 15;
    batchMusicState.startTime = 0;

    const modal = getEl('modal-batch-music-video');
    if (!modal) return;

    // Actualizar datos del afiche en el modal
    const infoText = getEl('batch-music-target-info');
    const idx = currentBatchItems.findIndex(i => i.id === itemId);
    if (infoText) {
      infoText.textContent = `Publicación #${idx + 1}: ${item.productName || 'Afiche Kmarket'}`;
    }

    const previewImg = getEl('batch-music-preview-img');
    const imgSrc = item.originalImageUrl || item.imageUrl;
    if (previewImg) {
      previewImg.src = imgSrc;
    }

    // Actualizar radio buttons según el formato
    const radioFeed = document.querySelector('input[name="batch_video_format"][value="feed"]');
    const radioStory = document.querySelector('input[name="batch_video_format"][value="story"]');
    if (batchMusicState.format === 'story' && radioStory) {
      radioStory.checked = true;
    } else if (radioFeed) {
      radioFeed.checked = true;
    }
    document.querySelectorAll('input[name="batch_video_format"]').forEach(r => {
      r.closest('.radio-pill')?.classList.toggle('active', r.checked);
    });

    updateBatchModalPreviewFormat(batchMusicState.format, imgSrc);

    document.querySelectorAll('.batch-music-duration-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.duration === '15');
    });

    const durationText = getEl('batch-music-duration-text');
    if (durationText) durationText.textContent = '15s';

    const startSlider = getEl('batch-music-start-slider');
    if (startSlider) startSlider.value = 0;
    const startText = getEl('batch-music-start-time-text');
    if (startText) startText.textContent = '0:00';

    modal.style.display = 'flex';

    // Cargar catálogo curado si aún no está cargado
    if (batchMusicState.catalog.length === 0) {
      loadBatchMusicCatalog();
    }
  }

  function updateBatchModalPreviewFormat(format, optionalImgSrc) {
    const wrap = getEl('batch-music-preview-wrap');
    const backdrop = getEl('batch-music-preview-backdrop');
    const img = getEl('batch-music-preview-img');
    const targetSrc = optionalImgSrc || img?.src || '';

    if (!wrap || !img) return;

    if (format === 'story') {
      wrap.style.aspectRatio = '9/16';
      wrap.style.maxHeight = '280px';
      wrap.style.padding = '10px 6px';

      if (backdrop) {
        backdrop.style.display = 'block';
        if (targetSrc) {
          backdrop.style.backgroundImage = `url('${targetSrc}')`;
        }
      }

      img.style.objectFit = 'contain';
      img.style.borderRadius = '8px';
      img.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
      img.style.border = '1px solid rgba(255,255,255,0.15)';
    } else {
      wrap.style.aspectRatio = '4/5';
      wrap.style.maxHeight = '';
      wrap.style.padding = '0';

      if (backdrop) {
        backdrop.style.display = 'none';
        backdrop.style.backgroundImage = '';
      }

      img.style.objectFit = 'cover';
      img.style.borderRadius = '0';
      img.style.boxShadow = 'none';
      img.style.border = 'none';
    }
  }

  function closeBatchMusicModal() {
    const modal = getEl('modal-batch-music-video');
    if (modal) modal.style.display = 'none';
    stopBatchAudio();
  }

  function stopBatchAudio() {
    if (batchMusicState.audioPlayer) {
      batchMusicState.audioPlayer.pause();
      batchMusicState.audioPlayer.currentTime = 0;
    }
    batchMusicState.isPlaying = false;
    const playBtn = getEl('btn-batch-active-music-play');
    if (playBtn) playBtn.textContent = '▶ Escuchar';
    const indicator = getEl('batch-music-playing-indicator');
    if (indicator) indicator.style.display = 'none';
  }

  async function loadBatchMusicCatalog(category = 'all', query = '') {
    const listContainer = getEl('batch-music-track-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">Cargando catálogo sin copyright...</div>';

    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (query && query.trim()) params.append('q', query.trim());

      const res = await fetch(`/api/music/library?${params.toString()}`);
      const json = await res.json();

      if (json.success && json.data) {
        batchMusicState.catalog = json.data.tracks || [];
        renderBatchCategoryPills(json.data.categories || []);
        renderBatchTrackList(batchMusicState.catalog);

        if (!batchMusicState.selectedTrack && batchMusicState.catalog.length > 0) {
          selectBatchTrack(batchMusicState.catalog[0], false);
        }
      }
    } catch (err) {
      listContainer.innerHTML = `<div style="color:#f43f5e; padding:10px; font-size:0.8rem;">Error: ${err.message}</div>`;
    }
  }

  function renderBatchCategoryPills(categories) {
    const container = getEl('batch-music-category-pills');
    if (!container) return;
    container.innerHTML = '';

    categories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `music-category-pill ${idx === 0 ? 'active' : ''}`;
      btn.dataset.category = cat.id;
      btn.textContent = cat.label;
      btn.style.fontSize = '0.72rem';
      btn.style.padding = '3px 8px';

      btn.addEventListener('click', () => {
        container.querySelectorAll('.music-category-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadBatchMusicCatalog(cat.id);
      });

      container.appendChild(btn);
    });
  }

  function renderBatchTrackList(tracks) {
    const container = getEl('batch-music-track-list');
    if (!container) return;
    container.innerHTML = '';

    if (tracks.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">No se encontraron canciones.</div>';
      return;
    }

    tracks.forEach(track => {
      const item = document.createElement('div');
      item.className = `music-track-item ${batchMusicState.selectedTrack?.id === track.id ? 'active' : ''}`;
      item.style.padding = '6px 10px';
      item.innerHTML = `
        <div class="track-left" style="display:flex; align-items:center; gap:8px;">
          <button type="button" class="track-play-btn" data-id="${track.id}" style="width:26px; height:26px; font-size:0.75rem;">▶</button>
          <div class="track-info">
            <span class="track-title" style="font-size:0.8rem; font-weight:600;">${escapeHtml(track.title)}</span>
            <span class="track-artist-meta" style="font-size:0.7rem; color:var(--text-secondary);">${escapeHtml(track.artist)} • ${formatBatchDuration(track.durationSec)}</span>
          </div>
        </div>
        <div class="track-right" style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="btn-select-track" style="font-size:0.72rem; padding:3px 8px;">Elegir</button>
        </div>
      `;

      item.querySelector('.track-play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayBatchTrack(track);
      });

      item.querySelector('.btn-select-track').addEventListener('click', () => {
        selectBatchTrack(track, true);
      });

      item.addEventListener('click', () => {
        selectBatchTrack(track, false);
      });

      container.appendChild(item);
    });
  }

  function selectBatchTrack(track, autoplay = false) {
    batchMusicState.selectedTrack = track;

    // Actualizar UI del panel activo
    const titleEl = getEl('batch-active-music-title');
    const artistEl = getEl('batch-active-music-artist');
    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = `${track.artist} (${formatBatchDuration(track.durationSec)})`;

    // Resaltar en la lista
    document.querySelectorAll('#batch-music-track-list .music-track-item').forEach(el => {
      const isCurrent = el.querySelector('.track-play-btn')?.dataset.id === String(track.id);
      el.classList.toggle('active', isCurrent);
    });

    if (autoplay) {
      playBatchTrack(track);
    }
  }

  function togglePlayBatchTrack(track) {
    if (batchMusicState.selectedTrack?.id === track.id && batchMusicState.isPlaying) {
      stopBatchAudio();
    } else {
      selectBatchTrack(track, false);
      playBatchTrack(track);
    }
  }

  function playBatchTrack(track) {
    if (!track.streamUrl) return;
    stopBatchAudio();

    batchMusicState.audioPlayer.src = track.streamUrl;
    batchMusicState.audioPlayer.currentTime = batchMusicState.startTime;
    batchMusicState.audioPlayer.play()
      .then(() => {
        batchMusicState.isPlaying = true;
        const playBtn = getEl('btn-batch-active-music-play');
        if (playBtn) playBtn.textContent = '⏸ Pausar';
        const indicator = getEl('batch-music-playing-indicator');
        if (indicator) indicator.style.display = 'inline-flex';
      })
      .catch(err => {
        console.warn('[Batch Music Play Warning]:', err.message);
      });

    batchMusicState.audioPlayer.onended = () => {
      stopBatchAudio();
    };
  }

  function formatBatchDuration(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }

  // Inicialización de controles del modal de música
  function setupBatchMusicEvents() {
    // 1. Tabs de Fuentes (Curada vs Subir vs Jamendo)
    document.querySelectorAll('.batch-music-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.batch-music-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const target = btn.dataset.tab;
        const paneCurated = getEl('batch-music-tab-curated');
        const paneUpload = getEl('batch-music-tab-upload');
        const paneJamendo = getEl('batch-music-tab-jamendo');

        if (paneCurated) paneCurated.style.display = target === 'curated' ? 'block' : 'none';
        if (paneUpload) paneUpload.style.display = target === 'upload' ? 'block' : 'none';
        if (paneJamendo) paneJamendo.style.display = target === 'jamendo' ? 'block' : 'none';
      });
    });

    // 2. Buscador de biblioteca curada
    const searchInput = getEl('batch-music-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        loadBatchMusicCatalog('all', q);
      });
    }

    // 3. Duración (15s, 30s, 60s)
    document.querySelectorAll('.batch-music-duration-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.batch-music-duration-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        batchMusicState.duration = Number(btn.dataset.duration) || 15;
        const durationText = getEl('batch-music-duration-text');
        if (durationText) durationText.textContent = `${batchMusicState.duration}s`;
      });
    });

    // 3.1 Cambio de Formato de Video (Feed 4:5 vs Historia 16:9 vertical blur)
    document.querySelectorAll('input[name="batch_video_format"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        batchMusicState.format = e.target.value;
        document.querySelectorAll('input[name="batch_video_format"]').forEach(r => {
          r.closest('.radio-pill')?.classList.toggle('active', r.checked);
        });
        const currentItem = currentBatchItems.find(i => i.id === batchMusicState.currentItemId);
        updateBatchModalPreviewFormat(batchMusicState.format, currentItem?.originalImageUrl || currentItem?.imageUrl);
      });
    });

    // 4. Slider de inicio
    const startSlider = getEl('batch-music-start-slider');
    if (startSlider) {
      startSlider.addEventListener('input', (e) => {
        batchMusicState.startTime = Number(e.target.value);
        const startText = getEl('batch-music-start-time-text');
        if (startText) startText.textContent = formatBatchDuration(batchMusicState.startTime);

        if (batchMusicState.isPlaying && batchMusicState.audioPlayer) {
          batchMusicState.audioPlayer.currentTime = batchMusicState.startTime;
        }
      });
    }

    // 5. Botón Play en el panel activo
    const btnActivePlay = getEl('btn-batch-active-music-play');
    if (btnActivePlay) {
      btnActivePlay.addEventListener('click', () => {
        if (!batchMusicState.selectedTrack) return;
        if (batchMusicState.isPlaying) {
          stopBatchAudio();
        } else {
          playBatchTrack(batchMusicState.selectedTrack);
        }
      });
    }

    // 6. Subir canción propia
    const dropzone = getEl('batch-audio-dropzone');
    const fileInput = getEl('batch-audio-file-input');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await uploadCustomBatchAudio(file);
      });
    }

    // 7. Buscador Jamendo
    const btnJamendoSearch = getEl('btn-batch-jamendo-search');
    const jamendoInput = getEl('batch-jamendo-search-input');
    if (btnJamendoSearch && jamendoInput) {
      btnJamendoSearch.addEventListener('click', searchBatchJamendo);
      jamendoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') searchBatchJamendo();
      });
    }

    // 8. Botón Renderizar Video con Música
    const btnConfirmGen = getEl('btn-confirm-batch-generate-video');
    if (btnConfirmGen) {
      btnConfirmGen.addEventListener('click', generateBatchPostVideo);
    }
  }

  async function uploadCustomBatchAudio(file) {
    const formData = new FormData();
    formData.append('audio', file);

    const dropText = getEl('batch-audio-dropzone')?.querySelector('p');
    if (dropText) dropText.textContent = '⏳ Subiendo y procesando audio...';

    try {
      const res = await fetch('/api/music/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();

      if (json.success && json.data) {
        if (typeof showToast === 'function') showToast('¡Canción subida con éxito!', 'success');

        const customTrack = {
          id: `custom_${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          artist: 'Mi Audio Propio',
          durationSec: 180,
          streamUrl: json.data.relativeUrl,
          badge: 'Propio'
        };

        selectBatchTrack(customTrack, true);
        if (dropText) dropText.textContent = `✅ ${file.name}`;
      } else {
        throw new Error(json.error || 'Error al subir audio');
      }
    } catch (err) {
      if (typeof showToast === 'function') showToast('Error al subir audio: ' + err.message, 'error');
      if (dropText) dropText.textContent = 'Haz clic aquí o arrastra tu archivo de música';
    }
  }

  async function searchBatchJamendo() {
    const jamendoInput = getEl('batch-jamendo-search-input');
    const resultsContainer = getEl('batch-jamendo-results-list');
    const query = jamendoInput?.value?.trim();
    if (!query || !resultsContainer) return;

    resultsContainer.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">Buscando en Jamendo...</div>';

    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&limit=15`);
      const json = await res.json();

      if (json.success && json.data?.results) {
        const results = json.data.results;
        if (results.length === 0) {
          resultsContainer.innerHTML = '<div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.8rem;">No se encontraron resultados.</div>';
          return;
        }

        resultsContainer.innerHTML = '';
        results.forEach(track => {
          const item = document.createElement('div');
          item.className = 'music-track-item';
          item.style.padding = '6px 10px';
          item.innerHTML = `
            <div class="track-left" style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="track-play-btn" data-id="${track.id}" style="width:26px; height:26px; font-size:0.75rem;">▶</button>
              <div class="track-info">
                <span class="track-title" style="font-size:0.8rem; font-weight:600;">${escapeHtml(track.title)}</span>
                <span class="track-artist-meta" style="font-size:0.7rem; color:var(--text-secondary);">${escapeHtml(track.artist)} • ${formatBatchDuration(track.durationSec)}</span>
              </div>
            </div>
            <div class="track-right">
              <button type="button" class="btn-select-track" style="font-size:0.72rem; padding:3px 8px;">Elegir</button>
            </div>
          `;

          item.querySelector('.track-play-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePlayBatchTrack(track);
          });
          item.querySelector('.btn-select-track').addEventListener('click', () => {
            selectBatchTrack(track, true);
          });

          resultsContainer.appendChild(item);
        });
      }
    } catch (err) {
      resultsContainer.innerHTML = `<div style="color:#f43f5e; padding:10px; font-size:0.8rem;">Error: ${err.message}</div>`;
    }
  }

  /**
   * Renderiza el video con música usando FFmpeg y actualiza la tarjeta del lote
   */
  async function generateBatchPostVideo() {
    const item = currentBatchItems.find(i => i.id === batchMusicState.currentItemId);
    if (!item) return;

    if (!batchMusicState.selectedTrack) {
      if (typeof showToast === 'function') showToast('Por favor selecciona una canción primero.', 'warning');
      return;
    }

    const btn = getEl('btn-confirm-batch-generate-video');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Codificando video MP4 con FFmpeg... (~2-4s)</span>';
    }

    stopBatchAudio();

    const isStoryFormat = batchMusicState.format === 'story';

    if (typeof showToast === 'function') {
      showToast(isStoryFormat
        ? 'Generando video vertical 16:9 para Historia con audio real mediante FFmpeg...'
        : 'Generando video MP4 con audio real mediante FFmpeg...', 'info');
    }

    try {
      const baseImg = item.originalImageUrl || item.imageUrl;
      const res = await fetch('/api/stories/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: baseImg,
          audio_url: batchMusicState.selectedTrack.streamUrl,
          post_type: batchMusicState.format,
          duration: batchMusicState.duration,
          start_time: batchMusicState.startTime,
          add_music_sticker: isStoryFormat,
          song_title: batchMusicState.selectedTrack.title,
          song_artist: batchMusicState.selectedTrack.artist
        })
      });

      const json = await res.json();

      if (json.success && json.data?.relativeUrl) {
        if (!item.originalImageUrl) item.originalImageUrl = item.imageUrl;
        item.imageUrl = json.data.relativeUrl;
        item.isVideo = true;
        item.post_type = isStoryFormat ? 'story' : 'feed';
        item.musicConfig = {
          audio_url: batchMusicState.selectedTrack.streamUrl,
          duration: batchMusicState.duration,
          start_time: batchMusicState.startTime,
          song_title: batchMusicState.selectedTrack.title,
          song_artist: batchMusicState.selectedTrack.artist
        };

        closeBatchMusicModal();
        renderReviewCards(currentBatchItems);

        if (typeof showToast === 'function') {
          showToast(isStoryFormat
            ? '¡Video vertical 16:9 con música generado con éxito y aplicado como Historia!'
            : '¡Video con música generado con éxito y aplicado al post!', 'success');
        }
      } else {
        throw new Error(json.error || 'Error al generar video');
      }
    } catch (err) {
      console.error('[Generate Batch Video Error]', err);
      if (typeof showToast === 'function') showToast('Error al generar video: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡ Renderizar Video con Música</span>';
      }
    }
  }

  // Inicializar eventos de música cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBatchMusicEvents);
  } else {
    setupBatchMusicEvents();
  }

  /**
   * Recopila todos los posts aprobados del lote y los envía a programar masivamente
   * Enviando la estrategia de historias y la extensión mensual completa (Campiña)
   */
  async function confirmAndScheduleBatch() {
    const itemsContainer = getEl('batch-items-container');
    const btnConfirmSchedule = getEl('btn-confirm-batch-schedule');
    if (!itemsContainer) return;

    const cards = itemsContainer.querySelectorAll('.batch-post-card');
    const postsToSchedule = [];

    cards.forEach(card => {
      const toggle = card.querySelector('.batch-item-toggle');
      if (toggle && toggle.checked) {
        const itemId = card.dataset.itemId;
        const rawItem = currentBatchItems.find(i => i.id === itemId);

        const title = card.querySelector('.batch-item-title')?.value.trim() || rawItem?.productName || 'Producto Kmarket';
        const content = card.querySelector('.batch-item-content')?.value.trim();
        const datetimeVal = card.querySelector('.batch-item-datetime')?.value;

        if (content && datetimeVal) {
          const iso = datetimeVal.length === 16 ? datetimeVal + ':00' : datetimeVal;

          postsToSchedule.push({
            productName: title,
            content: content,
            scheduledAt: iso,
            imageUrl: rawItem?.imageUrl || '',
            originalImageUrl: rawItem?.originalImageUrl || rawItem?.imageUrl || '',
            isVideo: Boolean(rawItem?.isVideo),
            post_type: rawItem?.post_type || (rawItem?.isVideo ? 'feed' : 'feed'),
            musicConfig: rawItem?.musicConfig ? {
              audio_url: rawItem.musicConfig.audio_url || rawItem.musicConfig.audioUrl,
              duration: rawItem.musicConfig.duration,
              start_time: rawItem.musicConfig.start_time || rawItem.musicConfig.startTime,
              song_title: rawItem.musicConfig.song_title || rawItem.musicConfig.title,
              song_artist: rawItem.musicConfig.song_artist || rawItem.musicConfig.artist
            } : null,
            platforms: ['instagram', 'facebook']
          });
        }
      }
    });

    if (postsToSchedule.length === 0) {
      if (typeof showToast === 'function') showToast('Selecciona al menos una publicación para programar.', 'warning');
      return;
    }

    if (btnConfirmSchedule) {
      btnConfirmSchedule.disabled = true;
      btnConfirmSchedule.textContent = '⚡ Programando afiches e historias en el calendario...';
    }

    const includeStories = Boolean(document.getElementById('batch-chk-create-stories')?.checked);
    const storyStrategy = document.querySelector('input[name="batch_story_strategy"]:checked')?.value || 'single';
    const storyTimingRule = document.querySelector('input[name="batch_story_timing"]:checked')?.value || 'plus_3h';
    const storyMonthlyExtension = Boolean(document.getElementById('batch-chk-story-monthly-extension')?.checked);

    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const accountSelect = document.getElementById('global-account-select');
    const accountId = activeAcc?.pageId || accountSelect?.value || '';
    const accountName = activeAcc?.pageName || (accountSelect?.options[accountSelect?.selectedIndex]?.getAttribute('data-name')) || '';

    try {
      const res = await fetch('/api/batch/confirm-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: postsToSchedule,
          include_stories: includeStories,
          story_strategy: storyStrategy,
          story_timing_rule: storyTimingRule,
          story_monthly_extension: storyMonthlyExtension,
          accountId,
          accountName
        })
      });

      const json = await res.json();

      if (json.success) {
        if (typeof showToast === 'function') {
          showToast(json.message || `¡Excelente! ${json.scheduledCount} publicaciones programadas.`, 'success');
        }

        closeBatchModal();

        if (typeof window.loadPlannerCalendar === 'function') {
          window.loadPlannerCalendar();
        } else if (typeof window.fetchCalendarPosts === 'function') {
          window.fetchCalendarPosts();
        }

        if (typeof window.updateQueueBadge === 'function') {
          window.updateQueueBadge();
        }
      } else {
        throw new Error(json.error || 'Error al guardar publicaciones');
      }
    } catch (err) {
      console.error('[Batch Schedule Confirm Error]', err);
      if (typeof showToast === 'function') showToast('Error al programar: ' + err.message, 'error');
    } finally {
      if (btnConfirmSchedule) {
        btnConfirmSchedule.disabled = false;
        btnConfirmSchedule.textContent = '🚀 Aprobar y Programar Todo en el Calendario';
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Exponer a window para llamadas directas
  window.openBatchModal = openBatchModal;
  window.closeBatchModal = closeBatchModal;
  window.openBatchMusicModal = openBatchMusicModal;
  window.closeBatchMusicModal = closeBatchMusicModal;

})();
