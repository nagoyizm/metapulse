// =============================================================================
// MetaPulse - Estudio de Reels: clips descritos -> reel 9:16 con texto, voz IA y música
// =============================================================================
(function () {
  'use strict';

  const S = {
    clips: [],        // { url, kind, description, name }
    scenes: [],       // { clip, url, kind, start, length, text, pos }
    voiceover: '',
    caption: '',
    voices: [],
    voice: 'Sulafat',
    voiceUrl: '',
    voiceDur: 0,
    music: null,      // { url, title, artist }
    musicQuery: '',
    resultUrl: '',
    busy: false
  };
  let audioEl = null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => { if (typeof showToast === 'function') showToast(m, t); };

  function brandName() {
    const acc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    return acc?.pageName || (window.AppState?.config?.pageName) || '';
  }

  async function api(path, body) {
    const res = await fetch('/api' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `Error ${res.status}`);
    return json.data;
  }

  function setBusy(btnId, busy, label) {
    const b = $(btnId);
    if (!b) return;
    if (busy) { b.dataset.label = b.textContent; b.textContent = label; b.disabled = true; } else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }

  // ── Clips ──
  function renderClips() {
    const box = $('reel-clips');
    if (!box) return;
    if (!S.clips.length) { box.innerHTML = '<div class="reel-empty">Aún no hay clips. Sube videos o fotos y descríbelos.</div>'; return; }
    box.innerHTML = S.clips.map((c, i) => `
      <div class="reel-clip" data-i="${i}">
        <div class="reel-clip-thumb">${c.kind === 'imagen'
          ? `<img src="${esc(c.url)}" alt="">`
          : `<video src="${esc(c.url)}#t=0.5" muted preload="metadata" playsinline></video>`}</div>
        <div class="reel-clip-body">
          <div class="reel-clip-name">${i + 1}. ${esc(c.name || 'clip')} <span class="reel-tag">${c.kind}</span></div>
          <textarea class="form-control reel-clip-desc" rows="2" placeholder="Describe qué se ve (ej: cámara lenta del helado partiéndose, se ve el relleno de poroto)">${esc(c.description)}</textarea>
        </div>
        <button type="button" class="btn btn-secondary btn-xs reel-clip-del" title="Quitar">✕</button>
      </div>`).join('');
    box.querySelectorAll('.reel-clip').forEach((el) => {
      const i = +el.dataset.i;
      el.querySelector('.reel-clip-desc').addEventListener('input', (e) => { S.clips[i].description = e.target.value; });
      el.querySelector('.reel-clip-del').addEventListener('click', () => { S.clips.splice(i, 1); renderClips(); });
    });
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    toast(`Subiendo ${files.length} archivo(s)...`, 'info');
    try {
      const acc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
      if (acc?.pageId) fd.append('account_id', acc.pageId);
      if (acc?.pageName) fd.append('account_name', acc.pageName);
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'No se pudo subir');
      json.data.forEach((m) => {
        const isImg = (m.mime_type || '').startsWith('image/');
        S.clips.push({ url: m.url, kind: isImg ? 'imagen' : 'video', description: '', name: m.original_name });
      });
      renderClips();
      toast('Archivos subidos. Descríbelos y arma el reel.', 'success');
    } catch (err) {
      toast('Error al subir: ' + err.message, 'error');
    }
  }

  // ── Plan con IA ──
  async function planWithAI() {
    if (!S.clips.length) return toast('Sube al menos un clip o foto.', 'warning');
    if (S.clips.some((c) => !c.description.trim())) toast('Tip: describir cada clip mejora mucho el resultado.', 'info');
    setBusy('btn-reel-plan', true, '✨ Armando reel con IA...');
    try {
      const data = await api('/reel/plan', {
        brand: brandName(),
        clips: S.clips.map((c) => ({ url: c.url, description: c.description })),
        goal: $('reel-goal')?.value || '',
        target_seconds: Number($('reel-target')?.value) || 10
      });
      S.scenes = data.scenes;
      S.voiceover = data.voiceover;
      S.caption = data.caption;
      S.musicQuery = data.musicQuery || '';
      S.voiceUrl = '';
      S.resultUrl = '';
      renderEditor();
      if ($('reel-music-q') && S.musicQuery) $('reel-music-q').value = S.musicQuery;
      toast('Reel armado. Revisa y ajusta lo que quieras.', 'success');
      $('reel-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      toast('No se pudo armar el reel: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-plan', false);
    }
  }

  // ── Editor de escenas / voz ──
  function totalSeconds() { return S.scenes.reduce((a, s) => a + (Number(s.length) || 0), 0); }

  function renderEditor() {
    const wrap = $('reel-editor');
    if (!wrap) return;
    wrap.style.display = S.scenes.length ? 'block' : 'none';
    if (!S.scenes.length) return;
    const clipOpts = (sel) => S.clips.map((c, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${i + 1}. ${esc((c.description || c.name || '').slice(0, 28))}</option>`).join('');
    $('reel-scenes').innerHTML = S.scenes.map((s, i) => `
      <div class="reel-scene" data-i="${i}">
        <div class="reel-scene-head"><strong>Escena ${i + 1}</strong>
          <span class="reel-scene-tools">
            <button type="button" class="btn btn-secondary btn-xs" data-act="up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-secondary btn-xs" data-act="down" ${i === S.scenes.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-secondary btn-xs" data-act="del">✕</button>
          </span></div>
        <div class="reel-scene-grid">
          <label>Clip<select class="form-control" data-f="clip">${clipOpts(s.clip)}</select></label>
          <label>Inicio (s)<input class="form-control" type="number" step="0.1" min="0" data-f="start" value="${s.start}" ${s.kind === 'imagen' ? 'disabled' : ''}></label>
          <label>Duración (s)<input class="form-control" type="number" step="0.1" min="0.8" max="8" data-f="length" value="${s.length}"></label>
          <label>Posición<select class="form-control" data-f="pos">
            ${['top', 'center', 'bottom'].map((p) => `<option value="${p}" ${s.pos === p ? 'selected' : ''}>${{ top: 'Arriba', center: 'Centro', bottom: 'Abajo' }[p]}</option>`).join('')}</select></label>
        </div>
        <label>Texto en pantalla<input class="form-control" type="text" maxlength="60" data-f="text" value="${esc(s.text)}"></label>
      </div>`).join('');
    $('reel-scenes').querySelectorAll('.reel-scene').forEach((el) => {
      const i = +el.dataset.i;
      el.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('change', () => {
        const f = inp.dataset.f;
        if (f === 'clip') { const c = S.clips[+inp.value]; S.scenes[i].clip = +inp.value; S.scenes[i].url = c.url; S.scenes[i].kind = c.kind; S.scenes[i].start = 0; renderEditor(); return; }
        S.scenes[i][f] = (f === 'start' || f === 'length') ? Number(inp.value) : inp.value;
        updateTotal(); S.resultUrl = '';
      }));
      el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'del') S.scenes.splice(i, 1);
        else { const j = a === 'up' ? i - 1 : i + 1; [S.scenes[i], S.scenes[j]] = [S.scenes[j], S.scenes[i]]; }
        renderEditor();
      }));
    });
    $('reel-voiceover').value = S.voiceover;
    $('reel-caption').value = S.caption;
    updateTotal();
    renderVoices();
  }

  function updateTotal() {
    const t = totalSeconds();
    const el = $('reel-total');
    if (el) el.textContent = `${t.toFixed(1)} s`;
  }

  function renderVoices() {
    const sel = $('reel-voice');
    if (!sel || !S.voices.length) return;
    sel.innerHTML = S.voices.map((v) => `<option value="${v.id}" ${v.id === S.voice ? 'selected' : ''}>${esc(v.label)} — ${esc(v.desc)}</option>`).join('');
  }

  async function previewVoice() {
    const text = ($('reel-voiceover').value || '').trim();
    if (!text) return toast('Escribe o genera el guion de voz primero.', 'warning');
    setBusy('btn-reel-voice', true, '🔊 Generando voz...');
    try {
      const data = await api('/reel/voice', { text, voice: S.voice, style: $('reel-voice-style')?.value || '' });
      S.voiceUrl = data.url; S.voiceDur = data.duration; S.resultUrl = '';
      const a = $('reel-voice-audio');
      a.src = data.url; a.style.display = 'block'; a.play().catch(() => {});
      $('reel-voice-info').textContent = `Voz lista (${data.duration.toFixed(1)} s). Si dura más que el video, se alarga la última escena.`;
    } catch (err) {
      toast('No se pudo generar la voz: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-voice', false);
    }
  }

  // ── Música ──
  async function searchMusic() {
    const q = ($('reel-music-q').value || '').trim();
    const box = $('reel-music-results');
    box.innerHTML = '<div class="reel-empty">Buscando...</div>';
    try {
      let tracks = [];
      if (q) {
        const r = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=12`).then((x) => x.json());
        tracks = r.data?.results || [];
      } else {
        const r = await fetch('/api/music/library').then((x) => x.json());
        tracks = [...(r.data?.userAudios || []), ...(r.data?.tracks || [])].slice(0, 20);
      }
      if (!tracks.length) { box.innerHTML = '<div class="reel-empty">Sin resultados. Prueba otra palabra.</div>'; return; }
      box.innerHTML = '';
      tracks.forEach((t) => {
        const row = document.createElement('div');
        row.className = 'reel-track';
        row.innerHTML = `<button type="button" class="btn btn-secondary btn-xs" data-a="play">▶</button>
          <span class="reel-track-info"><strong>${esc(t.title)}</strong><small>${esc(t.artist || '')}</small></span>
          <button type="button" class="btn btn-primary btn-xs" data-a="use">Usar</button>`;
        row.querySelector('[data-a="play"]').addEventListener('click', () => {
          if (!audioEl) audioEl = new Audio();
          audioEl.src = t.previewUrl || t.streamUrl; audioEl.play().catch(() => toast('No se pudo reproducir la muestra.', 'warning'));
        });
        row.querySelector('[data-a="use"]').addEventListener('click', () => {
          S.music = { url: t.streamUrl, title: t.title, artist: t.artist || '' }; S.resultUrl = '';
          if (audioEl) audioEl.pause();
          renderMusicSel();
        });
        box.appendChild(row);
      });
    } catch (err) {
      box.innerHTML = `<div class="reel-empty">Error: ${esc(err.message)}</div>`;
    }
  }

  function renderMusicSel() {
    const el = $('reel-music-sel');
    if (el) el.innerHTML = S.music ? `🎵 <strong>${esc(S.music.title)}</strong> ${esc(S.music.artist)} <button type="button" class="btn btn-secondary btn-xs" id="reel-music-clear">Quitar</button>` : 'Sin música seleccionada';
    $('reel-music-clear')?.addEventListener('click', () => { S.music = null; renderMusicSel(); });
  }

  // ── Render y entrega ──
  async function renderReel() {
    if (!S.scenes.length) return toast('Arma el reel primero.', 'warning');
    S.voiceover = $('reel-voiceover').value;
    S.caption = $('reel-caption').value;
    const useVoice = $('reel-use-voice')?.checked && S.voiceover.trim();
    setBusy('btn-reel-render', true, '🎬 Renderizando reel...');
    try {
      if (useVoice && !S.voiceUrl) {
        toast('Generando la voz...', 'info');
        const v = await api('/reel/voice', { text: S.voiceover, voice: S.voice, style: $('reel-voice-style')?.value || '' });
        S.voiceUrl = v.url; S.voiceDur = v.duration;
      }
      const data = await api('/reel/render', {
        scenes: S.scenes.map(({ url, start, length, text, pos }) => ({ url, start, length, text, pos })),
        voice_url: useVoice ? S.voiceUrl : '',
        voice_volume: Number($('reel-voice-vol').value) || 1,
        music: S.music ? { url: S.music.url, title: S.music.title, artist: S.music.artist } : null,
        music_volume: Number($('reel-music-vol').value) || 0.3
      });
      S.resultUrl = data.url;
      const v = $('reel-result-video');
      v.src = data.url + '?t=' + Date.now(); v.style.display = 'block';
      $('reel-result-actions').style.display = 'flex';
      $('reel-result-info').textContent = `${data.duration} s · ${(data.sizeBytes / 1048576).toFixed(1)} MB`;
      toast('¡Reel listo!', 'success');
    } catch (err) {
      toast('Error al renderizar: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-render', false);
    }
  }

  async function saveDraft(openInComposer) {
    if (!S.resultUrl) return;
    const acc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    try {
      const body = {
        title: 'Reel', content: $('reel-caption').value || '', platforms: ['facebook', 'instagram'], post_type: 'reel',
        media_urls: [S.resultUrl], accountId: acc?.pageId || null, accountName: acc?.pageName || null
      };
      const res = await fetch('/api/posts/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      toast('Borrador de Reel guardado en el calendario.', 'success');
      if (openInComposer && typeof window.switchTab === 'function') window.switchTab('queue');
    } catch (err) {
      toast('No se pudo guardar el borrador: ' + err.message, 'error');
    }
  }

  async function init() {
    if (!$('tab-reels') || init.done) return;
    init.done = true;
    $('reel-file')?.addEventListener('change', (e) => { uploadFiles(e.target.files); e.target.value = ''; });
    $('btn-reel-plan')?.addEventListener('click', planWithAI);
    $('btn-reel-voice')?.addEventListener('click', previewVoice);
    $('btn-reel-music-search')?.addEventListener('click', searchMusic);
    $('reel-music-q')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchMusic(); } });
    $('btn-reel-render')?.addEventListener('click', renderReel);
    $('btn-reel-draft')?.addEventListener('click', () => saveDraft(true));
    $('reel-voice')?.addEventListener('change', (e) => { S.voice = e.target.value; S.voiceUrl = ''; });
    $('reel-voiceover')?.addEventListener('input', () => { S.voiceUrl = ''; });
    $('reel-music-vol')?.addEventListener('input', (e) => { $('reel-music-vol-n').textContent = Math.round(e.target.value * 100) + '%'; });
    $('reel-voice-vol')?.addEventListener('input', (e) => { $('reel-voice-vol-n').textContent = Math.round(e.target.value * 100) + '%'; });
    try { S.voices = await api('/reel/voices'); } catch (_) { S.voices = []; }
    renderVoices(); renderClips(); renderMusicSel();
  }

  window.loadReelStudio = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
