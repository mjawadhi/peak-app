import { useState } from "react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [slug, setSlug] = useState("");

  const demos = [
    { slug: "burgerstack", name: "Burger Stack", color: "#0ea5e9", emoji: "🍔", desc: "Smash burgers & loaded fries" },
    { slug: "noorsweets", name: "Noor Sweets", color: "#f59e0b", emoji: "🍬", desc: "Traditional sweets & desserts" },
  ];

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg aria-label="Peak logo" viewBox="0 0 32 32" className="w-8 h-8" fill="none">
            <polygon points="16,4 28,26 4,26" fill="#0ea5e9" opacity="0.9"/>
            <polygon points="16,10 24,26 8,26" fill="#0f1117"/>
            <polygon points="16,14 22,26 10,26" fill="#0ea5e9" opacity="0.5"/>
          </svg>
          <span className="font-semibold text-lg tracking-tight">Peak</span>
          <span className="text-white/40 text-sm font-normal">Multi Tenant System</span>
        </div>
        <button
          data-testid="link-admin"
          onClick={() => setLocation("/admin")}
          className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/30"
        >
          Super Admin →
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 text-[#0ea5e9] text-xs font-medium px-3 py-1 rounded-full mb-8">
          Phase 1 — Live Platform
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-4 max-w-lg">
          White-label e-commerce,<br/>
          <span className="text-[#0ea5e9]">tenant-isolated</span> by design
        </h1>
        <p className="text-white/50 max-w-md mb-12 text-sm leading-relaxed">
          Each store lives at its own URL with a fully isolated dashboard.
          Owners only see their own orders, products, and settings.
        </p>

        {/* Demo stores */}
        <div className="w-full max-w-md space-y-3 mb-10">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-4">Demo Stores</p>
          {demos.map((d) => (
            <div
              key={d.slug}
              data-testid={`card-store-${d.slug}`}
              className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:border-white/25 transition-all group cursor-pointer"
              onClick={() => setLocation(`/t/${d.slug}`)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ background: d.color + "22", border: `1px solid ${d.color}44` }}
                >
                  {d.emoji}
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-white/40 text-xs">{d.desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  data-testid={`button-storefront-${d.slug}`}
                  onClick={(e) => { e.stopPropagation(); setLocation(`/t/${d.slug}`); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:border-white/40 text-white/60 hover:text-white transition-all"
                >
                  Storefront
                </button>
                <button
                  data-testid={`button-dashboard-${d.slug}`}
                  onClick={(e) => { e.stopPropagation(); setLocation(`/t/${d.slug}/login`); }}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:border-white/40 text-white/60 hover:text-white transition-all"
                >
                  Dashboard
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Go to store by slug */}
        <div className="w-full max-w-md">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Go to store</p>
          <div className="flex gap-2">
            <input
              data-testid="input-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && slug && setLocation(`/t/${slug}`)}
              placeholder="store-slug"
              className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#0ea5e9]/60"
            />
            <button
              data-testid="button-go-slug"
              disabled={!slug}
              onClick={() => slug && setLocation(`/t/${slug}`)}
              className="px-4 py-2 rounded-lg bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Go →
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-4 flex items-center justify-between text-xs text-white/25">
        <span>Peak Multi Tenant System — Phase 1</span>
        <span>Credentials: <code className="text-white/40">Peak@2024!</code></span>
      </footer>
    </div>
  );
}
