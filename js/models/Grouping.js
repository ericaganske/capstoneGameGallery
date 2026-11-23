/* ==========================================================
   Grouping  (entity in the ER diagram)
   One sustainability grouping and its default (stock) picture.
   The list is fixed: 8 official groupings + "Other".
   ========================================================== */

export class Grouping {
  constructor(name, stockImage) {
    this.name = name;             // primary key, e.g. "Food & Agriculture"
    this.stockImage = stockImage; // picture used when a game has no image
  }

  // The official groupings, in the order they appear in the dropdown and on the page.
  static OFFICIAL = [
    new Grouping("Clean Energy & Climate", "images/stock/cleanEnergy.jpg"),
    new Grouping("Nature & Biodiversity", "images/stock/nature.jpg"),
    new Grouping("Water & Natural Resources", "images/stock/water.jpg"),
    new Grouping("Waste & Circular Economy", "images/stock/waste.jpg"),
    new Grouping("Sustainable Cities & Communities", "images/stock/cities.jpg"),
    new Grouping("Food & Agriculture", "images/stock/food.jpg"),
    new Grouping("People & Social Sustainability", "images/stock/people.jpg"),
    new Grouping("Sustainable Business & Innovation", "images/stock/business.jpg"),
  ];

  // Used for any value in games.csv that doesn't match an official grouping.
  static OTHER = new Grouping("Other", "images/stock/other.jpg");

  // Match a CSV value to a grouping (ignores capitalization and extra spaces).
  static fromValue(value) {
    const v = (value || "").trim().toLowerCase();
    return Grouping.OFFICIAL.find(g => g.name.toLowerCase() === v) || Grouping.OTHER;
  }
}
