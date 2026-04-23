import { useState, useEffect } from 'react'
import { C, K, fmtC, btn, card } from '../appConstants.js'
import { gerarAnalise, salvarAnalise, carregarAnalise } from '../lib/analiseLeilao.js'
import { supabase } from '../lib/supabase.js'

const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'
const pct = v => v != null ? `${parseFloat(v).toFixed(1)}%` : '—'

function BarraProbabilidade({ pct: p, cor }) {
  return (
    <div style={{height:6,borderRadius:3,background:C.borderW,overflow:'hidden',margin:'4px 0'}}>
      <div style={{height:'100%',borderRadius:3,background:cor,width:`${p}%`,transition:'width .4s'}}/>
    </div>
  )
}

export default function PainelLeilao({ imovel, isAdmin }) {
  const [analise, setAnalise] = useState(null)
  const [gerando, setGerando] = useState(false)
  const [msg, setMsg] = useState('')
  const [aba, setAba] = useState('leilao')

  useEffect(() => {
    if (!imovel?.id) return
    carregarAnalise(imovel.id).then(setAnalise).catch(() => {})
  }, [imovel?.id])

  const gerar = async () => {
    setGerando(true); setMsg('Calculando análise...')
    try {
      const { data:{ session } } = await supabase.auth.getSession()
      const analiseCalc = await gerarAnalise(imovel)
      const salva = await salvarAnalise(analiseCalc, session?.user?.id)
      setAnalise(salva)
      setMsg('✅ Análise gerada e salva!')
    } catch(e) { 
      console.error('[AXIS PainelLeilao]', e)
      setMsg('⚠️ Erro ao salvar análise. Tente novamente.') }
    setGerando(false)
  }

  const abas = [
    ['leilao','Leilões'],
    ['roi','ROI'],
    ['custo','Custo'],
    ['venda','Venda'],
    ['sintese','Síntese'],
  ]

  return (
    <div style={{...card(), marginBottom:14}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div>
          <div style={{fontWeight:600,color:C.navy,fontSize:13}}>Análise de Leilão</div>
          {analise && (
            <div style={{fontSize:10,color:C.hint,marginTop:2}}>
              {analise.modelo_ia === 'interno' ? 'Cálculo interno (custo zero)' : `Modelo: ${analise.modelo_ia}`}
              {' · '}Gerado em {new Date(analise.gerado_em).toLocaleDateString('pt-BR')}
            </div>
          )}
        </div>
        {isAdmin && (
          <button onClick={gerar} disabled={gerando} style={{...btn('s'),background:C.navy,color:'#fff',border:'none',opacity:gerando?0.6:1}}>
            {gerando ? 'Gerando...' : analise ? '↺ Atualizar' : '+ Gerar Análise'}
          </button>
        )}
      </div>

      {msg && <div style={{fontSize:11,color:C.muted,marginBottom:8}}>{msg}</div>}

      {!analise && (
        <div style={{textAlign:'center',padding:'20px',color:C.hint,fontSize:12}}>
          {isAdmin ? 'Clique em "Gerar Análise" para calcular automaticamente (custo zero).' : 'Análise ainda não gerada pelo administrador.'}
        </div>
      )}

      {analise && (
        <>
          {/* Abas */}
          <div style={{display:'flex',gap:4,marginBottom:14,flexWrap:'wrap'}}>
            {abas.map(([k,l]) => (
              <button key={k} onClick={()=>setAba(k)} style={{
                padding:'5px 12px',borderRadius:6,fontSize:11,fontWeight:aba===k?600:400,cursor:'pointer',
                border:`1px solid ${aba===k?C.navy:C.borderW}`,
                background:aba===k?C.navy:C.white,color:aba===k?'#fff':C.muted
              }}>{l}</button>
            ))}
          </div>

          {/* ABA: LEILÕES */}
          {aba==='leilao' && (
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8}}>
                Projeção do 2º leilão — base {analise.fonte_historico}
              </div>
              {[
                ['Piso legal (50%)', analise.lance_2_piso, analise.prob_piso_pct, C.emerald],
                ['Esperado (57% histórico)', analise.lance_2_esperado, analise.prob_esperado_pct, C.mustard],
                ['Competitivo (65%)', analise.lance_2_competitivo, analise.prob_competitivo_pct, C.navy],
              ].map(([label, val, prob, cor]) => (
                <div key={label} style={{marginBottom:10,padding:'10px 12px',background:C.surface,borderRadius:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                    <span style={{fontSize:12,color:C.text}}>{label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:cor}}>{fmt(val)}</span>
                  </div>
                  <BarraProbabilidade pct={prob} cor={cor}/>
                  <div style={{fontSize:10,color:C.hint}}>Probabilidade: {prob}%</div>
                </div>
              ))}
              <div style={{padding:'10px 12px',background:`${C.navy}08`,borderRadius:8,marginTop:6}}>
                <div style={{fontSize:11,fontWeight:600,color:C.navy,marginBottom:4}}>Lance mínimo 1º leilão</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,color:C.muted}}>
                    {pct(analise.desconto_1_pct)} abaixo da avaliação · {pct(analise.desconto_mercado_pct)} abaixo do mercado
                  </span>
                  <span style={{fontSize:15,fontWeight:800,color:C.navy}}>{fmt(analise.lance_minimo_1)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ABA: ROI */}
          {aba==='roi' && (
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8}}>Cenários de retorno — todos os custos incluídos</div>
              {(analise.cenarios||[]).map((c,i) => (
                <div key={i} style={{
                  marginBottom:8,padding:'10px 12px',borderRadius:8,
                  border:`1px solid ${c.viavel?C.emerald:C.mustard}`,
                  background:c.viavel?`${C.emerald}06`:`${C.mustard}06`
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>{c.label}</span>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{fontSize:11,color:C.muted}}>Lance: {fmt(c.lance)}</span>
                      <span style={{fontSize:13,fontWeight:800,color:c.roi>=30?C.emerald:c.roi>=20?C.mustard:'#E5484D'}}>
                        ROI {pct(c.roi)}
                      </span>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4}}>
                    {[
                      ['Custo total', fmt(c.custo_total)],
                      ['IRPF 15%', fmt(c.irpf)],
                      ['Lucro líq.', fmt(c.lucro)],
                    ].map(([l,v]) => (
                      <div key={l} style={{fontSize:10}}>
                        <div style={{color:C.hint}}>{l}</div>
                        <div style={{color:C.text,fontWeight:600}}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:6,fontSize:10,color:C.hint}}>
                    Lance máx. flip: {fmt(c.mao)} · {c.viavel ? '✓ Lance viável' : '⚠ Acima do limite'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA: CUSTO */}
          {aba==='custo' && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <div style={{padding:'10px 12px',background:C.surface,borderRadius:8}}>
                  <div style={{fontSize:10,color:C.hint,marginBottom:4}}>Custo padrão (1º leilão)</div>
                  <div style={{fontSize:16,fontWeight:800,color:C.navy}}>{fmt(analise.custo_total_1)}</div>
                  <div style={{fontSize:10,color:C.muted}}>ROI: {pct(analise.roi_1_pct)}</div>
                </div>
                <div style={{padding:'10px 12px',background:`${C.emerald}08`,borderRadius:8,border:`1px solid ${C.emerald}30`}}>
                  <div style={{fontSize:10,color:C.hint,marginBottom:4}}>Custo otimizado</div>
                  <div style={{fontSize:16,fontWeight:800,color:C.emerald}}>{fmt(analise.custo_total_otimizado)}</div>
                  <div style={{fontSize:10,color:C.emerald}}>ROI: {pct(analise.roi_otimizado_pct)}</div>
                </div>
              </div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8}}>Oportunidades de redução</div>
              {(analise.reducoes_disponiveis||[]).map((r,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'8px 0',borderBottom:`1px solid ${C.borderW}`,fontSize:12}}>
                  <div>
                    <div style={{color:C.text,fontWeight:500}}>{r.descricao || r.item}</div>
                  </div>
                  <div style={{color:C.emerald,fontWeight:700,flexShrink:0,marginLeft:8}}>
                    {r.economia_min ? `R$ ${r.economia_min.toLocaleString('pt-BR')}–${r.economia_max.toLocaleString('pt-BR')}` : fmt(r.economia)}
                  </div>
                </div>
              ))}
              <div style={{marginTop:10,padding:'8px 12px',background:`${C.emerald}08`,borderRadius:8,fontSize:11}}>
                Economia total possível: <strong style={{color:C.emerald}}>{fmt(analise.economia_total_possivel)}</strong>
                {' · '}Reforma mínima segura: <strong>{fmt(analise.reforma_minima_segura)}</strong>
              </div>
            </div>
          )}

          {/* ABA: VENDA */}
          {aba==='venda' && (
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:8}}>
                Probabilidade de valor de venda · {analise.n_comparaveis || 0} comparáveis · média {fmt(analise.media_comparaveis)}
              </div>
              {[
                ['Conservadora', analise.faixa_venda_conserv_min, analise.faixa_venda_conserv_max, analise.prob_conserv_pct, C.mustard, 'Mercado travado · 6-9 meses'],
                ['Realista', analise.faixa_venda_realista_min, analise.faixa_venda_realista_max, analise.prob_realista_pct, C.emerald, 'Cenário base · 4-6 meses'],
                ['Otimista', analise.faixa_venda_otimista_min, analise.faixa_venda_otimista_max, analise.prob_otimista_pct, C.navy, 'Reforma valorizada · mercado aquecido'],
              ].map(([label, min, max, prob, cor, obs]) => (
                <div key={label} style={{marginBottom:10,padding:'10px 12px',background:C.surface,borderRadius:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>{label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:cor}}>{fmt(min)} – {fmt(max)}</span>
                  </div>
                  <BarraProbabilidade pct={prob} cor={cor}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:C.hint}}>
                    <span>{obs}</span><span>{prob}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ABA: SÍNTESE */}
          {aba==='sintese' && (
            <div>
              <div style={{padding:'12px',background:`${C.navy}06`,borderRadius:8,marginBottom:10}}>
                <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{analise.sintese}</div>
              </div>
              {(analise.alertas_criticos||[]).length > 0 && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>Alertas</div>
                  {analise.alertas_criticos.map((a,i) => (
                    <div key={i} style={{fontSize:11,color:a.includes('CRITICO')?'#A32D2D':C.mustard,
                      padding:'4px 0',borderBottom:`1px solid ${C.borderW}`}}>{a}</div>
                  ))}
                </div>
              )}
              <div style={{fontSize:11,fontWeight:600,color:C.muted,marginBottom:6}}>Recomendações</div>
              {(analise.recomendacoes||[]).map((r,i) => (
                <div key={i} style={{display:'flex',gap:6,padding:'5px 0',borderBottom:`1px solid ${C.borderW}`,fontSize:12}}>
                  <span style={{color:C.emerald,flexShrink:0}}>→</span>
                  <span style={{color:C.text}}>{r}</span>
                </div>
              ))}
              <div style={{marginTop:10,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{padding:'8px 12px',background:C.surface,borderRadius:8,fontSize:11}}>
                  <div style={{color:C.hint}}>Risco principal</div>
                  <div style={{color:C.text,marginTop:2}}>{analise.risco_principal}</div>
                </div>
                <div style={{padding:'8px 12px',background:C.surface,borderRadius:8,fontSize:11}}>
                  <div style={{color:C.hint}}>Proteção legal</div>
                  <div style={{color:C.emerald,marginTop:2}}>{analise.protecao_legal}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
