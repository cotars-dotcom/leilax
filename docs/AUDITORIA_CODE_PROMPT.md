# AXIS IP — Prompt de Conferência Completa (Claude Code)

## Projeto
Plataforma de inteligência imobiliária para análise de imóveis de leilão e mercado direto na RMBH.
- **Repo:** `cotars-dotcom/axis-platform` | **Branch:** `main`
- **Produção:** `axisip.vercel.app`
- **Supabase:** projeto `vovkfhyjjoruiljfjrxy`
- **Vercel:** team `team_UJugYFpSSuKLZOw0OeBTOuBt` | project `prj_PmBnpJako14yeGFZRcNZ5PWvOHiM`
- **Stack:** React 18 + Vite + Supabase + Vercel
- **Cascata IA:** Gemini 2.0 Flash → DeepSeek → GPT-4o-mini → Claude Sonnet

## Convenções
- Git: `git config user.email "axis@cotars.com" && git config user.name "AXIS Bot"`
- Build obrigatório antes de push: `npm run build`
- Responder sempre em português
- Commits descritivos com lista de alterações

---

## TAREFA: Auditoria completa de consistência e qualidade

Clone o repo, instale dependências, e execute as verificações abaixo **na ordem**. Para cada categoria, reporte: ✅ OK | ⚠️ Warning | ❌ Erro crítico.

### 1. BUILD E LINT
```bash
npm install && npm run build 2>&1
```
- [ ] Build passa sem erros
- [ ] Sem warnings de ESBuild/Vite relevantes (ignorar size warnings)
- [ ] Verificar se há imports não utilizados: `grep -rn "import.*from" src/ | grep -v node_modules`

### 2. REACT RULES OF HOOKS
Verificar se TODOS os componentes respeitam Rules of Hooks (nenhum hook após return condicional):
```bash
# Para cada componente com export default function:
# 1. Listar todos os useState/useEffect/useRef/useMemo/useCallback/useIsMobile
# 2. Listar todos os "if(...) return" 
# 3. Confirmar que TODOS os hooks estão ANTES do primeiro return condicional
```
Arquivos prioritários (maiores e mais complexos):
- `src/App.jsx` (1950 linhas) — TEVE BUG DE HOOKS RECENTE
- `src/components/Detail.jsx` (2091 linhas)
- `src/components/AbaJuridicaAgente.jsx` (887 linhas)
- `src/components/Dashboard.jsx` (500 linhas)

### 3. CONSTANTES CENTRALIZADAS (Zero Hardcodes)
Fonte de verdade: `src/lib/constants.js`. Verificar que NENHUM arquivo hardcoda:
```bash
# Modelos Gemini (deve importar MODELOS_GEMINI)
grep -rn "gemini-1.5\|gemini-2.0" src/ --include="*.js" --include="*.jsx" | grep -v constants.js | grep -v node_modules | grep -v "\.map"

# ITBI (deve ser 3%, importado de CUSTOS_LEILAO)
grep -rn "itbi.*0\.02\|itbi.*2%\|ITBI.*2%" src/ --include="*.js" --include="*.jsx" | grep -v constants.js

# Comissão leiloeiro (deve importar de constants)
grep -rn "0\.05.*comiss\|comiss.*0\.05\|5%.*comiss" src/ --include="*.js" --include="*.jsx" | grep -v constants.js

# anthropic-version (deve importar ANTHROPIC_VERSION)
grep -rn "anthropic-version.*2025\|2025-01-01" src/ --include="*.js" --include="*.jsx" | grep -v constants.js

# Pesos de score duplicados (deve importar SCORE_PESOS)
grep -rn "0\.20.*0\.18.*0\.18\|localizacao.*20.*desconto.*18" src/ --include="*.js" --include="*.jsx" | grep -v constants.js

# Registro cartório hardcoded
grep -rn "1500.*registro\|registro.*1500\|R\$.*1\.500" src/ --include="*.js" --include="*.jsx" | grep -v constants.js
```

### 4. TIPO DE TRANSAÇÃO (isMercadoDireto)
Nenhum arquivo deve usar `tipo_transacao === 'mercado_direto'` direto. Deve usar `isMercadoDireto()`:
```bash
grep -rn "tipo_transacao.*===\|=== .*tipo_transacao" src/ --include="*.js" --include="*.jsx" | grep -v detectarFonte | grep -v "isMercadoDireto"
```

