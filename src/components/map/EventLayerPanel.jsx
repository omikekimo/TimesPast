import React, { useState } from "react";
import { Eye, EyeOff, Lock, Unlock, Trash2, Layers, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import EditPinModal from "./EditPinModal";

const categoryColors = {
  war:              { bg: "#dc2626", label: "War" },
  politics:         { bg: "#7c3aed", label: "Politics" },
  culture:          { bg: "#059669", label: "Culture" },
  science:          { bg: "#2563eb", label: "Science" },
  natural_disaster: { bg: "#ea580c", label: "Disaster" },
  economics:        { bg: "#ca8a04", label: "Economics" },
  religion:         { bg: "#9333ea", label: "Religion" },
  exploration:      { bg: "#0891b2", label: "Exploration" },
  person:           { bg: "#f59e0b", label: "Person" },
};

function GroupHeader({ groupName, color, count, collapsed, onToggle, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(groupName);

  // Keep draft in sync if parent renames the group externally
  React.useEffect(() => { setDraft(groupName); }, [groupName]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== groupName) onRename(draft.trim());
  };

  return (
    <div className="flex items-center gap-1.5 px-1 py-1 mt-1 first:mt-0">
      <button onClick={onToggle} className="flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors">
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {editing ? (
        <input
          autoFocus
          className="flex-1 text-xs font-semibold border-b border-blue-400 bg-transparent outline-none text-gray-800"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditing(false); setDraft(groupName); }
          }}
        />
      ) : (
        <span className="flex-1 text-xs font-semibold text-gray-700 truncate">{groupName}</span>
      )}
      <button
        onClick={() => { setDraft(groupName); setEditing(e => !e); }}
        className="p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
        title="Rename group"
      >
        <Pencil className="w-3 h-3 text-gray-400 hover:text-blue-500" />
      </button>
      <span className="text-[9px] text-gray-400 flex-shrink-0">{count}</span>
    </div>
  );
}

export default function EventLayerPanel({
  events,
  hiddenEventIds,
  lockedEventIds,
  onToggleVisible,
  onToggleLock,
  onDeleteEvent,
  onHoverEvent,
  onEditEvent,
  onSelectEvent,
  pickingLocation,
  onStartPickLocation,
  groups = [],            // full groups array so modal can show current names
  onRenameGroup,
}) {
  const [editingEvent, setEditingEvent] = useState(null);
  const [collapsed, setCollapsed]       = useState({});

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No events in current view</p>
      </div>
    );
  }

  // Build groups from events
  const groupList = [];
  const groupMap  = {};
  events.forEach(event => {
  const key = event.search_group || "__ungrouped__";
  if (!groupMap[key]) {
    groupMap[key] = {
      key,
      name:   event.search_query || (key === "__ungrouped__" ? "Ungrouped" : key),
      color:  event.search_color || "#6b7280",
      events: [],
    };
    groupList.push(groupMap[key]);
  }
  groupMap[key].events.push(event);
});

// Sort each group's events chronologically
groupList.forEach(g => {
  g.events.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
});

  const handleRenameGroup = (groupKey, newName) => {
  onRenameGroup?.(groupKey, newName);
  };

  const EventRow = ({ event }) => {
    const cat      = categoryColors[event.category] || { bg: "#6b7280", label: event.category };
    const isHidden = hiddenEventIds.has(event.id);
    const isLocked = lockedEventIds.has(event.id);

    return (
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer
          ${isHidden ? "opacity-40" : "opacity-100"}
          hover:bg-gray-50 border-transparent hover:border-gray-200`}
        onMouseEnter={() => onHoverEvent(event.id)}
        onMouseLeave={() => onHoverEvent(null)}
        onClick={(e) => { if (e.target.closest('button')) return; onSelectEvent?.(event); }}
        title="Click to select on map"
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: event.search_color || cat.bg }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{event.title}</p>
          <p className="text-[10px] text-gray-400">
            {event.year < 0 ? `${Math.abs(event.year)} BCE` : `${event.year} CE`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onToggleVisible(event.id)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            title={isHidden ? "Show" : "Hide"}>
            {isHidden
              ? <EyeOff className="w-3.5 h-3.5 text-gray-400" />
              : <Eye    className="w-3.5 h-3.5 text-gray-600" />}
          </button>
          <button onClick={() => onToggleLock(event.id)}
            className="p-1 rounded hover:bg-gray-200 transition-colors"
            title={isLocked ? "Unlock" : "Lock"}>
            {isLocked
              ? <Lock   className="w-3.5 h-3.5 text-amber-500" />
              : <Unlock className="w-3.5 h-3.5 text-gray-400" />}
          </button>
          <button onClick={() => setEditingEvent(event)}
            className="p-1 rounded hover:bg-blue-100 transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5 text-blue-400 hover:text-blue-600" />
          </button>
          <button
            onClick={() => !isLocked && onDeleteEvent(event.id)}
            className={`p-1 rounded transition-colors ${isLocked ? "cursor-not-allowed opacity-30" : "hover:bg-red-100"}`}
            title={isLocked ? "Unlock to delete" : "Delete"}>
            <Trash2 className={`w-3.5 h-3.5 ${isLocked ? "text-gray-300" : "text-red-400 hover:text-red-600"}`} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
      {groupList.map(group => {
        const isCollapsed = collapsed[group.key];
        const showHeader  = groupList.length > 1 || group.key !== "__ungrouped__";
        return (
          <div key={group.key}>
            {showHeader && (
              <GroupHeader
                groupName={group.name}
                color={group.color}
                count={group.events.length}
                collapsed={isCollapsed}
                onToggle={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}
                onRename={(name) => handleRenameGroup(group.key, name)}
              />
            )}
            {!isCollapsed && (
              <div className={showHeader ? "pl-4 space-y-0.5" : "space-y-0.5"}>
                {group.events.map(event => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {editingEvent && (
        <EditPinModal
          event={editingEvent}
          groups={groups}
          onSave={async (id, data) => { await onEditEvent(id, data); }}
          onClose={() => setEditingEvent(null)}
          pickingLocation={pickingLocation}
          onStartPickLocation={onStartPickLocation}
        />
      )}
    </div>
  );
}
