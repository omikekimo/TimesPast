import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Slides in from the top — used for the console on mobile
export default function MobileTopSheet({ open, onClose, title, children, heightPct = 0.55 }) {
  const screenH = window.innerHeight;
  const sheetH  = Math.round(screenH * heightPct);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-[900]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet — slides down from top */}
          <motion.div
            className="fixed top-0 left-0 right-0 z-[910] bg-gray-900 shadow-2xl rounded-b-2xl flex flex-col overflow-hidden"
            initial={{ y: -sheetH }}
            animate={{ y: 0 }}
            exit={{ y: -sheetH }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ height: sheetH }}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 flex-shrink-0 bg-gray-800">
              <span className="text-sm font-semibold text-green-400 font-mono">{title}</span>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {children}
            </div>

            {/* Pull-down handle at bottom */}
            <div className="flex justify-center py-2 flex-shrink-0 cursor-pointer" onClick={onClose}>
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
