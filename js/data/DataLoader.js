/* ==========================================================
   DataLoader
   Reads games.csv and turns each row into a Game.
   The only class that knows where the data comes from.
   ========================================================== */

import { Game } from "../models/Game.js";
import { Grouping } from "../models/Grouping.js";

export class DataLoader {
  constructor(csvFile = "games.csv") {
    this.csvFile = csvFile;
  }

  // Fetch the CSV and return a list of Game objects.
  async loadGames() {
    const res = await fetch(this.csvFile, { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load " + this.csvFile);
    const rows = DataLoader.parseCSV(await res.text());
    const headers = rows.shift().map(h => h.trim().toLowerCase());
    const seen = {};

    return rows.map(cells => {
      const row = {};
      headers.forEach((h, i) => (row[h] = (cells[i] || "").trim()));
      if (!row.title) return null; // skip lines with no title

      // Same title twice -> the second one gets "-2", and so on.
      let id = DataLoader.slugify(row.title);
      seen[id] = (seen[id] || 0) + 1;
      if (seen[id] > 1) id += "-" + seen[id];

      return new Game({
        id,
        title: row.title,
        team: row.team,
        semester: row.semester || "Other",
        grouping: Grouping.fromValue(row.grouping),
        department: row.department,
        tags: (row.tags || "").split(",").map(t => t.trim()).filter(Boolean),
        description: row.description,
        image: row.image,
        url: DataLoader.safeUrl(row.url),
      });
    }).filter(Boolean);
  }

  // Turns CSV text into rows. Supports "quoted, values" with commas.
  static parseCSV(text) {
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

  // "Trash Sort!" -> "trash-sort"
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
