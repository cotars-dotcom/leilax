// AXIS — Analisador Jurídico com IA Dupla
// Claude analisa texto (PDF/TXT), ChatGPT analisa imagens, Claude consolida

import { RISCOS_JURIDICOS } from '../data/riscos_juridicos.js'
import { salvarDocumentoJuridico } from './supabase.js'
import { CLAUDE_MODEL, ANTHROPIC_VERSION } from './constants.js'

const GPT_MODEL = 'gpt-4o'

// ── Claude lê PDF/TXT e extrai riscos jurídicos ──────────────────
export async function analisarDocumentoTextoClaude(conteudoTexto, nomeArquivo, imovelAtual, claudeKey) {
  if (!conteudoTexto || !claudeKey) return null

  const riscosBase = RISCOS_JURIDICOS.map(r =>
    `- ${r.risco_id}: ${r.label} (penalização: ${r.score_penalizacao} pts)`
  ).join('\n')

  const contextoImovel = `
IMÓVEL ATUAL:
- Endereço: ${imovelAtual?.endereco || '—'}
- Modalidade: ${imovelAtual?.modalidade_leilao || '—'}
- Score jurídico atual: ${imovelAtual?.score_juridico || '—'}
- Processos conhecidos: ${imovelAtual?.processos_ativos || 'Nenhum identificado'}
- Ocupação: ${imovelAtual?.ocupacao || '—'}
  `

  const prompt = `Você é um especialista jurídico em leilões imobiliários e análise de processos judiciais.

Analise este documento jurídico do imóvel e identifique riscos, processos e inconsistências.

ARQUIVO: ${nomeArquivo}

CONTEÚDO DO DOCUMENTO:
${conteudoTexto.slice(0, 8000)}

${contextoImovel}

BASE DE RISCOS DO SISTEMA:
${riscosBase}

INSTRUÇÕES:
1. Identifique TODOS os processos judiciais mencionados no documento
2. Compare com os processos já conhecidos do imóvel
3. Identifique riscos jurídicos usando os IDs da base acima
4. Calcule o impacto no score jurídico (de -50 a +20)
5. Indique se o imóvel deve ser RECLASSIFICADO

Retorne APENAS JSON válido:
{
  "processos_encontrados": ["número do processo 1", "número do processo 2"],
  "novos_processos": ["processos que NÃO constavam no cadastro"],
  "riscos_identificados": [
    {
      "risco_id": "string (usar IDs da base)",
      "descricao": "o que foi encontrado no documento",
      "gravidade": "baixa|media|alta|critica",
      "trecho_relevante": "trecho do documento que evidencia o risco"
    }
  ],
  "impacto_score_juridico": -15,
  "recomendacao_score_juridico": 4.5,
  "deve_reclassificar": true,
  "nova_recomendacao": "COMPRAR|AGUARDAR|EVITAR",
  "parecer_resumido": "string — parecer jurídico em 3-5 linhas",
  "alertas_criticos": ["alerta 1", "alerta 2"],
  "score_risco_documento": 8,
  "custos_adicionais_estimados": 15000
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!res.ok) throw new Error(`Claude erro ${res.status}`)
    const data = await res.json()
    const txt = data.content?.find(b => b.type === 'text')?.text || ''
    const jsonMatch = txt.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Claude não retornou JSON')
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('[AXIS] Erro análise jurídica Claude:', e.message)
    return null
  }
}

// ── ChatGPT analisa IMAGENS (matrícula foto, print de processo) ──
export async function analisarImagemJuridicaGPT(base64Image, mediaType, nomeArquivo, imovelAtual, openaiKey) {
  if (!base64Image || !openaiKey) return null

  const instrucao = `Você está analisando uma imagem de documento jurídico imobiliário.

Arquivo: ${nomeArquivo}
Imóvel: ${imovelAtual?.endereco || 'não informado'}

ANALISE A IMAGEM E IDENTIFIQUE:
1. Tipo de documento (matrícula, certidão, processo, alvará, etc.)
2. Número de processo ou registro
3. Partes envolvidas (nomes, CPFs/CNPJs visíveis)
4. Débitos ou valores mencionados
5. Datas relevantes
6. Status ou situação (ativo, baixado, cancelado, etc.)
7. Qualquer informação que represente risco jurídico
8. Inconsistências com o endereço: ${imovelAtual?.endereco || 'não informado'}

Retorne APENAS JSON:
{
  "tipo_documento": "string",
  "numero_processo_registro": "string ou null",
  "partes": ["nome1", "nome2"],
  "valores_mencionados": ["R$ X em Y data"],
  "datas_relevantes": ["string"],
  "status": "string",
  "riscos_visuais": ["risco encontrado na imagem"],
  "inconsistencias": ["inconsistência 1"],
  "texto_extraido_resumo": "texto principal visível na imagem",
  "confiabilidade_leitura": "alta|media|baixa"
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: GPT_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: instrucao },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }]
      })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message || `OpenAI erro ${res.status}`)
    }
    const data = await res.json()
    const txt = data.choices?.[0]?.message?.content || ''
    const jsonMatch = txt.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.warn('[AXIS] ChatGPT imagem indisponível:', e.message)
    return null
  }
}

