export const MERCADO_REGIONAL = {
  // ── BELO HORIZONTE (GERAL) ────────────────────────────────────────
  bh_geral: {
    label: "BH Geral",
    cidade: "Belo Horizonte",
    preco_m2_venda_medio: 10595,
    preco_m2_locacao: 48.28,
    yield_bruto_pct: 5.16,
    tendencia_loc_12m: 10.52,
    variacao_mensal_loc: 0.21,
    fonte: 'FipeZAP Locação Residencial fev/2026',
    atualizado_em: '2026-02',
  },

  // ── BELO HORIZONTE (ZONAS) ────────────────────────────────────────
  bh_centro_sul: {
    label: "BH Centro-Sul",
    cidade: "Belo Horizonte",
    bairros: ["Anchieta", "Sion", "Serra", "Santo Agostinho", "Santo Antônio", "Gutierrez", "Cruzeiro"],
    preco_m2_venda_min: 9000,
    preco_m2_venda_max: 12500,
    preco_m2_venda_medio: 10500,
    preco_m2_locacao: 72,
    tempo_venda_dias: 75,
    tendencia: "alta",
    tendencia_pct_12m: 12.0,
    demanda: "alta",
    vacancia_pct: 2.5,
    yield_bruto_pct: 5.5,
    yield_liquido_pct: 3.5,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 3,
      suites_min: 1,
      vagas_ideal: 2,
      area_min_m2: 80,
      area_max_m2: 100,
      faixa_preco_min: 800000,
      faixa_preco_max: 1200000,
      condominio_teto: 1200,
      lazer: "completo"
    },
    alertas: [],
    viabilidade_temporada: "alta"
  },

  bh_savassi: {
    label: "BH Savassi / Lourdes / Belvedere",
    cidade: "Belo Horizonte",
    bairros: ["Savassi", "Lourdes", "Funcionários", "Belvedere", "Luxemburgo", "Cidade Jardim"],
    preco_m2_venda_min: 12000,
    preco_m2_venda_max: 18000,
    preco_m2_venda_medio: 16074,
    preco_m2_locacao: 58,
    tempo_venda_dias: 45,
    tendencia: "alta",
    tendencia_pct_12m: 16.0,
    demanda: "muito_alta",
    vacancia_pct: 2.0,
    yield_bruto_pct: 5.0,
    yield_liquido_pct: 3.2,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 1,
      vagas_ideal: 2,
      area_min_m2: 70,
      area_max_m2: 90,
      faixa_preco_min: 700000,
      faixa_preco_max: 900000,
      condominio_teto: 1000,
      lazer: "completo"
    },
    alertas: [],
    viabilidade_temporada: "alta"
  },

  bh_pampulha: {
    label: "BH Pampulha",
    cidade: "Belo Horizonte",
    bairros: ["Pampulha", "São Luiz", "Bandeirantes", "Itapoã"],
    preco_m2_venda_min: 8500,
    preco_m2_venda_max: 9800,
    preco_m2_venda_medio: 9150,
    preco_m2_locacao: 35,
    tempo_venda_dias: 105,
    tendencia: "estavel_leve_alta",
    tendencia_pct_12m: 4.0,
    demanda: "media_alta",
    vacancia_pct: 4.0,
    yield_bruto_pct: 5.5,
    yield_liquido_pct: 3.5,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 3,
      suites_min: 1,
      vagas_ideal: 2,
      area_min_m2: 90,
      area_max_m2: 120,
      faixa_preco_min: 600000,
      faixa_preco_max: 900000,
      condominio_teto: 800,
      lazer: "basico"
    },
    alertas: [],
    viabilidade_temporada: "media"
  },

  nova_lima: {
    label: "Nova Lima (Vila da Serra / Morro do Chapéu)",
    cidade: "Nova Lima",
    bairros: ["Vila da Serra", "Morro do Chapéu", "Centro Nova Lima", "Nova Lima"],
    preco_m2_venda_min: 14000,
    preco_m2_venda_max: 18000,
    preco_m2_venda_medio: 16000,
    preco_m2_locacao: 85,
    tempo_venda_dias: 60,
    tendencia: "alta",
    tendencia_pct_12m: 8.0,
    demanda: "alta",
    vacancia_pct: 3.0,
    yield_bruto_pct: 4.5,
    yield_liquido_pct: 2.8,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 3,
      suites_min: 2,
      vagas_ideal: 2,
      area_min_m2: 120,
      area_max_m2: 150,
      faixa_preco_min: 1200000,
      faixa_preco_max: 1800000,
      condominio_teto: 1500,
      lazer: "completo"
    },
    alertas: ["Verificar risco geológico em encostas — regiões serranas exigem laudo técnico"],
    viabilidade_temporada: "media"
  },

  bh_buritis: {
    label: "BH Buritis / Estoril / Barroca",
    cidade: "Belo Horizonte",
    bairros: ["Buritis", "Estoril", "Ouro Preto", "Salgado Filho", "Castelo", "Alto Barroca", "Barroca"],
    preco_m2_venda_min: 9000,
    preco_m2_venda_max: 12000,
    preco_m2_venda_medio: 10200,
    preco_m2_locacao: 50,
    tempo_venda_dias: 75,
    tendencia: "alta",
    tendencia_pct_12m: 6.9,
    demanda: "alta",
    vacancia_pct: 3.5,
    yield_bruto_pct: 6.0,
    yield_liquido_pct: 4.0,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 2,
      area_min_m2: 70,
      area_max_m2: 100,
      faixa_preco_min: 450000,
      faixa_preco_max: 700000,
      condominio_teto: 600,
      lazer: "basico"
    },
    alertas: [],
    viabilidade_temporada: "media"
  },

  bh_santa_efigenia: {
    label: "BH Santa Efigênia / Prates / Floresta",
    cidade: "Belo Horizonte",
    bairros: ["Santa Efigênia", "Carlos Prates", "Floresta", "Lagoinha"],
    preco_m2_venda_min: 5500,
    preco_m2_venda_max: 8500,
    preco_m2_venda_medio: 7080,
    preco_m2_locacao: 56,
    tempo_venda_dias: 120,
    tendencia: "estavel_leve_alta",
    tendencia_pct_12m: 3.0,
    demanda: "media",
    vacancia_pct: 5.0,
    yield_bruto_pct: 5.5,
    yield_liquido_pct: 3.3,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 60,
      area_max_m2: 80,
      faixa_preco_min: 350000,
      faixa_preco_max: 500000,
      condominio_teto: 500,
      lazer: "basico"
    },
    alertas: ["Verificar proximidade de córregos — alguns trechos têm histórico de alagamentos"],
    viabilidade_temporada: "baixa"
  },

  bh_cidade_nova: {
    label: "BH Cidade Nova / Caiçara / Padre Eustáquio",
    cidade: "Belo Horizonte",
    bairros: ["Cidade Nova", "Caiçara", "Padre Eustáquio", "Planalto", "Jardim Guanabara", "Engenho Nogueira"],
    preco_m2_venda_min: 4800,
    preco_m2_venda_max: 7200,
    preco_m2_venda_medio: 5900,
    preco_m2_locacao: 40,
    tempo_venda_dias: 150,
    tendencia: "estavel_queda_moderada",
    tendencia_pct_12m: -1.0,
    demanda: "media_baixa",
    vacancia_pct: 6.0,
    yield_bruto_pct: 6.5,
    yield_liquido_pct: 4.0,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 50,
      area_max_m2: 70,
      faixa_preco_min: 250000,
      faixa_preco_max: 350000,
      condominio_teto: 300,
      lazer: "nenhum"
    },
    alertas: [],
    viabilidade_temporada: "baixa"
  },

  bh_venda_nova: {
    label: "BH Venda Nova / Jardim Leblon / Mantiqueira",
    cidade: "Belo Horizonte",
    bairros: ["Venda Nova", "Jardim Leblon", "Mantiqueira", "Jardim Vitória", "Tupi"],
    preco_m2_venda_min: 4000,
    preco_m2_venda_max: 4500,
    preco_m2_venda_medio: 4250,
    preco_m2_locacao: 20,
    tempo_venda_dias: 195,
    tendencia: "estavel_baixa",
    tendencia_pct_12m: 1.0,
    demanda: "baixa",
    vacancia_pct: 9.0,
    yield_bruto_pct: 7.0,
    yield_liquido_pct: 4.5,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 40,
      area_max_m2: 60,
      faixa_preco_min: 150000,
      faixa_preco_max: 250000,
      condominio_teto: 250,
      lazer: "nenhum"
    },
    alertas: [
      "Liquidez moderada no bairro — precificar competitivamente para venda rápida",
      "Vacância acima da média — considerar locação como estratégia principal",
    ],
    viabilidade_temporada: "nenhuma"
  },

  bh_barreiro: {
    label: "BH Barreiro / Milionários / Jatobá",
    cidade: "Belo Horizonte",
    bairros: ["Barreiro", "Milionários", "Jatobá", "Lindeia", "Teixeira Dias"],
    preco_m2_venda_min: 6000,
    preco_m2_venda_max: 7000,
    preco_m2_venda_medio: 6500,
    preco_m2_locacao: 31,
    tempo_venda_dias: 150,
    tendencia: "estavel",
    tendencia_pct_12m: 2.0,
    demanda: "baixa",
    vacancia_pct: 7.0,
    yield_bruto_pct: 6.0,
    yield_liquido_pct: 3.8,
    imovel_mais_liquido: {
      tipologia: "casa",
      quartos_ideal: 3,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 70,
      area_max_m2: 90,
      faixa_preco_min: 200000,
      faixa_preco_max: 350000,
      condominio_teto: 300,
      lazer: "nenhum"
    },
    alertas: ["Verificar risco geológico antes do lance — consultar URBEL/PBH"],
    viabilidade_temporada: "nenhuma"
  },

  contagem_europa: {
    label: "Contagem — Europa / Eldorado / Santa Cruz",
    cidade: "Contagem",
    bairros: ["Europa", "Eldorado", "Santa Cruz", "Ressaca", "Petrolândia"],
    preco_m2_venda_min: 4200,
    preco_m2_venda_max: 5800,
    preco_m2_venda_medio: 5073,
    preco_m2_locacao: 31,
    tempo_venda_dias: 120,
    tendencia: "estavel_leve_alta",
    tendencia_pct_12m: 3.5,
    demanda: "media",
    vacancia_pct: 5.5,
    yield_bruto_pct: 6.2,
    yield_liquido_pct: 4.0,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 3,
      suites_min: 1,
      vagas_ideal: 2,
      area_min_m2: 80,
      area_max_m2: 130,
      faixa_preco_min: 350000,
      faixa_preco_max: 650000,
      condominio_teto: 600,
      lazer: "basico"
    },
    alertas: [],
    viabilidade_temporada: "baixa",
    observacao: "Contagem/Europa tem padrão superior ao RMBH geral. Coberturas duplex novas têm demanda de família classe média/alta que migra de BH."
  },

  bh_rmbh: {
    label: "RMBH (Contagem / Betim / Ribeirão das Neves)",
    cidade: "Região Metropolitana BH",
    bairros: ["Citrolândia", "Imbiruçu", "Alterosas"],
    preco_m2_venda_min: 2500,
    preco_m2_venda_max: 5500,
    preco_m2_venda_medio: 4000,
    preco_m2_locacao: 22,
    tempo_venda_dias: 210,
    tendencia: "estavel_baixa",
    tendencia_pct_12m: 1.5,
    demanda: "baixa",
    vacancia_pct: 8.0,
    yield_bruto_pct: 7.0,
    yield_liquido_pct: 4.5,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 45,
      area_max_m2: 65,
      faixa_preco_min: 150000,
      faixa_preco_max: 300000,
      condominio_teto: 300,
      lazer: "nenhum"
    },
    alertas: [
      "Liquidez abaixo da média — estimar prazo de 90-150 dias para revenda",
      "Vacância regional elevada — preferir locação a flip rápido",
    ],
    viabilidade_temporada: "nenhuma"
  },

  // ── JUIZ DE FORA ────────────────────────────────────────────────
  jf_centro: {
    label: "JF Centro / Centro Histórico",
    cidade: "Juiz de Fora",
    bairros: ["Centro", "Centro Histórico", "Santa Helena", "Monte Castelo"],
    preco_m2_venda_min: 5500,
    preco_m2_venda_max: 6800,
    preco_m2_venda_medio: 6150,
    preco_m2_locacao: 21,
    tempo_venda_dias: 75,
    tendencia: "estavel",
    tendencia_pct_12m: 3.0,
    demanda: "alta",
    vacancia_pct: 4.0,
    yield_bruto_pct: 4.5,
    yield_liquido_pct: 2.8,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 55,
      area_max_m2: 75,
      faixa_preco_min: 280000,
      faixa_preco_max: 450000,
      condominio_teto: 500,
      lazer: "basico"
    },
    alertas: [],
    viabilidade_temporada: "media"
  },

  jf_bairros_nobres: {
    label: "JF Manoel Honório / Benfica / Dom Bosco",
    cidade: "Juiz de Fora",
    bairros: ["Manoel Honório", "Benfica", "Dom Bosco", "Grama", "Salvaterra"],
    preco_m2_venda_min: 5500,
    preco_m2_venda_max: 6500,
    preco_m2_venda_medio: 6000,
    preco_m2_locacao: 20,
    tempo_venda_dias: 75,
    tendencia: "estavel",
    tendencia_pct_12m: 3.5,
    demanda: "alta",
    vacancia_pct: 3.5,
    yield_bruto_pct: 5.0,
    yield_liquido_pct: 3.2,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 55,
      area_max_m2: 75,
      faixa_preco_min: 280000,
      faixa_preco_max: 420000,
      condominio_teto: 500,
      lazer: "basico"
    },
    alertas: [],
    viabilidade_temporada: "media"
  },

  jf_bairros_medios: {
    label: "JF Cascatinha / São Mateus / Granbery / Alto dos Passos",
    cidade: "Juiz de Fora",
    bairros: ["Cascatinha", "São Mateus", "Granbery", "Alto dos Passos", "Jardim Glória", "Santa Luzia"],
    preco_m2_venda_min: 5000,
    preco_m2_venda_max: 5650,
    preco_m2_venda_medio: 5300,
    preco_m2_locacao: 23,
    tempo_venda_dias: 105,
    tendencia: "estavel",
    tendencia_pct_12m: 2.5,
    demanda: "media",
    vacancia_pct: 5.0,
    yield_bruto_pct: 5.0,
    yield_liquido_pct: 3.0,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 55,
      area_max_m2: 75,
      faixa_preco_min: 250000,
      faixa_preco_max: 380000,
      condominio_teto: 450,
      lazer: "nenhum"
    },
    alertas: [],
    viabilidade_temporada: "baixa"
  },

  jf_periferica: {
    label: "JF Bairros Periféricos (Passos / Graminha / Ipiranga)",
    cidade: "Juiz de Fora",
    bairros: ["Passos", "São Pedro", "Bom Pastor", "Graminha", "Progresso", "Vitorino Braga", "Ipiranga"],
    preco_m2_venda_min: 4500,
    preco_m2_venda_max: 5600,
    preco_m2_venda_medio: 5000,
    preco_m2_locacao: 18,
    tempo_venda_dias: 180,
    tendencia: "estavel_queda",
    tendencia_pct_12m: 0.5,
    demanda: "baixa",
    vacancia_pct: 7.0,
    yield_bruto_pct: 4.0,
    yield_liquido_pct: 2.6,
    imovel_mais_liquido: {
      tipologia: "apartamento",
      quartos_ideal: 2,
      suites_min: 0,
      vagas_ideal: 1,
      area_min_m2: 45,
      area_max_m2: 65,
      faixa_preco_min: 180000,
      faixa_preco_max: 300000,
      condominio_teto: 350,
      lazer: "nenhum"
    },
    alertas: [
      "Liquidez reduzida em regiões periféricas de JF — prazo de venda estimado 6+ meses",
      "Ciclo de venda lento — evitar operações que exijam saída rápida",
    ],
    viabilidade_temporada: "nenhuma"
  }
}

