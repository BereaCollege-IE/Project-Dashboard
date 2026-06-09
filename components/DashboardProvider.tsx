"use client";

// Holds the live working copy of the projects data on the client and exposes
// mutation actions to the views. Edits apply optimistically and persist to
// GitHub on a short debounce. Also owns the viewed day (for planning other
// days), a multi-level undo stack, and the user settings.
//
// "today" and the viewed day are resolved on the client after mount, on purpose:
// the server runs in UTC on Vercel, so the user's local day is the source of
// truth for what counts as today and what counts as stale.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ProjectsData,
  Project,
  TimeBlock,
  Subtask,
  BlockStatus,
  ProjectStatus,
  Priority,
  Recurrence,
  Settings,
} from "@/lib/types";
import {
  todayISO,
  addDays,
  addMinutesToTime,
  advanceDueDate,
  isISODate,
  getSettings,
} from "@/lib/data";
import * as mutate from "@/lib/mutations";

// How long to wait after the last edit before committing to GitHub.
const SAVE_DEBOUNCE_MS = 900;

// The next status when cycling a block forward.
const NEXT_STATUS: Record<BlockStatus, BlockStatus> = {
  planned: "in_progress",
  in_progress: "complete",
  complete: "planned",
};

interface TaskOptions {
  priority?: Priority;
  recurrence?: Recurrence;
}

