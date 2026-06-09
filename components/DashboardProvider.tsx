"use client";

// Holds the live working copy of the projects data on the client and exposes
// mutation actions to the views. Edits apply optimistically (UI updates at once)
// and are persisted to GitHub through /api/projects on a short debounce so a
// burst of edits collapses into one commit instead of one commit per keystroke.
//
// "today" is computed on the client after mount, on purpose: the server runs in
// UTC on Vercel, so the user's local day is the source of truth for what counts
// as today and what counts as stale.

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
} from "@/lib/types";
import { todayISO } from "@/lib/data";
import * as mutate from "@/lib/mutations";

// How long to wait after the last edit before committing to GitHub.
const SAVE_DEBOUNCE_MS = 900;

// The next status when cycling a block forward.
const NEXT_STATUS: Record<BlockStatus, BlockStatus> = {
  planned: "in_progress",
  in_progress: "complete",
  complete: "planned",
};

// Default span for a freshly created block.
const DEFAULT_START = "09:00";
const DEFAULT_END = "10:00";

interface DashboardActions {
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
  // Move a scheduled block back out of Today, returning its tasks to the backlog
  unscheduleBlock: (blockId: string) => void;
  bumpProject: (slug: string) => void;
  // Backlog (project-level task list)
  addBacklogTask: (slug: string, title: string, dueDate?: string) => void;
  toggleBacklogTask: (slug: string, taskId: string) => void;
  deleteBacklogTask: (slug: string, taskId: string) => void;
  scheduleTask: (
    slug: string,
    taskId: string,
    startTime?: string,
    endTime?: string
  ) => void;
  // Create a brand-new project
  addProject: (title: string, dueDate?: string) => void;
}

interface DashboardContextValue {
  data: ProjectsData;
  today: string | null; // null until mounted on the client
  saving: boolean;
  error: string | null;
  actions: DashboardActions;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used inside a DashboardProvider.");
  }
  return ctx;
}

// Generate a unique id. Available in modern browsers; this only runs client-side.
function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

// Turn a project title into a url-safe slug. Falls back to "project" if the
// title has no usable characters.
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "project";
}

// Pick a slug not already used by another project, appending -2, -3, etc.
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs hold the latest values for the debounced save, which closes over them.
  const dataRef = useRef(data);
  const shaRef = useRef(initialSha);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the local day once we are on the client.
  useEffect(() => {
    setToday(todayISO());
  }, []);

  // Commit the current working copy to GitHub. Serialized by the debounce, so
  // only one of these is in flight at a time.
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
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `Save failed (${res.status}).`);
      }
      const json = (await res.json()) as { sha: string };
      shaRef.current = json.sha; // keep the SHA current for the next write
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      // We keep the optimistic local state so edits are not lost; the user can
      // retry with the next change. Surface what went wrong.
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

  // Apply a pure mutation: update both state and the ref, then queue a save.
  const apply = useCallback(
    (next: ProjectsData) => {
      dataRef.current = next;
      setData(next);
      scheduleSave();
    },
    [scheduleSave]
  );

  // Flush any pending save on unmount so a quick edit-then-leave still persists.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        void save();
      }
    };
  }, [save]);

  // Build the actions. Each guards on `today` being resolved first.
  const actions: DashboardActions = {
    addBlock: (slug, startTime = DEFAULT_START, endTime = DEFAULT_END) => {
      if (!today) return;
      const block: TimeBlock = {
        id: newId("blk"),
        date: today,
        startTime,
        endTime,
        status: "planned",
        order: 0, // assigned by the mutation
        subtasks: [],
      };
      apply(mutate.addBlock(dataRef.current, slug, block, today));
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
      apply(
        mutate.setBlockStatus(
          dataRef.current,
          blockId,
          NEXT_STATUS[current.status],
          today
        )
      );
    },
    reorderToday: (orderedIds) => {
      if (!today) return;
      apply(
        mutate.reorderBlocksForDay(dataRef.current, today, orderedIds, today)
      );
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
    unscheduleBlock: (blockId) => {
      if (!today) return;
      apply(mutate.unscheduleBlock(dataRef.current, blockId, today));
    },
    bumpProject: (slug) => {
      if (!today) return;
      const block: TimeBlock = {
        id: newId("blk"),
        date: today,
        startTime: DEFAULT_START,
        endTime: DEFAULT_END,
        status: "planned",
        order: 0, // assigned by the mutation
        subtasks: [],
      };
      apply(mutate.bumpProjectToToday(dataRef.current, slug, block, today));
    },
    addBacklogTask: (slug, title, dueDate) => {
      if (!today || !title.trim()) return;
      const task: Subtask = {
        id: newId("task"),
        title: title.trim(),
        done: false,
        ...(dueDate?.trim() ? { dueDate: dueDate.trim() } : {}),
      };
      apply(mutate.addBacklogTask(dataRef.current, slug, task, today));
    },
    toggleBacklogTask: (slug, taskId) => {
      if (!today) return;
      apply(mutate.toggleBacklogTask(dataRef.current, slug, taskId, today));
    },
    deleteBacklogTask: (slug, taskId) => {
      if (!today) return;
      apply(mutate.deleteBacklogTask(dataRef.current, slug, taskId, today));
    },
    scheduleTask: (slug, taskId, startTime = DEFAULT_START, endTime = DEFAULT_END) => {
      if (!today) return;
      const block: TimeBlock = {
        id: newId("blk"),
        date: today,
        startTime,
        endTime,
        status: "planned",
        order: 0, // assigned by the mutation
        subtasks: [], // the task is moved in by the mutation
      };
      apply(mutate.scheduleTaskToday(dataRef.current, slug, taskId, block, today));
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
  };

  return (
    <DashboardContext.Provider value={{ data, today, saving, error, actions }}>
      {children}
    </DashboardContext.Provider>
  );
}
