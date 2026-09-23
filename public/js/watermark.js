// =============================================================================
// MetaPulse Media, Watermark & Branding Controller
// =============================================================================

let selectedPosition = 'bottom-right';
window.mediaFilterMode = 'current';

// ===========================================================================
// FUNCIONES GLOBALES CRÍTICAS — definidas aquí para que el onclick del botón
// siempre las encuentre, sin depender del DOMContentLoaded
// ===========================================================================

// Variables de estado compartidas globalmente
let _stampXPercent = 78;
let _stampYPercent = 78;
let _stampScale = 18;
let _stampOpacity = 90;
let _currentTargetImage = '';
let _availableWatermarks = [];

window.closeInteractiveStamp = function() {
  const modal = document.getElementById('modal-interactive-stamp');
  if (modal) modal.style.display = 'none';
};

window.openInteractiveStampModal = function(forcedImage, onCompleteCallback) {
  if (typeof onCompleteCallback === 'function') {
    window._stampCustomCallback = onCompleteCallback;
  } else {
    window._stampCustomCallback = null;
  }
  console.log('[MetaPulse] openInteractiveStampModal llamada');
  const modal = document.getElementById('modal-interactive-stamp');
  if (!modal) {
    console.error('[MetaPulse] ERROR: modal-interactive-stamp no encontrado en el DOM');
    return;
  }

  // Mover el modal directo al body para evitar cualquier overflow/z-index de padres
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  // Forzar todos los estilos críticos inline (no pueden ser sobrescritos por CSS de contenedores)
  modal.style.cssText = [
    'display: flex !important',
    'position: fixed !important',
    'top: 0 !important',
    'left: 0 !important',
    'width: 100vw !important',
    'height: 100vh !important',
    'z-index: 2147483647 !important',
    'background: rgba(15, 23, 42, 0.8) !important',
    'align-items: center !important',
    'justify-content: center !important',
    'padding: 16px !important',
    'backdrop-filter: blur(8px) !important',
    'box-sizing: border-box !important'
  ].join('; ');

  console.log('[MetaPulse] Modal en body:', modal.parentElement === document.body, '| display:', window.getComputedStyle(modal).display);

  // Detectar imagen a usar
  let targetImg = forcedImage || '';
  if (!targetImg && typeof ComposerState !== 'undefined' && ComposerState.mediaFiles && ComposerState.mediaFiles.length > 0) {
    const firstItem = ComposerState.mediaFiles[0];
    targetImg = typeof firstItem === 'string' ? firstItem : (firstItem?.url || '');
  }
  if (!targetImg) {
    const previewEl = document.querySelector('#media-preview-grid img');
    if (previewEl && previewEl.src && !previewEl.src.endsWith('/')) targetImg = previewEl.src;
  }
  if (!targetImg) {
    const fbImg = document.querySelector('#mock-fb-media img');
    if (fbImg && fbImg.src && !fbImg.src.endsWith('/')) targetImg = fbImg.src;
  }
  if (!targetImg) {
    const igImg = document.querySelector('#mock-ig-media img');
    if (igImg && igImg.src && !igImg.src.endsWith('/')) targetImg = igImg.src;
  }
  if (!targetImg) {
    const campinaAiEl = document.getElementById('campina-ai-img-result');
    if (campinaAiEl && campinaAiEl.src && !campinaAiEl.src.endsWith('/')) targetImg = campinaAiEl.src;
  }

  const stageBg = document.getElementById('stamp-stage-bg');
  const stageLogo = document.getElementById('stamp-stage-logo');
  const stageLogoImg = document.getElementById('stamp-stage-logo-img');
  const placeholder = document.getElementById('stamp-no-image-placeholder');

  if (targetImg) {
    _currentTargetImage = targetImg;
    if (placeholder) placeholder.style.display = 'none';
    if (stageBg) {
      stageBg.style.display = 'block';
      stageBg.src = targetImg;
    }
    if (stageLogo) stageLogo.style.display = 'flex';
  } else {
    _currentTargetImage = '';
    if (stageBg) { stageBg.src = ''; stageBg.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
    if (stageLogo) stageLogo.style.display = 'none';
  }

  // Cargar logos disponibles vía API con prioridad estricta para la cuenta activa
  const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
  const activeAccountId = activeAcc?.pageId || '';
  const activeAccountName = activeAcc?.pageName || 'Cuenta Activa';
  const queryUrl = activeAccountId 
    ? `/api/watermarks?account_id=${encodeURIComponent(activeAccountId)}&all=true`
    : '/api/watermarks?all=true';

  fetch(queryUrl)
    .then(r => r.json())
    .then(json => {
      if (!json.success) return;
      _availableWatermarks = json.data || [];
      const select = document.getElementById('stamp-logo-select');
      if (!select) return;

      const currentAccLogos = activeAccountId 
        ? _availableWatermarks.filter(w => String(w.account_id) === String(activeAccountId))
        : _availableWatermarks;
      const otherAccLogos = activeAccountId 
        ? _availableWatermarks.filter(w => String(w.account_id) !== String(activeAccountId))
        : [];

      if (currentAccLogos.length > 0) {
        let html = '';
        if (otherAccLogos.length > 0) {
          html += `<optgroup label="✨ Logos de ${activeAccountName}">`;
        }
        currentAccLogos.forEach((w, idx) => {
          const isDef = w.is_default ? ' ★ (Principal)' : '';
          html += `<option value="${w.id}" ${idx === 0 ? 'selected' : ''}>${w.name}${isDef}</option>`;
        });
        if (otherAccLogos.length > 0) {
          html += `</optgroup><optgroup label="Otros Negocios">`;
          otherAccLogos.forEach(w => {
            const acc = w.account_name ? ` [${w.account_name}]` : '';
            html += `<option value="${w.id}">${w.name}${acc}</option>`;
          });
          html += `</optgroup>`;
        }
        select.innerHTML = html;
        if (stageLogoImg && currentAccLogos[0]) {
          stageLogoImg.src = currentAccLogos[0].filepath;
          if (stageLogo && targetImg) stageLogo.style.display = 'flex';
        }
      } else {
        let html = `<option value="">(Sin logos para ${activeAccountName} - Sube uno abajo)</option>`;
        if (otherAccLogos.length > 0) {
          html += `<optgroup label="Logos de Otras Cuentas">`;
          otherAccLogos.forEach(w => {
            const acc = w.account_name ? ` [${w.account_name}]` : '';
            html += `<option value="${w.id}">${w.name}${acc}</option>`;
          });
          html += `</optgroup>`;
        }
        select.innerHTML = html;
        if (stageLogo) stageLogo.style.display = 'none';
      }
    })
    .catch(err => console.warn('[MetaPulse] Error cargando logos:', err));
};

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
    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const url = activeAcc?.pageId ? `/api/watermarks?account_id=${encodeURIComponent(activeAcc.pageId)}` : '/api/watermarks';
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) return;

    const watermarks = json.data;
    const nameEl = document.getElementById('logo-file-name');
    if (nameEl) {
      if (watermarks && watermarks.length > 0) {
        nameEl.textContent = `Logo activo (${activeAcc?.pageName || 'Esta cuenta'}): ${watermarks[0].name} (${watermarks[0].filename})`;
        nameEl.classList.remove('text-muted');
        nameEl.classList.add('text-emerald');
      } else {
        nameEl.textContent = `Ningún logo configurado para ${activeAcc?.pageName || 'esta cuenta'}`;
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
      const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;

      const formData = new FormData();
      formData.append('logo', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
      if (activeAcc?.pageId) formData.append('account_id', activeAcc.pageId);
      if (activeAcc?.pageName) formData.append('account_name', activeAcc.pageName);

      showToast(`Guardando logotipo oficial para ${activeAcc?.pageName || 'cuenta activa'}...`, 'info');

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

  // closeInteractiveStamp ya definido en scope global arriba

  function syncStampPosition() {
    const stageWrap = document.getElementById('stamp-stage-wrap');
    const stageLogo = document.getElementById('stamp-stage-logo');
    const coordX = document.getElementById('stamp-coord-x');
    const coordY = document.getElementById('stamp-coord-y');
    if (!stageWrap || !stageLogo) return;

    const stageW = stageWrap.clientWidth;
    const stageH = stageWrap.clientHeight;
    if (stageW <= 0 || stageH <= 0) return;

    const logoW = Math.max(24, Math.round(stageW * (stampScale / 100)));
    stageLogo.style.width = logoW + 'px';
    stageLogo.style.opacity = (stampOpacity / 100).toString();

    const logoH = stageLogo.offsetHeight || Math.round(logoW * 0.6);
    const maxLeft = Math.max(0, stageW - logoW);
    const maxTop = Math.max(0, stageH - logoH);

    const left = Math.max(0, Math.min(maxLeft, Math.round(stageW * (stampXPercent / 100))));
    const top = Math.max(0, Math.min(maxTop, Math.round(stageH * (stampYPercent / 100))));

    stageLogo.style.left = left + 'px';
    stageLogo.style.top = top + 'px';

    if (coordX) coordX.textContent = Math.round((left / stageW) * 100) + '%';
    if (coordY) coordY.textContent = Math.round((top / stageH) * 100) + '%';
  }

  function snapStampToPreset(pos) {
    const stageWrap = document.getElementById('stamp-stage-wrap');
    const stageLogo = document.getElementById('stamp-stage-logo');
    const coordX = document.getElementById('stamp-coord-x');
    const coordY = document.getElementById('stamp-coord-y');
    if (!stageWrap || !stageLogo) return;

    const stageW = stageWrap.clientWidth;
    const stageH = stageWrap.clientHeight;
    if (stageW <= 0 || stageH <= 0) return;

    const logoW = stageLogo.offsetWidth || Math.round(stageW * (stampScale / 100));
    const logoH = stageLogo.offsetHeight || Math.round(logoW * 0.6);
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

    stageLogo.style.left = left + 'px';
    stageLogo.style.top = top + 'px';

    if (coordX) coordX.textContent = Math.round(stampXPercent) + '%';
    if (coordY) coordY.textContent = Math.round(stampYPercent) + '%';

    document.querySelectorAll('.btn-stamp-snap').forEach(b => {
      b.classList.toggle('active', b.dataset.pos === pos);
    });
  }

  // Eventos de arrastre para el logo
  function onPointerDown(e) {
    const stageLogo = document.getElementById('stamp-stage-logo');
    if (!stageLogo) return;
    isDraggingStamp = true;
    const pt = e.touches ? e.touches[0] : e;
    dragStartX = pt.clientX;
    dragStartY = pt.clientY;
    dragInitLeft = stageLogo.offsetLeft;
    dragInitTop = stageLogo.offsetTop;
    stageLogo.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDraggingStamp) return;
    const stageWrap = document.getElementById('stamp-stage-wrap');
    const stageLogo = document.getElementById('stamp-stage-logo');
    const coordX = document.getElementById('stamp-coord-x');
    const coordY = document.getElementById('stamp-coord-y');
    if (!stageWrap || !stageLogo) return;

    const pt = e.touches ? e.touches[0] : e;
    const dx = pt.clientX - dragStartX;
    const dy = pt.clientY - dragStartY;

    const stageW = stageWrap.clientWidth;
    const stageH = stageWrap.clientHeight;
    const logoW = stageLogo.offsetWidth;
    const logoH = stageLogo.offsetHeight;

    const maxLeft = Math.max(0, stageW - logoW);
    const maxTop = Math.max(0, stageH - logoH);

    const newLeft = Math.max(0, Math.min(maxLeft, dragInitLeft + dx));
    const newTop = Math.max(0, Math.min(maxTop, dragInitTop + dy));

    stageLogo.style.left = newLeft + 'px';
    stageLogo.style.top = newTop + 'px';

    stampXPercent = Math.round((newLeft / stageW) * 1000) / 10;
    stampYPercent = Math.round((newTop / stageH) * 1000) / 10;

    if (coordX) coordX.textContent = Math.round(stampXPercent) + '%';
    if (coordY) coordY.textContent = Math.round(stampYPercent) + '%';

    document.querySelectorAll('.btn-stamp-snap').forEach(b => b.classList.remove('active'));
    e.preventDefault();
  }

  function onPointerUp() {
    if (isDraggingStamp) {
      isDraggingStamp = false;
      const stageLogo = document.getElementById('stamp-stage-logo');
      if (stageLogo) stageLogo.style.cursor = 'grab';
    }
  }

  // Carga de logos desde el backend con soporte multi-cuenta y fallback global
  async function loadWatermarksForStampModal() {
    try {
      const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
      const activeAccountId = activeAcc?.pageId || '';
      const activeAccountName = activeAcc?.pageName || 'Cuenta Activa';
      const q = activeAccountId 
        ? `/api/watermarks?account_id=${encodeURIComponent(activeAccountId)}&all=true`
        : '/api/watermarks?all=true';

      const res = await fetch(q);
      const json = await res.json();
      if (!json.success) return;

      availableWatermarks = json.data || [];
      _availableWatermarks = availableWatermarks;
      const select = document.getElementById('stamp-logo-select');
      const stageLogo = document.getElementById('stamp-stage-logo');
      const stageLogoImg = document.getElementById('stamp-stage-logo-img');

      if (!select) return;

      const currentAccLogos = activeAccountId 
        ? availableWatermarks.filter(w => String(w.account_id) === String(activeAccountId))
        : availableWatermarks;
      const otherAccLogos = activeAccountId 
        ? availableWatermarks.filter(w => String(w.account_id) !== String(activeAccountId))
        : [];

      if (currentAccLogos.length > 0) {
        let html = '';
        if (otherAccLogos.length > 0) {
          html += `<optgroup label="✨ Logos de ${activeAccountName}">`;
        }
        currentAccLogos.forEach((w, idx) => {
          const isDef = w.is_default ? ' ★ (Principal)' : '';
          html += `<option value="${w.id}" ${idx === 0 ? 'selected' : ''}>${w.name}${isDef}</option>`;
        });
        if (otherAccLogos.length > 0) {
          html += `</optgroup><optgroup label="Otros Negocios">`;
          otherAccLogos.forEach(w => {
            const acc = w.account_name ? ` [${w.account_name}]` : '';
            html += `<option value="${w.id}">${w.name}${acc}</option>`;
          });
          html += `</optgroup>`;
        }
        select.innerHTML = html;

        const activeLogo = currentAccLogos[0];
        if (stageLogoImg && activeLogo) {
          stageLogoImg.src = activeLogo.filepath;
          if (stageLogo) stageLogo.style.display = 'flex';
          setTimeout(() => {
            syncStampPosition();
          }, 50);
        }
      } else {
        let html = `<option value="">(Sin logos registrados para ${activeAccountName} - Sube uno abajo)</option>`;
        if (otherAccLogos.length > 0) {
          html += `<optgroup label="Logos de Otras Cuentas">`;
          otherAccLogos.forEach(w => {
            const acc = w.account_name ? ` [${w.account_name}]` : '';
            html += `<option value="${w.id}">${w.name}${acc}</option>`;
          });
          html += `</optgroup>`;
        }
        select.innerHTML = html;
        if (stageLogo) stageLogo.style.display = 'none';
      }
    } catch (err) {
      console.warn('Error cargando logos para el modal:', err);
    }
  }

  // openInteractiveStampModal ya definido en scope global arriba.
  // Aquí sincronizamos las variables internas con las globales al abrirse el modal
  // y conectamos la función con la lógica de drag interna.
  const _origOpen = window.openInteractiveStampModal;
  window.openInteractiveStampModal = function(forcedImage, onCompleteCallback) {
    // Llamar a la versión global que muestra el modal
    _origOpen(forcedImage, onCompleteCallback);
    // Sincronizar variables internas
    currentTargetImage = _currentTargetImage;
    availableWatermarks = _availableWatermarks;
    // Posicionar logo después de un pequeño delay
    setTimeout(() => {
      syncStampPosition();
      snapStampToPreset('bottom-right');
    }, 80);
    setTimeout(syncStampPosition, 200);
  };

  function initInteractiveStampListeners() {
    const stageLogo = document.getElementById('stamp-stage-logo');
    if (stageLogo) {
      stageLogo.removeEventListener('mousedown', onPointerDown);
      stageLogo.addEventListener('mousedown', onPointerDown);
      stageLogo.removeEventListener('touchstart', onPointerDown);
      stageLogo.addEventListener('touchstart', onPointerDown, { passive: false });
    }

    window.removeEventListener('mousemove', onPointerMove);
    window.addEventListener('mousemove', onPointerMove);
    window.removeEventListener('touchmove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.removeEventListener('mouseup', onPointerUp);
    window.addEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchend', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    const sliderScale = document.getElementById('stamp-slider-scale');
    const scaleVal = document.getElementById('stamp-scale-val');
    if (sliderScale) {
      sliderScale.oninput = () => {
        stampScale = parseInt(sliderScale.value, 10) || 18;
        if (scaleVal) scaleVal.textContent = `${stampScale}%`;
        syncStampPosition();
      };
    }

    const sliderOpacity = document.getElementById('stamp-slider-opacity');
    const opacityVal = document.getElementById('stamp-opacity-val');
    if (sliderOpacity) {
      sliderOpacity.oninput = () => {
        stampOpacity = parseInt(sliderOpacity.value, 10) || 90;
        if (opacityVal) opacityVal.textContent = `${stampOpacity}%`;
        const sLogo = document.getElementById('stamp-stage-logo');
        if (sLogo) sLogo.style.opacity = (stampOpacity / 100).toString();
      };
    }

    document.querySelectorAll('.btn-stamp-snap').forEach(btn => {
      btn.onclick = () => {
        snapStampToPreset(btn.dataset.pos);
      };
    });

    const select = document.getElementById('stamp-logo-select');
    if (select) {
      select.onchange = () => {
        const found = availableWatermarks.find(w => String(w.id) === String(select.value));
        const sLogoImg = document.getElementById('stamp-stage-logo-img');
        if (found && sLogoImg) {
          sLogoImg.src = found.filepath;
          setTimeout(syncStampPosition, 40);
        }
      };
    }

    const baseFileInput = document.getElementById('stamp-base-file-input');
    if (baseFileInput) {
      baseFileInput.onchange = async () => {
        if (!baseFileInput.files || baseFileInput.files.length === 0) return;
        const file = baseFileInput.files[0];
        const formData = new FormData();
        formData.append('media', file);
        showToast('Subiendo foto para estampar...', 'info');
        try {
          const res = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData
          });
          const json = await res.json();
          if (json.success && json.data && json.data.length > 0) {
            const uploadedUrl = json.data[0].url;
            if (typeof ComposerState !== 'undefined') {
              ComposerState.mediaFiles = [uploadedUrl];
              if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
              if (typeof updateLivePreviews === 'function') updateLivePreviews();
            }
            window.openInteractiveStampModal(uploadedUrl);
            showToast('¡Foto cargada! Ahora posiciona el logo.', 'success');
          } else {
            showToast('Error subiendo foto: ' + (json.error || 'Desconocido'), 'error');
          }
        } catch (err) {
          showToast('Error de conexión: ' + err.message, 'error');
        }
      };
    }

    const btnUpload = document.getElementById('btn-stamp-upload-new-logo');
    const inputUpload = document.getElementById('stamp-quick-logo-input');
    if (btnUpload && inputUpload) {
      btnUpload.onclick = () => inputUpload.click();
      inputUpload.onchange = async () => {
        if (!inputUpload.files || inputUpload.files.length === 0) return;
        const file = inputUpload.files[0];
        const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;

        const formData = new FormData();
        formData.append('logo', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        if (activeAcc?.pageId) formData.append('account_id', activeAcc.pageId);
        if (activeAcc?.pageName) formData.append('account_name', activeAcc.pageName);

        showToast(`Subiendo nuevo logotipo para ${activeAcc?.pageName || 'cuenta activa'}...`, 'info');
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
      };
    }

    const stampModal = document.getElementById('modal-interactive-stamp');
    if (stampModal) {
      stampModal.onclick = (e) => {
        if (e.target === stampModal) {
          window.closeInteractiveStamp();
        }
      };
    }

    const btnConfirm = document.getElementById('btn-confirm-stamp-logo');
    if (btnConfirm) {
      btnConfirm.onclick = async () => {
        // Usar las variables globales (_currentTargetImage, _availableWatermarks)
        // que se actualizan al abrir el modal desde openInteractiveStampModal
        const targetImg = _currentTargetImage;
        const watermarks = _availableWatermarks;

        if (!targetImg) {
          showToast('No hay imagen para estampar. Sube o selecciona una foto.', 'warning');
          const baseInput = document.getElementById('stamp-base-file-input');
          if (baseInput) baseInput.click();
          return;
        }

        if (watermarks.length === 0) {
          showToast('Debes subir un logotipo PNG primero en Multimedia & Logos', 'warning');
          const quickInput = document.getElementById('stamp-quick-logo-input');
          if (quickInput) quickInput.click();
          return;
        }

        const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
        const accountSelect = document.getElementById('global-account-select');
        const accountId = activeAcc?.pageId || accountSelect?.value || '';

        const sel = document.getElementById('stamp-logo-select');
        const selectedId = sel ? sel.value : '';

        if (!selectedId) {
          showToast(`Debes seleccionar o subir un logotipo para ${activeAcc?.pageName || 'esta cuenta'}`, 'warning');
          return;
        }

        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span>⚡ Estampando logotipo...</span>';
        showToast('Generando nueva imagen con el logotipo estampado...', 'info');

        try {
          const res = await fetch('/api/watermark/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imagePath: targetImg,
              watermarkId: parseInt(selectedId, 10),
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

            if (typeof window._stampCustomCallback === 'function') {
              const cb = window._stampCustomCallback;
              window._stampCustomCallback = null;
              cb(newImageUrl);
            } else {
              // Guardar la nueva imagen en el composer (no abre nada del PC)
              if (typeof ComposerState !== 'undefined') {
                ComposerState.mediaFiles = [newImageUrl];
              }
              if (typeof renderMediaPreviews === 'function') renderMediaPreviews();
              if (typeof updateLivePreviews === 'function') updateLivePreviews();
              if (typeof updateBaseImageVisibility === 'function') updateBaseImageVisibility();
            }

            window.closeInteractiveStamp();
            showToast('¡Logotipo estampado con éxito! ✨', 'success');

            if (typeof window.loadMediaGallery === 'function') {
              window.loadMediaGallery();
            }
          } else {
            showToast('Error estampando logotipo: ' + (json.error || 'Desconocido'), 'error');
          }
        } catch (err) {
          showToast('Error de conexión: ' + err.message, 'error');
        } finally {
          btnConfirm.disabled = false;
          btnConfirm.innerHTML = '<span>✨ Estampar y Generar Nueva Imagen</span>';
        }
      };
    }
  }

  initInteractiveStampListeners();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInteractiveStampListeners);
  }
});
