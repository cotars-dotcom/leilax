/**
 * metricas_bairros_bh.js
 * AXIS Platform — Módulo de Métricas Imobiliárias BH
 * Fontes: QuintoAndar 3T2025 + FipeZAP fev/2026 + IPEAD/UFMG + PRODABEL/PBH
 * Gerado: 2026-03-23
 */

export const CLASSE_IPEAD = Object.freeze({
  1: 'Popular', 2: 'Médio', 3: 'Alto', 4: 'Luxo',
})

export const REFERENCIAS_BH = Object.freeze({
  preco_m2_medio_bh:     10595,
  variacao_12_meses:     0.0882,
  preco_m2_betim:        4870,
  preco_m2_contagem:     5836,
  variacao_12m_betim:    0.1024,
  variacao_12m_contagem: 0.0333,
  yield_medio_bh:        5.80,
  ticket_medio_bh:       613344,
  // FipeZAP Locação Residencial fev/2026
  preco_m2_locacao_bh:      48.28,
  variacao_mensal_loc:       0.0021,
  variacao_12m_locacao:      0.1052,
  variacao_bimestre_loc:     0.0055,
  rental_yield_bh_anual:     5.16,
  preco_m2_locacao_brasil:   51.89,
  fonte_locacao: 'FipeZAP Locação Residencial fev/2026',
  atualizado_locacao_em: '2026-02',
  fonte: 'FipeZAP fev/2026 + QuintoAndar 3T2025 + Secovi-MG jul/2025',
  atualizado_em: '2026-02',
})

export const YIELD_POR_ZONA = Object.freeze({
  'Centro Sul': 5.30, 'Oeste': 5.70, 'Nordeste': 6.40,
  'Leste': 5.90, 'Pampulha': 6.40, 'Noroeste': 6.40, 'Norte': 6.60,
})

export const YIELD_FIPEZAP_BH = Object.freeze({
  bh_geral:    5.16,  // FipeZAP fev/2026 — sobre preço anúncio
  // Nota: yield QuintoAndar (sobre preço contrato) é maior
  // Centro Sul: 5.30% (QA) vs ~4.8% (FZ) — diferença pela discrepância asking/closing
  // Norte: 6.60% (QA) — maior yield pois preços de anúncio são mais baixos
  fonte: 'FipeZAP Locação Residencial fev/2026',
  metodologia: 'preço_anuncio_locacao / preço_anuncio_venda',
})

export const PRECO_M2_POR_ZONA = Object.freeze({
  'Centro Sul': 6796.90, 'Oeste': 5762.70, 'Nordeste': 5454.50,
  'Leste': 4923.10, 'Pampulha': 4755.10, 'Noroeste': 4583.30, 'Norte': 4309.50,
})

