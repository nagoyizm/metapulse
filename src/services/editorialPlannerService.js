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
        badge: '🌿 Desconexión & Naturaleza',
        intent: 'Evocar la pausa de la rutina, el aire puro entre los pinos y eucaliptos de Algarrobo, y la desconexión real sin Wi-Fi para volver a mirarse a los ojos y conversar con tranquilidad.',
        keywords: ['desconexion', 'descanso', 'naturaleza', 'rutina', 'silencio', 'relajo', 'desconectar', 'escapada'],
        narrativeStructure: 'prose_immersive',
        structureDescription: 'Prosa inmersiva y entrañable de 2 párrafos cálidos + invitación cordial.',
        hookConcept: 'Ese momento en que dejas el teléfono a un lado y sientes la brisa fresca entre los pinos.',
        soberEmojis: ['🌲', '🌿', '🏡'],
        sampleTone: 'Cálido, entrañable, acogedor y sereno',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'los próximos días';
          return `Hay una calma muy especial que solo se siente cuando dejas el teléfono a un lado y escuchas el viento pasar entre los pinos. 🌲

En Cabañas La Campiña pensamos cada rincón para desconectarse de la prisa y volver a lo que de verdad importa: una caminata tranquila por nuestros senderos, una conversación larga sin pantallas y ese aire puro que solo tiene Algarrobo. 🌿

Si sientes que ya es momento de una pausa para ti y los tuyos ${dateRef}, te esperamos con los brazos abiertos. 🏡

📲 Reservas y consultas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #descanso #desconexion #naturaleza #litoralcentral`;
        }
      },
      {
        id: 'quincho_familiar',
        title: 'El Rito del Quincho & Sobremesa',
        badge: '🏡 Quincho Privado & Sobremesa',
        intent: 'Destacar la terraza con quincho propio en cada cabaña familiar, el asado pausado, la risa compartida y la sobremesa sin mirar el reloj.',
        keywords: ['quincho', 'asado', 'parrilla', 'almuerzo', 'sobremesa', 'terraza', 'carne'],
        narrativeStructure: 'scene_moment',
        structureDescription: 'Escena vívida de sobremesa hogareña + comodidades de cabaña equipada + contacto directo.',
        hookConcept: 'Un buen asado se disfruta más cuando la sobremesa no tiene prisa y la risa fluye en familia.',
        soberEmojis: ['🏡', '🥩', '🌿'],
        sampleTone: 'Hogareño, entrañable, cálido y apetitoso',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'tu próxima escapada';
          return `Un buen asado no es solo la parrilla: es la risa compartida, el olor a brasas al atardecer y esa sobremesa que se alarga sin que nadie mire la hora. 🥩🌿

En nuestras cabañas familiares disfrutas de tu propio quincho privado en la terraza: el rincón perfecto para reunir a quienes más quieres, cocinar con calma y disfrutar al aire libre rodeado de áreas verdes. 🏡

Ven a vivir esos momentos que quedan grabados en el corazón. Escríbenos para consultar fechas y valores para ${dateRef}.

📲 Reservas y consultas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #asadoenfamilia #quincho #descanso #algarrobochile`;
        }
      },
      {
        id: 'escapada_parejas',
        title: 'Refugio en Pareja & Suites Acogedoras',
        badge: '🌿 Refugio en Pareja (Suites)',
        intent: 'Destacar la intimidad y calidez de las suites para 2 personas (Jardín con vista a las flores, Balcón), café o mate matutino, caminatas tranquilas y descanso sin apuros.',
        keywords: ['pareja', 'parejas', 'suite', 'suites', 'romantico', 'balcon', 'jardin', 'dos personas'],
        narrativeStructure: 'curated_highlights',
        structureDescription: 'Invitación a la calma compartida de a dos + detalles de confort acogedor + reserva cordial.',
        hookConcept: 'Un café por la mañana mirando el jardín y el tiempo corriendo a su propio ritmo de a dos.',
        soberEmojis: ['☕', '🌿', '🏡'],
        sampleTone: 'Íntimo, cariñoso, acogedor y reconfortante',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `para este ${targetDate}` : 'para cuando decidan hacer una pausa';
          return `Un café calientito por la mañana, vista verde desde la ventana y el día entero para disfrutarlo de a dos, sin alarmas ni apuros. ☕🌿

Nuestras suites son un refugio íntimo pensado especialmente para parejas que buscan descansar y cambiar de aire:
• Espacio cálido y acogedor con frigobar y coffee bar
• Vista hermosa hacia nuestros jardines temáticos
• Senderos naturales para caminar y desconectarse juntos

Regálense unos días de calma compartida ${dateRef} en Algarrobo. Escríbenos por WhatsApp para conocer disponibilidad y valores. 🏡

📲 Consultas y reservas: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #escapadadepareja #suites #descanso #litoralcentral`;
        }
      },
      {
        id: 'jardines_senderos',
        title: 'Senderos Temáticos & Rincones del Bosque',
        badge: '🌿 Senderos & Jardines Temáticos',
        intent: 'Poner en valor los jardines del recinto (Puente Rojo, Duendecitos, Pinos, Virgen) y el contacto reconfortante con la naturaleza y el bosque desde 1993.',
        keywords: ['jardines', 'senderos', 'puente rojo', 'flores', 'arboles', 'caminar', 'lectura', 'duendecitos'],
        narrativeStructure: 'prose_immersive',
        structureDescription: 'Paseo evocador y reconfortante por el recinto + invitación serena a hospedarse + contacto.',
        hookConcept: 'Caminar despacio entre jardines temáticos y respirar bosque a solo minutos del mar.',
        soberEmojis: ['🌿', '🌲', '🌸'],
        sampleTone: 'Inspirador, entrañable, natural y apacible',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `para este ${targetDate}` : 'para tus días libres';
          return `Caminar sin prisa por el Jardín del Puente Rojo, descubrir los rincones de los Duendecitos y sentarse bajo la sombra de los pinos a respirar profundo. 🌲🌿

Desde 1993 cuidamos nuestros jardines en Cabañas La Campiña para que cada paseo sea un bálsamo para la rutina. Aquí el paisaje se vive, se respira y te devuelve la calma natural que a veces la ciudad nos quita.

Planea tu descanso ${dateRef} y ven a disfrutar de la naturaleza más linda de Algarrobo con quienes más quieres. 🏡

📲 Reservas y consultas por WhatsApp: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #jardinestematicos #naturaleza #descansototal #litoralcentral`;
        }
      },
      {
        id: 'familia_recuerdos',
        title: 'Tiempo en Familia & Recuerdos de Infancia',
        badge: '🏡 Encuentro Familiar & Niños',
        intent: 'Cabañas amplias de 2 a 8 personas totalmente equipadas, juegos infantiles seguros, áreas verdes para correr libres, quincho propio y bienvenida a mascotas en cabañas.',
        keywords: ['familia', 'hijos', 'niños', 'juegos', 'mascotas', 'abuelos', 'reunion', 'espacio'],
        narrativeStructure: 'curated_highlights',
        structureDescription: 'Enfoque generacional entrañable + comodidades de valor familiar + llamada afectuosa a reservar.',
        hookConcept: 'Los recuerdos familiares más lindos se construyen al aire libre: risas, pasto y sobremesa sin apuro.',
        soberEmojis: ['🏡', '🌿', '👨‍👩‍👧‍👦'],
        sampleTone: 'Afectuoso, entrañable, hogareño y familiar',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'pronto';
          return `Ver a los niños reír y correr libres por el pasto mientras los grandes disfrutan una sobremesa tranquila y sin mirar el reloj. 🏡🌿

En Cabañas La Campiña llevamos más de 30 años recibiendo familias en Algarrobo con todo lo necesario para sentirse en casa:
• Cabañas independientes totalmente equipadas para 2 a 8 personas
• Terraza con quincho privado para preparar el asado familiar
• Juegos infantiles (camas saltarinas y columpios) en áreas verdes seguras
• ¡Y en cabañas tus mascotas también son bienvenidas! 🐾

Si están pensando en reunir a la familia ${dateRef}, escríbannos por WhatsApp para coordinar su cabaña con tiempo y cariño.

📲 Reservas y consultas: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #vacacionesenfamilia #recuerdos #descansofamiliar #algarrobochile`;
        }
      },
      {
        id: 'planificacion_serena',
        title: 'Organización Anticipada con Cariño',
        badge: '📍 Planificación Serena',
        intent: 'Organizar las fechas de descanso o fines de semana con calma y orden, asegurando el lugar ideal para la familia o pareja sin apuros ni falsas presiones.',
        keywords: ['fecha', 'fechas', 'fin de semana', 'feriado', 'fiestas patrias', '18', 'vacaciones', 'temporada', 'semana santa'],
        narrativeStructure: 'question_contrast',
        structureDescription: 'Ocasión de calendario + propuesta integral de descanso + orientación cordial y cálida por WhatsApp.',
        hookConcept: 'Saber que tienes un refugio acogedor esperándote en Algarrobo hace que la semana se sienta mucho más liviana.',
        soberEmojis: ['🏡', '🌿', '📅'],
        sampleTone: 'Cálido, cordial, previsor y acogedor',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate || 'el próximo fin de semana';
          return `Saber que tienes un lugar acogedor esperándote en Algarrobo hace que la semana se sienta mucho más liviana. 🏡🌿

En Cabañas La Campiña te esperamos con cabañas independientes equipadas, quinchos privados en terraza y amplios jardines para disfrutar de ${dateRef} rodeado de bosque y aire puro. 🌲

Coordinar tu estadía con anticipación te permite elegir la cabaña o suite ideal para tu grupo y viajar con total tranquilidad. Te atendemos con gusto por WhatsApp.

📲 Reservas y consultas: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #escapada #descanso #familiachile #litoralcentral`;
        }
      },
      {
        id: 'descanso_nocturno',
        title: 'Silencio Nocturno & Despertar con Pájaros',
        badge: '🌿 Silencio Nocturno & Calma',
        intent: 'La política de silencio a partir de las 21:00 hrs para un sueño verdaderamente reparador, noche estrellada y despertar con el canto de las aves.',
        keywords: ['silencio', 'noche', 'dormir', 'estrellas', 'paz', 'amanecer', 'tranquilidad', 'ruido'],
        narrativeStructure: 'prose_immersive',
        structureDescription: 'Contraste entre el estrés urbano y la paz nocturna de La Campiña + contacto afectuoso.',
        hookConcept: 'Dormir con verdadero silencio y despertar con el trinar de las aves es un lujo que renueva el cuerpo.',
        soberEmojis: ['🌲', '🌿', '🏡'],
        sampleTone: 'Apacible, entrañable, reconfortante y sereno',
        buildFallback: ({ targetDate }) => {
          const dateRef = targetDate ? `este ${targetDate}` : 'tus días de descanso';
          return `Dormir sintiendo la brisa suave entre los árboles, bajo un cielo estrellado y despertar solo con el canto de los pajaritos. 🌲🕊️

En La Campiña cuidamos con mucho cariño el descanso de cada huésped: a partir de las 21:00 hrs reina el silencio en todo el recinto para garantizar una noche de sueño profundo y reparador, lejos de las bocinas y el ruido de la ciudad. 🏡

Ven a recargar energías ${dateRef}. Escríbenos por WhatsApp y preparamos tu llegada.

📲 Consultas y reservas: +56 9 7900 4253
www.cabanaslacampina.cl

#cabañaslacampiña #algarrobo #paz #silencio #descanso #bienestar #litoralcentral`;
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
      sampleTone: isCampina ? 'Cálido, entrañable, acogedor y familiar' : (selectedAngle.sampleTone || tone || 'Cálido, humano y profesional'),
      soberEmojis: selectedAngle.soberEmojis || ['🏡', '🌿', '☕'],
      maxEmojis: 5,
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

REGLAS DE ORO OBLIGATORIAS (EQUILIBRIO, VOZ ENTRAÑABLE & CERO INVENTOS):
1. VOZ ENTRAÑABLE, CÁLIDA Y CERCANA (EQUILIBRIO JUSTO, CERO ACARTONAMIENTO):
   - ❌ PROHIBIDO sonar frío, excesivamente formal, distante o corporativo. No hables como un folleto frío ni des discursos filosóficos densos.
   - ✅ Habla con calidez humana, cercanía entrañable y hospitalidad sincera, como el anfitrión de una casa de campo en Algarrobo que recibe a su familia con los brazos abiertos.
   - Evoca momentos que reconfortan el corazón: el asadito en el quincho de la terraza, el café mañanero mirando las flores, la sobremesa sin mirar el reloj, las risas de los niños en el pasto, el silencio apacible del bosque al caer la noche.

2. EMOJIS EQUILIBRADOS (NI SATURACIÓN CHILLONA NI SEQUÍA FRÍA):
   - Usa entre 3 y 5 emojis cálidos y bien colocados a lo largo del post (ej: ${plan.soberEmojis.join(', ')} o un ícono discreto de contacto 📲).
   - ❌ PROHIBIDO saturar el post de emojis (cero spam de emojis en cada palabra, cero emojis chillones de alarma o urgencia como 🚨, 👀 o 💥).
   - ❌ PROHIBIDO "framing" con emojis al inicio y final de una misma línea (ej: NUNCA hagas "✨🌿 Título 🌿✨").

3. LEER BIEN LA PÁGINA Y TOMAR LO IMPORTANTE (CERO INVENTOS):
   - Todo lo que digas debe estar estrictamente respaldado por la web oficial www.cabanaslacampina.cl:
     * Cabañas familiares (2 a 8 personas) con cocina equipada y quincho privado en terraza.
     * Suites para parejas (Jardín, Balcón) con frigobar, coffee bar y acceso a quinchos comunitarios.
     * Amplios jardines y senderos temáticos (Puente Rojo, Duendecitos, Pinos, Virgen) para pasear con calma.
     * Juegos infantiles en áreas verdes seguras.
     * Desconexión genuina: NO cuenta con Wi-Fi (para descansar de verdad y reconectar en persona).
     * Silencio a partir de las 21:00 hrs para un descanso nocturno profundo.
     * Mascotas bienvenidas en cabañas.
     * Piscinas al aire libre operativas SOLO en temporada de verano (diciembre a Semana Santa).
     * ❌ PROHIBIDO TERMINANTEMENTE inventar tinajas, jacuzzis o hot tubs (NO existen).

4. CERO FÓRMULAS DE FALSA ESCASEZ (PROHIBIDO "PERO OJO"):
   - ❌ PROHIBIDO usar "Pero ojo…", "Ojo…", "nos van quedando pocas reservas", "apúrate que se acaban".
   - Comunica la invitación a reservar con calidez, confianza y serenidad: "Escríbenos por WhatsApp y coordinamos tu estadía con tiempo y todo el cariño".
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
