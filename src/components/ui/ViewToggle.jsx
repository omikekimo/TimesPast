import React from "react";
import { Button } from "@/components/ui/button";
import { Globe, Map as MapIcon } from "lucide-react";

export default function ViewToggle({ currentView, onViewChange }) {
  return (
    <div className="flex flex-col gap-1 w-full px-3">
        <Button
          variant={currentView === 'map' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('map')}
          className="flex items-center gap-2 justify-start w-full text-text-primary dark:text-gray-100 dark:hover:bg-blue-900/40"
        >
          <MapIcon className="w-4 h-4" />
          <span>Map View</span>
        </Button>
        <Button
          variant={currentView === 'globe' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onViewChange('globe')}
          className="flex items-center gap-2 justify-start w-full text-text-primary dark:text-gray-100 dark:hover:bg-blue-900/40"
        >
          <Globe className="w-4 h-4" />
          <span>Globe View</span>
        </Button>
    </div>
  );
}
