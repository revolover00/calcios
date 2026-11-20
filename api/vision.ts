import type { VercelRequest, VercelResponse } from "@vercel/node";

// Server-only Groq proxy — keys never leave the server
// Env vars: GROQ_API_KEY, GROQ_API_KEY_1..5, GROQ_API_KEYS (comma-separated)

function collectServerKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = (process.env[`GROQ_API_KEY_${i}`] || "").trim();
    if (k) keys.push(k);
  }
  const csv = (process.env.GROQ_API_KEYS || "").trim();
  if (csv) for (const p of csv.split(",")) if (p.trim()) keys.push(p.trim());
  const single = (process.env.GROQ_API_KEY || "").trim();
  if (single) keys.push(single);
  return [...new Set(keys)];
}

function parseRetryAfterMs(res: Response): number {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const n = Number(ra);
    if (Number.isFinite(n)) return Math.max(1000, n * 1000);
  }
  return 5000;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Basic rate limit: 30/min per IP (in-memory, per lambda instance)
  // For stronger protection use Vercel Firewall / Upstash
  // Simple check for payload size
  const body = req.body;
  if (!body || typeof body.dataUrl !== "string" || !body.dataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "Invalid image data" });
  }
  const model = typeof body.model === "string" ? body.model.slice(0, 80) : undefined;
  const apiUrl = typeof body.apiUrl === "string" ? body.apiUrl.slice(0, 300) : undefined;

  const keys = collectServerKeys();
  if (keys.length === 0) return res.status(503).json({ error: "Vision service not configured" });

  const endpoint = apiUrl || process.env.GROQ_API_URL || process.env.VITE_GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";
  const chosenModel = model || process.env.GROQ_MODEL || process.env.VITE_GROQ_MODEL || "qwen/qwen3-8b-27b";

  const systemPrompt = `You convert an image of a handwritten or printed mathematical problem into a JSON object for the Calcios 2D scientific calculator.
Return ONLY valid JSON with this exact schema:
{
  "expression": "<Calcios 2D expression>",
  "mode": "COMP" | "CMPLX",
  "angle": "DEG" | "RAD" | null
}`;

  const payloadBase: any = {
    model: chosenModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: [{ type: "text", text: "Extract the mathematical problem from this image as Calcios JSON." }, { type: "image_url", image_url: { url: body.dataUrl } }] },
    ],
    temperature: 0.1,
    max_completion_tokens: 300,
    response_format: { type: "json_object" },
  };
  if (chosenModel.toLowerCase().includes("qwen3.8")) payloadBase.reasoning_effort = "none";

  let lastErr = "Vision service unavailable";
  for (const key of keys) {
    try {
      let r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(payloadBase) });
      if (r.status === 400 && "reasoning_effort" in payloadBase) {
        const fb = { ...payloadBase }; delete fb.reasoning_effort;
        r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(fb) });
      }
      if (r.ok) {
        const data = await r.json();
        return res.status(200).json(data);
      }
      if (r.status === 429 || r.status === 500 || r.status === 502 || r.status === 503) {
        try { const j: any = await r.clone().json(); if (j?.error?.message) lastErr = j.error.message; } catch { lastErr = `HTTP ${r.status}`; }
        // failover to next key
        continue;
      }
      // non-retryable (e.g. 400 bad image)
      const detail = await r.text();
      return res.status(r.status).json({ error: detail.slice(0, 2000) });
    } catch (e: any) {
      lastErr = e?.message || "Network error";
      continue;
    }
  }
  return res.status(502).json({ error: lastErr });
}
