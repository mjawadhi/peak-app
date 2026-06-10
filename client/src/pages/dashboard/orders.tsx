import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getTUToken } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "./layout";
import { StatusBadge } from "./overview";
import { Search, Copy, ChevronDown, ChevronUp, Download } from "lucide-react";

interface OrderItem { productNameEn: string; variantNameEn: string | null; quantity: number; unitPrice: number; totalPrice: number; }
interface Order {
  id: string; orderNumber: string; status: string; total: number; subtotal: number; shippingAmount: number; discountAmount: number;
  fulfillmentType: string; paymentMethod: string; paymentStatus: string;
  addressSnapshot?: string | null; branchName?: string | null; branchAddress?: string | null;
  specialInstructions?: string | null;
  createdAt: string;
  items: OrderItem[];
}

function formatKWD(n: number) { return (parseFloat(String(n)) || 0).toFixed(3) + " KWD"; }

const STATUSES = ["pending","confirmed","preparing","ready_pickup","out_for_delivery","delivered","cancelled"];

function csvExport(orders: Order[], slug: string) {
  const rows = [["Order #","Fulfillment","Status","Payment","Total KWD","Date"]];
  orders.forEach(o => rows.push([o.orderNumber, o.fulfillmentType, o.status, o.paymentMethod, String((parseFloat(String(o.total))||0).toFixed(3)), (o.createdAt||"").slice(0,10)]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `orders-${slug}.csv`; a.click();
}

export default function DashboardOrders() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const token = getTUToken();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/t", slug, "dashboard/orders"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/orders`, { headers: { Authorization: `Bearer ${token}` } }),
    enabled: !!token && !!slug,
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      await apiRequest("PATCH", `/api/t/${slug}/dashboard/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/orders"] });
      toast({ title: "Order updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const filtered = sorted.filter(o => {
    const matchSearch = !search || o.orderNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <DashboardLayout>
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">Orders</h1>
            <p className="text-muted-foreground text-sm">{orders.length} total</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => csvExport(filtered, slug || "store")} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search order #…" className="pl-8 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : paginated.length === 0 ? (
          <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">No orders found</div>
        ) : (
          <div className="space-y-2">
            {paginated.map(order => {
              const isExp = expanded === order.id;
              const addr = order.addressSnapshot ? (() => { try { return JSON.parse(order.addressSnapshot!); } catch { return null; } })() : null;
              return (
                <div key={order.id} className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setExpanded(isExp ? null : order.id)}>
                    <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Order #</p>
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-mono font-medium">{order.orderNumber}</p>
                          <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(order.id); toast({ title: "ID copied" }); }} className="text-muted-foreground hover:text-foreground">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fulfillment</p>
                        <p className="text-sm capitalize">{order.fulfillmentType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-sm font-semibold">{formatKWD(order.total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                    <div onClick={e => e.stopPropagation()}>
                      <Select value={order.status} onValueChange={val => statusMutation.mutate({ orderId: order.id, status: val })}>
                        <SelectTrigger className="h-8 text-xs w-36" data-testid={`select-status-${order.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace(/_/g," ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>

                  {isExp && (
                    <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Payment: </span><span className="font-medium capitalize">{order.paymentMethod}</span></div>
                        <div><span className="text-muted-foreground">Pay status: </span><span className="font-medium capitalize">{order.paymentStatus}</span></div>
                        <div><span className="text-muted-foreground">Date: </span><span className="font-medium">{new Date(order.createdAt).toLocaleString()}</span></div>
                        {order.discountAmount > 0 && <div><span className="text-muted-foreground">Discount: </span><span className="font-medium">-{formatKWD(order.discountAmount)}</span></div>}
                        {order.fulfillmentType === "pickup" && order.branchName && (
                          <div className="col-span-2"><span className="text-muted-foreground">Branch: </span><span className="font-medium">{order.branchName}{order.branchAddress ? ` — ${order.branchAddress}` : ""}</span></div>
                        )}
                        {order.fulfillmentType === "delivery" && addr && (
                          <div className="col-span-4">
                            <span className="text-muted-foreground">Delivery: </span>
                            <span className="font-medium">{addr.firstName} {addr.lastName} · {addr.phone} · {addr.area}, Block {addr.block}, Street {addr.street}
                            {addr.houseNumber ? `, House ${addr.houseNumber}` : ""}
                            {addr.buildingNumber ? `, Bldg ${addr.buildingNumber}` : ""}
                            {addr.floor ? `, Fl ${addr.floor}` : ""}
                            {addr.unitNumber ? `, Unit ${addr.unitNumber}` : ""}</span>
                          </div>
                        )}
                        {order.specialInstructions && <div className="col-span-4"><span className="text-muted-foreground">Note: </span><span className="italic">{order.specialInstructions}</span></div>}
                      </div>
                      <div className="space-y-1 pt-1">
                        <p className="text-xs font-medium text-muted-foreground">Items</p>
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.productNameEn}{item.variantNameEn ? ` (${item.variantNameEn})` : ""} × {item.quantity}</span>
                            <span className="text-muted-foreground">{formatKWD(item.totalPrice)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2 text-xs">Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2 text-xs">Next</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
