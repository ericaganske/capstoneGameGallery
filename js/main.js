/* ==========================================================
   Sustainability Games Gallery
   Reads games.csv and builds the gallery and game pages.
   ========================================================== */

const CSV_FILE = "games.csv";

/* ---------- Load games.csv ---------- */

// Turns CSV text into rows. Supports "quoted, values" with commas.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim()));
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";
}

// Only accept normal https/http links.
function safeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch { return ""; }
}

async function loadGames() {
  const res = await fetch(CSV_FILE, { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load games.csv");
  const rows = parseCSV(await res.text());
  const headers = rows.shift().map(h => h.trim().toLowerCase());
  const seen = {};

  return rows.map(cells => {
    const g = {};
    headers.forEach((h, i) => (g[h] = (cells[i] || "").trim()));
    if (!g.title) return null; // skip lines with no title
    let id = slugify(g.title);
    seen[id] = (seen[id] || 0) + 1;
    if (seen[id] > 1) id += "-" + seen[id];
    return {
      id,
      title: g.title,
      team: g.team,
      semester: g.semester || "Other",
      department: g.department,
      tags: (g.tags || "").split(",").map(t => t.trim()).filter(Boolean),
      description: g.description,
      image: g.image,
      url: safeUrl(g.url),
    };
  }).filter(Boolean);
}

// "Fall 2026" -> sortable number, so newest semesters come first.
function semesterRank(s) {
  const m = /(spring|summer|fall|winter)\s+(\d{4})/i.exec(s || "");
  if (!m) return 0;
  const order = { winter: 0, spring: 1, summer: 2, fall: 3 };
  return Number(m[2]) * 10 + order[m[1].toLowerCase()];
}

/* ---------- Helper to build elements safely ---------- */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  children.flat().forEach(c => c && node.append(c));
  return node;
}

// Game picture shown faded under a green tint. Plain green for coming games for now.
function gameImage(g) {
  const box = el("div", { class: "card-img", "aria-hidden": "true" });
  if (g.image) {
    const img = el("img", { src: g.image, alt: "", loading: "lazy" });
    img.addEventListener("error", () => img.remove(), { once: true });
    box.append(img);
  }
  return box;
}

function loadError(container) {
  container.replaceChildren(el("div", { class: "empty" },
    el("p", { text: "Couldn't load the games." }),
    el("p", { text: "If you're testing on your computer, use Live Server or a local server (see README.md)." })));
}

/* ---------- Home page ---------- */
async function initHome() {
  const results = document.getElementById("results");
  const search = document.getElementById("search");
  const deptSelect = document.getElementById("department");
  const semSelect = document.getElementById("semester");
  const clearBtn = document.getElementById("clear");
  const count = document.getElementById("count");

  let games;
  try { games = await loadGames(); }
  catch { loadError(results); return; }

  // Fill the filter dropdowns from whatever is in the CSV.
  const departments = [...new Set(games.map(g => g.department).filter(Boolean))].sort();
  const semesters = [...new Set(games.map(g => g.semester))].sort((a, b) => semesterRank(b) - semesterRank(a));
  if (deptSelect) departments.forEach(d => deptSelect.append(el("option", { value: d, text: d })));
  semesters.forEach(s => semSelect.append(el("option", { value: s, text: s })));

  // Restore filters from the address bar, so filtered views can be shared.
  const params = new URLSearchParams(location.search);
  search.value = params.get("q") || "";
  if (deptSelect && departments.includes(params.get("dept"))) deptSelect.value = params.get("dept");
  if (semesters.includes(params.get("sem"))) semSelect.value = params.get("sem");

  function card(g) {
    return el("article", { class: "card" },
      gameImage(g),
      el("div", { class: "card-body" },
        el("h3", { class: "card-title", text: g.title }),
        g.team ? el("p", { class: "card-meta", text: g.team }) : null,
        el("p", { class: "card-desc", text: g.description || "" }),
        g.tags.length ? el("div", { class: "tags" }, g.tags.map(t => el("span", { class: "tag", text: t }))) : null,
        g.url
          ? el("a", { class: "card-link", href: "game.html?id=" + encodeURIComponent(g.id) },
              "Play Game ", el("span", { "aria-hidden": "true", text: "→" }))
          : el("span", { class: "soon", text: "Coming soon" })
      )
    );
  }

  function render() {
    const q = search.value.trim().toLowerCase();
    const dept = deptSelect ? deptSelect.value : "";
    const sem = semSelect.value;

    const matches = games.filter(g =>
      (!q || [g.title, g.team, g.description, ...g.tags].join(" ").toLowerCase().includes(q)) &&
      (!dept || g.department === dept) &&
      (!sem || g.semester === sem));

    count.textContent = `Showing ${matches.length} of ${games.length} games`;
    clearBtn.hidden = !(q || dept || sem);

    const next = new URLSearchParams();
    if (q) next.set("q", search.value.trim());
    if (dept) next.set("dept", dept);
    if (sem) next.set("sem", sem);
    history.replaceState(null, "", next.toString() ? "?" + next : location.pathname);

    if (!matches.length) {
      const reset = el("button", { class: "btn", type: "button", text: "Clear search and filters" });
      reset.addEventListener("click", clearAll);
      results.replaceChildren(el("div", { class: "empty" }, el("p", { text: "No games match your search." }), reset));
      return;
    }

    // Group by semester, newest first.
    results.replaceChildren(...semesters
      .filter(s => matches.some(g => g.semester === s))
      .map(s => {
        const list = matches.filter(g => g.semester === s);
        return el("section", { class: "semester-group", "aria-label": s },
          el("h2", {}, s + " ", el("span", { text: `${list.length} ${list.length === 1 ? "game" : "games"}` })),
          el("div", { class: "grid" }, list.map(card)));
      }));
  }

  function clearAll() {
    search.value = ""; semSelect.value = "";
    if (deptSelect) deptSelect.value = "";
    render(); search.focus();
  }

  search.addEventListener("input", render);
  deptSelect?.addEventListener("change", render);
  semSelect.addEventListener("change", render);
  clearBtn.addEventListener("click", clearAll);
  render();
}

/* ---------- Game page ---------- */
async function initGame() {
  const root = document.getElementById("game");
  const id = new URLSearchParams(location.search).get("id");

  let games;
  try { games = await loadGames(); }
  catch { loadError(root); return; }

  const g = games.find(x => x.id === id);
  if (!g) {
    root.replaceChildren(el("div", { class: "empty" },
      el("p", { text: "We couldn't find that game." }),
      el("a", { class: "btn", href: "index.html", text: "Back to all games" })));
    return;
  }

  document.title = g.title + " · Sustainability Games";

  const actions = el("div", { class: "game-actions" });
  let player;
  if (g.url) {
    const frameWrap = el("div", { class: "player" },
      el("iframe", {
        src: g.url, title: g.title, allow: "fullscreen; autoplay",
        sandbox: "allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms",
      }));
    const fs = el("button", { class: "btn", type: "button", text: "Fullscreen" });
    fs.addEventListener("click", () => frameWrap.requestFullscreen?.().catch(() => {}));
    actions.append(fs, el("a", { class: "btn btn-primary", href: g.url, target: "_blank", rel: "noopener", text: "Open in new tab ↗" }));
    player = el("div", {}, frameWrap,
      el("p", { class: "note", text: "If the game doesn't load here, use “Open in new tab”." }));
  } else {
    player = el("div", { class: "empty" },
      el("p", { text: "This game's link hasn't been added yet." }),
      el("p", { text: "Check back soon!" }));
  }

  root.replaceChildren(
    el("a", { class: "back", href: "index.html", text: "← All games" }),
    el("div", { class: "game-head" }, el("h1", { text: g.title }), actions),
    player,
    el("div", { class: "game-info" },
      el("div", {},
        el("h2", { text: "About this game" }),
        el("p", { text: g.description || "No description yet." })),
      el("dl", { class: "details" },
        g.team ? [el("dt", { text: "Made by" }), el("dd", { text: g.team })] : null,
        [el("dt", { text: "Semester" }), el("dd", { text: g.semester })],
        g.tags.length ? [el("dt", { text: "Tags" }), el("dd", {}, el("div", { class: "tags" }, g.tags.map(t => el("span", { class: "tag", text: t }))))] : null)));
}

/* ---------- Start ---------- */
const page = document.body.dataset.page;
if (page === "home") initHome();
if (page === "game") initGame();
