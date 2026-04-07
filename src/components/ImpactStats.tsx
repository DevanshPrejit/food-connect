import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AnimatedCounter from "./AnimatedCounter";
import { Utensils, Leaf, HandHeart } from "lucide-react";

export default function ImpactStats() {
  const [stats, setStats] = useState({ meals: 0, active: 0, co2: 0 });

  useEffect(() => {
    const fetch = async () => {
      const { data: listings } = await supabase.from("listings").select("quantity, status");
      if (listings) {
        const totalMeals = listings.reduce((sum, l) => sum + l.quantity, 0);
        const active = listings.filter((l) => l.status === "pending").length;
        setStats({ meals: totalMeals, active, co2: Math.round(totalMeals * 2.5) });
      }
    };
    fetch();
  }, []);

  const items = [
    { icon: Utensils, label: "Meals Saved", value: stats.meals, suffix: "" },
    { icon: HandHeart, label: "Active Donations", value: stats.active, suffix: "" },
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
