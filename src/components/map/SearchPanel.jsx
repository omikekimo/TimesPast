
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Loader2, Calendar, Grab } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { id: "war", label: "War & Conflict", color: "bg-red-100 text-red-800" },
  { id: "politics", label: "Politics", color: "bg-purple-100 text-purple-800" },
  { id: "culture", label: "Culture", color: "bg-green-100 text-green-800" },
  { id: "science", label: "Science", color: "bg-blue-100 text-blue-800" },
  { id: "natural_disaster", label: "Natural Disasters", color: "bg-orange-100 text-orange-800" },
  { id: "economics", label: "Economics", color: "bg-yellow-100 text-yellow-800" },
  { id: "religion", label: "Religion", color: "bg-indigo-100 text-indigo-800" },
  { id: "exploration", label: "Exploration", color: "bg-cyan-100 text-cyan-800" }
];

export default function EventSearchPanel({
  onSearch,
  isSearching,
  selectedCategories,
  onCategoryChange
}) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const toggleCategory = (categoryId) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onCategoryChange([...selectedCategories, categoryId]);
    }
  };

  const clearFilters = () => {
    onCategoryChange([]);
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
            <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFilters(!showFilters)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Filter className="w-4 h-4" />
                </Button>
                <Grab className="w-4 h-4 text-gray-400 ml-2" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search events, places, dates..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

          <Button
            type="submit"
            disabled={true}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium opacity-50 cursor-not-allowed">
            <Search className="w-4 h-4 mr-2" />
            AI Search (coming soon)
          </Button>
          </form>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Filter by Category</span>
                  {selectedCategories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge
                      key={category.id}
                      variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                      className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                        selectedCategories.includes(category.id)
                          ? category.color
                          : "hover:bg-gray-100"
                      }`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      {category.label}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
