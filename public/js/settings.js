// =============================================================================
// MetaPulse Settings & Meta Graph API Wizard Controller
// =============================================================================

window.loadSettingsData = async function() {
  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    if (!json.success) return;

    const s = json.data;

    // Llenar campos de Meta
    if (s.meta_app_id) document.getElementById('meta-app-id').value = s.meta_app_id;
    if (s.meta_user_token) document.getElementById('meta-user-token').value = s.meta_user_token;

    // Llenar campos de IA
    if (s.ai_provider) document.getElementById('ai-provider-select').value = s.ai_provider;
    if (s.ai_api_key) document.getElementById('ai-api-key').value = s.ai_api_key;
    if (s.brand_name) document.getElementById('brand-default-name').value = s.brand_name;

    // Llenar servidor & simulación
    if (s.public_url_base) document.getElementById('public-url-base').value = s.public_url_base;
    document.getElementById('toggle-simulation-mode').checked = (s.simulation_mode === 'true');

    // Llenar estado de auto-estampar sello
    const chkAutoStamp = document.getElementById('chk-auto-stamp-seal');
    if (chkAutoStamp) chkAutoStamp.checked = (s.auto_stamp_seal === 'true');

    // Cargar sello activo si existe
    window.loadActiveSealPreview();
  } catch (err) {
    console.error('Error cargando ajustes:', err);
  }
};

