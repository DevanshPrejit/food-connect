const cache = new Map<string, string>();

type NominatimReverseResponse = {
  display_name?: string;
  address?: Record<string, unknown>;
};

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lon))}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) return null;

    const data = (await res.json()) as NominatimReverseResponse;
    const address = typeof data?.display_name === "string" ? data.display_name.trim() : "";
    if (!address) return null;

    cache.set(key, address);
    return address;
  } catch (e) {
    console.error("Reverse geocoding failed for:", lat, lon, e);
    return null;
  }
}

