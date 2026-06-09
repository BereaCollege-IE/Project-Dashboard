"use client";

// Stale project section. Surfaces active projects untouched for five or more
// days and offers a one-click "bump into today" that appends a fresh planned
// block for today and marks the project touched. Reads data and actions from
// the dashboard context; computes the stale list on the client.

import { useDashboard } from "./DashboardProvider";
import { daysBetween, getStaleProjects, STALE_AFTER_DAYS } from "@/lib/data";

export default function StaleProjects() {
  const { data, today, actions } = useDashboard();

  if (!today) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Stale projects</h2>
        <p className="text-sm text-gray-400">Checking…</p>
      </section>
    );
  }

  const projects = getStaleProjects(data, today);

  return (
    <section aria-labelledby="stale-heading" className="space-y-3">
      <h2 id="stale-heading" className="text-lg font-medium">
        Stale projects
      </h2>

      {projects.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing has gone quiet. Every active project has been touched in the
          last {STALE_AFTER_DAYS} days.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => {
            const idleDays = daysBetween(project.lastTouched, today);
            return (
              <li
                key={project.slug}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-medium">{project.title}</p>
                  <p className="text-xs text-gray-500">
                    Quiet for {idleDays} days
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => actions.bumpProject(project.slug)}
                  className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
                >
                  Bump into today
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
