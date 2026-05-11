# AXIS IP — Diagnóstico Sistêmico Sprint 46

Auditor: Claude Code (claude-sonnet-4-6) | Data: 2026-05-11 | Commit base: b422b9177a7b3b94b8216fa3c80adda784ac19d4

---

## Sumário executivo

- Achados P0: 5
- Achados P1: 8
- Achados P2: 9
- Achados P3: 6
- **Total de achados: 28**

**Áreas de maior risco (top 3):**
1. **Segurança** — API keys de providers passadas do `localStorage` direto para chamadas `fetch()` ao browser (8 arquivos), contornando o proxy seguro implantado no Sprint 18. Um usuário autenticado com as chaves em localStorage tem os segredos expostos nas DevTools e em qualquer XSS.
2. **Integridade financeira** — `roi_estimado = 94.0` e `roi_liquido_oficial = 38.9` coexistem para MG-007 sem reconciliação automatizada. `cenario_oficial` existe apenas para 1/5 imóveis. As 4 funções paralelas de cálculo de ROI produzem valores distintos para o mesmo lance — sem arbitragem canônica por código.
3. **Ausência de Edge Function `ai-proxy`** — `aiProxy.js` chama `SUPABASE_URL/functions/v1/ai-proxy`, mas o diretório `supabase/functions/ai-proxy/` não existe no repositório. A integração está quebrada em produção ou o arquivo foi deployado manualmente e perdeu o versionamento.

**Recomendação de sequência:** Sprint 46 deve focar em (1) fechar o buraco de segurança das chaves em localStorage, (2) criar o diretório da Edge Function `ai-proxy` com código commitado, (3) aplicar migração `cenario_oficial` retroativa para os 4 imóveis restantes com valores calculados pelo backend. Só depois abordar refatorações de porte (Detail.jsx, motorIA.js).

---

## Anexo A — Reconhecimento

```
node: v22.22.2 | npm: 10.9.7
HEAD: b422b9177a7b3b94b8216fa3c80adda784ac19d4 (2026-05-08)
Commits desde 2026-04-01: 50 commits, autor único "AXIS Bot"
Total LoC src/: 32.775 linhas
TODOs/FIXMEs/XXX: 0 (zero marcadores formais)
console.* calls: 222
investimento_total refs: 58 (via grep em src/)
calcularROI refs: 17 (em 6 arquivos distintos)
lanceMaximo/MAO/maoFlip refs: 149
cenario_oficial refs: 4 (apenas em GerarPDFProfissional)
dangerouslySetInnerHTML: não encontrado
service_role no frontend: não encontrado
secrets em código-fonte: não encontrado (keys vêm de localStorage, não hardcoded)
Migrations SQL: 6 arquivos
Edge functions deployadas: get-top-auctions, scrape-auctions, notificar-leilao (3 — falta ai-proxy)
ESLint/Prettier/Husky: nenhum configurado
Testes automatizados: nenhum
CI/CD (.github/workflows): ausente

Build prod: OK — 10.67s, sem erros, sem warnings críticos
Chunks mais pesados (minificado):
  GerarPDFProfissional: 458 kB (jsPDF + autotable embutidos)
  xlsx: 429 kB
  Charts (Recharts): 415 kB
  html2canvas: 201 kB
  index.js (main bundle): 190 kB
  Detail.jsx chunk: 249 kB
  vendor-supabase: 176 kB
  vendor-react: 141 kB
```

---

## Dimensão A — Arquitetura de premissas e cálculos financeiros

### A.1 Inventário de funções de cálculo de ROI/investimento

| Função | Arquivo:Linha | Inputs principais | Usa cenario_oficial | Observação |
|--------|--------------|-------------------|---------------------|------------|
| `calcularROI(investTotal, valorMercado, aluguel)` | `constants.js:526` | investimentoTotal, valorMercado, aluguelMensal | Não | ROI líquido com IRPF, 3 cenários |
| `calcularDadosFinanceiros(lance, imovel, eMercado)` | `constants.js:462` | lance, imovel{}, eMercado | Não | Wrapper canônico para exportadores |
| `calcularBreakdownFinanceiro(lance, imovel, eMercado)` | `constants.js:403` | lance, imovel{} | Não | Breakdown de custos detalhado |
| `calcularCustoTotal(precoBase, isMercado, reforma, ...)` | `constants.js:376` | precoBase, isMercado, reforma, holdingMeses | Não | Inclui holding, sem usar imovel{} |
| `calcularLanceMaximoParaROI(roiAlvo, p, opts)` | `constants.js:930` | roiAlvo, p{} (imovel) | Não | MAO calculado |
| `calcularMatrizInvestimento(p, opts)` | `constants.js:831` | p{} (imovel), opts | Não | 4 cenários de reforma |
| `calcularROISimples(lance, p)` | `ResumoPreLeilao.jsx:14` | lance, p{} | Não | Função LOCAL, duplicata de lógica |
| Derivação direta no PDF | `GerarPDFProfissional.jsx:96,132` | bd, mercado, aluguel | Sim (fallback) | Usa cenario_oficial.lance como entrada |
| `calcular_mao()` (SQL RPC) | DB function | imovel_id | N/A | Duplicata no banco, não usada via UI |
| `calcular_investimento_total()` (SQL RPC) | DB function | imovel_id | N/A | Duplicata no banco |

**Total de caminhos de cálculo independentes identificados: 10**

### A.2 Tabela de convergência MG-007

| Campo no banco | Valor observado | Fonte de escrita |
|----------------|-----------------|------------------|
| `roi_estimado` | 94.0 | motorIA / reanálise IA |
| `roi_liquido_oficial` | 38.9 | Auditoria sprint45 (manual) |
| `investimento_total` | 269.907 | Campo legado (supabase.js IMOVEIS_COLS) |
| `caixa_arrematacao` | 275.700 | cenario_oficial derivado |
| `caixa_projeto` | 337.707 | cenario_oficial derivado |
| `cenario_oficial.lance` | 240.000 | manual_operador |
| `cenario_oficial.reforma_custo` | 57.807 | cenario_oficial |
| `valor_minimo_2` (2ª praça) | 180.000 | edital |
| `lance_maximo_definido` | 240.000 | operador |

