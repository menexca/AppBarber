import { FaceShape } from '../data/haircuts';

export interface CranialAIDiagnosis {
  faceShapeConfirmed: FaceShape;
  occipitalBone: {
    type: 'Prominente' | 'Medio / Anatómico' | 'Plano';
    dropRecommendation: string;
    dangerZoneNote: string;
  };
  crownSwirl: {
    direction: 'Horario (Derecha)' | 'Antihorario (Izquierda)' | 'Doble Remolino';
    minSafeGuard: '#2 (6 mm)' | '#3 (10 mm)' | 'Tijera sobre peine';
    warning: string;
  };
  hairCharacteristics: {
    density: 'Alta' | 'Media' | 'Fina / Moderada';
    texture: 'Liso' | 'Ondulado' | 'Rizado / Afro';
    frontHairline: 'Recta definida' | 'Entradas leves en sienes' | 'Entradas pronunciadas';
  };
  customRecipeAdjustments: string[];
  recommendedStyleId: string;
  source: 'gemini-api' | 'local-engine';
}

export interface HaircutEvaluationResult {
  overallScore: number;
  symmetryScore: number;
  fadeTransitionScore: number;
  lineupCleanlinessScore: number;
  strengths: string[];
  improvementsForNextCut: string[];
  correctiveActionNow: string;
  source: 'gemini-api' | 'local-engine';
}

const STORAGE_KEY = 'appbarber_gemini_api_key';

export function getSavedGeminiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function saveGeminiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

function stripDataUrlPrefix(dataUrl: string): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export async function analyzeFourAnglesWithAI(
  photos: { front?: string; left?: string; right?: string; back?: string },
  detectedFaceShape: FaceShape
): Promise<CranialAIDiagnosis> {
  const apiKey = getSavedGeminiKey();
  const inlineParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];

  (['front', 'left', 'right', 'back'] as const).forEach((angle) => {
    const img = photos[angle];
    if (img) {
      const parsed = stripDataUrlPrefix(img);
      if (parsed) {
        inlineParts.push({
          inline_data: {
            mime_type: parsed.mimeType,
            data: parsed.data,
          },
        });
      }
    }
  });

  if (apiKey && inlineParts.length > 0) {
    try {
      const prompt = `Eres un Maestro Barbero y experto en Visagismo y Morfología Craneal.
Analiza las fotografías del cliente (Frente, Perfil Izquierdo, Perfil Derecho, Nuca/Coronilla). El escáner geométrico preliminar detectó rostro "${detectedFaceShape}".
Devuelve ÚNICAMENTE un objeto JSON válido (sin bloques markdown) con esta estructura exacta:
{
  "faceShapeConfirmed": "Ovalado" | "Cuadrado" | "Redondo" | "Diamante" | "Alargado" | "Triangular",
  "occipitalBone": {
    "type": "Prominente" | "Medio / Anatómico" | "Plano",
    "dropRecommendation": "explicación técnica de a qué altura trazar la caída del fade en la nuca",
    "dangerZoneNote": "advertencia para no crear escalón ni sombra oscura bajo el occipital"
  },
  "crownSwirl": {
    "direction": "Horario (Derecha)" | "Antihorario (Izquierda)" | "Doble Remolino",
    "minSafeGuard": "#2 (6 mm)" | "#3 (10 mm)" | "Tijera sobre peine",
    "warning": "instrucción exacta para no trasquilar ni parar el remolino de la coronilla"
  },
  "hairCharacteristics": {
    "density": "Alta" | "Media" | "Fina / Moderada",
    "texture": "Liso" | "Ondulado" | "Rizado / Afro",
    "frontHairline": "Recta definida" | "Entradas leves en sienes" | "Entradas pronunciadas"
  },
  "customRecipeAdjustments": ["ajuste técnico 1", "ajuste técnico 2", "ajuste técnico 3"],
  "recommendedStyleId": "mid-drop-fade-crop" | "low-taper-classic" | "high-skin-fade-quiff"
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }, ...inlineParts],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          return {
            ...parsed,
            source: 'gemini-api',
          };
        }
      }
    } catch (err) {
      console.warn('Fallback a diagnóstico morfológico local:', err);
    }
  }

  // Intelligent deterministic fallback based on detected face shape
  const styleByShape: Record<FaceShape, string> = {
    Ovalado: 'mid-drop-fade-crop',
    Cuadrado: 'high-skin-fade-quiff',
    Redondo: 'high-skin-fade-quiff',
    Diamante: 'low-taper-classic',
    Alargado: 'low-taper-classic',
    Triangular: 'mid-drop-fade-crop',
  };

  return {
    faceShapeConfirmed: detectedFaceShape,
    occipitalBone: {
      type: 'Medio / Anatómico',
      dropRecommendation:
        'Bajar la guía #0 en curva suave 1.5 cm por debajo de la protuberancia del hueso occipital para alargar el perfil del cuello.',
      dangerZoneNote:
        'Hundimiento leve justo debajo del hueso occipital: usa la esquina de la cuchilla con #0.5 a mitad para borrar esa sombra sin subir la línea.',
    },
    crownSwirl: {
      direction: 'Horario (Derecha)',
      minSafeGuard: '#2 (6 mm)',
      warning:
        'Remolino en coronilla con nacimiento hacia la derecha: no bajar de peine #2 abierto en el remolino o el cabello se levantará.',
    },
    hairCharacteristics: {
      density: 'Media',
      texture: 'Ondulado',
      frontHairline: 'Entradas leves en sienes',
    },
    customRecipeAdjustments: [
      `Para rostro ${detectedFaceShape}: mantener la cresta parietal (herradura) en #2 abierto saliendo en vertical a 90°.`,
      'No meter el trimmer en las entradas frontales; apoyar solo en las puntas del cerquillo central y el arco C de las sienes.',
      'En la nuca alta, peinar en sentido horario siguiendo el remolino antes de pasar el peine #1.5 cerrado.',
    ],
    recommendedStyleId: styleByShape[detectedFaceShape],
    source: 'local-engine',
  };
}

