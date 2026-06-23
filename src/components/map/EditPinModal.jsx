import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Save, Crosshair, Plus, Trash2 } from "lucide-react";
import { blankDatePart, datePartToYear, yearToDatePart, migrateLegacyPin } from "@/lib/dateUtils";
import DatePartPicker from "@/components/ui/DatePartPicker";

const CATEGORIES    = ["war", "politics", "culture", "science", "natural_disaster", "economics", "religion", "exploration", "person"];
const SIGNIFICANCES = ["local", "regional", "national", "global"];

// Migrate old wikipedia_url to links array
function getInitialLinks(event) {
  if (event.links?.length) return event.links;
  if (event.wikipedia_url) return [{ label: 'Wikipedia', url: event.wikipedia_url }];
  return [];
}

export default function EditPinModal({ event, onSave, onClose, pickingLocation, onStartPickLocation, groups = [] }) {
  const migrated = migrateLegacyPin(event);

  const [form, setForm] = useState({
    title:        migrated.title        ?? "",
    latitude:     migrated.latitude     ?? "",
    longitude:    migrated.longitude    ?? "",
    category:     migrated.category     ?? "culture",
    significance: migrated.significance ?? "local",
    description:  migrated.description  ?? "",
    search_query: migrated.search_query ?? "",
  });

  const [date, setDate]               = useState({
    start: migrated.date?.start || blankDatePart(),
    end:   migrated.date?.end   || null,
  });
  const [showEndDate, setShowEndDate] = useState(!!migrated.date?.end);
  const [selectedGroupId, setSelectedGroupId] = useState(migrated.search_group ?? "");
  const [links, setLinks]             = useState(getInitialLinks(event));
  const [saving, setSaving]           = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // When map pick completes, populate lat/lng
  useEffect(() => {
    if (pickingLocation?.lat != null && pickingLocation?.lng != null) {
      set("latitude",  pickingLocation.lat.toFixed(5));
      set("longitude", pickingLocation.lng.toFixed(5));
    }
  }, [pickingLocation?.lat, pickingLocation?.lng]);

  // Links helpers
  const addLink    = () => setLinks(prev => [...prev, { label: '', url: '' }]);
  const removeLink = (i) => setLinks(prev => prev.filter((_, idx) => idx !== i));
  const updateLink = (i, field, val) =>
    setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const group = groups.find(g => g.id === selectedGroupId);
    const year  = datePartToYear(date.start);
    const finalDate = { start: date.start, end: showEndDate ? (date.end || null) : null };

    // Keep wikipedia_url populated from first link for CSV backwards compat
    const wikipedia_url = links[0]?.url || '';

    await onSave(event.id, {
      ...form,
      year,
      date:         finalDate,
      latitude:     parseFloat(form.latitude),
      longitude:    parseFloat(form.longitude),
      links:        links.filter(l => l.url.trim()),
      wikipedia_url,
      search_group: group ? group.id    : null,
      search_query: group ? group.name  : form.search_query,
      search_color: group ? group.color : null,
    });

    setSaving(false);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[3000] flex items-center justify-center transition-opacity ${
        pickingLocation?.active ? "opacity-0 pointer-events-none" : "bg-black/40"
      }`}
      onClick={onClose}
    >
      <div className="bg-white rounded-xl shadow-2xl p-5 w-[380px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-sm">Edit Pin</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">

          {/* Title */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Title *</label>
            <input className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              value={form.title} onChange={e => set("title", e.target.value)} required />
          </div>

          {/* Date */}
          <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
            <DatePartPicker label="Date" value={date.start}
              onChange={v => setDate(d => ({ ...d, start: v }))} allowClear={false} />
          </div>
          <div className="border border-gray-200 rounded-lg p-2 bg-gray-50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">End Date</span>
              <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                <input type="checkbox" checked={showEndDate}
                  onChange={e => setShowEndDate(e.target.checked)} className="accent-blue-500 w-3 h-3" />
                Include
              </label>
            </div>
            {showEndDate && (
              <DatePartPicker value={date.end} onChange={v => setDate(d => ({ ...d, end: v }))} />
            )}
          </div>

          {/* Location picker */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1">Location</label>
            <div className="flex gap-2 items-center mb-1.5">
              {onStartPickLocation && (
                <button type="button" onClick={onStartPickLocation}
                  className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium transition-colors flex-shrink-0 ${
                    pickingLocation?.active
                      ? "bg-blue-600 text-white border-blue-600 animate-pulse"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}>
                  <Crosshair className="w-3 h-3" />
                  {pickingLocation?.active ? "Click map…" : "Pick on map"}
                </button>
              )}
              <span className="text-[10px] text-gray-400">
                {form.latitude && form.longitude
                  ? `${parseFloat(form.latitude).toFixed(3)}, ${parseFloat(form.longitude).toFixed(3)}`
                  : "No location set"}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 block mb-0.5">Latitude</label>
                <input type="number" step="any"
                  className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={form.latitude} onChange={e => set("latitude", e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 block mb-0.5">Longitude</label>
                <input type="number" step="any"
                  className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={form.longitude} onChange={e => set("longitude", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Category + Significance */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 block mb-0.5">Category</label>
              <select className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 block mb-0.5">Significance</label>
              <select className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                value={form.significance} onChange={e => set("significance", e.target.value)}>
                {SIGNIFICANCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Description</label>
            <textarea rows={3}
              className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
              value={form.description} onChange={e => set("description", e.target.value)} />
          </div>

          {/* Links — multiple */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-gray-500">Links</label>
              <button type="button" onClick={addLink}
                className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700">
                <Plus className="w-3 h-3" /> Add link
              </button>
            </div>
            {links.length === 0 && (
              <p className="text-[10px] text-gray-400 italic">No links added yet</p>
            )}
            {links.map((link, i) => (
              <div key={i} className="flex gap-1 mb-1.5 items-start">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <input placeholder="Label (e.g. Wikipedia)"
                    className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} />
                  <input placeholder="https://..."
                    className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={link.url} onChange={e => updateLink(i, 'url', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeLink(i)}
                  className="mt-1 p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Timeline Group */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Timeline Group</label>
            <select className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
              <option value="">— no group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {selectedGroupId && (() => {
              const g = groups.find(x => x.id === selectedGroupId);
              return g ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                  <span className="text-[10px] text-gray-400">{g.name}</span>
                </div>
              ) : null;
            })()}
          </div>

          <Button type="submit" size="sm" disabled={saving} className="w-full gap-2">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </div>
    </div>
  );
}
