// ═══════════════════════════════════════════════════════════════
// LEILAX — Base de Custos de Reforma MG/BH/JF
// Versão: MG_BH_JF_reforma_pequena_v1 (2026)
// Escopo: APENAS custo direto de mão de obra + materiais + terceirizados
// NÃO inclui: projeto, ART/RRT, administração, eletros, marcenaria,
//             móveis, documentação, custo financeiro
// Fonte: Lar Pontual SP 2026 ajustado MG + Preço da Obra + SINAPI MG jun/2025
// ═══════════════════════════════════════════════════════════════

export const CLASSES_MERCADO_REFORMA = [
  {
    classe: "A_prime",
    label: "Classe A — Prime",
    faixa_venda_m2_min: 12000,
    faixa_venda_m2_max: 99999,
    bairros_referencia: [
      "Savassi", "Lourdes", "Belvedere", "Funcionários",
      "Serra", "Sion", "Anchieta", "Vila da Serra", "Nova Lima"
    ],
    regioes_mercado: ["bh_centro_sul", "bh_savassi", "nova_lima"],
    custos_m2: {
      refresh_giro:              { min: 320, max: 520 },
      leve_funcional:            { min: 520, max: 900 },
      leve_reforcada_1_molhado:  { min: 900, max: 1450 }
    },
    teto_pct_valor_imovel: { min: 0.03, max: 0.07 },
    observacao: "Aceita acabamento melhor, mas ainda não vale exagero em flip. Logística de condomínio premium +15–25%."
  },
  {
    classe: "B_medio_alto",
    label: "Classe B — Médio-Alto",
    faixa_venda_m2_min: 8000,
    faixa_venda_m2_max: 12000,
    bairros_referencia: [
      "Buritis", "Estoril", "Luxemburgo", "Salgado Filho",
      "Santa Efigênia", "Carlos Prates", "Floresta", "Pampulha",
      "Castelo", "São Luiz", "Bandeirantes"
    ],
    regioes_mercado: ["bh_buritis", "bh_santa_efigenia", "bh_pampulha"],
    custos_m2: {
      refresh_giro:              { min: 280, max: 470 },
      leve_funcional:            { min: 470, max: 820 },
      leve_reforcada_1_molhado:  { min: 820, max: 1320 }
    },
    teto_pct_valor_imovel: { min: 0.03, max: 0.06 },
    observacao: "Mercado bom mas mais sensível a gasto excessivo. Obra objetiva com bom acabamento."
  },
  {
    classe: "C_intermediario",
    label: "Classe C — Intermediário",
    faixa_venda_m2_min: 5000,
    faixa_venda_m2_max: 8000,
    bairros_referencia: [
      "Cidade Nova", "Caiçara", "Padre Eustáquio",
      "Barreiro", "Milionários", "Jatobá",
      "Centro JF", "Santa Helena", "Monte Castelo",
      "Cascatinha", "São Mateus", "Granbery",
      "Alto dos Passos", "Manoel Honório", "Benfica"
    ],
    regioes_mercado: ["bh_cidade_nova", "bh_barreiro", "jf_centro", "jf_bairros_nobres", "jf_bairros_medios"],
    custos_m2: {
      refresh_giro:              { min: 240, max: 420 },
      leve_funcional:            { min: 420, max: 720 },
      leve_reforcada_1_molhado:  { min: 720, max: 1150 }
    },
    teto_pct_valor_imovel: { min: 0.025, max: 0.05 },
    observacao: "App deve travar melhor excesso de acabamento. Obra muito objetiva e econômica."
  },
  {
    classe: "D_sensivel_preco",
    label: "Classe D — Sensível a Preço",
    faixa_venda_m2_min: 0,
    faixa_venda_m2_max: 5000,
    bairros_referencia: [
      "Venda Nova", "Jardim Leblon", "Mantiqueira",
      "Contagem", "Betim", "Ribeirão das Neves",
      "Graminha", "Progresso", "Vitorino Braga", "Ipiranga",
      "Passos", "São Pedro"
    ],
    regioes_mercado: ["bh_venda_nova", "bh_rmbh", "jf_periferica"],
    custos_m2: {
      refresh_giro:              { min: 200, max: 360 },
      leve_funcional:            { min: 360, max: 620 },
      leve_reforcada_1_molhado:  { min: 620, max: 980 }
    },
    teto_pct_valor_imovel: { min: 0.02, max: 0.04 },
    observacao: "Reforma tem que ser estritamente de giro. Sem embelezamento caro."
  }
]

