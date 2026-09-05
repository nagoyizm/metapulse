/**
 * batchScheduler.js - MetaPulse Suite
 * Manejador del Importador y Programador en Lote (Batch Autopilot)
 * Procesa afiches de Gemini Web, estampa el sello oficial de Kmarket,
 * redacta los copies con formato oficial y los agenda en slots libres del calendario.
 */

(function () {
  let currentBatchItems = [];

  function getEl(id) {
    return document.getElementById(id);
  }

  window.openBatchModal = function openBatchModal() {
    const modal = getEl('modal-batch-autopilot');
    if (!modal) return;
    modal.style.display = 'flex';
    resetBatchViews();
  };

  window.closeBatchModal = function closeBatchModal() {
    const modal = getEl('modal-batch-autopilot');
    if (!modal) return;
    modal.style.display = 'none';
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

  // Delegación de eventos para apertura y cierre garantizados
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
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'batch-chk-create-stories') {
      const timingBox = getEl('batch-story-timing-box');
      if (timingBox) timingBox.style.display = e.target.checked ? 'flex' : 'none';
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
        currentBatchItems = json.items;
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
      card.style.gridTemplateColumns = '140px 1fr';
      card.style.gap = '16px';
      card.style.alignItems = 'start';

      const formattedDatetime = item.scheduledAt ? item.scheduledAt.slice(0, 16) : '';

      card.innerHTML = `
        <!-- Columna Izquierda: Imagen con sello y check -->
        <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
          <div style="position:relative; width:100%; border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle); background:#0f172a; aspect-ratio:4/5;">
            <img src="${item.imageUrl}" alt="${item.productName}" style="width:100%; height:100%; object-fit:cover;">
            <div style="position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.75); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700;">
              #${index + 1}
            </div>
            <div style="position:absolute; bottom:6px; right:6px; background:rgba(16,185,129,0.9); color:#fff; font-size:0.65rem; padding:2px 5px; border-radius:4px; font-weight:600;">
              Sello ✅
            </div>
          </div>

          <label style="display:flex; align-items:center; gap:6px; font-size:0.8rem; cursor:pointer; font-weight:600; color:var(--text-primary);">
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

      const textarea = card.querySelector('.batch-item-content');
      const counter = card.querySelector('.batch-char-counter');
      if (textarea && counter) {
        textarea.addEventListener('input', () => {
          counter.textContent = `${textarea.value.length} caracteres`;
        });
      }

      const toggle = card.querySelector('.batch-item-toggle');
      if (toggle) {
        toggle.addEventListener('change', () => {
          card.style.opacity = toggle.checked ? '1' : '0.45';
        });
      }

      itemsContainer.appendChild(card);
    });
  }

  /**
   * Recopila todos los posts aprobados del lote y los envía a programar masivamente
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
    const storyTimingRule = document.getElementById('batch-story-timing-option')?.value || 'plus_3h';

    try {
      const res = await fetch('/api/batch/confirm-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: postsToSchedule,
          include_stories: includeStories,
          story_timing_rule: storyTimingRule
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

})();
