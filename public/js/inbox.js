// =============================================================================
// MetaPulse Inbox & WhatsApp Controller
// =============================================================================

const InboxState = {
  currentView: 'dms', // 'dms' | 'comments' | 'whatsapp'
  conversations: [],
  activeConversationId: null,
  activePlatform: 'instagram',
  messages: [],
  comments: [],
  commentFilter: 'all',
  whatsappConfig: {},
  pollingTimer: null,
  searchQuery: ''
};

// Actualizar badge de cuenta activa en Inbox
function updateInboxAccountBadge() {
  const badge = document.getElementById('inbox-active-account-badge');
  const nameEl = document.getElementById('inbox-active-account-name');
  const active = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
  if (nameEl) {
    nameEl.textContent = active ? (active.pageName || 'Cuenta') : 'Sin cuenta';
  }
  if (badge) {
    badge.style.display = active ? 'inline-flex' : 'none';
  }
}
window.updateInboxAccountBadge = updateInboxAccountBadge;

// Carga principal invocada al entrar a la pestaña 'inbox'
window.loadInboxData = async function() {
  updateInboxAccountBadge();
  await Promise.all([
    loadConversations(),
    loadComments(),
    loadWhatsAppSettings()
  ]);
  startInboxPolling();
};

// ==========================================
// 1. SUBTABS (DMs, Comentarios, WhatsApp)
// ==========================================
function setupInboxSubtabs() {
  const subtabs = document.querySelectorAll('.inbox-subtab');
  subtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.inboxView;
      switchInboxView(view);
    });
  });

  // Botón Sincronizar Ahora
  const btnRefresh = document.getElementById('btn-inbox-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      const icon = document.getElementById('btn-inbox-refresh-icon');
      if (icon) icon.classList.add('spin-animation');
      try {
        const active = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
        const res = await fetch('/api/inbox/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId: active?.pageId || null })
        });
        const json = await res.json();
        if (json.success) {
          showToast('Sincronización completada exitosamente', 'success');
          await Promise.all([loadConversations(), loadComments(), loadWhatsAppSettings()]);
        } else {
          showToast(json.error || 'Error al sincronizar', 'error');
        }
      } catch (e) {
        showToast('Error de conexión al sincronizar', 'error');
      } finally {
        if (icon) icon.classList.remove('spin-animation');
      }
    });
  }

  // Buscador de chats
  const searchInput = document.getElementById('inbox-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      InboxState.searchQuery = (e.target.value || '').toLowerCase().trim();
      renderConversationsList();
    });
  }

  // Filtros de comentarios
  const filterBtns = document.querySelectorAll('[data-comment-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      InboxState.commentFilter = btn.dataset.commentFilter;
      renderCommentsList();
    });
  });

  // Envío de chat
  const btnSend = document.getElementById('btn-chat-send');
  const chatInput = document.getElementById('chat-reply-input');
  if (btnSend && chatInput) {
    btnSend.addEventListener('click', sendActiveChatMessage);
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendActiveChatMessage();
      }
    });
  }

  // Sugerencia IA en chat
  const btnAiSuggest = document.getElementById('btn-chat-ai-suggest');
  if (btnAiSuggest) {
    btnAiSuggest.addEventListener('click', generateAiReplySuggestion);
  }

  // Ajustes de WhatsApp
  const btnSaveWpp = document.getElementById('btn-whatsapp-save');
  if (btnSaveWpp) {
    btnSaveWpp.addEventListener('click', saveWhatsAppSettings);
  }

  const btnTestWpp = document.getElementById('btn-whatsapp-test');
  if (btnTestWpp) {
    btnTestWpp.addEventListener('click', testWhatsAppAlert);
  }

  const serviceTypeSelect = document.getElementById('whatsapp-service-type');
  if (serviceTypeSelect) {
    serviceTypeSelect.addEventListener('change', (e) => {
      toggleWhatsAppProviderFields(e.target.value);
    });
  }

  const btnToggleToken = document.getElementById('btn-toggle-green-token');
  const inputGreenToken = document.getElementById('whatsapp-green-token');
  if (btnToggleToken && inputGreenToken) {
    btnToggleToken.addEventListener('click', () => {
      const isPass = inputGreenToken.type === 'password';
      inputGreenToken.type = isPass ? 'text' : 'password';
      btnToggleToken.textContent = isPass ? '🙈' : '👁️';
    });
  }
}

