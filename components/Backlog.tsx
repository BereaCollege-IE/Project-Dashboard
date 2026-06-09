"use client";

// Backlog view: every project and its unscheduled tasks. Each task can be
// checked off, deleted, or pulled into today's schedule (which creates a block
// for that project carrying the task as its subtask). You can also add a new
// task (with an optional due date) to any project, and create a brand-new
// project. Each project is a collapsible card so a long list stays manageable.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import {
  compareTasksByDue,
  formatDueDate,
  isOverdue,
} from "@/lib/data";
import type { Project, Subtask } from "@/lib/types";

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
      className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm p-3"
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
  const { actions } = useDashboard();
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");

  const tasks = [...(project.tasks ?? [])].sort(compareTasksByDue);
  const pending = tasks.filter((t) => !t.done).length;

  return (
    <details open className="rounded-lg border border-gray-200 bg-white/80 shadow-sm backdrop-blur-sm">
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
        <span className="text-sm font-medium">{project.title}</span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {project.dueDate && (
            <span className="rounded bg-gray-100 px-2 py-0.5">
              Due {formatDueDate(project.dueDate)}
            </span>
          )}
          <span>{pending} open</span>
        </span>
      </summary>

      <div className="space-y-1 px-3 pb-3">
        {tasks.length === 0 && (
          <p className="text-xs text-gray-400">
            No tasks yet. Add one below.
          </p>
        )}

        {tasks.map((task: Subtask) => {
          const overdue = isOverdue(task.dueDate, today ?? "", task.done);
          return (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => actions.toggleBacklogTask(project.slug, task.id)}
              />
              <span className={task.done ? "text-gray-400 line-through" : ""}>
                {task.title}
              </span>
              {task.dueDate && (
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    overdue
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {formatDueDate(task.dueDate)}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {!task.done && (
                  <button
                    type="button"
                    onClick={() => actions.scheduleTask(project.slug, task.id)}
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs"
                  >
                    Schedule today
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    actions.deleteBacklogTask(project.slug, task.id)
                  }
                  className="text-xs text-gray-400 underline"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}

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
