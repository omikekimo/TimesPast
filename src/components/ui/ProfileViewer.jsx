import React, { useState } from 'react';
import { X, Grab, ExternalLink, BookmarkPlus, Check, Globe } from 'lucide-react';
import DraggablePanel from './DraggablePanel';
import { isImageUrl } from './ImageViewer';
import ImageViewer from './ImageViewer';

// ── Property value renderer ───────────────────────────────────────────────────
function ProfileValue({ value, type }) {
  const [viewingImage, setViewingImage] = useState(null);
  if (!value) return <span className="text-gray-300 italic text-xs">—</span>;

  const isImage = type === 'image' || (typeof value === 'string' && isImageUrl(value));
  const isUrl   = type === 'url'   || (typeof value === 'string' && value.startsWith('https://') && !isImage);

  if (isImage) return (
    <>
      <button
        onClick={() => setViewingImage(value)}
        className="flex items-center gap-2 group"
      >
        <img
          src={value}
          alt=""
          style={{ maxWidth: 80, maxHeight: 50, objectFit: 'contain' }}
          className="rounded border border-gray-200 group-hover:border-orange-400 transition-colors"
        />
        <span className="text-[10px] text-orange-500 group-hover:text-orange-700">enlarge</span>
      </button>
      {viewingImage && (
        <ImageViewer imageUrl={viewingImage} title="Image" onClose={() => setViewingImage(null)} />
      )}
    </>
  );

  if (isUrl) return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1 break-all"
    >
      {value.length > 55 ? value.slice(0, 55) + '…' : value}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  );

  return <span className="text-gray-800 text-xs">{value}</span>;
}

