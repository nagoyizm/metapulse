// Pestaña "Actividad": feed de aumentos de me gusta/comentarios y lista de posts con sus comentarios.
(function () {
  let lastEventId = 0;
  let pollTimer = null;
  let started = false;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function accountId() {
    const acc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    return acc?.pageId || $('global-account-select')?.value || '';
  }

  function parseUtc(s) {
    if (!s) return null;
    const iso = /Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function ago(s) {
    const d = parseUtc(s);
    if (!d) return '';
    const sec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return 'ahora';
    if (sec < 3600) return Math.round(sec / 60) + ' min';
    if (sec < 86400) return Math.round(sec / 3600) + ' h';
    return Math.round(sec / 86400) + ' d';
  }

  // "hace 5 min" + hora de Chile (ej. "hace 5 min · 14:32")
  function timeLabel(s) {
    const d = parseUtc(s);
    if (!d) return '';
    const clock = d.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false });
    const day = (Date.now() - d.getTime()) > 86400000 ? d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short' }) + ' ' : '';
    const a = ago(s);
    return (a === 'ahora' ? 'ahora' : 'hace ' + a) + '<br>' + day + clock;
  }

  function thumbHtml(url) {
    return url ? `<img class="activity-thumb" src="${esc(url)}" alt="" loading="lazy">` : '<div class="activity-thumb"></div>';
  }

  function eventHtml(e, isNew) {
    if (e.kind === 'comment') {
      const tag = e.permalink ? 'a' : 'div';
      const href = e.permalink ? ` href="${esc(e.permalink)}" target="_blank" rel="noopener"` : '';
      return `<${tag} class="activity-event${isNew ? ' is-new' : ''}"${href}>
        ${thumbHtml(e.thumb_url)}
        <div class="activity-event-main">
          <strong>💬 @${esc(e.author || 'usuario')} comentó</strong>
          <span style="white-space:normal;">${esc((e.text || '').slice(0, 140))}</span>
          <span>${esc(e.account_name || '')} · ${esc((e.caption || '').replace(/\s+/g, ' ').slice(0, 40))}</span>
        </div>
        <div class="activity-event-time">${timeLabel(e.event_time || e.created_at)}</div>
      </${tag}>`;
    }
    const what = e.kind === 'likes'
      ? `❤️ +${e.delta} me gusta`
      : `💬 +${e.delta} comentario${e.delta > 1 ? 's' : ''}`;
    const tag = e.permalink ? 'a' : 'div';
    const href = e.permalink ? ` href="${esc(e.permalink)}" target="_blank" rel="noopener"` : '';
    return `<${tag} class="activity-event${isNew ? ' is-new' : ''}"${href}>
      ${thumbHtml(e.thumb_url)}
      <div class="activity-event-main">
        <strong>${what} <small class="text-muted">· total ${e.total}</small></strong>
        <span>${esc(e.account_name || '')} · ${esc((e.caption || '').replace(/\s+/g, ' ').slice(0, 70))}</span>
      </div>
      <div class="activity-event-time">${timeLabel(e.created_at)}</div>
    </${tag}>`;
  }

  async function loadFeed(initial) {
    const box = $('activity-feed');
    if (!box) return;
    try {
      const acc = accountId();
      const q = new URLSearchParams({ sinceId: initial ? '0' : String(lastEventId), limit: initial ? '60' : '30' });
      if (acc) q.set('accountId', acc);
      const res = await fetch('/api/engagement/feed?' + q.toString());
      const json = await res.json();
      if (!json.success) return;
      const events = json.data;
      if (initial) {
        box.innerHTML = events.length
          ? events.map((e) => eventHtml(e, false)).join('')
          : '<p class="text-muted" style="font-size:0.85rem;">Aún no hay actividad registrada. Cuando alguien dé me gusta o comente, aparecerá aquí (se revisa cada 5 minutos).</p>';
      } else if (events.length) {
        box.querySelector('p.text-muted')?.remove();
        box.insertAdjacentHTML('afterbegin', events.map((e) => eventHtml(e, true)).join(''));
      }
      if (events.length) lastEventId = Math.max(lastEventId, ...events.map((e) => e.id));
    } catch (_) { /* se reintenta en el siguiente ciclo */ }
  }

  async function loadPosts() {
    const box = $('activity-posts');
    if (!box) return;
    const q = new URLSearchParams({ type: $('activity-filter-type')?.value || '', sort: $('activity-filter-sort')?.value || 'date' });
    const acc = accountId();
    if (acc) q.set('accountId', acc);
    try {
      const res = await fetch('/api/engagement/posts?' + q.toString());
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error');
      if (!json.data.length) { box.innerHTML = '<p class="text-muted">No hay publicaciones con métricas para esta cuenta todavía.</p>'; return; }
      box.innerHTML = json.data.map((p) => {
        const d = p.posted_at ? new Date(p.posted_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short' }) : '';
        return `<div class="activity-post" data-id="${esc(p.meta_media_id)}">
          <div class="activity-post-row">
            ${thumbHtml(p.thumb_url)}
            <div class="activity-event-main">
              <strong>${esc(d)} · ${p.media_type === 'VIDEO' ? 'Video' : 'Imagen'} · <span class="text-muted">${esc(p.account_name || '')}</span></strong>
              <span>${esc((p.caption || '').replace(/\s+/g, ' ').slice(0, 90))}</span>
            </div>
            <div class="activity-post-stats"><span>❤️ ${p.likes}</span><span>💬 ${p.comments}</span></div>
          </div>
          <div class="activity-comments" style="display:none;"></div>
        </div>`;
      }).join('');
    } catch (err) {
      box.innerHTML = `<p class="text-muted">No se pudieron cargar: ${esc(err.message)}</p>`;
    }
  }

  async function toggleComments(postEl) {
    const holder = postEl.querySelector('.activity-comments');
    if (!holder) return;
    if (holder.style.display !== 'none') { holder.style.display = 'none'; return; }
    holder.style.display = 'flex';
    holder.innerHTML = '<span class="text-muted">Cargando comentarios…</span>';
    try {
      const res = await fetch(`/api/engagement/posts/${encodeURIComponent(postEl.dataset.id)}/comments`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error');
      const link = postEl.querySelector('a');
      holder.innerHTML = json.data.length
        ? json.data.map((c) => `<div class="activity-comment"><strong>@${esc(c.username || 'usuario')}</strong> <small class="text-muted">${ago(c.timestamp)}</small><br>${esc(c.text || '')}${c.like_count ? ` <small>· ❤️ ${c.like_count}</small>` : ''}</div>`).join('')
        : '<span class="text-muted">Este post aún no tiene comentarios.</span>';
    } catch (err) {
      holder.innerHTML = `<span class="text-muted">No se pudieron cargar los comentarios: ${esc(err.message)}</span>`;
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    // El feed se consulta cada 20 s mientras la pestaña esté abierta (el servidor revisa Meta cada 5 min)
    pollTimer = setInterval(() => {
      if (document.hidden || !$('tab-activity')?.classList.contains('active')) return;
      loadFeed(false);
    }, 20000);
  }

  function bindOnce() {
    if (started) return;
    started = true;
    $('activity-filter-type')?.addEventListener('change', loadPosts);
    $('activity-filter-sort')?.addEventListener('change', loadPosts);
    $('activity-posts')?.addEventListener('click', (e) => {
      const row = e.target.closest('.activity-post-row');
      if (row) toggleComments(row.closest('.activity-post'));
    });
    $('btn-activity-refresh')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Revisando…';
      try {
        const res = await fetch('/api/engagement/refresh', { method: 'POST' });
        const json = await res.json();
        if (json.data?.skipped === 'reciente') showToast('Se revisó hace menos de 1 minuto', 'info');
        await loadFeed(false);
        await loadPosts();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Actualizar ahora';
      }
    });
    startPolling();
  }

  window.loadActivityData = async function () {
    bindOnce();
    lastEventId = 0;
    await Promise.all([loadFeed(true), loadPosts()]);
  };
})();
