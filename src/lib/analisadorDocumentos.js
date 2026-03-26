// ═══════════════════════════════════════════════════════════════
// AXIS — Analisador de Documentos de Leilão (Edital, RGI, Débitos)
// Usa Claude Sonnet para extrair informações de PDFs via base64
// ═══════════════════════════════════════════════════════════════

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

async function fetchPdfBase64(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function chamarClaude(apiKey, pdfBase64, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `Claude erro ${res.status}`)
  }
  const data = await res.json()
  // Log de uso
  try {
    const { logUsoChamadaAPI } = await import('./supabase')
    logUsoChamadaAPI({
      tipo: 'documento_pdf', modelo: CLAUDE_MODEL,
      tokensInput: data.usage?.input_tokens || 0,
      tokensOutput: data.usage?.output_tokens || 0,
      modoTeste: localStorage.getItem('axis-modo-teste') === 'true',
    })
  } catch {}
  const txt = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  const jsonMatch = txt.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  return JSON.parse(jsonMatch[0])
}

export async function analisarEdital(url, apiKey) {
  const pdfBase64 = await fetchPdfBase64(url)
  if (!pdfBase64) throw new Error('Não foi possível baixar o PDF do edital')
  return chamarClaude(apiKey, pdfBase64, `Extraia do edital de leilão judicial APENAS:
- Data e hora do leilão (1º e 2º)
- Valor de avaliação do imóvel
- Valor mínimo de lance (1º leilão)
- Valor mínimo de lance (2º leilão, se houver)
- Nome do leiloeiro responsável
- Comissão do leiloeiro (%)
- Prazo para pagamento após arrematação
- Imóvel desocupado ou ocupado (se mencionado)
- Restrições especiais (ITBI, condomínio em atraso, débitos sub-rogados, etc.)
- Número do processo judicial
- Vara judicial (ex: "7ª Vara do Trabalho de Belo Horizonte")
- Tipo de justiça: "TRT-3" | "TJMG" | "FEDERAL" | "EXTRAJUDICIAL"
- Número do leilão (1 ou 2)
Responda SOMENTE em JSON, sem markdown, sem explicações.
Formato: {"data_leilao":"","data_2o_leilao":"","valor_avaliacao":0,"lance_minimo_1":0,"lance_minimo_2":0,
"leiloeiro":"","comissao_pct":0,"prazo_pagamento":"","ocupacao":"","restricoes":"","processo_numero":"","vara_judicial":"","tipo_justica":"","num_leilao":1}`, 1500)
}

export async function analisarRGI(url, apiKey) {
  const pdfBase64 = await fetchPdfBase64(url)
  if (!pdfBase64) throw new Error('Não foi possível baixar o PDF da matrícula/RGI')
  return chamarClaude(apiKey, pdfBase64, `Extraia da matrícula/RGI APENAS:
- Nome do proprietário atual
- Ônus existentes (hipoteca, penhora, alienação fiduciária, usufruto, servidão)
- Área total do imóvel (m²)
- Número de matrícula
- Cartório de registro
- Se há averbação de indisponibilidade
Responda SOMENTE em JSON, sem markdown.
Formato: {"proprietario":"","onus":[],"area_m2":0,"matricula":"","cartorio":"","indisponibilidade":false}`, 1000)
}

export async function analisarDebitos(url, apiKey) {
  const pdfBase64 = await fetchPdfBase64(url)
  if (!pdfBase64) throw new Error('Não foi possível baixar o PDF de débitos')
  return chamarClaude(apiKey, pdfBase64, `Extraia os débitos do imóvel APENAS:
- Total de IPTU em atraso (R$)
- Total de condomínio em atraso (R$)
- Outros débitos (descrição e valor)
- Total geral de débitos (R$)
- Se débitos são de responsabilidade do arrematante ou sub-rogados no preço
Responda SOMENTE em JSON, sem markdown.
Formato: {"iptu_atraso":0,"condominio_atraso":0,"outros_debitos":[],"total_debitos":0,
"responsabilidade_arrematante":true,"observacoes":""}`, 800)
}

export async function analisarDocumentos(urls, apiKey, onProgress) {
  const progress = onProgress || (() => {})
  const resultado = { edital: null, rgi: null, debitos: null, erros: [] }

  for (const urlRaw of urls) {
    const url = urlRaw.trim()
    if (!url) continue
    const lower = url.toLowerCase()

    try {
      if (lower.includes('edital') || lower.includes('leilao') || lower.includes('leilão')) {
        progress('📄 Analisando edital...')
        resultado.edital = await analisarEdital(url, apiKey)
      } else if (lower.includes('rgi') || lower.includes('matricula') || lower.includes('matrícula')) {
        progress('📄 Analisando matrícula/RGI...')
        resultado.rgi = await analisarRGI(url, apiKey)
      } else if (lower.includes('debit') || lower.includes('débito') || lower.includes('planilha')) {
        progress('📄 Analisando débitos...')
        resultado.debitos = await analisarDebitos(url, apiKey)
      } else {
        // Tentar detectar pelo conteúdo — default para edital
        progress('📄 Analisando documento...')
        resultado.edital = resultado.edital || await analisarEdital(url, apiKey)
      }
    } catch (e) {
      resultado.erros.push(`${url}: ${e.message}`)
    }
  }

  return resultado
}
