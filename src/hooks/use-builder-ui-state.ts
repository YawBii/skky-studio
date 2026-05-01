// Shared builder UI state — selectedPage, selectedEnvironment, currentTab.
// Bridged via window CustomEvents so the chat panel (rendered outside the
// builder route) can read what the user is looking at without prop drilling.
import { useEffect, useState } from "react";

export type BuilderEnvironment = "preview" | "production";
export type BuilderTab = "preview" | "code" | "database" | "deploy" | "jobs" | "history";

export interface BuilderUIState {
  selectedPage: string;
  selectedEnvironment: BuilderEnvironment;
  currentTab: BuilderTab;
}

const DEFAULT: BuilderUIState = {
  selectedPage: "/",
  selectedEnvironment: "production",
  currentTab: "preview",
};

let current: BuilderUIState = { ...DEFAULT };
const listeners = new Set<(s: BuilderUIState) => void>();

export function setBuilderUIState(patch: Partial<BuilderUIState>) {
  current = { ...current, ...patch };
  listeners.forEach((fn) => fn(current));
}

export function getBuilderUIState(): BuilderUIState {
  return current;
}

export function useBuilderUIState(): BuilderUIState {
  const [state, setState] = useState<BuilderUIState>(current);
  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}
