import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Search, Loader2, BookOpen, LayoutList, Grab, X } from "lucide-react";
import { motion } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";

const SEARCH_MODE = { ENTITY: 'entity', BREAKTHROUGH: 'breakthrough' };
const PANEL_STATE = { IDLE: 'idle', RESOLVING: 'resolving', DISAMBIGUATING: 'disambiguating' };

export default function ArtificialAgentsSearch({ onSearch, onConceptSearch, onProfile, onStatements, isSearching, onClose }) {
  const [inputText, setInputText]         = useState('');
  const [searchMode, setSearchMode]       = useState(SEARCH_MODE.ENTITY);
  const [panelState, setPanelState]       = useState(PANEL_STATE.IDLE);
  const [candidates, setCandidates]       = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const [useWikidata, setUseWikidata]     = useState(true);
  const [useRdap, setUseRdap]             = useState(false);
  const [searchDepth, setSearchDepth]     = useState(2);

  const busy = isSearching || panelState === PANEL_STATE.RESOLVING;

  const resolveAndRoute = async (action) => {
    if (!inputText.trim()) return;
    setPendingAction(action);
    setPanelState(PANEL_STATE.RESOLVING);
    try {
      const found = await resolveTextToEntities(inputText.trim(), { limit: 15 });
      if (!found.length) { setPanelState(PANEL_STATE.IDLE); return; }
      if (found.length === 1) { fireAction(found[0], action); return; }
      setCandidates(found);
      setPanelState(PANEL_STATE.DISAMBIGUATING);
    } catch {
      setPanelState(PANEL_STATE.IDLE);
    }
  };

  const fireAction = (candidate, actionOverride) => {
    const action = actionOverride ?? pendingAction;
    setPanelState(PANEL_STATE.IDLE);
    setCandidates([]);
    if (action === 'search') {
      if (searchMode === SEARCH_MODE.BREAKTHROUGH && onConceptSearch) {
        onConceptSearch(candidate.qid, candidate.label);
      } else {
        onSearch(candidate.qid, candidate.label, { depth: searchDepth });
      }
    }
    if (action === 'profile') onProfile?.(candidate.qid, candidate.label, { useWikidata, useRdap });
    if (action === 'statements') onStatements?.(candidate.qid, candidate.label);
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">

        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-600" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Artificial Agents</h3>
            </div>
            <div className="flex items-center gap-2">
              <Grab className="w-4 h-4 text-gray-400" />
              {onClose && (
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {panelState !== PANEL_STATE.DISAMBIGUATING ? (

            <div className="space-y-3">

              {/* Blue info box */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Entity</strong> — a specific agent: AI, virus, bot or automaton.{' '}
                  <strong>Breakthrough</strong> — a technological first: first broadcast, first transmission, first connection.
                </p>
              </div>

              {/* Mode selector */}
              <div className="flex rounded-lg bg-gray-100 p-0.5 gap-0.5">
                <button
                  onClick={() => setSearchMode(SEARCH_MODE.ENTITY)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                    searchMode === SEARCH_MODE.ENTITY
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Entity
                </button>
                <button
                  onClick={() => setSearchMode(SEARCH_MODE.BREAKTHROUGH)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
                    searchMode === SEARCH_MODE.BREAKTHROUGH
                      ? 'bg-white text-sky-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Breakthrough
                </button>
              </div>

                          {/* Source checkboxes + depth — Entity mode only */}
              {searchMode === SEARCH_MODE.ENTITY && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                      <input type="checkbox" checked={useWikidata} onChange={e => setUseWikidata(e.target.checked)} className="accent-sky-600" />
                      Wikidata
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                      <input type="checkbox" checked={useRdap} onChange={e => setUseRdap(e.target.checked)} className="accent-sky-600" />
                      RDAP
                    </label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400 select-none">Depth</span>
                    <div className="flex bg-gray-100 rounded p-0.5 gap-0.5">
                      {[1, 2, 3].map(d => (
                        <button
                          key={d}
                          onClick={() => setSearchDepth(d)}
                          className={`w-5 h-5 text-xs font-medium rounded transition-colors ${
                            searchDepth === d
                              ? 'bg-white text-sky-700 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder={
                    searchMode === SEARCH_MODE.ENTITY
                      ? 'e.g., ENIAC, Stuxnet, Deep Blue'
                      : 'e.g., first radio broadcast, ARPANET'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') resolveAndRoute('search'); }}
                  className="pl-10 border-gray-200 focus:border-sky-500 focus:ring-sky-400"
                  disabled={busy}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => resolveAndRoute('search')}
                  disabled={busy || !inputText.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {busy && pendingAction === 'search'
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Search className="w-4 h-4" />
                  }
                  {searchMode === SEARCH_MODE.ENTITY ? 'Search' : 'Find Firsts'}
                </button>
                                <button
                  onClick={() => resolveAndRoute('profile')}
                  disabled={busy || !inputText.trim()}
                  title="Profile"
                  className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => resolveAndRoute('statements')}
                  disabled={busy || !inputText.trim()}
                  title="All Wikidata statements"
                  className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>

            </div>

          ) : (

            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {candidates.length} results — which did you mean?
              </p>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.qid}
                    onClick={() => fireAction(candidate)}
                    className="w-full text-left flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-sky-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{candidate.label}</p>
                      {candidate.description && (
                        <p className="text-[10px] text-gray-400 truncate">{candidate.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setPanelState(PANEL_STATE.IDLE); setCandidates([]); }}
                className="w-full text-xs text-gray-500 hover:text-gray-700 py-1.5 transition-colors"
              >
                ← Back
              </button>
            </div>

          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
