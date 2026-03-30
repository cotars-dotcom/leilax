/**
 * AXIS — Gestão de PDFs de Documentos Jurídicos
 * Download via Jina → Storage Supabase → Análise IA estruturada
 */

import { supabase } from './supabase.js'

// ─── DOWNLOAD DO PDF VIA FETCH ─────────────────────────────────────────────
export async function baixarPDFParaBlob(url, onProgress) {
  onProgress?.(`📥 Baixando PDF: ${url.split('/').pop().substring(0, 40)}...`)
  
  // Tentar fetch direto primeiro (PDF como binário)
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AXIS/1.0)' }
    })
    if (r.ok) {
      const contentType = r.headers.get('content-type') || ''
      const blob = await r.blob()
      if (blob.size > 1000) {
        onProgress?.(`✅ PDF baixado: ${(blob.size / 1024).toFixed(0)}KB`)
        return { blob, contentType: contentType || 'application/pdf', tamanho: blob.size }
      }
    }
  } catch(e) {
    console.warn('[AXIS PDF] Fetch direto:', e.message)
  }
  
  // Fallback: Jina como proxy para CORS
  try {
    onProgress?.('🔄 Tentando via proxy Jina...')
    const r2 = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
      signal: AbortSignal.timeout(30000)
    })
    if (r2.ok) {
      const texto = await r2.text()
      if (texto.length > 200) {
        const blob = new Blob([texto], { type: 'text/plain' })
        onProgress?.(`✅ Texto extraído: ${(texto.length / 1024).toFixed(0)}KB`)
        return { blob, contentType: 'text/plain', tamanho: blob.size, textoExtraido: texto }
      }
    }
  } catch(e) {
    console.warn('[AXIS PDF] Jina fallback:', e.message)
  }
  
  return null
}

// ─── SALVAR PDF NO SUPABASE STORAGE ───────────────────────────────────────
export async function salvarPDFNoStorage(blob, imovelId, nomeArquivo, contentType) {
  const nomeSeguro = nomeArquivo
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100)
  
  const caminho = `${imovelId}/${Date.now()}_${nomeSeguro}`
  
  const { data, error } = await supabase.storage
    .from('documentos-juridicos')
    .upload(caminho, blob, {
      contentType,
      upsert: false,
      cacheControl: '3600'
    })
  
  if (error) throw new Error(`Storage: ${error.message}`)
  
  // URL pública assinada (24h)
  const { data: urlData } = await supabase.storage
    .from('documentos-juridicos')
    .createSignedUrl(caminho, 86400)
  
  return {
    caminho,
    url_storage: urlData?.signedUrl || null,
    tamanho: blob.size
  }
}

