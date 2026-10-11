export const CLAUDE_RAYS = Array.from({ length: 12 }, (_, index) => {
  const angle = (index * Math.PI) / 6 + 0.12;
  const length = index % 2 ? 7.2 : 10;
  return `M0 0L${(Math.cos(angle) * length).toFixed(2)} ${(Math.sin(angle) * length).toFixed(2)}`;
}).join("");
