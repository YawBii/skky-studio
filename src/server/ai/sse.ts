// Helpers for parsing provider SSE streams into a unified async iterable of
// text deltas. Each provider has slightly different shapes — keep the parsing
// here so the adapter implementations stay small.

/** Parse OpenAI-compatible SSE (used by OpenAI and the Lovable Gateway). */
export async function* parseOpenAiSse(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
}

/** Parse Anthropic SSE (`event: content_block_delta` etc.). */
export async function* parseAnthropicSse(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":") || line.startsWith("event:")) continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      try {
        const parsed = JSON.parse(payload) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (
          parsed.type === "content_block_delta" &&
          parsed.delta?.type === "text_delta" &&
          typeof parsed.delta.text === "string"
        ) {
          yield parsed.delta.text;
        }
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
}

/** Parse Google Gemini streamGenerateContent SSE. */
export async function* parseGoogleSse(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line || line.startsWith(":")) continue;
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      try {
        const parsed = JSON.parse(payload) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const parts = parsed.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) if (typeof p.text === "string" && p.text) yield p.text;
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
}

/** Convert an async-iterable of text deltas into an OpenAI-shape SSE stream
 *  for the browser, so the existing client parser keeps working unchanged. */
export function deltasToOpenAiSse(
  deltas: AsyncIterable<string>,
  model: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const text of deltas) {
          const chunk = {
            model,
            choices: [{ delta: { content: text } }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}
