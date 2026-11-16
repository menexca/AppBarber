import { useEffect, useRef, useState, useCallback } from 'react';

interface VoiceControlHandlers {
  onNextStep: () => void;
  onPrevStep: () => void;
  onToggleARZones: () => void;
  onToggleMesh: () => void;
  onExplainCurrentStep: () => void;
}

export function useVoiceControl(handlers: VoiceControlHandlers) {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const recognition = new SpeechRec();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const lastIdx = event.results.length - 1;
      const transcript = event.results[lastIdx][0].transcript.toLowerCase().trim();
      setLastCommand(transcript);

      if (
        transcript.includes('siguiente') ||
        transcript.includes('avanzar') ||
        transcript.includes('próximo')
      ) {
        handlersRef.current.onNextStep();
      } else if (
        transcript.includes('anterior') ||
        transcript.includes('atrás') ||
        transcript.includes('volver')
      ) {
        handlersRef.current.onPrevStep();
      } else if (
        transcript.includes('ocultar') ||
        transcript.includes('mostrar líneas') ||
        transcript.includes('peines') ||
        transcript.includes('diagrama')
      ) {
        handlersRef.current.onToggleARZones();
      } else if (transcript.includes('malla') || transcript.includes('puntos')) {
        handlersRef.current.onToggleMesh();
      } else if (
        transcript.includes('explicar') ||
        transcript.includes('repetir') ||
        transcript.includes('ayuda')
      ) {
        handlersRef.current.onExplainCurrentStep();
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current?._keepAlive) {
        try {
          recognition.start();
        } catch {
          // ignore restart error
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognitionRef.current._keepAlive = false;
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;

    if (isListening) {
      rec._keepAlive = false;
      try {
        rec.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      rec._keepAlive = true;
      try {
        rec.start();
        setIsListening(true);
        speak('Control por voz activado. Di siguiente paso, anterior o explicar.');
      } catch {
        setIsListening(false);
      }
    }
  }, [isListening, speak]);

  return {
    isListening,
    lastCommand,
    supported,
    toggleListening,
    speak,
  };
}

