import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { ProjectScopedEmpty } from "@/components/project-empty";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — yawB" },
      { name: "description", content: "Plans, usage and invoices." },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { current, isReal } = useWorkspaces();
  if (!isReal || !current) {
    return (
      <ProjectScopedEmpty
        icon={CreditCard}
        eyebrow="Billing"
        title="Create a workspace first"
        hint="Billing is per workspace."
        cta={{ label: "Go home", to: "/" }}
      />
    );
  }
  return (
    <ProjectScopedEmpty
      icon={CreditCard}
      eyebrow={current.name}
      title="Billing not connected yet"
      hint="Stripe billing wires in the next pass. No usage, plan or invoice numbers are shown until they reflect real Stripe data for this workspace."
    />
  );
}