// Pacotes de serviço — independentes de m²
export const PACOTES_SERVICO = {
  pintura_geral_reparos:       { min: 3500,  max: 9000,  label: "Pintura geral + reparos leves" },
  revisao_eletrica_pontual:    { min: 1500,  max: 5000,  label: "Revisão elétrica pontual" },
  revisao_hidraulica_pontual:  { min: 1500,  max: 6000,  label: "Revisão hidráulica pontual" },
  banheiro_refresh:            { min: 7000,  max: 14000, label: "Banheiro refresh econômico" },
  banheiro_leve_reforcado:     { min: 14000, max: 22000, label: "Banheiro leve reforçado" },
  cozinha_refresh:             { min: 10000, max: 20000, label: "Cozinha refresh econômica" },
  cozinha_leve_reforcada:      { min: 20000, max: 32000, label: "Cozinha leve reforçada" },
  serralheria_pontual:         { min: 1000,  max: 6000,  label: "Serralheria pontual" },
  vidracaria_pontual:          { min: 800,   max: 5000,  label: "Vidraçaria pontual" },
  piso_simples_m2:             { min: 70,    max: 180,   label: "Piso simples/vinílico/laminado (por m²)" },
  gesso_pontual_m2:            { min: 60,    max: 180,   label: "Gesso pontual/sanca (por m²)" }
}

// Escopos de reforma definidos
export const ESCOPOS_REFORMA = {
  refresh_giro: {
    label: "Refresh de Giro",
    descricao: "Pintura, pequenos reparos, revisão elétrica/hidráulica pontual, troca de luminárias, metais, louças pontuais, pequenos vidros/serralheria",
    inclui: ["pintura_geral_reparos", "revisao_eletrica_pontual", "revisao_hidraulica_pontual", "serralheria_pontual", "vidracaria_pontual"],
    fator_valorizacao: 1.04
  },
  leve_funcional: {
    label: "Leve Funcional",
    descricao: "Refresh + piso simples/vinílico/laminado ou porcelanato econômico parcial, troca maior de tomadas/interruptores, revisão hidráulica mais ampla, portas/ferragens, gesso pontual",
    inclui: ["pintura_geral_reparos", "revisao_eletrica_pontual", "revisao_hidraulica_pontual", "piso_simples_m2", "gesso_pontual_m2", "serralheria_pontual"],
    fator_valorizacao: 1.08
  },
  leve_reforcada_1_molhado: {
    label: "Leve Reforçada (1 Área Molhada)",
    descricao: "Leve funcional + 1 banheiro ou 1 cozinha em padrão econômico/intermediário, sem quebra geral do apartamento",
    inclui: ["pintura_geral_reparos", "revisao_eletrica_pontual", "revisao_hidraulica_pontual", "piso_simples_m2", "banheiro_refresh"],
    fator_valorizacao: 1.12
  }
}

// Penalizações de score por sobrecapitalização
export const PENALIZACOES_SOBRECAP = {
  alerta_amarelo: { threshold: "teto_min", score_penalizacao: -8,  label: "Reforma no limite do teto recomendado" },
  alerta_vermelho: { threshold: "teto_max", score_penalizacao: -18, label: "Sobrecapitalização — reforma acima do teto do bairro" }
}

// ── FUNÇÕES ──────────────────────────────────────────────────────

// Detectar classe de mercado pela região ou preço/m²
export function detectarClasseMercado(regiao_mercado, preco_m2_atual = null) {
  // Por região primeiro
  for (const classe of CLASSES_MERCADO_REFORMA) {
    if (classe.regioes_mercado.includes(regiao_mercado)) return classe
  }
  // Por preço/m² como fallback
  if (preco_m2_atual) {
    for (const classe of CLASSES_MERCADO_REFORMA) {
      if (preco_m2_atual >= classe.faixa_venda_m2_min &&
          preco_m2_atual < classe.faixa_venda_m2_max) return classe
    }
  }
  return CLASSES_MERCADO_REFORMA[2] // default: Classe C
}

