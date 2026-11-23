/* ==========================================================
   Sustainability Games Gallery
   Starts the right controller for the current page.
   models/ = the data (Game, Grouping), data/ = loading games.csv,
   views/ = building page elements, controllers/ = running each page.
   ========================================================== */

import { DataLoader } from "./data/DataLoader.js";
import { HomePageController } from "./controllers/HomePageController.js";
import { GamePageController } from "./controllers/GamePageController.js";

const page = document.body.dataset.page;
const loader = new DataLoader("games.csv");

if (page === "home") new HomePageController(loader).init();
if (page === "game") new GamePageController(loader).init();
