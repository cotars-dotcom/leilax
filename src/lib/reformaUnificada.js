/**
 * AXIS — Custos de Reforma Unificados (SINAPI-MG 2026)
 *
 * FONTE DE VERDADE para custos de reforma em toda a plataforma.
 * Usado por:
 *   - useReforma.js (context centralizado)
 *   - CenariosReforma.jsx (6 escopos detalhados)
 *   - PainelRentabilidade.jsx (3 cenários: basica/media/completa)
 *   - PainelLancamento.jsx (3 cenários: basica/media/completa)
 *
 * Resolve o conflito de valores entre painéis — todos usam SINAPI como fallback.
 */

// Custo/m² por escopo e classe (SINAPI-MG 2026) — tabela única
export const CUSTO_M2_SINAPI = {
  sem_reforma:              { A_prime: 0,    B_medio_alto: 0,    C_intermediario: 0,    D_popular: 0 },
  refresh_giro:             { A_prime: 420,  B_medio_alto: 375,  C_intermediario: 335,  D_popular: 280 },
  leve_funcional:           { A_prime: 710,  B_medio_alto: 645,  C_intermediario: 585,  D_popular: 520 },
  leve_reforcada_1_molhado: { A_prime: 1175, B_medio_alto: 1070, C_intermediario: 975,  D_popular: 870 },
  media:                    { A_prime: 1600, B_medio_alto: 1450, C_intermediario: 1300, D_popular: 1100 },
  pesada:                   { A_prime: 2500, B_medio_alto: 2200, C_intermediario: 1900, D_popular: 1600 },
}

// Mapeamento dos 3 cenários simplificados para escopos SINAPI
export const MAPA_SIMPLIFICADO = {
  basica:   'refresh_giro',
  media:    'leve_reforcada_1_molhado',
  completa: 'pesada',
}

// Fator de valorização por escopo (pós-reforma / mercado)
export const FATOR_VALORIZACAO = {
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

// Bonus de liquidez por escopo (reduz prazo de venda)
export const LIQUIDEZ_BONUS = {
  sem_reforma:              0,
  refresh_giro:             0.05,
  leve_funcional:           0.12,
  leve_reforcada_1_molhado: 0.18,
  media:                    0.25,
  pesada:                   0.20,  // diminishing returns
}

// Prazo de obra estimado em meses
export const PRAZO_OBRA_MESES = {
  sem_reforma: 0,
  refresh_giro: 0.5,
  leve_funcional: 1.5,
  leve_reforcada_1_molhado: 2.5,
  media: 4,
  pesada: 7,
}

// 6 escopos detalhados — metadados para CenariosReforma.jsx
export const ESCOPOS = [
  {
    id: 'sem_reforma',
    label: 'Sem Reforma',
    descricao: 'Vende no estado atual — sem investimento em obras',
    fator_valorizacao: 1.00,
    inclui: [],
    cor: '#8E8EA0',
  },
  {
    id: 'refresh_giro',
    label: 'Refresh de Giro',
    descricao: 'Pintura, reparos, metais, luminárias — mínimo para girar',
    fator_valorizacao: 1.04,
    inclui: ['Pintura geral', 'Pequenos reparos', 'Metais/louças pontuais', 'Limpeza'],
    cor: '#3B8BD4',
  },
  {
    id: 'leve_funcional',
    label: 'Leve Funcional',
    descricao: 'Refresh + piso laminado/porcelanato parcial + elétrica/hidráulica',
    fator_valorizacao: 1.08,
    inclui: ['Pintura + Reparos', 'Piso laminado', 'Elétrica parcial', 'Hidráulica parcial'],
    cor: '#05A86D',
  },
  {
    id: 'leve_reforcada_1_molhado',
    label: 'Leve Reforçada',
    descricao: 'Leve funcional + 1 banheiro ou cozinha completa',
    fator_valorizacao: 1.12,
    inclui: ['Tudo do Leve', '1 área molhada completa', 'Porcelanato médio', 'Ferragens'],
    cor: '#D4A017',
  },
  {
    id: 'media',
    label: 'Reforma Média',
    descricao: 'Todos molhados + esquadrias + elétrica/hidráulica completa',
    fator_valorizacao: 1.18,
    inclui: ['Todos molhados', 'Esquadrias', 'Elétrica+Hidráulica total', 'Acabamento médio'],
    cor: '#A378DD',
  },
  {
    id: 'pesada',
    label: 'Reforma Pesada',
    descricao: 'Reforma total + estrutura + projeto + ART',
    fator_valorizacao: 1.28,
    inclui: ['Tudo + estrutura', 'Projeto arquitetônico', 'ART', 'Acabamento alto'],
    cor: '#D05538',
  },
]

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
 * Calcula custo de reforma para um escopo detalhado (os 6 nomes SINAPI).
 */
export function calcularCustoEscopo(escopoId, area, preco_m2_mercado) {
  const classe = detectarClasse(preco_m2_mercado)
  const custoM2 = CUSTO_M2_SINAPI[escopoId]?.[classe] || 0
  return Math.round((area || 80) * custoM2)
}

/**
 * Retorna o fator de valorização para um cenário ou escopo.
 */
export function fatorValorizacao(cenarioOuEscopo) {
  return FATOR_VALORIZACAO[cenarioOuEscopo] || 1.08
}
