const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { getSetting } = require('../database/db');

class MusicService {
  constructor() {
    this.audioDir = path.join(__dirname, '../../uploads/audio');
    this.cacheDir = path.join(this.audioDir, 'cache');

    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Catálogo curado de música Royalty-Free / Creative Commons de alta calidad
    // Compatible para uso comercial en Instagram y Facebook Stories
    this.curatedCatalog = [
      {
        id: 'incomp_carefree',
        title: 'Carefree & Happy',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'pop',
        categoryLabel: '✨ Pop & Alegre',
        mood: 'Feliz, Optimista, Ligero',
        durationSec: 205,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Popular',
        recommendedFor: 'Promociones, ofertas de temporada y novedades'
      },
      {
        id: 'incomp_airport',
        title: 'Airport Lounge & Chill',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'lofi',
        categoryLabel: '☕ Lo-Fi & Relax',
        mood: 'Relajado, Suave, Café',
        durationSec: 226,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Airport%20Lounge.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Chill',
        recommendedFor: 'Historias de café, lifestyle, detrás de escena'
      },
      {
        id: 'incomp_daily',
        title: 'Daily Beetle Folk',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'acoustic',
        categoryLabel: '🎸 Acústico & Cálido',
        mood: 'Acústico, Guitarra, Amigable',
        durationSec: 279,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Daily%20Beetle.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Cálido',
        recommendedFor: 'Mensajes a la comunidad, productos artesanales'
      },
      {
        id: 'incomp_cipher',
        title: 'Cipher Cyber Beat',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'electronic',
        categoryLabel: '⚡ Electrónica & Tech',
        mood: 'Moderno, Digital, Enérgico',
        durationSec: 232,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Moderno',
        recommendedFor: 'Lanzamientos tecnológicos, servicios web, avisos modernos'
      },
      {
        id: 'incomp_fluffing',
        title: 'Fluffing Duck Groove',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'funky',
        categoryLabel: '🍕 Divertido & Foodie',
        mood: 'Divertido, Pegajoso, Dinámico',
        durationSec: 67,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Viral',
        recommendedFor: 'Gastronomía, recetas, promociones flash con humor'
      },
      {
        id: 'incomp_riley',
        title: 'Life of Riley',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'pop',
        categoryLabel: '✨ Pop & Alegre',
        mood: 'Energía positiva, Verano, Fiesta',
        durationSec: 236,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Life%20of%20Riley.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Top Story',
        recommendedFor: 'Historias de fin de semana y eventos comerciales'
      },
      {
        id: 'incomp_local',
        title: 'Local Forecast Retail',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'corporate',
        categoryLabel: '💼 Corporativo & Marca',
        mood: 'Elegante, Comercial, Suave',
        durationSec: 198,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Local%20Forecast%20-%20Elevator.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Comercial',
        recommendedFor: 'Catálogos de productos, horarios y avisos de empresa'
      },
      {
        id: 'incomp_sneaky',
        title: 'Sneaky Snitch Curiosity',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'funky',
        categoryLabel: '🍕 Divertido & Foodie',
        mood: 'Curiosidad, Intriga, Misterio divertido',
        durationSec: 135,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Curioso',
        recommendedFor: 'Anticipos de sorpresas, sorteos y preguntas interactivas'
      }
    ];
  }

  /**
   * Obtiene la lista curada de música sin copyright
   */
  getCuratedCatalog(category = null, search = null) {
    let list = [...this.curatedCatalog];

    if (category && category !== 'all') {
      list = list.filter(t => t.category === category);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.artist.toLowerCase().includes(q) || 
        t.mood.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q)
      );
    }

    return list;
  }

  /**
   * Asegura que una pista remota esté descargada en caché local
   */
  async ensureTrackCached(trackOrUrl) {
    let url = trackOrUrl;
    let trackId = 'custom';

    if (typeof trackOrUrl === 'object' && trackOrUrl.streamUrl) {
      url = trackOrUrl.streamUrl;
      trackId = trackOrUrl.id;
    } else {
      const found = this.curatedCatalog.find(t => t.id === trackOrUrl || t.streamUrl === trackOrUrl);
      if (found) {
        url = found.streamUrl;
        trackId = found.id;
      }
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const cleanRel = url.split('?')[0].replace(/^[\\\/]+/, '');
      const baseName = path.basename(cleanRel);

      const candidates = [
        path.join(__dirname, '../../', cleanRel),
        path.join(__dirname, '../../uploads/audio', baseName),
        path.join(__dirname, '../../uploads/audio/cache', baseName),
        path.join(__dirname, '../../uploads', baseName),
        url.split('?')[0]
      ];

      for (const cand of candidates) {
        if (cand && fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) {
          return cand;
        }
      }

      throw new Error(`Archivo de audio local no encontrado: ${url}`);
    }

    // Nombre de archivo en caché basado en hash o id
    const cleanId = trackId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const localFile = path.join(this.cacheDir, `${cleanId}.mp3`);

    if (fs.existsSync(localFile) && fs.statSync(localFile).size > 10000) {
      return localFile;
    }

    // Descargar a caché
    console.log(`[MusicService] Descargando audio sin copyright a caché: ${url}`);
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    fs.writeFileSync(localFile, Buffer.from(response.data));
    return localFile;
  }

  /**
   * Búsqueda en API externa de Jamendo (si el usuario tiene configurado un client_id o fallback)
   */
  async searchJamendo({ query = '', tag = '', limit = 15 }) {
    const clientId = getSetting('jamendo_client_id');
    if (!clientId) {
      // Si no hay API key configurada, buscar en catálogo curado
      return {
        source: 'curated_fallback',
        results: this.getCuratedCatalog(tag, query)
      };
    }

    try {
      const params = {
        client_id: clientId,
        format: 'json',
        limit: limit,
        audioformat: 'mp32',
        order: 'popularity_month'
      };

      if (query) params.namesearch = query;
      if (tag && tag !== 'all') params.tags = tag;

      const res = await axios.get('https://api.jamendo.com/v3.0/tracks/', { params, timeout: 8000 });
      const tracks = (res.data.results || []).map(t => ({
        id: `jam_${t.id}`,
        title: t.name,
        artist: t.artist_name,
        category: tag || 'general',
        categoryLabel: 'Jamendo Royalty-Free',
        mood: (t.musicinfo?.tags?.genres || []).join(', ') || 'Instrumental',
        durationSec: t.duration,
        streamUrl: t.audio,
        license: t.license_ccurl || 'Creative Commons',
        badge: 'Jamendo',
        recommendedFor: 'Historias comerciales e institucionales'
      }));

      return {
        source: 'jamendo_api',
        results: tracks
      };
    } catch (err) {
      console.warn('[MusicService] Error consultando Jamendo API:', err.message);
      return {
        source: 'curated_fallback',
        error: err.message,
        results: this.getCuratedCatalog(tag, query)
      };
    }
  }

  /**
   * Obtiene la lista de audios subidos manualmente por el usuario
   */
  getUserUploadedAudios() {
    if (!fs.existsSync(this.audioDir)) return [];
    const files = fs.readdirSync(this.audioDir);
    return files
      .filter(f => f.match(/\.(mp3|wav|m4a|aac|ogg)$/i) && !fs.statSync(path.join(this.audioDir, f)).isDirectory())
      .map(filename => {
        const stat = fs.statSync(path.join(this.audioDir, filename));
        return {
          filename,
          relativeUrl: `/uploads/audio/${filename}`,
          sizeBytes: stat.size,
          createdAt: stat.mtime
        };
      });
  }
}

module.exports = new MusicService();
