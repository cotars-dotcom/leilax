import { useState, useEffect } from "react"
import { C } from "../appConstants.js"
import { supabase } from "../lib/supabase.js"

export default function PainelConvitesAdmin({ session, imoveis: propImoveis, isPhone }) {
  const [aba, setAba] = useState('convites')
  const [convites, setConvites] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [novoConvite, setNovoConvite] = useState({ nome:'', email:'', role:'member', obs:'' })
  const [linkGerado, setLinkGerado] = useState('')
  const [msg, setMsg] = useState('')
  const APP_URL = window.location.origin

  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const { getConvites, getUsuarios } = await import('../lib/supabase.js')
      const [c, u] = await Promise.all([getConvites(), getUsuarios()])
      setConvites(c); setUsuarios(u)
    } catch(e) { setMsg('Erro ao carregar: ' + e.message) }
    setLoading(false)
  }

  async function gerarConvite(e) {
    e?.preventDefault()
    if (!novoConvite.nome) { setMsg('Informe o nome do convidado'); return }
    setLoading(true)
    try {
      const { criarConvite } = await import('../lib/supabase.js')
      const token = await criarConvite(
        novoConvite.email || '',
        novoConvite.nome,
        novoConvite.role,
        session?.user?.id
      )
      setLinkGerado(`${APP_URL}?convite=${token}`)
      await carregarDados()
      setNovoConvite({ nome:'', email:'', role:'member', obs:'' })
      setMsg('')
    } catch(e) { setMsg('Erro: ' + e.message) }
    setLoading(false)
  }

  async function revogar(id) {
    if (!confirm('Revogar este convite?')) return
    try {
      const { revogarConvite } = await import('../lib/supabase.js')
      await revogarConvite(id)
      await carregarDados()
    } catch(e) { setMsg('Erro: ' + e.message) }
  }

  async function alterarRole(userId, role) {
    try {
      const { atualizarRoleUsuario } = await import('../lib/supabase.js')
      await atualizarRoleUsuario(userId, role)
      await carregarDados()
    } catch(e) { setMsg('Erro: ' + e.message) }
  }

  async function toggleAtivo(userId, ativo) {
    try {
      const { toggleAtivoUsuario } = await import('../lib/supabase.js')
      await toggleAtivoUsuario(userId, !ativo)
      await carregarDados()
    } catch(e) { setMsg('Erro: ' + e.message) }
  }

  const vencido = (expira) => new Date(expira) < new Date()
  const fmtDt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  const roleClr = (r) => r === 'admin' ? C.navy : r === 'member' ? C.emerald : C.mustard

  return (
    <div style={{ padding: isPhone ? '16px' : '24px 32px', maxWidth:900 }}>
      <h2 style={{ margin:'0 0 6px', fontSize:20, fontWeight:700, color:C.navy }}>
        🛡️ Painel Admin
      </h2>
      <p style={{ margin:'0 0 20px', fontSize:13, color:C.muted }}>
        Gerencie contas, permissões e convites
      </p>
      <div style={{ display:'flex', gap:4, marginBottom:24,
        borderBottom:`1px solid ${C.borderW}`, paddingBottom:0 }}>
        {[['convites','🔗 Convites'],['usuarios','👥 Usuários'],['custos','💰 Custos API']].map(([k,l]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            padding:'8px 20px', border:'none', background:'none',
            fontSize:13.5, fontWeight: aba===k ? 700 : 400,
            color: aba===k ? C.navy : C.muted, cursor:'pointer',
            borderBottom: aba===k ? `2px solid ${C.emerald}` : '2px solid transparent',
            marginBottom:-1,
          }}>{l}</button>
        ))}
      </div>
      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16,
          background: msg.includes('Erro') ? '#FEE8E8' : C.emeraldL,
          color: msg.includes('Erro') ? '#C0392B' : C.emerald, fontSize:13 }}>
          {msg}
        </div>
      )}
      {aba === 'convites' && (
        <div>
          <div style={{ background:C.surface, borderRadius:12,
            padding:'20px 24px', marginBottom:24, border:`1px solid ${C.borderW}` }}>
            <h4 style={{ margin:'0 0 16px', fontSize:14, fontWeight:700, color:C.navy }}>
              Gerar novo convite
            </h4>
            <div style={{ display:'grid', gridTemplateColumns: isPhone ? '1fr' : '1fr 1fr', gap:12 }}>
              {[
                { label:'Nome do convidado*', key:'nome', type:'text', ph:'Ex: Pedro Advogado' },
                { label:'Email (opcional)', key:'email', type:'email', ph:'pedro@email.com' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:11, fontWeight:600, color:C.muted,
                    textTransform:'uppercase', letterSpacing:'0.5px',
                    display:'block', marginBottom:5 }}>{f.label}</label>
                  <input type={f.type} value={novoConvite[f.key]}
                    onChange={e => setNovoConvite(p => ({...p, [f.key]: e.target.value}))}
                    placeholder={f.ph}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8,
                      border:`1.5px solid ${C.border}`, fontSize:13,
                      color:C.text, background:C.white, outline:'none',
                      boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:C.muted,
                  textTransform:'uppercase', letterSpacing:'0.5px',
                  display:'block', marginBottom:5 }}>Permissão</label>
                <select value={novoConvite.role}
                  onChange={e => setNovoConvite(p => ({...p, role: e.target.value}))}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8,
                    border:`1.5px solid ${C.border}`, fontSize:13,
                    color:C.text, background:C.white }}>
                  <option value="member">Membro — vê análises, sem IA</option>
                  <option value="viewer">Visualizador — apenas leitura</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:C.muted,
                  textTransform:'uppercase', letterSpacing:'0.5px',
                  display:'block', marginBottom:5 }}>Observação</label>
                <input type="text" value={novoConvite.obs}
                  onChange={e => setNovoConvite(p => ({...p, obs: e.target.value}))}
                  placeholder="Ex: Sócio comercial"
                  style={{ width:'100%', padding:'9px 12px', borderRadius:8,
                    border:`1.5px solid ${C.border}`, fontSize:13,
                    color:C.text, background:C.white, outline:'none',
                    boxSizing:'border-box' }} />
              </div>
            </div>
            <button onClick={gerarConvite} disabled={loading}
              style={{ marginTop:14, padding:'10px 24px', borderRadius:8,
                border:'none', background: loading ? C.emeraldL : C.emerald,
                color: loading ? C.emerald : '#fff',
                fontSize:13.5, fontWeight:700, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Gerando...' : '🔗 Gerar link de convite'}
            </button>
          </div>
          {linkGerado && (
            <div style={{ background:C.emeraldL, border:`1px solid ${C.emerald}30`,
              borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:C.emerald }}>
                ✅ Link gerado — válido por 7 dias
              </p>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input readOnly value={linkGerado}
                  style={{ flex:1, padding:'8px 12px', borderRadius:7,
                    border:`1px solid ${C.emerald}30`, fontSize:12,
                    color:C.navy, background:C.white }} />
                <button onClick={() => {
                  navigator.clipboard.writeText(linkGerado)
                  setMsg('✅ Link copiado!')
                  setTimeout(() => setMsg(''), 2000)
                }} style={{ padding:'8px 14px', borderRadius:7,
                  background:C.emerald, color:'#fff', border:'none',
                  fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                  Copiar
                </button>
              </div>
            </div>
          )}
          <h4 style={{ margin:'0 0 10px', fontSize:13, fontWeight:700, color:C.navy }}>
            Convites gerados ({convites.length})
          </h4>
          {convites.length === 0 ? (
            <p style={{ color:C.hint, fontSize:13 }}>Nenhum convite ainda.</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {convites.map(c => {
                const expirou = vencido(c.expira_em)
                const status = c.usado ? 'usado' : expirou ? 'expirado' : 'ativo'
                const statusColor = status === 'ativo' ? C.emerald
                  : status === 'usado' ? C.muted : '#E5484D'
                return (
                  <div key={c.id} style={{ background:C.white,
                    border:`1px solid ${C.borderW}`, borderRadius:10,
                    padding:'12px 14px', display:'flex',
                    justifyContent:'space-between', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>
                          {c.nome || 'Sem nome'}
                        </span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px',
                          borderRadius:10, background:`${statusColor}15`,
                          color:statusColor, textTransform:'uppercase' }}>
                          {status}
                        </span>
                        <span style={{ fontSize:10, color:C.hint,
                          padding:'2px 7px', borderRadius:10, background:C.surface }}>
                          {c.role === 'member' ? 'Membro' : c.role === 'admin' ? 'Admin' : 'Visualizador'}
                        </span>
                      </div>
                      <p style={{ margin:0, fontSize:11, color:C.muted }}>
                        {c.email && `${c.email} · `}
                        Criado {fmtDt(c.criado_em)} · Expira {fmtDt(c.expira_em)}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {status === 'ativo' && (
                        <>
                          <button onClick={() => {
                            navigator.clipboard.writeText(`${APP_URL}?convite=${c.token}`)
                            setMsg('✅ Link copiado!')
                            setTimeout(() => setMsg(''), 2000)
                          }} style={{ padding:'6px 12px', borderRadius:6,
                            background:C.emeraldL, color:C.emerald,
                            border:`1px solid ${C.emerald}30`,
                            fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            Copiar link
                          </button>
                          <button onClick={() => revogar(c.id)}
                            style={{ padding:'6px 10px', borderRadius:6,
                              background:'#FEE8E8', color:'#C0392B',
                              border:'1px solid #E5484D20',
                              fontSize:11, cursor:'pointer' }}>
                            Revogar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {aba === 'usuarios' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:14 }}>
            <h4 style={{ margin:0, fontSize:13, fontWeight:700, color:C.navy }}>
              {usuarios.length} usuário(s) cadastrado(s)
            </h4>
            <button onClick={carregarDados} style={{ padding:'6px 14px',
              borderRadius:7, border:`1px solid ${C.borderW}`,
              background:C.white, color:C.navy, fontSize:12,
              cursor:'pointer' }}>🔄 Atualizar</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {usuarios.map(u => (
              <div key={u.id} style={{ background:C.white,
                border:`1px solid ${C.borderW}`, borderRadius:10,
                padding:'12px 16px', display:'flex',
                justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:`${C.navy}15`, display:'flex',
                    alignItems:'center', justifyContent:'center',
                    fontSize:14, fontWeight:700, color:C.navy, flexShrink:0 }}>
                    {(u.nome || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:13, fontWeight:600, color:C.navy }}>
                      {u.nome || '—'}
                    </p>
                    <p style={{ margin:'1px 0 0', fontSize:11, color:C.muted }}>
                      {u.email} · Desde {fmtDt(u.criado_em)}
                    </p>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                  <select value={u.role} onChange={e => alterarRole(u.id, e.target.value)}
                    disabled={u.email === session?.user?.email}
                    style={{ padding:'5px 10px', borderRadius:6, fontSize:11,
                      border:`1px solid ${roleClr(u.role)}40`,
                      background:`${roleClr(u.role)}10`,
                      color:roleClr(u.role), fontWeight:600, cursor:'pointer' }}>
                    <option value="admin">Admin</option>
                    <option value="member">Membro</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                  {u.email !== session?.user?.email && (<>
                    <button onClick={() => toggleAtivo(u.id, u.ativo)}
                      style={{ padding:'5px 12px', borderRadius:6,
                        fontSize:11, fontWeight:600, cursor:'pointer',
                        border:'none',
                        background: u.ativo ? '#FEE8E8' : C.emeraldL,
                        color: u.ativo ? '#C0392B' : C.emerald }}>
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button onClick={async()=>{
                      await supabase.from('profiles').update({ pode_usar_api: !u.pode_usar_api }).eq('id', u.id)
                      carregarDados()
                    }}
                      style={{ padding:'5px 12px', borderRadius:6,
                        fontSize:11, fontWeight:600, cursor:'pointer',
                        border:'none',
                        background: u.pode_usar_api ? '#d1fae5' : '#f3f4f6',
                        color: u.pode_usar_api ? '#065f46' : '#6b7280' }}>
                      {u.pode_usar_api ? '🤖 API ativa' : '🔒 Sem API'}
                    </button>
                  </>)}
                  {u.email === session?.user?.email && (
                    <span style={{ fontSize:10, color:C.hint, fontStyle:'italic' }}>você</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {aba === 'custos' && (() => {
        const USD = 5.80
        const lista = propImoveis || []
        const totalUSD = lista.reduce((s,p) => s + (p.custo_api_usd || 0.10), 0)
        const media = lista.length ? totalUSD / lista.length : 0
        return (
          <div style={{ paddingTop: 16 }}>
            <div style={{ display:'grid', gridTemplateColumns: isPhone ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10, marginBottom:20 }}>
              {[
                ['Total gasto', `R$ ${(totalUSD*USD).toFixed(2)}`],
                ['Por análise', `R$ ${(media*USD).toFixed(2)}`],
                ['Análises', lista.length],
                ['Projeção 50/mês', `R$ ${(media*USD*50).toFixed(0)}`],
              ].map(([l,v]) => (
                <div key={l} style={{ background:C.surface, borderRadius:10,
                  padding:'12px 14px', border:`1px solid ${C.borderW}` }}>
                  <p style={{ margin:'0 0 3px', fontSize:10, color:C.muted }}>{l}</p>
                  <p style={{ margin:0, fontSize:16, fontWeight:800, color:C.navy }}>{v}</p>
                </div>
              ))}
            </div>
            <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:C.navy }}>Por imóvel</p>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[...lista]
                .sort((a,b) => (b.custo_api_usd||0.10)-(a.custo_api_usd||0.10))
                .map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', background:C.white,
                  border:`1px solid ${C.borderW}`, borderRadius:8, padding:'10px 14px' }}>
                  <div>
                    <p style={{ margin:0, fontSize:12, fontWeight:600, color:C.navy }}>
                      {p.codigo_axis && <span style={{ color:C.emerald }}>#{p.codigo_axis} · </span>}
                      {(p.titulo||p.endereco||'Imóvel').slice(0,40)}
                      {p.modo_teste && <span style={{ color:C.hint }}> · TESTE</span>}
                    </p>
                    <p style={{ margin:0, fontSize:10, color:C.muted }}>
                      {new Date(p.criado_em||Date.now()).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700,
                    color: (p.custo_api_usd||0.10)*USD > 0.80 ? C.mustard : C.emerald }}>
                    R$ {((p.custo_api_usd||0.10)*USD).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin:'12px 0 0', fontSize:10, color:C.hint }}>
              * Estimativas. Sonnet: $3/1M input · $15/1M output. ChatGPT: ~$0,04/análise.
            </p>
          </div>
        )
      })()}
    </div>
  )
}
