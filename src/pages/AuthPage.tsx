import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Leaf, Phone } from "lucide-react";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const initialRole = (searchParams.get("role") as "donor" | "ngo") || "donor";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [role, setRole] = useState<"donor" | "ngo">(initialRole);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        // Validate Indian mobile number format
        const cleanMobile = mobileNumber.replace(/\s+/g, "");
        const mobileRegex = /^(\+91|91)?[6-9]\d{9}$/;
        if (!mobileRegex.test(cleanMobile)) {
          toast.error("Please enter a valid Indian mobile number (e.g. +91 98765 43210)");
          setLoading(false);
          return;
        }
        // Normalize to +91XXXXXXXXXX
        const normalizedMobile = cleanMobile.startsWith("+91")
          ? cleanMobile
          : cleanMobile.startsWith("91")
            ? "+" + cleanMobile
            : "+91" + cleanMobile;

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, role, location, mobile_number: normalizedMobile },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account created! You can now log in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Fetch profile to redirect
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .single();
          navigate(profile?.role === "ngo" ? "/ngo" : "/donor");
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Leaf className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "login" ? "Welcome back" : "Join ResQMeal"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Create your account to get started"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          {mode === "signup" && (
            <>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" />
              </div>

              <div className="space-y-2">
                <Label>I am a</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("donor")}
                    className={`rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                      role === "donor"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    🍽️ Food Donor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("ngo")}
                    className={`rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                      role === "ngo"
                        ? "border-secondary bg-secondary/10 text-secondary"
                        : "border-border text-muted-foreground hover:border-secondary/50"
                    }`}
                  >
                    🤝 NGO
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>City / Area</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="e.g. Mumbai, Andheri" />
              </div>

              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    required
                    placeholder="+91 98765 43210"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">NGOs will use this to coordinate pickup</p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}