export type ServerState = "online" | "offline" | "unknown";

export type ServerStatus = {
  state: ServerState;
  /** null when player info is unavailable. `names` may list only some of those online. */
  players: { online: number; max: number; names: string[] } | null;
  checkedAt: string;
};
