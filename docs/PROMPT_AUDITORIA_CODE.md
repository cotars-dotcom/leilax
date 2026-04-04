# AXIS Platform — Prompt de Auditoria Final e Correções

> Cole este prompt no Claude Code com acesso ao repo `cotars-dotcom/axis-platform`
> Branch: main · Commit base: 18946dc · Produção: axisip.vercel.app

---

## CONTEXTO

O AXIS é uma plataforma de inteligência imobiliária (React 18 + Vite + Supabase + Vercel).
Acabamos de concluir o Sprint 9 com 7 commits que centralizaram constantes,
corrigiram custos financeiros e eliminaram hardcoded em 23 arquivos.

O módulo central é `src/lib/constants.js` (171 linhas) — fonte única de:
- `SCORE_PESOS` (6 dimensões: loc 20%, desc 18%, jur 18%, ocu 15%, liq 15%, mer 14%)
- `CUSTOS_LEILAO` / `CUSTOS_MERCADO` (comissão, ITBI 3%, advogado, doc, registro)
- `MODELOS_GEMINI` (cascata: 2.0-flash → 2.0-flash-exp → 1.5-flash)
- `CLAUDE_MODEL`, `CLAUDE_HAIKU`, `ANTHROPIC_VERSION`
- Helpers: `calcularScoreTotal()`, `calcularCustosAquisicao()`, `chamarGeminiCascata()`, `parseJSONResposta()`

---

## TAREFA 1: AUDITORIA DE CONSISTÊNCIA

Clone o repo, instale deps, e execute as verificações abaixo.
Para cada item, reporte: [OK] ou [BUG] + arquivo:linha + fix sugerido.

### 1.1 Custos centralizados
Verifique que TODOS os 8 componentes financeiros importam de `constants.js`:
- Detail.jsx, PainelRentabilidade.jsx, PainelLancamento.jsx, CenariosReforma.jsx
- CalculadoraROI.jsx, CustosReaisEditor.jsx, ExportarPDF.jsx, motorIA.js

Buscar: `0.05` (comissão), `0.02` (ITBI antigo ou advogado), `1500` (registro), `0.035`/`0.105` (mult).
Nenhum valor numérico de custo deve existir fora de `constants.js`.

### 1.2 Modelos IA
Buscar: `gemini-1.5-flash`, `gemini-1.5-pro`, `claude-haiku-4-5`, `claude-sonnet-4`, `2023-06-01`
Esses valores SÓ devem existir em `constants.js` e `motorAnaliseGemini.js` (que tem cascata própria).

### 1.3 Pesos de score
Buscar: `0.20`, `0.18`, `0.15`, `0.14` em contexto de score/peso.
SÓ devem existir em `constants.js`.

### 1.4 isMercadoDireto
Buscar: `tipo_transacao === 'mercado_direto'` ou `!== 'mercado_direto'`.
Nenhuma comparação direta deve existir — todos devem usar `isMercadoDireto(url, tipo)`.
Exceções aceitas: assignments como `data.tipo_transacao = 'mercado_direto'` (write, não read).

### 1.5 Status operacional
Buscar queries Supabase (`.from('imoveis')`) que NÃO filtram `status_operacional`.
Exceções: queries que buscam por ID específico (`.eq('id', ...)`) não precisam filtrar.

### 1.6 IMOVEIS_LIST_COLS
Verificar que todos os campos usados em `Detail.jsx` com `p.CAMPO` existem em `IMOVEIS_LIST_COLS`.
Campos computados internos (`_economia`, `_isLeilao`, `_similaridade`) são exceções.

### 1.7 Try/catch vazios
Buscar `catch {}` e `catch(e) {}` sem qualquer log.
Classificar: CRÍTICO (dados perdidos), ACEITÁVEL (fallback OK com comentário).

### 1.8 NaN protection
Buscar divisões aritméticas em componentes: `/ (p.` ou `/ area` ou `/ lance`.
Verificar que todas têm guard `|| 1` ou `> 0` antes.

### 1.9 URLs de portais
Testar URLs geradas pelo `CardComparavel` para:
- "Dona Clara", "Silveira", "Pampulha" em BH
- "Eldorado" em Contagem
Confirmar que VivaReal (`/bairros/`), ZAP (`++bairro/N-quartos/`) e OLX (região correta) resolvem.

### 1.10 Build
Rodar `npm run build` e confirmar zero erros.

---

## TAREFA 2: CORREÇÕES PENDENTES