**Problema central:** `roi_estimado=94.0` (calculado pelo motorIA sem todos os custos) diverge 2,4× de `roi_liquido_oficial=38.9` (calculado via cenario_oficial com custos completos). Ambos convivem no mesmo registro sem campo de flag indicando qual é canônico. O PDF (Sprint 45) lê `roi_liquido_oficial` somente se existir, caindo para cálculo in-line — mas os painéis de UI (PainelRentabilidade, PainelInvestimento, SimuladorLance) usam `calcularROI()` re-calculado em tempo real, que pode divergir de ambos.

### A.3 Achados

**A-001** [P0] — `roi_estimado` e `roi_liquido_oficial` coexistem sem reconciliação canônica  
- Evidência: MG-007 tem `roi_estimado=94.0` e `roi_liquido_oficial=38.9` (divergência 2,4×). `roi_estimado` é escrito pela IA sem custos completos; `roi_liquido_oficial` é manual. Nenhum trigger nem validação bloqueia a coexistência. Os 4 imóveis restantes não têm `roi_liquido_oficial` nem `cenario_oficial`.  
- Impacto: Usuário pode tomar decisão de lance baseado no ROI errado (94% vs 39%).  
- Esforço estimado: 8h (migração retroativa + trigger de consistência)

**A-002** [P1] — `calcularROISimples` local em `ResumoPreLeilao.jsx:14` duplica lógica de `constants.js`  
- Evidência: `ResumoPreLeilao.jsx:14` define função local que calcula ROI sem todos os custos (ignora reforma, holding, débitos). Chamada em linhas 104, 174, 330.  
- Impacto: Painel pré-leilão exibe ROI diferente dos demais painéis para o mesmo imóvel.  
- Esforço estimado: 3h (substituir por `calcularDadosFinanceiros`)

**A-003** [P1] — `calcular_mao()` e `calcular_investimento_total()` são RPCs no banco jamais chamadas pelo frontend  
- Evidência: Listadas em `information_schema.routines` mas ausentes em qualquer `grep` no código fonte.  
- Impacto: Dívida de manutenção — se os pesos de custo mudarem, as RPCs ficam desatualizadas silenciosamente.  
- Esforço estimado: 2h (documentar ou dropar)

**A-004** [P2] — `HOLDING_MESES_PADRAO=6` em constants.js mas `calcularCustoHolding()` usa `meses=4` como default  
- Evidência: `constants.js:585` — `function calcularCustoHolding(condominio=0, meses=HOLDING_MESES_PADRAO, ...)` — na verdade o JSDoc diz "padrão: 4" e o valor default é `HOLDING_MESES_PADRAO` que é 6. Apenas inconsistência de documentação, mas confunde.  
- Impacto: Baixo — cálculo correto usa a constante.  
- Esforço estimado: 0.5h (corrigir JSDoc)

**A-005** [P2] — `cenario_oficial` sem migration retroativa para imóveis BH-001 a BH-004  
- Evidência: Query Q3 retornou apenas MG-007 com `tem_cenario_oficial=true`. Os outros 4 registros ativos não têm o campo (NULL). O PDF usará fallback legacy para eles.  
- Impacto: Relatórios PDF inconsistentes dependendo do imóvel.  
- Esforço estimado: 4h (script de backfill + migration)

---

## Dimensão B — Schema do banco

### B.1 Tabelas (colunas e linhas)

| Tabela | Colunas | Linhas |
|--------|---------|--------|
| imoveis | **217** | 8 |
| analises_leilao | 67 | 3 |
| documentos_juridicos | 33 | 9 |
| arremates_historico | 32 | 4 |
| metricas_bairros | 32 | 32 |
| auction_leads | 16 | 114 |
| itens_reforma | 16 | 27 |
| itens_reforma_historico | 16 | 27 |
| tarefas | 12 | 0 |
| api_usage_log | 12 | 61 |
| riscos_juridicos | 12 | 15 |
| riscos_juridicos_config | 11 | 15 |
| agent_logs | 11 | 5 |
| taxas_financiamento | 10 | 6 |
| jurimetria_varas | 10 | 6 |
| mercado_regional | 10 | 16 |
| agent_health | 8 | 108 |
| scraper_debug | 11 | 98 |
| shared_links | 7 | 3 |
| riscos_imovel | 7 | 13 |
| avaliacoes_imovel | 6 | 9 |
| profiles | 6 | 6 |

Demais tabelas com 0-5 colunas ou 0-5 linhas omitidas por brevidade.

### B.2 Colunas financeiras chave na tabela imoveis

| Coluna | Tipo | Nullable |
|--------|------|----------|
| cenario_oficial | jsonb | YES |
| caixa_arrematacao | numeric | YES |
| caixa_projeto | numeric | YES |
| roi_estimado | numeric | YES |
| roi_liquido_oficial | numeric | YES |
| investimento_total | numeric | YES |
| notas_privadas | text | YES |
| status_operacional | text | YES |
| campos_travados | jsonb | YES |

Colunas `yield_estimado`, `lance_maximo_recomendado`, `preco_minimo_1` não existem no banco (queries retornaram erro 42703). Referências no código a `yield_estimado` são leituras defensivas (retornam null).

### B.3 Colunas não usadas ou candidatas a limpeza

- `imoveis` tem 217 colunas para 8 linhas. A whitelist `IMOVEIS_COLS` em `supabase.js:134` tem ~160 entradas, indicando ~57 colunas no banco não refletidas no código de escrita.
- `tarefas`: 0 linhas, feature não implementada na prática (confirmado em CLAUDE.md).
- `trello_sync_log`: 0 linhas.
- `rate_limit_log`: 0 linhas — funcionalidade de rate limit implementada no banco mas não chamada.

### B.4 RLS Coverage

Todas as 44 tabelas públicas têm RLS ativado. Cobertura completa de policies. Destaques:

- `arremates_historico`: policy UPDATE com `qual=true` — qualquer usuário autenticado pode atualizar qualquer arremate histórico. [VERIFICAR] se intencional.
- `cache_mercado`: policy ALL com `with_check=true` — qualquer autenticado pode escrever no cache.
- `metricas_bairros`: policy ALL para `authenticated` — qualquer usuário pode modificar métricas de bairro.
- `atividades`: leitura pública (`qual=true`) — todas as atividades de todos os usuários são visíveis.

