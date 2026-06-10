import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, apiFetch } from "@/lib/queryClient";
import { setTUToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoreInfo { name: string; primaryColor: string; logoUrl: string; }

export default function TenantLogin() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: store } = useQuery<StoreInfo>({
    queryKey: ["/api/t", slug, "store-info"],
    queryFn: () => apiFetch(`/api/t/${slug}/store-info`),
    enabled: !!slug,
  });

  const accentColor = store?.primaryColor || "#0ea5e9";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Enter credentials", description: "Email and password are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", `/api/t/${slug}/auth/login`, { email, password });
      const data = await res.json();
      setTUToken(data.token);
      navigate(`/t/${slug}/dashboard`);
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          {store?.logoUrl ? (
            <img src={store.logoUrl} alt={store?.name} className="h-14 w-14 rounded-full object-cover mx-auto" />
          ) : (
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto"
              style={{ backgroundColor: accentColor }}
            >
              {store?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
          )}
          <h1 className="text-xl font-bold">{store?.name ?? "Store"}</h1>
          <p className="text-sm text-muted-foreground">Dashboard Sign In</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border p-5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              data-testid="input-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pr-10"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                data-testid="button-togglePassword"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border cursor-pointer"
              style={{ accentColor }}
              data-testid="checkbox-rememberMe"
            />
            <label htmlFor="rememberMe" className="text-xs text-muted-foreground cursor-pointer select-none">
              Remember me
            </label>
          </div>

          <Button
            type="submit"
            className="w-full text-white"
            style={{ backgroundColor: accentColor }}
            disabled={loading}
            data-testid="button-login"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Sign In
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Customer?{" "}
          <button onClick={() => navigate(`/t/${slug}`)} className="underline hover:text-foreground">
            Go to store
          </button>
        </p>
      </div>
    </div>
  );
}
