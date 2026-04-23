import { abrirHtmlNovaTela } from '../lib/abrirHtml.js'
/**
 * AXIS — Exportar Decisão de Lance (PDF 1 página)
 * Sprint 35: gera PDF A4 executivo com:
 *   - Dados do imóvel + leilão
 *   - MAO flip / locação
 *   - Lance máximo definido + estratégia
 *   - Cenários de ROI
 *   - Alertas e débitos
 * Sprint 41d: usa calcularDadosFinanceiros (constants.js) — unificado com
 * ExportarResumoSimples e ExportarPDF para garantir mesmos números.
 */

import { calcularDadosFinanceiros } from '../lib/constants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const fmtPct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'
const fmtData = d => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—'

function calcROI(lance, p) {
  if (!lance || !p.valor_mercado_estimado) return null
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const df = calcularDadosFinanceiros(lance, p, eMercado)
  // Manter mesmo formato de retorno (invest/lucro/roi/yld) para não quebrar
  // o template abaixo que consome esses campos.
  return {
    invest: df.investimentoTotal,
    lucro: df.lucroFlip,
    roi: df.roiFlip,
    yld: df.yieldBruto,
  }
}

function gerarHTML(p) {
  const hoje = new Date()
  const dias1 = p.data_leilao   ? Math.ceil((new Date(p.data_leilao   + 'T12:00') - hoje) / 86400000) : null
  const dias2 = p.data_leilao_2 ? Math.ceil((new Date(p.data_leilao_2 + 'T12:00') - hoje) / 86400000) : null
  const avaliacao = parseFloat(p.valor_avaliacao || p.valor_minimo) || 0
  const lanceDefinido = parseFloat(p.lance_maximo_definido || 0)
  const roiDecisao = lanceDefinido > 0 ? calcROI(lanceDefinido, p) : null

  const estrategiaLabel = {
    flip: '🔄 Flip (revenda)', locacao: '🏠 Locação', hibrido: '⚡ Híbrido'
  }[p.lance_maximo_estrategia] || '—'

  const cenarios = [
    { label: '50% · piso legal',   pct: '50%', lance: Math.round(avaliacao * 0.50) },
    { label: '57% · esperado',      pct: '57%', lance: Math.round(avaliacao * 0.57) },
    { label: '65% · competitivo',   pct: '65%', lance: Math.round(avaliacao * 0.65) },
  ].map(c => ({ ...c, roi: calcROI(c.lance, p) }))

  const scoreCor = p.score_total >= 7 ? '#059669' : p.score_total >= 5 ? '#D97706' : '#DC2626'
  const corROI   = v => v >= 20 ? '#059669' : v >= 10 ? '#D97706' : '#DC2626'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Decisão de Lance — ${p.codigo_axis || p.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1e293b; background: #fff; }
  .page { max-width: 182mm; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 8px; border-bottom: 2.5px solid #0F172A; margin-bottom: 10px; }
  .header-left .brand { font-size: 18pt; font-weight: 900; color: #0F172A; letter-spacing: -0.5px; }
  .header-left .brand span { color: #D97706; }
  .header-left .sub { font-size: 7.5pt; color: #64748b; margin-top: 1px; }
  .header-right { text-align: right; }
  .header-right .codigo { font-size: 13pt; font-weight: 800; color: #0F172A; }
  .header-right .data { font-size: 7.5pt; color: #64748b; }

  /* Section title */
  .sec { font-size: 7pt; font-weight: 800; color: #94A3B8; text-transform: uppercase;
    letter-spacing: .6px; margin-bottom: 5px; margin-top: 10px; }

  /* Grid 2 col */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }

  /* Card genérico */
  .card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 7px 9px; }
  .card-dark { background: #0F172A; border: 1px solid #1E293B; border-radius: 6px; padding: 7px 9px; color: #F1F5F9; }
  .lbl { font-size: 7pt; color: #64748B; font-weight: 600; margin-bottom: 2px; }
  .lbl-dark { font-size: 7pt; color: #64748B; font-weight: 600; margin-bottom: 2px; }
  .val { font-size: 12pt; font-weight: 800; }
  .val-sm { font-size: 10pt; font-weight: 700; }

  /* Decisão destaque */
  .decisao-box { background: #0F172A; border: 2px solid #059669; border-radius: 8px;
    padding: 10px 14px; margin: 8px 0; display: flex; gap: 16px; align-items: center; }
  .decisao-lance { font-size: 24pt; font-weight: 900; color: #4ADE80; }
  .decisao-label { font-size: 7pt; color: #64748B; text-transform: uppercase; font-weight: 700; }
  .decisao-strat { font-size: 9pt; font-weight: 700; color: #A78BFA; margin-top: 2px; }
  .decisao-roi   { font-size: 10pt; font-weight: 800; color: #4ADE80; }

  /* Cenários */
  .cen { border-radius: 6px; padding: 7px 9px; border: 1px solid #E2E8F0; background: #F8FAFC; }
  .cen-lance { font-size: 10pt; font-weight: 800; color: #1E293B; }

  /* Alertas */
  .alerta { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px;
    padding: 6px 9px; font-size: 8pt; color: #DC2626; margin-top: 6px; }
  .ok-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px;
    padding: 6px 9px; font-size: 8pt; color: #059669; margin-top: 6px; }

  /* Score badge */
  .score-badge { display: inline-block; padding: 2px 8px; border-radius: 20px;
    font-size: 9pt; font-weight: 800; }

  /* Footer */
  .footer { margin-top: 12px; padding-top: 7px; border-top: 1px solid #E2E8F0;
    font-size: 7pt; color: #94A3B8; display: flex; justify-content: space-between; }

  .tag { display: inline-block; font-size: 6.5pt; font-weight: 700; padding: 1px 5px;
    border-radius: 3px; margin-right: 3px; }

  /* Leilão urgência */
  .urgencia { background: #FEF2F2; border: 1.5px solid #DC2626; border-radius: 6px;
    padding: 5px 10px; text-align: center; font-weight: 800; color: #DC2626; font-size: 9pt; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <div class="brand">AXIS<span>IP</span></div>
      <div class="sub">Decisão de Lance · Leilão Judicial</div>
    </div>
    <div class="header-right">
      <div class="codigo">${p.codigo_axis || p.id}</div>
      <div class="data">Gerado em ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <!-- DADOS DO IMÓVEL -->
  <div class="sec">📍 Imóvel</div>
  <div class="g2" style="margin-bottom:4px">
    <div class="card">
      <div class="lbl">Endereço / Identificação</div>
      <div style="font-size:10pt;font-weight:700">${p.titulo || p.codigo_axis}</div>
      <div style="font-size:8pt;color:#475569;margin-top:2px">${p.bairro || ''}${p.cidade ? ' · ' + p.cidade : ''} · ${p.area_privativa_m2 || p.area_m2 || '?'} m²</div>
      ${p.endereco ? `<div style="font-size:7.5pt;color:#64748B;margin-top:1px">${p.endereco}</div>` : ''}
    </div>
    <div class="g2">
      <div class="card" style="text-align:center">
        <div class="lbl">Score AXIS</div>
        <div class="val" style="color:${scoreCor}">${Math.round((p.score_total || 0) * 10)}/100</div>
        <div style="font-size:7pt;color:#64748B">${p.recomendacao || ''}</div>
      </div>
      <div class="card" style="text-align:center">
        <div class="lbl">Confidence</div>
        <div class="val" style="color:#3B82F6">${p.confidence_score || '—'}%</div>
        <div style="font-size:7pt;color:#64748B">precisão IA</div>
      </div>
    </div>
  </div>

  <!-- LEILÃO -->
  <div class="sec">🔨 Datas do Leilão</div>
  <div class="g2" style="margin-bottom:4px">
    ${p.data_leilao ? `
    <div class="card">
      <div class="lbl">1ª Praça</div>
      <div class="val-sm">${fmtData(p.data_leilao)}
        ${dias1 !== null && dias1 >= 0 ? `<span style="font-size:8pt;color:${dias1 <= 7 ? '#DC2626' : '#D97706'};margin-left:6px">(em ${dias1}d)</span>` : ''}
        ${dias1 !== null && dias1 < 0 ? `<span style="font-size:8pt;color:#64748B;margin-left:6px">(encerrada)</span>` : ''}
      </div>
      <div style="font-size:9pt;font-weight:700;color:#0F172A;margin-top:2px">${fmt(p.valor_minimo)}</div>
    </div>` : '<div></div>'}
    ${p.data_leilao_2 ? `
    <div class="card" style="border-color:${dias2 !== null && dias2 >= 0 && dias2 <= 15 ? '#F59E0B' : '#E2E8F0'}">
      <div class="lbl">2ª Praça ${dias2 !== null && dias2 >= 0 && dias2 <= 7 ? '🚨 URGENTE' : ''}</div>
      <div class="val-sm">${fmtData(p.data_leilao_2)}
        ${dias2 !== null && dias2 >= 0 ? `<span style="font-size:8pt;color:${dias2 <= 7 ? '#DC2626' : '#D97706'};margin-left:6px">(em ${dias2}d)</span>` : ''}
      </div>
      <div style="font-size:9pt;font-weight:700;color:#D97706;margin-top:2px">${fmt(p.valor_minimo_2)}</div>
    </div>` : '<div></div>'}
  </div>

  <!-- VALUATION -->
  <div class="sec">💰 Valuation</div>
  <div class="g4" style="margin-bottom:4px">
    <div class="card" style="text-align:center">
      <div class="lbl">Avaliação judicial</div>
      <div class="val-sm">${fmt(p.valor_avaliacao)}</div>
    </div>
    <div class="card" style="text-align:center">
      <div class="lbl">Mercado estimado</div>
      <div class="val-sm" style="color:#059669">${fmt(p.valor_mercado_estimado)}</div>
    </div>
    <div class="card" style="text-align:center">
      <div class="lbl">Lance máx. flip (ROI 20%)</div>
      <div class="val-sm" style="color:#059669">${fmt(p.mao_flip)}</div>
    </div>
    <div class="card" style="text-align:center">
      <div class="lbl">Lance máx. locação (6% a.a.)</div>
      <div class="val-sm" style="color:#7C3AED">${fmt(p.mao_locacao)}</div>
    </div>
  </div>

  <!-- DECISÃO DESTAQUE -->
  ${lanceDefinido > 0 ? `
  <div class="sec">🎯 Decisão Registrada</div>
  <div class="decisao-box">
    <div>
      <div class="decisao-label">Lance máximo definido</div>
      <div class="decisao-lance">${fmt(lanceDefinido)}</div>
      <div class="decisao-strat">${estrategiaLabel}</div>
    </div>
    ${roiDecisao ? `
    <div style="flex:1">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <div class="lbl-dark" style="color:#64748B">Invest. total</div>
          <div style="font-size:10pt;font-weight:800;color:#F1F5F9">${fmt(roiDecisao.invest)}</div>
        </div>
        <div>
          <div class="lbl-dark" style="color:#64748B">ROI flip líquido</div>
          <div style="font-size:12pt;font-weight:900;color:${corROI(roiDecisao.roi)}">${roiDecisao.roi > 0 ? '+' : ''}${roiDecisao.roi}%</div>
          <div style="font-size:6pt;color:#64748B">já c/ IR 15%</div>
        </div>
        <div>
          <div class="lbl-dark" style="color:#64748B">Yield loc.</div>
          <div style="font-size:12pt;font-weight:900;color:#A78BFA">${roiDecisao.yld > 0 ? roiDecisao.yld + '% a.a.' : '—'}</div>
          <div style="font-size:6pt;color:#64748B">bruto</div>
        </div>
      </div>
      <div style="margin-top:6px;font-size:7.5pt;color:${parseFloat(p.mao_flip||0) > 0 && lanceDefinido <= parseFloat(p.mao_flip) ? '#4ADE80' : '#F87171'}">
        ${parseFloat(p.mao_flip||0) > 0 && lanceDefinido <= parseFloat(p.mao_flip) ? '✅ Dentro do limite — operação viável' : '⚠️ Acima do limite — avaliar risco'}
      </div>
    </div>` : ''}
  </div>` : `
  <div class="alerta">⚠️ Nenhum lance máximo definido. Acesse o AXIS IP e registre sua decisão antes do leilão.</div>
  `}

  <!-- CENÁRIOS -->
  <div class="sec">📊 Cenários 2ª Praça</div>
  <div class="g3" style="margin-bottom:4px">
    ${cenarios.map(c => `
    <div class="cen" style="border-color:${c.roi && c.roi.roi >= 20 ? '#BBF7D0' : c.roi && c.roi.roi >= 10 ? '#FDE68A' : '#FECACA'}">
      <div class="lbl">${c.label}</div>
      <div class="cen-lance">${fmt(c.lance)}</div>
      ${c.roi ? `
      <div style="font-size:8.5pt;font-weight:700;color:${corROI(c.roi.roi)};margin-top:3px">
        ROI flip ${c.roi.roi > 0 ? '+' : ''}${c.roi.roi}%
      </div>
      <div style="font-size:7.5pt;color:#7C3AED">Yield ${c.roi.yld}% a.a.</div>
      <div style="font-size:7pt;color:#94A3B8;margin-top:2px">Invest: ${fmt(c.roi.invest)}</div>` : ''}
    </div>`).join('')}
  </div>

  <!-- DÉBITOS E CUSTOS -->
  ${parseFloat(p.debitos_total_estimado || 0) > 0 ? `
  <div class="alerta">
    ⚠️ <strong>Débitos a cargo do arrematante:</strong> ${fmt(p.debitos_total_estimado)}
    (condomínio: ${fmt(p.debitos_condominio)} · IPTU: ${fmt(p.debitos_iptu)}) — já incorporados no lance máximo e nos cenários acima.
  </div>` : `
  <div class="ok-box">✅ Débitos de condomínio/IPTU: responsabilidade do vendedor (conforme edital).</div>`}

  <!-- ESTRATÉGIA E ALERTAS -->
  ${p.estrategia_recomendada ? `
  <div class="sec" style="margin-top:8px">📋 Estratégia Recomendada</div>
  <div class="card" style="font-size:8.5pt;color:#1E293B;line-height:1.4">${p.estrategia_recomendada}</div>` : ''}

  ${(p.alertas && p.alertas.length) ? `
  <div class="sec" style="margin-top:8px">⚠️ Alertas</div>
  <div class="card" style="font-size:8pt;color:#DC2626;line-height:1.5">
    ${(Array.isArray(p.alertas) ? p.alertas : JSON.parse(p.alertas || '[]')).map(a => `• ${a}`).join('<br>')}
  </div>` : ''}

  <!-- FOOTER -->
  <div class="footer">
    <span>AXIS IP · Plataforma de Inteligência para Leilões Judiciais · axisip.vercel.app</span>
    <span>Documento gerado em ${hoje.toLocaleDateString('pt-BR')} · Uso exclusivo do investidor</span>
  </div>

</div>
</body>
</html>`
}

/** Abre o PDF de decisão em nova aba (compatível Safari/mobile) */
export function abrirDecisaoPDF(imovel) {
  const html = gerarHTML(imovel)
  abrirHtmlNovaTela(html, `decisao-lance-${imovel.codigo_axis || imovel.id}`, true)
}

/** Retorna o HTML da decisão (para embed ou download) */
export function gerarDecisaoHTML(imovel) {
  return gerarHTML(imovel)
}

/** Componente botão para usar inline */
export default function BotaoExportarDecisao({ imovel, style }) {
  const temDecisao = parseFloat(imovel?.lance_maximo_definido || 0) > 0
  return (
    <button
      onClick={() => abrirDecisaoPDF(imovel)}
      title={temDecisao ? 'Exportar decisão de lance como PDF' : 'Defina um lance antes de exportar'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
        background: temDecisao ? '#059669' : '#1E293B',
        border: `1px solid ${temDecisao ? '#059669' : '#334155'}`,
        color: temDecisao ? '#fff' : '#64748B',
        fontSize: 11, fontWeight: 700,
        opacity: 1,
        ...style
      }}>
      📄 {temDecisao ? 'Decisão PDF' : 'Sem decisão'}
    </button>
  )
}
