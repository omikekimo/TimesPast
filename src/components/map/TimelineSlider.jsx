import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const ABS_MIN = -13800000000;
const ABS_MAX = CURRENT_YEAR;

const PERIODS = [
  { start: -13800000000, end: -541000000,  label: "Precambrian" },
  { start: -541000000,   end: -485000000,  label: "Cambrian" },
  { start: -485000000,   end: -444000000,  label: "Ordovician" },
  { start: -444000000,   end: -419000000,  label: "Silurian" },
  { start: -419000000,   end: -359000000,  label: "Devonian" },
  { start: -359000000,   end: -299000000,  label: "Carboniferous" },
  { start: -299000000,   end: -252000000,  label: "Permian" },
  { start: -252000000,   end: -201000000,  label: "Triassic" },
  { start: -201000000,   end: -145000000,  label: "Jurassic" },
  { start: -145000000,   end: -66000000,   label: "Cretaceous" },
  { start: -66000000,    end: -56000000,   label: "Paleocene" },
  { start: -56000000,    end: -34000000,   label: "Eocene" },
  { start: -34000000,    end: -23000000,   label: "Oligocene" },
  { start: -23000000,    end: -2600000,    label: "Miocene" },
  { start: -2600000,     end: -11700,      label: "Pleistocene (Ice Ages)" },
  { start: -11700,       end: -3000,       label: "Mesolithic" },
  { start: -3000,        end: -550,        label: "Ancient World",          sub: "Bronze & Iron Age" },
  { start: -550,         end: -31,         label: "Classical Antiquity",     sub: "Greek & Roman" },
  { start: -31,          end: 476,         label: "Roman Empire" },
  { start: 476,          end: 1000,        label: "Early Middle Ages",       sub: "Dark Ages" },
  { start: 1000,         end: 1300,        label: "High Middle Ages" },
  { start: 1300,         end: 1500,        label: "Late Middle Ages",        sub: "Black Death era" },
  { start: 1485,         end: 1603,        label: "Tudor Period" },
  { start: 1500,         end: 1700,        label: "Renaissance",             sub: "Age of Exploration" },
  { start: 1600,         end: 1800,        label: "Baroque / Enlightenment" },
  { start: 1714,         end: 1830,        label: "Georgian Era" },
  { start: 1760,         end: 1840,        label: "Industrial Revolution" },
  { start: 1837,         end: 1901,        label: "Victorian Era" },
  { start: 1900,         end: 1945,        label: "World War Era" },
  { start: 1945,         end: 1991,        label: "Cold War",                sub: "Post-WWII" },
  { start: 1991,         end: ABS_MAX,     label: "Anthropocene",            sub: "Information Age" },
];

function getPeriodForRange(start, end) {
  const overlapping = PERIODS.filter(p => p.end >= start && p.start <= end);
  if (!overlapping.length) return null;
  const containing = overlapping.filter(p => p.start <= start && p.end >= end);
  if (containing.length) return containing.reduce((a, b) => (b.end - b.start < a.end - a.start ? b : a));
  return overlapping.reduce((best, p) => {
    const ov  = Math.min(p.end, end)    - Math.max(p.start, start);
    const bov = Math.min(best.end, end) - Math.max(best.start, start);
    return ov > bov ? p : best;
  });
}

function getTickScale(span) {
  if (span > 1e9)   return { step: 1e9,  unit: "Gigayears" };
  if (span > 1e6)   return { step: 1e6,  unit: "Megayears" };
  if (span > 10000) return { step: 1e4,  unit: "10,000-year steps" };
  if (span > 2000)  return { step: 1000, unit: "Millennia" };
  if (span > 200)   return { step: 100,  unit: "Centuries" };
  if (span > 20)    return { step: 10,   unit: "Decades" };
  return              { step: 1,    unit: "Years" };
}

export function formatYear(y) {
  if (Math.abs(y) >= 1e9) return `${(y / 1e9).toFixed(1)}Ba ${y < 0 ? "BCE" : "CE"}`;
  if (Math.abs(y) >= 1e6) return `${(y / 1e6).toFixed(1)}Ma ${y < 0 ? "BCE" : "CE"}`;
  if (Math.abs(y) >= 1000) return `${Math.abs(Math.round(y / 100) * 100).toLocaleString()} ${y < 0 ? "BCE" : "CE"}`;
  if (y < 0) return `${Math.abs(y)} BCE`;
  return `${y} CE`;
}

