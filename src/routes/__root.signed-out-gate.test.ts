// Verifies the auth gate in __root.tsx prevents heavy hooks/components from
// being mounted in the signed-out state. This is a static-source assertion —
// rendering the full root requires the TanStack router context. We assert
// that the AuthGate function exists and only renders MobileSignedOutEmpty
// when there is no session.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(process.cwd(), "src/routes/__root.tsx"), "utf8");

describe("signed-out hard gate", () => {
  it("renders MobileSignedOutEmpty when no session", () => {
    expect(src).toMatch(/function AuthGate/);
    expect(src).toMatch(/if \(!session\)[\s\S]{0,200}<MobileSignedOutEmpty \/>/);
  });

  it("WorkspaceShell is not rendered until session exists", () => {
    // Only one render site for WorkspaceShell, inside AuthGate after session check.
    const hits = src.match(/<WorkspaceShell\s*\/>/g) ?? [];
    expect(hits.length).toBe(1);
  });

  it("does not mount WorkspaceTopBar/AssistantPanel at root level outside the gate", () => {
    // WorkspaceTopBar must only appear in WorkspaceShell, not AuthGate.
    const beforeShell = src.split("function WorkspaceShell")[0];
    expect(beforeShell).not.toMatch(/<WorkspaceTopBar/);
    expect(beforeShell).not.toMatch(/<AssistantPanel/);
  });
});