function toggleWhatsAppProviderFields(serviceType) {
  const isGreen = serviceType === 'green-api';
  const guideGreen = document.getElementById('guide-green-api');
  const guideCallmebot = document.getElementById('guide-callmebot');
  const fieldsGreen = document.getElementById('fields-green-api');
  const fieldsCallmebot = document.getElementById('fields-callmebot');

  if (guideGreen) guideGreen.style.display = isGreen ? 'block' : 'none';
  if (guideCallmebot) guideCallmebot.style.display = isGreen ? 'none' : 'block';
  if (fieldsGreen) fieldsGreen.style.display = isGreen ? 'block' : 'none';
  if (fieldsCallmebot) fieldsCallmebot.style.display = isGreen ? 'none' : 'block';
}

function switchInboxView(view) {
  InboxState.currentView = view;
  const subtabs = document.querySelectorAll('.inbox-subtab');
  subtabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.inboxView === view);
  });

  const views = {
    dms: document.getElementById('inbox-view-dms'),
    comments: document.getElementById('inbox-view-comments'),
    whatsapp: document.getElementById('inbox-view-whatsapp')
  };

  Object.entries(views).forEach(([vKey, el]) => {
    if (el) el.style.display = (vKey === view) ? 'block' : 'none';
  });

  if (view === 'comments') loadComments();
  if (view === 'whatsapp') loadWhatsAppSettings();
}

