import { useState, useRef, useCallback } from "react";
import { getTUToken } from "@/lib/auth";
import { resolveUrl } from "@/lib/queryClient";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";

interface ImageUploadProps {
  value: string;           // current image URL
  onChange: (url: string) => void;
  className?: string;
}

export function ImageUpload({ value, onChange, className = "" }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = getTUToken();

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5 MB");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      const { url } = await res.json();
      onChange(url);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [token]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // reset so same file can be re-selected
    e.target.value = "";
  };

  function clearImage() {
    onChange("");
    setError(null);
  }

  // Preview state — show image if we have one
  if (value) {
    return (
      <div className={`relative rounded-xl overflow-hidden border border-border group ${className}`} style={{ aspectRatio: "16/9" }}>
        <img
          src={resolveUrl(value)}
          alt="Product"
          className="w-full h-full object-cover"
          onError={() => setError("Image failed to load")}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="bg-white text-black text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={clearImage}
            className="bg-white text-destructive text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative rounded-xl border-2 border-dashed transition-colors cursor-pointer
          flex flex-col items-center justify-center gap-2 py-7
          ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              {dragging ? <ImageIcon className="w-5 h-5 text-primary" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{dragging ? "Drop to upload" : "Upload image"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click · JPEG, PNG, WebP · max 5 MB</p>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
    </div>
  );
}
