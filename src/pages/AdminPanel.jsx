import{useState,useEffect}from'react'
import{getAllProfiles,updateProfile,getParametros,saveParametro,getAtividades}from'../lib/supabase'

const K={bg:'#080B10',s1:'#111620',s2:'#171E2C',bd:'#1C2438',teal:'#00E5BB',red:'#FF4757',tx:'#DDE4F0',t2:'#8896B0',t3:'#3D4E6A',wh:'#FFFFFF',warn:'#FFB627'}

const ROLES=[{id:'viewer',label:'Visualizador'},{id:'analista',label:'Analista'},{id:'admin',label:'Administrador'}]

export default function AdminPanel(){
  const[aba,setAba]=useState('usuarios')
  const[profiles,setProfiles]=useState([])
  const[parametros,setParametros]=useState([])
  const[atividades,setAtividades]=useState([])
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[toast,setToast]=useState('')

  useEffect(()=>{loadAll()},[])

  async function loadAll(){
    setLoading(true)
    try{
      const[p,par,at]=await Promise.all([getAllProfiles(),getParametros(),getAtividades()])
      setProfiles(p)
      setParametros(par)
      setAtividades(at)
    }catch(e){console.error(e)}
    setLoading(false)
  }

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(''),2500)}

  async function toggleAtivo(id,ativo){
    setSaving(true)
    try{await updateProfile(id,{ativo:!ativo});await loadAll();showToast('Usuário atualizado')}
    catch(e){console.error(e)}
    setSaving(false)
  }

  async function changeRole(id,role){
    setSaving(true)
    try{await updateProfile(id,{role});await loadAll();showToast('Perfil atualizado')}
    catch(e){console.error(e)}
    setSaving(false)
  }

  async function saveParam(param){
    setSaving(true)
    try{await saveParametro(param);await loadAll();showToast('Parâmetro salvo')}
    catch(e){console.error(e)}
    setSaving(false)
  }

  const abas=[
    {id:'usuarios',label:'👥 Usuários'},
    {id:'parametros',label:'⚙️ Parâmetros'},
    {id:'atividades',label:'📄 Log'},
  ]

  const row={borderBottom:'1px solid '+K.bd,padding:'12px 0',display:'flex',alignItems:'center',gap:'12px'}
  const badge=(on)=>({display:'inline-block',background:on?K.teal+'20':K.red+'20',color:on?K.teal:K.red,borderRadius:'6px',padding:'2px 8px',fontSize:'11px',fontWeight:700})
  const inp={background:K.s2,border:'1px solid '+K.bd,borderRadius:'7px',padding:'7px 10px',color:K.tx,fontSize:'12px',outline:'none'}

  if(loading)return<div style={{color:K.teal,padding:'40px',textAlign:'center',fontFamily:'system-ui'}}>⏳ Carregando...</div>

  return<div style={{fontFamily:"'DM Sans',system-ui,sans-serif",color:K.tx,minHeight:'100%',background:K.bg}}>
    <div style={{padding:'22px 28px 0',borderBottom:'1px solid '+K.bd}}>
      <div style={{fontWeight:700,fontSize:19,color:K.wh,marginBottom:'16px'}}>🛡️ Painel Admin</div>
      <div style={{display:'flex',gap:'4px'}}>
        {abas.map(a=><button key={a.id} onClick={()=>setAba(a.id)} style={{background:aba===a.id?K.teal+'20':'transparent',color:aba===a.id?K.teal:K.t2,border:'none',borderBottom:aba===a.id?'2px solid '+K.teal:'2px solid transparent',borderRadius:'0',padding:'8px 16px',cursor:'pointer',fontSize:'13px',fontWeight:aba===a.id?700:400}}>{a.label}</button>)}
      </div>
    </div>

    <div style={{padding:'24px 28px'}}>
      {aba==='usuarios'&&<div>
        <div style={{fontWeight:600,fontSize:'14px',color:K.wh,marginBottom:'16px'}}>{profiles.length} usuários cadastrados</div>
        {profiles.map(p=><div key={p.id} style={row}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:'13px',color:K.wh}}>{p.nome||'Sem nome'}</div>
            <div style={{fontSize:'11px',color:K.t3}}>{p.email}</div>
          </div>
          <select value={p.role||'viewer'} onChange={e=>changeRole(p.id,e.target.value)} style={{...inp(),width:'140px'}}>
            {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <span style={badge(p.ativo)}>{p.ativo?'Ativo':'Inativo'}</span>
          <button onClick={()=>toggleAtivo(p.id,p.ativo)} disabled={saving} style={{background:p.ativo?K.red+'15':K.teal+'15',border:'1px solid '+(p.ativo?K.red:K.teal),borderRadius:'6px',padding:'5px 10px',color:p.ativo?K.red:K.teal,cursor:'pointer',fontSize:'11px',fontWeight:700}}>
            {p.ativo?'Desativar':'Ativar'}
          </button>
        </div>)}
      </div>}

      {aba==='parametros'&&<div>
        <div style={{fontWeight:600,fontSize:'14px',color:K.wh,marginBottom:'4px'}}>Parâmetros de Score</div>
        <div style={{fontSize:'12px',color:K.t3,marginBottom:'16px'}}>Os pesos devem somar 100%</div>
        {parametros.length===0&&<div style={{color:K.t3,fontSize:'13px'}}>Nenhum parâmetro encontrado. Crie no Supabase.</div>}
        {parametros.map(p=><div key={p.id} style={row}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:'13px',color:K.wh}}>{p.nome}</div>
            <div style={{fontSize:'11px',color:K.t3}}>{p.descricao}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type="number" min="0" max="100" value={p.peso||0} onChange={e=>setParametros(prev=>prev.map(x=>x.id===p.id?{...x,peso:Number(e.target.value)}:x))} style={{...inp(),width:'70px',textAlign:'center'}}/>
            <span style={{color:K.t3,fontSize:'12px'}}>%</span>
            <button onClick={()=>saveParam(p)} disabled={saving} style={{background:K.teal+'15',border:'1px solid '+K.teal,borderRadius:'6px',padding:'5px 12px',color:K.teal,cursor:'pointer',fontSize:'11px',fontWeight:700}}>Salvar</button>
          </div>
        </div>)}
        {parametros.length>0&&<div style={{marginTop:'16px',padding:'12px',background:K.s2,borderRadius:'8px',fontSize:'12px'}}>
          <span style={{color:K.t3}}>Total: </span>
          <span style={{color:parametros.reduce((s,p)=>s+(p.peso||0),0)===100?K.green:K.warn,fontWeight:700}}>
            {parametros.reduce((s,p)=>s+(p.peso||0),0)}%
          </span>
          {parametros.reduce((s,p)=>s+(p.peso||0),0)!==100&&<span style={{color:K.warn,marginLeft:'8px'}}>⚠ Deve somar 100%</span>}
        </div>}
      </div>}

      {aba==='atividades'&&<div>
        <div style={{fontWeight:600,fontSize:'14px',color:K.wh,marginBottom:'16px'}}>Log de Atividades</div>
        {atividades.length===0&&<div style={{color:K.t3,fontSize:'13px'}}>Nenhuma atividade registrada.</div>}
        <div style={{fontFamily:'monospace',fontSize:'12px'}}>
          {atividades.map((a,i)=><div key={i} style={{...row,padding:'8px 0',flexDirection:'column',alignItems:'flex-start',gap:'2px'}}>
            <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
              <span style={{color:K.t3}}>{new Date(a.criado_em).toLocaleString('pt-BR')}</span>
              <span style={{color:K.teal,fontWeight:600}}>{a.usuario?.nome||'Sistema'}</span>
              <span style={{background:K.s2,borderRadius:'4px',padding:'1px 6px',color:K.tx}}>{a.acao}</span>
            </div>
            {a.detalhes&&<div style={{color:K.t2,paddingLeft:'8px'}}>{typeof a.detalhes==='string'?a.detalhes:JSON.stringify(a.detalhes)}</div>}
          </div>)}
        </div>
      </div>}
    </div>

    {toast&&<div style={{position:'fixed',bottom:'20px',right:'20px',background:K.teal,color:'#000',padding:'10px 18px',borderRadius:'8px',fontWeight:700,fontSize:'13px',zIndex:9999}}>{toast}</div>}
  </div>
}
