const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getSetting } = require('../database/db');
const { getCampinaKnowledgePrompt, CAMPINA_VERIFIED_DATA, scrapeCampinaWebsite } = require('../data/campinaKnowledge');

class AIService {
  getApiKey() {
    return getSetting('ai_api_key') || process.env.GEMINI_API_KEY || '';
  }

  getImageApiKey() {
    return getSetting('ai_image_api_key') || getSetting('ai_api_key') || process.env.GEMINI_API_KEY || '';
  }

  /**
   * Genera copys atractivos y hashtags según el tema, tono y objetivo
   */
  async generateCopy({ topic, tone = 'engaging', goal = 'engagement', platform = 'both', brandName = '', customInstructions = '' }) {
    const provider = getSetting('ai_provider') || 'local';
    const apiKey = getSetting('ai_api_key') || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

    // Si hay una API Key configurada para Gemini
    if (provider === 'gemini' && apiKey) {
      try {
        return await this.generateWithGemini({ topic, tone, goal, platform, brandName, customInstructions, apiKey });
      } catch (err) {
        console.warn('⚠️ Falló llamada a Gemini API, usando generador inteligente local:', err.message);
      }
    }

    // Si hay una API Key configurada para OpenAI
    if (provider === 'openai' && apiKey) {
      try {
        return await this.generateWithOpenAI({ topic, tone, goal, platform, brandName, customInstructions, apiKey });
      } catch (err) {
        console.warn('⚠️ Falló llamada a OpenAI API, usando generador inteligente local:', err.message);
      }
    }

    // Si hay una API Key configurada para Claude / Anthropic
    if (provider === 'claude' && apiKey) {
      try {
        return await this.generateWithClaude({ topic, tone, goal, platform, brandName, customInstructions, apiKey });
      } catch (err) {
        console.warn('⚠️ Falló llamada a Claude API, usando generador inteligente local:', err.message);
      }
    }

    // Generador inteligente de plantillas copywriting de alto impacto
    return this.generateSmartTemplate({ topic, tone, goal, platform, brandName, customInstructions });
  }

  /**
   * Generación mediante Google Gemini API
   */
  async generateWithGemini({ topic, tone, goal, platform, brandName, customInstructions, apiKey }) {
    const prompt = this.buildPrompt({ topic, tone, goal, platform, brandName, customInstructions });
    const configuredModel = getSetting('ai_model') || 'gemini-3.6-flash';
    const modelsToTry = [
      'gemini-3.6-flash',
      configuredModel,
      'gemini-2.5-flash',
      'gemini-flash-latest'
    ];
    // Eliminar duplicados manteniendo orden
    const uniqueModels = [...new Set(modelsToTry)];

    let lastError = null;
    for (const model of uniqueModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
          systemInstruction: {
            parts: [{ text: 'Eres un copywriter experto en marketing digital para redes sociales (Facebook e Instagram). Genera directamente el texto final listo para copiar y publicar. No incluyas introducciones como "Aquí tienes tu post", ni notas de explicación ni meta-comentarios.' }]
          },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        }, { timeout: 10000 });

