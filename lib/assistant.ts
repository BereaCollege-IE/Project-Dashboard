// Shared definitions for the task assistant: the tools Claude may propose, the
// system prompt, and types/pricing shared by the server route and the chat UI.
//
// Important design note: the tools here are PROPOSALS. The server never executes
// them. Claude "calls" a tool to suggest a change; the client shows it as a card
// and only applies it (through the normal dashboard mutations) after the user
// confirms. So nothing the assistant does is saved without an explicit click.

import type { ProjectsData } from "./types";

// One concrete change the assistant proposes. `name` matches a tool below;
// `input` is that tool's arguments.
export interface ProposedAction {
  id: string; // the tool_use id from the API
  name: string;
  input: Record<string, unknown>;
}

// A plain text turn in the chat. We keep our own simple history (text only) and
// re-send the full current task data on every request, so Claude always has the
// latest state without us threading tool results back through the API.
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  text: string;
  actions: ProposedAction[];
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

// Per-million-token pricing, used to show an estimated cost per message.
export const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-opus-4-8": { in: 5, out: 25 },
};

export function estimateCostUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number }
): number {
  const p = MODEL_PRICING[model] ?? { in: 3, out: 15 };
  return (usage.input_tokens / 1_000_000) * p.in + (usage.output_tokens / 1_000_000) * p.out;
}

// The tools Claude may propose. Descriptions are prescriptive about WHEN to call
// each one, which improves how reliably the model reaches for the right tool.
export const ASSISTANT_TOOLS = [
  {
    name: "add_project",
    description:
      "Propose creating a brand-new project. Use when Rob describes work that does not fit any existing project.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Project title" },
        dueDate: {
          type: "string",
          description: "Optional deadline. ISO YYYY-MM-DD, or free text like 'Fall 2026'.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_project",
    description:
      "Propose editing an existing project's title, due date, status, or description. Use the project's exact slug from the data. Status is one of active, paused, complete.",
    input_schema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        title: { type: "string" },
        dueDate: { type: "string" },
        status: { type: "string", enum: ["active", "paused", "complete"] },
        description: { type: "string" },
      },
      required: ["slug"],
    },
  },
  {
    name: "add_task",
    description:
      "Propose adding one task to a project's backlog. Use the project's exact slug from the data.",
    input_schema: {
      type: "object",
      properties: {
        projectSlug: { type: "string" },
        title: { type: "string" },
        dueDate: { type: "string", description: "Optional. ISO YYYY-MM-DD or free text." },
      },
      required: ["projectSlug", "title"],
    },
  },
  {
    name: "break_down_task",
    description:
      "Propose breaking one existing backlog task into several smaller tasks. The original task is removed and replaced by the new ones. Use when a task is too large or vague to act on in one sitting. Reference the task by its exact id and projectSlug.",
    input_schema: {
      type: "object",
      properties: {
        projectSlug: { type: "string" },
        taskId: { type: "string" },
        newTasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              dueDate: { type: "string" },
            },
            required: ["title"],
          },
        },
      },
      required: ["projectSlug", "taskId", "newTasks"],
    },
  },
  {
    name: "update_task",
    description:
      "Propose editing a backlog task's title or due date. Reference it by exact id and projectSlug.",
    input_schema: {
      type: "object",
      properties: {
        projectSlug: { type: "string" },
        taskId: { type: "string" },
        title: { type: "string" },
        dueDate: { type: "string" },
      },
      required: ["projectSlug", "taskId"],
    },
  },
  {
    name: "complete_task",
    description:
      "Propose marking a backlog task done or not done. Reference it by exact id and projectSlug.",
    input_schema: {
      type: "object",
      properties: {
        projectSlug: { type: "string" },
        taskId: { type: "string" },
        done: { type: "boolean" },
      },
      required: ["projectSlug", "taskId", "done"],
    },
  },
  {
    name: "schedule_task_today",
    description:
      "Propose pulling a backlog task into today's schedule (creates a planned time block carrying that task). Use when prioritizing what to work on today. Reference by exact id and projectSlug.",
    input_schema: {
      type: "object",
      properties: {
        projectSlug: { type: "string" },
        taskId: { type: "string" },
      },
      required: ["projectSlug", "taskId"],
    },
  },
  {
    name: "delete_task",
    description:
      "Propose deleting a backlog task. Use sparingly, only when Rob clearly wants it gone. Reference by exact id and projectSlug.",
    input_schema: {
      type: "object",
      properties: {
        projectSlug: { type: "string" },
        taskId: { type: "string" },
      },
      required: ["projectSlug", "taskId"],
    },
  },
];

// Build the system prompt with the current task data baked in as context.
export function buildSystemPrompt(data: ProjectsData, today: string): string {
  const json = JSON.stringify(data, null, 2);
  return `You are a friendly, practical task-management assistant built into Rob's personal project dashboard. Rob works in institutional effectiveness, accreditation, and psychology at a college.

Today's date is ${today}.

Here is Rob's current project and task data as JSON. Always reason from this, and reference any project by its exact "slug" and any task by its exact "id":

${json}

How you help:
- Point out tasks that are too big or vague and should be broken into smaller steps.
- Suggest different ways to approach a particular task.
- Help prioritize across projects, using due dates and noting what is overdue (today is ${today}).
- Scan for tasks across different projects that overlap or could be done together more efficiently, and say which ones.

When you recommend a concrete change to the data (add, edit, break down, schedule, complete, or delete a task or project), propose it by calling the matching tool. Calling a tool does NOT change anything: Rob reviews every proposed change and clicks to confirm before it is saved. So propose freely, and always also explain your reasoning in plain text so he can decide.

Keep replies warm, concise, and in plain language. Never use em dashes; use commas, parentheses, or separate sentences instead.`;
}
