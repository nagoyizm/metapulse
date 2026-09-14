// =============================================================================
// MetaPulse App Core Orquestador
// =============================================================================

const AppState = {
  activeTab: 'dashboard',
  config: {},
  counts: { scheduled: 0, published: 0, failed: 0, total: 0 },
  nextSlot: null,
  watermarks: []
};

function getToastIcon(type) {
  if (type === 'success') return '✅';
  if (type === 'error') return '❌';
  return 'ℹ️';
}

// Toast Notifications Helper
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${getToastIcon(type)}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Tab Navigation
function navigateToTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  AppState.activeTab = tabId;

  // Actualizar título de cabecera
  const titles = {
    dashboard: 'Panel Principal',
    composer: 'Crear Publicación',
    queue: 'Planner',
    analytics: 'Analítica',
    media: 'Multimedia',
    inbox: 'Bandeja de Entrada',
    settings: 'Conexión Meta & Ajustes'
  };

  const titleEl = document.getElementById('page-title');
  if (titleEl && titles[tabId]) {
    titleEl.textContent = titles[tabId];
  }

  // Cargas específicas por pestaña
  const tabLoaders = {
    dashboard: () => loadDashboardStatus(),
    queue: () => {
      window.loadPlannerData?.();
      window.loadQueuePosts?.();
      window.loadScheduleSlots?.();
    },
    inbox: () => window.loadInboxData?.(),
    analytics: () => window.loadAnalyticsData?.(),
    media: () => {
      window.loadMediaGallery?.();
      window.loadWatermarksList?.();
    },
    settings: () => window.loadSettingsData?.()
  };

  tabLoaders[tabId]?.();
}

// Live Clock
function initClock() {
  const clockEl = document.getElementById('live-clock-text');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  update();
  setInterval(update, 1000);
}

