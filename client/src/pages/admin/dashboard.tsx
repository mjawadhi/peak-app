import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { getSAToken } from "@/lib/auth";
import AdminLayout from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, ShoppingBag, DollarSign, TrendingUp, Link as LinkIcon } from "lucide-react";
import { Link } from "wouter";

interface Stats { totalTenants: number; activeTenants: number; totalOrders: number; totalRevenue: number; paidRevenue: number; }
interface Tenant { id: string; name: string; slug: string; status: string; ownerEmail: string; orderCount: number; }

function formatKWD(n: number) { return (parseFloat(String(n)) || 0).toFixed(3) + " KWD"; }

export default function AdminDashboard() {
  const token = getSAToken();
  const authH = { Authorization: `Bearer ${token}` };

  const { data: stats, isLoading: sLoading } = useQuery<Stats>({
    queryKey: ["/api/super-admin/stats"],
    queryFn: () => apiFetch("/api/super-admin/stats", { headers: authH }),
    enabled: !!token,
  });

  const { data: tenants = [], isLoading: tLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/super-admin/tenants"],
    queryFn: () => apiFetch("/api/super-admin/tenants", { headers: authH }),
    enabled: !!token,
  });

  const statCards = [
    { label: "Total Tenants", value: stats?.totalTenants ?? 0, sub: `${stats?.activeTenants ?? 0} active`, icon: Store, color: "#6366f1" },
    { label: "Total Orders", value: stats?.totalOrders ?? 0, sub: "all time", icon: ShoppingBag, color: "#10b981" },
    { label: "Total GMV", value: formatKWD(stats?.totalRevenue ?? 0), sub: "gross merchandise value", icon: TrendingUp, color: "#f59e0b" },
    { label: "Paid Revenue", value: formatKWD(stats?.paidRevenue ?? 0), sub: "confirmed payments", icon: DollarSign, color: "#3b82f6" },
  ];

  const recentTenants = [...tenants].slice(0, 5);

  return (
    <AdminLayout>
      <div className="p-5 space-y-6">
        <div>
          <h1 className="text-lg font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Platform overview</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              {sLoading ? <Skeleton className="h-6 w-20" /> : (
                <>
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Manage Tenants", href: "/admin/tenants" },
            { label: "Analytics", href: "/admin/analytics" },
            { label: "Audit Log", href: "/admin/audit-log" },
            { label: "Settings", href: "/admin/settings" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <div className="rounded-xl border border-border bg-card p-3 text-center text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
                {label}
              </div>
            </Link>
          ))}
        </div>

        {/* Recent tenants */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent Tenants</h2>
            <Link href="/admin/tenants"><span className="text-xs text-primary cursor-pointer hover:underline">View all →</span></Link>
          </div>
          {tLoading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recentTenants.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No tenants yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentTenants.map(t => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">/{t.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{t.status}</span>
                    <span className="text-xs text-muted-foreground">{t.orderCount} orders</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
