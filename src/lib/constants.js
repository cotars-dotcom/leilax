/**
 * AXIS — Constantes centralizadas
 * 
 * FONTE ÚNICA DE VERDADE para pesos, custos e modelos.
 * Qualquer alteração aqui propaga para todo o sistema.
 */

// ─── PESOS DO SCORE 6D (soma = 1.00) ────────────────────────────
export const SCORE_PESOS = {
  localizacao: 0.20,
  desconto:    0.18,
  juridico:    0.18,
  ocupacao:    0.15,
  liquidez:    0.15,
  mercado:     0.14,
}

// ─── CUSTOS PERCENTUAIS — LEILÃO ─────────────────────────────────
export const CUSTOS_LEILAO = {
  comissao_leiloeiro_pct: 5.0,     // % sobre lance
  itbi_pct:               3.0,     // % BH desde 2024
  advogado_pct:           2.0,     // % honorários
  documentacao_pct:       0.5,     // % cartório/registro
  registro_fixo:          1500,    // R$ fixo
  corretagem_venda_pct:   6.0,     // % sobre preço de venda
  irpf_ganho_capital_pct: 15.0,    // % sobre ganho
}

// ─── CUSTOS PERCENTUAIS — MERCADO DIRETO ─────────────────────────
export const CUSTOS_MERCADO = {
  comissao_leiloeiro_pct: 0.0,     // sem leiloeiro
  itbi_pct:               3.0,     // % BH
  advogado_pct:           0.0,     // sem necessidade
  documentacao_pct:       0.5,     // % cartório/registro
  registro_fixo:          1500,    // R$ fixo
  corretagem_venda_pct:   6.0,     // % sobre preço de venda
  irpf_ganho_capital_pct: 15.0,    // % sobre ganho
}

// ─── MULTIPLICADOR RÁPIDO PARA ESTIMATIVA CUSTO TOTAL ────────────
// Mercado: ITBI 3% + doc 0.5% = ~3.5%
// Leilão:  comissão 5% + ITBI 3% + adv 2% + doc 0.5% = ~10.5%
export const MULT_CUSTO_RAPIDO = {
  mercado: 0.035,
  leilao:  0.105,
}

// ─── MODELOS IA — CASCATA ────────────────────────────────────────
export const MODELOS_GEMINI = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',        // fallback — desliga jun/2026
]

export const MODELOS_GEMINI_PRO = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
]

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
export const CLAUDE_HAIKU = 'claude-haiku-4-5-20251001'
export const ANTHROPIC_VERSION = '2023-06-01'

// ─── CUSTO POR TOKEN (USD/1M tokens) ────────────────────────────
export const CUSTO_POR_TOKEN = {
  'claude-sonnet-4-20250514':  { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00,  output: 5.00 },
  'deepseek-chat':             { input: 0.14,  output: 0.28 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60 },
  'gemini-2.5-flash':          { input: 0.15,  output: 0.60 },
  'gemini-2.5-flash-lite':     { input: 0.075, output: 0.30 },
  'gemini-2.5-pro':            { input: 1.25,  output: 10.00 },
  'gemini-2.0-flash':          { input: 0.075, output: 0.30 },
  'gemini-1.5-flash':          { input: 0.075, output: 0.30 },
  'gemini-2.0-flash-lite':     { input: 0.038, output: 0.15 },
  'gemini-1.5-pro':            { input: 1.25,  output: 5.00 },
}

// ─── HELPER: calcular score total ────────────────────────────────
export function calcularScoreTotal(scores) {
  return parseFloat((
    (scores.score_localizacao || 0) * SCORE_PESOS.localizacao +
    (scores.score_desconto    || 0) * SCORE_PESOS.desconto +
    (scores.score_juridico    || 0) * SCORE_PESOS.juridico +
    (scores.score_ocupacao    || 0) * SCORE_PESOS.ocupacao +
    (scores.score_liquidez    || 0) * SCORE_PESOS.liquidez +
    (scores.score_mercado     || 0) * SCORE_PESOS.mercado
  ).toFixed(2))
}

