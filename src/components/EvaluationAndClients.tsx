import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  ClipboardList,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { FaceShape, HaircutStyle } from '../data/haircuts';
import {
  CranialAIDiagnosis,
  evaluateFinishedHaircutWithAI,
  HaircutEvaluationResult,
} from '../lib/geminiService';

interface ClientRecord {
  id: string;
  name: string;
  date: string;
  faceShape: FaceShape;
  styleName: string;
  guardsRecipe: string;
  crownNote: string;
  notes: string;
  score?: number;
}

interface EvaluationAndClientsProps {
  detectedFaceShape: FaceShape;
  selectedStyle: HaircutStyle;
  diagnosis: CranialAIDiagnosis | null;
}

const CLIENTS_STORAGE_KEY = 'appbarber_clients_v1';

const DEFAULT_CLIENTS: ClientRecord[] = [
  {
    id: 'demo-1',
    name: 'Carlos Mendoza (Cliente Demo)',
    date: 'Hace 2 días',
    faceShape: 'Ovalado',
    styleName: 'Mid Drop Fade + Textured Crop',
    guardsRecipe: 'Base #0 cerrada • Transición #0.5 media • Parietal #2 abierta • Tijera arriba',
    crownNote: 'Remolino horario en coronilla — no bajar de peine #2',
    notes: 'Hueso occipital ligeramente pronunciado, bajar drop 1 dedo detrás de la oreja.',
    score: 92,
  },
];

