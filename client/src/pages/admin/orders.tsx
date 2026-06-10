import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getSAToken } from "@/lib/auth";
import AdminLayout from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, ChevronDown, ChevronUp, Copy } from "lucide-react";

interface OrderItem { productNameEn: string; variantNameEn?: string | null; quantity: number; unitPrice: number; totalPrice: number; }
interface Order {
  id: string; tenantId: string; tenantName: string; tenantSlug: string;
  orderNumber: string; fulfillmentType: string; status: string;
  paymentMethod: string; paymentStatus: string;
  subtotal: number; total: number; shippingAmount: number; discountAmount: number;
  addressSnapshot?: string | null; branchName?: string | null; branchAddress?: string | null;
  specialInstructions?: string | null;
  createdAt: string; items: OrderItem[];
}

const STATUSES = ["", "pending","confirmed","preparing","ready_pickup","out_for_delivery","delivered","cancelled"];

function formatKWD(n: number) { return (parseFloat(String(n)) || 0).toFixed(3) + " KWD"; }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string,string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    preparing: "bg-purple-100 text-purple-700",
    ready_pickup: "bg-teal-100 text-teal-700",
    out_for_delivery: "bg-orange-100 text-orange-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${map[status] ?? "bg-muted text-muted-foreground"}`}>{status.replace(/_/g," ")}</span>;
}

function csvExport(orders: Order[]) {
  const rows = [["Order #","Tenant","Fulfillment","Status","Payment","Total KWD","Date"]];
  orders.forEach(o => rows.push([o.orderNumber, o.tenantName, o.fulfillmentType, o.status, o.paymentMethod, String((parseFloat(String(o.total))||0).toFixed(3)), o.createdAt?.slice(0,10) || ""]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "orders.csv"; a.click();
}

export default function AdminOrders() {
  const token = getSAToken();
  const { toast } = useToast();
  const authH = { Authorization: `Bearer ${token}` };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  if (tenantFilter) params.set("tenantId", tenantFilter);
  if (paymentFilter) params.set("paymentMethod", paymentFilter);
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/super-admin/orders", statusFilter, tenantFilter, paymentFilter, fromDate, toDate],
    queryFn: () => apiFetch(`/api/super-admin/orders?${params.toString()}`, { headers: authH }),
    enabled: !!token,
  });

  const filtered = orders.filter(o =>
    !search || o.orderNumber.toLowerCase().includes(search.toLowerCase()) || o.tenantName.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tenantOptions = [...new Map(orders.map(o => [o.tenantId, { id: o.tenantId, name: o.tenantName }])).values()];

  return (
    <AdminLayout>
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold">Orders</h1>
            <p className="text-muted-foreground text-sm">{filtered.length} orders</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => csvExport(filtered)} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Order # or tenant…" className="pl-8 h-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s ? s.replace(/_/g," ") : "All statuses"}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={tenantFilter} onValueChange={v => { setTenantFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All tenants" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">All tenants</SelectItem>
              {tenantOptions.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Payment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">All</SelectItem>
              <SelectItem value="cash" className="text-xs">Cash</SelectItem>
              <SelectItem value="myfatoorah" className="text-xs">MyFatoorah</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-8 text-xs w-36" />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-8 text-xs w-36" />
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : paginated.length === 0 ? (
          <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">No orders found</div>
        ) : (
          <div className="space-y-2">
            {paginated.map(order => {
              const isExp = expanded === order.id;
              const addr = order.addressSnapshot ? (() => { try { return JSON.parse(order.addressSnapshot!); } catch { return null; } })() : null;
              return (
                <div key={order.id} className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50" onClick={() => setExpanded(isExp ? null : order.id)}>
                    <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
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
                        <p className="text-xs text-muted-foreground">Tenant</p>
                        <p className="text-sm font-medium">{order.tenantName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-sm font-semibold">{formatKWD(order.total)}</p>
                      </div>
                      <div><StatusBadge status={order.status} /></div>
                      <div>
                        <p className="text-xs text-muted-foreground">{order.createdAt?.slice(0,10)}</p>
                        <p className="text-xs capitalize">{order.fulfillmentType}</p>
                      </div>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>
                  {isExp && (
                    <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Payment:</span> <span className="font-medium capitalize">{order.paymentMethod}</span></div>
                        <div><span className="text-muted-foreground">Pay status:</span> <span className="font-medium capitalize">{order.paymentStatus}</span></div>
                        <div><span className="text-muted-foreground">Subtotal:</span> <span className="font-medium">{formatKWD(order.subtotal)}</span></div>
                        <div><span className="text-muted-foreground">Shipping:</span> <span className="font-medium">{formatKWD(order.shippingAmount)}</span></div>
                        {order.discountAmount > 0 && <div><span className="text-muted-foreground">Discount:</span> <span className="font-medium">-{formatKWD(order.discountAmount)}</span></div>}
                        {order.fulfillmentType === "pickup" && order.branchName && (
                          <div className="col-span-2"><span className="text-muted-foreground">Branch:</span> <span className="font-medium">{order.branchName}{order.branchAddress ? ` — ${order.branchAddress}` : ""}</span></div>
                        )}
                        {order.fulfillmentType === "delivery" && addr && (
                          <div className="col-span-4">
                            <span className="text-muted-foreground">Delivery address: </span>
                            <span className="font-medium">{addr.firstName} {addr.lastName} · {addr.phone} · {addr.area}, Block {addr.block}, Street {addr.street}, Jadda {addr.jadda}{addr.houseNumber ? `, House ${addr.houseNumber}` : ""}
                            {addr.buildingNumber ? `, Bldg ${addr.buildingNumber}` : ""}{addr.floor ? `, Floor ${addr.floor}` : ""}
                            {addr.unitNumber ? `, Unit ${addr.unitNumber}` : ""}</span>
                          </div>
                        )}
                        {order.specialInstructions && <div className="col-span-4"><span className="text-muted-foreground">Note:</span> <span className="italic">{order.specialInstructions}</span></div>}
                      </div>
                      <div className="space-y-1">
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
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>Page {page} of {totalPages} · {filtered.length} results</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2 text-xs">Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 px-2 text-xs">Next</Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
