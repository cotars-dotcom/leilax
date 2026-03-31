/**
 * AXIS — Exportar Card do Imóvel como PDF
 * Gera HTML print-friendly e abre janela de impressão (salvar como PDF).
 */

import { C } from '../appConstants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const fmtD = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

function scoreEmoji(score) {
  if (score >= 8) return '🟢'
  if (score >= 6) return '🟡'
  return '🔴'
}

function recBadge(rec) {
  if (rec === 'COMPRAR') return { bg: '#ECFDF5', color: '#065F46', text: '✅ COMPRAR' }
  if (rec === 'EVITAR')  return { bg: '#FEF2F2', color: '#991B1B', text: '❌ EVITAR' }
  return { bg: '#FEF9C3', color: '#92400E', text: '⏳ AGUARDAR' }
}

export function exportarPDFImovel(p) {
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const rec = recBadge(p.recomendacao)
  const score = (p.score_total || 0).toFixed(2)

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>AXIS · ${p.codigo_axis || ''} · ${p.titulo || 'Imóvel'}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Inter', system-ui, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.5; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #002B80; padding-bottom: 12px; margin-bottom: 16px; }
  .header-left h1 { font-size: 18px; color: #002B80; margin-bottom: 2px; }
  .header-left .sub { font-size: 10px; color: #666; }
  .header-right { text-align: right; }
  .score-big { font-size: 32px; font-weight: 900; color: ${p.score_total >= 7.5 ? '#065F46' : p.score_total >= 6 ? '#92400E' : '#991B1B'}; line-height: 1; }
  .score-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .rec-badge { display: inline-block; padding: 3px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-top: 4px; }
  .tipo-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-left: 6px; }

  /* Grid */
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
  .card-title { font-size: 12px; font-weight: 700; color: #002B80; margin-bottom: 8px; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
  .row:last-child { border-bottom: none; }
  .row-label { color: #666; font-size: 10.5px; }
  .row-value { font-weight: 600; font-size: 11px; }
  .green { color: #065F46; } .red { color: #991B1B; } .amber { color: #92400E; } .blue { color: #1D4ED8; }
  .navy { color: #002B80; } .teal { color: #0D9488; } .purple { color: #7C3AED; }

  /* Score grid */
  .score-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  .score-bar { height: 6px; border-radius: 3px; background: #e5e7eb; flex: 1; margin: 0 10px; max-width: 100px; overflow: hidden; }
  .score-fill { height: 100%; border-radius: 3px; }

  /* Sections */
  .section { margin-bottom: 16px; }
  .section-title { font-size: 13px; font-weight: 700; color: #002B80; border-bottom: 1px solid #002B8030; padding-bottom: 4px; margin-bottom: 10px; }

  /* Risks */
  .risk { padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid; }
  .risk-critico { background: #FEF2F2; border-color: #991B1B; }
  .risk-alto { background: #FFF7ED; border-color: #C2410C; }
  .risk-medio { background: #FEF9C3; border-color: #CA8A04; }
  .risk-baixo { background: #F0FDF4; border-color: #16A34A; }
  .risk-title { font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .risk-desc { font-size: 10.5px; line-height: 1.4; }
  .risk-action { font-size: 10px; color: #1D4ED8; margin-top: 3px; font-style: italic; }

  /* Tags */
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; margin: 2px 4px 2px 0; }

  /* Footer */
  .footer { border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 16px; font-size: 9px; color: #999; display: flex; justify-content: space-between; }

  /* Photo */
  .photo { width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; }

  /* Custos reais */
  .custo-real { background: #ECFDF5; padding: 2px 6px; border-radius: 3px; font-size: 8px; color: #065F46; font-weight: 700; margin-left: 6px; }
  .custo-estimado { background: #FEF9C3; padding: 2px 6px; border-radius: 3px; font-size: 8px; color: #92400E; font-weight: 700; margin-left: 6px; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- PÁGINA 1: Resumo -->
<div class="page">

  ${p.foto_principal ? `<img src="${p.foto_principal}" class="photo" onerror="this.style.display='none'" />` : ''}

  <div class="header">
    <div class="header-left">
      <h1>${p.titulo || 'Imóvel sem título'}</h1>
      <div class="sub">
        ${p.codigo_axis ? `<strong>${p.codigo_axis}</strong> · ` : ''}
        📍 ${[p.bairro, p.cidade].filter(Boolean).join(', ')}/${p.estado || 'MG'}
        · ${(p.tipologia || p.tipo || '—').replace(/_/g, ' ')}
        · ${p.area_privativa_m2 || p.area_m2 || '—'}m²
        · ${p.quartos || '—'}q · ${p.vagas || '—'}v
      </div>
      <div style="margin-top:6px;">
        <span class="rec-badge" style="background:${rec.bg};color:${rec.color}">${rec.text}</span>
        <span class="tipo-badge" style="background:${eMercado ? '#EFF6FF' : '#ECFDF5'};color:${eMercado ? '#1D4ED8' : '#065F46'}">
          ${eMercado ? '🏠 MERCADO' : `🔨 ${p.num_leilao || 1}º LEILÃO`}
        </span>
        ${p.ocupacao ? `<span class="tipo-badge" style="background:${p.ocupacao === 'Desocupado' ? '#ECFDF5' : '#FEF2F2'};color:${p.ocupacao === 'Desocupado' ? '#065F46' : '#991B1B'}">${p.ocupacao}</span>` : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="score-big">${score}</div>
      <div class="score-label">Score AXIS</div>
    </div>
  </div>

  <!-- Valores principais -->
  <div class="grid-3">
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">${eMercado ? 'Preço Pedido' : 'Lance Mínimo'}</div>
      <div style="font-size:16px;font-weight:800;color:#C2410C">${fmt(eMercado ? (p.preco_pedido || p.valor_minimo) : p.valor_minimo)}</div>
    </div>
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Avaliação</div>
      <div style="font-size:16px;font-weight:800;color:#002B80">${fmt(p.valor_avaliacao)}</div>
    </div>
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Desconto</div>
      <div style="font-size:16px;font-weight:800;color:#065F46">${p.desconto_percentual ? `${p.desconto_percentual}%` : '—'}</div>
    </div>
  </div>

  <div class="grid-3">
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Mercado est.</div>
      <div style="font-size:14px;font-weight:700;color:#002B80">${fmt(p.valor_mercado_estimado)}</div>
      <div style="font-size:9px;color:#666">${p.preco_m2_mercado ? `R$ ${Math.round(p.preco_m2_mercado).toLocaleString('pt-BR')}/m²` : ''}</div>
    </div>
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Aluguel est.</div>
      <div style="font-size:14px;font-weight:700;color:#7C3AED">${p.aluguel_mensal_estimado ? `${fmt(p.aluguel_mensal_estimado)}/mês` : '—'}</div>
    </div>
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">MAO Flip</div>
      <div style="font-size:14px;font-weight:700;color:#0D9488">${fmt(p.mao_flip)}</div>
    </div>
  </div>

  <!-- Scores -->
  <div class="section">
    <div class="section-title">📊 Score por Dimensão</div>
    <div class="grid">
      ${[
        ['Localização', p.score_localizacao, 20],
        ['Desconto', p.score_desconto, 18],
        ['Jurídico', p.score_juridico, 18],
        ['Ocupação', p.score_ocupacao, 15],
        ['Liquidez', p.score_liquidez, 15],
        ['Mercado', p.score_mercado, 14],
      ].map(([label, score, peso]) => {
        const v = score || 0
        const c = v >= 7 ? '#065F46' : v >= 5 ? '#92400E' : '#991B1B'
        const bg = v >= 7 ? '#065F46' : v >= 5 ? '#D97706' : '#991B1B'
        return `<div class="score-row">
          <span class="row-label" style="min-width:80px">${label} (${peso}%)</span>
          <div class="score-bar"><div class="score-fill" style="width:${v*10}%;background:${bg}"></div></div>
          <span style="font-weight:700;color:${c};min-width:30px;text-align:right">${v.toFixed ? v.toFixed(1) : v}/10</span>
        </div>`
      }).join('')}
    </div>
  </div>

  <!-- Ficha técnica + Jurídico -->
  <div class="grid">
    <div class="card">
      <div class="card-title">🏠 Ficha Técnica</div>
      ${[
        ['Tipo', p.tipologia || p.tipo],
        ['Área', (p.area_privativa_m2 || p.area_m2) ? `${p.area_privativa_m2 || p.area_m2}m²` : null],
        ['Quartos', p.quartos], ['Suítes', p.suites], ['Vagas', p.vagas],
        ['Andar', p.andar], ['Padrão', p.padrao_acabamento],
        ...(!eMercado ? [['Leiloeiro', p.leiloeiro], ['Data leilão', p.data_leilao], ['Nº leilão', p.num_leilao ? `${p.num_leilao}º` : null]] : []),
      ].filter(([,v]) => v != null && v !== '—' && v !== 0).map(([l,v]) =>
        `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v}</span></div>`
      ).join('')}
    </div>
    <div class="card">
      <div class="card-title">⚖️ Jurídico</div>
      ${[
        ['Processos', p.processos_ativos, p.processos_ativos === 'Nenhum' ? 'green' : 'red'],
        ['Matrícula', p.matricula_status, p.matricula_status === 'Limpa' ? 'green' : 'red'],
        ['Déb. condomínio', p.debitos_condominio_real ? fmt(p.debitos_condominio_real) : p.debitos_condominio,
          p.debitos_condominio_real ? '' : (p.debitos_condominio?.includes('Sem') ? 'green' : 'amber')],
        ['Déb. IPTU', p.debitos_iptu_real ? fmt(p.debitos_iptu_real) : p.debitos_iptu,
          p.debitos_iptu_real ? '' : (p.debitos_iptu?.includes('Sem') ? 'green' : 'amber')],
        ['Ocupação', p.ocupacao, p.ocupacao === 'Desocupado' ? 'green' : 'red'],
        ['Financiável', p.financiavel ? 'Sim' : 'Não', p.financiavel ? 'green' : 'amber'],
      ].filter(([,v]) => v != null).map(([l,v,c]) =>
        `<div class="row"><span class="row-label">${l}</span><span class="row-value ${c}">${v}${p[l.replace(/[^a-z]/gi,'')+'_real'] ? '<span class="custo-real">REAL</span>' : ''}</span></div>`
      ).join('')}
    </div>
  </div>

  <!-- Custos -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-title">🧾 Custos de Aquisição</div>
    <div class="grid">
      <div>
        ${[
          [eMercado ? 'Preço pedido' : 'Lance mínimo', fmt(p.preco_pedido || p.valor_minimo)],
          ...(!eMercado ? [['Comissão leiloeiro', fmt((p.valor_minimo || 0) * ((p.comissao_leiloeiro_pct || 5) / 100))]] : []),
          ['ITBI', fmt((p.preco_pedido || p.valor_minimo || 0) * ((p.itbi_pct || 2) / 100))],
        ].map(([l,v]) => `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v}</span></div>`).join('')}
      </div>
      <div>
        ${[
          ['Reforma', p.custo_reforma_real ? fmt(p.custo_reforma_real) + '<span class="custo-real">REAL</span>' : fmt(p.custo_reforma) + '<span class="custo-estimado">EST</span>'],
          ['Regularização', fmt(p.custo_regularizacao_real || p.custo_regularizacao)],
          ['Total', `<strong>${fmt(p.custo_total_real || p.custo_total_aquisicao)}</strong>`],
        ].map(([l,v]) => `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v}</span></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Retorno -->
  <div class="grid-3">
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Retorno revenda</div>
      <div style="font-size:16px;font-weight:800" class="green">${p.retorno_venda_pct ? `+${p.retorno_venda_pct}%` : '—'}</div>
    </div>
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Locação a.a.</div>
      <div style="font-size:16px;font-weight:800" class="purple">${p.retorno_locacao_anual_pct ? `${p.retorno_locacao_anual_pct}%` : '—'}</div>
    </div>
    <div class="card">
      <div style="font-size:9px;color:#666;text-transform:uppercase">Estrutura</div>
      <div style="font-size:14px;font-weight:700" class="navy">${p.estrutura_recomendada || '—'}</div>
    </div>
  </div>

  <div class="footer">
    <span>AXIS Inteligência Patrimonial · ${p.codigo_axis || ''} · Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
    <span>${p.fonte_url ? p.fonte_url.substring(0, 60) + '...' : ''}</span>
  </div>
</div>

<!-- PÁGINA 2: Riscos + Pontos + Justificativa -->
<div class="page">
  <div class="header" style="padding-bottom:8px;margin-bottom:12px">
    <div class="header-left">
      <h1 style="font-size:15px">${p.codigo_axis || ''} · Análise Detalhada</h1>
      <div class="sub">${p.titulo || 'Imóvel'} · ${p.bairro || ''}, ${p.cidade || ''}/${p.estado || 'MG'}</div>
    </div>
    <div class="header-right">
      <span class="rec-badge" style="background:${rec.bg};color:${rec.color}">${rec.text} · ${score}</span>
    </div>
  </div>

  <!-- Riscos -->
  ${(p.riscos_presentes?.length || p.alertas?.length) ? `
  <div class="section">
    <div class="section-title">⚠️ Riscos Identificados</div>
    ${(p.riscos_presentes || []).map(r => {
      const grav = typeof r === 'string' ? 'medio' : (r.gravidade || 'medio')
      const desc = typeof r === 'string' ? r : r.descricao
      const acao = typeof r === 'object' ? r.acao_recomendada : null
      const impacto = typeof r === 'object' ? r.impacto_financeiro_estimado : null
      return `<div class="risk risk-${grav}">
        <div class="risk-title">${grav.toUpperCase()}${impacto ? ` · ~${fmt(impacto)}` : ''}</div>
        <div class="risk-desc">${desc}</div>
        ${acao ? `<div class="risk-action">→ ${acao}</div>` : ''}
      </div>`
    }).join('')}
    ${(p.alertas || []).map(a => `<div class="risk risk-alto"><div class="risk-desc">${typeof a === 'string' ? a : a.texto || a.descricao || JSON.stringify(a)}</div></div>`).join('')}
  </div>` : ''}

  <!-- Positivos + Negativos -->
  <div class="grid">
    <div class="card">
      <div class="card-title green">✅ Pontos Positivos</div>
      ${(p.positivos || []).map(x => `<div style="padding:3px 0;font-size:10.5px">• ${x}</div>`).join('') || '<div style="color:#999;font-size:10px">Nenhum identificado</div>'}
    </div>
    <div class="card">
      <div class="card-title red">⚠️ Pontos de Atenção</div>
      ${(p.negativos || []).map(x => `<div style="padding:3px 0;font-size:10.5px">• ${x}</div>`).join('') || '<div style="color:#999;font-size:10px">Nenhum identificado</div>'}
    </div>
  </div>

  <!-- Justificativa -->
  ${p.justificativa ? `
  <div class="section">
    <div class="section-title">💬 Justificativa da IA</div>
    <div style="font-size:11px;line-height:1.6;color:#333;padding:10px 14px;background:#F8F9FA;border-radius:8px;border:1px solid #e5e7eb">
      ${p.justificativa}
    </div>
  </div>` : ''}

  <!-- Síntese executiva -->
  ${p.sintese_executiva ? `
  <div class="section">
    <div class="section-title">📋 Síntese Executiva</div>
    <div style="font-size:11px;line-height:1.6;color:#333;padding:10px 14px;background:#F0F4FF;border-radius:8px;border:1px solid #C7D4F8">
      ${p.sintese_executiva}
    </div>
  </div>` : ''}

  <!-- Comparáveis -->
  ${p.comparaveis?.length > 0 ? `
  <div class="section">
    <div class="section-title">🏘️ Comparáveis (${p.comparaveis.length})</div>
    ${p.comparaveis.slice(0, 5).map(c => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:10.5px">
        <span>${c.endereco || c.titulo || '—'}</span>
        <span style="font-weight:600">${c.preco_m2 ? `R$ ${c.preco_m2}/m²` : (c.valor ? fmt(c.valor) : '—')}</span>
      </div>
    `).join('')}
  </div>` : ''}

  <!-- Dados do mercado -->
  <div class="grid">
    <div class="card">
      <div class="card-title">📈 Mercado</div>
      ${[
        ['Tendência', p.mercado_tendencia],
        ['Demanda', p.mercado_demanda],
        ['Tempo venda', p.mercado_tempo_venda_meses ? `${p.mercado_tempo_venda_meses} meses` : null],
        ['Preço/m² imóvel', p.preco_m2_imovel ? `R$ ${Math.round(p.preco_m2_imovel).toLocaleString('pt-BR')}` : null],
        ['Preço/m² mercado', p.preco_m2_mercado ? `R$ ${Math.round(p.preco_m2_mercado).toLocaleString('pt-BR')}` : null],
      ].filter(([,v]) => v != null).map(([l,v]) =>
        `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v}</span></div>`
      ).join('')}
    </div>
    <div class="card">
      <div class="card-title">🏗️ Atributos</div>
      ${[
        ['Elevador', p.elevador != null ? (p.elevador ? '✓' : '✗') : null],
        ['Piscina', p.piscina != null ? (p.piscina ? '✓' : '✗') : null],
        ['Área lazer', p.area_lazer != null ? (p.area_lazer ? '✓' : '✗') : null],
        ['Salão festas', p.salao_festas != null ? (p.salao_festas ? '✓' : '✗') : null],
        ['Idade prédio', p.idade_predio ? `${p.idade_predio} anos` : null],
        ['Condomínio', p.condominio_mensal ? `R$ ${p.condominio_mensal}/mês` : null],
      ].filter(([,v]) => v != null).map(([l,v]) =>
        `<div class="row"><span class="row-label">${l}</span><span class="row-value">${v}</span></div>`
      ).join('')}
    </div>
  </div>

  <div class="footer">
    <span>AXIS Inteligência Patrimonial · Forma Patrimonial MG · ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
    <span>Página 2/2</span>
  </div>
</div>

</body>
</html>`

  // Abrir em nova janela para impressão
  const win = window.open('', '_blank', 'width=800,height=1100')
  if (win) {
    win.document.write(html)
    win.document.close()
    // Auto-print após carregar imagens
    win.onload = () => setTimeout(() => win.print(), 500)
  } else {
    // Fallback: download como HTML
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AXIS_${p.codigo_axis || 'imovel'}_${new Date().toISOString().slice(0,10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }
}
