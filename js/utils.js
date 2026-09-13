export const CATEGORY_ROUTES = [
  { slug: "zanetliva-infekcni", title: "Zánětlivá, infekční a reaktivní onemocnění" },
  { slug: "melanocytarni", title: "Melanocytární léze" },
  { slug: "epidermalni-adnexalni", title: "Epidermální, keratinocytární a adnexální léze" },
  { slug: "mezenchymalni-vaskularni", title: "Mezenchymální, vaskulární, nervové a histiocytární léze" },
  { slug: "hematolymfoidni-systemova-vzacna", title: "Hematolymfoidní, systémová, metastatická a ostatní vzácná onemocnění" },
];

export function normalize(value = "") {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs").trim();
}

export function slugify(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function diagnosisSlug(diagnosis) {
  return diagnosis.diagnosis_slug || slugify(diagnosis.canonical_en || diagnosis.canonical_cs || diagnosis.diagnosis_id);
}

export function categoryRoute(value, categories = []) {
  const raw = typeof value === "object" && value ? value : categories.find((item) =>
    [item.id, item.category_id, item.category, item.slug].some((candidate) => String(candidate) === String(value))) || value;
  const candidates = typeof raw === "object" && raw
    ? [raw.slug, raw.category_slug, raw.name_cs, raw.title_cs, raw.category_cs, raw.label_cs, raw.category, raw.name, raw.title, raw.id, ...Object.values(raw).filter((item) => typeof item === "string")]
    : [raw];
  const text = normalize(candidates.filter(Boolean).join(" "));
  return CATEGORY_ROUTES.find((route) => text.includes(normalize(route.slug)) || text.includes(normalize(route.title)))
    || CATEGORY_ROUTES.find((route) => normalize(route.title).split(" ").slice(0, 1).some((word) => text.includes(word)))
    || null;
}

export function categoryForDiagnosis(diagnosis, categories) {
  return categoryRoute(diagnosis.category, categories)
    || categoryRoute(diagnosis.category_id, categories)
    || categoryRoute(diagnosis.category_slug, categories);
}

export function firstLetter(value) {
  return normalize(value).charAt(0).toUpperCase() || "#";
}

export function debounce(callback, delay = 200) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), delay); };
}

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child != null));
  return node;
}

export function countLabel(count, one, few, many) {
  if (count === 1) return `${count} ${one}`;
  if (count >= 2 && count <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function basePath() {
  return document.documentElement.dataset.base || "./";
}
