import React from 'react';
import { Switch } from "@/components/ui/switch";
import {
  Users, Calendar, Map, Cloud, Grab, Search, Terminal, Info, FolderOpen,
  Boxes, Zap, BookOpen, Lightbulb, Swords, Building2, Leaf, Cpu, FlaskConical, Bot, SlidersHorizontal
} from "lucide-react";

// hasSearch: true  = search panel exists now
// hasSearch: false = search panel planned but not built yet (greyed-out toggle)
// hasSearch: absent = no search panel ever (single toggle only)
const sections = [
  {
    label: 'Agents',
    layers: [
      { id: 'people',           label: 'People',            icon: Users,    color: 'bg-amber-100 text-amber-800',   hasSearch: true  },
      { id: 'organisations',    label: 'Organisations',     icon: Building2,color: 'bg-orange-100 text-orange-800', hasSearch: false },
      { id: 'livingEntities',   label: 'Living Entities',   icon: Leaf,     color: 'bg-lime-100 text-lime-800',     hasSearch: false },
      { id: 'artificialAgents', label: 'Artificial Agents', icon: Bot,      color: 'bg-sky-100 text-sky-800',       hasSearch: false },
    ],
  },
  {
    label: 'Occurrences',
    layers: [
      { id: 'events',        label: 'Events',           icon: Calendar,    color: 'bg-blue-100 text-blue-800',     hasSearch: true  },
      { id: 'phenomena',     label: 'Phenomena',        icon: Zap,         color: 'bg-yellow-100 text-yellow-800', hasSearch: false },
      { id: 'weather',       label: 'Weather',          icon: Cloud,       color: 'bg-cyan-100 text-cyan-800',     hasSearch: false },
      { id: 'conflicts',     label: 'Conflicts',        icon: Swords,      color: 'bg-red-100 text-red-800',       hasSearch: false },
    ],
  },
  {
    label: 'Entities',
    layers: [
      { id: 'places',        label: 'Places',           icon: Map,         color: 'bg-green-100 text-green-800',   hasSearch: false },
      { id: 'objects',       label: 'Objects',          icon: Boxes,       color: 'bg-stone-100 text-stone-800',   hasSearch: false },
      { id: 'technology',    label: 'Technology',       icon: Cpu,         color: 'bg-indigo-100 text-indigo-800', hasSearch: false },
      { id: 'works',         label: 'Works',            icon: BookOpen,    color: 'bg-rose-100 text-rose-800',     hasSearch: false },
    ],
  },
  {
    label: 'Abstractions',
   layers: [
  { id: 'concepts', label: 'Concepts & Ideas', icon: Lightbulb, color: 'bg-purple-100 text-purple-800', hasSearch: false },
  { id: 'sciences', label: 'Sciences', icon: FlaskConical, color: 'bg-teal-100 text-teal-800', hasSearch: false },
  { id: 'customQueries', label: 'Custom Queries', icon: Search, color: 'bg-violet-100 text-violet-800', hasSearch: true, noLayerToggle: true },
],
  },
  {
    label: 'Map Options',
    singleToggle: true,
    layers: [
      { id: 'mapOptions', label: 'Map Options', icon: SlidersHorizontal, color: 'bg-slate-100 text-slate-800' },
    ],
  },
  {
    label: 'System',
    singleToggle: true,
    layers: [
      { id: 'session',       label: 'Session',          icon: FolderOpen,  color: 'bg-emerald-100 text-emerald-800'},
      { id: 'console',       label: 'Console',          icon: Terminal,    color: 'bg-gray-700 text-green-300' },
      { id: 'about',         label: 'About',            icon: Info,        color: 'bg-gray-700 text-green-300' },
    ],
  },
];

export default function LayerSwitcher({ activeLayers, onLayerToggle, openPanels, onPanelToggle }) {
  const toggleLayer = (layerId) => {
    if (activeLayers.includes(layerId)) {
      onLayerToggle(activeLayers.filter(id => id !== layerId));
    } else {
      onLayerToggle([...activeLayers, layerId]);
    }
  };

  const togglePanel = (layerId) => {
    if (openPanels.includes(layerId)) {
      onPanelToggle(openPanels.filter(id => id !== layerId));
    } else {
      onPanelToggle([...openPanels, layerId]);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl elegant-shadow p-0 w-80 border dark:border-gray-700">
      <div className="flex items-center justify-between p-4 drag-handle">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Active Layers</h3>
        <Grab className="w-4 h-4 text-gray-400" />
      </div>

      <div className="p-4 pt-0 space-y-4">

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center mb-1">
          <span />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 w-14 text-center">View Layer</span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 w-14 text-center">View Search</span>
        </div>

        {sections.map((section, sIdx) => (
          <div key={section.label}>
            {sIdx > 0 && <hr className="border-t border-gray-200 dark:border-gray-700 mb-3" />}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              {section.label}
            </p>

            <div className="space-y-3">
              {section.layers.map(layer => {
                const isActive  = activeLayers.includes(layer.id);
                const panelOpen = openPanels.includes(layer.id);

                return (
                  <div key={layer.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center">

                    {/* Icon + label */}
                    <div className="flex items-center gap-2 min-w-0">
                      <layer.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gray-700' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                        {layer.label}
                      </span>
                      {isActive && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${layer.color}`}>
                          On
                        </span>
                      )}
                    </div>

                    {/* View Layer toggle — blue */}
                    <div className="w-14 flex justify-center">

                    {layer.noLayerToggle ? (
                      <div />
                      ) : (

                      <Switch
                        checked={isActive}
                        onCheckedChange={() => toggleLayer(layer.id)}
                        className="data-[state=checked]:bg-blue-600"
                      />


                        )}

                    </div>

                    {/* View Search toggle */}
                    <div className="w-14 flex justify-center">
                      {!section.singleToggle && (
                        layer.hasSearch === true ? (
                          <Switch
                            checked={panelOpen}
                            onCheckedChange={() => togglePanel(layer.id)}
                            disabled={layer.noLayerToggle ? false : !isActive}
                            className="data-[state=checked]:bg-violet-500"
                          />
                        ) : layer.hasSearch === false ? (
                          <Switch checked={false} disabled={true} className="opacity-30" />
                        ) : null
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {activeLayers.length} layer{activeLayers.length !== 1 ? 's' : ''} active
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Multiple layers can be active simultaneously for cross-analysis
        </p>
        <img src="public/tplogo.png" style={{ width: '30%', height: 'auto' }} />
      </div>
    </div>
  );
}
