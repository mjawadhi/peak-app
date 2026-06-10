import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { getTUToken, clearTUToken, decodePayload } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import {
  LayoutDashboard, ShoppingBag, Package, Settings, LogOut,
  Menu, X, ChevronRight, Users, UserCog, BarChart2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface StoreInfo { name: string; primaryColor: string; logoUrl: string; status: string; }

// Nav items with optional permission key — undefined means always show
const NAV_ITEMS: { href: string; label: string; icon: React.ElementType; permKey?: string }[] = [
  { href: "",           label: "Overview",  icon: LayoutDashboard },
  { href: "/orders",    label: "Orders",    icon: ShoppingBag,  permKey: "orders" },
  { href: "/products",  label: "Products",  icon: Package,      permKey: "products" },
  { href: "/customers", label: "Customers", icon: Users,        permKey: "customers" },
  { href: "/analytics", label: "Analytics", icon: BarChart2,    permKey: "analytics" },
  { href: "/team",      label: "Team",      icon: UserCog,      permKey: "team" },
  { href: "/settings",  label: "Settings",  icon: Settings,     permKey: "settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth guard + parse permissions
  const [userPerms, setUserPerms] = useState<Record<string, any>>({});
  const [userRole, setUserRole] = useState<string>("staff");

  useEffect(() => {
    const token = getTUToken();
    if (!token) { navigate(`/t/${slug}/login`); return; }
    const payload = decodePayload(token);
    if (!payload || payload.exp * 1000 < Date.now()) {
      clearTUToken();
      navigate(`/t/${slug}/login`);
      return;
    }
    setUserRole(payload.role || "staff");
    try { setUserPerms(JSON.parse(payload.permissions || "{}")); } catch { setUserPerms({}); }
  }, [slug]);

  // Owner always has full access; other roles check their permissions object
  function canSeeNav(permKey?: string): boolean {
    if (!permKey) return true;            // Overview — always show
    if (userRole === "owner") return true; // Owner sees everything
    const val = userPerms[permKey];
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val !== "none";
    return false;
  }

  const { data: store, isLoading } = useQuery<StoreInfo>({
    queryKey: ["/api/t", slug, "store-info"],
    queryFn: () => apiFetch(`/api/t/${slug}/store-info`),
    enabled: !!slug,
  });

  const accentColor = store?.primaryColor || "#0ea5e9";

  function handleLogout() {
    clearTUToken();
    queryClient.clear();
    navigate(`/t/${slug}/login`);
  }

  function isActive(href: string) {
    const full = `/t/${slug}/dashboard${href}`;
    if (href === "") return location === `/t/${slug}/dashboard`;
    return location.startsWith(full);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
        {isLoading ? (
          <Skeleton className="h-8 w-8 rounded-full" />
        ) : store?.logoUrl ? (
          <img src={store.logoUrl} alt={store.name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: accentColor }}
          >
            {store?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          {isLoading ? <Skeleton className="h-4 w-24" /> : (
            <p className="text-sm font-semibold truncate">{store?.name}</p>
          )}
          <p className="text-xs text-muted-foreground">Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_ITEMS.filter(({ permKey }) => canSeeNav(permKey)).map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={`/t/${slug}/dashboard${href}`}
              onClick={() => setMobileOpen(false)}
            >
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? "text-white"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                style={active ? { backgroundColor: accentColor } : {}}
                data-testid={`nav-${label.toLowerCase()}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border space-y-1">
        <button
          onClick={() => navigate(`/t/${slug}`)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          View Store
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-56">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm">{store?.name ?? "Dashboard"}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
