import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Sizes the sheet can snap to
export const SHEET_SIZES = {
  HIDDEN:    0,    // fully offscreen
  PILL:      48,   // just a drag handle visible — used during map picking
  HALF:      0.5,  // 50% of screen height
  TALL:      0.75, // 75% of screen height
  FULL:      0.92, // nearly full screen
};

export default function MobileBottomSheet({
  open,
  onClose,
  size = SHEET_SIZES.HALF,
  title,
  children,
  // When true, collapses to pill (used during location picking)
  collapsed = false,
}) {
  const screenH = window.innerHeight;
  const sheetH  = collapsed
    ? SHEET_SIZES.PILL
    : Math.round(screenH * size);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — only when not collapsed */}
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
            className="fixed bottom-0 left-0 right-0 z-[910] bg-white rounded-t-2xl shadow-2xl overflow-hidden"
            initial={{ y: screenH }}
            animate={{ y: screenH - sheetH }}
            exit={{ y: screenH }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ height: sheetH }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 cursor-pointer" onClick={collapsed ? undefined : onClose}>
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Title */}
            {title && !collapsed && (
              <div className="px-4 pb-2 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
              </div>
            )}

            {/* Collapsed pill label */}
            {collapsed && (
              <div className="flex items-center justify-center h-8">
                <span className="text-xs text-blue-600 font-medium animate-pulse">
                  🎯 Tap map to set location
                </span>
              </div>
            )}

            {/* Content */}
            {!collapsed && (
              <div className="overflow-y-auto" style={{ height: sheetH - 60 }}>
                {children}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
