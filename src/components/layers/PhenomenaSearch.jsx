import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Zap, Search, MapPin, Globe, Loader2, Grab, X } from 'lucide-react';
import { motion } from "framer-motion";
import { resolveTextToEntities } from '@/lib/wikidataUtils';

export default function PhenomenaSearch({
  onSearch,
  onSpread,
  isSearching,
  onClose,
}) {
  const [inputText, setInputText]         = useState('');
  const [searchMode, setSearchMode]       = useState('pin');
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
    if (action === 'pin')    onSearch(candidate.qid, candidate.label);
    if (action === 'spread') onSpread(candidate.qid, candidate.label);
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
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search Phenomena</h3>
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
              <strong>Pin</strong> places a dated point for the phenomenon.{' '}
              <strong>Spread</strong> maps sub-events and builds an area polygon.
            </p>
          </div>

          {/* Mode selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setSearchMode('pin')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                searchMode === 'pin'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MapPin className="w-3 h-3" /> Pin
            </button>
            <button
              onClick={() => setSearchMode('spread')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                searchMode === 'spread'
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe className="w-3 h-3" /> Spread
            </button>
          </div>

          {/* Search input */}
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              searchMode === 'pin' ? resolveAndRoute('pin') : resolveAndRoute('spread');
            }}
            placeholder={
              searchMode === 'pin'
                ? 'e.g. 1906 earthquake, Chernobyl'
                : 'e.g. Black Death, Spanish flu'
            }
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />

          {/* Action button */}
          <button
            onClick={() => searchMode === 'pin' ? resolveAndRoute('pin') : resolveAndRoute('spread')}
            disabled={busy || !inputText.trim()}
            className="w-full flex items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            {searchMode === 'pin' ? 'Find Phenomenon' : 'Map Spread'}
          </button>

          {/* Disambiguation list */}
          {candidates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Which one?</p>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {candidates.map(c => (
                  <button
                    key={c.qid}
                    onClick={() => handleCandidatePick(c)}
                    className="w-full text-left flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-amber-50 transition-colors"
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
