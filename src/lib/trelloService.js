// ═══════════════════════════════════════════════════════════════
// AXIS — Trello Service
// Workspace: AXIS Patrimonial
// Board único: "AXIS — Pipeline de Imóveis"
// Estrutura mínima: 6 listas + 1 board de métricas
// ═══════════════════════════════════════════════════════════════

const BASE_URL = 'https://api.trello.com/1'

// ── Helpers ─────────────────────────────────────────────────────
async function trello(method, path, body, key, token) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE_URL}${path}${sep}key=${key}&token=${token}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Trello ${method} ${path}: ${res.status} — ${err}`)
  }
  return res.json()
}

// ── ESTRUTURA DO BOARD AXIS ──────────────────────────────────────
//
// BOARD: "AXIS — Pipeline de Imóveis"
// ├── 📥 ENTRADA (análise pendente)
// ├── 🔍 EM ANÁLISE (Claude+GPT processando)
// ├── ⚖️ DUE DILIGENCE (Pedro valida jurídico)
// ├── ✅ APROVADOS (prontos para lance)
// ├── 🏆 ARREMATADOS (lançados/adquiridos)
// └── 🚫 DESCARTADOS (EVITAR + justificativa)
//
// BOARD AUXILIAR: "AXIS — Manual e Métricas"
// ├── 📚 Manual de Métricas (cards estáticos)
// ├── ⚖️ Base Jurídica
// └── 📊 Parâmetros de Score

// Criar estrutura completa do workspace AXIS
export async function setupWorkspaceAxis(key, token) {
  const resultados = {
    boards: {},
    lists: {},
    labels: {},
    erros: []
  }

  // ── BOARD 1: Pipeline de Imóveis ──────────────────────────────
  try {
    const board1 = await trello('POST', '/boards', {
      name: 'AXIS — Pipeline de Imóveis',
      desc: 'Gestão completa de oportunidades imobiliárias | Visão de Oportunidade. Base de Confiança.',
      defaultLists: false,
      prefs_background: 'green',
    }, key, token)
    resultados.boards.pipeline = board1.id

    const LISTAS_PIPELINE = [
      { name: '📥 Entrada',         pos: 1 },
      { name: '🔍 Em Análise',      pos: 2 },
      { name: '⚖️ Due Diligence',   pos: 3 },
      { name: '✅ Aprovados',       pos: 4 },
      { name: '🏆 Arrematados',     pos: 5 },
      { name: '🚫 Descartados',     pos: 6 },
    ]
    for (const lista of LISTAS_PIPELINE) {
      const l = await trello('POST', '/lists', { idBoard: board1.id, ...lista }, key, token)
      resultados.lists[lista.name] = l.id
    }

    // Etiquetas do board pipeline
    const ETIQUETAS = [
      { name: '🟢 COMPRAR',          color: 'green'   },
      { name: '🟡 AGUARDAR',         color: 'yellow'  },
      { name: '🔴 EVITAR',           color: 'red'     },
      { name: '⭐ Score ≥ 7.5',      color: 'lime'    },
      { name: '📊 Score 6–7.4',      color: 'sky'     },
      { name: '⚠️ Score < 6',        color: 'orange'  },
      { name: '🏠 Desocupado',       color: 'green'   },
      { name: '🔒 Ocupado',          color: 'red'     },
      { name: '❓ Ocupação incerta', color: 'orange'  },
      { name: '💰 Financiável',      color: 'sky'     },
      { name: '💎 FGTS aceito',      color: 'blue'    },
      { name: '⚖️ Due Diligence OK', color: 'green'   },
      { name: '⚠️ Risco jurídico',   color: 'red'     },
      { name: '🔄 Reclassificado',   color: 'purple'  },
      { name: '🤖 Análise dupla IA', color: 'pink'    },
    ]
    for (const et of ETIQUETAS) {
      try {
        const lbl = await trello('POST', `/boards/${board1.id}/labels`, et, key, token)
        resultados.labels[et.name] = lbl.id
      } catch {}
    }
  } catch (e) {
    resultados.erros.push(`Board Pipeline: ${e.message}`)
  }

  // ── BOARD 2: Manual e Métricas ────────────────────────────────
  try {
    const board2 = await trello('POST', '/boards', {
      name: 'AXIS — Manual e Métricas',
      desc: 'Base de conhecimento, parâmetros de score e base jurídica',
      defaultLists: false,
      prefs_background: 'blue',
    }, key, token)
    resultados.boards.manual = board2.id

    const LISTAS_MANUAL = [
      { name: '📚 Manual de Métricas', pos: 1 },
      { name: '⚖️ Base Jurídica',      pos: 2 },
      { name: '📊 Parâmetros de Score', pos: 3 },
    ]
    for (const lista of LISTAS_MANUAL) {
      const l = await trello('POST', '/lists', { idBoard: board2.id, ...lista }, key, token)
      resultados.lists[lista.name] = l.id
    }

    // Popular o Manual de Métricas
    await popularManualMetricas(resultados.lists['📚 Manual de Métricas'], key, token)
    await popularBaseJuridica(resultados.lists['⚖️ Base Jurídica'], key, token)
  } catch (e) {
    resultados.erros.push(`Board Manual: ${e.message}`)
  }

  return resultados
}

// Popular Manual de Métricas
async function popularManualMetricas(listId, key, token) {
  const cards = [
    {
      name: '📖 Sistema de Score AXIS',
      desc: `# Score AXIS — 0 a 10 por dimensão

