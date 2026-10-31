// Ubicador de datos de contacto: el usuario arrastra el texto sobre la imagen y elige tamaño, color y fondo suave.
// El texto que se ve es el mismo que dibuja el servidor (se pide como imagen), así lo que ves es lo que se estampa.
(function () {
  let overlay = null;
  let st = null;

  function buildModal() {
    overlay = document.createElement('div');
    overlay.id = 'contact-placer-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.82);display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);box-sizing:border-box;';
    overlay.innerHTML = `
      <div style="background:var(--bg-surface,#fff);color:var(--text-primary,#111);border-radius:12px;max-width:min(96vw,760px);max-height:96vh;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong style="font-size:.95rem;">📍 Elige dónde van los datos de contacto</strong>
          <button type="button" id="cp-close" class="btn btn-ghost btn-xs" aria-label="Cerrar">✕</button>
        </div>
        <div style="font-size:.75rem;color:var(--text-muted,#666);">Arrastra el texto sobre la imagen. Lo que ves es lo que se estampa.</div>
        <div style="text-align:center;">
          <div id="cp-stage" style="position:relative;display:inline-block;line-height:0;touch-action:none;user-select:none;">
            <img id="cp-img" alt="Imagen" style="max-width:100%;max-height:62vh;display:block;border-radius:6px;">
            <div id="cp-chip" style="position:absolute;transform:translate(-50%,-50%);cursor:grab;touch-action:none;display:none;outline:1px dashed rgba(99,102,241,.9);outline-offset:3px;">
              <img id="cp-chip-img" alt="Datos de contacto" draggable="false" style="width:100%;display:block;pointer-events:none;">
            </div>
          </div>
          <div id="cp-status" style="font-size:.75rem;color:var(--text-muted,#666);margin-top:6px;">Cargando…</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:.8rem;">
          <label style="display:flex;align-items:center;gap:6px;">Tamaño
            <input type="range" id="cp-scale" min="50" max="250" value="100" style="width:140px;">
          </label>
          <label style="display:flex;align-items:center;gap:6px;">Color
            <select id="cp-color" class="form-control form-control-sm" style="width:auto;font-size:.8rem;">
              <option value="auto">Automático</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="cp-veil" checked> Fondo suave
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" id="cp-cancel" class="btn btn-ghost btn-sm" style="border:1px solid var(--border-subtle,#ddd);">Cancelar</button>
          <button type="button" id="cp-ok" class="btn btn-primary btn-sm">Estampar aquí</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const $ = (id) => overlay.querySelector('#' + id);
    $('cp-close').addEventListener('click', close);
    $('cp-cancel').addEventListener('click', close);
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    $('cp-scale').addEventListener('input', () => { st.scale = Number($('cp-scale').value) / 100; layout(); });
    $('cp-color').addEventListener('change', () => { st.color = $('cp-color').value; fetchChip(); });
    $('cp-veil').addEventListener('change', () => { st.veil = $('cp-veil').checked; applyVeilPreview(); });
    $('cp-ok').addEventListener('click', confirm);

    // Arrastre con ratón o dedo
    const chip = $('cp-chip');
    const stage = $('cp-stage');
    let dragging = false;
    chip.addEventListener('pointerdown', (e) => { dragging = true; chip.setPointerCapture(e.pointerId); chip.style.cursor = 'grabbing'; e.preventDefault(); });
    chip.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = stage.getBoundingClientRect();
      st.x = (e.clientX - r.left) / r.width;
      st.y = (e.clientY - r.top) / r.height;
      layout();
    });
    const end = () => { if (!dragging) return; dragging = false; chip.style.cursor = 'grab'; if (st.color === 'auto') fetchChip(); };
    chip.addEventListener('pointerup', end);
    chip.addEventListener('pointercancel', end);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay && overlay.style.display === 'flex') close(); });
  }

  function $q(id) { return overlay.querySelector('#' + id); }

  function clampPos() {
    const hw = (st.wRel * st.scale) / 2;
    const hh = (st.hRel * st.scale) / 2;
    st.x = Math.min(Math.max(st.x, hw), 1 - hw);
    st.y = Math.min(Math.max(st.y, hh), 1 - hh);
  }

  function layout() {
    if (!st || !st.wRel) return;
    clampPos();
    const chip = $q('cp-chip');
    chip.style.display = 'block';
    chip.style.left = (st.x * 100) + '%';
    chip.style.top = (st.y * 100) + '%';
    chip.style.width = (st.wRel * st.scale * 100) + '%';
    applyVeilPreview();
  }

  function applyVeilPreview() {
    const chip = $q('cp-chip');
    if (!st || !st.veil) { chip.style.boxShadow = 'none'; chip.style.background = 'none'; return; }
    const v = st.textColor === '#F6EEDF' ? '0,0,0' : '255,255,255';
    chip.style.background = 'rgba(' + v + ',.28)';
    chip.style.boxShadow = '0 0 18px 10px rgba(' + v + ',.28)';
    chip.style.borderRadius = '10px';
  }

  async function fetchChip() {
    const status = $q('cp-status');
    status.textContent = 'Preparando texto…';
    try {
      const res = await fetch('/api/media/stamp-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: st.imageUrl, accountName: st.accountName, fields: st.fields,
          placement: { chip: true, x: st.x, y: st.y, color: st.color }
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo preparar el texto');
      const d = json.data;
      st.wRel = d.wRel; st.hRel = d.hRel; st.textColor = d.textColor;
      $q('cp-chip-img').src = d.chip;
      status.textContent = (d.lines || []).join(' · ');
      layout();
    } catch (err) {
      status.textContent = 'Error: ' + err.message;
    }
  }

  function close() { if (overlay) overlay.style.display = 'none'; }

  function confirm() {
    if (!st || !st.wRel) return;
    const cb = st.onConfirm;
    const placement = { x: st.x, y: st.y, scale: st.scale, color: st.color, veil: st.veil };
    close();
    if (typeof cb === 'function') cb(placement);
  }

  window.openContactPlacer = function ({ imageUrl, accountName, fields, onConfirm }) {
    if (!overlay) buildModal();
    st = { imageUrl, accountName, fields, onConfirm, x: 0.5, y: 0.9, scale: 1, color: 'auto', veil: true, wRel: 0, hRel: 0, textColor: '#F6EEDF' };
    $q('cp-scale').value = '100';
    $q('cp-color').value = 'auto';
    $q('cp-veil').checked = true;
    $q('cp-chip').style.display = 'none';
    $q('cp-img').src = imageUrl;
    overlay.style.display = 'flex';
    fetchChip();
  };
})();
