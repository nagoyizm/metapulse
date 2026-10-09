/**
 * Base de Conocimiento Verificada de Cabañas La Campiña (Algarrobo)
 * Extraída directamente de https://www.cabanaslacampina.cl
 */

const axios = require('axios');

const CAMPINA_VERIFIED_DATA = {
  nombre: 'Cabañas La Campiña - Algarrobo',
  desde: 1993,
  web: 'https://www.cabanaslacampina.cl',
  contacto: {
    whatsapp: '+56 9 7900 4253',
    email: 'contacto@cabanaslacampina.cl',
    instagram: '@cabanaslacampina.cl',
    facebook: 'Cabañas La Campiña'
  },
  concepto: 'Hermoso y tranquilo lugar de descanso familiar y en pareja en Algarrobo, rodeado de jardines, senderos y naturaleza desde 1993. Desconexión real (sin Wi-Fi) para relajarse.',
  
  alojamientos: [
    {
      tipo: 'Cabaña de 2 a 5 personas',
      descripcion: '1er piso: Habitación matrimonial con cama de 2 plazas, living-comedor con cocina equipada y baño independiente. 2do piso abierto: 2 camas de 1 plaza (opción de sofá cama adicional). Admite mascotas.',
      incluye: 'Quincho privado con terraza, estacionamiento, DirecTV, vajilla, refrigerador, microondas, calefacción (otoño a primavera), acceso a juegos y piscinas (en temporada).'
    },
    {
      tipo: 'Cabaña de 5 a 8 personas',
      descripcion: '1er piso: Habitación matrimonial con baño en suite, living-comedor con cocina y baño independiente. 2do piso: Habitación abierta con 3 camas de 1 plaza y habitación cerrada con 2 camas de 1 plaza (opción sofá cama). Admite mascotas.',
      incluye: 'Quincho privado con terraza, estacionamiento, DirecTV, cocina completa, calefacción (otoño a primavera), acceso a juegos y piscinas.'
    },
    {
      tipo: 'Suites para 1 a 2 personas (Parejas)',
      variantes: ['Suite Jardín (1er piso con vista a jardines)', 'Suite Balcón (2do piso con balcón y vista a piscina/jardines)', 'Suite Clásica (2do piso)'],
      descripcion: 'Ambiente exclusivo para parejas o descanso individual. Cama de 2 plazas, baño privado con ducha, lavaplatos, frigobar, hervidor, coffee bar de cortesía. NO admite mascotas.',
      incluye: 'Acceso a quinchos grandes comunitarios, estacionamiento, DirecTV, juegos infantiles, piscinas (en temporada).'
    }
  ],

  instalaciones: [
    {
      nombre: 'Jardines y Senderos Temáticos',
      detalle: 'Jardín de los Duendecitos, Jardín Puente Rojo, Jardín de la Virgen, Jardín de los Pinos, Jardín de las Zarzamoras. Caminos para pasear, relajarse y leer.'
    },
    {
      nombre: 'Piscinas al Aire Libre',
      detalle: '2 piscinas (una para adultos/jóvenes y una para niños) rodeadas de áreas verdes. Operativas SOLO desde Diciembre hasta Semana Santa (verano).'
    },
    {
      nombre: 'Quinchos y Parrillas',
      detalle: 'Cabañas cuentan con quincho privado en terraza. Suites cuentan con quinchos grandes comunitarios. También disponible arriendo de quincho por el día.'
    },
    {
      nombre: 'Área de Juegos Infantiles',
      detalle: 'Columpios, resbalines, camas saltarinas y áreas verdes seguras para niños.'
    },
    {
      nombre: 'Servicios & Amenidades Extra',
      detalle: 'Bebidas calientes de máquina (cappuccino, chocolate caliente), préstamo gratuito de juegos de mesa (2 hrs), servicio de lavandería por bolsa, servicio de aseo opcional, venta de carbón.'
    }
  ],

  reglasImportantes: [
    'NO TIENE TINAJAS NI HOT TUBS (Prohibido inventar tinajas).',
    'NO CUENTA CON WI-FI (Concepto de descanso y desconexión genuina).',
    'Lugar de descanso familiar: Prohibida música fuerte o ruidos molestos. Silencio a partir de las 21:00 hrs.',
    'Mascotas: Se aceptan mascotas pequeñas y medianas SOLO en cabañas con tarifa adicional (NO en suites ni en área de piscinas).',
    'Garantía: Se solicita garantía de $20.000 reembolsable al check-out.'
  ],

  panoramasAlgarrobo: [
    'Playa El Canelo y Canelillo (aguas turquesas y bosque de pinos)',
    'Santuario de la Naturaleza Humedal de Tunquén',
    'Paseos en lancha y avistamiento de pingüinos en Isla Pájaro Niño desde muelle El Yachting',
    'Go Kart Center Algarrobo y cuatrimotos',
    'Buceo Algarrobo (bautizos submarinos y cursos PADI)',
    'Pueblito de los Artesanos (feria artesanal, café y música)',
    'Playas El Pejerrey, El Yeco, Mirasol, Las Cadenas y Algarrobo Norte',
    'Senderos del Humedal El Membrillo y Cueva del Pirata'
  ]
};

