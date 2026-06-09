// Read and write the projects JSON file in GitHub.
//
// This module is server-only. It uses the GitHub Contents API so we get the
// file's blob SHA, which the API requires to commit an update. The PAT lives
// in an environment variable and never reaches the browser.

import type { ProjectsData } from "./types";

const API_BASE = "https://api.github.com";

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch: string;
}

// Pull config from the environment and fail loudly if something is missing.
function getConfig(): GitHubConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const path = process.env.GITHUB_DATA_PATH;
  const branch = process.env.GITHUB_BRANCH ?? "main";

  if (!token || !owner || !repo || !path) {
    throw new Error(
      "Missing GitHub config. Set GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, and GITHUB_DATA_PATH."
    );
  }
  return { token, owner, repo, path, branch };
}

function contentsUrl(cfg: GitHubConfig): string {
  return `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
}

function authHeaders(cfg: GitHubConfig): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// The data plus the SHA we need to write it back. Pass the SHA to saveProjects.
export interface ProjectsFile {
  data: ProjectsData;
  sha: string;
}

// Read the JSON file. `revalidate` controls how long Next.js caches the
// server-side fetch. Set to 0 from a route handler that needs fresh data.
export async function readProjects(revalidate = 30): Promise<ProjectsFile> {
  const cfg = getConfig();
  const res = await fetch(`${contentsUrl(cfg)}?ref=${cfg.branch}`, {
    headers: authHeaders(cfg),
    next: { revalidate },
  });

  if (!res.ok) {
    throw new Error(`GitHub read failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { content: string; sha: string };
  const decoded = Buffer.from(json.content, "base64").toString("utf-8");
  const data = JSON.parse(decoded) as ProjectsData;
  return { data, sha: json.sha };
}

// Write the JSON file back. The SHA must match the current file on the branch,
// otherwise GitHub rejects the commit (this is our optimistic-lock guard).
export async function saveProjects(
  data: ProjectsData,
  sha: string,
  message = "Update projects from dashboard"
): Promise<{ sha: string }> {
  const cfg = getConfig();
  const content = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString(
    "base64"
  );

  const res = await fetch(contentsUrl(cfg), {
    method: "PUT",
    headers: { ...authHeaders(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content,
      sha,
      branch: cfg.branch,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as { content: { sha: string } };
  return { sha: json.content.sha };
}
