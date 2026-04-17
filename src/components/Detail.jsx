import { useState, useEffect, useRef, lazy, Suspense } from "react"
import { C, K, RED, btn, inp, card, fmtC, fmtD, scoreColor, scoreLabel, recColor, mapDisplay, normalizarTextoAlerta, ESTRATEGIA_CONFIG, LIQUIDEZ_MAP } from "../appConstants.js"
import { supabase } from "../lib/supabase.js"
// motorIA: import dinâmico em handleReanalyze
// trelloService: import dinâmico em handleTrello
import CalculadoraROI from "./CalculadoraROI.jsx"
import { CLASSES_MERCADO_REFORMA, calcularCustoReforma, detectarClasseMercado } from "../data/custos_reforma.js"
import { CUSTO_M2_SINAPI, ESCOPOS as ESCOPOS_REFORMA, FATOR_VALORIZACAO, detectarClasse as detectarClasseReforma, avaliarViabilidadeReforma } from "../lib/reformaUnificada.js"
import PainelLeilao from './PainelLeilao.jsx'
const AbaJuridicaAgente = lazy(() => import('./AbaJuridicaAgente.jsx'))
import { buscarArrematesSimilares, carregarCacheArremates } from '../lib/buscaArrematesGPT.js'
import PainelLancamento from './PainelLancamento.jsx'
import PainelInvestimento from './PainelInvestimento.jsx'
import AtributosPredio from './AtributosPredio.jsx'
import SimuladorLance from './SimuladorLance.jsx'
import ConfigEstudo from './ConfigEstudo.jsx'
import TimelineMatricula from './TimelineMatricula.jsx'
import PainelRentabilidade from './PainelRentabilidade.jsx'
import { isMercadoDireto } from '../lib/detectarFonte.js'
import { calcularCustosAquisicao } from '../lib/constants.js'
import CenariosReforma from './CenariosReforma.jsx'
import { ReformaProvider } from '../hooks/useReforma.jsx'
import CustosReaisEditor from './CustosReaisEditor.jsx'
import ComparaveisComFiltros from './ComparaveisComFiltros.jsx'
const LazyMapaLocais = lazy(() => import('./MapaLocaisProximos.jsx'))
// ExportarPDF: loaded dynamically via import() in share menu

const ESCOPOS_INFO = {
  refresh_giro: {
    nome: 'Refresh Rápido',
    descricao: 'Pintura + reparos + revisão pontual — ideal para flip rápido',
    itens: ['Pintura geral interna', 'Correção de trincas e infiltrações', 'Limpeza e higienização profunda', 'Revisão elétrica pontual', 'Revisão hidráulica pontual'],
    prazo: '3–5 semanas'
  },
  leve_funcional: {
    nome: 'Leve Funcional',
    descricao: 'Refresh + piso + troca funcional — valorização 10–18%',
    itens: ['Tudo do Refresh', 'Troca de piso sala e quartos', 'Reforma banheiro social', 'Modernização de torneiras e metais', 'Iluminação LED'],
    prazo: '6–10 semanas'
  },
  leve_reforcada_1_molhado: {
    nome: 'Leve Reforçada (1 molhado)',
    descricao: 'Leve + 1 banheiro ou cozinha completa — valorização 18–28%',
    itens: ['Tudo do Leve Funcional', 'Reforma completa 1 banheiro OU cozinha', 'Revestimento novo no molhado', 'Louças e metais novos'],
    prazo: '10–16 semanas'
  },
  media: {
    nome: 'Reforma Média',
    descricao: 'Todos os molhados + elétrica/hidráulica — valorização 25–40%',
    itens: ['Reforma todos os banheiros', 'Reforma cozinha completa', 'Troca de toda a parte elétrica', 'Troca de toda a parte hidráulica', 'Pisos e revestimentos novos'],
    prazo: '16–24 semanas'
  },
  pesada: {
    nome: 'Reforma Pesada',
    descricao: 'Estrutural + layout — alto investimento, alto retorno potencial',
    itens: ['Tudo da Média', 'Alteração de layout (demolição/construção)', 'Forro de gesso novo', 'Esquadrias novas', 'Fachada (se aplicável)'],
    prazo: '24–36 semanas'
  }
}


const Bdg = ({c,ch}) => <span style={{display:"inline-block",fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"5px",textTransform:"uppercase",letterSpacing:".5px",background:`${c}12`,color:c}}>{ch}</span>

// Normaliza título longo do portal para "Apt 2q 43m² — Bairro, Cidade" (mesmo padrão do card)
function formatTitulo(p) {
  const t = p?.titulo || 'Imóvel'
  if (t.length <= 45) return t
  const tipo = (p?.tipo||'').toLowerCase().includes('casa') ? 'Casa'
    : (p?.tipo||'').toLowerCase().includes('cobertura') ? 'Cobertura'
    : (p?.tipo||'').toLowerCase().includes('sala') ? 'Sala'
    : 'Apt'
  const area = p?.area_privativa_m2 || p?.area_m2
  const parts = [tipo]
  if (p?.quartos) parts.push(`${p.quartos}q`)
  if (area) parts.push(`${Math.round(parseFloat(area))}m²`)
  const local = [p?.bairro, p?.cidade].filter(Boolean).join(', ')
  return local ? `${parts.join(' ')} — ${local}` : parts.join(' ')
}

function Hdr({title,sub,actions}) {
  return <div style={{padding:"22px 28px 16px",borderBottom:`1px solid ${C.borderW}`,flexShrink:0,background:C.white}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"10px",flexWrap:"wrap"}}>
      <div>
        <div style={{fontWeight:"700",fontSize:"19px",color:C.text,letterSpacing:"-0.3px"}}>{title}</div>
        {sub&&<div style={{fontSize:"11px",color:C.hint,marginTop:"3px"}}>{sub}</div>}
      </div>
      {actions&&<div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>{actions}</div>}
    </div>
  </div>
}

function ScoreRing({score,size=80}) {
  const [displayed, setDisplayed] = useState(0)
  const animRef = useRef(null)
  const maxVal = size > 60 ? 10 : 100
  useEffect(() => {
    const target = score || 0
    const start = performance.now()
    const duration = 800
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayed(target * ease)
      if (t < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [score])
  const c = maxVal === 10 ? scoreColor(displayed) : (displayed>=70?C.emerald:displayed>=50?C.mustard:"#E5484D")
  const r = (size-10)/2
  const circ = 2*Math.PI*r
  const dash = (displayed/maxVal)*circ
  return <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${c}20`} strokeWidth={size>60?8:4}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={size>60?8:4}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
    </svg>
    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center"}}>
      <div style={{fontSize:size>70?"18px":"13px",fontWeight:"800",color:c,lineHeight:1}}>{maxVal===10?displayed.toFixed(2):displayed.toFixed(1)}</div>
      <div style={{fontSize:"8px",color:C.hint,textTransform:"uppercase",letterSpacing:".5px"}}>{scoreLabel(displayed)}</div>
    </div>
  </div>
}

function NotasPrivadas({ imovelId }) {
  const key = `axis_nota_${imovelId}`
  const [nota, setNota] = useState(() => localStorage.getItem(key) || '')
  const [saved, setSaved] = useState(false)
  const save = (v) => { localStorage.setItem(key, v); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  return (
    <div style={{background:'#FFFBEB', borderRadius:12, padding:'16px', border:'1px solid #FEF3C7', marginBottom:'14px'}}>
      <div style={{fontWeight:600,color:'#92400E',marginBottom:8,fontSize:13,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span>📝 Notas privadas</span>
        <span style={{fontSize:10,color:'#A16207',fontWeight:400}}>🔒 Somente neste dispositivo</span>
      </div>
      <textarea
        value={nota}
        onChange={e => setNota(e.target.value)}
        onBlur={e => save(e.target.value)}
        placeholder="Suas anotações pessoais sobre este imóvel... (salvo automaticamente ao sair do campo)"
        style={{width:'100%',minHeight:100,padding:'10px 12px',borderRadius:8,border:'1px solid #FDE68A',fontSize:12,color:'#1A1A2E',lineHeight:1.6,resize:'vertical',outline:'none',background:'#fff',boxSizing:'border-box',fontFamily:"'Inter',system-ui,sans-serif"}}
      />
      <div style={{marginTop:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:10,color:'#A16207'}}>{nota.length} caracteres</span>
        <button onClick={() => save(nota)} style={{padding:'4px 14px',borderRadius:6,border:'1px solid #FDE68A',background:saved?'#05A86D':'#FFFBEB',color:saved?'#fff':'#92400E',fontSize:11,fontWeight:600,cursor:'pointer',transition:'all 0.2s'}}>
          {saved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// Trello helpers (used by Detail for legacy fallback)
const BASE = "https://api.trello.com/1"
const tPost = async (path,key,token,body) => { const p=new URLSearchParams({key,token,...body}); const r=await fetch(`${BASE}${path}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:p}); if(!r.ok) throw new Error(await r.text()); return r.json() }

function buildTrelloCard(p) {
  const rc = p.recomendacao||"—"
  const score = (p.score_total||0).toFixed(2)
  const emoji = rc==="COMPRAR"?"🟢":rc==="AGUARDAR"?"🟡":"🔴"
  const desc = `## ${emoji} ${rc} — Score ${score}/10

**Endereço:** ${p.endereco||"—"}
**Tipo:** ${p.tipo||"—"} · ${p.area_m2||"—"}m² · ${p.quartos||"—"} quartos · ${p.vagas||"—"} vagas

---

### 💰 Valores
- **Avaliação:** ${fmtC(p.valor_avaliacao)}
- **${isMercadoDireto(p.fonte_url,p.tipo_transacao)?'Preço pedido':'Lance mínimo'}:** ${fmtC(isMercadoDireto(p.fonte_url,p.tipo_transacao)?(p.preco_pedido||p.valor_minimo):p.valor_minimo)}
- **Desconto:** ${p.desconto_percentual||"—"}%
- **Preço/m² imóvel:** R$ ${p.preco_m2_imovel||"—"}/m²
- **Preço/m² mercado:** R$ ${p.preco_m2_mercado||"—"}/m²

---

### ⚖️ Jurídico
- **Processos:** ${p.processos_ativos||"—"}
- **Matrícula:** ${p.matricula_status||"—"}
- **Déb. condomínio:** ${p.debitos_condominio||"—"}
- **Déb. IPTU:** ${p.debitos_iptu||"—"}
${p.obs_juridicas?`\n${p.obs_juridicas}`:""}

---

### 📊 Scores
| Dimensão | Score | Peso |
|---|---|---|
| Localização | ${p.score_localizacao||0}/10 | 20% |
| Desconto | ${p.score_desconto||0}/10 | 18% |
| Jurídico | ${p.score_juridico||0}/10 | 18% |
| Ocupação | ${p.score_ocupacao||0}/10 | 15% |
| Liquidez | ${p.score_liquidez||0}/10 | 15% |
| Mercado | ${p.score_mercado||0}/10 | 14% |
| **TOTAL** | **${score}/10** | |

---

### 📈 Retorno
- **Revenda:** +${p.retorno_venda_pct||"—"}%
- **Locação a.a.:** ${p.retorno_locacao_anual_pct||"—"}%
- **Custo regularização:** ${fmtC(p.custo_regularizacao)}
- **Custo reforma:** ${fmtC(p.custo_reforma_calculado)}
- **Estrutura recomendada:** ${p.estrutura_recomendada||"—"}

---

### ✅ Pontos Positivos
${(p.positivos||[]).map(x=>`- ${x}`).join("\n")||"—"}

### ⚠️ Pontos de Atenção
${(p.negativos||[]).map(x=>`- ${x}`).join("\n")||"—"}

### 🚨 Alertas
${(p.alertas||[]).map(x=>`- ${x}`).join("\n")||"Nenhum"}

---

### 💬 Justificativa
${p.justificativa||"—"}

---
*Analisado pelo AXIS · ${new Date().toLocaleDateString("pt-BR")}*
${p.fonte_url?`\n🔗 ${p.fonte_url}`:""}`

  return { name:`${emoji} [${score}] ${p.titulo||p.tipo||"Imóvel"} — ${p.cidade||""}`, desc }
}

