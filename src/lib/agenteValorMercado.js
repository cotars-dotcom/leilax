/**
 * AXIS — Agente de Valor de Mercado
 * 
 * Busca preço/m² e aluguel do bairro a partir de:
 * 1. metricas_bairros (banco interno — fonte principal)
 * 2. SIDRA IBGE (índice macro BH)
 * 3. Jina Reader → ZAP (fallback scraping)
 */

import { supabase } from './supabase.js'

const SIDRA_SINAPI_URL =
  'https://servicodados.ibge.gov.br/api/v3/agregados/2296/periodos/-1/variaveis/1193?localidades=N3[31]'

/**
 * Retorna dados de mercado para um bairro/cidade.
 * Prioridade: banco → SIDRA (variação tendência) → null
 */
export async function buscarValorMercado(bairro, cidade = 'Belo Horizonte') {
  // 1. Banco interno (fonte primária — atualizado pelos prompts de delegação)
  let data = null
  try {
    const res = await supabase
      .from('metricas_bairros')
      .select('*')
      .ilike('bairro', bairro.trim())
      .limit(1)
      .single()
    data = res.data
  } catch { data = null }

  if (data) {
    return {
      fonte: 'banco_interno',
      bairro: data.bairro,
      cidade: data.cidade,
      preco_anuncio_m2: parseFloat(data.preco_anuncio_m2) || null,
      preco_contrato_m2: parseFloat(data.preco_contrato_m2) || null,
      aluguel_m2: parseFloat(data.aluguel_2q_tipico || data.aluguel_m2_com_elevador) || null,
      yield_bruto: parseFloat(data.yield_bruto) || null,
      classe_ipead: data.classe_ipead,
      classe_label: data.classe_ipead_label,
      tendencia_12m: parseFloat(data.tendencia_12m) || null,
      confianca: 'alta',
      atualizado_em: data.atualizado_em,
    }
  }

  // 2. Fallback: SIDRA IBGE (custo médio construção MG — serve como sanidade)
  try {
    const res = await fetch(SIDRA_SINAPI_URL, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const json = await res.json()
      const valor = json?.[0]?.resultados?.[0]?.series?.[0]?.serie
      const entries = valor ? Object.entries(valor) : []
      const ultimo = entries.sort((a, b) => b[0].localeCompare(a[0]))[0]
      if (ultimo) {
        return {
          fonte: 'sidra_ibge_mg',
          bairro,
          cidade,
          preco_anuncio_m2: null,
          preco_contrato_m2: null,
          aluguel_m2: null,
          yield_bruto: null,
          classe_ipead: null,
          classe_label: null,
          custo_construcao_m2_mg: parseFloat(ultimo[1]) || null,
          periodo: ultimo[0],
          confianca: 'baixa',
          nota: 'Bairro não encontrado no banco. Usando custo SINAPI MG como referência macro.',
        }
      }
    }
  } catch (e) {
    console.warn('[AXIS ValorMercado] SIDRA falhou:', e.message)
  }

  return null
}

/**
 * Calcula desconto real sobre mercado considerando preço de contrato (não anúncio)
 */
export function calcularDescontoRealMercado(valorLance, preco_contrato_m2, area_m2) {
  if (!valorLance || !preco_contrato_m2 || !area_m2) return null
  const valorMercado = preco_contrato_m2 * area_m2
  const desconto = (1 - valorLance / valorMercado) * 100
  return {
    valorMercadoEstimado: Math.round(valorMercado),
    descontoPct: parseFloat(desconto.toFixed(1)),
    viavel: desconto > 0,
  }
}

/**
 * Sugere classe IPEAD baseado em preco/m²
 */
export function inferirClasseIPEAD(preco_m2) {
  if (!preco_m2) return null
  if (preco_m2 >= 12000) return { classe: 4, label: 'Classe 4 - Luxo' }
  if (preco_m2 >= 7000)  return { classe: 3, label: 'Classe 3 - Alto' }
  if (preco_m2 >= 4000)  return { classe: 2, label: 'Classe 2 - Médio' }
  return { classe: 1, label: 'Classe 1 - Popular' }
}

/**
 * Busca dados do bairro no Supabase e retorna no mesmo formato do metricas_bairros_bh.js
 * Usado como substituto de getBairroDados() para dados atualizados
 */
export async function getBairroDadosOnline(nomeBairro, cidade = 'Belo Horizonte') {
  if (!nomeBairro) return null
  // Sprint 41d hotfix: buscar TODOS os campos do banco, incluindo fatores calibrados.
  // Antes: getBairroDadosOnline retornava fatorElevador: 0.85 hardcoded mesmo se o
  // banco tivesse valor calibrado para o bairro. Mesma negligência para piscina/lazer.
  let data = null
  try {
    const res = await supabase
      .from('metricas_bairros')
      .select('*')
      .ilike('bairro', nomeBairro.trim())
      .limit(1)
      .single()
    data = res.data
  } catch { data = null }

  if (!data) return null

  // Normalizar para o formato esperado pelo motorIA
  const classeNum = data.classe_ipead?.replace(/\D/g, '') || '2'
  return {
    label: data.bairro,
    zona: data.zona || null,
    classeIpead: parseInt(classeNum) || 2,
    classeIpeadLabel: data.classe_ipead_label?.replace(/Classe \d - /, '') || 'Médio',
    precoContratoM2: parseFloat(data.preco_contrato_m2) || null,
    precoAnuncioM2: parseFloat(data.preco_anuncio_m2) || null,
    yieldBruto: parseFloat(data.yield_bruto) || null,
    tendencia12m: parseFloat(data.tendencia_12m) || null,
    // Fatores de homogeneização — agora lidos do banco (antes hardcoded 0.85)
    fatorElevador: parseFloat(data.fator_elevador) || 0.85,
    fatorPiscina:  parseFloat(data.fator_piscina)  || 0.97,
    fatorLazer:    parseFloat(data.fator_lazer)    || 0.95,
    liquidez: data.liquidez_label || null,
    tempoVendaDias: data.tempo_venda_dias || null,
    _fonte: 'supabase',
    _atualizado_em: data.atualizado_em,
  }
}
