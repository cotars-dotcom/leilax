/**
 * AXIS — Agente de Análise de Leilão
 * Custo zero: cálculo interno baseado em modelos arquivados no banco
 * Fallback Gemini Flash-Lite (~$0,001) para síntese textual
 */

import { supabase } from './supabase.js'
import { IPTU_SOBRE_CONDO_RATIO, HOLDING_MESES_PADRAO } from './constants.js'

// ─── MOTOR DE CÁLCULO INTERNO (sem API) ─────────────────────────────────────

function calcularCustos(lance, params) {
  const { comissao_leiloeiro, itbi_bh, documentacao, advogado, registro_fixo } = params.custos_percentuais
  const comissao  = lance * comissao_leiloeiro
  const itbi      = lance * itbi_bh
  const doc       = lance * documentacao
  const adv       = lance * advogado
  const reg       = registro_fixo
  return { comissao, itbi, doc, adv, reg }
}

function calcularCenario(lance, vmercado, reforma, juridico, params, extras = {}) {
  const c = calcularCustos(lance, params)
  const corr_pct  = params.custos_percentuais.corretagem_venda
  const irpf_pct  = params.custos_percentuais.irpf_ganho_capital
  // Sprint 23: débitos do arrematante e holding entram em todo cenário
  const debitos   = parseFloat(extras.debitos || 0)
  const holding   = parseFloat(extras.holding || 0)
  const custoTotal = lance + c.comissao + c.itbi + c.doc + c.adv + c.reg + reforma + (juridico||0) + debitos + holding
  const irpf      = Math.max(0, (vmercado - custoTotal) * irpf_pct)
  const corretagem = vmercado * corr_pct
  const lucro     = vmercado - custoTotal - irpf - corretagem
  const roi       = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0
  const mao       = vmercado * params.thresholds.margem_seguranca_mao - (c.comissao + c.itbi + c.doc + c.adv + c.reg + reforma + (juridico||0) + debitos + holding)
  return {
    custo_total: Math.round(custoTotal), irpf: Math.round(irpf),
    corretagem: Math.round(corretagem), lucro: Math.round(lucro),
    roi: parseFloat(roi.toFixed(1)), mao: Math.round(mao),
    debitos: Math.round(debitos), holding: Math.round(holding),
    viavel: lance <= mao
  }
}

