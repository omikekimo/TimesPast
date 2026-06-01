// ── TimesPast date utilities ─────────────────────────────────────────────────
// A pin date looks like:
// {
//   start: { year, month?, day?, hour?, minute?, bce?, precision },
//   end:   { same shape } | null
// }
// precision: "year" | "month" | "day" | "time"
//
// The timeline slider always works in signed integer years (BCE = negative).
// All conversion to/from that lives here.

export const PRECISION = {
  YEAR:  "year",
  MONTH: "month",
  DAY:   "day",
  TIME:  "time",
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

// ── Construct a blank datePart ───────────────────────────────────────────────
export function blankDatePart() {
  return { year: "", month: "", day: "", hour: "", minute: "", bce: false, precision: PRECISION.YEAR };
}

// ── Convert a datePart to a signed integer year (for the timeline) ───────────
export function datePartToYear(part) {
  if (!part) return 0;
  const y = parseInt(part.year, 10);
  if (isNaN(y)) return 0;
  return part.bce ? -Math.abs(y) : Math.abs(y);
}

// ── Convert old-style integer year to a minimal datePart ────────────────────
export function yearToDatePart(year) {
  if (year == null) return blankDatePart();
  const abs = Math.abs(year);
  return { year: abs, month: "", day: "", hour: "", minute: "", bce: year < 0, precision: PRECISION.YEAR };
}

// ── Migrate a legacy pin (has .year int, no .date) ──────────────────────────
export function migrateLegacyPin(pin) {
  if (pin.date) return pin; // already new format
  return {
    ...pin,
    date: { start: yearToDatePart(pin.year), end: null },
    // keep .year for timeline, it will be recomputed on save
  };
}

// ── Derive the integer .year from a pin's date object ───────────────────────
export function deriveYear(date) {
  if (!date?.start) return 0;
  return datePartToYear(date.start);
}

// ── Format a datePart for human display ─────────────────────────────────────
export function formatDatePart(part, opts = {}) {
  if (!part) return "Unknown date";
  const y = parseInt(part.year, 10);
  if (isNaN(y)) return "Unknown date";

  const era = part.bce ? " BCE" : " CE";

  switch (part.precision) {
    case PRECISION.TIME: {
      const mo  = part.month  ? MONTH_NAMES[part.month - 1]  : null;
      const dy  = part.day    ? part.day    : null;
      const hr  = part.hour   != null && part.hour   !== "" ? String(part.hour).padStart(2,"0")   : null;
      const mn  = part.minute != null && part.minute !== "" ? String(part.minute).padStart(2,"0") : "00";
      const time = hr != null ? ` ${hr}:${mn}` : "";
      if (mo && dy) return `${dy} ${mo} ${y}${era}${time}`;
      if (mo)       return `${mo} ${y}${era}${time}`;
      return `${y}${era}${time}`;
    }
    case PRECISION.DAY: {
      const mo = part.month ? MONTH_NAMES[part.month - 1] : null;
      const dy = part.day   ? part.day : null;
      if (mo && dy) return `${dy} ${mo} ${y}${era}`;
      if (mo)       return `${mo} ${y}${era}`;
      return `${y}${era}`;
    }
    case PRECISION.MONTH: {
      const mo = part.month ? MONTH_NAMES[part.month - 1] : null;
      return mo ? `${mo} ${y}${era}` : `${y}${era}`;
    }
    default:
      return `${y}${era}`;
  }
}

// ── Format a full pin date (start [→ end]) ───────────────────────────────────
export function formatPinDate(date) {
  if (!date) return "Unknown date";
  const start = formatDatePart(date.start);
  if (!date.end) return start;
  const end = formatDatePart(date.end);
  return `${start} → ${end}`;
}

// ── Parse a SPARQL ISO date string into a datePart ──────────────────────────
export function parseSparqlDate(isoString) {
  if (!isoString) return blankDatePart();
  // e.g. "1066-10-14T00:00:00Z" or "-0043-03-15T00:00:00Z"
  const match = isoString.match(/^(-?)(\d{1,4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return yearToDatePart(parseInt(isoString, 10));
  const [, neg, yr, mo, dy, hr, mn] = match;
  const bce  = neg === "-";
  const year = parseInt(yr, 10);
  const month  = parseInt(mo, 10);
  const day    = parseInt(dy, 10);
  const hasTime = hr != null;
  const hour   = hasTime ? parseInt(hr, 10) : "";
  const minute = hasTime ? parseInt(mn, 10) : "";

  let precision = PRECISION.YEAR;
  if (month && month > 0)  precision = PRECISION.MONTH;
  if (day   && day   > 0)  precision = PRECISION.DAY;
  if (hasTime)              precision = PRECISION.TIME;

  return { year, month: month || "", day: day || "", hour, minute, bce, precision };
}

// ── CSV serialise / deserialise ──────────────────────────────────────────────
// Format: DD/MM/YYYY, MM/YYYY, or YYYY (BCE stored as negative: -44)
export function dateToCsvString(date) {
  if (!date?.start) return "";
  const s = date.start;
  const y = s.bce ? -Math.abs(parseInt(s.year, 10)) : Math.abs(parseInt(s.year, 10));
  if (!y && y !== 0) return "";

  switch (s.precision) {
    case PRECISION.DAY:
    case PRECISION.TIME:
      if (s.day && s.month) return `${String(s.day).padStart(2,'0')}/${String(s.month).padStart(2,'0')}/${y}`;
      if (s.month)           return `${String(s.month).padStart(2,'0')}/${y}`;
      return `${y}`;
    case PRECISION.MONTH:
      if (s.month) return `${String(s.month).padStart(2,'0')}/${y}`;
      return `${y}`;
    default:
      return `${y}`;
  }
}

export function dateToCsvTimeString(date) {
  if (!date?.start) return "";
  const s = date.start;
  if (s.precision !== PRECISION.TIME) return "";
  if (s.hour === "" || s.hour == null) return "";
  return `${String(s.hour).padStart(2,'0')}:${String(s.minute ?? 0).padStart(2,'0')}`;
}

export function csvStringToDate(dateStr, timeStr = "") {
  if (!dateStr || !dateStr.trim()) return null;
  const str = dateStr.trim();

  let year, month, day, bce;

  // Try DD/MM/YYYY
  const full = str.match(/^(\d{1,2})\/(\d{1,2})\/(-?\d{1,6})$/);
  if (full) {
    day   = parseInt(full[1], 10);
    month = parseInt(full[2], 10);
    year  = parseInt(full[3], 10);
    bce   = year < 0;
    year  = Math.abs(year);
    const part = {
      year, month, day,
      hour: "", minute: "",
      bce,
      precision: PRECISION.DAY
    };
    // Add time if present
    if (timeStr && timeStr.trim()) {
      const tp = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (tp) {
        part.hour     = parseInt(tp[1], 10);
        part.minute   = parseInt(tp[2], 10);
        part.precision = PRECISION.TIME;
      }
    }
    return { start: part, end: null };
  }

  // Try MM/YYYY
  const monthYear = str.match(/^(\d{1,2})\/(-?\d{1,6})$/);
  if (monthYear) {
    month = parseInt(monthYear[1], 10);
    year  = parseInt(monthYear[2], 10);
    bce   = year < 0;
    year  = Math.abs(year);
    return { start: { year, month, day: "", hour: "", minute: "", bce, precision: PRECISION.MONTH }, end: null };
  }

  // Plain year
  const y = parseInt(str, 10);
  if (!isNaN(y)) {
    return { start: { year: Math.abs(y), month: "", day: "", hour: "", minute: "", bce: y < 0, precision: PRECISION.YEAR }, end: null };
  }

  return null;
}

function parseCsvPart(str) {
  if (!str) return blankDatePart();
  const [year, month, day, hour, minute, bce, precision] = str.split("|");
  return {
    year:      year      ? parseInt(year, 10)   : "",
    month:     month     ? parseInt(month, 10)  : "",
    day:       day       ? parseInt(day, 10)    : "",
    hour:      hour      ? parseInt(hour, 10)   : "",
    minute:    minute    ? parseInt(minute, 10) : "",
    bce:       bce === "1",
    precision: precision || PRECISION.YEAR,
  };
}
