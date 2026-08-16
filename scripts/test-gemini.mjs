// scripts/test-gemini.mjs
import { readFileSync } from "fs";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY not found. Check your .env.local and how you ran this script.");
  process.exit(1);
}

const listings = JSON.parse(readFileSync("./src/data/listings.json", "utf-8"));

// Pull a small, cheap sample so the test call is fast
const sample = listings.slice(0, 15).map(l => ({
  id: l.id,
  sector: l.sector,
  marla: l.marla,
  price_display: l.price_display,
  bedrooms: l.bedrooms,
  bathrooms: l.bathrooms,
  amenities: l.amenities,
}));

const userNeed = "Family of 5, needs at least 5 bedrooms, budget around 6-9 crore, prefers a quiet residential sector with good security, would like a corner plot if possible.";

const prompt = `You are a helpful real estate matching assistant. Given the user's needs and a list of available properties, return the top 3 matches ranked best to worst. For each match, give a short plain-language reason (1-2 sentences) explaining why it fits.

User needs: ${userNeed}

Available properties:
${JSON.stringify(sample, null, 2)}

Respond ONLY with valid JSON in this exact shape:
{
  "matches": [
    { "id": <listing id>, "rank": 1, "reasoning": "<why this fits>" }
  ]
}`;

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  }
);

if (!res.ok) {
  console.error("Gemini API error:", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

console.log("--- Raw response ---");
console.log(text);

try {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  console.log("\n--- Parsed matches ---");
  console.log(JSON.stringify(parsed, null, 2));
} catch (e) {
  console.log("\n(Could not auto-parse as JSON — check formatting above)");
}