import fs from "node:fs";
import path from "node:path";

const SHEET_ID =
  process.env.GOOGLE_SHEET_ID ??
  "1XNqpKmi3uOHIFRBCEspu51iHesoKNQLHXpKWv6cfl5Y";

const TAB_CONFIG = [
  { sheet: "תיקים", category: "bag" },
  { sheet: "ביגוד", category: "apparel" },
  { sheet: "גיליון2", category: "shoes" }
];

function cleanPrice(raw = "") {
  const digits = String(raw ?? "").replace(/₪|\s|,/g, "").trim();
  if (!digits || digits === "0") return 0;
  const numeric = digits.replace(/[^\d.-]/g, "");
  if (!numeric) return 0;
  if (!numeric.includes(".") && numeric.length > 2) {
    const intPart = numeric.slice(0, -2);
    const decPart = numeric.slice(-2);
    const parsed = Number(`${intPart}.${decPart}`);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanNumber(value = "") {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pick(row, keys) {
  for (const k of keys) {
    if (k in row) return row[k];
  }
  return "";
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const splitLine = (line) =>
    line
      .match(/("([^"]|"")*"|[^,])+/g)
      ?.map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];

  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    return row;
  });
}

async function fetchTab({ sheet, category }) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    sheet
  )}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sheet ${sheet}`);
  const csv = await res.text();
  const rows = parseCsv(csv);
  return rows.map((row, index) => {
    const collection = row["קולקציה"]?.trim() ?? "";
    const subcategory = row["תת משפחה"]?.trim() ?? "";
    const brand = row["מותג"]?.trim() ?? "";
    const modelRef = row["קוד גם"]?.trim() ?? "";
    const gender = row["מגדר"]?.trim() ?? "";
    const supplier = row["ספק"]?.trim() ?? "";
    const skuRaw = row["קוד פריט"]?.trim() ?? "";
    const baseCode = skuRaw.split("-")[0]?.trim() || "";
    const color = row["צבע"]?.trim() ?? "";
    const rawRetail = pick(row, [
      'מחיר כולל מע""מ בסיס',
      "מחיר כולל מע״מ בסיס",
      'מחיר כולל מע\"מ בסיס',
      "מחיר כולל מע''מ בסיס",
      "מחיר כולל מע׳׳מ בסיס"
    ]);
    const rawWholesale = pick(row, ["סיטונאי", " סיטונאי", "סיטונאי "]);
    const priceRetail = cleanPrice(rawRetail);
    const priceWholesale = cleanPrice(rawWholesale);
    const stockQuantity = cleanNumber(row["כמות מלאי נוכחי"] ?? "");
    const imageFromSheet = row["image_url"]?.trim() ?? "";

    const id = baseCode || modelRef || `missing-id-${category}-${index}`;

    return {
      id,
      collection,
      category,
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
      size: row["מידה"]?.trim() ?? ""
    };
  });
}

async function main() {
  const all = [];
  for (const tab of TAB_CONFIG) {
    const items = await fetchTab(tab);
    all.push(...items);
  }

  const targetPath = path.join(process.cwd(), "data", "products.json");
  fs.writeFileSync(targetPath, JSON.stringify(all, null, 2), "utf-8");
  console.log(`Wrote ${all.length} products to ${targetPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

