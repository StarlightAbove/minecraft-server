"use client";

import { useEffect, useState } from "react";
import { REFRESH_SECONDS, SITE } from "@/lib/config";
import type { ServerState, ServerStatus } from "@/lib/types";
import PlayerHead from "./PlayerHead";

const LABELS: Record<ServerState, { title: string; detail: string }> = {
  online: { title: "Online", detail: "The server is up. Come on in!" },
  offline: { title: "Offline", detail: "The server is not responding right now." },
  unknown: { title: "Unknown", detail: "Couldn't check on the server." },
};

export default function StatusBoard({ initial }: { initial: ServerStatus }) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    async function refresh() {
      try {
        const response = await fetch("/api/status", {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next: ServerStatus = await response.json();
        if (!stopped) setStatus(next);
      } catch {
        // Don't keep showing "Online" if we've lost contact with the status check.
        if (!stopped) setStatus((s) => ({ ...s, state: "unknown", players: null }));
      }
      if (!stopped) timer = setTimeout(refresh, REFRESH_SECONDS * 1000);
    }

    timer = setTimeout(refresh, REFRESH_SECONDS * 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  const { state, players } = status;

  return (
    <>
      <header className="hero">
        <div className="scene" aria-hidden="true">
          <img src="/art/island.svg" alt="" />
        </div>

        <div className="wrap hero-row">
          <div className="hero-card">
            <div className="steps" aria-hidden="true" />
            <h1>{SITE.title}</h1>
            <p>{SITE.tagline}</p>
            <div className={`status status-${state}`} role="status">
              <p className="state">
                <span className="dot" aria-hidden="true" />
                {LABELS[state].title}
              </p>
              <p>{LABELS[state].detail}</p>
            </div>

            <div className="address">
              <h2 className="label">Server Address</h2>
              <p className={SITE.serverAddress ? "value" : "value pending"}>
                {SITE.serverAddress || "Coming soon"}
              </p>
            </div>

            <p className="notice">
              <strong>Whitelist in force.</strong> To get whitelisted, message{" "}
              <a
                href={`https://www.instagram.com/${SITE.whitelistContact}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{SITE.whitelistContact}
              </a>{" "}
              on Instagram.
            </p>

            <a className="button" href={SITE.modpackUrl} target="_blank" rel="noopener noreferrer">
              Get the Modpack
            </a>
          </div>

          <dl className="stats">
            <div>
              <dt>Players</dt>
              <dd>{players ? `${players.online}/${players.max}` : "--"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{SITE.minecraftVersion}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="section wrap" id="players" aria-labelledby="players-heading">
        <h2 id="players-heading">Who&apos;s Online</h2>

        {players && players.names.length > 0 && players.online > players.names.length && (
          <p>
            Showing {players.names.length} of {players.online} players.
          </p>
        )}

        {players && players.names.length > 0 ? (
          <ul className="players">
            {players.names.map((name) => (
              <li key={name}>
                <PlayerHead name={name} />
                <span>{name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            {players
              ? players.online === 0
                ? "Nobody's mining right now. Be the first to hop on!"
                : `${players.online} online. Player names are unavailable.`
              : state === "online"
                ? "Player list unavailable."
                : "No player list while the server isn't online."}
          </p>
        )}
      </section>
    </>
  );
}
