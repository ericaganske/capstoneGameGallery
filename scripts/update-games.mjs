// Builds data/games.json from the repo's approved game issues.
// Run by .github/workflows/update-games.yml — you don't need to run this yourself.
//
// How it works:
//  1. Reads every OPEN issue that has the "approved" label.
//  2. Reads the answers from the "Submit a game" form.
//  3. Checks the answers. A game with a problem is skipped (and the issue gets a comment),
//     so one mistake can never break the website.
//  4. Downloads the cover pictures into images/games/ and writes data/games.json.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;                    // "owner/name"
const EVENT_ACTION = process.env.EVENT_ACTION || "";
const EVENT_LABEL = process.env.EVENT_LABEL || "";
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER) || 0;

const API = process.env.GITHUB_API_URL || "https://api.github.com";
const APPROVED = "approved";
const SUBMISSION = "game submission";
const OUT_FILE = "data/games.json";
const IMG_DIR = "images/games";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const GROUPINGS = [
  "Clean Energy & Climate", "Nature & Biodiversity", "Water & Natural Resources",
  "Waste & Circular Economy", "Sustainable Cities & Communities", "Food & Agriculture",
  "People & Social Sustainability", "Sustainable Business & Innovation",
];

// Form question (### heading) -> field name
const FIELDS = {
  "Game title": "title",
  "Category": "grouping",
  "Semester": "season",
  "Year": "year",
  "Description": "description",
  "Team members": "team",
  "Tags": "tags",
  "Cover picture": "image",
  "Game link": "url",
  "Permission": "consent",
};

/* ---------- GitHub API ---------- */
async function gh(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok && res.status !== 422) throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function ensureLabel(name, color, description) {
  await gh(`/repos/${REPO}/labels`, { method: "POST", body: JSON.stringify({ name, color, description }) }); // 422 = already exists
}

// Label names are compared without caring about capitals ("Approved" = "approved").
const labelNames = issue => (issue.labels || []).map(l => (typeof l === "string" ? l : l.name).toLowerCase());
const sameLabel = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();

async function approvedIssues() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/repos/${REPO}/issues?state=open&per_page=100&page=${page}`);
    all.push(...batch.filter(i => !i.pull_request && labelNames(i).includes(APPROVED)));
    if (batch.length < 100) return all;
  }
}

async function comment(number, body) {
  // Don't post the same message twice in a row.
  const comments = await gh(`/repos/${REPO}/issues/${number}/comments?per_page=100`);
  const last = [...comments].reverse().find(c => c.user?.type === "Bot");
  if (last && last.body.trim() === body.trim()) return;
  await gh(`/repos/${REPO}/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

/* ---------- Reading the form ---------- */
export function parseForm(body) {
  const answers = {};
  const parts = (body || "").replace(/\r\n/g, "\n").split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl < 0 ? part : part.slice(0, nl)).trim();
    const key = FIELDS[heading];
    if (!key) continue;
    let value = (nl < 0 ? "" : part.slice(nl + 1)).trim();
    if (value === "_No response_" || value === "None") value = "";
    answers[key] = value;
  }
  return answers;
}

// Finds picture links (drag-and-drop gives ![...](url) or <img src="url">) and plain links.
export function imageUrls(text) {
  const urls = [];
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|<img[^>]*\ssrc=["'](https?:\/\/[^"']+)["']|(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)/gi;
  let m;
  while ((m = re.exec(text || ""))) urls.push(m[1] || m[2] || m[3]);
  return [...new Set(urls)];
}

const oneLine = s => (s || "").replace(/\s+/g, " ").trim();
const isLink = s => /^https:\/\/\S+\.\S+$/i.test(s);
export const tagList = s => oneLine(s).split(",").map(t => t.replace(/["']/g, "").trim().toLowerCase()).filter(Boolean);

export function check(a) {
  const problems = [];
  const title = oneLine(a.title);
  if (title.length < 2 || title.length > 100) problems.push("**Game title** should be 2–100 characters.");
  if (!GROUPINGS.includes(oneLine(a.grouping))) problems.push("**Category** is not one of the official categories.");
  if (!/^(Spring|Summer|Fall|Winter)$/.test(oneLine(a.season))) problems.push("**Semester** is not chosen.");
  if (!/^20\d\d$/.test(oneLine(a.year))) problems.push(`**Year** should be a year like 2026 (it says "${oneLine(a.year) || "nothing"}").`);
  const description = oneLine(a.description);
  if (description.length < 40 || description.length > 400) problems.push(`**Description** should be 40–400 characters (it has ${description.length}).`);
  if (!oneLine(a.team)) problems.push("**Team members** is empty.");
  const tags = tagList(a.tags);
  if (tags.length < 1 || tags.length > 8) problems.push("**Tags** should be 1–8 words separated by commas.");
  if (!isLink(oneLine(a.url))) problems.push("**Game link** should be a full link starting with https://");
  if (!/-\s*\[x\]/i.test(a.consent || "")) problems.push("The **Permission** box is not checked.");
  return problems;
}

/* ---------- Pictures ---------- */
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };

async function savePicture(url, issueNumber) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  for (const ext of Object.values(EXT)) {
    const existing = `${IMG_DIR}/${issueNumber}-${hash}.${ext}`;
    if (existsSync(existing)) return existing; // already downloaded on an earlier run
  }
  try {
    // GitHub's own attachment links accept the repo token; other sites are fetched without it.
    const headers = new URL(url).hostname === "github.com" ? { Authorization: `Bearer ${TOKEN}` } : {};
    const res = await fetch(url, { headers, redirect: "follow" });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok || !EXT[type]) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    const file = `${IMG_DIR}/${issueNumber}-${hash}.${EXT[type]}`;
    writeFileSync(file, buf);
    return file;
  } catch {
    return null;
  }
}

