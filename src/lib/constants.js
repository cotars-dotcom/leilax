/**
 * AXIS — Constantes centralizadas
 * 
 * FONTE ÚNICA DE VERDADE para pesos, custos e modelos.
 * Qualquer alteração aqui propaga para todo o sistema.
 */

// ─── GUARD: parseFloat seguro (evita NaN propagando em cálculos) ─────
export const safeFloat = (v, def = 0) => {
  const n = parseFloat(v)
  return (isNaN(n) || !isFinite(n)) ? def : n
}
/** Clamp score no intervalo 0-10 */
export const clampScore = (v) => Math.max(0, Math.min(10, safeFloat(v, 0)))
/** Clamp percentual no intervalo razoável (-100% a 999%) */
const clampPct = (v) => Math.max(-100, Math.min(999, safeFloat(v, 0)))

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
// Validados: STJ (comissão 5%), Lei 5.492/1988 BH (ITBI 3%),
// OAB-MG/mercado (advogado 5%), TJ-MG Portaria 8.366/2025 (doc ~2.5%)
export const CUSTOS_LEILAO = {
  comissao_leiloeiro_pct: 5.0,     // % sobre lance — STJ mín 5% (Decreto 21.981/1932)
  itbi_pct:               3.0,     // % BH — Lei Municipal 5.492/1988 (art. 8º)
  advogado_pct:           5.0,     // % honorários — OAB-MG tabela + mercado BH (5-6%)
  documentacao_pct:       2.5,     // % cartório — emolumentos CRI-MG + TFJ + custas judiciais
  registro_fixo:          0,       // R$ (absorvido no % acima)
  corretagem_venda_pct:   6.0,     // % sobre preço de venda (revenda)
  irpf_ganho_capital_pct: 15.0,    // % sobre ganho — Lei 8.981/1995
}

// ─── CUSTOS PERCENTUAIS — MERCADO DIRETO ─────────────────────────
export const CUSTOS_MERCADO = {
  comissao_leiloeiro_pct: 0.0,     // sem leiloeiro
  itbi_pct:               3.0,     // % BH — Lei Municipal 5.492/1988
  advogado_pct:           0.0,     // sem necessidade (compra direta)
  documentacao_pct:       1.5,     // % cartório — escritura + registro (sem custas judiciais)
  registro_fixo:          0,       // R$ (absorvido no % acima)
  corretagem_venda_pct:   6.0,     // % sobre preço de venda
  irpf_ganho_capital_pct: 15.0,    // % sobre ganho
}

// ─── MULTIPLICADOR RÁPIDO PARA ESTIMATIVA CUSTO TOTAL ────────────
// Mercado: ITBI 3% + doc 1.5% = ~4.5%
// Leilão:  comissão 5% + ITBI 3% + adv 5% + doc 2.5% = ~15.5%
export const MULT_CUSTO_RAPIDO = {
  mercado: 0.045,
  leilao:  0.155,
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
    clampScore(scores.score_localizacao) * SCORE_PESOS.localizacao +
    clampScore(scores.score_desconto)    * SCORE_PESOS.desconto +
    clampScore(scores.score_juridico)    * SCORE_PESOS.juridico +
    clampScore(scores.score_ocupacao)    * SCORE_PESOS.ocupacao +
    clampScore(scores.score_liquidez)    * SCORE_PESOS.liquidez +
    clampScore(scores.score_mercado)     * SCORE_PESOS.mercado
  ).toFixed(2))
}

