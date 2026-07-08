import React from 'react';
import { Switch } from "@/components/ui/switch";
import {
  Users, Calendar, Map, Cloud, Grab, Search, Terminal, Info, FolderOpen,
  Boxes, Zap, BookOpen, Lightbulb, Swords, Building2, Leaf, Cpu, FlaskConical, Bot,
} from "lucide-react";

// ── Section definitions ───────────────────────────────────────────────────────
const sections = [
  {
    label: 'Agents',
    layers: [
      { id: 'people',           label: 'People',            icon: Users,    color: 'bg-amber-100 text-amber-800' },
      { id: 'organisations',    label: 'Organisations',     icon: Building2,color: 'bg-orange-100 text-orange-800', disabled: false },
      { id: 'livingEntities',   label: 'Living Entities',   icon: Leaf,     color: 'bg-lime-100 text-lime-800',     disabled: false },
      { id: 'artificialAgents', label: 'Artificial Agents', icon: Bot,      color: 'bg-sky-100 text-sky-800',       disabled: false },
    ],
  },
  {
    label: 'Occurrences',
    layers: [
      { id: 'events',        label: 'Events',           icon: Calendar,    color: 'bg-blue-100 text-blue-800' },
      { id: 'phenomena',     label: 'Phenomena',        icon: Zap,         color: 'bg-yellow-100 text-yellow-800', disabled: false },
      { id: 'weather',       label: 'Weather',          icon: Cloud,       color: 'bg-cyan-100 text-cyan-800',     disabled: false },
      { id: 'conflicts',     label: 'Conflicts',        icon: Swords,      color: 'bg-red-100 text-red-800',       disabled: false },
    ],
  },
  {
    label: 'Entities',
    layers: [
      { id: 'places',        label: 'Places',           icon: Map,         color: 'bg-green-100 text-green-800',   disabled: false },
      { id: 'objects',       label: 'Objects',          icon: Boxes,       color: 'bg-stone-100 text-stone-800',   disabled: false },
      { id: 'technology',    label: 'Technology',       icon: Cpu,         color: 'bg-indigo-100 text-indigo-800', disabled: false },
      { id: 'works',         label: 'Works',            icon: BookOpen,    color: 'bg-rose-100 text-rose-800',     disabled: false },
    ],
  },
  {
    label: 'Abstractions',
    layers: [
      { id: 'customQueries', label: 'Custom Queries',   icon: Search,      color: 'bg-violet-100 text-violet-800' },
      { id: 'concepts',      label: 'Concepts & Ideas', icon: Lightbulb,   color: 'bg-purple-100 text-purple-800', disabled: false },
      { id: 'sciences',      label: 'Sciences',         icon: FlaskConical,color: 'bg-teal-100 text-teal-800',     disabled: false },
    ],
  },
  {
    label: 'System',
    layers: [
      { id: 'session',       label: 'Session',          icon: FolderOpen,  color: 'bg-emerald-100 text-emerald-800' },
      { id: 'console',       label: 'Console',          icon: Terminal,    color: 'bg-gray-700 text-green-300' },
      { id: 'about',         label: 'About',            icon: Info,        color: 'bg-gray-700 text-green-300' },
    ],
  },
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

      <div className="p-4 pt-0 space-y-4">
        {sections.map((section, sIdx) => (
          <div key={section.label}>
            {/* Divider + section label */}
            {sIdx > 0 && <hr className="border-t border-gray-200 dark:border-gray-700 mb-3" />}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              {section.label}
            </p>

            {/* Layer toggles */}
            <div className="space-y-3">
              {section.layers.map(layer => {
                const isActive = activeLayers.includes(layer.id);
                return (
                  <div key={layer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <layer.icon
                        className={`w-4 h-4 ${layer.disabled ? 'text-gray-300' : isActive ? 'text-gray-700' : 'text-gray-400'}`}
                      />
                      <span
                        className={`text-sm font-medium ${layer.disabled ? 'text-gray-300' : isActive ? 'text-gray-900' : 'text-gray-500'}`}
                      >
                        {layer.label}
                      </span>
                      {isActive && !layer.disabled && (
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
          </div>
        ))}
      </div>

      {/* Footer — unchanged */}
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
