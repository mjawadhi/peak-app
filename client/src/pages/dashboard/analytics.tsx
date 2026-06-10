import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { getTUToken, decodePayload } from "@/lib/auth";
import DashboardLayout from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, ShoppingCart, DollarSign, Clock } from "lucide-react";

interface AnalyticsData {
  kpi: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    pendingOrders: number;
  };
  revenueByDay: Record<string, number>;
  ordersByDay: Record<string, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  statusBreakdown: Record<string, number>;
  fulfillmentSplit: { pickup: number; delivery: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "#f59e0b",
  confirmed: "#3b82f6",
  preparing: "#8b5cf6",
  ready:     "#06b6d4",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

const FULFILLMENT_COLORS = ["#6366f1", "#10b981"];

function KpiCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="rounded-lg p-2" style={{ backgroundColor: color + "20" }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TenantAnalyticsPage() {
  const { slug } = useParams<{ slug: string }>();

  // Check permission from JWT
  const token = getTUToken();
  const payload = token ? decodePayload(token) : null;
  const perms = (() => {
    try { return JSON.parse(payload?.permissions || "{}"); } catch { return {}; }
  })();
  const hasAccess = payload?.role === "owner" || perms?.analytics === true;

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/t", slug, "dashboard/analytics"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/analytics`),
    enabled: !!slug && hasAccess,
  });

  // Build sorted day arrays for charts (last 30 days present in data)
  const dayChartData = (() => {
    if (!data) return [];
    const days = Array.from(
      new Set([...Object.keys(data.revenueByDay), ...Object.keys(data.ordersByDay)])
    ).sort().slice(-30);
    return days.map(d => ({
      date: d.slice(5), // MM-DD
      revenue: +(data.revenueByDay[d] || 0).toFixed(3),
      orders: data.ordersByDay[d] || 0,
    }));
  })();

  const statusData = data
    ? Object.entries(data.statusBreakdown).map(([name, value]) => ({ name, value }))
    : [];

  const fulfillmentData = data
    ? [
        { name: "Pickup", value: data.fulfillmentSplit.pickup },
        { name: "Delivery", value: data.fulfillmentSplit.delivery },
      ]
    : [];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-bold">Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Overview of your store performance</p>
        </div>

        {/* No access */}
        {!hasAccess && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              You don't have permission to view analytics.
            </CardContent>
          </Card>
        )}

        {hasAccess && isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="pt-5 pb-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
            ))}
          </div>
        )}

        {hasAccess && error && (
          <Card>
            <CardContent className="py-8 text-center text-destructive text-sm">
              Failed to load analytics.
            </CardContent>
          </Card>
        )}

        {hasAccess && data && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Total Revenue"
                value={`KD ${data.kpi.totalRevenue.toFixed(3)}`}
                icon={DollarSign}
                color="#10b981"
              />
              <KpiCard
                label="Total Orders"
                value={String(data.kpi.totalOrders)}
                icon={ShoppingCart}
                color="#6366f1"
              />
              <KpiCard
                label="Avg Order Value"
                value={`KD ${data.kpi.avgOrderValue.toFixed(3)}`}
                icon={TrendingUp}
                color="#f59e0b"
              />
              <KpiCard
                label="Pending Orders"
                value={String(data.kpi.pendingOrders)}
                sub="Awaiting action"
                icon={Clock}
                color="#ef4444"
              />
            </div>

            {/* Revenue over time */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {dayChartData.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No orders yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dayChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={v => `${v}`} />
                      <Tooltip
                        formatter={(v: number) => [`KD ${v.toFixed(3)}`, "Revenue"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Orders per day + Top products side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Orders per day */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Orders Per Day</CardTitle>
                </CardHeader>
                <CardContent>
                  {dayChartData.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">No orders yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dayChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={28} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="orders" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top products */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">No orders yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={data.topProducts}
                        layout="vertical"
                        margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 10 }}
                          width={90}
                          tickFormatter={n => n.length > 12 ? n.slice(0, 12) + "…" : n}
                        />
                        <Tooltip
                          formatter={(v: number, name: string) => [v, name === "qty" ? "Units sold" : "Revenue"]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Bar dataKey="qty" fill="#f59e0b" radius={[0, 3, 3, 0]} name="qty" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Status breakdown + Fulfillment split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Order status pie */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Order Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">No orders yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, name: string) => [v, name]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={v => <span style={{ fontSize: 11 }} className="capitalize">{v}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Fulfillment split */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Pickup vs Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                  {(data.fulfillmentSplit.pickup + data.fulfillmentSplit.delivery) === 0 ? (
                    <p className="text-xs text-muted-foreground py-8 text-center">No orders yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={fulfillmentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {fulfillmentData.map((_, i) => (
                            <Cell key={i} fill={FULFILLMENT_COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, name: string) => [v, name]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={v => <span style={{ fontSize: 11 }}>{v}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
