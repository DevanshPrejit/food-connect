import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import { geocode } from "@/lib/geocode";
import "leaflet/dist/leaflet.css";

interface MapListing {
  id: string;
  food_name: string;
  quantity: number;
  urgency: string;
  pickup_location: string;
}

interface MarkerData extends MapListing {
  coords: [number, number];
}

const urgencyColors: Record<string, string> = {
  urgent: "#ef4444",
  medium: "#f59e0b",
  safe: "#22c55e",
};

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function FoodSurplusMap() {
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndGeocode = async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, food_name, quantity, urgency, pickup_location")
        .eq("status", "pending");
      if (!data || data.length === 0) {
        setMarkers([]);
        setLoading(false);
        return;
      }
      const results: MarkerData[] = [];
      for (const l of data) {
        const coords = await geocode(l.pickup_location);
        if (coords) results.push({ ...l, coords });
      }
      setMarkers(results);
      setLoading(false);
    };
    fetchAndGeocode();
  }, []);

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
        {markers.length > 0 && <RecenterMap center={center} />}
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
      {!loading && markers.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-3">No surplus food right now</p>
      )}
    </div>
  );
}
