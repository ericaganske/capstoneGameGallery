/* ==========================================================
   GamePageController
   Finds the game and shows it in a sandboxed iframe.
   ========================================================== */

import { ViewBuilder } from "../views/ViewBuilder.js";

const el = ViewBuilder.el;

export class GamePageController {
  constructor(dataLoader) {
    this.dataLoader = dataLoader;
    this.root = document.getElementById("game");
    this.id = new URLSearchParams(location.search).get("id");
  }

  async init() {
    let games;
    try { games = await this.dataLoader.loadGames(); }
    catch { ViewBuilder.loadError(this.root); return; }

    const game = games.find(g => g.id === this.id);
    if (!game) { this.showNotFound(); return; }

    document.title = game.title + " · Sustainability Games";
    this.showGame(game);
  }

  showNotFound() {
    this.root.replaceChildren(el("div", { class: "empty" },
      el("p", { text: "We couldn't find that game." }),
      el("a", { class: "btn", href: "index.html", text: "Back to all games" })));
  }

  // The iframe player, or a message if the game has no link yet.
  player(game, actions) {
    if (!game.url) {
      return el("div", { class: "empty" },
        el("p", { text: "This game's link hasn't been added yet." }),
        el("p", { text: "Check back soon!" }));
    }
    const frameWrap = el("div", { class: "player" },
      el("iframe", {
        src: game.url, title: game.title, allow: "fullscreen; autoplay",
        sandbox: "allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms",
      }));
    const fs = el("button", { class: "btn", type: "button", text: "Fullscreen" });
    fs.addEventListener("click", () => frameWrap.requestFullscreen?.().catch(() => {}));
    actions.append(fs, el("a", { class: "btn btn-primary", href: game.url, target: "_blank", rel: "noopener", text: "Open in new tab ↗" }));
    return el("div", {}, frameWrap,
      el("p", { class: "note", text: "If the game doesn't load here, use “Open in new tab”." }));
  }

  showGame(game) {
    const actions = el("div", { class: "game-actions" });
    const player = this.player(game, actions);

    this.root.replaceChildren(
      el("a", { class: "back", href: "index.html", text: "← All games" }),
      el("div", { class: "game-head" }, el("h1", { text: game.title }), actions),
      player,
      el("div", { class: "game-info" },
        el("div", {},
          el("h2", { text: "About this game" }),
          el("p", { text: game.description || "No description yet." })),
        el("dl", { class: "details" },
          game.team ? [el("dt", { text: "Made by" }), el("dd", { text: game.team })] : null,
          [el("dt", { text: "Semester" }), el("dd", { text: game.semester })],
          game.tags.length ? [el("dt", { text: "Tags" }), el("dd", {}, ViewBuilder.tags(game))] : null)));
  }
}
