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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateMeals } from "@/lib/utils";
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
import { LocateFixed, Plus, Package, Brain, Phone, Trash2 } from "lucide-react";

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
  food_items?: {
    name: string;
    category: string;
    veg_status: string;
    quantity_kg: number;
  }[];
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
  const [impactRefreshKey, setImpactRefreshKey] = useState(0);

  // Form state
  const [foodItems, setFoodItems] = useState([{ name: "", category: "cooked_meal", veg_status: "veg", quantity_kg: "" }]);
  const [expiryTime, setExpiryTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!loading && user && profile?.role === "donor") {
      // User is authenticated and has correct role - stay on dashboard
    } else if (!loading && (!user || profile?.role !== "donor")) {
      navigate("/auth");
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (user) fetchListings();
  }, [user]);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select("*, food_items(*)")
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
            setImpactRefreshKey((k) => k + 1);
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

    const meals = calculateMeals(foodItems.map(i => ({ ...i, quantity_kg: Number(i.quantity_kg) })));
    const mainType = foodItems.some(i => i.veg_status === 'non_veg') ? 'non-veg' : 'veg';
    const mainName = foodItems.length === 1 ? foodItems[0].name : 'Multiple Items';

    const { error } = await supabase.rpc("create_listing_with_items", {
      p_donor_id: user!.id,
      p_food_name: mainName,
      p_food_type: mainType,
      p_quantity: meals,
      p_expiry_time: expiryTime,
      p_pickup_location: pickupLocation,
      p_urgency: urgency,
      p_items: foodItems.map(i => ({ ...i, quantity_kg: Number(i.quantity_kg) }))
    });

    if (error) {
      toast.error(error.message);
    } else {
      // Refresh listings to get the newly created one (including its ID)
      await fetchListings();

      toast.success("Food listing created!");
      setShowForm(false);
      setFoodItems([{ name: "", category: "cooked_meal", veg_status: "veg", quantity_kg: "" }]);
      setExpiryTime("");
      setPickupLocation("");

      // We don't easily have the new ID here from RPC without modifying it, 
      // but fetchListings will update the background. 
      // For immediate Smart Match, we use the first listing if it's new
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-16 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Donor Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {profile?.name}</p>
            {profile?.mobile_number ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" /> {profile.mobile_number}
              </p>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                ⚠️ Add your mobile number so NGOs can reach you
              </p>
            )}
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
              <div className="space-y-4 sm:col-span-2">
                <Label>Food Items</Label>
                <div className="space-y-3">
                  {foodItems.map((item, index) => (
                    <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <Input placeholder="Item name (e.g. Biryani)" value={item.name} onChange={(e) => { const newItems = [...foodItems]; newItems[index].name = e.target.value; setFoodItems(newItems); }} required className="flex-1 min-w-[150px]" />
                      <Select value={item.category} onValueChange={(val) => { const newItems = [...foodItems]; newItems[index].category = val; setFoodItems(newItems); }} required>
                        <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cooked_meal">Cooked Meal</SelectItem>
                          <SelectItem value="bread_bakery">Bread/Bakery</SelectItem>
                          <SelectItem value="snacks_starters">Snacks</SelectItem>
                          <SelectItem value="dessert_sweets">Dessert</SelectItem>
                          <SelectItem value="raw_produce">Raw Produce</SelectItem>
                          <SelectItem value="dairy">Dairy</SelectItem>
                          <SelectItem value="beverages">Beverages</SelectItem>
                          <SelectItem value="packaged_dry">Packaged/Dry</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={item.veg_status} onValueChange={(val) => { const newItems = [...foodItems]; newItems[index].veg_status = val; setFoodItems(newItems); }} required>
                        <SelectTrigger className="w-[110px]"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="veg">Veg</SelectItem>
                          <SelectItem value="non_veg">Non-Veg</SelectItem>
                          <SelectItem value="jain">Jain</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min="0.1" step="0.1" placeholder="Qty (kg)" value={item.quantity_kg} onChange={(e) => { const newItems = [...foodItems]; newItems[index].quantity_kg = e.target.value; setFoodItems(newItems); }} required className="w-[90px]" />
                      {foodItems.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setFoodItems(foodItems.filter((_, i) => i !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setFoodItems([...foodItems, { name: "", category: "cooked_meal", veg_status: "veg", quantity_kg: "" }])} className="gap-2">
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                  <div className="text-sm font-medium text-muted-foreground flex flex-col items-end">
                    <span>Total weight: {foodItems.reduce((acc, curr) => acc + (Number(curr.quantity_kg) || 0), 0).toFixed(1)} kg</span>
                    <span className="text-primary font-bold">≈ {calculateMeals(foodItems.map(i => ({ ...i, quantity_kg: Number(i.quantity_kg) })))} meals saved</span>
                  </div>
                </div>
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
                      {listing.food_items && listing.food_items.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {listing.food_items.map(fi => `${fi.quantity_kg}kg ${fi.name}`).join(' • ')}
                        </div>
                      )}
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
            <ImpactStats refreshKey={impactRefreshKey} userId={user?.id} role="donor" hideMealsSaved hideActiveDonations />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}