function formatYearShort(y) {
  if (Math.abs(y) >= 1e9) return `${(y / 1e9).toFixed(0)}Ba`;
  if (Math.abs(y) >= 1e6) return `${(y / 1e6).toFixed(0)}Ma`;
  if (y < 0) return `${Math.abs(y)}BCE`;
  return `${y}`;
}

// ── Window boundary YearInput boxes ──────────────────────────────────────────
function YearInput({ value, onChange, label, otherValue, isFrom }) {
  const [raw, setRaw]   = useState(String(Math.abs(value)));
  const [bce, setBce]   = useState(value < 0);
  const [error, setErr] = useState(null);

  useEffect(() => {
    setRaw(String(Math.abs(value)));
    setBce(value < 0);
    setErr(null);
  }, [value]);

  const tryCommit = (numericYear) => {
    const capped = Math.min(numericYear, ABS_MAX);
    if (isFrom  && capped >= otherValue) { setErr(`Must be before ${formatYear(otherValue)}`); return; }
    if (!isFrom && capped <= otherValue) { setErr(`Must be after ${formatYear(otherValue)}`);  return; }
    setErr(null);
    onChange(capped);
  };

  const commit = (overrideBce = bce) => {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) { setErr("Enter a positive number"); return; }
    tryCommit(overrideBce ? -n : n);
  };

  const handleEraToggle = (newBce) => {
    setBce(newBce);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) tryCommit(newBce ? -n : n);
  };

  return (
    <div className="flex flex-col items-center gap-1 min-w-[90px]">
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{label}</span>
      <input
        type="number" min="0" value={raw}
        onChange={e => { setRaw(e.target.value); setErr(null); }}
        onBlur={() => commit()}
        onKeyDown={e => e.key === "Enter" && commit()}
        className={`w-20 text-center border rounded px-1 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 ${
          error ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-blue-400"
        }`}
      />
      <div className="flex gap-1 text-xs">
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="radio" checked={!bce} onChange={() => handleEraToggle(false)} className="accent-blue-500" /> CE
        </label>
        <label className="flex items-center gap-0.5 cursor-pointer">
          <input type="radio" checked={bce}  onChange={() => handleEraToggle(true)}  className="accent-blue-500" /> BCE
        </label>
      </div>
      {error && <span className="text-[9px] text-red-500 text-center leading-tight max-w-[90px]">{error}</span>}
    </div>
  );
}

