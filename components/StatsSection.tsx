"use client";

// Progress section: overall completion plus a per-project progress bar. Gives a
// sense of momentum without a charting library.

import { useDashboard } from "./DashboardProvider";
import { getStats } from "@/lib/data";

export default function StatsSection() {
  const { data, today } = useDashboard();
  if (!today) return null;

  const s = getStats(data, today);
  const pct = (done: number, total: number) =>
    total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <section aria-labelledby="stats-heading" className="space-y-3">
      <h2 id="stats-heading" className="text-lg font-bold uppercase tracking-wide">
        Progress
      </h2>

      <div className="rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Overall</span>
          <span className="text-gray-500">
            {s.doneTasks}/{s.totalTasks} tasks · {s.completedThisWeek} done this week
          </span>
        </div>
        <Bar percent={pct(s.doneTasks, s.totalTasks)} />

        <ul className="mt-4 space-y-2">
          {s.perProject
            .filter((p) => p.total > 0)
            .map((p) => (
              <li key={p.slug} className="text-xs">
                <div className="flex items-center justify-between">
                  {/* Jump to this project's card in Projects & tasks, opening
                      it first in case it was collapsed. */}
                  <a
                    href={`#project-${p.slug}`}
                    onClick={() => {
                      const el = document.getElementById(`project-${p.slug}`);
                      if (el instanceof HTMLDetailsElement) el.open = true;
                    }}
                    className="truncate text-gray-700 hover:text-blue-600 hover:underline"
                  >
                    {p.title}
                  </a>
                  <span className="ml-2 shrink-0 text-gray-400">
                    {p.done}/{p.total}
                  </span>
                </div>
                <Bar percent={pct(p.done, p.total)} small />
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}

function Bar({ percent, small }: { percent: number; small?: boolean }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-gray-200 ${small ? "mt-1 h-1.5" : "h-2.5"}`}
    >
      <div
        className="h-full rounded-full bg-blue-500 transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
