// Supabase Edge Function: smart-processor
// Handles wake word detection, exit handling, and command extraction with CORS-safe parsing.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // You can restrict to your Vercel domain if desired
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeZh(s: string) {
  return (s || "")
    .replace(/[，。！？、,.!?]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const WAKE_WORDS = ["小朗", "小狼", "小郎", "小浪"];
const SLEEP_WORDS = ["退下吧", "退下", "回去吧", "休息吧"];

serve(async (req) => {
  // 1) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2) Allow GET for health checks
  if (req.method === "GET") {
    return json({ ok: true, name: "smart-processor", hint: "POST JSON to use" });
  }

  // 3) Only allow POST
  if (req.method !== "POST") {
    return json({ error: `Method ${req.method} not allowed` }, 405);
  }

  // 4) Safe JSON parsing
  const raw = await req.text();
  if (!raw) {
    return json({ error: "Empty request body" }, 400);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json(
      { error: "Invalid JSON", detail: String(e), rawPreview: raw.slice(0, 80) },
      400
    );
  }

  // 5) Business logic
  const sessionId = String(body.sessionId || "");
  const state = String(body.state || "wake_listen");
  const text = normalizeZh(String(body.text || ""));
  const isFinal = Boolean(body.isFinal);

  if (!text) {
    return json({
      nextState: state,
      tts: "",
      beep: [],
      action: { type: "none", payload: {} },
      debug: { normalized: text, matched: "empty" },
    });
  }

  const hitWake = WAKE_WORDS.some((w) => text.includes(w));
  const hitSleep = SLEEP_WORDS.some((w) => text.includes(w));

  if ((state === "wake_listen" || state === "idle") && hitWake) {
    return json({
      nextState: "awake",
      tts: "我在",
      beep: [
        { freq: 660, ms: 90 },
        { freq: 880, ms: 120 },
      ],
      action: { type: "none", payload: {} },
      debug: { sessionId, normalized: text, isFinal, matched: "wake" },
    });
  }

  if (state === "awake" && hitSleep) {
    return json({
      nextState: "wake_listen",
      tts: "",
      beep: [{ freq: 440, ms: 120 }],
      action: { type: "none", payload: {} },
      debug: { sessionId, normalized: text, isFinal, matched: "sleep" },
    });
  }

  if (state === "awake") {
    return json({
      nextState: "awake",
      tts: "",
      beep: [],
      action: { type: "execute_command", payload: { commandText: text } },
      debug: { sessionId, normalized: text, isFinal, matched: "command" },
    });
  }

  return json({
    nextState: state,
    tts: "",
    beep: [],
    action: { type: "none", payload: {} },
    debug: { sessionId, normalized: text, isFinal, matched: "none" },
  });
});
