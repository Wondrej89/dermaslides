import { readFile, writeFile } from "node:fs/promises";

const readArray = async (file, key) => { const value = JSON.parse(await readFile(file, "utf8")); return Array.isArray(value) ? value : value[key] || Object.values(value).find(Array.isArray) || []; };
const normalize = (value = "") => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const slugify = (value = "") => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const routes = [
  ["zanetliva-infekcni", "Zánětlivá, infekční a reaktivní onemocnění"], ["melanocytarni", "Melanocytární léze"],
  ["epidermalni-adnexalni", "Epidermální, keratinocytární a adnexální léze"], ["mezenchymalni-vaskularni", "Mezenchymální, vaskulární, nervové a histiocytární léze"],
  ["hematolymfoidni-systemova-vzacna", "Hematolymfoidní, systémová, metastatická a ostatní vzácná onemocnění"],
];
const [diagnoses, cases, categories] = await Promise.all([readArray("data/diagnoses.json", "diagnoses"), readArray("data/cases.json", "cases"), readArray("data/categories.json", "categories")]);
const categoryMap = new Map(categories.flatMap((item) => [item.id, item.category_id, item.category, item.slug].filter(Boolean).map((key) => [String(key), item])));
const routeFor = (diagnosis) => { const item = categoryMap.get(String(diagnosis.category_id ?? diagnosis.category)) || diagnosis; const text = normalize(Object.values(item).filter((v) => typeof v === "string").join(" ")); return routes.find(([slug, title]) => text.includes(normalize(slug)) || text.includes(normalize(title)) || text.includes(normalize(title).split(" ")[0])); };
const byId = new Map(diagnoses.map((item) => [String(item.diagnosis_id), item]));
const counts = cases.reduce((map, item) => map.set(String(item.diagnosis_id), (map.get(String(item.diagnosis_id)) || 0) + 1), new Map());
const fields = ["canonical_cs", "canonical_en", "diagnosis_group_cs", "diagnosis_group_en", "diagnosis_source", "clinical_cs", "clinical_source", "comment_cs"];
const compact = (item) => Object.fromEntries(fields.filter((key) => item[key]).map((key) => [key, item[key]]));
const items = diagnoses.flatMap((diagnosis) => { const route = routeFor(diagnosis); if (!route) return []; return [{ type:"diagnosis", ...compact(diagnosis), category_slug:route[0], category_title:route[1], diagnosis_slug:diagnosis.diagnosis_slug || slugify(diagnosis.canonical_en || diagnosis.canonical_cs), case_count:counts.get(String(diagnosis.diagnosis_id)) || 0, search_text:normalize(fields.map((key) => diagnosis[key]).filter(Boolean).join(" ")) }]; });
for (const item of cases) { const diagnosis = byId.get(String(item.diagnosis_id)); const route = diagnosis && routeFor(diagnosis); if (!route) continue; const combined = { ...compact(item), canonical_cs:diagnosis.canonical_cs, canonical_en:diagnosis.canonical_en, diagnosis_group_cs:diagnosis.diagnosis_group_cs, diagnosis_group_en:diagnosis.diagnosis_group_en }; items.push({ type:"case", ...combined, category_slug:route[0], diagnosis_slug:diagnosis.diagnosis_slug || slugify(diagnosis.canonical_en || diagnosis.canonical_cs), search_text:normalize(fields.map((key) => combined[key]).filter(Boolean).join(" ")) }); }
await writeFile("data/search-index.json", `${JSON.stringify({ generated_at:new Date().toISOString(), items })}\n`);
console.log(`Vytvořeno ${items.length} položek.`);
