// Shared data types for the project dashboard.
// These mirror the JSON schema in schema/projects.schema.json. Keep them in sync.

// A single time block can be in one of three states.
export type BlockStatus = "planned" | "in_progress" | "complete";

// The project as a whole has its own lifecycle status.
export type ProjectStatus = "active" | "paused" | "complete";

// A checklist item. Used both inside a time block and in a project's backlog.
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  // Optional deadline kept verbatim from the source. ISO YYYY-MM-DD for an exact
  // day, or a phrase like "Summer 2026" or "now through August 1, 2026".
  dueDate?: string;
}

// A flexible block of time on a given day, belonging to one project.
export interface TimeBlock {
  id: string;
  date: string; // calendar day this block sits on, as YYYY-MM-DD
  startTime: string; // HH:MM, 24 hour
  endTime: string; // HH:MM, 24 hour
  status: BlockStatus;
  order: number; // position within the day, used for drag reordering
  subtasks: Subtask[];
}

// A project and everything scheduled under it.
export interface Project {
  slug: string; // stable id, e.g. "accreditation-self-study"
  title: string;
  description: string;
  status: ProjectStatus;
  lastTouched: string; // ISO date string, updated on any edit to the project
  // Optional project-level deadline, free text (ISO day or a phrase).
  dueDate?: string;
  // Backlog: tasks captured but not yet scheduled into a time block.
  tasks?: Subtask[];
  blocks: TimeBlock[];
}

// The full document stored in GitHub.
export interface ProjectsData {
  projects: Project[];
}

// A block flattened with its parent project context, for the daily view
// where blocks from several projects are shown together.
export interface ScheduledBlock extends TimeBlock {
  projectSlug: string;
  projectTitle: string;
}
