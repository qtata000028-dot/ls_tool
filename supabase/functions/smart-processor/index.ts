// Supabase Edge Function: smart-processor
// Handles wake word detection, exit handling, and command extraction with CORS-safe parsing.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

function normalizeZh(s: string) {
  return (s || "").replace(/[，。！？、,.!?]/g, "").replace(/\s+/g, "").trim();
}

const WAKE_WORDS = ["小朗", "小狼", "小郎", "小浪"];
const SLEEP_WORDS = ["退下吧", "退下", "回去吧", "休息吧"];

Deno.serve(async (req) => {
  // ✅ 1) OPTIONS 预检：直接返回，不要 req.json()
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ✅ 2) GET：健康检查，避免你浏览器打开链接就报错
  if (req.method === "GET") {
    return ok({ ok: true, name: "smart-processor", hint: "POST JSON to use" });
  }

  // ✅ 3) 只允许 POST
  if (req.method !== "POST") {
    return ok({ error: `Method ${req.method} not allowed` }, 405);
  }

  // ✅ 4) 安全解析 JSON（空 body / 非 JSON 都兜底）
  const raw = await req.text();
  if (!raw) return ok({ error: "Empty request body" }, 400);

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return ok({ error: "Invalid JSON", detail: String(e), rawPreview: raw.slice(0, 80) }, 400);
  }

  const sessionId = String(body.sessionId || "");
  const state = String(body.state || "wake_listen");
  const text = normalizeZh(String(body.text || ""));
  const isFinal = Boolean(body.isFinal);

  if (!text) {
    return ok({
      nextState: state,
      tts: "",
      beep: [],
      action: { type: "none", payload: {} },
      debug: { sessionId, normalized: text, matched: "empty", isFinal },
    });
  }

  const hitWake = WAKE_WORDS.some((w) => text.includes(w));
  const hitSleep = SLEEP_WORDS.some((w) => text.includes(w));

  if ((state === "wake_listen" || state === "idle") && hitWake) {
    return ok({
      nextState: "awake",
      tts: "我在",
      beep: [{ freq: 660, ms: 90 }, { freq: 880, ms: 120 }],
      action: { type: "none", payload: {} },
      debug: { sessionId, normalized: text, matched: "wake", isFinal },
    });
  }

  if (state === "awake" && hitSleep) {
    return ok({
      nextState: "wake_listen",
      tts: "",
      beep: [{ freq: 440, ms: 120 }],
      action: { type: "none", payload: {} },
      debug: { sessionId, normalized: text, matched: "sleep", isFinal },
    });
  }

  if (state === "awake") {
    return ok({
      nextState: "awake",
      tts: "",
      beep: [],
      action: { type: "execute_command", payload: { commandText: text } },
      debug: { sessionId, normalized: text, matched: "command", isFinal },
    });
  }

  return ok({
    nextState: state,
    tts: "",
    beep: [],
    action: { type: "none", payload: {} },
    debug: { sessionId, normalized: text, matched: "none", isFinal },
  });
});
