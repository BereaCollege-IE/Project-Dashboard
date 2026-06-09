// Pure mutation helpers. Each takes the full ProjectsData and returns a new
// ProjectsData without touching the original. No I/O and no Date.now() in here,
// so they are deterministic and easy to test. Callers pass in ids and "today"
// so these stay pure.
//
// Any edit to a project bumps its lastTouched to the supplied `today`, which is
// what keeps the stale section honest.

import type {
  ProjectsData,
  Project,
  TimeBlock,
  Subtask,
  BlockStatus,
  Settings,
} from "./types";

// Replace the one project that owns `blockId`, leaving the rest untouched.
function mapProjectOwning(
  data: ProjectsData,
  blockId: string,
  fn: (project: Project) => Project
): ProjectsData {
  return {
    projects: data.projects.map((p) =>
      p.blocks.some((b) => b.id === blockId) ? fn(p) : p
    ),
  };
}

// Replace one block inside a project.
function mapBlock(
  project: Project,
  blockId: string,
  fn: (block: TimeBlock) => TimeBlock
): Project {
  return {
    ...project,
    blocks: project.blocks.map((b) => (b.id === blockId ? fn(b) : b)),
  };
}

// Highest `order` currently used on a given day, across all projects.
// Returns -1 when the day is empty so the first block lands at order 0.
function maxOrderForDay(data: ProjectsData, date: string): number {
  let max = -1;
  for (const project of data.projects) {
    for (const block of project.blocks) {
      if (block.date === date && block.order > max) max = block.order;
    }
  }
  return max;
}

// Append a fully-formed block to a project and mark the project touched.
// The caller supplies the block (with its id); we only assign its day order.
export function addBlock(
  data: ProjectsData,
  slug: string,
  block: TimeBlock,
  today: string
): ProjectsData {
  const order = maxOrderForDay(data, block.date) + 1;
  const placed: TimeBlock = { ...block, order };
  return {
    projects: data.projects.map((p) =>
      p.slug === slug
        ? { ...p, blocks: [...p.blocks, placed], lastTouched: today }
        : p
    ),
  };
}

// Patch a block's fields (times, status, etc.) and touch its project.
export function updateBlock(
  data: ProjectsData,
  blockId: string,
  patch: Partial<Omit<TimeBlock, "id" | "subtasks">>,
  today: string
): ProjectsData {
  return mapProjectOwning(data, blockId, (p) => ({
    ...mapBlock(p, blockId, (b) => ({ ...b, ...patch })),
    lastTouched: today,
  }));
}

// Remove a block entirely and touch its project.
export function deleteBlock(
  data: ProjectsData,
  blockId: string,
  today: string
): ProjectsData {
  return mapProjectOwning(data, blockId, (p) => ({
    ...p,
    blocks: p.blocks.filter((b) => b.id !== blockId),
    lastTouched: today,
  }));
}

// Set a block's status. Thin wrapper over updateBlock for clarity at call sites.
export function setBlockStatus(
  data: ProjectsData,
  blockId: string,
  status: BlockStatus,
  today: string
): ProjectsData {
  return updateBlock(data, blockId, { status }, today);
}

// Reassign `order` for one day based on the given id sequence. Blocks on other
// days are left alone. Every project that owns a reordered block is touched.
export function reorderBlocksForDay(
  data: ProjectsData,
  day: string,
  orderedIds: string[],
  today: string
): ProjectsData {
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  return {
    projects: data.projects.map((project) => {
      let changed = false;
      const blocks = project.blocks.map((b) => {
        if (b.date === day && orderById.has(b.id)) {
          changed = true;
          return { ...b, order: orderById.get(b.id)! };
        }
        return b;
      });
      return changed ? { ...project, blocks, lastTouched: today } : project;
    }),
  };
}

// Add a subtask to a block. Caller supplies the subtask (with its id).
export function addSubtask(
  data: ProjectsData,
  blockId: string,
  subtask: Subtask,
  today: string
): ProjectsData {
  return mapProjectOwning(data, blockId, (p) => ({
    ...mapBlock(p, blockId, (b) => ({
      ...b,
      subtasks: [...b.subtasks, subtask],
    })),
    lastTouched: today,
  }));
}

// Flip a subtask's done flag.
export function toggleSubtask(
  data: ProjectsData,
  blockId: string,
  subtaskId: string,
  today: string
): ProjectsData {
  return mapProjectOwning(data, blockId, (p) => ({
    ...mapBlock(p, blockId, (b) => ({
      ...b,
      subtasks: b.subtasks.map((s) =>
        s.id === subtaskId
          ? { ...s, done: !s.done, completedAt: !s.done ? today : undefined }
          : s
      ),
    })),
    lastTouched: today,
  }));
}

// Remove a subtask.
export function deleteSubtask(
  data: ProjectsData,
  blockId: string,
  subtaskId: string,
  today: string
): ProjectsData {
  return mapProjectOwning(data, blockId, (p) => ({
    ...mapBlock(p, blockId, (b) => ({
      ...b,
      subtasks: b.subtasks.filter((s) => s.id !== subtaskId),
    })),
    lastTouched: today,
  }));
}

