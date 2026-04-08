# AXIS IP — Análise de Causa Raiz: MG-007
**Data:** 07/04/2026 · **Gravidade:** Alta

---

## O QUE DEU ERRADO

O imóvel MG-007 (Buritis, BH) tinha dados corretos populados manualmente no banco.
Ao clicar "Reanalisar (Gemini)", TODOS os dados corretos foram sobrescritos por chutes do Gemini.

| Campo | Dado correto (banco) | Gemini sobrescreveu com | Problema |
|-------|---------------------|------------------------|----------|
| Bairro | Buritis | Santa Efigênia | INVENTADO |
| Quartos | 2 | 3 | INVENTADO |
| Área | desconhecida | 78m² | INVENTADO |
| Lance | R$ 360.000 | R$ 350.000 | ERRADO |
| Nº leilão | 1 | 3024 (ID da URL!) | BUG |
| Data leilão | desconhecida | 2024-07-10 (passado!) | INVENTADO |
| Processo | desconhecido | 0000000-00.00.0000 | PLACEHOLDER |
| Ocupação | Desocupado | incerto | ERRADO |
| Fotos | [] | [] | NÃO EXTRAIU |
| PDFs/Docs | 0 | 0 | NÃO EXTRAIU |
| Scores | — | 5/6 dimensões = 0.0 | SEM DADOS |

---

## 7 CAUSAS RAIZ IDENTIFICADAS

### CAUSA 1: Scraper Cloudflare bypass INSUFICIENTE
**Arquivo:** `scraperImovel.js` linhas 131-195

O fix `X-Wait-For-Selector` adicionado hoje NÃO funciona no tier gratuito do Jina.
O scraper retorna "Just a moment..." ou HTML de challenge. A cascata:
1. Jina markdown → "Just a moment..."
2. Jina HTML → "Just a moment..."  
3. Jina text → "Just a moment..."
4. Google Cache → falha
5. **Resultado: texto praticamente vazio vai pro Gemini**

**Fix necessário:** Implementar headless browser real (Puppeteer/Playwright via Supabase Edge Function ou Browserless.io) como fallback quando Jina falha em domínios Cloudflare.

---

### CAUSA 2: Motor IA (Gemini) INVENTA dados quando scraper falha
**Arquivo:** `motorAnaliseGemini.js` linhas 399-431

Quando o scrape retorna lixo, a função:
- Detecta qualidade ruim (`_scrapeQualidade.ok = false`)
- Adiciona warning ao array de erros
- **MAS CONTINUA NORMALMENTE** e envia o texto lixo pro Gemini
- Gemini recebe "URL do imóvel: https://..." e INVENTA tudo

O prompt do Gemini não diz: "se não conseguir extrair um campo, retorne null".
Em vez disso, Gemini preenche com chutes da sua "base de conhecimento".

**Fix necessário:** 
1. Quando `_scrapeQualidade.ok === false`, o motor deve BUSCAR dados existentes no banco e enviá-los como contexto pro Gemini
2. O prompt deve instruir explicitamente: "Retorne null para qualquer campo que não esteja explícito no texto"
3. Se scrape falhou E não tem dados no banco, ABORTAR a análise com mensagem clara

---

### CAUSA 3: `protegerCampos` NÃO protege contra dados ERRADOS
**Arquivo:** `Detail.jsx` linhas 829-860

A função de merge só protege quando o novo valor é null/0/empty:
```js
if ((novo[campo] === null || novo[campo] === 0 || novo[campo] === '') && original[campo]) {
  merged[campo] = original[campo]  // preserva original
}
```

Quando Gemini retorna `bairro = 'Santa Efigênia'` (errado mas não-null), o merge ACEITA.

Campos NÃO protegidos: `quartos`, `suites`, `area_m2`, `vagas`, `ocupacao`, `praca`, `data_leilao`, `processo_numero`, `nome_condominio`, `elevador`, `salao_festas`.

