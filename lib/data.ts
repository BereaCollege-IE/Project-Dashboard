// Pure data utilities. No I/O here, so these are easy to reason about and test.
// Everything works on plain objects so it can run on the server or the client.

import type {
  Deadline,
  Priority,
  Project,
  ProjectsData,
  ScheduledBlock,
  Settings,
  Subtask,
  TimeBlock,
} from "./types";

// How many days untouched before a project counts as stale (default).
export const STALE_AFTER_DAYS = 5;

// Default settings, merged under whatever the user has saved.
export const DEFAULT_SETTINGS: Required<Omit<Settings, "reminderEmail">> & {
  reminderEmail: string;
} = {
  staleAfterDays: 5,
  defaultStartTime: "09:00",
  defaultBlockMinutes: 60,
  assistantModel: "claude-sonnet-4-6",
  reminderEmail: "",
};

// Settings with defaults applied.
export function getSettings(data: ProjectsData) {
  return { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
}

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

// Priority rank for sorting (high first). Undefined sorts last.
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export function comparePriority(a: Subtask, b: Subtask): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ra = a.priority ? PRIORITY_RANK[a.priority] : 3;
  const rb = b.priority ? PRIORITY_RANK[b.priority] : 3;
  return ra - rb;
}

// --- Day math ---

// Shift a YYYY-MM-DD day by a whole number of days. Returns YYYY-MM-DD.
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

// Advance an ISO due date by one recurrence period. Non-ISO dates are returned
// unchanged (a fuzzy phrase like "Summer 2026" cannot be advanced).
export function advanceDueDate(dueDate: string, freq: "weekly" | "monthly"): string {
  if (!isISODate(dueDate)) return dueDate;
  if (freq === "weekly") return addDays(dueDate, 7);
  const d = new Date(`${dueDate}T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  return todayISO(d);
}

// Compute an end time from a start time plus a duration in minutes (clamped to
// 23:59 so it stays a valid same-day HH:MM).
export function addMinutesToTime(start: string, minutes: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// A friendly label for a day relative to today: "Today", "Tomorrow",
// "Yesterday", or e.g. "Mon, Jun 15".
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = MONTHS;
export function dayLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = new Date(`${day}T00:00:00`);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

// --- Deadlines ---

// All exact-dated deadlines (tasks and project umbrellas) that are not done,
// optionally limited to those due within `withinDays` of today (overdue items
// are always included). Sorted soonest first.
export function getUpcomingDeadlines(
  data: ProjectsData,
  today: string,
  withinDays = 14
): Deadline[] {
  const out: Deadline[] = [];
  for (const project of data.projects) {
    if (project.status === "complete") continue;
    for (const task of project.tasks ?? []) {
      if (task.done || !isISODate(task.dueDate)) continue;
      out.push({
        kind: "task",
        projectSlug: project.slug,
        projectTitle: project.title,
        title: task.title,
        dueDate: task.dueDate!,
        taskId: task.id,
        done: task.done,
        priority: task.priority,
      });
    }
    if (isISODate(project.dueDate)) {
      out.push({
        kind: "project",
        projectSlug: project.slug,
        projectTitle: project.title,
        title: `${project.title} (project deadline)`,
        dueDate: project.dueDate!,
        done: false,
      });
    }
  }
  return out
    .filter((d) => daysBetween(today, d.dueDate) <= withinDays)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// --- Stats ---

export interface DashboardStats {
  totalTasks: number;
  doneTasks: number;
  dueToday: number;
  overdue: number;
  scheduledToday: number;
  completedThisWeek: number;
  perProject: { slug: string; title: string; done: number; total: number }[];
}

// Roll up simple progress numbers for the at-a-glance header and stats section.
export function getStats(data: ProjectsData, today: string): DashboardStats {
  let totalTasks = 0;
  let doneTasks = 0;
  let dueToday = 0;
  let overdue = 0;
  let completedThisWeek = 0;
  const weekAgo = addDays(today, -7);
  const perProject: DashboardStats["perProject"] = [];

  for (const project of data.projects) {
    const tasks = project.tasks ?? [];
    let pDone = 0;
    for (const t of tasks) {
      totalTasks++;
      if (t.done) {
        doneTasks++;
        pDone++;
        if (t.completedAt && t.completedAt >= weekAgo && t.completedAt <= today) {
          completedThisWeek++;
        }
      } else if (isISODate(t.dueDate)) {
        const diff = daysBetween(today, t.dueDate!);
        if (diff === 0) dueToday++;
        else if (diff < 0) overdue++;
      }
    }
    perProject.push({
      slug: project.slug,
      title: project.title,
      done: pDone,
      total: tasks.length,
    });
  }

  const scheduledToday = getBlocksForDay(data, today).length;
  return {
    totalTasks,
    doneTasks,
    dueToday,
    overdue,
    scheduledToday,
    completedThisWeek,
    perProject,
  };
}

// All distinct tags used across projects, sorted.
export function getAllTags(data: ProjectsData): string[] {
  const set = new Set<string>();
  for (const p of data.projects) for (const t of p.tags ?? []) set.add(t);
  return [...set].sort();
}
