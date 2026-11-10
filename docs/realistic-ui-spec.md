# Realistic redesign

Status: in progress on the `realistic-ui` branch. Tested on localhost before any PR.

The whole game gets the realistic look from the design board ("Realistic · complete"): the race
over the real ground around each circuit, seen from above, with glass panels floating over it. The
game itself doesn't change: every call, panel and control stays where the player expects it.

## Decisions

- **Everything is redesigned except eras.** The home page, the race, the result, versus, survivor,
  how to play, how it works, the tutorial, the legal page and the account bits. The eras branches
  (`origin/eras*`) are not touched.
- **The same race screen behaviour.** Focus view: the map takes the screen, the leaders beside it.
  "Show stats" brings the timing tower and the stats in at the sides and the map shrinks between
  them. The calls, the dock and the control bar work as now. Only the look changes.
- **No battle camera popup.** The map itself is the battle camera: during a battle it zooms onto
  the two cars, as it does today, and zooms back out after. The picture-in-picture from the
  mockups is dropped.
- **Real maps for every circuit.** Under the track: forests, grass, farmland, buildings, roads,
  water, gravel and run-off from OpenStreetMap, placed where they really are, for all 20
  circuits. The track keeps its outline, drawn as tarmac with red and white kerbs.
- **Maps load as images.** Each circuit's ground is one JPEG (`apps/web/public/basemap/`), made
  once by the pipeline, loaded only for the race being run. Drawing the ground live (as the design
  board does) is too slow on most machines. The battle camera needs detail close up, so the
  images are about 1 pixel per metre.
- **One theme, no switch.** The look:
  - **Text:** Inter Tight for words and IBM Plex Mono for numbers. Both are free Google fonts,
    and they replace Archivo.
  - **Panels:** dark glass (slate, slightly see-through, blurred) with a thin light edge.
  - **Colours:** the team colours stay. Tyres, flags and the box red stay as they are.
- **Going back.** The tag `before-realistic` is the game as it was (car icons on the 2D map, 3D
  parked). Don't merge this branch, or revert its merge, and the old look returns.

## How it's built

- **The pipeline** (`pipeline scenery`, then `pipeline basemap`):
  - The scenery step gains the other 15 circuits.
  - The basemap step writes each circuit's ground as an SVG, in metres.
  - `apps/web/scripts/basemap.mjs` turns each SVG into a JPEG.
  - `data/basemap/index.json` says, per race, where its outline sits on the image (a
    similarity transform, already worked out by the scenery step).
- **The web app:**
  - `TrackMap` draws the image under the track inside its own SVG, so the battle camera's
    zoom moves the ground with the track.
  - Theme tokens live in `index.css`. Components use the tokens and the shared glass classes
    instead of hard-coded greys.
- **The 3D view stays parked.** Its switch and code are untouched.

## Phases

1. Theme, race screen (both views, the calls, the dock, the control bar), the map with the real
   ground for the five circuits that already have scenery.
2. The other 15 circuits, then the home page, the result, versus, survivor, how to play, how it
   works, the tutorial and the rest; phone polish.

## Testing

Unit tests, lint, typecheck and the end-to-end race. A look at every circuit's map on localhost,
on a computer and at phone width.
