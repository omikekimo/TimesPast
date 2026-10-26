 
import { useEffect }              from 'react';
import { useMap, useMapEvents }   from 'react-leaflet';

// Tells Leaflet to recalculate map dimensions after layout changes.
// Must be used as a child of <MapContainer>.
export function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

// Listens for map clicks and calls onPick with { lat, lng } when picking is active.
// Must be used as a child of <MapContainer>.
export function MapClickHandler({ picking, onPick }) {
  useMapEvents({
    click(e) {
      if (picking) {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}
