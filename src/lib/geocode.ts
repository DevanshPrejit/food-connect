const cache = new Map<string, [number, number]>();

export async function geocode(location: string): Promise<[number, number] | null> {
  if (cache.has(location)) return cache.get(location)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      { headers: { Accept: "application/json" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      cache.set(location, coords);
      return coords;
    }
  } catch (e) {
    console.error("Geocoding failed for:", location, e);
  }
  return null;
}