## Pesos das dimensões:

| Dimensão | Peso |
|---|---|
| 📍 Localização | 20% |
| 💸 Desconto | 18% |
| ⚖️ Risco Jurídico | 18% |
| 🏠 Ocupação | 15% |
| 📈 Liquidez | 15% |
| 🏙️ Mercado | 14% |

## Penalizações:

- Score jurídico < 4 → ×0,75
- Imóvel ocupado → ×0,85
- Risco enchente alto → ×0,80

## Classificação final:

- 🟢 7,5 a 10,0 → COMPRAR
- 🟡 6,0 a 7,4 → AGUARDAR
- 🔴 0,0 a 5,9 → EVITAR`
    },
    {
      name: '✅ Checklist Pré-Lance',
      desc: `# Checklist obrigatório antes de qualquer lance

## Jurídico (Pedro) ⚖️

- [ ] Matrícula atualizada (máx. 30 dias)
- [ ] Certidão negativa de IPTU
- [ ] Certidão negativa condominial
- [ ] Pesquisa TJ + CNJ
- [ ] Edital lido integralmente
- [ ] Modalidade identificada

## Técnico (Carlos) 🏗️

- [ ] Vistoria presencial ou fotos
- [ ] Estimativa de reforma
- [ ] Irregularidades construtivas

## Financeiro (Todos) 💰

- [ ] Capital confirmado por todos os sócios
- [ ] Estrutura de aquisição definida
- [ ] Acordo de Copropriedade assinado
- [ ] Reserva de 10% para imprevistos

## Operacional (Gabriel) ⚙️

- [ ] Cadastros PF ativos no portal CAIXA
- [ ] Proposta registrada no prazo
- [ ] Boleto emitido e pago`
    },
    {
      name: '📋 Fluxo Operacional: Edital → Registro',
      desc: `# Fases da operação

## Fase 1: Seleção (semanas 1-2)

1. Juliana/Felipe identificam imóveis
2. AXIS analisa automaticamente
3. Grupo decide due diligence

## Fase 2: Due Diligence (semanas 3-4)

1. Pedro: análise jurídica completa
2. Carlos: vistoria técnica
3. Gabriel: logística e estrutura

## Fase 3: Lance (semana 5)

1. Todos com cadastro ativo
2. Capital disponível confirmado
3. Lance/proposta no portal

## Fase 4: Arrematação (semanas 6-7)

1. Homologação e boleto
2. Pagamento identificado

## Fase 5: Registro (semanas 8-10)

1. ITBI pago
2. Instrumento assinado
3. Registro no RI`
    },
    {
      name: '🎯 Critérios de Aprovação do Grupo',
      desc: `# Quórum de aprovação AXIS

Score mínimo para análise: **6,0**
Score mínimo para aprovação: **7,0**
Score ideal para lance imediato: **8,0+**

