import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateMeals, calculateCO2 } from "@/lib/utils";
import AnimatedCounter from "./AnimatedCounter";
import { Utensils, Leaf, HandHeart } from "lucide-react";

interface ImpactStatsProps {
  refreshKey?: number;
  userId?: string;
  role?: "donor" | "ngo";
}

export default function ImpactStats({ refreshKey = 0, userId, role }: ImpactStatsProps) {
  const [stats, setStats] = useState({ meals: 0, active: 0, co2: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (userId && role === "donor") {
        const { data: listings } = await supabase.from("listings").select("quantity, status, food_items(category, quantity_kg)").eq("donor_id", userId);
        if (listings) {
          const savedListings = listings.filter((l) => l.status === "accepted" || l.status === "picked_up");
          let totalCO2 = 0;
          const totalMeals = savedListings.reduce((sum, l) => {
            if (l.food_items && l.food_items.length > 0) {
              totalCO2 += calculateCO2(l.food_items as any);
              return sum + calculateMeals(l.food_items as any);
            }
            totalCO2 += l.quantity * 2.5;
            return sum + l.quantity;
          }, 0);
          const active = listings.filter((l) => l.status === "pending").length;
          setStats({ meals: totalMeals, active, co2: Math.round(totalCO2) });
        }
      } else if (userId && role === "ngo") {
        const { data: acceptances } = await supabase.from("acceptances").select("status, listings(quantity, food_items(category, quantity_kg))").eq("ngo_id", userId);
        if (acceptances) {
          let totalCO2 = 0;
          const totalMeals = acceptances.reduce((sum, a) => {
            const l = a.listings as any;
            if (l && l.food_items && l.food_items.length > 0) {
              totalCO2 += calculateCO2(l.food_items);
              return sum + calculateMeals(l.food_items);
            }
            totalCO2 += (l?.quantity || 0) * 2.5;
            return sum + (l?.quantity || 0);
          }, 0);
          const active = acceptances.filter((a) => a.status === "pending").length;
          setStats({ meals: totalMeals, active, co2: Math.round(totalCO2) });
        }
      } else {
        const { data: listings } = await supabase.from("listings").select("quantity, status, food_items(category, quantity_kg)");
        if (listings) {
          const savedListings = listings.filter((l) => l.status === "accepted" || l.status === "picked_up");
          let totalCO2 = 0;
          const totalMeals = savedListings.reduce((sum, l) => {
            if (l.food_items && l.food_items.length > 0) {
              totalCO2 += calculateCO2(l.food_items as any);
              return sum + calculateMeals(l.food_items as any);
            }
            totalCO2 += l.quantity * 2.5;
            return sum + l.quantity;
          }, 0);
          const active = listings.filter((l) => l.status === "pending").length;
          setStats({ meals: totalMeals, active, co2: Math.round(totalCO2) });
        }
      }
    };
    fetchStats();
  }, [refreshKey, userId, role]);

  const items = [
    { icon: Utensils, label: role === "ngo" ? "Meals Rescued" : "Meals Donated", value: stats.meals, suffix: "" },
    { icon: HandHeart, label: role === "ngo" ? "Active Pickups" : "Active Donations", value: stats.active, suffix: "" },
    { icon: Leaf, label: "CO₂ Saved (kg)", value: stats.co2, suffix: " kg" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
