import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle2, Loader2, Tag, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  product: { id: string; name: string; basePrice: number };
  variant: { id: string; name: string; priceModifier: number } | null;
  qty: number;
}

interface PickupLocation { id: string; name: string; address: string; enabled: boolean; }

interface StoreInfo {
  id: string; name: string; primaryColor: string; currency: string;
  pickupEnabled: boolean; deliveryEnabled: boolean;
  pickupAddress: string; // legacy
  pickupLocations: PickupLocation[];
}

interface ShippingRate { id: string; name: string; price: number; }

function formatKWD(amount: number) { return amount.toFixed(3) + " KWD"; }

export default function Checkout() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [addressType, setAddressType] = useState<"house" | "apartment" | "office">("house");
  const [shippingRateId, setShippingRateId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "myfatoorah">("cash");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountResult, setDiscountResult] = useState<{ valid: boolean; type: string; value: number; amount: number } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  // Address fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [block, setBlock] = useState("");
  const [street, setStreet] = useState("");
  const [jadda, setJadda] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [unit, setUnit] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(`cart_${slug}`);
    if (raw) {
      try { setCart(JSON.parse(raw)); } catch { navigate(`/t/${slug}`); }
    } else {
      navigate(`/t/${slug}`);
    }
    // Read fulfillment choice set on storefront
    const savedFulfillment = sessionStorage.getItem(`fulfillment_${slug}`);
    if (savedFulfillment === "pickup" || savedFulfillment === "delivery") {
      setFulfillment(savedFulfillment);
    }
    // Read branch selection set on storefront
    const savedBranch = sessionStorage.getItem(`branch_${slug}`);
    if (savedBranch) setSelectedBranchId(savedBranch);
  }, [slug]);

  const { data: store } = useQuery<StoreInfo>({
    queryKey: ["/api/t", slug, "store-info"],
    queryFn: () => apiFetch(`/api/t/${slug}/store-info`),
    enabled: !!slug,
  });

  const { data: shippingRates = [] } = useQuery<ShippingRate[]>({
    queryKey: ["/api/t", slug, "shipping-rates"],
    queryFn: () => apiFetch(`/api/t/${slug}/shipping-rates`),
    enabled: !!slug && fulfillment === "delivery",
  });

  useEffect(() => {
    if (shippingRates.length > 0 && !shippingRateId) {
      setShippingRateId(shippingRates[0].id);
    }
  }, [shippingRates]);

  // Auto-select first enabled pickup branch when store loads
  useEffect(() => {
    if (store) {
      const branches = (store.pickupLocations || []).filter(l => l.enabled);
      if (branches.length > 0 && !selectedBranchId) setSelectedBranchId(branches[0].id);
    }
  }, [store]);

  const accentColor = store?.primaryColor || "#0ea5e9";

  const subtotal = cart.reduce((sum, item) => {
    return sum + (item.product.basePrice + (item.variant?.priceModifier ?? 0)) * item.qty;
  }, 0);

  const selectedShipping = shippingRates.find(r => r.id === shippingRateId);
  const shippingCost = fulfillment === "delivery" ? (selectedShipping?.price ?? 0) : 0;
  const discountAmount = discountResult?.valid ? (discountResult.amount ?? 0) : 0;
  const total = Math.max(0, subtotal + shippingCost - discountAmount);

  async function applyDiscount() {
    if (!discountCode.trim()) return;
    setDiscountLoading(true);
    try {
      const result = await apiFetch<any>(`/api/t/${slug}/validate-discount`, {
        method: "POST",
        body: { code: discountCode, orderAmount: subtotal },
      });
      setDiscountResult(result);
      if (result.valid) {
        toast({ title: "Discount applied", description: `Saving ${formatKWD(result.amount)}` });
      } else {
        toast({ title: "Invalid code", description: result.message || "Discount code not valid", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not validate discount code", variant: "destructive" });
    } finally {
      setDiscountLoading(false);
    }
  }

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      const orderItems = cart.map(item => ({
        productId: item.product.id,
        variantId: item.variant?.id ?? null,
        quantity: item.qty,
        unitPrice: item.product.basePrice + (item.variant?.priceModifier ?? 0),
      }));

      const enabledBranches = (store?.pickupLocations || []).filter(l => l.enabled);
      const selectedBranch = enabledBranches.find(l => l.id === selectedBranchId) || enabledBranches[0] || null;

      const address = fulfillment === "delivery" ? {
        firstName, lastName, phone, area, block, street, jadda,
        houseNumber: addressType === "house" ? houseNumber : undefined,
        buildingNumber: addressType !== "house" ? buildingNumber : undefined,
        floor: addressType !== "house" ? floor : undefined,
        unit: addressType !== "house" ? unit : undefined,
        type: addressType,
      } : fulfillment === "pickup" && selectedBranch ? {
        type: "pickup",
        branchId: selectedBranch.id,
        branchName: selectedBranch.name,
        branchAddress: selectedBranch.address,
      } : null;

      const payload = {
        fulfillmentType: fulfillment,
        paymentMethod,
        items: orderItems,
        address,
        shippingRateId: fulfillment === "delivery" ? shippingRateId : null,
        discountCode: discountResult?.valid ? discountCode : null,
      };

      const res = await apiRequest("POST", `/api/t/${slug}/checkout/place-order`, payload);
      return res.json();
    },
    onSuccess: (data) => {
      sessionStorage.removeItem(`cart_${slug}`);
      if (paymentMethod === "myfatoorah" && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        navigate(`/t/${slug}/confirm?orderId=${data.orderId}`);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Order failed", description: err.message, variant: "destructive" });
    },
  });

  function validate(): string | null {
    if (cart.length === 0) return "Your cart is empty";
    if (fulfillment === "pickup") {
      const branches = (store?.pickupLocations || []).filter(l => l.enabled);
      if (branches.length > 1 && !selectedBranchId) return "Please select a pickup branch";
    }
    if (fulfillment === "delivery") {
      if (!firstName.trim()) return "First name is required";
      if (!lastName.trim()) return "Last name is required";
      if (!/^\d{8}$/.test(phone)) return "Phone must be exactly 8 digits";
      if (!area.trim()) return "Area is required";
      if (!block.trim()) return "Block is required";
      if (!street.trim()) return "Street is required";
      if (!jadda.trim()) return "Jadda is required";
      if (addressType === "house" && !houseNumber.trim()) return "House number is required";
      if (addressType !== "house" && !buildingNumber.trim()) return "Building number is required";
      if (fulfillment === "delivery" && !shippingRateId) return "Select a delivery zone";
    }
    return null;
  }

  function handlePlaceOrder() {
    const err = validate();
    if (err) { toast({ title: "Missing information", description: err, variant: "destructive" }); return; }
    placeOrderMutation.mutate();
  }

  if (cart.length === 0) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(`/t/${slug}`)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold">Checkout</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Fulfillment — read-only summary (choice made on storefront) */}
        {store && (
          <section className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Fulfillment</h2>
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary capitalize">
                {fulfillment === "pickup" ? "📍 Pickup" : "🚚 Delivery"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {fulfillment === "pickup"
                ? "You selected pickup. Choose your branch below if applicable."
                : "You selected delivery. Fill in your address below."}
            </p>
            {fulfillment === "pickup" && (() => {
              const branches = (store.pickupLocations || []).filter(l => l.enabled);
              // Fallback to legacy single address
              if (branches.length === 0 && store.pickupAddress) {
                return <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">{store.pickupAddress}</p>;
              }
              if (branches.length === 1) {
                return (
                  <div className="flex items-start gap-2 bg-muted rounded-lg p-3">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{branches[0].name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{branches[0].address}</p>
                    </div>
                  </div>
                );
              }
              if (branches.length > 1) {
                const selected = branches.find(b => b.id === selectedBranchId) || branches[0];
                return (
                  <div className="space-y-2">
                    <Label className="text-xs">Select Branch *</Label>
                    <div className="space-y-2">
                      {branches.map(branch => (
                        <label
                          key={branch.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedBranchId === branch.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted"
                          }`}
                          data-testid={`radio-branch-${branch.id}`}
                        >
                          <input
                            type="radio"
                            name="branch"
                            value={branch.id}
                            checked={selectedBranchId === branch.id}
                            onChange={() => setSelectedBranchId(branch.id)}
                            className="mt-0.5 accent-primary"
                          />
                          <div>
                            <p className="text-sm font-medium">{branch.name}</p>
                            {branch.address && <p className="text-xs text-muted-foreground mt-0.5">{branch.address}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </section>
        )}

        {/* Delivery address */}
        {fulfillment === "delivery" && (
          <section className="rounded-xl border border-border p-4 space-y-4">
            <h2 className="font-semibold text-sm">Delivery Address</h2>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName" className="text-xs">First Name *</Label>
                <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} data-testid="input-firstName" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
                <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} data-testid="input-lastName" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">Phone (8 digits) *</Label>
              <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={8} data-testid="input-phone" />
            </div>

            {/* Address type */}
            <div className="space-y-1">
              <Label className="text-xs">Address Type *</Label>
              <RadioGroup
                value={addressType}
                onValueChange={(v) => setAddressType(v as "house" | "apartment" | "office")}
                className="flex gap-4"
              >
                {(["house", "apartment", "office"] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer capitalize" data-testid={`radio-${t}`}>
                    <RadioGroupItem value={t} />
                    <span className="text-sm capitalize">{t}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="area" className="text-xs">Area *</Label>
                <Input id="area" value={area} onChange={e => setArea(e.target.value)} data-testid="input-area" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="block" className="text-xs">Block *</Label>
                <Input id="block" value={block} onChange={e => setBlock(e.target.value)} data-testid="input-block" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="street" className="text-xs">Street *</Label>
                <Input id="street" value={street} onChange={e => setStreet(e.target.value)} data-testid="input-street" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="jadda" className="text-xs">Jadda *</Label>
                <Input id="jadda" value={jadda} onChange={e => setJadda(e.target.value)} data-testid="input-jadda" />
              </div>
            </div>

            {/* House-specific */}
            {addressType === "house" && (
              <div className="space-y-1">
                <Label htmlFor="houseNumber" className="text-xs">House Number *</Label>
                <Input id="houseNumber" value={houseNumber} onChange={e => setHouseNumber(e.target.value)} data-testid="input-houseNumber" />
              </div>
            )}

            {/* Apartment / Office fields */}
            {addressType !== "house" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="buildingNumber" className="text-xs">Building Number *</Label>
                  <Input id="buildingNumber" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} data-testid="input-buildingNumber" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="floor" className="text-xs">Floor</Label>
                  <Input id="floor" value={floor} onChange={e => setFloor(e.target.value)} data-testid="input-floor" />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="unit" className="text-xs">
                    {addressType === "apartment" ? "Apartment" : "Office"} Number
                  </Label>
                  <Input id="unit" value={unit} onChange={e => setUnit(e.target.value)} data-testid="input-unit" />
                </div>
              </div>
            )}

            {/* Shipping zone */}
            {shippingRates.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Delivery Zone *</Label>
                <Select value={shippingRateId} onValueChange={setShippingRateId}>
                  <SelectTrigger data-testid="select-shippingRate">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingRates.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} — {formatKWD(r.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </section>
        )}

        {/* Payment */}
        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Payment Method</h2>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as "cash" | "myfatoorah")}
            className="space-y-2"
          >
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors" data-testid="radio-cash">
              <RadioGroupItem value="cash" />
              <div>
                <p className="text-sm font-medium">Cash on Delivery/Pickup</p>
                <p className="text-xs text-muted-foreground">Pay when you receive your order</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted transition-colors" data-testid="radio-myfatoorah">
              <RadioGroupItem value="myfatoorah" />
              <div>
                <p className="text-sm font-medium">MyFatoorah (Card / KNET)</p>
                <p className="text-xs text-muted-foreground">Pay securely online</p>
              </div>
            </label>
          </RadioGroup>
        </section>

        {/* Discount code */}
        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Discount Code</h2>
          <div className="flex gap-2">
            <Input
              placeholder=""
              value={discountCode}
              onChange={e => { setDiscountCode(e.target.value); setDiscountResult(null); }}
              data-testid="input-discountCode"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={applyDiscount}
              disabled={discountLoading || !discountCode.trim()}
              data-testid="button-applyDiscount"
            >
              {discountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              <span className="ml-1.5 text-sm">Apply</span>
            </Button>
          </div>
          {discountResult?.valid && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saving {formatKWD(discountAmount)}
            </p>
          )}
        </section>

        {/* Order summary */}
        <section className="rounded-xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-sm">Order Summary</h2>
          <div className="space-y-2">
            {cart.map(item => {
              const key = item.product.id + (item.variant?.id ?? "");
              const price = (item.product.basePrice + (item.variant?.priceModifier ?? 0)) * item.qty;
              return (
                <div key={key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.product.name}{item.variant ? ` (${item.variant.name})` : ""} × {item.qty}
                  </span>
                  <span>{formatKWD(price)}</span>
                </div>
              );
            })}
          </div>
          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatKWD(subtotal)}</span>
            </div>
            {fulfillment === "delivery" && selectedShipping && (
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery ({selectedShipping.name})</span><span>{formatKWD(shippingCost)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>Discount</span><span>-{formatKWD(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1 border-t border-border">
              <span>Total</span><span>{formatKWD(total)}</span>
            </div>
          </div>
        </section>

        <Button
          className="w-full text-white py-5 text-sm font-semibold"
          style={{ backgroundColor: accentColor }}
          onClick={handlePlaceOrder}
          disabled={placeOrderMutation.isPending}
          data-testid="button-placeOrder"
        >
          {placeOrderMutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Placing Order...</>
          ) : (
            paymentMethod === "myfatoorah" ? "Pay with MyFatoorah" : "Place Order"
          )}
        </Button>
      </main>
    </div>
  );
}