export async function gerarAnalise(imovel) {
  // 1. Carregar modelos do banco (custo zero)
  const { data: modelos } = await supabase
    .from('modelos_analise')
    .select('nome, conteudo')
    .in('nome', ['regras_leilao_trt_mg', 'regras_mercado_bh'])
    .eq('ativo', true)

  const regraLeilao  = modelos?.find(m => m.nome === 'regras_leilao_trt_mg')?.conteudo || {}
  const regraMercado = modelos?.find(m => m.nome === 'regras_mercado_bh')?.conteudo || {}
  const params       = { ...regraLeilao, custos_percentuais: { ...regraLeilao.custos_percentuais } }

  const {
    valor_minimo: lance1, valor_avaliacao: aval, valor_mercado_estimado: vmercado,
    custo_reforma_calculado: reforma, custo_juridico_estimado: juridico,
    comparaveis, area_m2, area_privativa_m2, area_usada_calculo_m2, preco_m2_imovel, preco_m2_mercado,
    num_leilao, data_leilao, classe_ipead, aluguel_mensal_estimado: aluguel,
    prazo_liberacao_estimado_meses: prazoLib,
    condominio_mensal, iptu_mensal, debitos_total_estimado, responsabilidade_debitos
  } = imovel

  const areaCalculo = area_usada_calculo_m2 || area_privativa_m2 || area_m2

  const avaliacao  = parseFloat(aval) || 0
  const lancePrin  = parseFloat(lance1) || 0
  const vMercado   = parseFloat(vmercado) || lancePrin * 1.4
  const reformaVal = parseFloat(reforma) || 0
  const jurVal     = parseFloat(juridico) || 0

  // Sprint 23: débitos a cargo do arrematante e holding entram em todo cenário
  const debitos = responsabilidade_debitos === 'arrematante'
    ? parseFloat(debitos_total_estimado || 0) : 0
  const condoM = parseFloat(condominio_mensal || 0)
  const iptuM  = parseFloat(iptu_mensal || 0) || Math.round(condoM * IPTU_SOBRE_CONDO_RATIO)
  const holding = HOLDING_MESES_PADRAO * (condoM + iptuM)
  const extras = { debitos, holding }

  // 2. Projeção 2º leilão
  const hist = regraLeilao.historico_arrematacao || {}
  const lance2Piso    = avaliacao * (hist.piso_legal_pct / 100)
  const lance2Esp     = avaliacao * (hist.media_historica_pct / 100)
  const lance2Comp    = avaliacao * (hist.cenario_competitivo_pct / 100)

  // 3. Cenários de ROI (com débitos + holding incluídos — Sprint 23)
  const c1  = calcularCenario(lancePrin, vMercado, reformaVal, jurVal, params, extras)
  const c2p = calcularCenario(lance2Piso, vMercado, reformaVal, jurVal, params, extras)
  const c2e = calcularCenario(lance2Esp,  vMercado, reformaVal, jurVal, params, extras)
  const c2c = calcularCenario(lance2Comp, vMercado, reformaVal, jurVal, params, extras)

  const cenarios = [
    { label: `${num_leilao || 1}º Leilão (atual)`, lance: Math.round(lancePrin), ...c1 },
    { label: '2º — Piso legal (50%)', lance: Math.round(lance2Piso), ...c2p },
    { label: '2º — Esperado (57%)', lance: Math.round(lance2Esp), ...c2e },
    { label: '2º — Competitivo (65%)', lance: Math.round(lance2Comp), ...c2c },
  ]

  // 4. Redução de custo
  const custos1 = calcularCustos(lancePrin, params)
  const reducoes = (regraMercado.reducoes_custo || []).map(r => {
    let economia = r.economia_rel_pct ? reformaVal * (r.economia_rel_pct / 100) : null
    return { ...r, economia: economia || ((r.economia_min + r.economia_max) / 2) }
  })
  const reformaMin = avaliacao * 0.03
  const economiaReforma = reformaVal - reformaMin
  const custo_otimizado = lancePrin + custos1.comissao + custos1.itbi * 0.85 +
    custos1.doc + custos1.adv * 0.75 + custos1.reg + reformaMin + jurVal
  const irpfOtim = Math.max(0, (vMercado - custo_otimizado) * params.custos_percentuais.irpf_ganho_capital)
  const corrOtim = vMercado * params.custos_percentuais.corretagem_venda
  const lucroOtim = vMercado - custo_otimizado - irpfOtim - corrOtim
  const roiOtim = (lucroOtim / custo_otimizado) * 100

  // 5. Probabilidade de venda
  const cmps = (comparaveis || []).map(c => parseFloat(c.valor)).filter(Boolean)
  const mediaCmp = cmps.length ? cmps.reduce((a,b)=>a+b,0)/cmps.length : vMercado
  const { desconto_conserv, desconto_otimista } = regraMercado.probabilidades_venda || {}
  const vendaConservMin = Math.round(mediaCmp * (desconto_conserv || 0.92) * 0.97)
  const vendaConservMax = Math.round(mediaCmp * (desconto_conserv || 0.92) * 1.03)
  const vendaRealMin    = Math.round(mediaCmp * 0.97)
  const vendaRealMax    = Math.round(mediaCmp * 1.03)
  const vendaOtimMin    = Math.round(mediaCmp * (desconto_otimista || 1.07) * 0.97)
  const vendaOtimMax    = Math.round(mediaCmp * (desconto_otimista || 1.07) * 1.03)

  // 6. Alertas e estratégia
  const alertas = []
  if (c1.roi < 20) alertas.push('[CRITICO] ROI abaixo de 20% no 1º leilão — verificar viabilidade')
  if (!c1.viavel) alertas.push('[CRITICO] Lance atual acima do MAO — risco de prejuízo')
  if (reformaVal > avaliacao * 0.05) alertas.push('[ATENCAO] Reforma acima do teto — risco de sobrecapitalização')
  if (prazoLib > 6) alertas.push(`[ATENCAO] Prazo de liberação estimado: ${prazoLib} meses — capital imobilizado`)

  const estrategia = c1.viavel && c1.roi >= 25 ? 'lance_1'
    : c2e.roi > c1.roi * 1.15 ? 'aguardar_2' : 'lance_1'

  const analise = {
    imovel_id: imovel.id,
    codigo_axis: imovel.codigo_axis,
    modelo_ia: 'interno',
    num_leilao: parseInt(num_leilao) || 1,
    data_leilao,
    avaliacao_judicial: avaliacao,
    lance_minimo_1: lancePrin,
    desconto_1_pct: avaliacao > 0 ? parseFloat(((1 - lancePrin/avaliacao)*100).toFixed(1)) : 0,
    desconto_mercado_pct: vMercado > 0 ? parseFloat(((1 - lancePrin/vMercado)*100).toFixed(1)) : 0,
    valor_mercado: vMercado,
    valor_pos_reforma: parseFloat(imovel.valor_pos_reforma_estimado) || null,
    area_m2: parseFloat(areaCalculo),
    preco_m2_imovel: parseFloat(preco_m2_imovel),
    preco_m2_mercado: parseFloat(preco_m2_mercado),
    lance_2_piso: Math.round(lance2Piso),
    lance_2_esperado: Math.round(lance2Esp),
    lance_2_competitivo: Math.round(lance2Comp),
    prob_piso_pct: hist.probabilidades?.piso || 15,
    prob_esperado_pct: hist.probabilidades?.esperado || 55,
    prob_competitivo_pct: hist.probabilidades?.competitivo || 30,
    fonte_historico: hist.fonte || 'ABRAIM 2024-2025',
    cenarios,
    custo_comissao: Math.round(custos1.comissao),
    custo_itbi: Math.round(custos1.itbi),
    custo_documentacao: Math.round(custos1.doc),
    custo_advogado: Math.round(custos1.adv),
    custo_registro: custos1.reg,
    custo_reforma: reformaVal,
    custo_juridico: jurVal,
    custo_total_1: c1.custo_total,
    irpf_ganho_capital: c1.irpf,
    corretagem_venda: c1.corretagem,
    lucro_liquido_1: c1.lucro,
    roi_1_pct: c1.roi,
    mao_flip: c1.mao,
    lance_viavel: c1.viavel,
    reducoes_disponiveis: reducoes,
    custo_total_otimizado: Math.round(custo_otimizado),
    roi_otimizado_pct: parseFloat(roiOtim.toFixed(1)),
    reforma_minima_segura: Math.round(reformaMin),
    economia_total_possivel: Math.round(economiaReforma + 5000),
    faixa_venda_conserv_min: vendaConservMin,
    faixa_venda_conserv_max: vendaConservMax,
    faixa_venda_realista_min: vendaRealMin,
    faixa_venda_realista_max: vendaRealMax,
    faixa_venda_otimista_min: vendaOtimMin,
    faixa_venda_otimista_max: vendaOtimMax,
    prob_conserv_pct: regraMercado.probabilidades_venda?.conservadora_pct || 35,
    prob_realista_pct: regraMercado.probabilidades_venda?.realista_pct || 50,
    prob_otimista_pct: regraMercado.probabilidades_venda?.otimista_pct || 15,
    media_comparaveis: Math.round(mediaCmp),
    n_comparaveis: cmps.length,
    risco_principal: imovel.riscos_presentes ? 'Riscos presentes no imóvel — verificar antes do lance' : 'Sem riscos críticos identificados',
    protecao_legal: 'Débitos anteriores se sub-rogam no preço. Leilão judicial garante segurança formal.',
    capital_imobilizado_meses: prazoLib || 0,
    custo_oportunidade_anual: Math.round((c1.custo_total * 0.12)),
    estrategia,
    lance_maximo_1: c1.mao,
    lance_maximo_2: c2e.mao,
    sintese: `Desconto de ${(100 - lancePrin/vMercado*100).toFixed(1)}% sobre mercado. ROI ${c1.roi}% no 1º leilão${c2e.roi > c1.roi ? ` ou ${c2e.roi}% no 2º (esperado)` : ''}. ${c1.viavel ? 'Lance atual dentro do MAO.' : 'Lance acima do MAO — atenção.'} ${estrategia === 'aguardar_2' ? 'Recomendado aguardar 2º leilão.' : 'Recomendado participar do 1º leilão.'}`,
    alertas_criticos: alertas,
    recomendacoes: [
      `Lance máximo 1º leilão: R$ ${c1.mao.toLocaleString('pt-BR')} (MAO flip 20% margem)`,
      `Lance esperado 2º leilão: R$ ${Math.round(lance2Esp).toLocaleString('pt-BR')} — ROI ${c2e.roi}%`,
      `Reforma mínima segura: R$ ${Math.round(reformaMin).toLocaleString('pt-BR')} (3% avaliação)`,
      prazoLib > 0 ? `Provisionar desocupação: ${prazoLib} meses de capital imobilizado` : 'Imóvel desocupado — menor risco operacional'
    ]
  }

  return analise
}

export async function salvarAnalise(analise, userId) {
  const { data, error } = await supabase
    .from('analises_leilao')
    .upsert({ ...analise, gerado_por: userId, atualizado_em: new Date().toISOString() },
      { onConflict: 'imovel_id', ignoreDuplicates: false })
    .select().single()
  if (error) throw error
  return data
}

export async function carregarAnalise(imovelId) {
  const { data } = await supabase
    .from('analises_leilao')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('gerado_em', { ascending: false })
    .limit(1)
    .single()
  return data
}
