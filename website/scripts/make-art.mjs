// Regenerates the original voxel artwork and the favicon: node scripts/make-art.mjs
import { writeFileSync } from "node:fs";

let seed = 20;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const W = 20; // half-width of a block in SVG units
const H = 10; // half-height of its top face
const D = 20; // height of its sides

// [top, side] colours per block type
const BLOCKS = {
  grass: ["#78b843", "#8a5a37"],
  dirt: ["#8a5a37", "#7c5032"],
  stone: ["#8b8b8f", "#76767b"],
  deep: ["#55555d", "#484850"],
  sand: ["#e3d49a", "#cdbd85"],
  water: ["#3f8ee0", "#2f73c4"],
  log: ["#a07a4a", "#5f4024"],
  leaves: ["#4c9a35", "#3f842c"],
  blossom: ["#f4a6c8", "#e489b1"],
  gold: ["#ffe45c", "#e5b824"],
  diamond: ["#7ff0e4", "#42c6bd"],
  brick: ["#b0604a", "#a25440"],
  casing: ["#a3a89d", "#8d9288"], // andesite
  brass: ["#e8c066", "#d3a447"],
  plank: ["#9a7443", "#86633a"],
  slate: ["#4f5663", "#434955"],
  glass: ["#ffe9a8", "#ffd873"], // lit window
};

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift) => Math.min(255, Math.round(((n >> shift) & 255) * factor));
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}

/** Draws a map of "x,y,z" -> block type as an isometric SVG, with optional extras on top. */
function render(world, extras) {
  const blocks = [...world]
    .map(([key, type]) => [...key.split(",").map(Number), type])
    // Painter's order: back to front, bottom to top.
    .sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));

  let shapes = "";
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const poly = (fill, points) => {
    for (const [px, py] of points) {
      box[0] = Math.min(box[0], px);
      box[1] = Math.min(box[1], py);
      box[2] = Math.max(box[2], px);
      box[3] = Math.max(box[3], py);
    }
    shapes += `<path fill="${fill}" stroke="${fill}" stroke-width=".6" d="M${points.join("L")}z"/>`;
  };

  for (const [x, y, z, type] of blocks) {
    const open = {
      top: !world.has(`${x},${y},${z + 1}`),
      left: !world.has(`${x},${y + 1},${z}`),
      right: !world.has(`${x + 1},${y},${z}`),
    };
    if (!open.top && !open.left && !open.right) continue;

    const sx = (x - y) * W;
    const sy = (x + y) * H - z * D;
    const [top, side] = BLOCKS[type];
    const jitter = 0.93 + random() * 0.14;
    const faces = [
      [open.left, 0.82, [[sx - W, sy], [sx, sy + H], [sx, sy + H + D], [sx - W, sy + D]]],
      [open.right, 0.62, [[sx, sy + H], [sx + W, sy], [sx + W, sy + D], [sx, sy + H + D]]],
    ];
    for (const [visible, light, points] of faces) {
      if (!visible) continue;
      poly(shade(side, light * jitter), points);
      if (type === "grass" && open.top) {
        // Green lip hanging over the dirt sides.
        const [a, b] = points;
        poly(shade(top, light * jitter), [a, b, [b[0], b[1] + 6], [a[0], a[1] + 6]]);
      }
    }
    if (open.top) {
      poly(shade(top, jitter), [[sx, sy - H], [sx + W, sy], [sx, sy + H], [sx - W, sy]]);
    }
  }

  let style = "";
  if (extras) {
    const extra = extras({ poly, include: (px, py) => {
      box[0] = Math.min(box[0], px);
      box[1] = Math.min(box[1], py);
      box[2] = Math.max(box[2], px);
      box[3] = Math.max(box[3], py);
    }, add: (markup) => (shapes += markup) });
    style = extra ?? "";
  }

  const [x0, y0, x1, y1] = box;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x1 - x0}" height="${y1 - y0}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}">${style}${shapes}</svg>\n`;
}

