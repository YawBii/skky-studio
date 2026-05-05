// Client-side wrapper for the yawB AI gateway endpoint at /api/public/ai-chat.
// Secrets stay on the server; this file never touches LOVABLE_API_KEY.

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface BuildPlanStep {
  title: string;
  detail: string;
}
export interface BuildPlan {
  steps: BuildPlanStep[];
  estimatedMinutes: number;
}

const ENDPOINT = "/api/public/ai-chat";

export type AiErrorCategory =
  | "missing_key"
  | "invalid_key"
  | "rate_limit"
  | "credits"
  | "permission"
  | "network"
  | "upstream"
  | "parse"
  | "unknown";

export type ChatResult =
  | { ok: true; content: string; model?: string }
  | {
      ok: false;
      error: string;
      setupError?: boolean;
      status?: number;
      category?: AiErrorCategory;
      provider?: string;
    };

export type PlanResult =
  | { ok: true; plan: BuildPlan }
  | {
      ok: false;
      error: string;
      setupError?: boolean;
      status?: number;
      category?: AiErrorCategory;
      provider?: string;
    };

/** Non-streaming chat completion. */
export async function chat(messages: ChatMessage[]): Promise<ChatResult> {
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, stream: false }),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        setupError: Boolean(body.setupError),
        category: body.category as AiErrorCategory | undefined,
        provider: typeof body.provider === "string" ? body.provider : undefined,
        error: typeof body.error === "string" ? body.error : `AI error ${r.status}`,
      };
    }
    return {
      ok: true,
      content: String(body.content ?? ""),
      model: body.model as string | undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Structured plan extraction. */
export async function planFromPrompt(prompt: string): Promise<PlanResult> {
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "plan", prompt }),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        setupError: Boolean(body.setupError),
        error: typeof body.error === "string" ? body.error : `AI plan error ${r.status}`,
      };
    }
    return { ok: true, plan: body.plan as BuildPlan };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Streaming chat. Calls onDelta for each text chunk. Resolves when stream
 *  closes. Throws on transport / setup errors so callers can surface a toast. */
export async function streamChat(args: {
  messages: ChatMessage[];
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<{ model?: string }> {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: args.messages, stream: true }),
    signal: args.signal,
  });
  if (!resp.ok || !resp.body) {
    let detail = `AI stream error ${resp.status}`;
    try {
      const j = (await resp.json()) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  let model: string | undefined;
  while (!done) {
    const { value, done: d } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(payload) as {
          model?: string;
          choices?: Array<{ delta?: { content?: string } }>;
        };
        if (!model && parsed.model) model = parsed.model;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) args.onDelta(delta);
      } catch {
        // partial JSON across chunks — push back and wait
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  return { model };
}
