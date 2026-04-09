import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import UrgencyBadge from "@/components/UrgencyBadge";
import ImpactStats from "@/components/ImpactStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { computeUrgency } from "@/lib/urgency";
import { Plus, Package } from "lucide-react";

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
  const [impactRefreshKey, setImpactRefreshKey] = useState(0);

  // Form state
  const [foodName, setFoodName] = useState("");
  const [foodType, setFoodType] = useState<"veg" | "non-veg">("veg");
  const [quantity, setQuantity] = useState("10");
  const [expiryTime, setExpiryTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");

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

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("donor-listings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings", filter: `donor_id=eq.${user.id}` },
        (payload) => {
          setListings((prev) => prev.map((l) => (l.id === payload.new.id ? { ...l, ...payload.new } : l)));
          if (payload.new.status === "accepted") {
            toast.info("🎉 An NGO has accepted your donation!");
            setImpactRefreshKey((k) => k + 1);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const urgency = computeUrgency(expiryTime);

    const { error } = await supabase.from("listings").insert({
      donor_id: user!.id,
      food_name: foodName,
      food_type: foodType,
      quantity: parseInt(quantity),
      expiry_time: expiryTime,
      pickup_location: pickupLocation,
      urgency,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Food listing created!");
      setShowForm(false);
      setFoodName("");
      setQuantity("10");
      setExpiryTime("");
      setPickupLocation("");
      fetchListings();
    }
    setSubmitting(false);
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
          <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-foreground">New Food Listing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Food Name</Label>
                <Input value={foodName} onChange={(e) => setFoodName(e.target.value)} required placeholder="e.g. Rice & Curry" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFoodType("veg")}
                    className={`rounded-lg border-2 p-2 text-sm font-medium transition-all ${foodType === "veg" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    🥬 Veg
                  </button>
                  <button type="button" onClick={() => setFoodType("non-veg")}
                    className={`rounded-lg border-2 p-2 text-sm font-medium transition-all ${foodType === "non-veg" ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground"}`}>
                    🍗 Non-Veg
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantity (meals)</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Expiry Time</Label>
                <Input type="datetime-local" value={expiryTime} onChange={(e) => setExpiryTime(e.target.value)} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Pickup Location</Label>
                <Input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} required placeholder="e.g. 123 Main Street, Mumbai" />
              </div>
            </div>
            {expiryTime && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-tagged:</span>
                <UrgencyBadge urgency={computeUrgency(expiryTime)} />
              </div>
            )}
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Listing"}</Button>
          </form>
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
                  <div key={listing.id} className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{listing.food_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">({listing.food_type})</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{listing.quantity} meals</span>
                        <span>📍 {listing.pickup_location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <UrgencyBadge urgency={listing.urgency as any} />
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
            <ImpactStats refreshKey={impactRefreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
