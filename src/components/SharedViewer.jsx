/**
 * AXIS — Viewer Público (Sprint 10)
 * Exibe dados de um imóvel via link de compartilhamento sem necessidade de login.
 * Rota: /#/share/:token
 */
import { useState, useEffect } from 'react'
import { getImovelPorToken } from '../lib/supabase.js'
import { isMercadoDireto } from '../lib/detectarFonte.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct = v => v != null ? `${Number(v).toFixed(1)}%` : '—'

const P = {
  navy: '#002B80', emerald: '#05A86D', red: '#E5484D', mustard: '#D4A017',
  bg: '#F4F3EF', white: '#FFFFFF', border: '#E8E6DF', text: '#1A1A2E',
  muted: '#8E8EA0', surface: '#FAFAF8',
}

function ScoreBar({ label, value, peso }) {
  const c = value >= 7 ? P.emerald : value >= 5 ? P.mustard : P.red
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: P.muted }}>{label} <span style={{ fontSize: 9, color: '#ccc' }}>({peso}%)</span></span>
        <span style={{ fontWeight: 700, color: c }}>{(value || 0).toFixed(1)}/10</span>
      </div>
      <div style={{ height: 5, background: `${c}20`, borderRadius: 3, marginTop: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(100, (value / 10) * 100)}%`, background: c, borderRadius: 3 }} />
      </div>
    </div>
  )
}

export default function SharedViewer({ token }) {
  const [imovel, setImovel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function carregar() {
      try {
        const data = await getImovelPorToken(token)
        if (!data) setErro('Link inválido ou expirado.')
        else if (data.expirado) setErro('Este link expirou. Solicite um novo ao proprietário.')
        else setImovel(data)
      } catch (e) { setErro('Erro ao carregar imóvel.') }
      setLoading(false)
    }
    carregar()
  }, [token])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: P.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: P.muted, fontSize: 14 }}>Carregando análise...</div>
      </div>
    </div>
  )

  if (erro) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: P.bg }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 8 }}>{erro}</div>
        <div style={{ fontSize: 12, color: P.muted }}>AXIS IP · Inteligência Patrimonial</div>
      </div>
    </div>
  )

  const p = imovel
  const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
  const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
  const recBg = p.recomendacao === 'COMPRAR' ? '#ECFDF5' : p.recomendacao === 'EVITAR' ? '#FEF2F2' : '#FEF9C3'
  const recCor = p.recomendacao === 'COMPRAR' ? '#065F46' : p.recomendacao === 'EVITAR' ? '#991B1B' : '#92400E'

  return (
    <div style={{ background: P.bg, minHeight: '100vh', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      {/* Header */}
      <header style={{ background: P.white, borderBottom: `1px solid ${P.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, color: P.navy, letterSpacing: -1 }}>AXIS IP</span>
          <span style={{ fontSize: 11, color: P.muted, marginLeft: 10 }}>Análise Compartilhada</span>
        </div>
        <span style={{ fontSize: 10, color: P.muted }}>Somente leitura</span>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        {/* Foto + Info */}
        {p.foto_principal && (
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, maxHeight: 280 }}>
            <img src={p.foto_principal} alt="" referrerPolicy="no-referrer"
              style={{ width: '100%', height: 280, objectFit: 'cover' }} />
          </div>
        )}

        {/* Título e rec */}
        <div style={{ background: P.white, border: `1px solid ${P.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                {p.codigo_axis && <span style={{ fontSize: 11, fontWeight: 700, color: P.navy, background: `${P.navy}12`, padding: '2px 8px', borderRadius: 4 }}>{p.codigo_axis}</span>}
                <span style={{ fontSize: 11, fontWeight: 700, color: recCor, background: recBg, padding: '2px 8px', borderRadius: 4 }}>
                  {p.recomendacao === 'COMPRAR' ? '✅' : p.recomendacao === 'EVITAR' ? '❌' : '⏳'} {p.recomendacao || 'AGUARDAR'}
                </span>
                {!eMercado && p.num_leilao && <span style={{ fontSize: 10, color: P.muted }}>{p.num_leilao}º Leilão</span>}
              </div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: P.text, lineHeight: 1.3 }}>{p.titulo || 'Imóvel'}</h1>
              <div style={{ fontSize: 12, color: P.muted, marginTop: 4 }}>
                {p.bairro}{p.bairro && p.cidade ? ', ' : ''}{p.cidade} {p.estado ? `— ${p.estado}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: (p.score_total || 0) >= 7 ? P.emerald : (p.score_total || 0) >= 5 ? P.mustard : P.red }}>
                {(p.score_total || 0).toFixed(1)}
              </div>
              <div style={{ fontSize: 9, color: P.muted, textTransform: 'uppercase' }}>Score AXIS</div>
            </div>
          </div>
        </div>

        {/* Grid de KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: eMercado ? 'Preço Pedido' : 'Valor Mínimo', value: fmt(p.preco_pedido || p.valor_minimo) },
            { label: 'Valor Avaliação', value: fmt(p.valor_avaliacao) },
            { label: 'Valor Mercado', value: fmt(p.valor_mercado_estimado) },
            { label: 'Desconto', value: p.desconto_percentual ? `-${p.desconto_percentual}%` : '—' },
            { label: 'Área', value: area ? `${area} m²` : '—' },
            { label: 'R$/m² Imóvel', value: fmt(p.preco_m2_imovel) },
            { label: 'R$/m² Mercado', value: fmt(p.preco_m2_mercado) },
            { label: 'Aluguel Est.', value: fmt(p.aluguel_mensal_estimado) },
            { label: 'Yield', value: p.yield_bruto_pct ? `${p.yield_bruto_pct}%` : '—' },
            ...(p.quartos ? [{ label: 'Quartos', value: `${p.quartos}q ${p.suites ? `(${p.suites}s)` : ''}` }] : []),
            ...(p.vagas ? [{ label: 'Vagas', value: p.vagas }] : []),
            ...(p.condominio_mensal ? [{ label: 'Condomínio', value: fmt(p.condominio_mensal) }] : []),
          ].map((kpi, i) => (
            <div key={i} style={{ background: P.white, border: `1px solid ${P.border}`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 9.5, color: P.muted, textTransform: 'uppercase', letterSpacing: '.3px' }}>{kpi.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginTop: 2 }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Scores 6D */}
        <div style={{ background: P.white, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.navy, marginBottom: 12 }}>Score 6D — Detalhamento</div>
          <ScoreBar label="Localização" value={p.score_localizacao} peso={20} />
          <ScoreBar label="Desconto" value={p.score_desconto} peso={18} />
          <ScoreBar label="Jurídico" value={p.score_juridico} peso={18} />
          <ScoreBar label="Ocupação" value={p.score_ocupacao} peso={15} />
          <ScoreBar label="Liquidez" value={p.score_liquidez} peso={15} />
          <ScoreBar label="Mercado" value={p.score_mercado} peso={14} />
        </div>

        {/* Síntese */}
        {p.sintese_executiva && (
          <div style={{ background: P.white, border: `1px solid ${P.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.navy, marginBottom: 8 }}>Síntese Executiva</div>
            <div style={{ fontSize: 12.5, color: P.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{p.sintese_executiva}</div>
          </div>
        )}

        {/* Positivos / Negativos / Alertas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
          {p.positivos && p.positivos.length > 0 && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', marginBottom: 6 }}>✅ Pontos Fortes</div>
              {(typeof p.positivos === 'string' ? JSON.parse(p.positivos) : p.positivos).slice(0, 5).map((x, i) => (
                <div key={i} style={{ fontSize: 11.5, color: '#064E3B', marginBottom: 3, lineHeight: 1.4 }}>• {x}</div>
              ))}
            </div>
          )}
          {p.negativos && p.negativos.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', marginBottom: 6 }}>⚠️ Pontos de Atenção</div>
              {(typeof p.negativos === 'string' ? JSON.parse(p.negativos) : p.negativos).slice(0, 5).map((x, i) => (
                <div key={i} style={{ fontSize: 11.5, color: '#7F1D1D', marginBottom: 3, lineHeight: 1.4 }}>• {x}</div>
              ))}
            </div>
          )}
          {p.alertas && p.alertas.length > 0 && (
            <div style={{ background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>🚨 Alertas</div>
              {(typeof p.alertas === 'string' ? JSON.parse(p.alertas) : p.alertas).slice(0, 5).map((x, i) => (
                <div key={i} style={{ fontSize: 11.5, color: '#78350F', marginBottom: 3, lineHeight: 1.4 }}>• {x}</div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', borderTop: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: P.navy, letterSpacing: -0.5 }}>AXIS IP</div>
          <div style={{ fontSize: 10.5, color: P.muted, marginTop: 4 }}>Inteligência Patrimonial · Análise gerada por IA</div>
          <div style={{ fontSize: 9.5, color: '#ccc', marginTop: 8 }}>Link de compartilhamento — somente leitura</div>
        </div>
      </div>
    </div>
  )
}
