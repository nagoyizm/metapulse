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
});
