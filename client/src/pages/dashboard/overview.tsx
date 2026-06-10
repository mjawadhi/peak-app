import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { getTUToken } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, DollarSign, Clock, CheckCircle } from "lucide-react";
import DashboardLayout from "./layout";

interface Order {
  id: string; status: string; total: number; orderNumber: string;
  fulfillmentType: string; createdAt: string;
}

function formatKWD(n: number) { return (parseFloat(String(n)) || 0).toFixed(3) + " KWD"; }

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    preparing: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    ready_pickup: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    out_for_delivery: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function DashboardOverview() {
  const { slug } = useParams<{ slug: string }>();
  const token = getTUToken();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/t", slug, "dashboard/orders"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/orders`, { headers: { Authorization: `Bearer ${token}` } }),
    enabled: !!token && !!slug,
  });

  // Fix: always parse to number to prevent NaN
  const totalRevenue = orders
    .filter(o => o.status !== "cancelled")
    .reduce((s, o) => s + (parseFloat(String(o.total)) || 0), 0);

  const pending = orders.filter(o => o.status === "pending").length;
  const completed = orders.filter(o => o.status === "delivered" || o.status === "ready_pickup").length;

  const stats = [
    { label: "Total Orders", value: orders.length.toString(), icon: ShoppingBag, color: "#6366f1" },
    { label: "Revenue", value: formatKWD(totalRevenue), icon: DollarSign, color: "#10b981" },
    { label: "Pending", value: pending.toString(), icon: Clock, color: "#f59e0b" },
    { label: "Completed", value: completed.toString(), icon: CheckCircle, color: "#3b82f6" },
  ];

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <DashboardLayout>
      <div className="p-5 space-y-6">
        <div>
          <h1 className="text-lg font-bold">Overview</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your store at a glance</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              {isLoading ? <Skeleton className="h-6 w-16" /> : (
                <p className="text-lg font-bold">{value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Orders</h2>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recentOrders.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No orders yet</div>
          ) : (
            <div className="divide-y divide-border">
              {recentOrders.map(order => (
                <div key={order.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium font-mono">{order.orderNumber || order.id.slice(0, 8) + "…"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{order.fulfillmentType}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatKWD(order.total)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
