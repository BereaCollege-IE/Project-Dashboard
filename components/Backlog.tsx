"use client";

// Backlog view: every project and its unscheduled tasks. Each task can be
// checked off, deleted, or pulled into today's schedule (which creates a block
// for that project carrying the task as its subtask). Each project is a
// collapsible card so a long list stays manageable.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import {
  compareTasksByDue,
  formatDueDate,
  isOverdue,
} from "@/lib/data";
import type { Project, Subtask } from "@/lib/types";

export default function Backlog() {
  const { data, today } = useDashboard();

  // Only show projects that actually have a backlog.
  const projects = data.projects.filter((p) => (p.tasks?.length ?? 0) > 0);

  return (
    <section aria-labelledby="backlog-heading" className="space-y-3">
      <h2 id="backlog-heading" className="text-lg font-medium">
        Projects &amp; backlog
      </h2>

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">
          No backlog tasks. Everything has been scheduled or cleared.
        </p>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard key={project.slug} project={project} today={today} />
          ))}
        </div>
      )}
    </section>
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

  const tasks = [...(project.tasks ?? [])].sort(compareTasksByDue);
  const pending = tasks.filter((t) => !t.done).length;

  return (
    <details open className="rounded-lg border border-gray-200 bg-white">
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
            actions.addBacklogTask(project.slug, newTask);
            setNewTask("");
          }}
          className="mt-2 flex gap-2"
        >
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task to this project"
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
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
