import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getSAToken } from "@/lib/auth";
import AdminLayout from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface PlatformSettings {
  platformName: string; logoUrl: string; defaultCurrency: string;
  defaultCommissionRate: number; defaultTaxRate: number;
  paymentGateway: string; paymentGatewayKey: string; supportEmail: string;
}

export default function AdminSettings() {
  const token = getSAToken();
  const { toast } = useToast();
  const authH = { Authorization: `Bearer ${token}` };
  const [form, setForm] = useState<PlatformSettings>({
    platformName: "Peak Multi Tenant System", logoUrl: "", defaultCurrency: "KWD",
    defaultCommissionRate: 0, defaultTaxRate: 0,
    paymentGateway: "myfatoorah", paymentGatewayKey: "", supportEmail: "",
  });

  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["/api/super-admin/settings"],
    queryFn: () => apiFetch("/api/super-admin/settings", { headers: authH }),
    enabled: !!token,
  });

  useEffect(() => {
    if (data) setForm(f => ({ ...f, ...data }));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/super-admin/settings", form, authH),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const Field = ({ label, id, type = "text", value, onChange, placeholder }: any) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );

  if (isLoading) return <AdminLayout><div className="p-5 space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-5 space-y-6 max-w-xl">
        <div>
          <h1 className="text-lg font-bold">Platform Settings</h1>
          <p className="text-muted-foreground text-sm">Global configuration for Peak MTS</p>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Branding</h2>
          <Field label="Platform Name" id="platformName" value={form.platformName} onChange={(e: any) => setForm(f => ({ ...f, platformName: e.target.value }))} />
          <Field label="Logo URL" id="logoUrl" value={form.logoUrl} onChange={(e: any) => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://…" />
          <Field label="Support Email" id="supportEmail" type="email" value={form.supportEmail} onChange={(e: any) => setForm(f => ({ ...f, supportEmail: e.target.value }))} placeholder="support@example.com" />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Financial Defaults</h2>
          <Field label="Default Currency" id="currency" value={form.defaultCurrency} onChange={(e: any) => setForm(f => ({ ...f, defaultCurrency: e.target.value }))} placeholder="KWD" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Default Commission %</Label>
              <Input type="number" min="0" max="100" value={form.defaultCommissionRate} onChange={e => setForm(f => ({ ...f, defaultCommissionRate: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default Tax Rate %</Label>
              <Input type="number" min="0" max="100" value={form.defaultTaxRate} onChange={e => setForm(f => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Payment Gateway</h2>
          <Field label="Gateway" id="gateway" value={form.paymentGateway} onChange={(e: any) => setForm(f => ({ ...f, paymentGateway: e.target.value }))} placeholder="myfatoorah" />
          <div className="space-y-1">
            <Label className="text-xs">API Key / Secret</Label>
            <Input type="password" value={form.paymentGatewayKey} onChange={e => setForm(f => ({ ...f, paymentGatewayKey: e.target.value }))} placeholder="••••••••" />
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </AdminLayout>
  );
}
