import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, Users, Truck, Heart } from "lucide-react";

const steps = [
  { icon: Heart, title: "Donate", description: "List surplus food with details and pickup location" },
  { icon: Users, title: "Match", description: "NGOs discover and accept available food nearby" },
  { icon: Truck, title: "Deliver", description: "Track pickup and reduce waste together" },
];

const stats = [
  { label: "Meals Saved", value: 10000, suffix: "+" },
  { label: "Active Donors", value: 500, suffix: "+" },
  { label: "Partner NGOs", value: 200, suffix: "+" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        <div className="container relative mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground mb-6">
            <Leaf className="h-4 w-4 text-primary" />
            Connecting food donors with communities
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
            Reduce Food Waste.{" "}
            <span className="text-primary">Feed Communities.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
            Bridge the gap between surplus food and hungry communities. Every meal saved is a step towards a sustainable future.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth?mode=signup&role=donor">
              <Button size="lg" className="text-base px-8 gap-2 bg-primary hover:bg-primary/90">
                Donate Food <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth?mode=signup&role=ngo">
              <Button size="lg" variant="outline" className="text-base px-8 gap-2 border-secondary text-secondary hover:bg-secondary/10">
                Request Food <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center text-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="h-8 w-8" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {i + 1}
                  </span>
                  <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact stats */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Our Impact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-8 shadow-sm">
                <span className="text-4xl font-bold text-primary">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </span>
                <span className="text-muted-foreground font-medium">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Leaf className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">ZeroWaste Connect</span>
          </div>
          © 2026 ZeroWaste Connect. Reducing food waste, one meal at a time.
        </div>
      </footer>
    </div>
  );
}
