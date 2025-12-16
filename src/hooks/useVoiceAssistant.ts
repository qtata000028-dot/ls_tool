import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AsrMsg, RealtimeAsrClient } from '../lib/realtimeAsrClient';
import { fetchAppConfig } from '../services/appConfig';

export type AssistantState = 'wake_listen' | 'awake';

type ActionType = 'none' | 'navigate' | 'execute_command';

export interface AssistantAction {
  type: ActionType;
  payload?: Record<string, any>;
}

export interface VoiceAssistantOptions {
  onNavigate?: (view: string, params?: any) => void;
  onExecuteCommand?: (commandText: string) => void;
}

export interface VoiceAssistantStatus {
  assistantState: AssistantState;
  isListening: boolean;
  transcript: string;
  feedback: string;
  indicator: 'gray' | 'green' | 'yellow';
}

const WAKE_WORDS = ['小朗', '小浪', '小狼', '晓朗', '小郎'];
const EXIT_WORDS = ['退下吧', '退下', '休眠', '退出待命'];

function normalizeCn(s: string) {
  return (s || '').replace(/\s+/g, '').replace(/[，。！？,.!?]/g, '');
}

function containsAny(text: string, words: string[]) {
  const t = normalizeCn(text);
  return words.some((w) => t.includes(w));
}

function stripWake(text: string) {
  let t = normalizeCn(text);
  for (const w of WAKE_WORDS) t = t.split(w).join('');
  return t.trim();
}

function beep(freq = 880) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 120);
  } catch {}
}

function sayIAmHere() {
  try {
    const u = new SpeechSynthesisUtterance('我在');
    u.lang = 'zh-CN';
    window.speechSynthesis.speak(u);
  } catch {}
}

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

  const asrClientRef = useRef<RealtimeAsrClient | null>(null);
  const shouldListenRef = useRef(false);
  const asrUrlRef = useRef<string | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const wakeTimeoutRef = useRef<number | null>(null);
  const assistantStateRef = useRef<AssistantState>('wake_listen');
  const startingRef = useRef(false);

  const indicator: VoiceAssistantStatus['indicator'] = useMemo(() => {
    if (assistantState === 'awake') return 'green';
    if (isListening) return 'yellow';
    return 'gray';
  }, [assistantState, isListening]);

  const clearWakeTimeout = useCallback(() => {
    if (wakeTimeoutRef.current) {
      window.clearTimeout(wakeTimeoutRef.current);
      wakeTimeoutRef.current = null;
    }
  }, []);

  const enterStandby = useCallback(() => {
    clearWakeTimeout();
    assistantStateRef.current = 'wake_listen';
    setAssistantState('wake_listen');
    setFeedback('');
    setTranscript('');
  }, [clearWakeTimeout]);

  const scheduleWakeTimeout = useCallback(() => {
    clearWakeTimeout();
    wakeTimeoutRef.current = window.setTimeout(() => {
      enterStandby();
    }, 8000);
  }, [clearWakeTimeout, enterStandby]);

  const handleAwake = useCallback(() => {
    assistantStateRef.current = 'awake';
    setAssistantState('awake');
    setFeedback('待指令');
    beep(880);
    sayIAmHere();
    scheduleWakeTimeout();
  }, [scheduleWakeTimeout]);

  const handleExit = useCallback(() => {
    beep(440);
    enterStandby();
  }, [enterStandby]);

  const handleCommand = useCallback(
    (text: string) => {
      const cleaned = stripWake(text);
      if (!cleaned) {
        scheduleWakeTimeout();
        return;
      }
      if (options?.onExecuteCommand) options.onExecuteCommand(cleaned);
      else fallbackCommandRouter(cleaned, options?.onNavigate);
      scheduleWakeTimeout();
    },
    [options, scheduleWakeTimeout]
  );

  const ensureConfig = useCallback(async () => {
    if (asrUrlRef.current) return asrUrlRef.current;
    const { asrWsUrl } = await fetchAppConfig();
    asrUrlRef.current = asrWsUrl;
    return asrWsUrl;
  }, []);

  const stopClient = useCallback(() => {
    asrClientRef.current?.stop();
    asrClientRef.current = null;
  }, []);

  const startClientRef = useRef<() => Promise<void> | void>();

  const scheduleRestart = useCallback(() => {
    if (!shouldListenRef.current) return;
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => {
      startClientRef.current?.();
    }, 600);
  }, []);

  const handleAsrMsg = useCallback(
    (msg: AsrMsg) => {
      if (!msg) return;
      if (msg.type === 'started') {
        setIsListening(true);
        setFeedback('监听中');
        return;
      }
      if (msg.type === 'ready') {
        setFeedback('准备就绪');
        return;
      }
      if (msg.type === 'partial') {
        if (msg.text) {
          setTranscript(msg.text.trim());
          setFeedback('正在识别...');
          if (assistantStateRef.current !== 'awake' && containsAny(msg.text, WAKE_WORDS)) {
            handleAwake();
          }
        }
        return;
      }
      if (msg.type === 'final') {
        const text = msg.text?.trim() || '';
        if (!text) return;
        setTranscript(text);
        const normalized = normalizeCn(text);
        if (assistantStateRef.current === 'awake' && containsAny(normalized, EXIT_WORDS)) {
          handleExit();
          return;
        }
        if (assistantStateRef.current !== 'awake' && containsAny(normalized, WAKE_WORDS)) {
          handleAwake();
        }
        if (assistantStateRef.current === 'awake') {
          handleCommand(text);
        }
        return;
      }
      if (msg.type === 'error' || msg.type === 'nls_error') {
        setIsListening(false);
        setFeedback('语音连接中断，重试中');
        scheduleRestart();
      }
    },
    [handleAwake, handleCommand, handleExit, scheduleRestart]
  );

  const startClient = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      const wsUrl = await ensureConfig();
      if (!wsUrl) throw new Error('缺少语音地址');
      const client = new RealtimeAsrClient(wsUrl, (msg) => handleAsrMsg(msg));
      asrClientRef.current = client;
      await client.start();
      assistantStateRef.current = 'wake_listen';
      setAssistantState('wake_listen');
      setTranscript('');
      setFeedback('监听中');
      setIsListening(true);
    } catch (err) {
      console.error('asr start failed', err);
      setFeedback('语音启动失败');
      stopClient();
      setIsListening(false);
      shouldListenRef.current = false;
    } finally {
      startingRef.current = false;
    }
  }, [ensureConfig, handleAsrMsg, stopClient]);

  startClientRef.current = startClient;

  const startListening = useCallback(async () => {
    if (isListening || shouldListenRef.current) {
      return;
    }
    if (!navigator?.mediaDevices?.getUserMedia || typeof WebSocket === 'undefined') {
      setFeedback('设备不支持语音');
      return;
    }
    shouldListenRef.current = true;
    setFeedback('监听中');
    setTranscript('');
    await startClient();
  }, [isListening, startClient]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    stopClient();
    enterStandby();
  }, [enterStandby, stopClient]);

  const toggleListening = useCallback(() => {
    if (isListening || shouldListenRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      clearWakeTimeout();
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      stopListening();
    };
  }, [clearWakeTimeout, stopListening]);

  const status: VoiceAssistantStatus = {
    assistantState,
    isListening,
    transcript,
    feedback,
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
