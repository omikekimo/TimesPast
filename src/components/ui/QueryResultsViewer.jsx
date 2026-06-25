import React, { useState } from 'react';
import { X, Grab, ExternalLink, Download, BookmarkPlus, Check, Pin } from 'lucide-react';
import DraggablePanel from './DraggablePanel';
import { isImageUrl } from './ImageViewer';
import ImageViewer from './ImageViewer';

// ── Binding value renderer ────────────────────────────────────────────────────
function BindingValue({ value }) {
  const [viewingImage, setViewingImage] = useState(null);
  if (!value) return <span className="text-gray-300 italic">—</span>;

  const isUrl      = value.startsWith('http');
  const isImage    = isUrl && isImageUrl(value);
  const isWikidata = value.includes('wikidata.org/entity/');

  if (isImage) return (
    <>
      <button onClick={() => setViewingImage(value)} className="flex items-center gap-2 group">
        <img src={value} alt="" style={{ width: 60, height: 40, objectFit: 'cover' }}
          className="rounded border border-gray-200 group-hover:border-blue-400 transition-colors" />
        <span className="text-[10px] text-blue-400 group-hover:text-blue-600">enlarge</span>
      </button>
      {viewingImage && <ImageViewer imageUrl={viewingImage} title="Image" onClose={() => setViewingImage(null)} />}
    </>
  );

  if (isWikidata) {
    const qid = value.split('/').pop();
    return (
      <a href={`https://www.wikidata.org/wiki/${qid}`} target="_blank" rel="noreferrer"
        className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs">
        {qid} <ExternalLink className="w-3 h-3 flex-shrink-0" />
      </a>
    );
  }

  if (isUrl) return (
    <a href={value} target="_blank" rel="noreferrer"
      className="text-blue-500 hover:text-blue-700 text-xs break-all flex items-center gap-1">
      {value.length > 60 ? value.slice(0, 60) + '…' : value}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  );

  return <span className="text-gray-700 break-all text-xs">{value}</span>;
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportResultsCsv(results, entityLabel) {
  const defaultName = `${entityLabel.replace(/[^a-z0-9]/gi, '_')}_note`;
  const fileName = window.prompt('Name your export file:', defaultName);
  if (!fileName) return;

  // Event header row (no events, but keeps import parser happy)
  const eventHeader = 'Title,Date,Time,Category,Significance,Description,Wikipedia URL,Source,Search Group,Search Query,Search Color,Latitude,Longitude,ID (internal)';

  // Note block
  const noteHeader = [
    '##NOTE_START##',
    entityLabel,
    entityLabel,
    '',  // parent_pin_id — unknown at export time
    '',  // search_group
    '',  // search_color
    new Date().toISOString(),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');

  const bindingHeader = 'RowIndex,Property,Label,Value,Type';

  const toVal = v => `"${String(v || '').replace(/"/g, '""')}"`;

  const bindingRows = [];
  results.forEach((row, rowIdx) => {
    Object.entries(row)
      .filter(([key]) => !key.endsWith('Label'))
      .forEach(([key, binding]) => {
        const label = row[`${key}Label`]?.value || '';
        bindingRows.push([
          rowIdx,
          toVal(key),
          toVal(label),
          toVal(binding.value || ''),
          toVal(binding.type  || ''),
        ].join(','));
      });
  });

  const full = [eventHeader, noteHeader, bindingHeader, ...bindingRows, '##NOTE_END##'].join('\n');

  const blob = new Blob([full], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${fileName.trim()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function QueryResultsViewer({
  results,
  entityLabel,
  onClose,
  onSaveNote,
  groups = [],
  availablePins = [],   // current pins — for parent pin selection
}) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [noteName, setNoteName]         = useState(entityLabel);
  const [noteGroup, setNoteGroup]       = useState('');
  const [parentPinId, setParentPinId]   = useState('');
  const [pinSearch, setPinSearch]       = useState('');
  const [saved, setSaved]               = useState(false);

  if (!results?.length) return null;

  const allKeys = [...new Set(
    results.flatMap(row => Object.keys(row).filter(k => !k.endsWith('Label')))
  )];

  // Filter pins for the parent selector
  const filteredPins = availablePins.filter(p =>
    !pinSearch || p.title.toLowerCase().includes(pinSearch.toLowerCase())
  ).slice(0, 50);

  const handleSaveNote = () => {
    if (!noteName.trim()) return;
    const group = groups.find(g => g.id === noteGroup);
    onSaveNote?.({
      title:         noteName.trim(),
      entity_label:  entityLabel,
      search_group:  group?.id    || null,
      search_color:  group?.color || null,
      parent_pin_id: parentPinId  || null,
      rows:          results,
    });
    setSaved(true);
    setShowSaveForm(false);
  };

  const selectedParentPin = availablePins.find(p => p.id === parentPinId);

  return (
    <DraggablePanel
      initialPosition={{ x: Math.max(40, window.innerWidth / 2 - 320), y: 120 }}
      dragHandleClassName="drag-handle"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden" style={{ width: 640 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b drag-handle">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Query Results</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {entityLabel} — {results.length} row(s) returned
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Grab className="w-4 h-4 text-gray-400" />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results table */}
        <div className="overflow-auto" style={{ maxHeight: '48vh' }}>
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-gray-200 w-28">Property</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-gray-200">Label</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-gray-200">Value</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-500 border-b border-gray-200 w-16">Type</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row, rowIdx) => (
                <React.Fragment key={rowIdx}>
                  {rowIdx > 0 && (
                    <tr>
                      <td colSpan={4} className="bg-blue-50 px-3 py-0.5">
                        <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                          Row {rowIdx + 1}
                        </span>
                      </td>
                    </tr>
                  )}
                  {allKeys.map(key => {
                    const binding = row[key];
                    if (!binding) return null;
                    const label = row[`${key}Label`]?.value;
                    return (
                      <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-gray-400 align-top">{key}</td>
                        <td className="px-3 py-2 text-gray-600 align-top">
                          {label || <span className="text-gray-300 italic">—</span>}
                        </td>
                        <td className="px-3 py-2 align-top"><BindingValue value={binding.value} /></td>
                        <td className="px-3 py-2 text-gray-400 align-top italic">{binding.type}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save as note form */}
        {showSaveForm && (
          <div className="px-4 py-3 border-t border-gray-200 bg-blue-50 space-y-2">
            <p className="text-xs font-semibold text-blue-900">Save as Note</p>

            {/* Note name */}
            <input
              className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              placeholder="Note name…"
              value={noteName}
              onChange={e => setNoteName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
              autoFocus
            />

            {/* Timeline group */}
            {groups.length > 0 && (
              <select
                className="w-full border rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={noteGroup}
                onChange={e => setNoteGroup(e.target.value)}
              >
                <option value="">— attach to timeline group (optional) —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}

            {/* Parent pin selector */}
            {availablePins.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-blue-700 font-medium">Attach to pin (optional):</p>
                <input
                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Search pins…"
                  value={pinSearch}
                  onChange={e => setPinSearch(e.target.value)}
                />
                <div className="max-h-28 overflow-y-auto border rounded bg-white">
                  <button
                    type="button"
                    onClick={() => setParentPinId('')}
                    className={`w-full text-left px-2 py-1.5 text-xs border-b border-gray-100 transition-colors ${
                      !parentPinId ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50'
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
                          ? 'bg-blue-100 text-blue-700 font-medium'
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
                  <p className="text-[10px] text-blue-600">
                    ↳ Will appear under: {selectedParentPin.title}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleSaveNote} disabled={!noteName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded px-3 py-1.5 disabled:opacity-50 transition-colors">
                Save Note
              </button>
              <button onClick={() => setShowSaveForm(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-2">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            {!showSaveForm && (
              <button
                onClick={() => { setSaved(false); setShowSaveForm(true); }}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {saved
                  ? <><Check className="w-3.5 h-3.5 text-green-500" /> Saved</>
                  : <><BookmarkPlus className="w-3.5 h-3.5" /> Save as Note</>
                }
              </button>
            )}
          </div>
          <button
            onClick={() => exportResultsCsv(results, entityLabel)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

      </div>
    </DraggablePanel>
  );
}
