import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Building2, BookOpen, Grab, X } from "lucide-react";
import { motion } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";

const PANEL_STATE = { IDLE: 'idle', RESOLVING: 'resolving', DISAMBIGUATING: 'disambiguating' };

export default function OrganisationSearch({ onSearch, onProfile, isSearching, onClose }) {
  const [query, setPanelQuery]           = useState("");
  const [panelState, setPanelState]      = useState(PANEL_STATE.IDLE);
  const [candidates, setCandidates]      = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

  const startResolve = async (action) => {
    if (!query.trim()) return;
    setPendingAction(action);
    setPanelState(PANEL_STATE.RESOLVING);
    try {
      const found = await resolveTextToEntities(query.trim(), { limit: 15 });
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
    if (action === 'search')  onSearch(candidate.qid, candidate.label);
    if (action === 'profile') onProfile(candidate.qid, candidate.label);
  };

  const isBusy = isSearching || panelState === PANEL_STATE.RESOLVING;

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">

        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search Organisations</h3>
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

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Search</strong> plots formation or HQ on the map.{' '}
                  <strong>Profile</strong> shows a structured property card.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                <Input
                  placeholder="e.g., Amnesty International"
                  value={query}
                  onChange={(e) => setPanelQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') startResolve('search'); }}
                  className="pl-10 border-gray-200 focus:border-orange-500 focus:ring-orange-500"
                  disabled={isBusy}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => startResolve('search')}
                  disabled={isBusy || !query.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {isBusy && pendingAction === 'search' ? (
                    <><Loader2 className="w-1 h-1  animate-spin" />Searching…</>
                  ) : (
                    <><Search className="w-1 h-1" />Search</>
                  )}
                </Button>

                <Button
                  onClick={() => startResolve('profile')}
                  disabled={isBusy || !query.trim()}
                  variant="outline"
                  className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {isBusy && pendingAction === 'profile' ? (
                    <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Profiling…</>
                  ) : (
                    <><BookOpen className="w-1 h-1 mr-2" />Profile</>
                  )}
                </Button>
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
                    className="w-full text-left flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-orange-50 transition-colors"
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

              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setPanelState(PANEL_STATE.IDLE); setCandidates([]); }}
                className="w-full text-gray-500"
              >
                ← Back
              </Button>
            </div>

          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