window.loadActiveSealPreview = async function() {
  try {
    const res = await fetch('/api/watermarks');
    const json = await res.json();
    if (!json.success || !json.data) return;

    const activeSeal = json.data && json.data.length > 0 ? json.data[0] : null;
    const sealImg = document.getElementById('settings-seal-img');
    const placeholder = document.getElementById('settings-seal-placeholder');
    const nameLabel = document.getElementById('settings-seal-filename');

    if (activeSeal && sealImg) {
      sealImg.src = activeSeal.filepath;
      sealImg.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      if (nameLabel) {
        nameLabel.textContent = `Sello activo: ${activeSeal.name} (${activeSeal.filename})`;
        nameLabel.classList.remove('text-muted');
        nameLabel.classList.add('text-emerald');
      }
    } else {
      if (sealImg) sealImg.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      if (nameLabel) {
        nameLabel.textContent = 'Ningún sello configurado para esta cuenta';
        nameLabel.classList.remove('text-emerald');
        nameLabel.classList.add('text-muted');
      }
    }
  } catch (err) {
    console.error('Error cargando preview del sello:', err);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btnExchangeToken = document.getElementById('btn-exchange-token');
  const btnDetectPages = document.getElementById('btn-detect-pages');
  const metaExchangeResult = document.getElementById('meta-exchange-result');
  const detectedPagesList = document.getElementById('detected-pages-list');

  // 1. Intercambiar Token por uno de 60 días
  if (btnExchangeToken) {
    btnExchangeToken.addEventListener('click', async () => {
      const appId = document.getElementById('meta-app-id').value.trim();
      const appSecret = document.getElementById('meta-app-secret').value.trim();
      const userToken = document.getElementById('meta-user-token').value.trim();

      if (!appId || !appSecret || !userToken) {
        showToast('Debes ingresar APP ID, APP SECRET y el User Token', 'error');
        return;
      }

      btnExchangeToken.disabled = true;
      showToast('Solicitando Token de Larga Duración (60 días) a Meta...', 'info');

      try {
        const res = await fetch('/api/meta/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, appSecret, userToken })
        });
        const json = await res.json();

        if (json.success && json.data) {
          const d = json.data;
          document.getElementById('meta-user-token').value = d.accessToken;
          metaExchangeResult.style.display = 'block';
          metaExchangeResult.className = 'alert-box';
          metaExchangeResult.innerHTML = `
            <strong>🎉 ¡Token de 60 días obtenido con éxito!</strong><br>
            <span class="text-muted" style="font-size:0.8rem;">Expira el: ${new Date(d.expiresAt).toLocaleDateString()}</span>
          `;
          showToast('Token de 60 días generado y guardado', 'success');
          // Activar paso 3
          document.getElementById('step-3').classList.add('active');
        } else {
          metaExchangeResult.style.display = 'block';
          metaExchangeResult.className = 'alert-box text-rose';
          metaExchangeResult.textContent = 'Error: ' + (json.error || 'Verifica tus credenciales');
          showToast('Error obteniendo token: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        btnExchangeToken.disabled = false;
      }
    });
  }

  // 2. Detectar Páginas de Facebook y Cuentas de Instagram
  if (btnDetectPages) {
    btnDetectPages.addEventListener('click', async () => {
      const userToken = document.getElementById('meta-user-token').value.trim();
      if (!userToken) {
        showToast('Debes ingresar tu User Token primero', 'error');
        return;
      }

      btnDetectPages.disabled = true;
      showToast('Consultando tus Páginas de Facebook e Instagram vinculadas...', 'info');

      try {
        const res = await fetch('/api/meta/detect-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userToken })
        });
        const json = await res.json();

        if (json.success && json.data) {
          const pages = json.data;
          if (pages.length === 0) {
            detectedPagesList.innerHTML = `
              <p class="text-rose">No se encontraron Páginas con permisos de administrador en este Token. Revisa los permisos (pages_show_list, pages_read_engagement).</p>
            `;
            return;
          }

          detectedPagesList.innerHTML = pages.map(p => {
            const hasIg = p.instagram;
            const isHidden = p.isHidden;
            const isActive = AppState.config && String(AppState.config.pageId) === String(p.pageId);
            return `
              <div class="page-select-card ${isHidden ? 'page-hidden' : ''}" style="${isHidden ? 'opacity: 0.55; filter: grayscale(0.6);' : ''}">
                <div class="page-info-block">
                  <div class="page-avatar">${p.pageName.charAt(0)}</div>
                  <div>
                    <strong>${p.pageName} ${isActive ? '<span class="badge badge-accent" style="margin-left:6px;">ACTIVA</span>' : ''} ${isHidden ? '<span class="badge" style="background:var(--border-color); color:var(--text-secondary); margin-left:6px;">OCULTA</span>' : ''}</strong>
                    <div class="text-muted" style="font-size:0.75rem;">
                      FB ID: ${p.pageId} ${hasIg ? `· Instagram: <strong>@${hasIg.username || hasIg.name}</strong> (${hasIg.id})` : '· (Sin Instagram vinculado)'}
                    </div>
                  </div>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                  <button class="btn btn-ghost btn-sm" onclick="toggleHideAccount('${p.pageId}', ${!isHidden})" title="${isHidden ? 'Mostrar en selector' : 'Ocultar del selector'}">
                    ${isHidden ? '👁️ Mostrar' : '🙈 Ocultar'}
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="selectPageAccount('${p.pageId}', '${p.pageName}', '${p.pageToken}', '${hasIg ? hasIg.id : ''}', '${hasIg ? (hasIg.username || hasIg.name) : ''}')">
                    ${isActive ? 'Re-vincular' : 'Vincular Cuenta'}
                  </button>
                </div>
              </div>
            `;
          }).join('');

          document.getElementById('step-3').classList.add('active');
          showToast(`¡Se encontraron ${pages.length} página(s)!`, 'success');
        } else {
          showToast('Error detectando páginas: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      } finally {
        btnDetectPages.disabled = false;
      }
    });
  }

  // 3. Guardar Configuración de IA
  const btnSaveAiSettings = document.getElementById('btn-save-ai-settings');
  if (btnSaveAiSettings) {
    btnSaveAiSettings.addEventListener('click', async () => {
      const provider = document.getElementById('ai-provider-select').value;
      const apiKey = document.getElementById('ai-api-key').value.trim();
      const brandName = document.getElementById('brand-default-name').value.trim();

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ai_provider: provider,
            ai_api_key: apiKey,
            brand_name: brandName
          })
        });
        const json = await res.json();
        if (json.success) {
          showToast('Configuración de IA guardada con éxito', 'success');
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  // 4. Guardar Configuración de Servidor & Simulación
  const btnSaveServerSettings = document.getElementById('btn-save-server-settings');
  if (btnSaveServerSettings) {
    btnSaveServerSettings.addEventListener('click', async () => {
      const publicUrlBase = document.getElementById('public-url-base').value.trim();
      const simulationMode = document.getElementById('toggle-simulation-mode').checked;

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            public_url_base: publicUrlBase,
            simulation_mode: simulationMode ? 'true' : 'false'
          })
        });
        const json = await res.json();
        if (json.success) {
          showToast('Ajustes de servidor y simulación actualizados', 'success');
          loadDashboardStatus();
        }
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    });
  }

  // 6. Subir Sello Oficial de Marca (PNG Transparente)
  const sealFileInput = document.getElementById('settings-seal-file');
  if (sealFileInput) {
    sealFileInput.addEventListener('change', async () => {
      if (!sealFileInput.files || sealFileInput.files.length === 0) return;
      const file = sealFileInput.files[0];

      const formData = new FormData();
      formData.append('logo', file);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      showToast('Guardando sello oficial de marca...', 'info');

      try {
        const res = await fetch('/api/watermark/upload-logo', {
          method: 'POST',
          body: formData
        });
        const json = await res.json();
        if (json.success) {
          showToast('¡Sello oficial guardado con éxito!', 'success');
          window.loadActiveSealPreview();
          if (window.loadWatermarksList) window.loadWatermarksList();
        } else {
          showToast('Error: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('Error subiendo sello: ' + err.message, 'error');
      }
    });
  }

  // 7. Toggle de Auto-estampar Sello Oficial
  const chkAutoStampSeal = document.getElementById('chk-auto-stamp-seal');
  if (chkAutoStampSeal) {
    chkAutoStampSeal.addEventListener('change', async () => {
      const active = chkAutoStampSeal.checked;
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auto_stamp_seal: active ? 'true' : 'false'
          })
        });
        showToast(active ? 'Auto-estampado de sello activado para afiches' : 'Auto-estampado desactivado', 'info');
      } catch (err) {
        console.error('Error guardando auto_stamp_seal:', err);
      }
    });
  }
});

window.selectPageAccount = async function(pageId, pageName, pageToken, instagramId, instagramUsername) {
  try {
    const res = await fetch('/api/meta/select-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, pageName, pageToken, instagramId, instagramUsername })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`¡${pageName} vinculada correctamente para publicación!`, 'success');
      loadDashboardStatus();
      navigateToTab('dashboard');
    } else {
      showToast('Error: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};

window.toggleHideAccount = async function(pageId, hide) {
  try {
    const res = await fetch('/api/meta/toggle-hide-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, hide })
    });
    const json = await res.json();
    if (json.success) {
      showToast(hide ? 'Cuenta ocultada de la lista activa' : 'Cuenta ahora visible en el selector', 'success');
      loadAccountSwitcher();
      // Re-ejecutar detección para refrescar la lista en Settings
      const btnDetect = document.getElementById('btn-detect-pages');
      if (btnDetect) btnDetect.click();
    } else {
      showToast('Error: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
};


