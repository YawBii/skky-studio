// TODO(codex): wire to Lovable AI Gateway (OpenAI-compatible) using LOVABLE_API_KEY.
export interface ChatMessage { role: "user" | "assistant" | "system"; content: string }
export interface BuildPlan { steps: { title: string; detail: string }[]; estimatedMinutes: number }

export async function chat(_messages: ChatMessage[]): Promise<ChatMessage> {
  return { role: "assistant", content: "Demo reply — wire LOVABLE_API_KEY in src/services/ai.ts" };
}

export async function planFromPrompt(_prompt: string): Promise<BuildPlan> {
  return {
    estimatedMinutes: 4,
    steps: [
      { title: "Scaffold routes", detail: "Create /, /dashboard, /settings" },
      { title: "Wire database", detail: "Provision tables + RLS" },
      { title: "Verify build", detail: "Lighthouse + smoke tests" },
    ],
  };
}