function GaleriaFotos({ fotos = [], foto_principal = null, url = null, imovelId = null, onFotosAtualizadas = null, isAdmin = false }) {
  const [fotoAtiva, setFotoAtiva] = useState(foto_principal || fotos[0] || null)
  const [buscando, setBuscando] = useState(false)
  const [msgFoto, setMsgFoto] = useState('')
  const [fotosLocais, setFotosLocais] = useState(fotos)
  const [principalLocal, setPrincipalLocal] = useState(foto_principal)
  const [fotoErro, setFotoErro] = useState(false)
  const [retried, setRetried] = useState(null)

  const buscarFotos = async () => {
    if (!url) return
    setBuscando(true); setMsgFoto('')
    try {
      const { buscarFotosImovel } = await import('../lib/buscadorFotos.js')
      const geminiKey = localStorage.getItem('axis-gemini-key') || ''
      const resultado = await buscarFotosImovel({ fonte_url: url, id: imovelId }, geminiKey, setMsgFoto)
      if (resultado.fotos.length > 0 || resultado.foto_principal) {
        setFotosLocais(resultado.fotos)
        setPrincipalLocal(resultado.foto_principal)
        setFotoAtiva(resultado.foto_principal || resultado.fotos[0])
        setMsgFoto(`✅ ${resultado.fotos.length} fotos encontradas (${resultado.fonte})`)
        // Salvar no banco
        if (imovelId && onFotosAtualizadas) {
          onFotosAtualizadas(resultado.fotos, resultado.foto_principal)
        }
      } else {
        setMsgFoto('⚠️ Nenhuma foto encontrada automaticamente. Tente ver o anúncio original.')
      }
    } catch(e) {
      setMsgFoto('⚠️ Erro ao buscar fotos: ' + e.message)
    }
    setBuscando(false)
  }

  const todasFotosExib = principalLocal
    ? [principalLocal, ...fotosLocais.filter(f => f !== principalLocal)]
    : fotosLocais

  if (!fotosLocais.length && !principalLocal) return (
    <div style={{ textAlign:'center', padding:'32px 24px', color:C.hint }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📷</div>
      <p style={{ margin:'0 0 6px', fontSize:14, fontWeight:600, color:C.muted }}>Nenhuma foto disponível</p>
      <p style={{ margin:'0 0 16px', fontSize:12, color:C.hint }}>
        Fotos são extraídas automaticamente do edital. Clique em buscar ou veja o anúncio original.
      </p>
      {msgFoto && <p style={{ fontSize:11, color:msgFoto.includes('✅') ? C.emerald : C.mustard, marginBottom:10 }}>{msgFoto}</p>}
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        {isAdmin && url && (
          <button onClick={buscarFotos} disabled={buscando} style={{
            padding:'8px 16px', borderRadius:8, background:C.navy, color:'#fff',
            fontSize:12, fontWeight:600, border:'none', cursor:'pointer', opacity:buscando?0.6:1
          }}>
            {buscando ? (msgFoto || 'Buscando...') : '🔍 Buscar fotos automaticamente'}
          </button>
        )}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{
          display:'inline-flex', alignItems:'center', padding:'8px 16px',
          borderRadius:8, background:C.surface, border:`1px solid ${C.borderW}`,
          color:C.navy, fontSize:12, fontWeight:600, textDecoration:'none'
        }}>Ver anúncio original →</a>}
      </div>
    </div>
  )
  return (
    <div style={{ marginBottom: 20 }}>
      {msgFoto && <p style={{ fontSize:11, color:msgFoto.includes('✅') ? C.emerald : C.mustard, marginBottom:8, textAlign:'center' }}>{msgFoto}</p>}
      {fotoAtiva && (
        <div style={{
          width: '100%',
          borderRadius: 12, overflow: 'hidden',
          marginBottom: 8, background: '#F8FAFC',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 200, maxHeight: 420,
          position: 'relative',
          border: '1px solid #E2E8F0',
        }}>
          {fotoErro ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:200,color:'#94A3B8',gap:8}}>
              <span style={{fontSize:36}}>🖼️</span>
              <span style={{fontSize:12}}>Foto indisponível — abra o anúncio original</span>
            </div>
          ) : (
            <img
              key={fotoAtiva}
              src={retried === fotoAtiva ? fotoAtiva + (fotoAtiva.includes('?') ? '&' : '?') + '_r=1' : fotoAtiva}
              alt="Foto principal"
              referrerPolicy="no-referrer"
              style={{
                maxWidth: '100%',
                maxHeight: 420,
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={() => {
                if (retried !== fotoAtiva) {
                  setRetried(fotoAtiva)
                } else {
                  setFotoErro(true)
                }
              }}
            />
          )}
        </div>
      )}
      {todasFotosExib.length > 1 && (
        <div style={{
          display: 'flex', gap: 6,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {todasFotosExib.map((foto, i) => (
            <div
              key={i}
              onClick={() => { setFotoAtiva(foto); setFotoErro(false); setRetried(null) }}
              style={{ flexShrink: 0, cursor: 'pointer', borderRadius: 7, overflow: 'hidden',
                border: fotoAtiva === foto ? `2px solid ${C.emerald}` : '2px solid transparent',
                opacity: fotoAtiva === foto ? 1 : 0.7, transition: 'all 0.15s' }}>
              <img
                src={foto}
                alt={`Foto ${i + 1}`}
                referrerPolicy="no-referrer"
                style={{ width: 80, height: 58, objectFit: 'cover', display: 'block' }}
                onError={e => { e.target.parentElement.style.display = 'none' }}
              />
            </div>
          ))}
        </div>
      )}
      {isAdmin && url && (
        <div style={{ marginTop:10, textAlign:'center' }}>
          <button onClick={buscarFotos} disabled={buscando} style={{
            padding:'5px 12px', borderRadius:6, background:C.surface,
            border:`1px solid ${C.borderW}`, color:C.muted, fontSize:11,
            cursor:'pointer', opacity:buscando?0.6:1
          }}>
            {buscando ? (msgFoto || 'Buscando...') : '🔄 Buscar mais fotos'}
          </button>
        </div>
      )}
    </div>
  )
}

