import { loadAtlas, loadSearchIndex } from "./data.js";
import { renderCases } from "./diagnosis.js";
import { setupSearch } from "./search.js";
import { CATEGORY_ROUTES, categoryForDiagnosis, countLabel, diagnosisSlug, el, slugify } from "./utils.js";

const currentSlug = document.body.dataset.category;

function searchItems(diagnoses, cases, categories) {
  const byId = new Map(diagnoses.map((item) => [String(item.diagnosis_id), item]));
  const counts = cases.reduce((map, item) => map.set(String(item.diagnosis_id), (map.get(String(item.diagnosis_id)) || 0) + 1), new Map());
  return [...diagnoses.map((item) => { const route = categoryForDiagnosis(item, categories); return { ...item, type: "diagnosis", category_slug: route?.slug, category_title: route?.title, diagnosis_slug: diagnosisSlug(item), case_count: counts.get(String(item.diagnosis_id)) || 0 }; }),
    ...cases.map((item) => { const diagnosis = byId.get(String(item.diagnosis_id)); const route = diagnosis && categoryForDiagnosis(diagnosis, categories); return { ...item, type: "case", canonical_cs: diagnosis?.canonical_cs, canonical_en: diagnosis?.canonical_en, category_slug: route?.slug, diagnosis_slug: diagnosis && diagnosisSlug(diagnosis) }; })].filter((item) => item.category_slug);
}

async function init() {
  try {
    const { diagnoses, cases, categories } = await loadAtlas();
    const route = CATEGORY_ROUTES.find((item) => item.slug === currentSlug);
    const selected = diagnoses.filter((item) => categoryForDiagnosis(item, categories)?.slug === currentSlug)
      .sort((a, b) => (a.canonical_cs || "").localeCompare(b.canonical_cs || "", "cs"));
    const ids = new Set(selected.map((item) => String(item.diagnosis_id)));
    const selectedCases = cases.filter((item) => ids.has(String(item.diagnosis_id)));
    const groupedCases = selectedCases.reduce((map, item) => map.set(String(item.diagnosis_id), [...(map.get(String(item.diagnosis_id)) || []), item]), new Map());
    document.title = `${route.title} | Dermatopatologický atlas`;
    document.querySelector("h1").textContent = route.title;
    document.querySelector("#category-counts").textContent = `${countLabel(selected.length, "diagnóza", "diagnózy", "diagnóz")} · ${countLabel(selectedCases.length, "klinický případ", "klinické případy", "klinických případů")}`;
    const list = document.querySelector("#diagnoses");
    const subcategories = selected.reduce((groups, diagnosis) => {
      const key = diagnosis.subcategory || "";
      if (!groups.has(key)) groups.set(key, { key, diagnoses: [], caseCount: 0 });
      const group = groups.get(key);
      group.diagnoses.push(diagnosis);
      group.caseCount += (groupedCases.get(String(diagnosis.diagnosis_id)) || []).length;
      return groups;
    }, new Map());

    const groups = [...subcategories.values()]
      .sort((a, b) => a.key.localeCompare(b.key, "cs"))
      .map((group) => {
        const title = group.diagnoses.find((diagnosis) => diagnosis.subcategory_cs)?.subcategory_cs || "Ostatní";
        const safeKey = /^[a-z0-9][a-z0-9-]*$/.test(group.key) ? group.key : slugify(group.key);
        return { ...group, title, sectionId: `subcat-${safeKey}` };
      });

    const subcategoryNav = el("nav", { class: "subcategory-index", "aria-label": "Podsekce" }, ...groups.map((group) =>
      el("a", { href: `#${group.sectionId}` },
        el("span", { text: group.title }),
        el("small", { text: ` · ${group.diagnoses.length}` }))));
    document.querySelector("#subcategory-index").append(subcategoryNav);

    groups
      .forEach((group) => {
        const header = el("header", { class: "subcategory-header" },
          el("h2", { text: group.title }),
          el("p", { class: "subcategory-meta", text: `${countLabel(group.diagnoses.length, "diagnóza", "diagnózy", "diagnóz")} · ${countLabel(group.caseCount, "klinický případ", "klinické případy", "klinických případů")}` }));
        const section = el("section", { class: "subcategory", id: group.sectionId }, header);
        list.append(section);

        group.diagnoses.forEach((diagnosis) => {
          const slug = diagnosisSlug(diagnosis); const contentId = `cases-${slug}`; const diagnosisCases = groupedCases.get(String(diagnosis.diagnosis_id)) || [];
          const content = el("div", { id: contentId, class: "diagnosis-content", hidden: "" });
          const button = el("button", { class: "diagnosis-toggle", type: "button", "aria-expanded": "false", "aria-controls": contentId },
            el("span", { class: "diagnosis-name" }, el("strong", { text: diagnosis.canonical_cs || diagnosis.canonical_en }), diagnosis.canonical_en ? el("small", { text: diagnosis.canonical_en }) : null),
            el("span", { class: "diagnosis-actions" },
              el("span", { class: "diagnosis-count", text: countLabel(diagnosisCases.length, "případ", "případy", "případů") }),
              el("span", { class: "diagnosis-icon", "aria-hidden": "true", text: "+" })));
          const article = el("article", { class: "diagnosis", id: slug }, button, content); section.append(article);
          const open = () => { button.setAttribute("aria-expanded", "true"); article.classList.add("is-open"); content.hidden = false; renderCases(content, diagnosis, diagnosisCases); };
          button.addEventListener("click", () => { if (button.getAttribute("aria-expanded") === "true") { button.setAttribute("aria-expanded", "false"); article.classList.remove("is-open"); content.hidden = true; } else open(); });
          if (decodeURIComponent(location.hash.slice(1)) === slug) requestAnimationFrame(() => { open(); article.scrollIntoView({ block: "start" }); });
        });
    });
    const generated = await loadSearchIndex();
    setupSearch(document.querySelector("#global-search"), document.querySelector("#search-results"), generated || searchItems(diagnoses, cases, categories));
  } catch (error) { document.querySelector("#diagnoses").append(el("p", { class: "notice", role: "alert", text: `Data se nepodařilo načíst: ${error.message}` })); }
}
init();
