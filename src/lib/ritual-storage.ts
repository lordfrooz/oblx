import type { QuestId } from "@/lib/config";

export type Step = "intro" | "handle" | "quests" | "wallet" | "done";

const KEY = "oblx-ritual";

export interface RitualProgress {
  step: Step;
  handle: string;
  done: Record<QuestId, boolean>;
  address: string;
  invite: string;
}

const EMPTY_DONE: Record<QuestId, boolean> = {
  follow: false,
  reply: false,
  qrt: false,
  like: false,
};

export function loadRitual(): RitualProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RitualProgress;
    if (!data || typeof data !== "object") return null;
    return {
      step: data.step ?? "intro",
      handle: data.handle ?? "",
      done: { ...EMPTY_DONE, ...data.done },
      address: data.address ?? "",
      invite: data.invite ?? "",
    };
  } catch {
    return null;
  }
}

export function saveRitual(state: RitualProgress) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function clearRitual() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
