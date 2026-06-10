import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import { getTUToken } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Users, Search, Phone, Mail, ShoppingBag, DollarSign } from "lucide-react";
import DashboardLayout from "./layout";

interface Customer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  orderCount: number;
  totalSpend: number;
  createdAt: string;
}

function formatKWD(n: number) {
  return (n ?? 0).toFixed(3) + " KWD";
}

function formatDate(s: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

export default function DashboardCustomers() {
  const { slug } = useParams<{ slug: string }>();
  const token = getTUToken();
  const [search, setSearch] = useState("");

  const authHeaders = { Authorization: `Bearer ${token}` };

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/t", slug, "dashboard/customers"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/customers`, { headers: authHeaders }),
    enabled: !!token && !!slug,
  });

  const filtered = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  // Aggregate stats
  const totalRevenue = customers.reduce((s, c) => s + (c.totalSpend ?? 0), 0);
  const totalOrders = customers.reduce((s, c) => s + (c.orderCount ?? 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <DashboardLayout>
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Customers</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {customers.length} customer{customers.length !== 1 ? "s" : ""} · {totalOrders} total orders
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs">Customers</span>
            </div>
            <p className="text-xl font-bold">{customers.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="text-xs">Orders</span>
            </div>
            <p className="text-xl font-bold">{totalOrders}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-xs">Avg Order</span>
            </div>
            <p className="text-xl font-bold text-sm">{formatKWD(avgOrderValue)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-customerSearch"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border py-14 text-center">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? "No customers match your search." : "No customers yet. They appear here after their first order."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[1fr_140px_100px_110px] gap-3 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border">
              <span>Customer</span>
              <span className="text-center">Orders</span>
              <span className="text-center">Total Spend</span>
              <span className="text-right">Since</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(c => (
                <div
                  key={c.id}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_100px_110px] gap-1 sm:gap-3 px-4 py-3"
                  data-testid={`row-customer-${c.id}`}
                >
                  {/* Identity */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium">
                      {c.name || <span className="text-muted-foreground italic">Guest</span>}
                    </span>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Orders */}
                  <div className="sm:text-center">
                    <span className="text-sm font-semibold">{c.orderCount ?? 0}</span>
                    <span className="text-xs text-muted-foreground ml-1 sm:hidden">orders</span>
                  </div>

                  {/* Total spend */}
                  <div className="sm:text-center">
                    <span className="text-sm font-semibold">{formatKWD(c.totalSpend ?? 0)}</span>
                  </div>

                  {/* Date */}
                  <div className="sm:text-right text-xs text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
