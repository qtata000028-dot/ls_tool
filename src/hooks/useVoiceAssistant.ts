import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export type AssistantState = 'idle' | 'wake_listen' | 'awake';

type ActionType = 'none' | 'navigate' | 'execute_command';

export interface AssistantAction {
  type: ActionType;
  payload?: Record<string, any>;
}

export interface VoiceAssistantOptions {
  onNavigate?: (view: string, params?: any) => void;
  onExecuteCommand?: (commandText: string) => void;
  ttsEnabled?: boolean;
}

export interface VoiceAssistantStatus {
  assistantState: AssistantState;
  isListening: boolean;
  transcript: string;
  feedback: string;
  isSpeaking: boolean;
  indicator: 'gray' | 'green' | 'yellow';
}

const BEEP_PAUSE = 0.06;

const uid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeText = (text: string) =>
  (text || '')
    .replace(/[，。！？、,.!?；;：:“”"'’‘·`~…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fallbackCommandRouter = (
  commandText: string,
  onNavigate?: (view: string, params?: any) => void
) => {
  if (!onNavigate) return;
  const cmd = commandText.toLowerCase();
  if (cmd.includes('员工') || cmd.includes('档案')) return onNavigate('employee');
  if (cmd.includes('知识库')) return onNavigate('knowledge');
  if (cmd.includes('识图') || cmd.includes('视觉')) return onNavigate('vision');
  if (cmd.includes('分析') || cmd.includes('统计')) return onNavigate('tools', { mode: 'analysis' });
  if (cmd.includes('主页') || cmd.includes('首页')) return onNavigate('dashboard');
};

const useVoiceAssistant = (options?: VoiceAssistantOptions) => {
  const [assistantState, setAssistantState] = useState<AssistantState>('wake_listen');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const pausedForTTSRef = useRef(false);
  const sessionIdRef = useRef<string>(uid());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const assistantStateRef = useRef<AssistantState>('wake_listen');
  const restartTimerRef = useRef<number | null>(null);

  const indicator: VoiceAssistantStatus['indicator'] = useMemo(() => {
    if (assistantState === 'awake') return 'green';
    if (isListening) return 'yellow';
    return 'gray';
  }, [assistantState, isListening]);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playBeeps = useCallback(
    async (tones: { freq: number; ms: number }[]) => {
      if (!tones?.length) return;
      const ctx = await ensureAudioContext();
      if (!ctx) return;

      let startTime = ctx.currentTime;
      tones.forEach(({ freq, ms }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + ms / 1000);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + ms / 1000);
        startTime += ms / 1000 + BEEP_PAUSE;
      });
    },
    [ensureAudioContext]
  );

  const startRecognition = useCallback(() => {
    try {
      recognitionRef.current?.start?.();
    } catch (err) {
      // ignore repeated start errors
      console.warn('recognition restart failed', err);
    }
  }, []);

  const speak = useCallback(
    (text?: string) => {
      if (!text) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 1.05;
      pausedForTTSRef.current = true;
      setIsSpeaking(true);
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      utter.onend = () => {
        setIsSpeaking(false);
        pausedForTTSRef.current = false;
        if (shouldListenRef.current) {
          startRecognition();
        }
      };
      synth.speak(utter);
    },
    [startRecognition]
  );

  const handleProcessorResponse = useCallback(
    async (resp: any) => {
      if (!resp) return;
      const { nextState, tts, beep, action } = resp;
      if (nextState) {
        assistantStateRef.current = nextState;
        setAssistantState(nextState);
      }
      if (beep?.length) {
        await playBeeps(beep);
      }
      if (options?.ttsEnabled !== false && tts) {
        speak(tts);
      }
      if (action?.type === 'navigate' && options?.onNavigate) {
        options.onNavigate(action.payload?.view || action.payload?.target, action.payload);
      }
      if (action?.type === 'execute_command') {
        const commandText = action?.payload?.commandText as string;
        if (options?.onExecuteCommand) options.onExecuteCommand(commandText);
        else fallbackCommandRouter(commandText || '', options?.onNavigate);
      }
    },
    [options, playBeeps, speak]
  );

  const sendToProcessor = useCallback(
    async (finalText: string) => {
      const text = normalizeText(finalText);
      if (!text) return;
      const payload = {
        sessionId: sessionIdRef.current,
        state: assistantStateRef.current,
        text,
        isFinal: true,
        ts: Date.now(),
      };

      try {
        const { data, error } = await supabase.functions.invoke('smart-processor', {
          body: payload,
        });
        if (error) {
          console.warn('Edge invoke error', error);
        }
        await handleProcessorResponse(data);
      } catch (invokeErr) {
        console.warn('Invoke failed, fallback fetch', invokeErr);
        try {
          const res = await fetch(
            'https://gsbcfgmzzjhyiedhamgs.supabase.co/functions/v1/smart-processor',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify(payload),
            }
          );
          const data = await res.json();
          await handleProcessorResponse(data);
        } catch (fetchErr) {
          console.error('Processor call failed', fetchErr);
        }
      }
    },
    [handleProcessorResponse]
  );

  const buildRecognizer = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Recognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!Recognition) return null;
    const recognition = new Recognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onspeechstart = () => {
      if (assistantStateRef.current === 'awake') {
        setFeedback('待指令');
      } else {
        setFeedback('监听中');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (pausedForTTSRef.current) return;
      if (!shouldListenRef.current) return;
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = window.setTimeout(() => {
        startRecognition();
      }, 200);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onresult = async (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalText += res[0]?.transcript || '';
        }
      }
      const cleaned = normalizeText(finalText);
      if (cleaned) {
        setTranscript(cleaned);
        await sendToProcessor(cleaned);
      }
    };

    return recognition;
  }, [sendToProcessor, startRecognition]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    assistantStateRef.current = 'wake_listen';
    setAssistantState('wake_listen');
    setFeedback('');
    setTranscript('');
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  }, []);

  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setFeedback('浏览器不支持语音');
      return;
    }
    await ensureAudioContext();
    shouldListenRef.current = true;
    setFeedback('监听中');
    assistantStateRef.current = 'wake_listen';
    setAssistantState('wake_listen');
    setTranscript('');

    if (!recognitionRef.current) {
      recognitionRef.current = buildRecognizer();
    }
    if (!recognitionRef.current) {
      setFeedback('语音识别不可用');
      shouldListenRef.current = false;
      return;
    }
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn('start failed', err);
      setFeedback('语音启动失败');
    }
  }, [buildRecognizer, ensureAudioContext]);

  const toggleListening = useCallback(() => {
    if (isListening || shouldListenRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      try {
        recognitionRef.current?.stop?.();
      } catch {}
    };
  }, []);

  const status: VoiceAssistantStatus = {
    assistantState,
    isListening,
    transcript,
    feedback,
    isSpeaking,
    indicator,
  };

  return {
    status,
    toggleListening,
    startListening,
    stopListening,
  };
};

export default useVoiceAssistant;
