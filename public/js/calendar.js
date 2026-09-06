// =============================================================================
// MetaPulse Visual Content Planner & Queue Controller
// =============================================================================

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const PlannerState = {
  currentDate: new Date(),
  filter: 'all',
  currentView: 'calendar',
  posts: []
};

// 1. Inicialización y Gestión de Vistas del Planner
document.addEventListener('DOMContentLoaded', () => {
  // Selector de Vistas: Calendario, Lista o Slots
  document.querySelectorAll('.planner-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.planner-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      PlannerState.currentView = view;

      const calView = document.getElementById('view-planner-calendar');
      const listView = document.getElementById('view-planner-list');
      const slotsView = document.getElementById('view-planner-slots');

      if (calView) calView.style.display = view === 'calendar' ? 'flex' : 'none';
      if (listView) listView.style.display = view === 'list' ? 'block' : 'none';
      if (slotsView) slotsView.style.display = view === 'slots' ? 'block' : 'none';

      if (view === 'calendar') {
        renderPlannerCalendar();
      } else if (view === 'list') {
        window.loadQueuePosts();
      } else if (view === 'slots') {
        window.loadScheduleSlots();
      }
    });
  });

  // Navegación de Meses en el Planner
  const btnPrev = document.getElementById('btn-planner-prev');
  const btnNext = document.getElementById('btn-planner-next');
  const btnToday = document.getElementById('btn-planner-today');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      PlannerState.currentDate.setMonth(PlannerState.currentDate.getMonth() - 1);
      renderPlannerCalendar();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      PlannerState.currentDate.setMonth(PlannerState.currentDate.getMonth() + 1);
      renderPlannerCalendar();
    });
  }

  if (btnToday) {
    btnToday.addEventListener('click', () => {
      PlannerState.currentDate = new Date();
      renderPlannerCalendar();
    });
  }

  // Filtros del Calendario Planner
  document.querySelectorAll('#planner-filter-pills .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#planner-filter-pills .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      PlannerState.filter = pill.dataset.plannerFilter || 'all';
      renderPlannerCalendar();
    });
  });

  // Botón Crear Post desde Planner
  const btnNewPost = document.getElementById('btn-planner-new-post');
  if (btnNewPost) {
    btnNewPost.addEventListener('click', () => {
      if (typeof window.switchTab === 'function') {
        window.switchTab('composer');
      }
    });
  }

  // Modal Detalle de Publicación
  const modalDetail = document.getElementById('modal-planner-detail');
  const btnCloseDetail = document.getElementById('btn-close-planner-detail');
  const btnDetailCloseFooter = document.getElementById('btn-planner-detail-close');
  const btnLoadComposer = document.getElementById('btn-planner-load-composer');
  const btnPlannerPublishStoryNow = document.getElementById('btn-planner-publish-story-now');
  const btnPlannerEditStoryComposer = document.getElementById('btn-planner-edit-story-composer');
  const btnPlannerStoryFooter = document.getElementById('btn-planner-story-footer');

  function closeModal() {
    if (modalDetail) {
      modalDetail.style.display = 'none';
      modalDetail._currentPost = null;
    }
  }

  if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeModal);
  if (btnDetailCloseFooter) btnDetailCloseFooter.addEventListener('click', closeModal);
  if (modalDetail) {
    modalDetail.addEventListener('click', (e) => {
      if (e.target === modalDetail) closeModal();
    });
  }

  // Acción: Cargar en Composer (Formato original)
  if (btnLoadComposer) {
    btnLoadComposer.addEventListener('click', () => {
      const post = modalDetail._currentPost;
      if (!post) return;
      closeModal();

      if (typeof window.switchTab === 'function') {
        window.switchTab('composer');
      }

      const postContent = document.getElementById('post-content');
      const postTitle = document.getElementById('post-title');
      if (postContent) postContent.value = post.content || '';
      if (postTitle && post.title) postTitle.value = post.title;

      try {
        const media = JSON.parse(post.media_urls || '[]');
        if (typeof window.setComposerMedia === 'function') {
          window.setComposerMedia(media);
        }
      } catch (_) {}

      if (typeof window.updateLivePreviews === 'function') {
        window.updateLivePreviews();
      }

      showToast('Publicación cargada en el Composer', 'success');
    });
  }

  // Acción: Enviar / Publicar directamente como Historia 9:16
  if (btnPlannerPublishStoryNow) {
    btnPlannerPublishStoryNow.addEventListener('click', async () => {
      const post = modalDetail._currentPost;
      if (!post) return;

      const confirmMsg = `¿Deseas adaptar y publicar la publicación #${post.id} inmediatamente como Historia (Story 9:16) en tu cuenta seleccionada?`;
      if (!confirm(confirmMsg)) return;

      btnPlannerPublishStoryNow.disabled = true;
      const originalText = btnPlannerPublishStoryNow.innerHTML;
      btnPlannerPublishStoryNow.innerHTML = '<span>⏳</span> Publicando Historia...';

      try {
        showToast(`Generando tarjeta 9:16 y publicando historia...`, 'info');
        const res = await fetch(`/api/posts/${post.id}/publish-story-now`, { method: 'POST' });
        const json = await res.json();
        if (!json.success) {
          showToast('Error al publicar historia: ' + (json.error || 'Desconocido'), 'error');
          return;
        }

        showToast('¡Historia publicada exitosamente en Meta!', 'success');
        closeModal();
        if (typeof window.loadPlannerData === 'function') {
          await window.loadPlannerData();
        }
      } catch (err) {
        showToast('Error de conexión al publicar historia: ' + err.message, 'error');
      } finally {
        btnPlannerPublishStoryNow.disabled = false;
        btnPlannerPublishStoryNow.innerHTML = originalText;
      }
    });
  }

  // Acción: Maquetar como Historia 9:16 en Composer
  const handleEditAsStory = () => {
    const post = modalDetail._currentPost;
    if (!post) return;
    closeModal();
    if (typeof window.repostAsStory === 'function') {
      window.repostAsStory(post.id);
    }
  };

  if (btnPlannerEditStoryComposer) btnPlannerEditStoryComposer.addEventListener('click', handleEditAsStory);
  if (btnPlannerStoryFooter) btnPlannerStoryFooter.addEventListener('click', handleEditAsStory);

  // Botón Eliminar / Desprogramar desde el Modal
  const btnDeletePost = document.getElementById('btn-planner-delete-post');
  if (btnDeletePost) {
    btnDeletePost.addEventListener('click', async () => {
      const post = modalDetail._currentPost;
      if (!post) return;
      if (!confirm(`¿Deseas desprogramar y eliminar la publicación #${post.id}?`)) return;
      
      closeModal();
      await window.deletePost(post.id);
    });
  }

  // Botón Sincronizar Posts de Meta en Cola
  const btnSyncLiveQueue = document.getElementById('btn-sync-live-queue');
  if (btnSyncLiveQueue) {
    btnSyncLiveQueue.addEventListener('click', async () => {
      btnSyncLiveQueue.disabled = true;
      btnSyncLiveQueue.textContent = '🔄 Sincronizando...';
      try {
        const res = await fetch('/api/meta/sync-live-posts', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast(json.data.message || 'Posts sincronizados con éxito', 'success');
          await window.loadPlannerData();
          if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
        } else {
          showToast('Error sincronizando: ' + (json.error || 'Desconocido'), 'error');
        }
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
      } finally {
        btnSyncLiveQueue.disabled = false;
        btnSyncLiveQueue.textContent = '🔄 Sincronizar Posts de Meta';
      }
    });
  }

  // 2. Filtros de Cola (Vista Lista)
  document.querySelectorAll('#view-planner-list .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#view-planner-list .filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      window.loadQueuePosts();
    });
  });

  // Guardar configuración de slots y presets
  const btnSaveSlots = document.getElementById('btn-save-slots');
  const btnSaveAsNewPreset = document.getElementById('btn-save-as-new-preset');
  const btnActivatePreset = document.getElementById('btn-activate-selected-preset');
  const btnDeletePreset = document.getElementById('btn-delete-selected-preset');
  const selectPresets = document.getElementById('select-schedule-presets');

  function collectCurrentSlotsFromDOM() {
    const rows = document.querySelectorAll('.day-slot-row');
    const slotsPayload = [];
    rows.forEach(row => {
      const dayIdx = Number(row.dataset.day);
      const tags = row.querySelectorAll('.slot-pill-tag');
      tags.forEach(t => {
        slotsPayload.push({
          day_of_week: dayIdx,
          time_slot: t.dataset.time,
          is_active: 1,
          platforms: ['facebook', 'instagram']
        });
      });
    });
    return slotsPayload;
  }

  if (selectPresets) {
    selectPresets.addEventListener('change', () => {
      const selectedId = Number(selectPresets.value);
      const presets = window._loadedSchedulePresets || [];
      const chosen = presets.find(p => p.id === selectedId);
      if (chosen) {
        window.renderSlotsInDOM(chosen.slots);
        window.updatePresetActiveBadge(chosen.is_active);
      }
    });
  }

  if (btnSaveSlots) {
    btnSaveSlots.addEventListener('click', async () => {
      const slotsPayload = collectCurrentSlotsFromDOM();
      if (slotsPayload.length === 0) {
        showToast('Agrega al menos una hora en algún día antes de guardar.', 'warning');
        return;
      }

      const presets = window._loadedSchedulePresets || [];
      const currentPresetId = Number(selectPresets?.value);
      const currentPreset = presets.find(p => p.id === currentPresetId);
      const presetName = currentPreset ? currentPreset.name : 'Horario Personalizado';

      try {
        // 1. Guardar en el preset seleccionado
        await fetch('/api/schedule-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: presetName,
            slots: slotsPayload,
            isActive: Boolean(currentPreset?.is_active)
          })
        });

        // 2. Si es el horario activo, guardar también en slots directos
        if (currentPreset?.is_active) {
          await fetch('/api/slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slots: slotsPayload })
          });
        }

        showToast(`Horario "${presetName}" actualizado correctamente`, 'success');
        await window.loadScheduleSlots();
        if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
      } catch (err) {
        showToast('Error guardando horario: ' + err.message, 'error');
      }
    });
  }

  if (btnSaveAsNewPreset) {
    btnSaveAsNewPreset.addEventListener('click', async () => {
      const slotsPayload = collectCurrentSlotsFromDOM();
      if (slotsPayload.length === 0) {
        showToast('Configura al menos un día y hora antes de guardar la prueba.', 'warning');
        return;
      }

      const count = (window._loadedSchedulePresets || []).length + 1;
      const defaultName = `Prueba ${count} - Horario Alternativo`;
      const name = prompt('Ingresa un nombre para este horario / prueba (ej: Prueba 2 - Tardes y Noches):', defaultName);
      if (!name || !name.trim()) return;

      const desc = prompt('Descripción o notas sobre este horario (opcional):', 'Prueba A/B para corroborar alcance en este horario');

      try {
        const res = await fetch('/api/schedule-presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: desc || '',
            slots: slotsPayload,
            isActive: false
          })
        });
        const json = await res.json();
        if (json.success) {
          showToast(`¡Horario "${name.trim()}" guardado!`, 'success');
          await window.loadScheduleSlots(json.id);
        } else {
          showToast('Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error al guardar nueva prueba: ' + err.message, 'error');
      }
    });
  }

  if (btnActivatePreset) {
    btnActivatePreset.addEventListener('click', async () => {
      const selectedId = selectPresets?.value;
      if (!selectedId) return;

      try {
        const res = await fetch(`/api/schedule-presets/${selectedId}/activate`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          await window.loadScheduleSlots(selectedId);
          if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
        } else {
          showToast('Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error al activar horario: ' + err.message, 'error');
      }
    });
  }

  if (btnDeletePreset) {
    btnDeletePreset.addEventListener('click', async () => {
      const selectedId = selectPresets?.value;
      if (!selectedId) return;

      const presets = window._loadedSchedulePresets || [];
      const current = presets.find(p => p.id === Number(selectedId));
      if (!current) return;

      if (!confirm(`¿Estás seguro de eliminar el horario "${current.name}"?`)) return;

      try {
        const res = await fetch(`/api/schedule-presets/${selectedId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
          showToast(json.message, 'success');
          await window.loadScheduleSlots();
        } else {
          showToast('Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error al eliminar horario: ' + err.message, 'error');
      }
    });
  }

  // Preset Miércoles y Sábados
  const btnPresetWedSat = document.getElementById('btn-preset-wed-sat');
  if (btnPresetWedSat) {
    btnPresetWedSat.addEventListener('click', async () => {
      const wedSatSlots = [
        { day_of_week: 3, time_slot: '13:00', is_active: 1 },
        { day_of_week: 3, time_slot: '19:00', is_active: 1 },
        { day_of_week: 6, time_slot: '11:00', is_active: 1 },
        { day_of_week: 6, time_slot: '18:00', is_active: 1 }
      ];
      window.renderSlotsInDOM(wedSatSlots);
      showToast('Se cargó en el editor el horario de Miércoles y Sábados. Haz clic en Guardar o en Guardar como Nueva Prueba.', 'info');
    });
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupPlannerAccountFilter() {
  const pFilter = document.getElementById('planner-account-filter');
  if (pFilter && !pFilter._hasListener) {
    pFilter._hasListener = true;
    pFilter.addEventListener('change', () => {
      window.loadPlannerData(pFilter.value);
    });
  }
}

// 2. Cargar Datos del Planner (Posts pasados y futuros)
window.loadPlannerData = async function(customAccountId) {
  try {
    setupPlannerAccountFilter();
    const filterEl = document.getElementById('planner-account-filter');
    let targetAcc = customAccountId;
    if (targetAcc === undefined && filterEl) {
      targetAcc = filterEl.value;
    }
    if (!targetAcc) targetAcc = 'all';

    const url = targetAcc === 'all'
      ? '/api/posts?status=all&limit=250&accountId=all'
      : `/api/posts?status=all&limit=250&accountId=${encodeURIComponent(targetAcc)}`;

    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      PlannerState.posts = json.data || [];
      renderPlannerCalendar();
      renderQueueTable(PlannerState.posts);
    }
  } catch (err) {
    console.error('Error cargando posts para el planner:', err);
  }
};

// 3. Renderizar Cuadrícula del Calendario Planner
function renderPlannerCalendar() {
  const grid = document.getElementById('planner-calendar-grid');
  const monthLabel = document.getElementById('planner-month-label');
  if (!grid || !monthLabel) return;

  const year = PlannerState.currentDate.getFullYear();
  const month = PlannerState.currentDate.getMonth();

  monthLabel.textContent = `${monthNames[month]} ${year}`;

  grid.innerHTML = '';

  // Calcular primer día del mes (Lunes = 0, Domingo = 6)
  const firstDayObj = new Date(year, month, 1);
  const firstDayIndex = (firstDayObj.getDay() + 6) % 7; // Convertir Dom=0 a Lun=0

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // 1. Celdas del mes anterior para relleno
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = createDayCell(dayNum, true, false, null);
    grid.appendChild(cell);
  }

  // 2. Celdas del mes actual
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = isCurrentMonth && d === todayDate;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // Filtrar publicaciones que correspondan a esta fecha
    const dayPosts = PlannerState.posts.filter(p => {
      const rawDate = p.scheduled_at || p.published_at;
      if (!rawDate) return false;
      const postDateStr = rawDate.slice(0, 10);
      if (postDateStr !== dateStr) return false;

      // Aplicar filtro de formato o estado
      if (PlannerState.filter === 'all') return true;
      if (PlannerState.filter === 'story') return p.post_type === 'story';
      if (PlannerState.filter === 'reel') return p.post_type === 'reel';
      if (PlannerState.filter === 'feed') return p.post_type === 'feed' || p.post_type === 'carousel';
      if (PlannerState.filter === 'scheduled') return p.status === 'scheduled';
      if (PlannerState.filter === 'published') return p.status === 'published';
      return true;
    });

    const cell = createDayCell(d, false, isToday, dateStr, dayPosts);
    grid.appendChild(cell);
  }

  // 3. Celdas del mes siguiente para completar la cuadrícula de 7 columnas
  const totalCellsSoFar = firstDayIndex + daysInMonth;
  const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const cell = createDayCell(d, true, false, null);
    grid.appendChild(cell);
  }
}

// Crea una celda individual de día en el Planner
function createDayCell(dayNum, isOtherMonth, isToday, dateStr, posts = []) {
  const cell = document.createElement('div');
  cell.className = `planner-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`;

  const header = document.createElement('div');
  header.className = 'planner-cell-header';

  const num = document.createElement('span');
  num.className = 'planner-day-num';
  num.textContent = dayNum;
  header.appendChild(num);

  if (!isOtherMonth && dateStr) {
    const btnAdd = document.createElement('button');
    btnAdd.className = 'planner-btn-add-post';
    btnAdd.title = `Agendar publicación para el ${dayNum}`;
    btnAdd.innerHTML = '+';
    btnAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      openComposerForDate(dateStr);
    });
    header.appendChild(btnAdd);
  }

  cell.appendChild(header);

  // Lista de publicaciones en ese día
  if (posts && posts.length > 0) {
    const list = document.createElement('div');
    list.className = 'planner-items-list';

    posts.forEach(post => {
      const item = document.createElement('div');
      const isStory = post.post_type === 'story';
      const isReel = post.post_type === 'reel';
      const isFeed = post.post_type === 'feed' || post.post_type === 'carousel';
      const isScheduled = post.status === 'scheduled';

      item.className = `planner-card-item ${isStory ? 'is-story' : isReel ? 'is-reel' : 'is-feed'} ${isScheduled ? 'is-scheduled' : ''}`;

      let mediaUrls = [];
      try { mediaUrls = JSON.parse(post.media_urls || '[]'); } catch (_) {}
      const thumbUrl = mediaUrls[0] || '';

      const rawDate = post.scheduled_at || post.published_at || '';
      let timeStr = '';
      if (rawDate) {
        const dObj = new Date(rawDate);
        timeStr = dObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      }

      const formatIcon = isStory ? '📱' : isReel ? '🎥' : '🖼️';
      const statusIcon = isScheduled ? '🕒' : '✅';

      item.innerHTML = `
        ${thumbUrl ? `<img src="${thumbUrl}" class="planner-card-thumb" alt="media">` : `<div class="planner-card-thumb" style="background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:0.75rem;">${formatIcon}</div>`}
        <div class="planner-card-info">
          <span class="planner-card-time">${statusIcon} ${timeStr} · ${formatIcon}</span>
          <span class="planner-card-title">${post.title || post.content || 'Publicación'}</span>
        </div>
        <span class="planner-card-del" title="Desprogramar / Eliminar">&times;</span>
      `;

      const btnDel = item.querySelector('.planner-card-del');
      if (btnDel) {
        btnDel.addEventListener('click', (e) => {
          e.stopPropagation();
          deletePost(post.id);
        });
      }

      item.addEventListener('click', () => {
        showPlannerPostDetail(post);
      });

      list.appendChild(item);
    });

    cell.appendChild(list);
  }

  return cell;
}

// Abre el modal de detalle al hacer clic en un post del Planner
function showPlannerPostDetail(post) {
  const modal = document.getElementById('modal-planner-detail');
  if (!modal) return;
  modal._currentPost = post;

  const isStory = post.post_type === 'story';
  const isReel = post.post_type === 'reel';
  const isScheduled = post.status === 'scheduled';

  const formatBadge = document.getElementById('planner-detail-format-badge');
  if (formatBadge) {
    formatBadge.textContent = isStory ? '📱 Historia' : isReel ? '🎥 Reel' : '🖼️ Feed';
    formatBadge.style.background = isStory ? '#8b5cf6' : isReel ? '#ec4899' : '#3b82f6';
  }

  const titleEl = document.getElementById('planner-detail-title');
  if (titleEl) titleEl.textContent = post.title || 'Publicación sin título';

  const rawDate = post.scheduled_at || post.published_at;
  const dateEl = document.getElementById('planner-detail-datetime');
  if (dateEl) {
    dateEl.textContent = rawDate
      ? new Date(rawDate).toLocaleString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Sin fecha asignada';
  }

  let metaRes = null;
  try { metaRes = typeof post.meta_result === 'string' ? JSON.parse(post.meta_result) : post.meta_result; } catch (_) {}

  const statusEl = document.getElementById('planner-detail-status-pill');
  const deliveryEl = document.getElementById('planner-detail-delivery-breakdown');

  const fbSuccess = metaRes?.facebook?.success;
  const igSuccess = metaRes?.instagram?.success;

  if (statusEl) {
    if (isScheduled) {
      statusEl.innerHTML = '<span class="status-pill scheduled">🕒 Programado</span>';
    } else if (post.status === 'published') {
      if (metaRes && metaRes.facebook && metaRes.instagram) {
        if (fbSuccess && igSuccess) {
          statusEl.innerHTML = '<span class="status-pill published">✅ Publicado (FB + IG)</span>';
        } else if (igSuccess && !fbSuccess) {
          statusEl.innerHTML = '<span class="status-pill" style="background:#f59e0b; color:#fff; font-weight:700;">⚠️ Publicado solo en Instagram</span>';
        } else if (fbSuccess && !igSuccess) {
          statusEl.innerHTML = '<span class="status-pill" style="background:#f59e0b; color:#fff; font-weight:700;">⚠️ Publicado solo en Facebook</span>';
        } else {
          statusEl.innerHTML = '<span class="status-pill published">✅ Publicado</span>';
        }
      } else {
        statusEl.innerHTML = '<span class="status-pill published">✅ Publicado</span>';
      }
    } else {
      statusEl.innerHTML = '<span class="status-pill failed">❌ Error en envío</span>';
    }
  }

  if (deliveryEl) {
    if (metaRes && (metaRes.facebook || metaRes.instagram)) {
      let fbHtml = '';
      let igHtml = '';
      if (metaRes.facebook) {
        if (metaRes.facebook.success) {
          fbHtml = '<div style="color:#10b981; margin-bottom:2px;">📘 <strong>Facebook:</strong> Publicado exitosamente</div>';
        } else {
          fbHtml = `<div style="color:#f43f5e; margin-bottom:2px;">📘 <strong>Facebook:</strong> Falló (${metaRes.facebook.error || 'Error'})</div>`;
        }
      }
      if (metaRes.instagram) {
        if (metaRes.instagram.success) {
          igHtml = '<div style="color:#10b981;">📷 <strong>Instagram:</strong> Publicado exitosamente</div>';
        } else {
          igHtml = `<div style="color:#f43f5e;">📷 <strong>Instagram:</strong> Falló (${metaRes.instagram.error || 'Error'})</div>`;
        }
      }

      const hasPartialError = (metaRes.facebook && !metaRes.facebook.success) || (metaRes.instagram && !metaRes.instagram.success);

      deliveryEl.innerHTML = `
        <div style="font-weight:700; margin-bottom:6px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
          <span>📡</span> Entrega por plataforma:
        </div>
        ${fbHtml}
        ${igHtml}
        ${hasPartialError && metaRes.facebook?.error?.includes('pages_manage_posts') ? `
          <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(239, 68, 68, 0.3); font-size:0.75rem; color:var(--text-secondary);">
            💡 <em>Tu token actual no tiene concedido el permiso <strong>pages_manage_posts</strong> en Meta. Por eso Instagram sí publica pero Facebook rechaza el post.</em>
          </div>
        ` : ''}
      `;
      deliveryEl.style.display = 'block';
      deliveryEl.style.background = hasPartialError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)';
      deliveryEl.style.border = hasPartialError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)';
    } else {
      deliveryEl.style.display = 'none';
    }
  }

  const copyEl = document.getElementById('planner-detail-copy');
  if (copyEl) copyEl.textContent = post.content || 'Sin texto';

  let mediaUrls = [];
  try { mediaUrls = JSON.parse(post.media_urls || '[]'); } catch (_) {}

  const mediaContainer = document.getElementById('planner-detail-media-container');
  if (mediaContainer) {
    if (mediaUrls.length > 0) {
      const firstMedia = mediaUrls[0];
      const isVid = firstMedia.match(/\.(mp4|mov|webm)$/i);
      mediaContainer.innerHTML = isVid
        ? `<video src="${firstMedia}" controls style="max-height:240px; max-width:100%;"></video>`
        : `<img src="${firstMedia}" alt="preview" style="max-height:240px; max-width:100%; object-fit:contain;">`;
      mediaContainer.style.display = 'flex';
    } else {
      mediaContainer.style.display = 'none';
    }
  }

  // Estado del bloque de adaptación a Historia 9:16
  const storyBox = document.getElementById('planner-detail-story-box');
  const btnStoryNow = document.getElementById('btn-planner-publish-story-now');
  const btnStoryFooter = document.getElementById('btn-planner-story-footer');
  const storyDesc = document.getElementById('planner-detail-story-desc');
  const storyBadge = document.getElementById('planner-detail-story-badge');

  if (storyBox) {
    if (mediaUrls.length === 0) {
      if (btnStoryNow) {
        btnStoryNow.disabled = true;
        btnStoryNow.style.opacity = '0.5';
        btnStoryNow.style.cursor = 'not-allowed';
      }
      if (btnStoryFooter) btnStoryFooter.style.display = 'none';
      if (storyDesc) storyDesc.textContent = 'Este post no contiene imagen ni video. Las historias requieren multimedia para ser adaptadas.';
      if (storyBadge) {
        storyBadge.textContent = 'Sin Media';
        storyBadge.style.background = 'rgba(100,116,139,0.2)';
        storyBadge.style.color = '#94a3b8';
      }
    } else if (isStory) {
      if (btnStoryNow) {
        btnStoryNow.disabled = false;
        btnStoryNow.style.opacity = '1';
        btnStoryNow.style.cursor = 'pointer';
      }
      if (btnStoryFooter) btnStoryFooter.style.display = 'inline-block';
      if (storyDesc) storyDesc.textContent = 'Esta publicación ya tiene formato de Historia. Puedes re-publicarla inmediatamente o abrirla en el Composer para editarla.';
      if (storyBadge) {
        storyBadge.textContent = 'Ya es Story';
        storyBadge.style.background = 'rgba(139,92,246,0.2)';
        storyBadge.style.color = '#a78bfa';
      }
    } else {
      if (btnStoryNow) {
        btnStoryNow.disabled = false;
        btnStoryNow.style.opacity = '1';
        btnStoryNow.style.cursor = 'pointer';
      }
      if (btnStoryFooter) btnStoryFooter.style.display = 'inline-block';
      if (storyDesc) storyDesc.textContent = 'Adapta esta publicación automáticamente a formato vertical con fondo difuminado y sticker de llamada a la acción para Instagram y Facebook Stories.';
      if (storyBadge) {
        storyBadge.textContent = 'Story 9:16';
        storyBadge.style.background = 'rgba(236,72,153,0.15)';
        storyBadge.style.color = '#ec4899';
      }
    }
  }

  modal.style.display = 'flex';
}

window.showPlannerPostDetailById = function(id) {
  const post = (PlannerState.posts || []).find(p => p.id === Number(id));
  if (post) {
    showPlannerPostDetail(post);
  }
};

// Abre el Composer con fecha preseleccionada
function openComposerForDate(dateStr) {
  if (typeof window.switchTab === 'function') {
    window.switchTab('composer');
  }

  const scheduleTypeRadio = document.querySelector('input[name="schedule-type"][value="custom"]');
  if (scheduleTypeRadio) {
    scheduleTypeRadio.checked = true;
    scheduleTypeRadio.dispatchEvent(new Event('change'));
  }

  const scheduleDateInput = document.getElementById('schedule-custom-date');
  if (scheduleDateInput) {
    scheduleDateInput.value = `${dateStr}T14:00`;
  }

  showToast(`Composer listo para agendar el ${dateStr}`, 'info');
}

// 4. Vista Lista de Publicaciones en Cola
let currentFilter = 'all';

window.loadQueuePosts = async function() {
  await window.loadPlannerData();
};

function renderQueueTable(posts) {
  const tableBody = document.getElementById('queue-table-body');
  if (!tableBody) return;

  const filtered = currentFilter === 'all' ? posts : posts.filter(p => p.status === currentFilter);

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">
          No hay publicaciones para mostrar con el filtro actual.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(post => {
    let platforms = [];
    try { platforms = JSON.parse(post.platforms || '[]'); } catch (_) {}
    const platformBadges = platforms.map(p => 
      p === 'facebook' ? '<span class="meta-badge fb" style="width:20px;height:20px;font-size:0.65rem;display:inline-flex;">f</span>' :
      p === 'instagram' ? '<span class="meta-badge ig" style="width:20px;height:20px;font-size:0.65rem;display:inline-flex;">📷</span>' : p
    ).join(' ');

    let media = [];
    try { media = JSON.parse(post.media_urls || '[]'); } catch (_) {}
    let mediaThumb = '';
    if (media.length > 0) {
      const isVid = media[0].match(/\.(mp4|mov)$/i);
      mediaThumb = isVid
        ? `<div style="width:36px; height:36px; border-radius:4px; background:#1e293b; display:flex; align-items:center; justify-content:center; flex-shrink:0;">🎬</div>`
        : `<img src="${media[0]}" style="width:36px; height:36px; object-fit:cover; border-radius:4px; flex-shrink:0; border:1px solid var(--border-color);" alt="thumb">`;
    }

    let statusPill = `<span class="status-pill ${post.status}">${post.status}</span>`;
    if (post.status === 'failed' && post.retry_count > 0) {
      statusPill += `<br><small style="color:var(--accent-rose); font-size:0.7rem;">Reintento ${post.retry_count}/${post.max_retries}</small>`;
    }

    const scheduleDate = post.published_at || post.scheduled_at 
      ? new Date(post.published_at || post.scheduled_at).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Sin fecha';

    return `
      <tr>
        <td><strong>#${post.id}</strong></td>
        <td><span class="badge" style="background: rgba(99,102,241,0.12); color: var(--primary); font-size: 0.75rem; font-weight:600; white-space:nowrap;">🏢 ${escapeHtml(post.account_name || 'Cuenta General')}</span></td>
        <td>📅 ${scheduleDate}</td>
        <td><div style="display:flex;gap:4px;align-items:center;">${platformBadges}</div></td>
        <td><span class="badge badge-accent">${(post.post_type || 'feed').toUpperCase()}</span></td>
        <td style="cursor:pointer;" onclick="window.showPlannerPostDetailById(${post.id})" title="Click para ver detalle y opciones de Historia 9:16">
          <div style="display:flex; gap:10px; align-items:center;">
            ${mediaThumb}
            <div style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${post.title ? `<strong>${escapeHtml(post.title)}:</strong> ` : ''}${escapeHtml(post.content || '')}
            </div>
          </div>
        </td>
        <td>${statusPill}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${post.status === 'scheduled' ? `
              <button class="btn btn-primary btn-xs" onclick="publishPostNow(${post.id})" title="Publicar Ahora">⚡ Enviar</button>
            ` : ''}
            ${post.status === 'failed' ? `
              <button class="btn btn-secondary btn-xs" onclick="retryPost(${post.id})" title="Reintentar">🔁 Reintentar</button>
            ` : ''}
            <button class="btn btn-secondary btn-xs" onclick="window.repostAsStory(${post.id})" title="Convertir y repostear como Historia 9:16">📲 Story</button>
            <button class="btn btn-ghost btn-xs" onclick="window.openReassignModal(${post.id}, '${escapeHtml(post.account_name || '')}', '${post.account_id || ''}')" title="Reasignar a otra cuenta">🏢 Mover</button>
            <button class="btn btn-ghost btn-xs" onclick="window.reusePost(${post.id})" title="Reutilizar copy en Composer">🔄 Reusar</button>
            <button class="btn btn-ghost btn-xs" style="color:var(--accent-rose);" onclick="deletePost(${post.id})" title="Eliminar">&times;</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 5. Cargar Slots Semanales y Presets Guardados
window._loadedSchedulePresets = [];

window.updatePresetActiveBadge = function(isActive) {
  const badge = document.getElementById('badge-active-preset');
  const btnActivate = document.getElementById('btn-activate-selected-preset');
  if (!badge) return;

  if (isActive) {
    badge.textContent = '✅ Horario Activo Vigente';
    badge.style.background = '#10b981';
    badge.style.color = '#fff';
    if (btnActivate) btnActivate.style.display = 'none';
  } else {
    badge.textContent = '⏳ Modo Borrador / Prueba (Inactivo)';
    badge.style.background = 'rgba(234, 179, 8, 0.15)';
    badge.style.color = '#ca8a04';
    if (btnActivate) btnActivate.style.display = 'inline-block';
  }
};

window.renderSlotsInDOM = function(slots) {
  const container = document.getElementById('slots-week-container');
  if (!container) return;
  container.innerHTML = '';

  const daysOrder = [1, 2, 3, 4, 5, 6, 0];
  const safeSlots = Array.isArray(slots) ? slots : [];

  daysOrder.forEach(dayIdx => {
    const daySlots = safeSlots.filter(s => Number(s.day_of_week) === dayIdx);
    const row = document.createElement('div');
    row.className = 'day-slot-row';
    row.dataset.day = dayIdx;

    row.innerHTML = `
      <div class="day-name">${dayNames[dayIdx]}</div>
      <div class="slot-pills" id="slot-pills-${dayIdx}">
        ${daySlots.map(s => `
          <div class="slot-pill-tag" data-time="${s.time_slot}">
            <span>${s.time_slot}</span>
            <span class="slot-remove" onclick="removeSlot(${dayIdx}, '${s.time_slot}')">&times;</span>
          </div>
        `).join('')}
        <button class="btn-add-slot" onclick="promptAddSlot(${dayIdx})">+ Agregar Hora</button>
      </div>
    `;
    container.appendChild(row);
  });
};

window.loadScheduleSlots = async function(preferPresetId) {
  const selectPresets = document.getElementById('select-schedule-presets');

  try {
    const res = await fetch('/api/schedule-presets');
    const json = await res.json();
    if (!json.success || !json.data) return;

    window._loadedSchedulePresets = json.data;

    if (selectPresets) {
      selectPresets.innerHTML = json.data.map(p => `
        <option value="${p.id}" ${p.is_active ? 'data-active="true"' : ''}>
          ${escapeHtml(p.name)} ${p.is_active ? ' ⭐ (Activo)' : ''}
        </option>
      `).join('');

      let targetPreset = null;
      if (preferPresetId) {
        targetPreset = json.data.find(p => p.id === Number(preferPresetId));
      }
      if (!targetPreset) {
        targetPreset = json.data.find(p => p.is_active) || json.data[0];
      }

      if (targetPreset) {
        selectPresets.value = targetPreset.id;
        window.renderSlotsInDOM(targetPreset.slots);
        window.updatePresetActiveBadge(targetPreset.is_active);
      }
    }
  } catch (err) {
    console.error('Error cargando presets de horarios:', err);
  }
};

window.removeSlot = function(dayIdx, timeSlot) {
  const pillsContainer = document.getElementById(`slot-pills-${dayIdx}`);
  if (!pillsContainer) return;
  const tag = Array.from(pillsContainer.querySelectorAll('.slot-pill-tag')).find(el => el.dataset.time === timeSlot);
  if (tag) tag.remove();
};

window.promptAddSlot = function(dayIdx) {
  const time = prompt(`Ingresa la hora en formato 24h (HH:MM) para el ${dayNames[dayIdx]}:`, '14:00');
  if (!time || !time.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
    if (time) showToast('Formato de hora inválido. Usa formato 24 horas ej: 09:30 o 18:00', 'error');
    return;
  }

  const pillsContainer = document.getElementById(`slot-pills-${dayIdx}`);
  const addBtn = pillsContainer.querySelector('.btn-add-slot');

  const tag = document.createElement('div');
  tag.className = 'slot-pill-tag';
  tag.dataset.time = time;
  tag.innerHTML = `
    <span>${time}</span>
    <span class="slot-remove" onclick="removeSlot(${dayIdx}, '${time}')">&times;</span>
  `;

  pillsContainer.insertBefore(tag, addBtn);
};

window.publishPostNow = async function(id) {
  if (!confirm(`¿Deseas enviar la publicación #${id} inmediatamente a Meta?`)) return;
  showToast(`Publicando post #${id}...`, 'info');
  try {
    const res = await fetch(`/api/posts/${id}/publish-now`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(`¡Post #${id} publicado con éxito!`, 'success');
      await window.loadPlannerData();
      if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
    } else {
      showToast(`Error al publicar: ${json.error || 'Error'}`, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.retryPost = async function(id) {
  try {
    const res = await fetch(`/api/posts/${id}/retry`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(`Reintento programado para el post #${id}`, 'success');
      await window.loadPlannerData();
      if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.deletePost = async function(id) {
  if (!confirm(`¿Seguro que deseas eliminar la publicación #${id}?`)) return;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Publicación eliminada', 'info');
      await window.loadPlannerData();
      if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.repostAsStory = async function(id) {
  showToast(`Adaptando post #${id} a formato Historia 9:16 con fondo difuminado...`, 'info');
  try {
    const res = await fetch(`/api/posts/${id}/repost-story`, { method: 'POST' });
    const json = await res.json();
    if (!json.success || !json.data) {
      showToast('Error adaptando a historia: ' + (json.error || 'Desconocido'), 'error');
      return;
    }

    const data = json.data;
    if (typeof window.switchTab === 'function') {
      window.switchTab('composer');
    } else if (typeof navigateToTab === 'function') {
      navigateToTab('composer');
    }

    // 1. Asignar contenido con teaser de historia
    const postContent = document.getElementById('post-content');
    const postTitle = document.getElementById('post-title');
    if (postContent) postContent.value = data.content || '';
    if (postTitle) postTitle.value = data.title || '';

    // 2. Seleccionar tipo de formato 'story'
    const storyRadio = document.querySelector('input[name="post_type"][value="story"]');
    if (storyRadio) {
      storyRadio.checked = true;
      document.querySelectorAll('.radio-pill').forEach(pill => {
        const inp = pill.querySelector('input');
        pill.classList.toggle('active', inp && inp.value === 'story');
      });
      storyRadio.dispatchEvent(new Event('change'));
    }

    // 3. Cargar imagen de historia vertical 9:16 generada
    if (data.mediaUrls && data.mediaUrls.length > 0 && typeof window.setComposerMedia === 'function') {
      window.setComposerMedia(data.mediaUrls);
    }

    // 4. Cambiar vista previa a pestaña 'story'
    const storyTabBtn = document.querySelector('.preview-tab[data-preview="story"]');
    if (storyTabBtn) storyTabBtn.click();

    if (typeof window.updateLivePreviews === 'function') {
      window.updateLivePreviews();
    }

    showToast('Post adaptado a Historia 9:16 y cargado en el Composer', 'success');
  } catch (err) {
    showToast('Error adaptando post: ' + err.message, 'error');
  }
};

window.reusePost = function(id) {
  const post = PlannerState.posts.find(p => p.id === id);
  if (!post) return;
  if (typeof window.switchTab === 'function') {
    window.switchTab('composer');
  }

  const postContent = document.getElementById('post-content');
  const postTitle = document.getElementById('post-title');
  if (postContent) postContent.value = post.content || '';
  if (postTitle && post.title) postTitle.value = post.title;

  try {
    const media = JSON.parse(post.media_urls || '[]');
    if (typeof window.setComposerMedia === 'function') {
      window.setComposerMedia(media);
    }
  } catch (_) {}

  if (typeof window.updateLivePreviews === 'function') {
    window.updateLivePreviews();
  }

  showToast('Contenido copiado al Composer', 'info');
};

// ==========================================
// 6. GESTIÓN Y REASIGNACIÓN DE CUENTAS EN POSTS
// ==========================================
let currentReassignTarget = { mode: 'single', postId: null, currentAccountId: null };

window.openReassignModal = function(postId, currentAccountName, currentAccountId) {
  const modal = document.getElementById('modal-reassign-post');
  if (!modal) return;

  currentReassignTarget = { mode: 'single', postId, currentAccountId };

  const titleEl = document.getElementById('modal-reassign-title');
  const singleInfo = document.getElementById('reassign-single-info');
  const bulkBox = document.getElementById('reassign-bulk-options');
  const postLabel = document.getElementById('reassign-post-label');
  const currentAcc = document.getElementById('reassign-current-account');
  const btnConfirm = document.getElementById('btn-confirm-reassign');
  const targetSelect = document.getElementById('reassign-target-select');

  if (titleEl) titleEl.textContent = `Reasignar Publicación #${postId}`;
  if (singleInfo) singleInfo.style.display = 'block';
  if (bulkBox) bulkBox.style.display = 'none';
  if (postLabel) postLabel.textContent = `#${postId}`;
  if (currentAcc) currentAcc.textContent = currentAccountName || 'Cuenta General';
  if (btnConfirm) btnConfirm.textContent = '✅ Transferir Publicación';

  // Si hay páginas cacheadas, asegurar que targetSelect esté poblado
  if (targetSelect && window._cachedMetaPages && targetSelect.options.length === 0) {
    targetSelect.innerHTML = window._cachedMetaPages.map(p => `<option value="${p.pageId}" data-name="${p.pageName}">${p.pageName}${p.instagram ? ` (@${p.instagram.username || p.instagram.name})` : ''}</option>`).join('');
  }

  setupReassignConfirmBtn();
  modal.style.display = 'flex';
};

window.openBulkReassignModal = function(sourceAccountId, sourceAccountName) {
  const modal = document.getElementById('modal-reassign-post');
  if (!modal) return;

  currentReassignTarget = { mode: 'bulk' };

  const titleEl = document.getElementById('modal-reassign-title');
  const singleInfo = document.getElementById('reassign-single-info');
  const bulkBox = document.getElementById('reassign-bulk-options');
  const btnConfirm = document.getElementById('btn-confirm-reassign');
  const targetSelect = document.getElementById('reassign-target-select');
  const sourceSelect = document.getElementById('reassign-source-select');

  if (titleEl) titleEl.textContent = 'Mover Publicaciones en Lote a otra Cuenta';
  if (singleInfo) singleInfo.style.display = 'none';
  if (bulkBox) bulkBox.style.display = 'block';
  if (btnConfirm) btnConfirm.textContent = '🚀 Transferir Todos los Posts';

  // Asegurar que selects estén poblados
  if (window._cachedMetaPages) {
    const opts = window._cachedMetaPages.map(p => `<option value="${p.pageId}" data-name="${p.pageName}">${p.pageName}${p.instagram ? ` (@${p.instagram.username || p.instagram.name})` : ''}</option>`).join('');
    if (targetSelect && targetSelect.options.length === 0) targetSelect.innerHTML = opts;
    if (sourceSelect && sourceSelect.options.length === 0) sourceSelect.innerHTML = opts;
  }

  if (sourceSelect && sourceAccountId) {
    sourceSelect.value = sourceAccountId;
  }

  setupReassignConfirmBtn();
  modal.style.display = 'flex';
};

window.closeReassignModal = function() {
  const modal = document.getElementById('modal-reassign-post');
  if (modal) modal.style.display = 'none';
};

function setupReassignConfirmBtn() {
  const btnConfirm = document.getElementById('btn-confirm-reassign');
  if (btnConfirm && !btnConfirm._hasListener) {
    btnConfirm._hasListener = true;
    btnConfirm.addEventListener('click', async () => {
      const targetSelect = document.getElementById('reassign-target-select');
      const targetOpt = targetSelect?.options[targetSelect.selectedIndex];
      const targetAccountId = targetSelect?.value;
      const targetAccountName = targetOpt?.getAttribute('data-name') || targetOpt?.textContent?.trim() || '';

      if (!targetAccountId) {
        showToast('Selecciona una cuenta de destino válida.', 'warning');
        return;
      }

      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Procesando transferencia...';

      try {
        if (currentReassignTarget.mode === 'single') {
          const res = await fetch(`/api/posts/${currentReassignTarget.postId}/reassign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: targetAccountId, accountName: targetAccountName })
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message || 'Publicación reasignada con éxito.', 'success');
            window.closeReassignModal();
            window.loadPlannerData();
            if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
          } else {
            throw new Error(json.error || 'Error al reasignar');
          }
        } else {
          // Transferencia en Lote (Bulk)
          const sourceSelect = document.getElementById('reassign-source-select');
          const sourceAccountId = sourceSelect?.value;

          const res = await fetch('/api/posts/bulk-reassign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceAccountId,
              targetAccountId,
              targetAccountName
            })
          });
          const json = await res.json();
          if (json.success) {
            showToast(json.message || 'Transferencia masiva completada.', 'success');
            window.closeReassignModal();
            window.loadPlannerData();
            if (typeof loadDashboardStatus === 'function') loadDashboardStatus();
          } else {
            throw new Error(json.error || 'Error en transferencia masiva');
          }
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = currentReassignTarget.mode === 'single' ? '✅ Transferir Publicación' : '🚀 Transferir Todos los Posts';
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupReassignConfirmBtn();
});