### 5. JINA ENCODING
Todas as chamadas Jina devem usar `X-Return-Format: 'markdown'` (não `'text'`):
```bash
grep -rn "X-Return-Format.*text" src/lib/ --include="*.js" | grep -v "text/plain\|text/html"
```
Se encontrar algum com `'text'` em contexto de PDF/documento, é BUG (causa encoding quebrado em pt-BR).

### 6. CORS HANDLING
`documentosPDF.js` deve ter lista de domínios CORS-blocked para skip de fetch direto:
```bash
grep -n "CORS_BLOCKED\|corsBlocked\|suporteleiloes" src/lib/documentosPDF.js
```

### 7. SUPABASE — IMOVEIS_LIST_COLS
Verificar se todos os campos que são salvos também são lidos na listagem:
```bash
# Extrair campos do IMOVEIS_LIST_COLS
grep "IMOVEIS_LIST_COLS" src/lib/supabase.js | tr ',' '\n' | wc -l

# Extrair campos do IMOVEIS_COLS (whitelist de save)
grep -A100 "IMOVEIS_COLS" src/lib/supabase.js | grep "'" | head -50
```
Campos que são salvos mas não lidos = dados perdidos no frontend.

### 8. BANCO DE DADOS — Conferência de Dados
Executar no Supabase SQL Editor:
```sql
-- 8.1 Estado dos imóveis ativos
SELECT codigo_axis, titulo, score_total, recomendacao, status_operacional,
       data_leilao, num_documentos, score_viabilidade_docs
FROM imoveis WHERE status_operacional NOT IN ('arquivado','arrematado','vendido')
ORDER BY data_leilao NULLS LAST;

-- 8.2 Documentos sem análise IA
SELECT d.id, i.codigo_axis, d.tipo, d.nome, d.processado, 
       d.analise_ia IS NOT NULL as tem_analise,
       d.url_origem IS NOT NULL as tem_url,
       length(d.conteudo_texto) as texto_len
FROM documentos_juridicos d
JOIN imoveis i ON i.id = d.imovel_id
WHERE d.processado = false OR d.analise_ia IS NULL
ORDER BY i.codigo_axis;

-- 8.3 data_leilao formato (deve ser YYYY-MM-DD ou NULL)
SELECT id, codigo_axis, data_leilao 
FROM imoveis 
WHERE data_leilao IS NOT NULL 
  AND data_leilao !~ '^\d{4}-\d{2}-\d{2}$';

-- 8.4 Tabelas de referência populadas
SELECT 'mercado_regional' as tabela, count(*) FROM mercado_regional
UNION ALL SELECT 'riscos_juridicos', count(*) FROM riscos_juridicos
UNION ALL SELECT 'custos_construcao', count(*) FROM custos_construcao
UNION ALL SELECT 'taxas_financiamento', count(*) FROM taxas_financiamento
UNION ALL SELECT 'emolumentos_mg', count(*) FROM emolumentos_mg
UNION ALL SELECT 'jurisprudencia_leilao', count(*) FROM jurisprudencia_leilao
UNION ALL SELECT 'indicadores_mercado', count(*) FROM indicadores_mercado
UNION ALL SELECT 'metricas_aluguel_bairro', count(*) FROM metricas_aluguel_bairro
UNION ALL SELECT 'shared_links', count(*) FROM shared_links
ORDER BY tabela;

-- 8.5 Documentos com análise corrompida (Gemini interpretou como corrompido)
SELECT d.id, i.codigo_axis, d.tipo, 
       substring(d.analise_ia, 1, 100) as preview
FROM documentos_juridicos d
JOIN imoveis i ON i.id = d.imovel_id
WHERE d.analise_ia ILIKE '%corrompido%' 
   OR d.analise_ia ILIKE '%criptografado%'
   OR d.analise_ia ILIKE '%ilegível%'
   OR d.analise_ia ILIKE '%inviabilizada%';
```

