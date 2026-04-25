/**
 * AXIS — Agente Orquestrador
 * 
 * Coordena todos os agentes para uma análise completa de um imóvel.
 * Pipeline: endereço → mercado → reforma → aluguel → jurídico → confidence
 * 
 * Retorna um objeto unificado pronto para upsert em `imoveis`.
 */

import { buscarValorMercado, inferirClasseIPEAD } from './agenteValorMercado.js'
import { calcularReformaSINAPI } from './agenteReformaSINAPI.js'
import { estimarAluguel, calcularYield } from './agenteAluguel.js'
import { consultarProcesso } from './agenteDatajud.js'
import { calcularConfidence } from './agenteConfidenceBadge.js'
import { consultarCEP, validarEndereco, geocodificarEndereco } from './agenteEndereco.js'
import { calcularLanceMaximoParaROI, CUSTOS_LEILAO } from './constants.js'
import { calcularCustoJuridico } from '../data/riscos_juridicos.js'

/**
 * Enriquece um imóvel com dados de todos os agentes.
 * Cada agente é opcional — falha silenciosa com log.
 * 
 * @param {Object} imovel — Objeto do banco (campos básicos preenchidos)
 * @param {Object} opts — { forcarReforma, forcarMercado, forcarJuridico, forcarEndereco }
 */