        const parts = response.data?.candidates?.[0]?.content?.parts || [];
        const actualPart = parts.find(p => !p.thought)?.text || parts[parts.length - 1]?.text;
        if (actualPart) {
          return this.parseAIResponse(actualPart, topic);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini API] Falló intento con modelo ${model}:`, err.response?.data?.error?.message || err.message);
      }
    }

    throw lastError || new Error('No se pudo generar respuesta con ningún modelo de Gemini.');
  }

  /**
   * Generación mediante OpenAI API
   */
  async generateWithOpenAI({ topic, tone, goal, platform, brandName, customInstructions, apiKey }) {
    const prompt = this.buildPrompt({ topic, tone, goal, platform, brandName, customInstructions });
    const model = getSetting('ai_model') || 'gpt-4o-mini';

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: model,
      messages: [
        { role: 'system', content: 'Eres un copywriter experto en redes sociales (Facebook e Instagram) especializado en engagement y conversiones.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    const candidate = response.data?.choices?.[0]?.message?.content;
    if (!candidate) throw new Error('No se recibió texto de OpenAI.');

    return this.parseAIResponse(candidate, topic);
  }

  /**
   * Generación mediante Anthropic Claude API
   */
  async generateWithClaude({ topic, tone, goal, platform, brandName, customInstructions, apiKey }) {
    const prompt = this.buildPrompt({ topic, tone, goal, platform, brandName, customInstructions });
    const model = getSetting('ai_model') || 'claude-3-5-sonnet-20241022';

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: model,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });

    const candidate = response.data?.content?.[0]?.text;
    if (!candidate) throw new Error('No se recibió texto de Claude.');

    return this.parseAIResponse(candidate, topic);
  }

  /**
   * Construye el prompt estructurado para los modelos de lenguaje
   */
  buildPrompt({ topic, tone, goal, platform, brandName, customInstructions }) {
    if (customInstructions && customInstructions.length > 50) {
      return `
Negocio / Marca: "${brandName || 'Redes Sociales'}"
Plataforma: ${platform === 'both' ? 'Facebook e Instagram' : platform}
Tema: "${topic}"

${customInstructions}
`;
    }

    return `
Eres un estratega y copywriter de élite para Instagram y Facebook (Metodología Instagram Skills 2026).
Negocio / Marca: "${brandName || 'Redes Sociales'}"
Plataforma: ${platform === 'both' ? 'Facebook e Instagram' : platform}
Tema: "${topic}"
Tono: ${tone}
Objetivo: ${goal}
${brandName ? `- Negocio / Marca: "${brandName}"` : ''}
${customInstructions ? `- Instrucciones adicionales: ${customInstructions}` : ''}

REGLAS DE ORO OBLIGATORIAS (2026 Instagram Voice & Algorithm Rules):
1. GANCHO INICIAL (Línea 1): DEBE tener MENOS de 120 caracteres antes del primer salto de línea. El algoritmo de Instagram corta con "... más", por lo que la primera línea debe atrapar por sí sola (usa curiosidad, dato numérico específico o verdad contraria).
2. VOZ HUMANA NATURAL: CERO guiones largos ("—" o "--"). Si necesitas una pausa, usa ".." o un salto de línea.
3. PROHIBIDO VOCABULARIO DE IA: NO uses "sumérgete", "en el ajetreado mundo de hoy", "descubre", "revolucionario", "desbloquea", "eleva", "un viaje", "no es solo X, es Y", "un tapiz". Habla como una persona real conversando con otra.
4. EMOJIS CON RESTRICCIÓN: Usa solo 1 a 3 emojis bien ubicados para dar ritmo, nunca bloques de emojis de spam.
5. OBJETIVO DE ALCANCE (Sends & Saves): Diseña el cierre para que la gente quiera GUARDAR el post o ENVIÁRSELO a un amigo por DM (los factores #1 del algoritmo actual).
6. HASHTAGS 2026: Al final, incluye estrictamente entre 3 y 5 hashtags dimensionados (1 amplio, 2 de nicho/categoría, 1 micro-local ej: #${brandName ? brandName.replace(/[^a-zA-Z0-9]/g, '') : 'Chile'}). NUNCA pongas más de 5 hashtags.

Entrega ÚNICAMENTE el texto final listo para publicar, sin introducciones ni comentarios explicativos.
`;
  }

  /**
   * Parsea la respuesta del LLM a un formato estructurado
   */
  parseAIResponse(rawText, topic) {
    const cleanText = this.cleanCaptionAI(rawText);
    const cleanedLines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
    const hook = cleanedLines.length > 0 ? cleanedLines[0] : '';
    const hashtagLine = cleanedLines.filter(l => l.startsWith('#')).join(' ');

    return {
      raw: rawText,
      fullPost: cleanText,
      hook: hook,
      hashtags: hashtagLine || '',
      topic: topic,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Limpia y audita un texto con las reglas de Instagram Skills 2026 (ig-humanizer / voice-rules)
   */
  cleanCaptionAI(text) {
    if (!text) return '';
    let cleaned = text;

    // 1. Reemplazar guiones largos y dobles por salto de línea o ".."
    cleaned = cleaned.replace(/\s*—\s*/g, '.. ');
    cleaned = cleaned.replace(/\s*–\s*/g, '.. ');
    cleaned = cleaned.replace(/\s*--\s*/g, '.. ');

    // 2. Limpieza de vocabulario robótico típico
    const buzzwords = [
      { regex: /en el (vertiginoso|ajetreado|acelerado) mundo de hoy[,.]?\s*/gi, rep: '' },
      { regex: /en la era digital[,.]?\s*/gi, rep: '' },
      { regex: /sumérgete en\s+/gi, rep: 'conoce ' },
      { regex: /descubre un mundo de\s+/gi, rep: 'descubre ' },
      { regex: /un tapiz de\s+/gi, rep: 'una variedad de ' },
      { regex: /eleva tu[s]?\s+/gi, rep: 'mejora tus ' },
      { regex: /desbloquea tu[s]?\s+/gi, rep: 'logra tus ' },
      { regex: /un viaje hacia\s+/gi, rep: 'el camino a ' }
    ];

    buzzwords.forEach(bw => {
      cleaned = cleaned.replace(bw.regex, bw.rep);
    });

    // 3. RECORTAR HASHTAGS DETERMINÍSTICAMENTE (MÁXIMO 5-6 HASHTAGS)
    const hashtagMatches = cleaned.match(/#[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+/g);
    if (hashtagMatches && hashtagMatches.length > 6) {
      const keepTags = hashtagMatches.slice(0, 6);
      cleaned = cleaned.replace(/(#[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+\s*)+$/gi, '').trim();
      cleaned += '\n\n' + keepTags.join(' ');
    }

    return cleaned.trim();
  }

  /**
   * Auditoría y humanización avanzada con IA (ig-humanizer)
   */
  async humanizeCaption({ caption, brandName = '' }) {
    if (!caption) return { success: false, error: 'Se requiere un texto para auditar.' };

    const firstLine = (caption.split('\n').map(l => l.trim()).filter(Boolean)[0]) || '';
    const hookLength = firstLine.length;
    const hasEmDash = /[—–]|--/.test(caption);
    const aiBuzzwordsFound = [];
    const blacklist = ['sumérgete', 'vertiginoso', 'ajetreado', 'tapiz', 'desbloquea', 'eleva', 'revolucionario', 'leverage', 'delve', 'paradigma'];
    blacklist.forEach(w => {
      if (new RegExp(w, 'i').test(caption)) aiBuzzwordsFound.push(w);
    });

    const hashtags = caption.match(/#[a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ]+/g) || [];
    const emojis = caption.match(/\p{Extended_Pictographic}/gu) || [];

    let score = 100;
    const issues = [];
    if (hookLength > 125) {
      score -= 25;
      issues.push(`El gancho inicial tiene ${hookLength} caracteres (debe tener menos de 125 antes de que Instagram corte con "... más").`);
    }
    if (hasEmDash) {
      score -= 20;
      issues.push('Contiene guiones largos ("—" o "--"), el principal delator de textos generados por IA.');
    }
    if (aiBuzzwordsFound.length > 0) {
      score -= 20;
      issues.push(`Usa palabras cliché de bot: ${aiBuzzwordsFound.join(', ')}.`);
    }
    if (hashtags.length > 6) {
      score -= 15;
      issues.push(`Tiene ${hashtags.length} hashtags. En 2026 el algoritmo penaliza el exceso; lo óptimo son de 5 a 6 tags selectos.`);
    }
    if (emojis.length > 8) {
      score -= 10;
      issues.push(`Exceso de emojis (${emojis.length}). Lo recomendado para no parecer spam son de 3 a 5.`);
    }

    let humanizedRewrite = this.cleanCaptionAI(caption);
    const apiKey = this.getApiKey();

    if (apiKey) {
      const modelsToTry = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];
      for (const m of modelsToTry) {
        try {
          const prompt = `
Eres un editor humano experto en redes sociales aplicando el skill "ig-humanizer 2026".
Reescribe la siguiente publicación para que suene 100% como una persona real conversando en Instagram:
Texto original:
"""
${caption}
"""

REGLAS DE ORO OBLIGATORIAS:
1. Línea 1 (Hook): MÁXIMO 120 caracteres. Debe atrapar antes del corte "... más".
2. CERO guiones largos ("—", "–", "--"). Usa ".." o saltos de línea.
3. CERO palabras cliché de IA ("sumérgete", "revolucionario", "eleva", "desbloquea", "un viaje", etc.).
4. Si el post incluye dirección ("📍 Encuéntralo en Kmarket Algarrobo\nEl Boldo 366, local 13, Espacio Algarrobo, Algarrobo"), CONSÉRVALA EXACTA.
5. AL FINAL, EXACTAMENTE DE 5 A 6 HASHTAGS SELECTOS (elimina todos los demás hashtags sobrantes).
6. Cierre cálido y natural.

Devuelve ÚNICAMENTE el texto final reescrito, sin notas ni explicaciones.
`;
          const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
            contents: [{ parts: [{ text: prompt }] }]
          }, { timeout: 12000 });

          const parts = res.data?.candidates?.[0]?.content?.parts || [];
          const resultText = parts.find(p => !p.thought)?.text || parts[parts.length - 1]?.text;
          if (resultText) {
            humanizedRewrite = this.cleanCaptionAI(resultText.trim());
            break;
          }
        } catch (e) {
          console.warn(`Intento de humanización con ${m} falló:`, e.message);
        }
      }
    }

    return {
      success: true,
      original: caption,
      humanized: humanizedRewrite,
      hookLength,
      hookStatus: hookLength <= 125 ? 'optimal' : 'too_long',
      hasEmDash,
      aiBuzzwordsFound,
      hashtagCount: hashtags.length,
      emojiCount: emojis.length,
      score: Math.max(10, score),
      issues
    };
  }

  /**
   * Planificador de Carruseles Slide a Slide (ig-carousel-planner / carousel-structure.md)
   */
  async planCarousel({ topic, slidesCount = 6, goal = 'saves', brandName = '' }) {
    const apiKey = this.getApiKey();
    const prompt = `
Eres un diseñador de carruseles de Instagram viral 2026 (Skill: ig-carousel-planner).
Tema: "${topic}"
Negocio / Marca: "${brandName || 'Instagram'}"
Cantidad de diapositivas: ${slidesCount}
Objetivo algorítmico: ${goal} (saves = guardados, shares = compartir a amigos)

Genera la estructura slide a slide exacta para un carrusel de alta retención.
Devuelve un JSON válido con esta estructura:
{
  "title": "Título del Carrusel",
  "slides": [
    {
      "slideNumber": 1,
      "type": "hook_cover",
      "visualIdea": "Descripción visual de la imagen o diseño 4:5",
      "headline": "Texto grande gancho en la imagen (menos de 8 palabras)",
      "subtext": "Subtítulo intrigante"
    },
    {
      "slideNumber": 2,
      "type": "context_problem",
      "visualIdea": "Descripción visual",
      "headline": "El problema o contexto real",
      "subtext": "Detalle breve"
    }
  ],
  "caption": "Copy para el texto del post con gancho < 125 caracteres y 3-5 hashtags",
  "recommendedAudio": "Sugerencia de estilo de audio en tendencia"
}
`;

    if (apiKey) {
      try {
        const res = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }, { timeout: 12000 });

        const parts = res.data?.candidates?.[0]?.content?.parts || [];
        const rawJson = parts.find(p => !p.thought)?.text || parts[parts.length - 1]?.text;
        if (rawJson) {
          return JSON.parse(rawJson);
        }
      } catch (err) {
        console.warn('Fallo llamada JSON carrusel en Gemini:', err.message);
      }
    }

    // Plantilla de Carrusel 2026 local
    return {
      title: `${topic}: Guía Paso a Paso`,
      slides: [
        { slideNumber: 1, type: 'hook_cover', headline: `Lo que nadie te dijo sobre ${topic.slice(0, 30)}`, subtext: 'Desliza para ver la verdad 👉', visualIdea: 'Foto limpia de producto o espacio con tipografía grande y centrada.' },
        { slideNumber: 2, type: 'context_problem', headline: 'El error común que todos cometen', subtext: 'Creer que más es mejor...', visualIdea: 'Comparativa visual o gráfico de atención.' },
        { slideNumber: 3, type: 'value_step_1', headline: 'Paso 1: La base fundamental', subtext: 'Empieza por lo simple y de calidad.', visualIdea: 'Foto en primer plano del producto.' },
        { slideNumber: 4, type: 'value_step_2', headline: 'Paso 2: El secreto del sabor / experiencia', subtext: 'El detalle que marca la diferencia.', visualIdea: 'Detalle de uso o preparación.' },
        { slideNumber: 5, type: 'payoff_summary', headline: 'En resumen', subtext: 'Todo se reduce a estos 2 puntos clave.', visualIdea: 'Lista de verificación limpia.' },
        { slideNumber: 6, type: 'cta_save', headline: '¿Te sirvió este dato?', subtext: '💾 Guarda este post para después y compártelo con alguien que lo necesite.', visualIdea: 'Fondo de marca con icono grande de Guardar y Compartir.' }
      ],
      caption: `Lo que nadie te dijo sobre ${topic}.\n\nTe dejamos la guía completa en las diapositivas de arriba para que no cometas los mismos errores..\n\n💾 Guarda este carrusel para tenerlo a mano cuando lo necesites.\n\n#${topic.replace(/[^a-zA-Z0-9]/g, '')} #TipsInstagram #Algarrobo`,
      recommendedAudio: 'Audio suave lofi o chill hop instrumental sin letra'
    };
  }

  /**
   * Estrategia de Hashtags 2026 (3 a 5 tags por tamaño / ig-hashtag-strategist)
   */
  async generateHashtagStrategy({ topic, brandName = '', location = 'Algarrobo Chile' }) {
    const cleanTopic = (topic || '').replace(/[^a-zA-Z0-9]/g, '');
    const cleanBrand = (brandName || '').replace(/[^a-zA-Z0-9]/g, '');

    const broad = [`#${cleanTopic || 'Lifestyle'}`, '#InstagramTips', '#KFood', '#TurismoChile'];
    const mid = [`#${cleanTopic}Chile`, `#${cleanTopic}Oficial`, '#SaboresDelMundo', '#EscapadaPerfecta'];
    const niche = [`#${cleanBrand || 'Algarrobo'}`, '#AlgarroboChile', '#ElQuisco', '#LitoralCentral'];

    return {
      strategy: '3-5 Sized Hashtags (2026 Algorithm Standard)',
      broad: broad[0],
      mid: [mid[0], mid[1] || '#PanoramasChile'],
      niche: niche.slice(0, 2),
      recommendedBlock: `${broad[0]} ${mid[0]} ${niche[0]} ${niche[1] || ''}`.trim(),
      reason: 'En 2026 los hashtags funcionan como etiquetas de categorización. 1 tag amplio sitúa el tema general, 2 tags de nicho alcanzan a usuarios interesados y 1-2 locales conectan con tu público geográfico real.'
    };
  }

  /**
   * Generador de plantillas copywriting inteligentes de alta conversión (100% offline / local)
   */
  generateSmartTemplate({ topic, tone = 'engaging', goal = 'engagement', platform = 'both', brandName = '' }) {
    const brand = brandName ? ` en ${brandName}` : '';
    
    // Conjuntos de ganchos (Hooks)
    const hooks = {
      sales: [
        `🔥 ¡Lo que estabas esperando por fin está aquí${brand}! 👇`,
        `⚡ ATENCIÓN: Si buscas resultados reales con ${topic}, no te pierdas esto.`,
        `🚀 ¿Quieres llevar tus resultados al siguiente nivel? Descubre esto hoy.`
      ],
      educational: [
        `💡 3 cosas que probablemente no sabías sobre ${topic}:`,
        `📌 Guarda este post antes de que se te olvide: Guía rápida sobre ${topic}.`,
        `🧠 El error #1 que la mayoría comete con ${topic} (y cómo evitarlo hoy):`
      ],
      inspirational: [
        `✨ Cada gran cambio comienza con un pequeño paso${brand}.`,
        `🌟 El secreto para dominar ${topic} no es la suerte, es la constancia.`,
        `🎯 La diferencia entre desearlo y lograrlo está en tu decisión de hoy.`
      ],
      engaging: [
        `👀 ¿Team A o Team B? Hablemos con sinceridad sobre ${topic}...`,
        `🔥 Cuéntame en los comentarios: ¿Cuál ha sido tu mayor reto con ${topic}?`,
        `👇 ¡Esto puede cambiar la forma en que ves ${topic} para siempre!`
      ]
    };

    const selectedHooks = hooks[tone] || hooks.engaging;
    const hook = selectedHooks[Math.floor(Math.random() * selectedHooks.length)];

    // CTAs
    const ctas = [
      `👉 ¿Te gustó este contenido? Dale like ❤️ y compártelo con alguien que lo necesite.`,
      `💬 Déjanos tu opinión en los comentarios: ¿Cuál es tu experiencia con este tema?`,
      `💾 Guarda este post para revisarlo cuando lo necesites y síguenos para más consejos.`,
      `🔗 Toca el enlace de nuestro perfil para conocer todos los detalles y empezar hoy.`
    ];
    const cta = ctas[Math.floor(Math.random() * ctas.length)];

    // Hashtags limpios y temáticos
    const cleanTag = topic.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '');
    const hashtags = [
      `#${cleanTag}`,
      '#socialmedia',
      '#marketingdigital',
      '#estrategiadigital',
      '#contenido',
      '#negociosonline',
      '#emprendimiento',
      '#instagramtips',
      '#facebookpost',
      '#creadoresdecontenido',
      '#branding',
      '#comunidad'
    ].join(' ');

