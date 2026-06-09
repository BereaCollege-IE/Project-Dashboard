"use client";

// Upcoming deadlines: every exact-dated, not-done task or project deadline due
// within a window (plus anything overdue), sorted soonest first. The mirror of
// the stale section: this shows what is coming due, across all projects.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import { getUpcomingDeadlines, formatDueDate, daysBetween } from "@/lib/data";

export default function UpcomingDeadlines() {
  const { data, today, actions } = useDashboard();
  const [windowDays, setWindowDays] = useState(14);

  if (!today) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Upcoming deadlines</h2>
        <p className="text-sm text-gray-400">Checking…</p>
      </section>
    );
  }

  const deadlines = getUpcomingDeadlines(data, today, windowDays);

  return (
    <section aria-labelledby="deadlines-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="deadlines-heading" className="text-lg font-medium">
          Upcoming deadlines
        </h2>
        <label className="text-xs text-gray-500">
          Next{" "}
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
            className="rounded border border-gray-300 px-1 py-0.5 text-xs"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </label>
      </div>

      {deadlines.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing with an exact date is due in this window.
        </p>
      ) : (
        <ul className="space-y-2">
          {deadlines.map((d) => {
            const diff = daysBetween(today, d.dueDate);
            const overdue = diff < 0;
            const dueLabel =
              diff === 0 ? "today" : diff < 0 ? `${-diff}d overdue` : `in ${diff}d`;
            return (
              <li
                key={`${d.projectSlug}-${d.taskId ?? "project"}-${d.dueDate}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {d.title}
                    {d.priority && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                        {d.priority}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{d.projectTitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatDueDate(d.dueDate)} · {dueLabel}
                  </span>
                  {d.kind === "task" && d.taskId && (
                    <button
                      type="button"
                      onClick={() => actions.scheduleTask(d.projectSlug, d.taskId!)}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs"
                    >
                      Schedule
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
