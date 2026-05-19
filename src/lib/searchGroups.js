// Palette for search groups — vivid, distinct colours
const GROUP_COLORS = [
  "#e11d48","#7c3aed","#0284c7","#059669","#d97706",
  "#db2777","#4f46e5","#0891b2","#16a34a","#b45309",
  "#dc2626","#9333ea","#0369a1","#047857","#92400e",
];

let _idx = 0;

export function nextGroupColor() {
  const c = GROUP_COLORS[_idx % GROUP_COLORS.length];
  _idx++;
  return c;
}