// Mapeamento bairro → regiao_macro
export const BAIRRO_PARA_REGIAO = {
  // BH Centro-Sul (sem Lourdes/Funcionários — esses são bh_savassi classe 4 Luxo)
  "serra": "bh_centro_sul", "sion": "bh_centro_sul",
  "anchieta": "bh_centro_sul", "santo agostinho": "bh_centro_sul",
  "santo antônio": "bh_centro_sul", "santo antonio": "bh_centro_sul",
  "gutierrez": "bh_centro_sul", "cruzeiro": "bh_centro_sul",
  // BH Savassi (classe 4 Luxo — inclui Lourdes e Funcionários)
  "savassi": "bh_savassi", "lourdes": "bh_savassi",
  "funcionários": "bh_savassi", "funcionarios": "bh_savassi",
  "belvedere": "bh_savassi", "luxemburgo": "bh_savassi",
  "cidade jardim": "bh_savassi",
  // BH Pampulha
  "pampulha": "bh_pampulha",
  "são luiz": "bh_pampulha", "sao luiz": "bh_pampulha",
  "bandeirantes": "bh_pampulha",
  "itapoã": "bh_pampulha", "itapoa": "bh_pampulha",
  // Nova Lima
  "vila da serra": "nova_lima", "morro do chapéu": "nova_lima",
  "nova lima": "nova_lima",
  // BH Buritis
  "buritis": "bh_buritis", "estoril": "bh_buritis",
  "salgado filho": "bh_buritis", "ouro preto": "bh_buritis",
  "alto barroca": "bh_buritis", "barroca": "bh_buritis",
  "castelo": "bh_buritis",
  // BH Santa Efigênia
  "santa efigênia": "bh_santa_efigenia", "santa efigenia": "bh_santa_efigenia",
  "carlos prates": "bh_santa_efigenia", "floresta": "bh_santa_efigenia",
  "lagoinha": "bh_santa_efigenia",
  // BH Cidade Nova
  "cidade nova": "bh_cidade_nova", "caiçara": "bh_cidade_nova",
  "caicara": "bh_cidade_nova", "padre eustáquio": "bh_cidade_nova",
  "padre eustaquio": "bh_cidade_nova", "planalto": "bh_cidade_nova",
  "jardim guanabara": "bh_cidade_nova", "engenho nogueira": "bh_cidade_nova",
  // BH Venda Nova
  "venda nova": "bh_venda_nova", "jardim leblon": "bh_venda_nova",
  "mantiqueira": "bh_venda_nova", "tupi": "bh_venda_nova",
  // BH Barreiro
  "barreiro": "bh_barreiro", "milionários": "bh_barreiro",
  "milionarios": "bh_barreiro", "jatobá": "bh_barreiro",
  "jatoba": "bh_barreiro",
  // Contagem Europa
  "europa": "contagem_europa", "europa contagem": "contagem_europa",
  "contagem europa": "contagem_europa", "petrolândia": "contagem_europa",
  "petrolandia": "contagem_europa",
  // RMBH
  "contagem": "contagem_europa", "betim": "bh_rmbh",
  "ribeirão das neves": "bh_rmbh", "vespasiano": "bh_rmbh",
  "santa luzia": "bh_rmbh", "eldorado": "contagem_europa",
  // JF
  "centro jf": "jf_centro", "centro juiz de fora": "jf_centro",
  "centro bh": "bh_cidade_nova",
  "centro": "jf_centro", "centro histórico": "jf_centro",
  "santa helena": "jf_centro", "monte castelo": "jf_centro",
  "manoel honório": "jf_bairros_nobres", "benfica": "jf_bairros_nobres",
  "dom bosco": "jf_bairros_nobres", "grama": "jf_bairros_nobres",
  "salvaterra": "jf_bairros_nobres",
  "cascatinha": "jf_bairros_medios", "são mateus": "jf_bairros_medios",
  "granbery": "jf_bairros_medios", "alto dos passos": "jf_bairros_medios",
  "passos": "jf_periferica", "graminha": "jf_periferica",
  "ipiranga": "jf_periferica", "progresso": "jf_periferica"
}

