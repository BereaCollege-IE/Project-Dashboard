"use client";

// Wraps a TimeBlock with dnd-kit sortable behavior. Keeps the drag wiring out of
// TimeBlock itself, so TimeBlock stays focused on rendering and block actions.
// Only the small handle starts a drag; the rest of the card stays clickable.

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TimeBlock from "./TimeBlock";
import type { ScheduledBlock } from "@/lib/types";

export default function SortableTimeBlock({
  block,
}: {
  block: ScheduledBlock;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <TimeBlock block={block} dragHandleProps={{ ...attributes, ...listeners }} />
    </li>
  );
}
