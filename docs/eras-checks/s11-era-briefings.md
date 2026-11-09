# Job 1.11: era briefings

Nov 8 2026. One briefing per era (spec §4 names and years, §14 "Era detail: the era's name,
years and short briefing"), in `apps/web/src/eras/catalog.ts` (`briefing`, now required). The
era detail screen shows it; the `data-todo="era-briefing"` slot is gone.

**Where the text lives.** Only in the web catalog. The worker serves no era text:
`apps/worker/src/eras.ts` reads `eras` rows (id, name, years, play order, released_at) and
migration `0010_eras.sql` has no briefing column, and the web's era screens take an era's name,
years and briefing from the catalog. So no migration was added; one is needed only if the
briefings ever have to change without a web deploy.

**Shape.** 2-4 sentences on what shaped the era's strategy (rules, tyres, refuelling, fuel,
safety car; the title rivals), then one "Expect ..." line from the era's row in
`packages/sim/src/eras/eras-config.json` (★2 accuracy threshold, information level, rival
policy, decision timer). `catalog.test.ts` checks every era has one and that the expect line's
numbers match the config, so a config change fails the test until the text is updated.
The "pit board" and "reconstructed" notes on Eras 1-2 come from the spec (§7 era presentation;
§4 data availability: Eras 1-2 are full reconstructions). "No safety car comes out that didn't
really happen" before 1993 is the game's rule (rules.ts `SAFETY_CAR_FROM`, owner decision Nov 7).

All wording is original. No radio is quoted. Nothing was taken from formula1.com.

## Sources

