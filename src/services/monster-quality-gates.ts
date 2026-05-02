export type MonsterGateStatus = "pending" | "running" | "passed" | "failed" | "blocked";

export interface MonsterQualityGate {
  id: string;
  label: string;
  command?: string;
  required: boolean;
  status: MonsterGateStatus;
  proof?: string;
  error?: string;
}

export interface MonsterProofReport {
  version: "monster-proof-v1";
  generatedAt: string;
  projectId: string;
  blueprintSummary: string;
  gates: MonsterQualityGate[];
  canDeclareDone: boolean;
}

export function defaultMonsterQualityGates(): MonsterQualityGate[] {
  return [
    { id: "blueprint", label: "Monster Blueprint produced", required: true, status: "pending" },
    { id: "design", label: "Beautiful first design generated", required: true, status: "pending" },
    {
      id: "backend",
      label: "Backend/schema/RLS plan generated",
      required: true,
      status: "pending",
    },
    {
      id: "typecheck",
      label: "TypeScript check",
      command: "npm run typecheck",
      required: true,
      status: "pending",
    },
    { id: "lint", label: "Lint", command: "npm run lint", required: true, status: "pending" },
    {
      id: "build",
      label: "Production build",
      command: "npm run build",
      required: true,
      status: "pending",
    },
    { id: "test", label: "Tests", command: "npm run test", required: false, status: "pending" },
  ];
}

export function createMonsterProofReport(input: {
  projectId: string;
  blueprintSummary: string;
  gates?: MonsterQualityGate[];
}): MonsterProofReport {
  const gates = input.gates ?? defaultMonsterQualityGates();
  const canDeclareDone = gates.every((gate) => !gate.required || gate.status === "passed");
  return {
    version: "monster-proof-v1",
    generatedAt: new Date().toISOString(),
    projectId: input.projectId,
    blueprintSummary: input.blueprintSummary,
    gates,
    canDeclareDone,
  };
}

export function monsterDoneStatement(report: MonsterProofReport): string {
  if (!report.canDeclareDone) {
    const blockers = report.gates
      .filter((gate) => gate.required && gate.status !== "passed")
      .map((gate) => gate.label)
      .join(", ");
    return `Not done. Required gates still open: ${blockers || "unknown"}.`;
  }
  return "Done: blueprint, design, backend wiring plan, and required build gates passed.";
}
