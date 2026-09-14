import { mkdir, writeFile } from "node:fs/promises";

const categories = [
  ["zanetliva-infekcni", "Zánětlivá, infekční a reaktivní onemocnění"],
  ["melanocytarni", "Melanocytární léze"],
  ["epidermalni-adnexalni", "Epidermální, keratinocytární a adnexální léze"],
  ["mezenchymalni-vaskularni", "Mezenchymální, vaskulární, nervové a histiocytární léze"],
  ["hematolymfoidni-systemova-vzacna", "Hematolymfoidní, systémová, metastatická a ostatní vzácná onemocnění"],
];
const nav = categories.map(([slug, title]) => `<a href="../${slug}/">${title.split(/[ ,]/)[0]}</a>`).join("");
for (const [slug, title] of categories) {
  await mkdir(slug, { recursive: true });
  await writeFile(`${slug}/index.html`, `<!doctype html>
<html lang="cs" data-base="../"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${title} – Dermatopatologický atlas"><title>${title} | Dermatopatologický atlas</title><link rel="stylesheet" href="../css/app.css"></head>
<body id="top" data-category="${slug}"><a class="skip-link" href="#main">Přejít na obsah</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="../">Dermatopatologický atlas</a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Kategorie</button><nav class="site-nav" id="site-nav" aria-label="Hlavní navigace">${nav}<a href="../study/">Studijní režim</a><a href="#search">Vyhledávání</a></nav></div></header>
<main id="main" class="container"><header class="category-head"><a class="breadcrumb" href="../">← Domů</a><h1>${title}</h1><p id="category-counts" class="muted">Načítání…</p></header>
<section class="category-tools" id="search" aria-labelledby="search-title"><h2 id="search-title">Vyhledávání v atlasu</h2><div class="search-wrap"><label class="search-label" for="global-search">Diagnóza nebo klinický údaj</label><input class="search-input" id="global-search" type="search" autocomplete="off" placeholder="Hledat česky nebo anglicky" aria-controls="search-results" aria-expanded="false"><div class="search-results" id="search-results" role="region" aria-live="polite" hidden></div></div><h2>Podsekce</h2><div id="subcategory-index"></div></section>
<div id="diagnoses"></div><a class="back-top" href="#top">↑ Zpět nahoru</a></main>
<footer class="site-footer"><div class="container">Digitální preparáty a zdrojová data: <a href="https://vpathwebdev.virtualpathology.leeds.ac.uk/" target="_blank" rel="noopener noreferrer">University of Leeds Virtual Pathology</a>. Tento nezávislý atlas není oficiálním webem ani podporovaným projektem University of Leeds. Pro zpětnou vazbu použijte <a href="https://docs.google.com/forms/d/e/1FAIpQLSfTR73xe23OCjCqkRmtu74ZRonXNlj096UCBm17kylT8CQZVg/viewform" target="_blank" rel="noopener noreferrer">tento formulář</a>.</div></footer>
<script type="module" src="../js/nav.js"></script><script type="module" src="../js/category.js"></script></body></html>\n`);
}
