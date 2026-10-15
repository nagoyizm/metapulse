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

  window.loadBrandProfiles = async function (targetId) {
    const listContainer = document.getElementById('brand-profiles-list');
    try {
      const res = await fetch('/api/brand-profiles');
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

      cachedProfiles = data.profiles;
      if (cachedProfiles.length === 0) {
        if (listContainer) {
          listContainer.innerHTML = '<div class="text-muted p-3">No hay perfiles de marca configurados</div>';
        }
        return;
      }

      let selected = null;
      if (targetId) {
        selected = cachedProfiles.find(p => p.id === targetId);
      }
      if (!selected && currentProfileId) {
        selected = cachedProfiles.find(p => p.id === currentProfileId);
      }
      if (!selected) {
        selected = cachedProfiles[0];
      }
      currentProfileId = selected.id;

      if (listContainer) {
        listContainer.innerHTML = '';
        cachedProfiles.forEach(p => {
          const itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          itemBtn.className = `brand-list-item ${p.id === currentProfileId ? 'active' : ''}`;
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
          tag.textContent = p.profile?.tag || '';

          info.appendChild(name);
          info.appendChild(tag);
          itemBtn.appendChild(emoji);
          itemBtn.appendChild(info);

          itemBtn.addEventListener('click', () => {
            currentProfileId = p.id;
            document.querySelectorAll('.brand-list-item').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.profileId === p.id);
            });
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
      console.error('Error cargando perfiles de marca:', err);
      const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
      if (toastFn) toastFn('No se pudieron cargar los perfiles de marca', 'error');
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