## Critérios eliminatórios:

- Score jurídico < 3
- Ação anulatória do leilão em andamento
- Débito condominial > 20% do valor
- Capital insuficiente

## Quórum:

- Score 7,0–7,9 → 3/4 sócios aprovando
- Score 8,0–8,9 → 2/4 sócios aprovando
- Score 9,0+ → decisão do admin`
    },
  ]
  for (const card of cards) {
    try { await trello('POST', '/cards', { idList: listId, ...card }, key, token) } catch {}
  }
}

// Popular Base Jurídica
async function popularBaseJuridica(listId, key, token) {
  const cards = [
    {
      name: '⚖️ Leilão Judicial vs CAIXA — Diferenças críticas',
      desc: `# Regras por modalidade

## Leilão Judicial

- IPTU anterior: STJ protege arrematante (sub-roga no preço)
- Condomínio: CPC/2015 sub-roga no preço
- Imóvel ocupado: imissão na posse (60 dias a 24 meses)

## Leilão CAIXA / Extrajudicial

- IPTU: **FICA COM O COMPRADOR** (FAQ CAIXA oficial)
- Condomínio: **FICA COM O COMPRADOR**
- Comissão leiloeiro: 5% do valor arrematado
- Obrigação: LEITURA INTEGRAL DO EDITAL

⚠️ Sempre verificar modalidade antes de qualquer análise.`
    },
    {
      name: '🏗️ Custos Processuais TJMG 2025',
      desc: `# Tabela de custas — Minas Gerais

## Imissão na posse / Reintegração

- Mínimo formal: R$ 514,38
- Faixa residencial: R$ 602,88 a R$ 3.008,86
- Diligência imissão: + R$ 141,70
- Por endereço urbano: + R$ 35,40
- Arrombamento/remoção: + R$ 177,10

## Despejo (inquilino regular)

- Aluguel R$ 2.500/mês (causa R$ 30k): R$ 779,98
- Aluguel R$ 5.000/mês (causa R$ 60k): R$ 1.227,99
- Com arrombamento: + R$ 177,10

## Agravo de instrumento

- R$ 331,86 por agravo

## Prazos práticos:

- Ex-mutuário fiduciário: 4–24 meses
- Inquilino regular: 2–18 meses
- Janela pós-arrematação: 10 dias`
    },
  ]
  for (const card of cards) {
    try { await trello('POST', '/cards', { idList: listId, ...card }, key, token) } catch {}
  }
}

// ── Criar card do imóvel com fotos e métricas ────────────────────
export async function criarCardImovel(imovel, listId, boardId, key, token) {
  // Buscar labels existentes
  let labelIds = []
  try {
    const labels = await trello('GET', `/boards/${boardId}/labels?limit=50`, null, key, token)
    const mapear = (contém) => labels.find(l => l.name?.includes(contém))?.id

    const rec = imovel.recomendacao
    if (rec === 'COMPRAR')  { const l = mapear('COMPRAR');  if (l) labelIds.push(l) }
    if (rec === 'AGUARDAR') { const l = mapear('AGUARDAR'); if (l) labelIds.push(l) }
    if (rec === 'EVITAR')   { const l = mapear('EVITAR');   if (l) labelIds.push(l) }

    const sc = imovel.score_total || 0
    if (sc >= 7.5) { const l = mapear('Score ≥'); if (l) labelIds.push(l) }
    else if (sc >= 6) { const l = mapear('Score 6'); if (l) labelIds.push(l) }
    else { const l = mapear('Score < 6'); if (l) labelIds.push(l) }

    if (imovel.ocupacao === 'Desocupado') { const l = mapear('Desocupado'); if (l) labelIds.push(l) }
    if (imovel.ocupacao === 'Ocupado')    { const l = mapear('Ocupado');    if (l) labelIds.push(l) }
    if (imovel.financiavel)               { const l = mapear('Financiável'); if (l) labelIds.push(l) }
    if (imovel.analise_dupla_ia)          { const l = mapear('dupla IA');   if (l) labelIds.push(l) }
    if (imovel.reclassificado_por_doc)    { const l = mapear('Reclassificado'); if (l) labelIds.push(l) }
  } catch {}

  const fmt = n => n ? `R$ ${Number(n).toLocaleString('pt-BR')}` : '—'
  const pct = n => n ? `${Number(n).toFixed(1)}%` : '—'
  const sc  = n => n !== undefined ? `${Number(n).toFixed(1)}/10` : '—'
  const rec = imovel.recomendacao === 'COMPRAR' ? '🟢'
    : imovel.recomendacao === 'AGUARDAR' ? '🟡' : '🔴'

  const desc = `${rec} **${imovel.recomendacao || 'AGUARDAR'}** · Score AXIS: **${(imovel.score_total||0).toFixed(1)}/10**

