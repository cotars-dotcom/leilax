/**
 * AXIS — Agente de Aluguel e Yield
 * 
 * Estima aluguel mensal e yield bruto para um imóvel baseado em:
 * 1. metricas_bairros (banco) — aluguel_2q_tipico / aluguel_3q_tipico
 * 2. Interpolação por área e tipologia
 * 3. Ajustes por atributos — APENAS PENALIDADE POR AUSÊNCIA quando o atributo
 *    é padrão do bairro (ex: ausência de elevador em bairro Alto/Luxo).
 *    Atributos já embutidos no aluguel_tipico do bairro NÃO geram bônus.
 *
 * Regra de consistência (igual à homogeneização de valor_mercado):
 *   Classe IPEAD 3 (Alto) ou 4 (Luxo): elevador, piscina, lazer são PADRÃO
 *   Classe IPEAD 2 (Médio): elevador é PADRÃO, piscina/lazer não
 *   Classe IPEAD 1 (Popular): nada é padrão
 */

import { supabase } from './supabase.js'

// Fatores de penalidade por AUSÊNCIA de atributo padrão (sprint 41c).
// Consistentes com agenteValorMercado (fatorElevador: 0.85).
const PENALIDADE_SEM_ELEVADOR = 0.85  // -15% no aluguel se bairro espera elevador
const PENALIDADE_SEM_PISCINA  = 0.97  // -3% se bairro espera piscina
const PENALIDADE_SEM_LAZER    = 0.95  // -5% se bairro espera lazer completo

/**
 * Retorna quais atributos são PADRÃO do bairro dada a classe IPEAD.
 * Classe pode vir como número (1-4), string "Classe 3 - Alto" ou label curta "Alto".
 */
function atributosPadraoPorClasse(classeIpead) {
  const s = String(classeIpead || '').toLowerCase()
  const num = parseInt(s.replace(/\D/g, ''), 10) ||
    (s.includes('luxo') ? 4 :
     s.includes('alto') ? 3 :
     s.includes('médio') || s.includes('medio') ? 2 :
     s.includes('popular') ? 1 : 2)  // default 2 (médio)
  
  return {
    classe: num,
    elevador: num >= 2,   // padrão a partir de Médio
    piscina:  num >= 3,   // padrão a partir de Alto
    area_lazer: num >= 3, // padrão a partir de Alto
  }
}

/**
 * Estima aluguel mensal para um imóvel
 */
export async function estimarAluguel(bairro, area_m2, quartos = 2, atributos = {}) {
  let mb = null
  try {
    const res = await supabase
      .from('metricas_bairros')
      .select('aluguel_2q_tipico, aluguel_3q_tipico, aluguel_m2_com_elevador, aluguel_m2_sem_elevador, fator_elevador, fator_piscina, fator_lazer, yield_bruto, classe_ipead, classe_ipead_label')
      .ilike('bairro', bairro.trim())
      .limit(1)
      .single()
    mb = res.data
  } catch { mb = null }

  if (!mb) return null

  // Aluguel base por tipologia
  const aluguelBase = quartos >= 3
    ? parseFloat(mb.aluguel_3q_tipico || 0)
    : parseFloat(mb.aluguel_2q_tipico || 0)

  if (!aluguelBase) return null

  // Determinar quais atributos são padrão do bairro
  const padrao = atributosPadraoPorClasse(mb.classe_ipead || mb.classe_ipead_label)

  // Fator = PENALIDADE pela ausência de atributo padrão.
  // Se o imóvel TEM o atributo (padrão ou não) → neutro (já está no aluguel típico ou não impacta).
  // Se o imóvel NÃO TEM um atributo que é padrão do bairro → aplicar penalidade.
  let fator = 1.0
  const penalidades = []

  if (padrao.elevador && !atributos.elevador) {
    fator *= PENALIDADE_SEM_ELEVADOR
    penalidades.push('sem_elevador(-15%)')
  }
  if (padrao.piscina && !atributos.piscina) {
    fator *= PENALIDADE_SEM_PISCINA
    penalidades.push('sem_piscina(-3%)')
  }
  if (padrao.area_lazer && !atributos.area_lazer) {
    fator *= PENALIDADE_SEM_LAZER
    penalidades.push('sem_lazer(-5%)')
  }

  // Aluguel final = aluguel_tipico × ajuste_area × fator_penalidade
  // Area de referência: 60m² para 2q, 80m² para 3q+
  const areaRef = quartos >= 3 ? 80 : 60
  const ajusteArea = area_m2 ? Math.pow(area_m2 / areaRef, 0.65) : 1  // elasticidade 0.65 — cresce menos que proporcional
  
  const aluguelFinal = Math.round(aluguelBase * fator * ajusteArea)
  const yieldBruto = mb.yield_bruto ? parseFloat(mb.yield_bruto) : null

  return {
    aluguel_mensal: aluguelFinal,
    aluguel_m2: area_m2 ? Math.round(aluguelFinal / area_m2) : null,
    yield_bruto_pct: yieldBruto,
    fator_aplicado: parseFloat(fator.toFixed(3)),
    penalidades_aplicadas: penalidades,
    classe_ipead_bairro: padrao.classe,
    ajuste_area: parseFloat(ajusteArea.toFixed(3)),
    base_usada: quartos >= 3 ? '3q' : '2q',
    fonte: 'banco_metricas_bairros',
  }
}

/**
 * Calcula yield bruto e líquido
 * @param {number} aluguelMensal
 * @param {number} valorImovel
 * @param {number} ocupacao - taxa de ocupação anual (0.94 = 6% vacância, alinhado com VACANCIA_ANUAL_PCT)
 */
export function calcularYield(aluguelMensal, valorImovel, ocupacao = 0.94) {
  if (!aluguelMensal || !valorImovel) return null
  const yieldBruto = (aluguelMensal * 12 / valorImovel) * 100
  // Sprint 41d: ocupação 0.94 (6% vacância) alinhado com VACANCIA_ANUAL_PCT em constants.js.
  // Antes: 0.9 (10% vacância) — divergia da função canônica calcularDadosFinanceiros.
  const yieldLiquido = yieldBruto * ocupacao * 0.85  // 85% líquido após gestão/manutenção
  return {
    yield_bruto_pct: parseFloat(yieldBruto.toFixed(2)),
    yield_liquido_pct: parseFloat(yieldLiquido.toFixed(2)),
    payback_anos: parseFloat((valorImovel / (aluguelMensal * 12)).toFixed(1)),
    payback_meses: Math.round(valorImovel / aluguelMensal),
  }
}
