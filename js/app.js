import { loadAtlas, loadSearchIndex } from "./data.js";
import { setupSearch } from "./search.js";
import { CATEGORY_ROUTES, basePath, categoryForDiagnosis, countLabel, diagnosisSlug, el, firstLetter } from "./utils.js";

function alphabet(diagnoses, label = "Abecední rejstřík diagnóz") {
  const available = new Set(diagnoses.map((item) => firstLetter(item.canonical_cs)));
  return el("nav", { class: "alphabet", "aria-label": label }, ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) =>
    available.has(letter) ? el("a", { href: `#letter-${letter}`, text: letter }) : el("span", { "aria-disabled": "true", text: letter })));
}

function makeSearchItems(diagnoses, cases, categories) {
  const casesByDiagnosis = Map.groupBy ? Map.groupBy(cases, (item) => String(item.diagnosis_id)) : cases.reduce((map, item) => map.set(String(item.diagnosis_id), [...(map.get(String(item.diagnosis_id)) || []), item]), new Map());
  const byId = new Map(diagnoses.map((item) => [String(item.diagnosis_id), item]));
  const diagnosesItems = diagnoses.map((item) => {
    const route = categoryForDiagnosis(item, categories);
    return { ...item, type: "diagnosis", category_slug: route?.slug, category_title: route?.title, diagnosis_slug: diagnosisSlug(item), case_count: (casesByDiagnosis.get(String(item.diagnosis_id)) || []).length };
  }).filter((item) => item.category_slug);
  const caseItems = cases.map((item) => {
    const diagnosis = byId.get(String(item.diagnosis_id));
    const route = diagnosis && categoryForDiagnosis(diagnosis, categories);
    return { ...item, type: "case", canonical_cs: diagnosis?.canonical_cs, canonical_en: diagnosis?.canonical_en, diagnosis_group_cs: diagnosis?.diagnosis_group_cs, diagnosis_group_en: diagnosis?.diagnosis_group_en, category_slug: route?.slug, diagnosis_slug: diagnosis && diagnosisSlug(diagnosis) };
  }).filter((item) => item.category_slug);
  return [...diagnosesItems, ...caseItems];
}

function showError(error) {
  document.querySelector("main").append(el("div", { class: "notice", role: "alert" }, el("strong", { text: "Atlas nelze načíst." }), el("p", { text: `${error.message} Otevřete web prostřednictvím HTTP serveru, nikoli jako lokální soubor.` })));
}

async function init() {
  try {
    const { diagnoses, cases, categories } = await loadAtlas();
    document.querySelector("[data-total-diagnoses]").textContent = diagnoses.length.toLocaleString("cs-CZ");
    document.querySelector("[data-total-cases]").textContent = cases.length.toLocaleString("cs-CZ");
    const cards = document.querySelector("#category-cards");
    CATEGORY_ROUTES.forEach((route) => {
      const categoryDiagnoses = diagnoses.filter((item) => categoryForDiagnosis(item, categories)?.slug === route.slug);
      const ids = new Set(categoryDiagnoses.map((item) => String(item.diagnosis_id)));
      const caseCount = cases.filter((item) => ids.has(String(item.diagnosis_id))).length;
      cards.append(el("a", { class: "category-card", href: `${route.slug}/` }, el("h3", { text: route.title }),
        el("p", { text: `${countLabel(categoryDiagnoses.length, "diagnóza", "diagnózy", "diagnóz")} · ${countLabel(caseCount, "případ", "případy", "případů")}` }), el("span", { text: "Otevřít kategorii →" })));
    });
    const sorted = [...diagnoses].sort((a, b) => (a.canonical_cs || "").localeCompare(b.canonical_cs || "", "cs"));
    document.querySelector("#alphabet-home").append(alphabet(sorted));
    const index = document.querySelector("#diagnosis-index");
    let letter;
    sorted.forEach((item) => {
      const current = firstLetter(item.canonical_cs);
      if (current !== letter) { letter = current; index.append(el("h3", { id: `letter-${letter}`, class: "letter-heading", text: letter })); }
      const route = categoryForDiagnosis(item, categories);
      if (route) index.append(el("a", { href: `${route.slug}/#${diagnosisSlug(item)}`, text: item.canonical_cs || item.canonical_en }));
    });
    const generated = await loadSearchIndex();
    setupSearch(document.querySelector("#global-search"), document.querySelector("#search-results"), generated || makeSearchItems(diagnoses, cases, categories));
  } catch (error) { showError(error); }
}
init();
