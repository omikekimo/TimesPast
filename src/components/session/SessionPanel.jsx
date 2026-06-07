import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import {
  Save, FolderOpen, Trash2, Download, Upload, Clock, Grab
} from "lucide-react";

export default function SessionPanel({
  onSaveSession,
  onLoadSession,
  onClearSession,
  onExportData,
  onImportData,
  currentSessionInfo,
}) {
  const [sessionName, setSessionName]     = useState("");
  const [savedSessions, setSavedSessions] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('timesPastSessions');
    if (stored) {
      try { setSavedSessions(JSON.parse(stored)); } catch (_) {}
    }
  }, []);

  const handleSave = () => {
    if (!sessionName.trim()) return;
    const sessionData = {
      id:        Date.now(),
      name:      sessionName.trim(),
      timestamp: new Date().toISOString(),
      ...currentSessionInfo,
    };
    const updated = [...savedSessions, sessionData];
    setSavedSessions(updated);
    localStorage.setItem('timesPastSessions', JSON.stringify(updated));
    onSaveSession(sessionData);
    setSessionName("");
  };

  const handleDelete = (sessionId) => {
    const updated = savedSessions.filter(s => s.id !== sessionId);
    setSavedSessions(updated);
    localStorage.setItem('timesPastSessions', JSON.stringify(updated));
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Session</h3>
            </div>
            <Grab className="w-4 h-4 text-gray-400" />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Current session info */}
          {currentSessionInfo && (
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Current session</p>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                <div>Events: {currentSessionInfo.eventCount || 0}</div>
                <div>Layers: {currentSessionInfo.activeLayers?.length || 0} active</div>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="space-y-2">
            <Input
              placeholder="Session name..."
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!sessionName.trim()}
                size="sm"
                className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
              <Button
                onClick={onClearSession}
                variant="outline"
                size="sm"
                className="h-8 px-2 border-red-200 text-red-600 hover:bg-red-50"
                title="Clear current session"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Saved sessions list */}
          {savedSessions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Saved</p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {[...savedSessions].reverse().map(session => (
                  <div key={session.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{session.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost"
                        onClick={() => onLoadSession(session)}
                        className="h-6 w-6 text-blue-500 hover:text-blue-700"
                        title="Load session"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        onClick={() => handleDelete(session.id)}
                        className="h-6 w-6 text-red-400 hover:text-red-600"
                        title="Delete session"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export / Import */}
          <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Data</p>
            <div className="flex gap-2">
              <Button onClick={onExportData} variant="outline" size="sm"
                className="flex-1 h-8 text-xs">
                <Upload className="w-3 h-3 mr-1" /> Export
              </Button>
              <Button onClick={onImportData} variant="outline" size="sm"
                className="flex-1 h-8 text-xs">
                <Download className="w-3 h-3 mr-1" /> Import
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
