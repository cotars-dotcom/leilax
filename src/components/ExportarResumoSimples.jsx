/**
 * AXIS — Exportar Resumo Simplificado
 * 
 * Relatório de 1 página em 3 zonas para leitura rápida:
 *   ZONA 1 — DECISÃO   (10 segundos): score, recomendação, MAO, prazo
 *   ZONA 2 — FINANCEIRO (2 minutos):  cenários de ROI, yield, reforma
 *   ZONA 3 — DETALHES  (due diligence): jurídico, processo, alertas
 */

import { abrirHtmlNovaTela, downloadHtml } from '../lib/abrirHtml.js'
import { CUSTOS_LEILAO, HOLDING_MESES_PADRAO, IPTU_SOBRE_CONDO_RATIO } from '../lib/constants.js'

const fmt   = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const fmtPct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'
const fmtData = d => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR') : '—'

function calcROI(lance, p) {
  if (!lance || !p.valor_mercado_estimado) return null
  const mercado = parseFloat(p.valor_mercado_estimado)
  const pct = (CUSTOS_LEILAO.comissao_leiloeiro_pct + CUSTOS_LEILAO.itbi_pct +
               CUSTOS_LEILAO.advogado_pct + CUSTOS_LEILAO.documentacao_pct) / 100
  const condo = parseFloat(p.condominio_mensal || 0)
  const iptu  = parseFloat(p.iptu_mensal || 0) || Math.round(condo * IPTU_SOBRE_CONDO_RATIO)
  const holding = HOLDING_MESES_PADRAO * (condo + iptu)
  const debitos = p.responsabilidade_debitos === 'arrematante' ? parseFloat(p.debitos_total_estimado || 0) : 0
  const reforma = parseFloat(p.custo_reforma_basica || 0)
  const invest = lance * (1 + pct) + reforma + holding + debitos
  const lucro  = mercado * 0.94 - invest
  const roi    = invest > 0 ? (lucro / invest) * 100 : 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado || 0)
  const yld = aluguel > 0 && invest > 0 ? (aluguel * 12 / invest) * 100 : 0
  return { invest: Math.round(invest), lucro: Math.round(lucro), roi: +roi.toFixed(1), yld: +yld.toFixed(1) }
}

