export type FaceShape =
  | 'Ovalado'
  | 'Cuadrado'
  | 'Redondo'
  | 'Diamante'
  | 'Alargado'
  | 'Triangular';

export type LeverPosition = 'cerrada' | 'intermedia' | 'abierta';

export interface ARZoneSpec {
  id: 'zone0' | 'zone05' | 'zone1' | 'zone15' | 'zone2';
  label: string;
  guard: string;
  leverSummary: string;
  color: string;
  fillRgba: string;
  anatomicalRef: string;
  /** Relative vertical band height from temple/ear base (0 = bottom hairline/ear, 1 = crown/horseshoe) */
  yStartRatio: number;
  yEndRatio: number;
}

export interface HaircutStep {
  stepNumber: number;
  title: string;
  guard: string;
  lever: LeverPosition;
  leverPercent: 0 | 50 | 100;
  motion: string;
  zoneId: ARZoneSpec['id'];
  targetView: 'front' | 'left' | 'right' | 'back';
  anatomicalGuide: string;
  instruction: string;
  proTip: string;
}

export interface SimulatorVisualProfile {
  topVolumeHeight: number; // 0.12 (Buzz) a 0.55 (Quiff/Pompadour)
  fringeDrop: number; // caída sobre la frente: -0.05 (frente despejada) a +0.18 (Crop con flequillo)
  sideFadeDarkness: number; // 0.25 (High Skin Fade) a 0.75 (Low Taper)
  sidePart: boolean; // raya lateral marcada a navaja
  mulletTails: boolean; // extensión trasera para Burst Fade / Mullet
  textureType: 'crop' | 'quiff' | 'taper-natural' | 'buzz' | 'mullet' | 'pompadour';
}

export interface HaircutStyle {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado';
  durationMin: number;
  idealFaces: FaceShape[];
  avoidFaces: FaceShape[];
  visagismWhy: string;
  fadeType: 'mid-drop' | 'low-fade' | 'high-fade' | 'low-taper' | 'burst-fade' | 'crop-fade';
  /** Curve offset in front/back (0 = straight, >0 = drop behind ear/occipital) */
  dropAmount: number;
  startHeightRatio: number; // 0.15 = low, 0.35 = mid, 0.55 = high
  beardRecommendation: string;
  simulatorProfile: SimulatorVisualProfile;
  zones: ARZoneSpec[];
  steps: HaircutStep[];
}

export const FACE_SHAPE_INFO: Record<
  FaceShape,
  {
    summary: string;
    geometryRule: string;
    goal: string;
    beardAdvice: string;
  }
> = {
  Ovalado: {
    summary: 'Proporciones equilibradas: el largo del rostro es ~1.4x el ancho de pómulos, con frente y mandíbula armónicas.',
    geometryRule: 'Largo/Ancho ≈ 1.35–1.50 | Mandíbula suave',
    goal: 'Mantener la simetría natural sin alargar en exceso la coronilla ni cubrir la frente.',
    beardAdvice: 'Barba corta de 3–5 mm (Stubble) o perfilado limpio en mejillas.',
  },
  Cuadrado: {
    summary: 'Mandíbula marcada y angulosa con ancho casi idéntico entre frente, pómulos y quijada.',
    geometryRule: 'Frente ≈ Pómulos ≈ Mandíbula | Ángulo goníaco firme',
    goal: 'Aprovechar las facciones masculinas con degradados limpios en laterales y textura suave arriba.',
    beardAdvice: 'Desvanecer las patillas hacia la barba y redondear ligeramente el mentón.',
  },
  Redondo: {
    summary: 'Largo y ancho facial similares con pómulos amplios y línea mandibular curva sin ángulos duros.',
    geometryRule: 'Largo/Ancho < 1.32 | Pómulos > Mandíbula curva',
    goal: 'Crear verticalidad visual: laterales bien cortos (Mid/High Fade) y volumen o estructura angular arriba.',
    beardAdvice: 'Barba en candado o perfilado en "V" hacia el mentón para estilizar y alargar la cara.',
  },
  Diamante: {
    summary: 'Pómulos prominentes y anchos, mientras que la frente (sienes) y la barbilla son más estrechas.',
    geometryRule: 'Pómulos > Frente y Mandíbula',
    goal: 'No vaciar demasiado la zona parietal/sienes (usar Low Fade o Taper) y dejar textura frontal que ensanche la frente.',
    beardAdvice: 'Barba ligeramente más densa en los laterales de la quijada para equilibrar el mentón.',
  },
  Alargado: {
    summary: 'Rostro estilizado donde la longitud vertical supera claramente el ancho de pómulos.',
    geometryRule: 'Largo/Ancho > 1.52 | Frente y mentón largos',
    goal: 'Evitar subir mucho la #0 en los lados ni dejar tupés altos; preferir Low Taper o flequillo (Crop) que acorte la frente.',
    beardAdvice: 'Barba corta en el mentón y más rellena en los lados para dar anchura horizontal.',
  },
  Triangular: {
    summary: 'Mandíbula más ancha que las sienes o frente amplia con mentón fino (Corazón/Triángulo).',
    geometryRule: 'Diferencia marcada entre ancho frontal y mandibular',
    goal: 'Equilibrar el tercio superior e inferior mediante un desvanecido progresivo en sienes y volumen controlado en coronilla.',
    beardAdvice: 'Barba sombreada que armonice la transición entre pómulo y mentón.',
  },
};