// ── Convert profile properties to note rows that QueryResultsViewer can display ─
function profileToNoteRows(properties) {
  return properties.map(prop => ({
    // Human-readable column header — QueryResultsViewer uses Object.keys to build columns
    [prop.label]: {
      type:  'literal',
      value: prop.values.map(v => v.display).join('; '),
    },
  }));
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProfileViewer({
  qid,
  label,
  entityType = 'organisation',
  properties = [],
  wikipediaUrl,
  groups = [],
  availablePins = [],
  onSaveNote,
  onClose,
}) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [noteName, setNoteName]         = useState(label);
  const [noteGroup, setNoteGroup]       = useState('');
  const [parentPinId, setParentPinId]   = useState('');
  const [pinSearch, setPinSearch]       = useState('');
  const [saved, setSaved]               = useState(false);
  const [viewingImage, setViewingImage] = useState(null);

  if (!properties.length) return null;

  const filteredPins = availablePins
    .filter(p => !pinSearch || p.title.toLowerCase().includes(pinSearch.toLowerCase()))
    .slice(0, 50);

  const selectedParentPin = availablePins.find(p => p.id === parentPinId);

  const handleSaveNote = () => {
    if (!noteName.trim()) return;
    const group = groups.find(g => g.id === noteGroup);
    onSaveNote?.({
      title:         noteName.trim(),
      entity_label:  label,
      search_group:  group?.id    || null,
      search_color:  group?.color || null,
      parent_pin_id: parentPinId  || null,
      rows:          profileToNoteRows(properties),
    });
    setSaved(true);
    setShowSaveForm(false);
  };

  // Separate image/logo properties for the header area
  const imageProps = properties.filter(p => p.type === 'image');
  const bodyProps  = properties.filter(p => p.type !== 'image');

  return (
    <DraggablePanel
      initialPosition={{ x: Math.max(40, window.innerWidth / 2 - 240), y: 100 }}
      dragHandleClassName="drag-handle"
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        style={{ width: 480 }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-4 py-3 bg-orange-50 border-b border-orange-100 drag-handle">
          <div className="flex items-start gap-3 min-w-0">
            {/* Logo / image thumbnail in header */}
            {imageProps.length > 0 && (
              <button
                onClick={() => setViewingImage(imageProps[0].values[0].raw)}
                className="flex-shrink-0 mt-0.5"
              >
                <img
                  src={imageProps[0].values[0].raw}
                  alt={label}
                  style={{ width: 40, height: 40, objectFit: 'contain' }}
                  className="rounded border border-orange-200 hover:border-orange-400 transition-colors bg-white"
                />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{label}</h3>
              <p className="text-[10px] text-orange-600 uppercase tracking-wider mt-0.5">{entityType}</p>
              {wikipediaUrl && (
                <a
                  href={wikipediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 mt-1"
                >
                  <Globe className="w-3 h-3" />
                  Wikipedia
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <Grab className="w-4 h-4 text-gray-400" />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Property list ────────────────────────────────────────────── */}
        <div className="overflow-y-auto" style={{ maxHeight: '52vh' }}>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {bodyProps.map(prop => (
                <tr key={prop.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                  <td className="px-4 py-2.5 text-gray-500 font-medium whitespace-nowrap w-36">
                    {prop.label}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="space-y-1">
                      {prop.values.map((v, i) => (
                        <ProfileValue key={i} value={v.display} type={prop.type} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Save as Note form ─────────────────────────────────────────── */}
        {showSaveForm && (
          <div className="px-4 py-3 border-t border-gray-200 bg-orange-50 space-y-2">
            <p className="text-xs font-semibold text-orange-900">Save as Note</p>

            <input
              className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              placeholder="Note name…"
              value={noteName}
              onChange={e => setNoteName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
              autoFocus
            />

            {groups.length > 0 && (
              <select
                className="w-full border rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-orange-400"
                value={noteGroup}
                onChange={e => setNoteGroup(e.target.value)}
              >
                <option value="">— attach to timeline group (optional) —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}

            {availablePins.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-orange-800 font-medium">Attach to pin (optional):</p>
                <input
                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                  placeholder="Search pins…"
                  value={pinSearch}
                  onChange={e => setPinSearch(e.target.value)}
                />
                <div className="max-h-28 overflow-y-auto border rounded bg-white">
                  <button
                    type="button"
                    onClick={() => setParentPinId('')}
                    className={`w-full text-left px-2 py-1.5 text-xs border-b border-gray-100 transition-colors ${
                      !parentPinId ? 'bg-orange-100 text-orange-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    — no parent pin —
                  </button>
                  {filteredPins.map(pin => (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={() => setParentPinId(pin.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs border-b border-gray-100 last:border-0 transition-colors ${
                        parentPinId === pin.id
                          ? 'bg-orange-100 text-orange-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {pin.search_color && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: pin.search_color }} />
                        )}
                        <span className="truncate">{pin.title}</span>
                        <span className="ml-auto text-gray-400 flex-shrink-0 text-[10px]">
                          {pin.year < 0 ? `${Math.abs(pin.year)} BCE` : pin.year}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedParentPin && (
                  <p className="text-[10px] text-orange-700">
                    ↳ Will appear under: {selectedParentPin.title}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSaveNote}
                disabled={!noteName.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded px-3 py-1.5 disabled:opacity-50 transition-colors"
              >
                Save Note
              </button>
              <button
                onClick={() => setShowSaveForm(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <span>{qid}</span>
            {wikipediaUrl && (
              <a href={`https://www.wikidata.org/wiki/${qid}`} target="_blank" rel="noreferrer"
                className="ml-2 text-blue-400 hover:text-blue-600 flex items-center gap-0.5">
                Wikidata <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          {!showSaveForm && (
            <button
              onClick={() => { setSaved(false); setShowSaveForm(true); }}
              className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 font-medium"
            >
              {saved
                ? <><Check className="w-3.5 h-3.5 text-green-500" /> Saved</>
                : <><BookmarkPlus className="w-3.5 h-3.5" /> Save as Note</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Full-size image viewer triggered from header thumbnail */}
      {viewingImage && (
        <ImageViewer imageUrl={viewingImage} title={label} onClose={() => setViewingImage(null)} />
      )}
    </DraggablePanel>
  );
}