function gerarHTML(p) {
  const hoje = new Date()
  const dias2 = p.data_leilao_2 ? Math.ceil((new Date(p.data_leilao_2 + 'T12:00') - hoje) / 86400000) : null
  const dias1 = p.data_leilao   ? Math.ceil((new Date(p.data_leilao   + 'T12:00') - hoje) / 86400000) : null
  const lanceDecisao = parseFloat(p.lance_maximo_definido || 0)
  const roiDecisao   = lanceDecisao > 0 ? calcROI(lanceDecisao, p) : null
  const avaliacao    = parseFloat(p.valor_avaliacao || p.valor_minimo) || 0
  const scoreCor     = p.score_total >= 7 ? '#059669' : p.score_total >= 5 ? '#D97706' : '#DC2626'
  const recCor       = p.recomendacao === 'COMPRAR' ? '#059669' : p.recomendacao === 'AGUARDAR' ? '#D97706' : '#DC2626'

  // Cenários de ROI para 2ª praça
  const cenarios = avaliacao > 0 ? [
    { label: '50% (piso legal)', lance: Math.round(avaliacao * 0.50) },
    { label: '57% (esperado)',   lance: Math.round(avaliacao * 0.57) },
    { label: '65% (competitivo)',lance: Math.round(avaliacao * 0.65) },
  ].map(c => ({ ...c, r: calcROI(c.lance, p) })) : []

  const alertas = Array.isArray(p.alertas) ? p.alertas : []
  const positivos = Array.isArray(p.positivos) ? p.positivos : []
  const negativos = Array.isArray(p.negativos) ? p.negativos : []

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.codigo_axis} — Resumo AXIS IP</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 14px; color: #1e293b; background: #f8fafc; }
  .page { max-width: 780px; margin: 0 auto; padding: 24px 20px; }
  
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; background: #0F172A; border-radius: 12px; margin-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
  .brand span { color: #D97706; }
  .header-right { text-align: right; }
  .codigo { font-size: 14px; font-weight: 700; color: #94A3B8; font-family: monospace; }
  .data { font-size: 11px; color: #64748B; margin-top: 2px; }

  /* Zonas */
  .zona { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 16px;
    border: 1px solid #E2E8F0; }
  .zona-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
    padding-bottom: 12px; border-bottom: 1px solid #F1F5F9; }
  .zona-num { width: 28px; height: 28px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
  .zona-title { font-size: 15px; font-weight: 700; }
  .zona-sub { font-size: 12px; color: #64748B; margin-top: 1px; }

  /* Zona 1 — Decisão */
  .z1 .zona-num { background: #0F172A; color: #fff; }
  .decisao-grid { display: grid; grid-template-columns: auto 1fr 1fr 1fr; gap: 16px; align-items: start; }
  .score-big { text-align: center; }
  .score-val { font-size: 44px; font-weight: 900; line-height: 1; color: ${scoreCor}; }
  .score-max { font-size: 14px; color: #94A3B8; }
  .rec-val { font-size: 22px; font-weight: 800; color: ${recCor}; }
  .kpi-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
  .kpi-val { font-size: 18px; font-weight: 800; color: #0F172A; }
  .kpi-sub { font-size: 11px; color: #64748B; margin-top: 2px; }
  
  .lance-box { grid-column: 1 / -1; background: ${lanceDecisao > 0 ? '#F0FDF4' : '#FFFBEB'};
    border: 2px solid ${lanceDecisao > 0 ? '#059669' : '#F59E0B'};
    border-radius: 8px; padding: 14px 16px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .lance-principal { font-size: 28px; font-weight: 900; color: ${lanceDecisao > 0 ? '#059669' : '#92400E'}; }
  .lance-stats { display: flex; gap: 20px; }
  .lance-stat { text-align: center; }
  .lance-stat-val { font-size: 16px; font-weight: 800; }
  .lance-stat-label { font-size: 10px; color: #64748B; text-transform: uppercase; }

  /* Zona 2 — Financeiro */
  .z2 .zona-num { background: #EFF6FF; color: #1D4ED8; }
  .fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .fin-card { background: #F8FAFC; border-radius: 8px; padding: 12px 14px; }
  .fin-card-title { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
  .fin-card-val { font-size: 18px; font-weight: 800; color: #0F172A; }
  .fin-card-sub { font-size: 11px; color: #64748B; margin-top: 2px; }
  
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; color: #64748B; font-weight: 600;
    text-transform: uppercase; padding: 6px 8px; background: #F8FAFC; }
  td { padding: 8px; border-bottom: 1px solid #F1F5F9; }
  .td-green { color: #059669; font-weight: 700; }
  .td-red { color: #DC2626; font-weight: 700; }
  .td-yellow { color: #D97706; font-weight: 700; }

  /* Zona 3 — Detalhes */
  .z3 .zona-num { background: #EEEDFE; color: #534AB7; }
  .det-row { display: flex; justify-content: space-between; padding: 7px 0;
    border-bottom: 1px solid #F1F5F9; font-size: 13px; }
  .det-label { color: #64748B; }
  .det-val { font-weight: 600; text-align: right; max-width: 60%; }
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tag { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .tag-ok  { background: #ECFDF5; color: #065F46; }
  .tag-bad { background: #FEF2F2; color: #991B1B; }
  .tag-mid { background: #FFFBEB; color: #92400E; }
  
  .dias-urgente { display: inline-block; padding: 4px 12px; border-radius: 20px;
    font-weight: 800; font-size: 13px;
    background: ${dias2 !== null && dias2 <= 7 ? '#FEF2F2' : dias2 !== null && dias2 <= 15 ? '#FFF7ED' : '#FFFBEB'};
    color: ${dias2 !== null && dias2 <= 7 ? '#DC2626' : dias2 !== null && dias2 <= 15 ? '#EA580C' : '#D97706'}; }

  .footer { text-align: center; font-size: 11px; color: #94A3B8; padding: 12px 0; }
  
  @media print {
    body { background: white; }
    .page { padding: 0; }
    .zona { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="brand">AXIS<span>IP</span></div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">${p.titulo || p.codigo_axis}</div>
      <div style="font-size:11px;color:#475569;margin-top:1px">${[p.bairro, p.cidade].filter(Boolean).join(', ')} · ${p.area_privativa_m2 || p.area_m2 || '?'}m² · ${p.quartos ? p.quartos + 'q' : ''}${p.suites ? '/' + p.suites + 's' : ''}</div>
    </div>
    <div class="header-right">
      <div class="codigo">${p.codigo_axis}</div>
      <div class="data">Gerado ${hoje.toLocaleDateString('pt-BR')} ${hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <!-- ZONA 1: DECISÃO -->
  <div class="zona z1">
    <div class="zona-header">
      <div class="zona-num">1</div>
      <div>
        <div class="zona-title">Decisão</div>
        <div class="zona-sub">Score, recomendação e lance — leitura em 10 segundos</div>
      </div>
      ${(dias1 !== null && dias1 >= 0) || (dias2 !== null && dias2 >= 0) ? `
      <div style="margin-left:auto">
        ${dias1 !== null && dias1 >= 0 ? `<div style="font-size:12px;color:#94A3B8">1ª praça ${fmtData(p.data_leilao)} · ${fmt(p.valor_minimo)}</div>` : ''}
        ${dias2 !== null && dias2 >= 0 ? `<div class="dias-urgente">${dias2 === 0 ? 'HOJE!' : dias2 === 1 ? 'AMANHÃ' : dias2 + 'd'} — 2ª praça</div>` : ''}
      </div>` : ''}
    </div>

    <div class="decisao-grid">
      <div class="score-big">
        <div class="score-val">${Math.round((p.score_total || 0) * 10)}</div>
        <div class="score-max">/100</div>
        <div style="font-size:10px;color:#94A3B8;margin-top:4px">SCORE AXIS</div>
      </div>
      <div>
        <div class="kpi-label">Recomendação</div>
        <div class="rec-val">${p.recomendacao || '—'}</div>
        <div class="kpi-sub">${p.justificativa ? p.justificativa.substring(0, 80) + (p.justificativa.length > 80 ? '...' : '') : ''}</div>
      </div>
      <div>
        <div class="kpi-label">MAO Flip (ROI 20%)</div>
        <div class="kpi-val" style="color:#059669">${fmt(p.mao_flip)}</div>
        <div class="kpi-sub">Máximo para flip</div>
      </div>
      <div>
        <div class="kpi-label">MAO Locação (6% a.a.)</div>
        <div class="kpi-val" style="color:#7C3AED">${fmt(p.mao_locacao)}</div>
        <div class="kpi-sub">Máximo para locação</div>
      </div>

      <!-- Lance registrado -->
      <div class="lance-box">
        <div>
          <div class="kpi-label">${lanceDecisao > 0 ? '🎯 Lance máximo registrado' : '⚠️ Lance não registrado'}</div>
          <div class="lance-principal">${lanceDecisao > 0 ? fmt(lanceDecisao) : 'Definir antes do leilão'}</div>
          ${p.lance_maximo_estrategia ? `<div style="font-size:12px;color:#64748B;margin-top:2px">Estratégia: ${p.lance_maximo_estrategia}</div>` : ''}
        </div>
        ${roiDecisao ? `
        <div class="lance-stats">
          <div class="lance-stat">
            <div class="lance-stat-val" style="color:${roiDecisao.roi >= 20 ? '#059669' : roiDecisao.roi >= 10 ? '#D97706' : '#DC2626'}">${roiDecisao.roi > 0 ? '+' : ''}${roiDecisao.roi}%</div>
            <div class="lance-stat-label">ROI flip</div>
          </div>
          <div class="lance-stat">
            <div class="lance-stat-val" style="color:#7C3AED">${roiDecisao.yld > 0 ? roiDecisao.yld + '%' : '—'}</div>
            <div class="lance-stat-label">Yield a.a.</div>
          </div>
          <div class="lance-stat">
            <div class="lance-stat-val">${fmt(roiDecisao.invest)}</div>
            <div class="lance-stat-label">Investimento</div>
          </div>
        </div>` : ''}
      </div>
    </div>
  </div>

  <!-- ZONA 2: FINANCEIRO -->
  <div class="zona z2">
    <div class="zona-header">
      <div class="zona-num">2</div>
      <div>
        <div class="zona-title">Financeiro</div>
        <div class="zona-sub">Valuation, cenários de ROI e yield — leitura em 2 minutos</div>
      </div>
    </div>

    <div class="fin-grid">
      <div class="fin-card">
        <div class="fin-card-title">Valor de mercado</div>
        <div class="fin-card-val">${fmt(p.valor_mercado_estimado)}</div>
        <div class="fin-card-sub">${p.preco_m2_mercado ? 'R$' + Math.round(p.preco_m2_mercado).toLocaleString('pt-BR') + '/m² · ' : ''}${p.classe_ipead || ''}</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">Aluguel estimado</div>
        <div class="fin-card-val">${fmt(p.aluguel_mensal_estimado)}<span style="font-size:13px;font-weight:400;color:#64748B">/mês</span></div>
        <div class="fin-card-sub">Yield bruto: ${fmtPct(p.yield_bruto_pct)} a.a.</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">Avaliação judicial</div>
        <div class="fin-card-val">${fmt(p.valor_avaliacao)}</div>
        <div class="fin-card-sub">Desconto: ${p.desconto_percentual ? p.desconto_percentual + '%' : '—'} sobre avaliação</div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">Débitos (arrematante)</div>
        <div class="fin-card-val" style="color:${parseFloat(p.debitos_total_estimado||0)>0?'#DC2626':'#059669'}">${parseFloat(p.debitos_total_estimado||0) > 0 ? fmt(p.debitos_total_estimado) : 'Sem débitos'}</div>
        <div class="fin-card-sub">${p.responsabilidade_debitos === 'arrematante' ? 'A cargo do arrematante' : p.responsabilidade_debitos === 'sub_rogado' ? 'Sub-rogado no preço' : '—'}</div>
      </div>
    </div>

    ${cenarios.length > 0 ? `
    <div style="margin-top:4px">
      <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">Cenários de lance — 2ª praça (${fmtData(p.data_leilao_2)})</div>
      <table>
        <thead><tr>
          <th>Cenário</th><th>Lance</th><th>Invest. total</th>
          <th>ROI flip</th><th>Yield loc.</th><th>vs MAO</th>
        </tr></thead>
        <tbody>
          ${cenarios.map(c => `<tr>
            <td>${c.label}</td>
            <td><strong>${fmt(c.lance)}</strong></td>
            <td>${c.r ? fmt(c.r.invest) : '—'}</td>
            <td class="${c.r && c.r.roi >= 20 ? 'td-green' : c.r && c.r.roi >= 10 ? 'td-yellow' : 'td-red'}">${c.r ? (c.r.roi > 0 ? '+' : '') + c.r.roi + '%' : '—'}</td>
            <td style="color:#7C3AED;font-weight:700">${c.r && c.r.yld > 0 ? c.r.yld + '%' : '—'}</td>
            <td class="${parseFloat(p.mao_flip||0) > 0 && c.lance <= parseFloat(p.mao_flip) ? 'td-green' : 'td-red'}">${parseFloat(p.mao_flip||0) > 0 && c.lance <= parseFloat(p.mao_flip) ? '✓ dentro' : '✗ acima'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
  </div>

  <!-- ZONA 3: DETALHES -->
  <div class="zona z3">
    <div class="zona-header">
      <div class="zona-num">3</div>
      <div>
        <div class="zona-title">Detalhes</div>
        <div class="zona-sub">Jurídico, processo e alertas — due diligence</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:8px">Jurídico</div>
        ${[
          ['Score jurídico', p.score_juridico != null ? p.score_juridico + '/10' : '—'],
          ['Processo', p.processo_numero || '—'],
          ['Vara', p.vara_judicial || '—'],
          ['Ocupação', p.ocupacao || '—'],
          ['Prazo liberação', p.prazo_liberacao_estimado_meses ? p.prazo_liberacao_estimado_meses + ' meses' : '—'],
          ['Custo jurídico est.', p.custo_juridico_estimado ? fmt(p.custo_juridico_estimado) : 'Não calculado'],
        ].map(([l, v]) => `<div class="det-row"><span class="det-label">${l}</span><span class="det-val">${v}</span></div>`).join('')}
      </div>
      <div>
        <div style="font-size:11px;color:#64748B;font-weight:600;text-transform:uppercase;margin-bottom:8px">Reforma estimada</div>
        ${[
          ['Básica', fmt(p.custo_reforma_basica)],
          ['Média', fmt(p.custo_reforma_media)],
          ['Completa', fmt(p.custo_reforma_completa)],
          ['Padrão', p.padrao_acabamento || '—'],
          ['Financiável', p.financiavel ? 'Sim' : 'Não'],
          ['Leiloeiro', p.leiloeiro || '—'],
        ].map(([l, v]) => `<div class="det-row"><span class="det-label">${l}</span><span class="det-val">${v}</span></div>`).join('')}
      </div>
    </div>

    ${positivos.length > 0 || negativos.length > 0 || alertas.length > 0 ? `
    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${positivos.length > 0 ? `
      <div>
        <div style="font-size:11px;color:#065F46;font-weight:600;text-transform:uppercase;margin-bottom:6px">Pontos positivos</div>
        ${positivos.slice(0, 4).map(t => `<div style="font-size:12px;color:#1e293b;padding:3px 0;display:flex;gap:6px"><span style="color:#059669">+</span>${t}</div>`).join('')}
      </div>` : ''}
      ${negativos.length > 0 || alertas.length > 0 ? `
      <div>
        <div style="font-size:11px;color:#991B1B;font-weight:600;text-transform:uppercase;margin-bottom:6px">Atenção</div>
        ${[...alertas, ...negativos].slice(0, 4).map(t => `<div style="font-size:12px;color:#1e293b;padding:3px 0;display:flex;gap:6px"><span style="color:#DC2626">⚠</span>${t}</div>`).join('')}
      </div>` : ''}
    </div>` : ''}
  </div>

  <div class="footer">
    AXIS IP · Inteligência para Leilões Judiciais · axisip.vercel.app · Uso exclusivo do investidor
  </div>

</div>
</body>
</html>`
}

/** Abre o resumo simplificado em nova aba */
export function abrirResumoSimples(imovel) {
  const html = gerarHTML(imovel)
  abrirHtmlNovaTela(html, `resumo-${imovel.codigo_axis || imovel.id}`, true)
}

/** Componente botão para uso inline */
export default function BotaoResumoSimples({ imovel, style }) {
  return (
    <button
      onClick={() => abrirResumoSimples(imovel)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        color: '#1D4ED8', fontSize: 12, fontWeight: 700,
        ...style
      }}>
      📋 Resumo 3 Zonas
    </button>
  )
}
