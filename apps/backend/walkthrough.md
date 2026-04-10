# AirShare Backend — Complete Walkthrough

A WebRTC signaling server with adaptive file transfer controls, built on Express 5 + raw WebSockets (`ws`) + Redis.

## Directory Structure

```
apps/backend/
├── .env
├── package.json
└── src/
    ├── server.js
    ├── app.js
    ├── config/
    │   ├── config.env.js
    │   ├── config.logger.js
    │   └── config.redis.js
    ├── controller/
    │   └── room.controller.js
    ├── middleware/
    │   ├── error.middleware.js
    │   ├── ratelimiter.middleware.js
    │   └── requestLogger.middleware.js
    ├── routes/
    │   └── basic.router.js
    ├── services/
    │   ├── connectionManager.services.js
    │   └── messageRouter.services.js
    ├── socket/
    │   └── index.js
    ├── transferControls/
    │   ├── TransferController.js
    │   ├── chunkControl.js
    │   ├── congestionControl.js
    │   └── latencyControl.js
    └── utils/
        └── AppError.js
```

## Tech Stack

| Dependency | Purpose |
|---|---|
| `express` v5 | HTTP framework |
| `ws` | Raw WebSocket server for signaling |
| `socket.io` + `@socket.io/redis-adapter` | Socket.IO with Redis adapter (connection logging) |
| `ioredis` / `redis` | Redis client for room state and rate limiting |
| `zod` | WebSocket payload validation |
| `pino` + `pino-pretty` | Structured logging |
| `express-rate-limit` + `rate-limit-redis` | Distributed rate limiting |
| `helmet` | Security headers |
| `uuid` | Room ID generation |
| `cors` | Cross-origin support |

---

## Configuration

### .env

```
PORT=5000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
ROOM_TTL=600
```

### config.env.js

Loads `.env` via `dotenv` and exports a `config` object:

- `PORT` — server port (default 5000)
- `NODE_ENV` — environment flag (default `development`)
- `BACKEND_URL` — backend URL (default `https://localhost:3000`)
- `FRONTEND_URL` — frontend URL (default `https://localhost:5173`)
- `REDIS_URL` — Redis connection string (default `redis://localhost:6379`)
- `ROOM_TTL` — room expiry in seconds (default 600 = 10 minutes)
- `cors` — CORS config with `origin: "*"` and methods `GET`, `POST`

### config.logger.js

Creates a `pino` logger at `info` level with `pino-pretty` transport for human-readable output. Used throughout the application for structured logging.

### config.redis.js

Creates 3 Redis connections:

| Export | Purpose |
|---|---|
| `redis` | Main client for room state, rate limiting, peer management |
| `redisPub` | Socket.IO Redis adapter publisher |
| `redisSub` | Socket.IO Redis adapter subscriber (duplicated from `redisPub`) |

The main client logs connection success and errors via pino.

---

## Entry Point — server.js

1. Creates an HTTP server from the Express app
2. Initializes Socket.IO with Redis adapter — logs connection/disconnection events
3. Initializes the raw WebSocket server via `WebSocketINIT(server)` — handles all signaling
4. Starts listening on `config.PORT`

---

## Express App — app.js

Middleware pipeline (executed in order):

1. `cors()` — allows all origins
2. `helmet()` — sets security headers (X-Frame-Options, CSP, etc.)
3. `express.json()` — parses JSON request bodies
4. `limiter` — rate limiting (100 requests per 15 minutes per IP)
5. `requestLogger` — logs method, URL, status, response duration

Routes:

- `GET /health` → `{ status: 'ok' }`
- `/api/v1/*` → room management via `basicRouter`
- `ErrHandle` → global error handler

---

## REST API

### Routes — basic.router.js

