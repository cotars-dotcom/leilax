/**
 * AXIS — Gráfico de ROI por Horizonte Temporal
 * 
 * Projeta o retorno acumulado para 1-5 anos comparando:
 * - Flip (venda imediata após reforma)
 * - Locação (renda passiva + valorização)
 * - Selic (benchmark renda fixa)
 *
 * Sprint 41d: investimento base delegado para calcularDadosFinanceiros
 * (inclui jurídico). IRPF sobre ganho capital aplicado ao flip.
 * Locação continua com cálculo local (precisa acumular ao longo do tempo
 * com valorização + vacância + aluguel mensal — não cabe na função canônica).
 */

import { calcularDadosFinanceiros, IRPF_ISENCAO_TETO, SELIC_ANUAL_PCT, IR_ALUGUEL_TETO_MENSAL, IR_ALUGUEL_PCT, VACANCIA_ANUAL_PCT } from '../lib/constants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'

const ANOS = [1, 2, 3, 5]
const SELIC_ANUAL = SELIC_ANUAL_PCT  // taxa Selic — atualizar em constants.js

function projetarROI(p, lanceEstudo, custoReformaAtual, holdingMeses = 6) {
  const lance = lanceEstudo || parseFloat(p.valor_minimo || p.preco_pedido) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0
  const aluguel = parseFloat(p.aluguel_mensal_estimado) || 0

  if (!lance || !mercado) return null

  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  // Investimento canônico — inclui custo_juridico_estimado
  const df = calcularDadosFinanceiros(lance, p, eMercado, { reforma: custoReformaAtual })
  const investBase = df.investimentoTotal

  // Valorização anual do bairro (de metricas_bairros via tendencia_12m)
  const tendencia = parseFloat(p._metricasBairro?.tendencia_12m || p.tendencia_12m || 4.5) / 100
  const vacancia = parseFloat(p._metricasBairro?.vacancia_pct || VACANCIA_ANUAL_PCT * 100) / 100
  const corretagem = 0.06
  const potencialIsencaoIRPF = mercado <= IRPF_ISENCAO_TETO
  const aplicaIR = valor => !potencialIsencaoIRPF && valor > 0

  return ANOS.map(anos => {
    // Flip: vende no mercado no ano t com valorização.
    // IRPF 15% sobre ganho capital (alinhado com calcularDadosFinanceiros).
    const mercadoFlip = mercado * Math.pow(1 + tendencia, anos)
    const vendaLiquida = mercadoFlip * (1 - corretagem)
    const ganhoFlipBruto = vendaLiquida - investBase
    const irpfFlip = aplicaIR(ganhoFlipBruto) ? ganhoFlipBruto * 0.15 : 0
    const lucroFlip = ganhoFlipBruto - irpfFlip
    const roiFlip = (lucroFlip / investBase) * 100

    // Locação: renda acumulada + valorização + venda no final.
    // IR sobre aluguel mensal acima do teto (alinhado com calcularDadosFinanceiros).
    const irAluguelAnual = aluguel > IR_ALUGUEL_TETO_MENSAL
      ? (aluguel - IR_ALUGUEL_TETO_MENSAL) * IR_ALUGUEL_PCT * 12 : 0
    const aluguelAnualLiq = aluguel * 12 * (1 - vacancia) - irAluguelAnual
    const rendaAcum = aluguelAnualLiq * anos
    const valorFinalLoc = mercado * Math.pow(1 + tendencia, anos)
    const vendaLocLiquida = valorFinalLoc * (1 - corretagem)
    const ganhoLocBruto = rendaAcum + vendaLocLiquida - investBase
    const irpfLoc = aplicaIR(vendaLocLiquida - investBase) ? Math.max(0, vendaLocLiquida - investBase) * 0.15 : 0
    const lucroLoc = ganhoLocBruto - irpfLoc
    const roiLoc = (lucroLoc / investBase) * 100

    // Selic: capital aplicado
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