### B.5 Triggers em `imoveis` (11 triggers)

| Trigger | Evento | Quando | Função |
|---------|--------|--------|--------|
| `on_imovel_insert_codigo` | INSERT | BEFORE | `trigger_gerar_codigo()` |
| `trg_sync_area_usada_calculo` | INSERT, UPDATE | BEFORE | `fn_sync_area_usada_calculo()` |
| `trg_sanitizar_placeholders` | INSERT, UPDATE | BEFORE | `fn_sanitizar_placeholders()` |
| `trg_validar_imovel` | INSERT, UPDATE | BEFORE | `validar_imovel_antes_salvar()` |
| `trg_proteger_campos_travados` | UPDATE | BEFORE | `fn_proteger_campos_travados()` |
| `trg_atualizar_motor_ia_usado` | INSERT, UPDATE | BEFORE | `trg_atualizar_motor_ia_usado()` |
| `trg_capturar_snapshot_ia` | INSERT, UPDATE | BEFORE | `trg_capturar_snapshot_ia()` |
| `trg_log_atividade_imovel` | INSERT, UPDATE, DELETE | AFTER | `log_atividade_imovel()` |
| `auditoria_qualidade_imoveis` | INSERT, UPDATE | AFTER | `trigger_auditoria_qualidade()` |
| `trg_alertar_mercado_nao_rodou` | INSERT, UPDATE | AFTER | `trg_alertar_mercado_nao_rodou()` |
| `trg_detectar_drift_ia` | UPDATE | AFTER | `trg_detectar_drift_ia()` |

**Observação:** Há duplicação de proteção de campos travados: o trigger `trg_proteger_campos_travados` (banco) e o código JS em `saveImovelCompleto()` (frontend, supabase.js:337-346). Em caso de conflito de lógica, o trigger tem precedência sobre o código JS, mas ambos precisam ser mantidos em sincronia.

### B.6 Índices

Cobertura de índices adequada para as queries principais. Índices notáveis:
- `idx_imoveis_score_total`, `idx_imoveis_status_score` — cobrem queries de dashboard.
- `idx_imoveis_fonte_url` — cobre deduplicação de URL.
- `idx_arremates_dedup` — unique parcial com filtro `origem_busca='busca_gpt'`.

Não há índice em `imoveis.status_operacional` isolado — queries `.or('status_operacional.eq.ativo,status_operacional.is.null')` fazem scan com filtro. Com 8 linhas é irrelevante, mas crescerá.

### B.7 JSONB — schemas observados

`cenario_oficial` (MG-007) contém: `lance`, `praca`, `itbi_pct`, `admin_pct`, `definido_em`, `iptu_mensal`, `irpf_isento`, `advogado_pct`, `condo_mensal`, `definido_por`, `doc_registro`, `ir_lucro_pct`, `lance_origem`, `vacancia_pct`, `holding_meses`, `reforma_custo`, `corretagem_pct`, `manutencao_pct`, `reforma_escopo`, `fator_valorizacao`, `debitos_arrematante`, `valor_venda_estimado`, `comissao_leiloeiro_pct`.

`admin_pct=8.0` presente em `cenario_oficial` mas ausente de `CUSTOS_LEILAO` em `constants.js` e de `calcularBreakdownFinanceiro()` — campo fantasma sem consumidor conhecido.

### B.8 Achados

**B-001** [P1] — Campo `admin_pct=8.0` em `cenario_oficial` sem correspondente em constants.js  
- Evidência: Query Q12 — `cenario_oficial` de MG-007 tem `admin_pct: 8.0`. `CUSTOS_LEILAO` em `constants.js:120` não tem esse campo. `calcularBreakdownFinanceiro` não consome `admin_pct`.  
- Impacto: Se for uma taxa real de administração (cartório/leiloeiro extra), o ROI de 38.9% está supercalculado.  
- Esforço estimado: 2h (clarificar origem + adicionar ao breakdown se necessário)

**B-002** [P2] — `atividades` expõe todas as atividades de todos os usuários  
- Evidência: Policy `atividades_leitura` tem `qual=true` (sem filtro de usuário).  
- Impacto: Usuário A pode ver log de análises e ações do usuário B.  
- Esforço estimado: 1h (adicionar `user_id = auth.uid()` na policy SELECT)

**B-003** [P2] — Duplicação de proteção campos travados: trigger + código JS  
- Evidência: `supabase.js:337-346` + trigger `trg_proteger_campos_travados`. Divergência de lógica entre os dois = comportamento imprevisível.  
- Esforço estimado: 4h (consolidar no trigger, remover do JS)

**B-004** [P3] — `imoveis` com 217 colunas para 8 linhas — schema overloaded  
- Evidência: Q1. IMOVEIS_COLS whitelist em supabase.js tem ~160 entradas.  
- Impacto: Manutenibilidade. Cada migration precisa verificar todos os 160+ campos.  
- Esforço estimado: 16h (análise e normalização — sprint dedicado)

---

## Dimensão C — Frontend: componentes e duplicações

### C.1 Top 10 componentes por LoC

| Componente | LoC |
|------------|-----|
| Detail.jsx | 2.527 |
| AbaJuridicaAgente.jsx | 1.026 |
| ManualAxis.jsx | 1.071 |
| GerarPDFProfissional.jsx | 810 |
| ExportarPDF.jsx | 682 |
| Dashboard.jsx | 643 |
| CenariosReforma.jsx | 530 |
| PainelLancamento.jsx | 447 |
| PainelRentabilidade.jsx | 434 |
| ExportarResumoSimples.jsx | 433 |

### C.2 Componentes com apenas 1 importador (risco de órfão)

| Componente | Importadores |
|------------|-------------|
| AtributosPredio | 1 |
| ExportarExcel | 1 |
| GerarPDFProfissional | 1 |
| PainelAdmin | 1 |
| RelatorioCarteiraHTML | 1 |

