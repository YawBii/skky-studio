// TODO(codex): wire to Stripe REST API using STRIPE_SECRET_KEY.
export interface Plan { id: string; name: string; price: number; interval: "month" | "year"; features: string[]; current?: boolean }
export interface Invoice { id: string; date: string; amount: number; status: "paid" | "open" | "void" }

export async function listPlans(): Promise<Plan[]> {
  return [
    { id: "starter", name: "Starter", price: 0, interval: "month", features: ["1 project", "Community support"] },
    { id: "pro", name: "Pro", price: 49, interval: "month", current: true, features: ["10 projects", "Imports", "Priority support"] },
    { id: "scale", name: "Scale", price: 199, interval: "month", features: ["Unlimited projects", "SSO", "Audit logs", "SLA"] },
  ];
}
export async function listInvoices(): Promise<Invoice[]> {
  return [
    { id: "INV-1284", date: "Apr 1, 2026", amount: 49, status: "paid" },
    { id: "INV-1183", date: "Mar 1, 2026", amount: 49, status: "paid" },
    { id: "INV-1082", date: "Feb 1, 2026", amount: 49, status: "paid" },
  ];
}
export async function changePlan(_planId: string): Promise<void> {}
export async function openCustomerPortal(): Promise<{ url: string }> { return { url: "#" }; }
