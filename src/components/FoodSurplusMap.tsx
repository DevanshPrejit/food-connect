import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";

interface MapListing {
  id: string;
  food_name: string;
  quantity: number;
  urgency: string;
  pickup_location: string;
}

// Generate deterministic pseudo-random coords from a string (for demo purposes)
function locationToCoords(location: string, baseLat: number, baseLng: number): [number, number] {
  let hash = 0;
  for (let i = 0; i < location.length; i++) {
    hash = location.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = baseLat + ((hash % 100) / 1000) - 0.05;
  const lng = baseLng + (((hash >> 8) % 100) / 1000) - 0.05;
  return [lat, lng];
}

const urgencyColors: Record<string, string> = {
  urgent: "#ef4444",
  medium: "#f59e0b",
  safe: "#22c55e",
};

export default function FoodSurplusMap() {
  const [listings, setListings] = useState<MapListing[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, food_name, quantity, urgency, pickup_location")
        .eq("status", "pending");
      if (data) setListings(data);
    };
    fetch();
  }, []);

  const markers = useMemo(
    () =>
      listings.map((l) => ({
        ...l,
        coords: locationToCoords(l.pickup_location, 13.35, 74.79), // Default center near Manipal/Udupi
      })),
    [listings]
  );

  const center: [number, number] = markers.length > 0
    ? [
        markers.reduce((s, m) => s + m.coords[0], 0) / markers.length,
        markers.reduce((s, m) => s + m.coords[1], 0) / markers.length,
      ]
    : [13.35, 74.79];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-foreground text-sm">📍 Surplus Food Locations</h3>
        <p className="text-xs text-muted-foreground">Hover over markers to see details</p>
      </div>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "250px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={m.coords}
            radius={Math.min(8 + m.quantity, 20)}
            pathOptions={{
              color: urgencyColors[m.urgency] || "#22c55e",
              fillColor: urgencyColors[m.urgency] || "#22c55e",
              fillOpacity: 0.6,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-sm">
                <strong>{m.food_name}</strong>
                <br />
                {m.quantity} meals · {m.urgency}
                <br />
                📍 {m.pickup_location}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {listings.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-3">No surplus food right now</p>
      )}
    </div>
  );
}