export const EvaluationAndClients: React.FC<EvaluationAndClientsProps> = ({
  detectedFaceShape,
  selectedStyle,
  diagnosis,
}) => {
  const [afterPhoto, setAfterPhoto] = useState<string | undefined>(undefined);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<HaircutEvaluationResult | null>(null);

  const [clients, setClients] = useState<ClientRecord[]>(() => {
    try {
      const saved = localStorage.getItem(CLIENTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CLIENTS;
    } catch {
      return DEFAULT_CLIENTS;
    }
  });

  const [clientName, setClientName] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    } catch {
      // ignore storage quota errors
    }
  }, [clients]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAfterPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await evaluateFinishedHaircutWithAI(afterPhoto, selectedStyle.name);
      setEvalResult(res);
    } finally {
      setEvaluating(false);
    }
  };

  const handleSaveClientRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const guardsSummary = selectedStyle.zones
      .map((z) => `${z.guard} (${z.leverSummary})`)
      .join(' • ');

    const newRecord: ClientRecord = {
      id: `client-${Date.now()}`,
      name: clientName.trim(),
      date: new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      faceShape: diagnosis?.faceShapeConfirmed || detectedFaceShape,
      styleName: selectedStyle.name,
      guardsRecipe: guardsSummary,
      crownNote: diagnosis
        ? `Remolino ${diagnosis.crownSwirl.direction} (Mín. ${diagnosis.crownSwirl.minSafeGuard})`
        : 'Coronilla estándar (Peine #2 abierto)',
      notes:
        clientNotes.trim() ||
        diagnosis?.occipitalBone.dropRecommendation ||
        'Corte completado siguiendo diagrama AR.',
      score: evalResult?.overallScore,
    };

    setClients((prev) => [newRecord, ...prev]);
    setClientName('');
    setClientNotes('');
  };

  const handleDeleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left 6 Cols: AI Self-Evaluation for the Barber in Training */}
      <div className="lg:col-span-6 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Autoevaluación de Corte con IA
            </span>
            <h2 className="text-lg font-extrabold text-white mt-0.5">
              Medidor de Simetría y Limpieza del Degradado
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Al terminar el corte, sube o toma una foto del resultado para compararlo contra el diagrama original de{' '}
              <strong className="text-zinc-200">{selectedStyle.name}</strong>.
            </p>
          </div>
        </div>

        {/* Upload / Preview Box */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
          <div className="w-full sm:w-40 aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
            {afterPhoto ? (
              <img
                src={afterPhoto}
                alt="Corte terminado"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-3 text-xs text-zinc-500">
                Sin foto final
                <br />
                (Puedes evaluar en modo demo o subir foto)
              </div>
            )}
          </div>

          <div className="space-y-2.5 flex-1 w-full">
            <label className="w-full py-2.5 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition">
              <Upload className="w-4 h-4 text-amber-400" />
              Subir / Tomar Foto del Corte Terminado
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handleRunEvaluation}
              disabled={evaluating}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {evaluating ? 'Evaluando Simetría del Fade...' : 'Evaluar Corte Ahora'}
            </button>
          </div>
        </div>

        {/* Evaluation Result Metrics */}
        {evalResult && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-4 gap-2">
              <ScoreCard label="Puntaje Global" score={evalResult.overallScore} highlight />
              <ScoreCard label="Simetría" score={evalResult.symmetryScore} />
              <ScoreCard label="Transición Fade" score={evalResult.fadeTransitionScore} />
              <ScoreCard label="Contornos" score={evalResult.lineupCleanlinessScore} />
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                Retoque Rápido Recomendado (En 2 minutos):
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">
                {evalResult.correctiveActionNow}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Puntos Fuertes Logrados
                </div>
                {evalResult.strengths.map((s, idx) => (
                  <p key={idx} className="text-xs text-zinc-300">
                    • {s}
                  </p>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <div className="text-xs font-bold text-cyan-400">
                  Consejos para el Próximo Corte
                </div>
                {evalResult.improvementsForNextCut.map((imp, idx) => (
                  <p key={idx} className="text-xs text-zinc-300">
                    • {imp}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right 6 Cols: Technical Client File & Recipe History */}
      <div className="lg:col-span-6 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4" />
            Fichas Técnicas de Clientes
          </span>
          <h2 className="text-lg font-extrabold text-white mt-0.5">
            Bitácora de Peines, Remolinos y Perfil del Cliente
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Guarda la receta exacta utilizada hoy para que cuando el cliente regrese, tu hermano sepa qué peine y qué palanca usar en cada zona.
          </p>
        </div>

        {/* Add Client Form */}
        <form
          onSubmit={handleSaveClientRecord}
          className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. Andrés Gómez"
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Corte y Rostro Activo
              </label>
              <div className="px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-amber-300 font-semibold truncate">
                {selectedStyle.name} ({detectedFaceShape})
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
              Observaciones (Remolinos, cicatrices, altura preferida)
            </label>
            <input
              type="text"
              value={clientNotes}
              onChange={(e) => setClientNotes(e.target.value)}
              placeholder="Ej. Remolino fuerte a la derecha, dejar #2 en coronilla y patilla en punta..."
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Guardar Ficha Técnica del Cliente
          </button>
        </form>

        {/* Saved Client Cards */}
        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          {clients.map((client) => (
            <div
              key={client.id}
              className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-sm text-white">{client.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    Rostro {client.faceShape}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {client.score && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300">
                      {client.score}/100
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-500">{client.date}</span>
                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                    title="Eliminar ficha"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-xs font-semibold text-amber-400">{client.styleName}</div>
              <div className="text-[11px] text-zinc-300 bg-zinc-900/90 rounded-xl p-2 border border-zinc-800/80">
                <strong>Peines:</strong> {client.guardsRecipe}
              </div>
              <div className="text-[11px] text-cyan-300">
                <strong>Coronilla:</strong> {client.crownNote}
              </div>
              <p className="text-[11px] text-zinc-400">{client.notes}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ScoreCard: React.FC<{ label: string; score: number; highlight?: boolean }> = ({
  label,
  score,
  highlight,
}) => (
  <div
    className={`p-2.5 rounded-2xl border text-center ${
      highlight
        ? 'bg-amber-500/15 border-amber-500/40'
        : 'bg-zinc-950 border-zinc-800'
    }`}
  >
    <div className="text-[10px] uppercase text-zinc-400 truncate">{label}</div>
    <div
      className={`text-lg font-extrabold mt-0.5 ${
        highlight ? 'text-amber-400' : 'text-white'
      }`}
    >
      {score}%
    </div>
  </div>
);

