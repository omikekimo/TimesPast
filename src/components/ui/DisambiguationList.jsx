import React from 'react';
import { ExternalLink } from 'lucide-react';

// ── Shared disambiguation list ────────────────────────────────────────────────
// Used by EventSearchPanel and CustomQueryPanel whenever a search term
// returns multiple Wikidata candidates and the user needs to pick one.
//
// Props:
//   candidates  — array of { qid, label, description, url } from resolveTextToEntities
//   onSelect    — called with the chosen candidate object
//   onCancel    — called when user dismisses without choosing
// ─────────────────────────────────────────────────────────────────────────────

export default function DisambiguationList({ candidates, onSelect, onCancel }) {
  if (!candidates?.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          {candidates.length} result{candidates.length !== 1 ? 's' : ''} — which did you mean?
        </p>
        <button type="button" onClick={onCancel}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          cancel
        </button>
      </div>

      <div className="space-y-1.5">
        {candidates.map(c => (
          <button
            key={c.qid}
            type="button"
            onClick={() => onSelect(c)}
            className="w-full text-left px-3 py-2 rounded-lg border border-gray-200
              hover:border-blue-400 hover:bg-blue-50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {c.label}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
                    {c.qid}
                  </span>
                </div>
                {c.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                )}
              </div>
              {/* Open in Wikidata without triggering onSelect */}
              <ExternalLink
                className="w-3 h-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors"
                onClick={e => { e.stopPropagation(); window.open(c.url, '_blank'); }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
