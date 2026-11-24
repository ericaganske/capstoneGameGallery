# capstoneGameGallery

## Sustainability Games Gallery (first draft)

Group members: Erica Ganske, Parnian Semsar, and Kristina Hildebrandt

Project statement: The current gallery structure is not scalable, making it challenging to add, maintain, and organize its content

Objectives: Refresh the current site's visual design and layout, improve organization and accessibility of the gallery, make it easier to add and manage games as they’re created, and improve the overall user experience when discovering and playing games.


A static website (HTML, CSS, JavaScript, no backend) that shows student-made sustainability games for the University of St. Thomas Office of Sustainability. Hosted on GitHub Pages.

## Files

```
index.html     Gallery page: search, semester filter, game cards
game.html      Plays one game (opened from "Play Game")
about.html     About + how students submit
data/          The list of games (built automatically from approved game submissions)
css/style.css  Design and colors
js/            Code, split into classes (one job per file) so it's easier to maintain
```

## Add or remove a game

Students submit a game with **Issues → New issue → Submit a game**. An admin adds the **approved**
label and the game appears on the gallery within a minute or two. To remove a game, remove the label
or close the issue.

## TODO (first draft)

- [x] Match exact UST colors
- [ ] Add the Office's contact info on the About page
- [x] Write the real About page
- [ ] Replace placeholder games with real ones
- [ ] Add instructions for the Office
- [ ] Later: Office Tool