// ── Custom dual-handle drag slider ────────────────────────────────────────────
// Uses a single container div + pointer events to avoid the stacked-input problem.
function DualRangeSlider({ min, max, start, end, onChange }) {
  const trackRef  = useRef(null);
  const dragging  = useRef(null); // "start" | "end" | null
  const THUMB_R   = 8; // px, half thumb width

  const pct = useCallback((v) => {
    if (max === min) return 0;
    return Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  }, [min, max]);

  const valueFromPct = useCallback((p) => {
    return Math.round(min + (p / 100) * (max - min));
  }, [min, max]);

  const pctFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const raw = (clientX - rect.left) / rect.width * 100;
    return Math.min(100, Math.max(0, raw));
  }, []);

  const onPointerDown = useCallback((e) => {
    const p = pctFromEvent(e);
    const v = valueFromPct(p);
    // Pick whichever handle is closer
    const distStart = Math.abs(v - start);
    const distEnd   = Math.abs(v - end);
    dragging.current = distStart <= distEnd ? "start" : "end";
    trackRef.current.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [start, end, pctFromEvent, valueFromPct]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const v = valueFromPct(pctFromEvent(e));
    if (dragging.current === "start") {
      const newStart = Math.min(v, end - 1);
      if (newStart !== start) onChange({ start: newStart, end });
    } else {
      const newEnd = Math.max(v, start + 1);
      if (newEnd !== end) onChange({ start, end: newEnd });
    }
    e.preventDefault();
  }, [start, end, onChange, pctFromEvent, valueFromPct]);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const startPct = pct(start);
  const endPct   = pct(end);

  return (
    <div
      ref={trackRef}
      className="relative h-6 flex items-center cursor-pointer select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Track background */}
      <div className="absolute inset-x-0 h-2 bg-gray-200 rounded-full" />
      {/* Active range highlight */}
      <div
        className="absolute h-2 bg-blue-500 rounded-full"
        style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
      />
      {/* Start thumb */}
      <div
        className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow-md"
        style={{ left: `calc(${startPct}% - ${THUMB_R}px)`, zIndex: 2 }}
      />
      {/* End thumb */}
      <div
        className="absolute w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md"
        style={{ left: `calc(${endPct}% - ${THUMB_R}px)`, zIndex: 2 }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TimelineSlider({ timeRange, onTimeRangeChange, eventCount }) {
  const [dismissedPeriods, setDismissedPeriods] = useState(new Set());
  const [windowMin, setWindowMin] = useState(() => Math.min(timeRange.start, -3000));
  const [windowMax, setWindowMax] = useState(() => Math.max(timeRange.end, ABS_MAX));

  // Keep window covering externally-driven timeRange changes
  useEffect(() => {
    setWindowMin(prev => Math.min(prev, timeRange.start));
    setWindowMax(prev => Math.max(prev, timeRange.end));
  }, [timeRange.start, timeRange.end]);

  const span = windowMax - windowMin;
  const tickScale = useMemo(() => getTickScale(span), [span]);

  const startVal = Math.max(windowMin, Math.min(timeRange.start, windowMax));
  const endVal   = Math.max(windowMin, Math.min(timeRange.end,   windowMax));

  const currentPeriod = useMemo(() => getPeriodForRange(startVal, endVal), [startVal, endVal]);
  const periodKey  = currentPeriod?.label || "";
  const showPeriod = currentPeriod && !dismissedPeriods.has(periodKey);

  const ticks = useMemo(() => {
    if (span === 0) return [];
    const step  = tickScale.step;
    const first = Math.ceil(windowMin / step) * step;
    const result = [];
    for (let t = first; t <= windowMax; t += step) result.push(t);
    return result.slice(0, 10);
  }, [windowMin, windowMax, tickScale.step, span]);

  const pct = (v) => {
    if (span === 0) return 0;
    return Math.min(100, Math.max(0, ((v - windowMin) / span) * 100));
  };

  const updateWindowMin = (v) => {
    if (v >= windowMax) return;
    setWindowMin(v);
    const newStart = v;
    const newEnd   = Math.max(newStart + 1, timeRange.end);
    onTimeRangeChange({ start: newStart, end: Math.min(newEnd, windowMax) });
  };

  const updateWindowMax = (v) => {
    if (v <= windowMin) return;
    const safe = Math.min(v, ABS_MAX);
    setWindowMax(safe);
    const newEnd   = Math.min(safe, timeRange.end);
    const newStart = Math.min(safe - 1, Math.min(newEnd - 1, timeRange.start));
    onTimeRangeChange({ start: Math.max(newStart, windowMin), end: newEnd });
  };

  return (
    <div className="space-y-3">
      {/* Period badge */}
      <div className="min-h-[44px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {showPeriod ? (
            <motion.div
              key={periodKey}
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 max-w-full"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-blue-900 text-sm leading-tight truncate">{currentPeriod.label}</div>
                {currentPeriod.sub && <div className="text-xs text-blue-600 leading-tight">{currentPeriod.sub}</div>}
              </div>
              <button onClick={() => setDismissedPeriods(p => new Set([...p, periodKey]))}
                className="text-blue-400 hover:text-blue-700 flex-shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[36px]" />
          )}
        </AnimatePresence>
      </div>

      {/* Window bound inputs */}
      <div className="flex items-end justify-between gap-2">
        <YearInput label="From" value={windowMin} onChange={updateWindowMin} otherValue={windowMax} isFrom={true} />
        <div className="flex-1 text-center">
          <div className="text-xs text-gray-500 font-medium">{formatYear(startVal)} → {formatYear(endVal)}</div>
          <div className="text-[10px] text-gray-400">{eventCount} events in range</div>
        </div>
        <YearInput label="To" value={windowMax} onChange={updateWindowMax} otherValue={windowMin} isFrom={false} />
      </div>

      {/* Dual-handle drag slider */}
      <div className="relative px-1">
        <DualRangeSlider
          min={windowMin}
          max={windowMax}
          start={startVal}
          end={endVal}
          onChange={onTimeRangeChange}
        />

        {/* Ticks */}
        <div className="relative h-6 mt-0.5">
          {ticks.map(t => {
            const p = pct(t);
            if (p < 0 || p > 100) return null;
            return (
              <div key={t} className="absolute flex flex-col items-center" style={{ left: `${p}%`, transform: "translateX(-50%)" }}>
                <div className="w-px h-2 bg-gray-400" />
                <span className="text-[9px] text-gray-400 whitespace-nowrap mt-0.5">{formatYearShort(t)}</span>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-1">
          <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-2 py-0.5 font-mono">
            tick scale: {tickScale.unit}
          </span>
        </div>
      </div>
    </div>
  );
}
