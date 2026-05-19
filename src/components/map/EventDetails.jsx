import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Calendar, MapPin, Plus, Grab, ChevronLeft, ChevronRight, Link, Unlink, Search } from "lucide-react";
import { motion } from "framer-motion";
import { formatPinDate, migrateLegacyPin } from "@/lib/dateUtils";


const categoryColors = {
  war: "bg-red-100 text-red-800",
  politics: "bg-purple-100 text-purple-800",
  culture: "bg-green-100 text-green-800",
  science: "bg-blue-100 text-blue-800",
  natural_disaster: "bg-orange-100 text-orange-800",
  economics: "bg-yellow-100 text-yellow-800",
  religion: "bg-indigo-100 text-indigo-800",
  exploration: "bg-cyan-100 text-cyan-800",
  person: "bg-amber-100 text-amber-800",
};

const significanceColors = {
  local: "bg-gray-100 text-gray-800",
  regional: "bg-blue-100 text-blue-800",
  national: "bg-green-100 text-green-800",
  global: "bg-purple-100 text-purple-800",
};

export default function EventDetails({
  event,
  allEvents = [],
  onClose,
  onAddToComparison,
  onNavigate,      // (event) => void — called when prev/next pressed
  onEditEvent,     // (id, data) => void — for group edits
  className,
}) {
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [wikiStatus, setWikiStatus] = useState(null); // null | 'exists' | 'missing' | 'checking'

  // Determine Wikipedia link status for this event
  useEffect(() => {
    setWikiStatus('checking');

    // If the event already has a verified wikipedia_url (e.g. from SPARQL), use it directly
    if (event.wikipedia_url) {
      setWikiStatus('exists');
      return;
    }

    // Otherwise probe using the search_query (or title as fallback)
    const term = event.search_query || event.title;
    const encodedTerm = encodeURIComponent(term.replace(/ /g, '_'));
    const url = `https://en.wikipedia.org/wiki/${encodedTerm}`;

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTerm}`)
      .then(res => {
        if (res.ok) {
          setWikiStatus('exists');
        } else {
          setWikiStatus('missing');
        }
      })
      .catch(() => setWikiStatus('missing'));
  }, [event.id, event.wikipedia_url, event.search_query, event.title]);

  // Build the sorted group this event belongs to
  const groupEvents = event.search_group
    ? allEvents
        .filter(e => e.search_group === event.search_group)
        .sort((a, b) => a.year - b.year)
    : [];

  const groupIdx = groupEvents.findIndex(e => e.id === event.id);
  const prevEvent = groupIdx > 0 ? groupEvents[groupIdx - 1] : null;
  const nextEvent = groupIdx < groupEvents.length - 1 ? groupEvents[groupIdx + 1] : null;

  // All distinct groups in allEvents (for reassigning)
  const allGroups = [...new Set(allEvents.filter(e => e.search_group).map(e => e.search_group))];

  const handleRemoveFromGroup = () => {
    onEditEvent(event.id, { search_group: null, search_color: null });
  };

  const handleJoinGroup = (groupId) => {
    const representative = allEvents.find(e => e.search_group === groupId);
    onEditEvent(event.id, {
      search_group: groupId,
      search_color: representative?.search_color || null,
    });
    setShowGroupEditor(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={className}
    >
      <Card className="w-96 max-h-[85vh] overflow-y-auto elegant-shadow bg-white border-0 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-2">
              <h3 className="font-bold text-xl text-gray-900 dark:text-gray-100 leading-tight mb-2">
                {event.title}
              </h3>
              <div className="flex gap-2 flex-wrap">
                <Badge className={categoryColors[event.category] || "bg-gray-100 text-gray-800"}>
                  {event.category?.replace(/_/g, ' ')}
                </Badge>
                {event.significance && (
                  <Badge className={significanceColors[event.significance]}>
                    {event.significance} impact
                  </Badge>
                )}
                {event.search_color && (
                  <span
                    className="w-3 h-3 rounded-full self-center flex-shrink-0 border border-white shadow-sm"
                    style={{ backgroundColor: event.search_color }}
                    title="Search group"
                  />
                )}
              </div>
            </div>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </Button>
              <Grab className="w-4 h-4 text-gray-400 ml-2" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
             <span className="text-gray-700">{formatPinDate(migrateLegacyPin(event).date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="text-gray-700">{event.latitude?.toFixed(2)}, {event.longitude?.toFixed(2)}</span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
              <p className="text-gray-700 text-sm leading-relaxed">{event.description}</p>
            </div>
          )}

          {/* Source */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Source</h4>
            <p className="text-gray-600 text-sm">{event.source || "Historical database"}</p>
          </div>

          {/* ── Polyline group navigation ── */}
          {groupEvents.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Group ({groupIdx + 1} / {groupEvents.length})
                </span>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: event.search_color || "#6b7280" }} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={!prevEvent}
                  onClick={() => prevEvent && onNavigate(prevEvent)}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  {prevEvent ? prevEvent.year < 0 ? `${Math.abs(prevEvent.year)} BCE` : `${prevEvent.year}` : "—"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={!nextEvent}
                  onClick={() => nextEvent && onNavigate(nextEvent)}
                >
                  {nextEvent ? nextEvent.year < 0 ? `${Math.abs(nextEvent.year)} BCE` : `${nextEvent.year}` : "—"}
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
              {/* Group event list */}
              <div className="max-h-28 overflow-y-auto space-y-0.5 mt-1">
                {groupEvents.map((ge, i) => (
                  <button
                    key={ge.id}
                    onClick={() => ge.id !== event.id && onNavigate(ge)}
                    className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                      ge.id === event.id
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}
                  >
                    {i + 1}. {ge.title} ({ge.year < 0 ? `${Math.abs(ge.year)} BCE` : ge.year})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Group editor ── */}
          {onEditEvent && (
            <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connections</span>
                <button
                  className="text-xs text-blue-500 hover:text-blue-700"
                  onClick={() => setShowGroupEditor(v => !v)}
                >
                  {showGroupEditor ? "done" : "edit"}
                </button>
              </div>

              {!showGroupEditor ? (
                <p className="text-xs text-gray-400">
                  {event.search_group
                    ? `Connected to group · ${groupEvents.length} pin${groupEvents.length !== 1 ? "s" : ""}`
                    : "Not connected to any group"}
                </p>
              ) : (
                <div className="space-y-2">
                  {event.search_group && (
                    <button
                      onClick={handleRemoveFromGroup}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 w-full"
                    >
                      <Unlink className="w-3.5 h-3.5" /> Remove from current group
                    </button>
                  )}
                  {allGroups.filter(g => g !== event.search_group).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Join a group:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {allGroups.filter(g => g !== event.search_group).map(gid => {
                          const rep = allEvents.find(e => e.search_group === gid);
                          const count = allEvents.filter(e => e.search_group === gid).length;
                          const firstTitle = rep?.title || gid;
                          return (
                            <button
                              key={gid}
                              onClick={() => handleJoinGroup(gid)}
                              className="flex items-center gap-2 w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100"
                            >
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: rep?.search_color || "#6b7280" }} />
                              <span className="truncate text-gray-700">{firstTitle}</span>
                              <span className="ml-auto text-gray-400 flex-shrink-0">{count} pins</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Button onClick={() => onAddToComparison(event)} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add to Comparison
            </Button>
            {wikiStatus === 'exists' && (
              <Button
                variant="outline"
                onClick={() => {
                  const term = event.search_query || event.title;
                  const url = event.wikipedia_url || `https://en.wikipedia.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`;
                  window.open(url, '_blank');
                }}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" /> View on Wikipedia
              </Button>
            )}
            {wikiStatus === 'missing' && (
              <Button
                variant="outline"
                onClick={() => {
                  const term = event.search_query || event.title;
                  window.open(`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(term)}`, '_blank');
                }}
                className="w-full"
              >
                <Search className="w-4 h-4 mr-2" /> Search Wikipedia
              </Button>
            )}
          </div>

          {/* Historical context */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="font-semibold text-gray-900 mb-2 text-sm">Historical Context</h4>
            <p className="text-xs text-gray-600">
              This {event.significance}-level {event.category?.replace(/_/g, ' ')} event occurred in{" "}
              {event.year < 0 ? `${Math.abs(event.year)} BCE` : `${event.year} CE`}, during the{" "}
              {event.year < 500 ? "Ancient" : event.year < 1500 ? "Medieval" : event.year < 1800 ? "Renaissance" : event.year < 1950 ? "Industrial" : "Modern"} period.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
