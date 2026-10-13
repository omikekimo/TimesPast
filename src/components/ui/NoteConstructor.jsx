import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Grab, X, Plus, Trash2, BookmarkPlus, AlignLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import DraggablePanel from './DraggablePanel';
import { NOTE_ROW_TYPES, buildNoteRow, buildTextRow, assembleNote } from '@/lib/noteUtils';

const emptyRow = () => ({ property: '', label: '', value: '', type: 'text' });

export default function NoteConstructor({
  onSave,
  onClose,
  parentPin = null,    // the pin this note will attach to
  groups    = [],
  availablePins = [],
}) {
  const [title, setTitle]           = useState(parentPin ? `Note on ${parentPin.title}` : '');
  const [freeText, setFreeText]     = useState('');
  const [rows, setRows]             = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(parentPin?.search_group || '');
  const [pinSearch, setPinSearch]   = useState('');
  const [parentPinId, setParentPinId] = useState(parentPin?.id || '');
  const [error, setError]           = useState(null);

  const addRow = () => setRows(r => [...r, emptyRow()]);

  const updateRow = (idx, field, value) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const removeRow = (idx) => {
    setRows(r => r.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!title.trim()) { setError('A title is required'); return; }
    if (!freeText.trim() && rows.length === 0) {
      setError('Add some text or at least one row'); return;
    }

    const builtRows = [];

    // Free text becomes the first row if present
    if (freeText.trim()) {
      builtRows.push(buildTextRow(freeText.trim()));
    }

    // Structured rows — skip any that have no value
    rows.forEach(row => {
      if (!row.value.trim()) return;
      const property = row.property.trim() || `field_${Date.now()}`;
      builtRows.push(buildNoteRow(property, row.label || property, row.value.trim(), row.type));
    });

    const group = groups.find(g => g.id === selectedGroup);

    onSave(assembleNote({
      title,
      entityLabel:  title,
      parentPinId,
      searchGroup:  group?.id    || null,
      searchColor:  group?.color || null,
      rows:         builtRows,
    }));

    onClose();
  };

  const filteredPins = availablePins
    .filter(p => !pinSearch || p.title.toLowerCase().includes(pinSearch.toLowerCase()))
    .slice(0, 50);

  return (
    <DraggablePanel
      initialPosition={{ x: Math.max(40, window.innerWidth / 2 - 340), y: 100 }}
      dragHandleClassName="drag-handle"
    >
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-white/95 backdrop-blur-sm border-0 elegant-shadow dark:bg-gray-800"
          style={{ width: 560 }}>

          <CardHeader className="pb-3 drag-handle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  New Note
                </h3>
                {parentPin && (
                  <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                    ↳ {parentPin.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Grab className="w-4 h-4 text-gray-400" />
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 max-h-[75vh] overflow-y-auto">

            {/* Title */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">
                Note Title
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Note title…"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Free text */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1 flex items-center gap-1">
                <AlignLeft className="w-3 h-3" /> Free Text
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                placeholder="Write anything here…"
                rows={4}
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
              />
            </div>

            {/* Structured rows */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Structured Fields
                </label>
                <button
                  onClick={addRow}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Field
                </button>
              </div>

              {rows.length === 0 && (
                <p className="text-xs text-gray-300 italic">
                  No structured fields yet — click Add Field to add one.
                </p>
              )}

              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_80px_24px] gap-1.5 items-center">
                    <input
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Property key"
                      value={row.property}
                      onChange={e => updateRow(idx, 'property', e.target.value)}
                    />
                    <input
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Label"
                      value={row.label}
                      onChange={e => updateRow(idx, 'label', e.target.value)}
                    />
                    <input
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="Value"
                      value={row.value}
                      onChange={e => updateRow(idx, 'value', e.target.value)}
                    />
                    <select
                      className="border rounded px-1 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={row.type}
                      onChange={e => updateRow(idx, 'type', e.target.value)}
                    >
                      {NOTE_ROW_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {rows.length > 0 && (
                <p className="text-[10px] text-gray-300 mt-1">
                  Fields with no value will be skipped on save.
                </p>
              )}
            </div>

            <hr className="border-gray-100" />

            {/* Attach to pin */}
            {availablePins.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">
                  Attach to Pin (optional)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-1.5 text-xs mb-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Search pins…"
                  value={pinSearch}
                  onChange={e => setPinSearch(e.target.value)}
                />
                <div className="max-h-28 overflow-y-auto border rounded-lg bg-white">
                  <button
                    type="button"
                    onClick={() => setParentPinId('')}
                    className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-100 transition-colors ${
                      !parentPinId
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    — no parent pin —
                  </button>
                  {filteredPins.map(pin => (
                    <button
                      key={pin.id}
                      type="button"
                      onClick={() => setParentPinId(pin.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-100 last:border-0 transition-colors ${
                        parentPinId === pin.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
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
              </div>
            )}

            {/* Timeline group */}
            {groups.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1">
                  Timeline Group (optional)
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={selectedGroup}
                  onChange={e => setSelectedGroup(e.target.value)}
                >
                  <option value="">— no group —</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-red-500 text-xs">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <BookmarkPlus className="w-4 h-4 mr-2" /> Save Note
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="text-gray-500"
              >
                Cancel
              </Button>
            </div>

          </CardContent>
        </Card>
      </motion.div>
    </DraggablePanel>
  );
}
