import React from "react";
import { PRECISION, blankDatePart } from "@/lib/dateUtils";

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
];

// A single row of controls for one date part (start or end)
export default function DatePartPicker({ label, value, onChange, allowClear = true }) {
  const v = value || blankDatePart();

  const set = (k, val) => onChange({ ...v, [k]: val });

  const setPrecision = (p) => {
    // Clear fields that are beyond the new precision
    const next = { ...v, precision: p };
    if (p === PRECISION.YEAR)  { next.month = ""; next.day = ""; next.hour = ""; next.minute = ""; }
    if (p === PRECISION.MONTH) { next.day = ""; next.hour = ""; next.minute = ""; }
    if (p === PRECISION.DAY)   { next.hour = ""; next.minute = ""; }
    onChange(next);
  };

  const precisions = [
    { value: PRECISION.YEAR,  label: "Y" },
    { value: PRECISION.MONTH, label: "M" },
    { value: PRECISION.DAY,   label: "D" },
    { value: PRECISION.TIME,  label: "T" },
  ];

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
          {allowClear && value && (
            <button type="button" onClick={() => onChange(null)}
              className="text-[10px] text-red-400 hover:text-red-600">clear</button>
          )}
        </div>
      )}

      {/* Precision selector */}
      <div className="flex gap-1">
        <span className="text-[10px] text-gray-400 self-center mr-1">Precision:</span>
        {precisions.map(p => (
          <button key={p.value} type="button"
            onClick={() => setPrecision(p.value)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
              v.precision === p.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-300 hover:border-blue-400"
            }`}
            title={{ Y:"Year only", M:"Year + Month", D:"Full date", T:"Date + Time" }[p.label]}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Year row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            min="1"
            placeholder="Year"
            value={v.year}
            onChange={e => set("year", e.target.value)}
            className="w-20 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={!!v.bce}
              onChange={e => set("bce", e.target.checked)}
              className="accent-blue-500 w-3 h-3" />
            BCE
          </label>
        </div>

        {/* Month — shown for month+ precision */}
        {(v.precision === PRECISION.MONTH || v.precision === PRECISION.DAY || v.precision === PRECISION.TIME) && (
          <select value={v.month} onChange={e => set("month", e.target.value)}
            className="border rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
            <option value="">Mon</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        )}

        {/* Day — shown for day+ precision */}
        {(v.precision === PRECISION.DAY || v.precision === PRECISION.TIME) && (
          <input type="number" min="1" max="31" placeholder="Day"
            value={v.day} onChange={e => set("day", e.target.value)}
            className="w-12 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
        )}
      </div>

      {/* Time row — only for time precision */}
      {v.precision === PRECISION.TIME && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Time:</span>
          <input type="number" min="0" max="23" placeholder="HH"
            value={v.hour} onChange={e => set("hour", e.target.value)}
            className="w-12 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <span className="text-gray-400 text-xs">:</span>
          <input type="number" min="0" max="59" placeholder="MM"
            value={v.minute} onChange={e => set("minute", e.target.value)}
            className="w-12 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <span className="text-[10px] text-gray-400">(24h)</span>
        </div>
      )}
    </div>
  );
}
