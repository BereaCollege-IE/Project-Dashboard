"use client";

// Backlog view: every project and its tasks, with search, sort, and tag
// filtering. Tasks support priority and recurrence; projects support tags. You
// can check off, schedule, edit, add, and break down tasks, and edit projects.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import {
  compareTasksByDue,
  comparePriority,
  formatDueDate,
  isOverdue,
  getAllTags,
} from "@/lib/data";
import type { Project, ProjectStatus, Priority, Recurrence, Subtask } from "@/lib/types";

type SortKey = "due" | "priority" | "title";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "complete", label: "Complete" },
];
const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  complete: "Complete",
};
const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-gray-100 text-gray-600",
};

export default function Backlog() {
  const { data, today, actions } = useDashboard();
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [tag, setTag] = useState("");

  const allTags = getAllTags(data);
  const q = query.trim().toLowerCase();

  const projects = data.projects.filter((p) => {
    // Completed projects live in the Archive section, not here.
    if (p.status === "complete") return false;
    if (tag && !(p.tags ?? []).includes(tag)) return false;
    if (!q) return true;
    if (p.title.toLowerCase().includes(q)) return true;
    return (p.tasks ?? []).some((t) => t.title.toLowerCase().includes(q));
  });

  return (
    <section aria-labelledby="backlog-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="backlog-heading" className="text-lg font-bold uppercase tracking-wide">
          Projects &amp; tasks
        </h2>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
        >
          {showNew ? "Close" : "New project"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects and tasks"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          aria-label="Sort tasks"
        >
          <option value="due">Sort: due date</option>
          <option value="priority">Sort: priority</option>
          <option value="title">Sort: title</option>
        </select>
        {allTags.length > 0 && (
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label="Filter by tag"
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      {showNew && (
        <NewProjectForm
          onAdd={(title, due) => {
            actions.addProject(title, due);
            setShowNew(false);
          }}
        />
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">No projects match your search.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} today={today} sort={sort} query={q} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewProjectForm({ onAdd }: { onAdd: (title: string, dueDate: string) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onAdd(title, due);
      }}
      className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm"
    >
      <label className="flex flex-1 flex-col text-xs text-gray-600">
        Project title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Faculty Handbook Revision"
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col text-xs text-gray-600">
        Due date (optional)
        <input
          type="text"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          placeholder='2026-09-01 or "Fall 2026"'
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
        Create
      </button>
    </form>
  );
}

function ProjectCard({
  project,
  today,
  sort,
  query,
}: {
  project: Project;
  today: string | null;
  sort: SortKey;
  query: string;
}) {
  const { actions } = useDashboard();
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<Priority | "">("");
  const [newRecurrence, setNewRecurrence] = useState<Recurrence | "">("");
  const [editing, setEditing] = useState(false);

  const comparator =
    sort === "priority"
      ? comparePriority
      : sort === "title"
        ? (a: Subtask, b: Subtask) =>
            a.done === b.done ? a.title.localeCompare(b.title) : a.done ? 1 : -1
        : compareTasksByDue;

  let tasks = [...(project.tasks ?? [])].sort(comparator);
  if (query) tasks = tasks.filter((t) => t.title.toLowerCase().includes(query));
  const pending = (project.tasks ?? []).filter((t) => !t.done).length;

  return (
    <details
      open
      id={`project-${project.slug}`}
      className="scroll-mt-6 rounded-lg border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          {project.title}
          {(project.tags ?? []).map((t) => (
            <span key={t} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
              {t}
            </span>
          ))}
        </span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {project.status !== "active" && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-gray-700">
              {STATUS_LABEL[project.status]}
            </span>
          )}
          {project.dueDate && (
            <span className="rounded bg-gray-100 px-2 py-0.5">Due {formatDueDate(project.dueDate)}</span>
          )}
          <span>{pending} open</span>
        </span>
      </summary>

      <div className="space-y-1 px-3 pb-3">
        {editing ? (
          <ProjectEditForm
            project={project}
            onSave={(patch) => {
              actions.updateProject(project.slug, patch);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-center justify-between">
            {project.description ? (
              <p className="text-xs text-gray-500">{project.description}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-gray-500 underline"
            >
              Edit project
            </button>
          </div>
        )}

        {tasks.length === 0 && (
          <p className="text-xs text-gray-400">No tasks to show.</p>
        )}

        {tasks.map((task) => (
          <BacklogTaskRow key={task.id} slug={project.slug} task={task} today={today} />
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            actions.addBacklogTask(project.slug, newTask, newDue, {
              priority: newPriority || undefined,
              recurrence: newRecurrence || undefined,
            });
            setNewTask("");
            setNewDue("");
            setNewPriority("");
            setNewRecurrence("");
          }}
          className="mt-2 flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task"
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            placeholder="Due (optional)"
            className="w-40 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority | "")}
            className="rounded border border-gray-200 px-2 py-1 text-sm"
            aria-label="Priority"
          >
            <option value="">Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={newRecurrence}
            onChange={(e) => setNewRecurrence(e.target.value as Recurrence | "")}
            className="rounded border border-gray-200 px-2 py-1 text-sm"
            aria-label="Repeat"
          >
            <option value="">No repeat</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button type="submit" className="rounded border border-gray-300 px-2 py-1 text-xs">
            Add
          </button>
        </form>
      </div>
    </details>
  );
}

function ProjectEditForm({
  project,
  onSave,
  onCancel,
}: {
  project: Project;
  onSave: (patch: {
    title: string;
    dueDate: string;
    status: ProjectStatus;
    description: string;
    tags: string[];
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [due, setDue] = useState(project.dueDate ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [description, setDescription] = useState(project.description);
  const [tags, setTags] = useState((project.tags ?? []).join(", "));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim())
          onSave({
            title,
            dueDate: due,
            status,
            description,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          });
      }}
      className="space-y-2 rounded border border-gray-200 bg-gray-50/70 p-3"
    >
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 flex-col text-xs text-gray-600">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Due date
          <input
            type="text"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col text-xs text-gray-600">
        Tags (comma separated)
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="accreditation, teaching"
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col text-xs text-gray-600">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
          Save
        </button>
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-1 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function BacklogTaskRow({
  slug,
  task,
  today,
}: {
  slug: string;
  task: Subtask;
  today: string | null;
}) {
  const { actions } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(task.dueDate ?? "");
  const [priority, setPriority] = useState<Priority | "">(task.priority ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence | "">(task.recurrence ?? "");

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          actions.updateBacklogTask(slug, task.id, {
            title,
            dueDate: due,
            priority: priority || undefined,
            recurrence: recurrence || undefined,
          });
          setEditing(false);
        }}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <input
          type="text"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          placeholder="Due"
          className="w-36 rounded border border-gray-300 px-2 py-1"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | "")}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value="">Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value="">No repeat</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button type="submit" className="rounded bg-gray-900 px-2 py-1 text-xs text-white">
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle(task.title);
            setDue(task.dueDate ?? "");
            setPriority(task.priority ?? "");
            setRecurrence(task.recurrence ?? "");
            setEditing(false);
          }}
          className="text-xs text-gray-500 underline"
        >
          Cancel
        </button>
      </form>
    );
  }

  const overdue = isOverdue(task.dueDate, today ?? "", task.done);
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => actions.toggleBacklogTask(slug, task.id)}
      />
      <span className={task.done ? "text-gray-400 line-through" : ""}>{task.title}</span>
      {task.priority && (
        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${PRIORITY_STYLE[task.priority]}`}>
          {task.priority}
        </span>
      )}
      {task.recurrence && (
        <span className="text-xs text-gray-400" title={`Repeats ${task.recurrence}`}>
          ↻
        </span>
      )}
      {task.dueDate && (
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {formatDueDate(task.dueDate)}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-500 underline">
          Edit
        </button>
        {!task.done && (
          <button
            type="button"
            onClick={() => actions.scheduleTask(slug, task.id)}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs"
          >
            Schedule
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete the task "${task.title}"?`)) {
              actions.deleteBacklogTask(slug, task.id);
            }
          }}
          className="text-xs text-gray-400 underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
