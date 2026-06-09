"use client";

// Top-of-page header: a quick-glance summary of today, plus the global toolbar
// (undo, CSV export, settings).

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import SettingsPanel from "./SettingsPanel";
import { getStats } from "@/lib/data";
import type { ProjectsData } from "@/lib/types";

export default function GlanceHeader() {
  const { data, today, canUndo, saving, actions } = useDashboard();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Project Dashboard</h1>
          {today && <p className="text-sm text-gray-500">{today}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          <button
            type="button"
            onClick={actions.undo}
            disabled={!canUndo}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(data)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Settings
          </button>
        </div>
      </div>

      {today && <GlanceChips />}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </header>
  );
}

function GlanceChips() {
  const { data, today } = useDashboard();
  if (!today) return null;
  const s = getStats(data, today);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Chip label="Due today" value={s.dueToday} tone={s.dueToday ? "amber" : "gray"} />
      <Chip label="Overdue" value={s.overdue} tone={s.overdue ? "red" : "gray"} />
      <Chip label="Scheduled today" value={s.scheduledToday} tone="gray" />
      <Chip label="Done this week" value={s.completedThisWeek} tone="green" />
      <Chip label="Tasks done" value={`${s.doneTasks}/${s.totalTasks}`} tone="gray" />
    </div>
  );
}

const TONES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  green: "bg-green-100 text-green-800",
};

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <span className={`rounded-full px-3 py-1 ${TONES[tone]}`}>
      <span className="font-semibold">{value}</span> {label}
    </span>
  );
}

// Build a CSV of every task and trigger a download in the browser.
function downloadCsv(data: ProjectsData) {
  const header = [
    "Project",
    "Project status",
    "Project due",
    "Task",
    "Task due",
    "Priority",
    "Recurrence",
    "Done",
  ];
  const rows: string[][] = [header];
  for (const p of data.projects) {
    const tasks = p.tasks ?? [];
    if (tasks.length === 0) {
      rows.push([p.title, p.status, p.dueDate ?? "", "", "", "", "", ""]);
    }
    for (const t of tasks) {
      rows.push([
        p.title,
        p.status,
        p.dueDate ?? "",
        t.title,
        t.dueDate ?? "",
        t.priority ?? "",
        t.recurrence ?? "",
        t.done ? "yes" : "no",
      ]);
    }
  }
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "project-dashboard.csv";
  a.click();
  URL.revokeObjectURL(url);
}
