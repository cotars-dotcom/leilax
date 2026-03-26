import { useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase, signIn } from '../lib/supabase'

const C = {
  navy:    '#002B80',
  navy2:   '#001A5C',
  emerald: '#05A86D',
  emeraldL:'#E6F6F0',
  bg:      '#EDECEA',
  white:   '#FFFFFF',
  muted:   '#6B7C90',
  hint:    '#9EAAB8',
  border:  '#DDD9CF',
  text:    '#0A1628',
}

function AxisLogo({ tamanho = 120, corFundo = 'escuro' }) {
  const corTexto = corFundo === 'escuro' ? '#FFFFFF' : '#052990'
  const corSeta = '#05A86B'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <svg width={tamanho} height={tamanho * 0.35} viewBox="0 0 200 70" xmlns="http://www.w3.org/2000/svg">
        {/* Seta verde — acima-direita do A */}
        <g transform="translate(8, 0)">
          <line x1="0" y1="18" x2="14" y2="4" stroke={corSeta} strokeWidth="3" strokeLinecap="round"/>
          <line x1="14" y1="4" x2="14" y2="12" stroke={corSeta} strokeWidth="3" strokeLinecap="round"/>
          <line x1="6" y1="4" x2="14" y2="4" stroke={corSeta} strokeWidth="3" strokeLinecap="round"/>
        </g>
        {/* A */}
        <text x="0" y="52" fontFamily="'Inter','Helvetica Neue',Arial,sans-serif" fontWeight="800" fontSize="48" letterSpacing="2" fill={corTexto}>A</text>
        {/* Ponto central verde */}
        <circle cx="58" cy="44" r="4" fill={corSeta}/>
        {/* XIS. */}
        <text x="66" y="52" fontFamily="'Inter','Helvetica Neue',Arial,sans-serif" fontWeight="800" fontSize="48" letterSpacing="2" fill={corTexto}>XIS.</text>
      </svg>
    </div>
  )
}

