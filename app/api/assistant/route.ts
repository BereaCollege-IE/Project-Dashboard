// Chat endpoint for the task assistant.
//
// The client sends the chat history (text turns), the current task data, and the
// local date. We build a system prompt with that data, call Claude with the
// proposal tools, and return the assistant's text plus any proposed actions.
// We never execute the tools here; the client applies them after confirmation.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  ASSISTANT_TOOLS,
  buildSystemPrompt,
  type ChatTurn,
} from "@/lib/assistant";
import type { ProjectsData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

interface AssistantRequest {
  messages: ChatTurn[];
  data: ProjectsData;
  today: string;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The assistant is not configured yet. Add ANTHROPIC_API_KEY to the environment." },
      { status: 500 }
    );
  }

  let body: AssistantRequest;
  try {
    body = (await request.json()) as AssistantRequest;
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON." }, { status: 400 });
  }

  if (!body?.messages?.length || !body?.data) {
    return NextResponse.json(
      { error: "Both 'messages' and 'data' are required." },
      { status: 400 }
    );
  }

  const client = new Anthropic();
  const system = buildSystemPrompt(body.data, body.today || "an unknown date");

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system,
      tools: ASSISTANT_TOOLS as Anthropic.Tool[],
      messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Split the response into plain text and proposed tool calls.
    let text = "";
    const actions: { id: string; name: string; input: Record<string, unknown> }[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        actions.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    return NextResponse.json({
      text: text.trim(),
      actions,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      model: MODEL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `The assistant could not respond. ${message}` },
      { status: 500 }
    );
  }
}
