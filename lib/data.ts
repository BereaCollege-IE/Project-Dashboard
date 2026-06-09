// Pure data utilities. No I/O here, so these are easy to reason about and test.
// Everything works on plain objects so it can run on the server or the client.

import type {
  Project,
  ProjectsData,
  ScheduledBlock,
  Subtask,
  TimeBlock,
} from "./types";

// How many days untouched before a project counts as stale.
export const STALE_AFTER_DAYS = 5;

// Today as a YYYY-MM-DD string in local time.
// Example: "2026-06-09"
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Whole days between two YYYY-MM-DD dates. Positive when `to` is after `from`.
// Example: daysBetween("2026-06-04", "2026-06-09") -> 5
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// All blocks scheduled for a given day, across every project, flattened with
// their project context and sorted by their saved order then start time.
export function getBlocksForDay(
  data: ProjectsData,
  day: string
): ScheduledBlock[] {
  const blocks: ScheduledBlock[] = [];
  for (const project of data.projects) {
    for (const block of project.blocks) {
      if (block.date === day) {
        blocks.push({
          ...block,
          projectSlug: project.slug,
          projectTitle: project.title,
        });
      }
    }
  }
  return blocks.sort(
    (a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime)
  );
}

// Active projects whose last-touched date is at least STALE_AFTER_DAYS old.
// Completed and paused projects are not surfaced as stale.
export function getStaleProjects(
  data: ProjectsData,
  today: string = todayISO(),
  staleAfterDays: number = STALE_AFTER_DAYS
): Project[] {
  return data.projects.filter((p) => {
    if (p.status !== "active") return false;
    return daysBetween(p.lastTouched, today) >= staleAfterDays;
  });
}

// Progress on a block as completed-over-total subtasks.
// Example: { done: 2, total: 3 }
export function blockProgress(block: TimeBlock): {
  done: number;
  total: number;
} {
  const total = block.subtasks.length;
  const done = block.subtasks.filter((s: Subtask) => s.done).length;
  return { done, total };
}

// True when a due date is an exact calendar day (YYYY-MM-DD) rather than a
// free-text phrase like "Summer 2026".
export function isISODate(value?: string): boolean {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Friendly label for a due date. Exact dates become "Jun 15, 2026"; free-text
// phrases pass through unchanged. Empty input returns an empty string.
export function formatDueDate(value?: string): string {
  if (!value) return "";
  if (isISODate(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
  }
  return value;
}

// A task is overdue when it has an exact past date and is not yet done.
// ISO date strings compare correctly with a plain string comparison.
export function isOverdue(
  dueDate: string | undefined,
  today: string,
  done: boolean
): boolean {
  if (done || !isISODate(dueDate)) return false;
  return dueDate! < today;
}

// Sort comparator for backlog tasks: not-done first, then exact dates in
// chronological order, then fuzzy or undated tasks last.
export function compareTasksByDue(a: Subtask, b: Subtask): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const aIso = isISODate(a.dueDate);
  const bIso = isISODate(b.dueDate);
  if (aIso && bIso) return a.dueDate!.localeCompare(b.dueDate!);
  if (aIso) return -1;
  if (bIso) return 1;
  return 0;
}
