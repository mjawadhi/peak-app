import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { getSAToken } from "@/lib/auth";
import AdminLayout from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Analytics {
  revenueByDay: Record<string, number>;
  ordersCountByDay: Record<string, number>;
  topTenants: Array<{ id: string; name: string; slug: string; revenue: number; orders: number }>;
  statusBreakdown: Record<string, number>;
}

function formatKWD(n: number) { return (parseFloat(String(n)) || 0).toFixed(3) + " KWD"; }

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminAnalytics() {
  const token = getSAToken();
  const authH = { Authorization: `Bearer ${token}` };

  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["/api/super-admin/analytics"],
    queryFn: () => apiFetch("/api/super-admin/analytics", { headers: authH }),
    enabled: !!token,
  });

  // Sort days and take last 30
  const allDays = Object.keys(data?.revenueByDay || {}).sort();
  const last30 = allDays.slice(-30);
  const timeData = last30.map(day => ({
    day: day.slice(5), // MM-DD
    revenue: parseFloat(((data?.revenueByDay || {})[day] || 0).toFixed(3)),
    orders: (data?.ordersCountByDay || {})[day] || 0,
  }));

  const statusData = Object.entries(data?.statusBreakdown || {}).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  const topTenants = (data?.topTenants || []).slice(0, 8);

  function exportCSV() {
    const rows = [["Date","Revenue KWD","Orders"]];
    timeData.forEach(d => rows.push([d.day, String(d.revenue), String(d.orders)]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "analytics.csv"; a.click();
  }

  return (
    <AdminLayout>
      <div className="p-5 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Analytics</h1>
            <p className="text-muted-foreground text-sm">Platform-wide performance</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV</Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}</div>
        ) : (
          <>
            {/* Revenue over time */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold">Revenue Over Time (last 30 days)</h2>
              {timeData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [formatKWD(v), "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Orders per day */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold">Orders Per Day (last 30 days)</h2>
              {timeData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#10b981" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top tenants by GMV */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <h2 className="text-sm font-semibold">Top Tenants by GMV</h2>
                {topTenants.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No data</p> : (
                  <div className="space-y-2">
                    {topTenants.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.orders} orders</p>
                        </div>
                        <span className="text-sm font-semibold">{formatKWD(t.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status breakdown */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <h2 className="text-sm font-semibold">Order Status Breakdown</h2>
                {statusData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No data</p> : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2">
                      {statusData.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-1 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="capitalize">{s.name}: {s.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
