import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sheetId = process.env.GOOGLE_SHEET_ID;
const apiKey = process.env.GOOGLE_API_KEY;

const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("נעליים SAM")}?key=${apiKey}`;
const res = await fetch(url);
const data = await res.json();

const headers = data.values[0].map(h => h.trim());
const rows = data.values.slice(1).map(r => {
  const o = {};
  headers.forEach((h, i) => { o[h] = (r[i] || "").trim(); });
  return o;
});

const models = ["ALIE", "VIENNA", "HAZEL", "WALLER", "LINNIE", "KALLEN", "TALIA", "MICHAELA", "BIANKA", "BAY", "GIGI", "MARCIE"];

for (const m of models) {
  const matching = rows.filter(r => {
    const desc = (r["תיאור דגם"] || "").toUpperCase();
    // Match exact model name (not substrings like MICHAELAJLLY matching MICHAELA)
    return desc === m || desc.startsWith(m + " ");
  });
  
  if (matching.length > 0) {
    console.log(`\n${m} (${matching.length} products):`);
    matching.forEach(r => {
      console.log(`  itemCode=${r["קוד פריט"]}  color=${r["צבע"]}  desc=${r["תיאור דגם"]}`);
    });
  } else {
    console.log(`\n${m}: NOT FOUND in sheet`);
  }
}
