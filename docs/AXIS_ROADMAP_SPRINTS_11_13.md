# AXIS IP — Roadmap Sprints 11-13 (baseado na análise Leilão Ninja)

**Data:** 06/04/2026 | **Fonte:** Extração completa DOM Ninja (152K chars)

---

## VALIDAÇÃO CRUZADA FINAL

| Métrica | AXIS | Ninja | Veredito |
|---------|------|-------|----------|
| Avaliação | R$ 725.000 | R$ 725.000 | ✅ Idêntico |
| Lance mínimo | R$ 543.750 | R$ 543.750 | ✅ Idêntico |
| Valor mercado | R$ 821.142 | R$ 787.500 | ⚠️ AXIS +4% (usa área total, Ninja usa construída) |
| R$/m² | R$ 3.800 | R$ 4.500 | ⚠️ Bases diferentes (total vs construída) |
| Desconto s/ mercado | 33,8% | 31% | ⚠️ Decorre do valor mercado |
| Comissão | 5% | 5% | ✅ Idêntico |
| ITBI | 3% | 3% | ✅ Idêntico |
| Praça | 2ª (08/04) | 1ª (08/04) | ✅ **AXIS CORRETO** — edital confirma 2ª praça |
| Processos | 3 indisponibilidades | 3 únicos (inflados pra 7 com duplicatas) | ✅ AXIS mais preciso |
| Ocupação | Incerta | Não informado | ✅ Concordam |
| Financiável | Não | Não | ✅ Concordam |
| Aluguel | R$ 3.627/mês | R$ 3.000 (média bairro) | ⚠️ AXIS específico, Ninja genérico |
| Score | 5,97/10 | 4,4/10 (IPL) | Metodologias distintas |

**AXIS supera Ninja em:** Praça correta, matrícula identificada, endereço completo, exequente/executado, quantificação de riscos em R$, alertas com severidade.
**Ninja supera AXIS em:** Breakdown financeiro, preditor concorrência, timeline matrícula, mapa, comparáveis, condomínio, UI/UX.

---

## FEATURES PRIORIZADAS — 14 melhorias em 3 sprints

### SPRINT 11 — Quick Wins (impacto alto, esforço baixo)

| # | Feature | Impacto | Esforço | Descrição |
|---|---------|---------|---------|-----------|
| 11.1 | **Breakdown de custos** | 🔴 Alto | 🟢 Fácil | Exibir comissão 5%, ITBI 3%, doc 5% separadamente + investimento total. Dados já existem em constants.js |
| 11.2 | **ROI automático** | 🔴 Alto | 🟢 Fácil | ROI = (Mercado - Investimento) / Investimento. Cenários: sem reforma, básica, completa |
| 11.3 | **Área construída como base** | 🔴 Alto | 🟢 Fácil | Campo `area_construida_m2` no banco, usar pra R$/m². Fix metodológico crítico |
| 11.4 | **Fix praça vs num_leilao** | 🟡 Médio | 🟢 Fácil | Campo `praca` (1 ou 2), exibir "2ª PRAÇA" em vez de "55º LEILÃO" |
| 11.5 | **Campos do imóvel faltantes** | 🟡 Médio | 🟢 Fácil | `banheiros`, `elevador`, `nome_condominio`, `distribuicao_pavimentos` |
| 11.6 | **Calendário exportável** | 🟡 Médio | 🟢 Fácil | Botão "Adicionar ao Calendário" (Google/Outlook/.ics) com data do leilão |

### SPRINT 12 — Features Competitivas (impacto alto, esforço médio)

| # | Feature | Impacto | Esforço | Descrição |
|---|---------|---------|---------|-----------|
| 12.1 | **Preditor de Concorrência** | 🔴 Alto | 🟡 Médio | Calcular lances até cada ROI (20%, 10%, 0%). Slider interativo. Fórmula do Ninja já documentada |
| 12.2 | **Timeline da Matrícula** | 🔴 Alto | 🟡 Médio | Parsear atos do RGI, timeline visual. Ninja mostra desde 1990 — diferencial enorme |
| 12.3 | **Análise financeira editável** | 🟡 Médio | 🟡 Médio | Usuário edita lance, custos, reforma. Recalcula ROI ao vivo. Ninja tem campos editáveis |
| 12.4 | **Comparáveis de mercado** | 🔴 Alto | 🟡 Médio | Buscar 3-5 imóveis no ZAP/VivaReal, exibir tabela filtrável com preço/área/quartos |

