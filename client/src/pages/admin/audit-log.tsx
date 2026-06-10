import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { getSAToken } from "@/lib/auth";
import AdminLayout from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface AuditLog {
  id: string; actorType: string; actorEmail: string; action: string;
  targetType?: string; targetId?: string; details?: string; ip?: string; createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  "tenant.delete": "text-red-600 bg-red-50",
  "tenant.create": "text-green-600 bg-green-50",
  "tenant.status_change": "text-yellow-600 bg-yellow-50",
  "tenant.impersonate": "text-purple-600 bg-purple-50",
  "order.status_change": "text-blue-600 bg-blue-50",
  "settings.update": "text-gray-600 bg-gray-50",
};

export default function AdminAuditLog() {
  const token = getSAToken();
  const authH = { Authorization: `Bearer ${token}` };
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/super-admin/audit-logs"],
    queryFn: () => apiFetch("/api/super-admin/audit-logs", { headers: authH }),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const filtered = logs.filter(l =>
    !search || l.action.includes(search) || l.actorEmail.includes(search) || (l.targetId || "").includes(search)
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AdminLayout>
      <div className="p-5 space-y-5">
        <div>
          <h1 className="text-lg font-bold">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Last {logs.length} sensitive actions</p>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search action, email, ID…" className="pl-8 h-8 text-sm" />
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        ) : paginated.length === 0 ? (
          <div className="rounded-xl border border-border py-12 text-center text-muted-foreground text-sm">No audit log entries yet</div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {paginated.map(log => {
              let details: any = null;
              try { if (log.details) details = JSON.parse(log.details); } catch {}
              return (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium shrink-0 mt-0.5 ${ACTION_COLOR[log.action] ?? "text-gray-600 bg-gray-50"}`}>{log.action}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{log.actorEmail}</span>
                      <span className="text-xs text-muted-foreground capitalize">{log.actorType.replace("_"," ")}</span>
                      {log.targetType && <span className="text-xs text-muted-foreground">{log.targetType}: <span className="font-mono">{(log.targetId || "").slice(0, 8)}</span></span>}
                    </div>
                    {details && <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{JSON.stringify(details)}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">{log.createdAt?.slice(0, 16)?.replace("T"," ")}</span>
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
    </AdminLayout>
  );
}
