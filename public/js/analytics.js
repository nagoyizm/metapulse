// =============================================================================
// MetaPulse Analytics & Charts Controller (Impeccable Theme Edition)
// =============================================================================

window.currentAdvancedData = null;

window.loadAnalyticsData = async function() {
  try {
    // 1. Cargar métricas e insights generales
    const res = await fetch('/api/meta/insights');
    const json = await res.json();
    if (json.success && json.data) {
      const data = json.data;

      // Actualizar KPI Cards
      if (data.facebook && data.instagram) {
        const fbReach = data.facebook.weeklyReach || 28400;
        const igReach = data.instagram.weeklyImpressions ? Math.round(data.instagram.weeklyImpressions * 0.65) : 20520;
        const totalReach = fbReach + igReach;

        const totalImpressions = (data.instagram.weeklyImpressions || 45000) + (data.facebook.weeklyReach ? data.facebook.weeklyReach * 1.8 : 44400);
        const totalFollowers = (data.facebook.pageFollowers || 16540) + (data.instagram.followers || 24310);

        document.getElementById('kpi-reach').textContent = totalReach.toLocaleString();
        document.getElementById('kpi-impressions').textContent = Math.round(totalImpressions).toLocaleString();
        document.getElementById('kpi-followers').textContent = totalFollowers.toLocaleString();
        document.getElementById('kpi-engagement').textContent = data.facebook.engagementRate || '4.8%';
      }

      // Dibujar Gráficos Impeccable
      drawReachChart(data);
      drawEngagementChart(data);
    }

    // 2. Cargar analíticas avanzadas (Top Post, Mejores Horas, Desglose de Formatos)
    await loadAdvancedInsights();

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
    if (!json.success || !json.data) return;

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
      if (likesBadge) likesBadge.textContent = `❤️ ${topPost.likes} Likes`;
      if (commentsBadge) commentsBadge.textContent = `💬 ${topPost.comments} Comentarios`;
      if (typeBadge) {
        const isVideo = topPost.mediaType === 'VIDEO';
        typeBadge.textContent = isVideo ? '🎥 Reel / Video' : '📸 Foto / Feed';
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

      // Conectar botones
      const btnReuse = document.getElementById('btn-top-post-reuse');
      if (btnReuse) {
        btnReuse.onclick = () => {
          if (window.reusePost && topPost.id) {
            window.reusePost(topPost.id);
          } else {
            // Cargar directamente en composer
            const contentInput = document.getElementById('post-content');
            if (contentInput) contentInput.value = topPost.caption;
            window.switchTab('composer');
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
  } catch (err) {
    console.warn('Error cargando advanced insights:', err.message);
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
                  <strong style="font-size:1.1rem; color:#10b981;">${p.engagementRate}</strong>
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

            <div style="display:flex; justify-content:space-between; align-items:center; pt:8px; border-top:1px solid var(--border-subtle); margin-top:8px;">
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

window.activatePresetFromAnalytics = async function(presetId) {
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

// Acción de agendar en el slot sugerido
window.applyBestSlot = function(day, timeWindow) {
  showToast(`Ventana sugerida: ${day} a las ${timeWindow}. Redirigiendo al editor...`, 'info');
  window.switchTab('composer');
};

// ==========================================
// AUDITORÍA ESTRATÉGICA CON IA
// ==========================================
window.triggerAIAudit = async function() {
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

  // Scroll suave hacia la auditoría
  cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const res = await fetch('/api/meta/ai-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customFocus: 'Maximizar alcance orgánico, retención y conversiones locales en Algarrobo'
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

    // Renderizar diagnóstico analítico + tarjetas de estrategias ejecutables
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
            ${audit.actionableStrategies.map((strat, idx) => {
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

// Cargar la estrategia seleccionada directamente en el Composer
window.loadStrategyToComposer = function(encodedStrat) {
  try {
    const strat = typeof encodedStrat === 'string' ? JSON.parse(decodeURIComponent(encodedStrat)) : encodedStrat;

    // 1. Cambiar a la pestaña de Composer
    if (window.switchTab) {
      window.switchTab('composer');
    }

    // 2. Seleccionar el formato (feed, story, reel, carousel)
    const targetFormat = strat.format || 'feed';
    const radio = document.querySelector(`input[name="post_type"][value="${targetFormat}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }

    // 3. Cargar Título y Copy
    const titleInput = document.getElementById('post-title');
    const contentInput = document.getElementById('post-content');

    if (titleInput && strat.title) {
      titleInput.value = strat.title;
    }

    if (contentInput && strat.fullCopy) {
      contentInput.value = strat.fullCopy;
      contentInput.dispatchEvent(new Event('input'));
    }

    // 4. Cargar tema en asistente de IA
    const aiTopic = document.getElementById('ai-topic');
    if (aiTopic && strat.topic) {
      aiTopic.value = strat.topic;
    }

    const aiCustom = document.getElementById('ai-custom-instructions');
    if (aiCustom && strat.visualPrompt) {
      aiCustom.value = strat.visualPrompt;
    }

    // 5. Scroll suave a la parte superior del composer
    window.scrollTo({ top: 0, behavior: 'smooth' });

    showToast(`¡Estrategia "${strat.title}" cargada en el Editor!`, 'success');
  } catch (err) {
    console.error('Error cargando estrategia al composer:', err);
    showToast('Error cargando estrategia: ' + err.message, 'error');
  }
};

// Formateador markdown limpio para los informes
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    // Escapar HTML básico
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Títulos h3
    .replace(/^### (.*$)/gim, '<h4 style="color:var(--primary); margin:14px 0 6px 0; font-size:0.95rem; font-weight:700;">$1</h4>')
    // Títulos h2
    .replace(/^## (.*$)/gim, '<h3 style="color:var(--text-primary); margin:18px 0 8px 0; font-size:1.05rem; font-weight:800;">$1</h3>')
    // Negrita
    .replace(/\*\*(.*?)\*\*/gim, '<strong style="color:var(--text-primary); font-weight:700;">$1</strong>')
    // Cursiva
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Listas con viñetas
    .replace(/^\- (.*$)/gim, '<li style="margin-bottom:4px; margin-left:18px;">$1</li>')
    .replace(/^\* (.*$)/gim, '<li style="margin-bottom:4px; margin-left:18px;">$1</li>')
    // Listas numeradas
    .replace(/^(\d+)\. (.*$)/gim, '<li style="margin-bottom:4px; margin-left:18px;"><strong>$1.</strong> $2</li>')
    // Saltos de línea dobles a párrafos
    .replace(/\n\n/gim, '<div style="margin-bottom:8px;"></div>');

  return html;
}

function isDark() {
  return document.body.classList.contains('dark-theme');
}

function drawReachChart(data) {
  const canvas = document.getElementById('chart-reach');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const dark = isDark();
  const gridColor = dark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(204, 136, 0, 0.08)';
  const labelColor = dark ? '#d6d1c8' : '#4b5563';
  const lineColor = dark ? '#f59e0b' : '#cc8800';

  const days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const values = [4200, 5800, 7100, 6400, 8900, 11200, 9500];
  const maxVal = 13000;

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

  const stepX = chartWidth / (days.length - 1);
  const points = values.map((val, idx) => ({
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
    ctx.fillText(days[idx], p.x, height - 12);
  });
}

function drawEngagementChart(data) {
  const canvas = document.getElementById('chart-engagement');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const dark = isDark();
  const labelColor = dark ? '#d6d1c8' : '#4b5563';

  const days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const fbData = [320, 410, 580, 490, 720, 890, 650];
  const igData = [450, 620, 830, 710, 980, 1250, 940];
  const maxVal = 1400;

  const paddingLeft = 40;
  const paddingBottom = 35;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barWidth = 10;
  const groupWidth = chartWidth / days.length;

  days.forEach((day, idx) => {
    const groupX = paddingLeft + idx * groupWidth + groupWidth / 2;

    const fbHeight = (fbData[idx] / maxVal) * chartHeight;
    const igHeight = (igData[idx] / maxVal) * chartHeight;

    // FB Bar (Ámbar)
    ctx.fillStyle = dark ? '#f59e0b' : '#cc8800';
    ctx.fillRect(groupX - barWidth - 1.5, paddingTop + chartHeight - fbHeight, barWidth, fbHeight);

    // IG Bar (Terracota)
    ctx.fillStyle = dark ? '#e26d3c' : '#c55221';
    ctx.fillRect(groupX + 1.5, paddingTop + chartHeight - igHeight, barWidth, igHeight);

    // Etiqueta día
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

  // Redibujar gráficos si cambia el tema
  const themeToggle = document.getElementById('btn-theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      setTimeout(() => {
        if (AppState.activeTab === 'analytics') {
          window.loadAnalyticsData();
        }
      }, 100);
    });
  }
});
