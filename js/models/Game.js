/* ==========================================================
   Game  (entity in the ER diagram)
   One game = one row of games.csv, after the DataLoader has cleaned it.
   Each game belongs to exactly one Grouping.
   ========================================================== */

export class Game {
  constructor({ id, title, team, semester, grouping, department, tags, description, image, url }) {
    this.id = id;                   // primary key, made from the title 
    this.title = title;
    this.team = team;
    this.semester = semester;       // e.g. "Fall 2026"
    this.grouping = grouping;       // a Grouping object (foreign key: grouping name)
    this.department = department;   // read from the CSV, not used in the UI yet
    this.tags = tags;               // list of strings
    this.description = description;
    this.image = image;             // optional picture path or link
    this.url = url;                 // game link ("" when missing or unsafe)
  }

  // Picture to show: the game's own image, or its grouping's stock image.
  imageSrc() {
    return this.image || this.grouping.stockImage;
  }

  // "Fall 2026" -> sortable number, so newest semesters come first.
  semesterRank() {
    const m = /(spring|summer|fall|winter)\s+(\d{4})/i.exec(this.semester || "");
    if (!m) return 0;
    const order = { winter: 0, spring: 1, summer: 2, fall: 3 };
    return Number(m[2]) * 10 + order[m[1].toLowerCase()];
  }

  // Text the home page search looks through.
  searchText() {
    return [this.title, this.team, this.description, ...this.tags].join(" ").toLowerCase();
  }

  // Sort a list of games, newest semester first.
  static newestFirst(games) {
    return [...games].sort((a, b) => b.semesterRank() - a.semesterRank());
  }
}
