/**
 * AXIS — Agente de Reforma SINAPI
 * 
 * Calcula orçamento de reforma a partir de:
 * 1. itens_reforma (banco — calibrado BH 2026, fator 1.5×)
 * 2. SIDRA IBGE variação SINAPI (ajuste de índice)
 * 3. Fallback: VALORIZACAO_REFORMA_POR_CLASSE de constants.js
 */

import { supabase } from './supabase.js'
import { SOBRECAP_TETO_POR_CLASSE, calcularSobrecapitalizacao } from './constants.js'

/**
 * Busca itens de reforma do banco e calcula totais para a área dada.
 * @param {number} area_m2 — área útil de cálculo
 * @param {string} classeIpead — ex: "Classe 2 - Médio"
 * @returns {Promise<Object>} totais por cenário + lista de itens
 */
export async function calcularReformaSINAPI(area_m2, classeIpead = 'Classe 2 - Médio') {
  if (!area_m2 || area_m2 <= 0) return null

  const { data: itens, error } = await supabase
    .from('itens_reforma')
    .select('*')
    .eq('ativo', true)
    .order('cenario', { ascending: true })

  if (error || !itens?.length) {
    console.warn('[AXIS ReformaSINAPI] Sem itens no banco:', error?.message)
    return calcularFallback(area_m2, classeIpead)
  }

  // Calcular custo de cada item para a área fornecida
  const calcQtd = (item) => {
    if (item.qtd_formula === 'fixo')         return item.qtd_padrao
    if (item.qtd_formula === 'area')         return item.fator_area ? area_m2 * item.fator_area : item.qtd_padrao
    if (item.qtd_formula === 'perimetro')    return Math.sqrt(area_m2) * 4 * 0.8  // perimetro estimado
    if (item.qtd_formula === 'area_molhada') return item.qtd_padrao  // área molhada não escala com área total
    return item.qtd_padrao
  }

  const itensPorCenario = { basica: [], media: [], completa: [] }

  for (const item of itens) {
    const cenario = item.cenario?.toLowerCase()
    if (!itensPorCenario[cenario]) continue
    const qtd = calcQtd(item)
    const subtotal = Math.round(parseFloat(item.custo_unitario) * qtd)
    itensPorCenario[cenario].push({
      item: item.item,
      categoria: item.categoria,
      unidade: item.unidade,
      custo_unitario: parseFloat(item.custo_unitario),
      qtd: parseFloat(qtd.toFixed(1)),
      subtotal,
    })
  }

  const totalBasica    = itensPorCenario.basica.reduce((s, i) => s + i.subtotal, 0)
  const totalMedia     = itensPorCenario.media.reduce((s, i) => s + i.subtotal, 0)
  const totalCompleta  = itensPorCenario.completa.reduce((s, i) => s + i.subtotal, 0)

  // Valores acumulados (média = básica + itens médios)
  const mediaAcum    = totalBasica + totalMedia
  const completaAcum = mediaAcum + totalCompleta

  return {
    fonte: 'banco_itens_reforma',
    area_m2,
    classeIpead,
    cenarios: {
      basica:    { total: totalBasica,   r_m2: Math.round(totalBasica / area_m2),    itens: itensPorCenario.basica },
      media:     { total: mediaAcum,     r_m2: Math.round(mediaAcum / area_m2),      itens: [...itensPorCenario.basica, ...itensPorCenario.media] },
      completa:  { total: completaAcum,  r_m2: Math.round(completaAcum / area_m2),   itens: [...itensPorCenario.basica, ...itensPorCenario.media, ...itensPorCenario.completa] },
    },
    total_itens: itens.length,
  }
}

/**
 * Fallback quando banco não tem itens: usa pontos operacionais × área.
 * Sprint 41d: retorna valores ACUMULADOS para alinhar com o caminho principal
 * (banco_itens_reforma) e evitar que CenariosReforma/orquestrador exibam
 * valores inconsistentes. Antes: cada cenário era independente, mas o caminho
 * principal salva acumulados.
 */
function calcularFallback(area_m2, classeIpead) {
  // Pontos operacionais AXIS calibrados BH 2026 (Prompt 2)
  // Esses valores REPRESENTAM cada cenário independente (não acumulado).
  const PONTOS = {
    'Classe 1 - Popular': { basica: 700,  media: 1200, completa: 2000 },
    'Classe 2 - Médio':   { basica: 900,  media: 1550, completa: 2800 },
    'Classe 3 - Alto':    { basica: 1100, media: 1900, completa: 3500 },
    'Classe 4 - Luxo':    { basica: 1300, media: 2200, completa: 4200 },
    default:              { basica: 900,  media: 1550, completa: 2800 },
  }
  const p = PONTOS[classeIpead] || PONTOS.default
  // Calcular totais por cenário (independentes)
  const tBasica = Math.round(p.basica * area_m2)
  const tMediaInd = Math.round(p.media * area_m2)
  const tCompletaInd = Math.round(p.completa * area_m2)
  // Acumulados (mesmo padrão do retorno do banco_itens_reforma)
  const mediaAcum = tBasica + tMediaInd
  const completaAcum = mediaAcum + tCompletaInd
  return {
    fonte: 'fallback_pontos_operacionais',
    area_m2,
    classeIpead,
    cenarios: {
      basica:   { total: tBasica,        r_m2: p.basica },
      media:    { total: mediaAcum,      r_m2: Math.round(mediaAcum / area_m2) },
      completa: { total: completaAcum,   r_m2: Math.round(completaAcum / area_m2) },
    },
    total_itens: 0,
    nota: 'Pontos operacionais BH 2026 — banco de itens indisponível. Valores acumulados por cenário.',
  }
}

/**
 * Verifica sobrecapitalização para cada cenário
 */
export function auditarReforma(reforma, valorMercado, classeIpead) {
  if (!reforma || !valorMercado) return null
  return {
    basica:   calcularSobrecapitalizacao(reforma.cenarios.basica.total, valorMercado, classeIpead),
    media:    calcularSobrecapitalizacao(reforma.cenarios.media.total, valorMercado, classeIpead),
    completa: calcularSobrecapitalizacao(reforma.cenarios.completa.total, valorMercado, classeIpead),
  }
}
