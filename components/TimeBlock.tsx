"use client";

// A single time block: a drag handle, its time range (inline-editable), project,
// status (click to cycle), controls to move it back to the backlog or delete it,
// and an inline subtask checklist whose items can be edited.

import { useState } from "react";
import { useDashboard } from "./DashboardProvider";
import { blockProgress, formatDueDate, isOverdue } from "@/lib/data";
import type { ScheduledBlock, BlockStatus, Subtask } from "@/lib/types";

interface TimeBlockProps {
  block: ScheduledBlock;
  // Spread onto the drag handle by the sortable wrapper. Optional so the block
  // can also render outside a drag context.
  dragHandleProps?: Record<string, unknown>;
}

// Plain-language labels and a matching tint for each status.
const STATUS_LABELS: Record<BlockStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  complete: "Complete",
};
const STATUS_STYLES: Record<BlockStatus, string> = {
  planned: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800",
};

export default function TimeBlock({ block, dragHandleProps }: TimeBlockProps) {
  const { actions } = useDashboard();
  const { done, total } = blockProgress(block);
  const [newSubtask, setNewSubtask] = useState("");
  const [newSubtaskDue, setNewSubtaskDue] = useState("");

  return (
    <article className="rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
      <header className="flex items-start gap-3">
        {/* Drag handle. Only this starts a drag. */}
        <button
          type="button"
          aria-label="Drag to reorder"
          className="mt-1 cursor-grab touch-none text-gray-300 hover:text-gray-500"
          {...(dragHandleProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          ⠿
        </button>

        <div className="flex-1">
          <p className="text-sm font-medium">{block.projectTitle}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <input
              type="time"
              value={block.startTime}
              onChange={(e) =>
                actions.updateBlock(block.id, { startTime: e.target.value })
              }
              className="rounded border border-gray-200 px-1 py-0.5"
            />
            <span>to</span>
            <input
              type="time"
              value={block.endTime}
              onChange={(e) =>
                actions.updateBlock(block.id, { endTime: e.target.value })
              }
              className="rounded border border-gray-200 px-1 py-0.5"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Click to cycle planned -> in progress -> complete. */}
          <button
            type="button"
            onClick={() => actions.cycleStatus(block.id)}
            className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[block.status]}`}
          >
            {STATUS_LABELS[block.status]}
          </button>
          {/* Move back out of Today: returns the task(s) to the backlog. */}
          <button
            type="button"
            onClick={() => actions.unscheduleBlock(block.id)}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs"
            title="Move this day back to project tasks"
          >
            Move to tasks
          </button>
          <button
            type="button"
            onClick={() => actions.deleteBlock(block.id)}
            className="text-xs text-gray-400 underline"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-600">
          Subtasks {total > 0 && `(${done}/${total})`}
        </p>

        {block.subtasks.length > 0 && (
          <ul className="mt-2 space-y-1">
            {block.subtasks.map((subtask: Subtask) => (
              <li key={subtask.id}>
                <SubtaskRow blockId={block.id} subtask={subtask} />
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            actions.addSubtask(block.id, newSubtask, newSubtaskDue);
            setNewSubtask("");
            setNewSubtaskDue("");
          }}
          className="mt-2 flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            placeholder="Add a subtask"
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
          />
          <input
            type="text"
            value={newSubtaskDue}
            onChange={(e) => setNewSubtaskDue(e.target.value)}
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
    </article>
  );
}

// One subtask: toggles between a display row and an inline edit row.
function SubtaskRow({
  blockId,
  subtask,
}: {
  blockId: string;
  subtask: Subtask;
}) {
  const { today, actions } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subtask.title);
  const [due, setDue] = useState(subtask.dueDate ?? "");

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          actions.updateSubtask(blockId, subtask.id, { title, dueDate: due });
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
          placeholder="Due (optional)"
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
            setTitle(subtask.title);
            setDue(subtask.dueDate ?? "");
            setEditing(false);
          }}
          className="text-xs text-gray-500 underline"
        >
          Cancel
        </button>
      </form>
    );
  }

  const overdue = isOverdue(subtask.dueDate, today ?? "", subtask.done);
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={() => actions.toggleSubtask(blockId, subtask.id)}
      />
      <span className={subtask.done ? "text-gray-400 line-through" : ""}>
        {subtask.title}
      </span>
      {subtask.dueDate && (
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            overdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {formatDueDate(subtask.dueDate)}
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
        <button
          type="button"
          onClick={() => actions.deleteSubtask(blockId, subtask.id)}
          className="text-xs text-gray-400 underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
