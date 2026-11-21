# Stage 11: mechanics QA test list

Automated: `node tools/qa.mjs` (headless, against `npm run preview` on :4173). Last run 2026-11-21 01:55 GMT: **9 / 9 PASS**
(look-behind B, stamina drain/lock/refill, wall collision, sensitivity saved, heat clamp/chasers/clear, gamepad stick + R3, weather ramp, photo filter/clean HUD/reset, no XP in the event log).

Manual (real device, before each release). Tick each one.

## Camera
- [ ] Hold B: camera snaps behind-to-front in one frame, restores in ~180 ms on release. Gamepad R3 (button 11) does the same.
- [ ] Mouse drag / right stick: yaw + pitch follow; pitch clamps (no flipping under the ground).
- [ ] Sensitivity slider in PHONE > SETTINGS: 0.5 is slow, 2.0 fast; persists after reload (rw.sens).
- [ ] Camera never clips through a facade when you back into a wall; inside a club it never goes behind the entrance wall.

## Movement and stamina
- [ ] Walk, jog, sprint (Shift / RT / RUN button); sprint drains in ~4.5 s, then forced jog with a red pulse; refills ~3 s after a 2.5 s delay.
- [ ] Touch RUN: hold >350 ms and release while moving latches sprint; a second tap cancels.
- [ ] Jump (Space / A): single jump, landing dip, no double jump.
- [ ] Walking into buildings, railings, bollards and parked cars: you slide, never pass through.

## Heat and patrols
- [ ] Paste a poster in a patrol's cone: heat 1, one chaser; again while seen: heat 2, two chasers; never above 3.
- [ ] Break line of sight + hide at a bus stop / venue door: cool-off speeds up, "LOST THEM" note, chasers return to traffic.
- [ ] Caught (chaser within reach for the timer): run fails cleanly, no stuck state, HUD heat bar clears.
- [ ] Entering a venue mid-heat: you go inside, heat is held (no chase indoors); exiting restores traffic.
- [ ] Sprinting past a patrol while banking a run raises heat 1 only once.

## Driving, cab, glider
- [ ] Enter/exit a parked car (E); horn H makes AI pull over; peds hurry clear; car radio next track K.
- [ ] Hail a black cab, ride, drop at kerb; player re-appears facing the destination.
- [ ] Glider: board at a stop, fast travel, exit at the chosen stop.

## Stage 10
- [ ] Rain: showers come and go every few minutes (?rain forces it, ?norain keeps it dry); streaks + hiss outside, none inside a venue (hiss muffled).
- [ ] Peds flinch and side-step when you sprint past within ~2 m; they turn and dance when you dance near them (outside).
- [ ] Photo mode (P / CAMERA): FILTER cycles NONE > B&W > NOIR > WARM > COOL > NEON (C), POSE STAND/DANCE (V), HUD ON/OFF (H); closing resets all three; the saved thumb carries the filter.

## Rules (must always hold)
- [ ] No XP is awarded or shown as earned in game; events stay `test:true`; the game never PUTs.
- [ ] No PSNI/Translink marks or crests anywhere; number plates fictional or blank.
- [ ] LOCATION X is labelled LOCATION X.

## Frontage + poster-wall check (D, 2026-11-21)
- Every venue frontage from 9 m (tools/snap.mjs, `__rw.allDoors()[i]`, camRel `[Math.PI,5,3,3.5]`): Ware-House XL, Thompsons, Terminus, The Ware-House, LOCATION X, Temple. All read correctly; signage unmirrored. Shot: shots/world_2026-11-21/D_frontages_all6.png
- All 5 poster walls forced visible and shot from 1.3 m: every poster reads left-to-right (GRAND TOUR, OFFICIAL AFTERPARTY, dates). Shot: D_poster_walls_unmirrored.png
- Streamed buildings (C) checked against every door and poster spot: none within 4 m.
