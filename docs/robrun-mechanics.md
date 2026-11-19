# Rob Run: mechanics research → non-infringing ideas for the POSTER RUN and patrols
Sources (public guides, read 2026-11-19): hub.robrun.de gameplay overview; robruncodex.com escape guide; games.gg avoid-cops guide;
gamers.wiki roles guide; robrunguide.wiki gameplay explainer. No assets, names, maps, UI, text or audio are copied. Only general,
genre-common design patterns are noted and re-expressed in Reckless World's own terms (legal street-art poster run, no theft, no weapons).

## What Rob Run does (summary, in our words)
- Role switch: you scout safely as a civilian, then opt into risk explicitly (mask on). Risk mode lasts until you leave the zone.
- Three-phase job: approach (scout routes and camera angles), break (fast, limited bag, choose what to take), escape (the hard part).
- Concealment vs escape: hiding (bushes, bins, cabinets) only buys time; leaving the zone actually ends the pursuit.
- Witnesses recover over time; lingering lets them report. A careless exit (collisions) re-raises suspicion.
- Getting caught has graded outcomes (surrender keeps gear, loses the bag); police are a real role with their own incentives.
- Notoriety: high-attention players are revealed more widely; the board resets weekly.

## Ideas we can use (re-expressed, legal, family-safe)
1. OPT-IN RISK: posters are only "hot" once you pick up a roll of posters at a crew drop (phone CTA). Before that you can walk the
   route freely and see the walls marked. Putting the roll away at a drop ends the run (no penalty).
2. SCOUT PHASE: the phone map shows each wall's sightlines (patrol cone already drawn on the minimap) before you start; a 10 s
   "look around" bonus if you check a wall from across the street first (encourages planning, not grinding).
3. PASTE TIMING: pasting is a hold-to-fill meter (1.5–3 s by wall size). Moving or being seen mid-paste leaves a half poster
   (fewer points, still counts for the route). Choose: big wall slow, small wall quick (our version of "limited bag").
4. WITNESSES: shopkeepers/doormen near some walls glance over on a timer; paste while they look away. If they see you they
   "mention it" after a few seconds (heat +1 delayed), so finishing fast still matters. No phone-the-police wording; HUD says SEEN.
5. HIDING ≠ ESCAPING: alleys, bus shelters (new street kit), crowds outside venues and the inside of any venue hide you and
   speed heat decay (already in missions.js: inside = 6x decay). Fully clearing heat needs you to leave the patrol's area
   (a "cool-off zone" ring on the map) or wait out the timer. Matches our current HIDE table.
6. CLEAN EXIT: after the last wall, walk or bus to a crew drop to bank the run. Running into traffic or sprinting past a patrol
   during the exit re-raises heat (encourages calm exits).
7. GRADED OUTCOMES: if a patrol stops you: "MOVE ON" → you keep posters pasted so far, the unpasted roll is gone (no XP, no
   loss of wardrobe). Never arrest, never violence, never money.
8. PATROL BEHAVIOUR: patrols drive set loops (traffic graph), slow at junctions and glance down side streets; at heat 2 one
   wagon parks at a junction ahead (cut-off, never ram). Patrols lose interest when you are inside a venue or out of the ring.
9. NOTORIETY (light): the more walls in one run, the more patrols spawn on the next run that night (resets each in-game night,
   our version of a reset). Purely cosmetic leaderboard stays local; the game never awards XP and never PUTs.

## Explicitly NOT used
Masks, theft, weapons, intimidation, bribes, jail, raids, base building, player-vs-player policing, any Rob Run names
(Looty Bay etc.), UI layouts, icons, sounds or text.

## Implementation notes (next stage)
missions.js: add `run.roll` (opt-in), paste meter, half-poster state, witness NPC timers on 1/3 of walls, cool-off ring,
exit-to-drop banking, per-night notoriety; hud.js: paste meter + SEEN/LOST THEM already present. Shelters from the street kit
count as hide spots. Keep the fail words SEEN / MOVE ON.
