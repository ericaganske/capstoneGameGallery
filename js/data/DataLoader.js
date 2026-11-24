/* ==========================================================
   DataLoader
   Reads the game lists in data/ and turns each entry into a Game.
   The only class that knows where the data comes from.
   - data/games.json           games from approved GitHub issues (written automatically)
   - data/existing-games.json  games added before the form existed
   ========================================================== */

import { Game } from "../models/Game.js";
import { Grouping } from "../models/Grouping.js";

export class DataLoader {
  constructor(files = ["data/games.json", "data/existing-games.json"]) {
    this.files = files;
  }

  // Fetch every list and return one list of Game objects.
  // A missing or broken file is skipped; if nothing could be read, it throws.
  async loadGames() {
    const lists = await Promise.all(this.files.map(f => DataLoader.loadList(f)));
    if (lists.every(l => l === null)) throw new Error("Could not load the game lists");
    const seen = {};

    return lists.flat().filter(Boolean).map(entry => {
      if (typeof entry !== "object") return null;
      const title = DataLoader.text(entry.title);
      if (!title) return null; // a game needs at least a title

      // Same title twice -> the second one gets "-2", and so on.
      let id = DataLoader.slugify(title);
      seen[id] = (seen[id] || 0) + 1;
      if (seen[id] > 1) id += "-" + seen[id];

      return new Game({
        id,
        title,
        team: DataLoader.text(entry.team),
        semester: DataLoader.text(entry.semester) || "Other",
        grouping: Grouping.fromValue(entry.grouping),
        department: DataLoader.text(entry.department),
        tags: DataLoader.tags(entry.tags),
        description: DataLoader.text(entry.description),
        image: DataLoader.text(entry.image),
        url: DataLoader.safeUrl(DataLoader.text(entry.url)),
      });
    }).filter(Boolean);
  }

  // One JSON list, or null if it can't be read.
  static async loadList(file) {
    try {
      const res = await fetch(file, { cache: "no-cache" });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  static text(value) {
    return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  }

  // Tags can be a list or a comma-separated string; stray quotes are removed.
  static tags(value) {
    const list = Array.isArray(value) ? value : DataLoader.text(value).split(",");
    return list.map(t => DataLoader.text(t).replace(/^["']+|["']+$/g, "").trim()).filter(Boolean);
  }

  // "Trash Sort!" -> "trash-sort", used in game.html?id=...
  static slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";
  }

  // Only accept normal https/http links.
  static safeUrl(url) {
    if (!url) return "";
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch { return ""; }
  }
}
