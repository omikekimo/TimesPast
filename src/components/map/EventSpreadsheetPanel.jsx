
import React, { useState, useRef } from "react";
import { Download, Upload, Search, ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPinDate } from "@/lib/dateUtils";
import { dateToCsvString, dateToCsvTimeString } from "@/lib/dateUtils";


const HUMAN_COLUMNS = [
  { key: "title",       label: "Title" },
  { key: "date", label: "Date", format: d => d ? dateToCsvString(d) : "" },
  { key: "dateTime", label: "Time" },
  { key: "category",    label: "Category",    format: v => v ? v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ") : "" },
  { key: "significance",label: "Significance",format: v => v ? v.charAt(0).toUpperCase() + v.slice(1) : "" },
  { key: "description", label: "Description" },
  { key: "wikipedia_url",label: "Wikipedia URL" },
  { key: "source",      label: "Source" },
  { key: "search_group",label: "Search Group" },
  { key: "search_query", label: "Search Query" },
  { key: "search_color", label: "Search Color" },
  // Technical columns last
  { key: "latitude",    label: "Latitude" },
  { key: "longitude",   label: "Longitude" },
  { key: "id",          label: "ID (internal)" },
];

function toCSVValue(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function eventsToCSV(events) {
  const header = HUMAN_COLUMNS.map(c => c.label).join(",");
  const rows = events.map(e =>
  HUMAN_COLUMNS.map(c => {
    if (c.key === "date") return toCSVValue(dateToCsvString(e.date) ?? "");
    if (c.key === "dateTime") return toCSVValue(dateToCsvTimeString(e.date) ?? "");
    const raw = e[c.key];
    const display = c.format ? c.format(raw) : (raw ?? "");
    return toCSVValue(display ?? "");
  }).join(",")
);
  return [header, ...rows].join("\n");
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj  = {};
    headers.forEach((h, i) => {
      const col = HUMAN_COLUMNS.find(c => c.label === h);
      if (col) obj[col.key] = vals[i] ?? "";
    });
    return obj;
  });
}

function parseCSVLine(line) {
  const vals = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      vals.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  vals.push(cur);
  return vals;
}

const EDITABLE_COLUMNS = ["title", "year", "category", "significance", "description", "wikipedia_url", "search_group", "latitude", "longitude"];
const CATEGORIES = ["war", "politics", "culture", "science", "natural_disaster", "economics", "religion", "exploration", "person"];
const SIGNIFICANCES = ["local", "regional", "national", "global"];