Todos importados apenas por `Detail.jsx` ou `App.jsx`. Não são verdadeiramente órfãos — são folhas da árvore. `AtributosPredio` foi mencionado como "removido" em sprint41d mas ainda existe com 1 importador ativo.

### C.3 localStorage com chaves de API

Evidência em `App.jsx:496-615`: chaves `axis-api-key` (Claude), `axis-openai-key`, `axis-gemini-key`, `axis-deepseek-key`, `axis-trello-key` são lidas do `localStorage` e passadas diretamente para `fetch()` calls em `motorIA.js`, `analisadorJuridico.js`, `buscaArrematesGPT.js`, `documentosPDF.js` etc.

A coluna `app_settings` com `carregar_keys_seguro()` RPC existe no banco para armazenamento server-side, e `aiProxy.js` implementa a chamada via Edge Function — mas as chamadas diretas ao browser ainda dominam o codebase (ver Dimensão E).

### C.4 useMemo/useCallback

Apenas 48 ocorrências em todo o projeto (`grep`). `Detail.jsx` (2.527 linhas) tem múltiplos `useState` e cálculos inline sem memoização, forçando re-renders completos em qualquer mudança de estado.

### C.5 Achados

**C-001** [P1] — Detail.jsx com 2.527 linhas — Deus-componente sem separação de concerns  
- Evidência: 2.527 linhas (wc -l), importa 30+ componentes e libs. Contém lógica de negócio, UI, handlers de evento e integrações.  
- Impacto: Qualquer mudança tem alto risco de regressão. Tempo de build do chunk `Detail` = 249 kB.  
- Esforço estimado: 24h (split incremental por aba/seção)

**C-002** [P2] — 48 useMemo/useCallback para 32.775 LoC — memoização insuficiente  
- Evidência: `grep -rEn "useMemo|useCallback" src/ | wc -l` = 48.  
- Impacto: Re-renders desnecessários em listas de imóveis e cálculos financeiros repetitivos.  
- Esforço estimado: 8h (auditoria de dependências + memoizar hot paths)

---

## Dimensão D — Gerador de PDF

### D.1 Mapa das páginas (GerarPDFProfissional.jsx)

| Seção | Fonte de dados | Usa cenario_oficial |
|-------|---------------|---------------------|
| Capa — lance e ROI | `p.cenario_oficial?.lance` → fallback `p.lance_maximo_definido` → `lance` | Sim (Sprint 45) |
| Capa — caixa dia D | `p.caixa_arrematacao` → fallback `lanceCapa + bd.totalCustos` | Indiretamente |
| Capa — caixa total | `p.caixa_projeto` → fallback `bd.investimentoTotal` | Indiretamente |
| ROI líquido capa | `parseFloat(p.roi_liquido_oficial)` (sem fallback) | Sim |
| Breakdown financeiro | `calcularBreakdownFinanceiro(lance, p)` recalculado | Não |
| ROI realista | `calcularROI(bd.investimentoTotal, mercado, aluguel)` | Não |
| ROI 2ª praça | `calcularROI(bd2p.investimentoTotal, ...)` | Não |

**Problema detectado:** A capa lê `p.roi_liquido_oficial` diretamente do banco (linha 229), mas os boxes de ROI nas páginas internas recalculam via `calcularROI()`. Se `roi_liquido_oficial` não existir (4 imóveis), a capa mostra "—" enquanto as páginas internas mostram um valor calculado — relatório internamente inconsistente.

### D.2 Magic numbers identificados

| Linha | Valor | Contexto | Constante nomeada? |
|-------|-------|----------|--------------------|
| GerarPDFProfissional.jsx:96 | `0.94` | corretagem implícita (1 - 0.06) | Não — deveria usar `CUSTOS_LEILAO.corretagem_venda_pct` |
| constants.js:473 | `0.06` (CORRETAGEM_VENDA) | hardcoded inline em calcularDadosFinanceiros | Parcialmente — existe em CUSTOS_LEILAO mas não importado |
| constants.js:537 | `0.06` | hardcoded inline em calcularROI | Mesmo problema |
| constants.js:949 | `0.94` | hardcoded em calcularLanceMaximoParaROI | Idem |
| constants.js:884 | `0.94` | hardcoded em calcularMatrizInvestimento | Idem |

`0.06` (corretagem de venda) aparece 4× hardcoded dentro das próprias funções de `constants.js`, apesar de `CUSTOS_LEILAO.corretagem_venda_pct = 6.0` existir na mesma linha 126.

### D.3 validarRelatorioPreGeracao — existe?

**AUSENTE.** Nenhum arquivo `validarRelatorio.js` encontrado. Nenhuma função `validarRelatorioPreGeracao` encontrada em nenhum arquivo. O PDF pode ser gerado com dados incompletos (ex: sem `roi_liquido_oficial`, sem `cenario_oficial`) sem nenhum bloqueio ou aviso ao usuário.

### D.4 EditorCenarioOficial — existe?

**AUSENTE.** Nenhum arquivo `EditorCenarioOficial.jsx` encontrado. A edição do `cenario_oficial` foi feita manualmente via SQL (conforme commit do sprint45), sem UI dedicada. Operadores não têm como criar/editar o cenário oficial de outros imóveis pela interface.

### D.5 Achados

**D-001** [P0] — PDF gerado sem validação prévia — dados incompletos produzem relatório inconsistente  
- Evidência: Ausência de `validarRelatorioPreGeracao` + MG-007 é único imóvel com `roi_liquido_oficial`. Para os demais, a capa do PDF mostra "—" no campo ROI enquanto as páginas internas mostram valor calculado.  
- Impacto: Relatório entregue a investidores com inconsistência direta entre capa e conteúdo.  
- Esforço estimado: 4h (função de validação + modal de aviso pré-geração)

**D-002** [P1] — EditorCenarioOficial ausente — operadores sem acesso para preencher cenário canônico  
- Evidência: Arquivo ausente. `cenario_oficial` de MG-007 foi preenchido via SQL direto no banco.  
- Impacto: A feature de cenário oficial é inutilizável sem acesso direto ao banco, bloqueando adoção.  
- Esforço estimado: 8h (UI de criação/edição do cenário + integração com saveImovelCompleto)

