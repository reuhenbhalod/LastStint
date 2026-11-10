# Versus mode spec

**Status:** draft for review (Nov 9, 2026). Nothing is built yet.

**Decided so far (the owner):**
- Two people play each other live.
- It's a custom 20-lap race with only their two cars, starting side by side.
- Each car has realistic strengths and weaknesses.
- **The winner is whoever makes the better calls (grading).** The race result is shown too.

**Open:** questions marked **[Q]** need the owner's answer before building.

---

## V1. The race

**The track.**
- Each versus race uses one real track's measured numbers from its race file:
  - pit loss: green, under a VSC and under a safety car, plus the spread of real stops;
  - tyre wear, drop-off and the new-tyre bonus;
  - the fuel effect;
  - the overtake model and the dirty-air penalty;
  - safety car and VSC lap times.
- The map comes from the track outline in `data/tracks`.

**The grid.**
- Two cars start side by side: P1 and P2, 0.3 s apart. Who starts in front is picked by the seed, and the result shows it.
- Both start on mediums with 0 laps on them.
- Each car has 20 laps of fuel plus the player's chosen margin.
- 20 laps.
- **[Q]** Should both cars start on mediums, or does each player pick their starting tyre (visible to both)?
- No other cars on track.

**The rules.**
- One stop is required: two different dry tyres, as in a real race. So every race has at least one pit call.
- The overtake model, the battles, dirty air, the headset settings (pace, battery, fuel) and the radio all work as they do in solo.

**Events.**
- The seed decides any safety car, VSC or rain, using the track's real rate.
- **Safety car or VSC:** about one race in three gets one, between laps 4 and 17, lasting 2–4 laps.
- **Rain:** dry only at launch. Rain comes later, on a track that has had wet races.
- Both players get the same events on the same laps, and neither knows them in advance.

**Starting tracks:** five tracks with very different characters, all with a map outline:

| Track | Character | Race file used |
|---|---|---|
| Monza | Power, long straights | `italy-2024` |
| Spa | Power plus high-speed corners | `belgium-2024` |
| Hungaroring | Twisty, hard to pass | `hungary-2025` |
| Bahrain | Heavy tyre wear | `bahrain-2022` |
| Suzuka | Flowing corners | `japan-2024` |

Monaco, Silverstone and Singapore have no map outline yet. Adding one needs a network download (`pipeline outline`), which can come later. **[Q]** Are these five OK for launch?

## V2. The cars

**Stats.**
- Every car spends the same budget over five stats.
- Each stat is a small, realistic change to what the engine already models, so the calls decide the race rather than the car.

| Stat | Effect in the engine | Range |
|---|---|---|
| **Top speed** | Lap time on the track's straight share | up to ±0.30 s a lap |
| **Cornering** | Lap time on the track's corner share | up to ±0.30 s a lap |
| **Tyre wear** | Wear rate, so the drop-off comes earlier or later | ±15% |
| **Fuel use** | Burn per lap, and so weight and lift-and-coast | ±5% |
| **Pit crew** | Stationary time added to every stop | ±0.6 s |

**Track character.** Each track gets a straight share from its outline: the share of the lap with low curvature. Monza's is about 0.75 and the Hungaroring's about 0.45. On a given track a car's lap time changes by:

  `topSpeed × straightShare + cornering × (1 − straightShare)`

The shares are estimates from the track shapes, and the car-pick screen says so.

