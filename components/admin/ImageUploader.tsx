"use client";

import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

interface Props {
  currentImage: string;
  gallery: string[];
  onImageChange: (imageUrl: string, gallery: string[]) => void;
  modelRef: string;
  color?: string;
}

export function ImageUploader({ currentImage, gallery, onImageChange, modelRef, color }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadFile = async (file: File, index: number): Promise<string | null> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Format: MODELREF-COLOR-1.jpg (for association with products)
    // The fetchProducts.ts looks for images by modelRef and color
    const colorClean = (color || "DEFAULT").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const modelRefClean = (modelRef || "PRODUCT").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const extension = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `${modelRefClean}-${colorClean}-${index + 1}-${timestamp}.${extension}`;
    const filePath = `products/${fileName}`;

    console.log("[ImageUploader] Uploading with product association:", filePath);
    console.log("[ImageUploader] ModelRef:", modelRef, "Color:", color);

    const { error } = await supabase.storage
      .from("guess-images")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error("[ImageUploader] Upload error:", error.message);
      alert(`שגיאה בהעלאת תמונה: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from("guess-images").getPublicUrl(filePath);
    console.log("[ImageUploader] Upload success:", data.publicUrl);
    return data.publicUrl;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const newUrls: string[] = [];
    const existingCount = gallery.length;
    for (let i = 0; i < Math.min(files.length, 10); i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const url = await uploadFile(file, existingCount + i);
        if (url) newUrls.push(url);
      }
    }

    if (newUrls.length > 0) {
      const newGallery = [...gallery, ...newUrls];
      const mainImage = currentImage.includes("default") ? newUrls[0] : currentImage;
      onImageChange(mainImage, newGallery);
    }

    setUploading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [gallery, currentImage]);

  const setAsMain = (url: string) => onImageChange(url, gallery);

  const removeImage = (url: string) => {
    const newGallery = gallery.filter(g => g !== url);
    const newMain = url === currentImage ? (newGallery[0] || "/images/default.png") : currentImage;
    onImageChange(newMain, newGallery);
  };

  return (
    <div className="space-y-4">
      {/* Main Preview */}
      <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
        <img
          src={currentImage || "/images/default.png"}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = "/images/default.png"; }}
        />
      </div>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading}
        />
        
        <svg className={`w-8 h-8 mx-auto mb-2 ${dragActive ? "text-blue-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        
        {uploading ? (
          <p className="text-sm text-blue-600">מעלה תמונות...</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              <span className="text-blue-600 font-medium">לחץ</span> או גרור תמונות
            </p>
            <p className="text-xs text-slate-400 mt-1">PNG, JPG עד 10MB</p>
          </>
        )}
      </div>

      {/* Gallery Grid */}
      {gallery.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">גלריה ({gallery.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((url, i) => (
              <div key={i} className="relative group aspect-square">
                <img
                  src={url}
                  alt=""
                  className={`w-full h-full object-cover rounded-lg ${url === currentImage ? "ring-2 ring-blue-500" : ""}`}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/images/default.png"; }}
                />
                
                {/* Actions Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                  {url !== currentImage && (
                    <button
                      type="button"
                      onClick={() => setAsMain(url)}
                      className="p-1 bg-white/90 rounded text-blue-600 hover:bg-white"
                      title="הגדר כראשית"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="p-1 bg-white/90 rounded text-red-600 hover:bg-white"
                    title="הסר"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {url === currentImage && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-medium rounded">
                    ראשית
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
