import { countLabel, el } from "./utils.js";

const textBlock = (title, value) => value ? el("div", {}, el("h5", { text: title }), el("p", { text: value })) : null;

function patientTitle(item) {
  const sex = { male: "Muž", female: "Žena", unknown: "neuvedeno" }[String(item.sex_source || "unknown").toLowerCase()] || item.sex_source || "neuvedeno";
  const age = item.age_source && String(item.age_source).toLowerCase() !== "unknown" ? `${item.age_source} let` : "věk neuveden";
  return `${sex}, ${age}`;
}

function renderSlide(slide, diagnosis, index) {
  const linkAttrs = { href: slide.viewer_url, target: "_blank", rel: "noopener noreferrer" };
  const card = el("article", { class: "slide-card" });
  if (slide.thumbnail_url) {
    const image = el("img", { src: slide.thumbnail_url, loading: "lazy", alt: `Náhled preparátu: ${diagnosis.canonical_cs}`, decoding: "async" });
    image.addEventListener("error", () => { image.replaceWith(el("div", { class: "image-placeholder", role: "img", "aria-label": "Náhled preparátu není dostupný", text: "Náhled není dostupný" })); });
    card.append(el("a", { ...linkAttrs, class: "slide-image" }, image));
  } else card.append(el("div", { class: "image-placeholder", text: "Náhled není dostupný" }));
  card.append(el("div", { class: "slide-meta" },
    slide.stain_source ? el("strong", { text: slide.stain_source }) : null,
    slide.slide_id ? el("small", { text: `ID: ${slide.slide_id}` }) : null,
    slide.viewer_url ? el("a", { ...linkAttrs, class: "button button-small", text: "Otevřít digitální preparát" }) : null
  ));
  return card;
}

function renderCase(item, diagnosis, number) {
  const originalId = `original-${diagnosis.diagnosis_id}-${number}`;
  const original = el("div", { id: originalId, class: "original", hidden: "" },
    textBlock("Diagnosis", item.diagnosis_source), textBlock("Patient", item.patient_source),
    textBlock("Clinical", item.clinical_source), textBlock("Comment", item.comment_source));
  const toggle = el("button", { type: "button", class: "text-button", "aria-expanded": "false", "aria-controls": originalId, text: "Zobrazit originální anglický text" });
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open)); original.hidden = open;
    toggle.textContent = open ? "Zobrazit originální anglický text" : "Skrýt originální anglický text";
  });
  const slides = Array.isArray(item.slides) ? item.slides : [];
  return el("article", { class: "case-card" }, el("h4", { text: patientTitle(item) }),
    textBlock("Klinické údaje", item.clinical_cs), textBlock("Poznámka", item.comment_cs),
    toggle, original,
    slides.length ? el("div", {}, el("h5", { text: countLabel(slides.length, "preparát", "preparáty", "preparátů") }),
      el("div", { class: "slides-grid" }, ...slides.map((slide, index) => renderSlide(slide, diagnosis, index)))) : null);
}

export function renderCases(container, diagnosis, cases) {
  if (container.dataset.rendered) return;
  container.dataset.rendered = "true";
  if (!cases.length) container.append(el("p", { class: "muted", text: "K této diagnóze nejsou dostupné případy." }));
  else container.append(...cases.map((item, index) => renderCase(item, diagnosis, index)));
}
