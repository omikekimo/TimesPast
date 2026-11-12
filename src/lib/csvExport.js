 import { dateToCsvString, dateToCsvTimeString } from '@/lib/dateUtils';

// ── Column definitions ────────────────────────────────────────────────────────
export const HUMAN_COLUMNS = [
  { key: "title",         label: "Title" },
  { key: "date",          label: "Date",         format: d => d ? dateToCsvString(d) : "" },
  { key: "dateTime",      label: "Time" },
  { key: "category",      label: "Category",     format: v => v ? v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ") : "" },
  { key: "significance",  label: "Significance", format: v => v ? v.charAt(0).toUpperCase() + v.slice(1) : "" },
  { key: "description",   label: "Description" },
  { key: "wikipedia_url", label: "Wikipedia URL" },
  { key: "source",        label: "Source" },
  { key: "search_group",  label: "Search Group" },
  { key: "search_query",  label: "Search Query" },
  { key: "search_color",  label: "Search Color" },
  { key: "latitude",      label: "Latitude" },
  { key: "longitude",     label: "Longitude" },
  { key: "id",            label: "ID (internal)" },
];

const NOTE_START = '##NOTE_START##';
const NOTE_END   = '##NOTE_END##';

export function toCSVValue(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function eventsToCSV(events) {
  const header = HUMAN_COLUMNS.map(c => c.label).join(",");
  const rows   = events.map(e =>
    HUMAN_COLUMNS.map(c => {
      if (c.key === "date")     return toCSVValue(dateToCsvString(e.date)     ?? "");
      if (c.key === "dateTime") return toCSVValue(dateToCsvTimeString(e.date) ?? "");
      const raw     = e[c.key];
      const display = c.format ? c.format(raw) : (raw ?? "");
      return toCSVValue(display ?? "");
    }).join(",")
  );
  return [header, ...rows].join("\n");
}

export function notesToCSVBlocks(notes) {
  if (!notes?.length) return "";
  return notes.map(note => {
    const header = [
      NOTE_START,
      note.title        || "",
      note.entity_label || "",
      note.parent_pin_id || "",
      note.search_group  || "",
      note.search_color  || "",
      note.created_at    || "",
    ].map(toCSVValue).join(",");

    const bindingHeader = "RowIndex,Property,Label,Value,Type";
    const bindingRows   = [];

    (note.rows || []).forEach((row, rowIdx) => {
      Object.entries(row)
        .filter(([key]) => !key.endsWith("Label"))
        .forEach(([key, binding]) => {
          const label = row[`${key}Label`]?.value || "";
          bindingRows.push([
            rowIdx,
            toCSVValue(key),
            toCSVValue(label),
            toCSVValue(binding.value || ""),
            toCSVValue(binding.type  || ""),
          ].join(","));
        });
    });

    return [header, bindingHeader, ...bindingRows, NOTE_END].join("\n");
  }).join("\n");
}