| Method | Route | Handler | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/` | `getAllRoom` | List all active rooms |
| `GET` | `/api/v1/stats` | `getStats` | Server health info |
| `POST` | `/api/v1/room/` | `createRoom` | Create a new room |
| `POST` | `/api/v1/room/:roomID` | `joinRoom` | Validate & pre-check a room |
| `GET` | `/api/v1/room/:roomID` | `roomStatus` | Peer count & P2P/SFU mode |

### Controller — room.controller.js

**getStats** — Returns server diagnostics: uptime, heap memory usage, timestamp. No Redis calls.

**createRoom** — Generates a UUID v4, stores the room in Redis via the connection manager service, returns 201 with the `roomID`.

**joinRoom** — Validates the room exists and isn't full (< 50 peers) via `Services.validateRoom`. This is a pre-check before the client connects via WebSocket — it doesn't actually add a peer.

**getAllRoom** — Uses `scanStream` to iterate all `room:*` keys in Redis and returns an array of rooms with peer counts.

**roomStatus** — Returns peer count and determines the connection mode:
- `< 6 peers` → `"P2P"` (full mesh)
- `≥ 6 peers` → `"SFU"` (selective forwarding)

---

## Middleware

### error.middleware.js

Three-tier error handling:

1. **ZodError** → 400 with structured field-level validation errors
2. **AppError** (operational, `isOperational: true`) → uses the error's `statusCode` and `message`
3. **All other errors** → 500, generic "Something went wrong"

All errors are logged via pino.

### ratelimiter.middleware.js

- Window: 15 minutes
- Max requests: 100 per IP per window
- Uses `RedisStore` so rate limits are shared across server instances
- Sends standard `RateLimit-*` headers

### requestLogger.middleware.js

Hooks into `res.on("finish")` to log after the response is sent:
```
{ method, url, status, duration }
```

---

## Core Services

### connectionManager.services.js

The heart of the backend. Manages all room and peer state using a hybrid Redis + in-memory approach.

**Redis Key Schema:**

| Key Pattern | Type | Purpose |
|---|---|---|
| `room:{roomID}` | Hash | Room metadata (`id`, `createdAt`) |
| `room:{roomID}:peers` | Set | Set of peer IDs in the room |
| `socket:{peerID}` | String | Maps peer → room for disconnect lookup |

**In-Memory:**

| Store | Purpose |
|---|---|
| `localPeers` Map | Maps peerID → WebSocket reference (can't be serialized to Redis) |

**TTL Management:** All room keys expire after `ROOM_TTL` (600s). `refreshTTL()` resets the countdown on joins and signal relays. Inactive rooms auto-clean from Redis.

**Functions:**

| Function | Behavior |
|---|---|
| `sendData(ws, msg)` | Safe WebSocket send — checks `readyState === OPEN` before sending |
| `refreshTTL(roomID)` | Resets expiry on room hash and peers set |
| `createRoom(roomID)` | Idempotent room creation using `hsetnx`, sets TTL |
| `getRoom(roomID)` | Returns room metadata + peer list, or `null` |
| `getAllRooms()` | Cursor-based `scanStream` of all rooms with peer counts |
| `validateRoom(roomID)` | Checks room exists and has < 50 peers |
| `joinRoom(roomID, peerID, ws)` | Adds peer to Redis set, stores WS ref locally, sends `existing-peers` to joiner, broadcasts `new-peer` |
| `leaveRoom(roomID, peerID)` | Removes peer, broadcasts `peer-disconnected`, auto-deletes empty rooms |
| `broadcast(roomID, exclude, msg)` | Sends message to all peers in room except one |
| `relaySignal(roomID, from, target, msg)` | Forwards signaling data to a specific peer |
| `handleDisconnect(peerID)` | Looks up room via `socket:{peerID}`, calls `leaveRoom` |

### messageRouter.services.js

Zod validation schemas for WebSocket payloads:

**JoinRoomSchema:**
- `roomID` — must be a valid UUID
- `peerID` — must be a non-empty string

**SignalSchema:**
- `roomID` — must be a valid UUID
- `targetPeerID` — must be a non-empty string
- `sdp` — optional string
- `candidate` — optional any

Exports `validateJoin()` and `validateSignal()` which throw `ZodError` on invalid input.

---

## WebSocket Signaling — socket/index.js

Creates a raw `ws` WebSocket server attached to the HTTP server. All incoming messages are validated with Zod before processing.

**Message Types:**

| Type | Payload | Action |
|---|---|---|
| `join-room` | `{ roomID, peerID }` | Validates with `validateJoin` → creates room (idempotent) → joins peer |
| `offer` | `{ roomID, targetPeerID, sdp }` | Validates with `validateSignal` → relays SDP offer to target peer |
| `answer` | `{ roomID, targetPeerID, sdp }` | Validates with `validateSignal` → relays SDP answer to target peer |
| `ice-candidate` | `{ roomID, targetPeerID, candidate }` | Validates with `validateSignal` → relays ICE candidate to target peer |

Invalid payloads receive an error message back:
```json
{ "type": "error", "message": "roomID must be a valid UUID, peerID is required" }
```

On WebSocket close, the peer is cleaned up via `handleDisconnect`.

**Signaling Flow:**

```
Peer A                     Server                    Peer B
  |--- join-room ------------>|                          |
  |<-- existing-peers --------|                          |
  |                           |--- new-peer ------------>|
  |                           |<-- offer (SDP) ---------|
  |<-- offer (SDP) ----------|                          |
  |--- answer (SDP) -------->|--- answer (SDP) -------->|
  |<-- ice-candidate --------|--- ice-candidate ------->|
  |--- ice-candidate ------->|<-- ice-candidate --------|
  |                           |                          |
  |<========= Direct P2P Connection Established ========>|
