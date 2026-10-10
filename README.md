# Dustline — game server

Authoritative [Colyseus 0.18](https://colyseus.io) server for **Dustline**, an 8-player
FPS on the *Dustline Pumpstation* map (Team Deathmatch and Free-for-all). The client
lives in `../rust-client`.

```bash
npm install
npm run dev      # nodemon, restarts on change
npm start        # plain node
```

Listens on `PORT` (default **3000**) for both HTTP (`/api/*`, matchmaking) and
WebSockets. See `.env.example` for the other settings.

## What the server owns

| Thing | Where |
| --- | --- |
| Rooms, matchmaking (`dustline`, filtered by `mode`, max 8 humans) | `src/server.js`, `src/rooms/DustlineRoom.js` |
| Synced state (players, grenades, smokes, ammo boxes, scores) | `src/rooms/schema.js` |
| Map collision (Rapier), grenade physics, bot nav graph | `src/game/physics.js` |
| Bots (fill empty slots, see/hear, strafe, burst fire, throw frags, get flashed, blind in smoke) | `src/game/bots.js` |
| Gameplay rules shared with the client | `src/shared/*` |

`src/shared` is the **source of truth** for weapons, the map, hitboxes and
constants. The client copies it on `npm run dev` / `npm run build`
(`rust-client/scripts/sync-shared.mjs`), so edit it here.

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
- **Rockets** (the Warhead RL) are flown here (`tickRockets`: speed, a little
  drop, 3 s max flight) and burst on the first wall or player they meet, with the
  same splash rules as a frag (your own rocket hurts you at half strength).
- **Ladders**: a player's climbing flag only counts inside one of the
  `LADDERS` volumes in `shared/map.js` (it also resets fall damage).
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
`rl` (reload), `ml` (melee), `th` (throw), `avatar`, `rank {r}`, `pong`.

Server → client: `welcome`, `team_select`, `team_assigned`, `team_denied`,
`team_moved`, `spawn {p, yaw, classData, ammo}`, `correct`, `shot`, `hit`,
`damaged`, `kill`, `melee`, `explosion`, `flash`, `ammo`, `class_ack`,
`match_end`, `match_reset`, `xp {n, why}`, `act` (another player reloading or throwing, for their animation), `ping`. Room state replaces a `room_state` message.
A `shot` carries `q: true` when suppressed (clients play it quietly and skip the
minimap ping), and each player's `kit` string in state lists their weapons and
attachments so others render the right guns.

## Ranks and XP

`shared/progression.js` holds the 16 ranks (Private → General) and the XP table;
every weapon is open to everyone. The server awards XP as it happens (`xp`
message: kill, headshot, knife, longshot, revenge, every minute played, match
complete, win, MVP); the client keeps the running total and reports its rank
(join option `rank`, then `rank` messages) so scoreboards can show insignia.

## Tests

```bash
npm run test:bots       # boots a room, joins, lets bots fight for 20 s
npm run test:movement   # walks scripted routes with the client's character controller
npm run test:duel       # two clients: movement validation, noclip guard, hit validation
npm run test:private    # private rooms: keys, join by key, caps, bots on/off
npm run test:fall       # fall damage: hops/stairs free, 5 m landing hurts, tower kills
npm run test:arsenal    # rocket kill credited to the launcher, shotgun pellets = one hit, kill XP
```
