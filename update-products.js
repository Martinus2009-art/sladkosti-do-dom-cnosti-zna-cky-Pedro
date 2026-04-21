const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const BASE_URL = "https://global.ceskecukrovinky.sk";
const START_URL = "https://global.ceskecukrovinky.sk/2-vsechno";

function normalizeCategory(text) {
  const value = text.trim().toLowerCase();

  const map = {
    "želé": "zele",
    "zele": "zele",
    "pelendreky": "pelendreky",
    "pásky": "pasky",
    "pasky": "pasky",
    "lízanky": "lizanky",
    "lizanky": "lizanky",
    "cukríky": "cukriky",
    "cukriky": "cukriky",
    "čokoláda": "cokolada",
    "cokolada": "cokolada",
    "zdravá výživa": "zdrava_vyziva",
    "zdrava vyziva": "zdrava_vyziva",
    "mikuláš": "mikulas",
    "mikulas": "mikulas",
    "vianoce": "vanoce",
    "valentín": "valentyn",
    "valentin": "valentyn",
    "karnevaly": "karnevaly",
    "veľká noc": "velikonoce",
    "velka noc": "velikonoce",
    "kyslé": "kysle",
    "kysle": "kysle",
    "mix": "mix"
  };

  return map[value] || value.replace(/\s+/g, "_");
}

function extractPrice(text) {
  if (!text) return 0;

  const cleaned = text
    .replace(/\u00a0/g, " ")
    .replace(/€/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".")
    .trim();

  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;

  const price = Number(match[1]);
  return Number.isFinite(price) ? price : 0;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return await res.text();
}

function fallbackCategoriesFromName(name) {
  const n = name.toLowerCase();
  const out = new Set();

  if (n.includes("želé") || n.includes("zele")) out.add("zele");
  if (n.includes("pelendrek")) out.add("pelendreky");
  if (n.includes("pásky") || n.includes("pasky")) out.add("pasky");
  if (n.includes("lízank") || n.includes("lizank")) out.add("lizanky");
  if (n.includes("čoko") || n.includes("čokol") || n.includes("cokol")) out.add("cokolada");
  if (n.includes("kysl")) out.add("kysle");
  if (n.includes("mix")) out.add("mix");
  if (n.includes("mikul")) out.add("mikulas");
  if (n.includes("viano")) out.add("vanoce");
  if (n.includes("valent")) out.add("valentyn");
  if (n.includes("karneval")) out.add("karnevaly");
  if (n.includes("veľkono") || n.includes("velkono")) out.add("velikonoce");

  return [...out];
}

function getImageUrl(imgEl) {
  if (!imgEl || !imgEl.length) return "";

  const img =
    imgEl.attr("data-full-size-image-url") ||
    imgEl.attr("data-src") ||
    imgEl.attr("src") ||
    imgEl.attr("data-lazyload") ||
    "";

  if (!img) return "";
  return img.startsWith("http") ? img : `${BASE_URL}${img}`;
}

function getPriceFromCard(card) {
  const selectors = [
    ".product-price-and-shipping .price",
    ".current-price .price",
    ".price",
    "[itemprop='price']",
    ".regular-price",
    ".discount-price",
    ".product-price"
  ];

  for (const selector of selectors) {
    const el = card.find(selector).first();
    if (!el.length) continue;

    const text = el.text().trim();
    const price = extractPrice(text);
    if (price > 0) return price;

    const attrPrice =
      el.attr("content") ||
      el.attr("data-price-amount") ||
      el.attr("value") ||
      "";

    const attrParsed = extractPrice(attrPrice);
    if (attrParsed > 0) return attrParsed;
  }

  return 0;
}

function getNextPageUrl($) {
  const nextHref =
    $('a[rel="next"]').attr("href") ||
    $(".pagination-next a").attr("href") ||
    $("a.next").attr("href");

  if (!nextHref) return null;
  return nextHref.startsWith("http") ? nextHref : `${BASE_URL}${nextHref}`;
}

async function getProductDetails(productUrl, productName) {
  const result = {
    price: 0,
    categories: fallbackCategoriesFromName(productName)
  };

  if (!productUrl) return result;

  try {
    const html = await fetchHtml(productUrl);
    const $ = cheerio.load(html);
    const categories = new Set();

    const priceSelectors = [
      ".product-prices .current-price .price",
      ".current-price .price",
      ".product-price",
      ".price",
      "[itemprop='price']",
      "meta[itemprop='price']"
    ];

    for (const selector of priceSelectors) {
      const el = $(selector).first();
      if (!el.length) continue;

      const text = el.text().trim();
      const price = extractPrice(text);
      if (price > 0) {
        result.price = price;
        break;
      }

      const attrPrice =
        el.attr("content") ||
        el.attr("data-price-amount") ||
        el.attr("value") ||
        "";

      const attrParsed = extractPrice(attrPrice);
      if (attrParsed > 0) {
        result.price = attrParsed;
        break;
      }
    }

    $(".breadcrumb a, nav.breadcrumb a").each((_, el) => {
      const text = $(el).text().trim();
      if (text) categories.add(normalizeCategory(text));
    });

    const fallback = fallbackCategoriesFromName(productName);
    fallback.forEach((c) => categories.add(c));

    result.categories = [...categories].filter(
      (c) =>
        c &&
        ![
          "domov",
          "home",
          "vsechno",
          "všetko",
          "novinky"
        ].includes(c)
    );

    return result;
  } catch {
    return result;
  }
}

async function scrapePage(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const products = [];

  $(".product-miniature, .js-product-miniature").each((_, el) => {
    const card = $(el);

    const nameEl = card.find(".product-title a, h2 a, h3 a").first();
    const imgEl = card.find("img").first();

    const name = nameEl.text().trim();
    const href = nameEl.attr("href") || "";
    const productUrl = href
      ? (href.startsWith("http") ? href : `${BASE_URL}${href}`)
      : "";

    const imageUrl = getImageUrl(imgEl);
    const price = getPriceFromCard(card);

    if (name) {
      products.push({
        name,
        url: productUrl,
        image: imageUrl,
        price
      });
    }
  });

  return {
    products,
    nextUrl: getNextPageUrl($)
  };
}

async function main() {
  const all = [];
  const seen = new Set();

  let url = START_URL;
  let page = 1;

  while (url && page <= 20) {
    console.log(`Spracovávam stránku ${page}: ${url}`);

    const { products, nextUrl } = await scrapePage(url);

    if (!products.length) break;

    for (const item of products) {
      const key = `${item.name}||${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const details = await getProductDetails(item.url, item.name);

      const finalPrice =
        item.price > 0 ? item.price : details.price;

      all.push({
        id: all.length + 1,
        name: { sk: item.name },
        images: item.image ? [item.image] : [],
        priceEUR: finalPrice > 0 ? finalPrice : 0,
        url: item.url || "",
        cat: details.categories
      });
    }

    url = nextUrl;
    page += 1;
  }

  const outputPath = path.join(process.cwd(), "products.json");
  fs.writeFileSync(outputPath, JSON.stringify(all, null, 2), "utf8");

  console.log(`Hotovo. Uložených produktov: ${all.length}`);
}

main().catch((err) => {
  console.error("Chyba:", err);
  process.exit(1);
});