**Fix necessário:**
1. Expandir `camposCriticos` para incluir TODOS os campos que podem ser populados manualmente
2. Adicionar lógica: "se o dado existente foi populado manualmente (flag), NUNCA sobrescrever com dado de IA"
3. Ou: "se scrape falhou, NÃO sobrescrever NENHUM campo existente no banco"

---

### CAUSA 4: Fotos não extraídas — Cloudflare bloqueia tudo
**Arquivo:** `buscadorFotos.js` + `motorIA.js` linhas 1473-1482

O pipeline de fotos:
1. `buscarFotosImovel(url)` → Jina busca HTML → extrai <img> → Cloudflare bloqueia
2. Fallback `extrairFotosImovel(url)` → mesmo problema
3. **Resultado: `fotos = []`, `foto_principal = null`**

O screenshot do Gabriel mostra uma foto do prédio no site do leiloeiro que poderia ter sido extraída SE o scraper passasse pelo Cloudflare.

**Fix necessário:** Mesmo que Causa 1 — headless browser. Ou: permitir upload manual de fotos na interface.

---

### CAUSA 5: PDFs indisponíveis — sem análise jurídica
**Arquivo:** `AbaJuridicaAgente.jsx`

O leiloeiro Alexandre Pedrosa hospeda editais/matrículas no próprio site (Cloudflare).
Sem acesso ao site, não há como baixar os PDFs automaticamente.
`num_documentos = 0`, `score_viabilidade_docs = null`.

**Fix necessário:** Permitir upload manual de PDFs (arrastar edital/matrícula pro AXIS). O analisador jurídico já funciona com PDFs locais.

---

### CAUSA 6: Score calculado com 5/6 dimensões = 0
**Arquivo:** `motorAnaliseGemini.js`

Score final = 0.82 com: Localização 0, Desconto 0, Jurídico 0, Ocupação 5.5, Liquidez 0, Mercado 0.
A fórmula pondera: 0×20% + 0×18% + 0×18% + 5.5×15% + 0×15% + 0×14% = 0.825.

Score deveria mostrar "N/A — dados insuficientes" quando ≥4 dimensões são 0.

**Fix necessário:** Guard no cálculo: se mais de 3 dimensões = 0, setar score = null e recomendacao = null.

---

### CAUSA 7: Relatório exportado reflete dados errados
**Arquivo:** `ExportarPDF.jsx`

O relatório usa os dados do banco tal como estão. Como a análise sobrescreveu dados corretos com chutes, o relatório ficou:
- Bairro errado (Santa Efigênia)
- Quartos errado (3)
- Processo placeholder
- Score 0.82 sem sentido
- Síntese genérica sem dados reais

**Fix:** Não é no ExportarPDF — o problema é upstream (causas 1-6).

---

## PRIORIZAÇÃO DOS FIXES

### Sprint 15 — URGENTE
| # | Fix | Esforço | Impacto |
|---|-----|---------|---------|
| 1 | Motor IA: usar dados existentes do banco como contexto quando scrape falha | Médio | 🔴 Crítico |
| 2 | Motor IA: abortar análise se scrape falha E banco vazio | Fácil | 🔴 Crítico |
| 3 | Prompt Gemini: "retorne null, não invente" | Fácil | 🔴 Crítico |
| 4 | protegerCampos: expandir lista + flag "dado manual" | Médio | 🔴 Crítico |
| 5 | Score: N/A quando ≥4 dimensões = 0 | Fácil | 🟡 Alto |

### Sprint 16 — IMPORTANTE  
| # | Fix | Esforço | Impacto |
|---|-----|---------|---------|
| 6 | Upload manual de fotos na interface | Médio | 🟡 Alto |
| 7 | Upload manual de PDFs (edital/matrícula) | Médio | 🟡 Alto |
| 8 | Headless browser (Puppeteer Edge Function) como fallback Cloudflare | Alto | 🟡 Alto |

### Sprint 17 — DESEJÁVEL
| # | Fix | Esforço | Impacto |
|---|-----|---------|---------|
| 9 | Indicador visual "dados manuais" vs "dados IA" no Detail | Médio | 🟢 Médio |
| 10 | Log de auditoria: quem alterou cada campo e quando | Alto | 🟢 Médio |
