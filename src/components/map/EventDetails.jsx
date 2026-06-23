import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Calendar, MapPin, Plus, Grab, ChevronLeft, ChevronRight, Link, Unlink, Search, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatPinDate, migrateLegacyPin } from "@/lib/dateUtils";
import ImageViewer, { isImageUrl } from "@/components/ui/ImageViewer";

const categoryColors = {
  war:              "bg-red-100 text-red-800",
  politics:         "bg-purple-100 text-purple-800",
  culture:          "bg-green-100 text-green-800",
  science:          "bg-blue-100 text-blue-800",
  natural_disaster: "bg-orange-100 text-orange-800",
  economics:        "bg-yellow-100 text-yellow-800",
  religion:         "bg-indigo-100 text-indigo-800",
  exploration:      "bg-cyan-100 text-cyan-800",
  person:           "bg-amber-100 text-amber-800",
};

const significanceColors = {
  local:    "bg-gray-100 text-gray-800",
  regional: "bg-blue-100 text-blue-800",
  national: "bg-green-100 text-green-800",
  global:   "bg-purple-100 text-purple-800",
};

// Migrate old wikipedia_url to links array
function getLinks(event) {
  if (event.links?.length) return event.links;
  if (event.wikipedia_url) return [{ label: 'Wikipedia', url: event.wikipedia_url }];
  return [];
}

export default function EventDetails({
  event,
  allEvents = [],
  onClose,
  onAddToComparison,
  onNavigate,
  onEditEvent,
  className,
}) {
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [viewingImage, setViewingImage]       = useState(false);

  const migrated = migrateLegacyPin(event);
  const links    = getLinks(event);

  // Group navigation
  const groupEvents = event.search_group
    ? allEvents.filter(e => e.search_group === event.search_group).sort((a, b) => a.year - b.year)
    : [];
  const groupIdx  = groupEvents.findIndex(e => e.id === event.id);
  const prevEvent = groupIdx > 0 ? groupEvents[groupIdx - 1] : null;
  const nextEvent = groupIdx < groupEvents.length - 1 ? groupEvents[groupIdx + 1] : null;

  const allGroups = [...new Set(allEvents.filter(e => e.search_group).map(e => e.search_group))];

  const handleRemoveFromGroup = () => {
    onEditEvent(event.id, { search_group: null, search_color: null });
  };

  const handleJoinGroup = (groupId) => {
    const rep = allEvents.find(e => e.search_group === groupId);
    onEditEvent(event.id, { search_group: groupId, search_color: rep?.search_color || null });
    setShowGroupEditor(false);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className={className}>
      <Card className="w-96 max-h-[85vh] overflow-y-auto elegant-shadow bg-white border-0 dark:bg-gray-800">
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
                  <span className="w-3 h-3 rounded-full self-center flex-shrink-0 border border-white shadow-sm"
                    style={{ backgroundColor: event.search_color }} title="Timeline group" />
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

          {/* ── Image ── */}
          {event.image_url && (
            <div className="relative group rounded-lg overflow-hidden border border-gray-100">
              <img
                src={event.image_url}
                alt={event.title}
                style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }}
              />
              <button
                onClick={() => setViewingImage(true)}
                className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"
              >
                <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </button>
            </div>
          )}

          {/* Image viewer */}
          {viewingImage && event.image_url && (
            <ImageViewer
              imageUrl={event.image_url}
              title={event.title}
              onClose={() => setViewingImage(false)}
            />
          )}

          {/* ── Date + location ── */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-700">{formatPinDate(migrated.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <span className="text-gray-700">{event.latitude?.toFixed(2)}, {event.longitude?.toFixed(2)}</span>
            </div>
          </div>

          {/* ── Description ── */}
          {event.description && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Description</h4>
              <p className="text-gray-700 text-sm leading-relaxed">{event.description}</p>
            </div>
          )}

          {/* ── Source ── */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-1 text-sm">Source</h4>
            <p className="text-gray-600 text-sm">{event.source || "Historical database"}</p>
          </div>

          {/* ── Links ── */}
          {links.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-sm">Links</h4>
              <div className="space-y-1.5">
                {links.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                    {link.label || link.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Timeline group navigation ── */}
          {groupEvents.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Timeline Group ({groupIdx + 1} / {groupEvents.length})
                </span>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: event.search_color || "#6b7280" }} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs"
                  disabled={!prevEvent} onClick={() => prevEvent && onNavigate(prevEvent)}>
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  {prevEvent ? (prevEvent.year < 0 ? `${Math.abs(prevEvent.year)} BCE` : prevEvent.year) : "—"}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs"
                  disabled={!nextEvent} onClick={() => nextEvent && onNavigate(nextEvent)}>
                  {nextEvent ? (nextEvent.year < 0 ? `${Math.abs(nextEvent.year)} BCE` : nextEvent.year) : "—"}
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-0.5 mt-1">
                {groupEvents.map((ge, i) => (
                  <button key={ge.id} onClick={() => ge.id !== event.id && onNavigate(ge)}
                    className={`w-full text-left text-xs px-2 py-1 rounded transition-colors ${
                      ge.id === event.id
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "hover:bg-gray-100 text-gray-600"
                    }`}>
                    {i + 1}. {ge.title} ({ge.year < 0 ? `${Math.abs(ge.year)} BCE` : ge.year})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Connections editor ── */}
          {onEditEvent && (
            <div className="border border-dashed border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connections</span>
                <button className="text-xs text-blue-500 hover:text-blue-700"
                  onClick={() => setShowGroupEditor(v => !v)}>
                  {showGroupEditor ? "done" : "edit"}
                </button>
              </div>
              {!showGroupEditor ? (
                <p className="text-xs text-gray-400">
                  {event.search_group
                    ? `In timeline group · ${groupEvents.length} pin${groupEvents.length !== 1 ? "s" : ""}`
                    : "Not in any timeline group"}
                </p>
              ) : (
                <div className="space-y-2">
                  {event.search_group && (
                    <button onClick={handleRemoveFromGroup}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 w-full">
                      <Unlink className="w-3.5 h-3.5" /> Remove from timeline group
                    </button>
                  )}
                  {allGroups.filter(g => g !== event.search_group).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Join a timeline group:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {allGroups.filter(g => g !== event.search_group).map(gid => {
                          const rep   = allEvents.find(e => e.search_group === gid);
                          const count = allEvents.filter(e => e.search_group === gid).length;
                          return (
                            <button key={gid} onClick={() => handleJoinGroup(gid)}
                              className="flex items-center gap-2 w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-100">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: rep?.search_color || "#6b7280" }} />
                              <span className="truncate text-gray-700">{rep?.title || gid}</span>
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

          {/* ── Actions ── */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Button onClick={() => onAddToComparison(event)} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Add to Comparison
            </Button>
          </div>

          {/* ── Historical context ── */}
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