interface DashboardActions {
  // Schedule (operates on the currently viewed day)
  addBlock: (slug: string, startTime?: string, endTime?: string) => void;
  updateBlock: (
    blockId: string,
    patch: Partial<Pick<TimeBlock, "startTime" | "endTime">>
  ) => void;
  deleteBlock: (blockId: string) => void;
  cycleStatus: (blockId: string) => void;
  reorderToday: (orderedIds: string[]) => void;
  addSubtask: (blockId: string, title: string, dueDate?: string) => void;
  toggleSubtask: (blockId: string, subtaskId: string) => void;
  deleteSubtask: (blockId: string, subtaskId: string) => void;
  updateSubtask: (
    blockId: string,
    subtaskId: string,
    patch: { title?: string; dueDate?: string }
  ) => void;
  unscheduleBlock: (blockId: string) => void;
  bumpProject: (slug: string) => void;
  // Backlog
  addBacklogTask: (
    slug: string,
    title: string,
    dueDate?: string,
    opts?: TaskOptions
  ) => void;
  toggleBacklogTask: (slug: string, taskId: string) => void;
  deleteBacklogTask: (slug: string, taskId: string) => void;
  updateBacklogTask: (
    slug: string,
    taskId: string,
    patch: { title?: string; dueDate?: string; priority?: Priority; recurrence?: Recurrence }
  ) => void;
  scheduleTask: (
    slug: string,
    taskId: string,
    startTime?: string,
    endTime?: string
  ) => void;
  // Projects
  addProject: (title: string, dueDate?: string) => void;
  updateProject: (
    slug: string,
    patch: {
      title?: string;
      description?: string;
      dueDate?: string;
      status?: ProjectStatus;
      tags?: string[];
    }
  ) => void;
  // Day navigation
  goToDay: (delta: number) => void;
  goToToday: () => void;
  // Undo + settings
  undo: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

interface DashboardContextValue {
  data: ProjectsData;
  today: string | null;
  viewedDay: string | null;
  settings: ReturnType<typeof getSettings>;
  saving: boolean;
  error: string | null;
  canUndo: boolean;
  actions: DashboardActions;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside a DashboardProvider.");
  return ctx;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "project";
}

function uniqueSlug(title: string, existing: ProjectsData): string {
  const taken = new Set(existing.projects.map((p) => p.slug));
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

interface DashboardProviderProps {
  initialData: ProjectsData;
  initialSha: string;
  children: React.ReactNode;
}

export default function DashboardProvider({
  initialData,
  initialSha,
  children,
}: DashboardProviderProps) {
  const [data, setData] = useState<ProjectsData>(initialData);
  const [today, setToday] = useState<string | null>(null);
  const [viewedDay, setViewedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);

  const dataRef = useRef(data);
  const shaRef = useRef(initialSha);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<ProjectsData[]>([]);

  const settings = getSettings(data);

  useEffect(() => {
    const t = todayISO();
    setToday(t);
    setViewedDay(t);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataRef.current, sha: shaRef.current }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Save failed (${res.status}).`);
      }
      const json = (await res.json()) as { sha: string };
      shaRef.current = json.sha;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`${message} Your latest change is shown but not yet saved.`);
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, SAVE_DEBOUNCE_MS);
  }, [save]);

  // Apply a pure mutation: snapshot the prior state for undo, update state and
  // ref, then queue a save.
  const apply = useCallback(
    (next: ProjectsData) => {
      undoRef.current.push(dataRef.current);
      if (undoRef.current.length > 25) undoRef.current.shift();
      setUndoDepth(undoRef.current.length);
      dataRef.current = next;
      setData(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    setUndoDepth(undoRef.current.length);
    dataRef.current = prev;
    setData(prev);
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void save();
      }
    };
  }, [save]);

  const day = viewedDay ?? today;
  const cfg = getSettings(dataRef.current);
  const defaultStart = cfg.defaultStartTime;
  const defaultEnd = addMinutesToTime(defaultStart, cfg.defaultBlockMinutes);

  const actions: DashboardActions = {
    addBlock: (slug, startTime = defaultStart, endTime = defaultEnd) => {
      if (!day) return;
      const block: TimeBlock = {
        id: newId("blk"),
        date: day,
        startTime,
        endTime,
        status: "planned",
        order: 0,
        subtasks: [],
      };
      apply(mutate.addBlock(dataRef.current, slug, block, today!));
    },
    updateBlock: (blockId, patch) => {
      if (!today) return;
      apply(mutate.updateBlock(dataRef.current, blockId, patch, today));
    },
    deleteBlock: (blockId) => {
      if (!today) return;
      apply(mutate.deleteBlock(dataRef.current, blockId, today));
    },
    cycleStatus: (blockId) => {
      if (!today) return;
      const current = dataRef.current.projects
        .flatMap((p) => p.blocks)
        .find((b) => b.id === blockId);
      if (!current) return;
      apply(mutate.setBlockStatus(dataRef.current, blockId, NEXT_STATUS[current.status], today));
    },
    reorderToday: (orderedIds) => {
      if (!day) return;
      apply(mutate.reorderBlocksForDay(dataRef.current, day, orderedIds, today!));
    },
    addSubtask: (blockId, title, dueDate) => {
      if (!today || !title.trim()) return;
      const subtask: Subtask = {
        id: newId("sub"),
        title: title.trim(),
        done: false,
        ...(dueDate?.trim() ? { dueDate: dueDate.trim() } : {}),
      };
      apply(mutate.addSubtask(dataRef.current, blockId, subtask, today));
    },
    toggleSubtask: (blockId, subtaskId) => {
      if (!today) return;
      apply(mutate.toggleSubtask(dataRef.current, blockId, subtaskId, today));
    },
    deleteSubtask: (blockId, subtaskId) => {
      if (!today) return;
      apply(mutate.deleteSubtask(dataRef.current, blockId, subtaskId, today));
    },
    updateSubtask: (blockId, subtaskId, patch) => {
      if (!today) return;
      const next = { ...patch };
      if (next.dueDate !== undefined) next.dueDate = next.dueDate.trim() || undefined;
      if (next.title !== undefined) {
        const t = next.title.trim();
        if (!t) return;
        next.title = t;
      }
      apply(mutate.updateSubtask(dataRef.current, blockId, subtaskId, next, today));
    },
    unscheduleBlock: (blockId) => {
      if (!today) return;
      apply(mutate.unscheduleBlock(dataRef.current, blockId, today));
    },
    bumpProject: (slug) => {
      if (!today) return;
      const block: TimeBlock = {
        id: newId("blk"),
        date: today,
        startTime: defaultStart,
        endTime: defaultEnd,
        status: "planned",
        order: 0,
        subtasks: [],
      };
      apply(mutate.bumpProjectToToday(dataRef.current, slug, block, today));
    },
    addBacklogTask: (slug, title, dueDate, opts) => {
      if (!today || !title.trim()) return;
      const task: Subtask = {
        id: newId("task"),
        title: title.trim(),
        done: false,
        ...(dueDate?.trim() ? { dueDate: dueDate.trim() } : {}),
        ...(opts?.priority ? { priority: opts.priority } : {}),
        ...(opts?.recurrence ? { recurrence: opts.recurrence } : {}),
      };
      apply(mutate.addBacklogTask(dataRef.current, slug, task, today));
    },
    toggleBacklogTask: (slug, taskId) => {
      if (!today) return;
      const cur = dataRef.current;
      const task = cur.projects.find((p) => p.slug === slug)?.tasks?.find((t) => t.id === taskId);
      let next = mutate.toggleBacklogTask(cur, slug, taskId, today);
      // Completing a recurring, exact-dated task spawns the next occurrence.
      if (task && !task.done && task.recurrence && isISODate(task.dueDate)) {
        const nextTask: Subtask = {
          id: newId("task"),
          title: task.title,
          done: false,
          dueDate: advanceDueDate(task.dueDate!, task.recurrence),
          ...(task.priority ? { priority: task.priority } : {}),
          recurrence: task.recurrence,
        };
        next = mutate.addBacklogTask(next, slug, nextTask, today);
      }
      apply(next);
    },
    deleteBacklogTask: (slug, taskId) => {
      if (!today) return;
      apply(mutate.deleteBacklogTask(dataRef.current, slug, taskId, today));
    },
    updateBacklogTask: (slug, taskId, patch) => {
      if (!today) return;
      const next = { ...patch };
      if (next.dueDate !== undefined) next.dueDate = next.dueDate.trim() || undefined;
      if (next.title !== undefined) {
        const t = next.title.trim();
        if (!t) return;
        next.title = t;
      }
      apply(mutate.updateBacklogTask(dataRef.current, slug, taskId, next, today));
    },
    scheduleTask: (slug, taskId, startTime = defaultStart, endTime = defaultEnd) => {
      if (!day) return;
      const block: TimeBlock = {
        id: newId("blk"),
        date: day,
        startTime,
        endTime,
        status: "planned",
        order: 0,
        subtasks: [],
      };
      apply(mutate.scheduleTaskToday(dataRef.current, slug, taskId, block, today!));
    },
    addProject: (title, dueDate) => {
      if (!today || !title.trim()) return;
      const project: Project = {
        slug: uniqueSlug(title, dataRef.current),
        title: title.trim(),
        description: "",
        status: "active",
        lastTouched: today,
        ...(dueDate?.trim() ? { dueDate: dueDate.trim() } : {}),
        tasks: [],
        blocks: [],
      };
      apply(mutate.addProject(dataRef.current, project));
    },
    updateProject: (slug, patch) => {
      if (!today) return;
      const next = { ...patch };
      if (next.dueDate !== undefined) next.dueDate = next.dueDate.trim() || undefined;
      if (next.title !== undefined) {
        const t = next.title.trim();
        if (!t) return;
        next.title = t;
      }
      apply(mutate.updateProject(dataRef.current, slug, next, today));
    },
    goToDay: (delta) => {
      setViewedDay((d) => (d ? addDays(d, delta) : d));
    },
    goToToday: () => {
      setViewedDay(today);
    },
    undo,
    updateSettings: (patch) => {
      apply(mutate.updateSettings(dataRef.current, patch));
    },
  };

  return (
    <DashboardContext.Provider
      value={{
        data,
        today,
        viewedDay,
        settings,
        saving,
        error,
        canUndo: undoDepth > 0,
        actions,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
