const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ??
  "1XNqpKmi3uOHIFRBCEspu51iHesoKNQLHXpKWv6cfl5Y";

type Category = "תיק" | "נעל" | "ביגוד";

export interface Product {
  id: string;
  collection: string;
  category: Category;
  subcategory: string;
  brand: string;
  modelRef: string;
  gender: string;
  supplier: string;
  color: string;
  priceRetail: number;
  priceWholesale: number;
  stockQuantity: number;
  imageUrl: string;
  gallery: string[];
  productName?: string;
  size?: string;
}

const TAB_CONFIG: { sheet: string; category: Category }[] = [
  { sheet: "תיקים", category: "תיק" },
  { sheet: "ביגוד", category: "ביגוד" },
  { sheet: "גיליון2", category: "נעל" }
];

function cleanPrice(raw: unknown): number {
  const value = String(raw ?? "").trim();
  if (!value) return 0;
  const digits = value.replace(/₪|\s|,/g, "");
  if (!digits || digits === "0") return 0;
  const numeric = digits.replace(/[^\d.-]/g, "");
  if (!numeric) return 0;

  if (!numeric.includes(".") && numeric.length > 2) {
    const intPart = numeric.slice(0, -2);
    const decPart = numeric.slice(-2);
    const combined = `${intPart}.${decPart}`;
    const parsed = Number(combined);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (k in row) return row[k];
  }
  return "";
}

function parseCsv(csv: string): Record<string, string>[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const splitLine = (line: string) =>
    line
      .match(/("([^"]|"")*"|[^,])+/g)
      ?.map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ??
    [];

  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    return row;
  });
}

async function normalizeRow(
  row: Record<string, string>,
  category: Category,
  index: number
): Promise<Product> {
  const collection = row["קולקציה"]?.trim() ?? "";
  const subcategory = row["תת משפחה"]?.trim() ?? "";
  const brand = row["מותג"]?.trim() ?? "";
  const modelRef = row["קוד גם"]?.trim() ?? "";
  const gender = row["מגדר"]?.trim() ?? "";
  const supplier = row["ספק"]?.trim() ?? "";
  const skuRaw = row["קוד פריט"]?.trim() ?? "";
  const baseCode = skuRaw.split("-")[0]?.trim() || "";
  const color = row["צבע"]?.trim() ?? "";
  const imageFromSheet = row["image_url"]?.trim() ?? "";
  const rawRetail = pick(row, [
    'מחיר כולל מע""מ בסיס',
    "מחיר כולל מע״מ בסיס",
    'מחיר כולל מע"מ בסיס',
    "מחיר כולל מע''מ בסיס",
    "מחיר כולל מע׳׳מ בסיס"
  ]);
  const rawWholesale = pick(row, ["סיטונאי", " סיטונאי", "סיטונאי "]);
  const priceRetail = cleanPrice(rawRetail);
  const priceWholesale = cleanPrice(rawWholesale);
  const stockQuantity = cleanNumber(row["כמות מלאי נוכחי"] ?? "");

  const id = baseCode || modelRef || `missing-id-${category}-${index}`;

  // Catégorie issue directement de la colonne "תת משפחה" (valeurs attendues : "תיק", "נעל", "ביגוד")
  const rawCategory = subcategory.trim();
  const validCategories: Category[] = ["תיק", "נעל", "ביגוד"];
  
  // Valider et logger les catégories invalides
  let normalizedCategory: Category;
  if (validCategories.includes(rawCategory as Category)) {
    normalizedCategory = rawCategory as Category;
  } else {
    // Logger les catégories invalides pour nettoyer la feuille
    console.warn(
      `[fetchSheet] Catégorie invalide trouvée pour le produit ${id}: "${rawCategory}" (ligne ${index + 1}). Valeurs attendues: "תיק", "נעל", "ביגוד". Utilisation de la catégorie par défaut du tab: "${category}"`
    );
    normalizedCategory = category; // Fallback vers la catégorie du tab
  }

  const base: Product = {
    id,
    collection,
    category: normalizedCategory,
    subcategory,
    brand,
    modelRef,
    gender,
    supplier,
    color,
    priceRetail,
    priceWholesale,
    stockQuantity,
    imageUrl: imageFromSheet || "/images/default.png",
    gallery: [],
    productName: modelRef || brand || collection || "פריט",
    size: ""
  };

  console.log("Parsed retail:", priceRetail, "from raw:", rawRetail);
  console.log("Parsed wholesale:", priceWholesale, "from raw:", rawWholesale);

  return base;
}

async function fetchTab({ sheet, category }: (typeof TAB_CONFIG)[number]) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    sheet
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet ${sheet}`);
  }
  const csv = await res.text();
  const rows = parseCsv(csv);
  return Promise.all(rows.map((row, index) => normalizeRow(row, category, index)));
}

export async function fetchSheetData(): Promise<Product[]> {
  const allData = await Promise.all(TAB_CONFIG.map((tab) => fetchTab(tab)));
  return allData.flat();
}

