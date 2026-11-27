import { BadReply, ping } from "./ping";
import type { ServerStatus } from "./types";

// On the VPS, MC_HOST is the home server's WireGuard address.
const HOST = process.env.MC_HOST ?? "127.0.0.1";
const PORT = Number(process.env.MC_PORT ?? 25565);
// Visitors share one result for this long, so page traffic can't flood the server with pings.
const CACHE_MS = 10_000;

// Also drops the "Anonymous Player" stand-in for people who hide from server listings.
const PLAYER_NAME = /^\w{1,16}$/;

type Reply = {
  players?: { online?: unknown; max?: unknown; sample?: unknown };
};

function readPlayers(reply: Reply): ServerStatus["players"] {
  const { online, max, sample } = reply?.players ?? {};
  if (typeof online !== "number" || typeof max !== "number") return null;

  // The server sends only some of the names (12 by default), and can send none.
  const names = (Array.isArray(sample) ? sample : [])
    .map((player) => player?.name)
    .filter((name): name is string => typeof name === "string" && PLAYER_NAME.test(name));

  return { online, max, names: [...new Set(names)].sort() };
}

async function check(): Promise<ServerStatus> {
  let state: ServerStatus["state"] = "online";
  let players: ServerStatus["players"] = null;
  try {
    players = readPlayers((await ping(HOST, PORT)) as Reply);
  } catch (error) {
    state = error instanceof BadReply ? "unknown" : "offline";
    console.error("status ping failed:", error instanceof Error ? error.message : error);
  }
  return { state, players, checkedAt: new Date().toISOString() };
}

let cached: { at: number; result: Promise<ServerStatus> } | null = null;

export function getStatus(): Promise<ServerStatus> {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    cached = { at: Date.now(), result: check() };
  }
  return cached.result;
}
