const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
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
        artist: 'Kevin MacLeod (Royalty-Free)',
        category: 'pop',
        categoryLabel: '✨ Pop & Alegre',
        mood: 'Feliz, Optimista, Ligero',
        durationSec: 205,
        streamUrl: '/audio/incomp_carefree.mp3',
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
        streamUrl: '/audio/kpop_demon_hunters.mp3',
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
        streamUrl: '/audio/kpop_golden_porter.mp3',
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
        streamUrl: '/audio/kpop_no_jutsu.mp3',
        license: 'Creative Commons / Audius Free',
        badge: 'Kawaii Beat',
        recommendedFor: 'Ramen Buldak, golosinas asiáticas y unboxings'
      },
      {
        id: 'kpop_seoul_wave',
        title: 'Huntrix - Golden Seoul Wave',
        artist: 'AXEL & Dumbfoundead (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Electro Pop, Estilo Idol, Festival',
        durationSec: 192,
        streamUrl: '/audio/kpop_seoul_wave.mp3',
        license: 'Creative Commons / Audius Free',
        badge: 'Seoul Pop',
        recommendedFor: 'Ofertas de fin de semana, ramen bar y productos importados'
      },
      {
        id: 'kpop_lollipops',
        title: 'Lollipops Or Die Beat (Remix)',
        artist: 'Wukileak (Audius)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Fresco, Alegre, Playa & Verano',
        durationSec: 128,
        streamUrl: '/audio/kpop_lollipops.mp3',
        license: 'Creative Commons / Audius Free',
        badge: 'Verano K',
        recommendedFor: 'Helados coreanos Melona, bebidas heladas y paseos en Algarrobo'
      },
      {
        id: 'incomp_lotus',
        title: 'Lotus Asian Harmony',
        artist: 'Kevin MacLeod (Royalty-Free)',
        category: 'kpop',
        categoryLabel: '🌸 K-Pop & Asia',
        mood: 'Tradición Oriental, Suave, Elegante',
        durationSec: 215,
        streamUrl: '/audio/incomp_lotus.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Tradicional',
        recommendedFor: 'Té coreano, kimchi artesanal y gastronomía tradicional'
      },
      {
        id: 'incomp_fluffing',
        title: 'Fluffing Duck Groove',
        artist: 'Kevin MacLeod (Royalty-Free)',
        category: 'funky',
        categoryLabel: '🍕 Divertido & Foodie',
        mood: 'Divertido, Pegajoso, Dinámico',
        durationSec: 67,
        streamUrl: '/audio/incomp_fluffing.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Viral',
        recommendedFor: 'Gastronomía, recetas, promociones flash con humor'
      },
      {
        id: 'incomp_riley',
        title: 'Life of Riley',
        artist: 'Kevin MacLeod (Royalty-Free)',
        category: 'pop',
        categoryLabel: '✨ Pop & Alegre',
        mood: 'Energía positiva, Verano, Fiesta',
        durationSec: 236,
        streamUrl: '/audio/incomp_riley.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Top Story',
        recommendedFor: 'Historias de fin de semana y eventos comerciales'
      },
      {
        id: 'incomp_local',
        title: 'Local Forecast Retail',
        artist: 'Kevin MacLeod (Royalty-Free)',
        category: 'corporate',
        categoryLabel: '💼 Corporativo & Marca',
        mood: 'Elegante, Comercial, Suave',
        durationSec: 198,
        streamUrl: '/audio/incomp_local.mp3',
        license: 'Creative Commons CC-BY 3.0',
        badge: 'Comercial',
        recommendedFor: 'Catálogos de productos, horarios y avisos de empresa'
      },
      {
        id: 'incomp_sneaky',
        title: 'Sneaky Snitch Curiosity',
        artist: 'Kevin MacLeod (Royalty-Free)',
        category: 'funky',
        categoryLabel: '🍕 Divertido & Foodie',
        mood: 'Curiosidad, Intriga, Misterio divertido',
        durationSec: 135,
        streamUrl: '/audio/incomp_sneaky.mp3',
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
   * Devuelve una ruta local de audio de respaldo garantizada (cero dependencia de red)
   * con consciencia de categoría para mantener fidelidad temática (ej. K-Pop para Kmarket)
   */
  getFallbackTrackLocal(preferredCategory = 'all') {
    const isKpop = preferredCategory === 'kpop' || 
                   (typeof preferredCategory === 'string' && (
                     preferredCategory.toLowerCase().includes('kpop') ||
                     preferredCategory.toLowerCase().includes('k-pop') ||
                     preferredCategory.toLowerCase().includes('korean') ||
                     preferredCategory.toLowerCase().includes('audius') ||
                     preferredCategory.toLowerCase().includes('asia')
                   ));

    const kpopCandidates = [
      path.join(__dirname, '../../public/audio/kpop_demon_hunters.mp3'),
      path.join(__dirname, '../../public/audio/kpop_golden_porter.mp3'),
      path.join(__dirname, '../../public/audio/kpop_seoul_wave.mp3'),
      path.join(__dirname, '../../public/audio/kpop_no_jutsu.mp3'),
      path.join(__dirname, '../../public/audio/kpop_lollipops.mp3')
    ];

    const generalCandidates = [
      path.join(__dirname, '../../public/audio/incomp_carefree.mp3'),
      path.join(this.cacheDir, 'fallback_carefree.mp3'),
      path.join(__dirname, '../../public/audio/incomp_riley.mp3')
    ];

    const candidates = isKpop ? [...kpopCandidates, ...generalCandidates] : [...generalCandidates, ...kpopCandidates];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).size > 10000) {
        return cand;
      }
    }

    // Buscar cualquier .mp3 en public/audio o cache
    try {
      const publicAudioDir = path.join(__dirname, '../../public/audio');
      if (fs.existsSync(publicAudioDir)) {
        const files = fs.readdirSync(publicAudioDir).filter(f => f.endsWith('.mp3'));
        if (files.length > 0) {
          return path.join(publicAudioDir, files[0]);
        }
      }
    } catch (_) {}

    return path.join(this.cacheDir, 'fallback_carefree.mp3');
  }

  /**
   * Asegura que una pista remota o local esté disponible en el disco
   * Multi-host failover y fallback local garantizado para erradicar el Error 522
   */
  async ensureTrackCached(trackOrUrl, meta = {}) {
    let url = trackOrUrl;
    let trackId = meta.id || 'custom';
    let trackTitle = meta.title || '';
    let trackCategory = meta.category || '';

    if (typeof trackOrUrl === 'object' && trackOrUrl !== null) {
      url = trackOrUrl.streamUrl || trackOrUrl.url || '';
      trackId = trackOrUrl.id || trackId;
      trackTitle = trackOrUrl.title || trackTitle;
      trackCategory = trackOrUrl.category || trackCategory;
    } else if (typeof trackOrUrl === 'string') {
      const found = this.curatedCatalog.find(t => t.id === trackOrUrl || t.streamUrl === trackOrUrl);
      if (found) {
        url = found.streamUrl;
        trackId = found.id;
        trackTitle = found.title;
        trackCategory = found.category;
      }
    }

    const isKpopTarget = trackCategory === 'kpop' ||
      /k-?pop|korea|asian|seoul|bts|twice|kawaii|audius/i.test(trackTitle || '') ||
      /k-?pop|korea|asian|seoul|audius/i.test(url || '');

    if (!url || typeof url !== 'string') {
      console.warn('[MusicService] URL de audio no proporcionada, usando audio de respaldo.');
      return this.getFallbackTrackLocal(isKpopTarget ? 'kpop' : 'all');
    }

    // 1. Si es ruta local (ej: /audio/kpop_demon_hunters.mp3 o /uploads/...)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const cleanRel = url.split('?')[0].replace(/^[\\\/]+/, '');
      const baseName = path.basename(cleanRel);

      const candidates = [
        path.join(__dirname, '../../public', cleanRel),
        path.join(__dirname, '../../public/audio', baseName),
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

      console.warn(`[MusicService] Audio local no encontrado (${url}), aplicando fallback garantizado.`);
      return this.getFallbackTrackLocal(isKpopTarget ? 'kpop' : 'all');
    }

    // 2. Si es URL remota (HTTP / HTTPS), verificar caché previa
    let cleanId = trackId;
    const audiusMatch = url.match(/\/tracks\/([a-zA-Z0-9_-]+)\/stream/);
    if (audiusMatch) {
      cleanId = `audius_${audiusMatch[1]}`;
    } else if (!cleanId || cleanId === 'custom') {
      const crypto = require('crypto');
      cleanId = `audio_${crypto.createHash('md5').update(url).digest('hex').slice(0, 16)}`;
    }
    cleanId = cleanId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const localFile = path.join(this.cacheDir, `${cleanId}.mp3`);

    if (fs.existsSync(localFile) && fs.statSync(localFile).size > 10000) {
      return localFile;
    }

    // 3. Preparar lista de URLs para failover si es Audius (solo hosts activos saludables)
    const urlsToTry = [url];
    if (audiusMatch) {
      const tid = audiusMatch[1];
      const audiusHosts = [
        'https://api.audius.co',
        'https://discoveryprovider.audius.co'
      ];
      for (const host of audiusHosts) {
        const u = `${host}/v1/tracks/${tid}/stream?app_name=metapulse`;
        if (!urlsToTry.includes(u)) urlsToTry.push(u);
      }
    }

    // 4. Descarga streaming con pipeline y timeout de 25s para redes de música
    for (const tryUrl of urlsToTry) {
      const tempLocal = `${localFile}.part_${Date.now()}`;
      try {
        console.log(`[MusicService] Descargando audio a caché: ${tryUrl}`);
        const response = await axios.get(tryUrl, {
          responseType: 'stream',
          timeout: 25000,
          maxRedirects: 8,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        await pipeline(response.data, fs.createWriteStream(tempLocal));

        if (fs.existsSync(tempLocal) && fs.statSync(tempLocal).size > 10000) {
          fs.renameSync(tempLocal, localFile);
          console.log(`[MusicService] Audio descargado y cacheado con éxito: ${localFile}`);
          return localFile;
        }
      } catch (err) {
        if (fs.existsSync(tempLocal)) {
          try { fs.unlinkSync(tempLocal); } catch (_) {}
        }
        console.warn(`[MusicService] Intento falló para ${tryUrl}: ${err.message} (status: ${err.response?.status || 'timeout'})`);
      }
    }

    // 5. Fallback inteligente: si la descarga remota falló,
    // usar un tema del mismo género garantizado (ej: K-Pop -> kpop_demon_hunters.mp3)
    console.warn(`[MusicService] El servidor de la pista remota no respondió (${url}). Aplicando audio local garantizado (Categoría: ${isKpopTarget ? 'K-Pop' : 'General'}).`);
    return this.getFallbackTrackLocal(isKpopTarget ? 'kpop' : 'all');
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
