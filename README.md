# RaceOff

Go head-to-head live on F1 tracks. Race. Win. Repeat.

RaceOff is a small real-time multiplayer racing game that runs in the browser. Two players are matched into a race and drive around an F1 circuit for 5 laps. The first one across the line wins.

## How it plays

- **One control.** Press and hold (mouse, touch or trackpad) to accelerate, release to brake. That is it.
- **Corners bite.** Carry too much speed into a bend and you slide off the track, spin, and lose time before you are put back on the racing line.
- **Warm Up** lets you practice alone on the track before racing.
- **Race** puts you in the queue. As soon as a second driver joins, the race starts.

The simulation runs on the server. Clients only send `speed-up` / `brake` inputs and render the authoritative game state they receive over WebSockets, so both players see the same race.

## Tech stack

**Client** (`client/`)
- TypeScript, built with [Vite](https://vitejs.dev/)
- [Paper.js](http://paperjs.org/) for track/car rendering and path math
- [GSAP](https://gsap.com/) for animations
- [Alpine.js](https://alpinejs.dev/) for the small bits of UI
- socket.io-client for real-time communication

**Server** (`server/`)
- Node.js 22 + TypeScript
- [Fastify](https://fastify.dev/) (static files, sessions, cookies, CSRF)
- [Socket.IO](https://socket.io/) for the game loop and player inputs
- [Redis](https://redis.io/) (via ioredis + Redlock) for race/warmup state and matchmaking

**Tooling**
- Docker Compose for a local Node + Redis environment
- A `Makefile` wrapping the common commands

## Running locally

### Option A: Docker (recommended)

Requires Docker with Compose.

1. Create `server/.env`:

   ```
   HOST=0.0.0.0
   PORT=3000
   REDIS_HOST=redis
   SESSION_SECRET=change-me
   COOKIE_SECRET=change-me
   ```

2. Install dependencies:

   ```sh
   docker compose run --rm node bash -c "cd client && yarn install"
   docker compose run --rm node bash -c "cd server && yarn install"
   ```

3. In one terminal, build the client and keep it rebuilding on changes:

   ```sh
   make client.watch
   ```

4. In another terminal, start the server (this also starts Redis):

   ```sh
   make server.dev
   ```

5. Open http://localhost:3000.

Run `make help` to see all available targets.

### Option B: without Docker

Requires Node.js 22, Yarn and a Redis instance running on `127.0.0.1:6379`.

```sh
# server/.env as above, but with REDIS_HOST=127.0.0.1

cd client && yarn install && yarn watch   # terminal 1
cd server && yarn install && yarn dev     # terminal 2
```

Then open http://localhost:3000.

The server serves the built client from `client/dist`, so the client must be built (or watched) before the server can serve pages.

### Production build

```sh
make client.build    # tsc + vite build -> client/dist
make server.build    # tsc + node index.js
```

## Project layout

```
client/
  home.html, race.html, warmup.html   entry pages
  src/game/                            rendering, track, driver, input
  src/home | src/race | src/warmup    per-page apps
server/
  index.ts, app.ts                     Fastify bootstrap and plugins
  api/                                 REST endpoints (create race / warmup, CSRF)
  web/                                 page routes with access checks
  game/                                GameEngine, physics, race & warmup managers
  game/tracks/                         track data (SVG + JSON path)
```