// ─── ANÁLISE JURÍDICA ESTRUTURADA COMPLETA ────────────────────────────────
export async function analisarDocumentoCompleto(texto, nomeArq, imovel, geminiKey, claudeKey) {
  if (!texto || texto.length < 50) return null
  
  const prompt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (Minas Gerais).
Faça uma análise jurídica COMPLETA e ESTRUTURADA deste documento.

DOCUMENTO: ${nomeArq}
IMÓVEL: ${imovel.titulo || imovel.endereco || 'Não informado'} — ${imovel.bairro || ''}, ${imovel.cidade || 'BH'}/MG
MODALIDADE: ${imovel.modalidade_leilao || 'judicial'}
PROCESSO: ${imovel.processos_ativos || 'Não informado'}
VALOR MÍNIMO: R$ ${imovel.valor_minimo?.toLocaleString('pt-BR') || 'Não informado'}

TEXTO DO DOCUMENTO (primeiros 7000 chars):
${texto.substring(0, 7000)}

Retorne APENAS JSON válido com esta estrutura EXATA:
{
  "tipo_documento": "edital|matricula|processo|certidao|outro",
  "titulo_documento": "nome descritivo do documento",
  
  "resumo_executivo": "Resumo em 3-5 linhas do que este documento revela sobre o imóvel, processo e riscos para o arrematante",
  
  "informacoes_principais": {
    "processo_numero": "número CNJ se encontrado",
    "vara": "nome da vara",
    "exequente": "nome",
    "executado": "nome",
    "data_leilao": "data se edital",
    "lance_minimo_pct": 35,
    "matricula_numero": "número da matrícula se encontrado",
    "cartorio": "nome do cartório se encontrado",
    "area_m2": null,
    "proprietario_atual": "nome se encontrado",
    "debitos_declarados": "descrição dos débitos se houver",
    "gravames": "penhoras, hipotecas, alienações encontradas"
  },
  
  "metricas_viabilidade": {
    "score_geral": 7.0,
    "score_titulo": 8.0,
    "score_debitos": 6.0,
    "score_processos": 7.0,
    "score_ocupacao": 5.0,
    "score_documentacao": 8.0,
    "justificativa": "por que esses scores"
  },
  
  "riscos_identificados": [
    {
      "categoria": "titulo|debito|ocupacao|processo|documentacao",
      "descricao": "descrição clara do risco",
      "gravidade": "critico|alto|medio|baixo",
      "impacto_financeiro_estimado": 5000,
      "trecho_relevante": "trecho exato do documento",
      "acao_recomendada": "o que fazer antes do lance"
    }
  ],
  
  "pontos_positivos": ["ponto positivo 1", "ponto positivo 2"],
  "alertas_criticos": ["alerta 1 — ação necessária", "alerta 2"],
  
  "responsabilidade_debitos": "sub_rogado|arrematante|misto|exonerado",
  "explicacao_responsabilidade": "explicação sobre sub-rogação ou não",
  
  "ocupacao_confirmada": "desocupado|ocupado|incerto",
  "prazo_liberacao_estimado_meses": 0,
  
  "recomendacao_juridica": "favoravel|neutro|desfavoravel",
  "parecer_final": "Parecer jurídico completo em 4-6 linhas com conclusão clara sobre viabilidade do lance",
  
  "score_juridico_sugerido": 7.0,
  "score_juridico_delta": 0.0
}`

  // Tentar Gemini primeiro
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 3000 }
          }),
          signal: AbortSignal.timeout(60000)
        }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
        if (match) {
          const res = JSON.parse(match[0])
          res._modelo = 'gemini-1.5-flash'
          return res
        }
      }
    } catch(e) { console.warn('[AXIS análise doc] Gemini:', e.message) }
  }

  // Fallback Claude Haiku
  if (claudeKey) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':claudeKey, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(60000)
      })
      if (r.ok) {
        const data = await r.json()
        const txt = data.content?.[0]?.text || ''
        const match = txt.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
        if (match) {
          const res = JSON.parse(match[0])
          res._modelo = 'claude-haiku'
          return res
        }
      }
    } catch(e) { console.warn('[AXIS análise doc] Claude:', e.message) }
  }

  return null
}

// ─── PIPELINE COMPLETO: URL → Storage → Análise → Banco ───────────────────
export async function processarDocumentoCompleto({ url, nome, tipo, imovel, geminiKey, claudeKey, onProgress }) {
  onProgress?.(`🔍 Iniciando processamento de ${nome}...`)
  
  // 1. Baixar PDF
  const download = await baixarPDFParaBlob(url, onProgress)
  if (!download) {
    onProgress?.(`⚠️ Não foi possível baixar ${nome}`)
    return { sucesso: false, erro: 'download_falhou', nome, url }
  }

  // 2. Extrair texto para análise
  let textoParaAnalise = download.textoExtraido || ''
  if (!textoParaAnalise && download.blob) {
    try {
      textoParaAnalise = await download.blob.text()
      if (textoParaAnalise.includes('%PDF')) {
        // PDF binário — extrair strings legíveis
        const bytes = textoParaAnalise
        textoParaAnalise = bytes
          .match(/\(([^)]{4,200})\)/g)
          ?.map(m => m.slice(1,-1))
          .filter(s => s.length > 5 && /[a-zA-ZÀ-ÿ]/.test(s))
          .join(' ')
          .substring(0, 8000) || ''
      }
    } catch(e) {}
  }
  
  if (!textoParaAnalise || textoParaAnalise.length < 100) {
    // Tentar via Jina como texto
    try {
      const r = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' },
        signal: AbortSignal.timeout(30000)
      })
      if (r.ok) textoParaAnalise = await r.text()
    } catch(e) {}
  }
  
  // 3. Salvar no Storage Supabase
  let urlStorage = null, caminhoStorage = null
  try {
    onProgress?.('💾 Salvando PDF no banco de dados...')
    const storage = await salvarPDFNoStorage(download.blob, imovel.id, nome, download.contentType)
    urlStorage = storage.url_storage
    caminhoStorage = storage.caminho
    onProgress?.('✅ PDF armazenado')
  } catch(e) {
    console.warn('[AXIS storage]', e.message)
    onProgress?.('⚠️ Armazenamento falhou — análise continua')
  }
  
  // 4a. Pré-registrar no banco ANTES da análise (garante persistência mesmo se análise falhar)
  let preRegistroId = null
  try {
    const { salvarDocumentoJuridico } = await import('./supabase.js')
    const preReg = await salvarDocumentoJuridico({
      imovel_id: imovel.id,
      tipo,
      nome,
      url: url,
      url_origem: url,
      url_storage: urlStorage,
      tamanho_bytes: download.tamanho,
      status: 'baixado',
      processado: false,
      analisado_em: new Date().toISOString(),
    })
    preRegistroId = preReg?.id
    onProgress?.(`📋 Documento registrado (id: ${preRegistroId?.substring(0,8)})`)
  } catch(eReg) {
    onProgress?.(`⚠️ Pré-registro falhou: ${eReg.message?.substring(0,60)} — análise continua`)
  }

  // 4. Análise IA estruturada
  let analise = null
  if (textoParaAnalise?.length > 100) {
    onProgress?.(`🤖 IA analisando ${nome} (texto extraído)...`)
    analise = await analisarDocumentoCompleto(textoParaAnalise, nome, imovel, geminiKey, claudeKey)
  }

  // Se texto insuficiente ou análise falhou → Gemini Vision com base64 (PDFs escaneados)
  if (!analise && geminiKey && download.blob) {
    try {
      onProgress?.(`🔍 PDF escaneado — Gemini Vision processando ${nome}...`)
      const arrayBuf = await download.blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuf)
      let b64 = ''
      const chunkSize = 8192
      for (let i = 0; i < uint8.length; i += chunkSize) {
        b64 += String.fromCharCode(...uint8.subarray(i, i + chunkSize))
      }
      const base64 = btoa(b64)
      const prompt = `Você é especialista em direito imobiliário e leilões judiciais no Brasil (MG).
Analise este documento (${nome}) do imóvel: ${imovel.titulo || ''} | Processo: ${imovel.processos_ativos || '?'}
Retorne APENAS JSON:
{"tipo_documento":"edital|matricula|processo|certidao|outro","titulo_documento":"","resumo_executivo":"3-5 linhas","informacoes_principais":{"processo_numero":"","vara":"","exequente":"","executado":"","matricula_numero":"","cartorio":"","proprietario_atual":"","debitos_declarados":"","gravames":""},"metricas_viabilidade":{"score_geral":7.0,"score_titulo":7.0,"score_debitos":6.0,"score_processos":7.0,"score_ocupacao":5.0,"score_documentacao":8.0,"justificativa":""},"riscos_identificados":[{"categoria":"","descricao":"","gravidade":"alto","impacto_financeiro_estimado":0,"acao_recomendada":""}],"pontos_positivos":[],"alertas_criticos":[],"responsabilidade_debitos":"sub_rogado|arrematante","explicacao_responsabilidade":"","ocupacao_confirmada":"incerto","prazo_liberacao_estimado_meses":0,"recomendacao_juridica":"favoravel|neutro|desfavoravel","parecer_final":"4-6 linhas","score_juridico_sugerido":7.0,"score_juridico_delta":0.0}`
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
        {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            contents:[{parts:[
              {inline_data:{mime_type: download.contentType || 'application/pdf', data: base64}},
              {text: prompt}
            ]}],
            generationConfig:{temperature:0.1, maxOutputTokens:3000}
          }),
          signal: AbortSignal.timeout(120000)
        }
      )
      if (r.ok) {
        const data = await r.json()
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const match = txt.replace(/```json|```/g,'').trim().match(/\{[\s\S]*\}/)
        if (match) {
          analise = JSON.parse(match[0])
          analise._modelo = 'gemini-1.5-pro-vision'
          onProgress?.(`✅ ${nome} — Vision OK, score: ${analise.metricas_viabilidade?.score_geral || '?'}/10`)
        }
      } else {
        const err = await r.text().catch(()=>'')
        onProgress?.(`⚠️ Gemini Vision falhou (${r.status}) — ${err.substring(0,60)}`)
      }
    } catch(e) { onProgress?.(`⚠️ Gemini Vision erro: ${e.message.substring(0,60)}`) }
  }

  if (analise) {
    onProgress?.(`✅ ${nome}: ${analise.recomendacao_juridica||'?'} · viabilidade ${analise.metricas_viabilidade?.score_geral||'?'}/10`)
  } else {
    onProgress?.(`⚠️ ${nome}: salvo sem análise IA (texto insuficiente + sem Gemini Vision)`)
  }

  return {
    sucesso: true,
    nome,
    tipo,
    pre_registro_id: preRegistroId,
    url_origem: url,
    url_storage: urlStorage,
    caminho_storage: caminhoStorage,
    tamanho_bytes: download.tamanho,
    conteudo_texto: textoParaAnalise?.substring(0, 8000) || '',
    analise,
    analise_ia: analise?.parecer_final || analise?.resumo_executivo || '',
    riscos_encontrados: analise?.riscos_identificados || [],
    score_juridico_sugerido: analise?.score_juridico_sugerido || null,
    score_viabilidade: analise?.metricas_viabilidade?.score_geral || null,
    resumo_executivo: analise?.resumo_executivo || '',
    pontos_positivos: analise?.pontos_positivos || [],
    alertas_criticos: analise?.alertas_criticos || [],
    responsabilidade_debitos: analise?.responsabilidade_debitos || null,
    ocupacao_confirmada: analise?.ocupacao_confirmada || null,
    prazo_liberacao_meses: analise?.prazo_liberacao_estimado_meses || null,
    recomendacao_juridica: analise?.recomendacao_juridica || null,
    metricas_viabilidade: analise?.metricas_viabilidade || null,
    analise_estruturada: analise || null,
    processado: !!analise
  }
}
