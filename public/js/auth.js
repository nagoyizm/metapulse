/**
 * MetaPulse — Módulo de Autenticación y Seguridad
 * Protege la aplicación con sesiones seguras y pantalla de login
 */

(function() {
  const TOKEN_KEY = 'metapulse_token';

  // 1. Interceptar todos los fetch salientes para adjuntar el token de autorización
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    let [resource, config] = args;
    config = config || {};
    config.headers = config.headers || {};

    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      if (config.headers instanceof Headers) {
        if (!config.headers.has('Authorization')) {
          config.headers.append('Authorization', `Bearer ${token}`);
        }
        if (!config.headers.has('x-auth-token')) {
          config.headers.append('x-auth-token', token);
        }
      } else {
        config.headers['Authorization'] = config.headers['Authorization'] || `Bearer ${token}`;
        config.headers['x-auth-token'] = config.headers['x-auth-token'] || token;
      }
    }

    const response = await originalFetch(resource, config);

    // Si el servidor responde 401 Unauthorized, forzar inicio de sesión
    if (response.status === 401) {
      const urlStr = typeof resource === 'string' ? resource : resource.url;
      if (!urlStr.includes('/api/auth/login')) {
        showLoginOverlay('Tu sesión ha expirado o no estás autorizado. Por favor ingresa nuevamente.');
      }
    }

    return response;
  };

  function showLoginOverlay(errorMessage = null) {
    const overlay = document.getElementById('auth-overlay');
    const errorBox = document.getElementById('auth-error-box');
    const userBadge = document.getElementById('auth-user-badge');

    if (userBadge) userBadge.style.display = 'none';

    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
    }

    if (errorBox) {
      if (errorMessage) {
        errorBox.textContent = errorMessage;
        errorBox.style.display = 'block';
      } else {
        errorBox.style.display = 'none';
      }
    }

    const pwdInput = document.getElementById('auth-password');
    if (pwdInput) {
      pwdInput.value = '';
      setTimeout(() => pwdInput.focus(), 150);
    }
  }

  function hideLoginOverlay(user) {
    const overlay = document.getElementById('auth-overlay');
    const userBadge = document.getElementById('auth-user-badge');
    const userNameEl = document.getElementById('auth-user-name');

    if (overlay) {
      overlay.style.display = 'none';
    }

    if (userBadge) {
      userBadge.style.display = 'inline-flex';
      if (userNameEl && user) {
        userNameEl.textContent = user.name || user.email || 'Andrés Vega';
      }
    }
  }

  async function checkAuthStatus() {
    try {
      const res = await originalFetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}`,
          'x-auth-token': localStorage.getItem(TOKEN_KEY) || ''
        }
      });
      const json = await res.json();
      if (json.success && json.authenticated) {
        hideLoginOverlay(json.user);
        return true;
      } else {
        showLoginOverlay();
        return false;
      }
    } catch (_) {
      showLoginOverlay();
      return false;
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const errorBox = document.getElementById('auth-error-box');
    const btnSubmit = document.getElementById('btn-submit-auth-login');
    const spinner = document.getElementById('btn-auth-spinner');
    const btnText = document.getElementById('btn-auth-text');

    if (!email || !password) {
      if (errorBox) {
        errorBox.textContent = 'Por favor ingresa tu correo y contraseña.';
        errorBox.style.display = 'block';
      }
      return;
    }

    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (btnText) btnText.textContent = 'Verificando credenciales...';
    if (errorBox) errorBox.style.display = 'none';

    try {
      const res = await originalFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json();

      if (json.success && json.token) {
        localStorage.setItem(TOKEN_KEY, json.token);
        hideLoginOverlay(json.user);

        // Inicializar o recargar datos de la plataforma
        if (typeof window.initializeApp === 'function') {
          window.initializeApp();
        } else {
          window.location.reload();
        }
      } else {
        if (errorBox) {
          errorBox.textContent = json.error || 'Correo o contraseña incorrectos.';
          errorBox.style.display = 'block';
        }
      }
    } catch (err) {
      if (errorBox) {
        errorBox.textContent = 'Error de conexión con el servidor: ' + err.message;
        errorBox.style.display = 'block';
      }
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (btnText) btnText.textContent = '🔐 Iniciar Sesión';
    }
  }

  async function handleLogout() {
    if (!confirm('¿Deseas cerrar tu sesión en MetaPulse?')) return;
    try {
      await originalFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    localStorage.removeItem(TOKEN_KEY);
    showLoginOverlay('Sesión cerrada correctamente.');
  }

  // Inicialización de Eventos DOM
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-auth-login');
    if (form) form.addEventListener('submit', handleLoginSubmit);

    const btnLogout = document.getElementById('btn-auth-logout');
    if (btnLogout) btnLogout.addEventListener('click', handleLogout);

    const btnTogglePwd = document.getElementById('btn-toggle-auth-pwd');
    const pwdInput = document.getElementById('auth-password');
    if (btnTogglePwd && pwdInput) {
      btnTogglePwd.addEventListener('click', () => {
        const isPassword = pwdInput.type === 'password';
        pwdInput.type = isPassword ? 'text' : 'password';
        btnTogglePwd.textContent = isPassword ? '🙈' : '👁️';
      });
    }

    // Verificar estado inicial
    checkAuthStatus();
  });

  window.MetaPulseAuth = {
    checkAuthStatus,
    logout: handleLogout
  };
})();