```

After signaling completes, peers communicate directly via WebRTC data channels.

---

## Transfer Controls — Adaptive File Transfer over WebRTC

These 4 files implement client-side file transfer logic over WebRTC data channels.

### latencyControl.js — RTT Measurement

Measures round-trip time using ping/pong messages with Exponentially Weighted Moving Average (EWMA):

```
avgRTT = (1 - α) × avgRTT + α × latestRTT    (α = 0.2)
```

- `recordPing()` — creates a ping with incrementing ID, stores timestamp, returns `{ type: "ping", id }`
- `recordPong(id)` — calculates RTT from stored timestamp, updates EWMA average
- `getAverageRTT()` — returns the current smoothed RTT

The 0.2 alpha gives 20% weight to the latest sample and 80% to history, preventing overreaction to individual spikes.

### congestionControl.js — AIMD Chunk Sizing

Dynamically adjusts chunk size using Additive Increase / Multiplicative Decrease (inspired by TCP congestion control):

| Parameter | Value |
|---|---|
| Starting size | 16 KB |
| Minimum | 8 KB |
| Maximum | 64 KB |

**Decision logic:**

| Condition | Action |
|---|---|
| RTT < 50ms AND buffer < 100KB | `chunkSize += 4KB` (additive increase) |
| RTT > 150ms OR buffer > 300KB | `chunkSize /= 2` (multiplicative decrease) |
| Neither | No change |

Chunk size is always clamped between 8KB and 64KB.

### chunkControl.js — Backpressure-Aware File Slicing

Reads a file in dynamic-sized chunks with backpressure handling:

- `maxBuffer`: 256 KB — if `channel.bufferedAmount` exceeds this, pause sending
- `bufferedAmountLowThreshold`: 128 KB — when buffer drains to this level, resume

**sendFile loop:**
1. Get current average RTT from LatencyController
2. Update CongestionController with RTT + buffer level
3. Get the dynamically adjusted chunk size
4. If buffer is full → `await waitForBufferLow()` (pauses until `bufferedamountlow` event fires)
5. Slice file chunk → convert to ArrayBuffer → send via data channel
6. Advance offset

### TransferController.js — Orchestrator

Ties latency, congestion, and chunk control together. Handles both sending and receiving.

**Constructor** — takes a WebRTC data channel, creates all three sub-controllers, sets up a message handler.

**Incoming message handling:**

| Message | Action |
|---|---|
| `file-start` (string) | Resets receive state, stores expected size and filename |
| `file-end` (string) | If all bytes received → assembles file and triggers download, else logs corruption |
| `ping` (string) | Responds with `pong` |
| `pong` (string) | Updates RTT measurement |
| Binary data | Pushes to chunks array, increments byte counter, checks for overflow |

**send(file):**
1. Starts periodic pings (every 3s) for RTT measurement
2. Sends `file-start` with filename and size
3. Delegates chunked transfer to `chunkController.sendFile(file)`
4. Stops pings
5. Sends `file-end`

**assembleFile():**
Creates a Blob from received chunks, generates a download URL via `URL.createObjectURL`, programmatically clicks a download link, then cleans up.

---

## Utilities — AppError.js

Custom error class for expected/operational errors:

```js
throw new AppError("Room not found", 404)
```

- `isOperational: true` — tells the error middleware to show the actual message
- `statusCode` — the HTTP status to respond with
- Captures stack trace for debugging
