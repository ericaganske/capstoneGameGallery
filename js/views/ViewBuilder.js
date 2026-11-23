/* ==========================================================
   ViewBuilder
   Builds page elements safely: text is always set with textContent,
   never as raw HTML, so nothing in games.csv can run as code.
   ========================================================== */

export class ViewBuilder {
  // Create an element. attrs: { class, text, ...any attribute }.
  static el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    children.flat().forEach(c => c && node.append(c));
    return node;
  }

  // Game picture, falling back to the grouping's stock image.
  static gameImage(game) {
    const el = ViewBuilder.el;
    const box = el("div", { class: "card-img", "aria-hidden": "true" });
    const src = game.imageSrc();
    const img = el("img", { src, alt: "", loading: "lazy" });
    img.addEventListener("error", () => {
      // If the game's own image fails, try the stock one; if that fails too, remove it.
      if (game.image && img.src.indexOf("images/stock/") === -1) img.src = game.grouping.stockImage;
      else img.remove();
    });
    box.append(img);
    return box;
  }

  // Message shown when games.csv can't be loaded.
  static loadError(container) {
    const el = ViewBuilder.el;
    container.replaceChildren(el("div", { class: "empty" },
      el("p", { text: "Couldn't load the games." }),
      el("p", { text: "If you're testing on your computer, use Live Server or a local server (see README.md)." })));
  }

  // Tag chips for a game.
  static tags(game) {
    const el = ViewBuilder.el;
    return el("div", { class: "tags" }, game.tags.map(t => el("span", { class: "tag", text: t })));
  }
}
