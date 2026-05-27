// cli/src/memory.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type MemoryPrefs = {
  education?: string;
  major?: string;
  political?: string;
  province?: string;
  grassroots_years?: number;
  score?: number;
  exam_category?: string;
};

export type WatchedPosition = {
  position_id: string;
  year: number;
  label: string;
  added_at: string;
  note?: string;
};

export type MemoryEvent = { at: string; type: string; detail: string };

export type MemoryState = {
  prefs: MemoryPrefs;
  watched: WatchedPosition[];
  events: MemoryEvent[];
};

const DIR = join(homedir(), ".kaogongpro");
const FILE = join(DIR, "memory.json");

function empty(): MemoryState {
  return { prefs: {}, watched: [], events: [] };
}

export function memoryPath(): string { return FILE; }

export function loadMemory(): MemoryState {
  try {
    return JSON.parse(readFileSync(FILE, "utf-8"));
  } catch {
    return empty();
  }
}

function save(state: MemoryState) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function setPrefs(updates: Record<string, unknown>): MemoryState {
  const state = loadMemory();
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === "") continue;
    (state.prefs as Record<string, unknown>)[k] =
      k === "score" || k === "grassroots_years" ? Number(v) : String(v);
  }
  save(state);
  return state;
}

export function addWatched(
  positionId: string, year: number, label: string, note?: string,
): MemoryState {
  const state = loadMemory();
  state.watched.push({
    position_id: positionId, year, label,
    added_at: new Date().toISOString(), note,
  });
  save(state);
  return state;
}

export function logEvent(type: string, detail: string): MemoryState {
  const state = loadMemory();
  state.events.push({ at: new Date().toISOString(), type, detail });
  if (state.events.length > 200) state.events = state.events.slice(-200);
  save(state);
  return state;
}

export function clearMemory(): MemoryState {
  const state = empty();
  save(state);
  return state;
}
