#!/usr/bin/env node
/**
 * Test du matching de couleurs
 */

// Reproduction du COLOR_MAP du code
const COLOR_MAP = {
  "BLA": ["BLACK", "NOIR", "BLK", "BLO"],
  "BLK": ["BLACK", "NOIR", "BLA", "BLO"],
  "BLO": ["BLACK", "NOIR", "BLA", "BLK", "BLACKLOGO"],
  "BLACK": ["BLA", "BLK", "BLO"],
  "DBR": ["DARK BROWN", "DARKBROWN", "BROWN", "DARK", "BRO"],
  "DARKBROWN": ["DBR", "DARK BROWN", "BRO"],
  "DARK BROWN": ["DBR", "DARKBROWN", "BRO"],
  "LBR": ["LIGHT BROWN", "LIGHTBROWN", "BROWN", "BRO", "TAN"],
  "DRE": ["DRESS", "DRESSY", "DRS"],
  "WHI": ["WHITE", "BLANC", "WHT"],
  "WHT": ["WHITE", "BLANC", "WHI"],
  "WHITE": ["WHI", "WHT"],
};

function extractColorParts(color) {
  const normalized = color.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^([A-Z]+)(\d*)$/);
  if (match) {
    return { base: match[1], number: match[2] || "" };
  }
  const lettersOnly = normalized.replace(/\d/g, "");
  const numbersOnly = normalized.replace(/[A-Z]/g, "");
  return { base: lettersOnly || normalized, number: numbersOnly };
}

function matchesColor(imageColor, productColor) {
  const imgColorUpper = imageColor.toUpperCase().trim();
  const prodColorUpper = productColor.toUpperCase().trim();
  
  if (imgColorUpper === prodColorUpper) return "exact";
  
  const cleanColor = (c) => c.replace(/[^A-Z0-9]/g, "").replace(/OS$/, "").replace(/LOGO$/, "");
  
  const imgNormalized = cleanColor(imgColorUpper);
  const prodNormalized = cleanColor(prodColorUpper);
  
  if (imgNormalized === prodNormalized) return "normalized";
  
  const imgParts = extractColorParts(imgColorUpper);
  const prodParts = extractColorParts(prodColorUpper);
  
  console.log(`    Image parts: base="${imgParts.base}" number="${imgParts.number}"`);
  console.log(`    Product parts: base="${prodParts.base}" number="${prodParts.number}"`);
  
  const isColorEquivalent = (color1, color2) => {
    if (color1 === color2) return true;
    const mappedColors = COLOR_MAP[color1];
    if (mappedColors) {
      for (const mapped of mappedColors) {
        const mappedNorm = cleanColor(mapped);
        if (mappedNorm === color2) return true;
      }
    }
    return false;
  };
  
  if (imgParts.base && prodParts.base) {
    if (isColorEquivalent(imgParts.base, prodParts.base)) {
      return "base-match";
    }
    if (isColorEquivalent(prodParts.base, imgParts.base)) {
      return "base-match-reverse";
    }
  }
  
  if (imgParts.base.length >= 2 && imgParts.base.length <= 4) {
    if (prodParts.base.startsWith(imgParts.base) || prodNormalized.includes(imgParts.base)) {
      return "prefix-match";
    }
  }
  
  return false;
}

// Test cases based on what we see
const testCases = [
  { image: "BLK01", product: "BLACK 001" },
  { image: "BLK01", product: "BLACK001" },
  { image: "BLK01", product: "BLACK" },
  { image: "DBR01", product: "DARK BROWN 200" },
  { image: "DBR01", product: "DARKBROWN200" },
  { image: "DRE01", product: "DRESS" },
  { image: "WHI01", product: "WHITE 001" },
  { image: "WHI01", product: "WHITE" },
  { image: "GOL01", product: "GOLD" },
  { image: "LNA01", product: "LIGHT NATURAL" },
  { image: "MBL01", product: "MEDIUM BLUE" },
];

console.log("TEST DE MATCHING DE COULEURS\n");

for (const test of testCases) {
  console.log(`\n${test.image} vs ${test.product}:`);
  const result = matchesColor(test.image, test.product);
  console.log(`  Result: ${result ? '✅ ' + result : '❌ NO MATCH'}`);
}

