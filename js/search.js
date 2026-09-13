import { basePath, debounce, el, normalize } from "./utils.js";

const searchable = (item) => normalize([
  item.canonical_cs, item.canonical_en, item.diagnosis_group_cs, item.diagnosis_group_en,
  item.diagnosis_source, item.clinical_cs, item.clinical_source, item.comment_cs,
].filter(Boolean).join(" "));

function excerpt(item, query) {
  const fields = [item.clinical_cs, item.clinical_source, item.comment_cs, item.diagnosis_source].filter(Boolean);
  const field = fields.find((value) => normalize(value).includes(query)) || fields[0] || "";
  return field.length > 170 ? `${field.slice(0, 167)}…` : field;
}

export function setupSearch(input, results, items) {
  const render = () => {
    const query = normalize(input.value);
    results.replaceChildren();
    results.hidden = query.length < 2;
    input.setAttribute("aria-expanded", String(query.length >= 2));
    if (query.length < 2) return;
    const matches = items.filter((item) => normalize(item.search_text || searchable(item)).includes(query));
    const groups = [
      ["Diagnózy", matches.filter((item) => item.type === "diagnosis").slice(0, 12)],
      ["Klinické případy", matches.filter((item) => item.type === "case").slice(0, 18)],
    ];
    groups.forEach(([title, group]) => {
      const section = el("section", { class: "search-group" }, el("h3", { text: title }));
      if (!group.length) section.append(el("p", { class: "muted", text: "Žádné výsledky." }));
      group.forEach((item) => {
        const url = `${basePath()}${item.category_slug}/#${item.diagnosis_slug}`;
        section.append(el("a", { class: "search-result", href: url },
          el("strong", { text: item.canonical_cs || item.diagnosis_source || "Bez názvu" }),
          item.canonical_en ? el("span", { text: item.canonical_en }) : null,
          item.type === "diagnosis"
            ? el("small", { text: `${item.category_title || ""}${item.case_count != null ? ` · ${item.case_count} případů` : ""}` })
            : el("small", { text: excerpt(item, query) })
        ));
      });
      results.append(section);
    });
    if (!matches.length) results.append(el("p", { class: "empty", text: "Pro zadaný výraz nebyly nalezeny žádné výsledky." }));
  };
  input.addEventListener("input", debounce(render, 200));
  input.addEventListener("keydown", (event) => { if (event.key === "Escape") { input.value = ""; render(); } });
}
