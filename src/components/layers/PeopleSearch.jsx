import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Users, BookOpen, Grab, X } from "lucide-react";
import { motion } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";

const PANEL_STATE = { IDLE: 'idle', RESOLVING: 'resolving', DISAMBIGUATING: 'disambiguating' };

export default function PeopleSearch({ onSearch, onProfile, isSearching, onClose }) {
  const [query, setQuery]           = useState("");
  const [panelState, setPanelState] = useState(PANEL_STATE.IDLE);
  const [candidates, setCandidates] = useState([]);

  const handleSearch = (e) => {
    e?.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const handleProfileClick = async () => {
    if (!query.trim()) return;
    setPanelState(PANEL_STATE.RESOLVING);
    try {
      const found = await resolveTextToEntities(query.trim(), { limit: 15 });
      if (!found.length) { setPanelState(PANEL_STATE.IDLE); return; }
      if (found.length === 1) {
        setPanelState(PANEL_STATE.IDLE);
        onProfile(found[0].qid, found[0].label);
        return;
      }
      setCandidates(found);
      setPanelState(PANEL_STATE.DISAMBIGUATING);
    } catch {
      setPanelState(PANEL_STATE.IDLE);
    }
  };

  const pickCandidate = (candidate) => {
    setPanelState(PANEL_STATE.IDLE);
    setCandidates([]);
    onProfile(candidate.qid, candidate.label);
  };

  const isBusy      = isSearching || panelState === PANEL_STATE.RESOLVING;
  const isResolving = panelState === PANEL_STATE.RESOLVING;

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">

        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search People</h3>
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

            <form onSubmit={handleSearch} className="space-y-3">

              {/* Info box */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Search</strong> plots birth and death on the map.{' '}
                  <strong>Profile</strong> shows a structured biography card.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="e.g., Isaac Newton"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={isBusy}
                />
              </div>

                            <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isBusy || !query.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>

                <button
                  type="button"
                  onClick={handleProfileClick}
                  disabled={isBusy || !query.trim()}
                  className="flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  {isResolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                  Profile
                </button>
              </div>

            </form>

          ) : (

            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {candidates.length} results — which did you mean?
              </p>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.qid}
                    onClick={() => pickCandidate(candidate)}
                    className="w-full text-left flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-amber-50 transition-colors"
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