**D-003** [P2] — Corretagem de venda (6%) hardcoded 4× dentro de constants.js  
- Evidência: `constants.js:473,537,884,949` — `0.06` literal, apesar de `CUSTOS_LEILAO.corretagem_venda_pct=6.0` existir.  
- Impacto: Mudar a corretagem exige editar 4 locais + o objeto `CUSTOS_LEILAO`. Risco de inconsistência.  
- Esforço estimado: 1h (extrair constante `CORRETAGEM_VENDA_PCT` e referenciar)

---

## Dimensão E — Cascade IA e Edge Functions

### E.1 Agentes e motores

| Arquivo | Provedor primário | Fallback | Circuit breaker | Usa aiProxy |
|---------|------------------|----------|-----------------|-------------|
| motorIA.js | Claude (fetch direto) | DeepSeek (fetch direto) | Parcial (apenas em motorAnaliseGemini) | Não |
| motorAnaliseGemini.js | Gemini (via chamarGeminiCascata) | DeepSeek → GPT-4o-mini | Sim (`withCircuitBreaker`) | Não |
| agenteJuridico.js | Claude (fetch direto) | — | Não | Não (linha 431) |
| analisadorJuridico.js | Claude/GPT-4o (fetch direto) | Ambos | Não | Não |
| documentosPDF.js | Claude (fetch direto) | GPT-4o | Não | Não |
| buscaArrematesGPT.js | GPT-4o (fetch direto) | — | Não | Não |
| agenteHealthCheck.js | DeepSeek/GPT/Claude (fetch direto) | — | N/A (teste) | Não |
| AbaDiagnostico.jsx | Gemini/DeepSeek/GPT/Claude (fetch direto) | — | N/A (teste) | Não |
| aiProxy.js | Edge Function (JWT) | — | — | É o proxy |

### E.2 Chamadas diretas a providers (bypassam aiProxy)

18 chamadas diretas `fetch()` a APIs externas identificadas:

- `anthropic.com/v1/messages`: `analisadorJuridico.js:72,203`, `agenteJuridico.js:431`, `documentosPDF.js:221`, `analisadorDocumentos.js:22`, `motorIA.js:654,1143`, `agenteHealthCheck.js:103`
- `openai.com/v1/chat/completions`: `AbaDiagnostico.jsx:110`, `BuscaGPT.jsx:82`, `agenteHealthCheck.js:79`, `analisadorJuridico.js:132`, `motorAnaliseGemini.js:901`, `buscaArrematesGPT.js:53`, `documentosPDF.js:533`, `motorIA.js:362`
- `generativelanguage.googleapis.com`: `AbaDiagnostico.jsx:77` (+ via `chamarGeminiCascata` em constants.js)

**Conclusão:** O `aiProxy.js` existe e está bem estruturado, mas nenhum dos módulos principais de análise o utiliza. As chaves ficam expostas no browser do usuário.

### E.3 Edge Function `ai-proxy` — ausente do repositório

**Evidência crítica:** `supabase/functions/` contém apenas `get-top-auctions/`, `notificar-leilao/`, `scrape-auctions/`. O diretório `ai-proxy/` não existe. O código em `aiProxy.js` aponta para `SUPABASE_URL/functions/v1/ai-proxy`, que não tem código versionado.

Possibilidades: (a) foi deployado manualmente sem commit e funciona em produção; (b) nunca foi deployado e as chamadas via `aiProxy.js` falham silenciosamente (os módulos principais não usam `aiProxy.js` de qualquer forma).

### E.4 Modelos referenciados no código

| Modelo | Status | Observação |
|--------|--------|------------|
| gemini-2.5-flash | Ativo | Tier 1 primário |
| gemini-2.5-flash-lite | Ativo | Fallback de custo |
| gemini-2.0-flash | Ativo (desliga jun/2026) | Alerta em constants.js:171 |
| gemini-2.5-pro | Ativo | Usado em MODELOS_GEMINI_PRO |
| deepseek-chat | Ativo | DeepSeek V3 |
| gpt-4o-mini | Ativo | Research de mercado |
| gpt-4o | Ativo | Fallback complexo |
| claude-sonnet-4-20250514 | Ativo | Análise jurídica |
| claude-haiku-4-5-20251001 | Ativo | Health check, velocidade |

`AbaGastosAPI.jsx:10-11` referencia `gemini-2.0-flash` e `gemini-2.0-flash-lite` no mapa de custos, mas esses não são os modelos primários. Pode causar discrepância no tracking de custos se o modelo real for `gemini-2.5-flash`.

### E.5 agent_health — usage

| Provedor | Pings | Último ping |
|----------|-------|-------------|
| scraper-megaleiloes | 28 | 2026-05-11 18:00 (hoje) |
| scraper-caixa | 28 | 2026-05-11 18:00 (hoje) |
| scraper-leilaoimovel | 28 | 2026-05-11 18:00 (hoje) |
| gemini | 6 | 2026-05-10 20:58 |
| claude | 6 | 2026-05-10 20:58 |
| gpt | 6 | 2026-05-10 20:58 |
| deepseek | 6 | 2026-05-10 20:58 |

Scrapers têm 28 pings (cron diário ativo). Provedores de IA têm apenas 6 pings — health check de IA não está rodando regularmente. O cron `vercel.json` aponta para `/api/healthcheck` que tem `maxDuration=30s`, mas o diretório `/api/` não existe no repositório.

### E.6 Achados

**E-001** [P0] — Edge Function `ai-proxy` não está commitada no repositório  
- Evidência: `ls supabase/functions/` — diretório `ai-proxy/` ausente. `aiProxy.js` chama endpoint que pode não existir em produção.  
- Impacto: Feature de proxy seguro (Sprint 18) pode estar silenciosamente quebrada.  
- Esforço estimado: 4h (criar `supabase/functions/ai-proxy/index.ts` + commit + deploy)

