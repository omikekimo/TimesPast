import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Leaf, Search, User, Globe, Loader2, BookOpen, Grab, X } from 'lucide-react';
import { motion } from "framer-motion";
import { resolveTextToEntities } from '@/lib/wikidataUtils';

export default function LivingEntitiesSearch({
  onSearch,
  onSpeciesRange,
  onProfile,
  isSearching,
  onClose,
}) {
  const [inputText, setInputText]         = useState('');
  const [searchMode, setSearchMode]       = useState('individual');
  const [useWikidata, setUseWikidata]     = useState(true);
  const [useGBIF, setUseGBIF]             = useState(true);
  const [candidates, setCandidates]       = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [isResolving, setIsResolving]     = useState(false);

  const resolveAndRoute = async (action) => {
    if (!inputText.trim()) return;
    setIsResolving(true);
    const found = await resolveTextToEntities(inputText.trim());
    setIsResolving(false);
    if (!found.length) return;
    if (found.length === 1) {
      dispatchAction(action, found[0]);
    } else {
      setPendingAction(action);
      setCandidates(found);
    }
  };

  const dispatchAction = (action, candidate) => {
    if (action === 'search')  onSearch(candidate.qid, candidate.label);
    if (action === 'range')   onSpeciesRange(candidate.qid, candidate.label, { useWikidata, useGBIF });
    if (action === 'profile') onProfile(candidate.qid, candidate.label);
  };

  const handleCandidatePick = (candidate) => {
    dispatchAction(pendingAction, candidate);
    setCandidates([]);
    setPendingAction(null);
  };

  const busy = isSearching || isResolving;

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">

        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-lime-600" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Living Entities</h3>
            </div>
            <div className="flex items-center gap-2">
              <Grab className="w-4 h-4 text-gray-400" />
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">

          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Individual</strong> plots the entity on the map.{' '}
              <strong>Species Range</strong> overlays the habitat polygon.
            </p>
          </div>

          {/* Mode selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setSearchMode('individual')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                searchMode === 'individual'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-3 h-3" /> Individual
            </button>
            <button
              onClick={() => setSearchMode('range')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                searchMode === 'range'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe className="w-3 h-3" /> Species Range
            </button>
          </div>

          {/* Search input */}
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              searchMode === 'individual' ? resolveAndRoute('search') : resolveAndRoute('range');
            }}
            placeholder={
              searchMode === 'individual'
                ? 'e.g. Koko, Dolly the sheep'
                : 'e.g. Polar bear, Giant panda'
            }
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-400"
          />

          {/* Source toggles — Species Range mode only */}
          {searchMode === 'range' && (
            <div className="flex gap-4 px-1">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={useWikidata} onChange={e => setUseWikidata(e.target.checked)} className="accent-lime-600" />
                Wikidata
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={useGBIF} onChange={e => setUseGBIF(e.target.checked)} className="accent-lime-600" />
                gBIF Occurrences
              </label>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => searchMode === 'individual' ? resolveAndRoute('search') : resolveAndRoute('range')}
              disabled={busy || !inputText.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-4 h-4" />}
              {searchMode === 'individual' ? 'Search' : 'Find Range'}
            </button>
            <button
              onClick={() => resolveAndRoute('profile')}
              disabled={busy || !inputText.trim()}
              className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
            <BookOpen className="w-4 h-4" />
              Profile
            </button>
          </div>

          {/* Disambiguation list */}
          {candidates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Which one?</p>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {candidates.map(c => (
                  <button
                    key={c.qid}
                    onClick={() => handleCandidatePick(c)}
                    className="w-full text-left flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-lime-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{c.label}</p>
                      {c.description && (
                        <p className="text-[10px] text-gray-400 truncate">{c.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </motion.div>
  );
}
