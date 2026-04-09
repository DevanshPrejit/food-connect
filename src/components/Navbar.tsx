import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Leaf, LogOut } from "lucide-react";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary">
          <Leaf className="h-6 w-6" />
          ResQMeal
        </Link>

        <div className="flex items-center gap-3">
          {user && profile ? (
            <>
              <Link to={profile.role === "donor" ? "/donor" : "/ngo"}>
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {profile.name} ({profile.role.toUpperCase()})
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
