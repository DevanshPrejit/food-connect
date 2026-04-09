import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Navbar from "@/components/Navbar";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Leaf, Heart, Users, Truck } from "lucide-react";

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
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Background fades out as user scrolls through the 200vh hero buffer
  const bgOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 0.6], [1, 1.15]);
  const overlayOpacity = useTransform(scrollYProgress, [0.4, 0.8], [0, 1]);

  // Text animates on scroll
  const textY = useTransform(scrollYProgress, [0, 0.5], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0.3, 0.6], [1, 0]);
  const textScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.85]);

  // CTA buttons
  const ctaOpacity = useTransform(scrollYProgress, [0.2, 0.45], [1, 0]);
  const ctaY = useTransform(scrollYProgress, [0, 0.4], [0, -60]);

  // Scroll indicator
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ===== IMMERSIVE HERO ===== */}
      <section ref={heroRef} className="relative h-[200vh]">
        {/* Fixed viewport container */}
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Background image */}
          <motion.div
            className="absolute inset-0"
            style={{ opacity: bgOpacity, scale: bgScale }}
          >
            <img
              src="/kids-eating.jpeg"
              alt=""
              className="h-full w-full object-cover"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 hero-overlay" />
          </motion.div>

          {/* Fade-to-black overlay on scroll */}
          <motion.div
            className="absolute inset-0 bg-background"
            style={{ opacity: overlayOpacity }}
          />

          {/* Hero content */}
          <motion.div
            className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center"
            style={{ y: textY, opacity: textOpacity, scale: textScale }}
          >
            {/* Large cinematic typography */}
            <h1 className="hero-text-shadow font-bold tracking-tight text-white leading-[0.9] select-none">
              <span className="block text-[clamp(2.5rem,10vw,8rem)]">Share.</span>
              <span className="block text-[clamp(2.5rem,10vw,8rem)] mt-1 text-primary drop-shadow-lg">Nourish.</span>
              <span className="block text-[clamp(2.5rem,10vw,8rem)] mt-1">Sustain.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg sm:text-xl text-white/80 hero-text-shadow font-medium">
              Bridge the gap between surplus food and hungry communities.
            </p>

            {/* Glassmorphism CTA buttons */}
            <motion.div
              className="mt-10 flex flex-col sm:flex-row items-center gap-4"
              style={{ opacity: ctaOpacity, y: ctaY }}
            >
              <Link to="/auth?mode=signup&role=donor">
                <button className="glass-button rounded-full px-10 py-4 text-lg font-semibold tracking-wide flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform">
                  Donate <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
              <Link to="/auth?mode=signup&role=ngo">
                <button className="glass-button rounded-full px-10 py-4 text-lg font-semibold tracking-wide flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform">
                  Request <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/60"
            style={{ opacity: scrollIndicatorOpacity }}
          >
            <span className="text-xs uppercase tracking-widest">Scroll</span>
            <div className="h-10 w-[1px] bg-white/30 relative overflow-hidden">
              <motion.div
                className="absolute top-0 left-0 w-full bg-white"
                animate={{ height: ["0%", "100%", "0%"], top: ["0%", "0%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
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

      {/* ===== IMPACT STATS ===== */}
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

      {/* ===== FOOTER ===== */}
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
