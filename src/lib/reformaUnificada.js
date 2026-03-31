/**
 * AXIS — Custos de Reforma Unificados (SINAPI-MG 2026)
 * 
 * Fonte de verdade para cenários de reforma usados em:
 *   - CenariosReforma.jsx (6 escopos detalhados)
 *   - PainelRentabilidade.jsx (3 cenários simplificados: basica/media/completa)
 *   - PainelLancamento.jsx (3 cenários simplificados: basica/media/completa)
 * 
 * Resolve o conflito de valores entre painéis — todos usam SINAPI como fallback.
 */

// Custo/m² por escopo e classe (SINAPI-MG 2026) — espelho do CenariosReforma.jsx
const CUSTO_M2_SINAPI = {
  sem_reforma:              { A_prime: 0,    B_medio_alto: 0,    C_intermediario: 0,    D_popular: 0 },
  refresh_giro:             { A_prime: 420,  B_medio_alto: 375,  C_intermediario: 335,  D_popular: 280 },
  leve_funcional:           { A_prime: 710,  B_medio_alto: 645,  C_intermediario: 585,  D_popular: 520 },
  leve_reforcada_1_molhado: { A_prime: 1175, B_medio_alto: 1070, C_intermediario: 975,  D_popular: 870 },
  media:                    { A_prime: 1600, B_medio_alto: 1450, C_intermediario: 1300, D_popular: 1100 },
  pesada:                   { A_prime: 2500, B_medio_alto: 2200, C_intermediario: 1900, D_popular: 1600 },
}

// Mapeamento dos 3 cenários simplificados para escopos SINAPI
const MAPA_SIMPLIFICADO = {
  basica:   'refresh_giro',
  media:    'leve_reforcada_1_molhado',
  completa: 'pesada',
}

// Fator de valorização por escopo
const FATOR_VALORIZACAO = {
  sem_reforma: 1.00,
  refresh_giro: 1.04,
  leve_funcional: 1.08,
  leve_reforcada_1_molhado: 1.12,
  media: 1.18,
  pesada: 1.28,
  // aliases simplificados
  basica: 1.04,
  completa: 1.28,
}

export function detectarClasse(preco_m2) {
  if (!preco_m2) return 'C_intermediario'
  if (preco_m2 >= 12000) return 'A_prime'
  if (preco_m2 >= 8000)  return 'B_medio_alto'
  if (preco_m2 >= 5000)  return 'C_intermediario'
  return 'D_popular'
}

/**
 * Calcula o custo de reforma SINAPI para um cenário simplificado (basica/media/completa).
 * Se houver valor do banco, retorna ele. Senão, calcula pelo SINAPI.
 * 
 * @param {string} cenario — 'basica' | 'media' | 'completa'
 * @param {number} area — área em m²
 * @param {number} preco_m2_mercado — preço/m² do mercado (para detectar classe)
 * @param {object} valoresBanco — { custo_reforma_basica, custo_reforma_media, custo_reforma_completa }
 * @returns {number} custo total da reforma
 */
export function calcularCustoReformaSINAPI(cenario, area, preco_m2_mercado, valoresBanco = {}) {
  // 1. Se tem valor do banco, usar ele (fonte primária)
  const chave = `custo_reforma_${cenario}`
  const valorBanco = parseFloat(valoresBanco[chave])
  if (valorBanco > 0) return valorBanco

  // 2. Fallback SINAPI por classe e escopo
  const classe = detectarClasse(preco_m2_mercado)
  const escopo = MAPA_SIMPLIFICADO[cenario] || 'leve_reforcada_1_molhado'
  const custoM2 = CUSTO_M2_SINAPI[escopo]?.[classe] || CUSTO_M2_SINAPI.leve_reforcada_1_molhado.C_intermediario
  return Math.round((area || 80) * custoM2)
}

/**
 * Retorna os 3 custos de reforma (basica/media/completa) unificados.
 */
export function calcularReformas3Cenarios(area, preco_m2_mercado, valoresBanco = {}) {
  return {
    basica:   calcularCustoReformaSINAPI('basica',   area, preco_m2_mercado, valoresBanco),
    media:    calcularCustoReformaSINAPI('media',    area, preco_m2_mercado, valoresBanco),
    completa: calcularCustoReformaSINAPI('completa', area, preco_m2_mercado, valoresBanco),
  }
}

/**
 * Retorna o fator de valorização para um cenário.
 */
export function fatorValorizacao(cenario) {
  return FATOR_VALORIZACAO[cenario] || 1.08
}

export { CUSTO_M2_SINAPI, MAPA_SIMPLIFICADO }
