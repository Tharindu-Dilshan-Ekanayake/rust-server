import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import cors from 'cors'
import express from 'express'

import { initPhysics } from './game/physics.js'
import { DustlineRoom } from './rooms/DustlineRoom.js'
import { ROOM_NAME } from './shared/constants.js'

const PORT = Number(process.env.PORT || 3000)

// Vite's dev server origin, plus anything in CLIENT_ORIGIN (comma separated) for
// a deployed client.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()) : []),
]

// Rapier is WASM; every room builds a physics world, so it must be loaded first.
await initPhysics()

const gameServer = new Server({
  transport: new WebSocketTransport(),
  greet: false,
  express: (app) => {
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
gameServer.define(ROOM_NAME, DustlineRoom).filterBy(['mode'])

await gameServer.listen(PORT)
console.log(`Dustline server listening on http://localhost:${PORT} (ws://localhost:${PORT})`)
