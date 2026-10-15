# Modern Guns — game server

Authoritative [Colyseus 0.18](https://colyseus.io) server for **Modern Guns**, an 8-player
FPS (Team Deathmatch, Free-for-all and Search & Destroy) on eight maps, *Pinecrest Lodge*, *Skyport Terminal*,
*Bramblewood*, *Old Quarter*, *Hollow Creek*, *Palmwood*, *Atomic Acres* and *Dustline Pumpstation*. The client lives in `../rust-client`.

Rooms are created with a `map` option (`pinecrest`, `terminal`, `bramble`, `quarter`, `hollow`, `palmwood`, `acres` or `dustline`, see
`src/shared/maps.js`) and matchmaking filters on mode and map. A client that
doesn't send one (from before maps) gets Dustline. Each room builds its own
Rapier world from its map; the bot nav graph is built once per map. On a
hilly map (Pinecrest Lodge) the nav grid looks for floor from the ground's own
height (`nav.grid.floorAt`), its links may climb `nav.climb` per metre, and
with `nav.steep` none is kept where the ground between its ends rises faster
than that (an outcrop's sheer side between two easy heights).

```bash
npm install
npm run dev      # nodemon, restarts on change
npm start        # plain node
```

Listens on `PORT` (default **3000**) for both HTTP (`/health`, `/api/*`,
matchmaking) and WebSockets. See `.env.example` for the other settings.

## Hosting (Bloxity Legion)

Game id `modern-guns`. Pushing to `dev` or `main` runs
`.github/workflows/deploy.yml`: it builds the `Dockerfile` (Node 24 alpine,
production deps only, runs as the non-root `node` user), pushes it to this
repo's GitHub Container Registry and asks Legion to roll it out on the `dev` or
`prod` channel (`https://modern-guns(.dev).host.bloxity.io` for HTTP; players'
sockets go through the matchmaker, see the client README).

One-time setup:

1. Repo → Settings → Secrets → Actions: add `LEGION_DEPLOY_TOKEN` (My Games →
   eye icon). Never commit it.
2. After the first push, make the package public (repo → Packages →
   `modern-guns-server` → Package settings → Change visibility) and re-run the
   workflow.

What the server does for Legion:

- Listens on the injected `PORT`; `GET /health` answers `ok` straight away.
- Allows CORS from `CLIENT_ORIGIN` and `modern-guns(.dev).play.bloxity.io`.
- **Drains on SIGTERM** (deploys, scale-down; only with `NODE_ENV=production`,
  so Ctrl+C still stops a local server at once). Every room is locked, so new
  players go to the fresh pod. A match in progress plays out, its clock cut to
  at most 7 minutes, with a notice to its players; after the results its
  players are closed with code 4100 (`SERVER_MOVING_CODE`), which makes clients
  rejoin through the matchmaker. Rooms with nobody mid-match move their players
  on at once, and everything is moved on after 9 minutes (Legion waits 10).
- `seatCap` in the workflow is **32** (four full rooms per 1 vCPU / 512 MB pod).
  `npm run test:load` measured six full rooms (48 players incl. bots) at ~14% of
  a core and ~100 MB. Every pod logs a `[stats]` line a minute (rooms, humans,
  bots, CPU, event-loop lag, memory): check it before raising seatCap.
- `MONGODB_URI` and `JWT_SECRET` are injected but not used yet; the webhook
  note in `src/server.js` says where purchases would be recorded.

## What the server owns

| Thing | Where |
| --- | --- |
| Rooms, matchmaking (`dustline`, filtered by `mode`, max 8 humans) | `src/server.js`, `src/rooms/DustlineRoom.js` |
| Synced state (players, grenades, smokes, ammo boxes, scores) | `src/rooms/schema.js` |
| Map collision (Rapier), grenade physics, bot nav graph | `src/game/physics.js` |
| Bots (fill empty slots, see/hear, strafe, burst fire, throw frags, get flashed, blind in smoke; plant, guard, defuse) | `src/game/bots.js` |
| Search & Destroy: rounds, sides, the bomb | `src/game/searchDestroy.js` |
| Gameplay rules shared with the client | `src/shared/*` |

`src/shared` is the **source of truth** for weapons, the map, hitboxes and
constants. The client copies it on `npm run dev` / `npm run build`
(`rust-client/scripts/sync-shared.mjs`), so edit it here.

## Search & Destroy

`mode: 'snd'` (`src/game/searchDestroy.js`; the numbers are `SND` in
`shared/constants.js`, each map's sites are `snd` in `shared/maps.js`):
4 v 4, one life a round, first side to 4 rounds.

- A round: a 5 s **freeze** (everyone spawned on their side, moves past 1.2 m are
  corrected), then 2 minutes **live**. The bomb starts on the ground a few metres
  in front of the attackers' (`state.attackers`) spawn (`bombStart`: out from the
  middle of their spawns toward the middle of the map, on a nav node); nobody can
  take it in the freeze, and the first attacker to reach it once the round is live
  carries it. Holding Use (`use {on}`) for 4 s inside a site's 3 m ring plants it
  on A or B. It goes off 40 s later (kills within 9 m, hurts out to 16 m where there's
  a clear line, credited to the planter). A defender within 1.8 m holding Use for
  6 s defuses it. Stepping 0.8 m off the spot starts the count again.
- A round ends on **elimination** (every defender; every attacker before a
  plant), **detonated**, **defused**, or **time** (the defenders held). Sides
  swap every 3 rounds. A round only scores while a person is playing; bots
  alone replay it, and the first person to deploy into a room of bots gets a
  fresh round.
- The carrier dying (or leaving) drops the bomb where they were; an attacker
  walking over it picks it up. Bots: the nearest attacker bot runs for a bomb on
  the ground (even mid-fight once it's close); a bot carrier takes it to its
  chosen site and plants when no enemy is in sight; the other attackers escort
  whoever has it, bot or player (a few metres ahead of them, then clearing the
  site they're closing on); they guard a planted bomb and defenders go to defuse
  it. With nobody to fight they run, and a far-off enemy doesn't hold them up.
- No respawns in a round. Deploying during the freeze or the first 10 s puts you
  in; later you're sent `snd {e: 'wait'}` and spawn with everyone next round.
- XP: plant 150, defuse 200, round win 100 (everyone on the winning side).
- State: `round`, `roundPhase` (`freeze` / `live` / `planted` / `over`, `''` in
  a private room's warm-up), `attackers`, `bombState` (`carried` / `dropped` /
  `planted` / `defused` / `exploded`), `bombCarrier`, `bombSite`, `bombX/Y/Z`,
  `bombLeft`, `action` / `actionBy` / `actionProgress` (who is planting or
  defusing, 0..1), `roundWinner`, `roundWhy`. `scoreAlpha` / `scoreBravo` count rounds.
- Events, message `snd` with `e`: `round {round, attackers}`, `live`, `swap`,
  `planted {site, by, p}`, `defused {by}`, `dropped {p}`, `pickup {by}`,
  `end {winner, why, a, b, counted}`, `wait`. The blast is an `explosion` with
  `k: 'bomb'`, and its kills a `kill` with weapon `bomb`.

## Anti-cheat model

Movement is client-predicted; everything that matters is decided here:

- **Fall damage** is worked out here: the server tracks each player's highest
  point since they last stood on something (short ground rays) and charges the
  drop when they land (`fallDamage` in `shared/constants.js`; ladders reset it).
- **Moves** are rejected (and the client is snapped back) for impossible speed,
  impossible climbs, leaving the map, or passing through a wall (`throughWall`).
- **Shots** are rate-limited per weapon (leaky bucket) and ammo is tracked
  server-side. A claimed hit is re-tested against the target's recent positions
  (lag tolerance) with the shared hitbox math, then checked for walls; damage and
  falloff are computed from `shared/weapons.js`, never taken from the client.
- **Classes** are sanitised (`sanitizeClass`) — only the allowed weapon and
  attachment combos (`attachSlots` per weapon). Attachment effects (mag size,
  falloff range, recoil, quiet shots) come from `effectiveWeapon()`, used by both
  sides. A class change while alive waits for the next spawn.
- **Shotgun pellets**: a blast carries each pellet's direction and claimed hit;
  every pellet is checked like a bullet (and must sit inside the gun's spread
  cone), and the damage per target is summed into one hit.
- **Breakable glass** (maps with `glass` in `shared/maps.js`: Skyport Terminal,
  Pinecrest Lodge's glasshouse):
  every shot is tested against the panes still whole (`shared/glass.js`). The
  first one in the way breaks and stops the bullet (any hit claimed past it
  doesn't count); bots' shots, rockets, grenades flying into a pane, blasts
  within reach and a knife at arm's length (`ml` with `g`) break them too.
  Broken panes lose their colliders in the room's world (walkable) and go into
  `state.glass` (a hex bitmask) for the clients; a new match or S&D round mends
  them.
- **Burst fire** (the Strix): one trigger pull fires `burst` rounds
  `fireInterval` apart, then waits `burstDelay`; the per-weapon leaky bucket
  lets a burst through and bots fire at the average rate (`cycleTime`).
- **Lethals** are the class's `lethal` (`frag`, `semtex`, `c4`, `claymore`;
  counts and blast numbers in `EQUIPMENT`):
  - Semtex sticks to the first wall, floor or player it meets (and rides along
    on them), 2.4 s fuse.
  - C4 is lobbed and sticks where it lands; the `det` message sets off every
    armed C4 of yours. Only one can be out at a time.
  - A claymore is planted a stride ahead, facing where you look, arms after 1 s
    and trips (an `act` `trip` click, then the blast 0.25 s later) on an enemy
    within 3.2 m inside its front cone and in sight of it. Its blast is
    directional: full in front, little behind.
  - Bullets set off enemy C4 and claymores they hit, and any blast sets off
    charges within 2.6 m. A dead or departed player's C4 and claymores fizzle.
- **Rockets** (the Warhead RL) are flown here (`tickRockets`: speed, a little
  drop, 3 s max flight) and burst on the first wall or player they meet, with the
  same splash rules as a frag (your own rocket hurts you at half strength).
- **Ladders**: a player's climbing flag only counts inside one of the room's
  map's ladder volumes (`ladderAt` in `shared/maps.js`; it also resets fall damage).
- **Teams**: you can't join a team that would end up 2+ humans bigger; auto-assign
  picks the smaller team, then the lower score, then random. If a leaver leaves the
  teams 2+ apart, the newest player on the bigger team is moved at their next death.

## Messages

Rooms are created by matchmaking (`joinOrCreate`, filtered by `mode`) or as
**private rooms**: `create` with `{ private: true, mode, maxPlayers (2-8), bots }`
gives the room a 6-character key as its `roomId` (also in `state.roomCode`),
hides it from matchmaking, and friends join with `joinById(key)`.
Private rooms open in `phase: 'warmup'` (play allowed, no clock or score limit);
the host (`state.host`) sends `start_match` to reset scores and start the clock.

Client → server: `choose_team {team|'auto'}`, `set_class {classData}`,
`spawn_request {classData?}`, `m` (movement + stance flags: crouch, ADS, sprint, climb, prone, slide; 20 Hz), `fire`, `sw` (switch),
`rl` (reload), `ml` (melee), `th {k}` (throw or plant the lethal / tactical), `det` (set off your C4), `use {on}` (hold to plant / defuse), `avatar`, `rank {r}`, `pong`.

Server → client: `welcome`, `team_select`, `team_assigned`, `team_denied`,
`team_moved`, `spawn {p, yaw, classData, ammo}`, `correct`, `shot`, `hit`,
`damaged`, `kill`, `melee`, `explosion`, `flash`, `ammo`, `class_ack`,
`match_end`, `match_reset`, `snd {e, ...}` (Search & Destroy, above), `notice {text, ms}` (e.g. the drain warning), `xp {n, why}`, `act` (another player reloading, throwing or planting, for their animation; `trip` when a claymore clicks), `ping`. Room state replaces a `room_state` message.
A `shot` carries `q: true` when suppressed (clients play it quietly and skip the
minimap ping), and each player's `kit` string in state lists their weapons and
attachments so others render the right guns.

## Ranks and XP

`shared/progression.js` holds the 16 ranks (Private → General) and the XP table;
every weapon is open to everyone. The server awards XP as it happens (`xp`
message: kill, headshot, knife, longshot, revenge, every minute played, match
complete, win, MVP; in Search & Destroy also plant, defuse and round won); the client keeps the running total and reports its rank
(join option `rank`, then `rank` messages) so scoreboards can show insignia.

## Tests

```bash
npm run test:bots       # boots a room, joins, lets bots fight for 20 s (MAP=acres, SECONDS=60)
npm run test:movement   # walks scripted routes with the client's character controller
npm run test:duel       # two clients: movement validation, noclip guard, hit validation
npm run test:private    # private rooms: keys, join by key, caps, bots on/off
npm run test:fall       # fall damage: hops/stairs free, 5 m landing hurts, tower kills
npm run test:arsenal    # rocket kill credited to the launcher, shotgun pellets = one hit, kill XP
npm run test:explosives # burst lands 3, C4 throw / detonate / one-at-a-time / shot by an enemy, claymore trip, semtex sticks
npm run test:drain      # deploy drain: warm-up moved on at once, match finishes, then everyone moves
npm run test:snd        # Search & Destroy with bots: plants, defuses, drops, side swap, match to 4 (MAP=quarter|hollow|palmwood|acres|dustline, SECONDS=420)
npm run test:load       # CPU / lag / memory with 1, 2, 4 full rooms (STEPS=1,2,4,6, MAP=acres)
```
