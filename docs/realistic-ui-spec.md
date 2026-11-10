# Realistic redesign

Status: built on the `realistic-ui` branch (not merged). Every screen is in the new look; all 18
circuits with a track outline (the 40 races that have one) have their real ground. Lint, types,
unit tests (web and pipeline) and the end-to-end race pass. For testing on localhost.

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
- **A follow camera, on a button.** "Follow car" in the control bar swaps the whole-lap view
  for a close view that moves with your car round the lap: the map stays as it is (north up,
  from above), the view a third of the circuit wide and looking a little ahead of the car.
  Pressing the button pans onto the car (and back out). A battle still takes the camera and
  hands it back after. The choice is kept on the device. (Trackside TV cameras with cuts
  between them were tried first and dropped: the cuts were awkward.)
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

## Detail on the map

- **Barriers:** the real walls, armco and catch fences from the map data, in their real places,
  drawn about twice their real width so they read on a whole-lap view.
- **Kerbs:** red and white along the track's edge, on the inside at each apex and on the
  outside at each exit.
- **Buildings:** each casts a shadow as long as it's tall (the map's real heights), with roofs in
  a few real tones and a darker rim.
- **Grandstands:** rows of coloured seats along each stand's length.
- **Track width:** over real ground the track is drawn near 30 m wide (between 12 and 22 map
  units), so the run-off and barriers beside it show. The battle lines scale with it.

## Circuits

Monza, Spa, Bahrain, Suzuka, the Hungaroring, Yas Marina, the Red Bull Ring (Austria and
Styria), Montreal, Shanghai, Paul Ricard, Mexico City, Miami, Zandvoort, Portimão, Sochi, Jeddah,
Barcelona and the Circuit of the Americas. Each race's outline sits on its circuit's image to
within 1 to 4 m (Abu Dhabi 2020, run on the old layout, 7 m).

- **Sochi** has no lap tagged as a raceway (it runs on the Olympic Park's roads). There the game's
  own outline is fitted onto the real roads (`align_to_roads`) and stands in for the lap.
- **The lap search is bounded.** Paul Ricard's dozens of layouts made the search hang, so it now
  stops after a set number of steps and keeps the 300 laps nearest the official length.
- **Races with no outline** (Monaco, Singapore, Silverstone, Australia, Brazil, the 70th
  Anniversary and the extra years at some circuits) have no map, as before.

## Phases

1. Theme, race screen (both views, the calls, the dock, the control bar), the map with the real
   ground for the five circuits that already have scenery.
2. The other 15 circuits, then the home page, the result, versus, survivor, how to play, how it
   works, the tutorial and the rest; phone polish.

## Testing

Unit tests, lint, typecheck and the end-to-end race. A look at every circuit's map on localhost,
on a computer and at phone width.