// Calcular custo direto total da reforma
export function calcularCustoReforma(params) {
  const {
    area_m2,
    escopo,
    regiao_mercado,
    preco_m2_atual,
    pacotes_adicionais = [],
    usar_valor_medio = true
  } = params

  const classe = detectarClasseMercado(regiao_mercado, preco_m2_atual)
  const custos_escopo = classe.custos_m2[escopo]
  if (!custos_escopo) return null

  const custo_m2 = usar_valor_medio
    ? (custos_escopo.min + custos_escopo.max) / 2
    : custos_escopo.min

  const custo_base = area_m2 * custo_m2

  // Somar pacotes adicionais específicos
  let custo_pacotes = 0
  for (const pacote_id of pacotes_adicionais) {
    const pacote = PACOTES_SERVICO[pacote_id]
    if (pacote) {
      custo_pacotes += usar_valor_medio
        ? (pacote.min + pacote.max) / 2
        : pacote.min
    }
  }

  // Fator logístico de condomínio (+15% médio)
  const fator_logistica = 1.15
  const custo_total_bruto = (custo_base + custo_pacotes) * fator_logistica

  // Reserva de contingência 12%
  const reserva = custo_total_bruto * 0.12
  const custo_total_com_reserva = custo_total_bruto + reserva

  return {
    classe: classe.classe,
    classe_label: classe.label,
    escopo,
    area_m2,
    custo_m2_min: custos_escopo.min,
    custo_m2_max: custos_escopo.max,
    custo_m2_usado: custo_m2,
    custo_base,
    custo_pacotes,
    fator_logistica,
    custo_total_bruto: Math.round(custo_total_bruto),
    reserva_contingencia: Math.round(reserva),
    custo_total_final: Math.round(custo_total_com_reserva),
    fator_valorizacao: ESCOPOS_REFORMA[escopo]?.fator_valorizacao || 1.05
  }
}

// Verificar sobrecapitalização
export function verificarSobrecapitalizacao(custo_total, valor_mercado, regiao_mercado, preco_m2_atual) {
  const classe = detectarClasseMercado(regiao_mercado, preco_m2_atual)
  const indice = custo_total / valor_mercado
  const teto_min = classe.teto_pct_valor_imovel.min
  const teto_max = classe.teto_pct_valor_imovel.max

  if (indice > teto_max) {
    return {
      status: "vermelho",
      indice_pct: (indice * 100).toFixed(1),
      teto_max_pct: (teto_max * 100).toFixed(0),
      score_penalizacao: PENALIZACOES_SOBRECAP.alerta_vermelho.score_penalizacao,
      mensagem: `Reforma representa ${(indice*100).toFixed(1)}% do valor do imóvel — acima do teto de ${(teto_max*100).toFixed(0)}% para ${classe.label}`
    }
  }

  if (indice > teto_min) {
    return {
      status: "amarelo",
      indice_pct: (indice * 100).toFixed(1),
      teto_min_pct: (teto_min * 100).toFixed(0),
      score_penalizacao: PENALIZACOES_SOBRECAP.alerta_amarelo.score_penalizacao,
      mensagem: `Reforma representa ${(indice*100).toFixed(1)}% do valor do imóvel — no limite do teto de ${(teto_min*100).toFixed(0)}% para ${classe.label}`
    }
  }

  return {
    status: "verde",
    indice_pct: (indice * 100).toFixed(1),
    score_penalizacao: 0,
    mensagem: `Reforma dentro do teto recomendado para ${classe.label}`
  }
}

// Estimar valor pós-reforma com teto de mercado
export function estimarValorPosReforma(valor_mercado_atual, custo_reforma, escopo, regiao_mercado, preco_m2_atual) {
  const escopo_dados = ESCOPOS_REFORMA[escopo]
  const fator = escopo_dados?.fator_valorizacao || 1.05

  // Teto: não pode ultrapassar 110% do teto de mercado da região
  const preco_teto = (preco_m2_atual || 0) * 1.10
  const valor_pos_bruto = valor_mercado_atual * fator
  const valor_pos_teto = preco_teto > 0
    ? Math.min(valor_pos_bruto, preco_teto * (valor_mercado_atual / (preco_m2_atual || 1)))
    : valor_pos_bruto

  return {
    valor_pos_reforma: Math.round(valor_pos_teto),
    ganho_bruto: Math.round(valor_pos_teto - valor_mercado_atual),
    ganho_liquido: Math.round(valor_pos_teto - valor_mercado_atual - custo_reforma),
    indice_eficiencia: custo_reforma > 0
      ? ((valor_pos_teto - valor_mercado_atual) / custo_reforma).toFixed(2)
      : 0,
    fator_valorizacao: fator
  }
}
