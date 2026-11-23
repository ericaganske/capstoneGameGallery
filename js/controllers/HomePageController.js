/* ==========================================================
   HomePageController
   Runs index.html: search, grouping filter, grouped view,
   and the shareable URL.
   ========================================================== */

import { Game } from "../models/Game.js";
import { Grouping } from "../models/Grouping.js";
import { ViewBuilder } from "../views/ViewBuilder.js";

const el = ViewBuilder.el;

export class HomePageController {
  static GROUPED_VIEW = "__grouped";   // dropdown value for "all games, grouped"

  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.games = [];
    this.groupings = [];
    this.departments = [];

    // Page elements
    this.results = document.getElementById("results");
    this.search = document.getElementById("search");
    this.deptSelect = document.getElementById("department");   // optional, not on the page yet
    this.groupSelect = document.getElementById("grouping");
    this.clearBtn = document.getElementById("clear");
    this.count = document.getElementById("count");
  }

  async init() {
    try { this.games = await this.dataLoader.loadGames(); }
    catch { ViewBuilder.loadError(this.results); return; }

    this.fillDropdowns();
    this.restoreFromUrl();

    this.search.addEventListener("input", () => this.render());
    this.deptSelect?.addEventListener("change", () => this.render());
    this.groupSelect.addEventListener("change", () => this.render());
    this.clearBtn.addEventListener("click", () => this.clearAll());
    this.render();
  }

  // Fill the dropdowns from whatever is in the CSV.
  fillDropdowns() {
    this.departments = [...new Set(this.games.map(g => g.department).filter(Boolean))].sort();
    // Always show the official groupings; add "Other" only if some game needs it.
    const names = Grouping.OFFICIAL.map(g => g.name);
    this.groupings = this.games.some(g => g.grouping === Grouping.OTHER)
      ? [...names, Grouping.OTHER.name]
      : names;
    if (this.deptSelect) {
      this.departments.forEach(d => this.deptSelect.append(el("option", { value: d, text: d })));
    }
    this.groupings.forEach(s => this.groupSelect.append(el("option", { value: s, text: s })));
  }

  // Restore filters from the address bar, so filtered views can be shared.
  restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    this.search.value = params.get("q") || "";
    if (this.deptSelect && this.departments.includes(params.get("dept"))) {
      this.deptSelect.value = params.get("dept");
    }
    const group = params.get("group");
    if (this.groupings.includes(group) || group === HomePageController.GROUPED_VIEW) {
      this.groupSelect.value = group;
    }
  }

  // Save the current filters in the address bar.
  updateUrl(q, dept, group) {
    const next = new URLSearchParams();
    if (q) next.set("q", this.search.value.trim());
    if (dept) next.set("dept", dept);
    if (group) next.set("group", group);
    history.replaceState(null, "", next.toString() ? "?" + next : location.pathname);
  }

  // One game card.
  card(game) {
    return el("article", { class: "card" },
      ViewBuilder.gameImage(game),
      el("div", { class: "card-body" },
        el("h3", { class: "card-title", text: game.title }),
        game.team ? el("p", { class: "card-meta", text: game.team }) : null,
        el("p", { class: "card-desc", text: game.description || "" }),
        game.tags.length ? ViewBuilder.tags(game) : null,
        game.url
          ? el("a", { class: "card-link", href: "game.html?id=" + encodeURIComponent(game.id) },
              "Play Game ", el("span", { "aria-hidden": "true", text: "→" }))
          : el("span", { class: "soon", text: "Coming soon" })
      )
    );
  }

  // Redraw the cards for the current search and filter.
  render() {
    const q = this.search.value.trim().toLowerCase();
    const dept = this.deptSelect ? this.deptSelect.value : "";
    const group = this.groupSelect.value;
    const grouped = group === HomePageController.GROUPED_VIEW;

    const matches = this.games.filter(g =>
      (!q || g.searchText().includes(q)) &&
      (!dept || g.department === dept) &&
      (!group || grouped || g.grouping.name === group));

    this.count.textContent = `Showing ${matches.length} of ${this.games.length} games`;
    this.clearBtn.hidden = !(q || dept || group);
    this.updateUrl(q, dept, group);

    if (!matches.length) {
      const reset = el("button", { class: "btn", type: "button", text: "Clear search and filters" });
      reset.addEventListener("click", () => this.clearAll());
      this.results.replaceChildren(el("div", { class: "empty" }, el("p", { text: "No games match your search." }), reset));
      return;
    }

    if (grouped) {
      // A heading for each grouping, newest semester first within each.
      this.results.replaceChildren(...this.groupings
        .filter(s => matches.some(g => g.grouping.name === s))
        .map(s => {
          const list = Game.newestFirst(matches.filter(g => g.grouping.name === s));
          return el("section", { class: "semester-group", "aria-label": s },
            el("h2", {}, s + " ", el("span", { text: `${list.length} ${list.length === 1 ? "game" : "games"}` })),
            el("div", { class: "grid" }, list.map(g => this.card(g))));
        }));
    } else {
      // One grid with every matching game, newest semester first.
      const sorted = Game.newestFirst(matches);
      this.results.replaceChildren(el("div", { class: "grid" }, sorted.map(g => this.card(g))));
    }
  }

  // Reset search and filters.
  clearAll() {
    this.search.value = "";
    this.groupSelect.value = "";
    if (this.deptSelect) this.deptSelect.value = "";
    this.render();
    this.search.focus();
  }
}