// ── Claude consolida resultados e decide reclassificação final ───
export async function consolidarAnaliseJuridica(resultadoClaude, resultadoGPT, imovelAtual, claudeKey) {
  if (!resultadoClaude && !resultadoGPT) return null
  if (!resultadoClaude) return resultadoGPT
  if (!resultadoGPT) return resultadoClaude

  const prompt = `Como especialista jurídico, consolide estas duas análises de documentos do mesmo imóvel e tome a decisão final de reclassificação.

ANÁLISE DE TEXTO (Claude):
${JSON.stringify(resultadoClaude, null, 2)}

ANÁLISE DE IMAGEM (ChatGPT Vision):
${JSON.stringify(resultadoGPT, null, 2)}

IMÓVEL ATUAL:
- Score jurídico: ${imovelAtual?.score_juridico || '—'}
- Recomendação atual: ${imovelAtual?.recomendacao || '—'}

Consolide e retorne APENAS JSON:
{
  "processos_totais": ["todos os processos encontrados"],
  "riscos_consolidados": [{ "risco_id": "string", "descricao": "string", "gravidade": "string" }],
  "impacto_score_total": -20,
  "novo_score_juridico": 4.5,
  "deve_reclassificar": true,
  "nova_recomendacao": "AGUARDAR",
  "parecer_final": "string",
  "alertas_criticos": ["string"],
  "fonte": "texto+imagem"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    if (!res.ok) return resultadoClaude
    const data = await res.json()
    const txt = data.content?.find(b => b.type === 'text')?.text || ''
    const jsonMatch = txt.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : resultadoClaude
  } catch {
    return resultadoClaude
  }
}

// ── Função principal — orquestra tudo ────────────────────────────
export async function processarDocumentoJuridico(arquivo, imovel, claudeKey, openaiKey, onProgress) {
  const progress = onProgress || (() => {})
  const { nome, tipo, conteudo, base64, mediaType } = arquivo

  let resultadoClaude = null
  let resultadoGPT = null

  // Claude processa texto (PDF parseado, TXT)
  if (conteudo && tipo !== 'imagem') {
    progress(`⚖️ Claude analisando ${nome}...`)
    resultadoClaude = await analisarDocumentoTextoClaude(conteudo, nome, imovel, claudeKey)
  }

  // ChatGPT processa imagens
  if (base64 && tipo === 'imagem') {
    progress(`📸 ChatGPT analisando imagem ${nome}...`)
    resultadoGPT = await analisarImagemJuridicaGPT(base64, mediaType, nome, imovel, openaiKey)
  }

  // PDF com imagens — se não conseguiu texto, manda para ChatGPT como imagem
  if (base64 && tipo === 'pdf' && !conteudo) {
    progress(`📄 ChatGPT extraindo texto do PDF ${nome}...`)
    resultadoGPT = await analisarImagemJuridicaGPT(base64, 'application/pdf', nome, imovel, openaiKey)
  }

  // Claude consolida se tiver os dois
  if (resultadoClaude && resultadoGPT) {
    progress('🔗 Claude consolidando análises...')
    return await consolidarAnaliseJuridica(resultadoClaude, resultadoGPT, imovel, claudeKey)
  }

  return resultadoClaude || resultadoGPT
}


// ─── SALVAR ANÁLISE NO BANCO ─────────────────────────────────────────────────
export async function processarESalvar(imovelId, conteudo, tipo, claudeKey, openaiKey) {
  try {
    const analise = await processarDocumentoJuridico(conteudo, tipo, claudeKey, openaiKey)
    if (analise && imovelId) {
      await salvarDocumentoJuridico({
        imovel_id: imovelId,
        tipo: analise.tipo_documento || tipo || 'matricula',
        nome: analise.nome || 'RGI / Matrícula',
        analise_ia: analise.analise_texto || analise.resumo || null,
        riscos_encontrados: analise.riscos_identificados || [],
        score_juridico_sugerido: analise.score_juridico_sugerido || null,
        impacto_score: analise.impacto_score || null,
        analisado_em: new Date().toISOString(),
        processado: true,
        status: 'analisado',
      }).catch(e => console.warn('[AXIS] salvar juridico:', e.message))
    }
    return analise
  } catch(e) {
    console.warn('[AXIS] processarESalvar:', e.message)
    return null
  }
}
