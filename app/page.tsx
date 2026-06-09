// The dashboard. A server component reads the full projects document from
// GitHub, then hands it to the client provider that owns the live working copy.
// The views compute "today", the viewed day, and stale/upcoming on the client so
// they reflect the user's local day, not UTC.

import DashboardProvider from "@/components/DashboardProvider";
import GlanceHeader from "@/components/GlanceHeader";
import DailySchedule from "@/components/DailySchedule";
import UpcomingDeadlines from "@/components/UpcomingDeadlines";
import StaleProjects from "@/components/StaleProjects";
import Backlog from "@/components/Backlog";
import StatsSection from "@/components/StatsSection";
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
      <main className="mx-auto max-w-5xl space-y-10 p-4 sm:p-6">
        {/* Quick-glance summary plus the global toolbar (undo, export, settings). */}
        <GlanceHeader />

        {/* The viewed day's time blocks, with day navigation. */}
        <DailySchedule />

        {/* Progress and what's coming due, side by side on wider screens.
            Stacks back to one column below the lg breakpoint. */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Completion progress. */}
          <StatsSection />

          {/* What's coming due across all projects. */}
          <UpcomingDeadlines />
        </div>

        {/* Anything active that has gone quiet for a while. */}
        <StaleProjects />

        {/* Every project and its tasks, with search, sort, and tags. */}
        <Backlog />
      </main>

      {/* Floating chat assistant (proposes changes, you confirm). */}
      <Assistant />
    </DashboardProvider>
  );
}
