### Human Foreword
This was very much built with Claude. The thing is, it's easy to work with and I did this in about 2 hours. Actually figuring this code out would take me a solid few hours that I did not have :c. Alas, it works.

For people who actually need access to the server, don't read the slop below. That is for the nerds who want to recreate this. 
Joining on minecraft is just: mc.elizakishan.com.
To check server state, it is mc.elizakishan.com in your browser. C'est tout. 

# Instructions to build this setup
A NeoForge 1.21.1 Create server with a status website. One address,
`mc.elizakishan.com`, works in both Minecraft and a browser. A small Oracle Cloud
VPS is the public side. Minecraft, the home end of the tunnel and the website run
in Docker on the home PC.

Mod credits are in [MODS.md](MODS.md).

## Contents

- [How it works](#how-it-works) and [files](#files)
- Setup: steps [1](#1-minecraft-server-and-mods) to [11](#11-idle-reclaim)
- [Player modpack](#2-player-modpack)
- [Website](#website), [backups](#backups), [running the server](#running-the-server)
- [Future idea: auto-repair watchdog](#future-idea-auto-repair-watchdog-not-built)

## How it works

DNS points the name at the VPS. The port decides what happens.

    Minecraft --25565--> VPS --WireGuard--> [wireguard container] mc-router :25565 --> mc
    Browser   --80/443-> VPS Caddy --WireGuard--> [wireguard container] website :3000

- No SRV record is needed, because 25565 is Minecraft's default port.
- The home PC only dials out, so the router needs no port forwarding.
- The VPS can only reach what listens in the `wireguard` container's network.
- This is separate from the homelab's Caddy and Cloudflare Tunnel.

Commands are marked **VPS** (bash, over SSH) or **PC** (fish). Paste them into a
terminal; they are not script files.

## Files

| Path | What it is | In Git |
|---|---|---|
| `compose.yml` | `mc`, `wireguard`, `router` and `website` services | yes |
| `mods/` | Server mod jars and `modslinks.txt` | yes |
| `client-extras/` | Player-only mod and resource pack | yes |
| `website/` | Status site source and Dockerfile | yes |
| `wg0.conf.example` | Template for the home WireGuard config | yes |
| `backups/` | Sanitized backups (see [Backups](#backups)) | yes |
| `data/` | Live server: world, settings, logs | no |
| `wireguard/` | Home WireGuard config, **including the private key** | no |
| `.env` | Local secrets | no |

**Keep the GitHub repository private.** Many mods are "All Rights Reserved" (see
[MODS.md](MODS.md)). Crediting an author doesn't give permission to redistribute
their files, and a private repository doesn't grant it either; check each license
before sharing. Backups also contain player names and UUIDs.

`wireguard/` is **not** fully recreated by Docker. The container makes some files,
but you create `wg_confs/wg0.conf` yourself ([step 6](#6-home-containers)).

---

## 1. Minecraft server and mods

**PC.** The `mc` service uses `itzg/minecraft-server`: Minecraft 1.21.1, NeoForge
21.1.267, 8 GB memory. At startup the image copies `./mods` into `data/mods`.

    cd ~/homelab/services/minecraft
    docker compose up -d mc
    docker compose logs -f mc                # look for "Done", then Ctrl+C
    docker exec minecraft-server rcon-cli "neoforge mods"

The whitelist is a setting in `data/server.properties` (`white-list=true`), which
isn't in Git. **On a new install, set it and restart `mc` before allowing public
connections.** Then add players:

    docker exec minecraft-server rcon-cli "whitelist add PLAYER_NAME"

### How the mods were installed

- `mods/modslinks.txt` is the original wish list. It doesn't record versions or
  every library; [MODS.md](MODS.md) lists what is installed.
- Most files came from Modrinth, with checksums verified. Bird Watching,
  Refurbished Furniture, the steampunk planes, Framework and the resource pack
  were downloaded from CurseForge.
- Libraries not on the wish list were added where mods required them.
- **Alex's Mobs** has no official 1.21.1 NeoForge build that was found. Installed
  instead: the unofficial [Alex's Mobs Continued](https://modrinth.com/mod/alexs-mobs-continued)
  with [CodxLib](https://modrinth.com/mod/codxlib), both from Modrinth. Players
  need both (the jar requires CodxLib on both sides, although Modrinth labels it
  server-only). Citadel isn't needed. Don't install a second Alex's Mobs port.
- JEI 19.64.0.455 declares a Minecraft range that appears to exclude 1.21.1, but
  it loaded on the server. Check that recipes show in game.
- `allow-flight` is off. If players get kicked for flying on planes or airships,
  turn it on in `data/server.properties`.
- New structures (such as Towns and Towers) only appear in unexplored areas.

To change mods: [back up](#backups), edit `mods/`, run `docker compose restart mc`,
check the logs, and update MODS.md. Check `data/mods` for leftover old jars.

## 2. Player modpack

Players need Minecraft **1.21.1** with **NeoForge 21.1.267**. Prism Launcher is
the recommended launcher.

Copy the files to another computer. Run this **on that computer**; the address
works only on the home network:

    rsync -avz --progress --exclude='modslinks.txt' \
      elizak@192.168.0.131:/home/elizak/homelab/services/minecraft/mods \
      elizak@192.168.0.131:/home/elizak/homelab/services/minecraft/client-extras \
      ./petrova-modpack/

- Jars from **both** `mods/` and `client-extras/mods/` go in the pack's `mods/`.
- The zip in `client-extras/resourcepacks/` goes in `resourcepacks/`. Players may
  need to enable it in game.
- Don't put `client-extras/` files on the server.

The pack's download link is in `website/src/lib/config.ts`.

## 3. Oracle Cloud

1. Create an Ubuntu 24.04 instance with your SSH key in a public subnet. This setup
   uses an AMD instance. The Always Free E2.1.Micro is capped at 50 Mbps of
   internet bandwidth.
2. Give it a **reserved** public IP, so the address can move to a new instance.
3. Add stateful ingress rules (Security List or NSG), source port empty:

| Port | Source |
|---|---|
| TCP 22 (SSH) | Your own public IP, as `/32` |
| TCP 25565, 80, 443 | `0.0.0.0/0` |
| UDP 51820 | `0.0.0.0/0` |

**SSH timeouts:** with SSH open to `0.0.0.0/0`, connections kept timing out,
attributed to a bot attack. Limiting SSH to one IP fixed it. If your home IP
changes and SSH stops working, update the rule in the Oracle console.

## 4. WireGuard keys

Don't use `ssh-keygen`; its keys don't work with WireGuard. Each machine has its
own pair. **Private keys never leave their machine.**

| Machine | WireGuard runs | Its public key goes |
|---|---|---|
| VPS | Directly on the VPS | In the PC's config (`VPS_KEY`) |
| Home PC | In Docker | In the VPS config (`HOME_KEY`) |

**VPS and PC:** check for existing files first.

    sudo ls -la /etc/wireguard

If `private.key` and `public.key` both exist, reuse them. If there is only one, or
an unexpected `wg0.conf`, work out why before continuing.

**VPS:** check that `ip route` shows nothing already using `10.8.0.`, then install
WireGuard.

    sudo apt update && sudo apt install -y wireguard

**PC:** the key commands need `wireguard-tools` (`sudo pacman -Syu wireguard-tools`,
which also upgrades the system; reboot if the kernel was upgraded). Only the tools
are used. **Don't start `wg-quick@wg0` on the PC**; the tunnel runs in Docker.

**VPS and PC, only if no keys exist:**

    sudo sh -c 'umask 077; wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key'

Show a public key:

    sudo cat /etc/wireguard/public.key

## 5. VPS tunnel

**VPS:** open the host firewall and enable forwarding. Oracle's Ubuntu images have
their own iptables rules, separate from the Security List; don't use ufw there. Do
this **before** WireGuard starts, so `save` doesn't store the tunnel's rules too.

    sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT
    sudo iptables -I INPUT -p udp --dport 51820 -j ACCEPT
    sudo netfilter-persistent save
    echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-wireguard.conf
    sudo sysctl --system

**VPS:** write the config. This **overwrites** `/etc/wireguard/wg0.conf`. Change
only `HOME_KEY`. `MTU` is set because Oracle's network interface uses jumbo
frames.

```sh
HOME_KEY='paste-home-public-key-here'
WAN=$(ip route show default | awk '{print $5; exit}')

sudo install -m 600 /dev/null /etc/wireguard/wg0.conf
sudo tee /etc/wireguard/wg0.conf >/dev/null <<EOF
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = $(sudo cat /etc/wireguard/private.key)
MTU = 1420

PostUp = iptables -t nat -A PREROUTING -i $WAN -p tcp --dport 25565 -j DNAT --to-destination 10.8.0.2:25565
PostUp = iptables -t nat -A POSTROUTING -o %i -p tcp -d 10.8.0.2 --dport 25565 -j MASQUERADE
PostUp = iptables -I FORWARD -i $WAN -o %i -p tcp -d 10.8.0.2 --dport 25565 -j ACCEPT
PostUp = iptables -I FORWARD -i %i -o $WAN -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

PostDown = iptables -t nat -D PREROUTING -i $WAN -p tcp --dport 25565 -j DNAT --to-destination 10.8.0.2:25565
PostDown = iptables -t nat -D POSTROUTING -o %i -p tcp -d 10.8.0.2 --dport 25565 -j MASQUERADE
PostDown = iptables -D FORWARD -i $WAN -o %i -p tcp -d 10.8.0.2 --dport 25565 -j ACCEPT
PostDown = iptables -D FORWARD -i %i -o $WAN -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

[Peer]
PublicKey = $HOME_KEY
AllowedIPs = 10.8.0.2/32
EOF

echo "Network interface: $WAN"
```

The interface should be a name such as `ens3`. If it's blank, stop. Then:

    sudo systemctl enable --now wg-quick@wg0
    sudo wg show

You should see `wg0` and one peer. If it was already running, use
`sudo systemctl restart wg-quick@wg0` after a key or peer change. If you're
changing the firewall lines, stop it **before** editing, then start it again.

## 6. Home containers

| Service | Job |
|---|---|
| `wireguard` | Dials out to the VPS. IP forwarding is off. |
| `router` | `itzg/mc-router`, sharing that network; passes 25565 to `mc`. |
| `website` | Shares that network; serves `10.8.0.2:3000`. No Docker access, but its outgoing connections aren't restricted. |

**PC:** enter your sudo password first, so a prompt doesn't interrupt the paste:

```fish
sudo -v
```

Set the first two values to the **VPS's** public key and public IP. This won't
overwrite an existing config. Don't add a `DNS =` line to the config, or the
containers may no longer find `mc`.

```fish
set VPS_KEY 'paste-vps-public-key'
set VPS_IP 'paste-vps-public-ip'

cd ~/homelab/services/minecraft
mkdir -p wireguard/wg_confs
if test -e wireguard/wg_confs/wg0.conf
    echo "wg0.conf already exists, not overwriting"
else if set HOME_PRIVATE (sudo cat /etc/wireguard/private.key)
    install -m 600 /dev/null wireguard/wg_confs/wg0.conf
    and sed "s#HOME_PRIVATE_KEY#$HOME_PRIVATE#; s#VPS_PUBLIC_KEY#$VPS_KEY#; s#VPS_PUBLIC_IP#$VPS_IP#" wg0.conf.example > wireguard/wg_confs/wg0.conf
    and echo "Config created"
end
set -e HOME_PRIVATE
```

If you get "permission denied", check who owns `wireguard/`. Once the config is
created:

```fish
docker compose up -d --build wireguard router website
docker compose ps
```

`wireguard` should be **healthy**, and the other two running. Healthy only means
the interface exists. These commands don't restart `mc`.

## 7. Test the tunnel

**PC:**

    docker exec minecraft-wireguard ping -c3 10.8.0.1
    docker exec minecraft-wireguard wg show      # recent "latest handshake"

**VPS:**

| Command | Expected |
|---|---|
| `sudo wg show` | Recent handshake |
| `nc -vz -w5 10.8.0.2 25565` | Succeeds |
| `curl -s -m10 http://10.8.0.2:3000/api/status; echo` | Server status |
| `nc -vz -w5 10.8.0.2 22` | **Fails** |
| `nc -vz -w5 10.8.0.2 5000` | **Fails** |

No handshake? Check both UDP 51820 rules (Oracle and iptables), the public IP, and
that each side has the *other* side's public key.

## 8. DNS

In Cloudflare, for `elizakishan.com`:

| Type | Name | Content | Proxy status |
|---|---|---|---|
| A | `mc` | VPS public IP | **DNS only** (grey cloud) |

The normal orange-cloud proxy doesn't carry Minecraft traffic. Don't add an AAAA
record (this setup is IPv4 only) or a Tunnel hostname for `mc`. The VPS IP becomes
public; the home IP isn't in DNS.

## 9. Caddy on the VPS

Do this after DNS is set up. Caddy only handles HTTPS and forwards to the website
at home; it gets the certificate itself.

**VPS:**

    sudo apt install -y caddy
    sudo cp -n /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak

The next command **replaces** the Caddyfile, so don't run it as is if Caddy serves
other sites.

```sh
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
mc.elizakishan.com {
    reverse_proxy 10.8.0.2:3000

    handle_errors {
        respond "MC on Petrova is unreachable right now. Try again soon." 503
    }
}
EOF
```

Check it:

    sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

If it says `Valid configuration`:

    sudo systemctl reload caddy
    systemctl is-active caddy

Don't write `handle_errors 502 503 504`: Caddy 2.6.2 rejects it with "Wrong
argument count".

## 10. Public test

- Open `https://mc.elizakishan.com`, ideally on mobile data.
- Join `mc.elizakishan.com` in Minecraft.
- Website problems, **VPS:** `sudo journalctl -u caddy -n 50 --no-pager`

**Moving from playit** (already done here): only after both tests work, remove its
service from `compose.yml`, run `docker compose up -d --remove-orphans` while
nobody is playing, remove `PLAYIT_SECRET_KEY` from `.env`, and delete the agent in
playit's dashboard.

## 11. Idle reclaim

Oracle [may reclaim](https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
an Always Free instance if, over 7 days, CPU (95th percentile) and network (and
memory, on A1 shapes only) are all under 20%. A light relay can easily qualify.
No official exemption for Pay As You Go was found. A ping won't prevent it.

**Optional, VPS:** artificial CPU load, about 30% on every CPU for 2.5 hours a day.
It doesn't guarantee anything, Oracle's terms on this haven't been checked, and the
timer hasn't been tested. Pick a quiet start time.

```sh
sudo apt install -y stress-ng

sudo tee /etc/systemd/system/keepalive-load.service >/dev/null <<'EOF'
[Unit]
Description=Scheduled CPU load

[Service]
Type=oneshot
Nice=19
ExecStart=/usr/bin/stress-ng --cpu 0 --cpu-load 30 --timeout 150m
EOF

sudo tee /etc/systemd/system/keepalive-load.timer >/dev/null <<'EOF'
[Unit]
Description=Run CPU load daily

[Timer]
OnCalendar=*-*-* 09:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now keepalive-load.timer
```

During a run, check CPU on the instance's **Metrics** page in the Oracle console.
Under 20%? Raise `--cpu-load`. If players notice lag then, see whether it stops
when the run ends. To remove:

    sudo systemctl disable --now keepalive-load.timer
    sudo systemctl stop keepalive-load.service

Keep a secure copy, outside Git, of the VPS `wg0.conf` (it holds a private key),
Caddyfile and firewall rules so you can rebuild. A replacement with a new key
pair needs its new public key in the PC's `wg0.conf`.

---

## Website

A Next.js page showing server status, players and the modpack link. It runs in the
`website` container. See [website/README.md](website/README.md).

- It uses Minecraft's Server List Ping, with no Docker or RCON access.
- The server sends only a sample of player names (12 by default), or none.
- A server that is still starting shows as offline.
- If Caddy can't reach the site, visitors get the "unreachable" message.
- Settings are in `website/src/lib/config.ts`. Rebuild after any change:

      docker compose up -d --build website

## Backups

`backups/` goes to GitHub, but `data/` doesn't. A plain archive of `data/` would
include the **RCON password** (`server.properties`, `.rcon-cli.*`) and **player IP
addresses** (logs, ban list), so use the command below. It leaves those out, along
with downloadable files and `data/mods`, which comes from `mods/`.

**PC (fish):** stopping `mc` gives a consistent copy. Do it when nobody is playing.

```fish
cd ~/homelab/services/minecraft
set FILE backups/data-(date +%F-%H%M).tar.gz
docker compose stop mc
and tar -czf $FILE --exclude=data/libraries --exclude=data/.cache --exclude=data/mods \
    --exclude=data/logs --exclude=data/crash-reports --exclude=data/server.properties \
    --exclude='data/.rcon-cli*' --exclude=data/banned-ips.json data
docker compose start mc
ls -lh $FILE
```

Check that `tar` showed no errors. Before pushing:

- New mods may add secrets in `data/config` or the world folder. List a backup with
  `tar -tzf FILE` and check anything unfamiliar.
- GitHub rejects files over 100 MB, and a committed backup stays in Git history
  even if the file is deleted later. As the world grows, store backups elsewhere.

The early file `data-pre-mods-2026-11-27.tar.gz` contains the password and logs,
so `.gitignore` excludes it. Commit the `.sanitized` copy instead. Both are from
**before the mods were installed**.

### Restore

1. Stop public access and the server:
   `docker compose stop website router wireguard mc`
2. Move the current data aside with `mv data data.old` (check that `data.old`
   doesn't exist). Don't extract over live data, and don't commit `data.old`.
3. Extract: `tar -xzf backups/FILE.tar.gz`
4. Run `docker compose up -d mc` and wait for "Done". This recreates
   `server.properties` with default settings.
5. Set `white-list=true` and any other custom settings in
   `data/server.properties`, using `data.old` as a reference. Then run
   `docker compose restart mc`.
6. Check the world, then run
   `docker compose up -d --force-recreate wireguard router website`.

## Running the server

- **Player IPs:** the server sees every player as the same internal address.
  **Never use `/ban-ip`**, which would ban everyone. Use `/ban`.
- **Whitelist:** keep it on.
- **Latency:** traffic goes player → VPS → home, so a nearby Oracle region helps.
- **After a PC reboot:** check `docker compose ps` and both public addresses.
  Reboot recovery hasn't been tested.
- **Tunnel containers stop responding** after `wireguard` was restarted on its own:
  `docker compose up -d --force-recreate wireguard router website`
- **Take public access down:** `docker compose stop website router wireguard`
- **LAN:** port 25565 is still published on the home network.

## Future idea: auto-repair watchdog (not built)

A systemd timer **at home** would use OCI CLI to check the VPS every 15 minutes.
Build it once the manual setup is working.

| State found | Action |
|---|---|
| Running | Nothing |
| Stopped | `oci compute instance action --action START --instance-id ID`; retry later if there's no capacity |
| Terminated | Launch a replacement and move the reserved IP to it |
| API error or unknown | Log it, create nothing |

- `cloud-init` would restore WireGuard, Caddy and its config, the firewall and
  forwarding settings, and the CPU load timer.
- Reuse the VPS WireGuard key so the home config stays the same. It would then be
  in instance user data and a copy at home: restrict access, keep it out of Git.
- Reuse the reserved IP, network and Security List.
- Prevent overlapping runs and duplicate replacements; add a pause switch.
- Store an API key for a dedicated, minimum-permission user.
- Check for leftover boot volumes, and verify a replacement's SSH host key.
- It can't guarantee capacity, may not recover from account or API problems, and
  doesn't run while home is off.
- Prefer this to unattended, auto-approved Terraform. Test a rebuild under
  supervision first.
- That reclaimed instances are stopped comes from an
  [older community post](https://community.oracle.com/customerconnect/discussion/671904/reclamation-of-idle-compute-instances),
  not confirmed in current docs.
