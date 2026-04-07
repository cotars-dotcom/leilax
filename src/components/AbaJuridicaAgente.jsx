import { useState, useEffect } from 'react'
import { C, K, btn, card } from '../appConstants.js'
import { supabase, getDocumentosJuridicos, salvarDocumentoJuridico, limparPDFsDuplicados,
         reclassificarImovel, loadApiKeys } from '../lib/supabase.js'
import { buscarDocumentosAuto, analisarTextoJuridicoGemini,
         analisarPDFBase64Gemini, calcularNovoScoreJuridico } from '../lib/agenteJuridico.js'
import { processarDocumentoCompleto } from '../lib/documentosPDF.js'
import { analisarImagemJuridicaGPT } from '../lib/analisadorJuridico.js'

const GRAVIDADE_COR = { critico:'#A32D2D', alto:C.mustard, medio:'#185FA5', baixo:C.emerald }
const GRAVIDADE_BG  = { critico:'#FCEBEB', alto:'#FAEEDA', medio:'#E6F1FB', baixo:C.emeraldL }

const P = {
  navy:'#002B80', navyL:'#E8EEF8',
  emerald:'#05A86D', emeraldL:'#E6F7F0',
  red:'#E5484D', redL:'#FCEBEB',
  mustard:'#D4A017', mustardL:'#FFF8E1',
  blue:'#4A9EFF', purple:'#7C3AED', purpleL:'#F0EBFF',
  gray:'#8E8EA0', border:'#E8E6DF',
  surface:'#F4F3EF', white:'#FFFFFF', text:'#1A1A2E',
}

const Tag = ({ text, cor }) => (
  <span style={{ fontSize:9.5, fontWeight:700, padding:'2px 8px', borderRadius:10,
    background:`${cor}18`, color:cor, border:`1px solid ${cor}30`, whiteSpace:'nowrap' }}>
    {text}
  </span>
)
const Box = ({ children, style }) => (
  <div style={{ background:P.white, border:`1px solid ${P.border}`, borderRadius:10, padding:'12px 14px', ...style }}>
    {children}
  </div>
)

