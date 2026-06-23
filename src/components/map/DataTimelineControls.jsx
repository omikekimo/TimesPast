import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Grab, Layers, TableProperties, Trash2, FolderPlus } from "lucide-react";
import AddPinForm from "./AddPinForm";
import { motion } from "framer-motion";
import EventLayerPanel from "./EventLayerPanel";
import EventSpreadsheetPanel from "./EventSpreadsheetPanel";
import TimelineSlider from "./TimelineSlider";

export default function DataTimelineControls({
  timeRange,
  onTimeRangeChange,
  eventCount,
  events = [],
  hiddenEventIds,
  lockedEventIds,
  onToggleVisible,
  onToggleLock,
  onDeleteEvent,
  onHoverEvent,
  onImportEvents,
  onAddPin,
  onEditEvent,
  onSelectEvent,
  pickingLocation,
  onStartPickLocation,
  onClearAll,
  groups = [],
  onCreateGroup,
  className,
  onRenameGroup,
  notes = [],
  onSelectNote,

}) {
  const [rightTab, setRightTab] = useState("layers"); // "layers" | "spreadsheet"
  const visibleCount = events.filter(e => !hiddenEventIds?.has(e.id)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className={`elegant-shadow bg-white/95 backdrop-blur-sm border-0 ${rightTab === "spreadsheet" ? "w-[90rem]" : "w-[58rem]"}`}
        style={{ transition: "width 0.3s ease" }}
      >
        <CardHeader className="pb-2 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-700" />
              <span className="font-bold text-lg text-gray-900">Timeline & Data</span>
            </div>
            <div className="flex items-center gap-2">
              {onCreateGroup && (
                <button
                  onClick={onCreateGroup}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors"
                  title="Create a new group"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> New Timeline Group
                </button>
              )}
              {onClearAll && (
                <button
                  onClick={onClearAll}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                  title="Delete all pins"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              )}
              <Grab className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-row gap-6">
          {/* ── Left: Timeline ── */}
          <div className="flex-[3] space-y-3 min-w-0">
            <TimelineSlider
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              eventCount={eventCount}
            />

            {/* Add Pin */}
            <div className="pt-1">
              <AddPinForm
                onAdd={onAddPin}
                pickingLocation={pickingLocation}
                onStartPickLocation={onStartPickLocation}
                groups={groups}
              />
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="w-px bg-gray-200 flex-shrink-0" />

          {/* ── Right: tabs ── */}
          <div className={`flex flex-col gap-2 min-w-0 ${rightTab === "spreadsheet" ? "flex-[5]" : "flex-[2]"}`}
            style={{ transition: "flex 0.3s ease" }}
          >
            {/* Tab header */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setRightTab("layers")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    rightTab === "layers"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> Layers
                </button>
                <button
                  onClick={() => setRightTab("spreadsheet")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    rightTab === "spreadsheet"
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <TableProperties className="w-3.5 h-3.5" /> Spreadsheet
                </button>
              </div>
              <Badge variant="secondary" className="text-xs">{visibleCount} visible</Badge>
            </div>

            {/* Tab body */}
            {rightTab === "layers" && (
              <>
                <div className="text-xs text-gray-400 flex items-center px-2">
                  <span className="ml-auto">👁 🔒 🗑</span>
                </div>
                <EventLayerPanel
                  events={events}
                  notes={notes}
                  onSelectNote={onSelectNote}
                  hiddenEventIds={hiddenEventIds}
                  lockedEventIds={lockedEventIds}
                  onToggleVisible={onToggleVisible}
                  onToggleLock={onToggleLock}
                  onDeleteEvent={onDeleteEvent}
                  onHoverEvent={onHoverEvent}
                  onEditEvent={onEditEvent}
                  onSelectEvent={onSelectEvent}
                  pickingLocation={pickingLocation}
                  onStartPickLocation={onStartPickLocation}
                  groups={groups}        // <-- add this one line
                  onRenameGroup={onRenameGroup}
                />
              </>
            )}

            {rightTab === "spreadsheet" && (
              <EventSpreadsheetPanel
                events={events}
                onImportEvents={onImportEvents}
                onEditEvent={onEditEvent}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