export default function Login() {
  const isMobileLogin = useIsMobile(768)
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [convite, setConvite] = useState(
    new URLSearchParams(window.location.search).get('convite') || ''
  )
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function handleLogin(e) {
    e?.preventDefault()
    setLoading(true); setErro('')
    try {
      await signIn(email.trim().toLowerCase(), senha)
    } catch(e) {
      setErro(e.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos'
        : e.message)
    }
    setLoading(false)
  }

  async function handleCadastro(e) {
    e?.preventDefault()
    if (!convite) { setErro('Código de convite obrigatório'); return }
    setLoading(true); setErro('')
    try {
      const { data: conv } = await supabase
        .from('convites')
        .select('*')
        .eq('token', convite)
        .eq('usado', false)
        .single()
      if (!conv) throw new Error('Convite inválido ou já utilizado')
      const { data, error } = await supabase.auth.signUp({ email, password: senha })
      if (error) throw error
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        nome: nome || email.split('@')[0],
        role: conv.role || 'member',
        ativo: true,
      })
      await supabase.from('convites').update({ usado: true, usado_por: data.user.id })
        .eq('token', convite)
      setSucesso('Conta criada! Verifique seu email para confirmar.')
    } catch(e) {
      setErro(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      display:'flex', flexDirection: isMobileLogin ? 'column' : 'row',
      minHeight:'100dvh',
      fontFamily:"'Inter', system-ui, sans-serif",
      background: C.bg,
    }}>
      {/* ── LADO ESQUERDO: Brand ─────────────────────────── */}
      <div style={{
        width: isMobileLogin ? '100%' : '45%',
        minHeight: isMobileLogin ? 'auto' : '100dvh',
        background: C.navy,
        display:'flex', flexDirection:'column',
        justifyContent: isMobileLogin ? 'center' : 'space-between',
        alignItems: isMobileLogin ? 'center' : 'flex-start',
        textAlign: isMobileLogin ? 'center' : 'left',
        padding: isMobileLogin ? '40px 24px 24px' : '48px 56px',
        position:'relative', overflow:'hidden',
      }}>
        <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}
          viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
          <g stroke="rgba(255,255,255,0.04)" strokeWidth="0.5">
            {[100,200,300,400,500].map(x => (
              <line key={x} x1={x} y1="0" x2={x} y2="900"/>
            ))}
            {[100,200,300,400,500,600,700,800].map(y => (
              <line key={y} x1="0" y1={y} x2="600" y2={y}/>
            ))}
          </g>
          <rect x="60" y="180" width="220" height="120" rx="10"
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
          <rect x="80" y="200" width="80" height="5" rx="2" fill="rgba(255,255,255,0.1)"/>
          <rect x="80" y="214" width="140" height="18" rx="4" fill="rgba(5,168,109,0.18)"/>
          <rect x="80" y="242" width="100" height="4" rx="2" fill="rgba(255,255,255,0.06)"/>
          <rect x="80" y="278" width="160" height="3" rx="1" fill="rgba(255,255,255,0.04)"/>
          <rect x="80" y="278" width="110" height="3" rx="1" fill="rgba(5,168,109,0.25)"/>
          <rect x="320" y="260" width="230" height="140" rx="10"
            fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
          <rect x="340" y="280" width="70" height="4" rx="2" fill="rgba(255,255,255,0.08)"/>
          <circle cx="490" cy="330" r="30"
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
          <path d="M490 300 A30 30 0 1 1 460 360"
            fill="none" stroke="rgba(5,168,109,0.3)" strokeWidth="3" strokeLinecap="round"/>
          <path d="M60 620 L140 590 L220 600 L300 560 L380 530 L460 500 L540 470"
            fill="none" stroke="rgba(5,168,109,0.25)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M60 620 L140 590 L220 600 L300 560 L380 530 L460 500 L540 470 L540 680 L60 680 Z"
            fill="rgba(5,168,109,0.06)"/>
        </svg>

        <AxisLogo tamanho={160} corFundo="escuro" />

        <div>
          <h1 style={{
            color:'#FFFFFF', fontSize:40, fontWeight:800,
            letterSpacing:'-1.5px', lineHeight:1.15, margin:'0 0 16px',
          }}>
            Visão de<br/>Oportunidade.<br/>
            <span style={{color:C.emerald}}>Base de<br/>Confiança.</span>
          </h1>
          <p style={{
            color:'rgba(255,255,255,0.5)', fontSize:15,
            lineHeight:1.6, margin:0, maxWidth:320,
          }}>
            Plataforma de inteligência patrimonial para leilões estratégicos,
            due diligence e análise de ativos imobiliários.
          </p>
        </div>

        <div style={{ display:'flex', gap:32 }}>
          {[
            { label:'Patrimônio gerido', val:'R$ 8,9M' },
            { label:'Imóveis analisados', val:'24+' },
            { label:'Score médio', val:'7,4' },
          ].map(s => (
            <div key={s.label}>
              <p style={{ margin:0, fontSize:20, fontWeight:800, color:C.emerald }}>
                {s.val}
              </p>
              <p style={{ margin:'2px 0 0', fontSize:10.5, color:'rgba(255,255,255,0.4)',
                textTransform:'uppercase', letterSpacing:'0.5px' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── LADO DIREITO: Formulário ─────────────────────── */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding: isMobileLogin ? '32px 24px 48px' : '48px 64px',
        maxWidth: isMobileLogin ? '100%' : 580,
      }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          <div style={{
            display:'flex', gap:4, marginBottom:36,
            background:'rgba(0,0,0,0.04)',
            borderRadius:10, padding:4,
          }}>
            {['login','cadastro'].map(m => (
              <button key={m} onClick={() => { setModo(m); setErro(''); setSucesso('') }}
                style={{
                  flex:1, padding:'9px 0', borderRadius:7,
                  border:'none', cursor:'pointer', fontSize:13.5,
                  fontWeight: modo===m ? 600 : 400,
                  background: modo===m ? C.white : 'transparent',
                  color: modo===m ? C.navy : C.muted,
                  boxShadow: modo===m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition:'all 0.15s',
                }}>
                {m === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          {modo === 'login' ? (
            <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:16}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:C.muted,
                  textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:6}}>
                  Email
                </label>
                <input
                  type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="seu@email.com" required autoComplete="email"
                  style={{
                    width:'100%', padding:'12px 14px', borderRadius:9,
                    border:`1.5px solid ${C.border}`, fontSize:14,
                    color:C.text, background:C.white, outline:'none',
                    boxSizing:'border-box', transition:'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = C.emerald}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:C.muted,
                  textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:6}}>
                  Senha
                </label>
                <input
                  type="password" value={senha} onChange={e=>setSenha(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{
                    width:'100%', padding:'12px 14px', borderRadius:9,
                    border:`1.5px solid ${C.border}`, fontSize:14,
                    color:C.text, background:C.white, outline:'none',
                    boxSizing:'border-box', transition:'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = C.emerald}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              {erro && (
                <div style={{
                  padding:'10px 14px', borderRadius:8,
                  background:'#FEE8E8', color:'#C0392B', fontSize:13,
                }}>⚠️ {erro}</div>
              )}

              <button type="submit" disabled={loading}
                style={{
                  padding:'13px', borderRadius:9, border:'none',
                  background: loading ? C.emeraldL : C.emerald,
                  color: loading ? C.emerald : '#fff',
                  fontSize:15, fontWeight:700, cursor: loading ? 'wait' : 'pointer',
                  transition:'all 0.15s', marginTop:4,
                  letterSpacing:'-0.3px',
                }}>
                {loading ? 'Entrando...' : 'Entrar na plataforma →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCadastro} style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{
                padding:'12px 14px', borderRadius:9,
                background:'#EEF2FF',
                border:'1px solid rgba(0,43,128,0.12)',
                fontSize:12.5, color:C.navy, lineHeight:1.5,
              }}>
                🔐 Acesso por <b>convite</b>. Insira o código recebido pelo administrador.
              </div>

              {[
                { label:'Nome completo', val:nome, set:setNome, type:'text', ph:'Gabriel Mattos', ac:'name' },
                { label:'Email', val:email, set:setEmail, type:'email', ph:'seu@email.com', ac:'email' },
                { label:'Senha', val:senha, set:setSenha, type:'password', ph:'min. 6 caracteres', ac:'new-password' },
                { label:'Código de convite', val:convite, set:setConvite, type:'text', ph:'TOKEN-CONVITE', ac:'off' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{fontSize:12,fontWeight:600,color:C.muted,
                    textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:6}}>
                    {f.label}
                  </label>
                  <input
                    type={f.type} value={f.val} onChange={e=>f.set(e.target.value)}
                    placeholder={f.ph} required autoComplete={f.ac}
                    style={{
                      width:'100%', padding:'12px 14px', borderRadius:9,
                      border:`1.5px solid ${C.border}`, fontSize:14,
                      color:C.text, background:C.white, outline:'none',
                      boxSizing:'border-box', transition:'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = C.emerald}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>
              ))}

              {erro && (
                <div style={{
                  padding:'10px 14px', borderRadius:8,
                  background:'#FEE8E8', color:'#C0392B', fontSize:13,
                }}>⚠️ {erro}</div>
              )}
              {sucesso && (
                <div style={{
                  padding:'10px 14px', borderRadius:8,
                  background:C.emeraldL, color:C.emerald, fontSize:13, fontWeight:500,
                }}>✅ {sucesso}</div>
              )}

              <button type="submit" disabled={loading}
                style={{
                  padding:'13px', borderRadius:9, border:'none',
                  background: loading ? C.emeraldL : C.navy,
                  color: loading ? C.navy : '#fff',
                  fontSize:15, fontWeight:700, cursor: loading ? 'wait' : 'pointer',
                  transition:'all 0.15s', marginTop:4,
                }}>
                {loading ? 'Criando conta...' : 'Criar conta →'}
              </button>
            </form>
          )}

          <div style={{
            marginTop:36, paddingTop:24,
            borderTop:`1px solid ${C.border}`,
            display:'flex', justifyContent:'space-between',
            alignItems:'center',
          }}>
            <p style={{margin:0, fontSize:11, color:C.hint}}>
              AXIS Intelligence v2.1
            </p>
            <p style={{margin:0, fontSize:11, color:C.hint}}>
              Belo Horizonte · MG
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