/* ---------- Main ---------- */
async function main() {
  if (!TOKEN || !REPO) throw new Error("GITHUB_TOKEN and REPO must be set (this runs inside GitHub Actions).");
  mkdirSync(IMG_DIR, { recursive: true });
  await ensureLabel(APPROVED, "2EA44F", "Show this game on the gallery");
  await ensureLabel(SUBMISSION, "8348AD", "Submitted with the Submit a game form");

  const issues = await approvedIssues();
  const games = [];
  const results = {};   // issue number -> { problems, warnings }
  const links = new Set();

  // Oldest issue first, so if two issues have the same game link the first one wins.
  for (const issue of issues.sort((a, b) => a.number - b.number)) {
    const a = parseForm(issue.body);
    if (!Object.keys(a).length) continue; // not a game form (e.g. a normal issue someone labeled)
    const problems = check(a);
    const url = oneLine(a.url);
    if (!problems.length && links.has(url)) problems.push("A game with this **Game link** is already on the gallery.");
    const warnings = [];
    if (problems.length) { results[issue.number] = { problems, warnings }; continue; }
    links.add(url);

    const cover = imageUrls(a.image)[0];
    let image = "";
    if (cover) {
      image = (await savePicture(cover, issue.number)) || "";
      if (!image) warnings.push("The cover picture could not be downloaded, so the category's stock picture is shown instead.");
    }

    games.push({
      title: oneLine(a.title),
      grouping: oneLine(a.grouping),
      team: oneLine(a.team),
      semester: `${oneLine(a.season)} ${oneLine(a.year)}`,
      tags: tagList(a.tags),
      description: oneLine(a.description),
      image,
      url,
      issue: issue.number,
    });
    results[issue.number] = { problems, warnings };
  }

  games.reverse(); // newest issue first
  const json = JSON.stringify(games, null, 2) + "\n";
  const before = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : "";
  if (json !== before) writeFileSync(OUT_FILE, json);
  console.log(`${games.length} approved game(s) written to ${OUT_FILE}.`);

  // Tell the person on the issue what happened (never fails the run).
  if (!ISSUE_NUMBER || EVENT_ACTION === "deleted") return;
  try { await notify(results); } catch (err) { console.warn("Could not comment on the issue:", err.message); }
}

async function notify(results) {
  const issue = await gh(`/repos/${REPO}/issues/${ISSUE_NUMBER}`);
  const labels = labelNames(issue);
  const isApproved = issue.state === "open" && labels.includes(APPROVED);
  const isSubmission = labels.includes(SUBMISSION) || Object.keys(parseForm(issue.body)).length > 0;
  if (!isSubmission) return;

  if (EVENT_ACTION === "opened" && !isApproved) {
    await comment(ISSUE_NUMBER, "Thanks for submitting your game! An admin will review it. It will appear on the gallery after it gets the **approved** label.");
  } else if (isApproved && ["labeled", "edited", "reopened", "opened"].includes(EVENT_ACTION)) {
    const r = results[ISSUE_NUMBER];
    if (r?.problems.length) {
      await comment(ISSUE_NUMBER, "⚠️ This game could not be added to the gallery yet. Please **edit the issue** to fix:\n\n" +
        r.problems.map(p => `- ${p}`).join("\n") + "\n\nThe gallery updates automatically after you save.");
    } else if (r) {
      await comment(ISSUE_NUMBER, "✅ This game is now on the gallery. It can take a minute or two to show up." +
        (r.warnings.length ? "\n\nNote:\n" + r.warnings.map(w => `- ${w}`).join("\n") : ""));
    }
  } else if ((EVENT_ACTION === "unlabeled" && sameLabel(EVENT_LABEL, APPROVED)) || EVENT_ACTION === "closed") {
    await comment(ISSUE_NUMBER, "This game was removed from the gallery. Add the **approved** label again (and reopen the issue if it's closed) to bring it back.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
