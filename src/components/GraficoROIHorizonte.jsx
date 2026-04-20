/**
 * AXIS — Gráfico de ROI por Horizonte Temporal
 * 
 * Projeta o retorno acumulado para 1-5 anos comparando:
 * - Flip (venda imediata após reforma)
 * - Locação (renda passiva + valorização)
 * - Selic (benchmark renda fixa)
 */

const ANOS = [1, 2, 3, 5]
const SELIC_ANUAL = 10.5  // % — taxa Selic abr/2026

function projetarROI(p, lanceEstudo, custoReformaAtual, holdingMeses = 6) {
  const lance = lanceEstudo || parseFloat(p.valor_minimo || p.preco_pedido) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0
  const condo = parseFloat(p.condominio_mensal || 0)
  const iptu = parseFloat(p.iptu_mensal || 0) || Math.round(condo * 0.35)
  const debitos = p.responsabilidade_debitos === 'arrematante'
    ? parseFloat(p.debitos_total_estimado || 0) : 0

  if (!lance || !mercado) return null

  // Custos de aquisição para leilão
  const pctCustos = (5 + 3 + 5 + 2.5) / 100  // comissão + ITBI + adv + doc
  const custosAq = lance * pctCustos
  const holdingTotal = holdingMeses * (condo + iptu)
  const investBase = lance + custosAq + custoReformaAtual + holdingTotal + debitos

  // Valorização anual do bairro (de metricas_bairros via tendencia_12m)
  const tendencia = parseFloat(p._metricasBairro?.tendencia_12m || p.tendencia_12m || 4.5) / 100
  const vacancia = parseFloat(p._metricasBairro?.vacancia_pct || 8) / 100
  const corretagem = 0.06

  return ANOS.map(anos => {
    // Flip: vende no mercado no ano t com valorização
    const mercadoFlip = mercado * Math.pow(1 + tendencia, anos)
    const lucroFlip = mercadoFlip * (1 - corretagem) - investBase
    const roiFlip = (lucroFlip / investBase) * 100

    // Locação: renda acumulada + valorização + venda no final
    const aluguelAnual = aluguel * 12 * (1 - vacancia)
    const rendaAcum = aluguelAnual * anos
    const valorFinalLoc = mercado * Math.pow(1 + tendencia, anos)
    const lucroLoc = rendaAcum + valorFinalLoc * (1 - corretagem) - investBase
    const roiLoc = (lucroLoc / investBase) * 100

    // Selic: capital aplicado a 10.5% a.a.
    const roiSelic = (Math.pow(1 + SELIC_ANUAL / 100, anos) - 1) * 100

    return {
      anos,
      roiFlip: Math.round(roiFlip * 10) / 10,
      roiLoc: Math.round(roiLoc * 10) / 10,
      roiSelic: Math.round(roiSelic * 10) / 10,
      lucroFlip: Math.round(lucroFlip),
      lucroLoc: Math.round(lucroLoc),
    }
  })
}

export default function GraficoROIHorizonte({ imovel, lanceEstudo, custoReformaAtual }) {
  const dados = projetarROI(imovel, lanceEstudo, custoReformaAtual)
  if (!dados) return null

  const maxROI = Math.max(...dados.flatMap(d => [d.roiFlip, d.roiLoc, d.roiSelic]), 1)
  const fmtC = v => `R$ ${Math.round(v).toLocaleString('pt-BR')}`
  const fmtP = v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`

  const barHeight = 120
  const barWidth = 18

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 12 }}>
        📈 ROI Projetado por Horizonte
      </div>

      {/* Gráfico de barras */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', marginBottom: 14,
        padding: '10px 8px', background: '#F8FAFC', borderRadius: 8 }}>

        {/* Eixo Y */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          height: barHeight, fontSize: 8, color: '#94A3B8', width: 28, textAlign: 'right' }}>
          <span>{Math.round(maxROI)}%</span>
          <span>{Math.round(maxROI / 2)}%</span>
          <span>0%</span>
        </div>

        {/* Grupos de barras */}
        {dados.map(d => (
          <div key={d.anos} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {/* Barras */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: barHeight }}>
              {/* Flip */}
              <div title={`Flip ${d.anos}a: ${fmtP(d.roiFlip)}`}
                style={{ width: barWidth, height: `${Math.max(2, (d.roiFlip / maxROI) * barHeight)}px`,
                  background: d.roiFlip >= 20 ? '#059669' : d.roiFlip >= 0 ? '#D97706' : '#DC2626',
                  borderRadius: '3px 3px 0 0', transition: 'height .3s', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 8, fontWeight: 700, color: d.roiFlip >= 20 ? '#059669' : '#D97706',
                  whiteSpace: 'nowrap' }}>
                  {d.roiFlip > 0 ? `+${Math.round(d.roiFlip)}%` : ''}
                </div>
              </div>
              {/* Locação */}
              <div title={`Locação ${d.anos}a: ${fmtP(d.roiLoc)}`}
                style={{ width: barWidth, height: `${Math.max(2, (d.roiLoc / maxROI) * barHeight)}px`,
                  background: '#7C3AED', opacity: 0.8,
                  borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
              {/* Selic */}
              <div title={`Selic ${d.anos}a: ${fmtP(d.roiSelic)}`}
                style={{ width: barWidth, height: `${Math.max(2, (d.roiSelic / maxROI) * barHeight)}px`,
                  background: '#94A3B8',
                  borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
            </div>
            {/* Label do eixo X */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>{d.anos}a</div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {[
          { cor: '#059669', label: 'Flip (revenda)' },
          { cor: '#7C3AED', label: 'Locação (renda + venda)' },
          { cor: '#94A3B8', label: `Selic (${SELIC_ANUAL}% a.a.)` },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#64748B' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.cor }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Tabela de valores */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              {['Horizonte', 'ROI Flip', 'Lucro Flip', 'ROI Locação', 'Lucro Locação', 'Selic'].map(h => (
                <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 9 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map(d => (
              <tr key={d.anos} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#334155' }}>{d.anos} ano{d.anos > 1 ? 's' : ''}</td>
                <td style={{ padding: '5px 8px', color: d.roiFlip >= 20 ? '#059669' : d.roiFlip >= 0 ? '#D97706' : '#DC2626', fontWeight: 700 }}>
                  {fmtP(d.roiFlip)}
                </td>
                <td style={{ padding: '5px 8px', color: d.lucroFlip >= 0 ? '#059669' : '#DC2626' }}>
                  {fmtC(d.lucroFlip)}
                </td>
                <td style={{ padding: '5px 8px', color: '#7C3AED', fontWeight: 700 }}>
                  {fmtP(d.roiLoc)}
                </td>
                <td style={{ padding: '5px 8px', color: '#7C3AED' }}>
                  {fmtC(d.lucroLoc)}
                </td>
                <td style={{ padding: '5px 8px', color: '#94A3B8' }}>
                  {fmtP(d.roiSelic)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 6 }}>
        Projeção baseada em tendência 12m do bairro. Valorização futura não garantida. Selic = {SELIC_ANUAL}% a.a.
      </div>
    </div>
  )
}
