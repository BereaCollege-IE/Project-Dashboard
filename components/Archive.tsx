"use client";

// Archive: completed projects, filed away for long-term storage. The section is
// collapsed by default and only appears once something has been completed. Each
// project keeps its task history (shown struck through) and can be restored,
// which sets its status back to active and returns it to Projects & tasks.

import { useDashboard } from "./DashboardProvider";
import { formatDueDate } from "@/lib/data";
import type { Project } from "@/lib/types";

export default function Archive() {
  const { data } = useDashboard();
  const archived = data.projects.filter((p) => p.status === "complete");

  // Nothing completed yet, so there is nothing to file away. Hide the section.
  if (archived.length === 0) return null;

  return (
    <section aria-labelledby="archive-heading">
      <details className="group space-y-3">
        <summary className="flex cursor-pointer items-center gap-2">
          <span
            className="text-gray-400 transition-transform group-open:rotate-90"
            aria-hidden="true"
          >
            ›
          </span>
          <h2 id="archive-heading" className="text-lg font-bold uppercase tracking-wide">
            Archive
          </h2>
          <span className="text-xs text-gray-500">
            {archived.length} completed{" "}
            {archived.length === 1 ? "project" : "projects"}
          </span>
        </summary>

        <div className="mt-3 space-y-3">
          {archived.map((project) => (
            <ArchivedProjectCard key={project.slug} project={project} />
          ))}
        </div>
      </details>
    </section>
  );
}

function ArchivedProjectCard({ project }: { project: Project }) {
  const { actions } = useDashboard();
  const tasks = project.tasks ?? [];
  const done = tasks.filter((t) => t.done).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/70 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {project.title}
            {(project.tags ?? []).map((t) => (
              <span
                key={t}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
              >
                {t}
              </span>
            ))}
          </p>
          <p className="text-xs text-gray-500">
            {tasks.length === 0
              ? "No tasks"
              : `${done}/${tasks.length} tasks done`}
            {project.dueDate && ` · was due ${formatDueDate(project.dueDate)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => actions.updateProject(project.slug, { status: "active" })}
          className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs"
          title="Move this project back to Projects & tasks"
        >
          Restore
        </button>
      </div>

      {tasks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-2 text-xs">
              <span
                className={task.done ? "text-gray-400 line-through" : "text-gray-600"}
              >
                {task.title}
              </span>
              {task.dueDate && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                  {formatDueDate(task.dueDate)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
