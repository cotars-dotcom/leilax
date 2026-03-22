// LEILAX — Trello Service (etiquetas, cards avançados, manual de métricas)

const SCORE_LABEL = (score) => {
  if (score >= 7.5) return { name: '⭐ Score Forte', color: 'green' }
  if (score >= 6.0) return { name: '📊 Score Médio', color: 'yellow' }
  return { name: '⚠️ Score Fraco', color: 'red' }
}

// ── Criar etiquetas no board ────────────────────────────────────
export async function criarEtiquetasBoard(boardId, key, token) {
  const etiquetas = [
    { name: '🟢 COMPRAR', color: 'green' },
    { name: '🟡 AGUARDAR', color: 'yellow' },
    { name: '🔴 EVITAR', color: 'red' },
    { name: '⭐ Score Forte', color: 'green' },
    { name: '📊 Score Médio', color: 'yellow' },
    { name: '⚠️ Score Fraco', color: 'red' },
    { name: '🏠 Desocupado', color: 'lime' },
    { name: '🔒 Ocupado', color: 'orange' },
    { name: '💰 Financiável', color: 'sky' },
    { name: '⚖️ Due Diligence', color: 'purple' },
    { name: '✅ Aprovado', color: 'green' },
    { name: '🚫 Descartado', color: 'black' },
  ]
  const criadas = []
  for (const e of etiquetas) {
    try {
      const res = await fetch(
        `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: e.name, color: e.color })
        }
      )
      if (res.ok) criadas.push(await res.json())
    } catch {}
  }
  return criadas
}

// ── Criar card do imóvel com etiquetas ─────────────────────────
export async function criarCardImovel(imovel, listId, boardId, key, token) {
  let labelIds = []
  try {
    const res = await fetch(
      `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}&limit=50`
    )
    if (res.ok) {
      const labels = await res.json()
      const labelsDoImovel = []
      if (imovel.recomendacao) {
        const lRec = labels.find(l => l.name.includes(imovel.recomendacao))
        if (lRec) labelsDoImovel.push(lRec.id)
      }
      const scoreLabel = SCORE_LABEL(imovel.score_total || 0)
      const lScore = labels.find(l => l.name.includes(scoreLabel.name.split(' ')[1]))
      if (lScore) labelsDoImovel.push(lScore.id)

      const lOcup = labels.find(l => l.name.includes(imovel.ocupacao === 'Desocupado' ? 'Desocupado' : 'Ocupado'))
      if (lOcup) labelsDoImovel.push(lOcup.id)

      if (imovel.financiavel) {
        const lFin = labels.find(l => l.name.includes('Financiável'))
        if (lFin) labelsDoImovel.push(lFin.id)
      }
      labelIds = labelsDoImovel
    }
  } catch {}

  const desc = `## 📊 Score: ${(imovel.score_total || 0).toFixed(1)}/10

**Recomendação:** ${imovel.recomendacao || '—'}
**Endereço:** ${imovel.endereco || '—'}
**Cidade:** ${imovel.cidade || '—'}/${imovel.estado || '—'}
**Tipo:** ${imovel.tipo || '—'} | **Área:** ${imovel.area_m2 || '—'}m²

---

## 💰 Valores

- **Avaliação:** R$ ${(imovel.valor_avaliacao || 0).toLocaleString('pt-BR')}
- **Mínimo:** R$ ${(imovel.valor_minimo || 0).toLocaleString('pt-BR')}
- **Desconto:** ${imovel.desconto_percentual || 0}%

## 📈 Scores por Dimensão

- Localização: ${imovel.score_localizacao || 0}/10
- Desconto: ${imovel.score_desconto || 0}/10
- Jurídico: ${imovel.score_juridico || 0}/10
- Ocupação: ${imovel.score_ocupacao || 0}/10
- Liquidez: ${imovel.score_liquidez || 0}/10
- Mercado: ${imovel.score_mercado || 0}/10

## ⚖️ Jurídico

- Ocupação: ${imovel.ocupacao || '—'}
- Financiável: ${imovel.financiavel ? 'Sim' : 'Não'}
- FGTS: ${imovel.fgts_aceito ? 'Sim' : 'Não'}
- Débitos IPTU: ${imovel.debitos_iptu || '—'}
- Débitos Condomínio: ${imovel.debitos_condominio || '—'}
- Processos: ${imovel.processos_ativos || '—'}

## 💡 Positivos

${(imovel.positivos || []).map(p => `- ✅ ${p}`).join('\n') || '—'}

## ⚠️ Alertas

${(imovel.alertas || []).map(a => `- ⚠️ ${a}`).join('\n') || '—'}

## 🏗️ Estrutura Recomendada

${imovel.estrutura_recomendada || '—'}

---

*Analisado pelo LEILAX — Motor Duplo IA (Claude + ChatGPT)*
${imovel.fonte_url ? `[Ver anúncio](${imovel.fonte_url})` : ''}`

  const res = await fetch(
    `https://api.trello.com/1/cards?key=${key}&token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idList: listId,
        name: `${imovel.recomendacao === 'COMPRAR' ? '🟢' : imovel.recomendacao === 'AGUARDAR' ? '🟡' : '🔴'} ${imovel.titulo || imovel.endereco || 'Imóvel'} — Score ${(imovel.score_total || 0).toFixed(1)}`,
        desc,
        idLabels: labelIds,
        due: imovel.data_leilao ? new Date(imovel.data_leilao.split('/').reverse().join('-')).toISOString() : null
      })
    }
  )
  if (!res.ok) throw new Error(`Trello card error: ${res.status}`)
  return await res.json()
}

