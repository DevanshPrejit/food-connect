import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Leaf, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  const isLandingPage = location.pathname === "/";

  // Only apply the transparent → solid transition on the landing page
  const isTransparent = isLandingPage && !scrolled;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isTransparent
          ? "bg-transparent border-b border-transparent"
          : "bg-card/80 backdrop-blur-md border-b shadow-sm"
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          to="/"
          className={`flex items-center gap-2 text-xl font-bold transition-colors duration-300 ${
            isTransparent ? "text-white" : "text-primary"
          }`}
        >
          <Leaf className="h-6 w-6" />
          ZeroWaste Connect
        </Link>

        <div className="flex items-center gap-3">
          {user && profile ? (
            <>
              <Link to={profile.role === "donor" ? "/donor" : "/ngo"}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`transition-colors duration-300 ${
                    isTransparent ? "text-white/90 hover:text-white hover:bg-white/10" : ""
                  }`}
                >
                  Dashboard
                </Button>
              </Link>
              <span
                className={`text-sm hidden sm:inline transition-colors duration-300 ${
                  isTransparent ? "text-white/70" : "text-muted-foreground"
                }`}
              >
                {profile.name} ({profile.role.toUpperCase()})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className={`transition-colors duration-300 ${
                  isTransparent ? "border-white/25 text-white hover:bg-white/10" : ""
                }`}
              >
                <LogOut className="h-4 w-4 mr-1" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`transition-colors duration-300 ${
                    isTransparent ? "text-white/90 hover:text-white hover:bg-white/10" : ""
                  }`}
                >
                  Login
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button
                  size="sm"
                  className={`transition-all duration-300 ${
                    isTransparent
                      ? "glass-button border border-white/25"
                      : ""
                  }`}
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
