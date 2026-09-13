// =============================================================================
// MetaPulse Media, Watermark & Branding Controller
// =============================================================================

let selectedPosition = 'bottom-right';
window.mediaFilterMode = 'current';

window.setMediaAccountFilter = function(mode) {
  window.mediaFilterMode = mode;
  const btnCurrent = document.getElementById('btn-media-filter-current');
  const btnAll = document.getElementById('btn-media-filter-all');
  if (btnCurrent && btnAll) {
    if (mode === 'current') {
      btnCurrent.className = 'btn btn-xs btn-primary';
      btnAll.className = 'btn btn-xs btn-ghost';
    } else {
      btnCurrent.className = 'btn btn-xs btn-ghost';
      btnAll.className = 'btn btn-xs btn-primary';
    }
  }
  window.loadMediaGallery();
};

window.loadMediaGallery = async function() {
  const gallery = document.getElementById('media-gallery-grid');
  if (!gallery) return;

  const indicator = document.getElementById('media-account-indicator');
  const isAll = window.mediaFilterMode === 'all';

  try {
    const url = isAll ? '/api/media?all=true' : '/api/media';
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    const items = json.data || [];
    const accountName = json.accountName || 'Cuenta Activa';

    if (indicator) {
      indicator.textContent = isAll 
        ? `Mostrando todas las imágenes (${items.length})` 
        : `Mostrando solo archivos de: ${accountName} (${items.length})`;
    }

    if (items.length === 0) {
      gallery.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding: 36px 16px; background:var(--bg-surface-subtle); border-radius:var(--radius-xs); border:1px dashed var(--border-color);">
          <div style="font-size: 2rem; margin-bottom: 8px;">📷</div>
          <h4 style="margin:0 0 6px 0;">No hay archivos para esta cuenta aún</h4>
          <p class="text-muted" style="margin:0 0 14px 0; font-size:0.85rem;">
            Las imágenes que subas o diseñes mientras administras <strong>${accountName}</strong> se guardarán aquí de forma privada.
          </p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('media-file-input').click()">
            + Subir Primera Foto a ${accountName}
          </button>
        </div>
      `;
      return;
    }

    gallery.innerHTML = items.map(item => {
      const isVideo = item.mime_type?.startsWith('video');
      const itemAcc = item.account_name ? `<span class="badge" style="position:absolute; top:4px; left:4px; font-size:0.6rem; padding:1px 5px; background:rgba(0,0,0,0.7); color:#fff; border-radius:3px;">${item.account_name}</span>` : '';
      return `
        <div class="media-preview-item" title="${item.original_name}" style="position:relative; overflow:hidden;">
          ${itemAcc}
          ${isVideo ? `<video src="${item.filepath}" preload="metadata"></video>` : `<img src="${item.filepath}" alt="${item.original_name}" loading="lazy">`}
          <div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%); opacity:0; transition:opacity 0.15s ease; display:flex; flex-direction:column; justify-content:flex-end; gap:5px; padding:8px;" class="media-hover-overlay">
            <button class="btn btn-xs btn-primary" style="font-size:0.68rem; padding:4px 6px; width:100%; border-radius:4px; font-weight:600;" onclick="useMediaInComposer('${item.filepath}')">
              Usar en Post
            </button>
            <button class="btn btn-xs btn-secondary" style="font-size:0.65rem; padding:3px 6px; width:100%; border-radius:4px; background:rgba(236,72,153,0.85); color:#fff; border:none;" onclick="useMediaAsPostAndStory('${item.filepath}')">
              📲 Post + Historia
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error cargando galería:', err);
  }
};

window.useMediaAsPostAndStory = function(filePath) {
  if (typeof ComposerState !== 'undefined') {
    if (!ComposerState.mediaFiles.includes(filePath)) {
      ComposerState.mediaFiles.push(filePath);
    }
  }
  const chkStory = document.getElementById('chk-also-share-story');
  const storyTimingBox = document.getElementById('story-timing-box');
  if (chkStory) {
    chkStory.checked = true;
    if (storyTimingBox) storyTimingBox.style.display = 'block';
    if (typeof window.syncStorySectionsVisibility === 'function') window.syncStorySectionsVisibility();
  }
  if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
  if (typeof updateLivePreviews === 'function') updateLivePreviews();
  navigateToTab('composer');
  showToast('Imagen lista con opción de Historia 9:16 activada ✨', 'success');
};

