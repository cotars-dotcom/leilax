# AXIS — Templates de Auditoria

**Quando usar:** Rodar no Claude Code (cada auditoria individualmente) + Claude in Chrome (auditoria visual).
**Frequência recomendada:** Antes de cada release para produção. Auditorias 1 e 3 sempre que adicionar colunas ou componentes novos.

---

## Auditoria 1 — IMOVEIS_COLS vs LIST_COLS
**Quando rodar:** Sempre que adicionar colunas ao banco ou novos campos na UI.
**Descobriu:** `custo_reforma`, `quartos`, `justificativa` e 11 outros campos retornavam `undefined` silenciosamente.

```
Audite src/lib/supabase.js:

1. Extraia IMOVEIS_LIST_COLS (o que é LIDO no SELECT) e IMOVEIS_COLS (whitelist de SAVE).

2. Liste as 3 categorias de discrepância:
   a) Campos em LIST_COLS mas NÃO em IMOVEIS_COLS — lidos mas nunca salvos (risco de perda de dado)
   b) Campos em IMOVEIS_COLS mas NÃO em LIST_COLS — salvos no banco mas nunca retornados à UI (dado morto)
   c) Campos usados em Detail.jsx e App.jsx via p.CAMPO que não estão em LIST_COLS — sempre retornam undefined

3. Para cada campo da categoria (c), mostre: arquivo, linha, e qual valor seria exibido.
4. Gere o patch SQL para adicionar ao LIST_COLS e, se necessário, ao IMOVEIS_COLS.
```

---

## Auditoria 2 — console.log de debug em produção
**Quando rodar:** Antes de qualquer release para produção.
**Descobriu:** 137 ocorrências — 14 eram ruído/debug; 1 era debug explícito de modo teste.

```
Varredura em src/ — analise todos os console.log, console.warn e console.error:

1. Categorize cada ocorrência:
   - MANTER: erros reais em catch com contexto útil (ex: [AXIS] fetch error: ...)
   - REMOVER: confirmações de sucesso (ex: 'salvo OK', 'encontrado', 'cache hit')
   - REMOVER: logs de loop/cascata que geram ruído em produção normal
   - REMOVER: debug explícito (ex: 'MODO TESTE', variáveis de estado)
   - CONVERTER: .catch(() => {}) silencioso → .catch(e => console.warn(...))

2. Agrupe por arquivo, mostre linha e texto do log.
3. Gere o diff das linhas a remover/alterar.

Critério: se o log não ajuda a diagnosticar um problema real em produção, remover.
```

---

## Auditoria 3 — isMercadoDireto: propagação completa
**Quando rodar:** Sempre que criar novo componente financeiro (cálculo de custo, ROI, desconto, MAO).
**Descobriu:** Desconto negativo exibido como positivo; MAO sem dedução de cartório.

```
Mapeie todos os usos de isMercadoDireto() em src/:

1. Liste todos os locais onde a função É chamada corretamente.

2. Identifique componentes que calculam ou exibem dados financeiros SEM chamar isMercadoDireto:
   - Valores monetários (custo, preço, desconto, MAO, comissão)
   - Porcentagens (ROI, yield, desconto percentual)
   - Labels condicionais ('Lance mínimo' vs 'Preço pedido', 'Leiloeiro' vs 'Vendedor')
   Foco em: PainelRentabilidade.jsx, CenariosReforma.jsx, CalculadoraROI.jsx,
            PainelLancamento.jsx, App.jsx (card de imóvel)

3. Para cada caso sem isMercadoDireto, mostre: arquivo, linha, o que está errado, e a correção.

4. Verifique fórmulas on-the-fly (desconto calculado no card, MAO calculado no card):
   - Desconto negativo deve exibir '+X% acima do mercado', não '-%'
   - MAO deve deduzir: vm*0.80 - (pp*taxas + 1500) [cartório]
```

---

## Auditoria 4 — async sem tratamento de erro
**Quando rodar:** Antes de releases com novos fluxos de API ou scraping.
**Descobriu:** 5 fetch() sem try/catch em motorAnaliseGemini.js e motorIA.js; .catch(()=>{}) silencioso.

```
Em src/lib/ e src/components/, audite o tratamento de erro em chamadas assíncronas:

1. fetch() sem try/catch — identifique chamadas fetch() que não têm:
   - try/catch local envolvendo o fetch
   - E não estão dentro de uma função já envolvida por try/catch externo
   Mostre: arquivo, linha, função envolvente, e se há fallback.

2. .catch(() => {}) silencioso — identifique Promises que engolam erros:
   .catch(() => {}) sem nenhum log → deve ser .catch(e => console.warn(...))

3. res.json() sem guard — identifique casos onde res.json() é chamado sem
   verificar res.ok antes (pode lançar SyntaxError se resposta for HTML de erro).

4. Para cada caso, gere a correção com try/catch + fallback apropriado ao contexto.
   (ex: extrairFotos com fallback para og:image; análise de doc com mensagem de erro amigável)
```

---

