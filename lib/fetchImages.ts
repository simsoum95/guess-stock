import * as cheerio from "cheerio";

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

const UA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml"
};

function toAbsolute(src?: string, base?: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http")) return src;
  if (base) {
    try {
      return new URL(src, base).toString();
    } catch {
      /* ignore */
    }
  }
  return src;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: UA_HEADERS
  });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.text();
}

function findFirstLink($: cheerio.CheerioAPI): string | undefined {
  const selectors = [
    "a.product.photo.product-item-photo",
    ".product-item-link",
    "a.product-item-link",
    "a.product-item-photo",
    "a.image"
  ];
  for (const sel of selectors) {
    const href = $(sel).first().attr("href");
    if (href) return href;
  }
  return undefined;
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string) {
  const mainCandidates = [
    "img.fotorama__img",
    "img.gallery-placeholder__image",
    "img.product-main-image",
    "img.zoomImg",
    ".product.media img"
  ];

  const gallerySelectors = [
    "img.fotorama__img",
    ".product.media img",
    ".gallery-placeholder img"
  ];

  let main: string | undefined;
  for (const sel of mainCandidates) {
    const src = $(sel).first().attr("src");
    const abs = toAbsolute(src, baseUrl);
    if (abs) {
      main = abs;
      break;
    }
  }

  const gallerySet = new Set<string>();
  for (const sel of gallerySelectors) {
    $(sel).each((_i, el) => {
      const src = $(el).attr("src");
      const abs = toAbsolute(src, baseUrl);
      if (abs) gallerySet.add(abs);
    });
  }

  if (main) gallerySet.delete(main);
  const gallery = Array.from(gallerySet);

  return { main, gallery };
}

async function scrapeProductPage(url: string, source: string): Promise<ImageResult> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const { main, gallery } = extractImages($, url);
    if (main) {
      return {
        success: true,
        imageUrl: main,
        gallery,
        source
      };
    }
  } catch (err) {
    console.log(`[fetchImages] Error on product page ${url}`, err);
  }
  return FALLBACK;
}

async function scrapeSearch(url: string, source: string): Promise<ImageResult> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const firstHref = findFirstLink($);

    const productUrl = firstHref ? toAbsolute(firstHref, url) : url; // if direct product URL
    if (!productUrl) return FALLBACK;

    const result = await scrapeProductPage(productUrl, source);
    if (result.success) return result;
  } catch (err) {
    console.log(`[fetchImages] Error on search ${url}`, err);
  }
  return FALLBACK;
}

export async function fetchImagesForModel(modelRef: string): Promise<ImageResult> {
  if (!modelRef) return FALLBACK;

  const sources: { url: string; name: string; isProduct?: boolean }[] = [
    { url: `https://www.guess.com/en-us/search?q=${encodeURIComponent(modelRef)}`, name: "guess-us" },
    { url: `https://www.guess.com/en-il/search?q=${encodeURIComponent(modelRef)}`, name: "guess-il" },
    { url: `https://www.globalonline.co.il/catalogsearch/result/?q=${encodeURIComponent(modelRef)}`, name: "globalonline-search" },
    { url: `https://www.globalonline.co.il/${encodeURIComponent(modelRef)}`, name: "globalonline-direct", isProduct: true }
  ];

  for (const src of sources) {
    const handler = src.isProduct ? scrapeProductPage : scrapeSearch;
    const result = await handler(src.url, src.name);
    if (result.success) {
      console.log(`[fetchImages] Found image for ${modelRef} via ${src.name}: ${result.imageUrl}`);
      return result;
    }
  }

  console.log(`[fetchImages] Fallback for ${modelRef}`);
  return FALLBACK;
}