/* The hero: a Create-style workshop island. Original art, no mod assets. */

const POND = { x: 1, y: 5, r: 3.2 };

function island() {
  const world = new Map();
  const set = (x, y, z, type) => world.set(`${x},${y},${z}`, type);
  const R = 11;

  for (let x = -R; x <= R; x++) {
    for (let y = -R; y <= R; y++) {
      const edge = Math.hypot(x, y) + Math.sin(x * 0.9) * 0.8 + Math.cos(y * 0.7) * 0.8;
      if (edge > R) continue;
      const pond = Math.hypot(x - POND.x, y - POND.y);
      const depth = Math.max(2, Math.round((R - edge) * 0.85 + random() * 2.5));
      for (let z = -depth; z <= 0; z++) {
        let type = z === 0 ? "grass" : z > -3 ? "dirt" : z > -6 ? "stone" : "deep";
        if (z === 0 && pond < POND.r) type = "water";
        else if (z === 0 && pond < POND.r + 1.1) type = "sand";
        if ((type === "stone" || type === "deep") && random() < 0.035) {
          type = random() < 0.5 ? "brass" : "casing";
        }
        set(x, y, z, type);
      }
    }
  }

  // Windmill tower, centred on (-6, 0)
  for (let z = 1; z <= 10; z++)
    for (let x = -7; x <= -5; x++)
      for (let y = -1; y <= 1; y++) {
        const corner = x !== -6 && y !== 0;
        let type = z <= 3 ? (corner ? "casing" : "stone") : corner ? "log" : "plank";
        if (z >= 9) type = "slate";
        if (z === 10 && corner) continue;
        set(x, y, z, type);
      }
  set(-6, 0, 11, "brass");
  set(-5, 0, 5, "glass");

  // Workshop with a chimney
  for (let x = 0; x <= 5; x++)
    for (let y = -7; y <= -4; y++)
      for (let z = 1; z <= 5; z++) {
        const corner = (x === 0 || x === 5) && (y === -7 || y === -4);
        let type = z === 5 ? "slate" : corner || z === 1 ? "casing" : z === 4 ? "brass" : "brick";
        if (x === 5 && (y === -6 || y === -5) && (z === 2 || z === 3)) type = "glass";
        set(x, y, z, type);
      }
  for (let z = 6; z <= 9; z++) set(1, -6, z, z === 9 ? "casing" : "brick");

  // Axle post behind the water wheel
  set(POND.x, POND.y - 1, 1, "casing");

  const tree = (x, y, leaf, trunk) => {
    for (let z = 1; z <= trunk; z++) set(x, y, z, "log");
    for (let dz = 0; dz < 4; dz++) {
      const r = dz < 2 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++)
        for (let dy = -r; dy <= r; dy++) {
          const corner = Math.abs(dx) === r && Math.abs(dy) === r;
          if (corner && (dz > 1 || random() < 0.7)) continue;
          if (dz < 2 && dx === 0 && dy === 0) continue;
          set(x + dx, y + dy, trunk - 1 + dz, leaf);
        }
    }
  };
  tree(-4, -7, "blossom", 4);

  return world;
}

/** Isometric projection of a point in block units. */
const project = (x, y, z) => [(x - y) * W, (x + y) * H - z * D];

