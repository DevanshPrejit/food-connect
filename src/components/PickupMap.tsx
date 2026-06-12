import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { geocode } from "@/lib/geocode";
import "leaflet/dist/leaflet.css";

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
  donorLocation: string;
  ngoLocation: string;
}

export default function PickupMap({ donorLocation, ngoLocation }: Props) {
  const [donorPos, setDonorPos] = useState<[number, number] | null>(null);
  const [ngoPos, setNgoPos] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  useEffect(() => {
    setDonorPos(null);
    setNgoPos(null);
    setRoute(null);
    setRouteLoading(true);
    setRouteError(null);
    setGeocodeError(null);

    let active = true;

    async function resolvePositions() {
      try {
        const [donorResult, ngoResult] = await Promise.all([
          geocode(donorLocation),
          geocode(ngoLocation),
        ]);

        if (!active) return;

        if (!donorResult || !ngoResult) {
          setGeocodeError("Unable to resolve donor or NGO location. Please check the addresses.");
          setRouteLoading(false);
          return;
        }

        setDonorPos(donorResult);
        setNgoPos(ngoResult);
      } catch (error) {
        if (!active) return;
        setGeocodeError("Geocoding failed. Please try again later.");
        setRouteLoading(false);
      }
    }

    resolvePositions();

    return () => {
      active = false;
    };
  }, [donorLocation, ngoLocation]);

  useEffect(() => {
    if (!donorPos || !ngoPos) {
      return;
    }

    setRouteLoading(true);
    setRouteError(null);

    const controller = new AbortController();
    const [donorLat, donorLng] = donorPos;
    const [ngoLat, ngoLng] = ngoPos;
    const url = `https://router.project-osrm.org/route/v1/driving/${donorLng},${donorLat};${ngoLng},${ngoLat}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data?.code === "Ok" && data.routes?.[0]?.geometry?.coordinates?.length) {
          setRoute(
            data.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
            )
          );
          setRouteError(null);
        } else {
          throw new Error("Routing data unavailable");
        }
      })
      .catch((error) => {
        if ((error as any).name !== "AbortError") {
          setRoute([donorPos, ngoPos]);
          setRouteError("Unable to load route; showing straight-line path.");
        }
      })
      .finally(() => setRouteLoading(false));

    return () => controller.abort();
  }, [donorPos, ngoPos]);

  if (geocodeError) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-red-600">
        {geocodeError}
      </div>
    );
  }

  if (!donorPos || !ngoPos) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading map...
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border shadow-sm">
      <MapContainer
        center={donorPos}
        zoom={13}
        style={{ height: "300px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={donorPos} icon={donorIcon} />
        <Marker position={ngoPos} icon={ngoIcon} />
        {route && (
          <Polyline
            positions={route}
            color="hsl(142, 72%, 29%)"
            dashArray={routeError ? "8" : undefined}
          />
        )}
        <FitBounds positions={route ?? [donorPos, ngoPos]} />
      </MapContainer>
      <div className="flex items-center justify-between bg-card p-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-primary" /> Donor
          <span className="h-3 w-3 rounded-full bg-secondary ml-3" /> NGO
        </span>
        <span className="font-medium text-muted-foreground">
          {routeLoading ? "Routing pickup path…" : routeError ? "Straight-line fallback route" : "📍 Pickup route"}
        </span>
      </div>
    </div>
  );
}