---

## 📍 ${imovel.titulo || imovel.endereco || 'Imóvel'}

- **Endereço:** ${imovel.endereco || '—'}
- **Cidade/UF:** ${imovel.cidade || '—'}/${imovel.estado || '—'}
- **Tipo:** ${imovel.tipo || '—'} | **Área:** ${imovel.area_m2 || '—'}m²
- **${imovel.quartos || '—'}Q** / **${imovel.suites || '—'}S** / **${imovel.vagas || '—'}V** | Andar ${imovel.andar || '—'}

---

## 💰 Valores

| Campo | Valor |
|---|---|
| Avaliação | ${fmt(imovel.valor_avaliacao)} |
| Lance mínimo | ${fmt(imovel.valor_minimo)} |
| Desconto | ${pct(imovel.desconto_percentual)} |
| Preço/m² imóvel | ${fmt(imovel.preco_m2_imovel)}/m² |
| Preço/m² mercado | ${fmt(imovel.preco_m2_mercado)}/m² |
| Aluguel estimado | ${fmt(imovel.aluguel_mensal_estimado)}/mês |
| Modalidade | ${imovel.modalidade_leilao || imovel.modalidade || '—'} |

---

## 📊 Score AXIS por Dimensão

| Dimensão | Score |
|---|---|
| 📍 Localização | ${sc(imovel.score_localizacao)} |
| 💸 Desconto | ${sc(imovel.score_desconto)} |
| ⚖️ Jurídico | ${sc(imovel.score_juridico)} |
| 🏠 Ocupação | ${sc(imovel.score_ocupacao)} |
| 📈 Liquidez | ${sc(imovel.score_liquidez)} |
| 🏙️ Mercado | ${sc(imovel.score_mercado)} |

---

## ⚖️ Jurídico

- **Ocupação:** ${imovel.ocupacao || '—'}
- **Financiável:** ${imovel.financiavel ? '✅' : '❌'}
- **FGTS:** ${imovel.fgts_aceito ? '✅' : '❌'}
- **IPTU:** ${imovel.debitos_iptu || '—'}
- **Condomínio:** ${imovel.debitos_condominio || '—'}
- **Processos:** ${imovel.processos_ativos || 'Nenhum identificado'}

---

## 💡 Análise AXIS

${(imovel.positivos||[]).map(p=>`✅ ${p}`).join('\n') || '—'}
${(imovel.alertas||[]).map(a=>`⚠️ ${a}`).join('\n') || ''}
${(imovel.negativos||[]).map(n=>`❌ ${n}`).join('\n') || ''}

**Justificativa:** ${imovel.justificativa || '—'}

