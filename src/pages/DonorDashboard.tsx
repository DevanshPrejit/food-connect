import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import UrgencyBadge from "@/components/UrgencyBadge";
import ImpactStats from "@/components/ImpactStats";
import SmartMatch from "@/components/SmartMatch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { computeUrgency } from "@/lib/urgency";
import { reverseGeocode } from "@/lib/reverseGeocode";
import {
  scoreNGOs,
  dispatchDonation,
  buildNGOPayload,
  geocodeLocation,
  haversineDistance,
  type ScoredNGO,
  type DonorPayload,
  type NGOPayload,
} from "@/lib/ml-api";
import { LocateFixed, Plus, Package, Brain } from "lucide-react";

// ── Helpers ────────────────────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mapFoodType(category: string): string {
  const map: Record<string, string> = {
    "cooked_meal": "cooked_meals",
    "bread_bakery": "bakery",
    "snacks_starters": "cooked_meals",
    "dessert_sweets": "bakery",
    "raw_produce": "raw_vegetables",
    "dairy": "dairy",
    "beverages": "packaged",
    "packaged_dry": "packaged",
    "veg": "cooked_meals",
    "non-veg": "cooked_meals",
  };
  return map[category.toLowerCase()] ?? "cooked_meals";
}

interface Listing {
  id: string;
  food_name: string;
  food_type: string;
  quantity: number;
  expiry_time: string;
  pickup_location: string;
  status: string;
  urgency: string;
  created_at: string;
  image_url: string | null;
}

