import { useRef, useState, useCallback, useEffect } from "react";
import { resolveUrl } from "@/lib/queryClient";
import { Move } from "lucide-react";

interface ImagePositionPickerProps {
  imageUrl: string;
  position: string; // "X% Y%"
  onChange: (position: string) => void;
}

function parsePosition(pos: string): { x: number; y: number } {
  const parts = pos.split(" ");
  const x = parseFloat(parts[0]) || 50;
  const y = parseFloat(parts[1]) || 50;
  return { x, y };
}

export function ImagePositionPicker({ imageUrl, position, onChange }: ImagePositionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const { x, y } = parsePosition(position);

  const positionFromEvent = useCallback((e: MouseEvent | TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const px = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const py = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    onChange(`${Math.round(px)}% ${Math.round(py)}%`);
  }, [onChange]);

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent | TouchEvent) => positionFromEvent(e);
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, [dragging, positionFromEvent]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Move className="w-3 h-3" /> Drag to reposition image
        </p>
        <button
          type="button"
          onClick={() => onChange("50% 50%")}
          className="text-[10px] text-muted-foreground hover:text-foreground underline"
        >
          Reset center
        </button>
      </div>

      {/* Preview + drag surface */}
      <div
        ref={containerRef}
        onMouseDown={e => { e.preventDefault(); setDragging(true); positionFromEvent(e.nativeEvent); }}
        onTouchStart={e => { setDragging(true); positionFromEvent(e.nativeEvent); }}
        className={`relative rounded-xl overflow-hidden border border-border select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ aspectRatio: "16/7" }}
      >
        <img
          src={resolveUrl(imageUrl)}
          alt="Position preview"
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: position }}
          draggable={false}
        />

        {/* Crosshair dot showing current focal point */}
        <div
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <div className="w-full h-full rounded-full border-2 border-white shadow-md bg-white/30" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow" />
          </div>
        </div>

        {/* Hint overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/50 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
            <Move className="w-3 h-3" /> Drag to adjust
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        Position: {x}% / {y}%
      </p>
    </div>
  );
}
