import { loadAtlas } from "./data.js";
import { categoryForDiagnosis, countLabel, diagnosisSlug, el, normalize } from "./utils.js";
import { formatAge } from "./diagnosis.js";

const STORAGE_KEY = "dermaslides-study-session-v1";
const app = document.querySelector("#study-app");
let atlas;
let eligibleCases = [];
let session = null;

const sexLabel = (value) => ({ male: "Muž", female: "Žena", unknown: "neuvedeno" }[String(value || "unknown").toLowerCase()] || value);
const patientLabel = (item) => `${sexLabel(item.sex_source)}, ${formatAge(item.age_source)}`;

export function fisherYates(items, random = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function diagnosisFor(item) {
  return atlas.diagnoses.find((diagnosis) => diagnosis.diagnosis_id === item.diagnosis_id);
}

function containsAnswer(item, diagnosis) {
  const clinical = normalize(`${item.clinical_source || ""} ${item.clinical_cs || ""}`);
  const variants = [item.diagnosis_source, item.diagnosis_normalized, item.diagnosis_group,
    item.diagnosis_cs, item.diagnosis_group_cs, diagnosis?.canonical_en, diagnosis?.canonical_cs,
    ...(diagnosis?.source_variants || [])];
  return variants.some((variant) => {
    const answer = normalize(variant);
    return answer.length >= 5 && clinical.includes(answer);
  });
}

export function isEligible(item, diagnosis) {
  if (item.certainty !== "definite" || diagnosis?.certainty && diagnosis.certainty !== "definite") return false;
  const label = String(item.diagnosis_source || item.diagnosis_normalized || "").trim();
  if (/^see comment\.?$/i.test(label)) return false;
  if (/^(\?|possible\b|probable\b|perhaps\b)|\b(differential diagnosis|cannot exclude|equivocal|no consensus|consensus not reached)\b/i.test(label)) return false;
  return !containsAnswer(item, diagnosis);
}

function saveSession() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* Storage is optional. */ }
}

function clearSession() {
  session = null;
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
}

function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.caseIds) || !saved.caseIds.length || !Number.isInteger(saved.current)) return null;
    if (saved.caseIds.some((id) => !atlas.cases.some((item) => item.id === id))) return null;
    return { ...saved, answers: saved.answers || {}, revealed: Boolean(saved.revealed) };
  } catch { return null; }
}

function renderSlide(slide, index) {
  const attrs = { href: slide.viewer_url, target: "_blank", rel: "noopener noreferrer" };
  const card = el("article", { class: "slide-card" });
  if (slide.thumbnail_url) {
    const image = el("img", { src: slide.thumbnail_url, loading: "lazy", decoding: "async", alt: `Náhled preparátu ${index + 1}` });
    const link = el("a", { ...attrs, class: "slide-image" }, image);
    image.addEventListener("error", () => {
      link.classList.add("slide-image--unavailable");
      image.replaceWith(el("div", { class: "image-placeholder", text: "Náhled není dostupný" }));
    });
    card.append(link);
  } else card.append(el("div", { class: "slide-image slide-image--unavailable" }, el("div", { class: "image-placeholder", text: "Náhled není dostupný" })));
  card.append(el("div", { class: "slide-meta" },
    slide.stain_source ? el("strong", { text: `Barvení: ${slide.stain_source}` }) : null,
    slide.viewer_url ? el("a", { ...attrs, class: "button", text: "Otevřít Leeds viewer" }) : null));
  return card;
}

