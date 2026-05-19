import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, Users, Wand2, Grab } from "lucide-react";
import { motion } from "framer-motion";

// Relevant Wikidata properties for searching people
const personProperties = [
  { id: 'P569', label: 'Date of Birth', sparqlVar: 'birthDate' },
  { id: 'P19',  label: 'Place of Birth', sparqlVar: 'birthPlace' },
  { id: 'P570', label: 'Date of Death', sparqlVar: 'deathDate' },
  { id: 'P20',  label: 'Place of Death', sparqlVar: 'deathPlace' },
  { id: 'P106', label: 'Occupation', sparqlVar: 'occupation' },
  { id: 'P1317', label: 'Floruit (active period)', sparqlVar: 'floruit' },
];

export default function SparqlSearchPanel({ onSearch, isSearching }) {
  const [query, setQuery] = useState("");
  // Default to birth/death dates + floruit
  const [selectedProps, setSelectedProps] = useState(['P569', 'P570', 'P1317']);

  const toggleProperty = (propId) => {
    setSelectedProps(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query, selectedProps);
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
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search People (SPARQL)</h3>
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

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Include in timeline:</p>
              <div className="grid grid-cols-2 gap-2">
                {personProperties.map(prop => (
                  <div key={prop.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={prop.id}
                      checked={selectedProps.includes(prop.id)}
                      onCheckedChange={() => toggleProperty(prop.id)}
                    />
                    <label
                      htmlFor={prop.id}
                      className="text-sm text-gray-600 cursor-pointer"
                    >
                      {prop.label}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Wikipedia link is always fetched when available.</p>
            </div>

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
                  Build & Run SPARQL Query
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