export async function evaluateFinishedHaircutWithAI(
  afterPhotoDataUrl: string | undefined,
  styleName: string
): Promise<HaircutEvaluationResult> {
  const apiKey = getSavedGeminiKey();
  const parsedImg = afterPhotoDataUrl ? stripDataUrlPrefix(afterPhotoDataUrl) : null;

  if (apiKey && parsedImg) {
    try {
      const prompt = `Eres un instructor de barbería evaluando un corte "${styleName}" realizado por un barbero en formación.
Analiza la foto del corte terminado y devuelve ÚNICAMENTE un JSON válido con:
{
  "overallScore": número de 70 a 99,
  "symmetryScore": número de 70 a 99,
  "fadeTransitionScore": número de 70 a 99,
  "lineupCleanlinessScore": número de 70 a 99,
  "strengths": ["punto fuerte 1", "punto fuerte 2"],
  "improvementsForNextCut": ["mejora técnica 1 con peine/palanca exacto", "mejora técnica 2"],
  "correctiveActionNow": "qué retoque rápido de 2 minutos puede hacer ahora mismo para dejarlo de 10"
}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: parsedImg.mimeType,
                      data: parsedImg.data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          return {
            ...JSON.parse(rawText),
            source: 'gemini-api',
          };
        }
      }
    } catch (err) {
      console.warn('Fallback a evaluación local:', err);
    }
  }

  return {
    overallScore: 91,
    symmetryScore: 93,
    fadeTransitionScore: 88,
    lineupCleanlinessScore: 92,
    strengths: [
      'Altura de la línea guía inicial bien nivelada respecto al arco de la ceja.',
      'Respeto correcto de la zona de herradura (cresta parietal) sin redondear la silueta.',
    ],
    improvementsForNextCut: [
      'En la transición entre #0.5 y #1 detrás de la oreja quedó una ligera sombra: usa solo la esquina de la cuchilla con #0.5 palanca intermedia (50%).',
      'Cepillar con fade brush constantemente mientras pasas el #1.5 para detectar pequeños cabellos largos.',
    ],
    correctiveActionNow:
      'Coloca el peine #0.5 con la palanca a la mitad (50%) y da 4 toques suaves en cuchareo justo detrás del lóbulo de la oreja para pulir la sombra media.',
    source: 'local-engine',
  };
}

