import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Search, Loader2, Calendar, Grab } from "lucide-react";
import { motion } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";
import DisambiguationList from "@/components/ui/DisambiguationList";

// ── Panel states ──────────────────────────────────────────────────────────────
const STATE = {
  IDLE:           'idle',
  DISAMBIGUATING: 'disambiguating',
  SEARCHING:      'searching',
};

export default function EventSearchPanel({
  onSearch,
  isSearching,
}) {
  const [query, setQuery]             = useState("");
  const [panelState, setPanelState]   = useState(STATE.IDLE);
  const [candidates, setCandidates]   = useState([]);

  // Step 1 — resolve text to candidates
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setPanelState(STATE.DISAMBIGUATING);
    setCandidates([]);

    const found = await resolveTextToEntities(query.trim(), { limit: 5 });
    setCandidates(found);

    // If exactly one result skip disambiguation
    if (found.length === 1) {
      await handleCandidateSelect(found[0]);
    }
  };

  // Step 2 — user picks candidate, fire search
  const handleCandidateSelect = async (candidate) => {
    setPanelState(STATE.SEARCHING);
    await onSearch(candidate.qid, candidate.label);
    setPanelState(STATE.IDLE);
    setCandidates([]);
  };

  const handleCancel = () => {
    setPanelState(STATE.IDLE);
    setCandidates([]);
  };

  return (
    <motion.div>
      <Card className="w-96 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search Events</h3>
            </div>
              <Grab className="w-4 h-4 text-gray-400" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── Search form ── */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search events, battles, movements…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={panelState === STATE.SEARCHING || !query.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {panelState === STATE.SEARCHING ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching Wikidata…</>
              ) : panelState === STATE.DISAMBIGUATING ? (
                <><Search className="w-4 h-4 mr-2" />Search again</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Search Events</>
              )}
            </Button>
          </form>

          {/* ── Disambiguation ── */}
          {panelState === STATE.DISAMBIGUATING && candidates.length > 1 && (
            <DisambiguationList
              candidates={candidates}
              onSelect={handleCandidateSelect}
              onCancel={handleCancel}
            />
          )}

          {/* ── No results ── */}
          {panelState === STATE.DISAMBIGUATING && candidates.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              No results found for "{query}"
              <button type="button" onClick={handleCancel}
                className="block mx-auto mt-2 text-xs text-blue-500 hover:text-blue-700">
                try again
              </button>
            </div>
          )}



        </CardContent>
      </Card>
    </motion.div>
  );
}

