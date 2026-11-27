#!/usr/bin/env python3
"""Make a shareable world zip from a backup, without per-player files.

Usage: python3 tools/export-world.py backups/BACKUP.tar.gz petrova-world.zip

Only data/world is read. Afterwards the output is searched for the names and IDs
of players listed in the backup. Builds, signs, books, pets and other world
content can still identify people, so review the report before publishing.
"""
import gzip
import json
import re
import sys
import tarfile
import uuid
import zipfile
import zlib

PREFIX = "data/world/"
# Per-player files, claims and parties, plus files a new server doesn't need.
SKIP = re.compile(
    r"^(playerdata|advancements|stats)/"
    r"|^data/(openpartiesandclaims|mezz_config)/"
    r"|^session\.lock$|_old$"
)


def chunks(data):
    """Yield the decompressed chunks of a region (.mca) file."""
    for i in range(1024 if len(data) >= 8192 else 0):
        offset = int.from_bytes(data[i * 4 : i * 4 + 3], "big") * 4096
        if not offset:
            continue
        length = int.from_bytes(data[offset : offset + 4], "big")
        kind = data[offset + 4]
        body = data[offset + 5 : offset + 4 + length]
        if kind == 1:
            yield gzip.decompress(body)
        elif kind == 2:
            yield zlib.decompress(body)
        elif kind == 3:
            yield body
        else:
            raise ValueError(f"unsupported chunk compression {kind}")


def readable(name, data):
    if name.endswith(".mca"):
        return list(chunks(data))
    if data[:2] == b"\x1f\x8b":
        return [gzip.decompress(data)]
    return [data]


def main(source, destination):
    players = {}  # uuid -> name
    kept, skipped = {}, 0
    with tarfile.open(source) as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            if member.name in ("data/usercache.json", "data/whitelist.json", "data/ops.json"):
                for entry in json.load(archive.extractfile(member)):
                    players[uuid.UUID(entry["uuid"])] = entry["name"]
            if not member.name.startswith(PREFIX):
                continue
            name = member.name[len(PREFIX) :]
            found = re.match(r"playerdata/([0-9a-f-]{36})\.dat", name)
            if found:
                players.setdefault(uuid.UUID(found.group(1)), None)
            if SKIP.search(name):
                skipped += 1
            else:
                kept[name] = archive.extractfile(member).read()

    with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED) as output:
        for name, data in sorted(kept.items()):
            output.writestr("world/" + name, data)
    print(f"{len(kept)} files kept, {skipped} left out; {len(players)} known players")

    needles = []
    for number, (player, name) in enumerate(sorted(players.items()), 1):
        label = f"player {number}"
        for form in (player.bytes, str(player).encode(), player.hex.encode()):
            needles.append((label + " ID", form))
        if name:
            needles.append((label + " name", name.encode()))

    hits = {}
    for name, data in kept.items():
        if any(raw in name.encode() for _, raw in needles):
            hits.setdefault(name, set()).add("ID in file name")
        for blob in readable(name, data):
            for label, needle in needles:
                if needle in blob:
                    hits.setdefault(name, set()).add(label)
    if not hits:
        print("No known player names or IDs found.")
    else:
        print("REVIEW: known player names or IDs remain in:")
        for name, labels in sorted(hits.items()):
            print(f"  {name}: {', '.join(sorted(labels))}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
