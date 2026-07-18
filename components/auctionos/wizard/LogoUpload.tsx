"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, ImageOff } from "lucide-react";
import { optimizeImage } from "@/lib/image-optimize";

// Shared drop-zone logo uploader for Identity (auction logo) and
// Franchises (team logos) steps: file -> optimizeImage() -> POST
// /api/auctionos/upload-logo -> onChange(url). Styled as a drag/drop card
// using the existing premium-card surface rather than a bespoke input.
export default function LogoUpload({
  value,
  onChange,
  label = "Logo",
  size = "md",
}: {
  value: string | null;
  onChange: (url: string) => void;
  label?: string;
  size?: "sm" | "md";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const dims = size === "sm" ? "w-20 h-20" : "w-32 h-32";

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const formData = new FormData();
      formData.append("file", optimized.file);
      const res = await fetch("/api/auctionos/upload-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setUploading(false);
        return;
      }
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-jcc-text-muted text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`premium-card ${dims} flex items-center justify-center cursor-pointer overflow-hidden shrink-0 transition-colors ${
          dragActive ? "border-jcc-accent-dark" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {uploading ? (
          <Loader2 className="w-5 h-5 animate-spin text-jcc-accent-dark" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-jcc-text-muted px-2 text-center">
            <UploadCloud className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Upload</span>
          </div>
        )}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-red-500 text-[10px] font-bold">
          <ImageOff className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