function CardComparavel({item:c, K, isPhone, imovel}) {
  const [aberto, setAberto] = useState(false)
  const fmtV = v => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : '—'
  // Helper: gerar slug para URLs de portais imobiliários
  const toSlug = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')
  return <div style={{marginBottom:6,borderRadius:8,overflow:"hidden",border:`1px solid ${K.bd}`}}>
    <div onClick={()=>setAberto(!aberto)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",cursor:"pointer",background:K.s2}}>
      <div style={{flex:1,minWidth:0}}>
        {c.link
          ? <a href={c.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
              style={{fontSize:12.5,fontWeight:600,color:K.wh,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
              <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.descricao||'Comparável'}</span>
              <span style={{fontSize:9,color:K.teal,flexShrink:0}}>{c._link_gerado ? '🔍' : '↗'}</span>
            </a>
          : <div style={{fontSize:12.5,fontWeight:600,color:K.wh,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.descricao||'Comparável'}</div>
        }
        <div style={{fontSize:11,color:K.t3,marginTop:1}}>
          {c.preco_m2?`R$ ${Number(c.preco_m2).toLocaleString('pt-BR')}/m²`:''}
          {c.similaridade?` · ${Number(c.similaridade).toFixed(1)} compatib.`:''}
          {c.fonte?` · ${c.fonte}`:''}
        </div>
        <div style={{fontSize:10,color:K.t3,marginTop:1,display:'flex',gap:6,flexWrap:'wrap'}}>
          {c.quartos>0&&<span>🛏 {c.quartos}q</span>}
          {c.vagas>0&&<span>🚗 {c.vagas}v</span>}
          {c.area_m2>0&&<span>📐 {c.area_m2}m²</span>}
          {c.condominio_mes>0&&<span>🏢 cond. R${Number(c.condominio_mes).toLocaleString('pt-BR')}/mês</span>}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:8}}>
        <div style={{textAlign:'right'}}>
          <div style={{fontWeight:700,fontSize:13,color:K.teal}}>{c.valor?`${(c.valor/1000).toFixed(0)}K`:''}</div>
          {c.area_m2>0&&c.valor>0&&<div style={{fontSize:9,color:K.t3}}>R${Math.round(c.valor/c.area_m2).toLocaleString('pt-BR')}/m²</div>}
        </div>
        <span style={{fontSize:14,color:K.t3}}>{aberto?'▲':'▼'}</span>
      </div>
    </div>
    {aberto&&<div style={{padding:"10px 12px",background:K.bg,borderTop:`1px solid ${K.bd}`,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
      {[['Área',c.area_m2?`${c.area_m2}m²`:'—'],['Quartos',c.quartos??'—'],['Vagas',c.vagas??'—'],
        ['Tipo',c.tipo??'—'],['Andar',c.andar??'—'],['Cond./mês',c.condominio_mes?fmtV(c.condominio_mes):'—']
      ].map(([label,val],i)=><div key={i}><div style={{fontSize:10,color:K.t3,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:12.5,fontWeight:600,color:K.wh}}>{val}</div></div>)}
      {c.link && !c._link_gerado
        ? <a href={c.link} target="_blank" rel="noreferrer" style={{gridColumn:"1/-1",fontSize:11,color:K.teal,textDecoration:"none"}}>🔗 Ver anúncio →</a>
        : (() => {
            // Usar c.bairro (preenchido pelo motor IA) → fallback: extrair da descrição → fallback: bairro do imóvel
            const bairro = c.bairro || (() => {
              const descParts = (c.descricao || '').split(',').map(s => s.trim())
              return descParts.length >= 2 ? descParts[descParts.length - 2] : ''
            })() || (imovel?.bairro || '')
            const bairroSlug = toSlug(bairro)
            const area = c.area_m2 || ''
            const q = c.quartos || ''
            const cid = c.cidade || imovel?.cidade || 'Belo Horizonte'
            const cidSlug = toSlug(cid)
            const aMin = area>0?`&areaMin=${Math.round(area*0.8)}&areaMax=${Math.round(area*1.2)}`:''
            // Detectar tipo para URLs
            const tipoComp = (c.tipo || imovel?.tipo || 'apartamento').toLowerCase()
            const tipoZap = tipoComp.includes('casa') ? 'casas' : tipoComp.includes('terreno') || tipoComp.includes('lote') ? 'terrenos' : 'apartamentos'
            const tipoViva = tipoComp.includes('terreno') || tipoComp.includes('lote') ? 'terreno_residencial'
              : tipoComp.includes('cobertura') ? 'cobertura_residencial'
              : tipoComp.includes('casa') ? 'casa_residencial'
              : 'apartamento_residencial'
            // ZAP: mg+cidade++bairro/N-quartos/ (bairro com duplo +)
            const zapBairro = bairroSlug ? `++${bairroSlug}` : ''
            const zapQuartos = q ? `/${q}-quartos/` : '/'
            const zapUrl = `https://www.zapimoveis.com.br/venda/${tipoZap}/mg+${cidSlug}${zapBairro}${zapQuartos}${aMin ? '?' + aMin.substring(1) : ''}`
            // VivaReal: /venda/minas-gerais/cidade/bairros/bairro/tipo/ (segmento /bairros/ obrigatório)
            const vivaBairro = bairroSlug ? `bairros/${bairroSlug}/` : ''
            const vivaUrl = `https://www.vivareal.com.br/venda/minas-gerais/${cidSlug}/${vivaBairro}${tipoViva}/${q ? `?quartos=${q}` : ''}${q && aMin ? aMin : (!q && aMin ? '?' + aMin.substring(1) : '')}`
            // OLX: busca textual — região baseada na cidade
            const olxRegiaoMap = {
              'belo-horizonte': 'belo-horizonte-e-regiao', 'contagem': 'belo-horizonte-e-regiao',
              'betim': 'belo-horizonte-e-regiao', 'nova-lima': 'belo-horizonte-e-regiao',
              'santa-luzia': 'belo-horizonte-e-regiao', 'sabara': 'belo-horizonte-e-regiao',
              'ribeirao-das-neves': 'belo-horizonte-e-regiao',
              'juiz-de-fora': 'juiz-de-fora-e-regiao',
            }
            const olxRegiao = olxRegiaoMap[cidSlug] || 'belo-horizonte-e-regiao'
            const olxUrl = `https://mg.olx.com.br/${olxRegiao}/imoveis?q=${tipoZap.slice(0,-1)}+${q ? q+'+quartos+' : ''}${bairro.replace(/\s+/g,'+')}`
            return <div style={{gridColumn:'1/-1',display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
              <a href={zapUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#F97316',textDecoration:'none',padding:'3px 8px',background:'#FFF7ED',borderRadius:4,border:'1px solid #FED7AA'}}>🔍 ZAP</a>
              <a href={vivaUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#7C3AED',textDecoration:'none',padding:'3px 8px',background:'#F5F3FF',borderRadius:4,border:'1px solid #DDD6FE'}}>🔍 Viva Real</a>
              <a href={olxUrl} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#059669',textDecoration:'none',padding:'3px 8px',background:'#ECFDF5',borderRadius:4,border:'1px solid #A7F3D0'}}>🔍 OLX</a>
            </div>
          })()
      }
    </div>}
  </div>
}

function ModoAoVivo({ imovel, onClose }) {
  const s = imovel
  const rec = s.recomendacao
  const recClr = rec === 'COMPRAR' ? C.emerald : rec === 'AGUARDAR' ? C.mustard : RED
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'#0A1628', color:'#fff',
      display:'flex', flexDirection:'column',
      padding:'24px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.5)',
            textTransform:'uppercase', letterSpacing:'1px' }}>Modo Ao Vivo — AXIS</p>
          <p style={{ margin:'2px 0 0', fontSize:14, fontWeight:600, color:'#fff' }}>
            {s.titulo || s.endereco}
          </p>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none',
          color:'rgba(255,255,255,0.6)', fontSize:24, cursor:'pointer' }}>×</button>
      </div>
      <div style={{ textAlign:'center', padding:'20px 0' }}>
        <p style={{ margin:0, fontSize:72, fontWeight:900, color:recClr,
          lineHeight:1 }}>
          {s.score_total?.toFixed(2) || '—'}
        </p>
        <p style={{ margin:'4px 0 0', fontSize:18, fontWeight:700, color:recClr }}>
          {rec || 'AGUARDAR'}
        </p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, flex:1 }}>
        {[
          [isMercadoDireto(s.fonte_url,s.tipo_transacao)?'💰 Preço pedido':'💰 Lance mínimo',
            (isMercadoDireto(s.fonte_url,s.tipo_transacao)?(s.preco_pedido||s.valor_minimo):s.valor_minimo)
            ? `R$ ${Number(isMercadoDireto(s.fonte_url,s.tipo_transacao)?(s.preco_pedido||s.valor_minimo):s.valor_minimo).toLocaleString('pt-BR')}` : '—'],
          ['💸 Desconto', s.desconto_percentual ? `${s.desconto_percentual}%` : '—'],
          ['⚖️ Jurídico', `${s.score_juridico?.toFixed(1) || '—'}/10`],
          ['🏠 Ocupação', s.ocupacao || 'Verificar'],
          ['📍 Localização', `${s.score_localizacao?.toFixed(1) || '—'}/10`],
          ['💡 Custo total', (()=>{const pr=parseFloat(isMercadoDireto(s.fonte_url,s.tipo_transacao)?(s.preco_pedido||s.valor_minimo):s.valor_minimo)||0;const mult=isMercadoDireto(s.fonte_url,s.tipo_transacao)?1.035:1.075;return pr?`R$ ${Math.round(pr*mult/1000)}k est.`:'—'})()],
        ].map(([label, val]) => (
          <div key={label} style={{ background:'rgba(255,255,255,0.08)',
            borderRadius:10, padding:'12px 14px' }}>
            <p style={{ margin:'0 0 2px', fontSize:11,
              color:'rgba(255,255,255,0.5)' }}>{label}</p>
            <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#fff' }}>{val}</p>
          </div>
        ))}
      </div>
      {s.alertas?.length > 0 && (
        <div style={{ marginTop:12, padding:'10px 14px',
          background:'rgba(229,72,77,0.15)', borderRadius:8,
          borderLeft:'3px solid #E5484D' }}>
          <p style={{ margin:'0 0 4px', fontSize:10, color:'#E5484D',
            fontWeight:700, textTransform:'uppercase' }}>⚠️ Alertas</p>
          {s.alertas.slice(0,2).map((a,i) => (
            <p key={i} style={{ margin:'2px 0', fontSize:11,
              color:'rgba(255,255,255,0.8)' }}>• {normalizarTextoAlerta(a)}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function AbaArremates({ imovel }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [doCache, setDoCache] = useState(false)

  // Carregar cache ao montar — sem custo de API
  useEffect(() => {
    if (!imovel?.id) return
    carregarCacheArremates(imovel.id).then(cache => {
      if (cache) {
        setDados(cache)
        setDoCache(true)
        const diasAtras = Math.floor((Date.now() - new Date(cache._cache_em)) / (1000*60*60*24))
        setMsg(`📦 Cache carregado (${diasAtras === 0 ? 'hoje' : diasAtras + 'd atrás'} · ${cache._modelo || 'IA'})`)
      }
    }).catch(() => {})
  }, [imovel?.id])

  const buscar = async () => {
    const openaiKey = localStorage.getItem('axis-openai-key') || ''
    const geminiKey = localStorage.getItem('axis-gemini-key') || ''
    if (!openaiKey && !geminiKey) { setMsg('Configure OpenAI ou Gemini em Admin → API Keys'); return }
    setLoading(true); setMsg('Pesquisando arremates similares...')
    try {
      const res = await buscarArrematesSimilares(imovel, openaiKey, geminiKey)
      if (res) { setDados(res); setDoCache(false); setMsg(`✅ ${res.n_amostras || res.arremates?.length || 0} arremates encontrados via ${res._modelo} · salvo no banco`) }
      else setMsg('Nenhum arrematado similar encontrado.')
    } catch(e) { setMsg('Erro: ' + e.message) }
    setLoading(false)
  }

  const fmt = v => v ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : '—'

  return (
    <div style={{padding:'12px 0'}}>
      <div style={{...card(), padding:14, marginBottom:12}}>
        <div style={{fontSize:13, fontWeight:600, color:C.navy, marginBottom:6}}>Arremates Similares</div>
        <div style={{fontSize:11, color:C.muted, marginBottom:10}}>
          Pesquisa histórico de arremates de imóveis similares para calibrar o lance.
        </div>
        <button onClick={buscar} disabled={loading} style={{
          ...btn('s'), background:C.navy, color:'#fff', border:'none', opacity:loading?0.6:1
        }}>
          {loading ? '🔍 Pesquisando...' : doCache ? '🔄 Atualizar (nova busca)' : '🔨 Buscar arremates similares'}
        </button>
        {msg && <div style={{fontSize:11, marginTop:8, color: msg.includes('✅') ? C.emerald : C.muted}}>{msg}</div>}
      </div>

      {dados && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12}}>
            {[
              ['Média', `${dados.media_pct_avaliacao?.toFixed(1)}% da avaliação`],
              ['Faixa', dados.faixa_pct || '—'],
              ['Amostras', dados.n_amostras || dados.arremates?.length || 0],
            ].map(([l,v]) => (
              <div key={l} style={{...card(), padding:'10px 12px', textAlign:'center'}}>
                <div style={{fontSize:10, color:C.hint}}>{l}</div>
                <div style={{fontSize:13, fontWeight:700, color:C.navy}}>{v}</div>
              </div>
            ))}
          </div>

          {dados.mao_sugerido > 0 && (
            <div style={{...card(), padding:12, marginBottom:12, background:`${C.emerald}08`, border:`1px solid ${C.emerald}20`}}>
              <div style={{fontSize:11, fontWeight:600, color:C.emerald}}>MAO sugerido baseado em arremates reais</div>
              <div style={{fontSize:18, fontWeight:800, color:C.emerald}}>{fmt(dados.mao_sugerido)}</div>
              <div style={{fontSize:10, color:C.muted}}>{dados.mao_base}</div>
            </div>
          )}

          {dados.arremates?.map((a, i) => (
            <div key={i} style={{...card(), padding:12, marginBottom:8}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4}}>
                <div style={{flex:1, minWidth:0}}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer"
                      style={{fontSize:12, fontWeight:600, color:C.navy, textDecoration:'none', display:'flex', alignItems:'center', gap:4}}>
                      <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{a.descricao}</span>
                      <span style={{fontSize:9, color:C.teal, flexShrink:0}}>↗</span>
                    </a>
                  ) : (
                    <span style={{fontSize:12, fontWeight:600, color:C.navy}}>{a.descricao}</span>
                  )}
                </div>
                <span style={{fontSize:11, fontWeight:700, color:C.emerald, flexShrink:0, marginLeft:8}}>{fmt(a.valor_arrematado)}</span>
              </div>
              <div style={{fontSize:10, color:C.muted}}>
                {a.pct_avaliacao?.toFixed(1)}% da avaliação ({fmt(a.valor_avaliacao)}) · {a.data}
                {a.fonte && !a.fonte.includes('XYZ') && !a.fonte.includes('ABC') && !a.fonte.includes('DEF')
                  ? ` · ${a.fonte}`
                  : <span style={{color:C.mustard}}> · estimativa IA</span>}
              </div>
            </div>
          ))}

          {dados._modelo && (
            <div style={{padding:'8px 12px', borderRadius:6, background:'#FEF9C3', border:'1px solid #FDE68A', fontSize:10, color:'#92400E', marginBottom:8}}>
              ⚠️ Dados estimados por IA ({dados._modelo}). Nomes de leiloeiros e valores são aproximações baseadas em mercado — não são registros oficiais. Confirme em sites de leiloeiros credenciados (suporteleiloes.com.br, saraivaleiloes.com.br).
            </div>
          )}

          {dados.observacoes && (
            <div style={{...card(), padding:12, fontSize:11, color:C.muted}}>{dados.observacoes}</div>
          )}
        </>
      )}
    </div>
  )
}

export default function Detail({p,onDelete,onNav,trello,onUpdateProp,onReanalyze,isAdmin,onArchive,isMobile,isPhone}) {
  const [sending,setSending]=useState(false)
  const [modoAoVivo, setModoAoVivo]=useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [shareStatus, setShareStatus] = useState(null)
  const [msg,setMsg]=useState("")
  const [abaDetalhe,setAbaDetalhe]=useState('resumo')
  const [reanalyzing,setReanalyzing]=useState(false)
  const [reStep,setReStep]=useState("")
  const [obs, setObs] = useState([])
  const [novaObs, setNovaObs] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [avaliacoes, setAvaliacoes] = useState([])
  const [minhaAvaliacao, setMinhaAvaliacao] = useState(null)
  const [oportunidadesLeilao, setOportunidadesLeilao] = useState([])

  useEffect(() => {
    if (!p?.id) return
    import('../lib/supabase.js').then(({ getObservacoes, getAvaliacoes }) => {
      getObservacoes(p.id).then(setObs).catch(() => {})
      getAvaliacoes(p.id).then(setAvaliacoes).catch(() => {})
    })
  }, [p?.id])

  // Buscar oportunidades melhores (leilão + mercado mais barato)
  useEffect(() => {
    if (!p?.id) return
    const tipo = (p.tipo || p.tipologia || 'apartamento').toLowerCase()
    const area = parseFloat(p.area_privativa_m2 || p.area_m2) || 0
    const precoRef = parseFloat(p.preco_pedido || p.valor_minimo) || 0
    const eMercado = isMercadoDireto(p.fonte_url, p.tipo_transacao)
    import('../lib/supabase.js').then(async ({ supabase: sb }) => {
      try {
        // Buscar todos os imóveis ativos (não filtrar por cidade — buscar regional MG)
        const { data } = await sb.from('imoveis')
          .select('id,titulo,bairro,cidade,area_m2,area_privativa_m2,quartos,vagas,valor_minimo,valor_avaliacao,preco_m2_imovel,score_total,recomendacao,foto_principal,fonte_url,tipo_transacao,num_leilao,praca,data_leilao,desconto_percentual,preco_pedido,status_operacional')
          .neq('id', p.id)
          .gt('valor_minimo', 0)
          .not('status_operacional', 'in', '("arquivado","arrematado","vendido")')
          .order('score_total', { ascending: false })
          .limit(50)
        if (!data?.length) return
        const scored = data.map(im => {
          let sim = 0
          const areaIm = parseFloat(im.area_privativa_m2 || im.area_m2) || 0
          const tipoIm = (im.titulo || '').toLowerCase()
          const precoIm = parseFloat(im.preco_pedido || im.valor_minimo) || 0
          // Mesmo tipo? (+3)
          if (tipo.includes('apart') && tipoIm.includes('apart')) sim += 3
          else if (tipo.includes('casa') && tipoIm.includes('casa')) sim += 3
          // Área similar ±40%? (+2)
          if (area > 0 && areaIm > 0 && Math.abs(areaIm - area) / area < 0.40) sim += 2
          // Mesmos quartos? (+2)
          if (p.quartos && im.quartos && parseInt(p.quartos) === parseInt(im.quartos)) sim += 2
          // Mesma cidade? (+2) ou RMBH (+1)
          const cidadeIm = (im.cidade || '').toLowerCase()
          const cidadeP = (p.cidade || '').toLowerCase()
          if (cidadeIm === cidadeP) sim += 2
          else if (['belo horizonte','contagem','betim','nova lima','santa luzia','sabará','ribeirão das neves'].some(c => cidadeIm.includes(c))) sim += 1
          // Preço menor? (+2 se leilão, +1 se mercado)
          if (precoIm < precoRef) {
            sim += !isMercadoDireto(im.fonte_url, im.tipo_transacao) ? 2 : 1
          }
          // Score alto? (+1)
          if ((im.score_total || 0) >= 7) sim += 1
          // Economia
          const economia = precoRef - precoIm
          // Tag: leilão ou mercado (usar isMercadoDireto para consistência)
          const isLeilao = !isMercadoDireto(im.fonte_url, im.tipo_transacao)
          return { ...im, _similaridade: sim, _economia: economia, _area: areaIm, _isLeilao: isLeilao }
        })
        .filter(im => im._similaridade >= 4 && im._economia > 0) // mínimo 4 pontos e mais barato
        .sort((a, b) => b._similaridade - a._similaridade || b._economia - a._economia)
        .slice(0, 5)
        setOportunidadesLeilao(scored)
      } catch(e) { console.warn('[AXIS] Oportunidades:', e.message) }
    })
  }, [p?.id, p?.fonte_url, p?.tipo_transacao])

  // Enriquecer aba Mercado com dados reais do banco quando disponível
  useEffect(() => {
    if (!p?.bairro && !p?.cidade) return
    import('../lib/supabase.js').then(({ supabase: sb }) => {
      sb.from('metricas_bairros')
        .select('preco_anuncio_m2, preco_contrato_m2, yield_bruto, tendencia_12m, classe_ipead')
        .ilike('bairro', `%${(p.bairro||'').trim()}%`)
        .single()
        .then(({ data }) => {
          if (data && onUpdateProp) {
            const enriched = {
              ...p,
              preco_m2_mercado: p.preco_m2_mercado || data.preco_anuncio_m2 || data.preco_contrato_m2,
              yield_bruto_pct: p.yield_bruto_pct || data.yield_bruto,
            }
            if (enriched.preco_m2_mercado !== p.preco_m2_mercado) {
              // só atualiza UI, não persiste
            }
          }
        }).catch(() => {})
    })
  }, [p?.bairro])

  // Auto-buscar fotos — roda só 1x por imóvel (ref previne loop quando onUpdateProp re-renderiza)
  const autoFotosBuscado = useRef(new Set())
  useEffect(() => {
    if (!p?.fonte_url || (p?.fotos?.length > 0)) return
    if (autoFotosBuscado.current.has(p.id)) return
    autoFotosBuscado.current.add(p.id)
    const timer = setTimeout(async () => {
      try {
        const { buscarFotosImovel } = await import('../lib/buscadorFotos.js')
        const geminiKey = localStorage.getItem('axis-gemini-key') || ''
        const resultado = await buscarFotosImovel({ fonte_url: p.fonte_url, id: p.id }, geminiKey)
        if (resultado.fotos?.length > 0 || resultado.foto_principal) {
          if (onUpdateProp) onUpdateProp(p.id, { ...p, fotos: resultado.fotos, foto_principal: resultado.foto_principal })
          const { saveImovelCompleto } = await import('../lib/supabase.js')
          const { data: { session } } = await supabase.auth.getSession()
          saveImovelCompleto({ ...p, fotos: resultado.fotos, foto_principal: resultado.foto_principal }, session?.user?.id).catch(() => {})
        }
      } catch(e) { /* silencioso */ }
    }, 2000)
    return () => clearTimeout(timer)
  }, [p?.id])

  const salvarObs = async () => {
    if (!novaObs.trim()) return
    setSalvandoObs(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { saveObservacao } = await import('../lib/supabase.js')
      const nova = await saveObservacao({ imovel_id: p.id, texto: novaObs.trim(), user_id: user?.id })
      setObs(prev => [nova, ...prev])
      setNovaObs('')
    } catch(e) { console.error('[AXIS obs]', e.message) }
    setSalvandoObs(false)
  }

  const handleReanalyze=async()=>{
    if(!p?.fonte_url){setMsg("⚠️ Imóvel sem URL de origem para reanalisar");return}
    // Buscar chaves — localStorage primeiro, banco como fallback
    let geminiKey = localStorage.getItem("axis-gemini-key") || ""
    let claudeKey = localStorage.getItem("axis-api-key") || ""
    // Sempre sincronizar chaves do banco — garante funcionamento em qualquer dispositivo
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { loadApiKeys } = await import('../lib/supabase.js')
        const keys = await loadApiKeys(user.id)
        // Sobrescrever localStorage com banco (banco é fonte da verdade)
        if (keys.geminiKey) { geminiKey = keys.geminiKey; localStorage.setItem('axis-gemini-key', geminiKey) }
        if (keys.claudeKey) { claudeKey = keys.claudeKey; localStorage.setItem('axis-api-key', claudeKey) }
        if (keys.openaiKey) localStorage.setItem('axis-openai-key', keys.openaiKey)
        if (keys.deepseekKey) localStorage.setItem('axis-deepseek-key', keys.deepseekKey)
      }
    } catch(e) { console.warn('[AXIS] Sync chaves do banco:', e.message) }
    if(!geminiKey && !claudeKey){setMsg("⚠️ Configure ao menos a Gemini API Key em Admin → API Keys");return}
    // Verificar permissão de uso da API
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase.from('profiles').select('pode_usar_api, role').eq('id', user.id).single()
        const podeUsar = perfil?.role === 'admin' || perfil?.pode_usar_api === true
        if (!podeUsar) { setMsg('⚠️ Acesso à análise por IA não liberado. Solicite ao administrador.'); return }
      }
    } catch (e) { console.warn('[AXIS] Verificação pode_usar_api:', e.message) }
    if(!confirm("Reanalisar este imóvel com a IA? Os dados serão atualizados.")) return
    setReanalyzing(true);setMsg("")
    try {
      const openaiKey=localStorage.getItem("axis-openai-key")||""
      let novaAnalise
      // Cascata: Gemini (~$0.002) → Claude Sonnet (fallback)
      if (geminiKey) {
        try {
          setReStep("Reanalisando com Gemini Flash-Lite (custo ~R$ 0,01)...")
          const { reAnalisarComGemini } = await import("../lib/agenteReanalise.js")
          novaAnalise = await reAnalisarComGemini(p, geminiKey, [], setReStep)
          setReStep("✅ Reanálise Gemini concluída")
        } catch(geminiErr) {
          console.warn("[AXIS] Gemini reanálise falhou, usando Claude:", geminiErr.message)
          setReStep("Gemini falhou, usando Claude Sonnet...")
          if (!claudeKey) throw new Error("Gemini e Claude indisponíveis. Configure as chaves em API Keys.")
          const { analisarImovelCompleto: _motorIAFn } = await import("../lib/motorIA.js")
          novaAnalise = await _motorIAFn(p.fonte_url, claudeKey, openaiKey, [], [], setReStep, [], p.id, p.titulo)
        }
      } else {
        // Sem Gemini — usar Claude
        const { analisarImovelCompleto: _motorIAFn } = await import("../lib/motorIA.js")
          novaAnalise = await _motorIAFn(p.fonte_url, claudeKey, openaiKey, [], [], setReStep, [], p.id, p.titulo)
      }
      // Proteger campos críticos: nunca sobrescrever com null/0 se já tinhamos valor
      const protegerCampos = (original, novo) => {
        const camposCriticos = ['valor_minimo','valor_avaliacao','titulo','fotos','comparaveis',
          'score_total','score_localizacao','score_desconto','score_juridico','score_ocupacao',
          'score_liquidez','score_mercado','recomendacao','codigo_axis','endereco','bairro']
        // Campos que nunca devem ser sobrescritos com zero (zero = dado inválido)
        const camposNuncaZero = ['valor_minimo','valor_avaliacao','desconto_percentual',
          'preco_m2_mercado','preco_m2_imovel','aluguel_mensal_estimado',
          'valor_mercado_estimado','num_leilao']
        const merged = {...original, ...novo}
        for (const campo of camposCriticos) {
          if ((novo[campo] === null || novo[campo] === undefined || novo[campo] === 0 || novo[campo] === '') && original[campo]) {
            merged[campo] = original[campo]
          }
        }
        for (const campo of camposNuncaZero) {
          if ((novo[campo] === 0 || novo[campo] === null || novo[campo] === undefined || novo[campo] === '') && original[campo] && original[campo] !== 0) {
            merged[campo] = original[campo]
          }
        }
        // Fotos e comparáveis: só sobrescrever se o novo tiver mais dados
        if ((!novo.fotos || novo.fotos.length === 0) && original.fotos?.length > 0) merged.fotos = original.fotos
        // Manter comparáveis existentes se novo tem menos ou tipo errado (terreno em vez de apt)
if (original.comparaveis?.length > 2) {
  const novosOk = (novo.comparaveis || []).filter(c => c.link && c.tipo !== 'terreno' && c.tipo !== 'lote' && c.tipo?.toLowerCase() !== 'terreno')
  const atuaisOk = original.comparaveis.filter(c => c.link)
  if (!novo.comparaveis?.length || novosOk.length < atuaisOk.length) {
    merged.comparaveis = original.comparaveis
  }
}
// Proteção de scores no merge: não deixar degradar > 2.5 pontos
const SCORES = ['score_localizacao','score_desconto','score_juridico','score_ocupacao','score_liquidez','score_mercado']
for (const s of SCORES) {
  if (original[s] != null && novo[s] != null) {
    if (Math.abs(parseFloat(novo[s]) - parseFloat(original[s])) > 2.5) {
      merged[s] = original[s]
    }
  }
}
        return merged
      }
      // NUNCA salvar dados de modo_teste no banco
      if (novaAnalise.modo_teste === true) {
        setReanalyzing(false)
        setMsg('⚠️ Modo Teste ativo — desative em Admin → Config antes de reanalisar.')
        return
      }
      // Verificar qualidade da análise retornada
      const modeloUsado = novaAnalise._modelo_usado || ''
      if (modeloUsado === 'regex_fallback') {
        // Na reanálise, regex_fallback significa que Gemini falhou mas preservou dados do banco
        // Ainda assim avisar o usuário mas NÃO bloquear (dados preservados são válidos)
        setMsg('⚠️ Gemini não respondeu — dados anteriores preservados. Configure a chave Gemini para reanálise completa.')
        // Continuar salvamento com dados preservados (não bloqueio total)
      }
      const merged={...protegerCampos(p, novaAnalise),id:p.id,createdAt:p.createdAt,criado_por:p.criado_por}
      if(onUpdateProp) onUpdateProp(p.id,merged)
      // Salvar no Supabase — buscar session corretamente
      try {
        const { data:{ session:sess } } = await supabase.auth.getSession()
        const { saveImovelCompleto } = await import('../lib/supabase.js')
        await saveImovelCompleto(merged, sess?.user?.id)
        const modeloUsado = novaAnalise._modelo_usado || 'desconhecido'
        const avisoModelo = modeloUsado.includes('fallback') ? ' (análise parcial — Gemini indisponível, configure a chave)' : ''
        setMsg(`✅ Imóvel reanalisado e salvo!${avisoModelo}`)
        // Após reanálise, ir para a aba jurídico para facilitar busca de documentos
        if (!merged.num_documentos || merged.num_documentos === 0) {
          setTimeout(() => setMsg('💡 Vá em Jurídico → Documentos para baixar e analisar o edital e matrícula.'), 2500)
        }
        try {
          const { logAtividade } = await import('../lib/supabase.js')
          const { data:{ session: sess2 } } = await supabase.auth.getSession()
          if (sess2?.user?.id) logAtividade(sess2.user.id, 'reanalise', 'imovel', p.id, { titulo: p.titulo })
        } catch(e) { console.warn("[AXIS Detail]", e.message?.substring(0,60)) }
      } catch(saveErr) {
        console.warn('[AXIS] Salvar reanálise:', saveErr.message)
        setMsg("✅ Reanalisado! (sync nuvem falhou — tente novamente)")
      }
    } catch(e) {
      const msg = e.message || ''
      if (msg.includes('Créditos esgotados') || msg.includes('402')) {
        setMsg('⚠️ Créditos Claude esgotados — recarregue em console.anthropic.com')
      } else if (msg.includes('Chave inválida') || msg.includes('401')) {
        setMsg('⚠️ Créditos Claude esgotados. Clique em "Reanalisar (Gemini)" para usar Gemini grátis.')
      } else if (msg.includes('Timeout') || msg.includes('AbortError')) {
        setMsg('⚠️ Timeout — o imóvel pode ser complexo. Tente novamente.')
      } else if (msg.includes('URL') || msg.includes('fetch')) {
        setMsg('⚠️ URL inacessível — o site do edital pode estar fora do ar')
      } else {
        setMsg(`⚠️ Erro: ${msg}`)
      }
    }
    setReanalyzing(false);setReStep("")
  }
  if(!p) return <div style={{padding:"40px",textAlign:"center",color:K.t3}}>Não encontrado</div>
  const sc=p.score_total||0, rc=recColor(p.recomendacao)
  const scores=[
    {l:"Localização",v:p.score_localizacao,w:"20%"},{l:"Desconto",v:p.score_desconto,w:"18%"},
    {l:"Jurídico",v:p.score_juridico,w:"18%"},{l:"Ocupação",v:p.score_ocupacao,w:"15%"},
    {l:"Liquidez",v:p.score_liquidez,w:"15%"},{l:"Mercado",v:p.score_mercado,w:"14%"},
  ]
  const sendTrello=async()=>{
    if(!trello?.listId){setMsg("Trello não configurado");return}
    setSending(true);setMsg("")
    try {
      if(trello.boardId) { const { criarCardImovel: _criarCardFn } = await import("../lib/trelloService.js")
      const res=await _criarCardFn(p,trello.listId,trello.boardId,trello.key,trello.token); setMsg(res?.atualizado?"✓ Card atualizado no Trello!":"✓ Card enviado ao Trello com etiquetas!") }
      else { const cd=buildTrelloCard(p); await tPost("/cards",trello.key,trello.token,{idList:trello.listId,name:cd.name,desc:cd.desc}); setMsg("✓ Card enviado ao Trello!") }
    } catch(e){setMsg(`Erro: ${e.message}`)}
    setSending(false)
  }
  return <div>
    <Hdr title={<>{formatTitulo(p)}{p.codigo_axis&&<span style={{fontSize:"10.5px",fontWeight:700,padding:"2px 8px",borderRadius:4,background:"#002B8010",color:"#002B80",border:"1px solid #002B8020",fontFamily:"monospace",letterSpacing:"0.5px",marginLeft:10,verticalAlign:"middle"}}>{p.codigo_axis}</span>}{(p.praca||p.num_leilao)&&!isMercadoDireto(p.fonte_url,p.tipo_transacao)&&<span style={{display:"inline-block",background:(p.praca||p.num_leilao)>=2?"#FEF3C7":"#ECFDF5",color:(p.praca||p.num_leilao)>=2?"#D97706":"#065F46",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,marginLeft:6,verticalAlign:"middle"}}>{p.praca?`${p.praca}ª PRAÇA`:`${p.num_leilao}º LEILÃO`}{p.valor_minimo&&p.valor_avaliacao?` · mín. ${Math.round(p.valor_minimo/p.valor_avaliacao*100)}%`:(p.praca||p.num_leilao)>=2?" · mín. 35%":""}</span>}
      {isMercadoDireto(p.fonte_url,p.tipo_transacao)&&<span style={{display:"inline-block",background:"#FFFBEB",color:"#92400E",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:4,marginLeft:6,verticalAlign:"middle"}}>🏠 MERCADO DIRETO</span>}{p.trello_card_url&&<a href={p.trello_card_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#0052CC",marginLeft:8,verticalAlign:"middle",textDecoration:"none"}}>Trello</a>}</>} sub={`${[p.bairro, `${p.cidade}/${p.estado}`].filter(Boolean).join(' · ')} · ${fmtD(p.createdAt)}`}
      actions={<>
        {p.fonte_url&&<a href={p.fonte_url} target="_blank" rel="noopener noreferrer" title={isMercadoDireto(p.fonte_url,p.tipo_transacao)?"Abrir anúncio no portal":"Abrir edital original no portal do leiloeiro"} style={{...btn("s"),textDecoration:"none",display:"inline-block",background:`${C.blue}08`,color:C.blue,border:`1px solid ${C.blue}30`}}>{isMercadoDireto(p.fonte_url,p.tipo_transacao)?'🔗 Anúncio':'🔗 Edital'}</a>}
        {isAdmin&&<>
              <button style={{...btn("s"),background:`${K.amb}15`,color:K.amb,border:`1px solid ${K.amb}30`}} onClick={handleReanalyze} disabled={reanalyzing}>
                {reanalyzing?`⏳ ${reStep||'Reanalisando...'}`:
                  localStorage.getItem("axis-gemini-key")?"🤖 Reanalisar (Gemini)":
                  localStorage.getItem("axis-api-key")?"🔄 Reanalisar (Claude)":"🔄 Reanalisar"}
              </button>
            </>}
        {isAdmin&&<button style={btn("trello")} onClick={sendTrello} disabled={sending}>{sending?"Enviando...":"🔷 Trello"}</button>}
        {/* Share/Export menu */}
        <div style={{position:'relative',display:'inline-block'}}>
          <button onClick={() => setShowShareMenu(!showShareMenu)}
            style={{...btn("s"),background:'#7C3AED12',color:'#7C3AED',border:'1px solid #7C3AED30'}}>
            📤 Relatório
          </button>
          {showShareMenu && <>
            <div onClick={() => setShowShareMenu(false)} style={{position:'fixed',inset:0,zIndex:40,background:isPhone?'rgba(0,0,0,0.3)':'transparent'}} />
            <div style={isPhone?{position:'fixed',bottom:0,left:0,right:0,zIndex:50,background:C.white,borderRadius:'16px 16px 0 0',
              boxShadow:'0 -8px 30px rgba(0,0,0,0.2)',padding:'6px 6px 20px',maxHeight:'70vh',overflowY:'auto'}
              :{position:'absolute',top:'100%',right:0,zIndex:50,marginTop:4,background:C.white,borderRadius:10,
              border:`1px solid ${C.borderW}`,boxShadow:'0 8px 30px rgba(0,0,0,0.15)',padding:6,minWidth:210}}>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button onClick={async () => {
                  const { compartilharRelatorio } = await import('./ExportarPDF.jsx')
                  setShareStatus('⏳')
                  const r = await compartilharRelatorio(p)
                  setShareStatus(r === 'shared' ? '✅ Enviado!' : r === 'cancelled' ? '' : '📥 Baixado!')
                  setTimeout(() => { setShareStatus(null); setShowShareMenu(false) }, 1500)
                }} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',
                  border:'none',background:'none',cursor:'pointer',borderRadius:8,fontSize:13,color:C.navy,fontWeight:600,
                  textAlign:'left'}}>
                  <span style={{fontSize:18}}>📱</span>
                  <div><div>Compartilhar</div><div style={{fontSize:10,color:C.muted,fontWeight:400}}>WhatsApp, Email, Telegram...</div></div>
                </button>
              )}
              <button onClick={async () => {
                setShareStatus('⏳ Gerando PDF...')
                try {
                  const { gerarPDFProfissional } = await import('./GerarPDFProfissional.jsx')
                  await gerarPDFProfissional(p, status => setShareStatus(`⏳ ${status}`))
                  setShareStatus('📥 PDF gerado!')
                } catch(e) { console.error('[AXIS PDF]', e); setShareStatus('❌ Erro') }
                setTimeout(() => { setShareStatus(null); setShowShareMenu(false) }, 2000)
              }} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',
                border:'none',background:'#F0F4FF',cursor:'pointer',borderRadius:8,fontSize:13,color:C.navy,fontWeight:600,
                textAlign:'left'}}>
                <span style={{fontSize:18}}>📄</span>
                <div><div>PDF Profissional</div><div style={{fontSize:10,color:C.muted,fontWeight:400}}>6 páginas · envio WhatsApp</div></div>
              </button>
              <button onClick={async () => {
                const { downloadRelatorio } = await import('./ExportarPDF.jsx')
                await downloadRelatorio(p)
                setShareStatus('📥 Baixado!')
                setTimeout(() => { setShareStatus(null); setShowShareMenu(false) }, 1500)
              }} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',
                border:'none',background:'none',cursor:'pointer',borderRadius:8,fontSize:13,color:C.navy,fontWeight:600,
                textAlign:'left'}}>
                <span style={{fontSize:18}}>📊</span>
                <div><div>Baixar Relatório</div><div style={{fontSize:10,color:C.muted,fontWeight:400}}>HTML interativo com abas</div></div>
              </button>
              <button onClick={async () => {
                const { exportarPDFImovel } = await import('./ExportarPDF.jsx')
                exportarPDFImovel(p)
                setShowShareMenu(false)
              }} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',
                border:'none',background:'none',cursor:'pointer',borderRadius:8,fontSize:13,color:C.navy,fontWeight:600,
                textAlign:'left'}}>
                <span style={{fontSize:18}}>🖨️</span>
                <div><div>Imprimir / PDF</div><div style={{fontSize:10,color:C.muted,fontWeight:400}}>Salvar como PDF pelo navegador</div></div>
              </button>
              <button onClick={() => {
                import('../lib/supabase.js').then(({ exportarAnaliseJSON }) => { exportarAnaliseJSON(p) })
                setShowShareMenu(false)
              }} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',
                border:'none',background:'none',cursor:'pointer',borderRadius:8,fontSize:13,color:'#666',
                textAlign:'left',borderTop:`1px solid ${C.borderW}`}}>
                <span style={{fontSize:16}}>{'{ }'}</span>
                <div><div>Dados JSON</div><div style={{fontSize:10,color:C.muted}}>Dados completos</div></div>
              </button>
              {/* Sprint 11: Adicionar ao Calendário */}
              {p.data_leilao && !isMercadoDireto(p.fonte_url, p.tipo_transacao) && (
                <button onClick={() => {
                  const [y,m,d] = p.data_leilao.split('-')
                  const dtStart = `${y}${m}${d}T090000`
                  const dtEnd = `${y}${m}${d}T170000`
                  const titulo = encodeURIComponent(`🔨 Leilão ${p.codigo_axis || ''} — ${p.titulo?.substring(0,40) || 'Imóvel'}`)
                  const desc = encodeURIComponent(`${p.praca ? p.praca+'ª Praça' : 'Leilão'} · Lance mín: R$ ${Math.round(p.valor_minimo||0).toLocaleString('pt-BR')}\nLeiloeiro: ${p.leiloeiro || '—'}\n${p.fonte_url || ''}`)
                  const loc = encodeURIComponent(`${p.endereco || ''} ${p.bairro || ''}, ${p.cidade || ''} ${p.estado || ''}`)
                  window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${dtStart}/${dtEnd}&details=${desc}&location=${loc}`, '_blank')
                  setShowShareMenu(false)
                }} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',
                  border:'none',background:'none',cursor:'pointer',borderRadius:8,fontSize:13,color:C.navy,fontWeight:600,
                  textAlign:'left'}}>
                  <span style={{fontSize:18}}>📅</span>
                  <div><div>Adicionar ao Calendário</div><div style={{fontSize:10,color:C.muted,fontWeight:400}}>Google Calendar · {p.data_leilao ? new Date(p.data_leilao+'T12:00').toLocaleDateString('pt-BR') : ''}</div></div>
                </button>
              )}
              {shareStatus && (
                <div style={{padding:'6px 12px',textAlign:'center',fontSize:12,fontWeight:600,color:'#065F46'}}>{shareStatus}</div>
              )}
            </div>
          </>}
        </div>
        <button onClick={() => setModoAoVivo(true)} style={{
          padding:'5px 12px', borderRadius:8, background:'#E5484D', color:'#fff',
          border:'none', fontSize:11.5, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#fff', display:'inline-block', animation:'pulse 1s infinite' }} />
          Ao Vivo
        </button>
        {isAdmin&&onArchive&&<button style={{...btn("s"),background:`${C.mustardL}`,color:C.mustard,border:`1px solid ${C.mustard}40`}} onClick={()=>onArchive(p.id)}>📦 Arquivar</button>}
        {isAdmin&&<button style={{...btn("s"),background:'#EBF4FF',color:'#002B80',border:'1px solid #002B8030',fontSize:11.5,fontWeight:600}}
          onClick={async()=>{
            try {
              const { criarLinkPublico } = await import('../lib/supabase.js')
              const { data:{session} } = await supabase.auth.getSession()
              const result = await criarLinkPublico(p.id, session?.user?.id)
              const url = `${window.location.origin}/#/share/${result.token}`
              await navigator.clipboard.writeText(url)
              setShareStatus(`🔗 Link copiado! Válido por 30 dias.`)
              setTimeout(() => setShareStatus(null), 5000)
            } catch(e){ setShareStatus(`❌ Erro: ${e.message}`); setTimeout(() => setShareStatus(null), 5000) }
          }}>🔗 Compartilhar</button>}
        {isAdmin&&<button style={{...btn("d"),padding:"5px 12px",fontSize:"12px"}} onClick={()=>{if(confirm("Excluir?"))onDelete(p.id)}}>🗑</button>}
      </>}/>
    {/* Banner pós-leilão — aparece quando data passou e imóvel ainda está ativo */}
    {!isMercadoDireto(p.fonte_url, p.tipo_transacao) && p.data_leilao && (() => {
      const [y,m,d] = p.data_leilao.split('-').map(Number)
      const dl = new Date(y, m-1, d); dl.setHours(0,0,0,0)
      const hoje = new Date(); hoje.setHours(0,0,0,0)
      const diff = Math.round((dl - hoje) / 86400000)
      if (diff > 1) return null // ainda não é urgente
      const passou = diff < 0
      const amanha = diff === 0 // data_leilao é hoje (D-0) ou amanhã (D-1) — leilao_proximo
      if (!passou && diff > 0) return null
      return (
        <div style={{
          margin:'0 28px', marginTop:12,
          background: passou ? '#FEF3C7' : '#FEE2E2',
          border: `1px solid ${passou ? '#FCD34D' : '#FCA5A5'}`,
          borderRadius:10, padding:'12px 16px',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap'
        }}>
          <div>
            <div style={{fontWeight:700, fontSize:13, color: passou ? '#92400E' : '#991B1B'}}>
              {amanha ? '🚨 Leilão hoje!' : `⏰ Leilão foi em ${new Date(p.data_leilao+'T12:00').toLocaleDateString('pt-BR')} — qual foi o resultado?`}
            </div>
            <div style={{fontSize:11.5, color:'#78350F', marginTop:2}}>
              {amanha ? `Leilão agendado para hoje · ${p.modalidade_leilao||''}` : 'Registre o resultado para manter a carteira atualizada.'}
            </div>
          </div>
          {passou && isAdmin && (
            <div style={{display:'flex',gap:8,flexShrink:0}}>
              <button
                style={{...btn("s"),background:'#D1FAE5',color:'#065F46',border:'1px solid #6EE7B7',fontSize:12,fontWeight:700}}
                onClick={async () => {
                  if (!confirm('Confirmar: imóvel NÃO foi arrematado?')) return
                  try {
                    const { registrarResultadoLeilao } = await import('../lib/supabase.js')
                    const { data:{session} } = await supabase.auth.getSession()
                    await registrarResultadoLeilao(p.id, 'nao_arrematado', session?.user?.id)
                    if (onArchive) onArchive(p.id)
                  } catch(e) { alert('Erro: ' + e.message) }
                }}
              >Não arrematado</button>
              <button
                style={{...btn("s"),background:'#FEE2E2',color:'#991B1B',border:'1px solid #FCA5A5',fontSize:12,fontWeight:700}}
                onClick={async () => {
                  if (!confirm('Confirmar: imóvel foi ARREMATADO?')) return
                  try {
                    const { registrarResultadoLeilao } = await import('../lib/supabase.js')
                    const { data:{session} } = await supabase.auth.getSession()
                    await registrarResultadoLeilao(p.id, 'arrematado', session?.user?.id)
                    if (onArchive) onArchive(p.id)
                  } catch(e) { alert('Erro: ' + e.message) }
                }}
              >Arrematado</button>
            </div>
          )}
        </div>
      )
    })()}
    {/* Tabs */}
    <div style={{display:"flex",gap:isPhone?4:0,borderBottom:`1px solid ${K.bd}`,padding:isPhone?"0 16px":"0 28px",background:K.s1,overflowX:isPhone?'auto':'visible',scrollbarWidth:'none',WebkitOverflowScrolling:'touch',msOverflowStyle:'none'}}>
      {[{id:'resumo',label:'📊 Resumo',labelMobile:'📊'},{id:'juridico',label:'⚖️ Jurídico',labelMobile:'⚖️'},{id:'fotos',label:'📸 Fotos',labelMobile:'📸'},{id:'mercado',label:'🏙️ Mercado',labelMobile:'🏙️'},...(isAdmin&&!isMercadoDireto(p.fonte_url,p.tipo_transacao)?[{id:'arremates',label:'🔨 Arremates',labelMobile:'🔨 Arr.'}]:[])].map(tab=>(
        <button key={tab.id} onClick={()=>setAbaDetalhe(tab.id)} style={{
          background:"none",border:"none",padding:isPhone?"10px 12px":"10px 18px",fontSize:"12.5px",fontWeight:abaDetalhe===tab.id?700:500,whiteSpace:'nowrap',flexShrink:0,
          color:abaDetalhe===tab.id?K.teal:K.t3,cursor:"pointer",
          borderBottom:abaDetalhe===tab.id?`2px solid ${K.teal}`:"2px solid transparent",
          transition:"all 0.15s",
        }}>{isPhone&&tab.labelMobile?tab.labelMobile:tab.label}</button>
      ))}
    </div>
    <div style={{padding:isPhone?"16px":"20px 28px"}}>
      {msg&&<div style={{background: msg.includes('⚠️') || msg.includes('Erro') ? `${K.amb}10` : `${K.teal}10`, border:`1px solid ${msg.includes('⚠️') || msg.includes('Erro') ? K.amb : K.teal}30`,borderRadius:"6px",padding:"10px",marginBottom:"14px",fontSize:"12px",color: msg.includes('⚠️') || msg.includes('Erro') ? K.amb : K.teal, whiteSpace:"pre-line",lineHeight:1.5}}>{msg}</div>}
      {reanalyzing&&reStep&&<div style={{background:`${K.amb}10`,border:`1px solid ${K.amb}30`,borderRadius:"7px",padding:"12px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:K.amb,animation:"pulse 1s infinite",flexShrink:0}}/>
        <span style={{fontSize:"13px",color:K.amb,fontWeight:600}}>{reStep}</span>
      </div>}

      {abaDetalhe==='juridico'&&<Suspense fallback={<div style={{padding:24,textAlign:'center',color:'#999',fontSize:13}}>Carregando aba jurídica...</div>}><AbaJuridicaAgente imovel={p} isAdmin={isAdmin} onReclassificado={(novaAnalise)=>{
          if(onUpdateProp) onUpdateProp(p.id, novaAnalise)
        }}/></Suspense>}

      {abaDetalhe==='fotos'&&<GaleriaFotos 
          fotos={p.fotos||[]} 
          foto_principal={p.foto_principal} 
          url={p.fonte_url||p.url} 
          imovelId={p.id}
          isAdmin={isAdmin}
          onFotosAtualizadas={async (fotos, foto_principal) => {
            // Salvar fotos no banco
            try {
              const { saveImovelCompleto } = await import('../lib/supabase.js')
              const { data:{ session } } = await supabase.auth.getSession()
              await saveImovelCompleto({ ...p, fotos, foto_principal }, session?.user?.id)
              if (onUpdateProp) onUpdateProp(p.id, { ...p, fotos, foto_principal })
              setMsg('✅ Fotos salvas!')
            } catch(e) { console.warn('[AXIS] Salvar fotos:', e.message) }
          }}
        />}

      {abaDetalhe==='arremates'&&isAdmin&&<AbaArremates imovel={p}/>}
      {abaDetalhe==='mercado'&&<div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>🏙️ Mercado Regional</div>
          {[["Tendência",mapDisplay(p.mercado_tendencia),p.mercado_tendencia==="alta"||p.mercado_tendencia==="Alta"||p.mercado_tendencia==="crescimento"?K.grn:p.mercado_tendencia==="queda"||p.mercado_tendencia==="Queda"?"#E5484D":K.t2],["Demanda",mapDisplay(p.mercado_demanda),p.mercado_demanda==="alta"||p.mercado_demanda==="Alta"?K.grn:p.mercado_demanda==="baixa"||p.mercado_demanda==="Baixa"?"#E5484D":K.t2],["Tempo médio venda",p.mercado_tempo_venda_meses?`${p.mercado_tempo_venda_meses} meses`:"—",K.t2],["Preço/m² mercado",p.preco_m2_mercado?`R$ ${Math.round(p.preco_m2_mercado).toLocaleString('pt-BR')}/m²`:"—",K.teal],["Aluguel estimado",fmtC(p.aluguel_mensal_estimado)+"/mês",K.pur],["Obs. mercado",p.mercado_obs||"—",K.t2]].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
        {/* Dados AXIS — bairro calibrado */}
        {p._dados_bairro_axis && (
          <div style={{...card(),marginTop:14,background:'#F0F9FF',border:'1px solid #BAE6FD'}}>
            <div style={{fontWeight:600,color:'#0369A1',marginBottom:10,fontSize:13}}>📊 Dados AXIS — {p._dados_bairro_axis.label}</div>
            {[
              ['Classe IPEAD',`${p._dados_bairro_axis.classeIpead} — ${p._dados_bairro_axis.classeIpeadLabel}`,'#0369A1'],
              ['Zona',p._dados_bairro_axis.zona,'#0369A1'],
              ['Preço contrato (QA)',p._dados_bairro_axis.precoContratoM2?`R$ ${p._dados_bairro_axis.precoContratoM2.toLocaleString('pt-BR')}/m²`:'—',K.teal],
              ['Preço anúncio (FipeZAP)',p._dados_bairro_axis.precoAnuncioM2?`R$ ${p._dados_bairro_axis.precoAnuncioM2.toLocaleString('pt-BR')}/m²`:'—',K.t2],
              ['Yield bruto',p._dados_bairro_axis.yieldBruto?`${p._dados_bairro_axis.yieldBruto}% a.a.`:'—',p._dados_bairro_axis.yieldBruto>=6?K.grn:K.amb],
              ['Tendência 12m',p._dados_bairro_axis.tendencia12m!=null?`${p._dados_bairro_axis.tendencia12m}%`:'—',p._dados_bairro_axis.tendencia12m>5?K.grn:K.red],
            ].map(([l,v,c])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #BAE6FD40'}}>
                <span style={{fontSize:12,color:'#64748B'}}>{l}</span>
                <span style={{fontSize:12.5,fontWeight:600,color:c}}>{v}</span>
              </div>
            ))}
            {p._gap_asking_closing_pct && (
              <div style={{marginTop:8,padding:'6px 10px',borderRadius:6,background:'#FEF3C7',border:'1px solid #FDE68A',fontSize:11,color:'#92400E'}}>
                📉 Gap anúncio vs contrato: <strong>{p._gap_asking_closing_pct}%</strong> — margem de negociação típica neste bairro
              </div>
            )}
            {p._score_axis_patrimonial && (
              <div style={{marginTop:6,padding:'6px 10px',borderRadius:6,background:'#ECFDF5',border:'1px solid #A7F3D0',fontSize:11,color:'#065F46'}}>
                🎯 Score AXIS patrimonial: <strong>{p._score_axis_patrimonial}</strong> (yield×40% + tendência×35% + demanda×25%)
              </div>
            )}
            <div style={{marginTop:6,fontSize:9,color:'#94A3B8'}}>
              Fontes: QuintoAndar 3T2025 · FipeZAP fev/2026 · IPEAD/UFMG · Supabase mercado_regional
            </div>
          </div>
        )}
        {/* Homogeneização */}
        {p.fator_homogenizacao && p.fator_homogenizacao < 1 && (
          <div style={{...card(),marginTop:14,background:'#FFFBEB',border:'1px solid #FDE68A'}}>
            <div style={{fontWeight:600,color:'#92400E',marginBottom:8,fontSize:13}}>📐 Homogeneização (NBR 14653)</div>
            <div style={{fontSize:12,color:'#78350F',lineHeight:1.7}}>
              Fator aplicado: <strong>{(p.fator_homogenizacao * 100).toFixed(0)}%</strong><br/>
              {p.valor_mercado_homogenizado && <>Valor homogeneizado: <strong>R$ {Math.round(p.valor_mercado_homogenizado).toLocaleString('pt-BR')}</strong><br/></>}
              {p.elevador===false && <span>• Sem elevador: ×0.85 (-15%)<br/></span>}
              {p.piscina===false && <span>• Sem piscina: ×0.97 (-3%)<br/></span>}
              {p.area_lazer===false && <span>• Sem área lazer: ×0.95 (-5%)<br/></span>}
              {(p.vagas||0)===0 && <span>• Sem vaga: ×0.90 (-10%)<br/></span>}
            </div>
          </div>
        )}
      {/* Comparáveis — também na aba mercado */}
      {p.comparaveis?.length>0&&<ComparaveisComFiltros comparaveis={p.comparaveis} imovel={p} isPhone={isPhone} CardComparavel={CardComparavel}/>}
      {/* Mapa de locais próximos — só quando coordenadas disponíveis */}
      {p.coordenadas_lat && p.coordenadas_lng && (
        <div style={{marginTop:16}}>
          <Suspense fallback={<div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'#999',fontSize:13}}>Carregando mapa...</div>}>
            <LazyMapaLocais lat={p.coordenadas_lat} lng={p.coordenadas_lng} titulo={p.titulo||p.codigo_axis}/>
          </Suspense>
        </div>
      )}
      </div>}

      {abaDetalhe==='resumo'&&<>
      {p.foto_principal&&(
        <div style={{width:'100%',maxHeight:420,borderRadius:12,overflow:'hidden',marginBottom:16,background:'#f0f0f0',willChange:'transform'}}>
          <img src={p.foto_principal} alt={p.titulo||'Foto'} referrerPolicy="no-referrer"
            style={{width:'100%',height:'auto',maxHeight:420,objectFit:'cover',display:'block'}}
            onError={e=>{e.target.parentElement.style.display='none'}}/>
        </div>
      )}
      <div style={{background:`${rc}10`,border:`1px solid ${rc}30`,borderRadius:"10px",padding:"20px",marginBottom:"16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"20px"}}>
          {sc > 0 ? <ScoreRing score={sc} size={90}/>
            : <div style={{width:90,height:90,borderRadius:'50%',border:'3px dashed #D4D4D8',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
                <div style={{fontSize:16,fontWeight:700,color:C.muted}}>N/A</div>
                <div style={{fontSize:8,color:C.hint}}>dados insuf.</div>
              </div>
          }
          <div>
            <div style={{fontSize:"11px",color:K.t3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"4px"}}>Recomendação</div>
            <div style={{fontSize:"28px",fontWeight:"800",color:rc}}>{p.recomendacao||"—"}</div>
            <div style={{fontSize:"12px",color:K.t2,marginTop:"4px",maxWidth:"400px"}}>{p.justificativa}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
          <Bdg c={p.ocupacao==="Desocupado"?K.grn:K.red} ch={p.ocupacao||"—"}/>
          <Bdg c={p.financiavel?K.blue:K.t3} ch={p.financiavel?"Financiável":"Sem financ."}/>
          {p.fgts_aceito&&<Bdg c={K.pur} ch="FGTS"/>}
          <Bdg c={K.t3} ch={p.modalidade||"—"}/>
          {p.parcelamento_aceito&&<Bdg c="#2563EB" ch="💳 Parcelável"/>}
          {p.elevador===false&&<Bdg c="#D97706" ch="⚠️ Sem elevador"/>}
          {p.praca&&<Bdg c={p.praca>=2?"#D97706":"#065F46"} ch={`${p.praca}ª Praça`}/>}
        </div>
      </div>
      {/* Sprint 12: Cards de atributos do imóvel (estilo Ninja) */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))',gap:8,marginBottom:16}}>
        {[
          {icon:'📐',label:'Área',value:parseFloat(p.area_construida_m2||p.area_privativa_m2||p.area_m2)?`${Math.round(parseFloat(p.area_construida_m2||p.area_privativa_m2||p.area_m2))} m²`:'—',sub:p.area_construida_m2?'construída':'total'},
          {icon:'🛏',label:'Quartos',value:p.quartos||'—',sub:p.suites?`${p.suites} suíte${p.suites>1?'s':''}`:null},
          {icon:'🚿',label:'Banheiros',value:p.banheiros||'—'},
          {icon:'🚗',label:'Vagas',value:p.vagas||'—'},
          ...(p.nome_condominio?[{icon:'🏢',label:'Condomínio',value:p.nome_condominio.split('(')[0].trim().substring(0,20),sub:p.condominio_mensal?`R$ ${Math.round(p.condominio_mensal)}/mês`:null}]:[]),
          ...(p.roi_estimado?[{icon:'📈',label:'ROI',value:`${p.roi_estimado}%`,sub:'estimado'}]:[]),
        ].map((a,i) => (
          <div key={i} style={{background:'#fff',border:`1px solid ${C.borderW}`,borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
            <div style={{fontSize:20,marginBottom:2}}>{a.icon}</div>
            <div style={{fontSize:14,fontWeight:700,color:C.navy}}>{a.value}</div>
            <div style={{fontSize:9.5,color:C.muted,textTransform:'uppercase',letterSpacing:'.3px'}}>{a.label}</div>
            {a.sub&&<div style={{fontSize:8.5,color:C.hint,marginTop:1}}>{a.sub}</div>}
          </div>
        ))}
      </div>
      {p.alertas?.length>0&&<div style={{background:`${K.red}10`,border:`1px solid ${K.red}30`,borderRadius:"8px",padding:"14px",marginBottom:"14px"}}>
        <div style={{fontSize:"11px",color:K.red,fontWeight:"700",textTransform:"uppercase",letterSpacing:"1px",marginBottom:"8px"}}>🚨 Alertas Críticos</div>
        {p.alertas.map((a,i)=><div key={i} style={{fontSize:"12.5px",color:K.tx,marginBottom:"4px"}}>• {normalizarTextoAlerta(a)}</div>)}
      </div>}
      {/* Estratégia recomendada badge */}
      {/* Sprint 12: Info cards extras */}
      {(p.distribuicao_pavimentos || p.parcelamento_detalhes || p.processo_numero || p.coproprietarios) && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
          {p.processo_numero && (
            <div style={{background:'#F0F4FF',border:'1px solid #002B8020',borderRadius:8,padding:'8px 12px',cursor:'pointer'}}
              onClick={() => { navigator.clipboard?.writeText(p.processo_numero); }}>
              <div style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>⚖️ Processo</div>
              <div style={{fontSize:11.5,fontWeight:600,color:C.navy,fontFamily:'monospace'}}>{p.processo_numero}</div>
              <div style={{fontSize:8,color:C.hint}}>clique p/ copiar</div>
            </div>
          )}
          {p.parcelamento_detalhes && (
            <div style={{background:'#EFF6FF',border:'1px solid #2563EB20',borderRadius:8,padding:'8px 12px'}}>
              <div style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>💳 Parcelamento</div>
              <div style={{fontSize:11,color:'#1D4ED8',lineHeight:1.4}}>{p.parcelamento_detalhes.substring(0,120)}</div>
            </div>
          )}
          {p.distribuicao_pavimentos && (
            <div style={{background:'#F8FAFC',border:`1px solid ${C.borderW}`,borderRadius:8,padding:'8px 12px',gridColumn:p.processo_numero&&p.parcelamento_detalhes?'1 / -1':'auto'}}>
              <div style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>🏗️ Distribuição</div>
              <div style={{fontSize:11,color:C.navy,lineHeight:1.5}}>
                {p.distribuicao_pavimentos.split('|').map((pav,i) => (
                  <div key={i}>• {pav.trim()}</div>
                ))}
              </div>
            </div>
          )}
          {p.coproprietarios && (
            <div style={{background:'#FEF3C7',border:'1px solid #F59E0B30',borderRadius:8,padding:'8px 12px'}}>
              <div style={{fontSize:9,color:'#92400E',textTransform:'uppercase'}}>⚠️ Coproprietário</div>
              <div style={{fontSize:11,color:'#78350F',lineHeight:1.4}}>{p.coproprietarios.substring(0,100)}</div>
            </div>
          )}
        </div>
      )}
      {p.estrategia_recomendada_detalhe?.tipo && parseFloat(p.score_total) > 0 && (() => {
        const cfg = ESTRATEGIA_CONFIG[p.estrategia_recomendada_detalhe.tipo]
        return cfg ? (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6,
            padding:'5px 12px', borderRadius:20, marginBottom:14,
            background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`,
            fontSize:12, fontWeight:600, color:cfg.color }}>
            {cfg.emoji} {cfg.label}
            {p.estrategia_recomendada_detalhe.prazo_estimado_meses && (
              <span style={{ fontWeight:400, opacity:0.8 }}>
                · {p.estrategia_recomendada_detalhe.prazo_estimado_meses} meses
              </span>
            )}
          </div>
        ) : null
      })()}
      {/* Síntese executiva */}
      {p.sintese_executiva && (
        <div style={{
          background: C.navyAlfa || '#F0F4FF',
          border: `1px solid ${C.navy}20`,
          borderLeft: `3px solid ${C.navy}`,
          borderRadius: '0 10px 10px 0',
          padding: '12px 16px', marginBottom: 16,
        }}>
          <p style={{ margin:'0 0 4px', fontSize:10, fontWeight:700, color:C.navy,
            textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Síntese da análise
          </p>
          <p style={{ margin:0, fontSize:13, color:C.text, lineHeight:1.6 }}>
            {normalizarTextoAlerta(
              isMercadoDireto(p.fonte_url, p.tipo_transacao)
                ? (p.sintese_executiva || '')
                    .replace(/leil[ãa]o\s*judicial/gi, 'compra de mercado')
                    .replace(/leil[ãa]o/gi, 'mercado')
                    .replace(/arrematação|arrematante/gi, m => m.toLowerCase().startsWith('arrematante') ? 'comprador' : 'aquisição')
                    .replace(/edital/gi, 'anúncio')
                    .replace(/(?:1[ªº]|2[ªº])\s*praça/gi, 'negociação')
                    .replace(/lance\s*mínimo/gi, 'preço pedido')
                    .replace(/leiloeiro/gi, 'vendedor')
                    .replace(/não\s+parece\s+ser\s+de\s+um\s+leilão[^.]*\./gi, '')
                    .trim()
                : p.sintese_executiva
            )}
          </p>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>💰 Valores</div>
          {[["Avaliação",fmtC(p.valor_avaliacao),K.t2],[isMercadoDireto(p.fonte_url,p.tipo_transacao)?"Preço pedido":"Lance mínimo",fmtC(isMercadoDireto(p.fonte_url,p.tipo_transacao)?(p.preco_pedido||p.valor_minimo):p.valor_minimo),K.amb],["Desc. s/avaliação",p.desconto_percentual?`${p.desconto_percentual}%`:"—",K.grn],["Desc. s/mercado",p.desconto_sobre_mercado_pct_calculado?`${parseFloat(p.desconto_sobre_mercado_pct_calculado).toFixed(1)}%`:"—",K.grn],["Preço/m² imóvel",p.preco_m2_imovel?`R$ ${Math.round(p.preco_m2_imovel).toLocaleString('pt-BR')}/m²`:"—",K.teal],["Preço/m² mercado",p.preco_m2_mercado?`R$ ${Math.round(p.preco_m2_mercado).toLocaleString('pt-BR')}/m²`:"—",K.t2],["Aluguel estimado",fmtC(p.aluguel_mensal_estimado)+"/mês",K.pur],...(p.fator_homogenizacao&&p.fator_homogenizacao<1?[["Fator homogeneização",`${(p.fator_homogenizacao*100).toFixed(0)}%`,"#92400E"]]:[])].map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>🏠 Ficha Técnica</div>
          {[["Tipo",(p.tipologia||p.tipo||'').replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase())],["Área privativa",(p.area_privativa_m2||p.area_m2)?`${String(p.area_privativa_m2||p.area_m2).replace('.',',')}m²`:"—"],
            ...(p.area_total_m2&&p.area_total_m2!==(p.area_privativa_m2||p.area_m2)?[["Área total (registral)",`${String(p.area_total_m2).replace('.',',')}m² · inclui área comum`]]:[]
            ),["Base de cálculo",(p.area_usada_calculo_m2||p.area_privativa_m2)?`${String(p.area_usada_calculo_m2||p.area_privativa_m2).replace('.',',')}m² (privativa)`:"—"],
            ["Quartos",p.quartos],["Suítes",p.suites],["Vagas",p.vagas],["Andar",p.andar],["Condomínio",p.condominio_mensal?`R$ ${p.condominio_mensal.toLocaleString('pt-BR')}/mês`:null],["Padrão",p.padrao_acabamento],...(!isMercadoDireto(p.fonte_url,p.tipo_transacao)?[["Leiloeiro",p.leiloeiro],["Data leilão",p.data_leilao],["Nº leilão",p.num_leilao?`${p.num_leilao}º leilão`:null]]:[]),["Liquidez",LIQUIDEZ_MAP[p.liquidez?.toLowerCase()]||p.liquidez],["Revenda est.",p.prazo_revenda_meses?`${p.prazo_revenda_meses} meses`:"—"]].filter(([,v])=>v&&v!==null&&v!=="—"&&v!=="0"&&v!==0).map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",color:K.tx}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{...card(),marginBottom:"14px"}}>
        <div style={{fontWeight:"600",color:K.wh,marginBottom:"14px",fontSize:"13px"}}>📊 Score por Dimensão</div>
        <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:"10px"}}>
          {scores.map(({l,v,w})=>(
            <div key={l} style={{background:K.s2,borderRadius:"6px",padding:"10px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                <span style={{fontSize:"11px",color:K.t3}}>{l}</span>
                <span style={{fontSize:"10px",color:K.t3}}>peso {w}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{flex:1,height:"6px",background:K.bd,borderRadius:"3px",overflow:"hidden"}}>
                  <div style={{width:`${(v||0)*10}%`,height:"100%",background:scoreColor(v||0),borderRadius:"3px"}}/>
                </div>
                <span style={{fontSize:"13px",fontWeight:"700",color:scoreColor(v||0),minWidth:"36px",textAlign:"right"}}>{(v||0).toFixed(2)}</span>
              </div>
              {l==="Jurídico"&&(v||0)>=7&&(!p.num_documentos||p.num_documentos===0)&&(
                <div style={{fontSize:9,color:'#D97706',fontWeight:600,marginTop:4}}>⚠️ Score estimado — 0 documentos analisados</div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Análise de Leilão — só para leilões */}
      {!isMercadoDireto(p.fonte_url, p.tipo_transacao) && <PainelLeilao imovel={p} isAdmin={isAdmin} />}
      {/* ═══ ReformaProvider: sincroniza cenário de reforma entre painéis ═══ */}
      <ReformaProvider imovel={p}>
        {/* Sprint 18: Configuração global do estudo (lance + reforma) */}
        <ConfigEstudo imovel={p} />
        {/* Mostrar PainelLancamento só para leilões */}
        {!isMercadoDireto(p.fonte_url, p.tipo_transacao) && <PainelLancamento imovel={p}/>}
        {/* Sprint 11: Breakdown financeiro + ROI + Preditor de Concorrência */}
        <PainelInvestimento imovel={p} />
        {/* Sprint 16: Simulador de Lance Interativo */}
        <SimuladorLance p={p} isPhone={isPhone} />
        {/* Sprint 16: Atributos do Prédio */}
        <AtributosPredio p={p} />
        {/* Sprint 12.2: Timeline da Matrícula */}
        <TimelineMatricula imovel={p} />
        {/* Mercado direto: badge de oportunidade */}
        {isMercadoDireto(p.fonte_url, p.tipo_transacao) && p.preco_pedido > 0 && (
          <div style={{...card(),marginBottom:'14px',padding:'12px 14px',background:'#FFFBEB',border:'1.5px solid #F59E0B'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#92400E',marginBottom:6}}>
              🏠 Compra de Mercado — Análise de Oportunidade
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}}>
              {[
                ['Preço pedido', p.preco_pedido ? `R$ ${Math.round(p.preco_pedido).toLocaleString('pt-BR')}` : '—'],
                ['Valor mercado', p.valor_mercado_estimado ? `R$ ${Math.round(p.valor_mercado_estimado).toLocaleString('pt-BR')}` : '—'],
                ['Diferença', p.desconto_sobre_mercado_pct_calculado > 0
                  ? <span style={{color:'#065F46',fontWeight:700}}>-{p.desconto_sobre_mercado_pct_calculado}% abaixo</span>
                  : <span style={{color:'#991B1B',fontWeight:700}}>{Math.abs(p.desconto_sobre_mercado_pct_calculado || 0)}% acima</span>
                ],
              ].map(([l,v]) => (
                <div key={l}>
                  <div style={{fontSize:9,color:'#92400E',textTransform:'uppercase',letterSpacing:.3}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:'#78350F'}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Oportunidades melhores — leilão e mercado mais barato */}
        {oportunidadesLeilao.length > 0 && (
          <div style={{...card(),marginBottom:14,padding:'14px',background:'#F0FDF4',border:'1.5px solid #86EFAC'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#065F46',marginBottom:10}}>
              🏆 Oportunidades Melhores — Imóveis Similares Mais Baratos
            </div>
            <div style={{fontSize:11,color:'#047857',marginBottom:10,lineHeight:1.5}}>
              {oportunidadesLeilao.length} imóve{oportunidadesLeilao.length > 1 ? 'is' : 'l'} com características similares e preço menor na RMBH.
            </div>
            {oportunidadesLeilao.map((op) => {
              const areaOp = parseFloat(op.area_privativa_m2 || op.area_m2) || 0
              return (
                <div key={op.id} onClick={() => onNav && onNav('detail', { id: op.id })}
                  style={{padding:'10px 12px',borderRadius:8,marginBottom:6,cursor:'pointer',
                    background:'#fff',border:`1px solid ${op._isLeilao ? '#FDE68A' : '#BBF7D0'}`,transition:'all .15s'}}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:4,alignItems:'center',marginBottom:3}}>
                        <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:3,
                          background:op._isLeilao ? '#FEF3C7' : '#DBEAFE',
                          color:op._isLeilao ? '#92400E' : '#1D4ED8'}}>
                          {op._isLeilao ? `🔨 ${op.praca ? op.praca+'ª PRAÇA' : (op.num_leilao ? op.num_leilao+'º LEILÃO' : 'LEILÃO')}` : '🏠 MERCADO'}
                        </span>
                        {op.score_total >= 7 && <span style={{fontSize:9,fontWeight:700,color:'#065F46'}}>⭐ {op.score_total.toFixed(1)}</span>}
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {op.titulo || 'Imóvel'}
                      </div>
                      <div style={{fontSize:10,color:C.muted}}>
                        📍 {op.bairro || '—'}, {op.cidade}
                      </div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:10,color:C.hint,marginTop:2}}>
                        {areaOp > 0 && <span>📐 {areaOp}m²</span>}
                        {op.quartos > 0 && <span>🛏 {op.quartos}q</span>}
                        {op.vagas > 0 && <span>🚗 {op.vagas}v</span>}
                        {op.desconto_percentual > 0 && <span style={{color:'#065F46',fontWeight:600}}>↓{op.desconto_percentual}%</span>}
                      </div>
                      {/* Link externo */}
                      {op.fonte_url && (
                        <a href={op.fonte_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          style={{fontSize:9,color:'#0D9488',textDecoration:'none',marginTop:2,display:'block'}}>
                          {op._isLeilao ? '🔗 Ver lote no leiloeiro →' : '🔗 Ver anúncio original →'}
                        </a>
                      )}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:op._isLeilao ? '#D97706' : '#1D4ED8'}}>
                        R$ {Math.round((op._isLeilao ? op.valor_minimo : (op.preco_pedido || op.valor_minimo)) / 1000)}k
                      </div>
                      {op._economia > 0 && (
                        <div style={{fontSize:10,fontWeight:700,color:'#065F46',marginTop:2}}>
                          💰 -{Math.round(op._economia / 1000)}k economia
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{fontSize:9,color:'#065F46',marginTop:6,lineHeight:1.4}}>
              Clique para ver análise completa. Leilões envolvem riscos adicionais (ocupação, débitos, prazo).
            </div>
          </div>
        )}
        <CustosReaisEditor imovel={p} onUpdateProp={onUpdateProp} isAdmin={isAdmin} />
        <PainelRentabilidade imovel={p}/>
      {/* Cenários de Reforma */}
      <CenariosReforma imovel={p} isAdmin={isAdmin} />
      {/* Calculadora ROI — dentro do Provider para sincronizar com ConfigEstudo */}
      <div style={{...card(),marginBottom:"14px"}}>
        <CalculadoraROI imovel={p} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>⚖️ Jurídico</div>
          {[["Processos",p.processos_ativos,{Nenhum:K.grn,Possível:K.amb,Confirmado:K.red,Desconhecido:K.t3}],
            ["Matrícula",p.matricula_status,{Limpa:K.grn,"Com ônus":K.red,Desconhecido:K.t3}],
            ["Déb. condomínio",p.debitos_condominio,{"Sem débitos":K.grn,"Com débitos":K.red,Desconhecido:K.t3}],
            ["Déb. IPTU",p.debitos_iptu,{"Sem débitos":K.grn,"Com débitos":K.red,Desconhecido:K.t3}]].map(([l,v,cs])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`,alignItems:"center"}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span>
              <span style={{fontSize:"12px",fontWeight:"600",color:cs?.[v]||K.t2}}>{v||"—"}</span>
            </div>
          ))}
          {p.obs_juridicas&&<div style={{marginTop:"10px",fontSize:"11.5px",color:K.t2,lineHeight:"1.6",background:K.s2,borderRadius:"5px",padding:"8px"}}>{normalizarTextoAlerta(p.obs_juridicas)}</div>}
          <button onClick={()=>setAbaDetalhe('juridico')} style={{marginTop:10,background:`${K.teal}12`,border:`1px solid ${K.teal}30`,borderRadius:6,padding:"6px 14px",fontSize:12,color:K.teal,fontWeight:600,cursor:"pointer",width:"100%"}}>📎 Anexar documentos jurídicos</button>
          {p.num_documentos>0&&(
            <div style={{marginTop:10,padding:'10px 12px',borderRadius:8,background:'#F5F3FF',border:'1px solid #DDD6FE'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,color:'#7C3AED'}}>📄 {p.num_documentos} documento(s) analisado(s)</span>
                {p.score_viabilidade_docs!=null&&<span style={{fontSize:12,fontWeight:800,color:p.score_viabilidade_docs>=7?C.emerald:p.score_viabilidade_docs>=5?C.mustard:'#E5484D'}}>{Number(p.score_viabilidade_docs).toFixed(1)}/10 viabilidade</span>}
              </div>
              {p.recomendacao_juridica_docs&&<div style={{fontSize:10,padding:'3px 8px',borderRadius:5,display:'inline-block',marginBottom:6,background:p.recomendacao_juridica_docs==='favoravel'?C.emeraldL:p.recomendacao_juridica_docs==='desfavoravel'?'#FCEBEB':'#FFF8E1',color:p.recomendacao_juridica_docs==='favoravel'?C.emerald:p.recomendacao_juridica_docs==='desfavoravel'?'#E5484D':'#D4A017',fontWeight:700}}>{p.recomendacao_juridica_docs==='favoravel'?'✅ Juridicamente Favorável':p.recomendacao_juridica_docs==='desfavoravel'?'❌ Riscos Identificados':'⚠️ Due Diligence Necessária'}</div>}
              <button onClick={()=>setAbaDetalhe('documentos')} style={{display:'block',width:'100%',padding:'4px',borderRadius:5,border:'1px solid #DDD6FE',background:'#fff',color:'#7C3AED',fontSize:11,cursor:'pointer',fontWeight:600}}>Ver análise completa dos documentos →</button>
            </div>
          )}
          {p.reclassificado_por_doc&&<div style={{marginTop:6,fontSize:10.5,color:K.amb,fontWeight:600}}>🔄 Reclassificado por documento</div>}
        </div>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"4px",fontSize:"13px"}}>📈 Retorno e Custos <span style={{fontSize:9,fontWeight:500,color:K.t3}}>— da análise IA</span></div>
          <div style={{fontSize:10,color:K.t3,marginBottom:10}}>Snapshot gerado na análise original. Para valores dinâmicos com seu lance, veja os painéis acima.</div>
          {[["Custo regularização",fmtC(p.custo_regularizacao),K.amb],["Custo reforma",fmtC(p.custo_reforma_calculado),K.amb],["Retorno revenda",p.retorno_venda_pct?`+${p.retorno_venda_pct}%`:"—",K.grn],["Locação a.a.",p.retorno_locacao_anual_pct?`${p.retorno_locacao_anual_pct}%`:"—",K.teal],["Estrutura rec.",mapDisplay(p.estrutura_recomendada),K.pur],["Tendência",mapDisplay(p.mercado_tendencia),p.mercado_tendencia==="Alta"?K.grn:K.amb],["Demanda",mapDisplay(p.mercado_demanda),p.mercado_demanda==="Alta"?K.grn:K.amb]].filter(([,v])=>v&&v!=="—").map(([l,v,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
              <span style={{fontSize:"12px",color:K.t3}}>{l}</span><span style={{fontSize:"12.5px",fontWeight:"600",color:c}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Preço/m² e Comparáveis */}
      <div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={card()}>
          <div style={{fontWeight:"600",color:K.wh,marginBottom:"12px",fontSize:"13px"}}>💰 Preço/m²</div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
            <span style={{fontSize:"12px",color:K.t3}}>{isMercadoDireto(p.fonte_url,p.tipo_transacao)?"Preço ÷ área":"Lance ÷ área privativa"}</span>
            <span style={{fontSize:"12.5px",fontWeight:"600",color:K.tx}}>R$ {Math.round((isMercadoDireto(p.fonte_url,p.tipo_transacao)?(p.preco_pedido||p.valor_minimo||0):(p.valor_minimo||0))/(p.area_usada_calculo_m2||p.area_privativa_m2||p.area_m2||1)).toLocaleString('pt-BR')}/m²</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${K.bd}`}}>
            <span style={{fontSize:"12px",color:K.t3}}>Mercado</span>
            <span style={{fontSize:"12.5px",fontWeight:"600",color:K.grn}}>R$ {(p.preco_m2_mercado||0).toLocaleString('pt-BR')}/m²</span>
          </div>
          {p.preco_m2_fonte&&<div style={{fontSize:"10px",color:K.t3,marginTop:"4px"}}>{p.preco_m2_fonte}</div>}
          {p.desconto_sobre_mercado_pct!=null&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
            <span style={{fontSize:"12px",color:K.t3}}>Desconto s/ mercado</span>
            <span style={{fontSize:"12.5px",fontWeight:"700",color:K.grn}}>{p.desconto_sobre_mercado_pct}%</span>
          </div>}
        </div>
        <div style={card()}>
          {(()=>{
            const eMerc=isMercadoDireto(p.fonte_url,p.tipo_transacao)
            const precoBase=parseFloat(eMerc?(p.preco_pedido||p.valor_minimo):p.valor_minimo)||0
            // Usar calcularCustosAquisicao centralizado (constants.js)
            const _overrides = { comissao_leiloeiro_pct: p.comissao_leiloeiro_pct, itbi_pct: p.itbi_pct }
            const _custos = calcularCustosAquisicao(precoBase, eMerc, _overrides)
            const custoCalc = p.custo_total_aquisicao || (_custos?.total || 0)
            return custoCalc>0?<>
            <div style={{fontWeight:"600",color:K.amb,marginBottom:"10px",fontSize:"13px"}}>🧾 Custo total {p.custo_total_aquisicao?'real':'estimado'}</div>
            {[[eMerc?"Preço pedido":"Lance mínimo",fmtC(precoBase)],...(!eMerc&&_custos?.comissao>0?[["Comissão leiloeiro",fmtC(_custos.comissao)]]:[]),["ITBI",fmtC(_custos?.itbi||0)],["Doc + Registro",fmtC((_custos?.documentacao||0)+(_custos?.registro||0))],...(!eMerc&&_custos?.advogado>0?[["Advogado",fmtC(_custos.advogado)]]:[]),["Regularização",fmtC(p.custo_regularizacao)]].filter(([,v])=>v&&v!=="R$ 0"&&v!=="R$ NaN").map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:"12px"}}>
                <span style={{color:K.t3}}>{l}</span><span style={{color:K.tx}}>{v}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:`1px solid ${K.bd}`,marginTop:"6px"}}>
              <span style={{fontSize:"13px",fontWeight:"700",color:K.wh}}>Total</span>
              <span style={{fontSize:"13px",fontWeight:"700",color:K.amb}}>R$ {custoCalc.toLocaleString('pt-BR')}</span>
            </div>
          </>:<div style={{fontSize:"12px",color:K.t3}}>Preço de aquisição não disponível</div>
          })()}
        </div>
      </div>
      {/* Comparáveis */}
      {p.comparaveis?.length>0&&<ComparaveisComFiltros comparaveis={p.comparaveis} imovel={p} isPhone={isPhone} CardComparavel={CardComparavel}/>}
      {/* Responsabilidade passivos */}
      {p.responsabilidade_debitos&&<div style={{...card(),marginBottom:"14px",background:p.responsabilidade_debitos==='exonerado'?`${K.grn}15`:p.responsabilidade_debitos==='sub_rogado'?`${K.teal}15`:`${K.red}15`,border:`1px solid ${p.responsabilidade_debitos==='exonerado'?K.grn:p.responsabilidade_debitos==='sub_rogado'?K.teal:K.red}30`}}>
        <div style={{fontSize:"12.5px",fontWeight:"600",color:p.responsabilidade_debitos==='exonerado'?K.grn:p.responsabilidade_debitos==='sub_rogado'?K.teal:K.red}}>
          {p.responsabilidade_debitos==='exonerado'?'✅ Passivos NÃO são do arrematante (edital exonera)':p.responsabilidade_debitos==='sub_rogado'?'📋 Débitos sub-rogados no preço (leilão judicial)':'⚠️ Verificar responsabilidade pelos passivos'}
        </div>
        {p.responsabilidade_fonte&&<div style={{fontSize:"10.5px",color:K.t3,marginTop:"4px"}}>Fonte: {p.responsabilidade_fonte}</div>}
      </div>}
      {(p.positivos?.length>0||p.negativos?.length>0)&&<div style={{display:"grid",gridTemplateColumns:isPhone?"1fr":"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div style={{...card(),borderTop:`2px solid ${K.grn}`}}>
          <div style={{fontWeight:"600",color:K.grn,marginBottom:"10px",fontSize:"13px"}}>✅ Pontos Positivos</div>
          {(p.positivos||[]).map((pt,i)=><div key={i} style={{fontSize:"12.5px",color:K.tx,marginBottom:"6px",display:"flex",gap:"8px"}}><span style={{color:K.grn}}>+</span>{normalizarTextoAlerta(pt)}</div>)}
        </div>
        <div style={{...card(),borderTop:`2px solid ${K.red}`}}>
          <div style={{fontWeight:"600",color:K.red,marginBottom:"10px",fontSize:"13px"}}>⚠️ Pontos de Atenção</div>
          {(p.negativos||[]).map((pt,i)=><div key={i} style={{fontSize:"12.5px",color:K.tx,marginBottom:"6px",display:"flex",gap:"8px"}}><span style={{color:K.red}}>−</span>{normalizarTextoAlerta(pt)}</div>)}
        </div>
      </div>}
      {p.endereco&&<div style={{...card(),marginBottom:"14px"}}><div style={{fontWeight:"600",color:K.wh,marginBottom:"6px",fontSize:"13px"}}>📍 Localização</div><div style={{fontSize:"13px",color:K.t2}}>{p.endereco}</div></div>}

      {/* Avaliação do grupo */}
      <div style={{...card(),marginBottom:'14px'}}>
        <div style={{fontWeight:600,color:K.wh,marginBottom:10,fontSize:13}}>Avaliação do grupo</div>
        <div style={{display:'flex',gap:6,marginBottom:10}}>
          {['COMPRAR','AGUARDAR','EVITAR'].map(op => (
            <button key={op} onClick={async () => {
              const { data:{ user } } = await supabase.auth.getUser()
              const { saveAvaliacao, getAvaliacoes } = await import('../lib/supabase.js')
              await saveAvaliacao({ imovel_id: p.id, user_id: user?.id, nota: op === 'COMPRAR' ? 5 : op === 'AGUARDAR' ? 3 : 1, comentario: op })
              getAvaliacoes(p.id).then(setAvaliacoes).catch(()=>{})
              setMinhaAvaliacao(op)
            }} style={{
              ...btn('s'),
              background: minhaAvaliacao === op ? (op==='COMPRAR'?C.emerald:op==='AGUARDAR'?C.mustard:'#E5484D') : K.s2,
              color: minhaAvaliacao === op ? '#fff' : K.tx,
              border: 'none'
            }}>{op}</button>
          ))}
        </div>
        {avaliacoes.length > 0 && (
          <div style={{fontSize:11,color:K.t3}}>
            {avaliacoes.length} avaliação(ões) · maioria: {
              (() => {
                const counts = avaliacoes.reduce((a,v) => {
                  const op = v.comentario || (v.nota >= 4 ? 'COMPRAR' : v.nota >= 3 ? 'AGUARDAR' : 'EVITAR')
                  a[op] = (a[op]||0)+1; return a
                }, {})
                return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]
              })()
            }
          </div>
        )}
      </div>

      {/* Observações do grupo */}
      <div style={{...card(),marginBottom:'14px'}}>
        <div style={{fontWeight:600,color:K.wh,marginBottom:10,fontSize:13}}>Observações do grupo</div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input
            value={novaObs}
            onChange={e => setNovaObs(e.target.value)}
            placeholder="Adicionar observação..."
            style={{...inp(),flex:1,fontSize:12}}
            onKeyDown={e => e.key === 'Enter' && salvarObs()}
          />
          <button onClick={salvarObs} disabled={salvandoObs} style={{...btn('s'),background:C.emerald,color:'#fff',border:'none'}}>
            {salvandoObs ? '...' : 'Salvar'}
          </button>
        </div>
        {obs.map(o => (
          <div key={o.id} style={{padding:'6px 0',borderBottom:`1px solid ${K.bd}`,fontSize:12}}>
            <span style={{color:K.t3,fontSize:10}}>{o.autor?.nome || 'Membro'} · {new Date(o.criado_em).toLocaleDateString('pt-BR')}</span>
            <div style={{color:K.tx,marginTop:2}}>{o.texto}</div>
          </div>
        ))}
        {obs.length === 0 && <div style={{fontSize:11,color:K.t3}}>Nenhuma observação ainda</div>}
      </div>

      {/* Anotações privadas — localStorage */}
      <NotasPrivadas imovelId={p.id} />
      </ReformaProvider>
      </>}
    </div>
    {modoAoVivo && <ModoAoVivo imovel={p} onClose={() => setModoAoVivo(false)} />}
    {/* Sprint 12: Botão flutuante de exportação */}
    <div style={{position:'fixed',bottom:20,right:20,zIndex:50,display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}}>
      {p.data_leilao && !isMercadoDireto(p.fonte_url, p.tipo_transacao) && (() => {
        const [y,m,d] = p.data_leilao.split('-').map(Number)
        const dl = new Date(y, m-1, d); dl.setHours(0,0,0,0)
        const hoje = new Date(); hoje.setHours(0,0,0,0)
        const diff = Math.round((dl - hoje) / 86400000)
        if (diff < 0 || diff > 7) return null
        return (
          <div style={{
            background: diff <= 1 ? '#DC2626' : '#D97706', color:'#fff',
            padding:'6px 14px', borderRadius:20, fontSize:11, fontWeight:700,
            boxShadow:'0 4px 15px rgba(0,0,0,0.2)', animation: diff <= 1 ? 'pulse 2s infinite' : 'none'
          }}>
            🔨 {diff === 0 ? 'LEILÃO HOJE!' : diff === 1 ? 'LEILÃO AMANHÃ!' : `Leilão em ${diff} dias`}
          </div>
        )
      })()}
      <button onClick={async () => {
        const { exportarPDFImovel } = await import('./ExportarPDF.jsx')
        exportarPDFImovel(p)
      }} style={{
        width:48, height:48, borderRadius:'50%', border:'none',
        background:'#002B80', color:'#fff', fontSize:20, cursor:'pointer',
        boxShadow:'0 4px 15px rgba(0,43,128,0.4)', display:'flex', alignItems:'center', justifyContent:'center',
        transition:'transform .2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      title="Exportar / Imprimir"
      >🖨️</button>
    </div>
  </div>
}