function ScoreBar({ label, value }) {
  const c = value >= 7 ? P.emerald : value >= 5 ? P.mustard : P.red
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span style={{ fontSize:10.5, color:P.gray }}>{label}</span>
        <span style={{ fontSize:10.5, fontWeight:700, color:c }}>{value?.toFixed(1)}/10</span>
      </div>
      <div style={{ height:5, background:P.surface, borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${Math.min(100,(value/10)*100)}%`, background:c, borderRadius:3 }}/>
      </div>
    </div>
  )
}

// ─── CARD DE DOCUMENTO COMPLETO ──────────────────────────────────────────────
function CardDoc({ doc, onAnalisarDoc }) {
  const [aberto, setAberto] = useState(false)
  const analise = doc.analise_estruturada || {}
  const metricas = analise.metricas_viabilidade || doc.metricas_viabilidade || {}
  const riscos = analise.riscos_identificados || doc.riscos_encontrados || []
  const positivos = analise.pontos_positivos || doc.pontos_positivos || []
  const alertas = analise.alertas_criticos || doc.alertas_criticos || []
  const infos = analise.informacoes_principais || {}
  const score = metricas.score_geral || doc.score_viabilidade || doc.score_juridico_sugerido
  const tipoConf = {
    edital:    { icon:'📋', cor:P.navy },
    matricula: { icon:'📜', cor:P.purple },
    processo:  { icon:'⚖️', cor:P.red },
    certidao:  { icon:'🏛️', cor:P.blue },
    outro:     { icon:'📄', cor:P.gray },
  }
  const tc = tipoConf[doc.tipo] || tipoConf.outro
  const recConf = {
    favoravel:    { cor:P.emerald, label:'✅ Favorável' },
    neutro:       { cor:P.mustard, label:'⚠️ Neutro' },
    desfavoravel: { cor:P.red,     label:'❌ Desfavorável' },
  }
  const rc = recConf[analise.recomendacao_juridica || doc.recomendacao_juridica]
  const criticos = riscos.filter(r => r.gravidade === 'critico' || r.gravidade === 'alto')

  return (
    <Box style={{ marginBottom:10, padding:0, overflow:'hidden' }}>
      {/* Header */}
      <div onClick={() => setAberto(!aberto)} style={{
        padding:'10px 14px', cursor:'pointer', display:'flex', gap:10, alignItems:'flex-start',
        background: aberto ? P.surface : P.white,
        borderBottom: aberto ? `1px solid ${P.border}` : 'none',
        borderRadius: aberto ? '10px 10px 0 0' : 10
      }}>
        <div style={{ fontSize:20, flexShrink:0 }}>{tc.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:3 }}>
            <Tag text={doc.tipo?.toUpperCase() || 'DOC'} cor={tc.cor}/>
            {rc && <Tag text={rc.label} cor={rc.cor}/>}
            {doc.url_storage && <Tag text="💾 Salvo" cor={P.emerald}/>}
            {criticos.length > 0 && <Tag text={`⚠️ ${criticos.length} risco(s)`} cor={P.red}/>}
          </div>
          <div style={{ fontSize:12.5, fontWeight:600, color:P.navy, marginBottom:2 }}>
            {analise.titulo_documento || doc.nome}
          </div>
          {(analise.resumo_executivo || doc.resumo_executivo || doc.analise_ia) && (
            <div style={{ fontSize:11, color:P.gray, lineHeight:1.5,
              overflow:'hidden', display:'-webkit-box', WebkitLineClamp:aberto?100:2, WebkitBoxOrient:'vertical' }}>
              {analise.resumo_executivo || doc.resumo_executivo || doc.analise_ia}
            </div>
          )}
        </div>
        <div style={{ flexShrink:0, textAlign:'center' }}>
          {score != null && (
            <div>
              <div style={{ fontSize:18, fontWeight:800, color: score>=7 ? P.emerald : score>=5 ? P.mustard : P.red }}>
                {Number(score).toFixed(1)}
              </div>
              <div style={{ fontSize:8, color:P.gray }}>viabilidade</div>
            </div>
          )}
          <div style={{ fontSize:13, color:P.gray, marginTop:2 }}>{aberto ? '▲' : '▼'}</div>
        </div>
      </div>

      {aberto && (
        <div style={{ padding:'12px 14px' }}>

          {/* Resumo */}
          {(analise.resumo_executivo || doc.resumo_executivo) && (
            <Box style={{ marginBottom:10, background:P.navyL, border:`1px solid ${P.navy}20` }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>📋 Resumo Executivo</div>
              <div style={{ fontSize:12, color:P.text, lineHeight:1.7 }}>{analise.resumo_executivo || doc.resumo_executivo}</div>
            </Box>
          )}

          {/* Informações identificadas */}
          {Object.values(infos).some(v => v && v !== 'Não informado') && (
            <Box style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>📊 Informações do Documento</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 12px' }}>
                {[
                  ['Processo', infos.processo_numero], ['Vara', infos.vara],
                  ['Exequente', infos.exequente], ['Executado', infos.executado],
                  ['Matrícula nº', infos.matricula_numero], ['Cartório', infos.cartorio],
                  ['Área', infos.area_m2 ? `${infos.area_m2}m²` : null],
                  ['Lance mínimo', infos.lance_minimo_pct ? `${infos.lance_minimo_pct}%` : null],
                  ['Débitos', infos.debitos_declarados], ['Gravames', infos.gravames],
                ].filter(([,v]) => v && v !== 'Não informado' && v !== 'null').map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize:9.5, color:P.gray, textTransform:'uppercase', letterSpacing:.3 }}>{k}</div>
                    <div style={{ fontSize:11.5, color:P.text, fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </Box>
          )}

          {/* Métricas de viabilidade */}
          {metricas.score_geral != null && (
            <Box style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>📈 Métricas de Viabilidade</div>
              {metricas.score_titulo != null && <ScoreBar label="Situação do Título" value={metricas.score_titulo}/>}
              {metricas.score_debitos != null && <ScoreBar label="Débitos e Ônus" value={metricas.score_debitos}/>}
              {metricas.score_processos != null && <ScoreBar label="Processos / Disputas" value={metricas.score_processos}/>}
              {metricas.score_ocupacao != null && <ScoreBar label="Ocupação / Posse" value={metricas.score_ocupacao}/>}
              {metricas.score_documentacao != null && <ScoreBar label="Completude Doc." value={metricas.score_documentacao}/>}
              <div style={{ marginTop:6, paddingTop:6, borderTop:`1px solid ${P.border}` }}>
                <ScoreBar label="Score Geral" value={metricas.score_geral}/>
              </div>
              {metricas.justificativa && (
                <div style={{ fontSize:10.5, color:P.gray, fontStyle:'italic', marginTop:4, padding:'5px 8px', background:P.surface, borderRadius:5 }}>
                  {metricas.justificativa}
                </div>
              )}
            </Box>
          )}

          {/* Responsabilidade débitos */}
          {(analise.responsabilidade_debitos || doc.responsabilidade_debitos) && (
            <Box style={{ marginBottom:10, background:P.emeraldL, border:`1px solid ${P.emerald}25` }}>
              <div style={{ fontSize:11, fontWeight:700, color:P.emerald, marginBottom:3 }}>
                ⚖️ Responsabilidade: <span style={{ textTransform:'uppercase' }}>{analise.responsabilidade_debitos || doc.responsabilidade_debitos}</span>
              </div>
              {analise.explicacao_responsabilidade && (
                <div style={{ fontSize:11, color:P.text, lineHeight:1.6 }}>{analise.explicacao_responsabilidade}</div>
              )}
            </Box>
          )}

          {/* Riscos */}
          {riscos.length > 0 && (
            <Box style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.red, marginBottom:8, textTransform:'uppercase', letterSpacing:.4 }}>
                ⚠️ Riscos Identificados ({riscos.length})
              </div>
              {riscos.map((r, i) => (
                <div key={i} style={{
                  padding:'8px 10px', marginBottom:5, borderRadius:7,
                  background: GRAVIDADE_BG[r.gravidade] || P.surface,
                  borderLeft: `3px solid ${GRAVIDADE_COR[r.gravidade] || P.gray}`
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                    <span style={{ fontSize:10.5, fontWeight:700, color: GRAVIDADE_COR[r.gravidade] || P.text }}>
                      {r.gravidade?.toUpperCase()} — {r.categoria || ''}
                    </span>
                    {r.impacto_financeiro_estimado > 0 && (
                      <span style={{ fontSize:10, color:P.red, fontWeight:600 }}>
                        ~R$ {Math.round(r.impacto_financeiro_estimado).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11.5, color:P.text, marginBottom:3 }}>{r.descricao}</div>
                  {r.trecho_relevante && (
                    <div style={{ fontSize:10, color:P.gray, fontStyle:'italic', marginBottom:3 }}>
                      "{r.trecho_relevante.substring(0,150)}"
                    </div>
                  )}
                  {r.acao_recomendada && (
                    <div style={{ fontSize:10.5, color:P.navy, fontWeight:600 }}>→ {r.acao_recomendada}</div>
                  )}
                </div>
              ))}
            </Box>
          )}

          {/* Positivos + Alertas */}
          {(positivos.length > 0 || alertas.length > 0) && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              {positivos.length > 0 && (
                <Box style={{ background:P.emeraldL, border:`1px solid ${P.emerald}25` }}>
                  <div style={{ fontSize:10, fontWeight:700, color:P.emerald, marginBottom:5, textTransform:'uppercase', letterSpacing:.4 }}>✅ Positivos</div>
                  {positivos.map((p, i) => <div key={i} style={{ fontSize:11, color:P.text, padding:'2px 0', borderBottom:i<positivos.length-1?`1px solid ${P.emerald}20`:'none' }}>• {p}</div>)}
                </Box>
              )}
              {alertas.length > 0 && (
                <Box style={{ background:P.mustardL, border:`1px solid ${P.mustard}25` }}>
                  <div style={{ fontSize:10, fontWeight:700, color:P.mustard, marginBottom:5, textTransform:'uppercase', letterSpacing:.4 }}>🔔 Alertas</div>
                  {alertas.map((a, i) => <div key={i} style={{ fontSize:11, color:P.text, padding:'2px 0', borderBottom:i<alertas.length-1?`1px solid ${P.mustard}20`:'none' }}>• {a}</div>)}
                </Box>
              )}
            </div>
          )}

          {/* Parecer */}
          {(analise.parecer_final || doc.analise_ia) && (
            <Box style={{ background:P.navyL, border:`1px solid ${P.navy}20`, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:P.navy, marginBottom:4, textTransform:'uppercase', letterSpacing:.4 }}>📝 Parecer Jurídico</div>
              <div style={{ fontSize:12, color:P.text, lineHeight:1.75 }}>{analise.parecer_final || doc.analise_ia}</div>
            </Box>
          )}

          {/* Links e ações */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {doc.url_storage && (
              <a href={doc.url_storage.startsWith('http') 
                ? doc.url_storage.replace('/object/sign/', '/object/public/').split('?token=')[0]
                : `https://vovkfhyjjoruiljfjrxy.supabase.co/storage/v1/object/public/documentos-juridicos/${doc.url_storage}`
              } target="_blank" rel="noreferrer"
                style={{ fontSize:11, padding:'5px 12px', borderRadius:7, textDecoration:'none', background:P.navy, color:'#fff', fontWeight:600 }}>
                📄 Abrir PDF
              </a>
            )}
            {(doc.url_origem || doc.url) && (
              <a href={doc.url_origem || doc.url} target="_blank" rel="noreferrer"
                style={{ fontSize:11, padding:'5px 12px', borderRadius:7, textDecoration:'none', background:P.surface, color:P.navy, border:`1px solid ${P.border}` }}>
                🔗 Original
              </a>
            )}
            {(!doc.processado || !doc.analise_ia || (doc.analise_ia && doc.analise_ia.includes('heurística'))) && onAnalisarDoc && (
              <button onClick={() => onAnalisarDoc(doc)}
                style={{ fontSize:11, padding:'5px 12px', borderRadius:7, background:'#7C3AED', color:'#fff', border:'none', cursor:'pointer', fontWeight:600 }}>
                🤖 {doc.analise_ia?.includes('heurística') ? 'Reanalisar com IA' : 'Analisar com IA'}
              </button>
            )}
          </div>
        </div>
      )}
    </Box>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function AbaJuridicaAgente({ imovel, isAdmin, onReclassificado }) {
  const [subAba, setSubAba] = useState('situacao')
  const [docs, setDocs] = useState([])
  const [analisando, setAnalisando] = useState(false)
  const [buscandoAuto, setBuscandoAuto] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')
  const [linksEncontrados, setLinksEncontrados] = useState([])

  useEffect(() => {
    if (!imovel?.id) return
    getDocumentosJuridicos(imovel.id).then(setDocs).catch(() => {})
  }, [imovel?.id])

  const geminiKey = () => localStorage.getItem('axis-gemini-key') || ''
  const claudeKey = () => localStorage.getItem('axis-api-key') || ''

  const carregarDocs = async () => {
    const data = await getDocumentosJuridicos(imovel.id).catch(() => [])
    setDocs(data || [])
  }

  const syncChaves = async () => {
    let gKey = geminiKey(), cKey = claudeKey()
    let oKey = localStorage.getItem('axis-openai-key') || ''
    if (!gKey || !cKey || !oKey) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const keys = await loadApiKeys(user.id)
          if (keys.geminiKey) { gKey = keys.geminiKey; localStorage.setItem('axis-gemini-key', gKey) }
          if (keys.claudeKey) { cKey = keys.claudeKey; localStorage.setItem('axis-api-key', cKey) }
          if (keys.openaiKey) { oKey = keys.openaiKey; localStorage.setItem('axis-openai-key', oKey) }
        }
      } catch(e) {}
    }
    return { gKey, cKey, oKey }
  }

  const buscarAuto = async () => {
    if (!imovel.fonte_url) { setErro('Imóvel sem URL de origem'); return }
    const { gKey, cKey } = await syncChaves()
    if (!gKey && !cKey) { setErro('Configure Gemini ou Claude em Admin → API Keys'); return }
    setBuscandoAuto(true); setErro(''); setProgresso('')
    try {
      // PASSO 1: Extrair links dos PDFs da página do leilão
      const urlsExist = docs.map(d => d.url || d.url_origem).filter(Boolean)
      const { links } = await buscarDocumentosAuto(imovel, gKey, setProgresso)
      if (links?.length > 0) setLinksEncontrados(links)
      if (!links?.length) { setProgresso('Nenhum documento encontrado na página. Tente upload manual.'); setBuscandoAuto(false); return }
      const linksNovos = links.filter(l => !urlsExist.includes(l.url))
      // FIX: Docs com heurística sem URL — atualizar com URLs descobertas antes de prosseguir
      const docsHeuristicos = docs.filter(d => d.analise_ia?.includes('heurística') && !(d.url_origem || d.url))
      if (docsHeuristicos.length > 0 && links.length > 0) {
        setProgresso(`🔗 Vinculando ${docsHeuristicos.length} doc(s) sem URL a PDFs encontrados...`)
        for (const dh of docsHeuristicos) {
          const tipoDoc = (dh.tipo || dh.nome || '').toLowerCase()
          const linkMatch = links.find(l => l.tipo === tipoDoc)
            || links.find(l => tipoDoc.includes('matri') && (l.tipo === 'matricula' || l.nome?.toLowerCase().includes('rgi')))
            || links.find(l => tipoDoc.includes('edital') && l.tipo === 'edital')
          if (linkMatch) {
            try {
              await salvarDocumentoJuridico({
                id: dh.id, imovel_id: imovel.id, tipo: dh.tipo,
                url: linkMatch.url, url_origem: linkMatch.url
              })
              // Remover da lista de "novos" pra não duplicar
              const idx = linksNovos.findIndex(l => l.url === linkMatch.url)
              if (idx >= 0) linksNovos.splice(idx, 1)
              setProgresso(`✅ ${dh.nome || dh.tipo} → URL vinculada`)
            } catch(e) { console.warn('[AXIS] vincular URL:', e.message) }
          }
        }
        // Recarregar docs com URLs atualizadas
        await carregarDocs()
      }
      if (!linksNovos.length && docsHeuristicos.length === 0) { setProgresso(`✅ Todos os ${links.length} documento(s) já estão no banco`); setBuscandoAuto(false); setSubAba('documentos'); return }
      if (linksNovos.length < links.length) setProgresso(`ℹ️ ${links.length-linksNovos.length} já existe(m) — baixando ${linksNovos.length} novo(s)...`)
      // PASSO 2: Pipeline completo — download + Gemini Vision para PDFs escaneados
      const sb = supabase
      const { data: { session } } = await sb.auth.getSession()
      const resultsFull = []
      for (const link of linksNovos.slice(0,4)) {
        const { oKey: _oKey } = await syncChaves()
        const res = await processarDocumentoCompleto({ url:link.url, nome:link.nome||link.tipo, tipo:link.tipo||'outro', imovel, geminiKey:gKey, claudeKey:cKey, openaiKey:_oKey, onProgress:setProgresso })
        resultsFull.push(res)
      }
      // PASSO 3: Salvar com todos os campos estruturados
      for (const res of resultsFull) {
        if (!res.sucesso) continue
        const a = res.analise_estruturada || res.analise
        // Se já foi pré-registrado pelo processarDocumentoCompleto, atualiza; senão cria
        await salvarDocumentoJuridico({
          ...(res.pre_registro_id ? { id: res.pre_registro_id } : {}),
          imovel_id:imovel.id, nome:res.nome||'Documento', tipo:res.tipo||'outro',
          url:res.url_origem, url_storage:res.url_storage, url_origem:res.url_origem,
          tamanho_bytes:res.tamanho_bytes||0,
          analise_ia:a?.parecer_final||a?.resumo_executivo||'',
          riscos_encontrados:a?.riscos_identificados||[],
          score_juridico_sugerido:a?.score_juridico_sugerido||null,
          score_viabilidade:res.score_viabilidade||a?.metricas_viabilidade?.score_geral||null,
          resumo_executivo:res.resumo_executivo||a?.resumo_executivo||'',
          pontos_positivos:a?.pontos_positivos||[],
          alertas_criticos:a?.alertas_criticos||[],
          responsabilidade_debitos:a?.responsabilidade_debitos||null,
          ocupacao_confirmada:a?.ocupacao_confirmada||null,
          prazo_liberacao_meses:a?.prazo_liberacao_estimado_meses||null,
          recomendacao_juridica:a?.recomendacao_juridica||null,
          metricas_viabilidade:a?.metricas_viabilidade||null,
          analise_estruturada:a||null, conteudo_texto:res.conteudo_texto||null,
          processado:!!a, reclassificado:false,
          analisado_em:new Date().toISOString(), user_id:session?.user?.id
        }).catch(e=>{
          console.error('[AXIS save doc] FALHA:', e.message)
          setProgresso(`⚠️ Erro ao salvar ${res.nome}: ${e.message.substring(0,80)}`)
        })
      }
      // PASSO 4: Recalcular score jurídico com base nos documentos
      const analises = resultsFull.filter(r=>r.analise||r.analise_estruturada).map(r=>r.analise||r.analise_estruturada)
      if (analises.length>0) {
        const { novoScore, delta } = calcularNovoScoreJuridico(imovel.score_juridico||7, analises)
        if (onReclassificado&&delta!==0) { try { await reclassificarImovel(imovel.id,{score_juridico:novoScore,reclassificado_por_doc:true},null); onReclassificado({...imovel,score_juridico:novoScore}) } catch(e){} }
        setProgresso(`✅ ${resultsFull.length} doc(s) — ${analises.length} com parecer IA jurídico. Score: ${novoScore}/10`)
      } else { setProgresso(`⚠️ ${resultsFull.filter(r=>r.sucesso).length} doc(s) baixado(s) mas sem análise IA — configure Gemini`) }
      await carregarDocs(); setSubAba('documentos')
    } catch(e) { setErro(e.message) }
    setBuscandoAuto(false)
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    let { gKey, cKey } = await syncChaves()
    if (!gKey && !cKey) { setErro('Configure Gemini ou Claude em Admin → API Keys'); return }
    setAnalisando(true); setErro('')
    for (const file of files) {
      setProgresso(`Processando ${file.name}...`)
      try {
        const tipo = file.type.includes('image') ? 'imagem' : file.type.includes('pdf') ? 'pdf' : 'txt'
        let analise = null
        if (tipo === 'txt') {
          const texto = await file.text()
          analise = await analisarTextoJuridicoGemini(texto, file.name, imovel, gKey || cKey)
        } else if (tipo === 'pdf' && (gKey || cKey)) {
          let texto = null
          try { texto = await file.text(); if (texto.includes('%PDF')) texto = null } catch {}
          if (texto) {
              analise = await analisarTextoJuridicoGemini(texto, file.name, imovel, gKey || cKey)
          } else {
            setProgresso(`Enviando ${file.name} para análise IA...`)
            const base64 = await new Promise((res, rej) => {
              const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file)
            })
            if (gKey) {
              analise = await analisarPDFBase64Gemini(base64, file.name, imovel, gKey)
            } else {
              try {
                const bytes = atob(base64)
                const textoExtraido = bytes.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g,' ')
                  .match(/\(([^)]{4,200})\)/g)?.map(m=>m.slice(1,-1)).filter(s=>s.length>5&&/[a-zA-ZÀ-ÿ]/.test(s)).join(' ').substring(0,6000)||''
                if (textoExtraido.length > 100) {
                          analise = await analisarTextoJuridicoGemini(textoExtraido, file.name, imovel, cKey)
                }
              } catch(e2) {}
            }
          }
        } else if (tipo === 'imagem') {
          const oKey = localStorage.getItem('axis-openai-key') || ''
          const base64 = await new Promise((res, rej) => {
            const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file)
          })
          try {
              analise = await analisarImagemJuridicaGPT(base64, file.type, file.name, imovel, oKey)
          } catch(e) {}
        }
        if (analise) await processarResultados([{ nome: file.name, tipo, analise }])
        else setProgresso(`⚠️ Análise de ${file.name} não retornou resultado`)
      } catch(e) { setErro(`Erro: ${e.message}`) }
    }
    setAnalisando(false); setProgresso('')
    await carregarDocs()
    setSubAba('documentos')
  }

  const processarResultados = async (resultados) => {
    const { data: { session } } = await supabase.auth.getSession()
    for (const res of resultados) {
      if (!res.analise) continue
      setProgresso(`Salvando ${res.nome}...`)
      await salvarDocumentoJuridico({
        imovel_id: imovel.id, nome: res.nome, tipo: res.tipo || 'outro',
        tamanho_bytes: 0,
        analise_ia: res.analise.parecer || res.analise.parecer_resumido || res.analise.parecer_final || '',
        riscos_encontrados: res.analise.riscos_identificados || [],
        score_juridico_sugerido: res.analise.score_juridico_sugerido || null,
        score_viabilidade: res.analise.metricas_viabilidade?.score_geral || null,
        resumo_executivo: res.analise.resumo_executivo || '',
        pontos_positivos: res.analise.pontos_positivos || [],
        alertas_criticos: res.analise.alertas_criticos || [],
        responsabilidade_debitos: res.analise.responsabilidade_debitos || null,
        metricas_viabilidade: res.analise.metricas_viabilidade || null,
        analise_estruturada: res.analise,
        recomendacao_juridica: res.analise.recomendacao_juridica || null,
        conteudo_texto: res.texto?.substring(0,8000) || null,
        processado: true, reclassificado: false,
        analisado_em: new Date().toISOString(),
        user_id: session?.user?.id
      }).catch(e => console.warn('[AXIS save doc]', e.message))
    }
    const todasAnalises = resultados.map(r => r.analise).filter(Boolean)
    // Sprint 11: propagar campos extraídos do edital para o imóvel
    const camposExtraidos = {}
    for (const a of todasAnalises) {
      if (a.praca && !imovel.praca) camposExtraidos.praca = a.praca
      if (a.parcelamento_aceito != null) camposExtraidos.parcelamento_aceito = a.parcelamento_aceito
      if (a.parcelamento_detalhes) camposExtraidos.parcelamento_detalhes = a.parcelamento_detalhes
      if (a.coproprietarios) camposExtraidos.coproprietarios = a.coproprietarios
      if (a.area_construida_m2 && !imovel.area_construida_m2) camposExtraidos.area_construida_m2 = a.area_construida_m2
      if (a.elevador != null && imovel.elevador == null) camposExtraidos.elevador = a.elevador
      if (a.nome_condominio && !imovel.nome_condominio) camposExtraidos.nome_condominio = a.nome_condominio
    }
    if (Object.keys(camposExtraidos).length > 0) {
      try {
        await supabase.from('imoveis').update(camposExtraidos).eq('id', imovel.id)
        console.debug('[AXIS jurídico] Campos propagados:', Object.keys(camposExtraidos))
      } catch(e) { console.warn('[AXIS jurídico] propagar campos:', e.message) }
    }
    const { novoScore, delta } = calcularNovoScoreJuridico(imovel.score_juridico || 7, todasAnalises)
    if (onReclassificado && delta !== 0) {
      try {
        await reclassificarImovel(imovel.id, { novo_score_juridico: novoScore, nova_recomendacao: null, parecer_final: `Reclassificado por análise documental. Score: ${novoScore}` }, null)
        onReclassificado({ ...imovel, score_juridico: novoScore, score_juridico_manual: novoScore })
      } catch(e) { console.warn('[AXIS jurídico] reclassificar:', e.message) }
    }
    await carregarDocs()
    const com = resultados.filter(r => r.analise).length
    setProgresso(`✅ ${com} documento(s) analisado(s). Score jurídico: ${novoScore}`)
  }

  const fmt = v => v != null ? String(v) : '—'

  // ─── QUADRO RESUMO DOS DOCUMENTOS ──────────────────────────────────────────
  const docsComAnalise = docs.filter(d => d.processado || d.analise_estruturada)
  const scoresMed = docsComAnalise.map(d => d.score_viabilidade || d.score_juridico_sugerido).filter(s => s > 0)
  const scoreMedDoc = scoresMed.length ? (scoresMed.reduce((a,b)=>a+b,0)/scoresMed.length) : null
  const riscosCriticos = docs.flatMap(d => (d.riscos_encontrados||[]).filter(r=>r.gravidade==='critico'||r.gravidade==='alto'))
  const recGeral = docs.some(d=>d.recomendacao_juridica==='desfavoravel') ? 'desfavoravel'
    : docs.every(d=>!d.recomendacao_juridica||d.recomendacao_juridica==='favoravel') && docs.length > 0 ? 'favoravel' : 'neutro'

  // Analisar documento existente via IA
  async function handleAnalisarDoc(doc) {
    setProgresso(`🤖 Analisando ${doc.nome || doc.tipo}...`)
    try {
      const { gKey, cKey } = await syncChaves()
      const { oKey: openaiKeyDoc } = await syncChaves()
      let res = null

      // CAMINHO 1: Se já tem texto salvo E LEGÍVEL, analisar direto (sem re-download)
      const { isTextoLegivel } = await import('../lib/agenteJuridico.js')
      if (doc.conteudo_texto && doc.conteudo_texto.length > 100 && isTextoLegivel(doc.conteudo_texto)) {
        setProgresso(`📄 Usando texto salvo (${(doc.conteudo_texto.length / 1000).toFixed(0)}k chars)...`)
        const { analisarTextoJuridicoGemini } = await import('../lib/agenteJuridico.js')
        const analise = await analisarTextoJuridicoGemini(doc.conteudo_texto, doc.nome || doc.tipo, imovel, gKey)
        if (analise) {
          res = {
            analise_ia: analise.parecer || analise.resumo,
            resumo_executivo: analise.resumo,
            riscos_encontrados: analise.riscos_identificados || [],
            score_juridico_sugerido: analise.score_juridico_sugerido,
            score_viabilidade: analise.score_juridico_sugerido,
            responsabilidade_debitos: analise.responsabilidade_debitos,
            ocupacao_confirmada: analise.ocupacao_confirmada,
            recomendacao_juridica: analise.recomendacao_juridica,
            pontos_positivos: analise.pontos_positivos || [],
            alertas_criticos: analise.alertas_criticos || [],
            analise_estruturada: analise,
            conteudo_texto: doc.conteudo_texto,
          }
        }
      }
      
      // CAMINHO 2: Re-download e análise completa (se tem URL e não conseguiu pelo texto)
      if (!res && (doc.url_origem || doc.url)) {
        res = await processarDocumentoCompleto({
          url: doc.url_origem || doc.url,
          nome: doc.nome || doc.tipo,
          tipo: doc.tipo || 'outro',
          imovel,
          geminiKey: gKey,
          claudeKey: cKey,
          openaiKey: openaiKeyDoc,
          onProgress: setProgresso
        })
        // Se processou mas o texto é ilegível, tentar Vision
        if (res && res.conteudo_texto && !isTextoLegivel(res.conteudo_texto) && !res.analise_estruturada) {
          res = null // forçar fallback Vision
        }
      }

      // CAMINHO 2.5: PDF Vision (texto corrompido → enviar PDF base64 ao Gemini Pro)
      if (!res && (doc.url_storage || doc.url_origem || doc.url) && gKey) {
        setProgresso(`🔬 Texto ilegível — Gemini Vision direto no PDF...`)
        try {
          const { analisarPDFBase64Gemini } = await import('../lib/agenteJuridico.js')
          const pdfUrl = doc.url_storage || doc.url_origem || doc.url
          const resp = await fetch(pdfUrl.startsWith('http') ? pdfUrl : `https://r.jina.ai/${pdfUrl}`, {
            signal: AbortSignal.timeout(30000)
          })
          if (resp.ok) {
            const buf = await resp.arrayBuffer()
            const bytes = new Uint8Array(buf)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64 = btoa(binary)
            setProgresso(`🤖 Gemini Vision analisando PDF (~45s)...`)
            const analise = await analisarPDFBase64Gemini(base64, doc.nome || doc.tipo, imovel, gKey)
            if (analise) {
              res = {
                analise_ia: analise.parecer || analise.resumo || JSON.stringify(analise).substring(0,500),
                resumo_executivo: analise.resumo,
                riscos_encontrados: analise.riscos_identificados || [],
                score_juridico_sugerido: analise.score_juridico_sugerido,
                score_viabilidade: analise.score_juridico_sugerido,
                responsabilidade_debitos: analise.responsabilidade_debitos,
                ocupacao_confirmada: analise.ocupacao_confirmada,
                recomendacao_juridica: analise.recomendacao_juridica,
                pontos_positivos: analise.pontos_positivos || [],
                alertas_criticos: analise.alertas_criticos || [],
                analise_estruturada: { ...analise, _via: 'gemini-vision-pdf' },
              }
            }
          }
        } catch(e) { console.warn('[AXIS] Vision fallback:', e.message) }
      }

      // CAMINHO 3: Sem URL no doc — re-scrape a página fonte para descobrir URL do PDF
      if (!res && !(doc.url_origem || doc.url) && imovel.fonte_url) {
        setProgresso(`🔍 Buscando URL do ${doc.tipo || 'documento'} na página do leilão...`)
        try {
          const { buscarDocumentosAuto } = await import('../lib/agenteJuridico.js')
          const { links } = await buscarDocumentosAuto(imovel, gKey, setProgresso)
          // Tentar casar tipo do doc com tipo do link encontrado
          const tipoDoc = (doc.tipo || doc.nome || '').toLowerCase()
          let linkMatch = links.find(l => l.tipo === tipoDoc)
            || links.find(l => tipoDoc.includes('matri') && (l.tipo === 'matricula' || l.nome?.toLowerCase().includes('matri') || l.nome?.toLowerCase().includes('rgi')))
            || links.find(l => tipoDoc.includes('edital') && l.tipo === 'edital')
            || links.find(l => tipoDoc.includes('pdf') && l.tipo !== 'outro')
          // Se não achou por tipo, pegar pela ordem de prioridade
          if (!linkMatch && links.length > 0) {
            const docsJaSalvos = docs.filter(d => d.id !== doc.id).map(d => d.url_origem || d.url).filter(Boolean)
            linkMatch = links.find(l => !docsJaSalvos.includes(l.url))
          }
          if (linkMatch) {
            setProgresso(`✅ URL encontrada: ${linkMatch.nome || linkMatch.tipo} — processando...`)
            res = await processarDocumentoCompleto({
              url: linkMatch.url,
              nome: doc.nome || linkMatch.nome || doc.tipo,
              tipo: doc.tipo || linkMatch.tipo || 'outro',
              imovel,
              geminiKey: gKey,
              claudeKey: cKey,
              openaiKey: openaiKeyDoc,
              onProgress: setProgresso
            })
            // Salvar URL descoberta no doc para próximas vezes
            if (res) res.url_origem_descoberta = linkMatch.url
          } else {
            setProgresso(`⚠️ Nenhum PDF de ${doc.tipo} encontrado na página do leilão`)
          }
        } catch(e) {
          setProgresso(`⚠️ Busca automática falhou: ${e.message?.substring(0,60)}`)
        }
      }

      if (!res) {
        setProgresso(`⚠️ Sem URL e sem texto salvo — faça upload manual do PDF`)
        return
      }

      if (res?.analise_ia || res?.analise_estruturada) {
        await salvarDocumentoJuridico({
          id: doc.id,
          imovel_id: imovel.id,
          tipo: doc.tipo,
          // Gravar URL descoberta pelo CAMINHO 3 (se não tinha antes)
          ...(res.url_origem_descoberta ? { url: res.url_origem_descoberta, url_origem: res.url_origem_descoberta } : {}),
          ...(res.url_origem ? { url: res.url_origem, url_origem: res.url_origem } : {}),
          analise_ia: res.analise_ia,
          resumo_executivo: res.resumo_executivo,
          pontos_positivos: res.pontos_positivos,
          alertas_criticos: res.alertas_criticos,
          riscos_encontrados: res.riscos_encontrados,
          score_juridico_sugerido: res.score_juridico_sugerido,
          score_viabilidade: res.score_viabilidade,
          responsabilidade_debitos: res.responsabilidade_debitos,
          ocupacao_confirmada: res.ocupacao_confirmada,
          recomendacao_juridica: res.recomendacao_juridica,
          metricas_viabilidade: res.metricas_viabilidade,
          analise_estruturada: res.analise_estruturada,
          conteudo_texto: res.conteudo_texto,
          processado: true, status: 'analisado',
          analisado_em: new Date().toISOString(),
        }).catch(e => console.warn('[AXIS handleAnalisarDoc]', e.message))
        // Sprint 11: propagar campos do edital para o imóvel
        const a = res.analise_estruturada || {}
        const upd = {}
        if (a.praca && !imovel.praca) upd.praca = a.praca
        if (a.parcelamento_aceito != null) upd.parcelamento_aceito = a.parcelamento_aceito
        if (a.parcelamento_detalhes) upd.parcelamento_detalhes = a.parcelamento_detalhes
        if (a.coproprietarios) upd.coproprietarios = a.coproprietarios
        if (a.area_construida_m2 && !imovel.area_construida_m2) upd.area_construida_m2 = a.area_construida_m2
        if (a.elevador != null && imovel.elevador == null) upd.elevador = a.elevador
        if (a.nome_condominio && !imovel.nome_condominio) upd.nome_condominio = a.nome_condominio
        if (Object.keys(upd).length > 0) {
          supabase.from('imoveis').update(upd).eq('id', imovel.id).then(() => {
            console.debug('[AXIS jurídico] Campos extraídos do edital:', Object.keys(upd))
          }).catch(() => {})
        }
        // Sprint 12.2: salvar timeline da matrícula
        if (a.timeline_atos?.length > 0) {
          const rows = a.timeline_atos.map(ev => ({
            imovel_id: imovel.id,
            data_evento: ev.data || null,
            tipo: ev.tipo || 'outro',
            registro: ev.registro || null,
            descricao: ev.descricao || '',
            valor: ev.valor || null,
            partes: ev.partes || null,
            gravidade: ev.gravidade || 'info',
          }))
          supabase.from('timeline_matricula').upsert(rows, { onConflict: 'imovel_id,registro', ignoreDuplicates: true })
            .then(() => console.debug(`[AXIS] ${rows.length} atos da matrícula salvos`))
            .catch(() => {})
        }
        setProgresso(`✅ ${doc.nome || doc.tipo} analisado — recarregando...`)
        await carregarDocs()
      } else {
        setProgresso(`⚠️ Sem análise — verifique a chave Gemini em Admin → API Keys`)
      }
    } catch(e) {
      setProgresso(`❌ Erro: ${e.message?.substring(0,80)}`)
    }
  }

  return (
    <div>
      {/* Sub-abas */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.borderW}`, marginBottom:14 }}>
        {[
          { id:'situacao', label:`⚖️ Situação Jurídica` },
          { id:'documentos', label:`📄 Documentos${docs.length>0?` (${docs.length})`:''}` },
        ].map(s => (
          <button key={s.id} onClick={() => setSubAba(s.id)} style={{
            background:'none', border:'none', padding:'8px 14px', fontSize:12.5, cursor:'pointer',
            fontWeight: subAba===s.id ? 700 : 400,
            color: subAba===s.id ? C.navy : C.muted,
            borderBottom: subAba===s.id ? `2px solid ${C.navy}` : '2px solid transparent',
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── SUB-ABA: SITUAÇÃO JURÍDICA ─────────────────────────────────────── */}
      {subAba === 'situacao' && (
        <div>
          <div style={{...card(), padding:14, marginBottom:12}}>
            <div style={{fontWeight:600, color:C.navy, fontSize:13, marginBottom:10}}>Situação Jurídica</div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {[
                ['Processos', imovel.processos_ativos || 'Nenhum identificado'],
                ['Matrícula', imovel.matricula_status || 'Não verificada'],
                ['Déb. Condomínio', imovel.debitos_condominio || 'Não informado'],
                ['Déb. IPTU', imovel.debitos_iptu || 'Não informado'],
                ['Responsabilidade', imovel.responsabilidade_debitos === 'sub_rogado' ? '✅ Sub-rogado' : imovel.responsabilidade_debitos || '—'],
                ['Score jurídico', imovel.score_juridico != null ? `${imovel.score_juridico}/10` : '—'],
              ].map(([l, v]) => (
                <div key={l} style={{padding:'6px 0', borderBottom:`1px solid ${C.borderW}`}}>
                  <div style={{fontSize:10, color:C.hint}}>{l}</div>
                  <div style={{fontSize:12, color:C.text, fontWeight:500}}>{v}</div>
                </div>
              ))}
            </div>
            {imovel.obs_juridicas && (
              <div style={{marginTop:8, fontSize:11, color:C.muted, padding:'6px 10px', background:C.surface, borderRadius:6}}>
                {imovel.obs_juridicas}
              </div>
            )}
          </div>

          {/* Quadro resumo dos docs se existirem */}
          {docs.length > 0 && (
            <div style={{ padding:'10px 12px', borderRadius:9, marginBottom:12,
              background:P.navyL, border:`1px solid ${P.navy}20` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:P.navy }}>
                  📄 {docs.length} documento(s) analisado(s)
                </span>
                {scoreMedDoc != null && (
                  <span style={{ fontSize:13, fontWeight:800,
                    color: scoreMedDoc>=7 ? P.emerald : scoreMedDoc>=5 ? P.mustard : P.red }}>
                    {scoreMedDoc.toFixed(1)}/10
                  </span>
                )}
              </div>
              {recGeral !== 'neutro' && (
                <div style={{ fontSize:11, padding:'3px 8px', borderRadius:5, display:'inline-block', marginBottom:6,
                  background: recGeral==='favoravel' ? P.emeraldL : P.redL,
                  color: recGeral==='favoravel' ? P.emerald : P.red, fontWeight:700 }}>
                  {recGeral==='favoravel' ? '✅ Juridicamente Favorável' : '❌ Riscos Significativos Identificados'}
                </div>
              )}
              {riscosCriticos.length > 0 && (
                <div style={{ fontSize:11, color:P.red, fontWeight:600, marginBottom:4 }}>
                  ⚠️ {riscosCriticos.length} risco(s) crítico(s)/alto(s)
                </div>
              )}
              <button onClick={() => setSubAba('documentos')}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:`1px solid ${P.navy}30`,
                  background:'#fff', color:P.navy, cursor:'pointer', fontWeight:600 }}>
                Ver análise completa dos documentos →
              </button>
            </div>
          )}

          {isAdmin && (
            <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
              <button onClick={() => { buscarAuto() }} disabled={buscandoAuto || analisando} style={{
                ...btn('s'), background:C.navy, color:'#fff', border:'none', opacity:(buscandoAuto||analisando)?0.6:1
              }}>
                {buscandoAuto ? '🔍 Buscando...' : '🤖 Buscar documentos automaticamente'}
              </button>
              <label style={{...btn('s'), cursor:'pointer', background:C.surface, border:`1px solid ${C.borderW}`}}>
                📎 Upload manual (PDF/TXT)
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={handleUpload}
                  style={{display:'none'}} disabled={analisando || buscandoAuto}/>
              </label>
            </div>
          )}

          {(progresso || erro) && (
            <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, fontSize:12,
              background: erro ? '#FCEBEB' : `${C.emerald}08`,
              border:`1px solid ${erro ? '#E24B4A30' : `${C.emerald}30`}`,
              color: erro ? '#A32D2D' : C.text }}>
              {erro || progresso}
            </div>
          )}

          {docs.length === 0 && !analisando && !buscandoAuto && (
            <div style={{textAlign:'center', padding:'24px', color:C.hint, fontSize:12}}>
              <div style={{fontSize:32, marginBottom:8}}>⚖️</div>
              <div style={{fontWeight:600, color:C.muted, marginBottom:4}}>Nenhum documento analisado</div>
              {isAdmin ? 'Clique em "Buscar documentos automaticamente".' : 'Aguardando análise jurídica.'}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-ABA: DOCUMENTOS ────────────────────────────────────────────── */}
      {subAba === 'documentos' && (
        <div>
          {/* Ações */}
          {isAdmin && (
            <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
              <button onClick={buscarAuto} disabled={buscandoAuto || analisando} style={{
                ...btn('s'), background:C.navy, color:'#fff', border:'none', opacity:(buscandoAuto||analisando)?0.6:1
              }}>
                {buscandoAuto ? '🔍 Buscando...' : '🤖 Buscar e analisar documentos'}
              </button>
              <label style={{...btn('s'), cursor:'pointer', background:C.surface, border:`1px solid ${C.borderW}`}}>
                📎 Upload manual
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={handleUpload}
                  style={{display:'none'}} disabled={analisando || buscandoAuto}/>
              </label>
            </div>
          )}

          {(progresso || erro) && (
            <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, fontSize:12,
              background: erro ? '#FCEBEB' : `${C.emerald}08`,
              border:`1px solid ${erro ? '#E24B4A30' : `${C.emerald}30`}`,
              color: erro ? '#A32D2D' : C.text }}>
              {erro || progresso}
            </div>
          )}

          {/* Quadro resumo */}
          {docs.length > 0 && (
            <div style={{ padding:'10px 12px', borderRadius:9, marginBottom:12,
              background: recGeral==='favoravel' ? P.emeraldL : recGeral==='desfavoravel' ? P.redL : P.mustardL,
              border:`1px solid ${recGeral==='favoravel' ? P.emerald : recGeral==='desfavoravel' ? P.red : P.mustard}30` }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                <div style={{ textAlign:'center', padding:'6px', background:P.white, borderRadius:7 }}>
                  <div style={{ fontSize:18 }}>
                    {recGeral==='favoravel' ? '✅' : recGeral==='desfavoravel' ? '❌' : '⚠️'}
                  </div>
                  <div style={{ fontSize:9, color:P.gray, marginTop:2 }}>Recomendação geral</div>
                </div>
                <div style={{ textAlign:'center', padding:'6px', background:P.white, borderRadius:7 }}>
                  <div style={{ fontSize:20, fontWeight:800,
                    color: scoreMedDoc>=7 ? P.emerald : scoreMedDoc>=5 ? P.mustard : P.red }}>
                    {scoreMedDoc != null ? scoreMedDoc.toFixed(1) : '—'}
                  </div>
                  <div style={{ fontSize:9, color:P.gray }}>Score médio</div>
                </div>
                <div style={{ textAlign:'center', padding:'6px', background:P.white, borderRadius:7 }}>
                  <div style={{ fontSize:20, fontWeight:800, color: riscosCriticos.length===0 ? P.emerald : P.red }}>
                    {riscosCriticos.length}
                  </div>
                  <div style={{ fontSize:9, color:P.gray }}>Riscos críticos</div>
                </div>
              </div>
            </div>
          )}

          {/* Lista de documentos */}
          {(() => {
            const heuristicos = docs.filter(d => d.analise_ia?.includes('heurística'))
            if (heuristicos.length > 0) return (
              <div style={{ display:'flex', justifyContent:'center', marginBottom:12 }}>
                <button onClick={async () => {
                  for (const d of heuristicos) await handleAnalisarDoc(d)
                }} disabled={analisando}
                  style={{ padding:'8px 20px', borderRadius:8, background:'#7C3AED', color:'#fff',
                    border:'none', cursor:analisando?'wait':'pointer', fontWeight:700, fontSize:12,
                    display:'flex', alignItems:'center', gap:6, opacity:analisando?0.6:1 }}>
                  🤖 Reanalisar {heuristicos.length} doc(s) com IA completa
                </button>
              </div>
            )
            return null
          })()}
          {docs.length > 0
            ? docs.map(doc => <CardDoc key={doc.id} doc={doc} onAnalisarDoc={handleAnalisarDoc}/>)
            : !analisando && !buscandoAuto && (
              <div style={{textAlign:'center', padding:'32px', color:C.hint, fontSize:12}}>
                <div style={{fontSize:32, marginBottom:8}}>📂</div>
                <div style={{fontWeight:600, color:C.muted, marginBottom:4}}>Nenhum documento analisado</div>
                <div style={{fontSize:11, lineHeight:1.6}}>
                  {isAdmin ? 'Clique em "Buscar e analisar documentos" para baixar o edital e a matrícula.' : 'Aguardando análise.'}
                </div>
              </div>
            )
          }

          {/* Links encontrados sem download */}
          {linksEncontrados.length > 0 && docs.length === 0 && (
            <div style={{...card(), padding:12, marginTop:8}}>
              <div style={{fontSize:11, fontWeight:600, color:C.muted, marginBottom:6}}>
                Links identificados ({linksEncontrados.length}) — download não concluído
              </div>
              {linksEncontrados.slice(0,6).map((l, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:11}}>
                  <span style={{color:C.navy, fontWeight:500}}>{l.nome || l.tipo}</span>
                  <a href={l.url} target="_blank" rel="noreferrer"
                    style={{color:C.teal, fontSize:10, textDecoration:'none'}}>Abrir PDF →</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
