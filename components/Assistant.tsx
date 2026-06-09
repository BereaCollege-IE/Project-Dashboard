"use client";

// Floating task assistant. A button opens a chat panel. Each message is sent to
// /api/assistant along with the current task data and local date. The reply may
// include proposed changes, which render as cards; nothing is saved until Rob
// clicks Apply, which runs the change through the normal dashboard actions.

import { useRef, useState } from "react";
import { useDashboard } from "./DashboardProvider";
import {
  estimateCostUsd,
  type ChatTurn,
  type ProposedAction,
} from "@/lib/assistant";
import type { ProjectStatus } from "@/lib/types";

// A chat turn plus, for assistant turns, the proposed actions and their state.
interface Message extends ChatTurn {
  actions?: ProposedAction[];
  resolved?: Record<string, "applied" | "skipped">;
  costUsd?: number;
}

export default function Assistant() {
  const { data, today, actions } = useDashboard();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);

    // The history we send is text-only; the current data goes separately.
    const history: ChatTurn[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, data, today: today ?? "" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status}).`);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: json.text || "(Proposed the changes below.)",
          actions: json.actions ?? [],
          resolved: {},
          costUsd: estimateCostUsd(json.model, json.usage),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  // Apply one proposed action through the normal dashboard mutations.
  function applyAction(action: ProposedAction): void {
    const inp = action.input as Record<string, string | boolean | undefined>;
    const slug = String(inp.projectSlug ?? "");
    const taskId = String(inp.taskId ?? "");

    switch (action.name) {
      case "add_project":
        actions.addProject(String(inp.title ?? ""), inp.dueDate as string | undefined);
        break;
      case "update_project": {
        const patch: {
          title?: string;
          dueDate?: string;
          status?: ProjectStatus;
          description?: string;
        } = {};
        if (inp.title !== undefined) patch.title = String(inp.title);
        if (inp.dueDate !== undefined) patch.dueDate = String(inp.dueDate);
        if (inp.status !== undefined) patch.status = inp.status as ProjectStatus;
        if (inp.description !== undefined) patch.description = String(inp.description);
        actions.updateProject(String(inp.slug ?? ""), patch);
        break;
      }
      case "add_task":
        actions.addBacklogTask(slug, String(inp.title ?? ""), inp.dueDate as string | undefined);
        break;
      case "break_down_task": {
        const newTasks = (action.input.newTasks as { title: string; dueDate?: string }[]) ?? [];
        actions.deleteBacklogTask(slug, taskId);
        for (const t of newTasks) actions.addBacklogTask(slug, t.title, t.dueDate);
        break;
      }
      case "update_task": {
        const patch: { title?: string; dueDate?: string } = {};
        if (inp.title !== undefined) patch.title = String(inp.title);
        if (inp.dueDate !== undefined) patch.dueDate = String(inp.dueDate);
        actions.updateBacklogTask(slug, taskId, patch);
        break;
      }
      case "complete_task": {
        const project = data.projects.find((p) => p.slug === slug);
        const task = project?.tasks?.find((t) => t.id === taskId);
        if (task && task.done !== Boolean(inp.done)) actions.toggleBacklogTask(slug, taskId);
        break;
      }
      case "schedule_task_today":
        actions.scheduleTask(slug, taskId);
        break;
      case "delete_task":
        actions.deleteBacklogTask(slug, taskId);
        break;
    }
  }

  function resolve(msgIndex: number, action: ProposedAction, choice: "applied" | "skipped") {
    if (choice === "applied") applyAction(action);
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex
          ? { ...m, resolved: { ...(m.resolved ?? {}), [action.id]: choice } }
          : m
      )
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
      >
        Ask Claude
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[70vh] w-96 max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-gray-200 bg-white/90 shadow-xl backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <span className="text-sm font-medium">Task assistant</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-400 hover:text-gray-700"
          aria-label="Close assistant"
        >
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500">
            Ask me to break a task down, prioritize your week, or find work that
            overlaps. I will propose changes and you decide whether to apply them.
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content}
            </div>

            {/* Proposed-change cards for assistant turns. */}
            {m.actions && m.actions.length > 0 && (
              <div className="mt-2 space-y-2">
                {m.actions.map((a) => {
                  const state = m.resolved?.[a.id];
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border border-gray-200 bg-white p-2 text-left text-xs"
                    >
                      <p className="font-medium text-gray-700">Proposed change</p>
                      <p className="mt-0.5 text-gray-600">{describeAction(a)}</p>
                      {state ? (
                        <p
                          className={`mt-1 ${
                            state === "applied" ? "text-green-700" : "text-gray-400"
                          }`}
                        >
                          {state === "applied" ? "Applied" : "Skipped"}
                        </p>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => resolve(i, a, "applied")}
                            className="rounded bg-gray-900 px-2 py-1 text-white"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => resolve(i, a, "skipped")}
                            className="rounded border border-gray-300 px-2 py-1"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {m.costUsd !== undefined && (
              <p className="mt-1 text-[10px] text-gray-400">
                ~${m.costUsd.toFixed(4)} this message
              </p>
            )}
          </div>
        ))}

        {loading && <p className="text-xs text-gray-400">Thinking…</p>}
        {error && (
          <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex gap-2 border-t border-gray-200 p-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your tasks…"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// A short, human-readable summary of a proposed action for the confirmation card.
function describeAction(a: ProposedAction): string {
  const i = a.input as Record<string, string | boolean | undefined>;
  const due = i.dueDate ? ` (due ${i.dueDate})` : "";
  switch (a.name) {
    case "add_project":
      return `Create project "${i.title}"${due}.`;
    case "update_project":
      return `Edit project ${i.slug}: ${[
        i.title && `title to "${i.title}"`,
        i.dueDate && `due ${i.dueDate}`,
        i.status && `status ${i.status}`,
        i.description && "description",
      ]
        .filter(Boolean)
        .join(", ")}.`;
    case "add_task":
      return `Add task "${i.title}"${due} to ${i.projectSlug}.`;
    case "break_down_task": {
      const titles = ((a.input.newTasks as { title: string }[]) ?? [])
        .map((t) => `"${t.title}"`)
        .join(", ");
      return `Break a task in ${i.projectSlug} into: ${titles}.`;
    }
    case "update_task":
      return `Edit a task in ${i.projectSlug}: ${[
        i.title && `title to "${i.title}"`,
        i.dueDate && `due ${i.dueDate}`,
      ]
        .filter(Boolean)
        .join(", ")}.`;
    case "complete_task":
      return `Mark a task in ${i.projectSlug} as ${i.done ? "done" : "not done"}.`;
    case "schedule_task_today":
      return `Schedule a task from ${i.projectSlug} into today.`;
    case "delete_task":
      return `Delete a task from ${i.projectSlug}.`;
    default:
      return a.name;
  }
}
