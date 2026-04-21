# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server (localhost:5173)
npm run build    # production build
npm run preview  # preview production build locally
```

There are no tests or lint scripts. The project uses plain Vite without ESLint config.

Required `.env` file at root:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GEMINI_API_KEY=...   # optional: used in motorAnaliseGemini.js directly
```

AI API keys (Claude, OpenAI, Gemini, DeepSeek) are stored per-user in the Supabase `user_api_keys` table and loaded at runtime via `loadApiKeys()` — never hardcoded or in env vars.

## Architecture

**Stack:** React 18 + Vite (no router library) + Supabase JS v2 + Vercel (static deploy + Edge Functions).

### Navigation and State

`App.jsx` is a single-file router: it owns all top-level state and switches views via `useState` (`view` field). There is no React Router. Heavy components are lazy-loaded with `React.lazy()` (Dashboard, Detail, BuscaGPT, Tarefas, ProximosLeiloes, SharedViewer). `storage.js` provides `stLoad`/`stSave` wrappers around `localStorage`.

### Auth

`src/lib/AuthContext.jsx` wraps `supabase.auth` with an `AuthProvider`. Use `useAuth()` to get `{ session, profile, loading, isAdmin }`. Two roles: `admin` and `user`. `profile.role` comes from the `profiles` table.

### Data Layer — `src/lib/supabase.js`

Central module for all Supabase CRUD. Key patterns:
- `normalizarImovel(d)` — normalizes array fields (stored as JSON strings in DB) to actual arrays; call this on every record fetched from `imoveis`
- `invalidarCache(prefixo)` — clears the in-memory 30s query cache
- `saveImovelCompleto()` — full upsert with field-protection whitelist; prefer over `saveImovel()`
- `gerarAxisId()` — generates the canonical `BH-NNN` property ID

The `imoveis` table has 167+ columns. New fields must be added via SQL migrations in `supabase/migrations/`.

### AI Pipeline — `src/lib/motorIA.js` + `src/lib/motorAnaliseGemini.js`

All AI analysis runs through a cascade:
1. **Jina.ai** — free scraper fetching the property URL text (`scraperImovel.js`)
2. **Regex extractor** — fast field extraction from scraped text
3. **Gemini 2.0 Flash** — primary analysis engine (~$0.002/analysis); handles complex fields, scores, synthesis
4. **Fallback cascade** — DeepSeek → GPT-4o-mini → GPT-4o if Gemini fails
5. **Claude Sonnet** — used for deep juridical analysis and document parsing

AI calls from the frontend go through `aiProxy.js` → Supabase Edge Function `ai-proxy` (which holds the provider API keys server-side). The `aiProxy(provider, payload, opts)` function handles auth with the user's Supabase JWT.

Model constants live in `src/lib/constants.js`: `CLAUDE_MODEL`, `ANTHROPIC_VERSION`, `MODELOS_GEMINI`.

### Scoring — `src/lib/constants.js`

The AXIS Score is a 6-dimension weighted average (sum = 1.00):
- Localização 20%, Desconto 18%, Jurídico 18%, Ocupação 15%, Liquidez 15%, Mercado 14%

Key exports from `constants.js`: `SCORE_PESOS`, `calcularScoreTotal(scores)`, `calcularCustosAquisicao(precoBase, isMercado, overrides)`, `calcularCustoTotal(...)`, `calcularBreakdownFinanceiro(...)`, `areaUsada(imovel)`.

Two cost tables: `CUSTOS_LEILAO` (comissão 5%, ITBI 3%, advogado 5%, doc 2.5%) and `CUSTOS_MERCADO` (no comissão/advogado). Source of truth for all financial calculations — do not hardcode percentages elsewhere.

### Transaction Type Detection — `src/lib/detectarFonte.js`

`detectarTipoTransacao(url)` classifies a URL as `'leilao'` or `'mercado_direto'` based on domain lists and URL heuristics. Default is `'leilao'`. Use `isMercadoDireto(url, tipoTransacao)` throughout the codebase to gate cost calculation branches.

### Static Data — `src/data/`

- `metricas_bairros_bh.js` — 21 BH neighborhoods + 7 zones with price/m², yield, IPEAD class
- `mercado_regional.js` — 16 regions (BH, Nova Lima, Contagem, JF) sourced from FipeZAP/QuintoAndar
- `custos_reforma.js` — SINAPI-MG 2026 renovation costs by finish class
- `riscos_juridicos.js` — judicial risk types by process/modality

These are **static JS objects** (not fetched from DB). Update them when market data changes; the DB table `mercado_regional` is a mirror used as fallback via `getMercadoComFallback()`.

### Design Tokens — `src/appConstants.js`

All colors, spacing shortcuts, and utility functions (`btn`, `inp`, `card`, `fmtC`, `fmtD`, `scoreColor`, `scoreLabel`) live here. Import from `appConstants.js`, not inline. The palette objects are `C` (raw colors) and `K` (semantic aliases).

### Edge Functions — `supabase/functions/`

Deno-based. Three functions: `ai-proxy` (routes AI calls, holds API keys), `get-top-auctions` (returns top 3 scored leads), `notificar-leilao` (auction deadline alerts), `scrape-auctions` (automated lead scraping). Deploy with Supabase CLI (`supabase functions deploy <name>`).

### PDF / Export

`ExportarPDF.jsx` generates an interactive HTML report (not a native PDF). `GerarPDFProfissional.jsx` uses jsPDF + jspdf-autotable. `ExportarDecisaoPDF.jsx` exports the pre-auction decision summary.

### Key Architectural Constraint

`Detail.jsx` is the main property analysis view and imports nearly every analysis component. It uses `ReformaProvider`/`useReforma` context for renovation state. When adding a new analysis panel, register it inside `Detail.jsx` as a lazy import where appropriate.