Se a auditoria encontrar bugs, corrija seguindo estas regras:
1. Custos → importar de `constants.js`, NUNCA hardcoded
2. Modelos → importar `MODELOS_GEMINI`/`CLAUDE_MODEL` de `constants.js`
3. Pesos → importar `SCORE_PESOS` de `constants.js`
4. isMercadoDireto → importar de `detectarFonte.js`
5. Build DEVE passar antes de commit

---

## TAREFA 3: BANCO DE DADOS — VERIFICAÇÃO SUPABASE

Conectar ao Supabase (projeto `vovkfhyjjoruiljfjrxy`) e executar:

```sql
-- 1. Verificar imoveis ativos com dados faltantes
SELECT codigo_axis, titulo, 
  CASE WHEN valor_minimo IS NULL OR valor_minimo = 0 THEN 'SEM PREÇO' ELSE 'OK' END as preco,
  CASE WHEN score_total IS NULL OR score_total = 0 THEN 'SEM SCORE' ELSE 'OK' END as score,
  CASE WHEN comparaveis IS NULL OR jsonb_array_length(comparaveis) = 0 THEN 'SEM COMP' ELSE 'OK' END as comparaveis,
  CASE WHEN fotos IS NULL OR jsonb_array_length(fotos) = 0 THEN 'SEM FOTOS' ELSE 'OK' END as fotos,
  CASE WHEN aluguel_mensal_estimado IS NULL OR aluguel_mensal_estimado = 0 THEN 'SEM ALUGUEL' ELSE 'OK' END as aluguel,
  status_operacional
FROM imoveis
WHERE status_operacional = 'ativo' OR status_operacional IS NULL
ORDER BY codigo_axis;

-- 2. Verificar mercado_regional atualizado
SELECT regiao_key, label, preco_m2_venda_medio, yield_bruto_pct, 
  atualizado_em, fonte
FROM mercado_regional 
WHERE cidade = 'Belo Horizonte'
ORDER BY preco_m2_venda_medio DESC
LIMIT 10;

-- 3. Verificar documentos jurídicos sem análise
SELECT dj.id, dj.nome, dj.tipo, dj.processado, dj.analise_ia IS NOT NULL as tem_analise,
  i.codigo_axis, i.titulo
FROM documentos_juridicos dj
JOIN imoveis i ON i.id = dj.imovel_id
WHERE dj.processado = false OR dj.analise_ia IS NULL
ORDER BY dj.criado_em DESC;

-- 4. Verificar modelos de análise
SELECT nome, ativo, 
  jsonb_pretty(conteudo->'custos_percentuais') as custos
FROM modelos_analise
WHERE ativo = true;

-- 5. Campos IMOVEIS_LIST_COLS que existem na tabela
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'imoveis' AND table_schema = 'public'
ORDER BY ordinal_position;
```

Reporte:
- Quantos imóveis ativos com dados faltantes
- Documentos jurídicos pendentes de análise (BH-004 especificamente)
- Se mercado_regional está atualizado (fonte e data)
- Se modelos_analise tem custos_percentuais populados

---

## TAREFA 4: ATUALIZAR PLANO DE CORREÇÕES

Atualize `docs/PLANO_CORRECOES_SPRINT9.md` marcando como CORRIGIDO todos os itens resolvidos.
Adicione novos itens encontrados na auditoria.

---

## FORMATO DE SAÍDA

Gere relatório com este formato:

```
# AXIS — Relatório de Auditoria Final
Data: DD/MM/YYYY · Commit: HASH

## 1. Custos Centralizados
[OK] Detail.jsx — importa calcularCustosAquisicao
[OK] PainelRentabilidade — importa CUSTOS_LEILAO/MERCADO
[BUG] ExportarPDF:123 — ainda tem 0.05 hardcoded → FIX: importar _tab

## 2. Modelos IA
[OK] Todos centralizados

... etc ...

## Resumo
| Categoria | OK | BUG | FIX |
|---|---|---|---|
| Custos | 7 | 1 | 1 |
| Modelos | 8 | 0 | 0 |
| Total | X | Y | Z |

## Banco de Dados
- Imóveis ativos com dados faltantes: N
- Docs jurídicos pendentes: N
- mercado_regional última atualização: DD/MM/YYYY
```

---

## REGRAS

- NUNCA criar hardcoded novo — sempre importar de constants.js
- Build DEVE passar antes de qualquer commit
- Commit message em português com prefixo fix:/feat:/refactor:
- Git config: user.email "axis@cotars.com" && user.name "AXIS Bot"
- Responder em português
