import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { getSAToken, clearSAToken, decodePayload } from "@/lib/auth";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  LayoutDashboard, Store, BarChart3,
  Settings, LogOut, Menu, ChevronRight, Users, ScrollText,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Store },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users", label: "Admin Users", icon: Users },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = getSAToken();
    if (!token) { navigate("/admin/login"); return; }
    const payload = decodePayload(token);
    if (!payload || payload.exp * 1000 < Date.now()) { clearSAToken(); navigate("/admin/login"); }
  }, []);

  function handleLogout() {
    clearSAToken();
    navigate("/admin/login");
  }

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-border flex items-center gap-2">
        <div className="flex items-center gap-0.5 shrink-0">
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 20, color: "#373643", letterSpacing: -0.5 }}>PEAK</span>
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 mb-3" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="0,0 10,0 10,10" fill="#2d999d" />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground leading-tight">Super Admin</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active ? "text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                style={active ? { backgroundColor: ACCENT } : {}}
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
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-0.5">
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 18, color: "#373643", letterSpacing: -0.5 }}>PEAK</span>
            <svg viewBox="0 0 10 10" className="w-2 h-2 mb-3" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="0,0 10,0 10,10" fill="#2d999d" />
            </svg>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