export const HAIRCUT_CATALOG: HaircutStyle[] = [
  {
    id: 'mid-drop-fade-crop',
    name: 'Mid Drop Fade + Textured Crop',
    subtitle: 'Degradado medio con caída curva detrás de la oreja y textura superior',
    difficulty: 'Principiante',
    durationMin: 35,
    idealFaces: ['Ovalado', 'Redondo', 'Alargado', 'Cuadrado'],
    avoidFaces: [],
    visagismWhy:
      'La curva "Drop" sigue la anatomía del hueso occipital evitando trasquilar la coronilla, mientras que el frente texturizado equilibra la frente y estiliza los pómulos.',
    fadeType: 'mid-drop',
    dropAmount: 0.25,
    startHeightRatio: 0.35,
    beardRecommendation: 'Taper en patilla con conexión en #1 hacia barba perfilada a navaja.',
    simulatorProfile: {
      topVolumeHeight: 0.30,
      fringeDrop: 0.16,
      sideFadeDarkness: 0.45,
      sidePart: false,
      mulletTails: false,
      textureType: 'crop',
    },
    zones: [
      {
        id: 'zone0',
        label: 'Zona 0 — Base Piel / Trimmer',
        guard: '#0 / Trimmer / Shaver',
        leverSummary: 'Palanca Cerrada (0%)',
        color: '#ef4444',
        fillRgba: 'rgba(239, 68, 68, 0.24)',
        anatomicalRef: 'Desde mitad del arco de la ceja cayendo 1 dedo bajo el hueso occipital',
        yStartRatio: 0.0,
        yEndRatio: 0.24,
      },
      {
        id: 'zone05',
        label: 'Zona 1 — Primera Transición',
        guard: 'Sin peine (#0 Abierta) + Peine #0.5 (1.5 mm)',
        leverSummary: 'Abierta (100%) → Intermedia (50%) → Cerrada (0%)',
        color: '#f97316',
        fillRgba: 'rgba(249, 115, 22, 0.24)',
        anatomicalRef: 'Franja de 1 cm (ancho de 1 dedo) siguiendo la misma curva Drop',
        yStartRatio: 0.24,
        yEndRatio: 0.45,
      },
      {
        id: 'zone1',
        label: 'Zona 2 — Degradado Medio',
        guard: 'Peine #1 (3 mm) y #1.5 (4.5 mm)',
        leverSummary: 'Palanca Abierta → Cerrada con cuchareo',
        color: '#eab308',
        fillRgba: 'rgba(234, 179, 8, 0.24)',
        anatomicalRef: 'Desde la sien hasta la zona media sobre el hueso occipital',
        yStartRatio: 0.45,
        yEndRatio: 0.72,
      },
      {
        id: 'zone2',
        label: 'Zona 3 — Herradura / Cresta Parietal',
        guard: 'Peine #2 (6 mm) + Tijera sobre peine',
        leverSummary: 'Palanca Abierta (100%) en salida vertical',
        color: '#22c55e',
        fillRgba: 'rgba(34, 197, 94, 0.22)',
        anatomicalRef: 'Sección de herradura (parietales) y protección de remolino en coronilla',
        yStartRatio: 0.72,
        yEndRatio: 1.0,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Desbastar base general y proteger herradura',
        guard: 'Peine #2 (6 mm)',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Recto ascendente (salir recto en parietales)',
        zoneId: 'zone2',
        targetView: 'left',
        anatomicalGuide: 'Hasta la línea de la herradura (cresta parietal), sin meter la máquina hacia adentro',
        instruction:
          'Pasa el peine #2 con palanca abierta por los laterales y la nuca hasta la línea verde de la herradura para limpiar el volumen e identificar remolinos.',
        proTip: 'Al llegar a la sien y cresta parietal, saca la máquina recta hacia arriba (como un avión despegando) para no hundir el cráneo.',
      },
      {
        stepNumber: 2,
        title: 'Marcar Primera Línea Guía (Curva Drop)',
        guard: '#0 / Trimmer',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Trazo firme y simétrico',
        zoneId: 'zone0',
        targetView: 'left',
        anatomicalGuide: 'Inicia a la altura de la ceja, arquea sobre la oreja y cae 1 dedo debajo del hueso occipital',
        instruction:
          'Con la máquina en #0 palanca cerrada (o trimmer), marca la línea roja guía. Verifica de frente en el espejo o con la cámara que ambos lados inicien a la misma altura respecto a las cejas.',
        proTip: 'Deja siempre 1 dedo de margen antes de pasar shaver para no subir el corte por accidente.',
      },
      {
        stepNumber: 3,
        title: 'Crear primera franja de 1 cm (#0 Abierta)',
        guard: 'Sin peine (#0)',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Cuchareo (Flick-out) corto',
        zoneId: 'zone05',
        targetView: 'left',
        anatomicalGuide: '1 dedo (1 cm) por encima de la línea base roja manteniendo la caída Drop',
        instruction:
          'Abre la palanca al 100% sin peine y sube exactamente 1 centímetro (franja naranja). Luego pon la palanca a la mitad (50%) y ve cerrándola poco a poco tocando solo la línea inferior hasta borrarla.',
        proTip: 'Usa solo las 3 o 4 cuchillas de la esquina de la máquina cuando borres la línea detrás de la oreja.',
      },
      {
        stepNumber: 4,
        title: 'Conectar zona media con Peine #1 y #0.5',
        guard: 'Peine #1 (3 mm) → #0.5 (1.5 mm)',
        lever: 'intermedia',
        leverPercent: 50,
        motion: 'Cuchareo ascendente suave',
        zoneId: 'zone1',
        targetView: 'right',
        anatomicalGuide: 'Franja amarilla entre la sien y la curva media del occipital',
        instruction:
          'Pasa el peine #1 palanca abierta subiendo 1.5 cm. Luego coloca el peine #0.5 con palanca a la mitad y pásalo justo en la unión entre la zona naranja y amarilla hasta que desaparezca el escalón.',
        proTip: 'Cepilla hacia abajo con el cepillo fade (fade brush) después de cada pasada para ver las sombras reales.',
      },
      {
        stepNumber: 5,
        title: 'Pulir línea de peso parietal (#1.5) y Coronilla',
        guard: 'Peine #1.5 (4.5 mm)',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Salida vertical sin presionar el cráneo',
        zoneId: 'zone2',
        targetView: 'back',
        anatomicalGuide: 'Unión entre zona amarilla y verde + zona del remolino en coronilla',
        instruction:
          'Con el peine #1.5 (abierto y luego cerrado), conecta hacia la zona #2 de la herradura. En la nuca alta y coronilla respeta la dirección del remolino para no dejar huecos claros.',
        proTip: 'Nunca pases menos de #2 en contra del remolino de la coronilla; si el cabello se para, rebájalo con tijera de entresacar.',
      },
    ],
  },
  {
    id: 'low-taper-classic',
    name: 'Low Taper Fade + Volumen Natural',
    subtitle: 'Desvanecido limpio solo en patillas y nuca baja, conservando estructura lateral',
    difficulty: 'Principiante',
    durationMin: 25,
    idealFaces: ['Diamante', 'Alargado', 'Triangular', 'Ovalado'],
    avoidFaces: [],
    visagismWhy:
      'Conserva densidad en las sienes y parietales (clave para rostros Diamante o Alargados) mientras da un acabado ultra limpio alrededor de la oreja y el cuello.',
    fadeType: 'low-taper',
    dropAmount: 0.15,
    startHeightRatio: 0.18,
    beardRecommendation: 'Doble desvanecido en patilla: hacia arriba para la sien y hacia abajo para conectar con la barba.',
    simulatorProfile: {
      topVolumeHeight: 0.36,
      fringeDrop: 0.05,
      sideFadeDarkness: 0.72,
      sidePart: false,
      mulletTails: false,
      textureType: 'taper-natural',
    },
    zones: [
      {
        id: 'zone0',
        label: 'Zona 0 — Arco de Patilla y Nuca Baja',
        guard: '#0 / Trimmer',
        leverSummary: 'Palanca Cerrada (0%)',
        color: '#ef4444',
        fillRgba: 'rgba(239, 68, 68, 0.24)',
        anatomicalRef: 'Mitad inferior de la patilla y 2 dedos sobre el nacimiento del cuello',
        yStartRatio: 0.0,
        yEndRatio: 0.18,
      },
      {
        id: 'zone05',
        label: 'Zona 1 — Micro-transición Taper',
        guard: '#0 Abierta + Peine #0.5 (1.5 mm)',
        leverSummary: 'Intermedia (50%) → Cerrada (0%)',
        color: '#f97316',
        fillRgba: 'rgba(249, 115, 22, 0.24)',
        anatomicalRef: 'Medio dedo arriba del lóbulo de la oreja y curva baja en nuca',
        yStartRatio: 0.18,
        yEndRatio: 0.34,
      },
      {
        id: 'zone1',
        label: 'Zona 2 — Sombra de Sien (#1 a #1.5)',
        guard: 'Peine #1 (3 mm) y #1.5 (4.5 mm)',
        leverSummary: 'Palanca Abierta (100%)',
        color: '#eab308',
        fillRgba: 'rgba(234, 179, 8, 0.24)',
        anatomicalRef: 'Hasta la altura del arco de la ceja en sien y bajo el hueso occipital en nuca',
        yStartRatio: 0.34,
        yEndRatio: 0.56,
      },
      {
        id: 'zone2',
        label: 'Zona 3 — Laterales Clásicos (#2 a #3 / Tijera)',
        guard: 'Peine #2 (6 mm) o #3 (10 mm)',
        leverSummary: 'Palanca Cerrada + Máquina sobre peine',
        color: '#22c55e',
        fillRgba: 'rgba(34, 197, 94, 0.22)',
        anatomicalRef: 'Todo el contorno lateral alrededor de la oreja y conexión superior',
        yStartRatio: 0.56,
        yEndRatio: 1.0,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Limpiar laterales con #2 o #3',
        guard: 'Peine #2 (6 mm) o #3 (10 mm)',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Recto hacia arriba hasta cresta parietal',
        zoneId: 'zone2',
        targetView: 'left',
        anatomicalGuide: 'Laterales completos dejando el contorno de la oreja intacto',
        instruction:
          'Unifica los laterales con peine #2 o #3 cerrado. Esto crea una base oscura perfecta para que el Taper resalte en la patilla y la nuca.',
        proTip: 'Peina el cabello hacia abajo antes de pasar la máquina para asegurar un corte uniforme.',
      },
      {
        stepNumber: 2,
        title: 'Marcar semicírculo en patilla y línea en nuca baja',
        guard: 'Trimmer / #0',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Trazo en arco corto',
        zoneId: 'zone0',
        targetView: 'left',
        anatomicalGuide: 'Desde el trago de la oreja hacia el pómulo en la patilla',
        instruction:
          'Marca un pequeño arco con #0 en la base de la patilla (zona roja) y una línea curva en la nuca baja a la altura del lóbulo de la oreja.',
        proTip: 'En un Taper el degradado es comprimido: cada escalón debe medir apenas medio dedo (0.5 cm).',
      },
      {
        stepNumber: 3,
        title: 'Desvanecer patilla con #0 Abierta y #0.5',
        guard: '#0 Abierta → Peine #0.5',
        lever: 'intermedia',
        leverPercent: 50,
        motion: 'Cuchareo con esquina de cuchilla',
        zoneId: 'zone05',
        targetView: 'left',
        anatomicalGuide: 'Franja naranja de 0.5 cm sobre la patilla',
        instruction:
          'Sube medio dedo con #0 abierta y borra la línea inicial cerrando gradualmente la palanca. Luego suaviza el borde superior con el peine #0.5.',
        proTip: 'Inclina la máquina 45 grados para usar solo 3 dientes de la cuchilla en el espacio reducido de la patilla.',
      },
      {
        stepNumber: 4,
        title: 'Conectar con #1 y #1.5 + Marcar cerquillo (C-Cup)',
        guard: 'Peine #1 y #1.5 + Trimmer',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Cuchareo + Marcado de arco frontal',
        zoneId: 'zone1',
        targetView: 'front',
        anatomicalGuide: 'Curva C entre la cola de la ceja y la sien',
        instruction:
          'Conecta la sombra hacia el #2 usando los peines #1 y #1.5. Finalmente, con el trimmer marca la curva "C" de la sien y el contorno detrás de la oreja sin meterte de más.',
        proTip: 'Al marcar el arco de la sien, toca apenas las puntas para mantener el grosor natural del crecimiento.',
      },
    ],
  },
  {
    id: 'high-skin-fade-quiff',
    name: 'High Skin Fade + Quiff Estructurado',
    subtitle: 'Degradado alto a piel que estiliza rostros redondos o cuadrados con volumen frontal',
    difficulty: 'Intermedio',
    durationMin: 40,
    idealFaces: ['Redondo', 'Cuadrado', 'Ovalado'],
    avoidFaces: ['Alargado', 'Diamante'],
    visagismWhy:
      'Al reducir al máximo el volumen lateral y elevar la transición hacia las sienes, alarga visualmente el rostro redondo y resalta la mandíbula.',
    fadeType: 'high-fade',
    dropAmount: 0.12,
    startHeightRatio: 0.52,
    beardRecommendation: 'Desvanecido inverso en patilla con perfilado recto en mejilla para crear ángulos definidos.',
    simulatorProfile: {
      topVolumeHeight: 0.52,
      fringeDrop: -0.02,
      sideFadeDarkness: 0.28,
      sidePart: false,
      mulletTails: false,
      textureType: 'quiff',
    },
    zones: [
      {
        id: 'zone0',
        label: 'Zona 0 — Piel Alta / Shaver',
        guard: '#0 / Shaver',
        leverSummary: 'Palanca Cerrada (0%)',
        color: '#ef4444',
        fillRgba: 'rgba(239, 68, 68, 0.24)',
        anatomicalRef: '1 dedo por encima de la ceja bajando justo sobre el hueso occipital',
        yStartRatio: 0.0,
        yEndRatio: 0.42,
      },
      {
        id: 'zone05',
        label: 'Zona 1 — Transición Comprimida',
        guard: '#0 Abierta + Peine #0.5',
        leverSummary: 'Abierta → Cerrada',
        color: '#f97316',
        fillRgba: 'rgba(249, 115, 22, 0.24)',
        anatomicalRef: 'Banda de 1 cm en la sien alta',
        yStartRatio: 0.42,
        yEndRatio: 0.62,
      },
      {
        id: 'zone1',
        label: 'Zona 2 — Sombra Parietal (#1 a #1.5)',
        guard: 'Peine #1 y #1.5',
        leverSummary: 'Palanca Intermedia a Cerrada',
        color: '#eab308',
        fillRgba: 'rgba(234, 179, 8, 0.24)',
        anatomicalRef: 'Justo debajo de la herradura parietal',
        yStartRatio: 0.62,
        yEndRatio: 0.80,
      },
      {
        id: 'zone2',
        label: 'Zona 3 — Desconexión Suave (#2 + Tijera)',
        guard: 'Peine #2 + Tijera de esculpir',
        leverSummary: 'Salida vertical a 90°',
        color: '#22c55e',
        fillRgba: 'rgba(34, 197, 94, 0.22)',
        anatomicalRef: 'Corona y conexión con el Quiff frontal',
        yStartRatio: 0.80,
        yEndRatio: 1.0,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Marcar línea guía alta desde la sien',
        guard: '#0 / Trimmer',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Línea continua con ligera caída trasera',
        zoneId: 'zone0',
        targetView: 'left',
        anatomicalGuide: 'Inicia en el recodo de la entrada/sien alta y cruza justo sobre el hueso occipital',
        instruction:
          'Traza la guía #0 en la zona roja alta. Limpia todo el cabello debajo de esa línea y pasa la rasuradora (shaver) solo en los dos tercios inferiores.',
        proTip: 'No llegues con el shaver hasta la mera línea del trimmer o crearás una raya muy difícil de borrar.',
      },
      {
        stepNumber: 2,
        title: 'Abrir banda de transición con #0 Abierta y #0.5',
        guard: '#0 Abierta → Peine #0.5',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Cuchareo corto de 1 cm',
        zoneId: 'zone05',
        targetView: 'left',
        anatomicalGuide: 'Franja naranja en sien alta',
        instruction:
          'Sube 1 cm con #0 abierta y difumina la línea jugando con la palanca en 50% y 0%. Refuerza el borde superior con #0.5 cerrado.',
        proTip: 'Como ya estás cerca de la curva del cráneo (parietal), no presiones la cuchilla contra la piel.',
      },
      {
        stepNumber: 3,
        title: 'Conectar hacia la herradura con #1 y #1.5',
        guard: 'Peine #1 y #1.5',
        lever: 'intermedia',
        leverPercent: 50,
        motion: 'Salida recta vertical',
        zoneId: 'zone1',
        targetView: 'right',
        anatomicalGuide: 'Franja amarilla de la cresta parietal',
        instruction:
          'Pasa el #1.5 abierto saliendo completamente vertical y luego el #1 intermedio para borrar la frontera con la zona naranja.',
        proTip: 'Mira al cliente de frente para comprobar que ambas paredes laterales suban rectas y no redondeadas.',
      },
      {
        stepNumber: 4,
        title: 'Pulir coronilla y texturizar el Quiff superior',
        guard: 'Peine #2 + Tijera sobre peine',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Máquina/tijera sobre peine en ángulo de 90°',
        zoneId: 'zone2',
        targetView: 'front',
        anatomicalGuide: 'Zona verde de herradura y flequillo frontal elevado',
        instruction:
          'Conecta los últimos milímetros con peine #2 abierto o tijera sobre peine, dejando mayor longitud en el frontal (Quiff) y más corto hacia la coronilla.',
        proTip: 'Corta de atrás hacia adelante en la parte superior aumentando 0.5 cm de largo en cada sección hasta el flequillo.',
      },
    ],
  },
  {
    id: 'buzz-cut-lineup',
    name: 'Buzz Cut + Mid Fade & Cerquillo Angular',
    subtitle: 'Corte uniforme al #3 o #4 arriba con degradado medio limpio y frente a navaja',
    difficulty: 'Principiante',
    durationMin: 25,
    idealFaces: ['Cuadrado', 'Ovalado', 'Diamante'],
    avoidFaces: ['Redondo'],
    visagismWhy:
      'Resalta la estructura ósea mandibular y las sienes limpias mediante un cerquillo frontal geométrico y una silueta craneal compacta.',
    fadeType: 'crop-fade',
    dropAmount: 0.16,
    startHeightRatio: 0.36,
    beardRecommendation: 'Barba corta de 3 mm conectada con degradado medio desde el trago de la oreja.',
    simulatorProfile: {
      topVolumeHeight: 0.16,
      fringeDrop: 0.02,
      sideFadeDarkness: 0.35,
      sidePart: false,
      mulletTails: false,
      textureType: 'buzz',
    },
    zones: [
      {
        id: 'zone0',
        label: 'Zona 0 — Base Piel / Shaver',
        guard: '#0 / Trimmer / Shaver',
        leverSummary: 'Palanca Cerrada (0%)',
        color: '#ef4444',
        fillRgba: 'rgba(239, 68, 68, 0.24)',
        anatomicalRef: 'Mitad de la sien hacia el hueso occipital',
        yStartRatio: 0.0,
        yEndRatio: 0.26,
      },
      {
        id: 'zone05',
        label: 'Zona 1 — Primera Transición',
        guard: '#0 Abierta + Peine #0.5',
        leverSummary: 'Abierta (100%) → Cerrada (0%)',
        color: '#f97316',
        fillRgba: 'rgba(249, 115, 22, 0.24)',
        anatomicalRef: 'Franja de 1 cm paralela a la línea guía',
        yStartRatio: 0.26,
        yEndRatio: 0.48,
      },
      {
        id: 'zone1',
        label: 'Zona 2 — Conexión Media (#1 y #1.5)',
        guard: 'Peine #1 (3 mm) y #1.5 (4.5 mm)',
        leverSummary: 'Intermedia (50%) → Cerrada (0%)',
        color: '#eab308',
        fillRgba: 'rgba(234, 179, 8, 0.24)',
        anatomicalRef: 'Hasta 1 dedo debajo de la cresta parietal',
        yStartRatio: 0.48,
        yEndRatio: 0.75,
      },
      {
        id: 'zone2',
        label: 'Zona 3 — Corona Uniforme (#3 o #4)',
        guard: 'Peine #3 (10 mm) o #4 (13 mm)',
        leverSummary: 'Palanca Cerrada en dirección del crecimiento',
        color: '#22c55e',
        fillRgba: 'rgba(34, 197, 94, 0.22)',
        anatomicalRef: 'Parte superior completa y conexión con peine #2 en parietales',
        yStartRatio: 0.75,
        yEndRatio: 1.0,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Pasar peine #3 o #4 en toda la parte superior',
        guard: 'Peine #3 (10 mm) o #4 (13 mm)',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Pasadas uniformes siguiendo el remolino',
        zoneId: 'zone2',
        targetView: 'front',
        anatomicalGuide: 'Toda la bóveda superior hasta la herradura parietal',
        instruction:
          'Pasa la máquina en #3 o #4 cerrado de frente hacia la coronilla en varias direcciones sin apretar de más sobre protuberancias.',
        proTip: 'Si hay remolino fuerte en la coronilla, pasa #4 en esa zona o peina a favor del nacimiento.',
      },
      {
        stepNumber: 2,
        title: 'Marcar línea guía media (#0)',
        guard: '#0 / Trimmer',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Línea limpia nivelada con las cejas',
        zoneId: 'zone0',
        targetView: 'left',
        anatomicalGuide: 'Sien media rodeando la oreja hasta el occipital',
        instruction:
          'Marca la zona roja guía con #0 cerrada y limpia por debajo dejando margen para el shaver.',
        proTip: 'Revisa de frente en espejo o cámara que las dos sienes queden a la misma altura.',
      },
      {
        stepNumber: 3,
        title: 'Degradar franja de transición (#0 Abierta → #1.5)',
        guard: '#0.5, #1 y #1.5',
        lever: 'intermedia',
        leverPercent: 50,
        motion: 'Cuchareo ascendente hasta herradura',
        zoneId: 'zone1',
        targetView: 'right',
        anatomicalGuide: 'Zonas naranja y amarilla conectando con el #2 y #3 superior',
        instruction:
          'Abre el fade con #0 abierta (1 cm), borra con #0.5 a mitad y conecta hacia arriba con #1 y #1.5 hasta fundir con la corona.',
        proTip: 'Usa peine #2 abierto justo en la herradura para que el salto del #1.5 al #3 quede invisible.',
      },
      {
        stepNumber: 4,
        title: 'Perfilar cerquillo frontal y curvas C (Line-Up)',
        guard: 'Trimmer + Navaja',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Toques rectos desde el centro hacia las sienes',
        zoneId: 'zone05',
        targetView: 'front',
        anatomicalGuide: 'Línea frontal del cabello y arcos C de las sienes',
        instruction:
          'Empieza marcando el centro de la frente con la trimmer tocando solo las puntas y avanza simétricamente hacia ambos lados formando esquinas a 90°.',
        proTip: 'Aplica un poco de gel o talco y estira la piel antes de pasar la navaja para un contorno nítido sin irritar.',
      },
    ],
  },
  {
    id: 'burst-fade-mullet',
    name: 'Burst Fade + Modern Mullet Texturizado',
    subtitle: 'Desvanecido radial semicircular alrededor de la oreja conservando largo en la nuca',
    difficulty: 'Avanzado',
    durationMin: 45,
    idealFaces: ['Ovalado', 'Alargado', 'Triangular'],
    avoidFaces: ['Redondo'],
    visagismWhy:
      'Despeja las sienes y rodea la oreja en forma de abanico, manteniendo volumen en la nuca que equilibra rostros alargados o triangulares.',
    fadeType: 'burst-fade',
    dropAmount: 0.32,
    startHeightRatio: 0.30,
    beardRecommendation: 'Patilla desvanecida en punta conectada hacia barba sombreada ligera.',
    simulatorProfile: {
      topVolumeHeight: 0.42,
      fringeDrop: 0.10,
      sideFadeDarkness: 0.40,
      sidePart: false,
      mulletTails: true,
      textureType: 'mullet',
    },
    zones: [
      {
        id: 'zone0',
        label: 'Zona 0 — Semicírculo Base Oreja',
        guard: '#0 / Trimmer',
        leverSummary: 'Palanca Cerrada (0%)',
        color: '#ef4444',
        fillRgba: 'rgba(239, 68, 68, 0.24)',
        anatomicalRef: 'Arco cerrado alrededor del contorno de la oreja',
        yStartRatio: 0.0,
        yEndRatio: 0.22,
      },
      {
        id: 'zone05',
        label: 'Zona 1 — Abanico Medio (#0.5)',
        guard: '#0 Abierta + Peine #0.5',
        leverSummary: 'Abierta → Intermedia (50%)',
        color: '#f97316',
        fillRgba: 'rgba(249, 115, 22, 0.24)',
        anatomicalRef: 'Segundo arco concéntrico de 1.5 cm sobre y detrás de la oreja',
        yStartRatio: 0.22,
        yEndRatio: 0.44,
      },
      {
        id: 'zone1',
        label: 'Zona 2 — Expansión Burst (#1 y #1.5)',
        guard: 'Peine #1 y #1.5',
        leverSummary: 'Cuchareo radial hacia nuca y sien',
        color: '#eab308',
        fillRgba: 'rgba(234, 179, 8, 0.24)',
        anatomicalRef: 'Difuminado radial que respeta la masa trasera del mullet',
        yStartRatio: 0.44,
        yEndRatio: 0.72,
      },
      {
        id: 'zone2',
        label: 'Zona 3 — Cresta + Caída de Nuca (#2 / Tijera)',
        guard: 'Peine #2 + Tijera dentada / Texturizado',
        leverSummary: 'Conexión suave sin invadir la nuca',
        color: '#22c55e',
        fillRgba: 'rgba(34, 197, 94, 0.22)',
        anatomicalRef: 'Parietales superiores y extensión trasera en V o cuadrada',
        yStartRatio: 0.72,
        yEndRatio: 1.0,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Separar la nuca y marcar el arco radial #0',
        guard: '#0 / Trimmer',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Semicírculo perfecto alrededor de la oreja',
        zoneId: 'zone0',
        targetView: 'left',
        anatomicalGuide: 'Desde el arco de la patilla rodeando detrás de la oreja sin irse a la nuca',
        instruction:
          'Sujeta con pinza el cabello de la coronilla/nuca y dibuja un semicírculo limpio alrededor de la oreja con la máquina en #0 cerrada.',
        proTip: 'No continúes la línea hacia el hueso occipital; el Burst Fade muere detrás de la oreja para conservar el largo del mullet.',
      },
      {
        stepNumber: 2,
        title: 'Expandir abanico con #0 Abierta y #0.5',
        guard: '#0 Abierta → #0.5',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Cuchareo radial en forma de sol',
        zoneId: 'zone05',
        targetView: 'left',
        anatomicalGuide: 'Segundo semicírculo de 1.5 cm concéntrico al primero',
        instruction:
          'Abre el abanico 1.5 cm alrededor del arco rojo con #0 abierta y borra la línea base cerrando la palanca progresivamente.',
        proTip: 'Trabaja en ángulos radiales (como rayos de rueda) para que el degradado siga la curva circular.',
      },
      {
        stepNumber: 3,
        title: 'Conectar hacia sienes y masa trasera (#1 y #1.5)',
        guard: 'Peine #1 y #1.5',
        lever: 'intermedia',
        leverPercent: 50,
        motion: 'Salida aérea hacia la nuca y parietal',
        zoneId: 'zone1',
        targetView: 'right',
        anatomicalGuide: 'Zona amarilla entre la sien, parietal y nuca lateral',
        instruction:
          'Conecta con #1 y #1.5 saliendo hacia afuera antes de tocar el cabello largo de la nuca; repite de forma simétrica en el perfil derecho.',
        proTip: 'Usa solo la esquina de la cuchilla en la transición hacia la parte trasera para no crear un escalón marcado.',
      },
      {
        stepNumber: 4,
        title: 'Texturizar coronilla y definir caída trasera',
        guard: 'Tijera de entresacar + Point Cut',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Corte en punta (Point Cut)',
        zoneId: 'zone2',
        targetView: 'back',
        anatomicalGuide: 'Coronilla superior, flequillo y puntas de la nuca',
        instruction:
          'Conecta la zona verde con tijera sobre peine y realiza cortes en punta (Point Cut) arriba y en la nuca para dar movimiento moderno sin peso excesivo.',
        proTip: 'Limpia únicamente las puntas sobresalientes en la base del cuello para mantener un mullet orgánico.',
      },
    ],
  },
  {
    id: 'executive-pompadour',
    name: 'Side Part Pompadour + Mid Taper',
    subtitle: 'Estilo clásico ejecutivo con raya lateral definida, volumen frontal y laterales pulidos',
    difficulty: 'Intermedio',
    durationMin: 40,
    idealFaces: ['Redondo', 'Cuadrado', 'Ovalado'],
    avoidFaces: ['Alargado'],
    visagismWhy:
      'La altura del Pompadour estiliza rostros redondos o cuadrados aportando elegancia, mientras que la raya lateral ordena la asimetría natural.',
    fadeType: 'low-fade',
    dropAmount: 0.14,
    startHeightRatio: 0.28,
    beardRecommendation: 'Barba media perfilada con transición limpia desde patilla en #1.5.',
    simulatorProfile: {
      topVolumeHeight: 0.50,
      fringeDrop: -0.04,
      sideFadeDarkness: 0.60,
      sidePart: true,
      mulletTails: false,
      textureType: 'pompadour',
    },
    zones: [
      {
        id: 'zone0',
        label: 'Zona 0 — Base Taper / Patilla y Cuello',
        guard: '#0 / Trimmer',
        leverSummary: 'Palanca Cerrada (0%)',
        color: '#ef4444',
        fillRgba: 'rgba(239, 68, 68, 0.24)',
        anatomicalRef: 'Patilla baja y contorno inferior de nuca',
        yStartRatio: 0.0,
        yEndRatio: 0.20,
      },
      {
        id: 'zone05',
        label: 'Zona 1 — Transición Baja (#0.5)',
        guard: '#0 Abierta + Peine #0.5',
        leverSummary: 'Intermedia (50%) → Cerrada (0%)',
        color: '#f97316',
        fillRgba: 'rgba(249, 115, 22, 0.24)',
        anatomicalRef: 'Alrededor de la patilla y parte baja detrás de la oreja',
        yStartRatio: 0.20,
        yEndRatio: 0.38,
      },
      {
        id: 'zone1',
        label: 'Zona 2 — Estructura Lateral (#1.5 y #2)',
        guard: 'Peine #1.5 (4.5 mm) y #2 (6 mm)',
        leverSummary: 'Salida vertical conservando densidad',
        color: '#eab308',
        fillRgba: 'rgba(234, 179, 8, 0.24)',
        anatomicalRef: 'Paredes laterales rectas hacia la raya lateral',
        yStartRatio: 0.38,
        yEndRatio: 0.68,
      },
      {
        id: 'zone2',
        label: 'Zona 3 — Raya Lateral y Volumen Superior',
        guard: 'Peine #3 + Tijera y Navaja',
        leverSummary: 'Conexión parietal + marcado de raya',
        color: '#22c55e',
        fillRgba: 'rgba(34, 197, 94, 0.22)',
        anatomicalRef: 'Receso temporal izquierdo/derecho hacia coronilla',
        yStartRatio: 0.68,
        yEndRatio: 1.0,
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Definir partición natural y paredes laterales (#2/#3)',
        guard: 'Peine #2 (6 mm) o #3 (10 mm)',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Recto hacia arriba hasta la línea de la raya',
        zoneId: 'zone2',
        targetView: 'left',
        anatomicalGuide: 'Desde la sien hasta el receso parietal donde nace la raya lateral',
        instruction:
          'Peina el cabello superior hacia el lado contrario de la raya y limpia las paredes laterales con peine #2 o #3 saliendo recto.',
        proTip: 'Sigue la dirección del remolino en la coronilla para elegir en qué lado queda más natural la raya.',
      },
      {
        stepNumber: 2,
        title: 'Desvanecer patilla y nuca (Mid Taper)',
        guard: '#0 → #0.5 → #1',
        lever: 'intermedia',
        leverPercent: 50,
        motion: 'Cuchareo corto en patilla y cuello',
        zoneId: 'zone05',
        targetView: 'left',
        anatomicalGuide: 'Zonas roja y naranja en patilla y nacimiento de nuca',
        instruction:
          'Crea una base limpia en la patilla y nuca baja con #0 y fúndela gradualmente con #0.5 y #1 hacia la zona #1.5/#2 lateral.',
        proTip: 'Mantén la patilla estilizada y limpia sobre el contorno de la oreja para un acabado elegante.',
      },
      {
        stepNumber: 3,
        title: 'Marcar raya lateral (Side Part) con Trimmer y Navaja',
        guard: 'Trimmer + Navaja fina',
        lever: 'cerrada',
        leverPercent: 0,
        motion: 'Línea recta fina siguiendo la curvatura craneal',
        zoneId: 'zone1',
        targetView: 'front',
        anatomicalGuide: 'Alineada con el receso de la sien hacia atrás sin pasarse a la coronilla',
        instruction:
          'Peina bien la partición, marca la raya con una pasada firme pero ligera del trimmer (sin ensancharla) y afínala con navaja.',
        proTip: 'Nunca hagas la raya más ancha de 2 mm para que al crecer no se vea una franja despoblada.',
      },
      {
        stepNumber: 4,
        title: 'Conectar parte superior y elevar Pompadour frontal',
        guard: 'Tijera sobre peine + Secador',
        lever: 'abierta',
        leverPercent: 100,
        motion: 'Elevación frontal gradual de atrás hacia adelante',
        zoneId: 'zone2',
        targetView: 'front',
        anatomicalGuide: 'Desde la coronilla hacia el flequillo frontal',
        instruction:
          'Conecta el lado de la raya con tijera sobre peine y deja mayor longitud en el frente para peinar el volumen del Pompadour hacia arriba y atrás.',
        proTip: 'En el lado opuesto a la raya deja un poco más de longitud en el parietal para que el cabello envuelva bien la cabeza.',
      },
    ],
  },
];

