import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, X, Crosshair } from "lucide-react";
import DatePartPicker from "@/components/ui/DatePartPicker";
import { blankDatePart, datePartToYear, PRECISION } from "@/lib/dateUtils";

const PIN_TYPES = [
  { value: "event",         label: "Event" },
  { value: "person",        label: "Person" },
  { value: "place",         label: "Place" },
  { value: "object",        label: "Object" },
  { value: "weather_event", label: "Weather Event" },
];

const CATEGORIES_BY_TYPE = {
  event:         ["war", "politics", "culture", "science", "natural_disaster", "economics", "religion", "exploration"],
  person:        ["person"],
  place:         ["culture", "religion", "politics", "exploration"],
  object:        ["science", "culture", "economics", "religion"],
  weather_event: ["natural_disaster"],
};

const SIGNIFICANCES = ["local", "regional", "national", "global"];

const emptyPin = () => ({
  pinType:      "event",
  title:        "",
  category:     "culture",
  significance: "local",
  description:  "",
  latitude:     "",
  longitude:    "",
});

const emptyDate = () => ({
  start: blankDatePart(),
  end:   null,
});

// Labels for start/end date fields per pin type
function dateLabelConfig(pinType) {
  switch (pinType) {
    case "person":       return { start: "Date of Birth", end: "Date of Death" };
    case "place":        return { start: "Founded / Established", end: "Dissolved / Abandoned" };
    case "object":       return { start: "Created", end: "Destroyed / Lost" };
    case "weather_event":return { start: "Start Date", end: "End Date" };
    default:             return { start: "Date", end: "End Date (if range)" };
  }
}

export default function AddPinForm({ onAdd, pickingLocation, onStartPickLocation, groups = [] }) {
  const [open, setOpen]                   = useState(false);
  const [pin, setPin]                     = useState(emptyPin);
  const [date, setDate]                   = useState(emptyDate);
  const [showEndDate, setShowEndDate]     = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [error, setError]                 = useState(null);
  const [saving, setSaving]               = useState(false);

  const set = (k, v) => setPin(p => ({ ...p, [k]: v }));

  const handleTypeChange = (type) => {
    const cats = CATEGORIES_BY_TYPE[type];
    set("pinType", type);
    set("category", cats[0]);
    // People always show end date (death)
    setShowEndDate(type === "person");
  };

  useEffect(() => {
    if (pickingLocation?.lat != null) {
      set("latitude",  pickingLocation.lat.toFixed(5));
      set("longitude", pickingLocation.lng.toFixed(5));
    }
  }, [pickingLocation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("submit fired", pin, date);

    if (!pin.title.trim())                            { setError("Title is required"); return; }
    if (pin.latitude === "" || pin.longitude === "")  { setError("Please pick a location on the map"); return; }
    const lat = parseFloat(pin.latitude);
    const lon = parseFloat(pin.longitude);
    if (isNaN(lat) || lat < -90  || lat > 90)         { setError("Invalid latitude");  return; }
    if (isNaN(lon) || lon < -180 || lon > 180)        { setError("Invalid longitude"); return; }


    setError(null);
    setSaving(true);

    const category = pin.pinType === "person"
      ? "person"
      : pin.pinType === "weather_event"
      ? "natural_disaster"
      : pin.category;

    const group = groups.find(g => g.id === selectedGroupId);

    // Derive integer year for timeline slider
    const year = datePartToYear(date.start);

    const finalDate = {
      start: date.start,
      end:   showEndDate ? (date.end || null) : null,
    };

    await onAdd({
      title:        pin.title,
      year,                     // integer for timeline
      date:         finalDate,  // full resolution date object
      latitude:     lat,
      longitude:    lon,
      category,
      significance: pin.significance,
      description:  pin.description,
      ...(group ? { search_group: group.id, search_query: group.name, search_color: group.color } : {}),
    });

    setSaving(false);
    setPin(emptyPin());
    setDate(emptyDate());
    setShowEndDate(false);
    setSelectedGroupId("");
    setOpen(false);
  };

  const categories  = CATEGORIES_BY_TYPE[pin.pinType] || CATEGORIES_BY_TYPE.event;
  const dateLabels  = dateLabelConfig(pin.pinType);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full gap-2 text-xs">
        <Plus className="w-3.5 h-3.5" /> Add Pin
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-xs">
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-gray-700 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-blue-500" /> New Pin
        </span>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pin type */}
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Type</label>
        <div className="flex flex-wrap gap-1">
          {PIN_TYPES.map(t => (
            <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
              className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors ${
                pin.pinType === t.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <input
        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="Title *" value={pin.title}
        onChange={e => set("title", e.target.value)} />

      {/* Start date */}
      <div className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
        <DatePartPicker
          label={dateLabels.start}
          value={date.start}
          onChange={v => setDate(d => ({ ...d, start: v }))}
          allowClear={false}
        />
      </div>

      {/* End date toggle + picker */}
      <div className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            {dateLabels.end}
          </span>
          <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showEndDate}
              onChange={e => setShowEndDate(e.target.checked)}
              className="accent-blue-500 w-3 h-3" />
            Include
          </label>
        </div>
        {showEndDate && (
          <DatePartPicker
            value={date.end}
            onChange={v => setDate(d => ({ ...d, end: v }))}
          />
        )}
      </div>

      {/* Location */}
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Location *</label>
        <div className="flex gap-2 items-center">
          <button type="button" onClick={onStartPickLocation}
            className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium transition-colors flex-shrink-0 ${
              pickingLocation?.active
                ? "bg-blue-600 text-white border-blue-600 animate-pulse"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
            }`}>
            <Crosshair className="w-3 h-3" />
            {pickingLocation?.active ? "Click map…" : "Pick on map"}
          </button>
          {pin.latitude && pin.longitude ? (
            <span className="text-[10px] text-gray-500 truncate">
              {parseFloat(pin.latitude).toFixed(3)}, {parseFloat(pin.longitude).toFixed(3)}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 italic">No location set</span>
          )}
        </div>
      </div>

      {/* Category / significance */}
      {pin.pinType !== "person" && pin.pinType !== "weather_event" && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-0.5 block">Category</label>
            <select className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              value={pin.category} onChange={e => set("category", e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 mb-0.5 block">Significance</label>
            <select className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              value={pin.significance} onChange={e => set("significance", e.target.value)}>
              {SIGNIFICANCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {pin.pinType === "weather_event" && (
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Significance</label>
          <select className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            value={pin.significance} onChange={e => set("significance", e.target.value)}>
            {SIGNIFICANCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <textarea
        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
        placeholder="Description (optional)" rows={2}
        value={pin.description} onChange={e => set("description", e.target.value)} />

      {/* Group */}
      {groups.length > 0 && (
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Add to timeline group (optional)</label>
          <select className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
            <option value="">— no group —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      )}

      {error && <p className="text-red-500 text-[10px]">{error}</p>}

      <Button type="submit" size="sm" disabled={saving} className="w-full text-xs">
        {saving ? "Saving…" : "Place Pin"}
      </Button>
    </form>
  );
}
