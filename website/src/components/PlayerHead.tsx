// A generic 8x8 pixel face, coloured from the player's name. It isn't their real
// skin: that would mean sending player names to a third-party avatar service.
const SKIN = ["#f1c9a5", "#d9a066", "#b57b52", "#8d5a3b"];
const HAIR = ["#3b2414", "#6b4423", "#c9942e", "#1f1f1f", "#a33b20", "#d8d8d8"];
const EYES = ["#3c5aa6", "#2f7d32", "#5a3a22", "#6a3fa0"];

export default function PlayerHead({ name }: { name: string }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  const hair = HAIR[(hash >>> 3) % HAIR.length];

  return (
    <svg className="head" viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      <path fill={SKIN[hash % SKIN.length]} d="M0 0h8v8H0z" />
      <path fill={hair} d="M0 0h8v2H0zM0 2h1v2H0zM7 2h1v2H7z" />
      <path fill="#fff" d="M1 4h2v1H1zM5 4h2v1H5z" />
      <path fill={EYES[(hash >>> 7) % EYES.length]} d="M2 4h1v1H2zM5 4h1v1H5z" />
      <path fill="#00000040" d="M3 5h2v1H3zM2 6h4v1H2z" />
    </svg>
  );
}
