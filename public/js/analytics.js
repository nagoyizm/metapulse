// =============================================================================
// MetaPulse Analytics & Charts Controller (Impeccable Theme Edition)
// =============================================================================

window.currentAdvancedData = null;

function isDark() {
  return document.body.classList.contains('dark-theme');
}

function setKpiValue(elementId, value, formatter) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (value !== null && value !== undefined && value !== '') {
    el.textContent = formatter ? formatter(value) : value;
    el.removeAttribute('title');
  } else {
    el.textContent = '—';
    el.title = 'Sin datos de Meta para este periodo';
  }
}

function drawCanvasEmptyState(ctx, width, height, message = 'Aún no hay datos suficientes de Meta para graficar este periodo') {
  const dark = isDark();
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
  ctx.font = '13px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
}

window.loadAnalyticsData = async function () {
  try {
    let insightsData = null;

    // 1. Cargar métricas e insights generales
    try {
      const res = await fetch('/api/meta/insights');
      const json = await res.json();
      if (json.success && json.data) {
        insightsData = json.data;
      }
    } catch (e) {
      console.warn('Error fetching insights:', e);
    }

    const isSimulated = Boolean(insightsData && insightsData.simulated === true);

    if (isSimulated) {
      ['kpi-reach', 'kpi-impressions', 'kpi-followers', 'kpi-engagement'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = '—';
          el.title = 'Modo simulación: sin datos reales de Meta';
        }
      });
    } else if (insightsData) {
      const summary = insightsData.summary || {};
      const fb = insightsData.facebook || {};
      const ig = insightsData.instagram || {};

      // Alcance Total: summary.reach o la suma calculada real
      let reach = summary.reach;
      if (reach == null && (fb.weeklyReach != null || ig.reach != null)) {
        reach = (fb.weeklyReach || 0) + (ig.reach || 0);
      }

      // Impresiones: summary.impressions o impresiones disponibles
      let impressions = summary.impressions;
      if (impressions == null && (ig.weeklyImpressions != null || fb.pageImpressions != null)) {
        impressions = (ig.weeklyImpressions || 0) + (fb.pageImpressions || 0);
      }

      // Crecimiento Seguidores: summary.followersGrowth o total seguidores
      let followersGrowth = summary.followersGrowth;
      if (followersGrowth == null) {
        if (summary.followers != null) {
          followersGrowth = summary.followers;
        } else if (fb.pageFollowers != null || ig.followers != null) {
          followersGrowth = (fb.pageFollowers || 0) + (ig.followers || 0);
        }
      }

      // Engagement Rate: summary.engagementRate o de facebook
      let engagementRate = summary.engagementRate;
      if (engagementRate == null && fb.engagementRate != null) {
        engagementRate = fb.engagementRate;
      }

      setKpiValue('kpi-reach', reach, val => typeof val === 'number' ? val.toLocaleString() : val);
      setKpiValue('kpi-impressions', impressions, val => typeof val === 'number' ? Math.round(val).toLocaleString() : val);
      setKpiValue('kpi-followers', followersGrowth, val => typeof val === 'number' ? val.toLocaleString() : val);
      setKpiValue('kpi-engagement', engagementRate, val => typeof val === 'number' ? `${val}%` : val);
    } else {
      setKpiValue('kpi-reach', null);
      setKpiValue('kpi-impressions', null);
      setKpiValue('kpi-followers', null);
      setKpiValue('kpi-engagement', null);
    }

    // 2. Cargar analíticas avanzadas (Top Post, Mejores Horas, Desglose de Formatos)
    const advancedData = await loadAdvancedInsights();

    // Dibujar Gráficos con datos reales o estado vacío
    if (isSimulated) {
      drawReachChart(null, null, null, 'Modo simulación: sin datos reales');
      drawEngagementChart(null, null, 'Modo simulación: sin datos reales');
    } else {
      if (insightsData?.chartLabels && insightsData?.reachData) {
        drawReachChart(insightsData.chartLabels, insightsData.reachData, insightsData.impressionsData);
      } else if (insightsData?.facebook?.chartData) {
        const labels = insightsData.facebook.chartData.map(c => c.day);
        const reach = insightsData.facebook.chartData.map(c => c.reach || c.value || 0);
        const imp = insightsData.facebook.chartData.map(c => c.impressions || 0);
        drawReachChart(labels, reach, imp);
      } else {
        drawReachChart(null, null, null);
      }

      if (insightsData?.chartLabels && insightsData?.engagementData) {
        drawEngagementChart(insightsData.chartLabels, insightsData.engagementData);
      } else if (advancedData?.dailyActivity && Object.values(advancedData.dailyActivity).some(v => v > 0)) {
        drawEngagementChart(Object.keys(advancedData.dailyActivity), Object.values(advancedData.dailyActivity));
      } else if (insightsData?.facebook?.chartData) {
        const labels = insightsData.facebook.chartData.map(c => c.day);
        const eng = insightsData.facebook.chartData.map(c => c.engagement || c.likes || 0);
        drawEngagementChart(labels, eng);
      } else {
        drawEngagementChart(null, null);
      }
    }

    // 3. Cargar comparativa A/B de Horarios
    await loadScheduleAnalytics();
  } catch (err) {
    console.error('Error cargando analíticas:', err);
  }
};