| Key | Source |
|---|---|
| JOL | Jolpica driver standings, `https://api.jolpi.ca/ergast/f1/<year>/driverstandings.json?limit=2`, 1983-2025, read Nov 8 2026 (positions 1-2, points, team) |
| WP-22 | [2022 Formula One World Championship](https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship) |
| WP-21 | [2021 Formula One World Championship](https://en.wikipedia.org/wiki/2021_Formula_One_World_Championship) |
| WP-17 | [2017 Formula One World Championship](https://en.wikipedia.org/wiki/2017_Formula_One_World_Championship) |
| WP-14 | [2014 Formula One World Championship](https://en.wikipedia.org/wiki/2014_Formula_One_World_Championship) |
| WP-11 | [2011 Formula One World Championship](https://en.wikipedia.org/wiki/2011_Formula_One_World_Championship) |
| WP-89 | [1989 Formula One World Championship](https://en.wikipedia.org/wiki/1989_Formula_One_World_Championship) |
| WP-TY | [Formula One tyres](https://en.wikipedia.org/wiki/Formula_One_tyres) |
| WP-SC | [Safety car](https://en.wikipedia.org/wiki/Safety_car) |
| WP-REG | [Formula One regulations](https://en.wikipedia.org/wiki/Formula_One_regulations) |
| RULES | `packages/sim/src/rules.ts` header (sources checked Nov 7: Wikipedia "Drag reduction system", "Kinetic energy recovery system", "Safety car"; BBC / Bridgestone / Motorsport.com on 2005; Autosport and RaceFans on 2007; 2025 FIA Sporting Regulations) |
| REFUEL | `pipeline/src/pipeline/refuel.py` docstring (Wikipedia "Pit stop", 1984/1986/1987 season pages; Honda "1988 RA168E"; Wikipedia "1985 San Marino Grand Prix") |
| CFG | `packages/sim/src/eras/eras-config.json` and spec §7 (information levels, rival policies) |

## Facts by era

| Era | Fact in the briefing | Source | Owner checked |
|---|---|---|---|
| 10 | Ground effect reintroduced in 2022, first time since venturi tunnels were banned in 1983 | WP-22 | |
| 10 | Underside of the car the main source of grip; aim: let drivers follow each other more closely | WP-22 | |
| 10 | Wheels went from 13 to 18 inches | WP-22 | |
| 10 | No refuelling (banned from 2010) | WP-REG, REFUEL | |
| 10 | DRS 2011-2025; hybrid ERS 2014+; VSC 2015+ | RULES | |
| 10 | Verstappen champion 2022, 2023, 2024; Norris 2025 on 423 to Verstappen's 421 (two points) | JOL | |
| 10 | Expect: full, Standard, 45 s, 70% | CFG | |
| 9 | 2021 cars mostly carried over; the main change a floor cut back near the rear tyre; the big rule change delayed to 2022 | WP-21 | |
| 9 | Hamilton (Mercedes) and Verstappen (Red Bull) entered the Abu Dhabi finale tied on points | WP-21 | |
| 9 | Verstappen passed Hamilton on the last lap after a late safety car restart | WP-21 | |
| 9 | Expect: full, Standard, 45 s, 72% | CFG | |
| 8 | 2017: car width 1,800 to 2,000 mm; tyre width up 25%; aim 4-5 s a lap faster than 2016 | WP-17 | |
| 8 | Hamilton (Mercedes) champion 2017-2020; Vettel (Ferrari) second 2017 and 2018; Bottas second 2019 and 2020 | JOL | |
| 8 | No refuelling; DRS, hybrid battery, SC and VSC | WP-REG, RULES | |
| 8 | Expect: full, Standard+ (covers an undercut when its stop is within 7 laps, not 4), 45 s, 75% | CFG | |
| 7 | 2014: 1.6-litre turbocharged V6 with an energy recovery system | WP-14 | |
| 7 | Fuel flow limited (100 kg/h above 10,500 rpm) | WP-14 | |
| 7 | Mercedes drivers first and second 2014, 2015, 2016; Hamilton champion 2014 and 2015 over Rosberg; Rosberg 2016 on 385 to 380 (five points) | JOL | |
| 7 | VSC officially introduced for 2015 | WP-SC, RULES | |
| 7 | Expect: reduced, Standard+, 45 s, 78% | CFG | |
| 6 | Refuelling banned from 2010; every car starts with a full fuel load | WP-REG, REFUEL | |
| 6 | Pirelli sole supplier from 2011, mandate to design a higher-wearing tyre; testing showed three stops at most races | WP-11 | |
| 6 | DRS first used in 2011; KERS not used in 2010, optional again for 2011 (raced in 2009) | WP-11, RULES | |
| 6 | Vettel (Red Bull) champion 2010-2013; Alonso (Ferrari) second 2010 (256-252), 2012 (281-278) and 2013 | JOL | |
| 6 | Expect: reduced, Smart (overcut, wet crossover), 30 s, 80% | CFG | |
| 5 | Refuelling allowed 1994-2009 | REFUEL | |
| 5 | 2005: one set of dry tyres for qualifying and the race, changed only if damaged or between wet and dry | RULES, WP-TY | |
| 5 | Bridgestone sole supplier from 2007 after Michelin left; both dry compounds must be used (unless wets or inters are) | WP-TY, RULES | |
| 5 | Slicks reintroduced in 2009; KERS raced in 2009 | WP-TY, RULES | |
| 5 | Alonso (Renault) 2005, 2006; Räikkönen 110 to Hamilton 109 (2007); Hamilton 98 to Massa 97 (2008); Button (Brawn) 2009 | JOL | |
| 5 | Expect: reduced, Smart, 30 s, 82% | CFG | |
| 4 | Refuelling allowed (1994-2009) | REFUEL | |
| 4 | Michelin entered in 2001, a tyre war with Bridgestone; Michelin left after 2006 | WP-TY | |
| 4 | Grooved tyres (introduced 1998, required to 2008) | WP-TY | |
| 4 | Schumacher (Ferrari) champion 2000-2004; 2003 Schumacher 93, Räikkönen 91 (two points) | JOL | |
| 4 | Expect: limited (gaps to 0.5 s, rival fuel hidden), Smart, 30 s, 84% | CFG | |
| 3 | Refuelling banned 1984-93, allowed again from 1994 (ten seasons banned) | REFUEL | |
| 3 | Safety cars officially introduced in 1993 | WP-SC | |
| 3 | Schumacher (Benetton) 92 to Hill (Williams) 91 in 1994; Schumacher 1995; Hill 1996; Villeneuve 1997; Häkkinen 1998, 1999 | JOL | |
| 3 | Bridgestone joined Goodyear for 1997; Goodyear left after 1998 | WP-TY | |
| 3 | Grooved tyres introduced in 1998 | WP-TY | |
| 3 | Expect: limited, Expert (covers on the lap you stop, grades its own calls), 20 s, 86% | CFG | |
| 2 | Turbos banned at the end of 1988; 3.5-litre engine formula from 1989 | WP-89 | |
| 2 | Refuelling banned 1984-93, so stops were for tyres | REFUEL | |
| 2 | Senna and Prost both McLaren in 1989; title decided at the Japanese GP at Suzuka, Prost champion | WP-89, JOL | |
| 2 | Senna 1990, 1991; Mansell 1992; Prost 1993 | JOL | |
| 2 | Safety car official from 1993; the game makes none up before then | WP-SC, RULES | |
| 2 | Expect: minimal, Expert, 20 s, 88%; pit-board prompts; reconstructed laps | CFG, spec §4 and §7 | |
| 1 | Refuelling allowed until 1983, banned from 1984 | REFUEL | |
| 1 | Turbo race fuel: 220 L 1984-85, 195 L 1986-87, 150 L 1988 (Honda's figure; Wikipedia's 1988 page says 155 L) | REFUEL | |
| 1 | A car that ran out of fuel was out (San Marino 1985) | REFUEL | |
| 1 | Piquet 1983 (Brabham) and 1987 (Williams); Lauda 72 to Prost 71.5 in 1984; Prost 1985, 1986; Senna 1988 | JOL | |
| 1 | Expect: minimal, Expert, 20 s, 90%; pit-board prompts; reconstructed laps; no made-up safety car | CFG, spec §4 and §7, RULES | |
