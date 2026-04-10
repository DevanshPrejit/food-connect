import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import UrgencyBadge from "@/components/UrgencyBadge";
import ImpactStats from "@/components/ImpactStats";
import FoodSurplusMap from "@/components/FoodSurplusMap";
import PickupMap from "@/components/PickupMap";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Star, Search, Clock, MapPin, Brain, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { checkMLHealth, scoreNGOs, buildNGOPayload, geocodeLocation, haversineDistance, type ScoredNGO } from "@/lib/ml-api";

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
  donor_id: string;
}

interface Acceptance {
  id: string;
  listing_id: string;
  accepted_at: string;
  status: string;
  listings?: Listing;
}

// Add this outside the component at the top of NGODashboard.tsx
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

export default function NgoDashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [filter, setFilter] = useState<"all" | "urgent" | "medium" | "safe">("all");
  const [acceptedListing, setAcceptedListing] = useState<Listing | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [impactRefreshKey, setImpactRefreshKey] = useState(0);

  // ML-powered ranking state
  const [mlScores, setMlScores] = useState<Record<string, ScoredNGO>>({});
  const [mlOnline, setMlOnline] = useState(false);
  const [mlLoading, setMlLoading] = useState(false);

  useEffect(() => {
    console.log("user:", user)
    console.log("profile:", profile)
    console.log("loading:", loading)
  }, [user, profile, loading])

  useEffect(() => {
    if (user && profile) {
      fetchListings();
      fetchAcceptances();
      // Check if ML service is available
      checkMLHealth().then((h) => setMlOnline(!!h));
    }
  }, [user, profile]);

  // Real-time subscription for new listings
  useEffect(() => {
    if (!user || !profile) return;
    const channel = supabase
      .channel("ngo-listings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" },
        async (payload) => {
          const listing = payload.new as Listing;

          if (profile?.location) {
            const ngoCoords = await geocodeLocation(profile.location);
            const donorCoords = await geocodeLocation(listing.pickup_location);
            if (ngoCoords && donorCoords) {
              const dist = haversineDistance(ngoCoords.lat, ngoCoords.lon, donorCoords.lat, donorCoords.lon);
              if (dist > 50) return;
            }
          }

          setListings((prev) => [listing, ...prev]);
          if (listing.urgency === "urgent") {
            toast.info("🚨 New urgent food listing nearby!");
          } else {
            toast.info("🍽️ New food listing nearby!");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
      
    if (data) {
      if (!profile?.location) {
        setListings(data);
        return;
      }

      const ngoCoords = await geocodeLocation(profile.location);
      if (!ngoCoords) {
        setListings(data);
        return;
      }

      const filtered: Listing[] = [];
      for (const listing of data) {
        let distanceOk = false;
        const donorCoords = await geocodeLocation(listing.pickup_location);
        if (donorCoords) {
          const dist = haversineDistance(ngoCoords.lat, ngoCoords.lon, donorCoords.lat, donorCoords.lon);
          if (dist <= 50) distanceOk = true;
        } else {
          // If a donor location cannot be geocoded, we fallback to showing it to be safe
          distanceOk = true;
        }

        if (distanceOk) {
          filtered.push(listing);
        }
        await new Promise(r => setTimeout(r, 1100)); // Sequential delay to avoid rate limit
      }
      setListings(filtered);
    }
  };

  const fetchAcceptances = async () => {
    // First try without the join
    const { data, error } = await supabase
      .from("acceptances")
      .select("*")
      .eq("ngo_id", user!.id)
      .order("accepted_at", { ascending: false });

    if (error) {
      console.error("Acceptances error:", error.message)
      return
    }
    if (data) setAcceptances(data as any);
  };

  const handleAccept = async (listing: Listing) => {
    setAccepting(listing.id);
    const { error } = await supabase.rpc("accept_listing", { p_listing_id: listing.id });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Accepted "${listing.food_name}"! Preparing pickup...`);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
      setAcceptedListing(listing);
      fetchAcceptances();
      setImpactRefreshKey((k) => k + 1);
    }
    setAccepting(null);
  };

  const filteredListings = filter === "all" ? listings : listings.filter((l) => l.urgency === filter);

  // ── ML-powered recommendation fetcher ────────────
  const fetchMLRecommendations = useCallback(async () => {
    if (!mlOnline || listings.length === 0 || !profile || !user) return;
    setMlLoading(true);
    try {
      const ngoPayload = buildNGOPayload(
        {
          id: user!.id,
          user_id: user!.id,
          name: profile.name ?? "",
          role: "ngo",
          location: profile.location ?? "",
          created_at: new Date().toISOString(),
        },
        profile.location ?? ""
      );

      const scoreMap: Record<string, ScoredNGO> = {};

      for (const listing of listings.slice(0, 10)) {
        try {
          // Fetch actual food category from food_items table
          const { data: foodItems, error: foodItemError } = await supabase
            .from("food_items")
            .select("category")
            .eq("listing_id", listing.id);

          if (foodItemError) {
            console.warn("food_items fetch failed:", foodItemError.message);
          }

          // Take first category found, fall back to listing food_type
          const mappedType = foodItems && foodItems.length > 0
            ? mapFoodType(foodItems[0].category)
            : mapFoodType(listing.food_type);

          const results = await scoreNGOs(
            listing.id,
            {
              donor_name: "Donor",
              food_type: mappedType,
              quantity_kg: listing.quantity,
              expiry_time: new Date(listing.expiry_time).toISOString(),
              pickup_location: listing.pickup_location,
            },
            [ngoPayload]
          );

          if (results.length > 0) {
            scoreMap[listing.id] = results[0];
          }
        } catch {
          // skip failed individual scores
        }
      }
      setMlScores(scoreMap);
    } catch {
      console.warn("ML recommendation fetch failed");
    } finally {
      setMlLoading(false);
    }
  }, [mlOnline, listings, profile, user]);

  useEffect(() => {
    fetchMLRecommendations();
  }, [fetchMLRecommendations]);

  useEffect(() => {
    fetchMLRecommendations();
  }, [fetchMLRecommendations]);

  // Smart matching: use ML scores when available, else fall back to urgency × recency
  const urgencyScore: Record<string, number> = { urgent: 3, medium: 2, safe: 1 };
  const recommended = [...listings]
    .sort((a, b) => {
      // If ML scores are available, use them as primary sort
      const mlA = mlScores[a.id]?.final_score ?? 0;
      const mlB = mlScores[b.id]?.final_score ?? 0;
      if (mlA !== mlB) return mlB - mlA;
      // Fallback: urgency × recency
      const scoreA = (urgencyScore[a.urgency] || 1) * (1 / (Date.now() - new Date(a.created_at).getTime()));
      const scoreB = (urgencyScore[b.urgency] || 1) * (1 / (Date.now() - new Date(b.created_at).getTime()));
      return scoreB - scoreA;
    })
    .slice(0, 3);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">NGO Dashboard</h1>
          <p className="text-muted-foreground">Welcome, {profile?.name}</p>
        </div>

        {/* Accepted listing with map */}
        {acceptedListing && (
          <div className="mb-8 space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5 text-secondary" /> Pickup Tracking
            </h2>
            <PickupMap
              donorLocation={acceptedListing.pickup_location}
              ngoLocation={profile?.location || "Udupi"}
            />
            <Button variant="outline" onClick={() => setAcceptedListing(null)}>Dismiss</Button>
          </div>
        )}

        <Tabs defaultValue="available" className="space-y-6">
          <TabsList>
            <TabsTrigger value="available">Available Food</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-8">
            {/* Food Surplus Map */}
            <FoodSurplusMap listings={filteredListings} />
            {/* Recommended */}
            {recommended.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  {mlOnline ? (
                    <Brain className="h-5 w-5 text-violet-500" />
                  ) : (
                    <Star className="h-5 w-5 text-medium" />
                  )}
                  Recommended For You
                  {mlOnline && (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-500 uppercase tracking-wider">
                      ML Ranked
                    </span>
                  )}
                  {mlLoading && (
                    <span className="text-xs text-muted-foreground animate-pulse">Scoring…</span>
                  )}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recommended.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onAccept={handleAccept}
                      accepting={accepting}
                      recommended
                      mlScore={mlScores[listing.id]}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Filter bar */}
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Search className="h-4 w-4 text-muted-foreground" />
                {(["all", "urgent", "medium", "safe"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onAccept={handleAccept}
                    accepting={accepting}
                  />
                ))}
                {filteredListings.length === 0 && (
                  <p className="col-span-full text-center py-12 text-muted-foreground">No listings found.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {acceptances.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">No pickups yet.</p>
            ) : (
              <div className="space-y-3">
                {acceptances.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
                    <div>
                      <p className="font-semibold text-foreground">{(a as any).listings?.food_name || "Food"}</p>
                      <p className="text-sm text-muted-foreground">
                        Accepted {formatDistanceToNow(new Date(a.accepted_at), { addSuffix: true })}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="impact">
            <ImpactStats refreshKey={impactRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ListingCard({
  listing,
  onAccept,
  accepting,
  recommended = false,
  mlScore,
}: {
  listing: Listing;
  onAccept: (l: Listing) => void;
  accepting: string | null;
  recommended?: boolean;
  mlScore?: ScoredNGO;
}) {
  return (
    <div className={`relative rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${recommended ? "ring-2 ring-violet-500/30" : ""}`}>
      {recommended && (
        <div className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
          ⭐ Recommended
        </div>
      )}
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground">{listing.food_name}</h3>
          <UrgencyBadge urgency={listing.urgency as any} />
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>🍽️ {listing.quantity} meals · {listing.food_type === "veg" ? "🥬 Veg" : "🍗 Non-Veg"}</p>
          <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {listing.pickup_location}</p>
          <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true })}</p>
        </div>

        {/* ML Score badge */}
        {mlScore && (
          <div className="flex items-center gap-3 rounded-lg bg-violet-500/5 border border-violet-500/10 px-3 py-2">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-bold text-violet-600">
                {(mlScore.final_score * 100).toFixed(0)}% match
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              ~{mlScore.predicted_time_min} min
            </span>
          </div>
        )}

        <Button
          onClick={() => onAccept(listing)}
          disabled={accepting === listing.id}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          size="sm"
        >
          {accepting === listing.id ? "Accepting..." : "Accept Donation"}
        </Button>
      </div>
    </div>
  );
}