    const postContent = `${hook}

En el mundo de hoy, ${topic} se ha convertido en una pieza clave para destacar y conectar de forma genuina.

Aquí te compartimos los puntos clave que debes tener en mente:
✅ Calidad y coherencia en cada paso que das.
✅ Escuchar a tu audiencia y resolver sus necesidades reales.
✅ Innovar constantemente sin perder tu esencia.

${cta}

${hashtags}`;

    return {
      fullPost: postContent,
      hook: hook,
      cta: cta,
      hashtags: hashtags,
      topic: topic,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generador Especializado para Kmarket: Diseñador Gráfico 4:5 + Copy
   */
  async generateKmarketProduct({ productName, description = '', extraNotes = '' }) {
    const masterImagePrompt = `necesito que te comportes como un diseñador grafico senior experto en marketing. hacer una imagen publicitaria de este producto ("${productName}") de dimensiones 4:5 vertical para instagram , usar una fuente similar a la del producto, pero dinamica y el subtitulo con una fuente de menor tamaño pero tambien elegante y un diseño similar para poner el titulo de lo que es, buscar info online del producto e imagenes de referencia de este mismo (es decir no usar exactamente la imagen que te di) . Todo texto en español. No hacer referencia a ninguna tienda en especial. ni poner nada como comprar ahora . no dar tanto enfasis a lo de "sabor coreano" ni a la marca, si es que, solo de manera pequeña.\n\nProducto: ${productName}${description ? `\nDetalles: ${description}` : ''}${extraNotes ? `\nNotas: ${extraNotes}` : ''}`;

    const promptForCopy = `
Eres el copywriter oficial de "Kmarket - Algarrobo". Debes redactar la publicación siguiendo EXACTAMENTE la estructura, tono sobrio, dirección física y moderación de hashtags de este post oficial de Kmarket:

FORMATO OFICIAL DE REFERENCIA OBLIGATORIA:
"""
🍵💚 Descubre el auténtico sabor del matcha en Kmarket Algarrobo 💚🍵

El té Matcha es una de las bebidas más tradicionales y apreciadas de Asia. Elaborado a partir de hojas de té verde finamente molidas, destaca por su intenso color verde, su sabor suave con notas vegetales y su gran versatilidad.

✨ ¿Qué lo hace especial?
A diferencia de un té tradicional, con el matcha disfrutas la hoja completa, obteniendo una bebida de sabor intenso y textura cremosa al prepararlo correctamente.

☕ Perfecto para disfrutar como:
• Matcha latte caliente o frío
• Té tradicional japonés
• Smoothies y frappés
• Postres, galletas, queques y helados

🌿 Su sabor único lo ha convertido en uno de los ingredientes más populares para quienes disfrutan de nuevas experiencias gastronómicas.

📍 Encuéntralo en Kmarket Algarrobo
El Boldo 366, local 13, Espacio Algarrobo, Algarrobo

🧡 Descubre por qué el matcha ha conquistado a millones de personas alrededor del mundo.

#KmarketAlgarrobo #Matcha #TeMatcha #MatchaLover #KFood #SaboresDeAsia #AlgarroboMoments
"""

DATOS DEL PRODUCTO A REDACTAR AHORA:
- Producto: "${productName}"
- Características: "${description}"
${extraNotes ? `- Notas adicionales: "${extraNotes}"` : ''}

REGLAS DE ORO OBLIGATORIAS:
1. Primera línea: Emojis temáticos acordes al producto + Título llamativo + "en Kmarket Algarrobo" + Emojis temáticos.
2. Párrafo 1 (Presentación): Qué es el producto, de dónde proviene y qué destaca de su textura o sabor.
3. Sección "✨ ¿Qué lo hace especial?": 1 párrafo conciso explicando su valor o autenticidad.
4. Sección con viñetas: "[Emoji temático] Perfecto para disfrutar como:" (o "Ideal para disfrutar:"), seguido de 3 a 4 opciones prácticas con viñeta "•".
5. Párrafo breve de conexión y experiencia gastronómica.
6. SIEMPRE INCLUIR LA DIRECCIÓN FÍSICA EXACTA:
📍 Encuéntralo en Kmarket Algarrobo
El Boldo 366, local 13, Espacio Algarrobo, Algarrobo
7. Cierre cálido con emoji 🧡 invitando a probarlo o descubrirlo.
8. EXACTAMENTE ENTRE 5 Y 7 HASHTAGS (¡PROHIBIDO poner 15 o 20 hashtags!). Incluye siempre #KmarketAlgarrobo #KFood y los específicos del producto.

Entrega ÚNICAMENTE el texto final listo para publicar en Instagram.
`;

    let postCopy = '';
    const apiKey = getSetting('ai_api_key') || process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const res = await this.generateWithGemini({
          topic: `Producto destacado: ${productName}. ${description}`,
          tone: 'sobrio y apetitoso',
          goal: 'ventas en tienda',
          platform: 'both',
          brandName: 'Kmarket - Algarrobo',
          customInstructions: promptForCopy,
          apiKey
        });
        postCopy = res.fullPost;
      } catch (e) {
        postCopy = `🥢✨ Descubre ${productName} en Kmarket Algarrobo ✨🥢\n\n${description || 'Un producto tradicional y apreciado, perfecto para disfrutar de la gastronomía asiática en casa.'}\n\n✨ ¿Qué lo hace especial?\nSu calidad auténtica, sabor inconfundible y la frescura que lo convierten en un favorito indiscutido.\n\n🍜 Perfecto para disfrutar como:\n• Snack o antojo en cualquier momento\n• Para compartir con amigos y familia\n• Acompañando tus momentos de descanso y series\n\n🌿 Una experiencia culinaria única que ahora tienes a pasos de la playa.\n\n📍 Encuéntralo en Kmarket Algarrobo\nEl Boldo 366, local 13, Espacio Algarrobo, Algarrobo\n\n🧡 ¡Ven a conocerlo y déjate sorprender!\n\n#KmarketAlgarrobo #${productName.replace(/[^a-zA-Z0-9]/g, '')} #KFood #SnacksCoreanos #AlgarroboMoments`;
      }
    } else {
      postCopy = `🥢✨ Descubre ${productName} en Kmarket Algarrobo ✨🥢\n\n${description || 'Un producto tradicional y apreciado, perfecto para disfrutar de la gastronomía asiática en casa.'}\n\n✨ ¿Qué lo hace especial?\nSu calidad auténtica, sabor inconfundible y la frescura que lo convierten en un favorito indiscutido.\n\n🍜 Perfecto para disfrutar como:\n• Snack o antojo en cualquier momento\n• Para compartir con amigos y familia\n• Acompañando tus momentos de descanso y series\n\n🌿 Una experiencia culinaria única que ahora tienes a pasos de la playa.\n\n📍 Encuéntralo en Kmarket Algarrobo\nEl Boldo 366, local 13, Espacio Algarrobo, Algarrobo\n\n🧡 ¡Ven a conocerlo y déjate sorprender!\n\n#KmarketAlgarrobo #${productName.replace(/[^a-zA-Z0-9]/g, '')} #KFood #SnacksCoreanos #AlgarroboMoments`;
    }

    // Asegurar que pase por el sanitizador para garantizar menos de 7 hashtags
    postCopy = this.cleanCaptionAI(postCopy);

