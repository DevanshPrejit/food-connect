import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Navbar from "@/components/Navbar";
import AnimatedCounter from "@/components/AnimatedCounter";
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

  // Background fades out as user scrolls through the hero buffer
  const bgOpacity = useTransform(scrollYProgress, [0, 0.78], [1, 0]);
  const bgScale = useTransform(scrollYProgress, [0, 0.78], [1, 1.12]);
  const overlayOpacity = useTransform(scrollYProgress, [0.45, 0.95], [0, 1]);

  // Text animates on scroll - move it UP significantly to avoid the cards
  const textY = useTransform(scrollYProgress, [0.1, 0.4], [0, -280]);
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.6], [1, 0]);
  const textScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.88]);

  // CTA buttons
  const ctaOpacity = useTransform(scrollYProgress, [0.14, 0.4], [1, 0]);
  const ctaY = useTransform(scrollYProgress, [0, 0.34], [0, -80]);

  // Scroll indicator
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  // India snapshot cards animate earlier in the hero scroll space
  const foodWasteCardOpacity = useTransform(scrollYProgress, [0.2, 0.32, 0.78, 0.92], [0, 1, 1, 0]);
  const foodWasteCardX = useTransform(scrollYProgress, [0.2, 0.32], [-80, 0]);
  const hungerCardOpacity = useTransform(scrollYProgress, [0.34, 0.48, 0.84, 0.96], [0, 1, 1, 0]);
  const hungerCardX = useTransform(scrollYProgress, [0.34, 0.48], [80, 0]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ===== IMMERSIVE HERO ===== */}
      <section ref={heroRef} className="relative h-[320vh]">
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
              <span className="block text-[clamp(2.5rem,10vw,8rem)] mt-1 text-green-600 drop-shadow-lg">Nourish.</span>
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
                <button className="glass-button rounded-full px-10 py-4 text-lg font-semibold tracking-wide flex items-center gap-2 hover:scale-105 hover:text-green-500 active:scale-95 transition-transform">
                  Donate <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
              <Link to="/auth?mode=signup&role=ngo">
                <button className="glass-button rounded-full px-10 py-4 text-lg font-semibold tracking-wide flex items-center gap-2 hover:scale-105 hover:text-green-500 active:scale-95 transition-transform">
                  Request <ArrowRight className="h-5 w-5" />
                </button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Cards shown in the hero scroll buffer — brought 'down' and gaps reduced */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-2 sm:px-6 sm:pb-4">
            <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
              <motion.div
                style={{ opacity: foodWasteCardOpacity, x: foodWasteCardX }}
                className="ml-0 mr-auto w-full max-w-[min(92vw,36rem)] overflow-hidden rounded-2xl border border-white/35 bg-background/85 shadow-2xl backdrop-blur-md sm:max-w-[min(92vw,44rem)]"
              >
                <div className="flex min-h-[10rem] sm:min-h-[12rem]">
                  <div className="relative w-[40%] shrink-0">
                    <img
                      src="/food_waste.jpg"
                      alt="Food waste and surplus"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex w-[60%] flex-col justify-center gap-2 px-4 py-4 sm:gap-3 sm:px-6 sm:py-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary sm:text-xs">
                      Food wastage in India
                    </p>
                    <p className="text-sm leading-snug text-muted-foreground sm:text-base sm:leading-relaxed">
                      India wastes nearly{" "}
                      <span className="text-lg font-extrabold tabular-nums text-foreground sm:text-2xl">68 million tonnes</span>{" "}
                      of food every year — resources lost while surplus could feed millions.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                style={{ opacity: hungerCardOpacity, x: hungerCardX }}
                className="ml-auto mr-0 w-full max-w-[min(92vw,36rem)] overflow-hidden rounded-2xl border border-white/35 bg-background/85 shadow-2xl backdrop-blur-md sm:max-w-[min(92vw,44rem)]"
              >
                <div className="flex min-h-[10rem] sm:min-h-[12rem]">
                  <div className="relative w-[40%] shrink-0">
                    <img
                      src="/hunger.jpg"
                      alt="Hunger and food insecurity"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex w-[60%] flex-col justify-center gap-2 px-4 py-4 sm:gap-3 sm:px-6 sm:py-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary sm:text-xs">
                      Hunger in India
                    </p>
                    <p className="text-sm leading-snug text-muted-foreground sm:text-base sm:leading-relaxed">
                      Around{" "}
                      <span className="text-lg font-extrabold tabular-nums text-foreground sm:text-2xl">194 million people</span>{" "}
                      remain undernourished — bridging surplus to need matters now.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
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