// Detectar região a partir de cidade + bairro (case insensitive)
export function detectarRegiao(cidade = '', bairro = '') {
  const c = cidade.toLowerCase().trim()
  const b = bairro.toLowerCase().trim()

  // Busca direta no mapa
  if (BAIRRO_PARA_REGIAO[b]) return BAIRRO_PARA_REGIAO[b]

  // Busca parcial
  for (const [key, regiao] of Object.entries(BAIRRO_PARA_REGIAO)) {
    if (b.includes(key) || key.includes(b)) return regiao
  }

  // Fallback por cidade
  if (c.includes('juiz') || c.includes('jf')) return 'jf_bairros_medios'
  if (c.includes('nova lima')) return 'nova_lima'
  if (c.includes('contagem')) return 'contagem_europa'
  if (c.includes('betim')) return 'bh_rmbh'
  if (c.includes('belo horizonte') || c.includes('bh')) return 'bh_cidade_nova'

  return null
}

// Obter dados de mercado para uma região
export function getMercado(regiao) {
  return MERCADO_REGIONAL[regiao] || null
}

// Calcular valor de mercado estimado
export function estimarValorMercado(regiao, area_m2) {
  const m = getMercado(regiao)
  if (!m || !area_m2) return null
  return m.preco_m2_venda_medio * area_m2
}

// Calcular aluguel estimado
export function estimarAluguel(regiao, area_m2) {
  const m = getMercado(regiao)
  if (!m || !area_m2) return null
  return m.preco_m2_locacao * area_m2
}
