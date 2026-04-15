/**
 * AXIS — Card Atributos do Prédio (Sprint 17)
 * Mostra amenidades, pontuação, fatores de homogeneização e impacto em R$.
 * Usa calcularFatorHomogeneizacao() de constants.js como fonte única.
 */
import { C, card, fmtC } from '../appConstants.js'
import { calcularFatorHomogeneizacao, calcularScoreAtributos7D } from '../lib/constants.js'

const INFO_FIELDS = [
  { key: 'andar', label: 'Andar' },
  { key: 'total_andares', label: 'Andares prédio' },
  { key: 'ano_construcao', label: 'Ano construção' },
  { key: 'vaga_tipo', label: 'Tipo vaga' },
  { key: 'nome_condominio', label: 'Condomínio' },
  { key: 'tipologia', label: 'Tipologia' },
]

// Re-export para compatibilidade com imports existentes
export function calcularScoreAtributos(p) {
  const r = calcularScoreAtributos7D(p)
  return { pts: r.score, max: 10, pct: Math.round(r.score * 10) }
}

export default function AtributosPredio({ p }) {
  if (!p) return null

  const valorMercado = parseFloat(p.valor_mercado_estimado) || 0
  const homo = calcularFatorHomogeneizacao(p, valorMercado)
  const score7d = calcularScoreAtributos7D(p)

  const AMENIDADES = [
    { key: 'elevador', label: 'Elevador', icon: '🛗' },
    { key: 'piscina', label: 'Piscina', icon: '🏊' },
    { key: 'academia', label: 'Academia', icon: '🏋️' },
    { key: 'churrasqueira', label: 'Churrasqueira', icon: '🔥' },
    { key: 'area_lazer', label: 'Área de Lazer', icon: '🎯' },
    { key: 'portaria_24h', label: 'Portaria 24h', icon: '🔒' },
  ]

  const hasAmenidades = AMENIDADES.some(a => p[a.key] != null)
  const hasInfo = INFO_FIELDS.some(f => p[f.key])
  if (!hasAmenidades && !hasInfo) return (
    <div style={{...card(), padding: 16, opacity: 0.6}}>
      <div style={{fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8}}>Atributos do Prédio</div>
      <div style={{fontSize: 12, color: C.muted}}>Dados de amenidades não disponíveis para este imóvel.</div>
    </div>
  )

  const tagStyle = (val) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: val === true ? '#ECFDF5' : val === false ? '#FEF2F2' : '#F8FAFC',
    color: val === true ? '#065F46' : val === false ? '#991B1B' : '#64748B',
    border: `1px solid ${val === true ? '#A7F3D0' : val === false ? '#FECACA' : '#E2E8F0'}`,
  })

  const fatorCor = homo.fator >= 1.05 ? '#065F46' : homo.fator >= 1.0 ? '#92400E' : '#991B1B'
  const fatorBg = homo.fator >= 1.05 ? '#ECFDF5' : homo.fator >= 1.0 ? '#FEF9C3' : '#FEF2F2'

  return (
    <div style={{...card(), padding: 16}}>
      {/* Header com score e fator */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6}}>
        <div style={{fontSize: 13, fontWeight: 700, color: C.navy}}>Atributos do Prédio</div>
        <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
          {!score7d.semDados && (
            <div style={{padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: fatorBg, color: fatorCor}}>
              {score7d.score.toFixed(1)}/10
            </div>
          )}
          {homo.ajustes.length > 0 && (
            <div style={{padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
              background: fatorBg, color: fatorCor, border: `1px solid ${fatorCor}20`}}>
              Fator: {(homo.fator * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Amenidades tags */}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12}}>
        {AMENIDADES.map(a => {
          const val = p[a.key]
          if (val == null) return null
          return <span key={a.key} style={tagStyle(val)}>{a.icon} {a.label}</span>
        })}
      </div>

      {/* Info fields */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6, marginBottom: homo.ajustes.length > 0 ? 12 : 0}}>
        {INFO_FIELDS.map(f => {
          const val = p[f.key]
          if (!val) return null
          const display = f.key === 'vaga_tipo' || f.key === 'tipologia' ? String(val).replace(/_/g, ' ') : val
          return (
            <div key={f.key} style={{padding: '6px 10px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0'}}>
              <div style={{fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px'}}>{f.label}</div>
              <div style={{fontSize: 12, fontWeight: 600, color: C.text, marginTop: 2}}>{display}</div>
            </div>
          )
        })}
      </div>

      {/* Tabela de Homogeneização — impacto por atributo */}
      {homo.ajustes.length > 0 && (
        <div style={{borderTop: '1px solid #E2E8F0', paddingTop: 10}}>
          <div style={{fontSize: 10, fontWeight: 700, color: C.navy, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.3px'}}>
            Impacto no Valor (NBR 14653)
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
            {homo.ajustes.map(a => {
              const positivo = a.fator >= 1
              return (
                <div key={a.key} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '4px 8px', borderRadius: 6, fontSize: 11,
                  background: positivo ? '#F0FDF4' : '#FEF2F2'}}>
                  <span style={{color: '#475569', fontWeight: 500}}>{a.label}</span>
                  <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                    <span style={{fontWeight: 700, color: positivo ? '#065F46' : '#991B1B', fontSize: 11}}>
                      {a.impactoPct > 0 ? '+' : ''}{a.impactoPct}%
                    </span>
                    {a['impactoR$'] !== 0 && (
                      <span style={{fontWeight: 600, color: positivo ? '#065F46' : '#991B1B', fontSize: 10, minWidth: 72, textAlign: 'right'}}>
                        {a['impactoR$'] > 0 ? '+' : ''}{fmtC(a['impactoR$'])}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Resultado composto */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 6, padding: '6px 8px', borderRadius: 6,
            background: homo.fator >= 1 ? '#065F4610' : '#991B1B10',
            border: `1px solid ${homo.fator >= 1 ? '#065F4630' : '#991B1B30'}`}}>
            <span style={{fontSize: 11, fontWeight: 700, color: C.navy}}>Ajuste composto</span>
            <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
              <span style={{fontWeight: 800, color: fatorCor, fontSize: 12}}>
                {homo.fator >= 1 ? '+' : ''}{((homo.fator - 1) * 100).toFixed(1)}%
              </span>
              {homo.impactoTotal !== 0 && (
                <span style={{fontWeight: 700, color: fatorCor, fontSize: 11}}>
                  {homo.impactoTotal > 0 ? '+' : ''}{fmtC(homo.impactoTotal)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