export async function enriquecerImovel(imovel, opts = {}) {
  const p = imovel
  const updates = {}
  const log = []

  // ── 0. ENDEREÇO / CEP / GEOCODING ─────────────────────────────────────────
  // Sprint 41d: agenteEndereco era código morto — não era chamado por ninguém.
  // Agora plugado no pipeline. Roda só se temos CEP e (lat/lng) ainda não foi geocodada.
  if (opts.forcarEndereco !== false && p.cep && (!p.lat || !p.lng)) {
    try {
      const cepData = await consultarCEP(p.cep)
      if (cepData) {
        if (!p.bairro && cepData.bairro) updates.bairro = cepData.bairro
        if (!p.cidade && cepData.cidade) updates.cidade = cepData.cidade
        if (cepData.lat && cepData.lng) {
          updates.lat = cepData.lat
          updates.lng = cepData.lng
        }
        log.push(`✅ CEP: ${cepData.bairro}, ${cepData.cidade}${cepData.lat ? ` (${cepData.lat.toFixed(4)}, ${cepData.lng.toFixed(4)})` : ''}`)
        // Se CEP não tem coordenadas mas temos endereço, tentar Nominatim
        if ((!cepData.lat || !cepData.lng) && p.endereco) {
          const geo = await geocodificarEndereco(p.endereco, cepData.cidade, cepData.estado)
          if (geo?.lat) {
            updates.lat = geo.lat
            updates.lng = geo.lng
            log.push(`✅ Geocoding: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)} (${geo.fonte})`)
          }
        }
      }
    } catch(e) { log.push(`⚠️ Endereço falhou: ${e.message}`) }
  }

  // ── 1. VALOR DE MERCADO ─────────────────────────────────────────────────────
  // Usa bairro atualizado pelo passo 0 se disponível
  const bairroEfetivo = updates.bairro || p.bairro
  if (opts.forcarMercado !== false && bairroEfetivo) {
    try {
      const vm = await buscarValorMercado(bairroEfetivo, updates.cidade || p.cidade)
      if (vm?.preco_contrato_m2) {
        const area = parseFloat(p.area_usada_calculo_m2 || p.area_privativa_m2 || p.area_m2) || 0
        updates.valor_mercado_estimado = Math.round(vm.preco_contrato_m2 * area)
        updates.preco_m2_mercado = vm.preco_contrato_m2
        updates.preco_m2_imovel = area > 0 && p.valor_minimo
          ? Math.round(parseFloat(p.valor_minimo) / area) : null
        if (vm.classe_label) updates.classe_ipead = vm.classe_label
        log.push(`✅ Mercado: R$${vm.preco_contrato_m2}/m² (${vm.bairro})`)
      }
    } catch(e) { log.push(`⚠️ Mercado falhou: ${e.message}`) }
  }

  // ── 2. REFORMA ──────────────────────────────────────────────────────────────
  if (opts.forcarReforma !== false) {
    try {
      const area = parseFloat(p.area_usada_calculo_m2 || p.area_privativa_m2 || p.area_m2) || 0
      const classe = updates.classe_ipead || p.classe_ipead || 'Classe 2 - Médio'
      if (area > 0) {
        const rf = await calcularReformaSINAPI(area, classe)
        if (rf) {
          updates.custo_reforma_basica   = rf.cenarios.basica.total
          updates.custo_reforma_media    = rf.cenarios.media.total
          updates.custo_reforma_completa = rf.cenarios.completa.total
          log.push(`✅ Reforma: básica R$${rf.cenarios.basica.total.toLocaleString('pt-BR')} / média R$${rf.cenarios.media.total.toLocaleString('pt-BR')}`)
        }
      }
    } catch(e) { log.push(`⚠️ Reforma falhou: ${e.message}`) }
  }

  // ── 3. ALUGUEL ───────────────────────────────────────────────────────────────
  if (p.bairro) {
    try {
      const area = parseFloat(p.area_usada_calculo_m2 || p.area_privativa_m2 || p.area_m2) || 0
      const aluguel = await estimarAluguel(p.bairro, area, p.quartos || 2, {
        elevador: p.elevador, piscina: p.piscina, area_lazer: p.area_lazer
      })
      if (aluguel?.aluguel_mensal) {
        updates.aluguel_mensal_estimado = aluguel.aluguel_mensal
        const vm = parseFloat(updates.valor_mercado_estimado || p.valor_mercado_estimado) || 0
        if (vm > 0) {
          const y = calcularYield(aluguel.aluguel_mensal, vm)
          if (y) updates.yield_bruto_pct = y.yield_bruto_pct
        }
        log.push(`✅ Aluguel: R$${aluguel.aluguel_mensal.toLocaleString('pt-BR')}/mês`)
      }
    } catch(e) { log.push(`⚠️ Aluguel falhou: ${e.message}`) }
  }

  // ── 4. JURÍDICO (Datajud) ─────────────────────────────────────────────────
  if (opts.forcarJuridico !== false && p.processo_numero && !p.processo_numero.includes('0000000-00')) {
    try {
      const proc = await consultarProcesso(p.processo_numero)
      if (proc?.encontrado) {
        if (!p.vara_judicial && proc.orgaoJulgador) updates.vara_judicial = proc.orgaoJulgador
        if (!p.tipo_justica)  updates.tipo_justica  = proc.tribunal
        log.push(`✅ Datajud: ${proc.classe} · ${proc.orgaoJulgador}`)
      }
    } catch(e) { log.push(`⚠️ Datajud falhou: ${e.message}`) }
  }

  // ── 4.5. CUSTO JURÍDICO ─────────────────────────────────────────────────────
  try {
    const pAtual = { ...p, ...updates }
    const riscos = Array.isArray(pAtual.riscos_presentes)
      ? pAtual.riscos_presentes
      : (() => { try { return JSON.parse(pAtual.riscos_presentes || '[]') } catch { return [] } })()
    if (riscos.length > 0) {
      const aluguel = parseFloat(updates.aluguel_mensal_estimado || p.aluguel_mensal_estimado) || 0
      const custoJur = calcularCustoJuridico(riscos, aluguel)
      if (custoJur?.custo_total_max > 0) {
        updates.custo_juridico_estimado      = custoJur.custo_total_max
        updates.prazo_liberacao_estimado_meses = custoJur.prazo_liberacao_meses_max || p.prazo_liberacao_estimado_meses
        log.push(`✅ Custo jurídico: R$${custoJur.custo_total_max.toLocaleString('pt-BR')} · prazo ${custoJur.prazo_liberacao_meses_max}m`)
      }
    }
  } catch(e) { log.push(`⚠️ Custo jurídico falhou: ${e.message}`) }

  // ── 5. LANCE MÁXIMO ─────────────────────────────────────────────────────────
  const vmFinal = parseFloat(updates.valor_mercado_estimado || p.valor_mercado_estimado) || 0
  const reformaMedia = parseFloat(updates.custo_reforma_media || p.custo_reforma_media) || 0
  if (vmFinal > 0 && p.valor_minimo) {
    try {
      const pEnriquecido = { ...p, ...updates }
      // Lance máx. flip = teto que preserva ROI ≥ 20% (custos + reforma + débitos + jurídico já incluídos)
      updates.mao_flip = calcularLanceMaximoParaROI(20, pEnriquecido, {
        eMercado: false, custoReforma: reformaMedia, mercadoBruto: vmFinal,
      })
      // Sprint 41d hotfix: mao_locacao usa fórmula de YIELD, não de ROI.
      // Antes: calcularLanceMaximoParaROI(6, ...) — chamava com 6 como roiAlvo,
      // resultando em lance máximo absurdamente alto (até maior que o valor de mercado).
      // Correto: lance máximo = (aluguel × 12 / yield_alvo) − custos_fixos
      const aluguel = parseFloat(updates.aluguel_mensal_estimado || p.aluguel_mensal_estimado) || 0
      if (aluguel > 0) {
        const yieldAlvo = 0.06  // 6% a.a. típico BH
        const condoMensal = parseFloat(p.condominio_mensal || 0)
        const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * 0.35) : 0)
        const holding = 6 * (condoMensal + iptuMensal)
        const debitosArr = pEnriquecido.responsabilidade_debitos === 'arrematante'
          ? parseFloat(pEnriquecido.debitos_total_estimado || 0) : 0
        const juridico = parseFloat(updates.custo_juridico_estimado || p.custo_juridico_estimado || 0)
        const custosFixos = reformaMedia + holding + debitosArr + juridico
        // Custos variáveis sobre lance: 15.5% leilão (comissão + ITBI + adv + doc)
        const pctCustos = 0.155
        const targetInvest = aluguel * 12 / yieldAlvo  // investimento total para atingir yield alvo
        const lanceMaxLoc = (targetInvest - custosFixos) / (1 + pctCustos)
        updates.mao_locacao = Math.max(0, Math.round(lanceMaxLoc))
      } else {
        updates.mao_locacao = null
      }
      // Verificar se MAO está protegido (campos_travados)
      const travados = Array.isArray(imovel.campos_travados) ? imovel.campos_travados : []
      const maoProtegido = travados.includes('mao_flip')
      if (maoProtegido) {
        log.push(`ℹ️ Lance máx. calculado (bloqueado): flip R$${updates.mao_flip?.toLocaleString('pt-BR')} / locação R$${updates.mao_locacao?.toLocaleString('pt-BR')} — campos protegidos, valor do banco mantido`)
        delete updates.mao_flip
        delete updates.mao_locacao
      } else {
        log.push(`✅ Lance máx.: flip R$${updates.mao_flip?.toLocaleString('pt-BR')} / locação R$${updates.mao_locacao?.toLocaleString('pt-BR')}`)
      }
    } catch(e) { log.push(`⚠️ Lance máx. falhou: ${e.message}`) }
  }

  // ── 6. CONFIDENCE ──────────────────────────────────────────────────────────
  const imovelEnriquecido = { ...p, ...updates }
  const conf = calcularConfidence(imovelEnriquecido)
  updates.confidence_score = conf.score

  return {
    updates,
    log,
    confidence: conf,
    imovelEnriquecido,
  }
}