// 21 bairros com preço anúncio (FipeZAP) + contrato (QuintoAndar) + classe IPEAD
export const BAIRROS_BH = [
  { key:'bh_bairro_savassi', label:'Savassi', zona:'Centro Sul',
    precoAnuncioM2:16310, precoContratoM2:9302, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:4, tipoPreco:'anuncio_fipezap' },
  { key:'bh_bairro_lourdes', label:'Lourdes', zona:'Centro Sul',
    precoAnuncioM2:15804, precoContratoM2:11148, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:2, tipoPreco:'anuncio_fipezap' },
  { key:'bh_bairro_funcionarios', label:'Funcionários', zona:'Centro Sul',
    precoAnuncioM2:15053, precoContratoM2:11237, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:1, tipoPreco:'anuncio_fipezap',
    destaque_locacao:true, obs_locacao:'Top 3 bairros mais caros em locação BH (FipeZAP fev/2026)' },
  { key:'bh_bairro_gutierrez', label:'Gutierrez', zona:'Centro Sul',
    precoAnuncioM2:11024, precoContratoM2:null, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null, tipoPreco:'anuncio_fipezap',
    destaque_locacao:true, obs_locacao:'Top 3 bairros mais caros em locação BH (FipeZAP fev/2026)' },
  { key:'bh_bairro_serra', label:'Serra', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:9464, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:68.3, rankingQA:3, tipoPreco:'contrato_qa',
    obs:'Maior valorização trimestral BH — verificar amostra' },
  { key:'bh_bairro_anchieta', label:'Anchieta', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:7833, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:5, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_sion', label:'Sion', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:6878, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:7, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_santo_agostinho', label:'Santo Agostinho', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null, tipoPreco:'proxy_zona',
    obs:'Dado específico pendente — estimativa via zona Centro Sul' },
  { key:'bh_bairro_santo_antonio', label:'Santo Antônio', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:26.3, rankingQA:null, tipoPreco:'proxy_zona',
    obs:'⚠️ Tendência +26,3% — verificar amostra antes de usar como premissa' },
  { key:'bh_bairro_cruzeiro', label:'Cruzeiro', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:6412, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:9, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_estoril', label:'Estoril', zona:'Oeste',
    precoAnuncioM2:null, precoContratoM2:7544, classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:5.70, tendencia12m:8.82, rankingQA:6, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_buritis', label:'Buritis', zona:'Oeste',
    precoAnuncioM2:10200, precoContratoM2:6764, classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:5.70, tendencia12m:6.9, rankingQA:8, tipoPreco:'anuncio_fipezap',
    destaque_locacao:true, obs_locacao:'Top 3 bairros mais caros em locação BH (FipeZAP fev/2026)' },
  { key:'bh_bairro_luxemburgo', label:'Luxemburgo', zona:'Oeste',
    precoAnuncioM2:null, precoContratoM2:5882, classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.70, tendencia12m:8.82, rankingQA:12, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_barroca', label:'Barroca', zona:'Oeste',
    precoAnuncioM2:null, precoContratoM2:5176, classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:5.70, tendencia12m:8.82, rankingQA:14, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_castelo', label:'Castelo', zona:'Pampulha',
    precoAnuncioM2:null, precoContratoM2:null, classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:6.40, tendencia12m:8.82, rankingQA:null, tipoPreco:'proxy_zona',
    obs:'Dado específico pendente — usar proxy zona Pampulha' },
  { key:'bh_bairro_cidade_nova', label:'Cidade Nova', zona:'Nordeste',
    precoAnuncioM2:null, precoContratoM2:5188, classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:6.40, tendencia12m:8.82, rankingQA:13, tipoPreco:'contrato_qa' },
  { key:'bh_bairro_santa_efigenia', label:'Santa Efigênia', zona:'Leste',
    precoAnuncioM2:8123, precoContratoM2:6300, classeIpead:2, classeIpeadLabel:'Médio',
    yieldBruto:5.90, tendencia12m:3.0, rankingQA:10, tipoPreco:'anuncio_fipezap' },
  { key:'bh_bairro_sagrada_familia', label:'Sagrada Família', zona:'Leste',
    precoAnuncioM2:null, precoContratoM2:null, classeIpead:2, classeIpeadLabel:'Médio',
    yieldBruto:5.90, tendencia12m:8.82, rankingQA:null, tipoPreco:'proxy_zona',
    obs:'Dado específico pendente — usar proxy zona Leste' },
  { key:'bh_bairro_carlos_prates', label:'Carlos Prates', zona:'Noroeste',
    precoAnuncioM2:6037, precoContratoM2:null, classeIpead:2, classeIpeadLabel:'Médio',
    yieldBruto:6.40, tendencia12m:2.5, rankingQA:null, tipoPreco:'anuncio_fipezap' },
  { key:'bh_bairro_padre_eustaquio', label:'Padre Eustáquio', zona:'Noroeste',
    precoAnuncioM2:null, precoContratoM2:null, classeIpead:2, classeIpeadLabel:'Médio',
    yieldBruto:6.40, tendencia12m:8.82, rankingQA:null, tipoPreco:'proxy_zona',
    obs:'Dado específico pendente — usar proxy zona Noroeste' },
  { key:'bh_bairro_venda_nova', label:'Venda Nova', zona:'Norte',
    precoAnuncioM2:4365, precoContratoM2:null, classeIpead:2, classeIpeadLabel:'Médio',
    yieldBruto:6.60, tendencia12m:2.0, rankingQA:null, tipoPreco:'anuncio_fipezap' },
  { key:'bh_bairro_planalto', label:'Planalto', zona:'Norte',
    precoAnuncioM2:null, precoContratoM2:null, classeIpead:2, classeIpeadLabel:'Médio',
    yieldBruto:6.60, tendencia12m:2.0, rankingQA:null, tipoPreco:'proxy_zona',
    obs:'Classe 2 Médio (5 a 8.5 SM) — dado estimado via zona Norte' },
  { key:'bh_bairro_mangabeiras', label:'Mangabeiras', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Dado específico pendente — usar proxy zona Centro Sul' },
  { key:'bh_bairro_belvedere', label:'Belvedere', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Inclui Belvedere Nova Lima — verificar divisa' },
  { key:'bh_bairro_santa_lucia', label:'Santa Lúcia', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Dado específico pendente' },
  { key:'bh_bairro_carmo', label:'Carmo', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:4, classeIpeadLabel:'Luxo',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Dado específico pendente' },
  { key:'bh_bairro_floresta', label:'Floresta', zona:'Leste',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:5.90, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Bairro histórico próximo ao centro' },
  { key:'bh_bairro_prado', label:'Prado', zona:'Oeste',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:5.70, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Dado específico pendente' },
  { key:'bh_bairro_barro_preto', label:'Barro Preto', zona:'Centro Sul',
    precoAnuncioM2:null, precoContratoM2:null,
    classeIpead:3, classeIpeadLabel:'Alto',
    yieldBruto:5.30, tendencia12m:8.82, rankingQA:null,
    tipoPreco:'proxy_zona',
    obs:'Polo médico BH — demanda por locação alta' },
]

// Função principal — buscar dados de bairro por nome
export function getBairroDados(nomeBairro) {
  if (!nomeBairro) return null
  const norm = nomeBairro.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  return BAIRROS_BH.find(b => {
    const bl = b.label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return bl === norm || bl.includes(norm) || norm.includes(bl)
  }) || null
}

// Calcular gap % entre anúncio e contrato
export function calcGapPrecoPct(bairro) {
  if (!bairro?.precoAnuncioM2 || !bairro?.precoContratoM2) return null
  return ((bairro.precoAnuncioM2 - bairro.precoContratoM2) / bairro.precoAnuncioM2) * 100
}

// Obter classe IPEAD de um bairro pelo nome
export function getClasseIPEAD(nomeBairro) {
  const b = getBairroDados(nomeBairro)
  if (!b) return null
  return { classe: b.classeIpead, label: b.classeIpeadLabel }
}

// Alertas de qualidade de dados
export const ALERTAS_DADOS = [
  'Santo Antônio: tendência +26,3% (FipeZAP) com gap asking/closing ~94% — verificar amostra',
  'Castelo, Sagrada Família, Padre Eustáquio: tipoPreco=proxy_zona — atualizar quando dado específico disponível',
  'Vacância: 100% estimada — nenhuma das 4 fontes traz dado direto por bairro',
]