### 9. FLUXO JURÍDICO — Pipeline Completa
Verificar os 4 caminhos de `handleAnalisarDoc` em `AbaJuridicaAgente.jsx`:
```bash
grep -n "CAMINHO" src/components/AbaJuridicaAgente.jsx
```
Deve ter:
- CAMINHO 1: texto salvo → análise direta
- CAMINHO 2: URL salva → re-download + análise
- CAMINHO 2.5: texto ilegível → Gemini Vision (base64)
- CAMINHO 3: sem URL → re-scrape fonte_url → descobrir PDF → processar

Verificar que `analisarTextoJuridicoGemini` em `agenteJuridico.js` inclui jurisprudência STJ:
```bash
grep -c "Tema 1.134\|preço vil\|condominiais\|1.672.508\|2.096.465" src/lib/agenteJuridico.js
```
Deve retornar >= 5 matches.

### 10. COMPONENTES FINANCEIROS — Consistência de Cálculos
Todos estes componentes devem importar de `constants.js`:
```bash
for f in Detail PainelRentabilidade PainelLancamento CenariosReforma CalculadoraROI CustosReaisEditor ExportarPDF; do
  echo "=== $f ==="
  grep -c "constants\|CUSTOS_LEILAO\|CUSTOS_MERCADO\|MULT_CUSTO\|calcularCustosAquisicao" src/components/$f.jsx 2>/dev/null || echo "NÃO ENCONTRADO"
done
echo "=== motorIA ==="
grep -c "constants\|CUSTOS_LEILAO\|calcularCustosAquisicao\|SCORE_PESOS" src/lib/motorIA.js
```

### 11. SPRINT 10 — Features Novas
Verificar que todas as features do Sprint 10 funcionam:
```bash
# PainelPosLeilao (Dashboard)
grep -n "PainelPosLeilao" src/components/Dashboard.jsx

# ExportCarteira (Dashboard)
grep -n "ExportCarteira" src/components/Dashboard.jsx

# SharedViewer (App.jsx — rota /#/share/:token)
grep -n "SharedViewer\|shareToken" src/App.jsx | head -10

# Multi-select + análise em lote (Lista em App.jsx)
grep -n "selIds\|toggleSel\|analisarLote" src/App.jsx | head -10

# Funções Supabase do Sprint 10
grep -n "getImoveisLeilaoPendente\|getImoveisLeilaoProximo\|criarLinkPublico\|getImovelPorToken" src/lib/supabase.js
```

### 12. DEAD CODE — Funções não utilizadas
```bash
# Funções exportadas em supabase.js que ninguém importa
for fn in $(grep "export async function\|export function" src/lib/supabase.js | sed 's/export.*function \([a-zA-Z]*\).*/\1/'); do
  count=$(grep -rn "$fn" src/ --include="*.js" --include="*.jsx" | grep -v "supabase.js" | grep -v node_modules | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "⚠️ DEAD: $fn (0 usos)"
  fi
done
```

### 13. SEGURANÇA
```bash
# API keys hardcoded (NUNCA deve ter)
grep -rn "AIza\|sk-ant\|sk-proj\|ghp_" src/ --include="*.js" --include="*.jsx" | grep -v ".env\|constants\|example\|placeholder\|API_KEY"

# localStorage sem sanitização
grep -rn "localStorage.getItem\|localStorage.setItem" src/ --include="*.js" --include="*.jsx" | wc -l
```

---

## FORMATO DE SAÍDA

Para cada categoria (1-13), reporte:

```
### [N]. [NOME DA CATEGORIA]
Status: ✅ OK | ⚠️ N warnings | ❌ N erros críticos

[Se houver problemas:]
- Arquivo:Linha — Descrição do problema
- Arquivo:Linha — Descrição do problema

[Se houver correção necessária:]
FIX: [descrição da correção]
```

Ao final, gere um **RESUMO EXECUTIVO** com:
1. Total de ✅ / ⚠️ / ❌ por categoria
2. Lista de correções prioritárias (ordenada por criticidade)
3. Commits sugeridos (agrupar fixes relacionados)

Se encontrar erros críticos (❌), corrija-os imediatamente, builde e commite com mensagem descritiva.
Se encontrar apenas warnings (⚠️), documente mas não corrija (reportar ao Gabriel).

**REGRA:** Nunca modificar lógica de negócio (scores, fórmulas, pesos) — apenas corrigir bugs de código, imports quebrados, inconsistências de dados e violações de padrão.
