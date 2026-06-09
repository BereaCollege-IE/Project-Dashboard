"use client";

// Editable settings, stored in the projects JSON alongside the data so they
// persist and travel with the dashboard. Saving runs through updateSettings.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6 (balanced)" },
  { value: "claude-haiku-4-5", label: "Haiku 4.5 (cheapest)" },
  { value: "claude-opus-4-8", label: "Opus 4.8 (most capable)" },
];

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, actions } = useDashboard();
  const [staleAfterDays, setStale] = useState(String(settings.staleAfterDays));
  const [defaultStartTime, setStart] = useState(settings.defaultStartTime);
  const [defaultBlockMinutes, setMinutes] = useState(String(settings.defaultBlockMinutes));
  const [assistantModel, setModel] = useState(settings.assistantModel);
  const [reminderEmail, setEmail] = useState(settings.reminderEmail);

  function save() {
    actions.updateSettings({
      staleAfterDays: Math.max(1, parseInt(staleAfterDays, 10) || 5),
      defaultStartTime,
      defaultBlockMinutes: Math.max(15, parseInt(defaultBlockMinutes, 10) || 60),
      assistantModel,
      reminderEmail: reminderEmail.trim(),
    });
    onClose();
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Settings</h3>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 underline">
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col text-xs text-gray-600">
          Flag projects stale after (days)
          <input
            type="number"
            min={1}
            value={staleAfterDays}
            onChange={(e) => setStale(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Default day start time
          <input
            type="time"
            value={defaultStartTime}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Default day length (minutes)
          <input
            type="number"
            min={15}
            step={15}
            value={defaultBlockMinutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Assistant model
          <select
            value={assistantModel}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600 sm:col-span-2">
          Daily reminder email (optional)
          <input
            type="email"
            value={reminderEmail}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@berea.edu"
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
      >
        Save settings
      </button>
    </div>
  );
}
