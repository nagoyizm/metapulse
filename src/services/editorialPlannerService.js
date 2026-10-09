/**
 * Editorial Planner Service — "La pequeña mente que planea"
 * 
 * Estratega editorial dinámico para evitar copys monótonos y repetitivos.
 * - Planifica dinámicamente el ángulo editorial y la estructura narrativa.
 * - Evita fórmulas repetitivas ("pero ojo... quedan pocas reservas").
 * - Regula el uso de emojis: pocos, justos, necesarios y estrictamente sobrios (máx 1-2).
 * - Mantiene una memoria deslizante para garantizar variedad entre generaciones consecutivas.
 */

class EditorialPlannerService {
  constructor() {
    // Memoria deslizante de ángulos recientes por marca/ámbito (para no repetir)
    this.recentAnglesHistory = new Map();

    // Catálogo de Ángulos Editoriales para Cabañas La Campiña
    this.campinaAngles = [
      {
        id: 'desconexion_sensorial',
        title: 'Desconexión Sensorial & Silencio',
        badge: '🌿 Desconexión & Silencio',
        intent: 'Evocar la pausa de la rutina, el aire puro entre los pinos y eucaliptos, la ausencia de Wi-Fi para un descanso real.',
        keywords: ['desconexion', 'descanso', 'naturaleza', 'rutina', 'silencio', 'relajo', 'desconectar', 'escapada'],
        narrativeStructure: 'prose_immersive',
        structureDescription: 'Prosa inmersiva de 2 párrafos breves y elegantes + invitación serena.',
        hookConcept: 'La pausa que la mente necesita: silencio, naturaleza y tiempo a tu propio ritmo.',
        soberEmojis: ['🌿'],
        sampleTone: 'Sereno, contemplativo y cálido',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'los próximos días';
          return `A veces el descanso no se busca sumando planes, sino restando ruido.

En Cabañas La Campiña el ritmo lo marcan el viento entre los pinos, las caminatas sin apuro y la desconexión real de las pantallas. Un espacio pensado para respirar aire limpio y recuperar la calma en Algarrobo.

Si estás pensando en una pausa para ${dateRef}, te invitamos a escribirnos para coordinar tu estadía con tranquilidad.

📲 Consultas y reservas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #descanso #desconexion #litoralcentral #naturaleza`;
        }
      },
      {
        id: 'quincho_familiar',
        title: 'El Rito del Quincho & Sobremesa',
        badge: '🏡 Quincho Privado & Sobremesa',
        intent: 'Destacar la terraza con quincho propio en cada cabaña, el asado pausado y la sobremesa en familia sin mirar el reloj.',
        keywords: ['quincho', 'asado', 'parrilla', 'almuerzo', 'sobremesa', 'terraza', 'carne'],
        narrativeStructure: 'scene_moment',
        structureDescription: 'Escena vívida de sobremesa + comodidades de cabaña equipada + contacto directo.',
        hookConcept: 'Un buen asado se disfruta más cuando la sobremesa no tiene prisa ni horarios que cumplir.',
        soberEmojis: ['🏡'],
        sampleTone: 'Hogareño, familiar y apetitoso',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `Para este ${targetDate}` : 'Para tu próxima escapada';
          return `Un buen asado no se mide solo por las brasas, sino por la sobremesa tranquila que viene después.

En nuestras cabañas disfrutas de tu propio quincho privado en la terraza: el espacio perfecto para reunir a la familia o amigos, cocinar con calma y compartir al aire libre rodeado de áreas verdes.

${dateRef}, ven a disfrutar de Algarrobo con la comodidad de un hogar completamente equipado.

📲 Consultas y reservas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #asado #quincho #familia #descanso #algarrobochile`;
        }
      },
      {
        id: 'escapada_parejas',
        title: 'Refugio en Pareja & Suites con Vista',
        badge: '🌿 Refugio en Pareja (Suites)',
        intent: 'Destacar la exclusividad y privacidad de las suites (Jardín, Balcón), café matutino con vista y paseos tranquilos.',
        keywords: ['pareja', 'parejas', 'suite', 'suites', 'romantico', 'balcon', 'jardin', 'dos personas'],
        narrativeStructure: 'curated_highlights',
        structureDescription: 'Invitación a la calma compartida de a dos + detalles de confort en 3 viñetas limpias + reserva cordial.',
        hookConcept: 'Una escapada de a dos donde el único compromiso es disfrutar el momento.',
        soberEmojis: ['🌿'],
        sampleTone: 'Íntimo, distinguido y reconfortante',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `pensada para este ${targetDate}` : 'para cuando tú decidas';
          return `Hay momentos donde el mejor panorama es simplemente cambiar de aire y disfrutar de la tranquilidad compartida.

Nuestras suites están diseñadas para parejas que buscan intimidad, descanso y contacto con la naturaleza:

• Espacio acogedor con frigobar y coffee bar
• Hermosa vista hacia jardines temáticos o balcón privado
• Acceso a senderos naturales para caminar y desconectarse

Una pausa ${dateRef} en Algarrobo. Escríbenos para conocer disponibilidad y valores.

📲 Consultas y reservas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #escapadadepareja #suites #descanso #litoralcentral`;
        }
      },
      {
        id: 'jardines_senderos',
        title: 'Senderos Temáticos & Rincones Naturales',
        badge: '🌿 Senderos & Jardines Temáticos',
        intent: 'Poner en valor los jardines del recinto (Puente Rojo, Duendecitos, Pinos, Virgen) y el contacto directo con la botánica.',
        keywords: ['jardines', 'senderos', 'puente rojo', 'flores', 'arboles', 'caminar', 'lectura', 'duendecitos'],
        narrativeStructure: 'prose_immersive',
        structureDescription: 'Recorrido evocador por el recinto + invitación serena a hospedarse + contacto.',
        hookConcept: 'Caminar entre jardines temáticos y respirar bosque a solo minutos del mar.',
        soberEmojis: ['🌿'],
        sampleTone: 'Inspirador, natural y poético',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `para este ${targetDate}` : 'para tus días libres';
          return `El Jardín del Puente Rojo, el sendero de los pinos y rincones pensados para sentarse a leer o simplemente contemplar.

En Cabañas La Campiña el paisaje no es un decorado: es parte esencial de la estadía. Caminar por nuestros jardines temáticos invita a bajar las revoluciones y reconectar con lo esencial.

Planea tu estadía ${dateRef} y vive el encanto natural de Algarrobo desde adentro.

📲 Reservas y detalles por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #jardines #naturaleza #senderos #descansototal`;
        }
      },
      {
        id: 'familia_recuerdos',
        title: 'Tiempo en Familia & Recuerdos Seguros',
        badge: '🏡 Encuentro Familiar & Niños',
        intent: 'Cabañas amplias de 2 a 8 personas, juegos infantiles, áreas verdes seguras y descanso genuino para los padres.',
        keywords: ['familia', 'hijos', 'niños', 'juegos', 'mascotas', 'abuelos', 'reunion', 'espacio'],
        narrativeStructure: 'curated_highlights',
        structureDescription: 'Enfoque generacional acogedor + 3 viñetas limpias de valor + llamada a la acción.',
        hookConcept: 'Los recuerdos familiares más lindos se construyen al aire libre y sin apuro.',
        soberEmojis: ['🏡'],
        sampleTone: 'Afectuoso, seguro y distendido',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'pronto';
          return `Ver a los niños correr libres en áreas verdes seguras mientras los adultos disfrutan de una buena conversación sin prisas.

Nuestras cabañas familiares en Algarrobo ofrecen el espacio y equipamiento que necesitas para compartir cómodamente:

• Cabañas independientes totalmente equipadas para 2 a 8 personas
• Juegos infantiles y amplias áreas verdes seguras
• Quincho privado para compartir almuerzos familiares

Si estás planificando reunir a la familia ${dateRef}, contáctanos con tiempo para coordinar tu cabaña.

📲 Reservas y consultas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #vacacionesenfamilia #descansofamiliar #algarrobochile`;
        }
      },
      {
        id: 'planificacion_serena',
        title: 'Organización Serena de Fechas',
        badge: '📍 Planificación Anticipada',
        intent: 'Anticipar fechas especiales o fines de semana con calma y orden, sin caer en la urgencia artificial de "pero ojo".',
        keywords: ['fecha', 'fechas', 'fin de semana', 'feriado', 'fiestas patrias', '18', 'vacaciones', 'temporada', 'semana santa'],
        narrativeStructure: 'question_contrast',
        structureDescription: 'Ocasión de calendario + propuesta integral de descanso + orientación cordial por WhatsApp.',
        hookConcept: 'Planificar tu descanso con tiempo es la mejor manera de empezar a disfrutarlo desde ya.',
        soberEmojis: ['📍'],
        sampleTone: 'Práctico, cordial y organizado',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate || 'el próximo fin de semana';
          return `Planificar el descanso con anticipación permite viajar con tranquilidad y asegurar la cabaña o suite ideal para tu grupo.

En Cabañas La Campiña te esperamos en Algarrobo con cabañas independientes, quinchos privados y amplios jardines para disfrutar de ${dateRef} rodeado de naturaleza.

Para consultas sobre fechas disponibles, valores y alternativas de estadía, te atendemos de forma personalizada por WhatsApp.

📲 Reservas y consultas: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #escapada #descanso #turismochile #litoralcentral`;
        }
      },
      {
        id: 'descanso_nocturno',
        title: 'Silencio Nocturno & Despertar en Calma',
        badge: '🌿 Silencio Nocturno & Calma',
        intent: 'La política de silencio a partir de las 21:00 hrs, el descanso nocturno profundo y el despertar con el canto de las aves.',
        keywords: ['silencio', 'noche', 'dormir', 'estrellas', 'paz', 'amanecer', 'tranquilidad', 'ruido'],
        narrativeStructure: 'prose_immersive',
        structureDescription: 'Contraste entre el estrés urbano y la paz nocturna de La Campiña + contacto.',
        hookConcept: 'Dormir con verdadero silencio y despertar solo con el trinar de las aves es el verdadero lujo.',
        soberEmojis: ['🌿'],
        sampleTone: 'Apacible, reconfortante y sobrio',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'tus días de descanso';
          return `En un mundo lleno de alarmas y notificaciones continuas, dormir en completo silencio se ha transformado en un privilegio.

En La Campiña cuidamos especialmente la tranquilidad de nuestros huéspedes: a partir de las 21:00 hrs reina el silencio para garantizar un descanso profundo bajo el cielo despejado de Algarrobo.

Ven a renovar energías ${dateRef}. Escríbenos para resolver tus dudas y asegurar tu lugar.

📲 Consultas y reservas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #paz #silencio #descanso #bienestar`;
        }
      }
    ];

    // Catálogo General para marcas generales / SaaS / Ecommerce
    this.generalAngles = [
      {
        id: 'dolor_real_resuelto',
        title: 'Solución Concreta a un Problema Cotidiano',
        badge: '🎯 Dolor Real Resuelto',
        intent: 'Atacar una fricción concreta que vive el cliente y mostrar la solución con empatía y claridad.',
        narrativeStructure: 'prose_immersive',
        soberEmojis: ['💡']
      },
      {
        id: 'contraste_perspectiva',
        title: 'Perspectiva Contraria & Sentido Común',
        badge: '⚡ Perspectiva Diferente',
        intent: 'Cuestionar un error o mito común de la industria con argumentos sólidos y calmados.',
        narrativeStructure: 'question_contrast',
        soberEmojis: ['📌']
      },
      {
        id: 'escena_cotidiana',
        title: 'Momento Real Detrás de Escena',
        badge: '📖 Historia Cotidiana',
        intent: 'Narrar una situación representativa del día a día del cliente o negocio.',
        narrativeStructure: 'scene_moment',
        soberEmojis: ['✨']
      },
      {
        id: 'curaduria_valor',
        title: 'Curaduría de Puntos Clave',
        badge: '📋 Puntos Clave Curados',
        intent: 'Entregar 2 a 3 recomendaciones concretas y accionables con viñetas limpias.',
        narrativeStructure: 'curated_highlights',
        soberEmojis: ['📍']
      }
    ];
  }

  /**
   * Planifica inteligentemente el ángulo editorial y la estructura para una publicación
   */
  planStrategy({ brandName = '', topic = '', targetDate = '', format = 'post', tone = '', goal = '' }) {
    const isCampina = (brandName || '').toLowerCase().includes('campiña') || 
                      (brandName || '').toLowerCase().includes('campina') ||
                      (topic || '').toLowerCase().includes('campiña') ||
                      (topic || '').toLowerCase().includes('cabaña');

    const scopeKey = isCampina ? 'campina' : (brandName.toLowerCase().trim() || 'general');
    const recentAngles = this.recentAnglesHistory.get(scopeKey) || [];

    let catalog = isCampina ? this.campinaAngles : this.generalAngles;

    // 1. Detección de afinidad semántica por palabras clave en topic / theme / targetDate
    const combinedText = `${topic} ${targetDate} ${tone} ${goal}`.toLowerCase();
    
    // Buscar si alguna coincidencia es explícita y prioritaria
    const matchingAngles = catalog.filter(angle => {
      if (!angle.keywords) return false;
      return angle.keywords.some(kw => combinedText.includes(kw));
    });

    let selectedAngle = null;

    if (matchingAngles.length > 0) {
      // Si hay coincidencias temáticas, elegir una que NO se haya usado en los últimos 3 turnos
      const freshMatches = matchingAngles.filter(a => !recentAngles.slice(-3).includes(a.id));
      if (freshMatches.length > 0) {
        selectedAngle = freshMatches[Math.floor(Math.random() * freshMatches.length)];
      }
    }

    // Si no había coincidencias temáticas o todas ya se usaron recientemente, rotar con ángulos frescos del catálogo
    if (!selectedAngle) {
      const freshPool = catalog.filter(a => !recentAngles.slice(-3).includes(a.id));
      const pool = freshPool.length > 0 ? freshPool : catalog.filter(a => !recentAngles.slice(-1).includes(a.id));
      const finalPool = pool.length > 0 ? pool : catalog;
      selectedAngle = finalPool[Math.floor(Math.random() * finalPool.length)];
    }

    if (!selectedAngle) {
      selectedAngle = catalog[0];
    }

    // Actualizar historial deslizante (guardar últimos 4)
    const updatedRecent = [...recentAngles.filter(id => id !== selectedAngle.id), selectedAngle.id].slice(-4);
    this.recentAnglesHistory.set(scopeKey, updatedRecent);

    return {
      scope: scopeKey,
      isCampina,
      angleId: selectedAngle.id,
      angleName: selectedAngle.title,
      badge: selectedAngle.badge,
      intent: selectedAngle.intent,
      narrativeStructure: selectedAngle.narrativeStructure,
      structureDescription: selectedAngle.structureDescription || 'Estructura equilibrada con respiro visual y llamada natural.',
      hookConcept: selectedAngle.hookConcept || 'Gancho sobrio en 1 línea con curiosidad o empatía.',
      sampleTone: selectedAngle.sampleTone || tone || 'Sobrio, cálido y profesional',
      soberEmojis: selectedAngle.soberEmojis || ['🌿'],
      maxEmojis: 2,
      forbiddenPhrases: [
        'pero ojo',
        'pero ojo…',
        'pero ojo,,,',
        'ojo…',
        'ojo con esto',
        'quedan pocas reservas',
        'nos van quedando las últimas cabañas y suites disponibles',
        'últimas cabañas disponibles',
        'corre que se acaban',
        'apúrate antes que se agoten',
        'oferta imperdible'
      ],
      buildFallback: selectedAngle.buildFallback || null
    };
  }

  /**
   * Genera el bloque de directrices estratégicas que se inyecta al LLM (Gemini, Claude, OpenAI)
   */
  buildPromptDirectives(plan, { topic, targetDate, format }) {
    return `
🧠 DIRECTRICES DE LA MENTE PLANIFICADORA EDITORIAL:
- ÁNGULO EDITORIAL ASIGNADO: "${plan.angleName}" (${plan.badge})
- INTENCIÓN COMUNICACIONAL: ${plan.intent}
- ESTRUCTURA NARRATIVA EXIGIDA: ${plan.structureDescription}
- ENFOQUE DEL GANCHO (Línea 1): "${plan.hookConcept}"
${targetDate ? `- CONTEXTO DE FECHA O TEMPORADA: "${targetDate}"` : ''}

REGLAS DE ORO OBLIGATORIAS (SOBRIEDAD & CALIDAD EDITORIAL):
1. EMOJIS MÍNIMOS Y SOBRIOS (MÁXIMO 1 A 2 EN TODO EL TEXTO):
   - Usa un máximo estricto de 1 o 2 emojis sobrios (por ejemplo: ${plan.soberEmojis.join(' o ')} o un ícono discreto de contacto).
   - ❌ PROHIBIDO llenar el post de emojis decorativos (cero ✨, cero 🔥 repetidos, cero 🥩, cero 👀).
   - ❌ PROHIBIDO "framing" con emojis al inicio y final de una misma línea (ej: ¡NUNCA hagas "✨🌿 Título 🌿✨").
   - ❌ PROHIBIDO poner emojis en cada viñeta o línea de lista. Si usas viñetas, usa viñeta limpia con punto ("•").

2. CERO FÓRMULAS DE FALSA ESCASEZ (PROHIBIDO "PERO OJO"):
   - ❌ PROHIBIDO TERMINANTEMENTE usar expresiones como "Pero ojo…", "Ojo…", "nos van quedando pocas reservas", "corre que se acaban", "últimos cupos".
   - Si se menciona disponibilidad o fechas, comunícalo con serenidad, elegancia y tranquilidad:
     (Ej: "Para consultar fechas disponibles y asegurar tu descanso, te invitamos a escribirnos por WhatsApp" o "Si buscas organizar tu escapada con calma, puedes coordinar tu fecha con anticipación").

3. VARIEDAD NARRATIVA REAL:
   - No copies estructuras monótonas previas. Desarrolla el texto según el ángulo planificado ("${plan.angleName}"), dándole un respiro visual limpio, párrafos breves y una voz humana que suene auténtica.
`.trim();
  }

  /**
   * Devuelve un copy de respaldo offline de altísima fidelidad según el plan editorial
   */
  getFallbackCopy(plan, params = {}) {
    if (typeof plan.buildFallback === 'function') {
      return plan.buildFallback(params);
    }

    const { topic = 'novedades', brandName = 'Nuestra marca' } = params;
    return `Hay momentos donde detenerse y mirar con perspectiva marca toda la diferencia.

En ${brandName} trabajamos cada día enfocados en ofrecer una experiencia cuidada, transparente y pensada para tus necesidades reales con ${topic}.

Te invitamos a conocer más o escribirnos directamente para resolver cualquier consulta.

📍 Más información y contacto en el enlace de nuestra biografía.

#comunidad #calidad #experiencia #compromiso`;
  }
}

module.exports = new EditorialPlannerService();
