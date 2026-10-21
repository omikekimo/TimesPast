import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Grab, Map, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { getTileProvidersByCategory } from "@/lib/mapConfig";

const CATEGORY_ORDER = ['Street', 'Terrain', 'Satellite', 'Artistic'];

export default function MapOptions({ selectedTileId, onTileChange, onClose }) {
  const byCategory = getTileProvidersByCategory();

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Map Options</h3>
            </div>
            <div className="flex items-center gap-2">
    <Grab className="w-4 h-4 text-gray-400" />
    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
      <X className="w-4 h-4" />
    </button>
  </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {CATEGORY_ORDER.filter(cat => byCategory[cat]).map(category => (
            <div key={category}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {category}
              </p>
              <div className="space-y-1">
                {byCategory[category].map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => onTileChange(provider.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedTileId === provider.id
                        ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                        : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <span>{provider.label}</span>
                    {selectedTileId === provider.id && (
                      <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <p className="text-[10px] text-gray-400 pt-1">
            All map sources are free and open. Your selection is remembered between sessions.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
