import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';

export const SHEET_SIZES = {
  HIDDEN: 0,
  PILL:   48,
  HALF:   0.5,
  TALL:   0.75,
  FULL:   0.92,
};

export default function MobileBottomSheet({
  open,
  onClose,
  size = SHEET_SIZES.HALF,
  title,
  children,
  collapsed = false,
  // Allow sheet to be expanded to full height by the user
  expandable = true,
}) {
  const screenH = window.innerHeight;
  const [expanded, setExpanded] = useState(false);

  const effectiveSize = expanded ? SHEET_SIZES.FULL : size;
  const sheetH = collapsed
    ? SHEET_SIZES.PILL
    : Math.round(screenH * effectiveSize);

  const contentH = sheetH - (title ? 80 : 52); // subtract handle + title height

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          {!collapsed && (
            <motion.div
              className="fixed inset-0 bg-black/40 z-[900]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
          )}

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[910] bg-white rounded-t-2xl shadow-2xl flex flex-col"
            initial={{ y: screenH }}
            animate={{ y: screenH - sheetH }}
            exit={{ y: screenH }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ height: sheetH }}
          >
            {/* Drag handle row */}
            <div
              className="flex justify-center pt-2 pb-1 flex-shrink-0 cursor-pointer"
              onClick={collapsed ? undefined : onClose}
            >
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Title row */}
            {title && !collapsed && (
              <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100 flex-shrink-0">
                <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                {expandable && (
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    title={expanded ? 'Reduce' : 'Expand to full screen'}
                  >
                    {expanded
                      ? <Minimize2 className="w-4 h-4" />
                      : <Maximize2 className="w-4 h-4" />
                    }
                  </button>
                )}
              </div>
            )}

            {/* Collapsed pill label */}
            {collapsed && (
              <div className="flex items-center justify-center h-8 flex-shrink-0">
                <span className="text-xs text-blue-600 font-medium animate-pulse">
                  🎯 Tap map to set location
                </span>
              </div>
            )}

            {/* Scrollable content */}
            {!collapsed && (
              <div
                className="overflow-y-auto flex-1 overscroll-contain"
                style={{ height: contentH }}
              >
                {children}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
