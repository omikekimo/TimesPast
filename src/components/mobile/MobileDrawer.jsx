import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Calendar, Search, Terminal, Info, Layers } from 'lucide-react';
import PeopleSearch from '../layers/PeopleSearch';
import CustomQueryPanel from '../layers/CustomQueryPanel';
import EventSearchPanel from '../layers/EventSearch';
import LayerSwitcher from '../layers/LayerSwitcher';
import AboutPanel from "../ui/AboutPanel";
import SessionPanel from "../session/SessionPanel";

// Section separator
function DrawerSection({ title, children }) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      {title && (
        <div className="px-4 py-2 bg-gray-50">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            {title}
          </span>
        </div>
      )}
      <div className="px-2 py-3">
        {children}
      </div>
    </div>
  );
}

export default function MobileDrawer({
  open,
  onClose,
  // Layer state
  activeLayers,
  onLayerToggle,
  // Search handlers
  onSparqlSearch,
  onCustomQuery,
  onEventSearch,
  isSearching,
  selectedCategories,
  onCategoryChange,
  // Console / About toggles
  onToggleConsole,
  onToggleSession,
  onToggleAbout,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-[800]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            className="fixed top-0 left-0 bottom-0 z-[810] bg-white shadow-2xl overflow-y-auto"
            style={{ width: '100vw', maxWidth: 420 }}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <img src="/tplogo.png" style={{ width: 28, height: 'auto' }} alt="TimesPast" />
                <span className="font-bold text-gray-900">TimesPast</span>
              </div>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Layers */}
            <DrawerSection title="Layers">
              <LayerSwitcher activeLayers={activeLayers} onLayerToggle={onLayerToggle} />
            </DrawerSection>

            {/* People search */}
            {activeLayers.includes('people') && (
              <DrawerSection title="People Search">
                <PeopleSearch
                  onSearch={onSparqlSearch}
                  isSearching={isSearching}
                />
              </DrawerSection>
            )}

            {/* Events search */}
            {activeLayers.includes('events') && (
              <DrawerSection title="Event Search">
                <EventSearchPanel
                  onSearch={onEventSearch}
                  isSearching={isSearching}
                  selectedCategories={selectedCategories}
                  onCategoryChange={onCategoryChange}
                />
              </DrawerSection>
            )}

            {/* Custom query */}
            {activeLayers.includes('customQueries') && (
              <DrawerSection title="Custom Query">
                <CustomQueryPanel
                  onSearch={onCustomQuery}
                  isSearching={isSearching}
                />
              </DrawerSection>
            )}

             {/* sesson controls */}
            {activeLayers.includes('session') && (
              <DrawerSection title="Session">
                <SessionPanel

                />
              </DrawerSection>
            )}

             {/* about */}
            {activeLayers.includes('about') && (
              <DrawerSection title="about">
                <AboutPanel
                    //onToggleAbout={onToggleAbout}
                />
              </DrawerSection>
            )}


          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