**The four cars** (stat points out of ±2; each car's points add up to 0):

| Car | Top speed | Cornering | Tyre wear | Fuel use | Pit crew | In one line |
|---|---|---|---|---|---|---|
| **Bullet** | +2 | −1 | −1 | 0 | 0 | Flies on straights, hard on its tyres |
| **Glider** | −1 | +2 | +1 | −1 | −1 | Quick in corners, gentle on tyres, thirsty |
| **Endurance** | −1 | −1 | +1 | +1 | 0 | Slower, but goes long and saves fuel |
| **Balanced** | 0 | 0 | 0 | 0 | 0 | Middle of the road at everything |

The point values are a first pass. Before launch they get checked with simulated head-to-heads on all five tracks:
- no car may win more than 60% of no-call races on any track;
- across the five tracks, every car should average close to 50%.

**Picking.**
- Players pick at the same time, and either can pick any car, including the same one.
- The picks are revealed together before the start.
- **[Q]** Should both be allowed the same car, or must they differ?
- **[Q]** Should players also get a team livery (colours only) on top of the car?

## V3. The calls

The real-race moments don't exist here, so calls are raised by what's happening. Both screens see the same state, so they raise the same calls at the same time.

| Call | Raised when | Options |
|---|---|---|
| **Pit window** | Your tyres are within 5 laps of their drop-off, or it's lap 8+ and you haven't stopped | Box (pick a tyre) / stay out |
| **Safety car or VSC** | The first lap of one | Box (pick a tyre) / stay out |
| **They've pitted** | The other car stopped last lap | Box to answer / stay out |
| **Final laps** | 5 laps to go, gap under 3 s | Attack, defend or hold (battle stance) / pace |

Quick calls, battles and the headset work as in solo, and each player answers their own.

**Big calls are blind and timed.**
- **Timing:** when a big call comes up for either player, the race pauses for both. Each player gets 12 s, plus the reading pause from the call timing spec, to answer their own call.
- **No answer:** "stay out".
- **Who waits:** a player with no call that lap sees "The other wall is deciding" while the race is paused.
- **What you see:** neither player sees the other's choice until the race resumes. A stop then shows on track as it happens.

**No safety net.** Nobody gets auto "stay out" calls in versus, so a call can't come up on tyres that are only a few laps old.

## V4. The winner

- **How calls are graded:** each player's calls are graded as in solo. For each call, the engine replays the race many times with each option and measures the chance of finishing ahead of the other car. The other car's real calls stay fixed in every replay.
- **The score:** the score is the average points per call, as in solo.
- **The winner:** whoever scores higher.
  - **First tie-break:** the higher average chance across the calls.
  - **Second tie-break:** the race result.
- **The results screen:** "Calls 82 vs 64: Alex wins", the road result next to it ("Sam finished 1.4 s ahead"), and both players' calls side by side on one lap timeline.
- **Grading time:** solo grades in the browser. In versus the server grades, so both players see the same score at the same time. **[Q]** Do we accept a short "grading…" wait (a few seconds) at the end, or grade on both browsers and compare?

## V5. Playing live

**Matches.**
- One player creates a match and gets a link and a 4-letter code.
- The other joins with either one.
- No accounts needed. Signed-in players get their name shown and their result saved.
- **[Q]** Is invite-only enough to start? Matchmaking with strangers can come later.

**The server.**
- **The room:** each match is one Cloudflare Durable Object, holding a WebSocket to each player.
- **What it does:**
  - keeps the lap clock, at a fixed speed with no 2x and no pause;
  - pauses both players for a big call;
  - collects each player's calls, tagged with the lap they apply to;
  - sends the calls on to the other player once the lap they apply to is reached.
- **Lockstep:**
  - Both browsers run the same race from the same seed with the same call list. Only the calls travel, not the race.
  - A call reaches the other player before the lap it acts on.
  - The server applies calls in a fixed order, so both browsers stay identical.
- **Check:** at the end the server re-runs the race and checks it, as `verifyRun` does in solo.

**Problems.**
- **Disconnect:** the race pauses for up to 30 s for a reconnect. After that the driver makes his own calls for the rest of the race, and the result notes it.
- **Leaving:** the other player wins.

**Fair play.** Your own calls are visible only to you until they act on the track: a stop shows when you pit, and a battle stance when the cars meet.

## V6. Screens

1. **Home:** a "Versus" button, like Gauntlet, opens the lobby.
2. **Lobby:**
   - Create a match: track, then the link and code.
   - Join a match: enter a code.
   - Who's in.
3. **Car pick:**
   - the four cars with their stat bars;
   - the track's character ("Monza rewards top speed");
   - a 30 s timer, then picks revealed together.
4. **Race:**
   - the race screen with only two cars;
   - the score bar shows both players' names;
   - the "other wall is deciding" overlay;
   - no Plan panel. The race opens with a choice of one-stop or two-stop plans instead, which is the first graded call.
5. **Results:** see V4, with a rematch button.

## V7. The build, in phases

Each phase is tested before the next.

1. **The engine (`packages/sim`).**
   - Two-car custom races: a race from a track template, two cars and seeded events.
   - Car stats on `CarState`, with defaults of 0 so solo and the Python parity are unchanged.
   - Two player cars, with no computer reactions for either.
   - The triggered calls.
   - **Tests:** determinism (same seed and calls, same race); car balance (V2); and that solo is unchanged against the golden files.
2. **Grading.** Grading against the other car's real calls (V4), and the balance runs.
3. **The live room (`apps/worker`).**
   - The Durable Object, the WebSocket messages, lockstep, the paused big calls, reconnects and checking the result.
   - Tested with two simulated clients.
4. **The screens (`apps/web`).**
   - Lobby, car pick, the versus race screen and results.
   - Two browsers in an end-to-end test.
5. **Launch.** Localhost first, then live.

## Not in this version

- Matchmaking with strangers, a ranking ladder, or more than two players.
- Custom points spending and rain.
- Monaco, Silverstone and Singapore, backmarker traffic, and spectators.
