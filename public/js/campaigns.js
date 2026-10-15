// =============================================================================
// MetaPulse - Fase 1: Campañas e Indicaciones + Planificador del Mes
// =============================================================================

(function () {
  'use strict';

  let currentBrandId = null;
  let cachedCampaigns = [];
  let proposedPlanItems = [];

  function getToastFn() {
    return window.showToast || (typeof showToast === 'function' ? showToast : null);
  }

  function notify(msg, type = 'info') {
    const toast = getToastFn();
    if (toast) {
      toast(msg, type);
    } else {
      console.log(`[Campaigns ${type}]`, msg);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getTodayDateChile() {
    try {
      const d = new Date();
      return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function getDefaultMonthValue() {
    const today = new Date();
    const day = today.getDate();
    let y = today.getFullYear();
    let m = today.getMonth() + 1; // 1-12

    if (day >= 20) {
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // 1. Cargar y renderizar fichas de la marca
  async function loadCampaigns(brandId) {
    if (!brandId) return;
    try {
      const res = await fetch(`/api/campaigns?brandId=${encodeURIComponent(brandId)}`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Error al obtener campañas');
      }

      cachedCampaigns = json.campaigns || [];
      renderGroupedCampaigns(cachedCampaigns);
    } catch (err) {
      console.error('[Campaigns] Error cargando campañas:', err);
      notify('Error al cargar campañas: ' + err.message, 'error');
    }
  }

  function renderGroupedCampaigns(campaigns) {
    const today = getTodayDateChile();

    const vigentes = [];
    const proximas = [];
    const vencidas = [];

    campaigns.forEach(c => {
      if (c.status === 'archivada' || c.status === 'pausada') {
        vencidas.push(c);
      } else if (c.ends_on && c.ends_on < today) {
        vencidas.push(c);
      } else if (c.starts_on && c.starts_on > today) {
        proximas.push(c);
      } else {
        vigentes.push(c);
      }
    });

    renderCampaignListInContainer('items-vigentes', vigentes, 'No hay campañas vigentes.');
    renderCampaignListInContainer('items-proximas', proximas, 'No hay campañas próximas.');
    renderCampaignListInContainer('items-vencidas', vencidas, 'No hay campañas vencidas o archivadas.');
  }

  function renderCampaignListInContainer(containerId, list, emptyText) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `<div style="font-size:0.8rem; color:var(--text-secondary); padding:8px 0;">${escapeHtml(emptyText)}</div>`;
      return;
    }

    container.innerHTML = '';
    list.forEach(c => {
      const itemEl = document.createElement('div');
      itemEl.className = `campaign-item-row status-${c.status || 'activa'}`;
      itemEl.id = `campaign-item-${c.id}`;

      const kindClass = `campaign-kind-${c.kind || 'promo'}`;
      const kindLabel = (c.kind ? c.kind.charAt(0).toUpperCase() + c.kind.slice(1) : 'Promo');

      let dateText = 'Permanente';
      if (c.starts_on && c.ends_on) {
        dateText = `${c.starts_on} al ${c.ends_on}`;
      } else if (c.starts_on) {
        dateText = `Desde ${c.starts_on}`;
      } else if (c.ends_on) {
        dateText = `Hasta ${c.ends_on}`;
      }

      const statusBadge = c.status === 'pausada'
        ? '<span class="badge" style="background:#fef3c7; color:#92400e;">Pausada</span>'
        : (c.status === 'archivada'
          ? '<span class="badge" style="background:#e2e8f0; color:#475569;">Archivada</span>'
          : '<span class="badge" style="background:#d1fae5; color:#065f46;">Activa</span>');

      const details = c.details || {};
      const condBadge = details.condiciones ? `<span style="font-size:0.75rem; color:var(--text-secondary);">Condiciones: ${escapeHtml(details.condiciones)}</span>` : '';
      const urgenciaBadge = details.permitirUrgencia === true
        ? '<span class="badge" style="background:#fee2e2; color:#991b1b; font-size:0.7rem;">Disponibilidad autorizada</span>'
        : '';

      itemEl.innerHTML = `
        <div class="campaign-header-row">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong style="font-size:0.92rem; color:var(--text-primary);">${escapeHtml(c.title)}</strong>
            <span class="campaign-kind-badge ${kindClass}">${kindLabel}</span>
            ${statusBadge}
            ${urgenciaBadge}
            <span style="font-size:0.75rem; color:var(--text-secondary);">${dateText}</span>
          </div>
          <div class="campaign-actions-row">
            <button type="button" class="btn btn-secondary btn-xs btn-camp-edit" data-id="${c.id}">Editar</button>
            <button type="button" class="btn btn-secondary btn-xs btn-camp-toggle" data-id="${c.id}" data-status="${c.status}">${c.status === 'pausada' ? 'Activar' : 'Pausar'}</button>
            ${c.status !== 'archivada' ? `<button type="button" class="btn btn-secondary btn-xs btn-camp-archive" data-id="${c.id}">Archivar</button>` : ''}
            <button type="button" class="btn btn-danger btn-xs btn-camp-delete" data-id="${c.id}" style="color:#ef4444; background:none; border:none; cursor:pointer;" title="Eliminar ficha">Eliminar</button>
          </div>
        </div>
        <div style="font-size:0.83rem; color:var(--text-primary); line-height:1.45; background:var(--bg-surface-subtle); padding:8px 12px; border-radius:var(--radius-xs);">
          ${escapeHtml(c.directive)}
        </div>
        ${condBadge ? `<div>${condBadge}</div>` : ''}
      `;

      // Eventos de botones
      const btnEdit = itemEl.querySelector('.btn-camp-edit');
      const btnToggle = itemEl.querySelector('.btn-camp-toggle');
      const btnArchive = itemEl.querySelector('.btn-camp-archive');
      const btnDelete = itemEl.querySelector('.btn-camp-delete');

      if (btnEdit) {
        btnEdit.addEventListener('click', () => openEditForm(c));
      }
      if (btnToggle) {
        btnToggle.addEventListener('click', () => toggleCampaignStatus(c));
      }
      if (btnArchive) {
        btnArchive.addEventListener('click', () => archiveCampaign(c.id));
      }
      if (btnDelete) {
        btnDelete.addEventListener('click', () => deleteCampaign(c.id));
      }

      container.appendChild(itemEl);
    });
  }

  // 2. Interpretar indicaciones libres del cliente (parseBrief)
  function setupParseBrief() {
    const btnParse = document.getElementById('btn-parse-brief');
    const textarea = document.getElementById('campaign-raw-text');
    const resultsBox = document.getElementById('campaign-parse-results');
    const summaryBox = document.getElementById('campaign-parse-summary');
    const conflictsBox = document.getElementById('campaign-parse-conflicts');
    const cardsContainer = document.getElementById('campaign-proposed-cards-container');

    if (!btnParse || !textarea) return;

    btnParse.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        notify('Por favor escribe o pega el texto del cliente', 'warning');
        return;
      }
      if (!currentBrandId) {
        notify('Selecciona primero un perfil de marca', 'warning');
        return;
      }

      const originalBtnText = btnParse.textContent;
      btnParse.disabled = true;
      btnParse.textContent = 'Interpretando con IA...';

      try {
        const res = await fetch('/api/campaigns/parse-brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: currentBrandId, text })
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Fallo en la interpretación');
        }

        const data = json.data || {};
        renderParsedResults(data);
        notify('Indicaciones interpretadas exitosamente', 'success');
      } catch (err) {
        console.error('[Campaigns] Error interpretando brief:', err);
        notify('Error al interpretar: ' + err.message, 'error');
      } finally {
        btnParse.disabled = false;
        btnParse.textContent = originalBtnText;
      }
    });

    function renderParsedResults(data) {
      if (!resultsBox) return;
      resultsBox.style.display = 'block';

      if (summaryBox) {
        summaryBox.innerHTML = `<strong>Resumen de interpretación:</strong> ${escapeHtml(data.summary || 'Propuesta estructurada.')}`;
      }

      if (conflictsBox) {
        if (data.conflicts && data.conflicts.length > 0) {
          conflictsBox.style.display = 'block';
          conflictsBox.innerHTML = `
            <h5>⚠️ Posibles conflictos detectados con las reglas de la marca:</h5>
            <ul>
              ${data.conflicts.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
            </ul>
          `;
        } else {
          conflictsBox.style.display = 'none';
        }
      }

      if (cardsContainer) {
        cardsContainer.innerHTML = '';
        const campaigns = data.campaigns || [];
        if (campaigns.length === 0) {
          cardsContainer.innerHTML = '<p class="text-muted">No se extrajeron fichas de campaña del texto.</p>';
          return;
        }

        campaigns.forEach((c, idx) => {
          const card = createProposedCard(c, idx);
          cardsContainer.appendChild(card);
        });
      }
    }

    function createProposedCard(c, idx) {
      const card = document.createElement('div');
      card.className = 'campaign-card-editable is-new';
      card.id = `proposed-card-${idx}`;

      const details = c.details || {};
      const questions = Array.isArray(c.open_questions) ? c.open_questions : [];

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h5 style="margin:0; font-size:0.95rem; color:var(--text-primary);">Ficha propuesta #${idx + 1}</h5>
          <span class="badge" style="background:rgba(99, 102, 241, 0.15); color:var(--primary);">Borrador de IA</span>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Título de la campaña:</label>
            <input type="text" class="form-control prop-title" value="${escapeHtml(c.title || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de campaña:</label>
            <select class="form-control prop-kind">
              <option value="promo" ${c.kind === 'promo' ? 'selected' : ''}>Promoción</option>
              <option value="permanente" ${c.kind === 'permanente' ? 'selected' : ''}>Permanente</option>
              <option value="disponibilidad" ${c.kind === 'disponibilidad' ? 'selected' : ''}>Disponibilidad</option>
              <option value="evento" ${c.kind === 'evento' ? 'selected' : ''}>Evento</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Desde (inicio):</label>
            <input type="date" class="form-control prop-starts" value="${c.starts_on || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Hasta (fin):</label>
            <input type="date" class="form-control prop-ends" value="${c.ends_on || ''}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Instrucción para la IA (directive):</label>
          <textarea class="form-control prop-directive" rows="2">${escapeHtml(c.directive || '')}</textarea>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Oferta / Beneficio:</label>
            <input type="text" class="form-control prop-oferta" value="${escapeHtml(details.oferta || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Público objetivo:</label>
            <input type="text" class="form-control prop-publico" value="${escapeHtml(details.publico || '')}" />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Días aplicables:</label>
            <input type="text" class="form-control prop-dias" value="${escapeHtml(details.dias || '')}" placeholder="Ej: Lunes a jueves" />
          </div>
          <div class="form-group">
            <label class="form-label">Condiciones explícitas:</label>
            <input type="text" class="form-control prop-condiciones" value="${escapeHtml(details.condiciones || '')}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Llamado a la acción (CTA):</label>
          <input type="text" class="form-control prop-cta" value="${escapeHtml(details.cta || '')}" />
        </div>

        <div class="form-group">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.83rem;">
            <input type="checkbox" class="prop-urgencia" ${details.permitirUrgencia ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary);" />
            <span>Permitir mencionar disponibilidad limitada real en copies de esta campaña</span>
          </label>
        </div>

        ${questions.length > 0 ? `
          <div class="campaign-questions-box">
            <strong>Preguntas abiertas pendientes (confírmalas con el cliente):</strong>
            <ul>
              ${questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
          <button type="button" class="btn btn-secondary btn-sm btn-discard-proposed">Descartar</button>
          <button type="button" class="btn btn-primary btn-sm btn-save-proposed">Guardar ficha</button>
        </div>
      `;

      const btnDiscard = card.querySelector('.btn-discard-proposed');
      const btnSave = card.querySelector('.btn-save-proposed');

      btnDiscard.addEventListener('click', () => {
        card.remove();
        if (cardsContainer.children.length === 0) {
          resultsBox.style.display = 'none';
        }
      });

      btnSave.addEventListener('click', async () => {
        const title = card.querySelector('.prop-title').value.trim();
        const kind = card.querySelector('.prop-kind').value;
        const starts_on = card.querySelector('.prop-starts').value || null;
        const ends_on = card.querySelector('.prop-ends').value || null;
        const directive = card.querySelector('.prop-directive').value.trim();
        const oferta = card.querySelector('.prop-oferta').value.trim();
        const publico = card.querySelector('.prop-publico').value.trim();
        const dias = card.querySelector('.prop-dias').value.trim();
        const condiciones = card.querySelector('.prop-condiciones').value.trim();
        const cta = card.querySelector('.prop-cta').value.trim();
        const permitirUrgencia = card.querySelector('.prop-urgencia').checked;

        if (!title || !directive) {
          notify('El título y la instrucción son obligatorios', 'warning');
          return;
        }

        const payload = {
          brand_id: currentBrandId,
          title,
          kind,
          starts_on,
          ends_on,
          directive,
          details: { oferta, publico, dias, condiciones, cta, permitirUrgencia },
          open_questions: questions,
          source_text: textarea.value.trim(),
          status: 'activa'
        };

        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';

        try {
          const res = await fetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || 'Error al guardar');
          }

          notify(`Ficha "${title}" guardada exitosamente`, 'success');
          card.remove();
          if (cardsContainer.children.length === 0) {
            resultsBox.style.display = 'none';
          }
          await loadCampaigns(currentBrandId);
        } catch (err) {
          console.error('[Campaigns] Error guardando ficha:', err);
          notify('Error al guardar: ' + err.message, 'error');
          btnSave.disabled = false;
          btnSave.textContent = 'Guardar ficha';
        }
      });

      return card;
    }
  }

  // 3. Crear ficha manual o editar ficha existente
  function openEditForm(campaign = null) {
    const wrap = document.getElementById('campaign-manual-form-wrap');
    if (!wrap) return;

    wrap.style.display = 'block';
    const isEdit = Boolean(campaign && campaign.id);
    const details = campaign?.details || {};

    wrap.innerHTML = `
      <div class="campaign-card-editable" style="border-color:var(--primary);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h5 style="margin:0; font-size:0.95rem; color:var(--text-primary);">
            ${isEdit ? `Editar ficha: "${escapeHtml(campaign.title)}"` : 'Nueva ficha de campaña'}
          </h5>
          <button type="button" class="btn btn-ghost btn-xs btn-close-manual-form" style="font-size:1.1rem; line-height:1;">&times;</button>
        </div>

        <form id="form-campaign-manual">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Título de la campaña:</label>
              <input type="text" id="manual-title" class="form-control" value="${escapeHtml(campaign?.title || '')}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Tipo de campaña:</label>
              <select id="manual-kind" class="form-control">
                <option value="promo" ${campaign?.kind === 'promo' ? 'selected' : ''}>Promoción</option>
                <option value="permanente" ${campaign?.kind === 'permanente' ? 'selected' : ''}>Permanente</option>
                <option value="disponibilidad" ${campaign?.kind === 'disponibilidad' ? 'selected' : ''}>Disponibilidad</option>
                <option value="evento" ${campaign?.kind === 'evento' ? 'selected' : ''}>Evento</option>
              </select>
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Desde (inicio):</label>
              <input type="date" id="manual-starts" class="form-control" value="${campaign?.starts_on || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Hasta (fin):</label>
              <input type="date" id="manual-ends" class="form-control" value="${campaign?.ends_on || ''}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Instrucción para la IA (directive):</label>
            <textarea id="manual-directive" class="form-control" rows="2" placeholder="Instrucción de 1 a 4 frases para incluir en los copies..." required>${escapeHtml(campaign?.directive || '')}</textarea>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Oferta / Beneficio:</label>
              <input type="text" id="manual-oferta" class="form-control" value="${escapeHtml(details.oferta || '')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Público objetivo:</label>
              <input type="text" id="manual-publico" class="form-control" value="${escapeHtml(details.publico || '')}" />
            </div>
          </div>

          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Días aplicables:</label>
              <input type="text" id="manual-dias" class="form-control" value="${escapeHtml(details.dias || '')}" placeholder="Ej: lunes a jueves" />
            </div>
            <div class="form-group">
              <label class="form-label">Condiciones explícitas:</label>
              <input type="text" id="manual-condiciones" class="form-control" value="${escapeHtml(details.condiciones || '')}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Llamado a la acción (CTA):</label>
            <input type="text" id="manual-cta" class="form-control" value="${escapeHtml(details.cta || '')}" />
          </div>

          <div class="form-group">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.83rem;">
              <input type="checkbox" id="manual-urgencia" ${details.permitirUrgencia ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary);" />
              <span>Permitir mencionar disponibilidad limitada real en copies de esta campaña</span>
            </label>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
            <button type="button" class="btn btn-secondary btn-sm btn-close-manual-form">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Guardar cambios' : 'Crear ficha'}</button>
          </div>
        </form>
      </div>
    `;

    wrap.querySelectorAll('.btn-close-manual-form').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.style.display = 'none';
        wrap.innerHTML = '';
      });
    });

    const form = document.getElementById('form-campaign-manual');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('manual-title').value.trim();
      const kind = document.getElementById('manual-kind').value;
      const starts_on = document.getElementById('manual-starts').value || null;
      const ends_on = document.getElementById('manual-ends').value || null;
      const directive = document.getElementById('manual-directive').value.trim();
      const oferta = document.getElementById('manual-oferta').value.trim();
      const publico = document.getElementById('manual-publico').value.trim();
      const dias = document.getElementById('manual-dias').value.trim();
      const condiciones = document.getElementById('manual-condiciones').value.trim();
      const cta = document.getElementById('manual-cta').value.trim();
      const permitirUrgencia = document.getElementById('manual-urgencia').checked;

      const payload = {
        brand_id: currentBrandId,
        title,
        kind,
        starts_on,
        ends_on,
        directive,
        details: { oferta, publico, dias, condiciones, cta, permitirUrgencia }
      };

      try {
        const url = isEdit ? `/api/campaigns/${campaign.id}` : '/api/campaigns';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Error al guardar');
        }

        notify(isEdit ? 'Ficha actualizada' : 'Ficha creada', 'success');
        wrap.style.display = 'none';
        wrap.innerHTML = '';
        await loadCampaigns(currentBrandId);
      } catch (err) {
        console.error('[Campaigns] Error guardando manual:', err);
        notify('Error: ' + err.message, 'error');
      }
    });

    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function toggleCampaignStatus(campaign) {
    const newStatus = campaign.status === 'pausada' ? 'activa' : 'pausada';
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error al actualizar');
      notify(`Campaña ${newStatus === 'activa' ? 'activada' : 'pausada'}`, 'success');
      await loadCampaigns(currentBrandId);
    } catch (err) {
      notify('Error al cambiar estado: ' + err.message, 'error');
    }
  }

  async function archiveCampaign(id) {
    if (!confirm('¿Deseas archivar esta campaña? No se usará en futuras generaciones de copy.')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archivada' })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error al archivar');
      notify('Campaña archivada', 'info');
      await loadCampaigns(currentBrandId);
    } catch (err) {
      notify('Error al archivar: ' + err.message, 'error');
    }
  }

  async function deleteCampaign(id) {
    if (!confirm('¿Estás seguro de eliminar permanentemente esta ficha de campaña?')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Error al eliminar');
      notify('Campaña eliminada', 'info');
      await loadCampaigns(currentBrandId);
    } catch (err) {
      notify('Error al eliminar: ' + err.message, 'error');
    }
  }

  // 4. Planificador del mes
  function setupMonthPlanner() {
    const monthInput = document.getElementById('plan-month-select');
    const postsInput = document.getElementById('plan-posts-per-week');
    const btnPropose = document.getElementById('btn-propose-plan');
    const resultsBox = document.getElementById('plan-proposal-results');
    const notesBanner = document.getElementById('plan-notes-banner');
    const tbody = document.getElementById('plan-items-tbody');
    const btnSelectAll = document.getElementById('btn-plan-select-all');
    const btnDeselectAll = document.getElementById('btn-plan-deselect-all');
    const chkMaster = document.getElementById('chk-plan-master');
    const counterEl = document.getElementById('plan-selected-count');
    const btnCreateDrafts = document.getElementById('btn-create-drafts');
    const progressEl = document.getElementById('plan-create-progress');

    if (monthInput && !monthInput.value) {
      monthInput.value = getDefaultMonthValue();
    }

    if (btnPropose) {
      btnPropose.addEventListener('click', async () => {
        const month = monthInput.value;
        const postsPerWeek = postsInput ? Number(postsInput.value) : 3;

        if (!currentBrandId) {
          notify('Selecciona primero un perfil de marca', 'warning');
          return;
        }
        if (!month) {
          notify('Selecciona un mes para planificar', 'warning');
          return;
        }

        const originalBtnText = btnPropose.textContent;
        btnPropose.disabled = true;
        btnPropose.textContent = 'Proponiendo plan con IA...';
        if (progressEl) progressEl.textContent = '';

        try {
          const res = await fetch('/api/campaigns/plan-month', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandId: currentBrandId, month, postsPerWeek })
          });

          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || 'Error al generar plan');
          }

          const data = json.data || {};
          proposedPlanItems = data.items || [];
          renderPlanTable(proposedPlanItems, data.notes);
          notify(`Plan propuesto con ${proposedPlanItems.length} publicaciones`, 'success');
        } catch (err) {
          console.error('[Campaigns] Error proponiendo plan:', err);
          notify('Error al generar plan: ' + err.message, 'error');
        } finally {
          btnPropose.disabled = false;
          btnPropose.textContent = originalBtnText;
        }
      });
    }

    function renderPlanTable(items, notes) {
      if (!resultsBox || !tbody) return;
      resultsBox.style.display = 'block';

      if (notesBanner) {
        notesBanner.innerHTML = `<strong>Estrategia del mes:</strong> ${escapeHtml(notes || 'Distribución editorial balanceada.')}`;
      }

      tbody.innerHTML = '';
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align:center; padding:16px;">No se propusieron publicaciones para este mes.</td></tr>';
        updateCounter();
        return;
      }

      items.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const camp = item.campaign_id ? cachedCampaigns.find(c => c.id === item.campaign_id) : null;
        const campLabel = camp
          ? `<span class="badge" style="background:var(--primary-subtle); color:var(--primary); font-size:0.75rem;">${escapeHtml(camp.title)}</span>`
          : '<span style="color:var(--text-secondary); font-size:0.75rem;">Marca / Branding</span>';

        const fmtBadge = `<span style="font-weight:600; text-transform:capitalize;">${escapeHtml(item.format || 'feed')}</span>`;

        tr.innerHTML = `
          <td style="text-align:center;">
            <input type="checkbox" class="chk-plan-item" data-idx="${idx}" checked />
          </td>
          <td style="font-weight:600; white-space:nowrap;">${escapeHtml(item.date)}</td>
          <td style="white-space:nowrap; color:var(--text-secondary);">${escapeHtml(item.time || '11:00')}</td>
          <td>${fmtBadge}</td>
          <td>${campLabel}</td>
          <td>
            <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.angle)}</div>
            ${item.hook ? `<div style="font-size:0.76rem; color:var(--text-secondary); margin-top:2px;">Gancho: ${escapeHtml(item.hook)}</div>` : ''}
          </td>
          <td style="font-size:0.78rem; color:var(--text-secondary); max-width:220px;">
            ${escapeHtml(item.why || '')}
          </td>
        `;

        const chk = tr.querySelector('.chk-plan-item');
        chk.addEventListener('change', updateCounter);

        tbody.appendChild(tr);
      });

      updateCounter();
    }

    function updateCounter() {
      const allCheckboxes = document.querySelectorAll('.chk-plan-item');
      const checkedBoxes = document.querySelectorAll('.chk-plan-item:checked');
      if (counterEl) {
        counterEl.textContent = `${checkedBoxes.length} seleccionados`;
      }
      if (chkMaster) {
        chkMaster.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedBoxes.length;
      }
    }

    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => {
        document.querySelectorAll('.chk-plan-item').forEach(c => { c.checked = true; });
        updateCounter();
      });
    }

    if (btnDeselectAll) {
      btnDeselectAll.addEventListener('click', () => {
        document.querySelectorAll('.chk-plan-item').forEach(c => { c.checked = false; });
        updateCounter();
      });
    }

    if (chkMaster) {
      chkMaster.addEventListener('change', () => {
        const val = chkMaster.checked;
        document.querySelectorAll('.chk-plan-item').forEach(c => { c.checked = val; });
        updateCounter();
      });
    }

    if (btnCreateDrafts) {
      btnCreateDrafts.addEventListener('click', async () => {
        const checkedBoxes = document.querySelectorAll('.chk-plan-item:checked');
        if (checkedBoxes.length === 0) {
          notify('Selecciona al menos una publicación para crear', 'warning');
          return;
        }

        const selectedItems = [];
        checkedBoxes.forEach(chk => {
          const idx = Number(chk.dataset.idx);
          if (proposedPlanItems[idx]) {
            selectedItems.push(proposedPlanItems[idx]);
          }
        });

        if (selectedItems.length === 0) return;

        const originalBtnText = btnCreateDrafts.textContent;
        btnCreateDrafts.disabled = true;
        btnCreateDrafts.textContent = `Creando ${selectedItems.length} borradores...`;
        if (progressEl) {
          progressEl.textContent = `Generando copies y guardando ${selectedItems.length} publicaciones en el calendario...`;
        }

        try {
          const res = await fetch('/api/campaigns/create-drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brandId: currentBrandId, items: selectedItems })
          });

          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || 'Error al crear borradores');
          }

          const createdCount = json.data?.created?.length || 0;
          const msg = `Se crearon ${createdCount} borradores en el calendario`;
          notify(msg, 'success');
          if (progressEl) {
            progressEl.textContent = `✅ ${msg}. Puedes verlos en la pestaña Calendario con etiqueta "Borrador".`;
          }

          // Si el calendario está cargado, refrescarlo
          if (typeof window.loadPlannerData === 'function') {
            window.loadPlannerData();
          }
        } catch (err) {
          console.error('[Campaigns] Error creando borradores:', err);
          notify('Error al crear borradores: ' + err.message, 'error');
          if (progressEl) {
            progressEl.textContent = `❌ Error: ${err.message}`;
          }
        } finally {
          btnCreateDrafts.disabled = false;
          btnCreateDrafts.textContent = originalBtnText;
        }
      });
    }
  }

  // 5. Inicialización y слушатели de eventos
  function initCampaignsModule() {
    setupParseBrief();
    setupMonthPlanner();

    const btnManualNew = document.getElementById('btn-new-campaign-manual');
    if (btnManualNew) {
      btnManualNew.addEventListener('click', () => openEditForm(null));
    }

    // Escuchar el evento brand:selected despachado por brand.js
    document.addEventListener('brand:selected', (e) => {
      const brandId = e.detail?.id;
      if (!brandId) return;
      currentBrandId = brandId;

      const badge = document.getElementById('campaigns-brand-badge');
      if (badge) {
        badge.textContent = brandId;
      }

      loadCampaigns(brandId);
    });

    // Detectar si ya hay un perfil seleccionado en el DOM al cargar
    setTimeout(() => {
      const activeInput = document.getElementById('brand-profile-id');
      const activeItem = document.querySelector('#brand-profiles-list .brand-list-item.active');
      const brandId = activeInput?.value || activeItem?.dataset?.profileId;
      if (brandId && !currentBrandId) {
        currentBrandId = brandId;
        const badge = document.getElementById('campaigns-brand-badge');
        if (badge) badge.textContent = brandId;
        loadCampaigns(brandId);
      }
    }, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCampaignsModule);
  } else {
    initCampaignsModule();
  }
})();
