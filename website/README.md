# Minecraft server status page

Single-page Next.js site: server status, online players, world map and the modpack link.

## Run

    npm install
    npm run dev                 # development
    npm run build && npm start  # production

## How the status check works

`src/lib/status.ts` sends a Minecraft Server List Ping (`src/lib/ping.ts`), the
same query as the in-game server list. It needs no Docker or RCON access.

- A valid reply shows online, no reply shows offline, and a garbled reply shows
  unknown. A server that is still starting shows offline.
- The server sends only a sample of player names (12 by default), and can send none.

Results are cached for 10 seconds; the page refreshes every 15 seconds.

## Hosting

The site runs in the `website` container on the home PC (`Dockerfile`, defined in
`../compose.yml`). Caddy on the VPS forwards to it over WireGuard (see
`../README.md`). After changes: `docker compose up -d --build website`

## Configuration

- Title, tagline, versions, modpack and launcher links: `src/lib/config.ts`
- Server address, whitelist contact and map URL: also `src/lib/config.ts`.
  Empty values show placeholders. Rebuild after any change.
- World map: squaremap, served under `/map/` by a rewrite in `next.config.ts`.
  It forwards to `http://mc:8080`; set `MAP_ORIGIN` at **build** time to change that
  (for `npm run dev`, point it at a reachable squaremap).
- Minecraft address: `MC_HOST` and `MC_PORT` environment variables (default `127.0.0.1:25565`)
- Voxel artwork and favicon: `node scripts/make-art.mjs`