**E-002** [P0] — API keys de providers passadas via localStorage ao browser em 18 call sites  
- Evidência: `App.jsx:496-615` armazena chaves. `motorIA.js:362,654,1143`, `analisadorJuridico.js:72,132,203`, `agenteJuridico.js:431`, `documentosPDF.js:221,533`, `buscaArrematesGPT.js:53`, etc. Total: 18 call sites.  
- Impacto: Qualquer extensão maliciosa, XSS ou snapshot de DevTools expõe todas as chaves de API dos usuários. Viola OWASP A02:2021 (Cryptographic Failures).  
- Esforço estimado: 16h (migrar todos os call sites para `aiProxy` + garantir Edge Function deployada)

**E-003** [P1] — `gemini-2.0-flash` deprecação em jun/2026 — 4 semanas  
- Evidência: `constants.js:171` — `// fallback — desliga jun/2026`. `MODELOS_GEMINI` inclui o modelo como fallback de tier 3.  
- Impacto: Cascata pode falhar silenciosamente a partir de jun/2026 se 2.5-flash e 2.5-flash-lite também falharem.  
- Esforço estimado: 1h (remover da lista ou substituir por 2.0-flash-exp)

**E-004** [P2] — Circuit breaker só cobre motorAnaliseGemini; motorIA.js e outros sem proteção  
- Evidência: `motorIA.js:362,654` — chamadas diretas sem `withCircuitBreaker`. Se Claude falhar, a função inteira trava pelo timeout (sem fallback automático).  
- Esforço estimado: 6h (envolver todos os call sites críticos com `withCircuitBreaker`)

**E-005** [P2] — `/api/healthcheck.js` referenciado em `vercel.json` mas não existe no repositório  
- Evidência: `vercel.json:3` aponta `path=/api/healthcheck`. `find src/ api/ -name healthcheck*` — ausente.  
- Impacto: Cron de health check falha silenciosamente toda segunda-feira às 11h.  
- Esforço estimado: 2h (criar `api/healthcheck.js` ou remover do vercel.json)

---

## Dimensão F — Segurança

### F.1 Secrets em config files

Nenhum secret hardcoded encontrado no código-fonte. `.env` não existe no repositório (apenas `.env.example`). `supabase/config.toml` não contém chaves.

`supabase/functions/scrape-auctions/index.ts:4` usa `SUPABASE_SERVICE_ROLE_KEY` via `Deno.env.get()` — correto, key carregada pelo runtime Supabase, não commitada.

### F.2 API keys no browser — análise detalhada

Fluxo atual: `app_settings` (banco, com RLS) → `loadApiKeys()` → retorna ao frontend → armazena em `localStorage` → passado para `fetch()` diretamente.

O campo `app_settings.chave = 'api_keys_<user_id>'` tem policy de leitura apenas para o próprio usuário + admin — correto. Mas a key sai do banco e vai para o localStorage, onde qualquer script pode acessá-la via `localStorage.getItem('axis-api-key')`.

### F.3 carregar_keys_seguro — análise

RPC `carregar_keys_seguro()` existe no banco. `loadApiKeys()` em `supabase.js` chama essa RPC e retorna as chaves ao frontend. O fluxo é: banco → frontend → localStorage → fetch. A segurança é parcial: protege contra consultas diretas ao banco por usuários não autorizados, mas não protege contra exfiltração via browser (localStorage é acessível a qualquer JS na página).

### F.4 Achados

**F-001** [P0] — (ver E-002) — API keys dos providers expostas no localStorage  
- Risco adicional: Chaves armazenadas em localStorage sobrevivem ao fechamento da aba e são acessíveis via `window.localStorage` de qualquer script na mesma origem.

**F-002** [P1] — Policy `atividades.leitura` expõe logs de todos os usuários  
- Evidência: `policyname=atividades_leitura`, `qual=true` — sem filtro de user_id.  
- Impacto: Usuário regular pode listar atividades de admin e de outros usuários.  
- Esforço estimado: 1h

**F-003** [P2] — `arremates_historico` UPDATE sem filtro de dono  
- Evidência: Policy `arremates_update`, `qual=true` — qualquer autenticado pode atualizar qualquer registro histórico.  
- Impacto: Integridade de dados históricos comprometida.  
- Esforço estimado: 1h (adicionar filtro `criado_por = auth.uid() OR is_admin()`)

---

## Dimensão G — Performance

### G.1 Bundle size por chunk (top 10 — minificado)

| Chunk | Tamanho | gzip |
|-------|---------|------|
| GerarPDFProfissional | 458 kB | 149 kB |
| xlsx | 429 kB | 143 kB |
| Charts (Recharts) | 415 kB | 112 kB |
| html2canvas | 201 kB | 48 kB |
| index.js (App) | 190 kB | 57 kB |
| Detail.jsx | 249 kB | 66 kB |
| vendor-supabase | 176 kB | 46 kB |
| vendor-react | 141 kB | 45 kB |
| motorIA | 116 kB | 39 kB |
| AbaJuridicaAgente | 59 kB | 17 kB |

**Total gzip acima da fold (App + React + Supabase):** ~148 kB — razoável. O problema é o `GerarPDFProfissional` (149 kB gzip) que é carregado junto com Detail (lazy? [VERIFICAR] — não aparece como lazy no import de Detail.jsx).

### G.2 select('*') em tabelas com potencial de crescimento

| Arquivo | Linha | Tabela |
|---------|-------|--------|
| supabase.js | 79 | profiles |
| supabase.js | 110 | imoveis (fallback path) |
| supabase.js | 476 | parametros_score |
| supabase.js | 611 | convites |
| supabase.js | 627 | riscos_juridicos |
| supabase.js | 692 | riscos_juridicos |
| supabase.js | 975 | imoveis (getImoveisAtivos fallback) |
| AbaSaudeAXIS.jsx | 69 | imoveis (por ID) |
| CenariosReforma.jsx | 44 | itens_reforma |
| analiseLeilao.js | 238 | (não identificada) |

`getImoveis()` usa `IMOVEIS_LIST_COLS` (>100 campos nomeados) como query principal — correto. Mas o fallback em `supabase.js:110` usa `select('*')` que traz as 217 colunas, incluindo JSONBs pesados.

### G.3 Achados