### SPRINT 13 — Diferenciação (impacto médio-alto, esforço alto)

| # | Feature | Impacto | Esforço | Descrição |
|---|---------|---------|---------|-----------|
| 13.1 | **Mapa de entorno** | 🟡 Médio | 🔴 Difícil | Leaflet + Overpass API. 11 categorias (farmácia, metrô, escola...). Raio configurável |
| 13.2 | **Análise IA do bairro** | 🟡 Médio | 🟡 Médio | Texto gerado sobre o bairro com dados reais (aluguel, compra, infraestrutura) |
| 13.3 | **Extração edital por IA** | 🔴 Alto | 🟡 Médio | Extrair automaticamente: parcelamento, coproprietários, condições de pagamento |
| 13.4 | **Cenários de saída** | 🟡 Médio | 🟢 Fácil | Venda mercado / Venda rápida (-10%) / Locação. NPV e payback por cenário |

---

## FÓRMULAS DOCUMENTADAS DO NINJA (pra replicar)

### IPL Score (0-10)
```
Margem (max 6 pts) = ((valorMercado - lance) / valorMercado) × 6
Risco (max 3 pts)  = 3 - penalizações (processos, ocupação, dívidas)
Oportunidade (1 pt) = desconto > 40% → 1 | 20-40% → 0.5 | <20% → 0
IPL = Margem + Risco + Oportunidade
```

### Preditor de Concorrência
```
Para cada ROI alvo (100%, 50%, 30%, 20%, 10%, 0%):
  investMax = valorBase / (1 + ROI/100)
  lanceMax = investMax - custos - dívidas
  numLances = floor((lanceMax - lanceMin) / incremento)
  lanceAtual = lanceMin + (numLances × incremento)
  roiReal = (valorBase - investAtual) / investAtual × 100
```

### Valor de Mercado
```
valorMercado = R$/m² × areaConstruida
R$/m² = média de portais (ZAP, OLX, VivaReal, QuintoAndar, ImovelWeb)
Cenários: Realista (±0%) | Otimista (+15%) | Rápido (-10%)
```

### Custos Padrão
```
comissao = lance × 5%
itbi = lance × 3%
documentacao = lance × 5%
totalCustos = comissao + itbi + documentacao (= 13% do lance)
investimentoTotal = lance + totalCustos
```

---

## STACK TÉCNICA DO NINJA (referência)

- **Frontend:** HTML/CSS/JS vanilla + Tailwind + Chart.js
- **Mapa:** Leaflet.js + CartoDB tiles + ESRI Satellite
- **Locais próximos:** Overpass API (OpenStreetMap) com cache local
- **IA:** GPT com busca em tempo real (11 fontes) + Pinecone (RAG por imóvel)
- **PDF Export:** Backend (puppeteer-like) + fallback html2canvas/jsPDF
- **Monetização:** Hotmart (R$ 97/mês ou R$ 797/ano)
- **Dados processuais:** Parceria "Processo Rápido" (serviço pago por consulta)

---

## VANTAGENS COMPETITIVAS AXIS A PRESERVAR

1. **Quantificação de riscos em R$** — Ninja não faz. AXIS estima R$100k sub-rogação, R$20k ocupação, R$50k gravames
2. **Scores 6D desagregados** — Localização, Desconto, Jurídico, Ocupação, Liquidez, Mercado. Ninja tem apenas IPL (3 componentes)
3. **Identificação de matrícula e partes** — Ninja lista "Não informado"; AXIS tem 633.865, 4º RI BH
4. **Alertas com prazo** — "Certidão máx 48h antes do leilão" é acionável
5. **Classificação de praça correta** — Ninja erra neste caso (1ª vs 2ª)
6. **Custo por análise ~R$ 0,01** — Ninja cobra R$ 97/mês. AXIS usa Gemini Flash a custo marginal
7. **Pipeline multi-agente** — 6 agentes especializados, escalável pra centenas de imóveis
