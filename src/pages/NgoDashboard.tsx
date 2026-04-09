import { useState, useEffect } from "react";
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
import { Star, Search, Clock, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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


export default function NgoDashboard() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [filter, setFilter] = useState<"all" | "urgent" | "medium" | "safe">("all");
  const [acceptedListing, setAcceptedListing] = useState<Listing | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [impactRefreshKey, setImpactRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && user && profile?.role === "ngo") {
      // User is authenticated and has correct role - stay on dashboard
    } else if (!loading && (!user || profile?.role !== "ngo")) {
      navigate("/auth");
    }
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchListings();
      fetchAcceptances();
    }
  }, [user]);

  // Real-time subscription for new listings
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("ngo-listings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" },
        (payload) => {
          setListings((prev) => [payload.new as Listing, ...prev]);
          if ((payload.new as Listing).urgency === "urgent") {
            toast.info("🚨 New urgent food listing nearby!");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setListings(data);
  };

  const fetchAcceptances = async () => {
    const { data } = await supabase
      .from("acceptances")
      .select("*, listings(*)")
      .eq("ngo_id", user!.id)
      .order("accepted_at", { ascending: false });
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

  // Smart matching: sort by urgency score × recency
  const urgencyScore: Record<string, number> = { urgent: 3, medium: 2, safe: 1 };
  const recommended = [...listings]
    .sort((a, b) => {
      const scoreA = (urgencyScore[a.urgency] || 1) * (1 / (Date.now() - new Date(a.created_at).getTime()));
      const scoreB = (urgencyScore[b.urgency] || 1) * (1 / (Date.now() - new Date(b.created_at).getTime()));
      return scoreB - scoreA;
    })
    .slice(0, 3);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

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
            <FoodSurplusMap />
            {/* Recommended */}
            {recommended.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Star className="h-5 w-5 text-medium" /> Recommended For You
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recommended.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onAccept={handleAccept}
                      accepting={accepting}
                      recommended
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
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-all ${
                      filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
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
}: {
  listing: Listing;
  onAccept: (l: Listing) => void;
  accepting: string | null;
  recommended?: boolean;
}) {
  return (
    <div className={`relative rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md ${recommended ? "ring-2 ring-medium/40" : ""}`}>
      {recommended && (
        <div className="absolute -top-2 -right-2 rounded-full bg-medium px-2.5 py-0.5 text-xs font-bold text-foreground">
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