// ─── HELPER: calcular custos de aquisição ────────────────────────
export function calcularCustosAquisicao(precoBase, isMercado, overrides = {}) {
  const pb = safeFloat(precoBase)
  if (pb <= 0) return { precoBase: 0, comissao: 0, itbi: 0, advogado: 0, documentacao: 0, registro: 0, total: 0, percentual_total: '0', invalido: true }
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
export const HOLDING_MESES_PADRAO = 6          // prazo médio revenda BH (4-8m, usando 6 conservador)

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
  const doc = lance * docPct + (custos.registro_fixo ?? 0)
  const advogado = lance * advPct
  const reforma = parseFloat(imovel.custo_reforma_estimado || imovel.custo_reforma_calculado || 0)
  const condoMensal = parseFloat(imovel.condominio_mensal || 0)
  const iptuMensal = parseFloat(imovel.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMeses = HOLDING_MESES_PADRAO
  const holdingMensal = condoMensal + iptuMensal
  const holding = holdingMeses * holdingMensal
  // Débitos a cargo do arrematante (condomínio/IPTU propter rem — STJ)
  const debitosArrematante = imovel.responsabilidade_debitos === 'arrematante'
    ? parseFloat(imovel.debitos_total_estimado || 0)
    : 0
  const totalCustos = comissao + itbi + doc + advogado
  const investimentoTotal = lance + totalCustos + reforma + holding + debitosArrematante
  
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
    debitosArrematante: Math.round(debitosArrematante),
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

// ─── SPRINT 17: Fator de Homogeneização por Atributos (NBR 14653) ──────────

/**
 * Fatores de ajuste do valor de mercado com base nos atributos do imóvel.
 * Referência: NBR 14653-2 (Avaliação de Imóveis Urbanos) — fatores de homogeneização.
 */
export const FATORES_ATRIBUTOS = {
  // ─── Fatores estruturais (sem saturação) ─────────────────────
  elevador_presente:          { fator: 1.08,  label: 'Elevador',           descricao: 'Prédio com elevador', grupo: 'estrutural' },
  elevador_ausente_alto:      { fator: 0.87,  label: 'Sem elevador (>4and)', descricao: 'Sem elevador, prédio >4 andares', grupo: 'estrutural' },
  elevador_ausente_baixo:     { fator: 1.00,  label: 'Sem elevador (≤4and)', descricao: 'Sem elevador, prédio ≤4 andares (neutro)', grupo: 'estrutural' },
  portaria_24h:               { fator: 1.04,  label: 'Portaria 24h',       descricao: 'Portaria 24 horas', grupo: 'seguranca' },
  andar_alto:                 { fator: 1.05,  label: 'Andar alto (>8)',     descricao: 'Unidade em andar acima do 8º', grupo: 'estrutural' },
  idade_alta:                 { fator: 0.95,  label: 'Idade >30 anos',     descricao: 'Edificação com mais de 30 anos sem reforma relevante', grupo: 'estrutural' },
  // ─── Fatores de lazer (saturação ×0.80 quando 2+ presentes) ───
  piscina:                    { fator: 1.05,  label: 'Piscina',            descricao: 'Condomínio com piscina', grupo: 'lazer' },
  area_lazer:                 { fator: 1.03,  label: 'Área de lazer',      descricao: 'Área de lazer completa', grupo: 'lazer' },
  academia:                   { fator: 1.02,  label: 'Academia',           descricao: 'Condomínio com academia', grupo: 'lazer' },
  churrasqueira:              { fator: 1.01,  label: 'Churrasqueira',      descricao: 'Área de churrasqueira', grupo: 'lazer' },
}

// Fator de saturação para itens de lazer quando 2+ presentes (IBAPE/estudos hedônicos)
const SATURACAO_LAZER = 0.80

/**
 * Calcula o fator de homogeneização composto (fórmula ADITIVA IBAPE com saturação).
 * 
 * Fórmula: Vu = Vo × [1 + Σ(Fi - 1)]
 * Onde fatores de lazer são multiplicados por 0.80 quando 2+ presentes (saturação).
 * 
 * Referências: NBR 14653-2, IBAPE/SP 2011, Lima/COBREAP 2006, Lindenberg/FipeZAP
 * Teto prático: ~18-22% com todos os atributos presentes
 */
export function calcularFatorHomogeneizacao(p, valorBase = 0) {
  if (!p) return { fator: 1.0, ajustes: [], impactoTotal: 0 }

  const ajustes = []
  const andar = parseInt(p.andar) || 0
  const totalAndares = parseInt(p.total_andares) || 0
  const anoConst = parseInt(p.ano_construcao) || 0
  const idadeEdif = anoConst > 0 ? (new Date().getFullYear() - anoConst) : 0

  // Elevador — regra condicional por altura do prédio
  if (p.elevador === true) {
    ajustes.push({ key: 'elevador_presente', ...FATORES_ATRIBUTOS.elevador_presente })
  } else if (p.elevador === false) {
    if (totalAndares > 4 || (andar > 4 && !totalAndares)) {
      ajustes.push({ key: 'elevador_ausente_alto', ...FATORES_ATRIBUTOS.elevador_ausente_alto })
    } else {
      ajustes.push({ key: 'elevador_ausente_baixo', ...FATORES_ATRIBUTOS.elevador_ausente_baixo })
    }
  }

  // Amenidades booleanas
  if (p.piscina === true)      ajustes.push({ key: 'piscina',       ...FATORES_ATRIBUTOS.piscina })
  if (p.area_lazer === true)   ajustes.push({ key: 'area_lazer',    ...FATORES_ATRIBUTOS.area_lazer })
  if (p.portaria_24h === true) ajustes.push({ key: 'portaria_24h',  ...FATORES_ATRIBUTOS.portaria_24h })
  if (p.academia === true)     ajustes.push({ key: 'academia',      ...FATORES_ATRIBUTOS.academia })
  if (p.churrasqueira === true) ajustes.push({ key: 'churrasqueira', ...FATORES_ATRIBUTOS.churrasqueira })

  // Andar alto
  if (andar > 8) ajustes.push({ key: 'andar_alto', ...FATORES_ATRIBUTOS.andar_alto })

  // Idade alta sem reforma relevante
  if (idadeEdif > 30) ajustes.push({ key: 'idade_alta', ...FATORES_ATRIBUTOS.idade_alta })

  // ─── Fórmula ADITIVA IBAPE com saturação para lazer ─────────
  // Separar ajustes por grupo: lazer vs não-lazer
  const ajustesLazer = ajustes.filter(a => a.grupo === 'lazer')
  const ajustesOutros = ajustes.filter(a => a.grupo !== 'lazer')
  
  // Soma dos incrementos (Fi - 1) para não-lazer
  const somaOutros = ajustesOutros.reduce((acc, a) => acc + (a.fator - 1), 0)
  
  // Soma dos incrementos de lazer com saturação
  const somaLazerBruta = ajustesLazer.reduce((acc, a) => acc + (a.fator - 1), 0)
  const aplicaSaturacao = ajustesLazer.length >= 2
  const somaLazer = aplicaSaturacao ? somaLazerBruta * SATURACAO_LAZER : somaLazerBruta
  
  // Fórmula aditiva: Vu = Vo × [1 + Σ(Fi - 1)]
  const fator = 1 + somaOutros + somaLazer
  const fatorArredondado = Math.round(fator * 10000) / 10000

  // Impacto em R$ se valor base fornecido
  const valorAjustado = Math.round(valorBase * fatorArredondado)
  const impactoTotal = valorAjustado - Math.round(valorBase)

  // Enriquecer cada ajuste com impacto em R$ (com saturação refletida nos de lazer)
  const ajustesComImpacto = ajustes.map(a => {
    const incremento = a.fator - 1
    const incrementoEfetivo = (a.grupo === 'lazer' && aplicaSaturacao) ? incremento * SATURACAO_LAZER : incremento
    return {
      ...a,
      impactoR$: valorBase > 0 ? Math.round(valorBase * incrementoEfetivo) : 0,
      impactoPct: Math.round(incrementoEfetivo * 1000) / 10,
      saturado: a.grupo === 'lazer' && aplicaSaturacao,
    }
  })

  return {
    fator: fatorArredondado,
    ajustes: ajustesComImpacto,
    impactoTotal,
    valorAjustado,
    qtdAjustes: ajustes.length,
    saturacaoAplicada: aplicaSaturacao,
    somaLazerBruta: Math.round(somaLazerBruta * 1000) / 10,
    somaLazerEfetiva: Math.round(somaLazer * 1000) / 10,
  }
}

/**
 * Score de atributos para compor o score_total (sub-dimensão de Mercado).
 * Escala 0-10: penalizado por ausência de amenidades, bonificado pela presença.
 * Neutro (sem dados) = 5.0
 */
export function calcularScoreAtributos7D(p) {
  if (!p) return { score: 5.0, detalhes: [] }

  const homo = calcularFatorHomogeneizacao(p)
  if (homo.ajustes.length === 0) return { score: 5.0, detalhes: [], semDados: true }

  // Mapear fator composto para escala 0-10
  // fator 0.80 → score ~2, fator 1.00 → score 5, fator 1.30 → score 9.5
  const raw = 5.0 + (homo.fator - 1.0) * 50  // cada 1% = 0.5pt
  const score = Math.max(0, Math.min(10, Math.round(raw * 10) / 10))

  return { score, fator: homo.fator, detalhes: homo.ajustes }
}

// ─── SPRINT 17: Matriz Unificada de Investimento ────────────────────────────

/**
 * Calcula a Matriz Unificada de Investimento: 4 cenários de reforma × métricas.
 * FONTE ÚNICA para todos os painéis: PainelInvestimento, CenariosReforma,
 * PainelRentabilidade, CalculadoraROI, PDF, HTML, SharedViewer.
 *
 * @param {object} p - Imóvel do Supabase
 * @param {object} opts - { lance, eMercado, holdingMeses, reformaCustos }
 * @returns {object} { cenarios: [...], melhor: { flip, locacao } }
 */
export function calcularMatrizInvestimento(p, opts = {}) {
  if (!p) return null

  const lance = opts.lance || parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const eMercado = opts.eMercado != null ? opts.eMercado : false
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
  const holdingMeses = opts.holdingMeses || HOLDING_MESES_PADRAO
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMensal = condoMensal + iptuMensal
  const holdingTotal = holdingMeses * holdingMensal

  if (!lance || !mercado) return null

  // Homogeneização
  const homo = calcularFatorHomogeneizacao(p, mercado)
  const mercadoAjustado = homo.valorAjustado || mercado

  // Breakdown de aquisição
  const bd = calcularBreakdownFinanceiro(lance, p, eMercado)
  const custosAquisicao = bd.totalCustos

  // Fatores de valorização e aluguel por cenário
  const CENARIOS = [
    { id: 'sem_reforma',  label: 'Sem Reforma',   fvPct: 0,   alugFator: 0.90, cor: '#8E8EA0' },
    { id: 'basica',       label: 'Básica',         fvPct: 4,   alugFator: 1.00, cor: '#3B8BD4' },
    { id: 'media',        label: 'Média',          fvPct: 12,  alugFator: 1.08, cor: '#D4A017' },
    { id: 'completa',     label: 'Completa',       fvPct: 28,  alugFator: 1.20, cor: '#D05538' },
  ]

  // Custos de reforma — prioridade: opts > banco > SINAPI
  const reformaCustos = opts.reformaCustos || {}
  const getCustoReforma = (cenId) => {
    if (cenId === 'sem_reforma') return 0
    if (reformaCustos[cenId] > 0) return reformaCustos[cenId]
    const chaveBanco = `custo_reforma_${cenId}`
    if (parseFloat(p[chaveBanco]) > 0) return parseFloat(p[chaveBanco])
    // Fallback SINAPI (importação circular evitada — cálculo inline)
    const SINAPI_M2 = { basica: 375, media: 1070, completa: 2200 }  // classe B padrão
    return Math.round(area * (SINAPI_M2[cenId] || 1070))
  }

  const cenarios = CENARIOS.map(cen => {
    const custoReforma = getCustoReforma(cen.id)
    const investTotal = lance + custosAquisicao + custoReforma + holdingTotal
    const valorPos = Math.round(mercadoAjustado * (1 + cen.fvPct / 100))

    // Flip
    const lucroFlip = valorPos * 0.94 - investTotal  // 6% corretagem
    const roiFlip = investTotal > 0 ? Math.round((lucroFlip / investTotal) * 1000) / 10 : 0

    // Locação
    const alugMensal = aluguel > 0 ? Math.round(aluguel * cen.alugFator) : 0
    const yieldAnual = alugMensal > 0 && investTotal > 0 ? Math.round((alugMensal * 12 / investTotal) * 1000) / 10 : 0
    const paybackAnos = alugMensal > 0 ? Math.round(investTotal / (alugMensal * 12) * 10) / 10 : 0

    return {
      ...cen,
      custoReforma,
      investTotal,
      valorPos,
      lucroFlip: Math.round(lucroFlip),
      roiFlip,
      alugMensal,
      yieldAnual,
      paybackAnos,
    }
  })

  // Melhor cenário flip e locação
  const melhorFlip = cenarios.reduce((best, c) => c.roiFlip > best.roiFlip ? c : best, cenarios[0])
  const melhorLocacao = cenarios.reduce((best, c) => c.yieldAnual > best.yieldAnual ? c : best, cenarios[0])

  return {
    cenarios,
    melhorFlip: { id: melhorFlip.id, label: melhorFlip.label, roiFlip: melhorFlip.roiFlip, lucro: melhorFlip.lucroFlip },
    melhorLocacao: { id: melhorLocacao.id, label: melhorLocacao.label, yieldAnual: melhorLocacao.yieldAnual },
    bd,
    holdingTotal,
    holdingMensal,
    homo,
    mercadoAjustado,
  }
}

/**
 * Calcula o lance máximo para um ROI alvo.
 * @returns {number} Lance máximo em R$
 */
export function calcularLanceMaximoParaROI(roiAlvo, p, opts = {}) {
  if (!p) return 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const eMercado = opts.eMercado || false
  const custos = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const pctCustos = (custos.comissao_leiloeiro_pct + custos.itbi_pct + custos.advogado_pct + custos.documentacao_pct) / 100
  const custoReforma = opts.custoReforma || parseFloat(p.custo_reforma_estimado || p.custo_reforma_calculado) || 0
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMeses = opts.holdingMeses || HOLDING_MESES_PADRAO
  const holdingTotal = holdingMeses * (condoMensal + iptuMensal)
  const registroFixo = custos.registro_fixo ?? 0

  // valorVenda = mercado * 0.94 (- 6% corretagem)
  // investTotal = lance * (1 + pctCustos) + registroFixo + custoReforma + holdingTotal
  // ROI = (valorVenda - investTotal) / investTotal
  // Resolvendo para lance:
  const valorVenda = mercado * 0.94
  const targetInvest = valorVenda / (1 + roiAlvo / 100)
  const lanceMax = (targetInvest - registroFixo - custoReforma - holdingTotal) / (1 + pctCustos)

  return Math.max(0, Math.round(lanceMax))
}
