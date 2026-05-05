// Public AI chat endpoint. Routes through yawB's provider abstraction
// (`src/server/ai-gateway.server.ts`), which selects an adapter based on
// YAWB_AI_PROVIDER / YAWB_AI_MODEL. Provider keys never leave the server.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  chatCompletion,
  planFromPrompt,
  streamChatCompletion,
  AI_NOT_CONFIGURED,
  isAiGatewayConfigured,
  getActiveProviderInfo,
  getRecentAiCalls,
} from "@/server/ai-gateway.server";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const BodySchema = z.object({
  mode: z.enum(["chat", "plan"]).optional().default("chat"),
  stream: z.boolean().optional().default(true),
  prompt: z.string().min(1).max(20_000).optional(),
  messages: z.array(MessageSchema).min(1).max(40).optional(),
  model: z.string().min(1).max(120).optional(),
});

export const Route = createFileRoute("/api/public/ai-chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const includeCalls = new URL(request.url).searchParams.get("recent") === "1";
        const body: Record<string, unknown> = {
          ...getActiveProviderInfo(),
          configured: isAiGatewayConfigured(),
        };
        if (includeCalls) body.recentCalls = getRecentAiCalls();
        return Response.json(body, { headers: { "cache-control": "no-store" } });
      },
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body." }, { status: 400 });
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid request.", issues: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const { mode, stream, prompt, messages, model } = parsed.data;

        if (mode === "plan") {
          if (!prompt)
            return Response.json({ error: "prompt is required for plan mode." }, { status: 400 });
          const r = await planFromPrompt({ prompt, model });
          if (!r.ok) {
            return Response.json(
              { error: r.error, setupError: r.setupError ?? false },
              { status: r.setupError ? 503 : (r.status ?? 500) },
            );
          }
          return Response.json({ plan: r.value });
        }

        const msgs = messages ?? (prompt ? [{ role: "user" as const, content: prompt }] : null);
        if (!msgs) return Response.json({ error: "messages or prompt required." }, { status: 400 });

        if (!stream) {
          const r = await chatCompletion({ messages: msgs, model });
          if (!r.ok) {
            return Response.json(
              { error: r.error, setupError: r.setupError ?? false },
              { status: r.setupError ? 503 : (r.status ?? 500) },
            );
          }
          return Response.json({ content: r.value.content, model: r.value.model });
        }

        const r = await streamChatCompletion({ messages: msgs, model });
        if (!r.ok) {
          return Response.json(
            { error: r.error, setupError: r.setupError ?? false },
            { status: r.setupError ? 503 : (r.status ?? 500) },
          );
        }
        return r.value;
      },
    },
  },
});

// Re-exported for tests.
export const __test = { AI_NOT_CONFIGURED };
