// Minecraft Server List Ping: the same query the in-game server list sends.
// https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
import { connect } from "node:net";

// 1.21.1. Servers answer status requests whichever version is sent.
const PROTOCOL = 767;
// Replies include the server icon and mod data, but should never get near this.
const MAX_BYTES = 1024 * 1024;

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value >>> 0;
  do {
    const byte = rest & 0x7f;
    rest >>>= 7;
    bytes.push(rest ? byte | 0x80 : byte);
  } while (rest);
  return Buffer.from(bytes);
}

/** Returns null if the buffer ends before the number does. */
function readVarInt(buffer: Buffer, offset: number): { value: number; end: number } | null {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buffer.length) return null;
    const byte = buffer[offset + i];
    value |= (byte & 0x7f) << (7 * i);
    if (!(byte & 0x80)) return { value, end: offset + i + 1 };
  }
  throw new BadReply("number too long");
}

function packet(...parts: Buffer[]): Buffer {
  const body = Buffer.concat(parts);
  return Buffer.concat([varInt(body.length), body]);
}

/** Something answered, but not with a valid status reply. */
export class BadReply extends Error {}

/** The parsed reply, or null while more data is still needed. */
function parseReply(data: Buffer): unknown {
  const length = readVarInt(data, 0);
  if (!length) return null;
  if (length.value <= 0 || length.value > MAX_BYTES) throw new BadReply("bad packet length");
  if (data.length < length.end + length.value) return null;

  const body = data.subarray(length.end, length.end + length.value);
  const id = readVarInt(body, 0);
  const size = id && readVarInt(body, id.end);
  if (!id || id.value !== 0 || !size || size.value < 0 || size.end + size.value > body.length) {
    throw new BadReply("unexpected packet");
  }
  try {
    return JSON.parse(body.toString("utf8", size.end, size.end + size.value));
  } catch {
    throw new BadReply("invalid JSON");
  }
}

export function ping(host: string, port: number, timeoutMs = 5_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    let data = Buffer.alloc(0);

    // A deadline for the whole exchange, so a slow trickle of bytes can't hold it open.
    const timer = setTimeout(() => finish(new Error("timed out")), timeoutMs);

    function finish(error: unknown, reply?: unknown) {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(reply);
    }

    socket.on("error", (error) => finish(error));
    socket.on("close", () => finish(new Error("connection closed before a reply")));
    socket.on("connect", () => {
      const address = Buffer.from(host, "utf8");
      const portBytes = Buffer.alloc(2);
      portBytes.writeUInt16BE(port);
      const handshake = packet(varInt(0), varInt(PROTOCOL), varInt(address.length), address, portBytes, varInt(1));
      socket.write(Buffer.concat([handshake, packet(varInt(0))]));
    });
    socket.on("data", (chunk) => {
      data = Buffer.concat([data, chunk]);
      if (data.length > MAX_BYTES) return finish(new BadReply("reply too large"));
      try {
        const reply = parseReply(data);
        if (reply !== null) finish(null, reply);
      } catch (error) {
        finish(error);
      }
    });
  });
}
