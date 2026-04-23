/**
 * AXIS — Exportar Carteira para Excel (CSV compatível)
 * 
 * Gera CSV com todos os imóveis da carteira para análise em Excel/Sheets.
 */

const fmtNum = v => v != null ? Math.round(parseFloat(v) || 0) : ''
const fmtPct = v => v != null ? (parseFloat(v) || 0).toFixed(1) + '%' : ''
const fmtDate = d => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : ''

const COLUNAS = [
  { label: 'Código AXIS',        fn: p => p.codigo_axis || '' },
  { label: 'Título',              fn: p => (p.titulo || '').replace(/;/g, ',') },
  { label: 'Bairro',              fn: p => p.bairro || '' },
  { label: 'Cidade',              fn: p => p.cidade || '' },
  { label: 'Tipo',                fn: p => p.tipo || '' },
  { label: 'Área m²',             fn: p => fmtNum(p.area_privativa_m2 || p.area_m2) },
  { label: 'Quartos',             fn: p => p.quartos || '' },
  { label: 'Suítes',              fn: p => p.suites || '' },
  { label: 'Vagas',               fn: p => p.vagas || '' },
  { label: 'Recomendação',        fn: p => p.recomendacao || '' },
  { label: 'Score Total (0-100)', fn: p => p.score_total ? Math.round(parseFloat(p.score_total) * 10) : '' },
  { label: 'Confiança (%)',        fn: p => p.confidence_score || '' },
  { label: 'Status Operacional',  fn: p => p.status_operacional || '' },
  { label: 'Tipo Transação',      fn: p => p.tipo_transacao || '' },
  { label: 'Avaliação (R$)',       fn: p => fmtNum(p.valor_avaliacao) },
  { label: 'Lance Mínimo (R$)',    fn: p => fmtNum(p.valor_minimo) },
  { label: 'Data 1ª Praça',       fn: p => fmtDate(p.data_leilao) },
  { label: 'Lance Mínimo 2ª (R$)', fn: p => fmtNum(p.valor_minimo_2) },
  { label: 'Data 2ª Praça',        fn: p => fmtDate(p.data_leilao_2) },
  { label: 'Valor Mercado (R$)',   fn: p => fmtNum(p.valor_mercado_estimado) },
  { label: 'Desconto s/Avaliação', fn: p => fmtPct(p.desconto_percentual) },
  { label: 'Desc. s/Mercado',      fn: p => fmtPct(p.desconto_sobre_mercado_pct_calculado) },
  { label: 'Preço/m² Imóvel',     fn: p => fmtNum(p.preco_m2_imovel) },
  { label: 'Preço/m² Mercado',    fn: p => fmtNum(p.preco_m2_mercado) },
  { label: 'Lance Máx. Flip (R$)',  fn: p => fmtNum(p.mao_flip) },
  { label: 'Lance Máx. Locação (R$)', fn: p => fmtNum(p.mao_locacao) },
  { label: 'Aluguel Est./mês (R$)', fn: p => fmtNum(p.aluguel_mensal_estimado) },
  { label: 'Yield Bruto (%)',      fn: p => fmtPct(p.yield_bruto_pct) },
  { label: 'Condomínio/mês (R$)', fn: p => fmtNum(p.condominio_mensal) },
  { label: 'Custo Reforma Básica', fn: p => fmtNum(p.custo_reforma_basica) },
  { label: 'Custo Reforma Média',  fn: p => fmtNum(p.custo_reforma_media) },
  { label: 'Custo Reforma Compl.', fn: p => fmtNum(p.custo_reforma_completa) },
  { label: 'Débitos Estimados',    fn: p => fmtNum(p.debitos_total_estimado) },
  { label: 'Resp. Débitos',        fn: p => p.responsabilidade_debitos || '' },
  { label: 'Score Localização',   fn: p => p.score_localizacao || '' },
  { label: 'Score Desconto',      fn: p => p.score_desconto || '' },
  { label: 'Score Jurídico',      fn: p => p.score_juridico || '' },
  { label: 'Score Ocupação',      fn: p => p.score_ocupacao || '' },
  { label: 'Score Liquidez',      fn: p => p.score_liquidez || '' },
  { label: 'Score Mercado',       fn: p => p.score_mercado || '' },
  { label: 'Financiável',         fn: p => p.financiavel ? 'Sim' : 'Não' },
  { label: 'Ocupação',            fn: p => p.ocupacao || '' },
  { label: 'Prazo Liberação (m)',  fn: p => p.prazo_liberacao_estimado_meses || '' },
  { label: 'Prazo Revenda (m)',    fn: p => p.prazo_revenda_meses || '' },
  { label: 'Classe IPEAD',        fn: p => p.classe_ipead || '' },
  { label: 'Vara Judicial',       fn: p => (p.vara_judicial || '').replace(/;/g, ',') },
  { label: 'Processo CNJ',        fn: p => p.processo_numero || '' },
  { label: 'Estratégia',          fn: p => p.estrategia_recomendada || '' },
  { label: 'Síntese',             fn: p => (p.sintese_executiva || '').replace(/;/g, ',').replace(/\n/g, ' ') },
]

export function exportarExcelCarteira(imoveis) {
  const ativos = imoveis.filter(p =>
    p.status === 'analisado' && p.status_operacional !== 'arquivado'
  )

  const header = COLUNAS.map(c => c.label).join(';')
  const rows = ativos.map(p =>
    COLUNAS.map(c => {
      const v = c.fn(p)
      // Escapar aspas duplas e campos com ponto-e-vírgula
      const s = String(v).replace(/"/g, '""')
      return s.includes(';') ? `"${s}"` : s
    }).join(';')
  )

  // BOM para UTF-8 no Excel
  const bom = '\uFEFF'
  const csv = bom + [header, ...rows].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AXIS_Carteira_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)

  return ativos.length
}
