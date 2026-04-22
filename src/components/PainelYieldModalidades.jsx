/**
 * AXIS — Painel de Yield por Modalidade
 * 
 * Compara yield estimado para:
 * - Locação residencial (contrato longo)
 * - Locação mensal (curto prazo)
 * - Airbnb / temporada (bairros elegíveis)
 * - Revenda rápida (flip)
 */

import { C, K, fmtC } from '../appConstants.js'

// Bairros BH com alta demanda Airbnb (turismo, eventos, negócios)
const BAIRROS_AIRBNB = new Set([
  'Savassi', 'Lourdes', 'Funcionários', 'Centro', 'Pampulha',
  'Santa Efigênia', 'Serra', 'Santo Agostinho', 'Cruzeiro',
  'Belvedere', 'Buritis', 'Gutierrez', 'Luxemburgo',
])

// Fator multiplicador Airbnb vs residencial (por bairro e tipologia)
function estimarAirbnb(bairro, aluguelResidencial, quartos) {
  if (!BAIRROS_AIRBNB.has(bairro) || !aluguelResidencial) return null
  // Fator médio BH 2025: 1.8-2.5× o aluguel mensal residencial
  const fator = quartos >= 2 ? 2.1 : 1.7
  const aluguelAirbnb = Math.round(aluguelResidencial * fator)
  // Ocupação estimada: 60-75% nos bairros premium
  const ocupacao = bairro === 'Savassi' || bairro === 'Lourdes' ? 0.72 : 0.62
  return {
    diaria_estimada: Math.round(aluguelAirbnb / 30),
    receita_bruta_mes: Math.round(aluguelAirbnb * ocupacao),
    ocupacao_pct: Math.round(ocupacao * 100),
    fator,
  }
}

export default function PainelYieldModalidades({ imovel, lanceEstudo, custoReformaAtual }) {
  if (!imovel) return null
  const lance = lanceEstudo || parseFloat(imovel?.valor_minimo || imovel?.preco_pedido) || 0
  const aluguelRes = parseFloat(imovel?.aluguel_mensal_estimado) || 0
  const condo = parseFloat(imovel?.condominio_mensal || 0)
  const iptu = parseFloat(imovel?.iptu_mensal || 0) || Math.round(condo * 0.35)
  const mercado = parseFloat(imovel?.valor_mercado_estimado) || 0
  const debitos = imovel?.responsabilidade_debitos === 'arrematante'
    ? parseFloat(imovel?.debitos_total_estimado || 0) : 0

  if (!lance || !mercado) return null

  const pctCustos = (5 + 3 + 5 + 2.5) / 100
  const holdingTotal = 6 * (condo + iptu)
  const investBase = lance * (1 + pctCustos) + (custoReformaAtual || 0) + holdingTotal + debitos

  if (investBase <= 0) return null

  const airbnb = estimarAirbnb(imovel?.bairro, aluguelRes, imovel?.quartos || 2)

  const modalidades = [
    {
      id: 'residencial',
      label: '🏠 Residencial',
      desc: 'Contrato 12-30 meses',
      receita: aluguelRes,
      despesas: condo + iptu,
      cor: '#3B82F6',
    },
    aluguelRes > 0 && {
      id: 'mensal',
      label: '📅 Mensal / Temporada',
      desc: 'Aluguel curto prazo (90d+)',
      receita: Math.round(aluguelRes * 1.3),
      despesas: condo + iptu + Math.round(aluguelRes * 0.15), // gestão 15%
      cor: '#8B5CF6',
    },
    airbnb && {
      id: 'airbnb',
      label: '✈️ Airbnb / Diárias',
      desc: `${airbnb.ocupacao_pct}% ocupação · R$${airbnb.diaria_estimada}/dia`,
      receita: airbnb.receita_bruta_mes,
      despesas: condo + iptu + Math.round(airbnb.receita_bruta_mes * 0.18), // ops 18%
      cor: '#EF4444',
      badge: 'PREMIUM',
    },
    mercado > 0 && {
      id: 'flip',
      label: '🔄 Flip (Revenda)',
      desc: 'Venda após reforma',
      receita: null, // retorno único
      cor: '#059669',
      lucro: Math.round(mercado * 0.94 - investBase),
      roi: Math.round(((mercado * 0.94 - investBase) / investBase) * 100 * 10) / 10,
    },
  ].filter(Boolean)

  const fmtYield = (receita, despesas) => {
    if (!receita) return null
    const liquido = receita - despesas
    const yieldBruto = (receita * 12 / investBase * 100).toFixed(1)
    const yieldLiq = (liquido * 12 / investBase * 100).toFixed(1)
    const payback = Math.round(investBase / liquido)
    return { yieldBruto, yieldLiq, payback, liquido: Math.round(liquido) }
  }

  return (
    <div style={{ padding: '14px 0' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
        💼 Yield por Modalidade
        <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>
          base: investimento total R${Math.round(investBase).toLocaleString('pt-BR')}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {modalidades.map(mod => {
          const y = mod.receita ? fmtYield(mod.receita, mod.despesas) : null
          return (
            <div key={mod.id} style={{
              padding: '10px 12px', borderRadius: 9,
              background: `${mod.cor}08`, border: `1px solid ${mod.cor}25`,
              borderLeft: `3px solid ${mod.cor}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {mod.label}
                    {mod.badge && (
                      <span style={{ fontSize: 8, background: mod.cor, color: '#fff',
                        padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>{mod.badge}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{mod.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {y ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 800, color: mod.cor, lineHeight: 1 }}>
                        {y.yieldLiq}%
                      </div>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>yield líq. a.a.</div>
                    </>
                  ) : mod.roi !== undefined ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 800,
                        color: mod.roi >= 20 ? '#059669' : mod.roi >= 10 ? '#D97706' : '#DC2626', lineHeight: 1 }}>
                        {mod.roi > 0 ? '+' : ''}{mod.roi}%
                      </div>
                      <div style={{ fontSize: 9, color: '#94A3B8' }}>ROI flip</div>
                    </>
                  ) : null}
                </div>
              </div>
              {y && (
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: '#64748B' }}>
                  <span>Receita: <strong style={{ color: '#334155' }}>{fmtC(mod.receita)}/mês</strong></span>
                  <span>Líquido: <strong style={{ color: mod.cor }}>{fmtC(y.liquido)}/mês</strong></span>
                  <span>Payback: <strong style={{ color: '#334155' }}>{y.payback} meses</strong></span>
                  <span style={{ color: '#94A3B8', fontSize: 9 }}>bruto {y.yieldBruto}%</span>
                </div>
              )}
              {mod.roi !== undefined && (
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>
                  Lucro estimado: <strong style={{ color: mod.lucro >= 0 ? '#059669' : '#DC2626' }}>
                    {fmtC(mod.lucro)}
                  </strong>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {airbnb && (
        <div style={{ marginTop: 8, fontSize: 9, color: '#94A3B8', fontStyle: 'italic' }}>
          ✈️ Estimativa Airbnb baseada em fator médio BH 2025 (×{airbnb.fator}× residencial). Verificar regulamentação local.
        </div>
      )}
    </div>
  )
}
