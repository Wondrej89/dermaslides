import { basePath } from "./utils.js";

const cache = new Map();

async function getJson(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`${basePath()}data/${name}`).then((response) => {
      if (!response.ok) throw new Error(`Data se nepodařilo načíst (${response.status}).`);
      return response.json();
    }));
  }
  return cache.get(name);
}

function asArray(value, preferredKey) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[preferredKey])) return value[preferredKey];
  return Object.values(value || {}).find(Array.isArray) || [];
}

export async function loadDiagnoses() { return asArray(await getJson("diagnoses.json"), "diagnoses"); }
export async function loadCases() { return asArray(await getJson("cases.json"), "cases"); }
export async function loadCategories() { return asArray(await getJson("categories.json"), "categories"); }
export async function loadAtlas() {
  const [diagnoses, cases, categories] = await Promise.all([loadDiagnoses(), loadCases(), loadCategories()]);
  return { diagnoses, cases, categories };
}

export async function loadSearchIndex() {
  try { return asArray(await getJson("search-index.json"), "items"); }
  catch { return null; }
}
