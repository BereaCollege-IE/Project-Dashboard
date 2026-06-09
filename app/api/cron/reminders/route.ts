// Daily deadline reminder. Intended to be triggered by a Vercel Cron (see
// vercel.json). It reads the projects from GitHub, finds anything overdue or due
// in the next couple of days, and emails a summary via Gmail SMTP.
//
// It is a graceful no-op when not configured: if there is no recipient or no
// SMTP credentials, it returns a note instead of erroring. Email send reuses the
// same Gmail SMTP setup pattern used elsewhere (AUTH_EMAIL_USER / AUTH_EMAIL_PASS
// / AUTH_EMAIL_FROM).

import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { readProjects } from "@/lib/github";
import {
  getSettings,
  getUpcomingDeadlines,
  todayISO,
  formatDueDate,
  daysBetween,
} from "@/lib/data";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function GET(request: Request) {
  // If a CRON_SECRET is set, require it (Vercel Cron sends it as a Bearer token).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let data;
  try {
    ({ data } = await readProjects(0));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Could not read data. ${message}` }, { status: 500 });
  }

  const settings = getSettings(data);
  const to = settings.reminderEmail || process.env.AUTH_EMAIL_FROM || "";
  const user = process.env.AUTH_EMAIL_USER;
  const pass = process.env.AUTH_EMAIL_PASS;

  if (!to || !user || !pass) {
    return NextResponse.json({
      sent: false,
      reason:
        "Reminders not configured. Set a reminder email in Settings and AUTH_EMAIL_USER / AUTH_EMAIL_PASS env vars.",
    });
  }

  const today = todayISO();
  const deadlines = getUpcomingDeadlines(data, today, 2); // overdue + next 2 days
  if (deadlines.length === 0) {
    return NextResponse.json({ sent: false, reason: "Nothing due soon." });
  }

  const whenLabel = (dueDate: string) => {
    const diff = daysBetween(today, dueDate);
    if (diff === 0) return "due today";
    if (diff < 0) return `${-diff}d overdue`;
    return `in ${diff}d`;
  };

  const text =
    `Your deadlines as of ${today}:\n\n` +
    deadlines
      .map((d) => `- ${d.title} (${d.projectTitle}) — ${formatDueDate(d.dueDate)}, ${whenLabel(d.dueDate)}`)
      .join("\n") +
    `\n\nOpen the dashboard to schedule or update these.`;

  const html =
    `<p>Your deadlines as of ${today}:</p><ul>` +
    deadlines
      .map(
        (d) =>
          `<li><strong>${escapeHtml(d.title)}</strong> (${escapeHtml(d.projectTitle)}) — ${formatDueDate(
            d.dueDate
          )}, ${whenLabel(d.dueDate)}</li>`
      )
      .join("") +
    `</ul>`;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.AUTH_EMAIL_FROM || user,
      to,
      subject: `Dashboard: ${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} need attention`,
      text,
      html,
    });
    return NextResponse.json({ sent: true, count: deadlines.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ sent: false, error: `Email send failed. ${message}` }, { status: 500 });
  }
}
