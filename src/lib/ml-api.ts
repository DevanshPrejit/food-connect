/**
 * ML Service API client
 *
 * Calls the FastAPI scoring / dispatch endpoints through the Vite proxy
 * (/api → localhost:8000) during development. In production set
 * VITE_ML_SERVICE_URL to the deployed FastAPI URL.
 */

const ML_API = import.meta.env.VITE_ML_API_URL || "https://food-connect-1snn.onrender.com"

// ── Types ──────────────────────────────────────────

export interface FoodItemPayload {
  name: string;
  category: string;
  veg_status: string;
  quantity_kg: number;
}

export interface DonorPayload {
  donor_name: string;
  food_type?: string;
  food_items?: FoodItemPayload[];
  quantity_kg: number;
  expiry_time: string; // ISO-8601
  pickup_location: string;
}

export interface NGOPayload {
  name: string;
  contact: string;
  accepted_types: string[];
  trip_features: Record<string, number>;
}

export interface ScoredNGO {
  ngo_name: string;
  ngo_contact: string;
  predicted_time_min: number;
  urgency_score: number;
  compatibility: number;
  final_score: number;
  eligible: boolean;
  rank: number;
}

export interface DonationRequest {
  donation_id: string;
  donor: DonorPayload;
  ngo_list: NGOPayload[];
}

// ── Health check ───────────────────────────────────

export async function checkMLHealth(): Promise<{
  status: string;
  model: string;
} | null> {
  try {
    const res = await fetch(`${ML_API}/health`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── Score NGOs ─────────────────────────────────────

export async function scoreNGOs(
  donationId: string,
  donor: DonorPayload,
  ngoList: NGOPayload[]
): Promise<ScoredNGO[]> {
  const body: DonationRequest = {
    donation_id: donationId,
    donor,
    ngo_list: ngoList,
  };

  const res = await fetch(`${ML_API}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ML score failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Dispatch donation ──────────────────────────────

export async function dispatchDonation(
  donationId: string,
  donor: DonorPayload,
  ngoList: NGOPayload[]
): Promise<{ status: string; donation_id: string }> {
  const body: DonationRequest = {
    donation_id: donationId,
    donor,
    ngo_list: ngoList,
  };

  const res = await fetch(`${ML_API}/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ML dispatch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Helper: build NGO payload from Supabase profile ──

export function buildNGOPayload(
  profile: {
    id: string;
    user_id: string;
    name: string;
    role: string;
    location: string;
    created_at: string;
  },
  donorLocation: string,
  mobileNumber: string = "",
  distanceKm: number = 10.0   // ← real distance passed in
): NGOPayload {
  const hour = new Date().getHours();
  const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19);
  const travelTime = distanceKm * (isRushHour ? 3.5 : 2.5); // mins per km estimate

  return {
    name: profile.name,
    contact: mobileNumber || profile.user_id,
    accepted_types: ["cooked_meals", "raw_vegetables", "bakery",
      "fruits", "packaged", "dairy"],
    trip_features: {
      osrm_time: travelTime,
      osrm_distance: distanceKm,
      actual_distance_to_destination: distanceKm * 1.05,
      route_type_encoded: 0,
      segment_osrm_time: travelTime,
      segment_osrm_distance: distanceKm,
      start_scan_to_end_scan: travelTime + 2,
      distance_efficiency: 1.05,
      segment_time_ratio: 1.0,
    },
  };
}

// Haversine formula — calculates real distance between two coordinates
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const _geocodeCache: Record<string, { lat: number; lon: number } | null> = {};

export async function geocodeLocation(location: string): Promise<{ lat: number; lon: number } | null> {
  if (_geocodeCache[location] !== undefined) return _geocodeCache[location];

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FoodConnect/1.0" }
    });
    const data = await res.json();
    const result = data.length > 0
      ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      : null;
    _geocodeCache[location] = result;
    return result;
  } catch {
    _geocodeCache[location] = null;
    return null;
  }
}