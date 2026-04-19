/**
 * AXIS — Agente de Confidence Badge
 * 
 * Calcula e justifica o nível de confiança da análise (0-100).
 * Alta = dados verificados por fonte primária
 * Média = estimativas calculadas com parâmetros razoáveis
 * Baixa = campos faltando ou sem validação cruzada
 */

/**
 * Dimensões de confiança e seus pesos
 */
const DIMENSOES = [
  {
    id: 'valor_mercado',
    label: 'Valor de mercado',
    peso: 25,
    check: (p) => {
      if (!p.valor_mercado_estimado) return { score: 0, motivo: 'Sem estimativa de mercado' }
      if (p.preco_m2_mercado && p.valor_mercado_estimado) return { score: 100, motivo: 'Estimativa com preço/m² do bairro' }
      return { score: 60, motivo: 'Estimativa sem base de comparáveis locais' }
    }
  },
  {
    id: 'juridico',
    label: 'Dados jurídicos',
    peso: 25,
    check: (p) => {
      const fake = !p.processo_numero || p.processo_numero.includes('0000000-00')
      if (fake) return { score: 0, motivo: 'Número de processo fake ou ausente' }
      const temVara = !!p.vara_judicial
      const temDebitos = p.debitos_total_estimado != null
      if (temVara && temDebitos) return { score: 100, motivo: 'Processo CNJ, vara e débitos informados' }
      if (temVara || temDebitos) return { score: 70, motivo: 'Dados jurídicos parciais' }
      return { score: 40, motivo: 'Apenas número de processo' }
    }
  },
  {
    id: 'dados_fisicos',
    label: 'Dados físicos',
    peso: 20,
    check: (p) => {
      const campos = ['area_privativa_m2', 'quartos', 'vagas', 'bairro', 'endereco']
      const preenchidos = campos.filter(c => p[c] != null && p[c] !== '').length
      const score = Math.round((preenchidos / campos.length) * 100)
      return {
        score,
        motivo: preenchidos === campos.length
          ? 'Todos campos físicos preenchidos'
          : `${campos.length - preenchidos} campo(s) físico(s) faltando`
      }
    }
  },
  {
    id: 'preco_lance',
    label: 'Preço e lance',
    peso: 20,
    check: (p) => {
      const temLance = !!p.valor_minimo
      const temAval = !!p.valor_avaliacao
      const avalOk = temLance && temAval && parseFloat(p.valor_avaliacao) > 0
      if (avalOk && parseFloat(p.valor_avaliacao) >= parseFloat(p.valor_minimo)) {
        return { score: 100, motivo: 'Lance e avaliação consistentes' }
      }
      if (temLance && !temAval) return { score: 60, motivo: 'Lance sem avaliação judicial' }
      if (!temLance) return { score: 0, motivo: 'Sem valor de lance definido' }
      return { score: 40, motivo: 'Avaliação menor que lance (incomum)' }
    }
  },
  {
    id: 'reforma',
    label: 'Estimativa de reforma',
    peso: 10,
    check: (p) => {
      if (p.custo_reforma_media > 0) return { score: 100, motivo: 'Reforma estimada por cenário' }
      if (p.custo_reforma_estimado > 0) return { score: 70, motivo: 'Reforma estimada globalmente' }
      return { score: 20, motivo: 'Sem estimativa de reforma' }
    }
  },
]

/**
 * Calcula badge de confiança para um imóvel
 * @param {Object} p - Objeto do imóvel
 * @returns {{ score: number, nivel: string, cor: string, dimensoes: Array }}
 */
export function calcularConfidence(p) {
  if (!p) return { score: 0, nivel: 'Indefinido', cor: '#94A3B8', dimensoes: [] }

  const resultados = DIMENSOES.map(d => {
    const { score, motivo } = d.check(p)
    return { ...d, score, motivo, contribuicao: Math.round(score * d.peso / 100) }
  })

  const scoreTotal = resultados.reduce((s, d) => s + d.contribuicao, 0)

  const nivel = scoreTotal >= 75 ? 'Alta'
    : scoreTotal >= 50 ? 'Média'
    : scoreTotal >= 25 ? 'Baixa' : 'Insuficiente'

  const cor = scoreTotal >= 75 ? '#059669'
    : scoreTotal >= 50 ? '#D97706'
    : scoreTotal >= 25 ? '#EA580C' : '#DC2626'

  const fraquezas = resultados.filter(d => d.score < 60).map(d => d.motivo)

  return {
    score: scoreTotal,
    nivel,
    cor,
    dimensoes: resultados,
    fraquezas,
    recomendacao: fraquezas.length > 0
      ? `Melhorar: ${fraquezas.slice(0, 2).join(' · ')}`
      : 'Dados suficientes para análise confiável',
  }
}

/**
 * Normaliza score 0-100 para escala legada 0-100 (compatibility)
 */
export function scoreToConfidencePct(confidence_score) {
  // O campo confidence_score no banco já é 0-100
  return Math.min(100, Math.max(0, parseFloat(confidence_score) || 0))
}
