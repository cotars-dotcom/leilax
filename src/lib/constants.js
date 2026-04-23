// ─── Thresholds canônicos de recomendação (usar em TODOS os módulos) ───────
export const SCORE_COMPRAR  = 7.5
export const SCORE_AGUARDAR = 6.0

/** Converte score 0-10 em recomendação — fonte única de verdade */
export function recomendacaoDeScore(score) {
  const s = parseFloat(score) || 0
  if (s >= SCORE_COMPRAR)  return 'COMPRAR'
  if (s >= SCORE_AGUARDAR) return 'AGUARDAR'
  return 'EVITAR'
}

/**
 * Gera justificativa acionável contextual da recomendação (sprint 41c).
 * Substitui textos genéricos tipo "AGUARDAR" por orientação operacional:
 * identifica o principal fator limitante e sugere condição concreta de viabilidade.
 *
 * @param {Object} p imóvel
 * @returns {string|null} texto curto (≤140 chars) com ação clara, ou null
 */
export function justificativaAcionavel(p) {
  if (!p) return null
  const rec = p.recomendacao
  const score = parseFloat(p.score_total) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const debitos = p.responsabilidade_debitos === 'arrematante'
    ? parseFloat(p.debitos_total_estimado || 0) : 0
  const pctDeb = mercado > 0 ? (debitos / mercado) * 100 : 0
  const maoFlip = parseFloat(p.mao_flip) || 0
  const lance2 = parseFloat(p.valor_minimo_2) || 0
  const lance1 = parseFloat(p.valor_minimo) || 0
  const fmt = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')

  if (rec === 'COMPRAR') {
    if (lance2 > 0 && maoFlip > 0 && lance2 <= maoFlip) {
      return `Lance na 2ª praça (${fmt(lance2)}) dentro do limite de flip — oportunidade clara.`
    }
    return `Score acima de ${SCORE_COMPRAR} — imóvel aprovado para lance.`
  }

  if (rec === 'AGUARDAR') {
    // Encontrar o maior fator limitante
    const scoresRuins = []
    if (parseFloat(p.score_juridico) < 6.0) scoresRuins.push({ k: 'juridico', v: p.score_juridico })
    if (parseFloat(p.score_desconto) < 6.0) scoresRuins.push({ k: 'desconto', v: p.score_desconto })
    if (parseFloat(p.score_ocupacao) < 6.0) scoresRuins.push({ k: 'ocupacao', v: p.score_ocupacao })
    if (parseFloat(p.score_liquidez) < 6.0) scoresRuins.push({ k: 'liquidez', v: p.score_liquidez })

    // Débitos altos é o cenário mais comum de AGUARDAR
    if (pctDeb >= 10 && debitos > 0) {
      const maoAjustado = maoFlip > 0 ? Math.round(maoFlip * 0.95) : null
      if (maoAjustado && lance1 > maoAjustado) {
        return `Débitos = ${pctDeb.toFixed(0)}% do mercado. Oportunidade se lance ≤ ${fmt(maoAjustado)} ou débitos renegociados.`
      }
      return `Débitos = ${pctDeb.toFixed(0)}% do mercado pesam no jurídico. Monitorar redução via acordo ou 3ª praça.`
    }

    if (scoresRuins.length > 0) {
      const pior = scoresRuins.sort((a, b) => a.v - b.v)[0]
      const label = { juridico: 'jurídico', desconto: 'desconto', ocupacao: 'ocupação', liquidez: 'liquidez' }[pior.k]
      return `Ponto fraco: ${label} (${pior.v}/10). Monitorar edital de 2ª praça ou queda adicional no lance mínimo.`
    }

    if (lance2 > 0 && maoFlip > 0 && lance2 > maoFlip) {
      const gap = Math.round(((lance2 - maoFlip) / maoFlip) * 100)
      return `2ª praça (${fmt(lance2)}) está ${gap}% acima do limite de flip. Aguardar 3ª praça ou evitar.`
    }

    return `Score ${score.toFixed(1)}/10 — próximo do corte. Revisar dados ou aguardar melhores condições.`
  }

  if (rec === 'EVITAR' || rec === 'INVIAVEL') {
    if (pctDeb >= 25) {
      return `Débitos excessivos (${pctDeb.toFixed(0)}% do mercado). Inviável sem renegociação prévia com credores.`
    }
    if (lance1 > 0 && mercado > 0 && lance1 > mercado * 0.95) {
      return `Lance mínimo próximo ou acima do mercado. Sem margem para operação lucrativa.`
    }
    return `Score ${score.toFixed(1)}/10 abaixo do mínimo viável.`
  }

  return null
}

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

