import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Copy of COLOR_MAP from fetchProducts.ts
const COLOR_MAP: Record<string, string[]> = {
  "OFF": ["OFFWHITE", "OFF WHITE", "CREAM", "אוף וויט"],
  "OFFWHITE": ["OFF", "OFFWHITE"],
  "OFFWHITELOGO": ["OFF", "OFFWHITE"],
  "COG": ["COGNAC", "COGNAC BROWN", "קוניאק"],
  "COGNAC": ["COG"],
  "BLA": ["BLACK", "NOIR", "שחור", "BLK", "BLACKLOGO"],
  "BLK": ["BLACK", "NOIR", "שחור", "BLA"],
  "BLACK": ["BLA", "BLK", "NOIR", "שחור"],
};

function matchesColor(imageColor: string, productColor: string): boolean {
  const imgColorUpper = imageColor.toUpperCase().trim();
  const prodColorUpper = productColor.toUpperCase().trim();
  
  if (imgColorUpper === prodColorUpper) return true;
  
  const cleanColor = (c: string) => c
    .replace(/[^A-Z0-9]/g, "")
    .replace(/OS$/, "")
    .replace(/LOGO$/, "");
  
  const imgNormalized = cleanColor(imgColorUpper);
  const prodNormalized = cleanColor(prodColorUpper);
  
  if (imgNormalized === prodNormalized) return true;
  
  const isColorEquivalent = (color1: string, color2: string): boolean => {
    const mappedColors = COLOR_MAP[color1];
    if (!mappedColors) return false;
    
    for (const mapped of mappedColors) {
      const mappedNorm = cleanColor(mapped);
      if (mappedNorm === color2) return true;
    }
    return false;
  };
  
  if (isColorEquivalent(imgNormalized, prodNormalized)) return true;
  if (isColorEquivalent(prodNormalized, imgNormalized)) return true;
  
  return false;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageColor = searchParams.get("imgColor") || "OFFWHITE";
  const productColor = searchParams.get("prodColor") || "COG";
  
  const result = matchesColor(imageColor, productColor);
  
  return NextResponse.json({
    imageColor,
    productColor,
    matches: result,
    timestamp: new Date().toISOString(),
    testCases: [
      { img: "OFFWHITE", prod: "OFF", match: matchesColor("OFFWHITE", "OFF") },
      { img: "OFFWHITE", prod: "COG", match: matchesColor("OFFWHITE", "COG") },
      { img: "OFFWHITE", prod: "COGNAC", match: matchesColor("OFFWHITE", "COGNAC") },
      { img: "OFFWHITE", prod: "BLA", match: matchesColor("OFFWHITE", "BLA") },
      { img: "OFFWHITE", prod: "BLACK", match: matchesColor("OFFWHITE", "BLACK") },
    ]
  });
}