// Bump a stale project back into today: append a fresh planned block for today
// and mark the project touched. The caller supplies the new block.
export function bumpProjectToToday(
  data: ProjectsData,
  slug: string,
  block: TimeBlock,
  today: string
): ProjectsData {
  return addBlock(data, slug, block, today);
}

// --- Backlog (project-level task list) ---

// Add a task to a project's backlog. Caller supplies the task (with its id).
export function addBacklogTask(
  data: ProjectsData,
  slug: string,
  task: Subtask,
  today: string
): ProjectsData {
  return {
    projects: data.projects.map((p) =>
      p.slug === slug
        ? { ...p, tasks: [...(p.tasks ?? []), task], lastTouched: today }
        : p
    ),
  };
}

// Flip the done flag on a backlog task. Stamps completedAt when marking done,
// clears it when un-completing (used for "completed this week" stats).
export function toggleBacklogTask(
  data: ProjectsData,
  slug: string,
  taskId: string,
  today: string
): ProjectsData {
  return {
    projects: data.projects.map((p) =>
      p.slug === slug
        ? {
            ...p,
            tasks: (p.tasks ?? []).map((t) =>
              t.id === taskId
                ? { ...t, done: !t.done, completedAt: !t.done ? today : undefined }
                : t
            ),
            lastTouched: today,
          }
        : p
    ),
  };
}

// Remove a backlog task.
export function deleteBacklogTask(
  data: ProjectsData,
  slug: string,
  taskId: string,
  today: string
): ProjectsData {
  return {
    projects: data.projects.map((p) =>
      p.slug === slug
        ? {
            ...p,
            tasks: (p.tasks ?? []).filter((t) => t.id !== taskId),
            lastTouched: today,
          }
        : p
    ),
  };
}

// Move a backlog task into today's schedule: remove it from the backlog and
// append a new block (supplied by the caller) that carries the task as its one
// subtask. No-op if the task is not found. The project is touched.
export function scheduleTaskToday(
  data: ProjectsData,
  slug: string,
  taskId: string,
  block: TimeBlock,
  today: string
): ProjectsData {
  const project = data.projects.find((p) => p.slug === slug);
  const task = project?.tasks?.find((t) => t.id === taskId);
  if (!task) return data;

  const order = maxOrderForDay(data, block.date) + 1;
  const placed: TimeBlock = { ...block, order, subtasks: [task] };

  return {
    projects: data.projects.map((p) =>
      p.slug === slug
        ? {
            ...p,
            tasks: (p.tasks ?? []).filter((t) => t.id !== taskId),
            blocks: [...p.blocks, placed],
            lastTouched: today,
          }
        : p
    ),
  };
}

// Reverse of scheduling: remove a block from the schedule and return its
// subtasks to the owning project's backlog. An empty block is simply removed.
// The project is touched. No-op if the block is not found.
export function unscheduleBlock(
  data: ProjectsData,
  blockId: string,
  today: string
): ProjectsData {
  return {
    projects: data.projects.map((p) => {
      const block = p.blocks.find((b) => b.id === blockId);
      if (!block) return p;
      return {
        ...p,
        tasks: [...(p.tasks ?? []), ...block.subtasks],
        blocks: p.blocks.filter((b) => b.id !== blockId),
        lastTouched: today,
      };
    }),
  };
}

// --- Projects ---

// Append a brand-new project. The caller supplies the fully-formed project
// (with a unique slug already chosen).
export function addProject(
  data: ProjectsData,
  project: Project
): ProjectsData {
  return { projects: [...data.projects, project] };
}

// Update editable fields on a project (title, description, dueDate, status).
// The slug is intentionally not patchable, since tasks and history hang off it.
export function updateProject(
  data: ProjectsData,
  slug: string,
  patch: Partial<Pick<Project, "title" | "description" | "dueDate" | "status" | "tags">>,
  today: string
): ProjectsData {
  return {
    projects: data.projects.map((p) =>
      p.slug === slug ? { ...p, ...patch, lastTouched: today } : p
    ),
  };
}

// Merge a patch into the user settings.
export function updateSettings(
  data: ProjectsData,
  patch: Partial<Settings>
): ProjectsData {
  return { ...data, settings: { ...(data.settings ?? {}), ...patch } };
}

// --- Editing tasks ---

// Update a backlog task's title, due date, priority, and/or recurrence.
export function updateBacklogTask(
  data: ProjectsData,
  slug: string,
  taskId: string,
  patch: Partial<Pick<Subtask, "title" | "dueDate" | "priority" | "recurrence">>,
  today: string
): ProjectsData {
  return {
    projects: data.projects.map((p) =>
      p.slug === slug
        ? {
            ...p,
            tasks: (p.tasks ?? []).map((t) =>
              t.id === taskId ? { ...t, ...patch } : t
            ),
            lastTouched: today,
          }
        : p
    ),
  };
}

// Update a block subtask's title and/or due date.
export function updateSubtask(
  data: ProjectsData,
  blockId: string,
  subtaskId: string,
  patch: Partial<Pick<Subtask, "title" | "dueDate">>,
  today: string
): ProjectsData {
  return mapProjectOwning(data, blockId, (p) => ({
    ...mapBlock(p, blockId, (b) => ({
      ...b,
      subtasks: b.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, ...patch } : s
      ),
    })),
    lastTouched: today,
  }));
}