**G-001** [P2] — GerarPDFProfissional.jsx não é lazy-loaded em Detail.jsx  
- Evidência: `head -50 Detail.jsx` — sem `lazy(() => import('./GerarPDFProfissional'))`. O chunk de 458 kB é carregado na abertura de qualquer imóvel.  
- Impacto: Usuários mobile com 4G carregam 149 kB extra gzip mesmo sem gerar PDF.  
- Esforço estimado: 2h (converter para lazy import com Suspense)

**G-002** [P3] — Fallback `select('*')` em `getImoveis()` e `getImoveisAtivos()` traz 217 colunas  
- Evidência: `supabase.js:110` e `supabase.js:975`.  
- Impacto: Baixo com 8 registros. Cresce linearmente. Migrar o fallback para usar `IMOVEIS_LIST_COLS`.  
- Esforço estimado: 1h

---

## Dimensão H — Dívida técnica

### H.1 Contagens

| Métrica | Valor |
|---------|-------|
| TODOs/FIXMEs/XXX/HACK | 0 |
| console.* calls | 222 |
| Arquivos >500 linhas | 10 (src/lib) + 11 (src/components) = 21 |
| Funções de cálculo financeiro | 10 paralelas |
| Migrações SQL commitadas | 6 |
| Edge Functions sem código no repo | 1 (ai-proxy) |

### H.2 Top arquivos por chamadas console.*

| Arquivo | Ocorrências |
|---------|-------------|
| motorIA.js | 36 |
| supabase.js | 37 |
| motorAnaliseGemini.js | 14 |
| (restante) | 135 |

A maioria são `console.warn` e `console.debug` (não apenas `console.log`) — padrão aceitável para um app sem logger estruturado, mas impede produção em modo silencioso.

### H.3 Achados

**H-001** [P3] — 222 console.* calls sem logger estruturado  
- Impacto: Impossível correlacionar erros de produção com sessões de usuário. Sem níveis configuráveis.  
- Esforço estimado: 8h (integrar Sentry ou logger simples com `console.error` → Sentry)

**H-002** [P3] — Velocidade de sprints: 50 commits em 40 dias, autor único  
- Impacto: Sem revisão de código (single author, sem PR reviews). Bugs estruturais acumulam sem segundo par de olhos.  
- Esforço estimado: N/A (processo)

---

## Dimensão I — Testes e qualidade

**Zero testes automatizados.** Nenhum arquivo `*.test.*` ou `*.spec.*` encontrado fora de `node_modules`. Nenhuma configuração de Vitest, Jest ou Playwright. Sem ESLint, Prettier ou Husky. Sem CI/CD.

O risco imediato: as 10 funções de cálculo financeiro não têm testes de regressão. Uma mudança em `calcularBreakdownFinanceiro()` pode quebrar silenciosamente 6 exportadores simultâneos.

**I-001** [P1] — Zero testes automatizados para funções financeiras críticas  
- Evidência: `find src/ -name "*.test.*"` = 0 resultados.  
- Impacto: Toda mudança em constants.js é um deploy cego. Com 10 caminhos de cálculo, qualquer refatoração tem alto risco de regressão silenciosa.  
- Esforço estimado: 16h (setup Vitest + testes unitários para as 10 funções de cálculo)

---

## Dimensão J — Documentação

`CLAUDE.md` existe e está atualizado com arquitetura, invariantes e decisões de design — excelente. `README.md` não foi encontrado. Sem diretório `docs/` pré-existente.

`ManualAxis.jsx` (1.071 linhas) contém documentação embutida na UI — positivo para usuários finais, mas acoplada ao código.

**J-001** [P3] — Sem README.md raiz  
- Impacto: Qualquer desenvolvedor novo não tem onboarding documentado além do CLAUDE.md.  
- Esforço: 1h

---

## Dimensão K — Observabilidade

**Zero integração com Sentry, LogRocket, Datadog, PostHog, Mixpanel ou similar.**

`ErrorBoundary` existe localmente em `Detail.jsx:38-56` (`SectionErrorBoundary`). Erros capturados vão apenas para `console.warn` — sem telemetria.

`agent_health` no banco captura health checks de IA e scrapers — positivo. `api_usage_log` registra custo por chamada — positivo. Mas não há alertas automáticos configurados.

`vercel.json` tem cron para `api/healthcheck.js` toda segunda às 11h — mas o arquivo não existe (ver E-005).

**K-001** [P2] — Sem telemetria de erros em produção  
- Evidência: Ausência de Sentry ou equivalente. `SectionErrorBoundary` só loga no console.  
- Impacto: Erros em produção invisíveis até usuário reportar.  
- Esforço estimado: 4h (Sentry + captura em ErrorBoundary)

---

## Dimensão L — Roadmap e estratégia

### L.1 Top 3 riscos de produto (não técnicos)

1. **Confiabilidade do ROI**: Com `roi_estimado=94%` exibido em painéis e `roi_liquido_oficial=38.9%` apenas no PDF de MG-007, um investidor pode tomar decisão baseada num número 2,4× inflado. Isso é risco legal (responsabilidade civil da plataforma) além de produto.

2. **Dependência de chave única de IA**: Todas as análises dependem das chaves pessoais de cada usuário. Se um usuário troca a chave, todas as análises dele param. Sem fallback de chave de plataforma para usuários básicos.

3. **Single point of failure humano**: 50 commits de um único autor em 40 dias. Se o desenvolvedor ficar indisponível, a plataforma para — não há documentação de infraestrutura além do CLAUDE.md e sem testes para validar que qualquer mudança funciona.

### L.2 Prioridades se features congeladas por 2 semanas

1. Fechar buraco de segurança das API keys no browser (E-002, F-001)
2. Criar e commitar Edge Function `ai-proxy` (E-001)
3. Criar `EditorCenarioOficial.jsx` para permitir preencher cenário canônico via UI (D-002)
4. Adicionar `validarRelatorioPreGeracao` bloqueando geração de PDF com dados incompletos (D-001)
5. Setup Vitest + testes unitários mínimos para as 10 funções financeiras (I-001)

### L.3 Refactor radical — vale?

**Não agora.** O sistema funciona, buildou sem erros, tem 5 usuários ativos e RLS cobrindo 100% das tabelas. O risco de regressão de um refactor agressivo (Detail.jsx, motorIA.js) sem testes é alto. A estratégia correta é:
- Sprint 46-47: segurança + integridade financeira
- Sprint 48: setup de testes
- Sprint 49+: refatoração incremental guiada por testes