window.loadWatermarksList = async function() {
  try {
    const res = await fetch('/api/watermarks');
    const json = await res.json();
    if (!json.success) return;

    const watermarks = json.data;
    const nameEl = document.getElementById('logo-file-name');
    if (nameEl) {
      if (watermarks && watermarks.length > 0) {
        nameEl.textContent = `Logo activo: ${watermarks[0].name} (${watermarks[0].filename})`;
        nameEl.classList.remove('text-muted');
        nameEl.classList.add('text-emerald');
      } else {
        nameEl.textContent = 'Ningún logo configurado para esta cuenta';
        nameEl.classList.remove('text-emerald');
        nameEl.classList.add('text-muted');
      }
    }
  } catch (err) {
    console.error('Error cargando watermarks:', err);
  }
};

window.useMediaInComposer = function(filePath) {
  if (!ComposerState.mediaFiles.includes(filePath)) {
    ComposerState.mediaFiles.push(filePath);
  }
  if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
  if (typeof updateLivePreviews === 'function') updateLivePreviews();
  navigateToTab('composer');
  showToast('Imagen cargada al redactor', 'success');
};

document.addEventListener('DOMContentLoaded', () => {
  const logoFileInput = document.getElementById('logo-file-input');
  const sliderOpacity = document.getElementById('slider-opacity');
  const sliderScale = document.getElementById('slider-scale');
  const opacityVal = document.getElementById('opacity-val');
  const scaleVal = document.getElementById('scale-val');

  // 1. Subir Logotipo
  if (logoFileInput) {
    logoFileInput.addEventListener('change', async () => {
      if (!logoFileInput.files || logoFileInput.files.length === 0) return;
      const file = logoFileInput.files[0];

      const formData = new FormData();
      formData.append('logo', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      showToast('Guardando logotipo oficial...', 'info');

      try {
        const res = await fetch('/api/watermark/upload-logo', {
          method: 'POST',
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          showToast('¡Logotipo guardado como marca de agua por defecto!', 'success');
          window.loadWatermarksList();
        } else {
          showToast('Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error subiendo logo: ' + err.message, 'error');
      }
    });
  }

  // 2. Selector de Posición del Logo
  document.querySelectorAll('.pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPosition = btn.dataset.pos;
    });
  });

  // 3. Sliders de Opacidad y Escala
  if (sliderOpacity) {
    sliderOpacity.addEventListener('input', () => {
      opacityVal.textContent = `${sliderOpacity.value}%`;
    });
  }

  if (sliderScale) {
    sliderScale.addEventListener('input', () => {
      scaleVal.textContent = `${sliderScale.value}% del ancho`;
    });
  }

  // 4. Formatos Adaptados (1:1, 4:5, 9:16)
  const formatPresets = [
    { id: 'btn-format-square', preset: 'square' },
    { id: 'btn-format-portrait', preset: 'portrait' },
    { id: 'btn-format-story', preset: 'story' }
  ];

  formatPresets.forEach(({ id, preset }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', async () => {
        if (ComposerState.mediaFiles.length === 0) {
          showToast('Debes subir o seleccionar una imagen en el composer primero.', 'error');
          return;
        }

        showToast(`Adaptando formato a ${preset.toUpperCase()}...`, 'info');
        try {
          const res = await fetch('/api/media/format', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imagePath: ComposerState.mediaFiles[0],
              preset: preset
            })
          });
          const json = await res.json();
          if (json.success && json.data) {
            ComposerState.mediaFiles[0] = json.data.relativeUrl;
            showToast(`¡Imagen adaptada a formato ${preset}!`, 'success');
            window.loadMediaGallery();
          }
        } catch (err) {
          showToast('Error adaptando formato: ' + err.message, 'error');
        }
      });
    }
  });

  // ===========================================================================
  // POSICIONADOR INTERACTIVO DE LOGOTIPO (ARRASTRAR Y ESTAMPAR)
  // ===========================================================================
  const modalInteractiveStamp = document.getElementById('modal-interactive-stamp');
  const btnCloseStampModal = document.getElementById('btn-close-stamp-modal');
  const btnCancelStampModal = document.getElementById('btn-cancel-stamp-modal');
  const stampLogoSelect = document.getElementById('stamp-logo-select');
  const stampStageWrap = document.getElementById('stamp-stage-wrap');
  const stampStageBg = document.getElementById('stamp-stage-bg');
  const stampStageLogo = document.getElementById('stamp-stage-logo');
  const stampStageLogoImg = document.getElementById('stamp-stage-logo-img');
  const stampSliderScale = document.getElementById('stamp-slider-scale');
  const stampScaleVal = document.getElementById('stamp-scale-val');
  const stampSliderOpacity = document.getElementById('stamp-slider-opacity');
  const stampOpacityVal = document.getElementById('stamp-opacity-val');
  const stampCoordX = document.getElementById('stamp-coord-x');
  const stampCoordY = document.getElementById('stamp-coord-y');
  const btnConfirmStampLogo = document.getElementById('btn-confirm-stamp-logo');
  const stampQuickLogoInput = document.getElementById('stamp-quick-logo-input');
  const btnStampUploadNewLogo = document.getElementById('btn-stamp-upload-new-logo');

  let currentTargetImage = '';
  let availableWatermarks = [];
  let stampXPercent = 78;
  let stampYPercent = 78;
  let stampScale = 18;
  let stampOpacity = 90;
  let isDraggingStamp = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragInitLeft = 0;
  let dragInitTop = 0;

  const closeInteractiveStamp = () => {
    if (modalInteractiveStamp) modalInteractiveStamp.style.display = 'none';
  };

  if (btnCloseStampModal) btnCloseStampModal.addEventListener('click', closeInteractiveStamp);
  if (btnCancelStampModal) btnCancelStampModal.addEventListener('click', closeInteractiveStamp);

  function syncStampPosition() {
    if (!stampStageWrap || !stampStageLogo) return;
    const stageW = stampStageWrap.clientWidth;
    const stageH = stampStageWrap.clientHeight;
    if (stageW <= 0 || stageH <= 0) return;

    const logoW = Math.max(24, Math.round(stageW * (stampScale / 100)));
    stampStageLogo.style.width = logoW + 'px';
    stampStageLogo.style.opacity = (stampOpacity / 100).toString();

    const logoH = stampStageLogo.offsetHeight || Math.round(logoW * 0.6);
    const maxLeft = Math.max(0, stageW - logoW);
    const maxTop = Math.max(0, stageH - logoH);

    const left = Math.max(0, Math.min(maxLeft, Math.round(stageW * (stampXPercent / 100))));
    const top = Math.max(0, Math.min(maxTop, Math.round(stageH * (stampYPercent / 100))));

    stampStageLogo.style.left = left + 'px';
    stampStageLogo.style.top = top + 'px';

    if (stampCoordX) stampCoordX.textContent = Math.round((left / stageW) * 100) + '%';
    if (stampCoordY) stampCoordY.textContent = Math.round((top / stageH) * 100) + '%';
  }

  function snapStampToPreset(pos) {
    if (!stampStageWrap || !stampStageLogo) return;
    const stageW = stampStageWrap.clientWidth;
    const stageH = stampStageWrap.clientHeight;
    if (stageW <= 0 || stageH <= 0) return;

    const logoW = stampStageLogo.offsetWidth || Math.round(stageW * (stampScale / 100));
    const logoH = stampStageLogo.offsetHeight || Math.round(logoW * 0.6);
    const margin = Math.round(stageW * 0.035);

    let left = margin;
    let top = margin;

    switch (pos) {
      case 'top-left':
        left = margin;
        top = margin;
        break;
      case 'top-right':
        left = stageW - logoW - margin;
        top = margin;
        break;
      case 'center':
        left = Math.round((stageW - logoW) / 2);
        top = Math.round((stageH - logoH) / 2);
        break;
      case 'bottom-left':
        left = margin;
        top = stageH - logoH - margin;
        break;
      case 'bottom-right':
      default:
        left = stageW - logoW - margin;
        top = stageH - logoH - margin;
        break;
    }

    const maxLeft = Math.max(0, stageW - logoW);
    const maxTop = Math.max(0, stageH - logoH);
    left = Math.max(0, Math.min(maxLeft, left));
    top = Math.max(0, Math.min(maxTop, top));

    stampXPercent = Math.round((left / stageW) * 1000) / 10;
    stampYPercent = Math.round((top / stageH) * 1000) / 10;

    stampStageLogo.style.left = left + 'px';
    stampStageLogo.style.top = top + 'px';

    if (stampCoordX) stampCoordX.textContent = Math.round(stampXPercent) + '%';
    if (stampCoordY) stampCoordY.textContent = Math.round(stampYPercent) + '%';

    document.querySelectorAll('.btn-stamp-snap').forEach(b => {
      b.classList.toggle('active', b.dataset.pos === pos);
    });
  }

  // Eventos de arrastre para el logo
  function onPointerDown(e) {
    isDraggingStamp = true;
    const pt = e.touches ? e.touches[0] : e;
    dragStartX = pt.clientX;
    dragStartY = pt.clientY;
    dragInitLeft = stampStageLogo.offsetLeft;
    dragInitTop = stampStageLogo.offsetTop;
    stampStageLogo.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDraggingStamp) return;
    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - dragStartX;
    const dy = pt.clientY - dragStartY;

    const stageW = stampStageWrap.clientWidth;
    const stageH = stampStageWrap.clientHeight;
    const logoW = stampStageLogo.offsetWidth;
    const logoH = stampStageLogo.offsetHeight;

    const maxLeft = Math.max(0, stageW - logoW);
    const maxTop = Math.max(0, stageH - logoH);

    const newLeft = Math.max(0, Math.min(maxLeft, dragInitLeft + dx));
    const newTop = Math.max(0, Math.min(maxTop, dragInitTop + dy));

    stampStageLogo.style.left = newLeft + 'px';
    stampStageLogo.style.top = newTop + 'px';

    stampXPercent = Math.round((newLeft / stageW) * 1000) / 10;
    stampYPercent = Math.round((newTop / stageH) * 1000) / 10;

    if (stampCoordX) stampCoordX.textContent = Math.round(stampXPercent) + '%';
    if (stampCoordY) stampCoordY.textContent = Math.round(stampYPercent) + '%';

    document.querySelectorAll('.btn-stamp-snap').forEach(b => b.classList.remove('active'));
    e.preventDefault();
  }

  function onPointerUp() {
    if (isDraggingStamp) {
      isDraggingStamp = false;
      if (stampStageLogo) stampStageLogo.style.cursor = 'grab';
    }
  }

  if (stampStageLogo) {
    stampStageLogo.addEventListener('mousedown', onPointerDown);
    stampStageLogo.addEventListener('touchstart', onPointerDown, { passive: false });
  }
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);

  // Sliders
  if (stampSliderScale) {
    stampSliderScale.addEventListener('input', () => {
      stampScale = parseInt(stampSliderScale.value, 10) || 18;
      if (stampScaleVal) stampScaleVal.textContent = `${stampScale}%`;
      syncStampPosition();
    });
  }

  if (stampSliderOpacity) {
    stampSliderOpacity.addEventListener('input', () => {
      stampOpacity = parseInt(stampSliderOpacity.value, 10) || 90;
      if (stampOpacityVal) stampOpacityVal.textContent = `${stampOpacity}%`;
      if (stampStageLogo) stampStageLogo.style.opacity = (stampOpacity / 100).toString();
    });
  }

  // Presets rápidos
  document.querySelectorAll('.btn-stamp-snap').forEach(btn => {
    btn.addEventListener('click', () => {
      snapStampToPreset(btn.dataset.pos);
    });
  });

  // Selector de Logo
  if (stampLogoSelect) {
    stampLogoSelect.addEventListener('change', () => {
      const selectedId = stampLogoSelect.value;
      const found = availableWatermarks.find(w => String(w.id) === String(selectedId));
      if (found && stampStageLogoImg) {
        stampStageLogoImg.src = found.filepath;
      }
    });
  }

  // Subir logo desde el modal
  if (btnStampUploadNewLogo && stampQuickLogoInput) {
    btnStampUploadNewLogo.addEventListener('click', () => {
      stampQuickLogoInput.click();
    });

    stampQuickLogoInput.addEventListener('change', async () => {
      if (!stampQuickLogoInput.files || stampQuickLogoInput.files.length === 0) return;
      const file = stampQuickLogoInput.files[0];
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      showToast('Subiendo nuevo logotipo...', 'info');
      try {
        const res = await fetch('/api/watermark/upload-logo', {
          method: 'POST',
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          showToast('¡Logotipo subido y listo para estampar!', 'success');
          await loadWatermarksForStampModal();
        } else {
          showToast('Error subiendo logo: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      }
    });
  }

  async function loadWatermarksForStampModal() {
    try {
      const res = await fetch('/api/watermarks');
      const json = await res.json();
      if (!json.success) return;

      availableWatermarks = json.data || [];
      if (!stampLogoSelect) return;

      if (availableWatermarks.length === 0) {
        stampLogoSelect.innerHTML = '<option value="">(Sin logos subidos aún)</option>';
        if (stampStageLogo) stampStageLogo.style.display = 'none';
        return;
      }

      stampLogoSelect.innerHTML = availableWatermarks.map(w => {
        const isDef = w.is_default ? ' ★ (Defecto)' : '';
        return `<option value="${w.id}">${w.name}${isDef}</option>`;
      }).join('');

      const activeLogo = availableWatermarks[0];
      if (stampStageLogoImg && activeLogo) {
        stampStageLogoImg.src = activeLogo.filepath;
        if (stampStageLogo) stampStageLogo.style.display = 'flex';
      }
    } catch (err) {
      console.warn('Error cargando logos para el modal:', err);
    }
  }

  // Abrir Modal de Estampado Interactivo
  window.openInteractiveStampModal = async function() {
    if (!ComposerState.mediaFiles || ComposerState.mediaFiles.length === 0) {
      showToast('Debes tener al menos una foto en el redactor para estampar el logo', 'warning');
      return;
    }

    currentTargetImage = ComposerState.mediaFiles[0];
    if (modalInteractiveStamp) modalInteractiveStamp.style.display = 'flex';

    await loadWatermarksForStampModal();

    if (stampStageBg) {
      stampStageBg.onload = () => {
        setTimeout(() => {
          syncStampPosition();
          snapStampToPreset('bottom-right');
        }, 60);
      };
      stampStageBg.src = currentTargetImage;
    }

    if (stampStageLogoImg) {
      stampStageLogoImg.onload = () => {
        syncStampPosition();
      };
    }
  };

  // Botón Confirmar Estampado y Generar Nueva Imagen
  if (btnConfirmStampLogo) {
    btnConfirmStampLogo.addEventListener('click', async () => {
      if (!currentTargetImage) {
        showToast('No hay imagen para estampar', 'error');
        return;
      }

      if (availableWatermarks.length === 0) {
        showToast('Debes subir un logotipo PNG primero', 'warning');
        if (stampQuickLogoInput) stampQuickLogoInput.click();
        return;
      }

      const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
      const accountSelect = document.getElementById('global-account-select');
      const accountId = activeAcc?.pageId || accountSelect?.value || '';

      btnConfirmStampLogo.disabled = true;
      btnConfirmStampLogo.innerHTML = '<span>⚡ Estampando logotipo...</span>';
      showToast('Generando nueva imagen con el logotipo estampado...', 'info');

      try {
        const selectedId = stampLogoSelect ? stampLogoSelect.value : '';
        const res = await fetch('/api/watermark/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imagePath: currentTargetImage,
            watermarkId: selectedId ? parseInt(selectedId, 10) : undefined,
            scalePercent: stampScale,
            opacity: stampOpacity / 100,
            xPercent: stampXPercent,
            yPercent: stampYPercent,
            account_id: accountId
          })
        });
        const json = await res.json();

        if (json.success && json.data?.relativeUrl) {
          const newImageUrl = json.data.relativeUrl;
          ComposerState.mediaFiles[0] = newImageUrl;
          renderMediaPreviews();
          updateLivePreviews();

          closeInteractiveStamp();
          showToast('¡Logotipo estampado con éxito y nueva imagen generada!', 'success');

          if (typeof window.loadMediaGallery === 'function') {
            window.loadMediaGallery();
          }
        } else {
          showToast('Error estampando logotipo: ' + (json.error || 'Desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        btnConfirmStampLogo.disabled = false;
        btnConfirmStampLogo.innerHTML = '<span>✨ Estampar y Generar Nueva Imagen</span>';
      }
    });
  }
});
