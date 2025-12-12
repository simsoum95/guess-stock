// Ce fichier nécessite cheerio - désactivé temporairement
// npm install cheerio @types/cheerio pour activer

type ImageResult = {
  success: boolean;
  imageUrl: string;
  gallery: string[];
  source: string;
};

const FALLBACK: ImageResult = {
  success: false,
  imageUrl: "/images/default.png",
  gallery: [],
  source: "fallback"
};

export async function fetchImagesForModel(modelRef: string): Promise<ImageResult> {
  if (!modelRef) return FALLBACK;
  
  // Désactivé - retourne fallback
  console.log(`[fetchImages] Fallback for ${modelRef}`);
  return FALLBACK;
}
