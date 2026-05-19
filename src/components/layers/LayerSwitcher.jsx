import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Users, Calendar, Map, Cloud, Grab, Search, Terminal, Info } from "lucide-react";

const layers = [
  { id: 'people',        label: 'People',          icon: Users,    color: 'bg-amber-100 text-amber-800' },
  { id: 'events',        label: 'Events',         icon: Calendar, color: 'bg-blue-100 text-blue-800' },

  { id: 'customQueries', label: 'Custom Queries',  icon: Search,   color: 'bg-violet-100 text-violet-800' },
  { id: 'weather',        label: 'Weather',         icon: Cloud,     color: 'bg-cyan-100 text-cyan-800',    disabled: true },
  { id: 'places',         label: 'Places',          icon: Map,       color: 'bg-green-100 text-green-800',  disabled: true },
  { id: 'console',        label: 'Console',         icon: Terminal,  color: 'bg-gray-700 text-green-300' },
  { id: 'about',        label: 'About',         icon: Info,  color: 'bg-gray-700 text-green-300' },
];

export default function LayerSwitcher({ activeLayers, onLayerToggle }) {
  const toggleLayer = (layerId) => {
    if (activeLayers.includes(layerId)) {
      onLayerToggle(activeLayers.filter(id => id !== layerId));
    } else {
      onLayerToggle([...activeLayers, layerId]);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl elegant-shadow p-0 w-80 border dark:border-gray-700">
      <div className="flex items-center justify-between p-4 drag-handle">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Active Layers</h3>
        <Grab className="w-4 h-4 text-gray-400" />
      </div>
      <div className="p-4 pt-0 space-y-3">
        {layers.map(layer => {
          const isActive = activeLayers.includes(layer.id);
          return (
            <div key={layer.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <layer.icon className={`w-4 h-4 ${isActive ? 'text-gray-700' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {layer.label}
                </span>
                {isActive && (
                  <span className={`text-xs px-2 py-1 rounded-full ${layer.color}`}>
                    Active
                  </span>
                )}
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={() => toggleLayer(layer.id)}
                disabled={layer.disabled}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {activeLayers.length} layer{activeLayers.length !== 1 ? 's' : ''} active
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Multiple layers can be active simultaneously for cross-analysis
        </p>


          <img src="public/tplogo.png" style={{ width: '30%', height: 'auto' }}/>


      </div>
    </div>
  );
}
