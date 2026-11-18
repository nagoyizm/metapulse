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
    voiceSegments: [],  // { id, text, start, url, duration }
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

  const TEXT_EFFECTS_IN = [
    { id: 'pop', label: 'Punch / Pop (Impacto rápido)' },
    { id: 'zoomin', label: 'Zoom in (Rebote dinámico)' },
    { id: 'zoomout', label: 'Zoom desde cerca' },
    { id: 'typewriter', label: 'Máquina de escribir' },
    { id: 'wordbyword', label: 'Palabra por palabra' },
    { id: 'wind', label: 'Viento con estela' },
    { id: 'magic', label: 'Magia y destello' },
    { id: 'glitch', label: 'Glitch' },
    { id: 'slideup', label: 'Deslizar hacia arriba' },
    { id: 'slidedown', label: 'Deslizar hacia abajo' },
    { id: 'slideleft', label: 'Deslizar desde la derecha' },
    { id: 'slideright', label: 'Deslizar desde la izquierda' },
    { id: 'drop', label: 'Caída con rebote' },
    { id: 'bounce', label: 'Rebote elástico' },
    { id: 'fade', label: 'Fundido suave' },
    { id: 'none', label: 'Corte directo' }
  ];

  const TEXT_EFFECTS_LOOP = [
    { id: 'none', label: 'Quieto' },
    { id: 'float', label: 'Flotar' },
    { id: 'pulse', label: 'Latido suave' },
    { id: 'heartbeat', label: 'Corazón' },
    { id: 'shake', label: 'Temblor' },
    { id: 'swing', label: 'Vaivén' },
    { id: 'glow', label: 'Respirar' },
    { id: 'wave', label: 'Ola entre líneas' }
  ];

  const TEXT_EFFECTS_OUT = [
    { id: 'fade', label: 'Fundido' },
    { id: 'zoomout', label: 'Zoom out' },
    { id: 'explode', label: 'Explosión' },
    { id: 'slideup', label: 'Deslizar hacia arriba' },
    { id: 'slidedown', label: 'Deslizar hacia abajo' },
    { id: 'slideleft', label: 'Deslizar hacia la izquierda' },
    { id: 'slideright', label: 'Deslizar hacia la derecha' },
    { id: 'wind', label: 'Viento hacia la derecha' },
    { id: 'magic', label: 'Magia y disolución' },
    { id: 'glitch', label: 'Glitch' },
    { id: 'typewriter', label: 'Borrado máquina' },
    { id: 'drop', label: 'Caída fuera' },
    { id: 'none', label: 'Corte directo' }
  ];

  const SPEED_OPTIONS = [
    { id: 'fast', label: 'Rápida (0.25s)', dur: 0.25 },
    { id: 'normal', label: 'Normal (0.45s)', dur: 0.45 },
    { id: 'slow', label: 'Lenta (0.8s)', dur: 0.8 }
  ];

  const VALID_EFFECTS_IN = TEXT_EFFECTS_IN.map((e) => e.id);
  const VALID_EFFECTS_LOOP = TEXT_EFFECTS_LOOP.map((e) => e.id);
  const VALID_EFFECTS_OUT = TEXT_EFFECTS_OUT.map((e) => e.id);
  const VALID_SPEEDS = ['fast', 'normal', 'slow'];

  function normalizeOverlay(ov) {
    if (!ov || typeof ov !== 'object') return null;
    let effectIn = ov.effectIn;
    let effectLoop = ov.effectLoop || 'none';
    let effectOut = ov.effectOut;
    let speed = ov.speed || 'normal';

    if (!effectIn && ov.effect) {
      if (ov.effect === 'pop') effectIn = 'pop';
      else if (ov.effect === 'fade') { effectIn = 'fade'; effectOut = 'fade'; }
      else if (ov.effect === 'slide') effectIn = 'slideup';
      else if (ov.effect === 'bounce') effectIn = 'bounce';
      else if (ov.effect === 'none') { effectIn = 'none'; effectOut = 'none'; }
      else effectIn = ov.effect;
    }

    if (!effectIn || !VALID_EFFECTS_IN.includes(effectIn)) effectIn = 'pop';
    if (!effectLoop || !VALID_EFFECTS_LOOP.includes(effectLoop)) effectLoop = 'none';
    if (!effectOut || !VALID_EFFECTS_OUT.includes(effectOut)) effectOut = (effectIn === 'none' ? 'none' : 'fade');
    if (!VALID_SPEEDS.includes(speed)) speed = 'normal';

    return {
      ...ov,
      effectIn,
      effectLoop,
      effectOut,
      speed
    };
  }

  function getTiming(start, end, speed = 'normal') {
    const dur = Math.max(0.1, (Number(end) || 0) - (Number(start) || 0));
    const baseDur = speed === 'fast' ? 0.25 : speed === 'slow' ? 0.8 : 0.45;
    const maxCombined = dur * 0.7;
    let inDur = baseDur;
    let outDur = baseDur;
    if (inDur + outDur > maxCombined) {
      inDur = maxCombined / 2;
      outDur = maxCombined / 2;
    }
    return { inDur, outDur };
  }

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
        voiceSegments: S.voiceSegments,
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
        S.textOverlays = data.textOverlays.map(normalizeOverlay).filter(Boolean);
      }
      if (data.voiceover) {
        S.voiceover = data.voiceover;
        const vo = $('reel-voiceover');
        if (vo) vo.value = data.voiceover;
      }
      if (Array.isArray(data.voiceSegments) && data.voiceSegments.length) {
        S.voiceSegments = data.voiceSegments;
      } else if (data.voiceover || S.voiceover) {
        const txt = (data.voiceover || S.voiceover || '').trim();
        if (txt) {
          S.voiceSegments = [{
            id: `vseg_${Date.now()}`,
            text: txt,
            start: 0,
            url: null,
            duration: null
          }];
        } else {
          S.voiceSegments = [];
        }
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
      renderVoiceSegments();
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
    S.voiceSegments = [];
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
    renderVoiceSegments();
    renderMusicSel();
    goToStep(1);
    toast('Estudio de Reels reiniciado.', 'info');
  }

  // ── Navegación de Pasos ──
  function goToStep(n) {
    stopSequence(false);
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
      renderVoiceSegments();
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
  async function analyzeSingleClip(i, force = false) {
    if (i < 0 || i >= S.clips.length) return;
    const clip = S.clips[i];
    clip._analyzingState = 'analyzing';
    renderClips();

    try {
      const data = await api('/reel/analyze-clip', {
        url: clip.url,
        brand: brandName(),
        goal: $('reel-goal')?.value || '',
        force: Boolean(force)
      });
      clip.analysis = data;
      clip._analyzingState = 'done';
      if (!clip.description || !clip.description.trim()) {
        clip.description = data.description || '';
      }
      renderClips();
      saveState();
      toast(`Clip ${i + 1} analizado con éxito`, 'success');
    } catch (err) {
      clip._analyzingState = 'error';
      renderClips();
      saveState();
      toast(`Error analizando clip ${i + 1}: ${err.message}`, 'error');
    }
  }

  async function analyzeClipsSequentially(indices) {
    for (const idx of indices) {
      if (idx >= S.clips.length) continue;
      await analyzeSingleClip(idx, false);
    }
  }

  async function analyzeAllClips() {
    const unanalyzed = S.clips
      .map((c, i) => (!c.analysis ? i : -1))
      .filter((i) => i >= 0);
    if (!unanalyzed.length) {
      return toast('Todos los clips ya están analizados.', 'info');
    }
    setBusy('btn-reel-analyze-all', true, 'Analizando...');
    try {
      await analyzeClipsSequentially(unanalyzed);
    } finally {
      setBusy('btn-reel-analyze-all', false);
    }
  }

  async function reviewClipsWithAI() {
    if (!S.clips.length) return toast('Sube al menos un clip primero.', 'warning');
    setBusy('btn-reel-review-clips', true, 'Revisando clips...');
    const reviewContent = $('reel-ai-review-content');

    try {
      const data = await api('/reel/review-clips', {
        brand: brandName(),
        goal: $('reel-goal')?.value || '',
        template: S.template,
        targetSeconds: Number($('reel-target')?.value) || 12,
        clips: S.clips.map((c, idx) => ({
          index: idx,
          description: c.description,
          analysis: c.analysis || null
        }))
      });

      if (reviewContent) {
        reviewContent.style.display = 'block';
        const templateTitle = DEFAULT_TEMPLATES.find(t => t.id === data.recommendedTemplate)?.title || data.recommendedTemplate;
        const hookClipNum = (data.hookClip != null ? data.hookClip : 0) + 1;
        const currentGoal = ($('reel-goal')?.value || '').trim();

        reviewContent.innerHTML = `
          <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <strong style="color:var(--text-primary);">Gancho sugerido:</strong>
                <button type="button" class="btn btn-xs btn-ghost" id="btn-reel-review-preview-hook" style="color:var(--primary); font-weight:700;">
                  Clip ${hookClipNum} (previsualizar)
                </button>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge" style="background:var(--primary-subtle); color:var(--primary);">
                  ${esc(templateTitle)} · ${data.recommendedSeconds}s
                </span>
                <button type="button" class="btn btn-xs btn-primary" id="btn-reel-apply-recommendation">Aplicar a Paso 1</button>
              </div>
            </div>

            ${(data.missingShots && data.missingShots.length) ? `
              <div>
                <span style="font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Planos que faltan:</span>
                <ul style="margin:0; padding-left:18px; color:var(--text-primary); font-size:0.76rem;">
                  ${data.missingShots.map(s => `<li>${esc(s)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${(data.tips && data.tips.length) ? `
              <div>
                <span style="font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Consejos de edición:</span>
                <ul style="margin:0; padding-left:18px; color:var(--text-primary); font-size:0.76rem;">
                  ${data.tips.map(t => `<li>${esc(t)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${(!currentGoal && data.goalIdea) ? `
              <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-subtle); padding:6px 10px; border-radius:6px; font-size:0.75rem;">
                <div>
                  <span style="font-weight:600; color:var(--text-secondary);">Objetivo sugerido:</span>
                  <span style="color:var(--text-primary); margin-left:4px;">${esc(data.goalIdea)}</span>
                </div>
                <button type="button" class="btn btn-xs btn-secondary" id="btn-reel-use-goal">Usar</button>
              </div>
            ` : ''}
          </div>
        `;

        $('btn-reel-review-preview-hook')?.addEventListener('click', () => {
          if (data.hookClip >= 0 && data.hookClip < S.clips.length) {
            previewClip(data.hookClip);
          }
        });

        $('btn-reel-apply-recommendation')?.addEventListener('click', () => {
          S.template = data.recommendedTemplate;
          S.targetSeconds = data.recommendedSeconds;
          const tg = $('reel-target');
          if (tg) tg.value = data.recommendedSeconds;
          document.querySelectorAll('.reel-template-card').forEach((card) => {
            card.classList.toggle('active', card.dataset.id === S.template);
          });
          const customBox = $('reel-custom-script-box');
          if (customBox) customBox.style.display = S.template === 'custom' ? 'block' : 'none';
          saveState();
          toast('Fórmula y duración aplicadas al Paso 1', 'success');
        });

        $('btn-reel-use-goal')?.addEventListener('click', () => {
          const g = $('reel-goal');
          if (g) g.value = data.goalIdea;
          S.goal = data.goalIdea;
          saveState();
          toast('Objetivo actualizado', 'success');
        });
      }
    } catch (err) {
      toast('Error revisando clips: ' + err.message, 'error');
    } finally {
      setBusy('btn-reel-review-clips', false);
    }
  }

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

    list.innerHTML = S.clips.map((c, i) => {
      const isAnalyzing = c._analyzingState === 'analyzing';
      const isError = c._analyzingState === 'error';
      const hasAnalysis = Boolean(c.analysis);

      let statusBadge = '';
      if (isAnalyzing) {
        statusBadge = '<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.7rem; font-weight:600;">Analizando...</span>';
      } else if (isError) {
        statusBadge = `
          <span class="badge" style="background:#fee2e2; color:#991b1b; font-size:0.7rem; font-weight:600;">Error: reintentar</span>
          <button type="button" class="btn btn-secondary btn-xs reel-retry-clip" data-i="${i}">Reintentar</button>
        `;
      } else if (hasAnalysis) {
        statusBadge = `
          <span class="badge" style="background:#d1fae5; color:#065f46; font-size:0.7rem; font-weight:600;">Analizado</span>
          <button type="button" class="btn btn-secondary btn-xs reel-reanalyze-clip" data-i="${i}" title="Volver a analizar con IA">Volver a analizar</button>
        `;
      } else {
        statusBadge = `
          <button type="button" class="btn btn-secondary btn-xs reel-analyze-clip" data-i="${i}" title="Analizar clip con IA">Analizar con IA</button>
        `;
      }

      const showSuggestion = hasAnalysis && c.description && c.description.trim() && c.analysis.description && c.description.trim() !== c.analysis.description.trim();

      return `
        <div class="reel-clip-card" data-i="${i}">
          <div class="reel-clip-thumb-box">
            ${c.kind === 'imagen'
              ? `<img src="${esc(c.url)}" alt="">`
              : `<video src="${esc(c.url)}#t=0.5" muted preload="metadata" playsinline></video>`}
            ${c.duration ? `<span class="reel-clip-dur-badge">${c.duration.toFixed(1)}s</span>` : ''}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
              <div style="display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden;">
                <strong style="font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${i + 1}. ${esc(c.name || 'Clip')}
                </strong>
                ${statusBadge}
              </div>
              <button type="button" class="btn btn-secondary btn-xs reel-del-clip" title="Eliminar clip">✕</button>
            </div>

            <textarea class="form-control form-control-sm reel-clip-desc-input" rows="2" style="font-size:0.75rem;" placeholder="¿Qué ocurre en este clip? (ej: cámara lenta abriendo el helado, se ve el relleno cremoso)">${esc(c.description)}</textarea>

            ${showSuggestion ? `
              <div class="reel-analysis-suggestion">
                <div style="min-width:0; flex:1;">
                  <span style="font-weight:600; color:var(--text-secondary);">Sugerencia:</span>
                  <span style="color:var(--text-primary); margin-left:4px;">${esc(c.analysis.description)}</span>
                </div>
                <button type="button" class="btn btn-secondary btn-xs reel-use-desc" data-i="${i}">Usar</button>
              </div>
            ` : ''}

            ${hasAnalysis ? `
              <div class="reel-analysis-box">
                <div style="font-size:0.72rem; color:var(--text-secondary); margin-bottom:4px;">
                  ${[c.analysis.subject, c.analysis.mood, c.analysis.shotType].filter(Boolean).map(esc).join(' · ')}
                </div>

                ${(Array.isArray(c.analysis.highlights) && c.analysis.highlights.length) ? `
                  <div class="reel-highlights-container">
                    ${c.analysis.highlights.map((h) => {
                      const isHook = c.analysis.hook && Math.abs(h.start - c.analysis.hook.start) < 0.6;
                      return `
                        <div class="reel-highlight-chip">
                          <span class="reel-highlight-clickable reel-preview-hl" data-i="${i}" data-start="${h.start}">
                            ${isHook ? '<span class="reel-badge-hook">Gancho</span>' : ''}
                            <strong>${h.start.toFixed(1)}–${h.end.toFixed(1)} s</strong> · ${esc(h.label)}
                          </span>
                          <button type="button" class="btn btn-secondary btn-xs reel-use-as-scene" data-i="${i}" data-start="${h.start}" data-end="${h.end}">Usar como toma</button>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                ${(c.analysis.issues && c.analysis.issues.length) ? `
                  <div class="reel-issues-container">
                    ${c.analysis.issues.map(iss => `<span class="reel-issue-badge">⚠️ ${esc(iss)}</span>`).join('')}
                  </div>
                ` : ''}

                ${(c.analysis.textIdeas && c.analysis.textIdeas.length) ? `
                  <div class="reel-text-ideas-container">
                    <span style="font-size:0.7rem; color:var(--text-secondary);">Textos:</span>
                    ${c.analysis.textIdeas.map(txt => `<button type="button" class="btn btn-secondary btn-xs reel-add-text-idea" data-text="${esc(txt)}">${esc(txt)}</button>`).join('')}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.reel-clip-card').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('click', (e) => {
        if (e.target.closest('textarea') || e.target.closest('button') || e.target.closest('.reel-highlight-chip')) return;
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
      el.querySelector('.reel-use-desc')?.addEventListener('click', () => {
        if (S.clips[i].analysis?.description) {
          S.clips[i].description = S.clips[i].analysis.description;
          renderClips();
          saveState();
        }
      });
      el.querySelector('.reel-analyze-clip')?.addEventListener('click', () => {
        analyzeSingleClip(i, false);
      });
      el.querySelector('.reel-reanalyze-clip')?.addEventListener('click', () => {
        analyzeSingleClip(i, true);
      });
      el.querySelector('.reel-retry-clip')?.addEventListener('click', () => {
        analyzeSingleClip(i, true);
      });
    });

    list.querySelectorAll('.reel-preview-hl').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = +el.dataset.i;
        const start = parseFloat(el.dataset.start) || 0;
        previewClip(i, start);
      });
    });

    list.querySelectorAll('.reel-use-as-scene').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = +btn.dataset.i;
        const start = parseFloat(btn.dataset.start) || 0;
        const end = parseFloat(btn.dataset.end) || (start + 2.5);
        const length = Math.max(1, Math.round((end - start) * 10) / 10);
        const clip = S.clips[i];
        if (!clip) return;
        const framing = clip.analysis?.framing || {};
        S.scenes.push({
          clip: i,
          url: clip.url,
          kind: clip.kind,
          start: Math.round(start * 10) / 10,
          length,
          fitMode: framing.fitMode === 'blur' ? 'blur' : 'crop',
          zoom: typeof framing.zoom === 'number' ? framing.zoom : 1.0,
          panX: typeof framing.panX === 'number' ? framing.panX : 0.5,
          panY: typeof framing.panY === 'number' ? framing.panY : 0.5,
          transition: 'zoomin'
        });
        renderScenes();
        saveState();
        toast('Toma agregada al paso 3', 'success');
      });
    });

    list.querySelectorAll('.reel-add-text-idea').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txt = btn.dataset.text;
        if (!txt) return;
        let start = 0;
        let end = 2.5;
        if (S.textOverlays.length > 0) {
          const maxEnd = Math.max(...S.textOverlays.map(t => Number(t.end) || 0));
          start = Math.round(maxEnd * 10) / 10;
          end = Math.round((start + 2.5) * 10) / 10;
        }
        S.textOverlays.push(normalizeOverlay({
          id: `ov_${Date.now()}`,
          text: txt,
          start,
          end,
          pos: 'top',
          textStyle: 'yellow',
          font: 'archivo',
          effectIn: 'pop',
          effectLoop: 'none',
          effectOut: 'fade',
          speed: 'normal'
        }));
        renderTextOverlays();
        saveState();
        toast('Texto agregado al paso 4', 'success');
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

            const addedIndices = [];
            for (const m of json.data) {
              const isImg = (m.mime_type || '').startsWith('image/');
              const clipObj = {
                url: m.url,
                kind: isImg ? 'imagen' : 'video',
                description: '',
                name: m.original_name,
                duration: null
              };
              addedIndices.push(S.clips.length);
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

            const autoAnalyze = $('reel-auto-analyze')?.checked ?? (localStorage.getItem('reel_auto_analyze') !== 'false');
            if (autoAnalyze && addedIndices.length > 0) {
              analyzeClipsSequentially(addedIndices);
            }

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
        clips: S.clips.map((c) => ({
          url: c.url,
          description: c.description,
          analysis: c.analysis || undefined
        })),
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

      S.textOverlays = (data.textOverlays || []).map((t, idx) => normalizeOverlay({
        id: t.id || `txt_${idx + 1}`,
        text: t.text || '',
        start: Number(t.start) || 0,
        end: Number(t.end) || 3.0,
        pos: t.pos || (idx === 0 ? 'top' : idx === 1 ? 'center' : 'bottom'),
        textStyle: t.textStyle || (idx === 0 ? 'yellow' : 'pill'),
        font: t.font || 'archivo',
        effectIn: t.effectIn,
        effectLoop: t.effectLoop,
        effectOut: t.effectOut,
        speed: t.speed,
        effect: t.effect
      }));

      S.voiceover = data.voiceover || '';
      S.caption = data.caption || '';
      S.musicQuery = data.musicQuery || '';
      S.voiceUrl = '';
      S.resultUrl = '';
      if (S.voiceover) {
        S.voiceSegments = splitScriptIntoPhrases(S.voiceover);
      } else {
        S.voiceSegments = [];
      }

      renderScenes();
      renderTextOverlays();
      renderVoiceSegments();
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
          effectIn: 'pop',
          effectLoop: 'none',
          effectOut: 'fade',
          speed: 'normal'
        }
      ];
    }

    renderScenes();
    renderTextOverlays();
    renderVoiceSegments();
    goToStep(3);
    toast(`${S.scenes.length} toma(s) creadas (1 por cada clip subido).`, 'info');
  }

  // ── Paso 3: Pista de Video (Cortes, Encuadre 9:16 y Transiciones) ──
  const VALID_XFADE_LIST = [
    'zoomin',
    'slideleft',
    'slideright',
    'smoothleft',
    'smoothright',
    'fadewhite',
    'fadeblack',
    'dissolve',
    'fade'
  ];

  function buildTimeline() {
    if (!S.scenes.length) {
      return { total: 0, items: [] };
    }

    const items = [];
    const len0 = Math.min(Math.max(Number(S.scenes[0].length) || 2.5, 0.8), 8);

    if (S.scenes.length === 1) {
      items.push({
        idx: 0,
        startAt: 0,
        len: len0,
        transition: 'none',
        transDur: 0
      });
      return { total: len0, items };
    }

    const hasXfade = S.scenes.some((s, idx) => {
      if (idx === 0) return false;
      const tr = s.transition || 'zoomin';
      return tr && tr !== 'none' && VALID_XFADE_LIST.includes(tr);
    });

    if (!hasXfade) {
      let currentOffset = 0;
      for (let i = 0; i < S.scenes.length; i++) {
        const len = Math.min(Math.max(Number(S.scenes[i].length) || 2.5, 0.8), 8);
        items.push({
          idx: i,
          startAt: currentOffset,
          len,
          transition: S.scenes[i].transition || 'none',
          transDur: 0
        });
        currentOffset += len;
      }
      return { total: currentOffset, items };
    }

    // Encadenamiento dinámico con xfade (idéntico a reelStudioService.render)
    items.push({
      idx: 0,
      startAt: 0,
      len: len0,
      transition: 'none',
      transDur: 0
    });

    let currentDur = len0;
    for (let i = 0; i < S.scenes.length - 1; i++) {
      const nextIdx = i + 1;
      const nextLen = Math.min(Math.max(Number(S.scenes[nextIdx].length) || 2.5, 0.8), 8);
      const rawTr = S.scenes[nextIdx].transition || 'zoomin';
      const isNone = (rawTr === 'none');
      const tr = isNone ? 'none' : (VALID_XFADE_LIST.includes(rawTr) ? rawTr : 'zoomin');
      const transDur = isNone ? 0.04 : Math.min(0.35, Math.min(currentDur * 0.35, nextLen * 0.35));
      const offset = Math.max(0, currentDur - transDur);

      items.push({
        idx: nextIdx,
        startAt: offset,
        len: nextLen,
        transition: tr,
        transDur
      });

      currentDur = offset + nextLen;
    }

    return { total: currentDur, items };
  }

  function totalSeconds() {
    return buildTimeline().total;
  }

  function renderScenes() {
    const list = $('reel-scenes-list');
    const badge = $('reel-badge-scenes-count');
    const totalEl = $('reel-total-dur');
    if (!list) return;

    const tl = buildTimeline();
    const tot = tl.total;

    if (badge) {
      badge.textContent = S.scenes.length;
      badge.style.display = S.scenes.length ? 'inline-block' : 'none';
    }
    if (totalEl) {
      totalEl.textContent = `${tot.toFixed(1)} s`;
    }
    const textTot = $('reel-text-total-dur');
    if (textTot) {
      textTot.textContent = `${tot.toFixed(1)} s`;
    }

    const progressEl = $('reel-seq-progress');
    if (progressEl) {
      progressEl.max = tot.toFixed(2);
      if (!seqPlaying) progressEl.value = '0';
    }
    if (!seqPlaying) updateSeqTimeLabel(0, tot);

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
        renderScenes();
        renderTextOverlays();
        renderVoiceSegments();
        saveState();
      });
      card.querySelector('.reel-scene-trans')?.addEventListener('change', (e) => {
        S.scenes[i].transition = e.target.value;
        renderScenes();
        renderTextOverlays();
        renderVoiceSegments();
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

    const effectInOpts = (sel) => TEXT_EFFECTS_IN.map((ef) =>
      `<option value="${ef.id}" ${ef.id === (sel || 'pop') ? 'selected' : ''}>${esc(ef.label)}</option>`
    ).join('');

    const effectLoopOpts = (sel) => TEXT_EFFECTS_LOOP.map((ef) =>
      `<option value="${ef.id}" ${ef.id === (sel || 'none') ? 'selected' : ''}>${esc(ef.label)}</option>`
    ).join('');

    const effectOutOpts = (sel) => TEXT_EFFECTS_OUT.map((ef) =>
      `<option value="${ef.id}" ${ef.id === (sel || 'fade') ? 'selected' : ''}>${esc(ef.label)}</option>`
    ).join('');

    const speedOpts = (sel) => SPEED_OPTIONS.map((sp) =>
      `<option value="${sp.id}" ${sp.id === (sel || 'normal') ? 'selected' : ''}>${esc(sp.label)}</option>`
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
            <label style="font-size:0.72rem; font-weight:600;">Entrada</label>
            <select class="form-control form-control-sm reel-overlay-effect-in">
              ${effectInOpts(t.effectIn)}
            </select>
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Animación (Loop)</label>
            <select class="form-control form-control-sm reel-overlay-effect-loop">
              ${effectLoopOpts(t.effectLoop)}
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-top:8px;">
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Salida</label>
            <select class="form-control form-control-sm reel-overlay-effect-out">
              ${effectOutOpts(t.effectOut)}
            </select>
          </div>
          <div>
            <label style="font-size:0.72rem; font-weight:600;">Velocidad</label>
            <select class="form-control form-control-sm reel-overlay-speed">
              ${speedOpts(t.speed)}
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

      card.querySelector('.reel-overlay-effect-in')?.addEventListener('change', (e) => {
        ov.effectIn = e.target.value;
        if (i === S.activeOverlayIdx) previewTextOverlay(i);
        saveState();
      });

      card.querySelector('.reel-overlay-effect-loop')?.addEventListener('change', (e) => {
        ov.effectLoop = e.target.value;
        if (i === S.activeOverlayIdx) previewTextOverlay(i);
        saveState();
      });

      card.querySelector('.reel-overlay-effect-out')?.addEventListener('change', (e) => {
        ov.effectOut = e.target.value;
        if (i === S.activeOverlayIdx) previewTextOverlay(i);
        saveState();
      });

      card.querySelector('.reel-overlay-speed')?.addEventListener('change', (e) => {
        ov.speed = e.target.value;
        if (i === S.activeOverlayIdx) previewTextOverlay(i);
        saveState();
      });

      card.querySelector('.reel-apply-text-style-all')?.addEventListener('click', () => {
        const chosenFont = ov.font || 'archivo';
        const chosenStyle = ov.textStyle || 'yellow';
        const chosenIn = ov.effectIn || 'pop';
        const chosenLoop = ov.effectLoop || 'none';
        const chosenOut = ov.effectOut || 'fade';
        const chosenSpeed = ov.speed || 'normal';
        S.textOverlays.forEach((t) => {
          t.font = chosenFont;
          t.textStyle = chosenStyle;
          t.effectIn = chosenIn;
          t.effectLoop = chosenLoop;
          t.effectOut = chosenOut;
          t.speed = chosenSpeed;
        });
        renderTextOverlays();
        previewTextOverlay(i);
        saveState();
        toast('Tipografía, estilo y efectos aplicados a todos los textos.', 'info');
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
    const first = S.textOverlays.length ? S.textOverlays[0] : null;
    const newOv = normalizeOverlay({
      id: `ov_${Date.now()}`,
      text: 'NUEVO TEXTO',
      start: Math.round(nextStart * 10) / 10,
      end: Math.round(nextEnd * 10) / 10,
      pos: 'center',
      textStyle: first ? first.textStyle : 'yellow',
      font: first ? first.font : 'archivo',
      effectIn: first ? first.effectIn : 'pop',
      effectLoop: first ? first.effectLoop : 'none',
      effectOut: first ? first.effectOut : 'fade',
      speed: first ? first.speed : 'normal'
    });
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
        S.textOverlays = data.map(normalizeOverlay).filter(Boolean);
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
    const tl = buildTimeline();
    if (!tl.items.length) return null;
    const t = Math.max(0, Number(globalSec) || 0);

    for (let i = tl.items.length - 1; i >= 0; i--) {
      const it = tl.items[i];
      if (t >= it.startAt) {
        const sc = S.scenes[it.idx];
        return {
          sceneIdx: it.idx,
          scene: sc,
          offsetInScene: Math.max(0, t - it.startAt),
          item: it
        };
      }
    }
    const first = tl.items[0];
    return {
      sceneIdx: first.idx,
      scene: S.scenes[first.idx],
      offsetInScene: 0,
      item: first
    };
  }

  let previewAnimTimer1 = null;
  let previewAnimTimer2 = null;
  let previewAnimTimer3 = null;
  let previewTwInterval = null;

  function clearActivePreviewTimers() {
    if (previewAnimTimer1) { clearTimeout(previewAnimTimer1); previewAnimTimer1 = null; }
    if (previewAnimTimer2) { clearTimeout(previewAnimTimer2); previewAnimTimer2 = null; }
    if (previewAnimTimer3) { clearTimeout(previewAnimTimer3); previewAnimTimer3 = null; }
    if (previewTwInterval) { clearInterval(previewTwInterval); previewTwInterval = null; }
  }

  function renderLiveOverlay(ov, triggerAnim = false) {
    clearActivePreviewTimers();
    const topEl = $('reel-vp-text-top');
    const centerEl = $('reel-vp-text-center');
    const bottomEl = $('reel-vp-text-bottom');
    if (!topEl || !centerEl || !bottomEl) return;

    topEl.innerHTML = '';
    centerEl.innerHTML = '';
    bottomEl.innerHTML = '';

    if (!ov || !ov.text || !ov.text.trim()) return;

    const norm = normalizeOverlay(ov);
    const targetEl = norm.pos === 'top' ? topEl : norm.pos === 'bottom' ? bottomEl : centerEl;
    const fontClass = `reel-font-${norm.font || 'archivo'}`;

    const badge = document.createElement('div');
    badge.className = `reel-live-caption ${norm.textStyle || 'yellow'} ${fontClass}`;
    const txt = norm.text.trim().toUpperCase();

    if (!triggerAnim) {
      badge.textContent = txt;
      targetEl.appendChild(badge);
      return;
    }

    // "Previsualizar" de un texto reproduce entrada -> 1.5 s de loop -> salida, una vez.
    const { inDur, outDur } = getTiming(norm.start, norm.end, norm.speed);
    badge.style.setProperty('--reel-in-dur', `${inDur}s`);
    badge.style.setProperty('--reel-out-dur', `${outDur}s`);
    targetEl.appendChild(badge);

    const isTwIn = (norm.effectIn === 'typewriter');
    const isWbwIn = (norm.effectIn === 'wordbyword');

    // 1. Entrada
    if (isTwIn) {
      badge.textContent = '';
      const totalChars = txt.length;
      const stepMs = Math.max(16, (inDur * 1000) / totalChars);
      let curChar = 0;
      previewTwInterval = setInterval(() => {
        curChar++;
        badge.textContent = txt.slice(0, curChar);
        if (curChar >= totalChars) {
          clearInterval(previewTwInterval);
          previewTwInterval = null;
        }
      }, stepMs);
    } else if (isWbwIn) {
      badge.textContent = '';
      const words = txt.split(/\s+/).filter(Boolean);
      const stepMs = Math.max(40, (inDur * 1000) / words.length);
      let curWord = 0;
      previewTwInterval = setInterval(() => {
        curWord++;
        badge.textContent = words.slice(0, curWord).join(' ');
        if (curWord >= words.length) {
          clearInterval(previewTwInterval);
          previewTwInterval = null;
        }
      }, stepMs);
    } else {
      badge.textContent = txt;
      if (norm.effectIn && norm.effectIn !== 'none') {
        badge.classList.add(`reel-in-${norm.effectIn}`);
      }
    }

    // 2. Loop continuo durante 1.5s
    previewAnimTimer1 = setTimeout(() => {
      if (isTwIn || isWbwIn) {
        if (previewTwInterval) { clearInterval(previewTwInterval); previewTwInterval = null; }
        badge.textContent = txt;
      }
      if (norm.effectIn && norm.effectIn !== 'none') {
        badge.classList.remove(`reel-in-${norm.effectIn}`);
      }
      if (norm.effectLoop && norm.effectLoop !== 'none') {
        badge.classList.add(`reel-loop-${norm.effectLoop}`);
      }

      // 3. Salida
      previewAnimTimer2 = setTimeout(() => {
        if (norm.effectLoop && norm.effectLoop !== 'none') {
          badge.classList.remove(`reel-loop-${norm.effectLoop}`);
        }

        if (norm.effectOut === 'typewriter') {
          const totalChars = txt.length;
          const stepMs = Math.max(16, (outDur * 1000) / totalChars);
          let remChar = totalChars;
          previewTwInterval = setInterval(() => {
            remChar--;
            badge.textContent = txt.slice(0, Math.max(0, remChar));
            if (remChar <= 0) {
              clearInterval(previewTwInterval);
              previewTwInterval = null;
              targetEl.innerHTML = '';
            }
          }, stepMs);
        } else if (norm.effectOut && norm.effectOut !== 'none') {
          badge.classList.add(`reel-out-${norm.effectOut}`);
          previewAnimTimer3 = setTimeout(() => {
            targetEl.innerHTML = '';
          }, outDur * 1000);
        }
      }, 1500);
    }, inDur * 1000);
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

  function previewClip(idx, startTime = 0) {
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
        vpVideo.currentTime = Number(startTime) || 0;
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
    if (btn) btn.textContent = isPlaying ? 'Pausar' : 'Play';
  }

  function toggleVideoPlay() {
    if (seqPlaying) {
      stopSequence(true);
      return;
    }
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

  let isMuted = false;
  function toggleVideoMute() {
    isMuted = !isMuted;
    const vpVideo = $('reel-vp-video');
    const finalPlayer = $('reel-final-player');
    const activeVideo = (finalPlayer && finalPlayer.style.display !== 'none') ? finalPlayer : vpVideo;
    const btn = $('btn-reel-vp-mute');
    if (activeVideo) activeVideo.muted = isMuted;
    if (seqMusicAudio) seqMusicAudio.muted = isMuted;
    seqVoiceAudios.forEach((va) => { if (va.audio) va.audio.muted = isMuted; });
    if (btn) btn.textContent = isMuted ? 'Muted' : 'Mute';
  }

  function applySceneFrame(sc, el) {
    if (!sc || !el) return;
    const vpBg = $('reel-vp-bg');
    const panCoords = $('reel-pan-coords');
    const panX = sc.panX != null ? sc.panX : 0.5;
    const panY = sc.panY != null ? sc.panY : 0.5;
    const zoom = sc.zoom || 1.0;

    if (panCoords) {
      panCoords.textContent = `X: ${Math.round(panX * 100)}% · Y: ${Math.round(panY * 100)}%`;
    }

    if (sc.fitMode === 'blur') {
      if (vpBg) {
        vpBg.style.backgroundImage = `url("${sc.url}")`;
        vpBg.style.opacity = '1';
      }
      el.style.width = '100%';
      el.style.height = 'auto';
      el.style.objectFit = 'contain';
      el.style.transform = 'none';
    } else {
      if (vpBg) vpBg.style.opacity = '0';
      el.style.width = 'auto';
      el.style.height = '100%';
      el.style.objectFit = 'cover';

      // Cálculo de traslación visual en el viewport de 270x480
      const shiftX = (0.5 - panX) * 120 * zoom;
      const shiftY = (0.5 - panY) * 60 * zoom;
      el.style.transform = `scale(${zoom}) translate(${shiftX}px, ${shiftY}px)`;
    }
  }

  // ── Reproductor de Secuencia Completa en Mini Pantalla ──
  let seqPlaying = false;
  let seqStartTime = 0;
  let seqRafId = null;
  let seqActiveSceneIdx = -1;
  let seqVoiceAudios = [];
  let seqMusicAudio = null;
  let seqPrevOverlaysByPos = {};

  function updateSeqTimeLabel(cur, tot) {
    const timeEl = $('reel-seq-time');
    if (timeEl) {
      timeEl.textContent = `${cur.toFixed(1)} / ${tot.toFixed(1)} s`;
    }
  }

  function startSequence(fromTime = 0) {
    if (!S.scenes.length) return toast('Sube clips y crea tomas primero en el Paso 3.', 'warning');
    const tl = buildTimeline();
    if (tl.total <= 0) return toast('La secuencia no tiene duración.', 'warning');

    stopSequence(false);

    const finalPlayer = $('reel-final-player');
    if (finalPlayer) {
      finalPlayer.pause();
      finalPlayer.style.display = 'none';
    }
    const placeholder = $('reel-vp-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    seqPlaying = true;
    seqActiveSceneIdx = -1;
    seqPrevOverlaysByPos = {};

    $('btn-reel-vp-seq-play')?.style.setProperty('display', 'none');
    $('btn-reel-vp-seq-stop')?.style.setProperty('display', 'inline-block');

    const progressEl = $('reel-seq-progress');
    if (progressEl) {
      progressEl.max = tl.total.toFixed(2);
      progressEl.value = fromTime.toFixed(2);
    }
    updateSeqTimeLabel(fromTime, tl.total);

    // Precargar audios de frases de voz
    seqVoiceAudios = [];
    if ($('reel-use-voice')?.checked && Array.isArray(S.voiceSegments)) {
      const vVol = Number($('reel-voice-vol')?.value) || 1;
      S.voiceSegments.forEach((seg) => {
        if (!seg.url) return;
        const aud = new Audio(seg.url);
        aud.preload = 'auto';
        aud.volume = vVol;
        aud.muted = isMuted;
        let triggered = false;
        if (fromTime >= seg.start) {
          const segDur = seg.duration || 3;
          if (fromTime < seg.start + segDur) {
            aud.currentTime = fromTime - seg.start;
            aud.play().catch(() => {});
            triggered = true;
          } else {
            triggered = true;
          }
        }
        seqVoiceAudios.push({ seg, audio: aud, triggered });
      });
    }

    // Precargar música si está seleccionada
    if (seqMusicAudio) {
      seqMusicAudio.pause();
      seqMusicAudio = null;
    }
    if (S.music && S.music.url) {
      seqMusicAudio = new Audio(S.music.url);
      seqMusicAudio.volume = Number($('reel-music-vol')?.value) || 0.3;
      seqMusicAudio.muted = isMuted;
      const mStart = (Number(S.music.start) || 0) + fromTime;
      seqMusicAudio.currentTime = Math.max(0, mStart);
      seqMusicAudio.play().catch(() => {});
    }

    seqStartTime = performance.now() - fromTime * 1000;

    function tick() {
      if (!seqPlaying) return;
      const now = performance.now();
      const t = (now - seqStartTime) / 1000;

      if (t >= tl.total) {
        stopSequence(true);
        return;
      }

      renderSequenceFrame(t, tl);
      seqRafId = requestAnimationFrame(tick);
    }

    seqRafId = requestAnimationFrame(tick);
  }

  function renderSequenceFrame(t, tl) {
    const progressEl = $('reel-seq-progress');
    if (progressEl) progressEl.value = t.toFixed(2);
    updateSeqTimeLabel(t, tl.total);

    // 1. Toma activa
    let activeItem = tl.items[0];
    for (let i = 0; i < tl.items.length; i++) {
      if (t >= tl.items[i].startAt) {
        activeItem = tl.items[i];
      } else {
        break;
      }
    }

    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const wrap = $('reel-vp-media-wrap');
    const flashEl = $('reel-vp-flash');
    const sc = S.scenes[activeItem.idx];

    if (activeItem.idx !== seqActiveSceneIdx) {
      seqActiveSceneIdx = activeItem.idx;

      const badge = $('reel-active-scene-badge');
      if (badge) badge.textContent = `Toma ${activeItem.idx + 1} (${t.toFixed(1)}s)`;

      if (sc.kind === 'imagen') {
        if (vpVideo) {
          vpVideo.pause();
          vpVideo.style.display = 'none';
        }
        if (vpImg) {
          vpImg.src = sc.url;
          vpImg.style.display = 'block';
          applySceneFrame(sc, vpImg);
        }
      } else {
        if (vpImg) vpImg.style.display = 'none';
        if (vpVideo) {
          vpVideo.src = sc.url;
          vpVideo.style.display = 'block';
          applySceneFrame(sc, vpVideo);
          const vTime = (sc.start || 0) + (t - activeItem.startAt);
          vpVideo.currentTime = Math.max(0, vTime);
          vpVideo.muted = isMuted;
          vpVideo.play().catch(() => {});
        }
      }

      // Transición CSS
      if (wrap) wrap.className = 'reel-viewport-media-wrap';
      if (flashEl) {
        flashEl.className = '';
        flashEl.style.opacity = '0';
      }

      if (activeItem.idx > 0) {
        const tr = activeItem.transition || 'none';
        const transDur = activeItem.transDur || 0.35;

        if (tr === 'fadewhite' || tr === 'fadeblack') {
          if (flashEl) {
            flashEl.style.setProperty('--seq-trans-dur', `${transDur}s`);
            flashEl.className = tr === 'fadewhite' ? 'seq-flash-white' : 'seq-flash-black';
          }
        } else if (tr && tr !== 'none' && wrap) {
          wrap.style.setProperty('--seq-trans-dur', `${transDur}s`);
          wrap.classList.add(`seq-trans-${tr}`);
        }
      }
    } else {
      if (sc && sc.kind !== 'imagen' && vpVideo && !vpVideo.paused) {
        const expectedTime = (sc.start || 0) + (t - activeItem.startAt);
        if (Math.abs(vpVideo.currentTime - expectedTime) > 0.35) {
          vpVideo.currentTime = Math.max(0, expectedTime);
        }
      }
    }

    // 2. Textos activos en t
    const activeByPos = {};
    for (const rawOv of S.textOverlays) {
      const ov = normalizeOverlay(rawOv);
      const s = Number(ov.start) || 0;
      const e = Number(ov.end) || 0;
      if (t >= s && t < e) {
        const pos = ['top', 'bottom'].includes(ov.pos) ? ov.pos : 'center';
        activeByPos[pos] = ov;
      }
    }

    ['top', 'center', 'bottom'].forEach((pos) => {
      const el = $(`reel-vp-text-${pos}`);
      if (!el) return;
      const curOv = activeByPos[pos];
      const prevState = seqPrevOverlaysByPos[pos];

      if (!curOv || !curOv.text || !curOv.text.trim()) {
        if (prevState) {
          el.innerHTML = '';
          delete seqPrevOverlaysByPos[pos];
        }
        return;
      }

      const { inDur, outDur } = getTiming(curOv.start, curOv.end, curOv.speed);
      const tInEnd = curOv.start + inDur;
      const tOut0 = curOv.end - outDur;
      const phase = (t < tInEnd) ? 'in' : (t >= tOut0) ? 'out' : 'loop';
      const fullText = curOv.text.trim().toUpperCase();

      const isTwIn = (curOv.effectIn === 'typewriter');
      const isWbwIn = (curOv.effectIn === 'wordbyword');
      const isTwOut = (curOv.effectOut === 'typewriter');

      let currentDisplayText = fullText;
      if (phase === 'in' && (isTwIn || isWbwIn)) {
        const p = Math.min(1, Math.max(0, (t - curOv.start) / inDur));
        if (isTwIn) {
          const charCount = Math.round(p * fullText.length);
          currentDisplayText = fullText.slice(0, charCount);
        } else if (isWbwIn) {
          const words = fullText.split(/\s+/).filter(Boolean);
          const wordCount = Math.min(words.length, Math.max(1, Math.ceil(p * words.length)));
          currentDisplayText = words.slice(0, wordCount).join(' ');
        }
      } else if (phase === 'out' && isTwOut) {
        const q = Math.min(1, Math.max(0, (t - tOut0) / outDur));
        const rem = Math.max(0, Math.round((1 - q) * fullText.length));
        currentDisplayText = fullText.slice(0, rem);
      }

      let badge = el.querySelector('.reel-live-caption');

      if (!prevState || prevState.id !== curOv.id || !badge) {
        el.innerHTML = '';
        const fontClass = `reel-font-${curOv.font || 'archivo'}`;
        badge = document.createElement('div');
        badge.className = `reel-live-caption ${curOv.textStyle || 'yellow'} ${fontClass}`;
        badge.style.setProperty('--reel-in-dur', `${inDur}s`);
        badge.style.setProperty('--reel-out-dur', `${outDur}s`);
        badge.textContent = currentDisplayText;

        if (phase === 'in' && !isTwIn && !isWbwIn && curOv.effectIn !== 'none') {
          badge.classList.add(`reel-in-${curOv.effectIn}`);
        } else if (phase === 'loop' && curOv.effectLoop !== 'none') {
          badge.classList.add(`reel-loop-${curOv.effectLoop}`);
        } else if (phase === 'out' && !isTwOut && curOv.effectOut !== 'none') {
          badge.classList.add(`reel-out-${curOv.effectOut}`);
        }

        el.appendChild(badge);
        seqPrevOverlaysByPos[pos] = { id: curOv.id, phase, text: curOv.text };
        return;
      }

      // Si cambió de fase
      if (prevState.phase !== phase) {
        badge.className = `reel-live-caption ${curOv.textStyle || 'yellow'} reel-font-${curOv.font || 'archivo'}`;
        badge.style.setProperty('--reel-in-dur', `${inDur}s`);
        badge.style.setProperty('--reel-out-dur', `${outDur}s`);

        if (phase === 'in' && !isTwIn && !isWbwIn && curOv.effectIn !== 'none') {
          badge.classList.add(`reel-in-${curOv.effectIn}`);
        } else if (phase === 'loop' && curOv.effectLoop !== 'none') {
          badge.classList.add(`reel-loop-${curOv.effectLoop}`);
        } else if (phase === 'out' && !isTwOut && curOv.effectOut !== 'none') {
          badge.classList.add(`reel-out-${curOv.effectOut}`);
        }

        seqPrevOverlaysByPos[pos].phase = phase;
      }

      if (isTwIn || isWbwIn || isTwOut) {
        badge.textContent = currentDisplayText;
      }
    });
    seqPrevOverlaysByPos = activeByPos;

    // 3. Frases de Voz
    seqVoiceAudios.forEach((item) => {
      if (!item.triggered && t >= item.seg.start) {
        item.triggered = true;
        const offset = t - item.seg.start;
        item.audio.currentTime = Math.max(0, offset);
        item.audio.volume = Number($('reel-voice-vol')?.value) || 1;
        item.audio.muted = isMuted;
        item.audio.play().catch(() => {});
      }
    });
  }

  function showStaticFrameAtTime(t, tl) {
    if (!tl) tl = buildTimeline();
    const progressEl = $('reel-seq-progress');
    if (progressEl) progressEl.value = t.toFixed(2);
    updateSeqTimeLabel(t, tl.total);

    const found = findSceneAtTime(t);
    if (!found || !found.scene) return;
    const sc = found.scene;
    const vpVideo = $('reel-vp-video');
    const vpImg = $('reel-vp-img');
    const placeholder = $('reel-vp-placeholder');
    const finalPlayer = $('reel-final-player');

    if (finalPlayer) finalPlayer.style.display = 'none';
    if (placeholder) placeholder.style.display = 'none';

    const badge = $('reel-active-scene-badge');
    if (badge) badge.textContent = `Toma ${found.sceneIdx + 1} (${t.toFixed(1)}s)`;

    if (sc.kind === 'imagen') {
      if (vpVideo) {
        vpVideo.pause();
        vpVideo.style.display = 'none';
      }
      if (vpImg) {
        vpImg.src = sc.url;
        vpImg.style.display = 'block';
        applySceneFrame(sc, vpImg);
      }
    } else {
      if (vpImg) vpImg.style.display = 'none';
      if (vpVideo) {
        vpVideo.src = sc.url;
        vpVideo.style.display = 'block';
        applySceneFrame(sc, vpVideo);
        vpVideo.pause();
        vpVideo.currentTime = (sc.start || 0) + (found.offsetInScene || 0);
      }
    }

    const activeByPos = {};
    for (const rawOv of S.textOverlays) {
      const ov = normalizeOverlay(rawOv);
      const s = Number(ov.start) || 0;
      const e = Number(ov.end) || 0;
      if (t >= s && t < e) {
        const pos = ['top', 'bottom'].includes(ov.pos) ? ov.pos : 'center';
        activeByPos[pos] = ov;
      }
    }

    ['top', 'center', 'bottom'].forEach((pos) => {
      const el = $(`reel-vp-text-${pos}`);
      if (!el) return;
      const curOv = activeByPos[pos];
      if (!curOv || !curOv.text || !curOv.text.trim()) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML = '';

      const { inDur, outDur } = getTiming(curOv.start, curOv.end, curOv.speed);
      const tInEnd = curOv.start + inDur;
      const tOut0 = curOv.end - outDur;
      const phase = (t < tInEnd) ? 'in' : (t >= tOut0) ? 'out' : 'loop';
      const fullText = curOv.text.trim().toUpperCase();

      const isTwIn = (curOv.effectIn === 'typewriter');
      const isWbwIn = (curOv.effectIn === 'wordbyword');
      const isTwOut = (curOv.effectOut === 'typewriter');

      let currentDisplayText = fullText;
      if (phase === 'in' && (isTwIn || isWbwIn)) {
        const p = Math.min(1, Math.max(0, (t - curOv.start) / inDur));
        if (isTwIn) {
          const charCount = Math.round(p * fullText.length);
          currentDisplayText = fullText.slice(0, charCount);
        } else if (isWbwIn) {
          const words = fullText.split(/\s+/).filter(Boolean);
          const wordCount = Math.min(words.length, Math.max(1, Math.ceil(p * words.length)));
          currentDisplayText = words.slice(0, wordCount).join(' ');
        }
      } else if (phase === 'out' && isTwOut) {
        const q = Math.min(1, Math.max(0, (t - tOut0) / outDur));
        const rem = Math.max(0, Math.round((1 - q) * fullText.length));
        currentDisplayText = fullText.slice(0, rem);
      }

      const fontClass = `reel-font-${curOv.font || 'archivo'}`;
      const badge = document.createElement('div');
      badge.className = `reel-live-caption ${curOv.textStyle || 'yellow'} ${fontClass}`;
      badge.textContent = currentDisplayText;

      if (phase === 'loop' && curOv.effectLoop !== 'none') {
        badge.classList.add(`reel-loop-${curOv.effectLoop}`);
      } else if (phase === 'in' && !isTwIn && !isWbwIn && curOv.effectIn !== 'none') {
        badge.classList.add(`reel-in-${curOv.effectIn}`);
      } else if (phase === 'out' && !isTwOut && curOv.effectOut !== 'none') {
        badge.classList.add(`reel-out-${curOv.effectOut}`);
      }

      el.appendChild(badge);
    });
  }

  function stopSequence(resetToActiveScene = true) {
    if (seqRafId) {
      cancelAnimationFrame(seqRafId);
      seqRafId = null;
    }
    seqPlaying = false;

    seqVoiceAudios.forEach((item) => {
      if (item.audio) {
        item.audio.pause();
        item.audio.currentTime = 0;
      }
    });
    seqVoiceAudios = [];

    if (seqMusicAudio) {
      seqMusicAudio.pause();
      seqMusicAudio = null;
    }

    const wrap = $('reel-vp-media-wrap');
    if (wrap) wrap.className = 'reel-viewport-media-wrap';
    const flashEl = $('reel-vp-flash');
    if (flashEl) {
      flashEl.className = '';
      flashEl.style.opacity = '0';
    }

    $('btn-reel-vp-seq-play')?.style.setProperty('display', 'inline-block');
    $('btn-reel-vp-seq-stop')?.style.setProperty('display', 'none');

    if (resetToActiveScene && S.scenes.length) {
      const idx = (S.activeSceneIdx >= 0 && S.activeSceneIdx < S.scenes.length) ? S.activeSceneIdx : 0;
      selectSceneForFrame(idx);
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
        if (seqPlaying) return;
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

  // ── Paso 5: Música, Voz y Render ──
  function renderVoices() {
    const sel = $('reel-voice');
    if (!sel || !S.voices.length) return;
    sel.innerHTML = S.voices.map((v) =>
      `<option value="${v.id}" ${v.id === S.voice ? 'selected' : ''}>${esc(v.label)} — ${esc(v.desc)}</option>`
    ).join('');
  }

  let currentVoiceAudio = null;

  async function listenVoiceSegment(idx, btn) {
    const seg = S.voiceSegments[idx];
    if (!seg) return;
    const text = (seg.text || '').trim();
    if (!text) return toast('Escribe texto en la frase para escucharla.', 'warning');

    if (currentVoiceAudio) {
      try { currentVoiceAudio.pause(); } catch (_) {}
      currentVoiceAudio = null;
    }

    if (seg.url) {
      currentVoiceAudio = new Audio(seg.url);
      currentVoiceAudio.play().catch(() => toast('No se pudo reproducir el audio.', 'warning'));
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generando...';
    }
    try {
      const data = await api('/reel/voice', {
        text,
        voice: S.voice,
        style: $('reel-voice-style')?.value || ''
      });
      seg.url = data.url;
      seg.duration = data.duration;
      saveState();
      renderVoiceSegments();
      currentVoiceAudio = new Audio(data.url);
      currentVoiceAudio.play().catch(() => {});
    } catch (err) {
      toast('Error sintetizando frase: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Generar y escuchar';
      }
    }
  }

  function splitScriptIntoPhrases(script) {
    if (!script || typeof script !== 'string') return [];
    const rawPhrases = script
      .split(/[\r\n.!?]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (!rawPhrases.length) return [];

    let currentStart = 0;
    return rawPhrases.map((phrase) => {
      const startSec = Math.round(currentStart * 10) / 10;
      const wordsCount = phrase.split(/\s+/).filter(Boolean).length;
      const estimatedDur = (wordsCount / 2.6) + 0.3;
      currentStart = startSec + estimatedDur;

      return {
        id: `vseg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        text: phrase,
        start: startSec,
        duration: null,
        url: null
      };
    });
  }

  function renderVoiceSegments() {
    const list = $('reel-voice-segments-list');
    const wBox = $('reel-voice-warnings');
    if (!list) return;

    if (!Array.isArray(S.voiceSegments)) S.voiceSegments = [];

    // Validaciones visuales y advertencias
    const warnings = [];
    const tl = buildTimeline();
    const totalDur = tl.total || totalSeconds();

    for (let i = 0; i < S.voiceSegments.length; i++) {
      const seg = S.voiceSegments[i];
      const nextSeg = S.voiceSegments[i + 1];
      if (seg.duration != null && nextSeg != null) {
        const segEnd = (Number(seg.start) || 0) + seg.duration;
        const nextStart = Number(nextSeg.start) || 0;
        if (segEnd > nextStart) {
          const diff = (segEnd - nextStart).toFixed(1);
          warnings.push(`La frase ${i + 1} se solapará con la frase ${i + 2} por ${diff} s. Retrasa el inicio de la frase ${i + 2}.`);
        }
      }
    }

    if (S.voiceSegments.length > 0) {
      let maxVoiceEnd = 0;
      for (const s of S.voiceSegments) {
        const sStart = Number(s.start) || 0;
        const sDur = s.duration || 0;
        const end = sStart + sDur;
        if (end > maxVoiceEnd) maxVoiceEnd = end;
      }
      if (totalDur > 0 && maxVoiceEnd > totalDur) {
        const extra = (maxVoiceEnd - totalDur).toFixed(1);
        warnings.push(`El video se extenderá automáticamente ${extra} s para terminar la locución.`);
      }
    }

    if (wBox) {
      if (warnings.length > 0) {
        wBox.innerHTML = warnings.map((w) => `<div class="reel-voice-warning-box">⚠️ ${esc(w)}</div>`).join('');
        wBox.style.display = 'block';
      } else {
        wBox.innerHTML = '';
        wBox.style.display = 'none';
      }
    }

    if (!S.voiceSegments.length) {
      list.innerHTML = '<div class="reel-empty" style="font-size:0.75rem; padding:8px 12px;">Sin frases configuradas. Escribe un guion arriba y pulsa "Dividir en frases" o agrega una frase manualmente.</div>';
      return;
    }

    list.innerHTML = '';
    S.voiceSegments.forEach((seg, idx) => {
      const row = document.createElement('div');
      row.className = 'reel-voice-seg-row';
      row.dataset.idx = idx;

      const nextSeg = S.voiceSegments[idx + 1];
      let isOverlap = false;
      if (seg.duration != null && nextSeg != null) {
        const segEnd = (Number(seg.start) || 0) + seg.duration;
        const nextStart = Number(nextSeg.start) || 0;
        if (segEnd > nextStart) isOverlap = true;
      }

      row.innerHTML = `
        <textarea class="form-control reel-voice-seg-text" rows="2" placeholder="Texto de la frase...">${esc(seg.text || '')}</textarea>
        <div class="reel-voice-seg-bottom">
          <div class="reel-voice-seg-start-wrap">
            <label>Inicio (s):</label>
            <input type="number" class="form-control form-control-sm reel-voice-seg-start" min="0" max="120" step="0.1" value="${Number(seg.start) || 0}">
            ${seg.duration != null
              ? `<span class="reel-voice-dur-badge ${isOverlap ? 'overlap' : ''}">${seg.duration.toFixed(1)} s</span>`
              : '<span class="reel-voice-dur-badge" style="opacity:0.6;">sin generar</span>'}
          </div>
          <div class="reel-voice-seg-actions">
            <button type="button" class="btn btn-secondary btn-xs btn-reel-seg-listen" data-idx="${idx}">Generar y escuchar</button>
            <button type="button" class="btn btn-ghost btn-xs btn-reel-seg-del" data-idx="${idx}" style="color:var(--accent-rose, #ef4444);">Quitar</button>
          </div>
        </div>
      `;

      const txt = row.querySelector('.reel-voice-seg-text');
      txt?.addEventListener('input', (e) => {
        seg.text = e.target.value;
        seg.url = null;
        seg.duration = null;
        saveState();
        const badge = row.querySelector('.reel-voice-dur-badge');
        if (badge) {
          badge.textContent = 'sin generar';
          badge.className = 'reel-voice-dur-badge';
          badge.style.opacity = '0.6';
        }
      });
      txt?.addEventListener('blur', () => {
        renderVoiceSegments();
      });

      const startInput = row.querySelector('.reel-voice-seg-start');
      startInput?.addEventListener('change', (e) => {
        const val = Math.max(0, parseFloat(e.target.value) || 0);
        seg.start = Math.round(val * 10) / 10;
        saveState();
        renderVoiceSegments();
      });

      row.querySelector('.btn-reel-seg-listen')?.addEventListener('click', (e) => {
        listenVoiceSegment(idx, e.currentTarget);
      });

      row.querySelector('.btn-reel-seg-del')?.addEventListener('click', () => {
        S.voiceSegments.splice(idx, 1);
        saveState();
        renderVoiceSegments();
      });

      list.appendChild(row);
    });
  }

  function addVoiceSegment() {
    if (!Array.isArray(S.voiceSegments)) S.voiceSegments = [];
    let nextStart = 0;
    if (S.voiceSegments.length > 0) {
      const last = S.voiceSegments[S.voiceSegments.length - 1];
      const lastStart = Number(last.start) || 0;
      const wordsCount = (last.text || '').split(/\s+/).filter(Boolean).length;
      const lastDur = last.duration != null ? last.duration : ((wordsCount / 2.6) + 0.3);
      nextStart = Math.round((lastStart + lastDur) * 10) / 10;
    } else {
      nextStart = 0;
    }
    S.voiceSegments.push({
      id: `vseg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: '',
      start: nextStart,
      duration: null,
      url: null
    });
    saveState();
    renderVoiceSegments();
  }

  function invalidateAllVoiceSegments() {
    if (!Array.isArray(S.voiceSegments)) return;
    let changed = false;
    S.voiceSegments.forEach((s) => {
      if (s.url || s.duration != null) {
        s.url = null;
        s.duration = null;
        changed = true;
      }
    });
    if (changed) {
      saveState();
      renderVoiceSegments();
    }
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
      if (info) info.textContent = `Voz lista (${data.duration.toFixed(1)} s).`;
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
    const useVoice = $('reel-use-voice')?.checked;

    setBusy('btn-reel-render', true, 'Renderizando reel en Contabo...');
    toast('Procesando video con FFmpeg: encuadres, transiciones y audio...', 'info');

    try {
      const voiceSegmentsPayload = [];

      if (useVoice) {
        // Si no se dividió en frases pero hay texto en voiceover, dividir automáticamente
        if ((!S.voiceSegments || !S.voiceSegments.length) && S.voiceover.trim()) {
          S.voiceSegments = splitScriptIntoPhrases(S.voiceover);
          renderVoiceSegments();
        }

        const activeSegs = (S.voiceSegments || []).filter((s) => s.text && s.text.trim());
        if (activeSegs.length > 0) {
          const style = $('reel-voice-style')?.value || '';
          for (let i = 0; i < activeSegs.length; i++) {
            const seg = activeSegs[i];
            if (!seg.url) {
              toast(`Sintetizando locución (frase ${i + 1}/${activeSegs.length})...`, 'info');
              const v = await api('/reel/voice', {
                text: seg.text.trim(),
                voice: S.voice,
                style
              });
              seg.url = v.url;
              seg.duration = v.duration;
            }
            voiceSegmentsPayload.push({
              url: seg.url,
              start: Number(seg.start) || 0
            });
          }
          saveState();
          renderVoiceSegments();
        }
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
        textOverlays: S.textOverlays.map((ov) => {
          const n = normalizeOverlay(ov);
          return {
            text: n.text,
            start: Number(n.start) || 0,
            end: Number(n.end) || 3,
            pos: n.pos || 'center',
            textStyle: n.textStyle || 'yellow',
            font: n.font || 'archivo',
            effectIn: n.effectIn,
            effectLoop: n.effectLoop,
            effectOut: n.effectOut,
            speed: n.speed,
            effect: n.effectIn
          };
        }),
        voice_segments: voiceSegmentsPayload,
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

    // Casilla "Analizar con IA al subir": recordar la preferencia
    const autoChk = $('reel-auto-analyze');
    if (autoChk) {
      try { autoChk.checked = localStorage.getItem('reel_auto_analyze') !== 'false'; } catch (e) { /* sin storage */ }
      autoChk.addEventListener('change', () => {
        try { localStorage.setItem('reel_auto_analyze', autoChk.checked ? 'true' : 'false'); } catch (e) { /* sin storage */ }
      });
    }

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
    $('btn-reel-voice-split')?.addEventListener('click', () => {
      const text = ($('reel-voiceover')?.value || '').trim();
      if (!text) return toast('Escribe o genera un guion primero.', 'warning');
      if (S.voiceSegments && S.voiceSegments.length > 0) {
        if (!confirm('Ya tienes frases configuradas. ¿Deseas reemplazarlas por la división del guion actual?')) {
          return;
        }
      }
      S.voiceSegments = splitScriptIntoPhrases(text);
      saveState();
      renderVoiceSegments();
      toast(`${S.voiceSegments.length} frase(s) creada(s). Ajusta los segundos de inicio.`, 'info');
    });
    $('btn-reel-voice-add-seg')?.addEventListener('click', addVoiceSegment);
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
      invalidateAllVoiceSegments();
      saveState();
    });
    $('reel-voice-style')?.addEventListener('input', () => {
      invalidateAllVoiceSegments();
      saveState();
    });
    $('reel-voiceover')?.addEventListener('input', () => {
      S.voiceUrl = '';
      saveState();
    });
    $('reel-use-voice')?.addEventListener('change', saveState);
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
    $('btn-reel-vp-seq-play')?.addEventListener('click', () => startSequence(0));
    $('btn-reel-vp-seq-stop')?.addEventListener('click', () => stopSequence(false));

    const seqProgress = $('reel-seq-progress');
    if (seqProgress) {
      seqProgress.addEventListener('input', (e) => {
        const targetSec = parseFloat(e.target.value) || 0;
        if (seqPlaying) {
          stopSequence(false);
        }
        showStaticFrameAtTime(targetSec);
      });
    }

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
    renderVoiceSegments();

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
