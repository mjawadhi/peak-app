import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import { CheckCircle2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Confirm() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<"success" | "failed" | "loading">("loading");
  const [accentColor, setAccentColor] = useState("#0ea5e9");

  useEffect(() => {
    const hash = window.location.hash;
    const search = hash.includes("?") ? hash.split("?")[1] : "";
    const params = new URLSearchParams(search);
    const id = params.get("orderId");
    const payStatus = params.get("status");
    setOrderId(id);

    async function fetchStoreAndConfirm() {
      try {
        const storeInfo = await apiFetch<any>(`/api/t/${slug}/store-info`);
        if (storeInfo?.primaryColor) setAccentColor(storeInfo.primaryColor);
      } catch {}

      // If returning from mock payment gateway
      if (payStatus === "failed") {
        setStatus("failed");
        return;
      }
      setStatus("success");
    }
    fetchStoreAndConfirm();
  }, [slug]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      {status === "loading" ? null : status === "success" ? (
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: accentColor }} />
          <h1 className="text-xl font-bold">Order Placed!</h1>
          <p className="text-muted-foreground text-sm">
            Your order has been received. We'll get back to you shortly.
          </p>
          {orderId && (
            <p className="text-xs text-muted-foreground font-mono bg-muted rounded-lg px-3 py-2">
              Order ID: {orderId}
            </p>
          )}
          <Button
            className="mt-4 text-white w-full"
            style={{ backgroundColor: accentColor }}
            onClick={() => navigate(`/t/${slug}`)}
            data-testid="button-backToStore"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Store
          </Button>
        </div>
      ) : (
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">✕</span>
          </div>
          <h1 className="text-xl font-bold">Payment Failed</h1>
          <p className="text-muted-foreground text-sm">
            Something went wrong with your payment. Please try again.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/t/${slug}/checkout`)}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
