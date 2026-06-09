// The daily dashboard. This is a server component: it reads the full projects
// document from GitHub on the server, then hands it to the client provider that
// owns the live working copy and persistence. The views compute "today" and the
// stale list on the client so they reflect the user's local day, not UTC.

import DashboardProvider from "@/components/DashboardProvider";
import DailySchedule from "@/components/DailySchedule";
import Backlog from "@/components/Backlog";
import StaleProjects from "@/components/StaleProjects";
import Assistant from "@/components/Assistant";
import { readProjects } from "@/lib/github";
import type { ProjectsData } from "@/lib/types";

// Revalidate the initial server read periodically so a fresh load picks up
// edits made from another device.
export const revalidate = 30;

export default async function DashboardPage() {
  let data: ProjectsData;
  let sha: string;
  try {
    const file = await readProjects(revalidate);
    data = file.data;
    sha = file.sha;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Project Dashboard</h1>
        <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          Could not load your projects right now. {message}
        </p>
      </main>
    );
  }

  return (
    <DashboardProvider initialData={data} initialSha={sha}>
      <main className="mx-auto max-w-3xl space-y-10 p-6">
        {/* Primary view: today's time blocks with their subtasks. */}
        <DailySchedule />

        {/* Every project and its unscheduled tasks. */}
        <Backlog />

        {/* Anything active that has gone quiet for a while. */}
        <StaleProjects />
      </main>

      {/* Floating chat assistant (proposes changes, you confirm). */}
      <Assistant />
    </DashboardProvider>
  );
}
