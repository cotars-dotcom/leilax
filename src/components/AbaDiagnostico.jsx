import { useState, useEffect } from 'react'
import { C } from '../appConstants.js'
import { supabase, loadApiKeys } from '../lib/supabase.js'
import { ANTHROPIC_VERSION, MODELOS_GEMINI } from '../lib/constants.js'

const CARD = { background:'#fff', border:`1px solid ${C.borderW}`, borderRadius:10, padding:'12px 14px', marginBottom:10 }
const TAG_OK = { background:'#ECFDF5', color:'#065F46', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, display:'inline-block' }
const TAG_ERRO = { background:'#FEF2F2', color:'#991B1B', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, display:'inline-block' }
const TAG_WARN = { background:'#FFFBEB', color:'#92400E', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, display:'inline-block' }

function StatusBadge({ status }) {
  if (status === 'ok') return <span style={TAG_OK}>✅ Ativo</span>
  if (status === 'erro') return <span style={TAG_ERRO}>❌ Falhou</span>
  if (status === 'invalido') return <span style={TAG_ERRO}>❌ Inválida</span>
  if (status === 'vazio') return <span style={TAG_WARN}>⚠️ Não configurada</span>
  if (status === 'testando') return <span style={TAG_WARN}>🔄 Testando...</span>
  return <span style={TAG_WARN}>? Desconhecido</span>
}

function LinhaChave({ nome, icone, chave, prefixo, status, modelo, latencia, custo, detalhe }) {
  return (
    <div style={{ padding:'10px 0', borderBottom:`1px solid ${C.borderW}`, display:'flex', alignItems:'flex-start', gap:10 }}>
      <div style={{ fontSize:20, flexShrink:0 }}>{icone}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
          <span style={{ fontSize:13, fontWeight:700, color:C.navy }}>{nome}</span>
          <StatusBadge status={status} />
          {modelo && <span style={{ fontSize:10, color:C.muted, fontStyle:'italic' }}>{modelo}</span>}
          {latencia && <span style={{ fontSize:10, color:C.muted }}>⚡ {latencia}ms</span>}
          {custo && <span style={{ fontSize:10, color:'#7C3AED', fontWeight:600 }}>💰 {custo}/análise</span>}
        </div>
        {chave && <div style={{ fontSize:10, color:C.muted, fontFamily:'monospace' }}>{prefixo}...{chave.slice(-4)}</div>}
        {detalhe && <div style={{ fontSize:11, color: status==='ok' ? C.muted : '#991B1B', marginTop:2 }}>{detalhe}</div>}
      </div>
    </div>
  )
}

