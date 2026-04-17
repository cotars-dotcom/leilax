/**
 * AXIS — Painel de Investimento (Sprint 11)
 * Breakdown financeiro + ROI + Preditor de Concorrência
 * Inspirado no Leilão Ninja, com melhorias AXIS
 */
import { useState } from 'react'
import { C, K, fmtC, card } from '../appConstants.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { calcularBreakdownFinanceiro, calcularROI, calcularPreditorConcorrencia, calcularCustoHolding } from '../lib/constants.js'
import { useReforma } from '../hooks/useReforma.jsx'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

function BarraVisual({ label, valor, total, cor }) {
  const w = total > 0 ? Math.min(100, (valor / total) * 100) : 0
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <span style={{ fontWeight: 700, color: cor || C.navy }}>{fmt(valor)}</span>
      </div>
      <div style={{ height: 6, background: `${cor || C.navy}15`, borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${w}%`, background: cor || C.navy, borderRadius: 3, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

export default function PainelInvestimento({ imovel }) {
  const [expandido, setExpandido] = useState(false)
  const [mesesHolding, setMesesHolding] = useState(4)
  const { lanceEstudo, custoReformaAtual } = useReforma()
  const p = imovel
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const lance = lanceEstudo || parseFloat(p.preco_pedido || p.valor_minimo) || 0
  const mercado = parseFloat(p.valor_mercado_estimado) || 0

  if (!lance || !mercado) return null

  const bd = calcularBreakdownFinanceiro(lance, p, eMercado)
  const holding = calcularCustoHolding(
    parseFloat(p.condominio_mensal) || 0,
    mesesHolding,
    p.iptu_mensal ? parseFloat(p.iptu_mensal) : null
  )
  // Débitos já incluídos no bd.investimentoTotal via calcularBreakdownFinanceiro
  const debitosArrematante = bd.debitosArrematante || 0
  const investimentoComHolding = bd.investimentoTotal
  const roi = calcularROI(bd.investimentoTotal, mercado, parseFloat(p.aluguel_mensal_estimado) || 0)
  const roiComHolding = calcularROI(investimentoComHolding, mercado, parseFloat(p.aluguel_mensal_estimado) || 0)
  const preditor = !eMercado ? calcularPreditorConcorrencia(
    parseFloat(p.valor_minimo) || lance,
    mercado,
    bd.totalCustos + bd.reforma + (bd.holding || 0)
  ) : []

  const roiColor = roi.roi > 20 ? '#065F46' : roi.roi > 10 ? '#D97706' : roi.roi > 0 ? '#92400E' : '#991B1B'
  const roiBg = roi.roi > 20 ? '#ECFDF5' : roi.roi > 10 ? '#FEF3C7' : roi.roi > 0 ? '#FFFBEB' : '#FEF2F2'

  return (
    <div style={{ ...card(), marginBottom: 14, overflow: 'hidden' }}>
      {/* Header com ROI destaque */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: roiBg, borderBottom: `1px solid ${C.borderW}` }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>💰 Análise de Investimento</div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            Breakdown · ROI · Preditor
            {p.data_leilao && !eMercado && (() => {
              const [y,m,d] = p.data_leilao.split('-').map(Number)
              const dl = new Date(y, m-1, d); dl.setHours(0,0,0,0)
              const hoje = new Date(); hoje.setHours(0,0,0,0)
              const diff = Math.round((dl - hoje) / 86400000)
              return diff >= 0 ? ` · 🔨 ${diff === 0 ? 'HOJE' : diff === 1 ? 'AMANHÃ' : `D-${diff}`}` : ''
            })()}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: roiColor, lineHeight: 1 }}>
            {roi.roi > 0 ? '+' : ''}{roi.roi}%
          </div>
          <div style={{ fontSize: 9, color: roiColor, fontWeight: 600, textTransform: 'uppercase' }}>ROI estimado</div>
        </div>
      </div>

      <div style={{ padding: '14px 18px' }}>
        {/* Lance fixo — simulação completa fica no SimuladorLance abaixo */}
        {/* Grid principal: Breakdown + Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 14 }}>
          {/* Coluna esquerda: Breakdown de custos */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Custos de Aquisição
            </div>
            <BarraVisual label={`Lance ${eMercado ? '(pedido)' : '(mínimo)'}`} valor={bd.lance} total={mercado} cor="#002B80" />
            <BarraVisual label={`Comissão ${eMercado ? '' : 'leiloeiro '}(${(bd.comissao.pct * 100).toFixed(0)}%)`} valor={bd.comissao.valor} total={mercado} cor="#7C3AED" />
            <BarraVisual label={`ITBI (${(bd.itbi.pct * 100).toFixed(0)}%)`} valor={bd.itbi.valor} total={mercado} cor="#0891B2" />
            <BarraVisual label={`Doc + Registro (${(bd.documentacao.pct * 100).toFixed(1)}%)`} valor={bd.documentacao.valor} total={mercado} cor="#6366F1" />
            {!eMercado && bd.advogado.valor > 0 && (
              <BarraVisual label={`Advogado (${(bd.advogado.pct * 100).toFixed(0)}%)`} valor={bd.advogado.valor} total={mercado} cor="#D946EF" />
            )}
            {bd.reforma > 0 && (
              <BarraVisual label="Reforma estimada" valor={bd.reforma} total={mercado} cor="#F59E0B" />
            )}
            {bd.holding > 0 && (
              <BarraVisual label={`Holding (${bd.holdingMeses}m × ${fmt(bd.holdingMensal)}/mês)`} valor={bd.holding} total={mercado} cor="#EA580C" />
            )}
            {debitosArrematante > 0 && (
              <BarraVisual label="Débitos (a cargo do arrematante)" valor={debitosArrematante} total={mercado} cor="#991B1B" />
            )}
            <div style={{ borderTop: `1px solid ${C.borderW}`, paddingTop: 6, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: C.navy }}>Investimento Total</span>
                <span style={{ color: C.navy }}>{fmt(bd.investimentoTotal)}</span>
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                Custos = {bd.pctCustosSobreLance}% sobre o lance{debitosArrematante > 0 ? ` + ${fmt(debitosArrematante)} débitos` : ''}
              </div>
            </div>

            {/* Holding cost */}
            {holding.porMes > 0 && (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>🏗️ Custo de Holding</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number" min={1} max={24} value={mesesHolding}
                      onChange={e => setMesesHolding(Math.max(1, Math.min(24, Number(e.target.value))))}
                      style={{ width: 38, textAlign: 'center', fontSize: 11, border: '1px solid #FDE68A', borderRadius: 4, padding: '1px 4px', background: '#FFF' }}
                    />
                    <span style={{ fontSize: 10, color: '#92400E' }}>meses</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: '#78350F', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cond. {fmt(holding.condominio)} + IPTU {fmt(holding.iptuMensal)}/mês</span>
                  <span style={{ fontWeight: 700 }}>{fmt(holding.total)}</span>
                </div>
                {holding.total > 0 && (
                  <div style={{ marginTop: 5, fontSize: 10, color: '#92400E', borderTop: '1px solid #FDE68A', paddingTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                    <span>ROI c/ holding</span>
                    <span style={{ fontWeight: 700, color: roiComHolding.roi >= 0 ? '#065F46' : '#991B1B' }}>
                      {roiComHolding.roi > 0 ? '+' : ''}{roiComHolding.roi}% ({fmt(investimentoComHolding)} total)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Débitos registrados */}
            {parseFloat(p.debitos_total_estimado) > 0 && (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8,
                background: p.responsabilidade_debitos === 'arrematante' ? '#FEF2F2' : '#F0F4FF',
                border: `1px solid ${p.responsabilidade_debitos === 'arrematante' ? '#FECACA' : '#C7D4F8'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: p.responsabilidade_debitos === 'arrematante' ? '#991B1B' : '#1D4ED8' }}>
                    ⚖️ Débitos registrados
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: p.responsabilidade_debitos === 'arrematante' ? '#991B1B' : '#1D4ED8' }}>
                    {fmt(parseFloat(p.debitos_total_estimado))}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 3 }}>
                  {p.responsabilidade_debitos === 'sub_rogado'
                    ? 'Sub-rogados no preço (Art. 130 CTN) — pagos com produto da arrematação. Verificar edital.'
                    : p.responsabilidade_debitos === 'arrematante'
                    ? `🔴 A cargo do arrematante — INCLUÍDO no investimento total (+${fmt(parseFloat(p.debitos_total_estimado))})`
                    : p.responsabilidade_debitos === 'exonerado'
                    ? '✅ Arrematante exonerado — não impacta investimento'
                    : `⚠️ Responsabilidade não determinada: ${p.responsabilidade_debitos || 'verificar edital'}`}
                </div>
                {p.debitos_condominio && <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>Cond: {p.debitos_condominio.substring(0, 80)}</div>}
                {p.debitos_iptu && <div style={{ fontSize: 9, color: '#64748B' }}>IPTU: {p.debitos_iptu.substring(0, 80)}</div>}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.3px' }}>
              Cenários de Saída
            </div>
            {[
              { label: '📈 Otimista (+15%)', ...roi.cenarios.otimista, cor: '#065F46' },
              { label: '📊 Realista', ...roi.cenarios.realista, cor: '#002B80' },
              { label: '⚡ Venda rápida (-10%)', ...roi.cenarios.vendaRapida, cor: roi.cenarios.vendaRapida.roi >= 0 ? '#D97706' : '#991B1B' },
            ].map(c => (
              <div key={c.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                background: c.roi >= 0 ? `${c.cor}08` : '#FEF2F210',
                border: `1px solid ${c.roi >= 0 ? `${c.cor}20` : '#FCA5A530'}`
              }}>
                <div>
                  <div style={{ fontSize: 10.5, color: C.muted }}>{c.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{fmt(c.valor)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.cor }}>
                    {c.roi > 0 ? '+' : ''}{c.roi}%
                  </div>
                  <div style={{ fontSize: 9, color: C.muted }}>
                    {fmt(c.valor - bd.investimentoTotal)}
                  </div>
                </div>
              </div>
            ))}

            {/* Locação */}
            {roi.locacao && (
              <div style={{
                padding: '8px 10px', borderRadius: 8, marginTop: 4,
                background: '#F0FDF4', border: '1px solid #BBF7D020'
              }}>
                <div style={{ fontSize: 10.5, color: '#065F46', fontWeight: 600 }}>🏠 Locação</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.muted }}>Aluguel</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{fmt(roi.locacao.aluguelMensal)}/mês</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.muted }}>Yield s/ invest.</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{roi.locacao.yieldAnual}% a.a.</div>
                    <div style={{ fontSize: 8, color: '#64748B' }}>Mercado: {p.yield_bruto_pct || '—'}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: C.muted }}>Payback</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>{Math.round(roi.locacao.paybackMeses / 12)} anos</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preditor de Concorrência */}
        {preditor.length > 0 && (
          <>
            <div onClick={() => setExpandido(!expandido)} style={{
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderTop: `1px solid ${C.borderW}`, marginTop: 4
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>
                🎯 Preditor de Concorrência
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: preditor.find(n => n.label === 'Break-even')?.numLances > 20 ? '#ECFDF5' : preditor.find(n => n.label === 'Break-even')?.numLances > 10 ? '#FEF3C7' : '#FEF2F2',
                  color: preditor.find(n => n.label === 'Break-even')?.numLances > 20 ? '#065F46' : preditor.find(n => n.label === 'Break-even')?.numLances > 10 ? '#D97706' : '#991B1B',
                }}>
                  até {preditor.find(n => n.label === 'Break-even')?.numLances || 0} lances até break-even
                </span>
                <span style={{ fontSize: 10, color: C.muted }}>{expandido ? '▲' : '▼'}</span>
              </div>
            </div>

            {expandido && (
              <div style={{ paddingBottom: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                  {preditor.map(n => {
                    const cor = n.alvo >= 0.20 ? '#7C3AED' : n.alvo >= 0.10 ? '#065F46' : '#D97706'
                    return (
                      <div key={n.label} style={{
                        padding: '10px 12px', borderRadius: 10,
                        background: `${cor}08`, border: `1px solid ${cor}20`,
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: cor, textTransform: 'uppercase', marginBottom: 4 }}>{n.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: cor, lineHeight: 1 }}>{n.numLances}</div>
                        <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>lances de R$ 5k</div>
                        <div style={{ fontSize: 10, color: C.navy, fontWeight: 600, marginTop: 4 }}>
                          até {fmt(n.lanceAtual)}
                        </div>
                        <div style={{ fontSize: 9, color: '#065F46' }}>
                          lucro {fmt(n.lucro)}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5, padding: '6px 0' }}>
                  💡 Cada lance = R$ 5.000 de incremento. Base: valor de mercado {fmt(mercado)}, custos {fmt(bd.totalCustos + bd.reforma + (bd.holding || 0))} (aquisição + reforma + holding).
                  {preditor.find(n => n.label === 'Break-even')?.numLances > 15 
                    ? ' Excelente margem — você pode competir com confiança.'
                    : preditor.find(n => n.label === 'Break-even')?.numLances > 5
                    ? ' Margem moderada — defina seu lance máximo antes do leilão.'
                    : ' Margem apertada — cuidado para não ultrapassar o break-even.'}
                </div>
              </div>
            )}
          </>
        )}

        {/* Info adicional: parcelamento e condomínio */}
        {(p.parcelamento_aceito || p.nome_condominio || p.elevador === false) && (
          <div style={{ borderTop: `1px solid ${C.borderW}`, paddingTop: 10, marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {p.parcelamento_aceito && (
              <span style={{ fontSize: 9.5, padding: '3px 8px', borderRadius: 5, background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }}>
                💳 Parcelável
              </span>
            )}
            {p.nome_condominio && (
              <span style={{ fontSize: 9.5, padding: '3px 8px', borderRadius: 5, background: '#F3F4F6', color: '#374151', fontWeight: 600 }}>
                🏢 {p.nome_condominio}
              </span>
            )}
            {p.elevador === false && (
              <span style={{ fontSize: 9.5, padding: '3px 8px', borderRadius: 5, background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                ⚠️ Sem elevador
              </span>
            )}
            {p.distribuicao_pavimentos && (
              <span style={{ fontSize: 9.5, padding: '3px 8px', borderRadius: 5, background: '#F3F4F6', color: '#374151' }}
                title={p.distribuicao_pavimentos}>
                🏗️ {p.distribuicao_pavimentos.split('|').length} pavimentos
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
