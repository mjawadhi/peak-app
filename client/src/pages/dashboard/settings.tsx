import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiFetch, apiRequest, queryClient } from "@/lib/queryClient";
import { getTUToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Plus, Trash2, MapPin, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "./layout";

interface PickupLocation { id: string; name: string; address: string; enabled: boolean; }

interface Settings {
  name: string; description: string; primaryColor: string;
  logoUrl: string; currency: string;
  pickupEnabled: boolean; deliveryEnabled: boolean;
  pickupLocations: PickupLocation[];
}

// Only these fields are editable by the store owner
interface FulfillmentForm {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  pickupLocations: PickupLocation[];
}

function genId() { return Math.random().toString(36).slice(2); }

export default function DashboardSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const token = getTUToken();

  const [form, setForm] = useState<FulfillmentForm>({
    pickupEnabled: true,
    deliveryEnabled: true,
    pickupLocations: [],
  });

  // Read-only store branding (set by super admin only)
  const [storeInfo, setStoreInfo] = useState({ name: "", description: "", logoUrl: "", primaryColor: "#0ea5e9" });

  const authHeaders = { Authorization: `Bearer ${token}` };

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/t", slug, "dashboard/settings"],
    queryFn: () => apiFetch(`/api/t/${slug}/dashboard/settings`, { headers: authHeaders }),
    enabled: !!token && !!slug,
  });

  useEffect(() => {
    if (settings) {
      setStoreInfo({
        name: settings.name,
        description: settings.description,
        logoUrl: settings.logoUrl,
        primaryColor: settings.primaryColor,
      });
      setForm({
        pickupEnabled: settings.pickupEnabled,
        deliveryEnabled: settings.deliveryEnabled,
        pickupLocations: settings.pickupLocations?.length
          ? settings.pickupLocations
          : (settings as any).pickupAddress
            ? [{ id: genId(), name: "Main Location", address: (settings as any).pickupAddress, enabled: true }]
            : [],
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Only send fulfillment fields — store info is read-only for owners
      await apiRequest("PATCH", `/api/t/${slug}/dashboard/settings`, {
        pickupEnabled: form.pickupEnabled,
        deliveryEnabled: form.deliveryEnabled,
        pickupLocations: form.pickupLocations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "dashboard/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/t", slug, "store-info"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function addLocation() {
    setForm(p => ({
      ...p,
      pickupLocations: [...p.pickupLocations, { id: genId(), name: "", address: "", enabled: true }],
    }));
  }

  function updateLocation(id: string, field: keyof PickupLocation, value: any) {
    setForm(p => ({
      ...p,
      pickupLocations: p.pickupLocations.map(loc => loc.id === id ? { ...loc, [field]: value } : loc),
    }));
  }

  function removeLocation(id: string) {
    setForm(p => ({ ...p, pickupLocations: p.pickupLocations.filter(loc => loc.id !== id) }));
  }

  return (
    <DashboardLayout>
      <div className="p-5 max-w-lg space-y-6">
        <div>
          <h1 className="text-lg font-bold">Store Settings</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage fulfillment options for your store</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : (
          <div className="space-y-4">

            {/* Read-only store identity — managed by super admin */}
            <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Store Identity</h2>
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> Admin only
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Store name, description, logo, and brand color are managed by the platform administrator.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Name</p>
                  <p className="font-medium">{storeInfo.name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Brand Color</p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-border inline-block"
                      style={{ background: storeInfo.primaryColor }}
                    />
                    <span className="font-mono">{storeInfo.primaryColor}</span>
                  </div>
                </div>
                {storeInfo.description && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-0.5">Description</p>
                    <p>{storeInfo.description}</p>
                  </div>
                )}
                {storeInfo.logoUrl && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-0.5">Logo</p>
                    <img src={storeInfo.logoUrl} alt="Logo" className="h-10 w-auto rounded border border-border object-contain" />
                  </div>
                )}
              </div>
            </section>

            {/* Fulfillment — editable by owner */}
            <section className="rounded-xl border border-border p-4 space-y-4">
              <h2 className="text-sm font-semibold">Fulfillment Options</h2>

              {/* Delivery toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Delivery</p>
                  <p className="text-xs text-muted-foreground">Allow customers to request delivery to address</p>
                </div>
                <Switch checked={form.deliveryEnabled} onCheckedChange={v => setForm(p => ({ ...p, deliveryEnabled: v }))} data-testid="switch-deliveryEnabled" />
              </div>

              {/* Pickup toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Pickup</p>
                  <p className="text-xs text-muted-foreground">Allow customers to pick up their orders</p>
                </div>
                <Switch checked={form.pickupEnabled} onCheckedChange={v => setForm(p => ({ ...p, pickupEnabled: v }))} data-testid="switch-pickupEnabled" />
              </div>

              {/* Pickup locations */}
              {form.pickupEnabled && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" /> Pickup Locations
                    </div>
                    <button
                      onClick={addLocation}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                      data-testid="button-addPickupLocation"
                    >
                      <Plus className="w-3 h-3" /> Add Location
                    </button>
                  </div>

                  {form.pickupLocations.length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
                      No pickup locations yet. Click "Add Location" to add one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.pickupLocations.map((loc, i) => (
                        <div
                          key={loc.id}
                          className={`rounded-lg border p-3 space-y-2 transition-colors ${loc.enabled ? "border-border" : "border-border/50 opacity-60"}`}
                          data-testid={`card-pickupLocation-${loc.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder={`Location ${i + 1} name (e.g. Main Branch)`}
                              value={loc.name}
                              onChange={e => updateLocation(loc.id, "name", e.target.value)}
                              className="text-xs h-8"
                              data-testid={`input-locationName-${loc.id}`}
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Switch
                                checked={loc.enabled}
                                onCheckedChange={v => updateLocation(loc.id, "enabled", v)}
                                data-testid={`switch-locationEnabled-${loc.id}`}
                              />
                              <button
                                onClick={() => removeLocation(loc.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                data-testid={`button-removeLocation-${loc.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <Textarea
                            placeholder="Full address..."
                            rows={2}
                            value={loc.address}
                            onChange={e => updateLocation(loc.id, "address", e.target.value)}
                            className="text-xs resize-none"
                            data-testid={`input-locationAddress-${loc.id}`}
                          />
                          <p className="text-xs text-muted-foreground">
                            {loc.enabled ? "Customers can select this location" : "Disabled — hidden from customers"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <Button
              className="w-full flex items-center gap-2"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-saveSettings"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
