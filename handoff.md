# Jelementi — razvojni handoff

> **Status:** M2 u toku — M2.2 merged u `main` kroz PR #3, canonical 103/103 i merged-main checks green; Checkpoint C ostaje zatvoren
> **Naziv projekta:** Jelementi  
> **Javni domen:** `https://jelementi.quz.ma`  
> **Beta režim:** unlisted beta — javni URL bez promocije, sa `noindex`  
> **Primarni jezik proizvoda:** engleski  
> **Primarni jezik razgovora i internog planiranja:** srpski  
> **Ciljna platforma:** web + privatni Android build  
> **Repozitorijum:** javni monorepo `DarkoKuzmanovic/jelementi`; ne nastavljati na istoriji Lenkalice
> **Poslednje usklađivanje:** 2026-07-28

---

## Contents

- [1. Kontekst i cilj](#1-kontekst-i-cilj)
- [2. Zaključane produktne odluke](#2-zaključane-produktne-odluke)
- [3. Jezička pravila](#3-jezička-pravila)
  - [Srpski je obavezan za](#srpski-je-obavezan-za)
  - [Engleski je obavezan za](#engleski-je-obavezan-za)
- [4. Tehnološke odluke](#4-tehnološke-odluke)
  - [Web](#web)
  - [Android](#android)
  - [Content](#content)
  - [Infrastruktura](#infrastruktura)
- [5. Arhitektura sistema](#5-arhitektura-sistema)
- [6. Predložena struktura repozitorijuma](#6-predložena-struktura-repozitorijuma)
- [7. Model članka](#7-model-članka)
  - [Primer Markdown fajla](#primer-markdown-fajla)
  - [Frontmatter pravila](#frontmatter-pravila)
- [8. ArticleDocument](#8-articledocument)
- [9. Content compiler](#9-content-compiler)
- [10. Web aplikacija](#10-web-aplikacija)
  - [MVP stranice](#mvp-stranice)
  - [Principi](#principi)
  - [Article renderer](#article-renderer)
  - [Search](#search)
  - [Unlisted beta i SEO](#unlisted-beta-i-seo)
- [11. Expo Android aplikacija](#11-expo-android-aplikacija)
  - [MVP funkcije](#mvp-funkcije)
  - [WebView trust granica](#webview-trust-granica)
  - [Native audio](#native-audio)
  - [Push](#push)
  - [Distribucija](#distribucija)
- [12. Privatni Studio](#12-privatni-studio)
  - [MVP funkcije](#mvp-funkcije-1)
  - [Publishing flow](#publishing-flow)
- [13. API i mutable state](#13-api-i-mutable-state)
- [14. Cloudflare i media](#14-cloudflare-i-media)
  - [Workers](#workers)
  - [R2](#r2)
  - [Cloudflare Access](#cloudflare-access)
- [15. Editorial workflow](#15-editorial-workflow)
- [16. Test strategija](#16-test-strategija)
  - [Article model i compiler](#article-model-i-compiler)
  - [Web](#web-1)
  - [Studio](#studio)
  - [Android](#android-1)
- [17. CI/CD i environment](#17-cicd-i-environment)
  - [Pull request gate](#pull-request-gate)
  - [Main branch](#main-branch)
  - [Secrets i bindings](#secrets-i-bindings)
- [18. Ručni prenos sa Lenkalice](#18-ručni-prenos-sa-lenkalice)
- [19. Faze implementacije](#19-faze-implementacije)
  - [Faza 0 — Bootstrap i prvi arhitektonski dokaz](#faza-0--bootstrap-i-prvi-arhitektonski-dokaz)
  - [Faza 1 — Content engine i web reader](#faza-1--content-engine-i-web-reader)
  - [Faza 2 — Cloudflare unlisted web beta](#faza-2--cloudflare-unlisted-web-beta)
  - [Faza 3 — Minimalni Studio](#faza-3--minimalni-studio)
  - [Faza 4 — Privatni Android shell](#faza-4--privatni-android-shell)
  - [Faza 5 — Native background audio](#faza-5--native-background-audio)
  - [Faza 6 — Početni katalog i MVP zatvaranje](#faza-6--početni-katalog-i-mvp-zatvaranje)
  - [Posle MVP-a](#posle-mvp-a)
- [20. MVP definicija](#20-mvp-definicija)
- [21. Namerno van MVP-a](#21-namerno-van-mvp-a)
- [22. Prihvaćeni rizici i budući gate-ovi](#22-prihvaćeni-rizici-i-budući-gate-ovi)
  - [Prihvaćeno tokom bete](#prihvaćeno-tokom-bete)
  - [Pre uklanjanja `noindex`](#pre-uklanjanja-noindex)
  - [Pre javne distribucije Android aplikacije](#pre-javne-distribucije-android-aplikacije)
- [23. Coding standardi](#23-coding-standardi)
- [24. Pravila rada za AI agente](#24-pravila-rada-za-ai-agente)
- [25. Prvi implementacioni zadatak](#25-prvi-implementacioni-zadatak)
- [26. Otvorene odluke koje ne blokiraju Fazu 0](#26-otvorene-odluke-koje-ne-blokiraju-fazu-0)
- [27. Sažetak](#27-sažetak)

---

## 1. Kontekst i cilj

Jelementi je custom-built digitalni magazin napravljen prvenstveno za Jelenu.
Tematski nasleđuje Lenkalicu, ali ne nastavlja njenu tehničku arhitekturu ni Git
istoriju.

Sadržaj obuhvata dobro istražene i lepo predstavljene priče iz oblasti:

- istorije;
- kulture;
- geografije i udaljenih mesta;
- prirodnih fenomena;
- nauke;
- neobičnih ljudi i zajednica;
- istorijskih anomalija;
- tema koje izazivaju reakciju: „Čekaj, kako je ovo uopšte moguće?”

AI modeli pomažu u istraživanju i pisanju. Darko lično odobrava finalni engleski
tekst, ključne činjenice i javne reference pre objave.

Projekat ima dva cilja, ali njihov prioritet nije isti u svakoj fazi:

1. **Do prvog upotrebljivog MVP-a:** Jelenina vrednost i brz feedback imaju prednost.
2. **Posle MVP-a:** projekat može nastaviti kao Darkov learning lab čak i ako ga
   Jelena retko koristi.

Ne koristiti gotovu blog platformu ili generički headless CMS kao centralni deo
sistema. Custom content compiler, Studio i publishing workflow su nameran deo
projekta.

---

## 2. Zaključane produktne odluke

- Jelena je jedini produktni kompas za prvi MVP.
- Web je javno dostupan na `jelementi.quz.ma`, ali u početku koristi `noindex`.
- Ova faza se zove **unlisted beta**, ne private ili closed beta.
- GitHub repozitorijum je javan.
- Markdown draftovi i njihova Git istorija nisu tajni.
- Android MVP se distribuira kao privatni EAS/internal build, ne preko javnog
  Play Store release-a.
- Jelena sme da koristi web beta verziju pre završetka celog Android MVP-a.
- Početni stvarni katalog čini 3–5 ručno prenetih Lenkalica članaka.
- Ne graditi migration script za početni katalog; članci se prenose i čiste kroz
  Studio.
- Audio je opcioni deo članka i može biti dodat posle objave teksta.
- Sajt ostaje `noindex` dok ne postoji dovoljno dobra evidencija da javno korišćeni
  tekstovi i asseti smeju da budu distribuirani.
- Backup R2 medija nije MVP uslov. Prihvaćen je rizik da je R2 jedina kopija tokom
  bete i eventualnog ranog rada.

---

## 3. Jezička pravila

Ovo je nameran eksperiment projekta: razvojni razgovor i privremeno interno
razmišljanje vode se na srpskom, dok proizvod i trajne javne tehničke površine
ostaju na engleskom.

### Srpski je obavezan za

- razgovor sa Darkom;
- pitanja i objašnjenja tokom rada;
- statusne izveštaje;
- lokalne planove i privremene implementation beleške;
- ovaj `handoff.md`;
- direktne code review komentare upućene Darku van javnog GitHub review-a.

Koristiti prirodan srpski i dijakritike: č, ć, š, ž, đ.

### Engleski je obavezan za

- source code identifikatore;
- nazive tipova, funkcija, promenljivih i fajlova;
- API rute, JSON polja i storage šeme;
- log poruke i poruke grešaka;
- code comments;
- test nazive;
- commit poruke;
- javni UI i accessibility tekst;
- članke i article metadata;
- SEO i Open Graph tekst;
- `README.md` i trajnu javnu tehničku dokumentaciju;
- `docs/decisions/` ADR dokumente;
- GitHub issues, PR opise i javne review komentare.

Primeri:

- Agent Darku na srpskom objašnjava šta implementira.
- Kod koristi `ArticleDocument`, `publishedAt` i `readingTimeMinutes`.
- Javni UI prikazuje `No articles found`, ne `Nema članaka`.
- Commit glasi `feat(content): add article compiler`.
- ADR i PR body pišu se na engleskom jer su deo javnog repozitorijuma.

Ne prevoditi engleski UI ili sadržaj na srpski bez izričitog zahteva.

---

## 4. Tehnološke odluke

### Web

- SvelteKit;
- TypeScript strict mode;
- Svelte 5 stil razvoja;
- Tailwind CSS uz sopstveni editorial design system;
- bez DaisyUI-ja i velikog UI component frameworka;
- `@sveltejs/adapter-cloudflare`;
- Cloudflare Workers;
- Wrangler za lokalni Cloudflare runtime i deployment proveru.

### Android

- Expo;
- React Native kao native shell;
- Expo Router;
- TypeScript;
- `react-native-webview` za reader;
- Expo Notifications za push;
- Expo Audio za native playback, background playback i lock-screen kontrole;
- EAS Build za privatni development/preview build.

Android aplikacija **nije zaseban React Native article renderer**. Ona prikazuje
web reader u WebView-u, a native sloj poseduje funkcije koje web ne može pouzdano
da obezbedi: push, background audio, lock-screen kontrole i buduće mini igre.

### Content

- Markdown je kanonski izvor istine;
- YAML frontmatter za metadata;
- custom Markdown direktive za posebne blokove;
- bez MDX-a, JSX-a, Svelte komponenti i raw HTML-a u člancima;
- Markdown se kompajlira u framework-neutralni `ArticleDocument`;
- Svelte renderer prikazuje `ArticleDocument` na webu;
- Android app prikazuje isti web route, ne drugi block renderer.

### Infrastruktura

- Cloudflare Workers: web, Studio server akcije i app API;
- Cloudflare R2: slike i audio;
- Cloudflare Access: `/studio` i svi Studio write endpointi;
- Cloudflare D1: push tokeni i minimalno notification stanje;
- GitHub: Markdown sadržaj, istorija i publishing trigger;
- GitHub Actions: lint, typecheck, testovi i content validacija;
- Cloudflare deployment: preview i produkcija.

D1 nikada nije izvor članaka. Članci ostaju u Markdownu i Git-u.

---

## 5. Arhitektura sistema

```text
Markdown article
      │
      ▼
Content compiler
remark + custom transforms + Zod validation
      │
      ▼
Framework-neutral ArticleDocument JSON
      │
      ├──────────────► article index / static search index
      │
      ▼
Svelte ArticleRenderer
      │
      ▼
SvelteKit web route on Cloudflare
      │
      ├──────────────► normal browser
      │
      └──────────────► Expo WebView shell
                              │
                              ├── native push handling
                              └── native Expo Audio playback
```

Osnovna pravila:

1. Markdown je kanonski sadržaj.
2. `ArticleDocument` je stabilan compiled ugovor, nezavisan od Sveltea.
3. Svelte je jedini article renderer u MVP-u.
4. Android ne duplira editorial layout; koristi isti web reader.
5. Native bridge je mali, strogo validiran i dostupan samo Jelementi originu.
6. D1 čuva mutable app stanje, ne article body.

---

## 6. Predložena struktura repozitorijuma

```text
jelementi/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   ├── article/
│   │   │   │   │   └── blocks/
│   │   │   │   ├── server/
│   │   │   │   ├── studio/
│   │   │   │   └── styles/
│   │   │   └── routes/
│   │   │       ├── +page.svelte
│   │   │       ├── articles/[slug]/
│   │   │       ├── categories/[category]/
│   │   │       ├── search/
│   │   │       ├── studio/
│   │   │       └── api/v1/
│   │   ├── static/
│   │   ├── svelte.config.js
│   │   └── wrangler.jsonc
│   │
│   └── mobile/
│       ├── src/
│       │   ├── app/
│       │   │   ├── _layout.tsx
│       │   │   └── index.tsx
│       │   ├── audio/
│       │   ├── notifications/
│       │   └── webview/
│       ├── app.json
│       └── eas.json
│
├── packages/
│   ├── article-model/
│   │   └── src/
│   ├── content-compiler/
│   │   └── src/
│   ├── design-tokens/
│   │   └── src/
│   └── config/
│       └── typescript/
│
├── content/
│   └── articles/
├── generated/
│   ├── article-index.json
│   └── articles/
├── scripts/
│   ├── build-content.ts
│   └── validate-content.ts
├── .github/workflows/
├── docs/decisions/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

Ne praviti `api-client` paket dok ne postoji drugi stvarni potrošač read API-ja.
Ne praviti React Native block renderer direktorijume.

`generated/` se u početku generiše tokom builda i može biti ignorisan u Git-u.
Ako Cloudflare build kasnije zahteva committed artefakte, odluku dokumentovati ADR-om.

---

## 7. Model članka

### Primer Markdown fajla

```md
---
title: "The 250 People at the End of the World"
slug: "tristan-da-cunha"
excerpt: "The story of the world's most remote permanent settlement."
publishedAt: "2026-07-26"
updatedAt: "2026-07-26"
status: "published"
category: "History"
tags:
  - remote places
  - islands
  - communities
author: "Jelementi"
cover:
  src: "https://media.jelementi.quz.ma/articles/tristan-da-cunha/cover-v1.webp"
  alt: "The volcanic island of Tristan da Cunha in the South Atlantic"
audio:
  src: "https://media.jelementi.quz.ma/articles/tristan-da-cunha/audio-v1.mp3"
  durationSeconds: 1842
references:
  - title: "Tristan da Cunha — Government and history"
    url: "https://example.org/source"
---

Pull up a map. Find South America on the left and Africa on the right.

## A Rock at the Edge of the World

The island has no airport and can only be reached by sea.

:::fact{title="No runway, no shortcut"}
The journey from Cape Town takes several days by ship.
:::
```

`media.jelementi.quz.ma` je zaključani i aktivni R2 custom hostname; kanonski media ključevi koriste obavezni `-vN` suffix.
Produkcijski `PUBLIC_MEDIA_BASE_URL` je `https://media.jelementi.quz.ma/`; lokalni development može koristiti loopback fixture bazu.

### Frontmatter pravila

Obavezna polja:

- `title`;
- `slug`;
- `excerpt`;
- `updatedAt`;
- `status`;
- `category`;
- `tags`;
- `author`;
- `cover.src`;
- `cover.alt`;
- javne `references` za istraživačke članke.

Za `published` članak obavezan je i `publishedAt`.

```ts
type ArticleStatus = "draft" | "published" | "archived";
```

Pravila:

- slug je stabilan i promena naslova ga ne menja automatski;
- datumi su ISO `YYYY-MM-DD` ili puni ISO timestamp;
- draftovi su isključeni iz javnog build indexa;
- repo je javan, pa draft status nije privatnost;
- audio je opcioni deo istog članka, ne poseban content type;
- naknadno dodavanje audija menja postojeći članak bez promene sluga.

---

## 8. ArticleDocument

`ArticleDocument` je javni ugovor između content compiler-a, Svelte renderera,
pretrage i budućih potrošača. WebView ne ukida potrebu za njim: njegova svrha su
validacija, kontrolisan block model, stabilan build output i buduća proširivost.

Početna šema mora biti mala.

```ts
type InlineNode =
  | {
      type: "text";
      value: string;
      marks?: Array<"strong" | "emphasis" | "code" | "strikethrough">;
    }
  | {
      type: "link";
      href: string;
      children: InlineNode[];
    }
  | {
      type: "footnoteReference";
      id: string;
    };

type ArticleBlock =
  | ParagraphBlock
  | HeadingBlock
  | ImageBlock
  | ListBlock
  | QuoteBlock
  | CalloutBlock
  | DividerBlock;

interface ParagraphBlock {
  type: "paragraph";
  children: InlineNode[];
}

interface HeadingBlock {
  type: "heading";
  level: 2 | 3 | 4;
  id: string;
  children: InlineNode[];
}

interface ImageBlock {
  type: "image";
  src: string;
  alt: string;
  caption?: InlineNode[];
  width?: number;
  height?: number;
}

interface ListBlock {
  type: "list";
  ordered: boolean;
  items: InlineNode[][];
}

interface QuoteBlock {
  type: "quote";
  children: InlineNode[];
  attribution?: string;
}

interface CalloutBlock {
  type: "callout";
  variant: "fact" | "note" | "warning";
  title?: string;
  children: InlineNode[];
}

interface DividerBlock {
  type: "divider";
}

interface ArticleReference {
  title: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
}

interface ArticleDocument {
  schemaVersion: 1;
  slug: string;
  title: string;
  excerpt: string;
  status: "draft" | "published" | "archived";
  publishedAt?: string;
  updatedAt: string;
  category: string;
  tags: string[];
  author: string;
  cover: {
    src: string;
    alt: string;
  };
  audio?: {
    src: string;
    durationSeconds?: number;
  };
  readingTimeMinutes: number;
  blocks: ArticleBlock[];
  references: ArticleReference[];
}
```

Svaki generisani dokument prolazi Zod validaciju pre serviranja.

Svaki dokument nosi `schemaVersion`:

- kompatibilne dopune mogu ostati u istoj verziji;
- breaking izmene dobijaju novu verziju;
- unsupported schema version mora dati jasnu grešku, ne tihi fallback.

---

## 9. Content compiler

Koristiti Unified/Remark ekosistem:

- `remark-parse`;
- `remark-frontmatter`;
- `remark-gfm`;
- `remark-directive`;
- sopstvene transformere;
- Zod.

Compiler:

1. učita Markdown;
2. parsira i validira frontmatter;
3. parsira Markdown AST;
4. pretvara podržane direktive u Jelementi blokove;
5. normalizuje slike, linkove i footnote reference;
6. izračuna reading time;
7. kreira `ArticleDocument`;
8. validira finalni dokument;
9. generiše article JSON;
10. generiše metadata i search index.

Ne generisati HTML kao kanonski izlaz. Svelte renderer proizvodi HTML iz
`ArticleDocument` blokova.

Ne dozvoljavati raw HTML, MDX, Svelte komponente ili JSX u člancima.

Root komande:

```bash
pnpm content:build
pnpm content:validate
pnpm content:watch
pnpm test
pnpm lint
pnpm typecheck
```

Compiler mora imati fixture test za svaki podržani block tip i jasnu grešku za
unsupported sadržaj.

---

## 10. Web aplikacija

### MVP stranice

- Home;
- article page;
- category page;
- search;
- About;
- Studio;
- 404/error.

### Principi

- content-first editorial dizajn;
- server-renderovan glavni sadržaj;
- minimalan client-side JavaScript;
- brz prvi prikaz;
- čitljivost ispred dekoracije;
- responsive i pristupačan layout;
- bez generičkog dashboard izgleda na javnom sajtu;
- dark mode je poželjan, ali nije MVP uslov.

### Article renderer

Jedna Svelte komponenta po block tipu:

```text
ArticleRenderer.svelte
blocks/
├── ParagraphBlock.svelte
├── HeadingBlock.svelte
├── ImageBlock.svelte
├── ListBlock.svelte
├── QuoteBlock.svelte
├── CalloutBlock.svelte
└── DividerBlock.svelte
```

Renderer koristi exhaustive type checking. Novi block tip ne sme neprimetno
ostati bez renderera.

### Search

MVP search koristi build-time/static index. D1 search nije potreban za 3–5
početnih članaka.

### Unlisted beta i SEO

Tokom unlisted bete:

- sve javne stranice imaju `noindex`;
- canonical i Open Graph metadata mogu postojati zbog deljenja linkova;
- RSS, sitemap i puni structured-data rad ne blokiraju MVP;
- uklanjanje `noindex` je ručna odluka;
- `noindex` se ne uklanja dok media/copyright evidencija nije prihvatljiva.

---

## 11. Expo Android aplikacija

Android MVP je Expo shell oko produkcionog web readera.

### MVP funkcije

- otvara `https://jelementi.quz.ma` u WebView-u;
- zadržava internu Jelementi navigaciju u aplikaciji;
- otvara spoljne linkove u sistemskom browseru;
- registruje Expo push token;
- otvara odgovarajući članak iz push notifikacije;
- preuzima audio playback od web readera;
- nastavlja audio u pozadini;
- prikazuje sistemske/lock-screen play/pause kontrole.

### WebView trust granica

- Samo `https://jelementi.quz.ma` sme ostati unutar WebView-a.
- Spoljni linkovi idu kroz sistemski browser.
- Koristiti i origin allowlist i eksplicitnu navigacionu proveru.
- Native bridge prihvata poruke samo dok je aktivni document trusted origin.
- Svaka bridge poruka prolazi runtime schema validation.
- Bridge ne prima proizvoljne komande; samo mali, versioned skup poruka.

Početni bridge događaj:

```ts
interface PlayArticleAudioMessage {
  type: "playArticleAudio";
  version: 1;
  payload: {
    slug: string;
    src: string;
    title: string;
    artworkUrl?: string;
  };
}
```

Stvarnu šemu zaključati testom pre implementacije bridge-a.

### Native audio

Web browser koristi web audio player. Kada se članak prikazuje u Expo shell-u,
Play akcija predaje audio URL i metadata native Expo Audio playeru.

MVP audio acceptance:

- playback nastavlja kada se ekran zaključa ili app ode u background;
- Android prikazuje play/pause kontrole;
- samo jedan player je aktivan za lock-screen kontrole;
- trajno pamćenje pozicije nije MVP uslov;
- audio progress sync nije MVP uslov.

### Push

Telefon dobija Expo push token i automatski ga šalje serveru.

Za privatnu betu registration endpoint može ostati bez pairing code-a, rate
limita i korisničkog naloga. I dalje mora:

- validirati request šemu;
- deduplikovati isti token;
- ne izlagati nikakav send credential klijentu.

Osnovna zaštita registration endpointa postaje obavezna pre bilo kakve javne
distribucije aplikacije.

Push događaji:

1. novi članak postane live;
2. postojeći članak naknadno dobije audio.

Ako tekst i audio postanu dostupni u istoj objavi, šalje se jedna notifikacija.
Ponovljeni build ili deploy ne sme poslati duplikat. Notification event mora imati
idempotency ključ izveden iz sluga, tipa događaja i content verzije.

Objava članka ne čeka uspeh push servisa. Push se šalje asinkrono kada je novi
sadržaj potvrđeno live; neuspeh je vidljiv i može se ponoviti.

### Distribucija

- prvi cilj je development/preview build na fizičkom Android uređaju;
- MVP se deli privatno kroz EAS/internal distribution;
- Play Store listing, privacy površina za širu publiku i javna podrška nisu MVP.

---

## 12. Privatni Studio

Studio je na:

```text
https://jelementi.quz.ma/studio
```

Cloudflare Access štiti UI i sve write endpoint-e. Server-side write akcije moraju
proveriti pouzdan Access identity signal; skriven link nije zaštita.

### MVP funkcije

- kreiranje članka;
- učitavanje i uređivanje postojećeg članka;
- metadata forma;
- Markdown editor;
- web preview;
- validacija i jasne greške;
- `Save draft`;
- `Publish` GitHub commit;
- deployment status;
- `Unpublish` GitHub commit.

Nisu MVP Studio funkcije:

- R2 media upload;
- autosave;
- realtime collaboration;
- WYSIWYG editor;
- approximate mobile preview;
- generičan CMS model.

Slike i NotebookLM audio se u MVP-u ručno postavljaju u R2, a URL se zatim unosi
kroz Studio.

### Publishing flow

```text
Studio
  │
  ├── Save draft ───────────► GitHub commit (status: draft)
  │
  ├── Publish ──────────────► GitHub commit (status: published)
  │                                │
  │                                ▼
  │                         Cloudflare deployment
  │                                │
  │                                ├── failure → visible status + retry
  │                                └── live → async push event
  │
  └── Unpublish ────────────► GitHub commit (status: archived)
```

Status model mora razlikovati:

- saved/committed;
- deployment pending;
- deployment failed;
- live.

`Publish` ne sme tvrditi da je članak live samo zato što je GitHub commit uspeo.

Repo je javan. Svaki `Save draft` commit čini draft vidljivim na GitHub-u, iako ga
javni web build ne prikazuje. To je svesno prihvaćena odluka.

GitHub credential i R2/Cloudflare tajne nikada ne smeju doći do browsera.

---

## 13. API i mutable state

SvelteKit Worker služi web, Studio server akcije i mali app API. Ne uvoditi zaseban
backend servis dok ne postoji stvaran razlog.

MVP nema generičan javni article API ni sync manifest, jer WebView app nije njihov
potrošač.

Potrebne rute ili server akcije:

```text
POST /api/v1/devices/register
POST /api/v1/studio/articles
PUT  /api/v1/studio/articles/:slug
POST /api/v1/studio/articles/:slug/publish
POST /api/v1/studio/articles/:slug/unpublish
GET  /api/v1/studio/deployments/:id
```

Tačan SvelteKit action/route oblik može se promeniti tokom implementacije, ali
trust granice ne mogu:

- device registration je jedini beta endpoint bez naloga;
- Studio read/write površina je Access-protected;
- notification send nije javni endpoint;
- article content ostaje u Git-u, ne u D1.

D1 u MVP-u čuva najmanje:

- Expo push tokene;
- minimalno notification/idempotency stanje;
- po potrebi deployment correlation podatke.

D1 ne čuva article body, draftove ili kanonski metadata model.

---

## 14. Cloudflare i media

### Workers

Web, Studio i app API deployuju se kao SvelteKit Cloudflare Worker.

Root scripts:

```bash
pnpm dev:web
pnpm preview:web
pnpm deploy:web
```

`preview:web` mora koristiti build i Wrangler runtime dovoljno sličan produkciji.
Ne zaključivati da kod radi na Workers samo zato što radi u standardnom SvelteKit
dev serveru.

### R2

Aktivni bucket:

```text
jelementi-media
```

Kanonska versioned putanja:

```text
articles/
└── tristan-da-cunha/
    ├── cover-v1.webp
    ├── image-01-v1.webp
    └── audio-v1.mp3
```

Pravila:

- nove slike i audio ne skladištiti u Git-u;
- koristiti stabilne i čitljive putanje;
- optimizovati slike pre ili tokom ručnog uploada;
- čuvati dimenzije slike u metadata gde je moguće;
- ne prepisivati objavljen asset na istom ključu;
- nova verzija dobija novo ime ili verziju;
- media hostname dolazi iz konfiguracije, ne hardkodovanog production URL-a.

R2 je svesno jedina media kopija u MVP-u. Backup i testiran restore ostaju kasniji
operativni rad, ne launch gate.

### Cloudflare Access

- štiti `/studio`;
- štiti sve Studio write i status endpoint-e;
- server proverava Access identity/JWT ili drugi pouzdan signal;
- javni article route i device registration ne idu iza Access-a.

---

## 15. Editorial workflow

Za svaki članak:

1. AI pomaže u istraživanju i draftu.
2. Darko proverava ključne tvrdnje i izvore.
3. Finalni tekst i metadata su na engleskom.
4. Javni članak sadrži reference ili Sources odeljak.
5. Studio validira content model.
6. Darko odobrava Publish.
7. Deployment mora potvrditi live stanje.
8. Push se šalje asinkrono posle live potvrde.

Audio workflow:

1. tekst može biti objavljen bez audija;
2. NotebookLM audio se ručno uploaduje u R2;
3. isti članak dobija opcioni `audio` metadata blok;
4. novi deployment objavljuje audio;
5. nakon live potvrde šalje se `audio available` notifikacija;
6. ako tekst i audio izlaze zajedno, šalje se samo jedna notifikacija.

Tokom bete media/copyright evidencija može biti best-effort. Sajt ostaje `noindex`
dok ta evidencija nije dovoljno dobra za javno indeksiranje.

---

## 16. Test strategija

### Article model i compiler

Obavezni unit/fixture testovi za:

- frontmatter validaciju;
- slug validaciju;
- svaki Markdown block tip;
- invalid i unsupported sadržaj;
- reading time;
- schema version;
- article index;
- content hash/version;
- references;
- članak sa i bez audija.

### Web

Minimalni tokovi:

- home prikazuje published članke;
- article page renderuje svaki podržani blok;
- category filter radi;
- search nalazi metadata/body rezultat;
- nepoznat slug daje 404;
- draft i archived članak nisu javni;
- beta stranice nose `noindex`;
- Studio nije javno dostupan bez Access identity-ja.

### Studio

- invalid content ne može da se objavi;
- `Save draft` ostavlja članak van javnog indexa;
- uspešan commit ne prikazuje lažni `live` status;
- deployment failure je vidljiv;
- `Unpublish` uklanja članak iz javnog indexa posle deploymenta;
- notification event je idempotentan.

### Android

Automatizovati gde je praktično:

- trusted-origin navigation;
- external-link routing;
- bridge message schema;
- push deep-link mapping;
- audio state transitions.

Na fizičkom Android uređaju ručno potvrditi:

- privatni build se instalira;
- WebView otvara produkcioni sajt;
- push otvara tačan članak;
- audio nastavlja u backgroundu;
- lock-screen play/pause radi.

Ne uvoditi kompleksan native E2E setup pre stabilnog vertical slice-a.

---

## 17. CI/CD i environment

### Pull request gate

1. install;
2. lint/format check;
3. typecheck;
4. content validation;
5. unit tests;
6. web build;
7. fokusirani smoke test kada postoji stabilna meta.

### Main branch

1. sve provere prolaze;
2. Cloudflare deployuje web/Studio/API;
3. deployment status postaje vidljiv Studiju;
4. published article index postaje live;
5. odgovarajući push event se šalje asinkrono.

Mobile build nije vezan za svaki content deployment.

### Secrets i bindings

Predložena imena prilagoditi stvarnoj implementaciji:

```text
GITHUB_TOKEN_OR_APP_CREDENTIAL
GITHUB_OWNER
GITHUB_REPO
GITHUB_BRANCH
PUBLIC_SITE_URL
PUBLIC_MEDIA_BASE_URL
R2_MEDIA_BUCKET
D1_APP_STATE
EXPO_PUBLIC_SITE_URL
```

Pravila:

- R2 i D1 koristiti kao Cloudflare bindings;
- sve sa `PUBLIC_` ili `EXPO_PUBLIC_` je javno;
- GitHub, Cloudflare i notification send credential nikada nisu public config;
- napraviti `.env.example` bez stvarnih vrednosti;
- javni repo nikada ne sme sadržati credential ili privatni Access podatak.

---

## 18. Ručni prenos sa Lenkalice

Ne graditi `migrate-lenkalica.ts` za MVP.

Početnih 3–5 članaka Darko ručno prenosi kroz Studio. Birati reprezentativan set:

- jedan dugačak članak;
- jedan sa više slika;
- jedan sa audio fajlom ili kandidat za naknadni audio;
- jedan kratak članak;
- jedan sa references/footnotes ako postoji.

Za svaki preneti članak:

1. očistiti i prevesti/urediti engleski tekst;
2. normalizovati frontmatter;
3. sačuvati stabilan slug;
4. ručno uploadovati izabrane medije u R2;
5. zameniti stare lokalne ili GitHub Raw putanje;
6. ukloniti unsupported raw HTML;
7. dodati javne reference;
8. validirati kroz novi compiler;
9. previewovati kroz Studio;
10. objaviti kroz novi workflow.

Generalni migration pipeline je van MVP-a i uvodi se samo ako se posle početnog
seta pokaže da ručni rad nije prihvatljiv.

---

## 19. Faze implementacije

Faze su vertikalne: Jelena dobija upotrebljive beta korake pre kompletiranja svih
native funkcija.

### Faza 0 — Bootstrap i prvi arhitektonski dokaz

Cilj: monorepo radi i centralna granica je dokazana bez preuranjenih integracija.

Deliverables:

- novi Git repo;
- pnpm workspace;
- SvelteKit app;
- Expo app;
- shared TypeScript config;
- `@jelementi/article-model`;
- minimalni ručno napravljeni `ArticleDocument` fixture;
- Svelte renderer za paragraph, heading, image i fact callout;
- Expo WebView shell koji otvara isti web reader;
- root lint, typecheck i test komande;
- osnovni CI;
- engleski `README.md`.

Acceptance:

- `pnpm install` radi;
- web prikazuje sample članak;
- Expo development build/simulator otvara isti article route;
- nema React Native article renderera;
- lint, typecheck i testovi prolaze.

Još ne raditi:

- Cloudflare deployment;
- R2;
- Studio;
- push;
- native audio bridge;
- D1;
- Lenkalica prenos;
- finalni dizajn.

### Faza 1 — Content engine i web reader

Deliverables:

- Zod šeme;
- Markdown compiler;
- supported directives;
- generated article JSON/index;
- kompletan Svelte block renderer;
- home, article, category, search, About i error stranice;
- fixture testovi;
- beta `noindex` ponašanje.

Acceptance:

- sample Markdown proizvodi validan `ArticleDocument`;
- unsupported block daje jasnu grešku;
- javni reader radi bez nepotrebnog client JavaScripta;
- draft nije vidljiv na javnim stranicama.

### Faza 2 — Cloudflare unlisted web beta

Deliverables:

- adapter-cloudflare;
- Wrangler config;
- preview i production deploy;
- `jelementi.quz.ma` binding;
- R2 bucket/binding;
- jedan stvarni beta članak;
- ručni media workflow.

Acceptance:

- web radi u Cloudflare runtimeu;
- produkcioni URL je dostupan Jeleni;
- sve javne stranice su `noindex`;
- članak prikazuje R2 sliku/audio kada postoje.

Ovo je prvi trenutak kada Jelena treba da dobije link i feedback može da počne.

### Faza 3 — Minimalni Studio

Deliverables:

- `/studio` iza Cloudflare Access-a;
- metadata forma;
- Markdown editor;
- validation i preview;
- `Save draft`;
- `Publish` commit;
- deployment status;
- `Unpublish` commit.

Acceptance:

- Darko može bez lokalnog filesystem uređivanja da napravi i objavi članak;
- tajne ne dolaze do browsera;
- draft nije na javnom webu, uz jasno dokumentovanu javnu Git vidljivost;
- Studio razlikuje committed, pending, failed i live;
- Unpublish uklanja članak iz javnog indexa posle deploymenta.

### Faza 4 — Privatni Android shell

Deliverables:

- EAS development/preview profil;
- WebView trusted-origin navigacija;
- external links kroz system browser;
- push permission i token registration;
- push deep link do članka;
- D1 push token storage;
- osnovni idempotent notification flow.

Acceptance:

- privatni build radi na fizičkom Android uređaju;
- app otvara produkcioni reader;
- novi live članak može poslati jednu notifikaciju;
- notifikacija otvara tačan članak;
- publish uspeh ne zavisi od push uspeha.

### Faza 5 — Native background audio

Deliverables:

- versioned web/native audio bridge;
- Expo Audio native player;
- background playback;
- Android lock-screen play/pause;
- naknadni audio publish event;
- audio notification bez duplikata.

Acceptance:

- audio pokrenut iz članka nastavlja van foregrounda;
- lock-screen play/pause radi;
- dodavanje audija postojećem članku šalje posebnu notifikaciju;
- tekst i audio objavljeni zajedno šalju samo jednu notifikaciju.

### Faza 6 — Početni katalog i MVP zatvaranje

Deliverables:

- 3–5 ručno prenetih Lenkalica članaka;
- oba article stanja: sa i bez audija, ako dostupni sadržaj to prirodno daje;
- editorial/reference provera;
- responsive i accessibility polish;
- puni MVP regression pass;
- dokumentovane poznate beta granice.

Acceptance:

- Jelena može čitati sadržaj na webu i u app-u;
- push i background audio rade na stvarnom uređaju;
- Darko može kroz Studio da sačuva, objavi i povuče članak;
- novi content deployment ne zahteva novi Android build.

### Posle MVP-a

Mogući pravci, po učenju i stvarnoj potrebi:

- mini igre u native aplikaciji;
- zaštićena push registracija;
- javna Play Store distribucija;
- reading progress i bookmarks;
- offline sadržaj i SQLite;
- audio position persistence;
- RSS, sitemap i puni SEO;
- media backup i restore;
- bolja rights/source evidencija;
- D1 korisnički sync;
- push notifications za širu publiku;
- generalni Lenkalica migration pipeline;
- richer block types;
- javni article API kada dobije stvarnog potrošača.

---

## 20. MVP definicija

Prvi pravi Jelementi MVP je završen kada:

- web radi na `https://jelementi.quz.ma` kroz Cloudflare Workers;
- web je u unlisted `noindex` režimu;
- postoji 3–5 stvarnih članaka;
- Markdown se kompajlira u validan `ArticleDocument`;
- Svelte reader radi u browseru i Expo WebView-u;
- Home, article, categories, search, About i error stranice rade;
- Studio može da sačuva draft, objavi i povuče članak;
- Studio prikazuje stvarni deployment status;
- Android privatni EAS build radi na fizičkom uređaju;
- app registruje push token i otvara article deep link;
- novi članak i naknadni audio imaju pravilne, neduplirane notifikacije;
- native audio nastavlja u backgroundu i ima lock-screen play/pause;
- novi članak ili audio ne zahtevaju novi Android build;
- stari Lenkalica repo nije runtime dependency.

MVP ne zahteva da svi delovi budu Jeleni prvi put prikazani istovremeno. Web beta
se isporučuje ranije.

---

## 21. Namerno van MVP-a

Ne implementirati prerano:

- zaseban React Native article renderer;
- Expo SQLite i offline sync;
- reading progress sync;
- bookmarks;
- javni Play Store release;
- više korisničkih naloga;
- pairing flow ili kompletan push abuse protection pre privatne bete;
- komentare i društvene funkcije;
- recommendation engine;
- WYSIWYG editor;
- autosave i conflict resolution;
- Studio media upload;
- realtime collaboration;
- generičan CMS;
- iOS release;
- puni RSS/sitemap/SEO launch paket;
- javni article/sync API;
- zaseban backend servis;
- D1 kao izvor članaka;
- MDX ili raw HTML;
- desetine block tipova;
- generalni migration script;
- media backup kao beta gate;
- mini igre.

---

## 22. Prihvaćeni rizici i budući gate-ovi

### Prihvaćeno tokom bete

- javni repo i javna istorija draftova;
- javni web URL uz `noindex`, bez stvarne privatnosti;
- best-effort media/copyright evidencija;
- R2 kao jedina media kopija;
- device registration bez naloga, pairing code-a i rate limita;
- ručni R2 upload;
- privatna EAS distribucija.

### Pre uklanjanja `noindex`

- ručna odluka Darka;
- prihvatljiva provera prava i izvora za objavljeni sadržaj;
- nema automatskog datuma ili broja članaka koji sam uklanja `noindex`.

### Pre javne distribucije Android aplikacije

- zaštititi device registration od očigledne zloupotrebe;
- definisati privacy policy i data lifecycle;
- proveriti push token cleanup i receipt handling;
- završiti Play Store release/support površinu.

Backup medija nije zaključan kao obavezan javni launch gate; ostaje poznat i
svesno prihvaćen operativni rizik dok se naknadno ne prioritizuje.

---

## 23. Coding standardi

- TypeScript strict mode svuda.
- Ne koristiti `any` bez dokumentovanog razloga.
- Ne koristiti non-null assertion kada se vrednost može bezbedno suziti.
- Koristiti `import type` za type-only importe.
- Javni tipovi i schema ugovori imaju eksplicitne exporte.
- Framework-specifičan kod ne ulazi u `article-model` ili compiler core.
- Greške ne gutati praznim `catch` blokovima.
- Logovi sadrže kontekst, ali ne tajne ili push credentiale.
- Block renderer koristi exhaustive switch/check.
- Raw HTML iz sadržaja nije dozvoljen.
- Tajne ne idu u `PUBLIC_*` ili `EXPO_PUBLIC_*`.
- Ne uvoditi biblioteku ako standardni API ili postojeća zavisnost rešavaju problem
  jednostavno.
- Ne praviti apstrakciju pre drugog stvarnog use case-a.
- Svaka schema ili compiler promena dobija test.
- Security-sensitive WebView/bridge odluke dokumentovati u engleskom ADR-u.

Koristiti jedan dosledan formatter/linter setup za ceo monorepo. Root komande
moraju proveravati sve workspace pakete.

---

## 24. Pravila rada za AI agente

Agent mora da:

1. komunicira sa Darkom na srpskom;
2. piše kod, UI, trajne javne docs i commit poruke na engleskom;
3. pre većih izmena pregleda relevantne fajlove i važeće odluke;
4. ne kopira slepo arhitekturu Lenkalice;
5. čuva Markdown kao kanonski sadržaj;
6. čuva `ArticleDocument` nezavisnim od Sveltea i Expo-a;
7. ne pravi React Native block renderer u MVP-u;
8. tretira Expo aplikaciju kao WebView shell sa malim native capabilities slojem;
9. čuva media fajlove van Git-a;
10. validira podatke na svakoj trust granici;
11. dodaje testove uz compiler, schema, bridge i notification izmene;
12. redovno proverava Cloudflare-compatible runtime;
13. ne preteruje sa apstrakcijama i infrastrukturom;
14. završava jednu vertikalnu celinu pre sledeće;
15. dokumentuje trajne arhitektonske odluke na engleskom u `docs/decisions/`;
16. ne menja zaključane odluke iz handoffa bez jasnog razloga i ADR-a;
17. ne tvrdi da je sadržaj live pre potvrde deploymenta;
18. ne tretira `noindex`, Cloudflare Access ili `status: draft` kao međusobno
    zamenljive oblike privatnosti.

Kada nejasnoća ne blokira rad, agent pravi razumnu pretpostavku, beleži je i
nastavlja. Kada menja scope, trust granicu ili kanonski izvor podataka, mora prvo
da pita.

---

## 25. Prvi implementacioni zadatak

> ⚠️ **ISTORIJSKO / ZAVRŠENO.** Ova sekcija je originalni plan prve sesije. Faze 0 i 1 su
> završene (vidi `ROADMAP.md`), a aktuelni rad prati `PLAN.md` — M2.2 je merged kroz PR #3;
> sledeći rad počinje u novoj Crew sesiji, dok Checkpoint C i M2.3 ostaju zaključani do eksplicitnog odobrenja. Ne počinjati ponovo od Faze 0.

Originalni cilj prve implementacione sesije (izvršeno):

- inicijalizovati novi Git repo i pnpm monorepo;
- napraviti SvelteKit web app;
- napraviti Expo app;
- dodati minimalni `@jelementi/article-model`;
- napraviti jedan ručni `ArticleDocument` fixture;
- prikazati paragraph, heading, image i fact callout kroz Svelte renderer;
- otvoriti isti web route iz Expo WebView shell-a;
- podesiti root lint, typecheck i test komande;
- dodati osnovni CI i engleski README.

Ne implementirati push, audio bridge, Studio, Cloudflare, R2 ili D1 u istoj prvoj
sesiji.

Na kraju agent na srpskom izveštava:

- šta je napravljeno;
- koje komande se pokreću;
- strukturu repoa;
- donesene pretpostavke;
- rezultate lint/typecheck/test provera;
- šta nije završeno;
- sledeći preporučeni vertical slice.

---

## 26. Otvorene odluke koje ne blokiraju Fazu 0

- finalni logo i tagline;
- tačna paleta i font kombinacija;
- GitHub App naspram fine-grained tokena za Studio;
- tačan provider/API za deployment status;
- Android application ID;
- konačan copy push notifikacija;
- kada dodati media backup;
- kada ukloniti `noindex` nakon rights/source provere;
- da li će shorts kasnije dobiti poseban layout ili `format` field;
- kada learning cilj opravdava native mini igre ili pravi native content surface.

---

## 27. Sažetak

```text
Web:
SvelteKit + TypeScript + Tailwind
→ Cloudflare Workers
→ jelementi.quz.ma

Content:
Markdown + frontmatter + directives
→ content compiler
→ ArticleDocument JSON
→ Svelte ArticleRenderer

Android:
Expo + React Native shell + WebView
→ isti web reader
→ native push
→ native Expo Audio background playback

Studio:
/studio + Cloudflare Access
→ edit / validate / preview
→ GitHub Save / Publish / Unpublish commits
→ deployment status
→ async push after live confirmation

Media:
Cloudflare R2
→ ručni upload u MVP-u

Mutable app state:
Cloudflare D1
→ push tokens
→ notification idempotency

Development conversation and local planning:
Serbian

Product, code, commits and durable public repo documentation:
English
```

Glavna ideja:

> Jelementi prvo mora postati prijatan magazin koji Jelena stvarno može da koristi.
> Kada taj prag pređe, može slobodno da raste i kao Darkova škola modernog web,
> mobile i edge razvoja.
