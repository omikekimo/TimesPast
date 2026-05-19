
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Trash2, Calendar, MapPin, Grab } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const categoryColors = {
  war: "bg-red-100 text-red-800",
  politics: "bg-purple-100 text-purple-800",
  culture: "bg-green-100 text-green-800",
  science: "bg-blue-100 text-blue-800",
  natural_disaster: "bg-orange-100 text-orange-800",
  economics: "bg-yellow-100 text-yellow-800",
  religion: "bg-indigo-100 text-indigo-800",
  exploration: "bg-cyan-100 text-cyan-800"
};

export default function EventComparison({
  events,
  onRemoveEvent,
  onClearAll,
  className
}) {
  const getTimeSpan = () => {
    if (events.length < 2) return null;
    const years = events.map(e => e.year).sort((a, b) => a - b);
    return years[years.length - 1] - years[0];
  };

  const getAverageDistance = () => {
    if (events.length < 2) return null;
    let totalDistance = 0;
    let pairs = 0;

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const lat1 = events[i].latitude * Math.PI / 180;
        const lat2 = events[j].latitude * Math.PI / 180;
        const deltaLat = (events[j].latitude - events[i].latitude) * Math.PI / 180;
        const deltaLng = (events[j].longitude - events[i].longitude) * Math.PI / 180;

        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = 6371 * c; // Earth's radius in km

        totalDistance += distance;
        pairs++;
      }
    }

    return Math.round(totalDistance / pairs);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="w-96 max-h-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
              Event Comparison ({events.length}/4)
            </h3>
            <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClearAll}
                  className="text-gray-400 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Grab className="w-4 h-4 text-gray-400 ml-2" />
            </div>
          </div>

          {events.length > 1 && (
            <div className="text-sm text-gray-600 space-y-1">
              {getTimeSpan() && (
                <div>Time span: {getTimeSpan()} years</div>
              )}
              {getAverageDistance() && (
                <div>Avg. distance: {getAverageDistance().toLocaleString()} km</div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 text-sm truncate">
                    {event.title}
                  </h4>

                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs ${categoryColors[event.category]}`}>
                      {event.category.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {event.year}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.latitude.toFixed(1)}, {event.longitude.toFixed(1)}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveEvent(event.id)}
                  className="text-gray-400 hover:text-red-600 h-6 w-6"
                >
                  <X className="w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>

          {events.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <div className="text-sm">No events selected for comparison</div>
              <div className="text-xs mt-1">Click on map pins to add events</div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
