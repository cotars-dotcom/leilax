/**
 * AXIS IP — Relatorio PDF Profissional v3
 * 7 paginas: Capa | Resumo | Investimento+2aPraca | Reformas | Juridico+Docs | Mercado | Fotos
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { calcularBreakdownFinanceiro, calcularROI, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO, calcularFatorHomogeneizacao } from '../lib/constants.js'
import { CUSTO_M2_SINAPI, FATOR_VALORIZACAO, detectarClasse, avaliarViabilidadeReforma } from '../lib/reformaUnificada.js'

const C = {
  navy: [0, 43, 128], navyL: [230, 236, 250],
  green: [6, 95, 70], greenL: [236, 253, 245],
  red: [153, 27, 27], redL: [254, 226, 226],
  amber: [146, 64, 14], amberL: [254, 243, 199],
  purple: [109, 40, 217], purpleL: [243, 232, 255],
  gray: [100, 116, 139], grayL: [226, 232, 240],
  text: [30, 41, 59], textL: [71, 85, 105],
  bg: [248, 250, 252], white: [255, 255, 255],
  accent: [14, 165, 233],
}
const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '--'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '--'

async function imgToBase64(url, timeout = 6000) {
  try {
    const res = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}&w=600&q=75&output=jpg`, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(); r.readAsDataURL(blob) })
  } catch { return null }
}
function scoreColor(v) { return v >= 7 ? C.green : v >= 5 ? C.amber : C.red }

function secH(doc, y, title) {
  doc.setFillColor(...C.navy); doc.rect(15, y, 180, 8, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white)
  doc.text(title.toUpperCase(), 20, y + 5.5); return y + 12
}
function subH(doc, y, title) {
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy)
  doc.text(title, 15, y); doc.setDrawColor(...C.grayL); doc.setLineWidth(0.3); doc.line(15, y + 1.5, 195, y + 1.5)
  return y + 5
}
function kpi(doc, x, y, w, h, label, value, color, bg) {
  doc.setFillColor(...bg); doc.roundedRect(x, y, w, h, 2, 2, 'F')
  doc.setDrawColor(...color); doc.setLineWidth(0.6); doc.line(x, y + 1, x, y + h - 1)
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray); doc.text(label.toUpperCase(), x + 4, y + 5)
  doc.setFontSize(11); doc.setTextColor(...color); doc.text(value, x + 4, y + 13)
}
function foot(doc, p, pg, tot) {
  doc.setDrawColor(...C.navy); doc.setLineWidth(0.4); doc.line(15, 282, 195, 282)
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray)
  doc.text(`AXIS IP  |  ${p.codigo_axis || ''}  |  ${new Date().toLocaleDateString('pt-BR')}  |  Gerado automaticamente`, 15, 286)
  doc.setFont('helvetica', 'bold'); doc.text(`${pg}/${tot}`, 195, 286, { align: 'right' })
}
function bdg(doc, x, y, text, bg, fg) {
  doc.setFontSize(7); const w = doc.getTextWidth(text) + 8
  doc.setFillColor(...bg); doc.roundedRect(x, y - 4.5, w, 7, 2, 2, 'F')
  doc.setTextColor(...fg); doc.setFont('helvetica', 'bold'); doc.text(text, x + 4, y); doc.setFont('helvetica', 'normal')
  return w + 2
}
function infoBox(doc, x, y, w, h, title, lines, titleColor, bgColor) {
  doc.setFillColor(...bgColor); doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F')
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...titleColor)
  doc.text(title, x + 4, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.text)
  let ly = y + 10
  lines.forEach(l => { doc.text(l, x + 4, ly); ly += 3.5 })
}

export async function gerarPDFProfissional(p, onProgress = () => {}) {
  const doc = new jsPDF('p', 'mm', 'a4')
  let lastY = 0
  const tbl = (opts) => { const r = autoTable(doc, opts); lastY = r?.finalY ?? (doc.lastAutoTable?.finalY ?? lastY); return r }

  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
  const lance = parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const avaliacao = parseFloat(p.valor_avaliacao) || lance
  const bd = calcularBreakdownFinanceiro(lance, p, eMercado)
  const roi = calcularROI(bd.investimentoTotal, mercado, aluguel)
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMensal = condoMensal + iptuMensal
  const holdingTotal = HOLDING_MESES_PADRAO * holdingMensal
  const score = parseFloat(p.score_total || 0)
  const totalPg = 7

  onProgress('Convertendo fotos...')
  const fotosRaw = [p.foto_principal, ...(p.fotos || [])].filter(Boolean)
  const fotosUnicas = [...new Set(fotosRaw)].slice(0, 8)
  const fotosB64 = (await Promise.allSettled(fotosUnicas.map(u => imgToBase64(u)))).map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
  const heroImg = fotosB64[0] || null

  const classe = detectarClasse(parseFloat(p.preco_m2_mercado) || 7000)
  const viab = avaliarViabilidadeReforma(mercado, lance, area, parseFloat(p.preco_m2_mercado) || 7000)
  const homo = calcularFatorHomogeneizacao(p, mercado)
  const reformas = ['refresh_giro', 'leve_reforcada_1_molhado', 'pesada'].map((esc, i) => {
    const custoM2 = CUSTO_M2_SINAPI[esc]?.[classe] || 0
    const custo = parseFloat(p[['custo_reforma_basica', 'custo_reforma_media', 'custo_reforma_completa'][i]]) || Math.round(area * custoM2)
    const fv = FATOR_VALORIZACAO[esc] || 1
    const cenario = ['basica', 'media', 'completa'][i]
    const v = viab?.[cenario]
    return { label: ['Basica (Refresh)', 'Media (1 area molhada)', 'Completa (Full)'][i], custo, custoM2, valorizacao: Math.round((fv - 1) * 100), roiFlip: v?.roiFlip || 0, eficiencia: v?.eficiencia || 0, recomendacao: v?.recomendacao || '' }
  })

  const recLabel = p.recomendacao === 'COMPRAR' ? 'COMPRAR' : p.recomendacao === 'EVITAR' ? 'EVITAR' : 'AGUARDAR'
  const recBg = p.recomendacao === 'COMPRAR' ? C.greenL : p.recomendacao === 'EVITAR' ? C.redL : C.amberL
  const recFg = p.recomendacao === 'COMPRAR' ? C.green : p.recomendacao === 'EVITAR' ? C.red : C.amber

  // Simulacao 2a praca
  const lance2p = Math.round(avaliacao * 0.50)
  const bd2p = calcularBreakdownFinanceiro(lance2p, p, eMercado)
  const roi2p = calcularROI(bd2p.investimentoTotal, mercado, aluguel)

  // Docs do agente juridico
  const docs = Array.isArray(p.resumo_documentos) ? p.resumo_documentos : []

  // ============ PAGINA 1 — CAPA ============
  onProgress('Gerando capa...')
  doc.setFillColor(...C.navy); doc.rect(0, 0, 210, 36, 'F')
  doc.setFillColor(...C.green); doc.rect(0, 36, 210, 1.5, 'F')
  doc.setFontSize(20); doc.setTextColor(...C.white); doc.setFont('helvetica', 'bold'); doc.text('AXIS IP', 15, 15)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 198, 230); doc.text('Inteligencia Imobiliaria', 15, 21)
  doc.setFontSize(7); doc.text('axisip.vercel.app', 15, 27)
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.white); doc.text(p.codigo_axis || '', 195, 15, { align: 'right' })
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 198, 230); doc.text(new Date().toLocaleDateString('pt-BR'), 195, 22, { align: 'right' })

  let y = 42
  if (heroImg) { try { doc.addImage(heroImg, 'JPEG', 15, y, 180, 95); doc.setDrawColor(...C.grayL); doc.setLineWidth(0.5); doc.rect(15, y, 180, 95, 'S'); y += 100 } catch { y += 3 } }
  else { doc.setFillColor(...C.bg); doc.rect(15, y, 180, 50, 'F'); doc.setTextColor(...C.gray); doc.setFontSize(11); doc.text('Foto nao disponivel', 105, y + 28, { align: 'center' }); y += 55 }

  doc.setFontSize(15); doc.setTextColor(...C.text); doc.setFont('helvetica', 'bold')
  const tLines = doc.splitTextToSize((p.titulo || 'Imovel').substring(0, 90), 135)
  doc.text(tLines, 15, y + 4); y += tLines.length * 6 + 3
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray)
  doc.text(doc.splitTextToSize([p.endereco, p.bairro, p.cidade].filter(Boolean).join(' -- ') + `/${p.estado || 'MG'}`, 135), 15, y); y += 8
  doc.setFontSize(8.5); doc.setTextColor(...C.textL)
  doc.text([area ? `${area}m2` : null, p.quartos ? `${p.quartos}q` : null, p.suites ? `${p.suites}s` : null, p.vagas ? `${p.vagas}v` : null, p.condominio_mensal ? `Cond. ${fmt(p.condominio_mensal)}` : null].filter(Boolean).join('  |  '), 15, y); y += 6

  let bx = 15; bx += bdg(doc, bx, y, recLabel, recBg, recFg)
  bx += bdg(doc, bx + 2, y, eMercado ? 'MERCADO DIRETO' : `${p.num_leilao || 1}a PRACA`, eMercado ? [219, 234, 254] : C.greenL, eMercado ? [29, 78, 216] : C.green)
  if (!eMercado && p.data_leilao) { bx += bdg(doc, bx + 2, y, `Leilao: ${new Date(p.data_leilao + 'T12:00:00').toLocaleDateString('pt-BR')}`, C.amberL, C.amber) }

  doc.setFontSize(42); doc.setFont('helvetica', 'bold'); doc.setTextColor(...scoreColor(score)); doc.text(score.toFixed(1), 170, y - 5, { align: 'center' })
  doc.setFontSize(12); doc.text('/10', 186, y - 5)
  doc.setFontSize(7); doc.setTextColor(...C.gray); doc.text('SCORE AXIS', 175, y + 1, { align: 'center' })
  y += 10

  kpi(doc, 15, y, 56, 22, eMercado ? 'Preco Pedido' : 'Lance Minimo', fmt(lance), C.amber, C.amberL)
  kpi(doc, 77, y, 56, 22, 'Mercado Estimado', fmt(mercado), C.navy, C.navyL)
  kpi(doc, 139, y, 56, 22, 'Aluguel Estimado', aluguel ? `${fmt(aluguel)}/mes` : '--', C.purple, C.purpleL)
  y += 28
  const roiV = roi?.roi ?? 0
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.gray); doc.text('ROI Estimado:', 15, y)
  doc.setTextColor(...(roiV >= 15 ? C.green : roiV >= 0 ? C.amber : C.red)); doc.text(`${roiV > 0 ? '+' : ''}${roiV}%`, 45, y)
  const desc = parseFloat(p.desconto_sobre_mercado_pct_calculado || p.desconto_sobre_mercado_pct) || 0
  if (desc > 0) { doc.setTextColor(...C.gray); doc.text('Desconto:', 70, y); doc.setTextColor(...C.green); doc.text(`-${desc.toFixed(0)}%`, 91, y) }
  if (!eMercado) { doc.setTextColor(...C.gray); doc.text('Avaliacao:', 110, y); doc.setTextColor(...C.navy); doc.text(fmt(avaliacao), 133, y) }
  foot(doc, p, 1, totalPg)

  // ============ PAGINA 2 — RESUMO EXECUTIVO ============
  onProgress('Resumo executivo...')
  doc.addPage(); y = 15
  y = secH(doc, y, 'Resumo Executivo -- Score AXIS 6D')

  const scores6D = [
    { l: 'Localizacao', v: parseFloat(p.score_localizacao) || 0, w: 20 },
    { l: 'Desconto', v: parseFloat(p.score_desconto) || 0, w: 18 },
    { l: 'Juridico', v: parseFloat(p.score_juridico) || 0, w: 18 },
    { l: 'Ocupacao', v: parseFloat(p.score_ocupacao) || 0, w: 15 },
    { l: 'Liquidez', v: parseFloat(p.score_liquidez) || 0, w: 15 },
    { l: 'Mercado', v: parseFloat(p.score_mercado) || 0, w: 14 },
  ]
  scores6D.forEach(s => {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.textL); doc.text(`${s.l} (${s.w}%)`, 15, y + 3)
    doc.setFillColor(...C.grayL); doc.roundedRect(55, y, 100, 4.5, 1.5, 1.5, 'F')
    const cor = scoreColor(s.v); doc.setFillColor(...cor); doc.roundedRect(55, y, Math.max(2, (s.v / 10) * 100), 4.5, 1.5, 1.5, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cor); doc.text(s.v.toFixed(1), 160, y + 3.5)
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray); doc.text(`(${(s.v * s.w / 100).toFixed(1)}pt)`, 170, y + 3.5)
    y += 8
  })
  y += 2
  doc.setFillColor(...C.bg); doc.roundedRect(15, y, 180, 10, 2, 2, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy); doc.text('SCORE TOTAL:', 20, y + 6.5)
  doc.setFontSize(14); doc.setTextColor(...scoreColor(score)); doc.text(`${score.toFixed(1)} / 10`, 58, y + 7)
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.gray); doc.text(`Recomendacao: ${recLabel}  |  Estrategia: ${p.estrategia_recomendada || '--'}`, 100, y + 6.5)
  y += 15

  if (p.sintese_executiva) {
    y = subH(doc, y, 'Sintese Executiva')
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
    const sl = doc.splitTextToSize(p.sintese_executiva, 175); doc.text(sl.slice(0, 6), 15, y); y += Math.min(sl.length, 6) * 3.8 + 4
  }

  if (p.justificativa) {
    y = subH(doc, y, 'Justificativa da Recomendacao (IA)')
    doc.setFillColor(240, 244, 255); const jl = doc.splitTextToSize(p.justificativa, 170)
    const jh = Math.min(jl.length * 3.5 + 8, 50)
    doc.roundedRect(15, y - 2, 180, jh, 1.5, 1.5, 'F')
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.navy)
    doc.text(jl.slice(0, Math.floor((jh - 4) / 3.5)), 18, y + 3); y += jh + 4
  }

  if (p.alertas?.length) {
    y = subH(doc, y, 'Alertas')
    const alertas = p.alertas.slice(0, 5).map(a => typeof a === 'string' ? a : a.texto || '')
    doc.setFillColor(...C.amberL); const al = alertas.map(a => doc.splitTextToSize(`  ${a}`, 172))
    const ah = al.reduce((s, l) => s + l.length, 0) * 3.8 + 4
    doc.roundedRect(15, y - 2, 180, ah, 1.5, 1.5, 'F')
    doc.setFontSize(7.5); doc.setTextColor(...C.amber); let ay = y + 2
    al.forEach(lines => { doc.text(lines, 18, ay); ay += lines.length * 3.8 }); y += ah + 4
  }

  if (p.positivos?.length && y < 235) {
    y = subH(doc, y, 'Pontos Positivos')
    doc.setFontSize(7.5); doc.setTextColor(...C.green)
    const pos = (typeof p.positivos === 'string' ? JSON.parse(p.positivos) : p.positivos).slice(0, 5)
    pos.forEach(item => { const l = doc.splitTextToSize(`[+]  ${item}`, 175); doc.text(l, 15, y); y += l.length * 3.5 + 1.5 }); y += 2
  }
  if (p.negativos?.length && y < 265) {
    y = subH(doc, y, 'Pontos de Atencao')
    doc.setFontSize(7.5); doc.setTextColor(...C.red)
    const neg = (typeof p.negativos === 'string' ? JSON.parse(p.negativos) : p.negativos).slice(0, 5)
    neg.forEach(item => { const l = doc.splitTextToSize(`[!]  ${item}`, 175); doc.text(l, 15, y); y += l.length * 3.5 + 1.5 })
  }
  foot(doc, p, 2, totalPg)

  // ============ PAGINA 3 — INVESTIMENTO + 2a PRACA ============
  onProgress('Analise de investimento...')
  doc.addPage(); y = 15
  y = secH(doc, y, 'Analise de Investimento')

  kpi(doc, 15, y, 43, 18, eMercado ? 'Preco' : 'Lance 1aP', fmt(lance), C.amber, C.amberL)
  kpi(doc, 60, y, 43, 18, 'Custos Aq.', fmt(bd.totalCustos), C.navy, C.navyL)
  kpi(doc, 105, y, 43, 18, 'Invest. Total', fmt(bd.investimentoTotal + holdingTotal), C.navy, C.bg)
  kpi(doc, 150, y, 45, 18, 'ROI', `${roiV > 0 ? '+' : ''}${roiV}%`, roiV >= 15 ? C.green : roiV >= 0 ? C.amber : C.red, roiV >= 0 ? C.greenL : C.redL)
  y += 24

  y = subH(doc, y, 'Breakdown de Custos')
  const bRows = [
    [eMercado ? 'Preco pedido' : 'Lance minimo', fmt(lance)],
    !eMercado && bd.comissao.valor > 0 && [`Comissao leiloeiro (${(bd.comissao.pct * 100).toFixed(0)}%)`, fmt(bd.comissao.valor)],
    [`ITBI (${(bd.itbi.pct * 100).toFixed(0)}%)`, fmt(bd.itbi.valor)],
    ['Doc + Registro', fmt(bd.documentacao.valor)],
    !eMercado && bd.advogado.valor > 0 && [`Advogado (${(bd.advogado.pct * 100).toFixed(0)}%)`, fmt(bd.advogado.valor)],
    bd.reforma > 0 && ['Reforma estimada', fmt(bd.reforma)],
    holdingTotal > 0 && [`Holding (${HOLDING_MESES_PADRAO}m x ${fmt(holdingMensal)}/mes)`, fmt(holdingTotal)],
  ].filter(Boolean)
  bRows.push([{ content: 'INVESTIMENTO TOTAL', styles: { fontStyle: 'bold', textColor: C.navy } }, { content: fmt(bd.investimentoTotal + holdingTotal), styles: { fontStyle: 'bold', textColor: C.navy } }])
  tbl({ startY: y, head: [], body: bRows, theme: 'striped', styles: { fontSize: 7.5, cellPadding: 2, textColor: C.text }, alternateRowStyles: { fillColor: C.bg }, columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } }, margin: { left: 15, right: 80 }, tableWidth: 115 })

  const eY = y - 5
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy); doc.text('Cenarios de Saida', 135, eY)
  tbl({ startY: eY + 3, head: [['Cenario', 'Valor', 'ROI']], body: [
    ['Otimista (+15%)', fmt(roi.cenarios?.otimista?.valor), `${roi.cenarios?.otimista?.roi > 0 ? '+' : ''}${roi.cenarios?.otimista?.roi}%`],
    ['Realista', fmt(roi.cenarios?.realista?.valor), `${roi.cenarios?.realista?.roi > 0 ? '+' : ''}${roi.cenarios?.realista?.roi}%`],
    ['Venda rapida', fmt(roi.cenarios?.vendaRapida?.valor), `${roi.cenarios?.vendaRapida?.roi > 0 ? '+' : ''}${roi.cenarios?.vendaRapida?.roi}%`],
  ], theme: 'grid', styles: { fontSize: 6.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6 }, margin: { left: 135 }, tableWidth: 60 })

  if (roi.locacao) {
    const lY = lastY + 4; doc.setFillColor(...C.greenL); doc.roundedRect(135, lY, 60, 14, 1.5, 1.5, 'F')
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.green); doc.text('Locacao', 138, lY + 5)
    doc.setFont('helvetica', 'normal'); doc.text(`${fmt(roi.locacao.aluguelMensal)}/mes`, 138, lY + 9); doc.text(`Yield ${roi.locacao.yieldAnual}% | ${Math.round(roi.locacao.paybackMeses / 12)}a`, 138, lY + 13)
  }

  // SIMULACAO 2a PRACA
  if (!eMercado && lance2p > 0) {
    y = Math.max(lastY + 15, eY + 60)
    y = subH(doc, y, `Simulacao 2a Praca (50% avaliacao = ${fmt(lance2p)})`)
    const hold2 = HOLDING_MESES_PADRAO * holdingMensal
    const inv2 = bd2p.investimentoTotal + hold2
    const roi2v = roi2p?.roi ?? 0
    tbl({ startY: y, head: [['', '1a Praca', '2a Praca', 'Diferenca']], body: [
      ['Lance', fmt(lance), fmt(lance2p), fmt(lance2p - lance)],
      ['Custos aquisicao', fmt(bd.totalCustos), fmt(bd2p.totalCustos), fmt(bd2p.totalCustos - bd.totalCustos)],
      ['Investimento total', fmt(bd.investimentoTotal + holdingTotal), fmt(inv2), fmt(inv2 - bd.investimentoTotal - holdingTotal)],
      ['ROI (flip)', `${roiV > 0 ? '+' : ''}${roiV}%`, `${roi2v > 0 ? '+' : ''}${roi2v}%`, `${(roi2v - roiV) > 0 ? '+' : ''}${(roi2v - roiV).toFixed(1)}pp`],
      roi.locacao && roi2p.locacao && ['Yield locacao', `${roi.locacao.yieldAnual}%`, `${roi2p.locacao.yieldAnual}%`, `+${(roi2p.locacao.yieldAnual - roi.locacao.yieldAnual).toFixed(1)}pp`],
    ].filter(Boolean), theme: 'grid', styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [88, 28, 135], textColor: C.white, fontSize: 6.5 }, alternateRowStyles: { fillColor: [250, 245, 255] }, margin: { left: 15, right: 15 } })

    y = lastY + 4
    const gain = roi2v - roiV
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(gain > 10 ? C.green : C.amber))
    doc.text(gain > 10 ? `[RECOMENDADO] Aguardar 2a praca gera +${gain.toFixed(1)}pp de ROI. Economia de ${fmt(lance - lance2p)} no lance.` : `Diferenca de ${gain.toFixed(1)}pp no ROI. Avaliar risco de perder o imovel vs. ganho marginal.`, 15, y)
  }
  foot(doc, p, 3, totalPg)

  // ============ PAGINA 4 — MATRIZ UNIFICADA DE INVESTIMENTO ============
  onProgress('Matriz de investimento...')
  doc.addPage(); y = 15
  y = secH(doc, y, 'Matriz Unificada de Investimento')

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.textL)
  doc.text(`Classe: ${classe || '--'}  |  Area: ${area}m2  |  Escopo IA: ${p.escopo_reforma || '--'}  |  Holding: ${HOLDING_MESES_PADRAO} meses`, 15, y); y += 6

  // Matriz: linhas = métricas, colunas = cenários
  const fatores = [0.90, 1.00, 1.08, 1.20]
  const cenLabels = ['Sem Reforma', 'Basica', 'Media', 'Completa']
  const custoRef = [0, reformas[0]?.custo || 0, reformas[1]?.custo || 0, reformas[2]?.custo || 0]
  const valoriz = [0, reformas[0]?.valorizacao || 0, reformas[1]?.valorizacao || 0, reformas[2]?.valorizacao || 0]

  const matrizRows = []
  // Custo reforma
  matrizRows.push([{ content: 'Custo Reforma', styles: { fontStyle: 'bold' } }, ...custoRef.map(c => fmt(c))])
  // Invest total
  const invests = custoRef.map(c => lance + bd.totalCustos + c + holdingTotal)
  matrizRows.push([{ content: 'Investimento Total', styles: { fontStyle: 'bold' } }, ...invests.map(v => fmt(v))])
  // Valor pos reforma
  const valoresPos = valoriz.map(v => Math.round(mercado * (1 + v / 100)))
  matrizRows.push([{ content: 'Valor Pos-Reforma', styles: { fontStyle: 'bold' } }, ...valoresPos.map(v => fmt(v))])
  // Lucro flip
  const lucros = invests.map((inv, i) => valoresPos[i] - inv)
  matrizRows.push([{ content: 'Lucro (Flip)', styles: { fontStyle: 'bold' } }, ...lucros.map(l => ({ content: `${l >= 0 ? '+' : ''}${fmt(l)}`, styles: { textColor: l >= 0 ? C.green : C.red } }))])
  // ROI flip
  const rois = invests.map((inv, i) => inv > 0 ? ((valoresPos[i] - inv) / inv * 100).toFixed(1) : '0')
  matrizRows.push([{ content: 'ROI Flip', styles: { fontStyle: 'bold' } }, ...rois.map(r => ({ content: `${parseFloat(r) > 0 ? '+' : ''}${r}%`, styles: { textColor: parseFloat(r) >= 10 ? C.green : parseFloat(r) >= 0 ? C.amber : C.red, fontStyle: 'bold' } }))])
  // Separador
  matrizRows.push([{ content: 'LOCACAO', styles: { fontStyle: 'bold', textColor: C.navy }, colSpan: 5 }])
  // Aluguel
  const alugs = fatores.map(f => Math.round(aluguel * f))
  matrizRows.push([{ content: 'Aluguel Mensal', styles: { fontStyle: 'bold' } }, ...alugs.map(a => `${fmt(a)}/mes`)])
  // Yield
  matrizRows.push([{ content: 'Yield Bruto', styles: { fontStyle: 'bold' } }, ...alugs.map((a, i) => invests[i] > 0 ? `${((a * 12) / invests[i] * 100).toFixed(1)}%` : '--')])
  // Payback
  matrizRows.push([{ content: 'Payback', styles: { fontStyle: 'bold' } }, ...alugs.map((a, i) => a > 0 ? `${Math.round(invests[i] / (a * 12))} anos` : '--')])

  tbl({ startY: y, head: [['', ...cenLabels]], body: matrizRows, theme: 'grid', styles: { fontSize: 7, cellPadding: 2.5 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7 }, alternateRowStyles: { fillColor: C.bg }, columnStyles: { 0: { cellWidth: 38 } }, margin: { left: 15, right: 15 } })
  y = lastY + 8

  // Recomendacao
  if (viab) {
    y = subH(doc, y, 'Recomendacao')
    const bestIdx = rois.reduce((bi, r, i) => parseFloat(r) > parseFloat(rois[bi]) ? i : bi, 0)
    const bestYieldIdx = alugs.reduce((bi, a, i) => {
      const y1 = invests[i] > 0 ? (a * 12) / invests[i] : 0
      const y2 = invests[bi] > 0 ? (alugs[bi] * 12) / invests[bi] : 0
      return y1 > y2 ? i : bi
    }, 0)
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
    doc.text(doc.splitTextToSize(`FLIP: Melhor cenario "${cenLabels[bestIdx]}" com ROI de ${rois[bestIdx]}% e lucro de ${fmt(lucros[bestIdx])}. LOCACAO: Melhor yield no cenario "${cenLabels[bestYieldIdx]}" com ${((alugs[bestYieldIdx] * 12) / invests[bestYieldIdx] * 100).toFixed(1)}% a.a. e payback de ${Math.round(invests[bestYieldIdx] / (alugs[bestYieldIdx] * 12))} anos. Escopo IA: ${p.escopo_reforma || '--'}.`, 175), 15, y)
    y += 16
  }

  // Atributos do predio com homogeneização (Sprint 17)
  const attrs = ['elevador', 'piscina', 'academia', 'churrasqueira', 'area_lazer', 'portaria_24h']
  const attrPresent = attrs.filter(a => p[a] != null)
  if (attrPresent.length > 0 || homo.ajustes.length > 0) {
    y = subH(doc, y, 'Atributos do Predio e Homogeneizacao (NBR 14653)')

    // Info row simples
    const attrLabels = { elevador: 'Elevador', piscina: 'Piscina', academia: 'Academia', churrasqueira: 'Churrasqueira', area_lazer: 'Area Lazer', portaria_24h: 'Portaria 24h' }
    const infoRows = [
      ...attrPresent.map(a => [attrLabels[a], p[a] ? 'Sim' : 'Nao']),
      ...(p.nome_condominio ? [['Condominio', p.nome_condominio]] : []),
      ...(p.andar ? [['Andar', String(p.andar)]] : []),
      ...(p.ano_construcao ? [['Ano construcao', String(p.ano_construcao)]] : []),
    ]
    if (infoRows.length > 0) {
      tbl({ startY: y, head: [], body: infoRows, theme: 'plain', styles: { fontSize: 7.5, cellPadding: 2, textColor: C.text }, columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold', textColor: C.gray } }, margin: { left: 15, right: 105 }, tableWidth: 90 })
      y = lastY + 4
    }

    // Tabela de homogeneização com impacto
    if (homo.ajustes.length > 0 && y < 240) {
      const homoRows = homo.ajustes.map(a => {
        const pctStr = `${a.impactoPct > 0 ? '+' : ''}${a.impactoPct}%`
        const valStr = a['impactoR$'] !== 0 ? `${a['impactoR$'] > 0 ? '+' : ''}R$ ${Math.abs(a['impactoR$']).toLocaleString('pt-BR')}` : '—'
        return [a.label, pctStr, valStr]
      })
      // Linha total
      const totalPct = `${(homo.fator - 1) >= 0 ? '+' : ''}${((homo.fator - 1) * 100).toFixed(1)}%`
      const totalVal = homo.impactoTotal !== 0 ? `${homo.impactoTotal > 0 ? '+' : ''}R$ ${Math.abs(homo.impactoTotal).toLocaleString('pt-BR')}` : '—'
      homoRows.push([{ content: 'FATOR COMPOSTO', styles: { fontStyle: 'bold', textColor: C.navy } }, { content: totalPct, styles: { fontStyle: 'bold', textColor: homo.fator >= 1 ? C.green : C.red } }, { content: totalVal, styles: { fontStyle: 'bold', textColor: homo.fator >= 1 ? C.green : C.red } }])

      tbl({ startY: y, head: [['Atributo', 'Fator', 'Impacto R$']], body: homoRows, theme: 'striped', styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6.5 }, alternateRowStyles: { fillColor: C.bg }, columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 35, halign: 'right' } }, margin: { left: 15, right: 90 }, tableWidth: 105 })
    }
  }
  foot(doc, p, 4, totalPg)

  // ============ PAGINA 5 — JURIDICO + DOCUMENTOS DO AGENTE ============
  onProgress('Analise juridica...')
  doc.addPage(); y = 15
  y = secH(doc, y, 'Analise Juridica Completa')

  const jRows = [
    p.processo_numero && ['Processo', p.processo_numero],
    p.processos_ativos && ['Detalhes', (typeof p.processos_ativos === 'string' ? p.processos_ativos : '').substring(0, 130)],
    p.vara_judicial && ['Vara', p.vara_judicial],
    p.tipo_justica && ['Tribunal', p.tipo_justica],
    p.matricula_status && ['Matricula', p.matricula_status],
    p.ocupacao && ['Ocupacao', `${p.ocupacao}${p.ocupacao_fonte ? ' (Fonte: ' + p.ocupacao_fonte + ')' : ''}`],
    ['Resp. debitos', p.responsabilidade_debitos === 'sub_rogado' ? 'Sub-rogados no preco' : p.responsabilidade_debitos === 'exonerado' ? 'Arrematante exonerado' : p.responsabilidade_debitos === 'arrematante' ? 'Arrematante arca' : p.responsabilidade_debitos || '--'],
    p.responsabilidade_fonte && ['Fundamentacao', p.responsabilidade_fonte],
    p.debitos_condominio && ['Deb. condominio', p.debitos_condominio],
    p.debitos_iptu && ['Deb. IPTU', p.debitos_iptu],
    !eMercado && ['Comissao leiloeiro', `${p.comissao_leiloeiro_pct || 5}%`],
    ['Pagamento', p.parcelamento_aceito ? `Parcelamento: ${p.parcelamento_detalhes || 'aceito'}` : 'Exclusivamente a vista'],
  ].filter(Boolean)

  tbl({ startY: y, head: [], body: jRows.map(([l, v]) => [l, (typeof v === 'string' ? v : String(v || '--')).substring(0, 140)]), theme: 'striped', styles: { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }, textColor: C.text, overflow: 'linebreak' }, alternateRowStyles: { fillColor: C.bg }, columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold', textColor: C.gray }, 1: { cellWidth: 148 } }, margin: { left: 15, right: 15 } })
  y = lastY + 6

  // Obs juridicas
  if (p.obs_juridicas && y < 200) {
    y = subH(doc, y, 'Observacoes Juridicas (Matricula e Onus)')
    doc.setFillColor(...C.amberL); const ol = doc.splitTextToSize(p.obs_juridicas, 172)
    const oh = Math.min(ol.length * 3.5 + 6, 60)
    doc.roundedRect(15, y - 2, 180, oh, 1.5, 1.5, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
    doc.text(ol.slice(0, Math.floor((oh - 4) / 3.5)), 18, y + 2); y += oh + 5
  }

  // Documentos analisados pelo agente juridico
  if (docs.length > 0 && y < 220) {
    y = subH(doc, y, `Documentos Analisados pelo Agente Juridico (${docs.length})`)
    docs.forEach((d, idx) => {
      if (y > 255) return
      const scoreCor = d.score >= 7 ? C.green : d.score >= 4 ? C.amber : C.red
      const recCor = d.recomendacao === 'favoravel' ? C.green : d.recomendacao === 'desfavoravel' ? C.red : C.amber

      // Doc header
      doc.setFillColor(...C.navyL); doc.roundedRect(15, y, 180, 6, 1, 1, 'F')
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.navy)
      doc.text(`${idx + 1}. ${d.nome || d.tipo || 'Documento'}`, 18, y + 4)
      doc.setTextColor(...scoreCor); doc.text(`Score: ${d.score || '--'}/10`, 140, y + 4)
      doc.setTextColor(...recCor); doc.text(`${(d.recomendacao || '--').toUpperCase()}`, 170, y + 4)
      y += 8

      // Resumo
      if (d.resumo) {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.text)
        const rl = doc.splitTextToSize(d.resumo, 172)
        doc.text(rl.slice(0, 4), 18, y); y += Math.min(rl.length, 4) * 3.5 + 2
      }

      // Alertas do documento
      if (d.alertas?.length) {
        doc.setFontSize(6.5); doc.setTextColor(...C.red)
        d.alertas.slice(0, 3).forEach(a => {
          const al = doc.splitTextToSize(`[!] ${a}`, 168)
          doc.text(al, 20, y); y += al.length * 3 + 1
        })
      }
      y += 3
    })
  }

  // Recomendacao juridica consolidada
  if (p.recomendacao_juridica_docs && y < 270) {
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(p.recomendacao_juridica_docs === 'favoravel' ? C.green : p.recomendacao_juridica_docs === 'desfavoravel' ? C.red : C.amber))
    doc.text(`Parecer consolidado dos documentos: ${(p.recomendacao_juridica_docs || '').toUpperCase()}`, 15, y)
  }
  foot(doc, p, 5, totalPg)

  // ============ PAGINA 6 — MERCADO ============
  onProgress('Analise de mercado...')
  doc.addPage(); y = 15
  y = secH(doc, y, 'Analise de Mercado')

  tbl({ startY: y, head: [['Indicador', 'Valor']], body: [
    ['Preco/m2 imovel', p.preco_m2_imovel ? `R$ ${Math.round(p.preco_m2_imovel).toLocaleString('pt-BR')}/m2` : '--'],
    ['Preco/m2 mercado', p.preco_m2_mercado ? `R$ ${Math.round(p.preco_m2_mercado).toLocaleString('pt-BR')}/m2` : '--'],
    ['Desconto s/ mercado', pct(p.desconto_sobre_mercado_pct_calculado || p.desconto_sobre_mercado_pct)],
    ['Yield bruto', p.yield_bruto_pct ? `${p.yield_bruto_pct}% a.a.` : '--'],
    ['Tendencia', p.mercado_tendencia || '--'],
    ['Demanda', p.mercado_demanda || '--'],
    ['Tempo revenda', p.prazo_revenda_meses ? `${p.prazo_revenda_meses} meses` : '--'],
    ['Liquidez', p.liquidez || '--'],
  ], theme: 'striped', styles: { fontSize: 7.5, cellPadding: 2.5 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7 }, alternateRowStyles: { fillColor: C.bg }, margin: { left: 15, right: 105 }, tableWidth: 90 })

  if (p._dados_bairro_axis) {
    const db = p._dados_bairro_axis
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.accent); doc.text(`Dados AXIS -- ${db.label || p.bairro}`, 110, y - 1)
    const axR = [db.classeIpeadLabel && ['Classe IPEAD', db.classeIpeadLabel], db.precoContratoM2 && ['Preco QA', `R$ ${db.precoContratoM2.toLocaleString('pt-BR')}/m2`], db.precoAnuncioM2 && ['Preco anuncio', `R$ ${db.precoAnuncioM2.toLocaleString('pt-BR')}/m2`], db.yieldBruto && ['Yield bruto', `${db.yieldBruto}% a.a.`], db.tendencia12m != null && ['Tendencia 12m', `${db.tendencia12m}%`]].filter(Boolean)
    tbl({ startY: y + 2, head: [], body: axR, theme: 'plain', styles: { fontSize: 7, cellPadding: 2, textColor: C.text }, columnStyles: { 0: { cellWidth: 35, textColor: C.gray, fontStyle: 'bold' } }, margin: { left: 110 }, tableWidth: 85 })
  }
  y = lastY + 10

  if (p.comparaveis?.length > 0 && y < 210) {
    y = subH(doc, y, `Comparaveis de Mercado (${p.comparaveis.length})`)
    tbl({ startY: y, head: [['Endereco', 'Area', 'Q', 'Preco', 'R$/m2']], body: p.comparaveis.slice(0, 8).map(c => [(c.descricao || c.endereco || '--').substring(0, 50), c.area_m2 ? `${c.area_m2}m2` : '--', c.quartos || '--', c.valor ? fmt(c.valor) : '--', c.preco_m2 ? `R$ ${Math.round(c.preco_m2).toLocaleString('pt-BR')}` : '--']), theme: 'striped', styles: { fontSize: 6.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6.5 }, alternateRowStyles: { fillColor: C.bg }, margin: { left: 15, right: 15 } })
    y = lastY + 8
  }

  if (aluguel > 0 && y < 245) {
    y = subH(doc, y, 'Aluguel Estimado por Cenario')
    tbl({ startY: y, head: [['Cenario', 'Aluguel', 'Yield']], body: [['Sem reforma', 0.90], ['Basica', 1.00], ['Media', 1.08], ['Completa', 1.20]].map(([lb, ft]) => { const al = Math.round(aluguel * ft); return [lb, `${fmt(al)}/mes`, lance > 0 ? `${((al * 12) / lance * 100).toFixed(1)}%` : '--'] }), theme: 'striped', styles: { fontSize: 7.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7 }, alternateRowStyles: { fillColor: C.bg }, margin: { left: 15, right: 105 }, tableWidth: 90 })
  }
  foot(doc, p, 6, totalPg)

  // ============ PAGINA 7 — FOTOS ============
  onProgress('Galeria de fotos...')
  doc.addPage(); y = 15
  y = secH(doc, y, 'Galeria de Fotos')
  if (fotosB64.length > 0) {
    const cols = 2, imgW = 87, imgH = 58, gap = 6
    fotosB64.slice(0, 8).forEach((img, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const fx = 15 + col * (imgW + gap), fy = y + row * (imgH + gap)
      if (fy + imgH > 275) return
      try { doc.setFillColor(...C.bg); doc.roundedRect(fx, fy, imgW, imgH, 2, 2, 'F'); doc.addImage(img, 'JPEG', fx + 1, fy + 1, imgW - 2, imgH - 2); doc.setDrawColor(...C.grayL); doc.setLineWidth(0.3); doc.roundedRect(fx, fy, imgW, imgH, 2, 2, 'S') } catch {}
    })
  } else { doc.setFontSize(10); doc.setTextColor(...C.gray); doc.text('Nenhuma foto disponivel', 105, 150, { align: 'center' }) }
  foot(doc, p, 7, totalPg)

  onProgress('Finalizando PDF...')
  doc.save(`AXIS_${p.codigo_axis || 'imovel'}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