// ==========================================
// 2. CONVERSACIONES Y DMs
// ==========================================
async function loadConversations() {
  try {
    const active = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const params = new URLSearchParams();
    if (active && active.pageId) {
      params.append('accountId', active.pageId);
      if (active.instagramId) params.append('instagramId', active.instagramId);
    }
    const url = `/api/inbox/conversations${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      InboxState.conversations = json.data || [];
      renderConversationsList();
      updateUnreadBadges();

      // Si la conversación activa ya no pertenece a esta cuenta, deseleccionar
      if (InboxState.activeConversationId && !InboxState.conversations.some(c => c.id === InboxState.activeConversationId)) {
        InboxState.activeConversationId = null;
        InboxState.messages = [];
        const headerBar = document.getElementById('chat-header-bar');
        const footerBar = document.getElementById('chat-footer-bar');
        const msgsContainer = document.getElementById('chat-messages-container');
        if (headerBar) headerBar.style.display = 'none';
        if (footerBar) footerBar.style.display = 'none';
        if (msgsContainer) {
          msgsContainer.innerHTML = `
            <div class="chat-empty-state">
              <div style="font-size: 2.8rem; margin-bottom: 8px;">✉️</div>
              <h3>Bandeja de Mensajes Directos</h3>
              <p>Selecciona un cliente de la lista izquierda para leer la conversación y responderle en vivo.</p>
            </div>
          `;
        }
      }

      // Si no hay chat seleccionado y hay chats, seleccionar el primero
      if (!InboxState.activeConversationId && InboxState.conversations.length > 0) {
        selectConversation(InboxState.conversations[0].id);
      } else if (InboxState.activeConversationId) {
        // Recargar mensajes del chat activo silenciosamente
        loadConversationMessages(InboxState.activeConversationId, true);
      }
    }
  } catch (err) {
    console.warn('[Inbox] Error cargando conversaciones:', err);
  }
}

function renderConversationsList() {
  const container = document.getElementById('inbox-conversations-list');
  if (!container) return;

  const filtered = InboxState.conversations.filter(c => {
    if (!InboxState.searchQuery) return true;
    const name = (c.participant_name || '').toLowerCase();
    const username = (c.participant_username || '').toLowerCase();
    const lastMsg = (c.last_message_text || '').toLowerCase();
    return name.includes(InboxState.searchQuery) || username.includes(InboxState.searchQuery) || lastMsg.includes(InboxState.searchQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">
        <span>📭</span>
        <p>No se encontraron conversaciones directas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isActive = c.id === InboxState.activeConversationId ? 'active' : '';
    const platformClass = c.platform === 'facebook' ? 'fb' : 'ig';
    const platformLabel = c.platform === 'facebook' ? 'FB' : 'IG';
    const timeFormatted = formatTimeSnippet(c.last_message_at);
    const unreadDot = (c.unread_count && c.unread_count > 0) 
      ? `<span class="unread-pill">${c.unread_count}</span>` 
      : '';
    const avatarContent = c.participant_pic
      ? `<img src="${c.participant_pic}" alt="${escapeHtml(c.participant_name)}" class="avatar-img">`
      : `<span class="avatar-initials">${escapeHtml((c.participant_name || 'U').charAt(0).toUpperCase())}</span>`;

    return `
      <div class="thread-item ${isActive}" onclick="selectConversation('${c.id}')">
        <div class="thread-avatar">
          ${avatarContent}
          <span class="platform-mini-badge ${platformClass}">${platformLabel}</span>
        </div>
        <div class="thread-meta">
          <div class="thread-header">
            <strong class="thread-name">${escapeHtml(c.participant_name || 'Usuario')}</strong>
            <span class="thread-time">${timeFormatted}</span>
          </div>
          <div class="thread-snippet-row">
            <span class="thread-snippet">${escapeHtml(c.last_message_text || 'Sin mensajes')}</span>
            ${unreadDot}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.selectConversation = async function(convId) {
  InboxState.activeConversationId = convId;
  const conv = InboxState.conversations.find(c => c.id === convId);
  if (!conv) return;

  InboxState.activePlatform = conv.platform || 'instagram';

  // Actualizar clase activa en la lista
  renderConversationsList();

  // Mostrar barras de cabecera y pie del chat
  document.getElementById('chat-header-bar').style.display = 'flex';
  document.getElementById('chat-footer-bar').style.display = 'block';

  // Configurar info en la cabecera
  document.getElementById('chat-header-name').textContent = conv.participant_name || 'Usuario';
  const tagEl = document.getElementById('chat-header-platform');
  tagEl.textContent = conv.platform === 'facebook' ? 'Facebook Messenger' : 'Instagram Direct';
  tagEl.className = `chat-platform-tag ${conv.platform === 'facebook' ? 'fb' : 'ig'}`;

  const avatarEl = document.getElementById('chat-header-avatar');
  if (conv.participant_pic) {
    avatarEl.innerHTML = `<img src="${conv.participant_pic}" alt="" class="avatar-img">`;
  } else {
    avatarEl.innerHTML = `<span>${(conv.participant_name || 'U').charAt(0).toUpperCase()}</span>`;
  }

  // Cargar mensajes
  await loadConversationMessages(convId);
};

async function loadConversationMessages(convId, silent = false) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  if (!silent) {
    container.innerHTML = `
      <div class="chat-loading">
        <div class="spinner-small"></div>
        <span>Cargando mensajes...</span>
      </div>
    `;
  }

  try {
    const res = await fetch(`/api/inbox/conversations/${convId}/messages`);
    const json = await res.json();
    if (json.success) {
      InboxState.messages = json.data || [];
      renderChatMessages();
    }
  } catch (err) {
    if (!silent) {
      container.innerHTML = `<div class="chat-empty-state"><p>Error cargando mensajes: ${err.message}</p></div>`;
    }
  }
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  if (InboxState.messages.length === 0) {
    container.innerHTML = `
      <div class="chat-empty-state">
        <div style="font-size: 2rem;">💬</div>
        <p>No hay mensajes previos registrados en este chat.</p>
        <small style="color: var(--text-secondary);">Escribe abajo para enviar el primer mensaje.</small>
      </div>
    `;
    return;
  }

  container.innerHTML = InboxState.messages.map(m => {
    const isOut = m.sender_type === 'page';
    const bubbleClass = isOut ? 'msg-outgoing' : 'msg-incoming';
    const timeFormatted = formatTimeSnippet(m.created_at);

    return `
      <div class="chat-msg-row ${bubbleClass}">
        <div class="msg-bubble">
          <div class="msg-text">${escapeHtml(m.message_text)}</div>
          <div class="msg-time">${timeFormatted} ${isOut ? '✓✓' : ''}</div>
        </div>
      </div>
    `;
  }).join('');

  // Scroll al final del chat
  container.scrollTop = container.scrollHeight;
}

async function sendActiveChatMessage() {
  const input = document.getElementById('chat-reply-input');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const convId = InboxState.activeConversationId;
  if (!convId) {
    showToast('Selecciona primero una conversación', 'error');
    return;
  }

  const btnSend = document.getElementById('btn-chat-send');
  if (btnSend) btnSend.disabled = true;

  try {
    const res = await fetch(`/api/inbox/conversations/${convId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        platform: InboxState.activePlatform
      })
    });

    const json = await res.json();
    if (json.success) {
      input.value = '';
      showToast('Mensaje enviado', 'success');

      // Agregar mensaje localmente
      if (json.data) {
        InboxState.messages.push(json.data);
        renderChatMessages();
      }

      // Actualizar vista de conversaciones
      loadConversations();
    } else {
      showToast(json.error || 'Error al enviar mensaje', 'error');
    }
  } catch (err) {
    showToast(`Error al enviar: ${err.message}`, 'error');
  } finally {
    if (btnSend) btnSend.disabled = false;
    input.focus();
  }
}

async function generateAiReplySuggestion() {
  const conv = InboxState.conversations.find(c => c.id === InboxState.activeConversationId);
  const lastCustomerMsg = [...InboxState.messages].reverse().find(m => m.sender_type === 'customer');
  const input = document.getElementById('chat-reply-input');
  if (!input) return;

  const customerText = lastCustomerMsg ? lastCustomerMsg.message_text : (conv ? conv.last_message_text : 'Hola');

  input.value = 'Generando respuesta con IA...';
  input.disabled = true;

  try {
    const res = await fetch('/api/ai/suggest-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerMessage: customerText,
        customerName: conv ? conv.participant_name : 'Cliente',
        platform: InboxState.activePlatform
      })
    });

    const json = await res.json();
    if (json.success && json.reply) {
      input.value = json.reply;
    } else {
      // Fallback local elegante
      input.value = `¡Hola ${conv?.participant_name ? conv.participant_name.split(' ')[0] : ''}! Muchas gracias por escribirnos. Con gusto te ayudamos con tu consulta, ¿nos puedes indicar un poco más de detalles? 😊`;
    }
  } catch (e) {
    input.value = `¡Hola! Gracias por comunicarte con nosotros. Estamos revisando tu consulta y te responderemos a la brevedad posible. 🌟`;
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ==========================================
// 3. COMENTARIOS EN PUBLICACIONES
// ==========================================
async function loadComments() {
  try {
    const active = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const params = new URLSearchParams();
    params.append('filter', InboxState.commentFilter);
    if (active && active.pageId) {
      params.append('accountId', active.pageId);
      if (active.instagramId) params.append('instagramId', active.instagramId);
    }
    const res = await fetch(`/api/inbox/comments?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      InboxState.comments = json.data || [];
      renderCommentsList();
      updateUnreadBadges();
    }
  } catch (err) {
    console.warn('[Inbox] Error cargando comentarios:', err);
  }
}

function renderCommentsList() {
  const container = document.getElementById('inbox-comments-list');
  if (!container) return;

  if (InboxState.comments.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card" style="text-align: center; padding: 40px; background: var(--bg-surface); border-radius: 12px; border: 1px solid var(--border-subtle);">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 12px;">💬</span>
        <h4 style="margin: 0 0 6px 0;">No hay comentarios en este filtro</h4>
        <p style="color: var(--text-secondary); margin: 0; font-size: 0.85rem;">Cuando tus seguidores comenten tus publicaciones de Instagram o Facebook, aparecerán aquí para responderles.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = InboxState.comments.map(c => {
    const isAnswered = c.is_answered === 1;
    const platformLabel = c.platform === 'facebook' ? 'Facebook' : 'Instagram';
    const platformClass = c.platform === 'facebook' ? 'fb' : 'ig';
    const timeFormatted = formatTimeSnippet(c.created_at);
    const postSnippet = c.post_caption ? `"${escapeHtml(c.post_caption.slice(0, 60))}..."` : 'Publicación de redes sociales';

    const statusBadge = isAnswered
      ? `<span class="badge badge-success" style="font-size: 0.75rem;">✅ Respondido</span>`
      : `<span class="badge badge-accent" style="font-size: 0.75rem;">⏳ Pendiente</span>`;

    const replyBox = isAnswered
      ? `
        <div class="comment-answered-box">
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">Tu respuesta:</div>
          <div style="font-size: 0.88rem; color: var(--text-primary);">💬 ${escapeHtml(c.reply_text || 'Respuesta enviada')}</div>
        </div>
      `
      : `
        <div class="comment-reply-form" id="comment-form-${c.id}">
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <input type="text" id="input-comment-reply-${c.id}" class="form-control" placeholder="Escribe una respuesta pública..." style="font-size: 0.85rem;">
            <button type="button" class="btn btn-primary btn-sm" onclick="sendCommentReply('${c.id}', '${c.platform}')">
              Responder
            </button>
          </div>
        </div>
      `;

    return `
      <div class="comment-card">
        <div class="comment-card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="comment-avatar">👤</div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <strong style="font-size: 0.92rem;">${escapeHtml(c.from_name || 'Usuario')}</strong>
                <span class="platform-mini-badge ${platformClass}">${platformLabel}</span>
              </div>
              <span style="font-size: 0.74rem; color: var(--text-secondary);">${timeFormatted}</span>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="comment-card-body">
          <div class="comment-post-ref">
            📌 <span>Post: ${postSnippet}</span>
            ${c.post_permalink ? `<a href="${c.post_permalink}" target="_blank" class="comment-post-link">Ver publicación ↗</a>` : ''}
          </div>
          <div class="comment-main-text">
            "${escapeHtml(c.comment_text)}"
          </div>
          ${replyBox}
        </div>
      </div>
    `;
  }).join('');
}

window.sendCommentReply = async function(commentId, platform) {
  const input = document.getElementById(`input-comment-reply-${commentId}`);
  if (!input) return;

  const text = input.value.trim();
  if (!text) {
    showToast('Escribe una respuesta antes de enviar', 'error');
    return;
  }

  input.disabled = true;
  try {
    const res = await fetch(`/api/inbox/comments/${commentId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, platform })
    });

    const json = await res.json();
    if (json.success) {
      showToast('Comentario respondido exitosamente', 'success');
      loadComments();
    } else {
      showToast(json.error || 'Error al responder comentario', 'error');
      input.disabled = false;
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
    input.disabled = false;
  }
};

// ==========================================
// 4. CONFIGURACIÓN DE ALERTAS WHATSAPP
// ==========================================
async function loadWhatsAppSettings() {
  try {
    const res = await fetch('/api/inbox/settings');
    const json = await res.json();
    if (json.success && json.data) {
      InboxState.whatsappConfig = json.data;
      const c = json.data;

      const chkEnabled = document.getElementById('chk-whatsapp-enabled');
      const selectService = document.getElementById('whatsapp-service-type');
      const inputGreenId = document.getElementById('whatsapp-green-id');
      const inputGreenToken = document.getElementById('whatsapp-green-token');
      const inputPhone = document.getElementById('whatsapp-input-phone');
      const inputKey = document.getElementById('whatsapp-input-key');
      const chkDms = document.getElementById('chk-notify-dms');
      const chkComments = document.getElementById('chk-notify-comments');
      const inputUrl = document.getElementById('whatsapp-public-url');
      const indicator = document.getElementById('whatsapp-active-indicator');
      const syncLabel = document.getElementById('inbox-last-synced-label');

      const service = c.serviceType || (c.greenIdInstance ? 'green-api' : 'callmebot');
      if (selectService) selectService.value = service;
      toggleWhatsAppProviderFields(service);

      if (chkEnabled) chkEnabled.checked = !!c.enabled;
      if (inputGreenId) inputGreenId.value = c.greenIdInstance || '';
      if (inputGreenToken) inputGreenToken.value = c.greenApiToken || '';
      if (inputPhone) inputPhone.value = c.phone || '';
      if (inputKey) inputKey.value = c.apiKey || '';
      if (chkDms) chkDms.checked = c.notifyDms !== false;
      if (chkComments) chkComments.checked = c.notifyComments !== false;
      if (inputUrl && c.publicUrl) inputUrl.value = c.publicUrl;

      const isConfigured = (service === 'green-api' && c.greenIdInstance && c.greenApiToken && c.phone) ||
                           (service === 'callmebot' && c.apiKey && c.phone);

      if (indicator) {
        indicator.style.display = (c.enabled && isConfigured) ? 'inline-block' : 'none';
      }

      if (syncLabel && c.lastSynced) {
        syncLabel.textContent = `Última sincr: ${new Date(c.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
  } catch (err) {
    console.warn('[Inbox] Error cargando ajustes de WhatsApp:', err);
  }
}

async function saveWhatsAppSettings() {
  const enabled = document.getElementById('chk-whatsapp-enabled')?.checked || false;
  const serviceType = document.getElementById('whatsapp-service-type')?.value || 'green-api';
  const greenIdInstance = document.getElementById('whatsapp-green-id')?.value.trim() || '';
  const greenApiToken = document.getElementById('whatsapp-green-token')?.value.trim() || '';
  const phone = document.getElementById('whatsapp-input-phone')?.value.trim() || '';
  const apiKey = document.getElementById('whatsapp-input-key')?.value.trim() || '';
  const notifyDms = document.getElementById('chk-notify-dms')?.checked ?? true;
  const notifyComments = document.getElementById('chk-notify-comments')?.checked ?? true;
  const publicUrl = document.getElementById('whatsapp-public-url')?.value.trim() || '';

  const btn = document.getElementById('btn-whatsapp-save');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/inbox/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled,
        serviceType,
        greenIdInstance,
        greenApiToken,
        phone,
        apiKey,
        notifyDms,
        notifyComments,
        publicUrl
      })
    });

    const json = await res.json();
    if (json.success) {
      showToast('Ajustes de WhatsApp guardados exitosamente', 'success');
      loadWhatsAppSettings();
    } else {
      showToast(json.error || 'Error al guardar ajustes', 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function testWhatsAppAlert() {
  const serviceType = document.getElementById('whatsapp-service-type')?.value || 'green-api';
  const greenIdInstance = document.getElementById('whatsapp-green-id')?.value.trim() || '';
  const greenApiToken = document.getElementById('whatsapp-green-token')?.value.trim() || '';
  const phone = document.getElementById('whatsapp-input-phone')?.value.trim() || '';
  const apiKey = document.getElementById('whatsapp-input-key')?.value.trim() || '';

  if (!phone) {
    showToast('Ingresa tu número de teléfono para recibir el WhatsApp', 'error');
    return;
  }

  if (serviceType === 'green-api' && (!greenIdInstance || !greenApiToken)) {
    showToast('Ingresa tu idInstance y apiTokenInstance de Green-API', 'error');
    return;
  }

  if (serviceType === 'callmebot' && !apiKey) {
    showToast('Ingresa tu API Key de CallMeBot', 'error');
    return;
  }

  const btn = document.getElementById('btn-whatsapp-test');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando WhatsApp... ⏳';
  }

  try {
    const res = await fetch('/api/inbox/test-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType,
        greenIdInstance,
        greenApiToken,
        phone,
        apiKey
      })
    });

    const json = await res.json();
    if (json.success) {
      showToast('🚀 ¡WhatsApp enviado con éxito! Revisa tu celular.', 'success', 5000);
    } else {
      showToast(json.error || 'Error al enviar WhatsApp de prueba', 'error', 5000);
    }
  } catch (err) {
    showToast(`Error al enviar: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📲 Enviar WhatsApp de Prueba';
    }
  }
}

// ==========================================
// 5. POLLING & BADGES EN VIVO
// ==========================================
function startInboxPolling() {
  if (InboxState.pollingTimer) return;
  InboxState.pollingTimer = setInterval(async () => {
    // Solo consultar si la ventana está activa
    if (document.visibilityState === 'visible') {
      if (AppState.activeTab === 'inbox') {
        if (InboxState.currentView === 'dms') {
          loadConversations();
        } else if (InboxState.currentView === 'comments') {
          loadComments();
        }
      } else {
        // En segundo plano, chequear badges
        updateUnreadBadgesFromApi();
      }
    }
  }, 25000);
}

async function updateUnreadBadgesFromApi() {
  try {
    const active = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const params = new URLSearchParams();
    if (active && active.pageId) {
      params.append('accountId', active.pageId);
      if (active.instagramId) params.append('instagramId', active.instagramId);
    }
    const res = await fetch(`/api/inbox/conversations${params.toString() ? '?' + params.toString() : ''}`);
    const json = await res.json();
    if (json.success && json.data) {
      InboxState.conversations = json.data;
      updateUnreadBadges();
    }
  } catch (_) {}
}

function updateUnreadBadges() {
  const unreadDms = InboxState.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const unreadComments = InboxState.comments.filter(c => c.is_answered === 0).length;
  const totalUnread = unreadDms + unreadComments;

  const sidebarBadge = document.getElementById('sidebar-inbox-badge');
  if (sidebarBadge) {
    if (totalUnread > 0) {
      sidebarBadge.textContent = totalUnread;
      sidebarBadge.style.display = 'inline-block';
    } else {
      sidebarBadge.style.display = 'none';
    }
  }

  const dmsBadge = document.getElementById('inbox-unread-dms-badge');
  if (dmsBadge) {
    if (unreadDms > 0) {
      dmsBadge.textContent = unreadDms;
      dmsBadge.style.display = 'inline-block';
    } else {
      dmsBadge.style.display = 'none';
    }
  }

  const commentsBadge = document.getElementById('inbox-unread-comments-badge');
  if (commentsBadge) {
    if (unreadComments > 0) {
      commentsBadge.textContent = unreadComments;
      commentsBadge.style.display = 'inline-block';
    } else {
      commentsBadge.style.display = 'none';
    }
  }
}

// Helpers
function formatTimeSnippet(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffHours = (now - d) / (1000 * 3600);

  if (diffHours < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffHours < 48) {
    return 'Ayer';
  } else {
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  setupInboxSubtabs();
});
