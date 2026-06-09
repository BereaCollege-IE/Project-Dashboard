// Route handler for reading and writing the projects data.
//
// GET  /api/projects        -> current data plus the GitHub SHA
// PUT  /api/projects        -> save the full data document, body: { data, sha }
//
// The client sends back the SHA it last read so GitHub can reject the write if
// the file changed underneath us. For a single user this rarely matters, but it
// keeps us honest across two open tabs.

import { NextResponse } from "next/server";
import { readProjects, saveProjects } from "@/lib/github";
import type { ProjectsData } from "@/lib/types";

// Always read fresh inside the handler; do not let Next.js cache the API route.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, sha } = await readProjects(0);
    return NextResponse.json({ data, sha });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not load projects. ${message}` },
      { status: 500 }
    );
  }
}

interface PutBody {
  data: ProjectsData;
  sha: string;
}

export async function PUT(request: Request) {
  let body: PutBody;
  try {
    body = (await request.json()) as PutBody;
  } catch {
    return NextResponse.json(
      { error: "Request body was not valid JSON." },
      { status: 400 }
    );
  }

  if (!body?.data || !body?.sha) {
    return NextResponse.json(
      { error: "Both 'data' and 'sha' are required." },
      { status: 400 }
    );
  }

  try {
    const result = await saveProjects(body.data, body.sha);
    return NextResponse.json({ sha: result.sha });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Surface a stale-SHA conflict as a real 409 so the client can refresh
    // its SHA and retry, instead of treating it as a generic failure.
    const status = (err as Error & { status?: number }).status === 409 ? 409 : 500;
    return NextResponse.json(
      { error: `Could not save changes. ${message}` },
      { status }
    );
  }
}
