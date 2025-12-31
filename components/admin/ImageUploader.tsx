"use client";

import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

interface Props {
  currentImage: string;
  gallery: string[];
  onImageChange: (imageUrl: string, gallery: string[]) => void;
  modelRef: string;
  color?: string;
  itemCode?: string; // For bags: used to extract actual modelRef
}

export function ImageUploader({ currentImage, gallery, onImageChange, modelRef, color, itemCode }: Props & { itemCode?: string }) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const uploadFile = async (file: File, index: number): Promise<string | null> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // IMPORTANT: Use the EXACT modelRef and color format as stored in Google Sheets
    // fetchProducts.ts matches by modelRef.toUpperCase().trim() and color.toUpperCase().trim()
    // So we must use the same format for the filename and index
    
    // For bags: modelRef is extracted from itemCode (e.g., "NN984571-BLA-OS" -> "NN984571")
    // Extract modelRef from itemCode if available, otherwise use modelRef as-is
    let actualModelRef = modelRef;
    if (itemCode && itemCode.includes("-")) {
      const parts = itemCode.split("-");
      actualModelRef = parts[0]; // Extract modelRef from itemCode
      console.log("[ImageUploader] Extracted modelRef from itemCode:", actualModelRef, "from itemCode:", itemCode);
    }
    
    // For filename: use clean format (no spaces/special chars) for file system compatibility
    const colorForFilename = (color || "DEFAULT").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    const modelRefForFilename = (actualModelRef || "PRODUCT").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
    
    // For index: use EXACT format as in Google Sheets (just uppercase, no cleaning)
    // This ensures matching works correctly in fetchProducts
    const colorForIndex = (color || "DEFAULT").toUpperCase().trim();
    const modelRefForIndex = (actualModelRef || "PRODUCT").toUpperCase().trim();
    
    const extension = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `${modelRefForFilename}-${colorForFilename}-${index + 1}-${timestamp}.${extension}`;
    const filePath = `products/${fileName}`;

    console.log("[ImageUploader] Uploading with product association:", filePath);
    console.log("[ImageUploader] ModelRef (for index):", modelRefForIndex, "Color (for index):", colorForIndex);
    console.log("[ImageUploader] ModelRef (for filename):", modelRefForFilename, "Color (for filename):", colorForFilename);

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from("guess-images")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("[ImageUploader] Upload error:", uploadError.message);
      alert(`שגיאה בהעלאת תמונה: ${uploadError.message}`);
      return null;
    }

    const { data: urlData } = supabase.storage.from("guess-images").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;
    console.log("[ImageUploader] Upload success:", publicUrl);

    // Index the image in image_index table with EXACT modelRef and color format
    // This ensures fetchProducts can match it correctly
    try {
      const { error: indexError } = await supabase
        .from("image_index")
        .upsert({
          model_ref: modelRefForIndex, // Use exact format (just uppercase, no cleaning)
          color: colorForIndex,        // Use exact format (just uppercase, no cleaning)
          filename: fileName,
          url: publicUrl,
        }, {
          onConflict: "filename"
        });

      if (indexError) {
        console.error("[ImageUploader] Index error:", indexError);
        alert(`שגיאה באינדוקס התמונה: ${indexError.message}`);
        // Don't fail the upload if indexing fails, but warn user
      } else {
        console.log("[ImageUploader] Image indexed successfully with modelRef:", modelRefForIndex, "color:", colorForIndex);
        // Note: Image will appear after cache refresh (up to 1 minute)
        // User should refresh the page to see it immediately
      }
    } catch (indexErr) {
      console.error("[ImageUploader] Failed to index image:", indexErr);
      alert(`שגיאה באינדוקס התמונה: ${indexErr instanceof Error ? indexErr.message : String(indexErr)}`);
      // Continue anyway - image is uploaded
    }

    return publicUrl;
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

  const removeImage = async (url: string) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Extract filename from URL
    // URL format: https://...supabase.co/storage/v1/object/public/guess-images/products/FILENAME
    const urlParts = url.split('/');
    const filenameIndex = urlParts.findIndex(part => part === 'products');
    const filename = filenameIndex >= 0 && filenameIndex < urlParts.length - 1 
      ? urlParts[filenameIndex + 1] 
      : null;

    if (!filename) {
      console.error("[ImageUploader] Could not extract filename from URL:", url);
      alert("שגיאה: לא ניתן לזהות את שם הקובץ");
      return;
    }

    console.log("[ImageUploader] Deleting image:", filename);

    try {
      // 1. Delete from Storage
      const filePath = `products/${filename}`;
      const { error: storageError } = await supabase.storage
        .from("guess-images")
        .remove([filePath]);

      if (storageError) {
        console.error("[ImageUploader] Storage delete error:", storageError);
        alert(`שגיאה במחיקת התמונה מהאחסון: ${storageError.message}`);
        return;
      }

      console.log("[ImageUploader] Deleted from Storage:", filePath);

      // 2. Delete from image_index
      const { error: indexError } = await supabase
        .from("image_index")
        .delete()
        .eq("filename", filename);

      if (indexError) {
        console.error("[ImageUploader] Index delete error:", indexError);
        // Continue anyway - file is deleted from storage
      } else {
        console.log("[ImageUploader] Deleted from index:", filename);
      }

      // 3. Update UI
      const newGallery = gallery.filter(g => g !== url);
      const newMain = url === currentImage ? (newGallery[0] || "/images/default.png") : currentImage;
      onImageChange(newMain, newGallery);

    } catch (error) {
      console.error("[ImageUploader] Error deleting image:", error);
      alert(`שגיאה במחיקת התמונה: ${error instanceof Error ? error.message : String(error)}`);
    }
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
