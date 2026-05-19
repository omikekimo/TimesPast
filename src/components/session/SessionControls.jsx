import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  Clock,
  Database
} from "lucide-react";
import { motion } from "framer-motion";

export default function SessionControls({
  onSaveSession,
  onLoadSession,
  onClearSession,
  onExportData,
  onImportData,
  currentSessionInfo
}) {
  const [sessionName, setSessionName] = useState("");
  const [savedSessions, setSavedSessions] = useState([]);

  const handleSaveSession = () => {
    if (!sessionName.trim()) return;

    const sessionData = {
      id: Date.now(),
      name: sessionName,
      timestamp: new Date().toISOString(),
      ...currentSessionInfo
    };

    const updated = [...savedSessions, sessionData];
    setSavedSessions(updated);
    localStorage.setItem('timesPastSessions', JSON.stringify(updated));
    onSaveSession(sessionData);
    setSessionName("");
  };

  const handleLoadSession = (session) => {
    onLoadSession(session);
  };

  const handleDeleteSession = (sessionId) => {
    const updated = savedSessions.filter(s => s.id !== sessionId);
    setSavedSessions(updated);
    localStorage.setItem('timesPastSessions', JSON.stringify(updated));
  };

  React.useEffect(() => {
    const stored = localStorage.getItem('timesPastSessions');
    if (stored) {
      setSavedSessions(JSON.parse(stored));
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="w-80 elegant-shadow bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Session Control</h3>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Current Session Info */}
          {currentSessionInfo && (
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Current Session</span>
              </div>
              <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                <div>Events: {currentSessionInfo.eventCount || 0}</div>
                <div>Active Layers: {currentSessionInfo.activeLayers?.length || 0}</div>
                <div>Time Range: {currentSessionInfo.timeRange?.start} - {currentSessionInfo.timeRange?.end}</div>
              </div>
            </div>
          )}

          {/* Save Current Session */}
          <div className="space-y-2">
            <Input
              placeholder="Session name..."
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveSession}
                disabled={!sessionName.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button
                onClick={onClearSession}
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Saved Sessions */}
          {savedSessions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Saved Sessions</h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {savedSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {session.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleLoadSession(session)}
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteSession(session.id)}
                        className="h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Export/Import */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Button
                onClick={onExportData}
                variant="outline"
                className="flex-1 text-xs dark:border-gray-600 dark:text-gray-300"
              >
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
              <Button
                onClick={onImportData}
                variant="outline"
                className="flex-1 text-xs dark:border-gray-600 dark:text-gray-300"
              >
                <Upload className="w-3 h-3 mr-1" />
                Import
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
