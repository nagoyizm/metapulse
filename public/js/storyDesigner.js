// Diseñador de historias: texto gancho + stickers (ubicación, mención, cuenta regresiva, emojis) que el usuario
// coloca arrastrando. Las posiciones se guardan como fracciones (0..1) del lienzo 1080x1920 y el servidor
// dibuja exactamente lo mismo al agendar.
(function () {
  const STAGE_W = 270;
  const STAGE_H = 480;
  const K = STAGE_W / 1080;

  const state = {
    enabled: false,
    useHook: true,
    hook: '',
    items: [], // { id, kind, text, code, targetDate, x, y, scale, rotate, animated }
    selectedId: null,
    animatedDefault: false,
    catalog: [],
    baseUrl: null,
    imageUrl: null,
    spriteCache: new Map()
  };
  let seq = 0;
  let baseTimer = null;
  let mount = null;
  const $ = (id) => document.getElementById(id);

  function firstImageUrl() {
    const files = (window.ComposerState && window.ComposerState.mediaFiles) || [];
    const img = files.find(u => !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u));
    if (img) return img;
    // El post es el video generado a partir de una imagen con música: se diseña sobre esa imagen
    const cs = window.ComposerState || {};
    if (cs.sourceImage && cs.sourceImageVideo && files[0] === cs.sourceImageVideo) return cs.sourceImage;
    return null;
  }

  async function post(path, body) {
    const res = await fetch('/api/story-design/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Error');
    return json.data;
  }

  function daysUntil(dateStr) {
    const t = new Date(dateStr + 'T12:00:00');
    if (isNaN(t.getTime())) return 0;
    const n = new Date(); n.setHours(12, 0, 0, 0);
    return Math.max(0, Math.round((t - n) / 86400000));
  }

  async function sprite(item) {
    const days = item.kind === 'countdown' ? daysUntil(item.targetDate) : 0;
    const key = [item.kind, item.text || '', item.code || '', days].join('|');
    if (state.spriteCache.has(key)) return state.spriteCache.get(key);
    const data = await post('sticker', { kind: item.kind, text: item.text, code: item.code, days });
    state.spriteCache.set(key, data);
    return data;
  }

  function buildUI() {
    mount.innerHTML = `
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:0.85rem;margin:0;">
        <input type="checkbox" id="sd-enable" style="width:17px;height:17px;accent-color:#ec4899;cursor:pointer;">
        <span>🎨 Diseñar la Historia (texto gancho y stickers)</span>
      </label>
      <div id="sd-panel" style="display:none;margin-top:10px;">
        <div id="sd-novideo" style="display:none;font-size:0.78rem;color:#b45309;">El diseño solo funciona con imágenes (si el post es un video que subiste, no se puede). Sube una imagen primero.</div>
        <div id="sd-body" style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;">
          <div>
            <div id="sd-stage" style="position:relative;width:${STAGE_W}px;height:${STAGE_H}px;background:#222;border-radius:10px;overflow:hidden;touch-action:none;user-select:none;">
              <img id="sd-base" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;">
              <div id="sd-items" style="position:absolute;inset:0;"></div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-secondary);margin-top:4px;max-width:${STAGE_W}px;">Arrastra cada elemento. Los stickers son solo visuales (no se pueden tocar en Instagram).</div>
          </div>
          <div style="flex:1;min-width:240px;display:flex;flex-direction:column;gap:10px;font-size:0.8rem;">
            <div>
              <label style="display:flex;align-items:center;gap:6px;font-weight:700;"><input type="checkbox" id="sd-use-hook" checked> Texto gancho (cuadro blanco)</label>
              <textarea id="sd-hook" class="form-control" rows="2" maxlength="140" placeholder="Frase corta que lleve al post…" style="margin-top:4px;font-size:0.82rem;"></textarea>
              <button type="button" class="btn btn-secondary" id="sd-suggest" style="margin-top:4px;font-size:0.76rem;padding:4px 10px;">✨ Sugerir con IA</button>
              <span id="sd-suggest-msg" style="font-size:0.72rem;margin-left:6px;color:var(--text-secondary);"></span>
            </div>
            <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center;">
              <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="sd-loc-on"> 📍 Ubicación</label>
              <input type="text" id="sd-loc" class="form-control" value="Algarrobo" maxlength="40" style="font-size:0.8rem;">
              <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="sd-men-on"> @ Mención</label>
              <input type="text" id="sd-men" class="form-control" placeholder="@cuenta" maxlength="40" style="font-size:0.8rem;">
              <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="sd-cd-on"> ⏳ Cuenta regresiva</label>
              <input type="date" id="sd-cd" class="form-control" style="font-size:0.8rem;">
            </div>
            <div>
              <div style="font-weight:700;margin-bottom:4px;">Stickers</div>
              <label style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:0.76rem;"><input type="checkbox" id="sd-animated"> Animados (la historia sale como video de 7 s)</label>
              <div id="sd-emojis" style="display:flex;flex-wrap:wrap;gap:4px;max-height:130px;overflow:auto;"></div>
            </div>
            <div id="sd-sel" style="display:none;padding:8px;border:1px dashed rgba(236,72,153,0.5);border-radius:8px;">
              <div style="font-weight:700;margin-bottom:4px;">Elemento seleccionado</div>
              <label style="display:flex;align-items:center;gap:6px;">Tamaño <input type="range" id="sd-scale" min="0.4" max="3" step="0.05" style="flex:1;"></label>
              <label style="display:flex;align-items:center;gap:6px;">Giro <input type="range" id="sd-rot" min="-45" max="45" step="1" style="flex:1;"></label>
              <button type="button" class="btn btn-secondary" id="sd-del" style="margin-top:4px;font-size:0.74rem;padding:3px 10px;">🗑️ Quitar</button>
              <label id="sd-anim-one-wrap" style="display:none;align-items:center;gap:6px;margin-top:4px;font-size:0.74rem;"><input type="checkbox" id="sd-anim-one"> Animado</label>
            </div>
          </div>
        </div>
      </div>`;
  }

  function getItem(id) { return state.items.find(i => i.id === id); }
  function findKind(kind) { return state.items.find(i => i.kind === kind); }

  async function renderStage() {
    const layer = $('sd-items');
    if (!layer) return;
    layer.innerHTML = '';
    for (const item of state.items) {
      let sp;
      try { sp = await sprite(item); } catch (_) { continue; }
      const w = sp.width * (item.scale || 1) * K;
      const h = sp.height * (item.scale || 1) * K;
      const el = document.createElement('div');
      el.dataset.id = item.id;
      el.style.cssText = `position:absolute;left:${item.x * 100}%;top:${item.y * 100}%;width:${w}px;height:${h}px;` +
        `transform:translate(-50%,-50%) rotate(${item.rotate || 0}deg);cursor:grab;` +
        (item.id === state.selectedId ? 'outline:1.5px dashed #ec4899;outline-offset:1px;' : '');
      const img = document.createElement('img');
      img.src = sp.dataUrl;
      img.draggable = false;
      img.style.cssText = 'width:100%;height:100%;pointer-events:none;';
      el.appendChild(img);
      if (item.animated) {
        const badge = document.createElement('span');
        badge.textContent = '▶';
        badge.style.cssText = 'position:absolute;right:-2px;top:-2px;background:#ec4899;color:#fff;font-size:8px;border-radius:50%;width:12px;height:12px;display:flex;align-items:center;justify-content:center;';
        el.appendChild(badge);
      }
      el.addEventListener('pointerdown', (ev) => startDrag(ev, item));
      layer.appendChild(el);
    }
    syncSelection();
  }

  function startDrag(ev, item) {
    ev.preventDefault();
    select(item.id, false);
    const stage = $('sd-stage');
    const rect = stage.getBoundingClientRect();
    const el = ev.currentTarget;
    el.style.cursor = 'grabbing';
    const move = (e) => {
      item.x = Math.min(1.05, Math.max(-0.05, (e.clientX - rect.left) / rect.width));
      item.y = Math.min(1.05, Math.max(-0.05, (e.clientY - rect.top) / rect.height));
      el.style.left = item.x * 100 + '%';
      el.style.top = item.y * 100 + '%';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.style.cursor = 'grab';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function select(id, rerender = true) {
    state.selectedId = id;
    syncSelection();
    if (rerender) renderStage();
    else {
      document.querySelectorAll('#sd-items > div').forEach(d => {
        d.style.outline = d.dataset.id === id ? '1.5px dashed #ec4899' : 'none';
      });
    }
  }

  function syncSelection() {
    const it = getItem(state.selectedId);
    const box = $('sd-sel');
    if (!box) return;
    box.style.display = it ? 'block' : 'none';
    if (!it) return;
    $('sd-scale').value = it.scale || 1;
    $('sd-rot').value = it.rotate || 0;
    const wrap = $('sd-anim-one-wrap');
    const cat = it.kind === 'emoji' ? state.catalog.find(c => c.code === it.code) : null;
    wrap.style.display = cat && cat.animated ? 'flex' : 'none';
    $('sd-anim-one').checked = Boolean(it.animated);
  }

  function addItem(partial) {
    const item = Object.assign({ id: 'i' + (++seq), x: 0.5, y: 0.5, scale: 1, rotate: 0 }, partial);
    state.items.push(item);
    state.selectedId = item.id;
    renderStage();
    return item;
  }

  function removeKind(kind) {
    state.items = state.items.filter(i => i.kind !== kind);
    if (!getItem(state.selectedId)) state.selectedId = null;
    renderStage();
  }

  function toggleSingle(kind, on, props) {
    if (!on) return removeKind(kind);
    const existing = findKind(kind);
    if (existing) Object.assign(existing, props);
    else addItem(Object.assign({ kind }, props));
    renderStage();
  }

  function refreshBase() {
    clearTimeout(baseTimer);
    baseTimer = setTimeout(async () => {
      const url = firstImageUrl();
      state.imageUrl = url;
      const noVideo = $('sd-novideo');
      const body = $('sd-body');
      if (!url) {
        if (noVideo) noVideo.style.display = 'block';
        if (body) body.style.display = 'none';
        return;
      }
      if (noVideo) noVideo.style.display = 'none';
      if (body) body.style.display = 'flex';
      try {
        const caption = state.useHook ? state.hook : '';
        const data = await post('base', { image_url: url, caption });
        state.baseUrl = data.url + '?t=' + Date.now();
        $('sd-base').src = state.baseUrl;
      } catch (err) {
        console.warn('[StoryDesigner] base:', err.message);
      }
    }, 450);
  }

  function renderEmojiGrid() {
    const grid = $('sd-emojis');
    if (!grid) return;
    grid.innerHTML = '';
    state.catalog.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = c.label + (c.animated ? ' (animable)' : '');
      b.style.cssText = 'width:34px;height:34px;padding:2px;border:1px solid rgba(0,0,0,0.12);border-radius:8px;background:#fff;cursor:pointer;';
      b.innerHTML = `<img src="/assets-stickers/${c.code}.png" alt="${c.label}" style="width:100%;height:100%;object-fit:contain;" onerror="this.remove()">`;
      b.addEventListener('click', () => {
        const n = state.items.filter(i => i.kind === 'emoji').length;
        addItem({
          kind: 'emoji', code: c.code, x: 0.2 + (n % 4) * 0.2, y: 0.25 + (n % 3) * 0.05, scale: 1, rotate: n % 2 ? 10 : -10,
          animated: Boolean(state.animatedDefault && c.animated)
        });
      });
      grid.appendChild(b);
    });
  }

  async function suggest() {
    const msg = $('sd-suggest-msg');
    const content = (document.getElementById('post-content')?.value || '').trim();
    const title = (document.getElementById('post-title')?.value || '').trim();
    if (!content && !title) { msg.textContent = 'Escribe primero el texto del post.'; return; }
    msg.textContent = 'Pensando…';
    try {
      const data = await post('suggest', { title, content });
      $('sd-hook').value = data.hook || '';
      state.hook = data.hook || '';
      state.useHook = true;
      $('sd-use-hook').checked = true;
      if (data.emojis && data.emojis.length && !state.items.some(i => i.kind === 'emoji')) {
        data.emojis.forEach((code, i) => {
          const c = state.catalog.find(x => x.code === code);
          addItem({ kind: 'emoji', code, x: i ? 0.15 : 0.85, y: i ? 0.66 : 0.13, rotate: i ? -10 : 12, animated: Boolean(state.animatedDefault && c && c.animated) });
        });
      }
      msg.textContent = data.fallback ? 'IA no disponible: usé la primera frase.' : 'Listo, edítalo si quieres.';
      refreshBase();
    } catch (err) {
      msg.textContent = 'No se pudo: ' + err.message;
    }
  }

  function bind() {
    $('sd-enable').addEventListener('change', (e) => {
      state.enabled = e.target.checked;
      $('sd-panel').style.display = state.enabled ? 'block' : 'none';
      if (state.enabled) {
        refreshBase();
        if (!state.hook && ((document.getElementById('post-content')?.value || '').trim())) suggest();
      }
    });
    $('sd-use-hook').addEventListener('change', (e) => { state.useHook = e.target.checked; refreshBase(); });
    $('sd-hook').addEventListener('input', (e) => { state.hook = e.target.value; refreshBase(); });
    $('sd-suggest').addEventListener('click', suggest);

    const locUpdate = () => toggleSingle('location', $('sd-loc-on').checked && $('sd-loc').value.trim(), { text: $('sd-loc').value.trim(), x: 0.28, y: 0.145 });
    $('sd-loc-on').addEventListener('change', locUpdate);
    $('sd-loc').addEventListener('change', () => { if ($('sd-loc-on').checked) locUpdate(); });
    const menUpdate = () => toggleSingle('mention', $('sd-men-on').checked && $('sd-men').value.trim(), { text: $('sd-men').value.trim(), x: 0.7, y: 0.145 });
    $('sd-men-on').addEventListener('change', menUpdate);
    $('sd-men').addEventListener('change', () => { if ($('sd-men-on').checked) menUpdate(); });
    const cdUpdate = () => toggleSingle('countdown', $('sd-cd-on').checked && $('sd-cd').value, { targetDate: $('sd-cd').value, x: 0.5, y: 0.9, rotate: -3 });
    $('sd-cd-on').addEventListener('change', cdUpdate);
    $('sd-cd').addEventListener('change', () => { if ($('sd-cd-on').checked) cdUpdate(); });

    $('sd-animated').addEventListener('change', (e) => { state.animatedDefault = e.target.checked; });
    $('sd-scale').addEventListener('input', (e) => { const it = getItem(state.selectedId); if (it) { it.scale = Number(e.target.value); renderStage(); } });
    $('sd-rot').addEventListener('input', (e) => { const it = getItem(state.selectedId); if (it) { it.rotate = Number(e.target.value); renderStage(); } });
    $('sd-anim-one').addEventListener('change', (e) => { const it = getItem(state.selectedId); if (it) { it.animated = e.target.checked; renderStage(); } });
    $('sd-del').addEventListener('click', () => {
      state.items = state.items.filter(i => i.id !== state.selectedId);
      state.selectedId = null;
      renderStage();
    });
    $('sd-stage').addEventListener('pointerdown', (e) => { if (e.target.id === 'sd-stage' || e.target.id === 'sd-items') select(null); });
  }

  function getDesign() {
    if (!state.enabled || !firstImageUrl()) return null;
    const items = state.items.map(i => ({
      kind: i.kind, text: i.text, code: i.code, targetDate: i.targetDate,
      x: i.x, y: i.y, scale: i.scale, rotate: i.rotate, animated: Boolean(i.animated)
    }));
    return { enabled: true, caption: state.useHook ? state.hook.trim() : '', items, imageUrl: firstImageUrl() };
  }

  function reset() {
    state.enabled = false; state.hook = ''; state.items = []; state.selectedId = null; state.useHook = true;
    if (!mount) return;
    buildUI(); bind(); renderEmojiGrid();
  }

  async function init() {
    mount = $('story-designer-mount');
    if (!mount) return;
    buildUI();
    bind();
    try {
      const res = await fetch('/api/story-design/catalog');
      const json = await res.json();
      state.catalog = (json.data && json.data.emojis) || [];
    } catch (_) { state.catalog = []; }
    renderEmojiGrid();
    // La imagen puede cambiar mientras el panel está abierto
    setInterval(() => {
      if (state.enabled && firstImageUrl() !== state.imageUrl) refreshBase();
    }, 1500);
  }

  window.StoryDesigner = { getDesign, reset, refresh: refreshBase };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