    return {
      productName,
      masterImagePrompt,
      postCopy
    };
  }

  /**
   * Generador Especializado para Cabañas La Campiña: Guión Reel / Video + Copy de Fechas
   * Fundamentado 100% en la información oficial de www.cabanaslacampina.cl
   */
  async generateCampinaContent({ theme, format = 'reel', targetDate = '', extraNotes = '' }) {
    const isReel = format === 'reel';
    const apiKey = getSetting('ai_api_key') || process.env.GEMINI_API_KEY;
    const campinaKnowledge = getCampinaKnowledgePrompt();

    const systemPrompt = `
${campinaKnowledge}

Eres el redactor de "Cabañas La Campiña - Algarrobo". Debes redactar el contenido siguiendo EXACTAMENTE el tono, estilo, quinchos, áreas verdes, viñetas, contacto y hashtags de este post real de La Campiña:

EJEMPLO DE REFERENCIA OBLIGATORIA (Imita esta estructura al pie de la letra):
"""
🇨🇱🔥 ¡Últimas cabañas y suites para estas Fiestas Patrias! 🔥🇨🇱

Del 18 al 20 de septiembre, ven a disfrutar unas Fiestas Patrias diferentes en Cabañas La Campiña 🏡.

Reúne a toda la familia, prepara un buen asado en nuestros quinchos 🥩🔥, disfruta de nuestras amplias áreas verdes y comparte esos momentos que hacen que el 18 sea tan especial ❤️🌿

Pero ojo… 👀 ¡nos quedan las últimas cabañas y suites disponibles!

Si todavía no tienes dónde pasar estas Fiestas Patrias, no dejes pasar la oportunidad de asegurar tu estadía y disfrutar de unos días de descanso, naturaleza y buena compañía en Algarrobo.

📅 18 al 20 de septiembre
🔥 Quinchos para disfrutar en familia
🌿 Amplias áreas verdes
🏡 Últimas cabañas y suites disponibles

📲 Reservas y consultas: +56 9 7900 4253

🇨🇱 ¡Asegura tu lugar y celebra el 18 en La Campiña! 🇨🇱

#cabañaslacampiña #algarrobo #fiestaspatrias #18deseptiembre #18septiembre #vacaciones #familia #asado #quincho #descanso #algarrobochile #litoralcentral
"""

DATOS DEL CONTENIDO A GENERAR AHORA:
- Tema / Enfoque: "${theme}"
- Fecha / Ocasión: "${targetDate || 'próximo fin de semana'}"
${extraNotes ? `- Notas adicionales: "${extraNotes}"` : ''}

REGLAS ESTRICTAS:
- Solo instalaciones reales: quinchos privados en terraza de cabañas o comunes en suites, amplias áreas verdes y jardines temáticos (Puente Rojo, Duendecitos, Pinos), cabañas familiares (2 a 8 personas), suites para parejas, juegos infantiles, sin Wi-Fi (desconexión).
- ❌ NUNCA mencionar tinajas ni hot tubs.
- Siempre incluir el número oficial: 📲 Reservas y consultas: +56 9 7900 4253

${isReel ? `
Estructura a entregar:
🎬 GUION DE REEL (Audiovisual):
- 0-2s (Hook Visual): Toma de inicio rápida (ej: carne a la parrilla en el quincho con humo 🥩🔥, pareja en el sendero del Puente Rojo 🌿, vista panorámica de la cabaña iluminada al atardecer).
- 2-8s (Tomas clave): Recorrido por el quincho, terraza, áreas verdes y cabaña acogedora.
- 8-15s (Cierre & CTA): Toma final con invitación a reservar.
- 💬 Frase en pantalla: Texto conciso y llamativo.
- 🎵 Música recomendada: Estilo acústico o lofi relajante.

📝 COPY PARA EL PIE DEL POST:
(Sigue exactamente la estructura del post de ejemplo: título con emojis, invitación, quinchos, áreas verdes, viñetas con emojis, WhatsApp +56 9 7900 4253 y bloque de hashtags).
` : `
Estructura a entregar:
(Sigue exactamente la estructura del post de ejemplo: título con emojis framing, invitación a Cabañas La Campiña 🏡, quinchos 🥩🔥, amplias áreas verdes ❤️🌿, escasez 'Pero ojo… 👀', bloque de 4 viñetas con emojis, WhatsApp: 📲 Reservas y consultas: +56 9 7900 4253, frase de cierre con emojis y bloque de hashtags).
`}
`;

    let generatedText = '';
    if (apiKey) {
      try {
        const res = await this.generateWithGemini({
          topic: `${theme} en Cabañas La Campiña Algarrobo (${targetDate || 'próximo fin de semana'})`,
          tone: 'cercano, familiar e inspiracional',
          goal: 'reservas y consultas',
          platform: 'both',
          brandName: 'Cabañas La Campiña - Algarrobo',
          customInstructions: systemPrompt,
          apiKey
        });
        generatedText = res.fullPost;
      } catch (e) {
        generatedText = `🌿✨ ¡Disfruta una escapada de descanso en Cabañas La Campiña! ✨🌿\n\nEste ${targetDate || 'fin de semana'}, ven a desconectarte de la rutina en Cabañas La Campiña 🏡.\n\nReúne a toda la familia o ven en pareja, prepara un rico asado en nuestros quinchos 🥩🔥, recorre nuestros jardines temáticos y senderos naturales ❤️🌿.\n\nPero ojo… 👀 ¡nos van quedando las últimas cabañas y suites disponibles!\n\n📅 ${targetDate || 'Próximo fin de semana'}\n🔥 Quinchos privados para disfrutar en familia\n🌿 Amplias áreas verdes y senderos\n🏡 Últimas cabañas y suites disponibles\n\n📲 Reservas y consultas: +56 9 7900 4253\n\n🌿 ¡Asegura tu estadía y descansa en La Campiña! 🌿\n\n#cabañaslacampiña #algarrobo #vacaciones #familia #asado #quincho #descanso #algarrobochile #litoralcentral`;
      }
    } else {
      generatedText = `🌿✨ ¡Disfruta una escapada de descanso en Cabañas La Campiña! ✨🌿\n\nEste ${targetDate || 'fin de semana'}, ven a desconectarte de la rutina en Cabañas La Campiña 🏡.\n\nReúne a toda la familia o ven en pareja, prepara un rico asado en nuestros quinchos 🥩🔥, recorre nuestros jardines temáticos y senderos naturales ❤️🌿.\n\nPero ojo… 👀 ¡nos van quedando las últimas cabañas y suites disponibles!\n\n📅 ${targetDate || 'Próximo fin de semana'}\n🔥 Quinchos privados para disfrutar en familia\n🌿 Amplias áreas verdes y senderos\n🏡 Últimas cabañas y suites disponibles\n\n📲 Reservas y consultas: +56 9 7900 4253\n\n🌿 ¡Asegura tu estadía y descansa en La Campiña! 🌿\n\n#cabañaslacampiña #algarrobo #vacaciones #familia #asado #quincho #descanso #algarrobochile #litoralcentral`;
    }

    return {
      theme,
      format,
      content: generatedText
    };
  }

  /**
   * Sugerencias Proactivas Semanales (Miércoles & Sábados)
   * 100% adaptadas a la realidad de cada negocio
   */
  getProactiveSuggestions(brandName = '') {
    const lower = (brandName || '').toLowerCase();
    const isCampina = lower.includes('campiña') || lower.includes('cabaña');
    const isKmarket = lower.includes('kmarket');
    const isTestAccount = lower.includes('prueba') || lower.includes('test') || lower.includes('yarur');

    if (isCampina) {
      return {
        brand: 'Cabañas La Campiña',
        accountType: 'campina',
        days: [
          {
            dayName: 'Miércoles (Slot Mitad de Semana)',
            slot: '13:00 / 19:00',
            type: 'reel',
            title: '🎥 Reel: Desconexión Real & Jardines Temáticos (Sin Wi-Fi)',
            suggestion: 'Muestra los senderos naturales (Puente Rojo, Jardín de los Duendecitos, Pinos) y la desconexión total para inspirar una escapada de fin de semana.',
            presetTopic: 'Desconexión de pantallas y descanso en los jardines temáticos y senderos de Cabañas La Campiña Algarrobo'
          },
          {
            dayName: 'Sábado (Slot Fin de Semana)',
            slot: '11:00 / 18:00',
            type: 'feed',
            title: '🏡 Cabañas Familiares con Quincho Privado & Suites para Parejas',
            suggestion: 'Promociona la comodidad de las cabañas con terraza y asado privado, o las suites de descanso para planificar el próximo viaje o feriado.',
            presetTopic: 'Cabañas familiares equipadas con quincho privado en terraza y suites de descanso en el bosque de Algarrobo'
          }
        ]
      };
    }

    if (isKmarket) {
      return {
        brand: 'Kmarket - Algarrobo',
        accountType: 'kmarket',
        days: [
          {
            dayName: 'Miércoles (Slot de Novedades K-Food)',
            slot: '13:00 / 19:00',
            type: 'feed',
            title: '🍜 Ramyun en Cup o Novedad Coreana (Diseño 4:5)',
            suggestion: 'Crea una imagen publicitaria 4:5 de un ramen coreano (Buldak, Shin Ramyun o Garak Mac & Cheese) con diseño dinámico para antojo de mitad de semana.',
            presetTopic: 'Ramen Buldak Carbonara y ramyuns en cup coreanos recién llegados a Kmarket Algarrobo'
          },
          {
            dayName: 'Sábado (Slot de Bebidas, Helados & Snacks)',
            slot: '11:30 / 18:30',
            type: 'carousel',
            title: '🧃 Helado Samanco, Bebidas & Golosinas Coreanas',
            suggestion: 'Promociona helados Samanco en forma de pez, bebidas Milkis o Bon Bon de uva, y galletas Pepero para el fin de semana en la playa.',
            presetTopic: 'Helados coreanos Samanco, refrescos Bon Bon de uva y snacks asiáticos exclusivos en Espacio Algarrobo'
          }
        ]
      };
    }

    if (isTestAccount) {
      const displayBrand = brandName || 'Cuenta de Pruebas';
      return {
        brand: displayBrand,
        accountType: 'test',
        days: [
          {
            dayName: 'Miércoles (Slot de Pruebas de Feed & Stories)',
            slot: '13:00 / 19:00',
            type: 'feed',
            title: '🧪 Prueba de Entrega: Post Feed 4:5 + Historia 9:16',
            suggestion: 'Verifica la publicación cruzada simultánea en Feed e Historias automáticas de Meta en esta cuenta de pruebas.',
            presetTopic: `Test de publicación automatizada en feed e historia para ${displayBrand}`
          },
          {
            dayName: 'Sábado (Slot de Pruebas de Carrusel & Métricas)',
            slot: '11:30 / 18:30',
            type: 'carousel',
            title: '📊 Prueba de Engagement & Carrusel Multi-Foto',
            suggestion: 'Prueba la sincronización de analíticas y el rendimiento de publicaciones múltiples antes de replicar en tus cuentas oficiales.',
            presetTopic: `Experimento de carrusel interactivo y medición de alcance en ${displayBrand}`
          }
        ]
      };
    }

    // Cuenta personalizada general
    const displayBrand = brandName || 'Tu Negocio';
    return {
      brand: displayBrand,
      accountType: 'custom',
      days: [
        {
          dayName: 'Miércoles (Slot de Valor & Contenido)',
          slot: '13:00 / 19:00',
          type: 'feed',
          title: `✨ Novedad y Oferta Destacada de ${displayBrand}`,
          suggestion: `Destaca tu producto o servicio principal de la semana en ${displayBrand} con un titular atractivo y llamado a la acción.`,
          presetTopic: `Novedad y propuesta de valor de ${displayBrand}`
        },
        {
          dayName: 'Sábado (Slot de Comunidad & Fin de Semana)',
          slot: '11:30 / 18:30',
          type: 'carousel',
          title: `🚀 Experiencia y Testimonios en ${displayBrand}`,
          suggestion: `Comparte casos de éxito, consejos de uso o promociones de fin de semana para conectar con tu audiencia.`,
          presetTopic: `Promoción de fin de semana y comunidad para ${displayBrand}`
        }
      ]
    };
  }

  /**
   * Genera una auditoría estratégica de analíticas basada en el algoritmo actual de redes sociales
   */
  async generateSocialAudit({ accountName, analyticsSummary, customFocus }) {
    const provider = getSetting('ai_provider') || 'local';
    const apiKey = getSetting('ai_api_key') || process.env.GEMINI_API_KEY;

    let result = null;
    if (provider === 'gemini' && apiKey) {
      try {
        result = await this.generateAuditWithGemini({ accountName, analyticsSummary, customFocus, apiKey });
      } catch (err) {
        console.warn('⚠️ Falló llamada a Gemini para auditoría, usando generador inteligente:', err.message);
      }
    }

    if (!result) {
      result = this.generateSmartAuditTemplate({ accountName, analyticsSummary });
    }

    // Asegurar que siempre contenga las estrategias desarrolladas ejecutables
    if (!result.actionableStrategies || result.actionableStrategies.length === 0) {
      result.actionableStrategies = this.getDevelopedStrategiesForAccount(accountName, analyticsSummary);
    }

    return result;
  }

  /**
   * Genera el conjunto de estrategias completamente desarrolladas y listas para llevar al editor
   */
  getDevelopedStrategiesForAccount(accountName, analyticsSummary) {
    const isCampina = (accountName || '').toLowerCase().includes('campiña') || (accountName || '').toLowerCase().includes('cabaña');

    if (isCampina) {
      return [
        {
          id: 'campina_reel_forest',
          category: 'Retención & Compartidos (DM Sends)',
          title: 'Reel: El sonido del bosque vs. el ruido de la ciudad',
          format: 'reel',
          scheduleHint: 'Miércoles 19:30 hrs',
          algorithmicGoal: 'Multiplicador #1: Envíos por DM a parejas y grupos familiares',
          hook: '🌲✨ ¿Cuándo fue la última vez que escuchaste el silencio del bosque?',
          fullCopy: `🌲✨ ¿Cuándo fue la última vez que escuchaste el silencio del bosque? 🏡💚

A solo 90 minutos de Santiago, el ruido de la ciudad desaparece y da paso a los senderos de Cabañas La Campiña. 🍃

Ven a desconectarte de verdad: sin Wi-Fi en las cabañas para volver a conversar, disfrutar un asado en tu quincho privado y caminar por el Puente Rojo y el Jardín de los Duendecitos. 🥩🔥

🌿 Cabañas familiares y suites de descanso en Algarrobo
🔥 Quincho privado en terraza para tu asado
🌲 Áreas verdes y senderos entre pinos
📲 Reservas directas por WhatsApp: +56 9 7900 4253

¿Con quién te escaparías este fin de semana? Envíale este video a tu persona favorita. 👇❤️

#cabanaslacampina #algarrobo #escapada #descanso #naturaleza #desconexion #asado #quincho #litoralcentral #findesemana`,
          topic: 'Reel de desconexión y naturaleza en Cabañas La Campiña Algarrobo',
          visualPrompt: 'Video vertical 9:16 con tomas de senderos naturales de pinos, Puente Rojo y quincho privado con leña y parrilla al atardecer.',
          whyThisWorks: 'El algoritmo de Meta premia los videos que se comparten por mensaje directo entre parejas o familias planificando su descanso.'
        },
        {
          id: 'campina_carousel_guide',
          category: 'Valor Permanente & Guardados (Saves)',
          title: 'Carrusel: Guía de 48 horas de desconexión en Algarrobo',
          format: 'carousel',
          scheduleHint: 'Sábado 11:00 hrs',
          algorithmicGoal: 'Multiplicador de Guardados (Saves) y Tiempo de Pantalla',
          hook: '🏡✨ Tu guía de 48 horas para recargar energías en Algarrobo 🌊🌲',
          fullCopy: `🏡✨ Tu guía de 48 horas para recargar energías en Algarrobo 🌊🌲

Guarda este post para tu próxima escapada. Te dejamos el itinerario perfecto:

📍 Día 1:
15:00 - Llegada a tu cabaña en La Campiña y bienvenida en el bosque.
18:00 - Caminata por los senderos temáticos (Puente Rojo y Duendecitos).
20:30 - Asado familiar o en pareja en tu quincho privado en terraza. 🥩🔥

📍 Día 2:
10:00 - Desayuno al aire libre rodeado de naturaleza. ☕🌿
12:00 - Paseo por el borde costero de Algarrobo y caleta de pescadores.
17:00 - Tarde de lectura y descanso sin pantallas ni interrupciones. 📖✨

📲 Asegura tu estadía y cotiza directo al WhatsApp: +56 9 7900 4253

#cabanaslacampina #algarrobo #escapada #turismochile #guiaviajera #descanso #naturaleza #litoralcentral`,
          topic: 'Guía de 48 horas y descanso en Cabañas La Campiña',
          visualPrompt: 'Secuencia de 4 láminas elegantes mostrando cabaña, quincho privado, senderos Puente Rojo y playa de Algarrobo.',
          whyThisWorks: 'Los carruseles tipo guía generan altas tasas de guardado (Saves) que el algoritmo utiliza para recomendar tu perfil en Explorar.'
        },
        {
          id: 'campina_story_weekend',
          category: 'Nutrición de Comunidad & Conversión Directa',
          title: 'Story: ¿Escapada improvisada este finde? (Link a WhatsApp)',
          format: 'story',
          scheduleHint: 'Viernes 17:30 hrs',
          algorithmicGoal: 'Clics de Conversión Directa & Interacción en Historias',
          hook: '🌲🔥 ¿Escapada improvisada a Algarrobo este fin de semana?',
          fullCopy: `🌲🔥 ¿Escapada improvisada a Algarrobo este fin de semana? Últimas cabañas y suites disponibles en el bosque. Toca el botón para cotizar directo por WhatsApp: +56 9 7900 4253 🏡✨`,
          topic: 'Historia de reservas de última hora para fin de semana',
          visualPrompt: 'Lienzo vertical 9:16 con cabaña rústica iluminada al atardecer y espacio central para sticker de enlace de WhatsApp.',
          whyThisWorks: 'Las historias en la tarde del viernes capturan reservas espontáneas con baja fricción mediante WhatsApp directo.'
        },
        {
          id: 'campina_feed_holidays',
          category: 'Anticipación de Feriados & Vacaciones (FOMO)',
          title: 'Post 4:5: Asegura tu cabaña para el próximo feriado',
          format: 'feed',
          scheduleHint: 'Miércoles 20:00 hrs',
          algorithmicGoal: 'Interacción en Feed y Conversión Preventiva',
          hook: '🇨🇱🔥 ¡No dejes para el final asegurar tu escapada de descanso!',
          fullCopy: `🇨🇱🔥 ¡No dejes para el final asegurar tu escapada de descanso! 🏡✨

Los feriados y fines de semana largos se llenan rápido en Algarrobo. Si buscas tranquilidad, amplias áreas verdes y disfrutar un buen asado en familia, Cabañas La Campiña es tu lugar. 🥩🌿

🏡 Cabañas familiares y suites exclusivas para parejas
🔥 Quinchos privados en terraza
🌿 Senderos temáticos entre árboles
📲 Consulta fechas y reserva al WhatsApp: +56 9 7900 4253

¡Asegura tu lugar y respira aire puro! 🌲❤️

#cabanaslacampina #algarrobo #vacaciones #feriado #familia #asado #descanso #litoralcentral`,
          topic: 'Anticipación de reservas para feriados y fines de semana largos',
          visualPrompt: 'Fotografía 4:5 de cabaña acogedora rodeada de naturaleza con letrero sutil de Reserva tu Feriado.',
          whyThisWorks: 'Aprovecha el sesgo de urgencia (FOMO) antes de que se agoten las suites y cabañas con quincho.'
        }
      ];
    }

    // Caso Kmarket
    return [
      {
        id: 'kmarket_reel_samanco',
        category: 'Atracción Viral & Compartidos (DM Sends)',
        title: 'Reel: ¿Helado con forma de pez? Samanco en Algarrobo',
        format: 'reel',
        scheduleHint: 'Miércoles 18:30 hrs',
        algorithmicGoal: 'Multiplicador de Shares por DM entre amigos (Antojo visual)',
        hook: '🐟🍦 ¡El helado más viral de Corea está en Algarrobo! 🇰🇷✨',
        fullCopy: `🐟 ¡Un clásico coreano que tienes que probar! 🇰🇷✨

¿Helado con forma de pez? 👀🐟 ¡Sí! Conoce Samanco, uno de los helados más queridos de Corea. 🇰🇷💛

Su tradicional masa en forma de pez envuelve un delicioso relleno cremoso que lo convierte en una combinación simplemente irresistible. 🤤

🍦 Helado suave y cremoso
🐟 La clásica forma de pez
🍫 Dulce y delicioso en cada bocado
❄️ ¡Perfecto para disfrutar bien frío!

Un clásico de las calles y tiendas de conveniencia coreanas que ahora puedes disfrutar en Kmarket Algarrobo. ✨

📍 ¡Ven por el tuyo y descubre este curioso y delicioso helado coreano! 🇰🇷💛

#KmarketAlgarrobo #Samanco #HeladoCoreano #Binggrae #KFood #ComidaCoreana #SnacksCoreanos #Algarrobo`,
        topic: 'Helado coreano Samanco en forma de pez en Kmarket Algarrobo',
        visualPrompt: 'Video 9:16 abriendo el paquete de Samanco, mostrando la textura de pez y partiéndolo con helado cremoso y música dinámica.',
        whyThisWorks: 'El factor curiosidad y antojo ("¿viste esto?") es el disparador #1 de compartidos por mensaje privado en Instagram.'
      },
      {
        id: 'kmarket_post_ramen',
        category: 'Novedades de Producto & Antojo Vespertino (4:5)',
        title: 'Post 4:5: Noche de Ramen Buldak & Variedades Coreanas',
        format: 'feed',
        scheduleHint: 'Miércoles 19:30 hrs',
        algorithmicGoal: 'Interacción en Feed y Posicionamiento de Novedades',
        hook: '🍜🔥 ¿Noche de ramen en casa? En Kmarket tenemos todas las variedades coreanas 🇰🇷✨',
        fullCopy: `🍜🔥 ¿Noche de ramen en casa? En Kmarket tenemos todas las variedades coreanas 🇰🇷✨

Desde los clásicos y reconfortantes de carne y mariscos, hasta el legendario Buldak Carbonara y picante extremo. 🌶️🤤

🍜 Fideos gruesos y de textura perfecta
🔥 Variedades en cup listas en 3 minutos
🧀 Opciones suaves, cremosas y ultra picantes
🥢 Palillos y complementos asiáticos

📍 Visítanos en Kmarket Algarrobo y arma tu combo de ramyun perfecto.

¿Cuál es tu nivel de picante? Cuéntanos en los comentarios. 👇🇰🇷

#KmarketAlgarrobo #RamenCoreano #Buldak #RamenBuldak #KFood #ComidaCoreana #Algarrobo`,
        topic: 'Variedades de ramen coreano y buldak carbonara en Kmarket',
        visualPrompt: 'necesito que te comportes como un diseñador grafico senior experto en marketing. hacer una imagen publicitaria de este producto de dimensiones 4:5 vertical para instagram , usar una fuente similar a la del producto, pero dinamica y el subtitulo con una fuente de menor tamaño pero tambien elegante y un diseño similar para poner el titulo de lo que es, buscar info online del producto e imagenes de referencia de este mismo (es decir no usar exactamente la imagen que te di) . Todo texto en español. No hacer referencia a ninguna tienda en especial. ni poner nada como comprar ahora . no dar tanto enfasis a lo de "sabor coreano" ni a la marca, si es que, solo de manera pequeña',
        whyThisWorks: 'El formato 4:5 ocupa un 78% más de pantalla en el feed del móvil que una foto cuadrada, elevando el dwell time.'
      },
      {
        id: 'kmarket_carousel_top5',
        category: 'Educación de Producto & Guardados (Saves)',
        title: 'Carrusel: Top 5 Snacks Coreanos que debes probar',
        format: 'carousel',
        scheduleHint: 'Sábado 12:00 hrs',
        algorithmicGoal: 'Multiplicador de Guardados (Saves) para compras de fin de semana',
        hook: '🇰🇷✨ Los 5 snacks coreanos que no te puedes perder en tu visita a Kmarket 💛',
        fullCopy: `🇰🇷✨ Los 5 snacks coreanos que no te puedes perder en tu próxima visita a Kmarket 💛

Guarda este post para tu próxima compra en Algarrobo:

1️⃣ Helado Samanco: Galleta crujiente de pez con helado cremoso.
2️⃣ Choco Pie: El clásico bizcocho suave con marshmallow.
3️⃣ Pepero de Almendras: Palitos crujientes cubiertos de chocolate y frutos secos.
4️⃣ Bebidas Milkis y Bon Bon de Uva: Refrescantes y con sabor único.
5️⃣ Snacks de alga tostada sazonada: El piqueo adictivo y ligero.

📍 Encuentra todo esto y mucho más en Kmarket Algarrobo.

¿Cuál ya probaste y cuál te falta probar? 👇🤤

#KmarketAlgarrobo #SnacksCoreanos #KFood #ChocoPie #Pepero #Samanco #Algarrobo`,
        topic: 'Top 5 snacks asiáticos imperdibles de Kmarket',
        visualPrompt: 'Carrusel de 5 láminas dinámicas mostrando cada snack con su nombre y características en español.',
        whyThisWorks: 'Las listas de recomendaciones tipo Top 5 son las que más se guardan para consultar en tienda al momento de comprar.'
      },
      {
        id: 'kmarket_story_kfood',
        category: 'Refrescos & Bebidas Importadas para el Fin de Semana',
        title: 'Story: Bebidas Coreanas & Kombucha para la Playa',
        format: 'story',
        scheduleHint: 'Sábado 11:30 hrs',
        algorithmicGoal: 'Interacción Rápida y Visita a Tienda Física en Algarrobo',
        hook: '🫧☀️ ¡Día perfecto para refrescarte con bebidas coreanas en Algarrobo!',
        fullCopy: `🫧☀️ ¿Buscando algo diferente para el fin de semana? En Kmarket tenemos las bebidas más famosas de Corea: Milkis suave carbonatada, Bon Bon de uva con trozos de fruta real y Kombucha Seven Berries 🍇✨

📍 Encuéntralas frías y listas en Kmarket Algarrobo:
El Boldo 366, local 13, Espacio Algarrobo.

🧡 ¿Cuál es tu favorita para llevar a la playa?
#KmarketAlgarrobo #BebidasCoreanas #Milkis #BonBon #Kombucha #KFood #AlgarroboMoments`,
        topic: 'Bebidas coreanas frías Milkis, Bon Bon y Kombucha en Espacio Algarrobo',
        visualPrompt: 'Imagen vertical 9:16 con latas frías de Milkis y Bon Bon condensando frío con fondo veraniego y sticker de ubicación en Espacio Algarrobo.',
        whyThisWorks: 'Conecta con el plan del sábado de quienes buscan refrescarse en Algarrobo con productos exclusivos importados.'
      }
    ];
  }

  /**
   * Auditoría de crecimiento con Gemini basada en el algoritmo de Meta (Instagram/Facebook)
   */
  async generateAuditWithGemini({ accountName, analyticsSummary, customFocus, apiKey }) {
    const isCampina = (accountName || '').toLowerCase().includes('campiña') || (accountName || '').toLowerCase().includes('cabaña');
    
    const prompt = `Actúa como un Director de Estrategia de Redes Sociales (Meta Growth Strategist & Algorithm Specialist).
Realiza una auditoría analítica y estratégica exhaustiva para la cuenta: "${accountName}".

DATOS REALES DE RENDIMIENTO ANALIZADOS:
- Total publicaciones analizadas: ${analyticsSummary.totalPostsAnalyzed || 20}
- Promedio de Likes: ${analyticsSummary.avgLikes || 0}
- Promedio de Comentarios: ${analyticsSummary.avgComments || 0}
- Formato con mejor desempeño: ${analyticsSummary.formatBreakdown?.winner || 'Reels / Video'}
- Publicación más exitosa (Top Post): "${analyticsSummary.topPost?.title || 'Contenido audiovisual destacado'}" (${analyticsSummary.topPost?.likes || 0} likes, ${analyticsSummary.topPost?.comments || 0} comentarios, Formato: ${analyticsSummary.topPost?.mediaType || 'VIDEO'})
- Frecuencia habitual del usuario: 2 posts por semana (Miércoles y Sábado).
- Enfoque opcional del usuario: ${customFocus || 'Maximizar alcance orgánico, retención y conversiones locales en Algarrobo'}.

CONTEXTO DEL NEGOCIO:
${isCampina ? 
`- Negocio: Cabañas La Campiña (Algarrobo, Chile).
- Propuesta de valor: Cabañas y suites familiares/parejas en entorno natural, quinchos privados en terraza para asados, senderos temáticos (Puente Rojo, Duendecitos), desconexión real (sin Wi-Fi en cabañas). Reservas directas por WhatsApp.` : 
`- Negocio: Kmarket Algarrobo (@kmarket_algarrobo).
- Ubicación física exacta: El Boldo 366, local 13, Espacio Algarrobo, Algarrobo, Chile.
- Giro comercial: TIENDA EXCLUSIVA DE PRODUCTOS ENVASADOS DE COREA DEL SUR E IMPORTADOS (K-FOOD).
- IMPORTANTE: NO es carnicería, NO vende carbón ni carne para asados. Son exclusivamente productos coreanos envasados de alta demanda y curiosidad.
- Catálogo real comprobado:
  * Ramyun / Ramen coreano: Samyang Buldak Carbonara, Buldak Cuatro Quesos, Garak Mac & Cheese (sin lactosa), Shin Ramyun en cup y paquete, Jin Ramen, Chapagetti.
  * Helados y dulces coreanos: Helado Samanco en forma de pez con galleta crujiente y crema (Binggrae), Pepero de almendras y chocolate, Choco Pie Orion.
  * Bebidas e infusiones coreanas: Milkis (refresco lácteo carbonatado), Bon Bon de Uva con fruta real, Sac Sac, Kombucha Danongwon Seven Berries, café KANU Matcha Espresso Latte, crema vegetal FRIMA.
  * Básicos de cocina coreana envasados: Spam de cerdo en lata para Budae-Jjigae, algas tostadas sazonadas (Gim), Tteokbokki instantáneo.`}

DIRECTRICES DEL ALGORITMO ACTUAL DE META (INSTAGRAM & FACEBOOK 2025/2026):
1. La métrica reina es "SENDS / SHARES" (compartir por mensaje directo a un amigo/pareja/grupo). Supera con creces a los simples likes.
2. Los "SAVES" (guardados) indican valor permanente y posicionan el contenido en el feed de recomendaciones.
3. En Reels, los primeros 2 a 3 segundos (Visual + Hook Text) definen el 80% de la retención del video.
4. Los Carruseles aumentan el tiempo de pantalla y otorgan una segunda oportunidad en el feed.
5. Las Historias diarias nutren a la comunidad fidelizada y elevan la prioridad del perfil en la barra superior.

ESTRUCTURA DE RESPUESTA REQUERIDA (en formato Markdown claro y profesional):
### 1. 📊 Diagnóstico del Algoritmo & Salud del Perfil
(Evaluación concisa de las métricas actuales, qué tan alineada está la cuenta con las dinámicas de recomendación de Meta).

### 2. 🏆 Disección del Mejor Post
(Por qué la publicación ganadora tuvo éxito y la fórmula exacta de gancho y formato que debes replicar).

### 3. ⚡ Mecánicas Clave del Algoritmo para tu Negocio
(Cómo activar los "Shares" por DM y "Saves" específicos para ${isCampina ? 'escapadas y reservas en cabañas' : 'snacks virales y compras en tienda'}).

### 4. ⏰ Ventanas de Publicación de Alto Rendimiento
(Por qué el ritmo de Miércoles por la tarde y Sábados por la mañana/tarde es estratégico y cómo potenciarlo con Stories intermedias).

### 5. 🚀 Plan Táctico Recomendado (3 Ideas Listas para Publicar)
(3 propuestas concretas con: Formato, Gancho de 2 segundos, Idea de contenido y Llamado a la Acción).`;

    const configuredModel = getSetting('ai_model') || 'gemini-3.5-flash';
    const modelsToTry = [configuredModel, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'];
    const uniqueModels = [...new Set(modelsToTry)];

    for (const model of uniqueModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2500
          }
        }, { timeout: 15000 });

        const parts = response.data?.candidates?.[0]?.content?.parts || [];
        const text = parts.find(p => !p.thought)?.text || parts[parts.length - 1]?.text;
        if (text) {
          return {
            success: true,
            provider: 'gemini',
            model: model,
            auditMarkdown: text.trim(),
            actionableStrategies: this.getDevelopedStrategiesForAccount(accountName, analyticsSummary)
          };
        }
      } catch (err) {
        console.warn(`Intento de auditoría con modelo ${model} falló:`, err.message);
      }
    }

    return this.generateSmartAuditTemplate({ accountName, analyticsSummary });
  }

  /**
   * Generador heurístico de auditoría estratégica en caso de no disponer de conexión a API
   */
  generateSmartAuditTemplate({ accountName, analyticsSummary }) {
    const isCampina = (accountName || '').toLowerCase().includes('campiña') || (accountName || '').toLowerCase().includes('cabaña');
    const topPost = analyticsSummary?.topPost;
    const topLikes = topPost?.likes || (isCampina ? 27 : 22);

    const strategies = this.getDevelopedStrategiesForAccount(accountName, analyticsSummary);

    if (isCampina) {
      return {
        success: true,
        provider: 'smart_heuristic',
        auditMarkdown: `### 1. 📊 Diagnóstico del Algoritmo & Salud del Perfil
- **Retención audiovisual superior:** Las publicaciones en formato **Reel / Video** superan con creces a las imágenes estáticas, registrando un pico de **${topLikes} reacciones** en contenidos de ambiente natural.
- **Factor Algorítmico Crítico:** En turismo y escapadas en Algarrobo, el algoritmo de Instagram premia el **"Share to DM"** (cuando un usuario le envía el Reel a su pareja o familia diciendo *"mira qué lindo para el fin de semana"*). Ese envío directo es el multiplicador #1 de alcance.

### 2. 🏆 Disección del Mejor Post
- **Publicación destacada:** *"${topPost?.title || 'Tu próxima escapada comienza en Cabañas La Campiña'}"*.
- **Por qué funcionó:** Conectó directamente con el deseo de descanso, aire libre y naturaleza. Los primeros 2 segundos mostraron vegetación y arquitectura rústica, frenando el scroll inmediato.
- **Fórmula a replicar:** Gancho visual de tranquilidad + música envolvente de baja frecuencia + llamado claro a cotizar o reservar por WhatsApp.

### 3. ⚡ Mecánicas Clave del Algoritmo Actual para Cabañas La Campiña
- **Impulso a los "Saves" (Guardados):** Crea carruseles tipo *"Guía de Fin de Semana en Algarrobo: Dónde comer, pasear y descansar sin pantallas"*. Los usuarios guardan este contenido para sus vacaciones.
- **Enfoque Anti-Estrés (Sin Wi-Fi):** La desconexión digital de las cabañas es un diferenciador de lujo hoy en día. Destaca el valor de conversar alrededor del fuego o hacer un asado en terraza sin pantallas.
- **Historias de Jueves y Viernes:** Publica historias con el sticker interactivo *"¿Escapada improvisada este finde?"* con link directo al WhatsApp de reservas (+56 9 7900 4253).

### 4. ⏰ Ventanas de Publicación de Alto Rendimiento
- **Miércoles (19:30 - 21:00 hrs):** La gente comienza a cansarse de la semana laboral y busca refugio mental para el fin de semana. Es el momento dorado para Reels de cabañas y naturaleza.
- **Sábado (11:00 - 13:00 hrs):** Ideal para carruseles de fotos detalladas de las suites y quinchos privados.
- **Domingo (18:00 - 20:30 hrs):** Momento de planificación para feriados y próximas vacaciones.

### 5. 🚀 Plan Táctico Recomendado (Listo para Ejecutar)
Abajo encontrarás cada una de las estrategias desarrolladas con su copy completo, gancho y botón directo para llevarlas al Editor.`,
        actionableStrategies: strategies
      };
    }

    // Caso Kmarket
    return {
      success: true,
      provider: 'smart_heuristic',
      auditMarkdown: `### 1. 📊 Diagnóstico del Algoritmo & Salud del Perfil
- **Atracción por Curiosidad & Antojo:** Las publicaciones con productos asiáticos únicos (helado Samanco, ramen picante, snacks virales) generan una tasa de interacción destacada, alcanzando **${topLikes} reacciones**.
- **Factor Algorítmico Crítico:** En retail de snacks y comida rápida, el algoritmo premia el **efecto antojo ("Food Porn")** y el envío por DM a amigos con la clásica frase: *"¿Vamos a comprar esto hoy?"*.

### 2. 🏆 Disección del Mejor Post
- **Publicación destacada:** *"${topPost?.title || 'Un rincón de Corea te espera en Kmarket Algarrobo'}"*.
- **Por qué funcionó:** Apeló al factor exótico y aspiracional de los productos coreanos en el Litoral Central. La claridad del producto en formato vertical (4:5) generó deseo visual inmediato.
- **Fórmula a replicar:** Producto en primer plano + tip curioso o historia de origen + llamada a visitarnos en la tienda de Algarrobo.

### 3. ⚡ Mecánicas Clave del Algoritmo Actual para Kmarket
- **Micro-Videos de Preparación (Reels de 7 a 12 segundos):** Muestra el vertido de agua caliente en un ramen o el primer mordisco crujiente de un helado Samanco. Los videos cortos con audio en tendencia generan repeticiones automáticas (loop), lo que dispara el algoritmo de Instagram.
- **Carruseles de "Nivel de Picante" o "Top 4 Snacks":** Deslizar fotos aumenta el tiempo de permanencia en la cuenta (*dwell time*), indicándole a Meta que tu perfil retiene usuarios.
- **Historias con Encuesta:** Todos los viernes a las 17:00 publica una historia con encuesta: *"¿Team Picante 🌶️ o Team Dulce 🍫?"*. Los clics en encuestas elevan tus historias a los primeros puestos del feed de tus clientes.

### 4. ⏰ Ventanas de Publicación de Alto Rendimiento
- **Miércoles (18:30 - 20:30 hrs):** El "bajón" o antojo de media tarde/noche. Perfecto para ramens y bebidas reconfortantes.
- **Sábado (11:30 - 13:30 hrs):** Salidas y paseos de fin de semana en Espacio Algarrobo: helados Samanco, bebidas frías y snacks coreanos para la playa.
- **Sábado (19:00 - 21:00 hrs):** Noche de maratón de K-Dramas, ramens picantes y golosinas coreanas.

### 5. 🚀 Plan Táctico Recomendado (Listo para Ejecutar)
Abajo encontrarás cada una de las estrategias desarrolladas con su copy completo, gancho y botón directo para llevarlas al Editor.`,
      actionableStrategies: strategies
    };
  }

  /**
   * Genera una imagen publicitaria profesional
   * Motor Primario: Gemini 3.1 Flash Lite Image (La opción más económica y ligera de Google)
   * Fallback: Gemini 3.1 Flash Image / Gemini 2.5 Flash Image
   * Fallback secundario: Flux (Pollinations AI)
   */
  async generateDirectImage({ prompt, format = 'feed', model = 'gemini-3.1-flash-lite-image', accountName = '', baseImageUrl = null }) {
    let width = 864;
    let height = 1080; // 4:5 vertical ideal para feed de Instagram
    if (format === 'story' || format === 'reel') {
      width = 720;
      height = 1280; // 9:16 vertical
    } else if (format === 'square') {
      width = 1024;
      height = 1024;
    }

    const isCampina = (accountName || '').toLowerCase().includes('campiña') || (accountName || '').toLowerCase().includes('cabaña');
    const isKmarket = (accountName || '').toLowerCase().includes('kmarket');

    let optimizedPrompt = prompt;
    // Si el usuario ya envió un prompt estructurado (como el prompt maestro de diseñador senior), respetarlo 100% íntegro
    const isCustomMasterPrompt = prompt.toLowerCase().includes('diseñador') || prompt.length > 80;

    if (!isCustomMasterPrompt) {
      if (baseImageUrl) {
        optimizedPrompt = `Commercial product advertising poster, 4:5 vertical aspect ratio. Using this reference photo as the hero product subject, create a clean commercial advertising flyer with striking typography in Spanish, appetizing studio presentation, vibrant colors, premium packaging, 8k resolution, photorealistic, cinematic lighting. Subject: ${prompt}`;
      } else {
        optimizedPrompt = `High quality commercial social media advertising poster, 4:5 vertical aspect ratio, striking typography in Spanish, ${prompt}, 8k resolution, cinematic lighting, photorealistic`;
      }
    }

    const destDir = path.join(__dirname, '../../uploads/generated');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // 1. INTENTO CON GOOGLE GEMINI FLASH LITE / FLASH IMAGE (LA OPCIÓN MÁS ECONÓMICA Y RÁPIDA)
    const apiKey = this.getImageApiKey();
    if (apiKey) {
      const requestedModel = model || 'gemini-3.1-flash-image';
      const geminiModels = [...new Set([
        requestedModel,
        'gemini-3.1-flash-image',
        'gemini-3-pro-image',
        'gemini-3.1-flash-lite-image'
      ])];

      for (const gm of geminiModels) {
        try {
          console.log(`Intentando generación económica con ${gm}...`);
          const parts = [];

          // Si hay imagen base, incluirla como inlineData multimodal
          if (baseImageUrl) {
            let localAbsPath = baseImageUrl;
            if (baseImageUrl.startsWith('http')) {
              try {
                const parsed = new URL(baseImageUrl);
                localAbsPath = parsed.pathname;
              } catch (_) {}
            }
            const cleanRel = localAbsPath.replace(/^[\\\/]+/, '');

            const candidates = [
              path.join(__dirname, '../../', cleanRel),
              path.join(__dirname, '../../uploads', path.basename(cleanRel)),
              path.join(__dirname, '../../uploads/processed', path.basename(cleanRel)),
              path.join(__dirname, '../../uploads/generated', path.basename(cleanRel)),
              path.join(__dirname, '../../uploads/watermarks', path.basename(cleanRel)),
              localAbsPath
            ];

            let fullPath = null;
            for (const c of candidates) {
              if (c && fs.existsSync(c)) {
                fullPath = c;
                break;
              }
            }

            console.log(`[Gemini Image] baseImageUrl: "${baseImageUrl}" -> Resuelto: "${fullPath}" (Existe: ${Boolean(fullPath)})`);

            if (fullPath && fs.existsSync(fullPath)) {
              const fileBuf = fs.readFileSync(fullPath);
              const ext = path.extname(fullPath).toLowerCase();
              const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              parts.push({
                inlineData: {
                  mimeType,
                  data: fileBuf.toString('base64')
                }
              });
              console.log(`[Gemini Image] ✅ Imagen de referencia adjuntada correctamente (${fileBuf.length} bytes, ${mimeType})`);
            } else {
              console.warn(`[Gemini Image] ⚠️ ATENCIÓN: El archivo de referencia no se pudo encontrar en disco: ${baseImageUrl}`);
            }
          }

          parts.push({ text: optimizedPrompt });

          const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${apiKey}`,
            {
              contents: [{ parts }],
              generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
            },
            { timeout: 70000 }
          );

          const imgPart = geminiRes.data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
          if (imgPart && imgPart.inlineData?.data) {
            const ext = imgPart.inlineData.mimeType?.includes('png') ? 'png' : 'jpg';
            const filename = `gemini_lite_${Date.now()}.${ext}`;
            const destPath = path.join(destDir, filename);
            const imgBuffer = Buffer.from(imgPart.inlineData.data, 'base64');
            fs.writeFileSync(destPath, imgBuffer);

            console.log(`✅ Imagen económica generada con éxito con ${gm}: ${filename}`);
            return {
              success: true,
              filename,
              url: `/uploads/generated/${filename}`,
              width,
              height,
              model: gm,
              engine: 'Gemini 3.1 Flash Lite Image (Económico)',
              prompt: optimizedPrompt
            };
          }
        } catch (geminiErr) {
          console.warn(`Aviso: Error con modelo ${gm}:`, geminiErr.response?.data?.error?.message || geminiErr.message);
        }
      }
    }

    // 2. FALLBACK SECUNDARIO CON FLUX (POLLINATIONS)
    console.log('Utilizando motor secundario Flux (Pollinations)...');
    const encoded = encodeURIComponent(optimizedPrompt);
    const seed = Math.floor(Math.random() * 1000000);
    let fluxUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

    if (baseImageUrl && baseImageUrl.startsWith('http')) {
      fluxUrl += `&image=${encodeURIComponent(baseImageUrl)}`;
    }

    const filename = `ai_flux_${Date.now()}.jpg`;
    const destPath = path.join(destDir, filename);

    const response = await axios.get(fluxUrl, { responseType: 'arraybuffer', timeout: 45000 });
    fs.writeFileSync(destPath, response.data);

    return {
      success: true,
      filename,
      url: `/uploads/generated/${filename}`,
      width,
      height,
      model: 'flux',
      engine: 'Flux / Pollinations',
      prompt: optimizedPrompt
    };
  }

  /**
   * Genera afiche publicitario para Kmarket usando el prompt maestro exacto del usuario
   * enriquecido con principios de diseño editorial Canvas Design (pulcritud, jerarquía, artesanía)
   * y máxima fidelidad al empaque original entregado por el usuario.
   */
  async generateKmarketDesignerPoster({ baseImageUrl, productName = '', extraNotes = '', scannedData = null }) {
    const prod = (productName || scannedData?.productName || '').trim();
    const productMention = prod ? `de este producto ("${prod}")` : 'de este producto';

    // Usar el PROMPT MAESTRO EXACTO del usuario sin contaminarlo con subtítulos largos ni directivas artificiales
    const designerPrompt = `necesito que te comportes como un diseñador grafico senior experto en marketing. hacer una imagen publicitaria ${productMention} de dimensiones 4:5 vertical para instagram. Usar una fuente tipográfica similar a la del producto, pero dinámica, y el subtítulo con una fuente de menor tamaño pero elegante y un diseño similar para poner el título de lo que es. En el afiche DEBES incluir el empaque o lata auténtico del producto exactamente como aparece en la foto de referencia adjunta (mismo logotipo original, colores y diseño del fabricante), pero integrado con naturalidad en una puesta en escena fotográfica publicitaria comercial de estudio (es decir, no un simple recorte plano sobre blanco, sino una fotografía comercial apetitosa de estudio). Todo texto en español. No hacer referencia a ninguna tienda en especial, ni poner nada como comprar ahora. No dar tanto énfasis a lo de "sabor coreano" ni a la marca, si es que, solo de manera pequeña y discreta. PROHIBIDO terminantemente incluir emojis o párrafos largos en el diseño gráfico o texto de la imagen. Titulares breves y de alto impacto visual.`.trim();

    return await this.generateDirectImage({
      prompt: designerPrompt,
      format: 'feed',
      model: 'gemini-3.1-flash-image',
      accountName: '',
      baseImageUrl
    });
  }

  /**
   * Escanea una foto de producto real, investiga sus detalles, extrae su ficha técnica,
   * redacta el copy de Instagram y formula los títulos del afiche 4:5.
   */
  async scanProductFromImage(imagePath) {
    let cleanRel = imagePath;
    if (imagePath.startsWith('http')) {
      try {
        const parsed = new URL(imagePath);
        cleanRel = parsed.pathname;
      } catch (_) {}
    }
    cleanRel = cleanRel.replace(/^[\\\/]+/, '');

    const candidates = [
      imagePath,
      path.join(__dirname, '../../', cleanRel),
      path.join(__dirname, '../../uploads', path.basename(cleanRel)),
      path.join(__dirname, '../../uploads/processed', path.basename(cleanRel)),
      path.join(__dirname, '../../uploads/generated', path.basename(cleanRel)),
      path.join(__dirname, '../../uploads/watermarks', path.basename(cleanRel))
    ];

    let fullPath = null;
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        fullPath = c;
        break;
      }
    }

    if (!fullPath) {
      throw new Error(`La imagen del producto no existe en disco: ${cleanRel}`);
    }

    const fileBuf = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const apiKey = this.getApiKey();

    const prompt = `Actúa como un Director Creativo Senior y Copywriter publicitario de clase mundial para Kmarket Algarrobo.
Analiza minuciosamente la imagen del empaque de este producto y extrae la información real del producto.
Responde estrictamente en formato JSON con la siguiente estructura:
{
  "brand": "Marca del fabricante (ej: CJ Bibigo, Lotte, Nongshim, Samyang, Binggrae, etc.)",
  "productName": "Nombre comercial oficial del producto en español e internacional",
  "category": "Categoría (ej: Dumplings Congelados, Snacks Dulces, Ramen Instantáneo, Helados Coreanos, Bebidas, etc.)",
  "productShape": "Forma física exacta del producto según aparece ilustrado en el empaque (ej: 'barra rectangular de sándwich', 'helado con forma de pez', 'paleta cilíndrica con palito', 'bolsa con papas onduladas', 'dumplings al vapor', 'tazón de fideos', etc.)",
  "details": "Ficha detallada con ingredientes clave, notas sensoriales de sabor, textura y cómo se consume realmente",
  "adHeadline": "Titular publicitario comercial de alto impacto: EXACTAMENTE DE 2 A 4 PALABRAS con gancho publicitario y ritmo (ej: '¡CRUJIENTE & CREMOSO!', 'PURITITA VAINILLA', 'AMOR AL PRIMER MORDISCO', 'WAFFLE DORADO', 'ANTOJO COREANO'). PROHIBIDO oraciones largas o textos de catálogo aburridos.",
  "adSubtitle": "Subtítulo editorial corto (1 sola línea, máximo 5 a 7 palabras) en tono sensorial y aspiracional (ej: 'Masa suave y corazón cremoso de vainilla').",
  "copyPost": "Texto completo para post de Instagram siguiendo estrictamente la fórmula oficial de Kmarket: 1) Título entre emojis temáticos: '[Emojis] [Nombre] en Kmarket Algarrobo [Emojis]'; 2) Breve párrafo descriptivo de textura/sabor; 3) '✨ ¿Qué lo hace especial?' (1 párrafo); 4) '[Emoji] Perfecto para disfrutar como:' con 3-4 viñetas '•'; 5) Párrafo breve de conexión; 6) Dirección exacta obligatoria: '📍 Encuéntralo en Kmarket Algarrobo\\nEl Boldo 366, local 13, Espacio Algarrobo, Algarrobo'; 7) Cierre cálido '🧡 Descubre por qué...'; 8) EXACTAMENTE ENTRE 5 Y 7 HASHTAGS (#KmarketAlgarrobo #KFood y los del producto; NUNCA más de 7)."
}`;

    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];
    let lastErr = null;

    // Probar con apiKey actual y si falla probar con la clave alternativa
    const keysToTry = [apiKey];
    const imageKey = this.getImageApiKey();
    if (imageKey && imageKey !== apiKey) keysToTry.push(imageKey);

    for (const currentKey of keysToTry) {
      for (const m of modelsToTry) {
        try {
          const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${currentKey}`,
            {
              contents: [{
                parts: [
                  { inlineData: { mimeType, data: fileBuf.toString('base64') } },
                  { text: prompt }
                ]
              }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.4
              }
            },
            { timeout: 25000 }
          );

          const textResponse = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResponse) {
            const parsed = JSON.parse(textResponse);
            if (parsed.copyPost) {
              parsed.copyPost = this.cleanCaptionAI(parsed.copyPost);
            }
            return {
              success: true,
              data: parsed
            };
          }
        } catch (err) {
          lastErr = err;
          console.warn(`[scanProductFromImage] Falló con ${m}:`, err.response?.data?.error?.message || err.message);
          // Si es 503 o 429, esperar 500ms antes del siguiente intento
          if (err.response?.status === 503 || err.response?.status === 429) {
            await new Promise(r => setTimeout(r, 600));
          }
        }
      }
    }

    throw new Error(lastErr ? lastErr.message : 'No se pudo analizar la imagen del producto');
  }
}

module.exports = new AIService();


