/**
 * AXIS — Agente de Aluguel e Yield
 * 
 * Estima aluguel mensal e yield bruto para um imóvel baseado em:
 * 1. metricas_bairros (banco) — aluguel_2q_tipico / aluguel_3q_tipico
 * 2. Interpolação por área e tipologia
 * 3. Ajustes por atributos (elevador, piscina, portaria)
 */

import { supabase } from './supabase.js'

/**
 * Estima aluguel mensal para um imóvel
 */
export async function estimarAluguel(bairro, area_m2, quartos = 2, atributos = {}) {
  const { data: mb } = await supabase
    .from('metricas_bairros')
    .select('aluguel_2q_tipico, aluguel_3q_tipico, aluguel_m2_com_elevador, aluguel_m2_sem_elevador, fator_elevador, fator_piscina, fator_lazer, yield_bruto')
    .ilike('bairro', bairro.trim())
    .limit(1)
    .single()
    .catch(() => ({ data: null }))

  if (!mb) return null

  // Aluguel base por tipologia
  const aluguelBase = quartos >= 3
    ? parseFloat(mb.aluguel_3q_tipico || 0)
    : parseFloat(mb.aluguel_2q_tipico || 0)

  if (!aluguelBase) return null

  // Ajuste por atributos (fator multiplicador)
  let fator = 1.0
  if (atributos.elevador && mb.fator_elevador) fator *= parseFloat(mb.fator_elevador)
  if (atributos.piscina && mb.fator_piscina)   fator *= parseFloat(mb.fator_piscina)
  if (atributos.area_lazer && mb.fator_lazer)  fator *= parseFloat(mb.fator_lazer)

  // Aluguel final = aluguel_tipico × (area_real / area_referencia) × fator_atributos
  // Area de referência: 60m² para 2q, 80m² para 3q+
  const areaRef = quartos >= 3 ? 80 : 60
  const ajusteArea = area_m2 ? Math.pow(area_m2 / areaRef, 0.65) : 1  // elasticidade 0.65 — cresce menos que proporcional
  
  const aluguelFinal = Math.round(aluguelBase * fator * ajusteArea)
  const yieldBruto = mb.yield_bruto ? parseFloat(mb.yield_bruto) : null

  return {
    aluguel_mensal: aluguelFinal,
    aluguel_m2: Math.round(aluguelFinal / area_m2),
    yield_bruto_pct: yieldBruto,
    fator_aplicado: parseFloat(fator.toFixed(3)),
    ajuste_area: parseFloat(ajusteArea.toFixed(3)),
    base_usada: quartos >= 3 ? '3q' : '2q',
    fonte: 'banco_metricas_bairros',
  }
}

/**
 * Calcula yield bruto e líquido
 */
export function calcularYield(aluguelMensal, valorImovel, vacanciaAnos = 0.9) {
  if (!aluguelMensal || !valorImovel) return null
  const yieldBruto = (aluguelMensal * 12 / valorImovel) * 100
  const yieldLiquido = yieldBruto * vacanciaAnos * 0.85  // 85% líquido após gestão/manutenção
  return {
    yield_bruto_pct: parseFloat(yieldBruto.toFixed(2)),
    yield_liquido_pct: parseFloat(yieldLiquido.toFixed(2)),
    payback_anos: parseFloat((valorImovel / (aluguelMensal * 12)).toFixed(1)),
    payback_meses: Math.round(valorImovel / aluguelMensal),
  }
}
