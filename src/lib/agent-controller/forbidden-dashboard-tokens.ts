export const FORBIDDEN_DASHBOARD_TOKENS = [
  { id: "Matter board", re: /matter[\s_-]*board/i },
  { id: "Case cockpit", re: /case[\s_-]*cockpit/i },
  { id: "Active matters", re: /active[\s_-]*matters/i },
  { id: "Dashboard", re: /\bdashboard\b/i },
  { id: "Admin panel", re: /\badmin[\s_-]*panel\b/i },
  { id: "Admin", re: /\badmin\b/i },
  { id: "RLS", re: /\brls\b/i },
  { id: "Supabase", re: /\bsupabase\b/i },
  { id: "Schema / RLS", re: /schema[\s/_-]*rls/i },
  { id: "Roles & access", re: /roles[\s_-]*(?:&|and)[\s_-]*access/i },
  { id: "Invoices dashboard", re: /invoices[\s_-]*dashboard/i },
  { id: "KPI grid", re: /\bkpi[\s_-]*grid\b/i },
  { id: "LexOS", re: /\blex\s*os\b/i },
  { id: "Client intake queue", re: /client[\s_-]*intake[\s_-]*queue/i },
] as const;

export function findForbiddenDashboardTokens(input: string | null | undefined): string[] {
  const text = String(input ?? "");
  return FORBIDDEN_DASHBOARD_TOKENS.filter((token) => token.re.test(text)).map((token) => token.id);
}