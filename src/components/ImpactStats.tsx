import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateMeals } from "@/lib/utils";
import AnimatedCounter from "./AnimatedCounter";
import { Utensils, Leaf, HandHeart } from "lucide-react";

interface ImpactStatsProps {
  refreshKey?: number;
  hideMealsSaved?: boolean;
  hideActiveDonations?: boolean;
}

export default function ImpactStats({ refreshKey = 0, hideMealsSaved = false, hideActiveDonations = false }: ImpactStatsProps) {
  const [stats, setStats] = useState({ meals: 0, active: 0, co2: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: listings } = await supabase.from("listings").select("quantity, status, food_items(category, quantity_kg)");
      if (listings) {
        const savedListings = listings.filter((l) => l.status === "accepted" || l.status === "picked_up");
        const totalMeals = savedListings.reduce((sum, l) => {
          if (l.food_items && l.food_items.length > 0) {
            return sum + calculateMeals(l.food_items as any);
          }
          return sum + l.quantity;
        }, 0);
        const active = listings.filter((l) => l.status === "pending").length;
        setStats({ meals: totalMeals, active, co2: Math.round(totalMeals * 2.5) });
      }
    };
    fetchStats();
  }, [refreshKey]);

  const items = [];
  
  if (!hideMealsSaved) {
    items.push({ icon: Utensils, label: "Meals Saved", value: stats.meals, suffix: "" });
  }
  
  if (!hideActiveDonations) {
    items.push({ icon: HandHeart, label: "Active Donations", value: stats.active, suffix: "" });
  }
  
  items.push({ icon: Leaf, label: "CO₂ Saved (kg)", value: stats.co2, suffix: " kg" });

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-${items.length} gap-4`}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 shadow-sm">
          <item.icon className="h-8 w-8 text-primary" />
          <span className="text-3xl font-bold text-foreground">
            <AnimatedCounter end={item.value} suffix={item.suffix} />
          </span>
          <span className="text-sm text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