---
*Analisado pelo AXIS Intelligence · Motor Duplo IA*
${imovel.fonte_url ? `🔗 [Ver anúncio](${imovel.fonte_url})` : ''}`

  const nomeCard = `${rec} ${imovel.titulo || imovel.endereco || 'Imóvel'} · ${(imovel.score_total||0).toFixed(1)}`

  const card = await trello('POST', '/cards', {
    idList: listId,
    name: nomeCard,
    desc,
    idLabels: labelIds,
    due: (() => {
      try {
        const [d,m,a] = (imovel.data_leilao||'').split('/')
        return a ? new Date(`${a}-${m}-${d}`).toISOString() : null
      } catch { return null }
    })(),
  }, key, token)

  // Foto de capa
  if (imovel.foto_principal && card.id) {
    try {
      await trello('POST', `/cards/${card.id}/attachments`, {
        url: imovel.foto_principal, name: 'Foto Principal', setCover: true
      }, key, token)
    } catch {}
  }

  // Fotos extras (até 4)
  for (const foto of (imovel.fotos||[]).slice(1, 5)) {
    try { await trello('POST', `/cards/${card.id}/attachments`, { url: foto, name: 'Foto' }, key, token) } catch {}
  }

  // Checklist de due diligence
  try {
    const chk = await trello('POST', '/checklists', {
      idCard: card.id, name: '✅ Checklist Due Diligence'
    }, key, token)
    const items = [
      '⚖️ Matrícula atualizada (30 dias)',
      '⚖️ Certidão negativa IPTU',
      '⚖️ Certidão negativa condominial',
      '⚖️ Pesquisa TJ + CNJ',
      '⚖️ Edital lido integralmente',
      '🏗️ Vistoria / fotos detalhadas',
      '🏗️ Estimativa de reforma',
      '💰 Capital disponível confirmado',
      '💰 Estrutura de aquisição definida',
      '💰 Acordo de Copropriedade assinado',
      '📋 Proposta registrada no prazo',
      '📋 Boleto emitido e pago',
    ]
    for (const item of items) {
      await trello('POST', `/checklists/${chk.id}/checkItems`, { name: item, checked: false }, key, token)
    }
  } catch {}

  return card
}

// ── Auditar board existente ──────────────────────────────────────
export async function auditarBoard(boardId, key, token) {
  const resultado = {
    board: null, listas: [], cards_total: 0,
    cards_sem_foto: [], cards_sem_checklist: [],
    cards_sem_labels: [], erros: []
  }
  try {
    resultado.board = await trello('GET', `/boards/${boardId}?fields=name,desc,url`, null, key, token)
    const listas = await trello('GET', `/boards/${boardId}/lists?filter=open`, null, key, token)
    resultado.listas = listas.map(l => ({ id: l.id, nome: l.name }))

    const cards = await trello('GET', `/boards/${boardId}/cards?fields=id,name,idLabels,cover,desc`, null, key, token)
    resultado.cards_total = cards.length

    for (const card of cards) {
      if (!card.cover?.idAttachment) resultado.cards_sem_foto.push(card.name)
      if (!card.idLabels?.length)    resultado.cards_sem_labels.push(card.name)
      // Verificar checklists
      try {
        const chks = await trello('GET', `/cards/${card.id}/checklists`, null, key, token)
        if (!chks?.length) resultado.cards_sem_checklist.push(card.name)
      } catch {}
    }
  } catch (e) {
    resultado.erros.push(e.message)
  }
  return resultado
}

// ── Atualizar card existente ─────────────────────────────────────
export async function atualizarCardImovel(cardId, imovel, key, token) {
  const rec = imovel.recomendacao === 'COMPRAR' ? '🟢'
    : imovel.recomendacao === 'AGUARDAR' ? '🟡' : '🔴'
  await trello('PUT', `/cards/${cardId}`, {
    name: `${rec} ${imovel.titulo || imovel.endereco || 'Imóvel'} · ${(imovel.score_total||0).toFixed(1)}`,
  }, key, token)
}

// ── Mover card entre listas ──────────────────────────────────────
export async function moverCard(cardId, novaListaId, key, token) {
  return trello('PUT', `/cards/${cardId}`, { idList: novaListaId }, key, token)
}

// ── Buscar boards do workspace ───────────────────────────────────
export async function getBoardsAxis(key, token) {
  return trello('GET', '/members/me/boards?filter=open&fields=id,name,desc,url,prefs', null, key, token)
}

// ── Buscar listas de um board ────────────────────────────────────
export async function getListasBoard(boardId, key, token) {
  return trello('GET', `/boards/${boardId}/lists?filter=open`, null, key, token)
}

// ── Backward compat: setupBoardLeilax → alias ────────────────────
export const setupBoardLeilax = async (boardId, key, token) => {
  // Legacy: creates workspace structure when called with old API
  return setupWorkspaceAxis(key, token)
}