export default function EventSpreadsheetPanel({ events, onImportEvents, onEditEvent }) {
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState(1);
  const [filter, setFilter] = useState("");
  const [editable, setEditable] = useState(false);
  const [editCell, setEditCell] = useState(null); // { eventId, key }
  const [editValue, setEditValue] = useState("");
  const fileRef = useRef();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const displayed = [...events]
  .filter(e => !filter || Object.values(e).some(v => String(v).toLowerCase().includes(filter.toLowerCase())))
  .sort((a, b) => {
    // Primary: group name
    const ag = a.search_query || a.search_group || "";
    const bg = b.search_query || b.search_group || "";
    if (ag < bg) return -1;
    if (ag > bg) return 1;
    // Secondary: if user has picked a sort column use that,
    // otherwise fall back to chronological within the group
    if (sortKey === "year" || sortKey === "date") {
      return ((a.year ?? 0) - (b.year ?? 0)) * sortDir;
    }
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    if (av < bv) return -sortDir;
    if (av > bv) return sortDir;
    // Tertiary: chronological tiebreaker
    return (a.year ?? 0) - (b.year ?? 0);
  });

  const handleExportCSV = () => {
    const defaultName = `timespast-events-${new Date().toISOString().split("T")[0]}`;
    const fileName = window.prompt("Name your export file:", defaultName);
    if (!fileName) return; // user cancelled
    const csv = eventsToCSV(displayed);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.trim()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = file.name.replace(/\.csv$/i, "");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length > 0 && onImportEvents) onImportEvents(parsed, fileName);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const startEdit = (event, key) => {
    if (!editable || !EDITABLE_COLUMNS.includes(key)) return;
    setEditCell({ eventId: event.id, key });
    setEditValue(String(event[key] ?? ""));
  };

  const commitEdit = async () => {
    if (!editCell || !onEditEvent) { setEditCell(null); return; }
    const { eventId, key } = editCell;
    let val = editValue;
    if (key === "year" || key === "latitude" || key === "longitude") {
      val = key === "year" ? parseInt(val, 10) : parseFloat(val);
    }
    await onEditEvent(eventId, { [key]: val });
    setEditCell(null);
  };

  const cancelEdit = () => setEditCell(null);

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortDir === 1 ? <ChevronUp className="w-3 h-3 text-blue-500" /> : <ChevronDown className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter events…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
        <button
          onClick={() => { setEditable(v => !v); setEditCell(null); }}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium transition-colors ${
            editable
              ? "bg-amber-500 text-white border-amber-500"
              : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
          }`}
          title={editable ? "Disable editing" : "Enable editing — click any cell to edit"}
        >
          <Pencil className="w-3 h-3" />
          {editable ? "Editing ON" : "Edit"}
        </button>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-7 text-xs gap-1 px-2">
          <Upload className="w-3.5 h-3.5" /> Export
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="h-7 text-xs gap-1 px-2">
          <Download className="w-3.5 h-3.5" /> Import
        </Button>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1 border border-gray-200 rounded-lg">
        <table className="text-xs w-full min-w-max border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {HUMAN_COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 border-b border-gray-200 ${
                    i >= 7 ? "text-gray-400 font-normal italic" : ""
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={HUMAN_COLUMNS.length} className="text-center py-8 text-gray-400">
                  No events to display
                </td>
              </tr>
            ) : (
              displayed.map((event, idx) => {
                const groupName = event.search_query || event.search_group || null;
                const prevGroupName = idx > 0 ? (displayed[idx-1].search_query || displayed[idx-1].search_group || null) : "__FIRST__";
                const showSeparator = groupName && groupName !== prevGroupName;
                return (<React.Fragment key={event.id}>
                {showSeparator && (
                  <tr>
                    <td colSpan={HUMAN_COLUMNS.length} className="px-3 py-1 bg-blue-50 border-y border-blue-200">
                      <div className="flex items-center gap-2">
                        {event.search_color && (
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: event.search_color }} />
                        )}
                        <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">{groupName}</span>
                      </div>
                    </td>
                  </tr>
                )}
                <tr className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${editable ? "hover:bg-blue-50/40" : ""}`}>
                  {HUMAN_COLUMNS.map((col, i) => {
                    const raw = event[col.key];
                    const display = col.format ? col.format(raw) : (raw ?? "");
                    const isEditing = editCell?.eventId === event.id && editCell?.key === col.key;
                    const canEdit = editable && EDITABLE_COLUMNS.includes(col.key);

                    if (isEditing) {
                      return (
                        <td key={col.key} className="px-1 py-0.5 border-b border-blue-200 bg-blue-50 min-w-[120px]">
                          {col.key === "category" ? (
                            <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              className="w-full border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none bg-white">
                              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                            </select>
                          ) : col.key === "significance" ? (
                            <select autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                              onBlur={commitEdit}
                              className="w-full border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none bg-white">
                              {SIGNIFICANCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                                className="flex-1 border border-blue-400 rounded px-1 py-0.5 text-xs focus:outline-none min-w-0"
                                type={["year","latitude","longitude"].includes(col.key) ? "number" : "text"}
                                step="any"
                              />
                              <button onClick={commitEdit} className="text-green-600 hover:text-green-700"><Check className="w-3 h-3" /></button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
                            </div>
                          )}
                        </td>
                      );
                    }

                    return (
                      <td
                        key={col.key}
                        onClick={() => startEdit(event, col.key)}
                        className={`px-3 py-1.5 border-b border-gray-100 max-w-[220px] truncate ${
                          i >= 7 ? "text-gray-400 italic" : "text-gray-800"
                        } ${col.key === "title" ? "font-medium" : ""} ${canEdit ? "cursor-pointer hover:bg-blue-100/60" : ""}`}
                        title={canEdit ? `Click to edit: ${String(display)}` : String(display)}
                      >
                        {col.key === "wikipedia_url" && display && !editable ? (
                          <a href={display} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                            {display}
                          </a>
                        ) : String(display)}
                      </td>
                    );
                  })}
                </tr>
                </React.Fragment>);
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-gray-400 text-right flex-shrink-0">
        {displayed.length} of {events.length} events shown · Technical columns (Lat, Lon, ID) are italicised
      </div>
    </div>
  );
}
