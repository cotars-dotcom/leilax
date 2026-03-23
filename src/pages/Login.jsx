import{useState}from'react'
import{signIn}from'../lib/supabase'

const K={bg:'#080B10',s1:'#111620',s2:'#171E2C',bd:'#1C2438',teal:'#00E5BB',red:'#FF4757',tx:'#DDE4F0',t2:'#8896B0',t3:'#3D4E6A',wh:'#FFFFFF'}

export default function Login(){
  const[email,setEmail]=useState('')
  const[senha,setSenha]=useState('')
  const[loading,setLoading]=useState(false)
  const[erro,setErro]=useState('')
  const inp={background:K.s1,border:'1px solid '+K.bd,borderRadius:'8px',padding:'12px 16px',color:K.tx,fontSize:'14px',width:'100%',outline:'none'}

  async function handleLogin(e){
    e.preventDefault()
    if(!email||!senha){setErro('Preencha e-mail e senha');return}
    setLoading(true);setErro('')
    try{await signIn(email.trim().toLowerCase(),senha)}
    catch(err){setErro(err.message==='Invalid login credentials'?'E-mail ou senha incorretos':err.message)}
    setLoading(false)
  }

  return(
    <div style={{minHeight:'100vh',background:K.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui,sans-serif",padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'400px'}}>
        <div style={{textAlign:'center',marginBottom:'40px'}}>
          <div style={{fontWeight:'800',fontSize:'36px',color:K.wh,letterSpacing:'-1px',marginBottom:'8px'}}>AX<span style={{color:K.teal}}>IS</span></div>
          <div style={{fontSize:'13px',color:K.t3,letterSpacing:'2px',textTransform:'uppercase'}}>Inteligência Patrimonial</div>
        </div>
        <div style={{background:K.s1,border:'1px solid '+K.bd,borderRadius:'14px',padding:'32px'}}>
          <div style={{fontWeight:'700',fontSize:'18px',color:K.wh,marginBottom:'6px'}}>Entrar</div>
          <div style={{fontSize:'12px',color:K.t3,marginBottom:'28px'}}>Acesso restrito a membros autorizados</div>
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',color:K.t3,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'6px'}}>E-mail</div>
              <input style={inp} type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>
            </div>
            <div style={{marginBottom:'24px'}}>
              <div style={{fontSize:'11px',color:K.t3,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'6px'}}>Senha</div>
              <input style={inp} type="password" placeholder="••••••••" value={senha} onChange={e=>setSenha(e.target.value)} autoComplete="current-password"/>
            </div>
            {erro&&<div style={{background:K.red+'15',border:'1px solid '+K.red+'40',borderRadius:'8px',padding:'12px',marginBottom:'16px',fontSize:'13px',color:K.red}}>⚠️ {erro}</div>}
            <button type="submit" disabled={loading} style={{width:'100%',background:loading?K.teal+'60':K.teal,color:'#000',border:'none',borderRadius:'8px',padding:'13px',fontSize:'14px',fontWeight:'700',cursor:loading?'not-allowed':'pointer'}}>
              {loading?'⏳ Entrando...':'→ Entrar'}
            </button>
          </form>
          <div style={{marginTop:'20px',padding:'14px',background:K.s2,borderRadius:'8px',fontSize:'12px',color:K.t3,textAlign:'center'}}>
            Não tem acesso? Solicite ao administrador.
          </div>
        </div>
      </div>
      <style>{'*{box-sizing:border-box}input::placeholder{color:#3D4E6A}'}</style>
    </div>
  )
}