// ─── HELPER: calcular custos de aquisição ────────────────────────
export function calcularCustosAquisicao(precoBase, isMercado, overrides = {}) {
  if (!precoBase || precoBase <= 0) return { precoBase: 0, comissao: 0, itbi: 0, advogado: 0, documentacao: 0, registro: 0, total: 0, percentual_total: '0', invalido: true }
  const tabela = isMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  // Filtrar overrides nulos/undefined para não sobrescrever defaults com NaN
  const cleanOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, v]) => v != null && v !== undefined)
  )
  const custos = { ...tabela, ...cleanOverrides }
  
  const comissao = precoBase * (custos.comissao_leiloeiro_pct / 100)
  const itbi     = precoBase * (custos.itbi_pct / 100)
  const adv      = precoBase * (custos.advogado_pct / 100)
  const doc      = precoBase * (custos.documentacao_pct / 100)
  const reg      = custos.registro_fixo
  
  const total = precoBase + comissao + itbi + adv + doc + reg
  
  return {
    precoBase: Math.round(precoBase),
    comissao: Math.round(comissao),
    itbi: Math.round(itbi),
    advogado: Math.round(adv),
    documentacao: Math.round(doc),
    registro: Math.round(reg),
    total: Math.round(total),
    percentual_total: ((total - precoBase) / precoBase * 100).toFixed(1),
  }
}

// ─── HELPER: chamar Gemini com cascata ───────────────────────────
export async function chamarGeminiCascata(prompt, geminiKey, opts = {}) {
  const {
    modelos = MODELOS_GEMINI,
    maxTokens = 2048,
    temperature = 0.1,
    timeout = 45000,
    onProgress = () => {},
  } = opts

  let ultimoErro = null
  let modeloUsado = null

  for (const modelo of modelos) {
    onProgress(`Gemini (${modelo})...`)
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature, maxOutputTokens: maxTokens }
          }),
          signal: AbortSignal.timeout(timeout)
        }
      )
      if (!r.ok) {
        const errTxt = await r.text().catch(() => '')
        console.warn(`[AXIS] ${modelo} HTTP ${r.status}:`, errTxt.substring(0, 120))
        if (r.status === 400 && errTxt.includes('API_KEY_INVALID')) break
        ultimoErro = new Error(`${modelo}: HTTP ${r.status}`)
        continue
      }
      const data = await r.json()
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!txt) { ultimoErro = new Error(`${modelo}: resposta vazia`); continue }
      modeloUsado = modelo
      return { texto: txt, modelo: modeloUsado }
    } catch (e) {
      console.warn(`[AXIS] ${modelo}:`, e.message)
      ultimoErro = e
    }
  }
  throw ultimoErro || new Error('Todos os modelos Gemini falharam')
}

// ─── HELPER: parse JSON de resposta IA ───────────────────────────
export function parseJSONResposta(texto) {
  const clean = texto.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('JSON não encontrado na resposta')
  return JSON.parse(match[0])
}

// ─── HOLDING COST ───────────────────────────────────────────────────
export const IPTU_SOBRE_CONDO_RATIO = 0.35   // regra geral BH: IPTU ≈ 35% do condo
export const HOLDING_MESES_PADRAO = 5

/** Calcula custo total incluindo aquisição + reforma + holding */
export function calcularCustoTotal(precoBase, isMercado, reforma = 0, holdingMeses = HOLDING_MESES_PADRAO, condoMensal = 0, iptuMensal = 0) {
  const aquisicao = calcularCustosAquisicao(precoBase, isMercado)
  const iptu = iptuMensal || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMensal = condoMensal + iptu
  const holding = holdingMeses * holdingMensal
  return {
    ...aquisicao,
    reforma: Math.round(reforma),
    holding: Math.round(holding),
    holdingMensal: Math.round(holdingMensal),
    holdingMeses,
    condoMensal: Math.round(condoMensal),
    iptuMensal: Math.round(iptu),
    totalCompleto: aquisicao.total + Math.round(reforma) + Math.round(holding),
  }
}

// ─── SPRINT 11: Breakdown Financeiro e ROI ─────────────────────────

