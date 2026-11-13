// =============================================================================
// MetaPulse - Brand Profiles Management Module
// =============================================================================

(function () {
  'use strict';

  let cachedProfiles = [];
  let currentProfileId = null;

  function parseHashtagString(raw) {
    if (!raw) return [];
    return raw
      .split(/[\s,\n]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('#') ? t : `#${t}`));
  }

  function renderChips(containerId, tagsArray) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!tagsArray || tagsArray.length === 0) {
      const emptySpan = document.createElement('span');
      emptySpan.className = 'brand-help';
      emptySpan.textContent = 'Sin hashtags definidos';
      container.appendChild(emptySpan);
      return;
    }
    tagsArray.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'brand-tag-chip';
      chip.textContent = tag.startsWith('#') ? tag : `#${tag}`;
      container.appendChild(chip);
    });
  }

  function updateChipPreviews() {
    const coreInput = document.getElementById('brand-hashtag-core');
    const bankInput = document.getElementById('brand-hashtag-bank');

    if (coreInput) {
      const coreTags = parseHashtagString(coreInput.value);
      renderChips('brand-core-chips', coreTags);
    }
    if (bankInput) {
      const bankTags = parseHashtagString(bankInput.value);
      renderChips('brand-bank-chips', bankTags);
    }
  }

  function populateForm(profileObj) {
    if (!profileObj) return;
    const p = profileObj.profile || {};
    const c = p.contact || {};

    const idInput = document.getElementById('brand-profile-id');
    const nameInput = document.getElementById('brand-name');
    const voiceInput = document.getElementById('brand-voice');
    const rulesInput = document.getElementById('brand-rules');
    const coreInput = document.getElementById('brand-hashtag-core');
    const bankInput = document.getElementById('brand-hashtag-bank');
    const keywordsInput = document.getElementById('brand-match-keywords');

    const contactWeb = document.getElementById('brand-contact-web');
    const contactWhatsapp = document.getElementById('brand-contact-whatsapp');
    const contactTelefono = document.getElementById('brand-contact-telefono');
    const contactEmail = document.getElementById('brand-contact-email');
    const contactInstagram = document.getElementById('brand-contact-instagram');
    const contactDireccion = document.getElementById('brand-contact-direccion');
    const contactCierre = document.getElementById('brand-contact-cierre');

    if (idInput) idInput.value = profileObj.id || '';
    if (nameInput) nameInput.value = p.name || profileObj.id || '';
    if (voiceInput) voiceInput.value = p.voice || '';
    if (rulesInput) rulesInput.value = Array.isArray(p.rules) ? p.rules.join('\n') : (p.rules || '');
    if (coreInput) coreInput.value = Array.isArray(p.hashtagCore) ? p.hashtagCore.join(', ') : (p.hashtagCore || '');
    if (bankInput) bankInput.value = Array.isArray(p.hashtagBank) ? p.hashtagBank.join(', ') : (p.hashtagBank || '');
    if (keywordsInput) keywordsInput.value = Array.isArray(profileObj.matchKeywords) ? profileObj.matchKeywords.join(', ') : (profileObj.matchKeywords || '');

    if (contactWeb) contactWeb.value = c.web || '';
    if (contactWhatsapp) contactWhatsapp.value = c.whatsapp || '';
    if (contactTelefono) contactTelefono.value = c.telefono || '';
    if (contactEmail) contactEmail.value = c.email || '';
    if (contactInstagram) contactInstagram.value = c.instagram || '';
    if (contactDireccion) contactDireccion.value = c.direccion || '';
    if (contactCierre) contactCierre.value = c.cierre || '';

    updateChipPreviews();
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getActiveAccountContext() {
    const activeAcc = typeof window.getActiveAccount === 'function' ? window.getActiveAccount() : null;
    const globalSelect = document.getElementById('global-account-select');
    const opt = globalSelect && globalSelect.selectedIndex >= 0 ? globalSelect.options[globalSelect.selectedIndex] : null;
    const ds = opt?.dataset;

    const pageId = activeAcc?.pageId || globalSelect?.value || localStorage.getItem('metapulse_active_account_id') || (window.AppState?.config ? window.AppState.config.pageId : '') || '';
    const pageName = activeAcc?.pageName || ds?.name || localStorage.getItem('metapulse_active_account_name') || (window.AppState?.config ? window.AppState.config.pageName : '') || '';
    const instagramUsername = activeAcc?.instagramUsername || ds?.iguser || (window.AppState?.config ? window.AppState.config.instagramUsername : '') || '';

    return { pageId, pageName, instagramUsername };
  }

  function matchBrandProfile(profiles, accContext) {
    if (!profiles || profiles.length === 0) return null;
    if (!accContext) return null;

    const { pageId, pageName, instagramUsername } = accContext;
    const rawTokens = [pageName, pageId, instagramUsername].filter(Boolean).join(' ').toLowerCase();
    if (!rawTokens.trim()) return null;

    // 1. Coincidencia directa por id de perfil (campina, kmarket, agendio)
    let found = profiles.find(p => p.id && rawTokens.includes(p.id.toLowerCase()));
    if (found) return found;

    // 2. Coincidencia por matchKeywords
    found = profiles.find(p => {
      const keywords = Array.isArray(p.matchKeywords) ? p.matchKeywords : [];
      return keywords.some(k => k && rawTokens.includes(String(k).toLowerCase().trim()));
    });
    if (found) return found;

    // 3. Coincidencia por nombre o tag del perfil
    found = profiles.find(p => {
      const pName = (p.profile?.name || '').toLowerCase();
      const pTag = (p.profile?.tag || '').toLowerCase();
      if (pageName && (pName.includes(pageName.toLowerCase()) || pageName.toLowerCase().includes(pName))) return true;
      if (pTag && (pTag.includes(pageName.toLowerCase()) || pageName.toLowerCase().includes(pTag))) return true;
      return false;
    });
    if (found) return found;

    // 4. Reglas semánticas específicas conocidas de los clientes de MetaPulse
    if (rawTokens.includes('campi') || rawTokens.includes('cabaña') || rawTokens.includes('cabana')) {
      found = profiles.find(p => p.id === 'campina');
    } else if (rawTokens.includes('kmarket') || rawTokens.includes('corea') || rawTokens.includes('k-food')) {
      found = profiles.find(p => p.id === 'kmarket');
    } else if (rawTokens.includes('agendio') || pageId === '1236967112842449') {
      found = profiles.find(p => p.id === 'agendio');
    }

    return found || null;
  }

  function clearForm() {
    const fields = [
      'brand-profile-id', 'brand-name', 'brand-voice', 'brand-rules',
      'brand-hashtag-core', 'brand-hashtag-bank', 'brand-match-keywords',
      'brand-contact-web', 'brand-contact-whatsapp', 'brand-contact-telefono',
      'brand-contact-email', 'brand-contact-instagram', 'brand-contact-direccion',
      'brand-contact-cierre'
    ];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    updateChipPreviews();
  }

  function setFormDisabled(disabled) {
    const form = document.getElementById('brand-profile-form');
    if (!form) return;
    const elements = form.querySelectorAll('input:not(#brand-profile-id), textarea, button');
    elements.forEach(el => {
      el.disabled = disabled;
    });
  }

  window.loadBrandProfiles = async function (targetId) {
    const listContainer = document.getElementById('brand-profiles-list');
    const subtitleEl = document.getElementById('brand-sidebar-subtitle');
    const accContext = getActiveAccountContext();

    try {
      const params = new URLSearchParams();
      if (accContext.pageId) params.append('accountId', accContext.pageId);
      if (accContext.pageName) params.append('accountName', accContext.pageName);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const headers = {};
      if (accContext.pageId) headers['x-account-id'] = accContext.pageId;

      const res = await fetch(`/api/brand-profiles${queryStr}`, { headers });
      if (!res.ok) {
        if (res.status === 401) {
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !Array.isArray(data.profiles)) {
        throw new Error(data.error || 'Respuesta inválida del servidor');
      }

      let availableProfiles = data.profiles;

      // Filtrar estrictamente por la cuenta activa para aislamiento total entre marcas
      if (accContext.pageName || accContext.pageId) {
        const matched = matchBrandProfile(availableProfiles, accContext);
        if (matched) {
          availableProfiles = [matched];
        } else if (targetId) {
          const byTarget = availableProfiles.find(p => p.id === targetId);
          availableProfiles = byTarget ? [byTarget] : [];
        } else {
          availableProfiles = [];
        }
      } else {
        // Sin cuenta seleccionada en el selector superior
        availableProfiles = [];
      }

      cachedProfiles = availableProfiles;

      if (subtitleEl) {
        if (accContext.pageName) {
          subtitleEl.textContent = `Cuenta activa: ${accContext.pageName}`;
        } else {
          subtitleEl.textContent = 'Selecciona una cuenta en el menú superior';
        }
      }

      if (cachedProfiles.length === 0) {
        currentProfileId = null;
        if (listContainer) {
          if (accContext.pageName || accContext.pageId) {
            listContainer.innerHTML = `<div class="text-muted p-3" style="font-size:0.8rem; line-height:1.4;">
              ⚠️ No hay un perfil de marca configurado para la cuenta activa: <strong>${escapeHtml(accContext.pageName || accContext.pageId)}</strong>.
            </div>`;
          } else {
            listContainer.innerHTML = `<div class="text-muted p-3" style="font-size:0.8rem; line-height:1.4;">
              💡 Selecciona una cuenta en el menú superior para ver y configurar su perfil de marca.
            </div>`;
          }
        }
        clearForm();
        setFormDisabled(true);

        const badge = document.getElementById('campaigns-brand-badge');
        if (badge) badge.textContent = 'Sin marca';
        return;
      }

      setFormDisabled(false);

      const selected = cachedProfiles[0];
      currentProfileId = selected.id;

      if (listContainer) {
        listContainer.innerHTML = '';
        cachedProfiles.forEach(p => {
          const itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          itemBtn.className = 'brand-list-item active';
          itemBtn.dataset.profileId = p.id;

          const emoji = document.createElement('span');
          emoji.className = 'brand-list-item-emoji';
          emoji.textContent = p.profile?.emoji || '🏷️';

          const info = document.createElement('div');
          info.className = 'brand-list-item-info';

          const name = document.createElement('span');
          name.className = 'brand-list-item-name';
          name.textContent = p.profile?.name || p.id;

          const tag = document.createElement('span');
          tag.className = 'brand-list-item-tag';
          tag.textContent = p.profile?.tag ? `Cuenta Activa · ${p.profile.tag}` : 'Cuenta Activa';

          info.appendChild(name);
          info.appendChild(tag);
          itemBtn.appendChild(emoji);
          itemBtn.appendChild(info);

          itemBtn.addEventListener('click', () => {
            currentProfileId = p.id;
            populateForm(p);
            document.dispatchEvent(new CustomEvent('brand:selected', { detail: { id: p.id } }));
          });

          listContainer.appendChild(itemBtn);
        });
      }

      populateForm(selected);
      if (selected?.id) {
        document.dispatchEvent(new CustomEvent('brand:selected', { detail: { id: selected.id } }));
      }
    } catch (err) {
      console.error('Error cargando perfil de marca:', err);
      const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
      if (toastFn) toastFn('No se pudo cargar el perfil de marca', 'error');
    }
  };

  function initBrandModule() {
    const coreInput = document.getElementById('brand-hashtag-core');
    const bankInput = document.getElementById('brand-hashtag-bank');

    if (coreInput) {
      coreInput.addEventListener('input', updateChipPreviews);
    }
    if (bankInput) {
      bankInput.addEventListener('input', updateChipPreviews);
    }

    const btnReset = document.getElementById('btn-brand-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (!currentProfileId) return;
        const original = cachedProfiles.find(p => p.id === currentProfileId);
        if (original) {
          populateForm(original);
          const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
          if (toastFn) toastFn('Valores del perfil restablecidos', 'info');
        }
      });
    }

    const form = document.getElementById('brand-profile-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idInput = document.getElementById('brand-profile-id');
        const id = idInput ? idInput.value : currentProfileId;
        if (!id) {
          const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
          if (toastFn) toastFn('No hay perfil de marca seleccionado', 'error');
          return;
        }

        const saveBtn = document.getElementById('btn-brand-save');
        const originalBtnText = saveBtn ? saveBtn.innerHTML : 'Guardar Cambios';
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';
        }

        try {
          const voiceInput = document.getElementById('brand-voice');
          const rulesInput = document.getElementById('brand-rules');
          const coreIn = document.getElementById('brand-hashtag-core');
          const bankIn = document.getElementById('brand-hashtag-bank');
          const keywordsInput = document.getElementById('brand-match-keywords');

          const contactWeb = document.getElementById('brand-contact-web');
          const contactWhatsapp = document.getElementById('brand-contact-whatsapp');
          const contactTelefono = document.getElementById('brand-contact-telefono');
          const contactEmail = document.getElementById('brand-contact-email');
          const contactInstagram = document.getElementById('brand-contact-instagram');
          const contactDireccion = document.getElementById('brand-contact-direccion');
          const contactCierre = document.getElementById('brand-contact-cierre');

          const voice = voiceInput ? voiceInput.value.trim() : '';
          const rules = rulesInput
            ? rulesInput.value.split('\n').map(r => r.trim()).filter(Boolean)
            : [];
          const hashtagCore = coreIn
            ? parseHashtagString(coreIn.value)
            : [];
          const hashtagBank = bankIn
            ? parseHashtagString(bankIn.value)
            : [];
          const matchKeywords = keywordsInput
            ? keywordsInput.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
            : [];

          const contact = {
            web: contactWeb ? contactWeb.value.trim() : '',
            whatsapp: contactWhatsapp ? contactWhatsapp.value.trim() : '',
            telefono: contactTelefono ? contactTelefono.value.trim() : '',
            email: contactEmail ? contactEmail.value.trim() : '',
            instagram: contactInstagram ? contactInstagram.value.trim() : '',
            direccion: contactDireccion ? contactDireccion.value.trim() : '',
            cierre: contactCierre ? contactCierre.value.trim() : ''
          };

          const payload = { voice, rules, hashtagCore, hashtagBank, matchKeywords, contact };

          const res = await fetch(`/api/brand-profiles/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Error al actualizar perfil de marca');
          }

          const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
          if (toastFn) toastFn('Perfil de marca actualizado', 'success');

          await window.loadBrandProfiles(id);
        } catch (err) {
          console.error('Error saving brand profile:', err);
          const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
          if (toastFn) toastFn(err.message || 'Error al guardar perfil de marca', 'error');
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBrandModule);
  } else {
    initBrandModule();
  }
})();
