"use client";

// Primary daily view: today's time blocks, drag-sortable, plus a small form to
// add a new block to an existing project. Reads the working copy and actions
// from the dashboard context; computes today's blocks from the full document
// using the client-resolved local day.

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableTimeBlock from "./SortableTimeBlock";
import { useDashboard } from "./DashboardProvider";
import { getBlocksForDay } from "@/lib/data";

export default function DailySchedule() {
  const { data, today, saving, error, actions } = useDashboard();
  const [showForm, setShowForm] = useState(false);

  // Drag sensors: pointer for mouse/touch, keyboard for accessibility.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Until the client has resolved the local day, hold off on rendering blocks.
  if (!today) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Today</h2>
        <p className="text-sm text-gray-400">Loading your schedule…</p>
      </section>
    );
  }

  const blocks = getBlocksForDay(data, today);
  const blockIds = blocks.map((b) => b.id);

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blockIds.indexOf(String(active.id));
    const newIndex = blockIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    actions.reorderToday(arrayMove(blockIds, oldIndex, newIndex));
  }

  return (
    <section aria-labelledby="schedule-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="schedule-heading" className="text-lg font-medium">
            Today
          </h2>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-gray-400">Saving…</span>}
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
          >
            {showForm ? "Close" : "Add block"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          {error}
        </p>
      )}

      {showForm && (
        <AddBlockForm
          onAdd={(slug, start, end) => {
            actions.addBlock(slug, start, end);
            setShowForm(false);
          }}
        />
      )}

      {blocks.length === 0 ? (
        <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Nothing scheduled for today yet. Add a block to get started.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            <ol className="space-y-3">
              {blocks.map((block) => (
                <SortableTimeBlock key={block.id} block={block} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

// A small inline form to add a block to one of the existing projects.
function AddBlockForm({
  onAdd,
}: {
  onAdd: (slug: string, start: string, end: string) => void;
}) {
  const { data } = useDashboard();
  const projects = data.projects.filter((p) => p.status !== "complete");
  const [slug, setSlug] = useState(projects[0]?.slug ?? "");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  if (projects.length === 0) {
    return (
      <p className="rounded border border-gray-200 p-3 text-sm text-gray-500">
        Add a project to the data file first, then you can schedule blocks for it.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (slug) onAdd(slug, start, end);
      }}
      className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm"
    >
      <label className="flex flex-col text-xs text-gray-600">
        Project
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        >
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs text-gray-600">
        Start
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col text-xs text-gray-600">
        End
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
      >
        Add
      </button>
    </form>
  );
}