/** Calcula breakdown completo dos custos de aquisição */
export function calcularBreakdownFinanceiro(lance, imovel = {}, eMercado = false) {
  const custos = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const comissaoPct = (imovel.comissao_leiloeiro_pct || custos.comissao_leiloeiro_pct || 5) / 100
  const itbiPct = (imovel.itbi_pct || custos.itbi_pct || 3) / 100
  const docPct = (custos.documentacao_pct || 0.5) / 100
  const advPct = (custos.advogado_pct || 0) / 100
  
  const comissao = lance * comissaoPct
  const itbi = lance * itbiPct
  const doc = lance * docPct + (custos.registro_fixo || 1500)
  const advogado = lance * advPct
  const reforma = parseFloat(imovel.custo_reforma_estimado || imovel.custo_reforma_calculado || 0)
  const condoMensal = parseFloat(imovel.condominio_mensal || 0)
  const iptuMensal = parseFloat(imovel.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMeses = HOLDING_MESES_PADRAO
  const holdingMensal = condoMensal + iptuMensal
  const holding = holdingMeses * holdingMensal
  const totalCustos = comissao + itbi + doc + advogado
  const investimentoTotal = lance + totalCustos + reforma + holding
  
  return {
    lance,
    comissao: { pct: comissaoPct, valor: Math.round(comissao) },
    itbi: { pct: itbiPct, valor: Math.round(itbi) },
    documentacao: { pct: docPct, valor: Math.round(doc) },
    advogado: { pct: advPct, valor: Math.round(advogado) },
    reforma: Math.round(reforma),
    holding: Math.round(holding),
    holdingMensal: Math.round(holdingMensal),
    holdingMeses,
    totalCustos: Math.round(totalCustos),
    investimentoTotal: Math.round(investimentoTotal),
    pctCustosSobreLance: ((totalCustos / lance) * 100).toFixed(1),
  }
}

/** Calcula ROI e cenários de saída */
export function calcularROI(investimentoTotal, valorMercado, aluguelMensal = 0) {
  if (!investimentoTotal || investimentoTotal <= 0 || !valorMercado || valorMercado <= 0) {
    return { lucro: 0, roi: 0, invalido: true, cenarios: { realista: { valor: 0, roi: 0 }, otimista: { valor: 0, roi: 0 }, vendaRapida: { valor: 0, roi: 0 } }, locacao: null }
  }
  const lucro = valorMercado - investimentoTotal
  const roi = (lucro / investimentoTotal) * 100
  const safeRoi = v => Math.max(-100, Math.min(999, Math.round(v * 10) / 10))
  
  return {
    lucro: Math.round(lucro),
    roi: safeRoi(roi),
    cenarios: {
      realista: { valor: Math.round(valorMercado), roi: safeRoi(roi) },
      otimista: { valor: Math.round(valorMercado * 1.15), roi: safeRoi(((valorMercado * 1.15 - investimentoTotal) / investimentoTotal) * 100) },
      vendaRapida: { valor: Math.round(valorMercado * 0.9), roi: safeRoi(((valorMercado * 0.9 - investimentoTotal) / investimentoTotal) * 100) },
    },
    locacao: aluguelMensal > 0 ? {
      aluguelMensal: Math.round(aluguelMensal),
      yieldAnual: Math.round((aluguelMensal * 12 / investimentoTotal) * 1000) / 10,
      paybackMeses: Math.round(investimentoTotal / aluguelMensal),
    } : null,
  }
}

// ─── SPRINT 15b: Custo de Holding ────────────────────────────────────────────
/**
 * Calcula custo de holding (IPTU + condomínio) durante o período pré-venda.
 * Regra BH: IPTU ≈ 35% do condomínio mensal.
 *
 * @param {number} condominio   - Condomínio mensal (R$)
 * @param {number} meses        - Meses de holding (padrão: 4)
 * @param {number|null} iptuMensal - IPTU mensal real; se null, estima por condomínio * 0.35
 * @returns {{ condominio, iptuMensal, meses, porMes, total }}
 */
export function calcularCustoHolding(condominio = 0, meses = 4, iptuMensal = null) {
  const cond = Math.round(condominio || 0)
  const iptu = iptuMensal != null ? Math.round(iptuMensal) : Math.round(cond * 0.35)
  const porMes = cond + iptu
  return {
    condominio: cond,
    iptuMensal: iptu,
    meses,
    porMes,
    total: Math.round(porMes * meses),
  }
}

/** Calcula preditor de concorrência (inspirado no Ninja) */
export function calcularPreditorConcorrencia(lanceMinimo, valorMercado, custos, incremento = 5000) {
  const niveis = [
    { label: '50% ROI', alvo: 0.50 },
    { label: '30% ROI', alvo: 0.30 },
    { label: '20% ROI', alvo: 0.20 },
    { label: '10% ROI', alvo: 0.10 },
    { label: 'Break-even', alvo: 0 },
  ]
  return niveis.map(n => {
    const investMax = valorMercado / (1 + n.alvo)
    const lanceMax = investMax - custos
    const numLances = Math.max(0, Math.floor((lanceMax - lanceMinimo) / incremento))
    const lanceAtual = lanceMinimo + (numLances * incremento)
    const investAtual = lanceAtual + custos
    const roiReal = investAtual > 0 ? ((valorMercado - investAtual) / investAtual) * 100 : 0
    return {
      ...n,
      numLances,
      lanceMax: Math.round(lanceMax),
      lanceAtual: Math.round(lanceAtual),
      investimento: Math.round(investAtual),
      lucro: Math.round(valorMercado - investAtual),
      roiReal: Math.round(roiReal * 10) / 10,
      viavel: numLances > 0,
    }
  }).filter(n => n.viavel)
}
