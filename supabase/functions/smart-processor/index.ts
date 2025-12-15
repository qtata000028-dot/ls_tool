// Supabase Edge Function: smart-processor
// Handles wake word detection, exit handling, and command extraction.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProcessorRequest {
  sessionId?: string;
  state?: "idle" | "wake_listen" | "awake";
  text?: string;
  isFinal?: boolean;
  ts?: number;
}

interface BeepTone {
  freq: number;
  ms: number;
}

interface ProcessorResponse {
  nextState: "wake_listen" | "awake" | "idle";
  tts?: string;
  beep?: BeepTone[];
  action?: {
    type: "none" | "navigate" | "execute_command";
    payload?: Record<string, unknown>;
  };
  debug?: {
    normalized: string;
    matched: "wake" | "sleep" | "command" | "none";
  };
}

const normalizeCompact = (text: string) =>
  (text || "")
    .replace(/[，。！？、,.!?；;：:“”\"'’‘·`~…]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();

const normalizeSpaced = (text: string) =>
  (text || "")
    .replace(/[，。！？、,.!?；;：:“”\"'’‘·`~…]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const wakeWords = ["小朗", "小狼", "小郎"];
const exitWords = ["退下吧", "退下", "回去吧", "休息吧"];

const stripWakeWords = (text: string) => {
  const patterns = [
    /小[朗狼郎]\s*小[朗狼郎]/g,
    /小[朗狼郎]/g,
    /xiao\s*lang\s*xiao\s*lang/gi,
    /xiaolang/gi,
    /xiao\s*lang/gi,
  ];

  let cleaned = text;
  patterns.forEach((p) => {
    cleaned = cleaned.replace(p, " ");
  });
  return cleaned.replace(/\s+/g, " ").trim();
};

const matchWake = (normalizedCompact: string) =>
  wakeWords.some((w) => normalizedCompact.includes(w.toLowerCase())) ||
  /xiao\s*lang/gi.test(normalizedCompact);

const matchExit = (normalizedCompact: string) =>
  exitWords.some((w) => normalizedCompact.includes(w.toLowerCase()));

const buildResponse = (data: ProcessorResponse, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body: ProcessorRequest;
  try {
    body = await req.json();
  } catch (_err) {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  const state = body.state || "idle";
  const text = body.text || "";

  const normalizedCompact = normalizeCompact(text);
  const normalizedSpaced = normalizeSpaced(text);

  const matchedWake = matchWake(normalizedCompact);
  const matchedExit = matchExit(normalizedCompact);

  // Exit handling regardless of state (higher priority after wake in awake mode)
  if (matchedExit) {
    const response: ProcessorResponse = {
      nextState: "wake_listen",
      tts: "",
      beep: [{ freq: 440, ms: 120 }],
      action: { type: "none" },
      debug: { normalized: normalizedCompact, matched: "sleep" },
    };
    return buildResponse(response);
  }

  // Wake handling
  if ((state === "idle" || state === "wake_listen") && matchedWake) {
    const response: ProcessorResponse = {
      nextState: "awake",
      tts: "我在",
      beep: [
        { freq: 660, ms: 90 },
        { freq: 880, ms: 120 },
      ],
      action: { type: "none" },
      debug: { normalized: normalizedCompact, matched: "wake" },
    };
    return buildResponse(response);
  }

  // Awake command handling
  if (state === "awake") {
    const commandText = stripWakeWords(normalizedSpaced);
    const response: ProcessorResponse = {
      nextState: "awake",
      tts: commandText ? "" : "",
      beep: [],
      action: commandText
        ? { type: "execute_command", payload: { commandText } }
        : { type: "none", payload: {} },
      debug: { normalized: normalizedCompact, matched: commandText ? "command" : "none" },
    };
    return buildResponse(response);
  }

  // No matches
  const response: ProcessorResponse = {
    nextState: state === "idle" ? "wake_listen" : state,
    tts: "",
    beep: [],
    action: { type: "none", payload: {} },
    debug: { normalized: normalizedCompact, matched: "none" },
  };
  return buildResponse(response);
});
