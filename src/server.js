import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import cors from 'cors'
import express from 'express'

import { initPhysics } from './game/physics.js'
import { startStats } from './game/stats.js'
import { DustlineRoom } from './rooms/DustlineRoom.js'
import { ROOM_NAME } from './shared/constants.js'

// Bloxity Legion injects PORT (2567), CLIENT_ORIGIN, BLOXITY_GAME_ID, BLOXITY_CHANNEL
// and POD_NAME at deploy time; locally everything falls back to dev defaults.
const PORT = Number(process.env.PORT || 3000)
const POD = process.env.POD_NAME || 'local'
const GAME_ID = process.env.BLOXITY_GAME_ID || 'modern-guns'
const CHANNEL = process.env.BLOXITY_CHANNEL || ''

// Vite's dev server, the game's Bloxity-hosted frontends, and anything in
// CLIENT_ORIGIN (comma separated), e.g. a custom domain.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `https://${GAME_ID}.play.bloxity.io`,
  `https://${GAME_ID}.dev.play.bloxity.io`,
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : []),
]

// Rapier is WASM; every room builds a physics world, so it must be loaded first.
await initPhysics()

const gameServer = new Server({
  transport: new WebSocketTransport(),
  greet: false,
  express: (app) => {
    // Readiness/liveness probe: answer straight away, never touch the game.
    app.get('/health', (_req, res) => {
      res.status(200).type('text/plain').send('ok')
    })

    app.use('/api', cors({ origin: ALLOWED_ORIGINS, credentials: true }))
    app.use('/api', express.json())

    app.get('/api/health', (_req, res) => {
      res.json({ ok: true })
    })

    /**
     * Auth passthrough for the Bloxity SDK.
     *
     * The frontend will POST `{ token, user }` here from
     * `Legion.SDK.auth.authenticateWithServer('/api/legion-auth')`.
     *
     * NOTE: not wired up on the frontend yet. When you do wire it, call
     * `authenticateWithServer` from `rust-client/src/bloxity/BloxityProvider.jsx`
     * inside the `onUserChanged` handler, right after a non-null user arrives, and
     * stash the returned accessToken for your own API calls.
     */
    app.post('/api/legion-auth', (req, res) => {
      console.log('[legion-auth] payload:', JSON.stringify(req.body, null, 2))

      // TODO: verify the Bloxity JWT here before trusting req.body.user.
      // Until that happens `req.body.user` is attacker-controlled — anyone can POST
      // any legionId they like. Verify `req.body.token` against Bloxity's public key /
      // introspection endpoint and derive the user from the *verified* claims, not
      // from the body.

      res.json({
        accessToken: 'stub',
        user: { legionId: req.body.user?._id },
      })
    })

    /**
     * Webhook for future Bux purchases.
     * Responds 200 immediately — the platform will retry on anything else, so do
     * the real work asynchronously rather than holding the response open.
     * With more than one pod this can land on any of them: record grants in
     * MongoDB (MONGODB_URI) keyed by transactionId, never in this pod's memory.
     */
    app.post('/api/legion-webhook', (req, res) => {
      console.log('[legion-webhook] payload:', JSON.stringify(req.body, null, 2))

      // TODO: verify x-legion-webhook-secret header, dedupe by transactionId, grant the item.

      res.sendStatus(200)
    })
  },
})

// One room type; `mode` keeps TDM and FFA players in separate rooms. joinOrCreate
// fills an existing room of that mode (max 8 players) before opening a new one.
gameServer.define(ROOM_NAME, DustlineRoom).filterBy(['mode', 'map'])

// Deploys and scale-downs send SIGTERM. Colyseus then locks every room (no new
// players; the matchmaker sends them to the fresh pod) and calls each room's
// onBeforeShutdown, which lets a running match finish before moving its players
// on (see DustlineRoom.onBeforeShutdown). The process exits once every room is gone.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => console.log(`[${POD}] ${signal}: draining rooms, then exiting`))
}
// Tests (and Windows, which can't deliver a catchable SIGTERM) ask for the same
// drain over IPC when they start the server with child_process.fork.
process.on('message', (m) => {
  if (m !== 'shutdown') return
  console.log(`[${POD}] shutdown requested: draining rooms, then exiting`)
  gameServer.gracefullyShutdown()
})

await gameServer.listen(PORT)
startStats(POD)
console.log(`Modern Guns server${CHANNEL ? ` (${CHANNEL})` : ''} on pod ${POD}, listening on http://localhost:${PORT} (ws://localhost:${PORT})`)
