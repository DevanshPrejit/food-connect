import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Leaf, LogOut, LayoutDashboard } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-500 ${isTransparent
          ? "bg-transparent border-b border-transparent"
          : "bg-card/80 backdrop-blur-md border-b shadow-sm"
        }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          to="/"
          className={`flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight transition-colors duration-300 ${isTransparent ? "text-white hero-text-shadow drop-shadow-md" : "text-primary"
            }`}
        >
          <Leaf className="h-7 w-7 sm:h-8 sm:w-8" />
          ResQMeal
        </Link>

        <div className="flex items-center gap-3">
          {user && profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`flex items-center gap-2 p-1 pl-3 transition-all duration-300 rounded-full h-10 ${isTransparent
                      ? "!bg-white/20 hover:!bg-white/30 backdrop-blur-md border border-white/30 text-white font-semibold hero-text-shadow"
                      : "hover:bg-accent border shadow-sm"
                    }`}
                >
                  <span className="hidden sm:inline text-sm font-medium">
                    {profile.name}
                  </span>
                  <Avatar className="h-8 w-8 border border-primary/10">
                    <AvatarImage src="" />
                    <AvatarFallback className={`${isTransparent ? "bg-white/20 text-white" : "bg-primary/10 text-primary"} text-xs`}>
                      {profile.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">{profile.name}</p>
                    <p className="text-xs leading-none text-muted-foreground capitalize">
                      {profile.role} account
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to={profile.role === "donor" ? "/donor" : "/ngo"}
                    className="flex items-center cursor-pointer py-2"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="flex items-center cursor-pointer py-2 text-destructive focus:text-destructive focus:bg-destructive/5"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth">
                <Button
                  variant={isTransparent ? "ghost" : "default"}
                  size="sm"
                  className={`transition-all duration-300 ${isTransparent ? "!bg-white/20 hover:!bg-white/30 hover:text-amber-50 backdrop-blur-md border border-white/30 text-white font-semibold hero-text-shadow hover:scale-105 active:scale-95 rounded-full px-5" : ""
                    }`}
                >
                  Login
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button
                  variant={isTransparent ? "ghost" : "default"}
                  size="sm"
                  className={`transition-all duration-300 ${isTransparent
                      ? "!bg-white/20 hover:!bg-white/30 hover:text-amber-50 backdrop-blur-md border border-white/30 text-white font-semibold hero-text-shadow hover:scale-105 active:scale-95 rounded-full px-5"
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