function updateDashboardMetrics(counts, nextSlot, config) {
  document.getElementById('dash-stat-scheduled').textContent = counts.scheduled;
  document.getElementById('dash-stat-published').textContent = counts.published;
  document.getElementById('dash-stat-failed').textContent = counts.failed;
  document.getElementById('sidebar-queue-badge').textContent = counts.scheduled;

  if (nextSlot) {
    const d = new Date(nextSlot);
    const formatted = d.toLocaleDateString('es-CL', {
      timeZone: 'America/Santiago',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    document.getElementById('dash-next-slot-time').textContent = formatted;
    const compSlot = document.getElementById('composer-next-slot-label');
    if (compSlot) compSlot.textContent = `Próximo: ${formatted}`;
  }

  const sbName = document.getElementById('sidebar-page-name');
  if (config.hasPage) {
    sbName.textContent = config.pageName;
  } else if (config.simulationMode) {
    sbName.textContent = 'Modo Simulación 🧪';
  } else {
    sbName.textContent = 'Sin conectar';
  }

  const bannerTitle = document.getElementById('dash-banner-title');
  const bannerDesc = document.getElementById('dash-banner-desc');
  if (config.hasPage && config.hasInstagram) {
    bannerTitle.textContent = `Conectado: ${config.pageName} (@${config.instagramUsername || 'IG'})`;
    bannerDesc.textContent = 'Meta Graph API v21.0 enlazada con permisos de publicación.';
  } else if (config.simulationMode) {
    bannerTitle.textContent = 'Modo Simulación / Sandbox Activo';
    bannerDesc.textContent = 'Las publicaciones y métricas funcionan en entorno de pruebas local.';
  } else {
    bannerTitle.textContent = 'Cuentas Meta no configuradas';
    bannerDesc.textContent = 'Configura tu Token de Facebook e Instagram en Ajustes para publicar en vivo.';
  }
}

function renderUpcomingPosts(upcomingPosts) {
  const upcomingList = document.getElementById('dash-upcoming-list');
  if (!upcomingList || !upcomingPosts || upcomingPosts.length === 0) return;

  upcomingList.innerHTML = upcomingPosts.map(p => {
    let media = [];
    try {
      media = JSON.parse(p.media_urls || '[]');
    } catch (_err) {
      // Ignored: non-JSON media_urls string
    }
    const firstMedia = media.length > 0 ? media[0] : null;
    const isVid = firstMedia ? firstMedia.match(/\.(mp4|mov)$/i) : false;

    let mediaThumb = '';
    if (firstMedia) {
      mediaThumb = isVid
        ? `<div style="width:38px; height:38px; border-radius:6px; background:#1e293b; display:flex; align-items:center; justify-content:center; flex-shrink:0;">🎬</div>`
        : `<img src="${firstMedia}" onerror="window.handleThumbError(this, ${p.id})" style="width:38px; height:38px; object-fit:cover; border-radius:6px; flex-shrink:0; border:1px solid var(--border-color);" alt="thumb">`;
    }

    return `
      <div class="page-select-card" style="justify-content: space-between; align-items: center; gap:8px;">
        <div class="page-info-block" style="gap:10px; align-items:center;">
          ${mediaThumb}
          <div>
            <span class="badge badge-accent" style="font-size:0.65rem; padding:2px 6px;">${p.post_type.toUpperCase()}</span>
            <strong style="display:block; font-size:0.85rem; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title || (p.content.slice(0, 40) + '...')}</strong>
            <p class="text-muted" style="font-size:0.75rem; margin:0;">📅 ${new Date(p.scheduled_at).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); window.openEditPostModal(${p.id})" title="Editar hora, texto o imagen">✏️ Editar</button>
          ${firstMedia ? `<button class="btn btn-ghost btn-xs" onclick="window.downloadMediaFile('${firstMedia}', 'scheduled-${p.id}')" title="Descargar imagen">📥 Bajar</button>` : ''}
          <span class="status-pill scheduled">Programado</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentPublishedPosts(recentPublished) {
  const recentList = document.getElementById('dash-recent-list');
  if (!recentList || !recentPublished || recentPublished.length === 0) return;

  recentList.innerHTML = recentPublished.map(p => {
    let media = [];
    try {
      media = JSON.parse(p.media_urls || '[]');
    } catch (_err) {
      // Ignored: non-JSON media_urls string
    }
    let mediaThumb = '';
    if (media.length > 0) {
      const isVid = media[0].match(/\.(mp4|mov)$/i);
      mediaThumb = isVid
        ? `<div style="width:40px; height:40px; border-radius:6px; background:#1e293b; display:flex; align-items:center; justify-content:center; flex-shrink:0;">🎬</div>`
        : `<img src="${media[0]}" onerror="window.handleThumbError(this, ${p.id})" style="width:40px; height:40px; object-fit:cover; border-radius:6px; flex-shrink:0; border:1px solid var(--border-color);" alt="thumb">`;
    }

    return `
      <div class="page-select-card" style="justify-content: space-between; align-items: center; gap:10px;">
        <div class="page-info-block" style="gap:10px; align-items:center;">
          ${mediaThumb}
          <div>
            <span class="badge badge-accent" style="font-size:0.65rem; padding:2px 6px;">${p.post_type.toUpperCase()}</span>
            <strong style="display:block; font-size:0.85rem; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${p.title || (p.content.slice(0, 35) + '...')}
            </strong>
            <p class="text-muted" style="font-size:0.72rem; margin:0;">✅ ${new Date(p.published_at || p.updated_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })} · Meta</p>
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-shrink:0;">
          ${media.length > 0 ? `
            <button class="btn btn-ghost btn-xs" onclick="window.downloadMediaFile('${media[0]}', 'published-${p.id}')" title="Descargar imagen">📥 Bajar</button>
          ` : ''}
          <button class="btn btn-secondary btn-xs" onclick="window.repostAsStory(${p.id})" title="Repostear este post como Historia 9:16">
            📲 Historia
          </button>
          <button class="btn btn-ghost btn-xs" onclick="window.reusePost(${p.id})" title="Reutilizar copy en Composer">
            🔄 Reusar
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Cargar estado inicial del Dashboard
async function loadDashboardStatus() {
  try {
    const res = await fetch('/api/status');
    const json = await res.json();
    if (!json.success) return;

    const { config, counts, nextSlot, upcomingPosts, recentPublished } = json.data;
    AppState.config = config;
    AppState.counts = counts;
    AppState.nextSlot = nextSlot;

    updateDashboardMetrics(counts, nextSlot, config);
    renderUpcomingPosts(upcomingPosts);
    renderRecentPublishedPosts(recentPublished);

    // Botón de sincronizar en Dashboard
    const btnSyncLiveDash = document.getElementById('btn-sync-live-dash');
    if (btnSyncLiveDash) {
      btnSyncLiveDash.onclick = async () => {
        btnSyncLiveDash.disabled = true;
        btnSyncLiveDash.textContent = '🔄 Sincronizando...';
        try {
          const res = await fetch('/api/meta/sync-live-posts', { method: 'POST' });
          const json = await res.json();
          if (json.success) {
            showToast(json.data.message || 'Posts sincronizados con éxito', 'success');
            loadDashboardStatus();
            if (window.loadQueuePosts) window.loadQueuePosts();
          } else {
            showToast('Error sincronizando: ' + (json.error || 'Desconocido'), 'error');
          }
        } catch (e) {
          showToast('Error: ' + e.message, 'error');
        } finally {
          btnSyncLiveDash.disabled = false;
          btnSyncLiveDash.textContent = '🔄 Sincronizar Feed';
        }
      };
    }

    // Cargar selector de cuentas globales
    loadAccountSwitcher();
    // Cargar Radar Proactivo
    loadProactiveRadar();
    if (window.updateComposerPreviews) window.updateComposerPreviews();
  } catch (err) {
    console.error('Error cargando estado:', err);
  }
}

// Cargar sugerencias proactivas para el Dashboard
async function loadProactiveRadar() {
  const container = document.getElementById('dash-radar-ideas-container');
  const tag = document.getElementById('dash-radar-account-tag');
  const subtitle = document.getElementById('dash-radar-subtitle');
  if (!container) return;

  const brand = AppState.config ? (AppState.config.pageName || '') : '';
  if (tag) tag.textContent = brand || 'Cuenta Activa';

  try {
    const res = await fetch(`/api/ai/proactive-suggestions?brandName=${encodeURIComponent(brand)}`);
    const json = await res.json();
    if (!json.success || !json.data) return;

    const data = json.data;
    if (subtitle) {
      subtitle.textContent = `2 publicaciones sugeridas para ${data.brand} (Miércoles y Sábados)`;
    }

    container.innerHTML = data.days.map((d, idx) => `
      <div class="card" style="margin:0; padding:14px; background:var(--bg-primary); border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="badge ${idx === 0 ? 'badge-accent' : 'badge'}" style="font-size:0.75rem;">📅 ${d.dayName}</span>
            <span class="text-muted" style="font-size:0.72rem; font-weight:600;">🕒 ${d.slot}</span>
          </div>
          <h4 style="margin:0 0 6px 0; font-size:0.95rem; color:var(--text-primary);">${d.title}</h4>
          <p style="margin:0; font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">${d.suggestion}</p>
        </div>
        <button class="btn btn-secondary btn-sm btn-full" onclick="useProactiveIdea('${data.accountType}', '${encodeURIComponent(d.presetTopic)}', '${d.type}')">
          ⚡ Preparar este Post en Composer →
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error cargando sugerencias proactivas:', err);
  }
}

window.useProactiveIdea = function(accountType, encodedTopic, format) {
  const topic = decodeURIComponent(encodedTopic);
  navigateToTab('composer');

  if (window.openAiModalWithPreset) {
    window.openAiModalWithPreset(accountType, topic, format);
  } else {
    const txt = document.getElementById('post-content');
    if (txt) {
      txt.value = `Ideando: ${topic}...`;
      if (window.updateComposerPreviews) window.updateComposerPreviews();
    }
  }
};

// Repostear cualquier post existente como Historia (Story 9:16)
window.repostAsStory = async function(id) {
  showToast(`Adaptando post #${id} a formato Historia 9:16...`, 'info');
  try {
    const res = await fetch(`/api/posts/${id}/repost-story`, { method: 'POST' });
    const json = await res.json();
    if (!json.success || !json.data) {
      showToast('Error adaptando a historia: ' + (json.error || 'Desconocido'), 'error');
      return;
    }

    const data = json.data;
    navigateToTab('composer');

    // 1. Asignar contenido
    const postContent = document.getElementById('post-content');
    const postTitle = document.getElementById('post-title');
    if (postContent) postContent.value = data.content;
    if (postTitle) postTitle.value = data.title;

    // 2. Seleccionar tipo de formato 'story'
    const storyRadio = document.querySelector('input[name="post_type"][value="story"]');
    if (storyRadio) {
      storyRadio.checked = true;
      document.querySelectorAll('.radio-pill').forEach(pill => {
        const inp = pill.querySelector('input');
        pill.classList.toggle('active', inp?.value === 'story');
      });
    }

    // 3. Cargar imagen de historia generada
    if (data.mediaUrls && data.mediaUrls.length > 0 && typeof window.setComposerMedia === 'function') {
      window.setComposerMedia(data.mediaUrls);
    }

    // 4. Cambiar vista previa a pestaña 'story'
    const storyTabBtn = document.querySelector('.preview-tab[data-preview="story"]');
    if (storyTabBtn) storyTabBtn.click();

    if (window.updateComposerPreviews) window.updateComposerPreviews();
    showToast('✨ ¡Post adaptado como Historia en formato 9:16! Listo para publicar o programar.', 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

// Reutilizar copy y contenido de un post en Composer
window.reusePost = async function(id) {
  try {
    const res = await fetch(`/api/posts/${id}`);
    const json = await res.json();
    if (!json.success || !json.data) return;

    const p = json.data;
    navigateToTab('composer');
    const postContent = document.getElementById('post-content');
    const postTitle = document.getElementById('post-title');
    if (postContent) postContent.value = p.content || '';
    if (postTitle) postTitle.value = p.title ? `Copia: ${p.title}` : '';

    let media = [];
    try {
      media = JSON.parse(p.media_urls || '[]');
    } catch (_err) {
      // Ignored: non-JSON media_urls string
    }

    if (media.length > 0 && typeof window.setComposerMedia === 'function') {
      window.setComposerMedia(media);
    }
    if (window.updateComposerPreviews) window.updateComposerPreviews();
    showToast('📝 Contenido cargado en el editor para reutilizar o adaptar', 'info');
  } catch (e) {
    showToast('Error cargando post: ' + e.message, 'error');
  }
};

// Helper global para obtener la cuenta actualmente seleccionada en el header
window.getActiveAccount = function() {
  const select = document.getElementById('global-account-select');
  if (!select?.value) return null;
  const opt = select.options[select.selectedIndex];
  const ds = opt?.dataset;
  return {
    pageId: select.value,
    pageName: ds?.name || '',
    pageToken: ds?.token || '',
    instagramId: ds?.igid || '',
    instagramUsername: ds?.iguser || ''
  };
};

function getAccountInstagramLabel(active) {
  if (active.instagramUsername) return `@${active.instagramUsername}`;
  if (active.instagramId) return 'Conectado';
  return 'Sin IG';
}

// Actualiza los badges informativos en el Composer, Batch Autopilot e Inbox
window.updateActiveAccountBadges = function() {
  const active = window.getActiveAccount();
  const compName = document.getElementById('composer-active-account-name');
  const compIg = document.getElementById('composer-active-account-ig');
  const batchName = document.getElementById('batch-target-account-name');
  const batchIg = document.getElementById('batch-target-account-ig');
  const inboxName = document.getElementById('inbox-active-account-name');
  const inboxBadge = document.getElementById('inbox-active-account-badge');

  if (active) {
    const igLabel = getAccountInstagramLabel(active);
    if (compName) compName.textContent = active.pageName;
    if (compIg) compIg.textContent = igLabel;
    if (batchName) batchName.textContent = active.pageName;
    if (batchIg) batchIg.textContent = igLabel;
    if (inboxName) inboxName.textContent = active.pageName;
    if (inboxBadge) inboxBadge.style.display = 'inline-flex';
  } else {
    if (compName) compName.textContent = 'Sin cuenta seleccionada';
    if (batchName) batchName.textContent = 'Sin cuenta seleccionada';
    if (inboxName) inboxName.textContent = 'Sin cuenta';
    if (inboxBadge) inboxBadge.style.display = 'none';
  }
};

function formatReassignPageOption(p) {
  const igPart = p.instagram ? ` (@${p.instagram.username || p.instagram.name})` : '';
  return `<option value="${p.pageId}" data-name="${p.pageName}">${p.pageName}${igPart}</option>`;
}

async function handleAccountSwitch(opt) {
  if (!opt?.value) return;

  const ds = opt.dataset;
  const pageId = opt.value;
  const pageName = ds.name || '';
  const pageToken = ds.token || '';
  const instagramId = ds.igid || '';
  const instagramUsername = ds.iguser || '';

  showToast(`Cambiando a: ${pageName}...`, 'info');
  try {
    const switchRes = await fetch('/api/meta/select-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, pageName, pageToken, instagramId, instagramUsername })
    });
    const switchJson = await switchRes.json();
    if (switchJson.success) {
      showToast(`¡Cuenta activa cambiada a: ${pageName}!`, 'success');
      window.updateActiveAccountBadges();
      loadDashboardStatus();
      loadProactiveRadar();

      if (window.loadPlannerData) window.loadPlannerData(pageId);
      if (window.loadQueuePosts) window.loadQueuePosts(pageId);
      if (window.loadAnalyticsData) window.loadAnalyticsData();
      if (window.loadMediaGallery) window.loadMediaGallery();
      if (window.loadWatermarksList) window.loadWatermarksList();
      if (window.loadActiveSealPreview) window.loadActiveSealPreview();
      if (window.loadInboxData) window.loadInboxData();
    }
  } catch (e) {
    showToast('Error cambiando de cuenta: ' + e.message, 'error');
  }
}

// Cargar opciones en el Selector de Negocio Global
async function loadAccountSwitcher() {
  const select = document.getElementById('global-account-select');
  if (!select) return;

  try {
    const res = await fetch('/api/meta/accounts');
    const json = await res.json();
    if (!json.success || !json.data || json.data.length === 0) {
      select.innerHTML = '<option value="">Sin cuentas conectadas</option>';
      window.updateActiveAccountBadges();
      return;
    }

    const pages = json.data;
    window._cachedMetaPages = pages;
    const currentSelectedPageId = AppState.config ? AppState.config.pageId : '';

    select.innerHTML = pages.map(p => {
      const isSelected = String(p.pageId) === String(currentSelectedPageId) ? 'selected' : '';
      const igLabel = p.instagram ? ` (IG: @${p.instagram.username || p.instagram.name})` : '';
      return `<option value="${p.pageId}" ${isSelected} data-name="${p.pageName}" data-token="${p.pageToken}" data-igid="${p.instagram ? p.instagram.id : ''}" data-iguser="${p.instagram ? (p.instagram.username || p.instagram.name) : ''}">
        ${p.pageName}${igLabel}
      </option>`;
    }).join('');

    if (currentSelectedPageId) {
      select.value = currentSelectedPageId;
    }

    // Poblar los selects del Modal de Reasignación
    const targetSelect = document.getElementById('reassign-target-select');
    const sourceSelect = document.getElementById('reassign-source-select');
    const pagesOptions = pages.map(formatReassignPageOption).join('');
    if (targetSelect) targetSelect.innerHTML = pagesOptions;
    if (sourceSelect) sourceSelect.innerHTML = pagesOptions;

    // Actualizar badges visuales
    window.updateActiveAccountBadges();

    select.onchange = () => {
      const opt = select.options[select.selectedIndex];
      handleAccountSwitch(opt);
    };
  } catch (err) {
    console.error('Error cargando selector de cuentas:', err);
  }
}

// Inicialización del Tema Claro / Oscuro
function initTheme() {
  const saved = localStorage.getItem('metapulse_theme') || 'light';
  setTheme(saved);

  const btn = document.getElementById('btn-theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-theme');
      const nextTheme = isDark ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }
}

function setTheme(theme) {
  const icon = document.getElementById('theme-toggle-icon');
  if (theme === 'dark') {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    if (icon) icon.textContent = '🌙';
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    if (icon) icon.textContent = '☀️';
  }
  localStorage.setItem('metapulse_theme', theme);
}

// Inicialización de Eventos DOM
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  loadDashboardStatus();

  // Navigation clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateToTab(item.dataset.tab);
    });
  });

  document.getElementById('btn-quick-create').addEventListener('click', () => {
    navigateToTab('composer');
  });

  document.getElementById('btn-goto-wizard').addEventListener('click', () => {
    navigateToTab('settings');
  });

  document.getElementById('btn-view-all-queue').addEventListener('click', () => {
    navigateToTab('queue');
  });

  document.getElementById('btn-test-connection').addEventListener('click', async () => {
    showToast('Probando conexión con Meta Graph API...', 'info');
    try {
      const res = await fetch('/api/meta/insights');
      const json = await res.json();
      if (json.success) {
        showToast('¡Conexión con Meta validada exitosamente!', 'success');
      } else {
        showToast('Error en la conexión con Meta: ' + (json.error || 'Token inválido'), 'error');
      }
    } catch (e) {
      showToast('No se pudo contactar a Meta: ' + e.message, 'error');
    }
  });

  // Polling periódico para actualizar contadores (cada 30s)
  setInterval(() => {
    if (AppState.activeTab === 'dashboard') {
      loadDashboardStatus();
    }
  }, 30000);
});