const rect = (fill, x, y, w, h) => `<rect fill="${fill}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;

function cogShape(radius, teeth, wood, rim) {
  let shape = "";
  for (let i = 0; i < teeth; i++) {
    shape += `<g transform="rotate(${(360 / teeth) * i})">${rect(rim, -0.17, -radius - 0.28, 0.34, 0.45)}</g>`;
  }
  shape += `<circle r="${radius}" fill="${wood}" stroke="${rim}" stroke-width=".18"/>`;
  for (const angle of [0, 90]) {
    shape += `<g transform="rotate(${angle})">${rect(rim, -radius, -0.14, radius * 2, 0.28)}</g>`;
  }
  return shape + rect("#8d9288", -0.28, -0.28, 0.56, 0.56) + rect("#3d403b", -0.12, -0.12, 0.24, 0.24);
}

/** Four lattice sails with cloth, like a windmill bearing contraption. */
function sailShape() {
  let shape = "";
  for (const angle of [0, 90, 180, 270]) {
    let arm = rect("#efe9da", 0.18, -6.2, 1.5, 5);
    for (let v = -6.2; v <= -1.2; v += 1) arm += rect("#c9bfa6", 0.18, v, 1.5, 0.1);
    arm += rect("#c9bfa6", 1.6, -6.2, 0.1, 5.1) + rect("#6d4d2b", -0.18, -6.4, 0.36, 6.4);
    shape += `<g transform="rotate(${angle})">${arm}</g>`;
  }
  return shape + rect("#d3a447", -0.55, -0.55, 1.1, 1.1) + rect("#8a6a28", -0.22, -0.22, 0.44, 0.44);
}

function wheelShape() {
  let shape = "";
  for (let i = 0; i < 12; i++) {
    shape += `<g transform="rotate(${30 * i})">${rect("#6d4d2b", -0.14, -2.6, 0.28, 2.6)}${rect("#b08a54", -0.42, -2.95, 0.84, 0.45)}</g>`;
  }
  shape += `<circle r="2.35" fill="none" stroke="#86633a" stroke-width=".35"/>`;
  shape += `<circle r="1.2" fill="none" stroke="#86633a" stroke-width=".22"/>`;
  return shape + rect("#a3a89d", -0.4, -0.4, 0.8, 0.8) + rect("#3d403b", -0.15, -0.15, 0.3, 0.3);
}

function machinery({ poly, include, add }) {
  /**
   * A flat, spinning part in the vertical plane facing front-left. Drawing in plane
   * coordinates and then skewing makes it rotate correctly in isometric view.
   */
  const spinning = (x, y, z, reach, shape, seconds, { reverse = false, clipBelow } = {}) => {
    const layer = (depth, filter) => {
      const [px, py] = project(x, y - depth, z);
      const spin = `<g class="spin" style="animation-duration:${seconds}s${reverse ? ";animation-direction:reverse" : ""}">${shape}</g>`;
      const clip = clipBelow === undefined ? "" : ` clip-path="url(#waterline)"`;
      add(`<g transform="matrix(${W} ${H} 0 ${D} ${px} ${py})"${filter}><g${clip}>${spin}</g></g>`);
    };
    if (clipBelow !== undefined) {
      add(`<clipPath id="waterline"><rect x="-4" y="-4" width="8" height="${4 + clipBelow}"/></clipPath>`);
    }
    layer(0.22, ` style="filter:brightness(.55)"`); // back copy gives it thickness
    layer(0, "");
    for (const du of [-reach, reach])
      for (const dv of [-reach, reach]) include(...project(x + du, y, z - dv));
  };

  /** A box spanning [x0,x1] x [y0,y1] x [z0,z1]: only the three visible faces. */
  const cuboid = (x0, x1, y0, y1, z0, z1, color) => {
    poly(shade(color, 0.82), [project(x0, y1, z1), project(x1, y1, z1), project(x1, y1, z0), project(x0, y1, z0)]);
    poly(shade(color, 0.62), [project(x1, y1, z1), project(x1, y0, z1), project(x1, y0, z0), project(x1, y1, z0)]);
    poly(shade(color, 1.08), [project(x0, y0, z1), project(x1, y0, z1), project(x1, y1, z1), project(x0, y1, z1)]);
  };

  const slab = (x0, x1, y0, y1, color) =>
    poly(color, [project(x0, y0, 0), project(x1, y0, 0), project(x1, y1, 0), project(x0, y1, 0)]);

  // Track along the front-right edge
  for (let y = -3.4; y <= 6.2; y += 0.7) slab(6.35, 7.65, y, y + 0.32, "#5f4024");
  for (const x of [6.62, 7.28]) slab(x, x + 0.12, -3.5, 6.6, "#c8ccc4");

  // Steam train, drawn back to front
  const wheels = (...positions) => {
    for (const y of positions) cuboid(6.55, 7.5, y, y + 0.55, 0.05, 0.5, "#35363a");
  };
  wheels(-2.4, -1.1);
  cuboid(6.45, 7.55, -2.6, -0.4, 0.45, 1.35, "#86633a");
  cuboid(6.4, 7.6, -2.65, -0.35, 1.35, 1.5, "#d3a447");
  wheels(0.2, 1.5, 2.7);
  cuboid(6.4, 7.6, 0, 1.3, 0.45, 2.05, "#a8402f");
  cuboid(6.3, 7.7, -0.1, 1.4, 2.05, 2.3, "#d3a447");
  cuboid(6.55, 7.45, 1.3, 3.4, 0.45, 1.4, "#5b605a");
  for (const y of [1.65, 2.55]) cuboid(6.52, 7.48, y, y + 0.18, 0.45, 1.43, "#d3a447");
  cuboid(6.75, 7.25, 1.95, 2.35, 1.4, 1.75, "#e8c066");
  cuboid(6.78, 7.22, 2.85, 3.25, 1.4, 2.2, "#35363a");
  cuboid(6.5, 7.5, 3.4, 3.65, 0.25, 0.65, "#c4704c");

  // Windmill sails, the water wheel, and a meshing pair of cogwheels
  spinning(-6, 2.15, 7.5, 6.5, sailShape(), 28);
  spinning(POND.x, POND.y + 0.15, 1.35, 3, wheelShape(), 14, { clipBelow: 1.35 });
  spinning(1.5, -3.25, 2.7, 2.1, cogShape(1.65, 16, "#c9953c", "#8a6a28"), 16);
  spinning(4.15, -3.25, 1.85, 1.4, cogShape(0.95, 9, "#a57c48", "#6d4d2b"), 9, { reverse: true });

  // Smoke from the workshop chimney and the train
  const smoke = (x, y, z, size) => {
    const [px, py] = project(x, y, z);
    for (let i = 0; i < 4; i++) {
      add(`<rect class="smoke" x="${px - size / 2}" y="${py - size}" width="${size}" height="${size}" fill="#e8e6ee" style="animation-delay:${-i * 1.25}s"/>`);
    }
    include(px + 70, py - 90);
  };
  smoke(1, -6, 9.2, 18);
  smoke(7, 3.05, 2.35, 11);

  // The SVG is loaded as an image, so its animation styles have to live inside it.
  return `<style>.spin{animation:spin linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.smoke{opacity:0;transform-box:fill-box;transform-origin:center;animation:rise 5s linear infinite}@keyframes rise{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:.75}100%{opacity:0;transform:translate(45px,-70px) scale(1.7)}}@media (prefers-reduced-motion:reduce){.spin,.smoke{animation:none}}</style>`;
}

function crate() {
  const world = new Map();
  for (let x = 0; x < 4; x++)
    for (let y = 0; y < 4; y++)
      for (let z = 0; z < 4; z++)
        world.set(`${x},${y},${z}`, z === 3 ? "grass" : z === 0 && random() < 0.4 ? "stone" : "dirt");
  // Blocks lifting off the top, spaced so they don't overlap on screen.
  world.set("0,3,6", "diamond");
  world.set("3,0,7", "gold");
  world.set("0,0,8", "blossom");
  return world;
}

writeFileSync("public/art/island.svg", render(island(), machinery));
writeFileSync("public/art/blocks.svg", render(crate()));
writeFileSync("src/app/icon.svg", render(new Map([["0,0,0", "grass"]])));
