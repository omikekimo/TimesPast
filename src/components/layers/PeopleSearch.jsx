import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Users, Wand2, Grab } from "lucide-react";
import { motion } from "framer-motion";

export default function PeopleSearch({ onSearch, isSearching }) {
  const [query, setQuery] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="w-96 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search People</h3>
            </div>
            <Grab className="w-4 h-4 text-gray-400" />
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="e.g., Isaac Newton"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-400">
              Plots birth and death on the map. Wikipedia link fetched when available.
            </p>
            <Button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Querying Wikidata...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Search People
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
