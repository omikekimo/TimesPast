 import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import DraggablePanel from './DraggablePanel';

// Detects Wikimedia Commons Special:FilePath URLs and direct image URLs
function isImageUrl(url) {
  return url.includes('Special:FilePath') ||
    /\.(jpg|jpeg|png|gif|webp|svg)/i.test(url);
}

export default function ImageViewer({ imageUrl, title, onClose }) {
  if (!imageUrl) return null;

  return (
    <DraggablePanel
      initialPosition={{ x: Math.max(40, window.innerWidth / 2 - 300), y: 80 }}
      dragHandleClassName="drag-handle"
    >
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200" style={{ width: 580 }}>

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b drag-handle">
          <span className="text-sm font-medium text-gray-700 truncate flex-1 mr-4">{title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={imageUrl} target="_blank" rel="noreferrer"
              className="text-gray-400 hover:text-blue-600 transition-colors" title="Open full size in browser">
              <ExternalLink className="w-4 h-4" />
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="p-3 bg-gray-900 flex items-center justify-center" style={{ minHeight: 200 }}>
          <img
            src={imageUrl}
            alt={title}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            className="rounded"
            onError={e => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none' }}
            className="text-gray-400 text-sm flex items-center justify-center h-32">
            Image could not be loaded
          </div>
        </div>

      </div>
    </DraggablePanel>
  );
}

export { isImageUrl };
