// ── noteUtils.js ──────────────────────────────────────────────────────────────
// Pure data helpers for note construction and row management.
// All note-creation logic lives here so it can be called from handlers,
// the console, or any future interface without duplicating logic.
// ─────────────────────────────────────────────────────────────────────────────

// Expandable list of row types available to the user.
// Add new entries here — NoteConstructor.jsx consumes this automatically.
export const NOTE_ROW_TYPES = [
  { value: 'text',    label: 'Text'    },
  { value: 'number',  label: 'Number'  },
  { value: 'date',    label: 'Date'    },
  { value: 'url',     label: 'URL'     },
  { value: 'person',  label: 'Person'  },
  { value: 'place',   label: 'Place'   },
];

// Build a single structured row in the same shape that SPARQL results use,
// so user-created rows and query-result rows are indistinguishable downstream.
export function buildNoteRow(property, label, value, type) {
  return {
    [property]: { value, type },
    [`${property}Label`]: { value: label, type: 'literal' },
  };
}

// Build a free-text row — always stored as a single 'text' typed entry
// under the key 'note_text' so the viewer renders it cleanly.
export function buildTextRow(text) {
  return buildNoteRow('note_text', 'Note', text, 'text');
}

// Assemble a complete note object ready to pass to handleSaveNote.
// Shape is identical to what QueryResultsViewer produces.
export function assembleNote({ title, entityLabel, parentPinId, searchGroup, searchColor, rows }) {
  return {
    title:         title.trim(),
    entity_label:  entityLabel || title.trim(),
    parent_pin_id: parentPinId  || null,
    search_group:  searchGroup  || null,
    search_color:  searchColor  || null,
    rows,
  };
}