function answerBlock(item) {
  const diagnosis = diagnosisFor(item);
  const block = el("section", { class: "study-answer", "aria-labelledby": "answer-title" },
    el("h3", { id: "answer-title", text: item.diagnosis_cs || diagnosis?.canonical_cs || "Diagnóza neuvedena" }),
    el("p", { class: "english-diagnosis", text: item.diagnosis_source || diagnosis?.canonical_en || "" }));
  if (item.comment_cs) block.append(el("h4", { text: "Poznámka" }), el("p", { text: item.comment_cs }));
  if (item.comment_source) {
    const original = el("div", { class: "original", hidden: "" }, el("p", { text: item.comment_source }));
    const toggle = el("button", { type: "button", class: "text-button", "aria-expanded": "false", text: "Zobrazit originální anglickou poznámku" });
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.textContent = open ? "Zobrazit originální anglickou poznámku" : "Skrýt originální anglickou poznámku";
      original.hidden = open;
    });
    block.append(toggle, original);
  }
  return block;
}

function renderCase() {
  if (session.current >= session.caseIds.length) return renderResults();
  const item = atlas.cases.find((candidate) => candidate.id === session.caseIds[session.current]);
  const slides = Array.isArray(item.slides) ? item.slides : [];
  const panel = el("article", { class: "study-panel study-case" },
    el("div", { class: "study-progress" }, el("span", { text: `Případ ${session.current + 1} z ${session.caseIds.length}` }), el("span", { text: `Správně: ${Object.values(session.answers).filter(Boolean).length}` })),
    el("h2", { text: patientLabel(item) }),
    item.clinical_cs ? el("div", {}, el("h3", { text: "Klinické údaje" }), el("p", { text: item.clinical_cs })) : null,
    el("h3", { text: countLabel(slides.length, "Preparát", "Preparáty", "Preparátů") }),
    slides.length ? el("div", { class: "slides-grid" }, ...slides.map(renderSlide)) : el("p", { class: "muted", text: "Preparát není dostupný." }));

  if (!session.revealed) {
    const reveal = el("button", { type: "button", class: "study-button", text: "Zobrazit diagnózu" });
    reveal.addEventListener("click", () => { session.revealed = true; saveSession(); renderCase(); });
    panel.append(el("div", { class: "study-actions" }, reveal));
  } else {
    panel.append(answerBlock(item));
    if (!(item.id in session.answers)) {
      const correct = el("button", { type: "button", class: "study-button study-button--correct", text: "Měl jsem správně" });
      const wrong = el("button", { type: "button", class: "study-button study-button--wrong", text: "Nevěděl jsem / špatně" });
      const score = (result) => { session.answers[item.id] = result; saveSession(); renderCase(); };
      correct.addEventListener("click", () => score(true)); wrong.addEventListener("click", () => score(false));
      panel.append(el("div", { class: "study-actions" }, correct, wrong));
    } else {
      const next = el("button", { type: "button", class: "study-button", text: session.current + 1 === session.caseIds.length ? "Zobrazit výsledky" : "Další případ" });
      next.addEventListener("click", () => { session.current += 1; session.revealed = false; saveSession(); renderCase(); window.scrollTo({ top: 0, behavior: "smooth" }); });
      panel.append(el("p", { class: session.answers[item.id] ? "study-result-good" : "study-result-bad", text: session.answers[item.id] ? "Označeno jako správně" : "Označeno jako nevěděl jsem / špatně" }), el("div", { class: "study-actions" }, next));
    }
  }
  app.replaceChildren(panel);
}

