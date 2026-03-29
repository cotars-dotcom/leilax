import { useState, useEffect } from 'react'
import { C, K, btn, card } from '../appConstants.js'
import { supabase } from '../lib/supabase.js'

const GRAVIDADE_COR = { critico:'#A32D2D', alto:C.mustard, medio:'#185FA5', baixo:C.emerald }
const GRAVIDADE_BG  = { critico:'#FCEBEB', alto:'#FAEEDA', medio:'#E6F1FB', baixo:C.emeraldL }

export default function AbaJuridicaAgente({ imovel, isAdmin, onReclassificado }) {
  const [docs, setDocs] = useState([])
  const [analisando, setAnalisando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')
  const [buscandoAuto, setBuscandoAuto] = useState(false)

  useEffect(() => {
    if (!imovel?.id) return
    import('../lib/supabase.js').then(({ getDocumentosJuridicos }) =>
      getDocumentosJuridicos(imovel.id).then(setDocs).catch(() => {})
    )
  }, [imovel?.id])

  const geminiKey = () => localStorage.getItem('axis-gemini-key') || ''
  const claudeKey = () => localStorage.getItem('axis-api-key') || ''

  // Busca automática de documentos da URL do imóvel
  const buscarAuto = async () => {
    if (!imovel.fonte_url) { setErro('Imóvel sem URL de origem'); return }
    const gKey = geminiKey()
    if (!gKey) { setErro('Configure a chave Gemini em Admin → API Keys'); return }

    setBuscandoAuto(true); setErro(''); setProgresso('')
    try {
      const { buscarDocumentosAuto } = await import('../lib/agenteJuridico.js')
      const { documentos } = await buscarDocumentosAuto(imovel, gKey, setProgresso)

      if (documentos.length === 0) {
        setProgresso('Nenhum documento encontrado automaticamente. Faça upload manual.')
        setBuscandoAuto(false); return
      }

      // Salvar e reclassificar
      await processarResultados(documentos)
    } catch(e) {
      setErro('Erro na busca automática: ' + e.message)
    }
    setBuscandoAuto(false)
  }

  // Upload manual de arquivo
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const gKey = geminiKey()
    const cKey = claudeKey()
    if (!gKey && !cKey) { setErro('Configure Gemini ou Claude em Admin → API Keys'); return }

    setAnalisando(true); setErro('')

    for (const file of files) {
      setProgresso(`Processando ${file.name}...`)
      try {
        const tipo = file.type.includes('image') ? 'imagem' : file.type.includes('pdf') ? 'pdf' : 'txt'
        let analise = null

        if (tipo === 'txt') {
          const texto = await file.text()
          const { analisarTextoJuridicoGemini } = await import('../lib/agenteJuridico.js')
          analise = await analisarTextoJuridicoGemini(texto, file.name, imovel, gKey || cKey)
        } else if (tipo === 'pdf' && gKey) {
          // Tentar texto primeiro
          let texto = null
          try { texto = await file.text(); if (texto.includes('%PDF')) texto = null } catch {}
          if (texto) {
            const { analisarTextoJuridicoGemini } = await import('../lib/agenteJuridico.js')
            analise = await analisarTextoJuridicoGemini(texto, file.name, imovel, gKey)
          } else {
            // PDF binário — enviar base64 para Gemini
            setProgresso(`Enviando ${file.name} para análise IA...`)
            const base64 = await new Promise((res, rej) => {
              const r = new FileReader()
              r.onload = () => res(r.result.split(',')[1])
              r.onerror = rej
              r.readAsDataURL(file)
            })
            const { analisarPDFBase64Gemini } = await import('../lib/agenteJuridico.js')
            analise = await analisarPDFBase64Gemini(base64, file.name, imovel, gKey)
          }
        } else if (tipo === 'imagem') {
          // Imagem — usar Claude GPT para analisar
          const { analisarImagemJuridicaGPT } = await import('../lib/analisadorJuridico.js')
          const oKey = localStorage.getItem('axis-openai-key') || ''
          const base64 = await new Promise((res, rej) => {
            const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file)
          })
          analise = await analisarImagemJuridicaGPT(base64, file.type, file.name, imovel, oKey)
        }

        if (analise) {
          await processarResultados([{ nome: file.name, tipo, analise }])
        }
      } catch(e) {
        setErro(`Erro ao processar ${file.name}: ${e.message}`)
      }
    }
    setAnalisando(false); setProgresso('')
  }

  const processarResultados = async (resultados) => {
    const { salvarDocumentoJuridico, reclassificarImovel } = await import('../lib/supabase.js')
    const { calcularNovoScoreJuridico } = await import('../lib/agenteJuridico.js')
    const { data: { session } } = await supabase.auth.getSession()

    const novosDocsIds = []
    for (const res of resultados) {
      if (!res.analise) continue
      setProgresso(`Salvando análise de ${res.nome}...`)
      const doc = await salvarDocumentoJuridico({
        imovel_id: imovel.id,
        nome: res.nome,
        tipo: res.tipo || 'outro',
        tamanho_bytes: 0,
        analise_ia: res.analise.parecer || res.analise.resumo,
        riscos_encontrados: res.analise.riscos_identificados || [],
        score_juridico_sugerido: res.analise.score_juridico_sugerido,
        reclassificado: false,
        analisado_em: new Date().toISOString(),
        user_id: session?.user?.id
      })
      if (doc) novosDocsIds.push(doc)
    }

    // Recalcular score jurídico com todos os documentos
    const todasAnalises = resultados.map(r => r.analise).filter(Boolean)
    const { novoScore, delta, riscos } = calcularNovoScoreJuridico(imovel.score_juridico || 7, todasAnalises)

    setProgresso(`Score jurídico atualizado: ${imovel.score_juridico || 7} → ${novoScore}`)

    // Reclassificar imóvel
    if (onReclassificado && delta !== 0) {
      try {
        await reclassificarImovel(imovel.id, { score_juridico: novoScore, reclassificado_por_doc: true }, null)
        onReclassificado({ ...imovel, score_juridico: novoScore, score_juridico_manual: novoScore })
      } catch(e) { console.warn('[AXIS jurídico] reclassificar:', e.message) }
    }

    // Recarregar docs
    const { getDocumentosJuridicos } = await import('../lib/supabase.js')
    const docsAtuais = await getDocumentosJuridicos(imovel.id).catch(() => [])
    setDocs(docsAtuais)
    setProgresso(`✅ ${resultados.length} documento(s) analisado(s). Score jurídico: ${novoScore}`)
  }

  const fmt = v => v != null ? String(v) : '—'

  return (
    <div>
      {/* Header jurídico do imóvel */}
      <div style={{...card(), padding:14, marginBottom:12}}>
        <div style={{fontWeight:600, color:C.navy, fontSize:13, marginBottom:10}}>Situação Jurídica</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          {[
            ['Processos', imovel.processos_ativos || 'Nenhum identificado'],
            ['Matrícula', imovel.matricula_status || 'Não verificada'],
            ['Déb. Condomínio', imovel.debitos_condominio || 'Não informado'],
            ['Déb. IPTU', imovel.debitos_iptu || 'Não informado'],
            ['Responsabilidade', imovel.responsabilidade_debitos === 'sub_rogado' ? '✅ Sub-rogado' : imovel.responsabilidade_debitos || '—'],
            ['Score jurídico', imovel.score_juridico != null ? `${imovel.score_juridico}/10${imovel.score_juridico_manual ? ' (manual)' : ''}` : '—'],
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

      {/* Ações */}
      {isAdmin && (
        <div style={{display:'flex', gap:8, marginBottom:12, flexWrap:'wrap'}}>
          <button onClick={buscarAuto} disabled={buscandoAuto || analisando} style={{
            ...btn('s'), background:C.navy, color:'#fff', border:'none', opacity:(buscandoAuto||analisando)?0.6:1
          }}>
            {buscandoAuto ? '🔍 Buscando...' : '🤖 Buscar documentos automaticamente'}
          </button>
          <label style={{...btn('s'), cursor:'pointer', background:C.surface, border:`1px solid ${C.borderW}`}}>
            📎 Upload manual (PDF/imagem/TXT)
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" onChange={handleUpload}
              style={{display:'none'}} disabled={analisando || buscandoAuto}/>
          </label>
        </div>
      )}

      {/* Status */}
      {(progresso || erro) && (
        <div style={{
          padding:'8px 12px', borderRadius:8, marginBottom:10, fontSize:12,
          background: erro ? '#FCEBEB' : `${C.emerald}08`,
          border: `1px solid ${erro ? '#E24B4A30' : `${C.emerald}30`}`,
          color: erro ? '#A32D2D' : C.text
        }}>
          {erro || progresso}
        </div>
      )}

      {/* Documentos analisados */}
      {docs.length > 0 && (
        <div>
          <div style={{fontSize:11, fontWeight:600, color:C.muted, marginBottom:8}}>
            {docs.length} documento(s) analisado(s)
          </div>
          {docs.map((doc, i) => {
            const riscos = doc.riscos_encontrados || []
            const criticos = riscos.filter(r => r.gravidade === 'critico' || r.gravidade === 'alto')
            return (
              <div key={i} style={{...card(), padding:14, marginBottom:8}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                  <div>
                    <div style={{fontSize:12, fontWeight:600, color:C.navy}}>{doc.nome}</div>
                    <div style={{fontSize:10, color:C.hint, marginTop:2}}>
                      {doc.tipo} · {new Date(doc.analisado_em || doc.criado_em).toLocaleDateString('pt-BR')}
                      {doc.score_juridico_sugerido != null && ` · Score sugerido: ${doc.score_juridico_sugerido}/10`}
                    </div>
                  </div>
                  {criticos.length > 0 && (
                    <span style={{fontSize:10, padding:'2px 8px', borderRadius:10, background:'#FCEBEB', color:'#A32D2D', fontWeight:600}}>
                      ⚠️ {criticos.length} risco(s)
                    </span>
                  )}
                </div>

                {doc.analise_ia && (
                  <div style={{fontSize:11, color:C.text, lineHeight:1.6, marginBottom:8, padding:'8px 10px', background:C.surface, borderRadius:6}}>
                    {doc.analise_ia}
                  </div>
                )}

                {riscos.length > 0 && (
                  <div>
                    {riscos.map((r, j) => (
                      <div key={j} style={{
                        padding:'6px 10px', borderRadius:6, marginBottom:4,
                        background: GRAVIDADE_BG[r.gravidade] || C.surface,
                        borderLeft: `3px solid ${GRAVIDADE_COR[r.gravidade] || C.muted}`
                      }}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2}}>
                          <span style={{fontSize:11, fontWeight:600, color: GRAVIDADE_COR[r.gravidade] || C.text}}>
                            {r.gravidade?.toUpperCase()} — {r.risco_id || r.descricao?.substring(0,30)}
                          </span>
                          {r.impacto_score && (
                            <span style={{fontSize:10, color:C.muted}}>Impacto: {r.impacto_score} pts</span>
                          )}
                        </div>
                        <div style={{fontSize:11, color:C.text}}>{r.descricao}</div>
                        {r.trecho_relevante && (
                          <div style={{fontSize:10, color:C.hint, marginTop:3, fontStyle:'italic'}}>
                            "{r.trecho_relevante.substring(0,150)}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {docs.length === 0 && !analisando && !buscandoAuto && (
        <div style={{textAlign:'center', padding:'24px', color:C.hint, fontSize:12}}>
          <div style={{fontSize:32, marginBottom:8}}>⚖️</div>
          <div style={{fontWeight:600, color:C.muted, marginBottom:4}}>Nenhum documento jurídico analisado</div>
          {isAdmin
            ? 'Clique em "Buscar documentos automaticamente" ou faça upload da matrícula/edital.'
            : 'Aguardando análise jurídica pelo administrador.'}
        </div>
      )}
    </div>
  )
}
