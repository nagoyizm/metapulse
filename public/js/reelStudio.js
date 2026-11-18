// =============================================================================
// MetaPulse - Estudio de Reels 2.0
// Clips grabados -> Encuadre 9:16 interactivo -> Transiciones dinámicas -> Textos -> Música -> Render
// =============================================================================
(function () {
  'use strict';

  const S = {
    step: 1,
    brand: '',
    template: 'review',
    customScript: '',
    goal: '',
    targetSeconds: 10,
    clips: [],          // { url, kind, description, name, duration }
    scenes: [],         // { clip, url, kind, start, length, fitMode, zoom, panX, panY, transition }
    textOverlays: [],   // { id, text, start, end, pos, textStyle, font, effect }
    activeSceneIdx: 0,
    activeOverlayIdx: 0,
    voiceover: '',
    caption: '',
    voices: [],
    voice: 'Sulafat',
    voiceUrl: '',
    voiceDur: 0,
    music: null,        // { url, title, artist }
    musicQuery: '',
    resultUrl: '',
    busy: false
  };

  let audioEl = null;
  let isDraggingMedia = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragInitialPanX = 0.5;
  let dragInitialPanY = 0.5;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'info') => { if (typeof showToast === 'function') showToast(m, t); };

  const FONTS = [
    { id: 'archivo', label: 'Archivo Black (Viral Hormozi / Máximo Impacto)' },
    { id: 'bangers', label: 'Bangers (Estilo Cómic / MrBeast)' },
    { id: 'titan', label: 'Titan One (Gruesa y Curva / Comida & Snacks)' },
    { id: 'bebas', label: 'Bebas Neue (Titular / Impacto Viral Clásico)' },
    { id: 'anton', label: 'Anton (Impacto Alto / Gruesa)' },
    { id: 'righteous', label: 'Righteous (Retro-Moderna Punchy)' },
    { id: 'syne', label: 'Syne (Vanguardista / Estética y Lujo)' },
    { id: 'montserrat', label: 'Montserrat Bold (Limpia / Moderna)' },
    { id: 'poppins', label: 'Poppins Bold (Geométrica / Amigable)' },
    { id: 'oswald', label: 'Oswald Bold (Condensada / Dinámica)' },
    { id: 'playfair', label: 'Playfair Display (Elegante / Editorial)' },
    { id: 'cinzel', label: 'Cinzel Bold (Clásica / Premium)' },
    { id: 'caveat', label: 'Caveat (Manuscrita / Orgánica)' },
    { id: 'lato', label: 'Lato Bold (Sólida / Neutra)' }
  ];

  const TEXT_STYLES = [
    { id: 'yellow', label: 'Cápsula Amarilla (Viral TikTok)' },
    { id: 'pill', label: 'Cápsula Oscura (Elegante)' },
    { id: 'impact', label: 'Borde de Impacto (Hormozi)' },
    { id: 'neon', label: 'Resplandor Neón (Llamativo)' },
    { id: 'minimal', label: 'Limpio con Sombra' }
  ];

  const TEXT_EFFECTS = [
    { id: 'pop', label: 'Punch / Pop-in (Impacto viral)' },
    { id: 'fade', label: 'Desvanecido Suave (Fade in/out)' },
    { id: 'slide', label: 'Deslizamiento desde Abajo (Slide up)' },
    { id: 'bounce', label: 'Rebote Elástico (Bounce)' },
    { id: 'none', label: 'Corte Directo (Sin animación)' }
  ];

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
    if (busy) {
      b.dataset.label = b.textContent;
      b.textContent = label;
      b.disabled = true;
    } else {
      b.textContent = b.dataset.label || b.textContent;
      b.disabled = false;
    }
  }

  // ── Persistencia de Sesión / Borrador Local (para soportar F5 sin pérdidas) ──
  const STORAGE_KEY = 'metapulse_reel_studio_draft';

  function saveState() {
    try {
      const data = {
        step: S.step,
        template: S.template,
        customScript: $('reel-custom-script')?.value || S.customScript,
        goal: $('reel-goal')?.value || S.goal,
        targetSeconds: Number($('reel-target')?.value) || S.targetSeconds,
        clips: S.clips,
        scenes: S.scenes,
        textOverlays: S.textOverlays,
        activeSceneIdx: S.activeSceneIdx,
        activeOverlayIdx: S.activeOverlayIdx,
        voiceover: $('reel-voiceover')?.value || S.voiceover,
        caption: $('reel-caption')?.value || S.caption,
        voice: S.voice,
        music: S.music,
        resultUrl: S.resultUrl,
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data) return;

      if (data.template) S.template = data.template;
      if (data.customScript) {
        S.customScript = data.customScript;
        const cs = $('reel-custom-script');
        if (cs) cs.value = data.customScript;
      }
      if (data.goal) {
        S.goal = data.goal;
        const g = $('reel-goal');
        if (g) g.value = data.goal;
      }
      if (data.targetSeconds) {
        S.targetSeconds = data.targetSeconds;
        const tg = $('reel-target');
        if (tg) tg.value = data.targetSeconds;
      }
      if (Array.isArray(data.clips) && data.clips.length) {
        S.clips = data.clips;
      }
      if (Array.isArray(data.scenes) && data.scenes.length) {
        S.scenes = data.scenes;
      }
      if (Array.isArray(data.textOverlays) && data.textOverlays.length) {
        S.textOverlays = data.textOverlays;
      }
      if (data.voiceover) {
        S.voiceover = data.voiceover;
        const vo = $('reel-voiceover');
        if (vo) vo.value = data.voiceover;
      }
      if (data.caption) {
        S.caption = data.caption;
        const cp = $('reel-caption');
        if (cp) cp.value = data.caption;
      }
      if (data.voice) S.voice = data.voice;
      if (data.music) S.music = data.music;
      if (data.resultUrl) S.resultUrl = data.resultUrl;
      if (data.activeSceneIdx != null) S.activeSceneIdx = data.activeSceneIdx;
      if (data.activeOverlayIdx != null) S.activeOverlayIdx = data.activeOverlayIdx;

      // Resaltar plantilla en UI
      document.querySelectorAll('.reel-template-card').forEach((card) => {
        card.classList.toggle('active', card.dataset.id === S.template);
      });
      const customBox = $('reel-custom-script-box');
      if (customBox) customBox.style.display = S.template === 'custom' ? 'block' : 'none';

      renderClips();
      renderScenes();
      renderTextOverlays();
      renderMusicSel();

      if (S.resultUrl) {
        const finalPlayer = $('reel-final-player');
        if (finalPlayer) {
          finalPlayer.src = S.resultUrl;
          finalPlayer.style.display = 'block';
        }
        const actionsBox = $('reel-result-actions-box');
        if (actionsBox) actionsBox.style.display = 'block';
        const dlBtn = $('btn-reel-download');
        if (dlBtn) {
          dlBtn.href = S.resultUrl;
          dlBtn.download = `reel_${Date.now()}.mp4`;
        }
      }

      if (data.step && data.step > 1) {
        goToStep(data.step);
      } else if (S.clips.length > 0) {
        previewClip(0);
      }
    } catch (_) {}
  }

  function clearState(confirmUser = true) {
    if (confirmUser && (S.clips.length || S.scenes.length || S.textOverlays.length)) {
      if (!confirm('¿Deseas reiniciar el Estudio de Reels? Se limpiarán los clips, tomas y textos cargados.')) {
        return;
      }
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    S.step = 1;
    S.clips = [];
    S.scenes = [];
    S.textOverlays = [];
    S.activeSceneIdx = 0;
    S.activeOverlayIdx = 0;
    S.voiceover = '';
    S.caption = '';
    S.music = null;
    S.resultUrl = '';
    if ($('reel-custom-script')) $('reel-custom-script').value = '';
    if ($('reel-goal')) $('reel-goal').value = '';
    if ($('reel-voiceover')) $('reel-voiceover').value = '';
    if ($('reel-caption')) $('reel-caption').value = '';
    const finalPlayer = $('reel-final-player');
    if (finalPlayer) {
      finalPlayer.pause();
      finalPlayer.src = '';
      finalPlayer.style.display = 'none';
    }
    const actionsBox = $('reel-result-actions-box');
    if (actionsBox) actionsBox.style.display = 'none';
    resetViewportPlaceholder();
    renderClips();
    renderScenes();
    renderTextOverlays();
    renderMusicSel();
    goToStep(1);
    toast('Estudio de Reels reiniciado.', 'info');
  }

  // ── Navegación de Pasos ──
  function goToStep(n) {
    S.step = n;
    document.querySelectorAll('.reel-step-btn').forEach((b) => {
      b.classList.toggle('active', +b.dataset.step === n);
    });
    document.querySelectorAll('.reel-step-pane').forEach((p) => {
      p.classList.remove('active');
    });
    const pane = $(`reel-pane-${n}`);
    if (pane) pane.classList.add('active');

    if (n === 2 && S.clips.length > 0 && !S.scenes.length) {
      previewClip(0);
    } else if (n === 3 && S.scenes.length > 0) {
      selectSceneForFrame(S.activeSceneIdx >= 0 && S.activeSceneIdx < S.scenes.length ? S.activeSceneIdx : 0);
    } else if (n === 4) {
      renderTextOverlays();
      if (S.textOverlays.length > 0) {
        previewTextOverlay(S.activeOverlayIdx >= 0 && S.activeOverlayIdx < S.textOverlays.length ? S.activeOverlayIdx : 0);
      }
    } else if (n === 5) {
      renderMusicSel();
    }
    saveState();
  }

  // ── Paso 1: Plantillas y Fórmulas ──
  const DEFAULT_TEMPLATES = [
    {
      id: 'review',
      title: 'Reseña de Producto / Prueba',
      desc: 'Gancho visual (0-2s) ➔ Textura o detalle (2-6s) ➔ Veredicto y ubicación en tienda'
    },
    {
      id: 'top3',
      title: 'Top 3 / Lista Rápida',
      desc: 'Gancho de lista (0-2s) ➔ Item 1 ➔ Item 2 ➔ Item 3 ➔ Llamado a guardar/compartir'
    },
    {
      id: 'atmosphere',
      title: 'Atmósfera y Recorrido',
      desc: 'Detalle sensorial (0-2s) ➔ Paisaje amplio (2-7s) ➔ Momento acogedor ➔ Reservas WhatsApp'
    },
    {
      id: 'promo',
      title: 'Novedad o Temporada',
      desc: 'Titular directo ➔ Demostración de lo que llegó o queda ➔ Dónde conseguirlo'
    },
    {
      id: 'custom',
      title: 'Guion Personalizado',
      desc: 'Escribe o pega tu propio guion o sugerencia y la IA distribuirá las tomas'
    }
  ];

  function renderTemplates(templates) {
    const grid = $('reel-template-grid');
    if (!grid) return;
    const list = Array.isArray(templates) && templates.length ? templates : DEFAULT_TEMPLATES;
    grid.innerHTML = list.map((t) => `
      <div class="reel-template-card ${t.id === S.template ? 'active' : ''}" data-id="${t.id}">
        <div class="reel-template-title">${esc(t.title)}</div>
        <div class="reel-template-desc">${esc(t.desc)}</div>
      </div>
    `).join('');

    grid.querySelectorAll('.reel-template-card').forEach((card) => {
      card.addEventListener('click', () => {
        S.template = card.dataset.id;
        grid.querySelectorAll('.reel-template-card').forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        const customBox = $('reel-custom-script-box');
        if (customBox) customBox.style.display = S.template === 'custom' ? 'block' : 'none';
        saveState();
      });
    });
  }

  // ── Paso 2: Subida y Clips ──
  function renderClips() {
    const list = $('reel-clips-list');
    const drop = $('reel-dropzone');
    const badge = $('reel-badge-clips-count');
    if (!list) return;

    if (badge) {
      badge.textContent = S.clips.length;
      badge.style.display = S.clips.length ? 'inline-block' : 'none';
    }

    if (!S.clips.length) {
      if (drop) {
        drop.style.display = 'block';
        drop.classList.remove('reel-dropzone-compact');
        drop.innerHTML = `
          <div style="font-size:1.5rem; margin-bottom:6px;">📹</div>
          <div style="font-weight:600; font-size:0.86rem; color:var(--text-primary); margin-bottom:2px;">Haz clic aquí o arrastra tus videos grabados</div>
          <small class="text-muted">Formatos MP4, MOV o fotos. Puedes subir videos en horizontal o vertical.</small>
        `;
      }
      list.innerHTML = '';
      return;
    }

    if (drop) {
      drop.style.display = 'block';
      drop.classList.add('reel-dropzone-compact');
      drop.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <span style="font-size:1.1rem;">➕</span>
          <span style="font-weight:600; font-size:0.82rem; color:var(--text-primary);">Arrastra más videos o fotos aquí o haz clic para agregar</span>
        </div>
      `;
    }

    list.innerHTML = S.clips.map((c, i) => `
      <div class="reel-clip-card" data-i="${i}">
        <div class="reel-clip-thumb-box">
          ${c.kind === 'imagen'
            ? `<img src="${esc(c.url)}" alt="">`
            : `<video src="${esc(c.url)}#t=0.5" muted preload="metadata" playsinline></video>`}
          ${c.duration ? `<span class="reel-clip-dur-badge">${c.duration.toFixed(1)}s</span>` : ''}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${i + 1}. ${esc(c.name || 'Clip')}
            </strong>
            <button type="button" class="btn btn-secondary btn-xs reel-del-clip" title="Eliminar clip">✕</button>
          </div>
          <textarea class="form-control form-control-sm reel-clip-desc-input" rows="2" style="font-size:0.75rem;" placeholder="¿Qué ocurre en este clip? (ej: cámara lenta abriendo el helado, se ve el relleno cremoso)">${esc(c.description)}</textarea>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.reel-clip-card').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('click', (e) => {
        if (e.target.closest('textarea') || e.target.closest('button')) return;
        previewClip(i);
      });
      el.querySelector('.reel-clip-thumb-box')?.addEventListener('click', () => {
        previewClip(i);
      });
      el.querySelector('.reel-clip-desc-input')?.addEventListener('input', (e) => {
        S.clips[i].description = e.target.value;
        saveState();
      });
      el.querySelector('.reel-del-clip')?.addEventListener('click', () => {
        S.clips.splice(i, 1);
        renderClips();
        if (S.clips.length) {
          previewClip(Math.min(i, S.clips.length - 1));
        } else {
          resetViewportPlaceholder();
        }
        saveState();
      });
    });
  }

  function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const progressBox = $('reel-upload-progress-box');
    const progressBar = $('reel-upload-bar');
    const progressPct = $('reel-upload-pct');
    const progressStatus = $('reel-upload-status');
    const progressDetail = $('reel-upload-detail');

    if (progressBox) progressBox.style.display = 'block';
    if (progressBar) {
      progressBar.style.width = '0%';
      progressBar.style.background = 'var(--primary)';
    }
    if (progressPct) progressPct.textContent = '0%';
    if (progressStatus) progressStatus.textContent = `Subiendo ${files.length} archivo(s)...`;
    if (progressDetail) progressDetail.textContent = 'Iniciando subida...';

    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));

    const acc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    if (acc?.pageId) fd.append('account_id', acc.pageId);
    if (acc?.pageName) fd.append('account_name', acc.pageName);

    const startTime = Date.now();
    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload');

      xhr.upload.onprogress = (e) => {
        const total = e.lengthComputable ? e.total : (totalBytes || 1);
        const loaded = e.loaded;
        const pct = Math.min(99, Math.round((loaded / total) * 100));

        if (progressBar) progressBar.style.width = pct + '%';
        if (progressPct) progressPct.textContent = pct + '%';

        const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (total / (1024 * 1024)).toFixed(1);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speedMBs = elapsedSec > 0.4 ? ((loaded / (1024 * 1024)) / elapsedSec).toFixed(1) : '...';

        if (progressStatus) progressStatus.textContent = `Subiendo ${files.length} archivo(s) (${pct}%)...`;
        if (progressDetail) progressDetail.textContent = `${loadedMB} MB de ${totalMB} MB · ${speedMBs} MB/s`;
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            if (!json.success) throw new Error(json.error || 'No se pudo subir');

            if (progressBar) progressBar.style.width = '100%';
            if (progressPct) progressPct.textContent = '100%';
            if (progressStatus) progressStatus.textContent = '¡Archivos subidos con éxito!';
            if (progressDetail) progressDetail.textContent = `${json.data.length} archivo(s) procesados.`;

            setTimeout(() => {
              if (progressBox) progressBox.style.display = 'none';
            }, 2000);

            for (const m of json.data) {
              const isImg = (m.mime_type || '').startsWith('image/');
              const clipObj = {
                url: m.url,
                kind: isImg ? 'imagen' : 'video',
                description: '',
                name: m.original_name,
                duration: null
              };
              S.clips.push(clipObj);

              if (!isImg) {
                const v = document.createElement('video');
                v.src = m.url;
                v.preload = 'metadata';
                v.onloadedmetadata = () => {
                  clipObj.duration = Math.round(v.duration * 10) / 10;
                  renderClips();
                  saveState();
                };
              }
            }

            renderClips();
            if (S.clips.length > 0) {
              previewClip(S.clips.length - 1);
            }
            saveState();
            toast(`${json.data.length} clip(s) subidos con éxito. Descríbelos y arma el reel.`, 'success');
            resolve(json.data);
          } catch (err) {
            handleError(err.message);
            reject(err);
          }
        } else {
          const err = new Error(`Error en el servidor (${xhr.status})`);
          handleError(err.message);
          reject(err);
        }
      };

      xhr.onerror = () => {
        const err = new Error('Error de conexión al subir');
        handleError(err.message);
        reject(err);
      };

      function handleError(msg) {
        if (progressStatus) progressStatus.textContent = 'Error al subir';
        if (progressDetail) progressDetail.textContent = msg;
        if (progressBar) progressBar.style.background = 'var(--danger, #ef4444)';
        toast('Error al subir: ' + msg, 'error');
        setTimeout(() => {
          if (progressBox) progressBox.style.display = 'none';
          if (progressBar) progressBar.style.background = 'var(--primary)';
        }, 5000);
      }

      xhr.send(fd);
    });
  }

  // ── Planificación IA ──
  async function planWithAI() {
    if (!S.clips.length) return toast('Sube al menos un clip o foto primero.', 'warning');
    setBusy('btn-reel-plan', true, 'Armando reel con IA...');

    try {
      const customScript = S.template === 'custom' ? ($('reel-custom-script')?.value.trim() || '') : '';
      const data = await api('/reel/plan', {
        brand: brandName(),
        clips: S.clips.map((c) => ({ url: c.url, description: c.description })),
        goal: $('reel-goal')?.value || '',
        target_seconds: Number($('reel-target')?.value) || 10,
        template: S.template,
        custom_script: customScript
      });

      S.scenes = (data.scenes || []).map((sc) => ({
        clip: sc.clip != null ? sc.clip : 0,
        url: sc.url,
        kind: sc.kind,
        start: Number(sc.start) || 0,
        length: Number(sc.length) || 2.5,
        fitMode: sc.fitMode || 'crop',
        zoom: sc.zoom || 1.0,
        panX: sc.panX != null ? sc.panX : 0.5,
        panY: sc.panY != null ? sc.panY : 0.5,
        transition: sc.transition || 'zoomin'
      }));

      S.textOverlays = (data.textOverlays || []).map((t, idx) => ({
        id: t.id || `txt_${idx + 1}`,
        text: t.text || '',
        start: Number(t.start) || 0,
        end: Number(t.end) || 3.0,
        pos: t.pos || (idx === 0 ? 'top' : idx === 1 ? 'center' : 'bottom'),
        textStyle: t.textStyle || (idx === 0 ? 'yellow' : 'pill'),
        font: t.font || 'archivo',
        effect: t.effect || 'pop'
      }));

      S.voiceover = data.voiceover || '';
      S.caption = data.caption || '';
      S.musicQuery = data.musicQuery || '';
      S.voiceUrl = '';
      S.resultUrl = '';

      renderScenes();
      renderTextOverlays();
      if ($('reel-music-q') && S.musicQuery) $('reel-music-q').value = S.musicQuery;
      if ($('reel-voiceover')) $('reel-voiceover').value = S.voiceover;
      if ($('reel-caption')) $('reel-caption').value = S.caption;

      toast('¡Reel armado con éxito! Revisa las tomas de video y luego ajusta tus textos.', 'success');
      goToStep(3);
    } catch (err) {
      toast('No se pudo armar el reel: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-plan', false);
    }
  }

  function createManualScenes() {
    if (!S.clips.length) return toast('Sube clips primero en el Paso 2.', 'warning');
    S.scenes = S.clips.map((c, i) => ({
      clip: i,
      url: c.url,
      kind: c.kind,
      start: 0,
      length: c.duration ? Math.min(c.duration, 4) : 3,
      fitMode: 'crop',
      zoom: 1.0,
      panX: 0.5,
      panY: 0.5,
      transition: i === 0 ? 'none' : 'zoomin'
    }));

    if (!S.textOverlays.length) {
      const tot = totalSeconds();
      S.textOverlays = [
        {
          id: 'txt_1',
          text: 'MIRA ESTO',
          start: 0,
          end: Math.min(2.8, tot > 1 ? tot : 2.8),
          pos: 'top',
          textStyle: 'yellow',
          font: 'archivo',
          effect: 'pop'
        }
      ];
    }

    renderScenes();
    renderTextOverlays();
    goToStep(3);
    toast(`${S.scenes.length} toma(s) creadas (1 por cada clip subido).`, 'info');
  }

  // ── Paso 3: Pista de Video (Cortes, Encuadre 9:16 y Transiciones) ──
  function totalSeconds() {
    return S.scenes.reduce((acc, s) => acc + (Number(s.length) || 0), 0);
  }

  function renderScenes() {
    const list = $('reel-scenes-list');
    const badge = $('reel-badge-scenes-count');
    const totalEl = $('reel-total-dur');
    if (!list) return;

    if (badge) {
      badge.textContent = S.scenes.length;
      badge.style.display = S.scenes.length ? 'inline-block' : 'none';
    }
    if (totalEl) {
      totalEl.textContent = `${totalSeconds().toFixed(1)} s`;
    }

    if (!S.scenes.length) {
      list.innerHTML = '<div class="reel-empty">No hay tomas de video armadas aún.</div>';
      return;
    }

    const clipOpts = (sel) => S.clips.map((c, i) =>
      `<option value="${i}" ${i === sel ? 'selected' : ''}>Clip ${i + 1}: ${esc((c.description || c.name || '').slice(0, 30))}</option>`
    ).join('');

    const transOpts = (sel) => [
      { id: 'zoomin', label: 'Zoom Dinámico (Punch)' },
      { id: 'slideleft', label: 'Deslizamiento Rápido (Slide)' },
      { id: 'fadewhite', label: 'Flash Blanco de Impacto' },
      { id: 'smoothleft', label: 'Paneo Suave' },
      { id: 'dissolve', label: 'Disolución Clásica' },
      { id: 'none', label: 'Corte Directo (Sin transición)' }
    ].map((t) => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.label}</option>`).join('');

    list.innerHTML = S.scenes.map((s, i) => `
      <div class="reel-scene-card ${i === S.activeSceneIdx ? 'selected-for-frame' : ''}" data-i="${i}">
        <div class="reel-scene-header">
          <div>
            <strong style="font-size:0.84rem;">Toma ${i + 1}</strong>
            <span class="badge" style="font-size:0.68rem; margin-left:6px; background:var(--bg-surface-subtle);">${s.length}s</span>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <button type="button" class="btn btn-secondary btn-xs reel-act-frame" style="font-weight:600;">Encuadrar en 9:16</button>
            <button type="button" class="btn btn-secondary btn-xs reel-act-up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn btn-secondary btn-xs reel-act-down" ${i === S.scenes.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn btn-secondary btn-xs reel-act-del" title="Eliminar toma">✕</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Clip de origen</label>
            <select class="form-control form-control-sm reel-scene-clip-sel">${clipOpts(s.clip)}</select>
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Inicio en video (s)</label>
            <input type="number" class="form-control form-control-sm reel-scene-start" step="0.1" min="0" value="${s.start}" ${s.kind === 'imagen' ? 'disabled' : ''}>
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Duración toma (s)</label>
            <input type="number" class="form-control form-control-sm reel-scene-length" step="0.1" min="0.8" max="8" value="${s.length}">
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Transición siguiente</label>
            <select class="form-control form-control-sm reel-scene-trans">${transOpts(s.transition)}</select>
          </div>
        </div>
      </div>
    `).join('');

    // Eventos de inputs de toma
    list.querySelectorAll('.reel-scene-card').forEach((card) => {
      const i = +card.dataset.i;

      card.querySelector('.reel-act-frame')?.addEventListener('click', () => {
        selectSceneForFrame(i);
      });
      card.querySelector('.reel-scene-clip-sel')?.addEventListener('change', (e) => {
        const clipIdx = +e.target.value;
        const c = S.clips[clipIdx];
        if (c) {
          S.scenes[i].clip = clipIdx;
          S.scenes[i].url = c.url;
          S.scenes[i].kind = c.kind;
          S.scenes[i].start = 0;
          renderScenes();
          selectSceneForFrame(i);
          saveState();
        }
      });
      card.querySelector('.reel-scene-start')?.addEventListener('change', (e) => {
        S.scenes[i].start = Number(e.target.value) || 0;
        selectSceneForFrame(i);
        saveState();
      });
      card.querySelector('.reel-scene-length')?.addEventListener('change', (e) => {
        S.scenes[i].length = Math.min(Math.max(Number(e.target.value) || 2.5, 0.8), 8);
        if (totalEl) totalEl.textContent = `${totalSeconds().toFixed(1)} s`;
        const textTot = $('reel-text-total-dur');
        if (textTot) textTot.textContent = `${totalSeconds().toFixed(1)} s`;
        saveState();
      });
      card.querySelector('.reel-scene-trans')?.addEventListener('change', (e) => {
        S.scenes[i].transition = e.target.value;
        saveState();
      });
      card.querySelector('.reel-act-up')?.addEventListener('click', () => {
        if (i > 0) {
          [S.scenes[i], S.scenes[i - 1]] = [S.scenes[i - 1], S.scenes[i]];
          renderScenes();
          selectSceneForFrame(i - 1);
          saveState();
        }
      });
      card.querySelector('.reel-act-down')?.addEventListener('click', () => {
        if (i < S.scenes.length - 1) {
          [S.scenes[i], S.scenes[i + 1]] = [S.scenes[i + 1], S.scenes[i]];
          renderScenes();
          selectSceneForFrame(i + 1);
          saveState();
        }
      });
      card.querySelector('.reel-act-del')?.addEventListener('click', () => {
        S.scenes.splice(i, 1);
        renderScenes();
        if (S.scenes.length) selectSceneForFrame(Math.min(i, S.scenes.length - 1));
        saveState();
      });
    });

    if (S.scenes.length > 0 && (S.activeSceneIdx < 0 || S.activeSceneIdx >= S.scenes.length)) {
      selectSceneForFrame(0);
    }
  }

  function addScene() {
    if (!S.clips.length) return toast('Sube clips primero en el Paso 2.', 'warning');
    const clipIdx = S.scenes.length ? S.scenes[S.scenes.length - 1].clip : 0;
    const c = S.clips[clipIdx];
    S.scenes.push({
      clip: clipIdx,
      url: c.url,
      kind: c.kind,
      start: 0,
      length: 2.5,
      fitMode: 'crop',
      zoom: 1.0,
      panX: 0.5,
      panY: 0.5,
      transition: 'zoomin'
    });
    renderScenes();
    selectSceneForFrame(S.scenes.length - 1);
    saveState();
  }

  // ── Paso 4: Capa de Textos y Efectos Virales (Overlays Desacoplados) ──
  function renderTextOverlays() {
    const list = $('reel-texts-list');
    const badge = $('reel-badge-texts-count');
    const totalEl = $('reel-text-total-dur');
    const summaryEl = $('reel-texts-summary');
    if (!list) return;

    const tot = totalSeconds();
    if (badge) {
      badge.textContent = S.textOverlays.length;
      badge.style.display = S.textOverlays.length ? 'inline-block' : 'none';
    }
    if (totalEl) {
      totalEl.textContent = `${tot.toFixed(1)} s`;
    }
    if (summaryEl) {
      if (!S.textOverlays.length) {
        summaryEl.textContent = '0 textos configurados';
      } else {
        const minT = Math.min(...S.textOverlays.map((t) => Number(t.start) || 0));
        const maxT = Math.max(...S.textOverlays.map((t) => Number(t.end) || 0));
        summaryEl.textContent = `${S.textOverlays.length} texto(s) · Cobertura: ${minT.toFixed(1)}s a ${maxT.toFixed(1)}s (Total video: ${tot.toFixed(1)}s)`;
      }
    }

    if (!S.textOverlays.length) {
      list.innerHTML = `
        <div class="reel-empty" style="padding:24px; text-align:center;">
          <div style="font-size:1.4rem; margin-bottom:6px;">✍️</div>
          <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">No hay textos configurados aún</div>
          <small class="text-muted" style="display:block; margin-bottom:12px;">Los textos flotan sobre el video y capturan la atención en los primeros segundos.</small>
          <div style="display:flex; justify-content:center; gap:8px;">
            <button type="button" class="btn btn-secondary btn-xs" id="btn-reel-empty-add-text">+ Agregar primer texto</button>
            <button type="button" class="btn btn-primary btn-xs" id="btn-reel-empty-suggest-texts">Sugerir textos con IA</button>
          </div>
        </div>
      `;
      $('btn-reel-empty-add-text')?.addEventListener('click', addTextOverlay);
      $('btn-reel-empty-suggest-texts')?.addEventListener('click', suggestTextsWithAI);
      return;
    }

    const fontOpts = (sel) => FONTS.map((f) =>
      `<option value="${f.id}" ${f.id === (sel || 'archivo') ? 'selected' : ''}>${esc(f.label)}</option>`
    ).join('');

    const styleOpts = (sel) => TEXT_STYLES.map((st) =>
      `<option value="${st.id}" ${st.id === (sel || 'yellow') ? 'selected' : ''}>${esc(st.label)}</option>`
    ).join('');

    const effectOpts = (sel) => TEXT_EFFECTS.map((ef) =>
      `<option value="${ef.id}" ${ef.id === (sel || 'pop') ? 'selected' : ''}>${esc(ef.label)}</option>`
    ).join('');

    list.innerHTML = S.textOverlays.map((t, i) => `
      <div class="reel-text-card ${i === S.activeOverlayIdx ? 'selected-for-frame' : ''}" data-i="${i}">
        <div class="reel-text-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:0.84rem;">Texto ${i + 1}</strong>
            <span class="reel-timing-badge">${(Number(t.start) || 0).toFixed(1)}s a ${(Number(t.end) || 0).toFixed(1)}s (${((Number(t.end) || 0) - (Number(t.start) || 0)).toFixed(1)}s)</span>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <button type="button" class="btn btn-secondary btn-xs reel-btn-preview-text" style="font-weight:600;">Previsualizar</button>
            <button type="button" class="btn btn-secondary btn-xs reel-del-text" title="Eliminar texto">✕</button>
          </div>
        </div>

        <div style="margin-top:8px;">
          <label style="font-size:0.72rem; font-weight:600;">Texto en pantalla (2 a 6 palabras, directo e impactante)</label>
          <input type="text" class="form-control form-control-sm reel-overlay-text" maxlength="70" value="${esc(t.text)}" placeholder="Ej: PRUÉBALO BIEN FRÍO">
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:8px; margin-top:8px;">
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Aparece al seg</label>
            <input type="number" class="form-control form-control-sm reel-overlay-start" step="0.1" min="0" max="${Math.max(0, tot)}" value="${t.start}">
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Desaparece al seg</label>
            <input type="number" class="form-control form-control-sm reel-overlay-end" step="0.1" min="0.4" max="${Math.max(0, tot)}" value="${t.end}">
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Posición en pantalla</label>
            <select class="form-control form-control-sm reel-overlay-pos">
              <option value="top" ${t.pos === 'top' ? 'selected' : ''}>Arriba (Titular)</option>
              <option value="center" ${t.pos === 'center' ? 'selected' : ''}>Centro (Foco)</option>
              <option value="bottom" ${t.pos === 'bottom' ? 'selected' : ''}>Abajo (Subtítulo)</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-top:8px;">
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Tipografía Viral</label>
            <select class="form-control form-control-sm reel-overlay-font">
              ${fontOpts(t.font)}
            </select>
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Estilo Visual</label>
            <select class="form-control form-control-sm reel-overlay-style">
              ${styleOpts(t.textStyle)}
            </select>
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Efecto de Animación</label>
            <select class="form-control form-control-sm reel-overlay-effect">
              ${effectOpts(t.effect)}
            </select>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:8px; padding-top:6px; border-top:1px dashed var(--border-subtle);">
          <button type="button" class="btn btn-ghost btn-xs reel-apply-text-style-all" style="font-size:0.72rem; border:1px solid var(--border-subtle);">
            Aplicar esta fuente y estilo a todos los textos
          </button>
        </div>
      </div>
    `).join('');

    // Eventos de inputs de texto
    list.querySelectorAll('.reel-text-card').forEach((card) => {
      const i = +card.dataset.i;
      const ov = S.textOverlays[i];
      if (!ov) return;

      card.querySelector('.reel-btn-preview-text')?.addEventListener('click', () => {
        previewTextOverlay(i);
      });

      card.querySelector('.reel-overlay-text')?.addEventListener('input', (e) => {
        ov.text = e.target.value;
        if (i === S.activeOverlayIdx) renderLiveOverlay(ov, false);
        saveState();
      });

      card.querySelector('.reel-overlay-start')?.addEventListener('change', (e) => {
        ov.start = Math.max(0, Number(e.target.value) || 0);
        renderTextOverlays();
        previewTextOverlay(i);
        saveState();
      });

      card.querySelector('.reel-overlay-end')?.addEventListener('change', (e) => {
        ov.end = Math.max(ov.start + 0.4, Number(e.target.value) || (ov.start + 2.5));
        renderTextOverlays();
        previewTextOverlay(i);
        saveState();
      });

      card.querySelector('.reel-overlay-pos')?.addEventListener('change', (e) => {
        ov.pos = e.target.value;
        if (i === S.activeOverlayIdx) renderLiveOverlay(ov, false);
        saveState();
      });

      card.querySelector('.reel-overlay-font')?.addEventListener('change', (e) => {
        ov.font = e.target.value;
        if (i === S.activeOverlayIdx) renderLiveOverlay(ov, true);
        saveState();
      });

      card.querySelector('.reel-overlay-style')?.addEventListener('change', (e) => {
        ov.textStyle = e.target.value;
        if (i === S.activeOverlayIdx) renderLiveOverlay(ov, true);
        saveState();
      });

      card.querySelector('.reel-overlay-effect')?.addEventListener('change', (e) => {
        ov.effect = e.target.value;
        if (i === S.activeOverlayIdx) renderLiveOverlay(ov, true);
        saveState();
      });

      card.querySelector('.reel-apply-text-style-all')?.addEventListener('click', () => {
        const chosenFont = ov.font || 'archivo';
        const chosenStyle = ov.textStyle || 'yellow';
        const chosenEffect = ov.effect || 'pop';
        S.textOverlays.forEach((t) => {
          t.font = chosenFont;
          t.textStyle = chosenStyle;
          t.effect = chosenEffect;
        });
        renderTextOverlays();
        previewTextOverlay(i);
        saveState();
        toast('Tipografía y estilo aplicados a todos los textos.', 'info');
      });

      card.querySelector('.reel-del-text')?.addEventListener('click', () => {
        S.textOverlays.splice(i, 1);
        if (S.activeOverlayIdx >= S.textOverlays.length) {
          S.activeOverlayIdx = Math.max(0, S.textOverlays.length - 1);
        }
        renderTextOverlays();
        if (S.textOverlays.length) previewTextOverlay(S.activeOverlayIdx);
        else renderLiveOverlay(null);
        saveState();
      });
    });
  }

  function addTextOverlay() {
    const tot = totalSeconds() || 10;
    let nextStart = 0;
    if (S.textOverlays.length) {
      const last = S.textOverlays[S.textOverlays.length - 1];
      nextStart = Math.min(Math.max(0, tot - 1), Math.max(0, Number(last.end) || 0));
    }
    const nextEnd = Math.min(tot, nextStart + 2.5);
    const newOv = {
      id: `ov_${Date.now()}`,
      text: 'NUEVO TEXTO',
      start: Math.round(nextStart * 10) / 10,
      end: Math.round(nextEnd * 10) / 10,
      pos: 'center',
      textStyle: S.textOverlays.length ? S.textOverlays[0].textStyle : 'yellow',
      font: S.textOverlays.length ? S.textOverlays[0].font : 'archivo',
      effect: 'pop'
    };
    S.textOverlays.push(newOv);
    S.activeOverlayIdx = S.textOverlays.length - 1;
    renderTextOverlays();
    previewTextOverlay(S.activeOverlayIdx);
    saveState();
  }

  async function suggestTextsWithAI() {
    if (!S.scenes.length) return toast('Crea o define las tomas primero en el Paso 3.', 'warning');
    setBusy('btn-reel-ai-suggest-texts', true, 'Generando textos virales...');
    try {
      const data = await api('/reel/suggest-texts', {
        brand: brandName(),
        scenes: S.scenes,
        clips: S.clips,
        goal: $('reel-goal')?.value || S.goal || '',
        voiceover: $('reel-voiceover')?.value || S.voiceover || ''
      });
      if (Array.isArray(data) && data.length) {
        S.textOverlays = data;
        S.activeOverlayIdx = 0;
        renderTextOverlays();
        previewTextOverlay(0);
        saveState();
        toast('¡Textos virales sugeridos con éxito!', 'success');
      } else {
        toast('No se generaron textos nuevos.', 'info');
      }
    } catch (err) {
      toast('Error al sugerir textos: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-ai-suggest-texts', false);
    }
  }

  function findSceneAtTime(globalSec) {
    let accum = 0;
    for (let i = 0; i < S.scenes.length; i++) {
      const sc = S.scenes[i];
      const len = Number(sc.length) || 0;
      if (globalSec >= accum && globalSec < accum + len) {
        return { sceneIdx: i, scene: sc, offsetInScene: Math.max(0, globalSec - accum) };
      }
      accum += len;
    }
    if (S.scenes.length > 0) {
      const lastIdx = S.scenes.length - 1;
      return { sceneIdx: lastIdx, scene: S.scenes[lastIdx], offsetInScene: 0 };
    }
    return null;
  }

  function renderLiveOverlay(ov, triggerAnim = false) {
    const topEl = $('reel-vp-text-top');
    const centerEl = $('reel-vp-text-center');
    const bottomEl = $('reel-vp-text-bottom');
    if (!topEl || !centerEl || !bottomEl) return;

    topEl.innerHTML = '';
    centerEl.innerHTML = '';
    bottomEl.innerHTML = '';

    if (!ov || !ov.text || !ov.text.trim()) return;

    const fontClass = `reel-font-${ov.font || 'archivo'}`;
    const effectClass = ov.effect && ov.effect !== 'none' ? `effect-${ov.effect}` : '';
    const badge = document.createElement('div');
    badge.className = `reel-live-caption ${ov.textStyle || 'yellow'} ${fontClass} ${effectClass}`;
    badge.textContent = ov.text.trim().toUpperCase();

    const targetEl = ov.pos === 'top' ? topEl : ov.pos === 'bottom' ? bottomEl : centerEl;
    targetEl.appendChild(badge);

    if (triggerAnim && effectClass) {
      badge.classList.remove(effectClass);
      void badge.offsetWidth;
      badge.classList.add(effectClass);
    }
  }

  function previewTextOverlay(idx) {
    if (idx < 0 || idx >= S.textOverlays.length) return;
    S.activeOverlayIdx = idx;

    document.querySelectorAll('.reel-text-card').forEach((card) => {
      card.classList.toggle('selected-for-frame', +card.dataset.i === idx);
    });

    const ov = S.textOverlays[idx];
    const badge = $('reel-active-scene-badge');
    if (badge) badge.textContent = `Texto ${idx + 1} (${ov.start.toFixed(1)}s)`;

    const found = findSceneAtTime(ov.start);
    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const vpBg = $('reel-vp-bg');
    const placeholder = $('reel-vp-placeholder');
    const finalPlayer = $('reel-final-player');

    if (finalPlayer) finalPlayer.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    if (found && found.scene) {
      const sc = found.scene;
      if (sc.kind === 'imagen') {
        if (vpVideo) {
          vpVideo.pause();
          vpVideo.style.display = 'none';
        }
        if (vpImg) {
          vpImg.src = sc.url;
          vpImg.style.display = 'block';
        }
        updatePlayBtn(false);
      } else {
        if (vpImg) vpImg.style.display = 'none';
        if (vpVideo) {
          const seekTime = (sc.start || 0) + (found.offsetInScene || 0);
          vpVideo.src = sc.url + `#t=${seekTime}`;
          vpVideo.style.display = 'block';
          vpVideo.currentTime = seekTime;
          vpVideo.play().then(() => updatePlayBtn(true)).catch(() => updatePlayBtn(false));
        }
      }
      if (vpBg) vpBg.style.backgroundImage = `url("${sc.url}")`;
      updateLiveMediaTransform(sc);
    }

    renderLiveOverlay(ov, true);
  }

  // ── Mini Pantalla 9:16 y Encuadre Interactivo ──
  function resetViewportPlaceholder() {
    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const vpBg = $('reel-vp-bg');
    const placeholder = $('reel-vp-placeholder');
    const badge = $('reel-active-scene-badge');
    if (vpVideo) {
      vpVideo.pause();
      vpVideo.style.display = 'none';
      vpVideo.src = '';
    }
    if (vpImg) {
      vpImg.style.display = 'none';
      vpImg.src = '';
    }
    if (vpBg) {
      vpBg.style.backgroundImage = 'none';
      vpBg.style.opacity = '0';
    }
    if (placeholder) placeholder.style.display = 'block';
    if (badge) badge.textContent = 'Vista previa';
    updatePlayBtn(false);
  }

  function previewClip(idx) {
    if (idx < 0 || idx >= S.clips.length) return;
    const c = S.clips[idx];
    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const vpBg = $('reel-vp-bg');
    const placeholder = $('reel-vp-placeholder');
    const finalPlayer = $('reel-final-player');
    const badge = $('reel-active-scene-badge');

    if (finalPlayer) finalPlayer.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';
    if (badge) badge.textContent = `Clip ${idx + 1}`;

    document.querySelectorAll('.reel-clip-card').forEach((card) => {
      card.classList.toggle('selected-for-frame', +card.dataset.i === idx);
    });

    if (c.kind === 'imagen') {
      if (vpVideo) {
        vpVideo.pause();
        vpVideo.style.display = 'none';
      }
      if (vpImg) {
        vpImg.src = c.url;
        vpImg.style.display = 'block';
        vpImg.style.transform = 'none';
        vpImg.style.objectFit = 'contain';
      }
      updatePlayBtn(false);
    } else {
      if (vpImg) vpImg.style.display = 'none';
      if (vpVideo) {
        vpVideo.src = c.url;
        vpVideo.style.display = 'block';
        vpVideo.style.transform = 'none';
        vpVideo.style.objectFit = 'cover';
        vpVideo.currentTime = 0;
        vpVideo.play().then(() => updatePlayBtn(true)).catch(() => updatePlayBtn(false));
      }
    }

    if (vpBg) {
      vpBg.style.backgroundImage = `url("${c.url}")`;
      vpBg.style.opacity = '0.3';
    }

    const topEl = $('reel-vp-text-top');
    const centerEl = $('reel-vp-text-center');
    const bottomEl = $('reel-vp-text-bottom');
    if (topEl) topEl.innerHTML = '';
    if (centerEl) centerEl.innerHTML = '';
    if (bottomEl) bottomEl.innerHTML = '';
  }

  function updatePlayBtn(isPlaying) {
    const btn = $('btn-reel-vp-play');
    if (btn) btn.textContent = isPlaying ? '⏸ Pausar' : '▶ Play';
  }

  function toggleVideoPlay() {
    const vpVideo = $('reel-vp-video');
    const finalPlayer = $('reel-final-player');
    const activeVideo = (finalPlayer && finalPlayer.style.display !== 'none') ? finalPlayer : vpVideo;
    if (!activeVideo || activeVideo.style.display === 'none') return;

    if (activeVideo.paused) {
      activeVideo.play().then(() => updatePlayBtn(true)).catch(() => {});
    } else {
      activeVideo.pause();
      updatePlayBtn(false);
    }
  }

  function toggleVideoMute() {
    const vpVideo = $('reel-vp-video');
    const finalPlayer = $('reel-final-player');
    const activeVideo = (finalPlayer && finalPlayer.style.display !== 'none') ? finalPlayer : vpVideo;
    const btn = $('btn-reel-vp-mute');
    if (!activeVideo) return;

    activeVideo.muted = !activeVideo.muted;
    if (btn) btn.textContent = activeVideo.muted ? '🔇' : '🔊';
  }

  function selectSceneForFrame(idx) {
    if (idx < 0 || idx >= S.scenes.length) return;
    S.activeSceneIdx = idx;

    // Resaltar tarjeta seleccionada en la lista
    document.querySelectorAll('.reel-scene-card').forEach((card) => {
      card.classList.toggle('selected-for-frame', +card.dataset.i === idx);
    });

    const badge = $('reel-active-scene-badge');
    if (badge) badge.textContent = `Toma ${idx + 1}`;

    const sc = S.scenes[idx];
    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const vpBg = $('reel-vp-bg');
    const placeholder = $('reel-vp-placeholder');
    const finalPlayer = $('reel-final-player');

    // Asegurar que el reproductor de resultado no tape la edición
    if (finalPlayer) finalPlayer.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    if (sc.kind === 'imagen') {
      if (vpVideo) {
        vpVideo.pause();
        vpVideo.style.display = 'none';
      }
      if (vpImg) {
        vpImg.src = sc.url;
        vpImg.style.display = 'block';
      }
      updatePlayBtn(false);
    } else {
      if (vpImg) vpImg.style.display = 'none';
      if (vpVideo) {
        vpVideo.src = sc.url + `#t=${sc.start || 0}`;
        vpVideo.style.display = 'block';
        vpVideo.currentTime = sc.start || 0;
        vpVideo.play().then(() => updatePlayBtn(true)).catch(() => updatePlayBtn(false));
      }
    }

    if (vpBg) {
      vpBg.style.backgroundImage = `url("${sc.url}")`;
    }

    // Sincronizar controles de encuadre
    const modeSel = $('reel-frame-mode');
    if (modeSel) modeSel.value = sc.fitMode || 'crop';

    const zoomSlider = $('reel-frame-zoom');
    if (zoomSlider) zoomSlider.value = sc.zoom || 1.0;

    const zoomVal = $('reel-zoom-val');
    if (zoomVal) zoomVal.textContent = `${(sc.zoom || 1.0).toFixed(2)}x`;

    const cropBox = $('reel-crop-controls');
    if (cropBox) cropBox.style.display = sc.fitMode === 'blur' ? 'none' : 'block';

    updateLiveMediaTransform(sc);
    renderLiveOverlay(null);
  }

  function updateLiveMediaTransform(sc) {
    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const vpBg = $('reel-vp-bg');
    const mediaEl = sc.kind === 'imagen' ? vpImg : vpVideo;
    if (!mediaEl) return;

    const panCoords = $('reel-pan-coords');
    const panX = sc.panX != null ? sc.panX : 0.5;
    const panY = sc.panY != null ? sc.panY : 0.5;
    const zoom = sc.zoom || 1.0;

    if (panCoords) {
      panCoords.textContent = `X: ${Math.round(panX * 100)}% · Y: ${Math.round(panY * 100)}%`;
    }

    if (sc.fitMode === 'blur') {
      if (vpBg) vpBg.style.opacity = '1';
      mediaEl.style.width = '100%';
      mediaEl.style.height = 'auto';
      mediaEl.style.objectFit = 'contain';
      mediaEl.style.transform = 'none';
    } else {
      if (vpBg) vpBg.style.opacity = '0';
      mediaEl.style.width = 'auto';
      mediaEl.style.height = '100%';
      mediaEl.style.objectFit = 'cover';

      // Cálculo de traslación visual en el viewport de 270x480
      // En modo 'crop', centrado es 50%. Mover a 0% mueve a la izquierda, 100% a la derecha.
      const shiftX = (0.5 - panX) * 120 * zoom;
      const shiftY = (0.5 - panY) * 60 * zoom;
      mediaEl.style.transform = `scale(${zoom}) translate(${shiftX}px, ${shiftY}px)`;
    }
  }

  function bindFramingTools() {
    const modeSel = $('reel-frame-mode');
    const zoomSlider = $('reel-frame-zoom');
    const zoomVal = $('reel-zoom-val');
    const btnLeft = $('btn-pan-left');
    const btnCenter = $('btn-pan-center');
    const btnRight = $('btn-pan-right');
    const wrap = $('reel-vp-media-wrap');

    if (modeSel) {
      modeSel.addEventListener('change', () => {
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc) return;
        sc.fitMode = modeSel.value;
        const cropBox = $('reel-crop-controls');
        if (cropBox) cropBox.style.display = sc.fitMode === 'blur' ? 'none' : 'block';
        updateLiveMediaTransform(sc);
        saveState();
      });
    }

    if (zoomSlider) {
      zoomSlider.addEventListener('input', () => {
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc) return;
        sc.zoom = parseFloat(zoomSlider.value) || 1.0;
        if (zoomVal) zoomVal.textContent = `${sc.zoom.toFixed(2)}x`;
        updateLiveMediaTransform(sc);
        saveState();
      });
    }

    if (btnLeft) {
      btnLeft.addEventListener('click', () => {
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc) return;
        sc.panX = 0.0;
        updateLiveMediaTransform(sc);
        saveState();
      });
    }

    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc) return;
        sc.panX = 0.5;
        sc.panY = 0.5;
        updateLiveMediaTransform(sc);
        saveState();
      });
    }

    if (btnRight) {
      btnRight.addEventListener('click', () => {
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc) return;
        sc.panX = 1.0;
        updateLiveMediaTransform(sc);
        saveState();
      });
    }

    // Arrastre libre con cursor (Drag-to-pan)
    if (wrap) {
      const onPointerDown = (e) => {
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc || sc.fitMode === 'blur') return;
        isDraggingMedia = true;
        dragStartX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        dragStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        dragInitialPanX = sc.panX != null ? sc.panX : 0.5;
        dragInitialPanY = sc.panY != null ? sc.panY : 0.5;
      };

      const onPointerMove = (e) => {
        if (!isDraggingMedia) return;
        const sc = S.scenes[S.activeSceneIdx];
        if (!sc) return;
        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;

        // Sensibilidad ajustada al tamaño del viewport (270px de ancho)
        const newPanX = Math.max(0, Math.min(1, dragInitialPanX - deltaX / 200));
        const newPanY = Math.max(0, Math.min(1, dragInitialPanY - deltaY / 200));

        sc.panX = Math.round(newPanX * 100) / 100;
        sc.panY = Math.round(newPanY * 100) / 100;
        updateLiveMediaTransform(sc);
      };

      const onPointerUp = () => {
        if (isDraggingMedia) {
          isDraggingMedia = false;
          saveState();
        }
      };

      wrap.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      wrap.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp);
    }
  }

  // ── Paso 4: Música, Voz y Render ──
  function renderVoices() {
    const sel = $('reel-voice');
    if (!sel || !S.voices.length) return;
    sel.innerHTML = S.voices.map((v) =>
      `<option value="${v.id}" ${v.id === S.voice ? 'selected' : ''}>${esc(v.label)} — ${esc(v.desc)}</option>`
    ).join('');
  }

  async function previewVoice() {
    const text = ($('reel-voiceover')?.value || '').trim();
    if (!text) return toast('Escribe o genera un guion de voz primero.', 'warning');
    setBusy('btn-reel-voice', true, 'Generando voz...');

    try {
      const data = await api('/reel/voice', {
        text,
        voice: S.voice,
        style: $('reel-voice-style')?.value || ''
      });
      S.voiceUrl = data.url;
      S.voiceDur = data.duration;
      const a = $('reel-voice-audio');
      if (a) {
        a.src = data.url;
        a.style.display = 'inline-block';
        a.play().catch(() => {});
      }
      const info = $('reel-voice-info');
      if (info) info.textContent = `Voz lista (${data.duration.toFixed(1)} s). Si dura más que el video, se alarga la última escena.`;
      toast('Muestra de voz lista.', 'success');
    } catch (err) {
      toast('No se pudo generar la voz: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-voice', false);
    }
  }

  async function searchMusic() {
    const q = ($('reel-music-q')?.value || '').trim();
    const box = $('reel-music-results');
    if (!box) return;
    box.innerHTML = '<div class="reel-empty">Buscando música libre de regalías...</div>';

    try {
      let tracks = [];
      if (q) {
        const r = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&limit=12`).then((x) => x.json());
        tracks = r.data?.results || [];
      } else {
        const r = await fetch('/api/music/library').then((x) => x.json());
        tracks = [...(r.data?.userAudios || []), ...(r.data?.tracks || [])].slice(0, 16);
      }

      if (!tracks.length) {
        box.innerHTML = '<div class="reel-empty">Sin resultados. Prueba con otra palabra clave.</div>';
        return;
      }

      box.innerHTML = '';
      tracks.forEach((t) => {
        const row = document.createElement('div');
        row.className = 'reel-track';
        row.innerHTML = `
          <button type="button" class="btn btn-secondary btn-xs" data-a="play">▶</button>
          <span class="reel-track-info"><strong>${esc(t.title)}</strong><small>${esc(t.artist || '')}</small></span>
          <button type="button" class="btn btn-primary btn-xs" data-a="use">Usar</button>
        `;
        row.querySelector('[data-a="play"]')?.addEventListener('click', () => {
          if (!audioEl) audioEl = new Audio();
          audioEl.src = t.previewUrl || t.streamUrl;
          audioEl.play().catch(() => toast('No se pudo reproducir la muestra.', 'warning'));
        });
        row.querySelector('[data-a="use"]')?.addEventListener('click', () => {
          S.music = { url: t.streamUrl, title: t.title, artist: t.artist || '' };
          if (audioEl) audioEl.pause();
          renderMusicSel();
          toast(`Música seleccionada: ${t.title}`, 'success');
        });
        box.appendChild(row);
      });
    } catch (err) {
      box.innerHTML = `<div class="reel-empty">Error buscando música: ${esc(err.message)}</div>`;
    }
  }

  function renderMusicSel() {
    const el = $('reel-music-sel');
    if (!el) return;
    el.innerHTML = S.music
      ? `🎵 <strong>${esc(S.music.title)}</strong> ${esc(S.music.artist)} <button type="button" class="btn btn-secondary btn-xs" id="reel-music-clear" style="margin-left:8px;">Quitar</button>`
      : 'Sin música seleccionada';

    $('reel-music-clear')?.addEventListener('click', () => {
      S.music = null;
      renderMusicSel();
    });
  }

  // ── Renderizado Definitivo ──
  async function renderReel() {
    if (!S.scenes.length) return toast('Crea o genera las escenas primero.', 'warning');

    S.voiceover = $('reel-voiceover')?.value || '';
    S.caption = $('reel-caption')?.value || '';
    const useVoice = $('reel-use-voice')?.checked && S.voiceover.trim();

    setBusy('btn-reel-render', true, 'Renderizando reel en Contabo...');
    toast('Procesando video con FFmpeg: encuadres, transiciones y audio...', 'info');

    try {
      if (useVoice && !S.voiceUrl) {
        toast('Generando voz de locución...', 'info');
        const v = await api('/reel/voice', {
          text: S.voiceover,
          voice: S.voice,
          style: $('reel-voice-style')?.value || ''
        });
        S.voiceUrl = v.url;
        S.voiceDur = v.duration;
      }

      const data = await api('/reel/render', {
        scenes: S.scenes.map((sc) => ({
          url: sc.url,
          start: sc.start,
          length: sc.length,
          fitMode: sc.fitMode,
          zoom: sc.zoom,
          panX: sc.panX,
          panY: sc.panY,
          transition: sc.transition
        })),
        textOverlays: S.textOverlays.map((ov) => ({
          text: ov.text,
          start: Number(ov.start) || 0,
          end: Number(ov.end) || 3,
          pos: ov.pos || 'center',
          textStyle: ov.textStyle || 'yellow',
          font: ov.font || 'archivo',
          effect: ov.effect || 'pop'
        })),
        voice_url: useVoice ? S.voiceUrl : '',
        voice_volume: Number($('reel-voice-vol')?.value) || 1,
        music: S.music ? { url: S.music.url, title: S.music.title, artist: S.music.artist } : null,
        music_volume: Number($('reel-music-vol')?.value) || 0.3,
        global_transition: 'zoomin'
      });

      S.resultUrl = data.url;
      saveState();

      // Mostrar en el reproductor de la mini pantalla
      const finalPlayer = $('reel-final-player');
      if (finalPlayer) {
        finalPlayer.src = data.url + '?t=' + Date.now();
        finalPlayer.style.display = 'block';
        finalPlayer.play().catch(() => {});
      }

      const actionsBox = $('reel-result-actions-box');
      if (actionsBox) actionsBox.style.display = 'block';

      const meta = $('reel-result-meta');
      if (meta) {
        meta.textContent = `${data.duration} segundos · ${(data.sizeBytes / 1048576).toFixed(1)} MB · 1080x1920`;
      }

      const dlBtn = $('btn-reel-download');
      if (dlBtn) {
        dlBtn.href = data.url;
        dlBtn.download = `reel_${Date.now()}.mp4`;
      }

      toast('¡Reel renderizado con éxito! Puedes revisarlo en la mini pantalla.', 'success');
    } catch (err) {
      console.error('[Reel render]', err);
      toast('Error al renderizar: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-render', false);
    }
  }

  async function saveDraft() {
    if (!S.resultUrl) return toast('Renderiza el video primero.', 'warning');
    const acc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;

    try {
      const body = {
        title: 'Reel Vertical 9:16',
        content: $('reel-caption')?.value || S.caption || '',
        platforms: ['facebook', 'instagram'],
        post_type: 'reel',
        media_urls: [S.resultUrl],
        accountId: acc?.pageId || null,
        accountName: acc?.pageName || null
      };

      const res = await fetch('/api/posts/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error al guardar');

      toast('Borrador de Reel guardado en el calendario.', 'success');
      clearState(false);
      if (typeof window.switchTab === 'function') {
        window.switchTab('queue');
      }
    } catch (err) {
      toast('No se pudo guardar el borrador: ' + err.message, 'error');
    }
  }

  function bindDropEvents() {
    const dropzone = $('reel-dropzone');
    const pane = $('reel-pane-2');
    const fileInput = $('reel-file');

    if (dropzone) {
      dropzone.addEventListener('click', () => fileInput?.click());

      ['dragenter', 'dragover'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'dragend'].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          uploadFiles(e.dataTransfer.files);
        }
      });
    }

    if (pane) {
      ['dragenter', 'dragover'].forEach((evt) => {
        pane.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropzone) dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'dragend'].forEach((evt) => {
        pane.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!pane.contains(e.relatedTarget) && dropzone) {
            dropzone.classList.remove('dragover');
          }
        });
      });

      pane.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dropzone) dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
          uploadFiles(e.dataTransfer.files);
        }
      });
    }

    fileInput?.addEventListener('change', (e) => {
      uploadFiles(e.target.files);
      e.target.value = '';
    });

    const tabReels = $('tab-reels');
    if (tabReels) {
      ['dragover', 'drop'].forEach((evt) => {
        tabReels.addEventListener(evt, (e) => {
          if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
            e.preventDefault();
          }
        });
      });
    }
  }

  // ── Inicialización ──
  async function init() {
    if (!$('tab-reels') || init.done) return;
    init.done = true;

    // Actualizar nombre de cuenta
    const brandBadge = $('reel-brand-badge');
    if (brandBadge) {
      const name = brandName();
      brandBadge.textContent = name || 'Cuenta activa';
    }

    // Paso 1
    renderTemplates(DEFAULT_TEMPLATES);
    $('btn-reel-go-step-2')?.addEventListener('click', () => goToStep(2));

    // Paso 2: Subida y clips
    bindDropEvents();
    $('btn-reel-back-step-1')?.addEventListener('click', () => goToStep(1));
    $('btn-reel-plan')?.addEventListener('click', planWithAI);
    $('btn-reel-manual-scenes')?.addEventListener('click', createManualScenes);

    // Paso 3: Pista de Video
    $('btn-reel-add-scene')?.addEventListener('click', addScene);
    $('btn-reel-back-step-2')?.addEventListener('click', () => goToStep(2));
    $('btn-reel-go-step-4')?.addEventListener('click', () => goToStep(4));

    // Paso 4: Capa de Textos y Efectos
    $('btn-reel-back-step-3')?.addEventListener('click', () => goToStep(3));
    $('btn-reel-go-step-5')?.addEventListener('click', () => goToStep(5));
    $('btn-reel-add-text')?.addEventListener('click', addTextOverlay);
    $('btn-reel-ai-suggest-texts')?.addEventListener('click', suggestTextsWithAI);

    // Paso 5: Música, Voz y Render
    $('btn-reel-back-step-4')?.addEventListener('click', () => goToStep(4));
    $('btn-reel-voice')?.addEventListener('click', previewVoice);
    $('btn-reel-music-search')?.addEventListener('click', searchMusic);
    $('reel-music-q')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchMusic();
      }
    });
    $('btn-reel-render')?.addEventListener('click', renderReel);
    $('btn-reel-save-draft')?.addEventListener('click', saveDraft);

    // Navegación de pasos por tabs
    document.querySelectorAll('.reel-step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        goToStep(+btn.dataset.step);
      });
    });

    // Botón reiniciar estudio
    $('btn-reel-clear')?.addEventListener('click', () => clearState(true));
    window.addEventListener('beforeunload', saveState);

    // Inputs que persisten
    $('reel-custom-script')?.addEventListener('input', saveState);
    $('reel-goal')?.addEventListener('input', saveState);
    $('reel-target')?.addEventListener('change', saveState);
    $('reel-caption')?.addEventListener('input', saveState);

    // Controles de audio y voz
    $('reel-voice')?.addEventListener('change', (e) => {
      S.voice = e.target.value;
      S.voiceUrl = '';
      saveState();
    });
    $('reel-voiceover')?.addEventListener('input', () => {
      S.voiceUrl = '';
      saveState();
    });
    $('reel-voice-vol')?.addEventListener('input', (e) => {
      const n = $('reel-voice-vol-n');
      if (n) n.textContent = Math.round(e.target.value * 100) + '%';
      saveState();
    });
    $('reel-music-vol')?.addEventListener('input', (e) => {
      const n = $('reel-music-vol-n');
      if (n) n.textContent = Math.round(e.target.value * 100) + '%';
      saveState();
    });

    // Controles de reproducción de la mini pantalla
    $('btn-reel-vp-play')?.addEventListener('click', toggleVideoPlay);
    $('btn-reel-vp-mute')?.addEventListener('click', toggleVideoMute);
    $('reel-vp-video')?.addEventListener('play', () => updatePlayBtn(true));
    $('reel-vp-video')?.addEventListener('pause', () => updatePlayBtn(false));
    $('reel-final-player')?.addEventListener('play', () => updatePlayBtn(true));
    $('reel-final-player')?.addEventListener('pause', () => updatePlayBtn(false));

    // Herramientas de encuadre interactivo
    bindFramingTools();

    // Cargar voces y plantillas desde API
    try {
      S.voices = await api('/reel/voices');
    } catch (_) {
      S.voices = [];
    }
    renderVoices();

    try {
      const tmps = await api('/reel/templates');
      if (Array.isArray(tmps) && tmps.length) renderTemplates(tmps);
    } catch (_) {}

    renderClips();
    renderMusicSel();

    // Restaurar borrador de sesión (para soportar F5 sin perder clips ni textos)
    restoreState();
  }

  window.loadReelStudio = init;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