/** Cadeia canônica de área para cálculos financeiros */
export const areaUsada = (p) =>
  parseFloat(p?.area_usada_calculo_m2 || p?.area_privativa_m2 || p?.area_m2) || 0

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

// ─── IRPF GANHO DE CAPITAL — ISENÇÃO ────────────────────────────────────────
// Lei 9.250/1995 art. 23: isenção para venda de imóvel residencial único ≤ R$440.000
// ou reinvestimento em outro imóvel em 180 dias (art. 39 Lei 11.196/2005).
// O AXIS não pode verificar se é único imóvel — sinaliza como potencial isenção.
export const IRPF_ISENCAO_TETO = 440000  // valor de venda do imóvel, não do ganho

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
  // Sprint 23: custo jurídico (due diligence, análise processual) entra no investimento
  const custoJuridico = parseFloat(imovel.custo_juridico_estimado || 0)
  const totalCustos = comissao + itbi + doc + advogado
  const investimentoTotal = lance + totalCustos + reforma + holding + debitosArrematante + custoJuridico
  
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
    custoJuridico: Math.round(custoJuridico),
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
  // Verificar potencial isenção de IRPF (Lei 9.250/1995 + Lei 11.196/2005)
  const potencialIsencaoIRPF = valorMercado <= IRPF_ISENCAO_TETO
  // Sprint 23: deduzir corretagem (6% padrão de venda) para convergir com CalculadoraROI/RoiLiveBanner
  const CORRETAGEM_VENDA = 0.06
  const vendaLiquida = valorMercado * (1 - CORRETAGEM_VENDA)
  const lucro = vendaLiquida - investimentoTotal
  const roi = (lucro / investimentoTotal) * 100
  const safeRoi = v => Math.max(-100, Math.min(999, Math.round(v * 10) / 10))

  const roiCenario = (valor) =>
    safeRoi(((valor * (1 - CORRETAGEM_VENDA) - investimentoTotal) / investimentoTotal) * 100)

  return {
    lucro: Math.round(lucro),
    roi: safeRoi(roi),
    cenarios: {
      realista:    { valor: Math.round(valorMercado),         roi: roiCenario(valorMercado) },
      otimista:    { valor: Math.round(valorMercado * 1.15),  roi: roiCenario(valorMercado * 1.15) },
      vendaRapida: { valor: Math.round(valorMercado * 0.90),  roi: roiCenario(valorMercado * 0.90) },
    },
    potencialIsencaoIRPF: potencialIsencaoIRPF,
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
export function calcularCustoHolding(condominio = 0, meses = HOLDING_MESES_PADRAO, iptuMensal = null) {
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


// ─── SOBRECAPITALIZAÇÃO ───────────────────────────────────────────────────────
/**
 * Detecta sobrecapitalização: quando o custo de reforma ultrapassa o teto
 * razoável em relação ao valor de mercado pós-reforma.
 *
 * Regra geral de mercado BH:
 *   - Popular:  reforma ≤ 15% do mercado
 *   - Médio:    reforma ≤ 20% do mercado
 *   - Alto:     reforma ≤ 25% do mercado
 *   - Luxo:     reforma ≤ 30% do mercado (customização justifica)
 */
export const SOBRECAP_TETO_POR_CLASSE = {
  'Classe 1 - Popular': 0.15,
  'Classe 2 - Médio':   0.20,
  'Classe 3 - Alto':    0.25,
  'Classe 4 - Luxo':    0.30,
  default:              0.20,
}

export function calcularSobrecapitalizacao(custoReforma, valorMercado, classeIpead = '') {
  if (!custoReforma || !valorMercado || valorMercado <= 0) return { sobrecap: false, pct: 0, teto: 0.20 }
  const classeNorm = normalizarClasseIPEAD(classeIpead)
  const teto = SOBRECAP_TETO_POR_CLASSE[classeNorm] || SOBRECAP_TETO_POR_CLASSE.default
  const pct = custoReforma / valorMercado
  return {
    sobrecap: pct > teto,
    pct: Math.round(pct * 1000) / 10,  // em %
    teto: Math.round(teto * 100),       // em %
    gravidade: pct > teto * 2 ? 'critico' : pct > teto * 1.5 ? 'alto' : 'moderado',
    mensagem: pct > teto
      ? `Reforma representa ${(pct*100).toFixed(0)}% do valor do imóvel (teto recomendado: ${(teto*100).toFixed(0)}%)`
      : null,
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


// ─── NORMALIZAÇÃO DE CLASSE IPEAD ─────────────────────────────────────────────
// Banco usa: "Medio", "Popular", "Alto", "Luxo"
// constants usa: "Classe 2 - Médio", "Classe 1 - Popular", etc.
export function normalizarClasseIPEAD(raw) {
  if (!raw) return 'Classe 2 - Médio'
  const r = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (r.includes('popular') || r.includes('1'))  return 'Classe 1 - Popular'
  if (r.includes('luxo') || r.includes('4'))     return 'Classe 4 - Luxo'
  if (r.includes('alto') || r.includes('3'))     return 'Classe 3 - Alto'
  return 'Classe 2 - Médio'  // médio / medio / default
}

// ─── VALORIZAÇÃO PÓS-REFORMA POR CLASSE IPEAD ────────────────────────────────
// Calibrado por tipo de mercado: popular tem teto de absorção menor,
// luxo tem retornos menores pois já começa em patamar elevado.
// Referências: pesquisa IBAPE/SP hedônico, FipeZap variação segmento 2023-2025
export const VALORIZACAO_REFORMA_POR_CLASSE = {
  'Classe 1 - Popular': { basica: 2,  media: 7,  completa: 15 },
  'Classe 2 - Médio':   { basica: 4,  media: 12, completa: 22 },
  'Classe 3 - Alto':    { basica: 5,  media: 14, completa: 28 },
  'Classe 4 - Luxo':    { basica: 3,  media: 10, completa: 24 },
  // fallback quando classe não mapeada
  default:              { basica: 4,  media: 12, completa: 22 },
}

export function calcularMatrizInvestimento(p, opts = {}) {
  if (!p) return null

  const lance = opts.lance || parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const eMercado = opts.eMercado != null ? opts.eMercado : false
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const area = parseFloat(p.area_usada_calculo_m2 || p.area_privativa_m2 || p.area_m2) || 0
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
  // Calibrar valorização por classe IPEAD do imóvel
  const classeIpead = normalizarClasseIPEAD(p.classe_ipead || p.classe_ipead_label)
  const fvTab = VALORIZACAO_REFORMA_POR_CLASSE[classeIpead] || VALORIZACAO_REFORMA_POR_CLASSE.default
  const CENARIOS = [
    { id: 'sem_reforma',  label: 'Sem Reforma',   fvPct: 0,          alugFator: 0.90, cor: '#8E8EA0' },
    { id: 'basica',       label: 'Básica',         fvPct: fvTab.basica,   alugFator: 1.00, cor: '#3B8BD4' },
    { id: 'media',        label: 'Média',          fvPct: fvTab.media,    alugFator: 1.08, cor: '#D4A017' },
    { id: 'completa',     label: 'Completa',       fvPct: fvTab.completa, alugFator: 1.20, cor: '#D05538' },
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

    const sobrecap = calcularSobrecapitalizacao(custoReforma, mercadoAjustado, classeIpead)
    return {
      ...cen,
      custoReforma,
      sobrecap: sobrecap.sobrecap,
      sobrecapPct: sobrecap.pct,
      sobrecapGravidade: sobrecap.gravidade,
      sobrecapMensagem: sobrecap.mensagem,
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
  // Usar mercado bruto passado explicitamente, ou valor_mercado_estimado do banco
  const mercado = opts.mercadoBruto || parseFloat(p.valor_mercado_estimado) || 0
  const eMercado = opts.eMercado || false
  const custos = eMercado ? CUSTOS_MERCADO : CUSTOS_LEILAO
  const pctCustos = (custos.comissao_leiloeiro_pct + custos.itbi_pct + custos.advogado_pct + custos.documentacao_pct) / 100
  const custoReforma = opts.custoReforma || parseFloat(p.custo_reforma_estimado || p.custo_reforma_calculado) || 0
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMeses = opts.holdingMeses || HOLDING_MESES_PADRAO
  const holdingTotal = holdingMeses * (condoMensal + iptuMensal)
  const registroFixo = custos.registro_fixo ?? 0
  // Débitos a cargo do arrematante entram como custo fixo no MAO
  const debitosArrematante = p.responsabilidade_debitos === 'arrematante'
    ? parseFloat(p.debitos_total_estimado || 0) : 0

  // MAO = (valorVenda / (1 + ROI%) - custos_fixos) / (1 + pctCustos%)
  // custos_fixos = registro + reforma + holding + débitos
  const valorVenda = mercado * 0.94  // 6% corretagem de venda
  const targetInvest = valorVenda / (1 + roiAlvo / 100)
  const custosFixos = registroFixo + custoReforma + holdingTotal + debitosArrematante
  const lanceMax = (targetInvest - custosFixos) / (1 + pctCustos)

  return Math.max(0, Math.round(lanceMax))
}
