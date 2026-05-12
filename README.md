# AirShare

**Browser-native peer-to-peer file transfer powered by WebRTC.**  
No uploads. No cloud storage. Files move directly between peers.

---

### HomePage

![HomePage](https://github.com/user-attachments/assets/1a271c92-ce54-4b39-b956-879e73828eb3)

### Transfer-Room

![Transfer-Room](https://github.com/user-attachments/assets/1febb483-c7f1-4b91-ba90-c2cb78ecddd2)

> Signaling is centralized. File transfer is not.

---

## Why AirShare

Most file-sharing apps route uploads through centralized servers.  
AirShare establishes direct encrypted WebRTC data channels between browsers, enabling fast local-first transfers with minimal infrastructure.

Built for:
- large file transfers
- local network sharing
- temporary collaboration rooms
- privacy-first workflows

---

## Features

- Direct browser-to-browser file transfer
- End-to-end encrypted transport via WebRTC (DTLS/SRTP)
- Multi-peer mesh rooms
- Adaptive chunk streaming with congestion control
- Folder drag-and-drop support
- Redis-backed room/session management
- Automatic reconnect + resilient WebSocket signaling
- TURN relay support for restrictive NAT environments
- Dockerized local development stack

---

## How It Works

1. Create a room
2. Share the room ID
3. Peers establish WebRTC connections
4. Files stream directly between browsers

---

## Architecture

```txt
Browser ── WebSocket Signaling ── Backend
    │
    └──── WebRTC DataChannel ──── Peer
```

- WebSocket is used only for signaling
- File payloads never pass through the backend
- Transfers occur over RTCDataChannel (SCTP)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, Zustand |
| Realtime | WebRTC, WebSocket (`ws`) |
| Backend | Node.js, Express |
| State & Cache | Redis |
| Infra | Docker, Docker Compose |
| NAT Traversal | coturn |
| CI/CD | GitHub Actions + GitHub Pages |

---

## Repository Structure

## Project Structure

```
apps/
  backend/
    src/
      config/         # env, logger, redis
      controller/     # room CRUD
      middleware/     # rate limiter, error handler, request logger
      routes/         # REST API
      services/       # connection manager (Redis-backed room/peer state)
      socket/         # WebSocket message handler
      utils/          # AppError
  frontend/
    src/
      domain/
        peer/         # PeerEngine (RTCPeerConnection abstraction)
        transfer/     # ChunkManager, CongestionController, LatencyController, TransferController
      infrastructure/ # SignalingClient (WebSocket + reconnect logic)
      pages/          # Home, Room, About
      components/     # BackgroundEngine, ThemeToggle
      context/        # ThemeContext
coturn/
  turnserver.conf.example
docker-compose.yml
```

### Core Transfer Modules

```txt
frontend/src/domain/transfer/
```

- `ChunkManager`
- `CongestionController`
- `TransferController`
- `LatencyController`

---

## Local Development

### Prerequisites

- Node.js 20+
- Docker

### Clone Repository

```bash
git clone <repo-url>
cd airshare
```

### Install Dependencies

#### Backend

```bash
cd apps/backend
npm install
```

#### Frontend

```bash
cd ../frontend
npm install
```

---

## Environment Variables


### Backend (`apps/backend/.env`)

```env
PORT=5000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
ROOM_TTL=600           # seconds; rooms expire after inactivity
FRONTEND_URL=http://localhost:5173
```

### Frontend (`apps/frontend/.env`)

```env
VITE_WS_URL=ws://localhost:5000
VITE_STUN_URL=stun:stun.l.google.com:19302   # or your coturn server
VITE_TURN_URL=turn:YOUR_SERVER_IP:3478        # optional
VITE_TURN_USERNAME=airshare
VITE_TURN_CREDENTIAL=your-secret
```
---

## Running the Project

### Start Redis + TURN

```bash
docker compose up redis coturn -d
```

### Run Backend

```bash
cd apps/backend
npm run dev
```

### Run Frontend

```bash
cd apps/frontend
npm run dev
```

### Full Stack via Docker

```bash
docker compose up --build
```

---


## API Routes

Base path: `/api/v1/`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List all active rooms |
| `GET` | `/stats` | Server uptime/memory stats |
| `POST` | `/room/` | Create a new room → returns `{ roomID }` |
| `POST` | `/room/:roomID` | Validate room + get peer count |
| `GET` | `/room/:roomID` | Room status + P2P mode (P2P / SFU) |
| `GET` | `/health` | Health check |

## WebSocket Protocol

Client connects to the WebSocket server and exchanges JSON messages:

| Type | Direction | Payload |
|---|---|---|
| `join-room` | Client → Server | `{ roomID, peerID }` |
| `offer` | Client → Server | `{ roomID, targetPeerID, sdp }` |
| `answer` | Client → Server | `{ roomID, targetPeerID, sdp }` |
| `ice-candidate` | Client → Server | `{ roomID, targetPeerID, candidate }` |
| `existing-peers` | Server → Client | `[peerID, ...]` |
| `new-peer` | Server → Client | `peerID` |
| `peer-disconnected` | Server → Client | `peerID` |


## TURN Server Setup

Copy the example configuration:

```bash
cp coturn/turnserver.conf.example coturn/turnserver.conf
```

Update:
- `external-ip`
- credentials

Start coturn:

```bash
docker compose up coturn -d
```

---

## Deployment Notes

- **Frontend** deploys to GitHub Pages via `.github/workflows/deploy.yml`
  - Secrets required: `VITE_WS_URL`, `VITE_STUN_URL`, `VITE_TURN_URL`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`
  - Vite base path is `/AirShare/` (configured in `vite.config.js`)
- **Backend** is Dockerized; deploy behind a reverse proxy (nginx/caddy) with WSS support
- Redis is required for rate limiting and room state; rooms auto-expire via TTL
- TURN server is optional but needed for peers behind symmetric NAT

---

## Roadmap

- [ ] SFU fallback mode
- [ ] Resume interrupted transfers
- [ ] File integrity verification
- [ ] Password-protected rooms
- [ ] Multi-file transfer queue
- [ ] PWA/mobile optimization

---

## License 

MIT

---

## Authors

- Vedang Srivastava
- Vedant Parasrampuria
- Atharv Dixit