## Auditoria Visual — Claude in Chrome
**Quando rodar:** Após cada deploy em produção. Colar no painel do Claude in Chrome com a extensão.
**Descobriu:** Stale cache pós-deploy, CT-001 vendido ainda ativo, comparáveis na aba errada.

```
Você é um auditor técnico do sistema AXIS IP (axisip.vercel.app).
Faça uma auditoria completa navegando pelo sistema. Execute cada teste abaixo e reporte.

URL BASE: https://axisip.vercel.app
LOGIN: admin (Gabriel)

=== CHECKLIST ===

1. CACHE — Antes de começar, force hard refresh: Ctrl+Shift+R
   Confirme que os chunks JS são recentes (DevTools → Network → JS files, ver hash nos nomes)

2. TÍTULOS NO DETAIL
   Abrir cada imóvel ativo. Formato esperado: "Tipo Xq Ym² — Bairro, Cidade"
   Verificar: quartos presentes? Área arredondada (sem decimais)? Tipo correto?

3. COMPARÁVEIS
   Em cada imóvel → aba Mercado → seção "Comparáveis de Mercado"
   Clicar 2-3 links 🔍 de cada imóvel. Verificar: página abre? Filtros fazem sentido?
   Também verificar na aba Resumo (devem aparecer nos dois lugares)

4. OPORTUNIDADES MELHORES
   Em cada imóvel de leilão → seção "Oportunidades Melhores" no Resumo
   Clicar "Ver anúncio original →" em 2 imóveis. Verificar se carrega.

5. FOTOS
   Para cada imóvel: aba Fotos → fotos carregam? Fundo neutro (não escuro)?
   Se placeholder: botão "Buscar fotos" → funciona?

6. RELATÓRIO PDF
   Em qualquer imóvel → botão Relatório → Baixar Relatório (HTML) e Imprimir/PDF
   Verificar: arquivo baixa? Conteúdo correto?

7. JURÍDICO → DOCUMENTOS
   Abrir um imóvel de leilão → aba Jurídico → Documentos
   Clicar "Buscar documentos automaticamente"
   Verificar: documentos encontrados? Score jurídico salvo após análise?

8. BOTÃO EDITAL/ANÚNCIO
   Clicar 🔗 Edital (leilão) ou 🔗 Anúncio (mercado direto) em cada imóvel
   Verificar: URL correta? Imóvel corresponde ao código AXIS?

9. PAINEL RENTABILIDADE
   Em imóvel de leilão → trocar cenário Básica / Média / Completa
   Verificar: Venda estimada muda? Aluguel Completa >= Aluguel Básica?
   Verificar: custo reforma exibido corretamente (não "—")?

10. STATUS DOS IMÓVEIS
    Verificar se algum imóvel ativo já foi vendido/arrematado no portal leiloeiro
    Se sim: reportar código AXIS + valor de arrematação para arquivar

11. CONSOLE DE ERROS (DevTools → Console)
    Navegar por todos os imóveis. Reportar:
    - Erros vermelhos (especialmente Failed to fetch, chunk errors)
    - Warnings relevantes
    - Padrão: são erros de cache stale ou bugs reais?

Formato do relatório:
✅ PASSOU | ⚠️ PARCIAL (com observação) | ❌ FALHOU (com erro exato)
Para cada item: resultado + URL testada + texto do erro se houver
```

---

## Histórico de bugs encontrados pelas auditorias

| Sprint | Auditoria | Bug | Fix |
|--------|-----------|-----|-----|
| Sprint 7 | Code #1 | `custo_reforma` → `custo_reforma_calculado` | `40b1f47` |
| Sprint 7 | Code #1 | 13 campos ausentes do LIST_COLS (quartos, justificativa...) | `40b1f47` |
| Sprint 7 | Code #2 | MODO TESTE warn em produção | `40b1f47` |
| Sprint 7 | Code #3 | Desconto negativo exibido como positivo | `40b1f47` |
| Sprint 7 | Code #3 | MAO sem dedução de cartório (R$1.500) | `40b1f47` |
| Sprint 7 | Code #4 | fetch() sem try/catch em extrairFotosImovel | `40b1f47` |
| Sprint 7 | Code #4 | .catch(()=>{}) silencioso no logUsoGemini | `40b1f47` |
| Sprint 7 | Chrome | AbaJuridicaAgente score_juridico → novo_score_juridico | `e904bb0` |
| Sprint 7 | Chrome | Fallback parecer_resumido ausente | `e904bb0` |
| Sprint 7 | Chrome | Badge OPORTUNIDADE duplicado | `e904bb0` |
| Sprint 7 | Chrome | Comparáveis ausentes na aba Mercado | `ac862dd` |
| Sprint 7 | Chrome | Área com decimal no título (156.19m²) | `ac862dd` |
| Sprint 7 | Chrome | Unicode escape sequence ao salvar docs jurídicos | `ac862dd` |
| Sprint 7 | Chrome | CT-001 ativo mas VENDIDO (arrematado R$486k) | `ac862dd` |
