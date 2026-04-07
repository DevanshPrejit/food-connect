import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const donorIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const ngoIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [50, 50] });
    }
  }, [map, positions]);
  return null;
}

interface Props {
  donorPosition: [number, number];
  ngoPosition: [number, number];
}

export default function PickupMap({ donorPosition, ngoPosition }: Props) {
  return (
    <div className="rounded-xl overflow-hidden border shadow-sm">
      <MapContainer
        center={donorPosition}
        zoom={13}
        style={{ height: "300px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={donorPosition} icon={donorIcon} />
        <Marker position={ngoPosition} icon={ngoIcon} />
        <Polyline positions={[donorPosition, ngoPosition]} color="hsl(142, 72%, 29%)" dashArray="8" />
        <FitBounds positions={[donorPosition, ngoPosition]} />
      </MapContainer>
      <div className="flex items-center justify-between bg-card p-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-primary" /> Donor
          <span className="h-3 w-3 rounded-full bg-secondary ml-3" /> NGO
        </span>
        <span className="font-medium text-muted-foreground">📍 ~15 mins away</span>
      </div>
    </div>
  );
}