// ── Criar lista "Manual de Métricas" no board ───────────────────
export async function criarManualMetricas(boardId, key, token) {
  const resLista = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '📚 Manual de Métricas LEILAX', pos: 'top' })
    }
  )
  if (!resLista.ok) throw new Error('Erro ao criar lista Manual')
  const lista = await resLista.json()

  const cards = [
    {
      name: '📖 Como funciona o Score LEILAX',
      desc: `# Sistema de Score LEILAX

O score de cada imóvel é calculado de 0 a 10 usando 6 dimensões ponderadas:

|Dimensão        |Peso|O que avalia                                     |
|----------------|----|-------------------------------------------------|
|📍 Localização   |20% |Infraestrutura, transporte, comércio, valorização|
|💸 Desconto      |18% |% de desconto sobre valor de avaliação           |
|⚖️ Risco Jurídico|18% |Processos, matrícula, débitos, ônus              |
|🏠 Ocupação      |15% |Se está desocupado ou ocupado                    |
|📊 Liquidez      |15% |Facilidade de revenda no mercado local           |
|🏙️ Mercado       |14% |Comparativo com preços e demanda da região       |

## Penalizações automáticas:

- Score jurídico < 4 → penalização de -25% no score total
- Imóvel ocupado → penalização de -15% no score total

## Classificação:

- 🟢 7.5 a 10.0 → COMPRAR
- 🟡 6.0 a 7.4 → AGUARDAR
- 🔴 0.0 a 5.9 → EVITAR`
    },
    {
      name: '📍 Critério: Localização (20%)',
      desc: `# Dimensão: Localização

**Peso no score:** 20%

## O que avaliar:

- Distância do centro / hub comercial
- Transporte público (metrô, BRT, terminal) em até 500m → +2 pts
- Comércio essencial (mercado, farmácia, banco) em até 1km → +1 pt
- Escola e hospital próximos → +1 pt
- Obras de valorização previstas na região → +2 pts
- Histórico de valorização acima do IPCA → +1 pt

## Escala:

- 9-10: Localização prime, alta valorização garantida
- 7-8: Boa localização, demanda consistente
- 5-6: Localização mediana, mercado moderado
- 3-4: Localização periférica, liquidez mais lenta
- 0-2: Localização ruim, alto risco de vacância`
    },
    {
      name: '💸 Critério: Desconto (18%)',
      desc: `# Dimensão: Desconto

**Peso no score:** 18%

## Escala de desconto:

|Desconto     |Score|Avaliação  |
|-------------|-----|-----------|
|Acima de 50% |9-10 |Excepcional|
|40% a 50%    |8-9  |Excelente  |
|30% a 40%    |7-8  |Muito bom  |
|20% a 30%    |5-7  |Bom        |
|10% a 20%    |3-5  |Aceitável  |
|Abaixo de 10%|0-3  |Fraco      |

## Atenção:

- Desconto alto com jurídico fraco não compensa
- Sempre cruze com valor de mercado real (não só avaliação)
- Custo de reforma pode neutralizar o desconto`
    },
    {
      name: '⚖️ Critério: Risco Jurídico (18%)',
      desc: `# Dimensão: Risco Jurídico

**Peso no score:** 18%
**⚠️ Score < 4 ativa penalização de -25% no score total**

## Checklist de due diligence (Pedro):

- [ ] Matrícula atualizada (máx 30 dias) — sem ônus ou gravames
- [ ] Certidão negativa de débitos municipais (IPTU)
- [ ] Certidão negativa condominial
- [ ] Pesquisa processual TJ + CNJ
- [ ] Verificar se há ação anulatória do leilão
- [ ] Confirmar modalidade (SFI = proteção STJ; extrajudicial = risco)
- [ ] Checar se há inquilino com contrato vigente

## Escala:

- 9-10: Matrícula limpa, sem processos, CND emitida
- 7-8: Pequenas pendências sanáveis antes do registro
- 5-6: Débitos menores que o desconto compensa
- 3-4: Processo em andamento, risco real de evicção
- 0-2: Múltiplos processos, matrícula bloqueada, EVITAR`
    },
    {
      name: '🏠 Critério: Ocupação (15%)',
      desc: `# Dimensão: Ocupação

**Peso no score:** 15%
**⚠️ Imóvel ocupado ativa penalização de -15% no score total**

## Escala:

|Situação                         |Score|Observação                  |
|---------------------------------|-----|----------------------------|
|Desocupado (confirmado no edital)|9-10 |Ideal                       |
|Desocupado (não confirmado)      |7-8  |Verificar in loco           |
|Ocupado por inquilino c/ contrato|4-6  |Depende do contrato         |
|Ocupado pelo devedor             |2-4  |Ação de imissão necessária  |
|Situação desconhecida            |4-5  |Provisão de risco necessária|

## Custo estimado de desocupação:

- Ação de imissão na posse: R$ 5.000 a R$ 20.000
- Prazo médio: 6 a 18 meses
- Risco de danos ao imóvel: prever 5-10% do valor`
    },
    {
      name: '📊 Critério: Liquidez (15%)',
      desc: `# Dimensão: Liquidez

**Peso no score:** 15%

## O que avaliar:

- Tempo médio de venda de similares na região
- Volume de transações nos últimos 12 meses
- Demanda por locação (taxa de vacância da região)
- Facilidade de financiamento pelo comprador final

## Escala:

|Prazo de revenda estimado|Score|
|-------------------------|-----|
|Até 3 meses              |9-10 |
|3 a 6 meses              |7-8  |
|6 a 12 meses             |5-7  |
|12 a 24 meses            |3-5  |
|Acima de 24 meses        |0-3  |`
    },
    {
      name: '🏙️ Critério: Mercado (14%)',
      desc: `# Dimensão: Mercado

**Peso no score:** 14%

## Indicadores:

- Preço/m² do imóvel vs. preço/m² de mercado
- Tendência de valorização da região (6 meses)
- Demanda atual (Alta/Média/Baixa)
- Novos lançamentos na região (concorrência)

## Comparativo preço/m²:

|Desconto vs. mercado    |Score|
|------------------------|-----|
|Abaixo de 50% do mercado|9-10 |
|50% a 70% do mercado    |7-8  |
|70% a 85% do mercado    |5-7  |
|85% a 95% do mercado    |3-5  |
|Acima de 95%            |0-3  |`
    },
    {
      name: '✅ Checklist Pré-Lance',
      desc: `# Checklist Obrigatório Antes de Qualquer Lance

## Jurídico (Pedro) ⚖️

- [ ] Matrícula atualizada (30 dias)
- [ ] Certidão negativa de IPTU
- [ ] Certidão negativa condominial
- [ ] Pesquisa TJ + CNJ sem processos relevantes
- [ ] Edital lido integralmente
- [ ] Modalidade identificada (SFI / Licitação / Venda Online)

## Técnico (Carlos) 🏗️

- [ ] Vistoria presencial ou fotos detalhadas
- [ ] Estimativa de custo de reforma
- [ ] Verificação de irregularidades construtivas
- [ ] Avaliação de padrão construtivo

## Comercial (Juliana/Felipe) 💼

- [ ] Pesquisa de mercado (preço/m² da região)
- [ ] Imóveis similares à venda / alugados na região
- [ ] Demanda de locação confirmada
- [ ] Retorno estimado calculado

## Financeiro (Todos) 💰

- [ ] Capital disponível confirmado por todos os sócios
- [ ] Estrutura de aquisição definida (CPF / Condomínio / PJ)
- [ ] Acordo de Copropriedade assinado (se condomínio)
- [ ] Reserva de 10% para imprevistos separada
- [ ] Conta bancária com saldo para o boleto

## Operacional (Gabriel) ⚙️

- [ ] Cadastros PF ativos no portal CAIXA
- [ ] Proposta registrada no prazo
- [ ] Boleto emitido e pago no prazo
- [ ] Contato com cartório de registro identificado`
    },
    {
      name: '📋 Fluxo: Edital → Registro',
      desc: `# Fluxo Operacional Completo

## Fase 1: Seleção (semanas 1-2)

1. Juliana/Felipe identificam imóveis no portal CAIXA
1. LEILAX analisa automaticamente (Claude + ChatGPT)
1. Score calculado com pesos do grupo
1. Grupo decide quais entram na due diligence

## Fase 2: Due Diligence (semana 3-4)

1. Pedro: análise jurídica completa
1. Carlos: vistoria técnica e estimativa de reforma
1. Gabriel: logística, prazos, estrutura de aquisição
1. Reunião de decisão → APROVADO ou DESCARTADO

## Fase 3: Lance (semana 5)

1. Todos os sócios com cadastro ativo no portal
1. Acordo de Copropriedade assinado (se condomínio)
1. Capital disponível confirmado nas contas
1. Lance/proposta registrado no portal CAIXA

## Fase 4: Arrematação (semanas 6-7)

1. Homologação confirmada
1. Boleto emitido (prazo do edital)
1. Pagamento realizado (TED identificado de cada sócio)
1. Assinatura do instrumento

## Fase 5: Registro (semanas 8-10)

1. ITBI calculado e pago
1. Escritura ou instrumento particular assinado
1. Apresentação ao Cartório de Registro de Imóveis
1. Prazo do edital respeitado (geralmente 30 dias)
1. Matrícula com frações dos coproprietários

## Fase 6: Pós-Registro

1. Seguro do imóvel contratado
1. IPTU transferido para o novo proprietário
1. Condomínio notificado da transferência
1. Estratégia de saída definida (venda ou locação)`
    },
    {
      name: '🎯 Critérios de Aprovação do Grupo',
      desc: `# Critérios Mínimos para Aprovação

## Score mínimo para análise aprofundada: 6.0

## Score mínimo para aprovação: 7.0

## Score ideal para lance imediato: 8.0+

## Critérios eliminatórios (qualquer um = EVITAR):

- Score jurídico < 3 → risco de evicção alto demais
- Imóvel com ação anulatória do leilão em andamento
- Débito condominial > 20% do valor do imóvel sem previsão de CND
- Localização com desvalorização documentada
- Capital do grupo insuficiente para o lance mínimo + custas

## Critérios de bonificação (aumentam score):

- Desocupado + FGTS aceito + Financiável = +0.5 pts
- Desconto > 40% + Jurídico limpo = +0.5 pts
- Localização prime com obra de valorização prevista = +0.5 pts

## Quórum para aprovação:

- Score 7.0 a 7.9: precisa de 3/4 sócios aprovando
- Score 8.0 a 8.9: precisa de 2/4 sócios aprovando
- Score 9.0+: pode avançar com decisão do admin`
    }
  ]

  for (const card of cards) {
    try {
      await fetch(
        `https://api.trello.com/1/cards?key=${key}&token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idList: lista.id,
            name: card.name,
            desc: card.desc
          })
        }
      )
    } catch {}
  }

  return lista
}

// ── Setup inicial do board LEILAX ──────────────────────────────
export async function setupBoardLeilax(boardId, key, token) {
  await criarEtiquetasBoard(boardId, key, token)
  await criarManualMetricas(boardId, key, token)
  const listas = [
    '🔍 Em Análise',
    '⚖️ Due Diligence',
    '✅ Aprovados para Lance',
    '🏆 Arrematados',
    '🚫 Descartados'
  ]
  for (const nome of listas) {
    try {
      await fetch(
        `https://api.trello.com/1/boards/${boardId}/lists?key=${key}&token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nome, pos: 'bottom' })
        }
      )
    } catch {}
  }
}