function renderResults() {
  const correct = Object.values(session.answers).filter(Boolean).length;
  const rows = session.caseIds.map((id, index) => {
    const item = atlas.cases.find((candidate) => candidate.id === id);
    const diagnosis = diagnosisFor(item);
    const diagnosisName = item.diagnosis_cs || diagnosis?.canonical_cs || "—";
    const category = diagnosis && categoryForDiagnosis(diagnosis, atlas.categories);
    const slug = diagnosis && diagnosisSlug(diagnosis);
    const diagnosisLabel = category?.slug && slug
      ? el("a", {
        href: `../${category.slug}/#${slug}`,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "result-diagnosis-link",
        "aria-label": `Otevřít diagnózu ${diagnosisName} v atlasu v nové kartě`,
      }, diagnosisName, el("span", { "aria-hidden": "true", text: "↗" }))
      : document.createTextNode(diagnosisName);
    const result = session.answers[id];
    return el("tr", {}, el("td", { text: String(index + 1) }), el("td", {}, diagnosisLabel),
      el("td", { class: result ? "study-result-good" : "study-result-bad", text: result ? "Správně" : "Nevěděl / špatně" }));
  });
  const restart = el("button", { type: "button", class: "study-button", text: "Nový test" });
  restart.addEventListener("click", () => { clearSession(); renderSetup(); });
  app.replaceChildren(el("section", { class: "study-panel" }, el("h2", { text: "Výsledky" }),
    el("p", { class: "stats", text: `Skóre: ${correct} z ${session.caseIds.length} (${Math.round(correct / session.caseIds.length * 100)} %)` }),
    el("div", { class: "study-results-wrap" }, el("table", { class: "study-results" }, el("thead", {}, el("tr", {}, el("th", { text: "#" }), el("th", { text: "Diagnóza" }), el("th", { text: "Výsledek" }))), el("tbody", {}, ...rows))),
    el("div", { class: "study-actions" }, restart)));
}

function renderSetup() {
  const categories = atlas.categories.map((category) => {
    const count = eligibleCases.filter((item) => item.category === category.category).length;
    return el("label", { class: "study-option" }, el("input", { type: "checkbox", name: "category", value: category.category, checked: "" }), el("span", { text: `${category.category_cs} (${count})` }));
  });
  const countChoices = [5, 10, 20].map((count) => el("label", { class: "study-option" }, el("input", { type: "radio", name: "count", value: count, checked: count === 10 ? "" : null }), el("span", { text: String(count) })));
  const customRadio = el("input", { type: "radio", name: "count", value: "custom" });
  const customInput = el("input", { class: "study-custom", type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "Vlastní počet", "aria-label": "Vlastní počet případů" });
  customInput.addEventListener("focus", () => { customRadio.checked = true; });
  const error = el("p", { class: "study-error", role: "alert" });
  const start = el("button", { type: "button", class: "study-button", text: "Spustit test" });
  start.addEventListener("click", () => {
    const selected = [...app.querySelectorAll('input[name="category"]:checked')].map((input) => input.value);
    const countChoice = app.querySelector('input[name="count"]:checked')?.value;
    const wanted = countChoice === "custom" ? Number(customInput.value) : Number(countChoice);
    const pool = eligibleCases.filter((item) => selected.includes(item.category));
    if (!selected.length) error.textContent = "Vyberte alespoň jednu kategorii.";
    else if (!Number.isInteger(wanted) || wanted < 1) error.textContent = "Zadejte platný počet případů.";
    else if (wanted > pool.length) error.textContent = `Pro tento výběr je dostupných nejvýše ${pool.length} případů.`;
    else {
      session = { caseIds: fisherYates(pool).slice(0, wanted).map((item) => item.id), current: 0, revealed: false, answers: {} };
      saveSession(); renderCase();
    }
  });
  app.replaceChildren(el("section", { class: "study-panel", "aria-labelledby": "setup-title" }, el("h2", { id: "setup-title", text: "Nastavení testu" }),
    el("fieldset", { class: "study-fieldset" }, el("legend", { text: "Kategorie (vyberte jednu nebo více)" }), el("div", { class: "study-options" }, ...categories)),
    el("fieldset", { class: "study-fieldset" }, el("legend", { text: "Počet případů" }), el("div", { class: "study-counts" }, ...countChoices, el("label", { class: "study-option" }, customRadio, el("span", { text: "Vlastní" }))), customInput),
    error, el("div", { class: "study-actions" }, start)));
}

async function init() {
  try {
    atlas = await loadAtlas();
    eligibleCases = atlas.cases.filter((item) => isEligible(item, diagnosisFor(item)));
    session = restoreSession();
    if (session) renderCase(); else renderSetup();
  } catch (error) {
    app.replaceChildren(el("div", { class: "notice", text: `Studijní režim se nepodařilo načíst: ${error.message}` }));
  }
}

init();
