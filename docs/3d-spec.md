# 3D race view

Status: built for five circuits, on the `graphics-3d` branch, not merged. For testing on localhost.

## What it is

On a computer, at the five circuits below, the race screen opens in a 3D view of the real
circuit. The full 2D track map sits in the corner. Click the small one to swap them; the game
remembers the choice per browser. Phones and tablets keep the 2D map alone, exactly as before.

| Circuit | Race files | Light | Notes |
| --- | --- | --- | --- |
| Monza | italy-2019, italy-2022, italy-2024 | afternoon | 44 grandstands, the park's trees |
| Spa-Francorchamps | belgium-2024 | overcast | 104 m of climb round the lap, the Ardennes forest |
| Bahrain | bahrain-2021, bahrain-2022 | dusk, floodlights | desert, palms |
| Suzuka | japan-2024 | afternoon | the crossover bridge, the Ferris wheel |
| Hungaroring | hungary-2019, hungary-2025 | summer | |

The five versus tracks are the same five, so versus gets the 3D view too.

## Decisions

- **Option A, real map data.** OpenStreetMap supplies the track, buildings, grandstands, land cover,
  roads, streams and trees. Terrain tiles supply the ground's shape. Everything stands where it
  really is. Only the trackside furniture is placed by rule, because no open map has it: armco,
  catch fencing, tyre walls, boards and floodlights.
- **Computers only.** The 3D view needs a screen at least 900 px wide with a mouse or trackpad.
  Phones and tablets, including iPads, get the 2D map.
- **3D is the main view, the 2D map in the corner.** While the 3D view builds (a few seconds), the
  2D map is the main view.
- **One source of where cars are.** The 2D map's motion places every car; the 3D view follows it
  (`MapFeed`). Each race's outline is lined up with the real track to within 1 to 3 m.
- **Cameras.**
  - Overview is the default: drag to turn it, scroll to zoom.
  - Chase is a helicopter shot behind your car.
  - TV uses high cameras round the lap that cut as you pass.
  - A battle camera takes over during a battle.

  A lap takes 10 seconds, so the cars run at hundreds of metres a second. The cameras are
  locked to the car rather than trailing it.
- **Cars read from far away.** They grow with the camera's distance, so they show in the overview.
  They are real size in close shots.
- **Our own designs only.** The car is an original open-wheel design in team colours. The boards
  carry made-up names (LASTSTINT, BOX BOX...), never real brands.
- **Credit.** The 3D view always shows "© OpenStreetMap contributors · Elevation: Mapzen". The map
  licence (ODbL) requires the first part.

## How it's built

- `pipeline scenery [circuit...]` (pipeline/src/pipeline/scenery.py) writes
  `data/scenery/<circuit>.json` (370 to 810 KB each). It caches downloads in `cache/scenery`. It:
  - downloads the circuit area from OpenStreetMap (Overpass) and the terrain tiles;
  - finds the lap: the cycle of raceway sections matching the official length and the game's outline;
  - shapes the ground to the track's smoothed profile, with bridges raised and their approaches as embankments;
  - lines each race's outline up with the lap: a similarity fit and a lap-fraction table.
- `apps/web/src/three/` builds and draws the scene. All 3D code lives in this folder, plus
  `track/feed.ts`, the per-frame hand-off from the 2D map. It loads only when needed: about 206 KB
  of code and 140 to 270 KB of scenery, compressed.
  - `world.ts`: the ground, track, kerbs, pit lane, barriers, buildings, grandstands with crowds, trees, sky and light.
  - `cars.ts`: the cars.
  - `Scene3D.tsx`: rendering, cameras, tags, and quality that steps down on slow machines.
  - `RaceStage.tsx`: the swap.

## Testing on localhost

- Practice any race: `http://localhost:5173/?race=belgium-2024`. Also `italy-2024`,
  `bahrain-2022`, `japan-2024` and `hungary-2025`.
- Versus: `http://localhost:5173/versus`. Pick any of the five tracks.
- Automated browsers (the e2e tests) keep the 2D map. Add `?view=3d` to show 3D in a headless
  desktop browser.

## Scrapping it

To go back to the normal track map with icons for the two main cars, there are three options.

1. **Quickest, leaves the code in:** in `apps/web/src/three/enabled.ts`, set `SCENE_3D = false`.
   The race screen is then the 2D map with the car icons everywhere.
2. **Clean, never merge the branch:** the car icons alone are the commit tagged `before-3d`. Start
   a branch from it with `git switch -c car-icons before-3d` and merge that one instead.
3. **Clean, after merging:** revert the 3D commits (everything after `before-3d`). The car icons
   stay.

## Limits and what's not real

- It looks like a clean, realistic game world, not a photograph. Buildings are their real
  footprints and heights, with generic walls and roofs. Trees are generic species, placed inside
  the real woods.
- The ground's shape comes from a surface model with about 5 m detail, smoothed. Small dips and
  crests are softened.
- Grandstand seating is built from each stand's footprint. Suzuka's map has no grandstands, so
  one is built on the main straight, as at every circuit.
- The Hungaroring's map has no pit lane, so the game's own pit lane is used, lined up with the
  track.
- Other races at these circuits (bahrain-2018 and -2023, hungary-2022 and -2024, japan-2023) have
  no 2D outline of their own. They keep the current behaviour: no map.