export default function DonorDashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ML Smart Match state
  const [mlResults, setMlResults] = useState<ScoredNGO[] | null>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);
  const [mlVisible, setMlVisible] = useState(false);
  const [mlDonor, setMlDonor] = useState<DonorPayload | null>(null);
  const [mlNgoList, setMlNgoList] = useState<NGOPayload[]>([]);
  const [mlDonationId, setMlDonationId] = useState<string>("");

  // Form state
  const [foodName, setFoodName] = useState("");
  const [foodType, setFoodType] = useState<"veg" | "non-veg">("veg");
  const [quantity, setQuantity] = useState("10");
  const [expiryTime, setExpiryTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "donor")) {
      navigate("/auth");
    }
  }, [user, profile, loading]);

  useEffect(() => {
    if (user) fetchListings();
  }, [user]);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("donor_id", user!.id)
      .order("created_at", { ascending: false });
    if (data) setListings(data);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("donor-listings")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `donor_id=eq.${user.id}`,
        },
        (payload) => {
          setListings((prev) =>
            prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l))
          );
          if (payload.new.status === "accepted") {
            toast.info("🎉 An NGO has accepted your donation!");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Trigger ML scoring ─────────────────────────
  const runSmartMatch = async (donationId: string, donor: DonorPayload) => {
    setMlVisible(true);
    setMlLoading(true);
    setMlError(null);
    setMlResults(null);
    setMlDonor(donor);
    setMlDonationId(donationId);

    try {
      const { data: ngoProfiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "ngo");

      // Geocode donor location once
      const donorCoords = await geocodeLocation(donor.pickup_location);
      console.log("Donor coords:", donorCoords);

      // Sequential loop with delay to avoid Nominatim rate limiting
      const ngoListRaw: (NGOPayload & { distanceKm: number })[] = [];

      for (const p of (ngoProfiles ?? [])) {
        let distanceKm = 99999; // HIGH default — fails 50km filter if geocoding fails

        if (donorCoords && p.location) {
          await delay(1100); // 1.1s between each geocoding call
          const ngoCoords = await geocodeLocation(p.location);
          console.log(`NGO: ${p.name} | Location: ${p.location} | Coords:`, ngoCoords);

          if (ngoCoords) {
            distanceKm = haversineDistance(
              donorCoords.lat, donorCoords.lon,
              ngoCoords.lat, ngoCoords.lon
            );
          }
        }

        console.log(`NGO: ${p.name} | Distance: ${distanceKm.toFixed(1)}km`);

        ngoListRaw.push({
          ...buildNGOPayload(
            {
              id: p.id ?? "",
              user_id: p.user_id ?? "",
              name: p.name ?? "",
              role: "ngo",
              location: p.location ?? "",
              created_at: p.created_at ?? new Date().toISOString(),
            },
            donor.pickup_location,
            p.mobile_number ?? "",
            distanceKm
          ),
          distanceKm,
        });
      }

      // Filter NGOs within 50km radius
      const nearbyNGOs = ngoListRaw.filter((n) => n.distanceKm <= 50);
      console.log(`Nearby NGOs (<=50km): ${nearbyNGOs.length} of ${ngoListRaw.length}`);
      setMlNgoList(nearbyNGOs);

      if (nearbyNGOs.length === 0) {
        setMlResults([]);
        setMlLoading(false);
        toast.warning("No NGOs found within 50km radius.");
        return;
      }

      // Fetch actual food category from food_items
      const { data: foodItems } = await supabase
        .from("food_items")
        .select("category")
        .eq("listing_id", donationId);

      const mappedFoodType =
        foodItems && foodItems.length > 0
          ? mapFoodType(foodItems[0].category)
          : donor.food_type ?? "cooked_meals";

      const ranked = await scoreNGOs(
        donationId,
        { ...donor, food_type: mappedFoodType },
        nearbyNGOs
      );
      setMlResults(ranked);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Smart Match error:", message);
      setMlError(`Error: ${message}`);
    } finally {
      setMlLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!mlDonor || mlNgoList.length === 0) return;
    try {
      await dispatchDonation(mlDonationId, mlDonor, mlNgoList);
      toast.success("Notifications dispatched to top NGOs!");
    } catch {
      toast.error("Failed to dispatch — ML service may be offline.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const urgency = computeUrgency(expiryTime);

    const { data: inserted, error } = await supabase
      .from("listings")
      .insert({
        donor_id: user!.id,
        food_name: foodName,
        food_type: foodType,
        quantity: parseInt(quantity),
        expiry_time: expiryTime,
        pickup_location: pickupLocation,
        urgency,
      })
      .select();

    if (error) {
      toast.error(error.message);
    } else {
      const newId = inserted?.[0]?.id ?? crypto.randomUUID();
      const parsedQuantity = parseInt(quantity);

      await supabase.from("food_items" as any).insert({
        listing_id: newId,
        name: foodName,
        category: mapFoodType(foodType),
        veg_status: foodType === "veg" ? "veg" : "non_veg",
        quantity_kg: parsedQuantity,
      });

      toast.success("Food listing created!");
      setShowForm(false);
      setFoodName("");
      setQuantity("10");
      setExpiryTime("");
      setPickupLocation("");
      fetchListings();

      runSmartMatch(newId, {
        donor_name: profile?.name ?? "Donor",
        food_type: mapFoodType(foodType),
        food_items: [{
          name: foodName,
          category: mapFoodType(foodType),
          veg_status: foodType === "veg" ? "veg" : "non_veg",
          quantity_kg: parsedQuantity,
        }],
        quantity_kg: parsedQuantity,
        expiry_time: new Date(expiryTime).toISOString(),
        pickup_location: pickupLocation,
      });
    }
    setSubmitting(false);
  };

  const handleUseCurrentLocation = async () => {
    if (locating || submitting) return;
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }
    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 30_000,
        });
      });
      const { latitude, longitude } = position.coords;
      const address = await reverseGeocode(latitude, longitude);
      if (address) {
        setPickupLocation(address);
        toast.success("Pickup location updated.");
      } else {
        toast.error("Couldn't determine your address. Please type it in.");
      }
    } catch (err) {
      const e = err as GeolocationPositionError;
      const message =
        e?.code === e.PERMISSION_DENIED
          ? "Location permission denied. Please allow access and try again."
          : e?.code === e.POSITION_UNAVAILABLE
            ? "Your location is currently unavailable. Please try again."
            : e?.code === e.TIMEOUT
              ? "Location request timed out. Please try again."
              : "Couldn't fetch your location. Please try again.";
      toast.error(message);
    } finally {
      setLocating(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      accepted: "bg-secondary/20 text-secondary",
      picked_up: "bg-primary/20 text-primary",
    };
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] || ""}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  const completedListings = listings.filter((l) => l.status === "accepted" || l.status === "picked_up");
  const totalMeals = completedListings.reduce((s, l) => s + l.quantity, 0);
  const completedDonations = completedListings.length;

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Donor Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {profile?.name}</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Food Listing
          </Button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-2xl border bg-card p-6 shadow-sm space-y-4"
          >
            <h2 className="text-lg font-semibold text-foreground">New Food Listing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Food Name</Label>
                <Input
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  required
                  placeholder="e.g. Rice & Curry"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFoodType("veg")}
                    className={`rounded-lg border-2 p-2 text-sm font-medium transition-all ${foodType === "veg"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                      }`}
                  >
                    🥬 Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => setFoodType("non-veg")}
                    className={`rounded-lg border-2 p-2 text-sm font-medium transition-all ${foodType === "non-veg"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border text-muted-foreground"
                      }`}
                  >
                    🍗 Non-Veg
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantity (meals)</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Time</Label>
                <Input
                  type="datetime-local"
                  value={expiryTime}
                  onChange={(e) => setExpiryTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Pickup Location</Label>
                <div className="relative">
                  <Input
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    required
                    placeholder="e.g. 123 Main Street, Mumbai"
                    className="pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={handleUseCurrentLocation}
                    disabled={locating || submitting}
                    aria-label="Use current location"
                    title="Use current location"
                  >
                    <LocateFixed className={locating ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                  </Button>
                </div>
              </div>
            </div>
            {expiryTime && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-tagged:</span>
                <UrgencyBadge urgency={computeUrgency(expiryTime)} />
              </div>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Listing"}
            </Button>
          </form>
        )}

        {mlVisible && (
          <div className="mb-8">
            <SmartMatch
              results={mlResults}
              loading={mlLoading}
              error={mlError}
              onClose={() => setMlVisible(false)}
              onDispatch={handleDispatch}
            />
          </div>
        )}

        <Tabs defaultValue="donations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="donations">My Donations</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="donations">
            {listings.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                <Package className="h-12 w-12" />
                <p>No donations yet. Add your first food listing!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{listing.food_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({listing.food_type})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{listing.quantity} meals</span>
                        <span>📍 {listing.pickup_location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-violet-500 hover:text-violet-600 hover:bg-violet-500/10"
                        onClick={() =>
                          runSmartMatch(listing.id, {
                            donor_name: profile?.name ?? "Donor",
                            food_type: mapFoodType(listing.food_type),
                            food_items: [{
                              name: listing.food_name,
                              category: mapFoodType(listing.food_type),
                              veg_status: listing.food_type.toLowerCase() === "veg" ? "veg" : "non_veg",
                              quantity_kg: listing.quantity,
                            }],
                            quantity_kg: listing.quantity,
                            expiry_time: new Date(listing.expiry_time).toISOString(),
                            pickup_location: listing.pickup_location,
                          })
                        }
                      >
                        <Brain className="h-3.5 w-3.5" />
                        Smart Match
                      </Button>
                      <UrgencyBadge urgency={listing.urgency as "urgent" | "medium" | "safe"} />
                      {statusBadge(listing.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="impact">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                <p className="text-3xl font-bold text-primary">{totalMeals}</p>
                <p className="text-sm text-muted-foreground">Total Meals Donated</p>
              </div>
              <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                <p className="text-3xl font-bold text-primary">{completedDonations}</p>
                <p className="text-sm text-muted-foreground">Completed Donations</p>
              </div>
            </div>
            <ImpactStats />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}