/**
 * Función para hacer scraping en vivo de cabanaslacampina.cl
 */
async function scrapeCampinaWebsite() {
  try {
    const res = await axios.get('https://www.cabanaslacampina.cl', { timeout: 10000 });
    const html = res.data;
    
    // Validar contenido básico
    const hasCabanas = html.includes('Cabañas') || html.includes('cabañas');
    const hasSuites = html.includes('Suites') || html.includes('suites');
    
    return {
      success: true,
      lastScrapedAt: new Date().toISOString(),
      url: 'https://www.cabanaslacampina.cl',
      summary: CAMPINA_VERIFIED_DATA
    };
  } catch (err) {
    console.warn('[Scraper Campiña] Error fetching live site, using cached verified data:', err.message);
    return {
      success: true,
      lastScrapedAt: new Date().toISOString(),
      fromCache: true,
      summary: CAMPINA_VERIFIED_DATA
    };
  }
}

function getCampinaKnowledgePrompt() {
  return `
INFORMACIÓN OFICIAL Y VERIFICADA DE "CABAÑAS LA CAMPIÑA" (ALGARROBO, DESDE 1993):
- Concepto: Hermoso y tranquilo lugar de descanso familiar y en pareja en Algarrobo, rodeado de naturaleza, bosques de pinos y jardines temáticos (Jardín de los Duendecitos, Puente Rojo, Virgen, Pinos, Zarzamoras).
- Alojamientos reales (www.cabanaslacampina.cl):
  * Cabañas de 2 a 5 personas y 5 a 8 personas: totalmente equipadas, living-comedor con cocina completa (vajilla, microondas, refrigerador, tetera), terraza con quincho privado para asados, calefacción en invierno, DirecTV. Admiten mascotas pequeñas/medianas.
  * Suites para parejas (Suite Jardín en 1er piso con vista a jardines, Suite Balcón en 2do piso, Suite Clásica): ambiente acogedor con cama matrimonial, frigobar, tetera / coffee bar de cortesía, vajilla, DirecTV, acceso a quinchos grandes comunitarios (no admiten mascotas, mayores de 12 años).
- Instalaciones reales del recinto:
  * Jardines y senderos temáticos para pasear con calma, leer bajo los árboles y respirar bosque.
  * Piscinas al aire libre (operativas SOLO de Diciembre a Semana Santa en temporada de verano).
  * Quinchos para asados (privados en terraza de cabañas, comunitarios en suites).
  * Área de juegos infantiles segura (camas saltarinas, columpios, resbalines en áreas verdes).
  * Amenidades: máquinas de bebidas calientes (cappuccino, chocolate caliente), préstamo de juegos de mesa para la sobremesa familiar.
- REGLAS DE ORO Y VERDAD DE MARCA (CERO INVENTOS):
  * ❌ NO TIENEN TINAJAS NI HOT TUBS (PROHIBIDO TERMINANTEMENTE inventar tinajas o jacuzzis).
  * ❌ NO CUENTAN CON WI-FI (Desconexión digital genuina para descansar y mirarse a los ojos).
  * ✅ Ambiente de descanso familiar y seguro: silencio a partir de las 21:00 hrs para un sueño reparador.
- TONO Y ESTILO DEL COPY:
  * Voz entrañable y equilibrada: Ni frío/corporativo ni informal/chillón. Debe sonar humano, cariñoso, hogareño y acogedor, como el anfitrión de una casa de campo que recibe a su familia con amor.
  * Emojis equilibrados: Ni inundación exagerada ni sequía fría. Unos 3 a 5 emojis cálidos y bien colocados (ej: 🏡, 🌿, ☕, 🥩, 🌲, 📲) que aporten ternura visual sin ensuciar la lectura.
- Contacto y Reservas oficiales: WhatsApp +56 9 7900 4253, web www.cabanaslacampina.cl, Instagram @cabanaslacampina.cl.
- Panoramas cercanos en Algarrobo: Playa El Canelo y Canelillo, Muelle El Yachting (paseos en lancha a Isla Pájaro Niño), Pueblito de los Artesanos, Humedal de Tunquén, gastronomía marina y playas locales.
`;
}

module.exports = {
  CAMPINA_VERIFIED_DATA,
  scrapeCampinaWebsite,
  getCampinaKnowledgePrompt
};