export default function AbaDiagnostico({ session, isPhone }) {
  const [keys, setKeys] = useState(null)
  const [resultados, setResultados] = useState({})
  const [testando, setTestando] = useState(false)
  const [usageData, setUsageData] = useState([])
  const [docsStatus, setDocsStatus] = useState(null)
  const [testeOff, setTesteOff] = useState(null)
  const [testeOffLoading, setTesteOffLoading] = useState(false)

  useEffect(() => {
    carregarDados()
  }, [session])

  async function carregarDados() {
    if (!session?.user?.id) return
    const k = await loadApiKeys(session.user.id)
    setKeys(k)
    // Carregar uso
    const { data: uso } = await supabase.from('api_usage_log')
      .select('modelo, tipo, custo_usd, sucesso, criado_em')
      .order('criado_em', { ascending: false })
      .limit(100)
    if (uso) setUsageData(uso)
    // Status documentos
    const { count: docsTabela } = await supabase.from('documentos_juridicos').select('*', { count: 'exact', head: true })
    const { data: storage } = await supabase.storage.from('documentos-juridicos').list('', { limit: 50 })
    setDocsStatus({ tabela: docsTabela || 0, storage: storage?.length || 0 })
  }

  async function testarChaves() {
    if (!keys) return
    setTestando(true)
    const res = {}

    // Gemini
    if (keys.geminiKey) {
      const t0 = Date.now()
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELOS_GEMINI[0]}:generateContent?key=${keys.geminiKey}`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ contents:[{parts:[{text:'Responda: OK'}]}], generationConfig:{maxOutputTokens:5} }),
          signal: AbortSignal.timeout(8000)
        })
        const d = await r.json()
        if (d.error) res.gemini = { status:'erro', detalhe: d.error.message?.substring(0,80), latencia: Date.now()-t0 }
        else res.gemini = { status:'ok', modelo:MODELOS_GEMINI[0], latencia: Date.now()-t0, custo:'~R$0,01' }
      } catch(e) { res.gemini = { status:'erro', detalhe: e.message?.substring(0,60) } }
    } else { res.gemini = { status:'vazio' } }

    // DeepSeek
    if (keys.deepseekKey) {
      const t0 = Date.now()
      try {
        const r = await fetch('https://api.deepseek.com/chat/completions', {
          method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${keys.deepseekKey}`},
          body: JSON.stringify({ model:'deepseek-chat', messages:[{role:'user',content:'OK'}], max_tokens:3 }),
          signal: AbortSignal.timeout(8000)
        })
        const d = await r.json()
        if (d.error) res.deepseek = { status:'erro', detalhe: d.error.message?.substring(0,80) }
        else res.deepseek = { status:'ok', modelo:'deepseek-chat', latencia: Date.now()-t0, custo:'~R$0,05' }
      } catch(e) { res.deepseek = { status:'erro', detalhe: e.message?.substring(0,60) } }
    } else { res.deepseek = { status:'vazio' } }

    // OpenAI
    if (keys.openaiKey) {
      const t0 = Date.now()
      try {
        const r = await fetch('https://api.openai.com/v1/chat/completions', {
          method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${keys.openaiKey}`},
          body: JSON.stringify({ model:'gpt-4o-mini', messages:[{role:'user',content:'OK'}], max_tokens:3 }),
          signal: AbortSignal.timeout(8000)
        })
        const d = await r.json()
        if (d.error) res.openai = { status:'erro', detalhe: d.error.message?.substring(0,80) }
        else res.openai = { status:'ok', modelo:'gpt-4o-mini', latencia: Date.now()-t0, custo:'~R$0,07' }
      } catch(e) { res.openai = { status:'erro', detalhe: e.message?.substring(0,60) } }
    } else { res.openai = { status:'vazio' } }

    // Claude
    if (keys.claudeKey && keys.claudeKey.length > 30) {
      const t0 = Date.now()
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST', headers:{'Content-Type':'application/json','x-api-key':keys.claudeKey,'anthropic-version':ANTHROPIC_VERSION},
          body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:5, messages:[{role:'user',content:'OK'}] }),
          signal: AbortSignal.timeout(8000)
        })
        const d = await r.json()
        if (d.error) res.claude = { status:'erro', detalhe: d.error.message?.substring(0,80) }
        else res.claude = { status:'ok', modelo:'claude-haiku', latencia: Date.now()-t0, custo:'~R$0,80' }
      } catch(e) { res.claude = { status:'erro', detalhe: e.message?.substring(0,60) } }
    } else {
      res.claude = { status: keys?.claudeKey ? 'invalido' : 'vazio', detalhe: keys?.claudeKey?.length < 30 ? `Chave truncada (${keys?.claudeKey?.length} chars — esperado ~108)` : undefined }
    }

    setResultados(res)
    setTestando(false)
  }

  async function executarTesteOff() {
    setTesteOffLoading(true)
    setTesteOff(null)
    const t0 = Date.now()
    // Análise simulada sem chamar nenhuma API
    const mockAnalise = {
      titulo: '[TESTE OFF] Apartamento 3 Quartos Dona Clara',
      bairro: 'Dona Clara', cidade: 'Belo Horizonte', estado: 'MG',
      tipo: 'apartamento', tipologia: 'apartamento_padrao',
      area_m2: 97, quartos: 3, vagas: 2,
      valor_avaliacao: 550000, valor_minimo: 371250,
      desconto_percentual: 32.5,
      score_localizacao: 8.5, score_desconto: 5.9, score_juridico: 7.0,
      score_ocupacao: 6.0, score_liquidez: 7.0, score_mercado: 7.0,
      score_total: 6.95, recomendacao: 'AGUARDAR',
      preco_m2_mercado: 7065, valor_mercado_estimado: 685305,
      mao_flip: 487000, mao_locacao: 371000,
      aluguel_mensal_estimado: 3000,
      comparaveis: [
        { descricao: 'Apto 3Q Dona Clara 123m²', valor: 680000, area_m2: 123, preco_m2: 5528, quartos: 3, vagas: 2, tipo: 'apartamento', similaridade: 9, fonte: '123i', link: 'https://www.123i.com.br' },
        { descricao: 'Apto 3Q Dona Clara 82m²', valor: 530000, area_m2: 82, preco_m2: 6463, quartos: 3, vagas: 2, tipo: 'apartamento', similaridade: 9, fonte: '123i', link: 'https://www.123i.com.br' }
      ],
      sintese_executiva: 'Teste de análise sem consumo de API. Todos os campos populados com dados de referência para validação da UI.',
      positivos: ['Bairro premium com alta demanda', 'Processo trabalhista com sub-rogação de débitos', 'Imóvel abaixo do mercado'],
      negativos: ['Ocupação incerta', 'Desconto moderado no 1º leilão'],
      alertas: ['Verificar situação de ocupação antes do lance'],
      _modo_teste: true,
      _modelo_usado: 'mock_off',
      _duracao_ms: Date.now() - t0
    }
    await new Promise(r => setTimeout(r, 800)) // simular latência
    mockAnalise._duracao_ms = Date.now() - t0
    setTesteOff(mockAnalise)
    setTesteOffLoading(false)
  }

  // Agrupar uso por modelo
  const usoPorModelo = {}
  usageData.forEach(u => {
    const k = u.modelo || 'desconhecido'
    if (!usoPorModelo[k]) usoPorModelo[k] = { usos: 0, custo: 0, sucessos: 0 }
    usoPorModelo[k].usos++
    usoPorModelo[k].custo += parseFloat(u.custo_usd || 0)
    if (u.sucesso) usoPorModelo[k].sucessos++
  })
  const custoTotal = usageData.reduce((s, u) => s + parseFloat(u.custo_usd || 0), 0)

  const fmtR = v => `R$ ${(v * 5.1).toFixed(2)}`
  const fmtUSD = v => `US$ ${v.toFixed(4)}`

  return (
    <div style={{ maxWidth: 700 }}>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700, color:C.navy, marginBottom:4 }}>🔬 Diagnóstico do Sistema</div>
        <div style={{ fontSize:11, color:C.muted }}>Status em tempo real das APIs, cascata de IA e sistema de documentos</div>
      </div>

      {/* APIs */}
      <div style={CARD}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4 }}>🔑 Chaves API</div>
          <button onClick={testarChaves} disabled={testando || !keys}
            style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:`1px solid ${C.navy}`,
              background: testando ? C.borderW : C.navy, color: testando ? C.muted : '#fff', cursor:testando?'default':'pointer' }}>
            {testando ? '🔄 Testando...' : '▶ Testar todas'}
          </button>
        </div>

        {[
          { key:'gemini', nome:'Gemini (principal)', icone:'🤖', k: keys?.geminiKey },
          { key:'deepseek', nome:'DeepSeek V3 (fallback)', icone:'⚡', k: keys?.deepseekKey },
          { key:'openai', nome:'OpenAI/GPT-4o (mercado)', icone:'🔍', k: keys?.openaiKey },
          { key:'claude', nome:'Claude Sonnet (emergência)', icone:'🔵', k: keys?.claudeKey },
        ].map(({ key, nome, icone, k }) => {
          const r = resultados[key]
          const status = r ? r.status : (k ? (k.length > 15 ? 'ok' : 'invalido') : 'vazio')
          return <LinhaChave key={key} nome={nome} icone={icone}
            chave={k} prefixo={k?.substring(0,12)}
            status={status}
            modelo={r?.modelo}
            latencia={r?.latencia}
            custo={r?.custo}
            detalhe={r?.detalhe || (!r && k && k.length < 30 ? `Chave possivelmente inválida (${k?.length} chars)` : null)}
          />
        })}

        {!keys && <div style={{ fontSize:11, color:C.muted, padding:'8px 0' }}>⏳ Carregando chaves...</div>}
      </div>

      {/* Cascata atual */}
      <div style={CARD}>
        <div style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4, marginBottom:10 }}>⚙️ Cascata de IA — Ordem Atual</div>
        {[
          { ordem:1, nome:'Gemini 1.5-flash → 1.5-pro', custo:'~R$0,01', status: keys?.geminiKey ? '✅ Configurado' : '❌ Sem chave', cor:'#065F46' },
          { ordem:2, nome:'DeepSeek V3 (deepseek-chat)', custo:'~R$0,05', status: keys?.deepseekKey ? '✅ Configurado' : '❌ Sem chave', cor:'#1E40AF' },
          { ordem:3, nome:'Claude Sonnet (emergência)', custo:'~R$1,80', status: (keys?.claudeKey?.length > 30) ? '✅ Configurado' : '❌ Chave inválida', cor:'#92400E' },
        ].map(({ ordem, nome, custo, status, cor }) => (
          <div key={ordem} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:`1px solid ${C.borderW}` }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:C.navy, color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{ordem}</div>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:12, fontWeight:600, color:C.navy }}>{nome}</span>
            </div>
            <span style={{ fontSize:10, color:'#7C3AED', fontWeight:600 }}>{custo}</span>
            <span style={{ fontSize:10, fontWeight:600, color:cor }}>{status}</span>
          </div>
        ))}
        <div style={{ fontSize:10, color:C.muted, marginTop:8 }}>
          Pesquisa de mercado (comparáveis): GPT-4o via OpenAI — {keys?.openaiKey ? '✅ configurado' : '❌ sem chave'}
        </div>
      </div>

      {/* Uso por modelo */}
      <div style={CARD}>
        <div style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4, marginBottom:10 }}>
          💰 Histórico de Uso — Total: {fmtR(custoTotal)} ({fmtUSD(custoTotal)})
        </div>
        {Object.entries(usoPorModelo).sort((a,b) => b[1].usos - a[1].usos).map(([modelo, dados]) => (
          <div key={modelo} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:`1px solid ${C.borderW}` }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.navy }}>{modelo}</div>
              <div style={{ fontSize:10, color:C.muted }}>{dados.usos} análises · {dados.sucessos}/{dados.usos} sucessos</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:12, fontWeight:700, color: dados.custo > 0.5 ? '#DC2626' : '#065F46' }}>{fmtR(dados.custo)}</div>
              <div style={{ fontSize:9, color:C.muted }}>{fmtUSD(dados.custo)}</div>
            </div>
          </div>
        ))}
        {usageData.length === 0 && <div style={{ fontSize:11, color:C.muted }}>Nenhum registro de uso.</div>}
      </div>

      {/* Status documentos */}
      <div style={CARD}>
        <div style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4, marginBottom:10 }}>📄 Sistema de Documentos</div>
        {docsStatus && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            {[
              ['Tabela documentos_juridicos', docsStatus.tabela, docsStatus.tabela > 0 ? 'ok' : 'warn'],
              ['PDFs no Storage', docsStatus.storage, docsStatus.storage > 0 ? 'ok' : 'warn'],
            ].map(([label, val, tipo]) => (
              <div key={label} style={{ padding:'8px 10px', borderRadius:7, background: tipo==='ok' ? '#ECFDF5' : '#FFFBEB', border:`1px solid ${tipo==='ok' ? '#A7F3D0' : '#FDE68A'}` }}>
                <div style={{ fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:.3, marginBottom:2 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color: tipo==='ok' ? '#065F46' : '#92400E' }}>{val}</div>
              </div>
            ))}
          </div>
        )}
        {docsStatus?.tabela === 0 && docsStatus?.storage > 0 && (
          <div style={{ fontSize:11, color:'#92400E', padding:'8px 10px', background:'#FFFBEB', borderRadius:7, border:'1px solid #FDE68A' }}>
            ⚠️ <strong>{docsStatus.storage} PDFs</strong> estão no Storage mas a tabela está vazia.
            Isso indica que o pipeline de análise baixou e salvou os PDFs, mas falhou ao registrar na tabela.
            Tente "Buscar documentos automaticamente" em um imóvel para forçar o re-registro.
          </div>
        )}
        {docsStatus?.tabela > 0 && (
          <div style={{ fontSize:11, color:'#065F46', padding:'8px 10px', background:'#ECFDF5', borderRadius:7, border:'1px solid #A7F3D0' }}>
            ✅ Pipeline de documentos funcionando — {docsStatus.tabela} documento(s) analisado(s).
          </div>
        )}
      </div>

      {/* Teste OFF — análise sem IA */}
      <div style={CARD}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4 }}>🧪 Teste OFF — Análise Sem IA</div>
            <div style={{ fontSize:10, color:C.muted }}>Valida a UI e o pipeline sem custo de API</div>
          </div>
          <button onClick={executarTesteOff} disabled={testeOffLoading}
            style={{ fontSize:11, padding:'5px 14px', borderRadius:6, border:`1px solid #7C3AED`,
              background: testeOffLoading ? C.borderW : '#7C3AED', color: testeOffLoading ? C.muted : '#fff', cursor:testeOffLoading?'default':'pointer' }}>
            {testeOffLoading ? '⏳ Simulando...' : '🧪 Executar teste'}
          </button>
        </div>

        {testeOff && (
          <div style={{ background:'#F5F3FF', borderRadius:8, padding:'10px 12px', border:'1px solid #DDD6FE' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#5B21B6', marginBottom:8 }}>
              ✅ Teste OFF concluído em {testeOff._duracao_ms}ms — sem custo
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px 12px' }}>
              {[
                ['Score total', `${testeOff.score_total}/10`],
                ['Recomendação', testeOff.recomendacao],
                ['Desconto', `${testeOff.desconto_percentual}%`],
                ['Comparáveis', `${testeOff.comparaveis.length} encontrados`],
                ['MAO flip', `R$ ${testeOff.mao_flip?.toLocaleString('pt-BR')}`],
                ['Modelo', testeOff._modelo_usado],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize:9, color:'#7C3AED', textTransform:'uppercase', marginBottom:1 }}>{k}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:'#5B21B6' }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:8, fontSize:10, color:'#7C3AED', fontStyle:'italic' }}>
              {testeOff.sintese_executiva}
            </div>
          </div>
        )}
      </div>

      {/* Últimas chamadas */}
      {usageData.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize:12, fontWeight:700, color:C.navy, textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>📋 Últimas 10 Chamadas</div>
          {usageData.slice(0,10).map((u, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0', borderBottom:`1px solid ${C.borderW}`, fontSize:11 }}>
              <span style={{ width:14, height:14, borderRadius:'50%', background: u.sucesso ? '#065F46' : '#DC2626', display:'inline-block', flexShrink:0 }} />
              <span style={{ flex:1, color:C.navy, fontWeight:500 }}>{u.modelo}</span>
              <span style={{ color:C.muted, fontSize:10 }}>{u.tipo}</span>
              <span style={{ color: parseFloat(u.custo_usd) > 0.1 ? '#DC2626' : '#065F46', fontWeight:600 }}>
                {fmtR(parseFloat(u.custo_usd || 0))}
              </span>
              <span style={{ color:C.muted, fontSize:10 }}>{new Date(u.criado_em).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
