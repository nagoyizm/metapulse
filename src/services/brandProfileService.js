const { db } = require('../database/db');

class BrandProfileService {
  listProfiles() {
    const rows = db.prepare('SELECT id, match_keywords, profile, updated_at FROM brand_profiles').all();
    return rows.map(r => {
      let matchKeywords = [];
      try {
        matchKeywords = JSON.parse(r.match_keywords || '[]');
      } catch (_) {}

      let profile = {};
      try {
        profile = JSON.parse(r.profile);
      } catch (_) {}

      profile.id = profile.id || r.id;

      return {
        id: r.id,
        matchKeywords,
        profile
      };
    });
  }

  getProfileById(id) {
    if (!id) return null;
    const row = db.prepare('SELECT id, match_keywords, profile FROM brand_profiles WHERE id = ?').get(id);
    if (!row) return null;
    try {
      const profile = JSON.parse(row.profile);
      profile.id = profile.id || row.id;
      return profile;
    } catch (_) {
      return null;
    }
  }

  getProfile(accountName = '', accountId = '') {
    const combined = `${accountName || ''} ${accountId || ''}`.toLowerCase();
    const rows = db.prepare('SELECT id, match_keywords, profile FROM brand_profiles').all();
    for (const row of rows) {
      let keywords = [];
      try {
        keywords = JSON.parse(row.match_keywords || '[]');
      } catch (_) {}

      if (Array.isArray(keywords) && keywords.some(k => k && combined.includes(String(k).toLowerCase()))) {
        try {
          const profile = JSON.parse(row.profile);
          profile.id = profile.id || row.id;
          return profile;
        } catch (_) {}
      }
    }
    return null;
  }

  updateProfile(id, patch = {}) {
    if (!id) throw new Error('ID de perfil requerido');
    const row = db.prepare('SELECT id, match_keywords, profile FROM brand_profiles WHERE id = ?').get(id);
    if (!row) {
      throw new Error(`Perfil de marca no encontrado: ${id}`);
    }

    let existingProfile = {};
    try {
      existingProfile = JSON.parse(row.profile);
    } catch (_) {}

    const patchCopy = { ...(patch || {}) };
    let updateKeywords = false;
    let newMatchKeywords = null;

    if ('matchKeywords' in patchCopy) {
      updateKeywords = true;
      newMatchKeywords = patchCopy.matchKeywords;
      delete patchCopy.matchKeywords;
    }

    const mergedProfile = { ...existingProfile, ...patchCopy, id };

    if (updateKeywords) {
      db.prepare(`
        UPDATE brand_profiles
        SET profile = ?, match_keywords = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(mergedProfile), JSON.stringify(newMatchKeywords), id);
    } else {
      db.prepare(`
        UPDATE brand_profiles
        SET profile = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(mergedProfile), id);
    }

    return mergedProfile;
  }

  buildContactBlock(profile) {
    if (!profile) return '';
    const contact = profile.contact;
    if (!contact || typeof contact !== 'object') return '';

    const lines = [];
    if (contact.web && String(contact.web).trim()) lines.push(`- Web: ${String(contact.web).trim()}`);
    if (contact.whatsapp && String(contact.whatsapp).trim()) lines.push(`- WhatsApp: ${String(contact.whatsapp).trim()}`);
    if (contact.telefono && String(contact.telefono).trim()) lines.push(`- Teléfono: ${String(contact.telefono).trim()}`);
    if (contact.email && String(contact.email).trim()) lines.push(`- Email: ${String(contact.email).trim()}`);
    if (contact.instagram && String(contact.instagram).trim()) lines.push(`- Instagram: ${String(contact.instagram).trim()}`);
    if (contact.direccion && String(contact.direccion).trim()) lines.push(`- Dirección: ${String(contact.direccion).trim()}`);

    const cierre = contact.cierre && String(contact.cierre).trim() ? `Cierre preferido: ${String(contact.cierre).trim()}` : '';

    if (lines.length === 0 && !cierre) {
      return '';
    }

    let block = 'DATOS DE CONTACTO OFICIALES (usa al menos la web o el WhatsApp en el cierre, escritos tal cual; no inventes otros datos):';
    if (lines.length > 0) {
      block += '\n' + lines.join('\n');
    }
    if (cierre) {
      block += '\n' + cierre;
    }
    return block;
  }
}

module.exports = new BrandProfileService();
