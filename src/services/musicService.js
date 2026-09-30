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
        id: 'kpop_demon_hunters',
        title: 'K-Pop Demon Hunters (Remix)',
        artist: 'Knights of Volition (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Energía K-Pop, Beat Moderno, Dinámico',
        durationSec: 174,
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/Q0JKxYB/stream?app_name=metapulse',
        license: 'Creative Commons / Audius Free',
        badge: 'K-Pop Viral',
        recommendedFor: 'Reels dinámicos de Kmarket, snacks virales y novedades'
      },
      {
        id: 'kpop_golden_porter',
        title: 'Golden K-Pop Beats (Remix)',
        artist: 'Michael Porter Music (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Pop Brillante, Melódico, Upbeat',
        durationSec: 135,
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/Y94XWaq/stream?app_name=metapulse',
        license: 'Creative Commons / Audius Free',
        badge: 'K-Pop Hit',
        recommendedFor: 'Presentación de bebidas Milkis, dulces y postres coreanos'
      },
      {
        id: 'kpop_no_jutsu',
        title: 'K-Pop No Jutsu (Anime & Kawaii Trap)',
        artist: 'Eugene Cam (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Kawaii, Trap Melódico, Divertido',
        durationSec: 108,
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/P5K7R/stream?app_name=metapulse',
        license: 'Creative Commons / Audius Free',
        badge: 'Kawaii Beat',
        recommendedFor: 'Ramen Buldak, golosinas asiáticas y unboxings'
      },
      {
        id: 'kpop_seoul_wave',
        title: 'Huntrix - Golden Seoul Wave',
        artist: 'SUTSU x YGG (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Electro Pop, Estilo Idol, Festival',
        durationSec: 192,
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/r9ywoPN/stream?app_name=metapulse',
        license: 'Creative Commons / Audius Free',
        badge: 'Seoul Pop',
        recommendedFor: 'Ofertas de fin de semana, ramen bar y productos importados'
      },
      {
        id: 'kpop_korean_samba',
        title: 'Korean Samba & Summer Vibes',
        artist: 'Alex Madore (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Fresco, Alegre, Playa & Verano',
        durationSec: 128,
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/mRY7r/stream?app_name=metapulse',
        license: 'Creative Commons / Audius Free',
        badge: 'Verano K',
        recommendedFor: 'Helados coreanos Melona, bebidas heladas y paseos en Algarrobo'
      },
      {
        id: 'kpop_romcoms',
        title: 'Korean Rom-Coms Chill Guitar',
        artist: 'Saint Coke (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Acústico K-Drama, Dulce, Romántico',
        durationSec: 72,
        streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/ep2YM/stream?app_name=metapulse',
        license: 'Creative Commons / Audius Free',
        badge: 'K-Drama',
        recommendedFor: 'Snacks dulces, té matcha y momentos acogedores'
      },
      {
        id: 'incomp_lotus',
        title: 'Lotus Asian Harmony',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Tradición Oriental, Suave, Elegante',
        durationSec: 215,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Lotus.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Tradicional',
        recommendedFor: 'Té coreano, kimchi artesanal y gastronomía tradicional'
      },
      {
        id: 'incomp_eastern',
        title: 'Eastern Thought & Zen Beats',
        artist: 'Kevin MacLeod (Incompetech)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Zen, Meditativo, Instrumentos Asiáticos',
        durationSec: 198,
        streamUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Eastern%20Thought.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Zen Asia',
        recommendedFor: 'Productos orgánicos, dumplings Mandu al vapor y gastronomía coreana'
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

    // Nombre de archivo en caché basado en hash o id único
    let cleanId = trackId;
    if (!cleanId || cleanId === 'custom') {
      const audiusMatch = url.match(/\/tracks\/([a-zA-Z0-9_-]+)\/stream/);
      if (audiusMatch) {
        cleanId = `audius_${audiusMatch[1]}`;
      } else {
        const crypto = require('crypto');
        cleanId = `audio_${crypto.createHash('md5').update(url).digest('hex').slice(0, 16)}`;
      }
    }
    cleanId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const localFile = path.join(this.cacheDir, `${cleanId}.mp3`);

    if (fs.existsSync(localFile) && fs.statSync(localFile).size > 10000) {
      return localFile;
    }

    // Descargar a caché
    console.log(`[MusicService] Descargando audio sin copyright a caché: ${url}`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 35000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    fs.writeFileSync(localFile, Buffer.from(response.data));
    return localFile;
  }

  /**
   * Búsqueda en Audius API (Plataforma abierta y libre de música sin copyright y remixes K-Pop)
   * 100% gratuita, sin clave de API requerida.
   */
  async searchAudius({ query = 'kpop', limit = 20 }) {
    const cleanQ = (query || 'kpop').trim();
    const discoveryHosts = [
      'https://discoveryprovider.audius.co',
      'https://api.audius.co'
    ];

    let lastErr = null;
    for (const host of discoveryHosts) {
      try {
        const res = await axios.get(`${host}/v1/tracks/search`, {
          params: {
            query: cleanQ,
            app_name: 'metapulse'
          },
          timeout: 9000,
          headers: {
            'User-Agent': 'MetaPulse/1.0 (Windows NT 10.0)'
          }
        });

        if (res.data && Array.isArray(res.data.data)) {
          const streamable = res.data.data
            .filter(t => t.is_streamable !== false && !t.is_gated && !t.stream_conditions && t.duration < 600)
            .slice(0, limit)
            .map(t => {
              const artwork = t.artwork?.['150x150'] || t.artwork?.['480x480'] || '';
              return {
                id: `audius_${t.id}`,
                title: t.title,
                artist: t.user?.name || 'Artista Independiente',
                category: 'kpop',
                categoryLabel: 'Audius Free Music',
                mood: t.genre || 'K-Pop / Beat',
                durationSec: t.duration || 120,
                streamUrl: `${host}/v1/tracks/${t.id}/stream?app_name=metapulse`,
                artworkUrl: artwork,
                license: 'Creative Commons / Audius Free',
                badge: 'Audius',
                recommendedFor: 'Reels, Stories y videos de Kmarket'
              };
            });

          return {
            source: 'audius_api',
            results: streamable
          };
        }
      } catch (err) {
        lastErr = err;
        console.warn(`[MusicService] Audius host ${host} falló:`, err.message);
      }
    }

    return {
      source: 'audius_api',
      error: lastErr ? lastErr.message : 'No se pudo conectar a Audius',
      results: []
    };
  }

  /**
   * Búsqueda en API externa de Jamendo (si el usuario tiene configurado un client_id o fallback)
   */
  async searchJamendo({ query = '', tag = '', limit = 15 }) {
    const clientId = getSetting('jamendo_client_id');
    if (!clientId) {
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
   * Búsqueda inteligente multi-proveedor (Audius prioritario para K-Pop, Jamendo y Catálogo Curado)
   */
  async searchAllSources({ query = '', tag = '', limit = 20, provider = 'all' }) {
    const q = (query || '').trim();

    // 1. Si el usuario solicita explícitamente Audius o busca temáticas K-Pop / Asia
    const isKpopQuery = q.toLowerCase().includes('kpop') ||
      q.toLowerCase().includes('k-pop') ||
      q.toLowerCase().includes('korean') ||
      q.toLowerCase().includes('asian') ||
      q.toLowerCase().includes('seoul') ||
      q.toLowerCase().includes('bts') ||
      q.toLowerCase().includes('twice') ||
      q.toLowerCase().includes('blackpink') ||
      q.toLowerCase().includes('kawaii') ||
      tag === 'kpop';

    if (provider === 'audius' || isKpopQuery) {
      const audiusRes = await this.searchAudius({ query: q || 'kpop', limit });
      if (audiusRes.results && audiusRes.results.length > 0) {
        return audiusRes;
      }
    }

    // 2. Si hay Jamendo configurado con Client ID
    if (provider === 'jamendo' || getSetting('jamendo_client_id')) {
      const jamRes = await this.searchJamendo({ query: q, tag, limit });
      if (jamRes.results && jamRes.results.length > 0 && jamRes.source === 'jamendo_api') {
        return jamRes;
      }
    }

    // 3. Búsqueda en Audius abierta
    if (q) {
      const audiusRes = await this.searchAudius({ query: q, limit });
      if (audiusRes.results && audiusRes.results.length > 0) {
        return audiusRes;
      }
    }

    // 4. Fallback al catálogo curado local
    return {
      source: 'curated_fallback',
      results: this.getCuratedCatalog(tag, q)
    };
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
