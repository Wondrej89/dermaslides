import { loadAtlas, loadSearchIndex } from "./data.js";
import { renderCases } from "./diagnosis.js";
import { setupSearch } from "./search.js";
import { CATEGORY_ROUTES, categoryForDiagnosis, countLabel, diagnosisSlug, el, firstLetter } from "./utils.js";

const currentSlug = document.body.dataset.category;

function alphabet(diagnoses) {
  const available = new Set(diagnoses.map((item) => firstLetter(item.canonical_cs || item.canonical_en)));
  return el("nav", { class: "alphabet", "aria-label": "Abecední rejstřík v kategorii" }, ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) =>
    available.has(letter) ? el("a", { href: `#letter-${letter}`, text: letter }) : el("span", { "aria-disabled": "true", text: letter })));
}

let letterHighlightTimer;

function showLetterTarget() {
  const match = decodeURIComponent(location.hash.slice(1)).match(/^letter-([A-Z])$/);
  if (!match) return;
  const target = document.getElementById(`letter-${match[1]}`);
  const article = target?.closest(".diagnosis");
  if (!target || !article) return;
  document.querySelector(".diagnosis.is-letter-target")?.classList.remove("is-letter-target");
  article.classList.add("is-letter-target");
  target.scrollIntoView({ block: "start" });
  clearTimeout(letterHighlightTimer);
  letterHighlightTimer = setTimeout(() => article.classList.remove("is-letter-target"), 1400);
}

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
    const alphabetNav = alphabet(selected);
    document.querySelector("#category-alphabet").append(alphabetNav);
    const list = document.querySelector("#diagnoses");
    const usedLetters = new Set();
    const subcategories = selected.reduce((groups, diagnosis) => {
      const key = diagnosis.subcategory || "";
      if (!groups.has(key)) groups.set(key, { key, diagnoses: [], caseCount: 0 });
      const group = groups.get(key);
      group.diagnoses.push(diagnosis);
      group.caseCount += (groupedCases.get(String(diagnosis.diagnosis_id)) || []).length;
      return groups;
    }, new Map());

    [...subcategories.values()]
      .sort((a, b) => a.key.localeCompare(b.key, "cs"))
      .forEach((group) => {
        const titleSource = group.diagnoses.find((diagnosis) => diagnosis.subcategory_cs)
          || group.diagnoses.find((diagnosis) => diagnosis.diagnosis_group_cs)
          || group.diagnoses[0];
        const title = titleSource?.subcategory_cs || titleSource?.diagnosis_group_cs || titleSource?.subcategory || "Ostatní";
        const header = el("header", { class: "subcategory-header" },
          el("h2", { text: title }),
          el("p", { class: "subcategory-meta", text: `${countLabel(group.diagnoses.length, "diagnóza", "diagnózy", "diagnóz")} · ${countLabel(group.caseCount, "klinický případ", "klinické případy", "klinických případů")}` }));
        const section = el("section", { class: "subcategory" }, header);
        list.append(section);

        group.diagnoses.forEach((diagnosis) => {
          const slug = diagnosisSlug(diagnosis); const contentId = `cases-${slug}`; const diagnosisCases = groupedCases.get(String(diagnosis.diagnosis_id)) || [];
          const letter = firstLetter(diagnosis.canonical_cs || diagnosis.canonical_en);
          const content = el("div", { id: contentId, class: "diagnosis-content", hidden: "" });
          const letterAnchor = /^[A-Z]$/.test(letter) && !usedLetters.has(letter) ? `letter-${letter}` : null;
          if (letterAnchor) usedLetters.add(letter);
          const button = el("button", { class: "diagnosis-toggle", id: letterAnchor, type: "button", "aria-expanded": "false", "aria-controls": contentId },
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
    alphabetNav.addEventListener("click", (event) => {
      if (event.target.closest('a[href^="#letter-"]')) requestAnimationFrame(showLetterTarget);
    });
    window.addEventListener("hashchange", showLetterTarget);
    requestAnimationFrame(showLetterTarget);
    const generated = await loadSearchIndex();
    setupSearch(document.querySelector("#global-search"), document.querySelector("#search-results"), generated || searchItems(diagnoses, cases, categories));
  } catch (error) { document.querySelector("#diagnoses").append(el("p", { class: "notice", role: "alert", text: `Data se nepodařilo načíst: ${error.message}` })); }
}
init();
