"use client";

// Daily view: the time blocks for the currently viewed day, drag-sortable, plus
// a form to add a block. Day navigation lets you review past days and plan
// future ones. Reads the working copy and actions from the dashboard context.

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
import { getBlocksForDay, dayLabel } from "@/lib/data";

export default function DailySchedule() {
  const { data, today, viewedDay, error, actions } = useDashboard();
  const [showForm, setShowForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!today || !viewedDay) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Schedule</h2>
        <p className="text-sm text-gray-400">Loading your schedule…</p>
      </section>
    );
  }

  const blocks = getBlocksForDay(data, viewedDay);
  const blockIds = blocks.map((b) => b.id);
  const label = dayLabel(viewedDay, today);

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="schedule-heading" className="text-lg font-medium">
            Schedule
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => actions.goToDay(-1)}
              aria-label="Previous day"
              className="rounded border border-gray-300 px-2 leading-none"
            >
              ‹
            </button>
            <span className="min-w-[8rem] text-center">
              {label} <span className="text-gray-400">· {viewedDay}</span>
            </span>
            <button
              type="button"
              onClick={() => actions.goToDay(1)}
              aria-label="Next day"
              className="rounded border border-gray-300 px-2 leading-none"
            >
              ›
            </button>
            {viewedDay !== today && (
              <button
                type="button"
                onClick={actions.goToToday}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs"
              >
                Today
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white"
        >
          {showForm ? "Close" : "Add Project"}
        </button>
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
          Nothing scheduled for {label.toLowerCase()}. Add a project, or schedule a
          task from tasks or deadlines below.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
  const { data, settings } = useDashboard();
  const projects = data.projects.filter((p) => p.status !== "complete");
  const [slug, setSlug] = useState(projects[0]?.slug ?? "");
  const [start, setStart] = useState(settings.defaultStartTime);
  const [end, setEnd] = useState("10:00");

  if (projects.length === 0) {
    return (
      <p className="rounded border border-gray-200 p-3 text-sm text-gray-500">
        Add a project first, then you can schedule days for it.
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
      <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
        Add
      </button>
    </form>
  );
}