---

## Backlog priorizado

| ID | Dimensão | Severidade | Achado | Esforço (h) | Ordem |
|----|----------|-----------|--------|-------------|-------|
| E-002 | E/F | P0 | API keys dos providers expostas em localStorage (18 call sites) | 16h | 1 |
| E-001 | E | P0 | Edge Function `ai-proxy` não commitada no repositório | 4h | 2 |
| D-001 | D | P0 | PDF gerado sem validação — capa e interior inconsistentes | 4h | 3 |
| A-001 | A | P0 | `roi_estimado` e `roi_liquido_oficial` sem reconciliação (divergência 2.4×) | 8h | 4 |
| F-001 | F | P0 | (idem E-002) | — | — |
| D-002 | D | P1 | EditorCenarioOficial ausente — operadores sem UI para cenário canônico | 8h | 5 |
| A-002 | A | P1 | `calcularROISimples` local em ResumoPreLeilao diverge de constants.js | 3h | 6 |
| B-001 | B | P1 | `admin_pct=8.0` em cenario_oficial sem correspondente nos cálculos | 2h | 7 |
| C-001 | C | P1 | Detail.jsx 2.527 linhas — Deus-componente | 24h | 8 |
| E-003 | E | P1 | gemini-2.0-flash deprecação jun/2026 — 4 semanas | 1h | 9 |
| F-002 | F | P1 | Policy atividades expõe logs de todos os usuários | 1h | 10 |
| I-001 | I | P1 | Zero testes para funções financeiras críticas | 16h | 11 |
| A-005 | A | P2 | cenario_oficial sem migration retroativa para 4 imóveis | 4h | 12 |
| E-004 | E | P2 | Circuit breaker só cobre motorAnaliseGemini | 6h | 13 |
| E-005 | E | P2 | `/api/healthcheck.js` referenciado em vercel.json mas ausente | 2h | 14 |
| B-002 | B | P2 | Policy atividades expõe dados de todos os usuários | 1h | 15 |
| B-003 | B | P2 | Duplicação de proteção campos travados: trigger + JS | 4h | 16 |
| C-002 | C | P2 | Memoização insuficiente — 48 useMemo para 32k LoC | 8h | 17 |
| G-001 | G | P2 | GerarPDFProfissional não é lazy-loaded (449 kB) | 2h | 18 |
| D-003 | D | P2 | Corretagem 6% hardcoded 4× dentro de constants.js | 1h | 19 |
| K-001 | K | P2 | Sem telemetria de erros em produção | 4h | 20 |
| F-003 | F | P2 | arremates_historico UPDATE sem filtro de dono | 1h | 21 |
| A-003 | A | P2 | RPCs calcular_mao e calcular_investimento_total mortas no banco | 2h | 22 |
| A-004 | A | P2 | HOLDING_MESES_PADRAO inconsistente entre constante e JSDoc | 0.5h | 23 |
| G-002 | G | P3 | Fallback select('*') em getImoveis traz 217 colunas | 1h | 24 |
| H-001 | H | P3 | 222 console.* sem logger estruturado | 8h | 25 |
| H-002 | H | P3 | Autor único sem revisão de código | N/A | 26 |
| J-001 | J | P3 | Sem README.md raiz | 1h | 27 |
| B-004 | B | P3 | imoveis com 217 colunas — schema overloaded | 16h | 28 |

---

## Sugestão de plano de 4 sprints

### Sprint 46 (esta semana) — Segurança e integridade financeira urgente

1. **E-001**: Criar e commitar `supabase/functions/ai-proxy/index.ts` (verificar se já deployado, se sim, apenas commitar o código existente)
2. **E-002/F-001**: Migrar os 5 call sites mais críticos para `aiProxy.js` — priorizar `analisadorJuridico.js` e `agenteJuridico.js` (análise de documentos sensíveis)
3. **E-003**: Remover `gemini-2.0-flash` de `MODELOS_GEMINI` ou documentar plano de substituição
4. **D-001**: Criar função `validarRelatorioPreGeracao` com checklist mínimo (roi_liquido_oficial presente? cenario_oficial presente?) e modal de aviso no PDF
5. **E-005**: Criar `api/healthcheck.js` ou remover do vercel.json

### Sprint 47 — UI de cenário canônico + reconciliação financeira

1. **D-002**: Criar `EditorCenarioOficial.jsx` com formulário de preenchimento do cenário
2. **A-001**: Migration SQL + script de backfill para calcular e salvar `roi_liquido_oficial` nos 4 imóveis sem ele
3. **A-005**: Aplicar `cenario_oficial` retroativo nos 4 imóveis usando os dados existentes do banco
4. **A-002**: Substituir `calcularROISimples` em ResumoPreLeilao por `calcularDadosFinanceiros`
5. **F-002/F-003**: Corrigir policies de atividades e arremates

### Sprint 48 — Qualidade e fundação de testes

1. **I-001**: Setup Vitest + testes unitários para as 10 funções de cálculo em constants.js (100% coverage nas funções financeiras)
2. **D-003**: Extrair `CORRETAGEM_VENDA_PCT = 0.06` e eliminar os 4 hardcodings em constants.js
3. **E-004**: Envolver call sites de Claude e GPT em motorIA.js com `withCircuitBreaker`
4. **G-001**: Converter GerarPDFProfissional para lazy import
5. **K-001**: Integrar Sentry básico + captura no SectionErrorBoundary

### Sprint 49 — Refatoração incremental guiada por testes

1. **E-002** (restante): Migrar os 13 call sites restantes de fetch direto para `aiProxy.js`
2. **C-001**: Começar split de Detail.jsx — extrair aba Financeiro para componente próprio (já existe PainelInvestimento como base)
3. **B-003**: Consolidar proteção de campos travados no trigger, remover do JS
4. **A-003**: Dropar ou documentar RPCs `calcular_mao` e `calcular_investimento_total`
5. **B-002/B-004**: Iniciar análise de normalização do schema de 217 colunas

---

*Fim do diagnóstico Sprint 46 — AXIS IP*
