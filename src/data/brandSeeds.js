// Semillas iniciales para perfiles de marca en SQLite (brand_profiles)
module.exports = [
  {
    id: 'agendio',
    matchKeywords: ['agendio'],
    profile: {
      id: 'agendio',
      name: 'Agendio (@agendio.cl)',
      tag: 'Agendio',
      emoji: '📅',
      whatsapp: '+56 9 7900 4253',
      web: 'www.agendio.cl',
      taglines: [
        'Nunca más pierdas una reserva.',
        'La calma de operar bien.'
      ],
      proposal: 'Centraliza y gestiona las reservas, horarios, huéspedes y pagos de tu cabaña, hostal u hospedaje en una sola plataforma intuitiva y automatizada.',
      painPoints: [
        'La doble reserva: Dos familias reservan la misma cabaña para el mismo fin de semana.',
        'La llamada perdida: Suena el teléfono a medianoche y cuando atiendes ya reservó en otro lado.',
        'La planilla que no aparece: Cuadernos, WhatsApp y Excel descoordinados, nadie sabe qué está libre.',
        'El pago que se olvida: Entre check-ins y aseo se te escapa cobrar lo ya trabajado.'
      ],
      rules: [
        'Agendio vende erradicar dolores operativos específicos en alojamientos turísticos de Chile (cabañas, hostales, hospedajes, domos), NO funciones abstractas de software.',
        'Tono chileno, cercano, directo, empático y sin tecnicismos ("la calma de operar bien").',
        'Destacar el fin de las dobles reservas, el calendario interactivo en vivo y el link público 24/7.',
        'Prohibido lenguaje de ecommerce ("oferta", "compra ya") o hashtags de creadores (#viral, #fyp).',
        'Paleta visual estricta: Verde bosque profundo (#0B1B12), Verde oscuro (#142B1E), Dorado ámbar CTA (#D99A2B), Crema cálido (#FBF7F0), Esmeralda (#34D399).',
        'Tipografía: Spectral para titulares y Outfit para cuerpo de texto. Bordes rectos de 2px (rounded-xs).'
      ],
      hashtags: '#gestiondealojamientos #turismochile #cabañaschile #hostalchile #alojamientoturistico #turismorural #airbnbchile #bookingchile #emprendimientoturistico #cabañas #hospedaje',
      knowledge: 'Plataforma SaaS chilena para gestión integral de cabañas y alojamientos turísticos. Elimina dobles reservas, automatiza confirmaciones de WhatsApp y ofrece cotización directa 24/7.',
      voice: 'Escribe como un anfitrión chileno que tuvo cabañas y sufrió el caos de las dobles reservas y el WhatsApp a medianoche. Habla de tú, directo y empático, con frases cortas y ejemplos concretos de la operación diaria. Nada de jerga de software ni de vendedor.',
      hashtagCore: ['#agendio', '#gestiondealojamientos'],
      hashtagBank: [
        '#turismochile',
        '#cabañaschile',
        '#hostalchile',
        '#alojamientoturistico',
        '#turismorural',
        '#airbnbchile',
        '#bookingchile',
        '#emprendimientoturistico',
        '#cabañas',
        '#hospedaje',
        '#reservasonline',
        '#anfitriones',
        '#pymechile'
      ]
    }
  },
  {
    id: 'campina',
    matchKeywords: ['campiña', 'campina', 'cabaña', 'cabana'],
    profile: {
      id: 'campina',
      name: 'Cabañas La Campiña - Algarrobo',
      tag: 'Cabañas La Campiña',
      emoji: '🌲',
      whatsapp: '+56 9 7900 4253',
      web: 'www.cabanaslacampina.cl',
      rules: [
        'NO TIENEN TINAJAS DE AGUA CALIENTE NI HOT TUBS (Prohibido inventar tinajas).',
        'NO CUENTA CON WI-FI (Concepto de descanso familiar y desconexión total sin pantallas).',
        'Piscinas al aire libre operan exclusivamente en temporada de verano (diciembre a Semana Santa).',
        'Cabañas familiares (2 a 5 y 5 a 8 personas) con cocina equipada, calefacción y quincho privado en terraza.',
        'Suites para parejas (1 a 2 personas) con frigobar, coffee bar y quinchos comunitarios (no admiten mascotas).',
        'Mascotas permitidas SOLO en cabañas familiares con recargo adicional (NO en suites ni en piscinas).',
        'Reservas y tarifas exactas por fechas: Invitar cordialmente a escribir al WhatsApp oficial +56 9 7900 4253.'
      ],
      voice: 'Escribe como la familia que atiende Cabañas La Campiña en Algarrobo. Cálida y sencilla, como quien invita a un amigo a pasar el fin de semana: cuenta lo que se ve, se huele y se escucha en el lugar. Frases naturales y variadas, sin exagerar ni sonar a folleto.',
      hashtagCore: ['#cabañaslacampiña', '#algarrobo'],
      hashtagBank: [
        '#descanso',
        '#naturaleza',
        '#litoralcentral',
        '#desconexion',
        '#escapada',
        '#findesemana',
        '#quincho',
        '#asadoenfamilia',
        '#vacacionesenfamilia',
        '#escapadadepareja',
        '#algarrobochile',
        '#turismochile',
        '#bosque'
      ]
    }
  },
  {
    id: 'kmarket',
    matchKeywords: ['kmarket', 'k-food', 'corea'],
    profile: {
      id: 'kmarket',
      name: 'Kmarket Algarrobo (@kmarket_algarrobo)',
      tag: 'Kmarket Algarrobo',
      emoji: '🍜',
      address: 'El Boldo 366, local 13, Espacio Algarrobo, Algarrobo, Chile',
      specialty: 'Alimentos y snacks coreanos e importados (K-Food): Ramyun (Buldak Carbonara, 4 Quesos, Shin Ramyun, Jin Ramen), Helados Samanco crujientes con crema, bebidas Milkis y Bon Bon con fruta, dulces virales Pepero, Choco Pie, Tteokbokki instantáneo.',
      rules: [
        'Ubicación física exacta: El Boldo 366, local 13, Espacio Algarrobo, Algarrobo.',
        'NO es carnicería ni vende carne de asados.',
        'Invitar a visitarnos en la tienda de Espacio Algarrobo o escribirnos por DM para coordinar productos.'
      ],
      voice: 'Escribe como el equipo de Kmarket Algarrobo: fanáticos del K-food que prueban todo lo que traen y lo recomiendan como a un amigo. Entusiastas pero sin exagerar, cuentan sabor, textura y cómo se come.',
      hashtagCore: ['#KmarketAlgarrobo', '#KFood'],
      hashtagBank: [
        '#SaboresDeAsia',
        '#AlgarroboMoments',
        '#Ramen',
        '#Ramyun',
        '#SnacksCoreanos',
        '#ComidaCoreana',
        '#KoreanFood',
        '#Algarrobo',
        '#Buldak',
        '#Matcha',
        '#DulcesCoreanos',
        '#Kdrama',
        '#LitoralCentral'
      ]
    }
  }
];
