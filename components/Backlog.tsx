"use client";

// Backlog view: every project and its unscheduled tasks. You can check off,
// schedule, delete, edit, or add tasks (with an optional due date), edit the
// project itself (title, due date, status, description), and create new
// projects. Each project is a collapsible card.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import {
  compareTasksByDue,
  formatDueDate,
  isOverdue,
} from "@/lib/data";
import type { Project, ProjectStatus, Subtask } from "@/lib/types";

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

export default function Backlog() {
  const { data, today, actions } = useDashboard();
  const [showNew, setShowNew] = useState(false);

  return (
    <section aria-labelledby="backlog-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="backlog-heading" className="text-lg font-medium">
          Projects &amp; backlog
        </h2>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
        >
          {showNew ? "Close" : "New project"}
        </button>
      </div>

      {showNew && (
        <NewProjectForm
          onAdd={(title, due) => {
            actions.addProject(title, due);
            setShowNew(false);
          }}
        />
      )}

      {data.projects.length === 0 ? (
        <p className="text-sm text-gray-500">
          No projects yet. Use New project to create one.
        </p>
      ) : (
        <div className="space-y-3">
          {data.projects.map((project) => (
            <ProjectCard key={project.slug} project={project} today={today} />
          ))}
        </div>
      )}
    </section>
  );
}

// Inline form to create a new project with a title and optional due date.
function NewProjectForm({
  onAdd,
}: {
  onAdd: (title: string, dueDate: string) => void;
}) {
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
      <button
        type="submit"
        className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
      >
        Create
      </button>
    </form>
  );
}

function ProjectCard({
  project,
  today,
}: {
  project: Project;
  today: string | null;
}) {
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");
  const [editing, setEditing] = useState(false);
  const { actions } = useDashboard();

  const tasks = [...(project.tasks ?? [])].sort(compareTasksByDue);
  const pending = tasks.filter((t) => !t.done).length;

  return (
    <details open className="rounded-lg border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm">
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
        <span className="text-sm font-medium">{project.title}</span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {project.status !== "active" && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-gray-700">
              {STATUS_LABEL[project.status]}
            </span>
          )}
          {project.dueDate && (
            <span className="rounded bg-gray-100 px-2 py-0.5">
              Due {formatDueDate(project.dueDate)}
            </span>
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
          <p className="text-xs text-gray-400">No tasks yet. Add one below.</p>
        )}

        {tasks.map((task: Subtask) => (
          <BacklogTaskRow
            key={task.id}
            slug={project.slug}
            task={task}
            today={today}
          />
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            actions.addBacklogTask(project.slug, newTask, newDue);
            setNewTask("");
            setNewDue("");
          }}
          className="mt-2 flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task to this project"
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            placeholder='Due (optional): 2026-07-15 or "Summer 2026"'
            className="w-56 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            Add
          </button>
        </form>
      </div>
    </details>
  );
}

// Inline editor for a project's title, due date, status, and description.
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
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [due, setDue] = useState(project.dueDate ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [description, setDescription] = useState(project.description);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSave({ title, dueDate: due, status, description });
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
            placeholder='2026-09-01 or "Fall 2026"'
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
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// One backlog task: toggles between a display row and an inline edit row.
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

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          actions.updateBacklogTask(slug, task.id, { title, dueDate: due });
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
          placeholder='Due (optional)'
          className="w-48 rounded border border-gray-300 px-2 py-1"
        />
        <button
          type="submit"
          className="rounded bg-gray-900 px-2 py-1 text-xs text-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle(task.title);
            setDue(task.dueDate ?? "");
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
      <span className={task.done ? "text-gray-400 line-through" : ""}>
        {task.title}
      </span>
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
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-gray-500 underline"
        >
          Edit
        </button>
        {!task.done && (
          <button
            type="button"
            onClick={() => actions.scheduleTask(slug, task.id)}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs"
          >
            Schedule today
          </button>
        )}
        <button
          type="button"
          onClick={() => actions.deleteBacklogTask(slug, task.id)}
          className="text-xs text-gray-400 underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