async function loadAdvancedInsights() {
  try {
    const res = await fetch('/api/meta/advanced-insights');
    const json = await res.json();
    if (!json.success || !json.data) return null;

    const data = json.data;
    window.currentAdvancedData = data;

    // A. Renderizar Top Post
    const topPost = data.topPost;
    if (topPost) {
      const titleEl = document.getElementById('top-post-title');
      const captionEl = document.getElementById('top-post-caption');
      const likesBadge = document.getElementById('top-post-likes-badge');
      const commentsBadge = document.getElementById('top-post-comments-badge');
      const typeBadge = document.getElementById('top-post-type-badge');
      const imgEl = document.getElementById('top-post-img');
      const placeholderIcon = document.getElementById('top-post-placeholder-icon');

      if (titleEl) titleEl.textContent = topPost.title || 'Publicación sin título';
      if (captionEl) captionEl.textContent = topPost.caption || 'Sin texto descriptivo';
      if (likesBadge) likesBadge.textContent = `❤️ ${topPost.likes} me gusta`;
      if (commentsBadge) commentsBadge.textContent = `💬 ${topPost.comments} Comentarios`;
      if (typeBadge) {
        const isVideo = topPost.mediaType === 'VIDEO';
        typeBadge.textContent = isVideo ? '🎥 Reel / video' : '📸 Foto / Feed';
        typeBadge.style.color = isVideo ? '#a855f7' : '#ea580c';
        typeBadge.style.background = isVideo ? 'rgba(168,85,247,0.12)' : 'rgba(234,88,12,0.12)';
      }

      if (imgEl && topPost.mediaUrl) {
        imgEl.src = topPost.mediaUrl;
        imgEl.style.display = 'block';
        if (placeholderIcon) placeholderIcon.style.display = 'none';
      } else if (placeholderIcon) {
        placeholderIcon.style.display = 'block';
        if (imgEl) imgEl.style.display = 'none';
      }

      const btnReuse = document.getElementById('btn-top-post-reuse');
      if (btnReuse) {
        btnReuse.onclick = () => {
          if (window.reusePost && topPost.id) {
            window.reusePost(topPost.id);
          } else {
            const contentInput = document.getElementById('post-content');
            if (contentInput) contentInput.value = topPost.caption;
            if (typeof navigateToTab === 'function') {
              navigateToTab('composer');
            } else if (window.switchTab) {
              window.switchTab('composer');
            }
            showToast('Post cargado en el editor', 'success');
          }
        };
      }

      const btnStory = document.getElementById('btn-top-post-story');
      if (btnStory) {
        btnStory.onclick = () => {
          if (window.repostAsStory && topPost.id) {
            window.repostAsStory(topPost.id);
          } else {
            showToast('Convierte este post desde la Cola & Historial', 'info');
          }
        };
      }
    }

    // B. Renderizar Mejores Horas
    const windowsList = document.getElementById('best-windows-list');
    if (windowsList && data.bestWindows) {
      windowsList.innerHTML = data.bestWindows.map(w => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-subtle); padding:10px 12px; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700; font-size:0.86rem; color:var(--text-primary);">${w.day} (${w.timeWindow})</span>
              <span class="badge" style="background:var(--primary-subtle); color:var(--accent-brand-text); font-size:0.7rem; padding:1px 6px;">${w.tag}</span>
            </div>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${w.reason}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.applyBestSlot('${w.day}', '${w.timeWindow}')" style="font-size:0.72rem; padding:4px 8px;">
            🎯 Usar
          </button>
        </div>
      `).join('');
    }

    // C. Renderizar Formatos
    if (data.formatBreakdown) {
      const winnerBadge = document.getElementById('format-winner-badge');
      if (winnerBadge) {
        winnerBadge.textContent = `🏆 Ganador: ${data.formatBreakdown.winner}`;
      }

      const vidLikes = document.getElementById('fmt-video-avg-likes');
      if (vidLikes) vidLikes.textContent = `${data.formatBreakdown.video?.avgLikes || 0} likes prom.`;

      const carLikes = document.getElementById('fmt-carousel-avg-likes');
      if (carLikes) carLikes.textContent = `${data.formatBreakdown.carousel?.avgLikes || 0} likes prom.`;

      const imgLikes = document.getElementById('fmt-image-avg-likes');
      if (imgLikes) imgLikes.textContent = `${data.formatBreakdown.image?.avgLikes || 0} likes prom.`;
    }

    return data;
  } catch (err) {
    console.warn('Error cargando advanced insights:', err.message);
    return null;
  }
}

// =============================================================================
// COMPARATIVA DE HORARIOS & PRUEBAS A/B
// =============================================================================
async function loadScheduleAnalytics() {
  try {
    const res = await fetch('/api/meta/schedule-analytics');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const { presets, winner, winnerReason, timeSlotsHeatmap } = json.data;

    // 1. Badge de Ganador
    const winnerBadge = document.getElementById('schedule-winner-badge');
    if (winnerBadge) {
      winnerBadge.textContent = `🏆 Horario Ganador: ${winner}`;
    }

    // 2. Texto de diagnóstico
    const insightText = document.getElementById('schedule-ab-insight-text');
    if (insightText) {
      insightText.innerHTML = `<strong>Diagnóstico del Algoritmo:</strong> ${winnerReason}`;
    }

    // 3. Grid de Presets
    const grid = document.getElementById('schedule-presets-comparison-grid');
    if (grid && Array.isArray(presets)) {
      grid.innerHTML = presets.map(p => {
        const isWinner = Boolean(p.isWinner);
        const isActive = Boolean(p.isActive);

        return `
          <div style="background:var(--bg-surface-subtle); border: 2px solid ${isWinner ? '#10b981' : 'var(--border-subtle)'}; border-radius:var(--radius-xs); padding:16px; display:flex; flex-direction:column; justify-content:space-between; position:relative; box-shadow:${isWinner ? '0 4px 12px rgba(16,185,129,0.12)' : 'none'};">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px;">
                <div>
                  <h4 style="margin:0 0 4px 0; font-size:0.95rem; color:var(--text-primary); font-weight:700;">${p.name}</h4>
                  <span style="font-size:0.75rem; color:var(--text-secondary);">${p.description || 'Configuración de horario semanal'}</span>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                  ${isWinner ? '<span class="badge" style="background:#10b981; color:#fff; font-size:0.7rem; padding:2px 8px; font-weight:700;">🏆 Mejor Rendimiento</span>' : ''}
                  ${isActive ? '<span class="badge" style="background:rgba(99,102,241,0.15); color:var(--primary); font-size:0.68rem; padding:2px 6px;">Vigente Activo</span>' : ''}
                </div>
              </div>

              <!-- Métricas Grid -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; background:var(--bg-surface); padding:10px; border-radius:6px; border:1px solid var(--border-subtle);">
                <div>
                  <span style="font-size:0.72rem; color:var(--text-secondary); display:block;">Alcance Promedio:</span>
                  <strong style="font-size:1.1rem; color:var(--text-primary);">${p.avgReach.toLocaleString()}</strong>
                </div>
                <div>
                  <span style="font-size:0.72rem; color:var(--text-secondary); display:block;">Interacción (ER):</span>
                  <strong style="font-size:1.1rem; color:#10b981;">${p.engagementRate != null ? p.engagementRate : '—'}</strong>
                </div>
                <div>
                  <span style="font-size:0.72rem; color:var(--text-secondary); display:block;">Likes Promedio:</span>
                  <span style="font-size:0.85rem; font-weight:600;">❤️ ${p.avgLikes}</span>
                </div>
                <div>
                  <span style="font-size:0.72rem; color:var(--text-secondary); display:block;">Comentarios:</span>
                  <span style="font-size:0.85rem; font-weight:600;">💬 ${p.avgComments}</span>
                </div>
              </div>

              <!-- Días y Horas -->
              <div style="margin-bottom:12px;">
                <span style="font-size:0.72rem; color:var(--text-secondary); display:block; margin-bottom:4px;">Horas configuradas:</span>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">
                  ${(p.slotsList || []).map(s => `
                    <span class="badge" style="background:rgba(255,255,255,0.06); border:1px solid var(--border-subtle); color:var(--text-primary); font-size:0.7rem; padding:2px 6px;">${s}</span>
                  `).join('')}
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--border-subtle); margin-top:8px;">
              <span style="font-size:0.75rem; color:var(--text-secondary);">
                <strong>${p.postsCount}</strong> posts probados
              </span>
              ${!isActive ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.activatePresetFromAnalytics(${p.id})" style="font-size:0.75rem; padding:4px 10px;">
                  ⚡ Activar Horario
                </button>
              ` : '<span style="font-size:0.75rem; color:#10b981; font-weight:600;">En uso ahora ✅</span>'}
            </div>
          </div>
        `;
      }).join('');
    }

    // 4. Franjas Horarias Heatmap List
    const heatmapEl = document.getElementById('schedule-ab-heatmap-list');
    if (heatmapEl && Array.isArray(timeSlotsHeatmap)) {
      heatmapEl.innerHTML = timeSlotsHeatmap.map(slot => `
        <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:6px; padding:10px 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:0.82rem; color:var(--text-primary);">${slot.window}</strong>
            <span class="badge" style="background:rgba(16,185,129,0.12); color:#047857; font-size:0.68rem; padding:2px 6px;">${slot.score}</span>
          </div>
          <div style="font-size:0.74rem; color:var(--accent-brand-text); font-weight:600; margin-bottom:2px;">${slot.day}</div>
          <div style="font-size:0.72rem; color:var(--text-secondary);">${slot.tip}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Error cargando analítica A/B de horarios:', err.message);
  }
}

window.activatePresetFromAnalytics = async function (presetId) {
  try {
    const res = await fetch(`/api/schedule-presets/${presetId}/activate`, { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      await loadScheduleAnalytics();
      if (typeof window.loadScheduleSlots === 'function') {
        window.loadScheduleSlots();
      }
    } else {
      showToast('Error: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Error al activar horario: ' + err.message, 'error');
  }
};

// Acción de agendar en el slot sugerido (applyBestSlot)
window.applyBestSlot = function (day, timeWindow) {
  const dayStr = String(day || '').toLowerCase().trim();
  const timeStr = String(timeWindow || '').trim();

  const dayMap = {
    'domingo': 0, 'dom': 0,
    'lunes': 1, 'lun': 1,
    'martes': 2, 'mar': 2,
    'miércoles': 3, 'miercoles': 3, 'mié': 3, 'mie': 3,
    'jueves': 4, 'jue': 4,
    'viernes': 5, 'vie': 5,
    'sábado': 6, 'sabado': 6, 'sáb': 6, 'sab': 6
  };

  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  const targetDay = dayMap[dayStr];

  if (targetDay === undefined || !timeMatch) {
    const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
    if (toastFn) {
      toastFn(`Ventana sugerida: ${day} a las ${timeWindow}. Redirigiendo al editor...`);
    }
    if (typeof navigateToTab === 'function') {
      navigateToTab('composer');
    } else if (typeof window.switchTab === 'function') {
      window.switchTab('composer');
    }
    return;
  }

  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const now = new Date();

  let daysUntil = (targetDay - now.getDay() + 7) % 7;
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntil, hour, minute, 0, 0);

  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  const pad = n => String(n).padStart(2, '0');
  const formattedIso = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;

  // Seleccionar radio 'custom' en la sección de programación
  const radio = document.querySelector('input[name="schedule_option"][value="custom"]') ||
                document.querySelector('input[name="schedule-type"][value="custom"]');
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('input', { bubbles: true }));
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelectorAll('.schedule-radio').forEach(sr => {
      sr.classList.toggle('active', sr.querySelector('input')?.value === 'custom');
    });
  }

  const customDateContainer = document.getElementById('custom-date-container');
  if (customDateContainer) {
    customDateContainer.style.display = 'block';
  }

  // Establecer fecha y disparar eventos 'input' y 'change'
  const dateInput = document.getElementById('custom-schedule-datetime') ||
                    document.getElementById('schedule-custom-date') ||
                    document.querySelector('input[name="schedule_custom_date"]') ||
                    document.querySelector('input[name="schedule-custom-date"]');
  if (dateInput) {
    dateInput.value = formattedIso;
    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Redirigir a pestaña composer
  if (typeof navigateToTab === 'function') {
    navigateToTab('composer');
  } else if (typeof window.switchTab === 'function') {
    window.switchTab('composer');
  }

  const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
  if (toastFn) {
    toastFn(`Horario programado: ${day} a las ${pad(hour)}:${pad(minute)} (${targetDate.toLocaleDateString()})`, 'success');
  }
};

// ==========================================
// AUDITORÍA ESTRATÉGICA CON IA
// ==========================================
window.triggerAIAudit = async function () {
  const cardEl = document.getElementById('card-ai-audit');
  const contentEl = document.getElementById('ai-audit-content');
  const providerBadge = document.getElementById('ai-audit-provider-badge');

  if (!cardEl || !contentEl) return;

  cardEl.style.display = 'block';
  contentEl.innerHTML = `
    <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
      <div style="font-size: 1.8rem; margin-bottom: 10px; animation: pulse 1.5s infinite;">✨</div>
      <p style="font-weight: 600; color: var(--text-primary); margin: 0 0 4px 0;">Consultando al Estratega de Crecimiento en Meta...</p>
      <p style="font-size: 0.8rem; margin: 0;">Analizando historial, retención de ganchos, dinámicas de Shares por DM y algoritmo actual.</p>
    </div>
  `;

  cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const brandName = activeAcc?.pageName || 'tu marca';
    const dynamicFocus = `Maximizar alcance orgánico, retención y conversiones para la cuenta ${brandName}`;

    const res = await fetch('/api/meta/ai-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customFocus: dynamicFocus
      })
    });

    const json = await res.json();
    if (!json.success || !json.data?.audit) {
      throw new Error(json.error || 'No se pudo generar la auditoría.');
    }

    const audit = json.data.audit;
    if (providerBadge) {
      providerBadge.textContent = audit.provider === 'gemini' ? `Gemini (${audit.model || 'Flash'})` : 'Inteligente (Heurístico)';
    }

    let fullHtml = renderMarkdown(audit.auditMarkdown);

    if (audit.actionableStrategies && audit.actionableStrategies.length > 0) {
      fullHtml += `
        <div style="margin-top:24px; border-top:1px solid var(--border-subtle); padding-top:20px;">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.3rem;">⚡</span>
              <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">
                Estrategias Desarrolladas Listas para Ejecutar
              </h3>
            </div>
            <span class="badge" style="background:var(--primary-subtle); color:var(--accent-brand-text); font-weight:700; font-size:0.75rem; padding:3px 10px; border-radius:12px;">
              ${audit.actionableStrategies.length} Opciones Listas
            </span>
          </div>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:0; margin-bottom:16px;">
            Cada recomendación del diagnóstico tiene su propuesta completamente redactada. Haz clic en <strong>"Llevar al Editor"</strong> para cargarla directamente con su copy, formato y gancho en el Composer:
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px;">
            ${audit.actionableStrategies.map(strat => {
              const stratJson = encodeURIComponent(JSON.stringify(strat));
              const formatEmoji = strat.format === 'reel' ? '🎥 Reel' : strat.format === 'story' ? '📲 Story (9:16)' : strat.format === 'carousel' ? '🖼️ Carrusel' : '📸 Post (4:5)';
              return `
                <div class="card" style="background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-sm);">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
                      <span class="badge" style="background:var(--primary-subtle); color:var(--accent-brand-text); font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:10px;">
                        ${formatEmoji}
                      </span>
                      <span class="badge" style="background:rgba(59,130,246,0.12); color:#3b82f6; font-size:0.7rem; font-weight:600; padding:2px 8px; border-radius:10px;">
                        ⏰ ${strat.scheduleHint || 'Óptimo'}
                      </span>
                    </div>

                    <h4 style="margin:0 0 6px 0; font-size:0.92rem; font-weight:800; color:var(--text-primary); line-height:1.35;">
                      ${strat.title}
                    </h4>

                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:8px 10px; margin-bottom:10px;">
                      <div style="font-size:0.72rem; font-weight:700; color:var(--primary); margin-bottom:3px;">
                        🎯 Objetivo Algorítmico:
                      </div>
                      <div style="font-size:0.76rem; color:var(--text-secondary); line-height:1.35;">
                        ${strat.algorithmicGoal || strat.whyThisWorks}
                      </div>
                    </div>

                    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:10px; margin-bottom:12px;">
                      <div style="font-size:0.72rem; font-weight:700; color:var(--text-secondary); margin-bottom:4px;">
                        📝 Copy y Estructura:
                      </div>
                      <p style="font-size:0.78rem; line-height:1.45; color:var(--text-primary); margin:0; white-space:pre-line; max-height:110px; overflow-y:auto;">
                        ${strat.fullCopy}
                      </p>
                    </div>
                  </div>

                  <button class="btn btn-primary btn-sm" onclick="window.loadStrategyToComposer('${stratJson}')" style="width:100%; justify-content:center; font-weight:700; font-size:0.8rem; padding:8px 12px; gap:6px;">
                    🚀 Llevar al Editor (Composer)
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    contentEl.innerHTML = fullHtml;
    showToast('Auditoría generada con estrategias ejecutables listas', 'success');
  } catch (err) {
    contentEl.innerHTML = `
      <div class="alert-box" style="background:#ef444422; border-color:#ef4444; color:#ef4444;">
        ⚠️ Error generando auditoría: ${err.message}
      </div>
    `;
  }
};

window.loadStrategyToComposer = function (encodedStrat) {
  try {
    const strat = typeof encodedStrat === 'string' ? JSON.parse(decodeURIComponent(encodedStrat)) : encodedStrat;

    if (typeof navigateToTab === 'function') {
      navigateToTab('composer');
    } else if (window.switchTab) {
      window.switchTab('composer');
    }

    const targetFormat = strat.format || 'feed';
    const radio = document.querySelector(`input[name="post_type"][value="${targetFormat}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }

    const titleInput = document.getElementById('post-title');
    const contentInput = document.getElementById('post-content');

    if (titleInput && strat.title) {
      titleInput.value = strat.title;
    }

    if (contentInput && strat.fullCopy) {
      contentInput.value = strat.fullCopy;
      contentInput.dispatchEvent(new Event('input'));
    }

    const aiTopic = document.getElementById('ai-topic');
    if (aiTopic && strat.topic) {
      aiTopic.value = strat.topic;
    }

    const aiCustom = document.getElementById('ai-custom-instructions');
    if (aiCustom && strat.visualPrompt) {
      aiCustom.value = strat.visualPrompt;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`¡Estrategia "${strat.title}" cargada en el Editor!`, 'success');
  } catch (err) {
    console.error('Error cargando estrategia al composer:', err);
    showToast('Error cargando estrategia: ' + err.message, 'error');
  }
};

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gim, '<h4 style="color:var(--primary); margin:14px 0 6px 0; font-size:0.95rem; font-weight:700;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="color:var(--text-primary); margin:18px 0 8px 0; font-size:1.05rem; font-weight:800;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong style="color:var(--text-primary); font-weight:700;">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li style="margin-bottom:4px; margin-left:18px;">$1</li>')
    .replace(/^\* (.*$)/gim, '<li style="margin-bottom:4px; margin-left:18px;">$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li style="margin-bottom:4px; margin-left:18px;"><strong>$1.</strong> $2</li>')
    .replace(/\n\n/gim, '<div style="margin-bottom:8px;"></div>');
}

function drawReachChart(labels, reachData, impressionsData, emptyMessage = 'Aún no hay datos suficientes de Meta para graficar este periodo') {
  const canvas = document.getElementById('chart-reach');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  let actualLabels = labels;
  let actualReach = reachData;

  // Si se llamó pasando un objeto de datos de insights
  if (labels && !Array.isArray(labels) && typeof labels === 'object') {
    const dataObj = labels;
    if (dataObj.chartLabels && dataObj.reachData) {
      actualLabels = dataObj.chartLabels;
      actualReach = dataObj.reachData;
    } else if (dataObj.facebook?.chartData) {
      actualLabels = dataObj.facebook.chartData.map(c => c.day);
      actualReach = dataObj.facebook.chartData.map(c => c.reach || c.value || 0);
    }
  }

  // Si no hay datos reales o las series están vacías, renderizar estado vacío profesional
  if (!actualLabels || !actualReach || actualReach.length === 0 || actualReach.every(v => !v || v === 0)) {
    drawCanvasEmptyState(ctx, width, height, emptyMessage);
    return;
  }

  ctx.clearRect(0, 0, width, height);

  const dark = isDark();
  const gridColor = dark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(204, 136, 0, 0.08)';
  const labelColor = dark ? '#d6d1c8' : '#4b5563';
  const lineColor = dark ? '#f59e0b' : '#cc8800';

  const maxVal = Math.max(...actualReach, 100);
  const paddingLeft = 50;
  const paddingBottom = 35;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    const labelVal = Math.round(maxVal - (maxVal / 4) * i);
    ctx.fillStyle = labelColor;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(labelVal.toLocaleString(), paddingLeft - 8, y + 3);
  }

  const stepX = chartWidth / Math.max(actualLabels.length - 1, 1);
  const points = actualReach.map((val, idx) => ({
    x: paddingLeft + idx * stepX,
    y: paddingTop + chartHeight - (val / maxVal) * chartHeight
  }));

  const grad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
  grad.addColorStop(0, dark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(204, 136, 0, 0.18)');
  grad.addColorStop(1, 'rgba(204, 136, 0, 0.0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
  ctx.lineTo(points[0].x, height - paddingBottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.8;
  ctx.stroke();

  points.forEach((p, idx) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.strokeStyle = dark ? '#171614' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = labelColor;
    ctx.font = '10px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(actualLabels[idx] || '', p.x, height - 12);
  });
}

function drawEngagementChart(dayLabels, engagementData, emptyMessage = 'Aún no hay datos suficientes de Meta para graficar este periodo') {
  const canvas = document.getElementById('chart-engagement');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  let labels = dayLabels;
  let values = engagementData;

  if (dayLabels && !Array.isArray(dayLabels) && typeof dayLabels === 'object') {
    const dataObj = dayLabels;
    if (dataObj.dailyActivity) {
      labels = Object.keys(dataObj.dailyActivity);
      values = Object.values(dataObj.dailyActivity);
    } else if (dataObj.facebook?.chartData) {
      labels = dataObj.facebook.chartData.map(c => c.day);
      values = dataObj.facebook.chartData.map(c => c.engagement || c.likes || 0);
    }
  }

  if (!labels || !values || values.length === 0 || values.every(v => !v || v === 0)) {
    drawCanvasEmptyState(ctx, width, height, emptyMessage);
    return;
  }

  ctx.clearRect(0, 0, width, height);
  const dark = isDark();
  const labelColor = dark ? '#d6d1c8' : '#4b5563';
  const maxVal = Math.max(...values, 10);

  const paddingLeft = 40;
  const paddingBottom = 35;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = 14;
  const groupWidth = chartWidth / labels.length;

  labels.forEach((day, idx) => {
    const val = values[idx] || 0;
    const groupX = paddingLeft + idx * groupWidth + groupWidth / 2;
    const barHeight = (val / maxVal) * chartHeight;

    ctx.fillStyle = dark ? '#f59e0b' : '#cc8800';
    ctx.fillRect(groupX - barWidth / 2, paddingTop + chartHeight - barHeight, barWidth, barHeight);

    ctx.fillStyle = labelColor;
    ctx.font = '10px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day, groupX, height - 12);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btnRefresh = document.getElementById('btn-refresh-insights');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      showToast('Actualizando analíticas en tiempo real...', 'info');
      window.loadAnalyticsData();
    });
  }

  const btnTriggerAudit = document.getElementById('btn-trigger-ai-audit');
  if (btnTriggerAudit) {
    btnTriggerAudit.addEventListener('click', () => {
      window.triggerAIAudit();
    });
  }

  const btnCloseAudit = document.getElementById('btn-close-ai-audit');
  if (btnCloseAudit) {
    btnCloseAudit.addEventListener('click', () => {
      const card = document.getElementById('card-ai-audit');
      if (card) card.style.display = 'none';
    });
  }

  const themeToggle = document.getElementById('btn-theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      setTimeout(() => {
        if (typeof AppState !== 'undefined' && AppState.activeTab === 'analytics') {
          window.loadAnalyticsData();
        }
      }, 100);
    });
  }
});
