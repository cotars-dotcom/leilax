/**
 * AXIS IP — Relatorio PDF Profissional v2 (Sprint 15B+)
 * Design corporativo: cabecalhos navy, KPI boxes, barras score, tabelas zebradas
 * 6 paginas: Capa | Resumo | Investimento | Juridico | Mercado | Fotos
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { calcularBreakdownFinanceiro, calcularROI, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO } from '../lib/constants.js'
import { CUSTO_M2_SINAPI, FATOR_VALORIZACAO, detectarClasse, avaliarViabilidadeReforma } from '../lib/reformaUnificada.js'

const C = {
  navy: [0, 43, 128], navyL: [230, 236, 250],
  green: [6, 95, 70], greenL: [236, 253, 245],
  red: [153, 27, 27], redL: [254, 226, 226],
  amber: [146, 64, 14], amberL: [254, 243, 199],
  purple: [109, 40, 217],
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

// === Drawing helpers ===
function secHeader(doc, y, title) {
  doc.setFillColor(...C.navy)
  doc.rect(15, y, 180, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text(title.toUpperCase(), 20, y + 5.5)
  return y + 12
}
function subH(doc, y, title) {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.navy)
  doc.text(title, 15, y)
  doc.setDrawColor(...C.grayL)
  doc.setLineWidth(0.3)
  doc.line(15, y + 1.5, 195, y + 1.5)
  return y + 5
}
function kpiBox(doc, x, y, w, h, label, value, color, bgColor) {
  doc.setFillColor(...bgColor)
  doc.roundedRect(x, y, w, h, 2, 2, 'F')
  doc.setDrawColor(...color)
  doc.setLineWidth(0.6)
  doc.line(x, y + 1, x, y + h - 1)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text(label.toUpperCase(), x + 4, y + 5)
  doc.setFontSize(11)
  doc.setTextColor(...color)
  doc.text(value, x + 4, y + 13)
}
function rodape(doc, p, pg, tot) {
  doc.setDrawColor(...C.navy)
  doc.setLineWidth(0.4)
  doc.line(15, 282, 195, 282)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.gray)
  doc.text(`AXIS IP  |  ${p.codigo_axis || ''}  |  ${new Date().toLocaleDateString('pt-BR')}  |  Gerado automaticamente`, 15, 286)
  doc.setFont('helvetica', 'bold')
  doc.text(`${pg}/${tot}`, 195, 286, { align: 'right' })
}
function bdg(doc, x, y, text, bg, fg) {
  doc.setFontSize(7)
  const w = doc.getTextWidth(text) + 8
  doc.setFillColor(...bg)
  doc.roundedRect(x, y - 4.5, w, 7, 2, 2, 'F')
  doc.setTextColor(...fg)
  doc.setFont('helvetica', 'bold')
  doc.text(text, x + 4, y)
  doc.setFont('helvetica', 'normal')
  return w + 2
}

// === MAIN ===
export async function gerarPDFProfissional(p, onProgress = () => {}) {
  const doc = new jsPDF('p', 'mm', 'a4')
  let lastY = 0
  const tbl = (opts) => { const r = autoTable(doc, opts); lastY = r?.finalY ?? (doc.lastAutoTable?.finalY ?? lastY); return r }

  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
  const lance = parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const bd = calcularBreakdownFinanceiro(lance, p, eMercado)
  const roi = calcularROI(bd.investimentoTotal, mercado, aluguel)
  const condoMensal = parseFloat(p.condominio_mensal || 0)
  const iptuMensal = parseFloat(p.iptu_mensal || 0) || (condoMensal > 0 ? Math.round(condoMensal * IPTU_SOBRE_CONDO_RATIO) : 0)
  const holdingMensal = condoMensal + iptuMensal
  const holdingTotal = HOLDING_MESES_PADRAO * holdingMensal
  const score = parseFloat(p.score_total || 0)
  const totalPg = 6

  onProgress('Convertendo fotos...')
  const fotosRaw = [p.foto_principal, ...(p.fotos || [])].filter(Boolean)
  const fotosUnicas = [...new Set(fotosRaw)].slice(0, 8)
  const fotosB64 = (await Promise.allSettled(fotosUnicas.map(u => imgToBase64(u)))).map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean)
  const heroImg = fotosB64[0] || null

  const classe = detectarClasse(parseFloat(p.preco_m2_mercado) || 7000)
  const viab = avaliarViabilidadeReforma(mercado, lance, area, parseFloat(p.preco_m2_mercado) || 7000)
  const reformas = ['refresh_giro', 'leve_reforcada_1_molhado', 'pesada'].map((esc, i) => {
    const custoM2 = CUSTO_M2_SINAPI[esc]?.[classe] || 0
    const custo = parseFloat(p[['custo_reforma_basica', 'custo_reforma_media', 'custo_reforma_completa'][i]]) || Math.round(area * custoM2)
    const fv = FATOR_VALORIZACAO[esc] || 1
    return { label: ['Basica', 'Media', 'Completa'][i], custo, custoM2, valorizacao: Math.round((fv - 1) * 100) }
  })

  const recLabel = p.recomendacao === 'COMPRAR' ? 'COMPRAR' : p.recomendacao === 'EVITAR' ? 'EVITAR' : 'AGUARDAR'
  const recBg = p.recomendacao === 'COMPRAR' ? C.greenL : p.recomendacao === 'EVITAR' ? C.redL : C.amberL
  const recFg = p.recomendacao === 'COMPRAR' ? C.green : p.recomendacao === 'EVITAR' ? C.red : C.amber

  // ============ PAGINA 1 — CAPA ============
  onProgress('Gerando capa...')
  doc.setFillColor(...C.navy)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setFillColor(...C.green)
  doc.rect(0, 36, 210, 1.5, 'F')

  doc.setFontSize(20)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.text('AXIS IP', 15, 15)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 198, 230)
  doc.text('Inteligencia Imobiliaria', 15, 21)
  doc.setFontSize(7)
  doc.text('axisip.vercel.app', 15, 27)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text(p.codigo_axis || '', 195, 15, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 198, 230)
  doc.text(new Date().toLocaleDateString('pt-BR'), 195, 22, { align: 'right' })

  let y = 42
  if (heroImg) {
    try { doc.addImage(heroImg, 'JPEG', 15, y, 180, 95); doc.setDrawColor(...C.grayL); doc.setLineWidth(0.5); doc.rect(15, y, 180, 95, 'S'); y += 100 } catch { y += 3 }
  } else {
    doc.setFillColor(...C.bg); doc.rect(15, y, 180, 50, 'F'); doc.setTextColor(...C.gray); doc.setFontSize(11); doc.text('Foto nao disponivel', 105, y + 28, { align: 'center' }); y += 55
  }

  doc.setFontSize(15)
  doc.setTextColor(...C.text)
  doc.setFont('helvetica', 'bold')
  const tLines = doc.splitTextToSize((p.titulo || 'Imovel').substring(0, 90), 135)
  doc.text(tLines, 15, y + 4)
  y += tLines.length * 6 + 3
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.gray)
  doc.text(doc.splitTextToSize([p.endereco, p.bairro, p.cidade].filter(Boolean).join(' -- ') + `/${p.estado || 'MG'}`, 135), 15, y)
  y += 8

  doc.setFontSize(8.5)
  doc.setTextColor(...C.textL)
  doc.text([area ? `${area}m2` : null, p.quartos ? `${p.quartos}q` : null, p.suites ? `${p.suites}s` : null, p.vagas ? `${p.vagas}v` : null, p.condominio_mensal ? `Cond. ${fmt(p.condominio_mensal)}` : null].filter(Boolean).join('  |  '), 15, y)
  y += 6

  let bx = 15
  bx += bdg(doc, bx, y, recLabel, recBg, recFg)
  bx += bdg(doc, bx + 2, y, eMercado ? 'MERCADO DIRETO' : `${p.num_leilao || 1}a PRACA`, eMercado ? [219, 234, 254] : C.greenL, eMercado ? [29, 78, 216] : C.green)

  doc.setFontSize(42)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...scoreColor(score))
  doc.text(score.toFixed(1), 170, y - 5, { align: 'center' })
  doc.setFontSize(12)
  doc.text('/10', 186, y - 5)
  doc.setFontSize(7)
  doc.setTextColor(...C.gray)
  doc.text('SCORE AXIS', 175, y + 1, { align: 'center' })
  y += 10

  kpiBox(doc, 15, y, 56, 22, eMercado ? 'Preco Pedido' : 'Lance Minimo', fmt(lance), C.amber, C.amberL)
  kpiBox(doc, 77, y, 56, 22, 'Mercado Estimado', fmt(mercado), C.navy, C.navyL)
  kpiBox(doc, 139, y, 56, 22, 'Aluguel Estimado', aluguel ? `${fmt(aluguel)}/mes` : '--', C.purple, [243, 232, 255])

  y += 28
  const roiV = roi?.roi ?? 0
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.gray)
  doc.text('ROI Estimado:', 15, y)
  doc.setTextColor(...(roiV >= 15 ? C.green : roiV >= 0 ? C.amber : C.red))
  doc.text(`${roiV > 0 ? '+' : ''}${roiV}%`, 45, y)
  const desc = parseFloat(p.desconto_sobre_mercado_pct_calculado || p.desconto_sobre_mercado_pct) || 0
  if (desc > 0) { doc.setTextColor(...C.gray); doc.text('Desconto:', 70, y); doc.setTextColor(...C.green); doc.text(`-${desc.toFixed(0)}%`, 91, y) }
  rodape(doc, p, 1, totalPg)

  // ============ PAGINA 2 — RESUMO ============
  onProgress('Resumo executivo...')
  doc.addPage()
  y = 15
  y = secHeader(doc, y, 'Resumo Executivo -- Score AXIS 6D')

  const scores6D = [
    { l: 'Localizacao', v: parseFloat(p.score_localizacao) || 0, w: 20 },
    { l: 'Desconto', v: parseFloat(p.score_desconto) || 0, w: 18 },
    { l: 'Juridico', v: parseFloat(p.score_juridico) || 0, w: 18 },
    { l: 'Ocupacao', v: parseFloat(p.score_ocupacao) || 0, w: 15 },
    { l: 'Liquidez', v: parseFloat(p.score_liquidez) || 0, w: 15 },
    { l: 'Mercado', v: parseFloat(p.score_mercado) || 0, w: 14 },
  ]
  scores6D.forEach(s => {
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.textL)
    doc.text(`${s.l} (${s.w}%)`, 15, y + 3)
    doc.setFillColor(...C.grayL)
    doc.roundedRect(55, y, 100, 4.5, 1.5, 1.5, 'F')
    const cor = scoreColor(s.v)
    doc.setFillColor(...cor)
    doc.roundedRect(55, y, Math.max(2, (s.v / 10) * 100), 4.5, 1.5, 1.5, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...cor)
    doc.text(s.v.toFixed(1), 160, y + 3.5)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.gray)
    doc.text(`(${(s.v * s.w / 100).toFixed(1)}pt)`, 170, y + 3.5)
    y += 8
  })

  y += 2
  doc.setFillColor(...C.bg)
  doc.roundedRect(15, y, 180, 10, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.navy)
  doc.text('SCORE TOTAL:', 20, y + 6.5)
  doc.setFontSize(14)
  doc.setTextColor(...scoreColor(score))
  doc.text(`${score.toFixed(1)} / 10`, 58, y + 7)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.gray)
  doc.text(`Recomendacao: ${recLabel}`, 110, y + 6.5)
  y += 15

  if (p.sintese_executiva) {
    y = subH(doc, y, 'Sintese Executiva')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    const sl = doc.splitTextToSize(p.sintese_executiva, 175)
    doc.text(sl.slice(0, 6), 15, y)
    y += Math.min(sl.length, 6) * 3.8 + 5
  }

  if (p.alertas?.length) {
    y = subH(doc, y, 'Alertas')
    const alertas = p.alertas.slice(0, 5).map(a => typeof a === 'string' ? a : a.texto || '')
    doc.setFillColor(...C.amberL)
    const al = alertas.map(a => doc.splitTextToSize(`  ${a}`, 172))
    const ah = al.reduce((s, l) => s + l.length, 0) * 3.8 + 4
    doc.roundedRect(15, y - 2, 180, ah, 1.5, 1.5, 'F')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.amber)
    let ay = y + 2
    al.forEach(lines => { doc.text(lines, 18, ay); ay += lines.length * 3.8 })
    y += ah + 5
  }

  if (p.positivos?.length && y < 230) {
    y = subH(doc, y, 'Pontos Positivos')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.green)
    const pos = (typeof p.positivos === 'string' ? JSON.parse(p.positivos) : p.positivos).slice(0, 5)
    pos.forEach(item => { const l = doc.splitTextToSize(`[+]  ${item}`, 175); doc.text(l, 15, y); y += l.length * 3.5 + 1.5 })
    y += 3
  }

  if (p.negativos?.length && y < 260) {
    y = subH(doc, y, 'Pontos de Atencao')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.red)
    const neg = (typeof p.negativos === 'string' ? JSON.parse(p.negativos) : p.negativos).slice(0, 5)
    neg.forEach(item => { const l = doc.splitTextToSize(`[!]  ${item}`, 175); doc.text(l, 15, y); y += l.length * 3.5 + 1.5 })
  }
  rodape(doc, p, 2, totalPg)

  // ============ PAGINA 3 — INVESTIMENTO ============
  onProgress('Analise de investimento...')
  doc.addPage()
  y = 15
  y = secHeader(doc, y, 'Analise de Investimento')

  const bW = 43, bH = 18
  kpiBox(doc, 15, y, bW, bH, eMercado ? 'Preco' : 'Lance', fmt(lance), C.amber, C.amberL)
  kpiBox(doc, 60, y, bW, bH, 'Custos Aq.', fmt(bd.totalCustos), C.navy, C.navyL)
  kpiBox(doc, 105, y, bW, bH, 'Invest. Total', fmt(bd.investimentoTotal + holdingTotal), C.navy, C.bg)
  kpiBox(doc, 150, y, 45, bH, 'ROI', `${roiV > 0 ? '+' : ''}${roiV}%`, roiV >= 15 ? C.green : roiV >= 0 ? C.amber : C.red, roiV >= 0 ? C.greenL : C.redL)
  y += bH + 8

  y = subH(doc, y, 'Custos de Aquisicao')
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

  tbl({ startY: y, head: [], body: bRows, theme: 'striped', styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: C.text }, alternateRowStyles: { fillColor: C.bg }, columnStyles: { 0: { cellWidth: 85 }, 1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' } }, margin: { left: 15, right: 65 }, tableWidth: 130 })

  const eY = y - 5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.navy)
  doc.text('Cenarios de Saida', 150, eY)
  tbl({ startY: eY + 3, head: [['Cenario', 'Valor', 'ROI']], body: [
    ['Otimista (+15%)', fmt(roi.cenarios?.otimista?.valor), `${roi.cenarios?.otimista?.roi > 0 ? '+' : ''}${roi.cenarios?.otimista?.roi}%`],
    ['Realista', fmt(roi.cenarios?.realista?.valor), `${roi.cenarios?.realista?.roi > 0 ? '+' : ''}${roi.cenarios?.realista?.roi}%`],
    ['Venda rapida', fmt(roi.cenarios?.vendaRapida?.valor), `${roi.cenarios?.vendaRapida?.roi > 0 ? '+' : ''}${roi.cenarios?.vendaRapida?.roi}%`],
  ], theme: 'grid', styles: { fontSize: 6.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6 }, margin: { left: 150 }, tableWidth: 45 })

  if (roi.locacao) {
    const lY = lastY + 4
    doc.setFillColor(...C.greenL)
    doc.roundedRect(150, lY, 45, 14, 1.5, 1.5, 'F')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.green)
    doc.text('Locacao', 153, lY + 5)
    doc.setFont('helvetica', 'normal')
    doc.text(`${fmt(roi.locacao.aluguelMensal)}/mes`, 153, lY + 9)
    doc.text(`Yield ${roi.locacao.yieldAnual}% | ${Math.round(roi.locacao.paybackMeses / 12)}a`, 153, lY + 13)
  }

  y = Math.max(lastY + 12, eY + 60)
  y = subH(doc, y, 'Cenarios de Reforma (SINAPI-MG 2026)')
  const rfRows = reformas.map(r => {
    const ct = lance + bd.totalCustos + r.custo + holdingTotal
    const vp = Math.round(mercado * (1 + r.valorizacao / 100))
    const roiR = ct > 0 ? Math.round((vp - ct) / ct * 100) : 0
    return [r.label, fmt(r.custo), `R$ ${r.custoM2}/m2`, `+${r.valorizacao}%`, fmt(ct), fmt(vp), `${roiR > 0 ? '+' : ''}${roiR}%`]
  })
  tbl({ startY: y, head: [['Cenario', 'Custo', 'R$/m2', 'Valoriz.', 'Invest. Total', 'Valor Pos', 'ROI']], body: rfRows, theme: 'grid', styles: { fontSize: 6.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6 }, alternateRowStyles: { fillColor: C.bg }, margin: { left: 15, right: 15 } })
  rodape(doc, p, 3, totalPg)

  // ============ PAGINA 4 — JURIDICO ============
  onProgress('Analise juridica...')
  doc.addPage()
  y = 15
  y = secHeader(doc, y, 'Analise Juridica')

  const jRows = [
    p.processos_ativos && ['Processo', p.processos_ativos],
    p.vara_judicial && ['Vara', p.vara_judicial],
    p.tipo_justica && ['Tribunal', p.tipo_justica],
    p.matricula_status && ['Matricula', p.matricula_status],
    p.ocupacao && ['Ocupacao', p.ocupacao],
    p.ocupacao_fonte && ['Fonte', p.ocupacao_fonte],
    ['Resp. debitos', p.responsabilidade_debitos === 'sub_rogado' ? 'Sub-rogados no preco' : p.responsabilidade_debitos === 'exonerado' ? 'Arrematante exonerado' : p.responsabilidade_debitos === 'arrematante' ? 'Arrematante arca' : p.responsabilidade_debitos || '--'],
    p.responsabilidade_fonte && ['Fonte resp.', p.responsabilidade_fonte],
    p.debitos_condominio && ['Deb. condominio', p.debitos_condominio],
    p.debitos_iptu && ['Deb. IPTU', p.debitos_iptu],
    !eMercado && ['Comissao leiloeiro', `${p.comissao_leiloeiro_pct || 5}%`],
    ['Pagamento', p.parcelamento_aceito ? 'Parcelamento aceito' : 'Exclusivamente a vista'],
  ].filter(Boolean)

  tbl({ startY: y, head: [], body: jRows.map(([l, v]) => [l, (typeof v === 'string' ? v : String(v || '--')).substring(0, 130)]), theme: 'striped', styles: { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 }, textColor: C.text, overflow: 'linebreak' }, alternateRowStyles: { fillColor: C.bg }, columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold', textColor: C.gray }, 1: { cellWidth: 145 } }, margin: { left: 15, right: 15 } })
  y = lastY + 8

  if (p.obs_juridicas && y < 240) {
    y = subH(doc, y, 'Observacoes Juridicas')
    doc.setFillColor(...C.amberL)
    const ol = doc.splitTextToSize(p.obs_juridicas, 172)
    const oh = Math.min(ol.length * 3.5 + 6, 240 - y)
    doc.roundedRect(15, y - 2, 180, oh, 1.5, 1.5, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(ol.slice(0, Math.floor((oh - 4) / 3.5)), 18, y + 2)
  }
  rodape(doc, p, 4, totalPg)

  // ============ PAGINA 5 — MERCADO ============
  onProgress('Analise de mercado...')
  doc.addPage()
  y = 15
  y = secHeader(doc, y, 'Analise de Mercado')

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
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text(`Dados AXIS -- ${db.label || p.bairro}`, 110, y - 1)
    const axR = [
      db.classeIpeadLabel && ['Classe IPEAD', db.classeIpeadLabel],
      db.precoContratoM2 && ['Preco QA', `R$ ${db.precoContratoM2.toLocaleString('pt-BR')}/m2`],
      db.precoAnuncioM2 && ['Preco anuncio', `R$ ${db.precoAnuncioM2.toLocaleString('pt-BR')}/m2`],
      db.yieldBruto && ['Yield bruto', `${db.yieldBruto}% a.a.`],
      db.tendencia12m != null && ['Tendencia 12m', `${db.tendencia12m}%`],
    ].filter(Boolean)
    tbl({ startY: y + 2, head: [], body: axR, theme: 'plain', styles: { fontSize: 7, cellPadding: 2, textColor: C.text }, columnStyles: { 0: { cellWidth: 35, textColor: C.gray, fontStyle: 'bold' } }, margin: { left: 110 }, tableWidth: 85 })
  }
  y = lastY + 10

  if (p.comparaveis?.length > 0 && y < 210) {
    y = subH(doc, y, `Comparaveis (${p.comparaveis.length})`)
    tbl({ startY: y, head: [['Endereco', 'Area', 'Q', 'Preco', 'R$/m2']], body: p.comparaveis.slice(0, 8).map(c => [(c.descricao || c.endereco || '--').substring(0, 50), c.area_m2 ? `${c.area_m2}m2` : '--', c.quartos || '--', c.valor ? fmt(c.valor) : '--', c.preco_m2 ? `R$ ${Math.round(c.preco_m2).toLocaleString('pt-BR')}` : '--']), theme: 'striped', styles: { fontSize: 6.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 6.5 }, alternateRowStyles: { fillColor: C.bg }, margin: { left: 15, right: 15 } })
    y = lastY + 8
  }

  if (aluguel > 0 && y < 245) {
    y = subH(doc, y, 'Aluguel Estimado por Cenario')
    tbl({ startY: y, head: [['Cenario', 'Aluguel', 'Yield']], body: [['Sem reforma', 0.90], ['Basica', 1.00], ['Media', 1.08], ['Completa', 1.20]].map(([lb, ft]) => { const al = Math.round(aluguel * ft); return [lb, `${fmt(al)}/mes`, lance > 0 ? `${((al * 12) / lance * 100).toFixed(1)}%` : '--'] }), theme: 'striped', styles: { fontSize: 7.5, cellPadding: 2 }, headStyles: { fillColor: C.navy, textColor: C.white, fontSize: 7 }, alternateRowStyles: { fillColor: C.bg }, margin: { left: 15, right: 105 }, tableWidth: 90 })
  }
  rodape(doc, p, 5, totalPg)

  // ============ PAGINA 6 — FOTOS ============
  onProgress('Galeria de fotos...')
  doc.addPage()
  y = 15
  y = secHeader(doc, y, 'Galeria de Fotos')

  if (fotosB64.length > 0) {
    const cols = 2, imgW = 87, imgH = 58, gap = 6
    fotosB64.slice(0, 8).forEach((img, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const fx = 15 + col * (imgW + gap), fy = y + row * (imgH + gap)
      if (fy + imgH > 275) return
      try { doc.setFillColor(...C.bg); doc.roundedRect(fx, fy, imgW, imgH, 2, 2, 'F'); doc.addImage(img, 'JPEG', fx + 1, fy + 1, imgW - 2, imgH - 2); doc.setDrawColor(...C.grayL); doc.setLineWidth(0.3); doc.roundedRect(fx, fy, imgW, imgH, 2, 2, 'S') } catch {}
    })
  } else { doc.setFontSize(10); doc.setTextColor(...C.gray); doc.text('Nenhuma foto disponivel', 105, 150, { align: 'center' }) }
  rodape(doc, p, 6, totalPg)

  onProgress('Finalizando PDF...')
  doc.save(`AXIS_${p.codigo_axis || 'imovel'}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
