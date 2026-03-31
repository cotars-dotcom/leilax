/**
 * AXIS — Scraper de Imóveis (Custo Zero)
 * Usa Jina.ai reader (gratuito) para extrair texto de qualquer URL
 * Depois regex extrai campos estruturados sem gastar API
 */

// ─── EXTRAÇÃO VIA JINA.AI (FREE) ─────────────────────────────────────────────

// Indicadores de que o scrape retornou uma página de erro/SPA vazia
const SPA_ERROR_INDICATORS = [
  'page not found', '404', 'not found', 'access denied', 'forbidden',
  'please enable javascript', 'loading...', 'carregando',
  'this page requires javascript', 'react app', 'root div',
  'noscript', 'we couldn\'t find', 'página não encontrada',
  'erro ao carregar', 'unavailable', 'blocked',
  'enable cookies', 'captcha', 'cloudflare',
  'just a moment', 'checking your browser',
]

// Domínios que são SPAs conhecidos (React/Next) e falham com scraping simples
const SPA_DOMAINS = [
  'quintoandar.com.br', 'loft.com.br', '123i.com.br',
  'chavesnamao.com.br', 'lugarcerto.com.br',
]

/**
 * Verifica qualidade do conteúdo scrapeado.
 * Retorna { ok, reason } — ok=false significa que o conteúdo é lixo/SPA
 */
export function verificarQualidadeScrape(texto, url = '') {
  if (!texto || texto.length < 80) return { ok: false, reason: 'EMPTY', detail: 'Conteúdo vazio ou muito curto' }

  const tl = texto.toLowerCase()

  // Verificar indicadores de erro/SPA
  const errorHits = SPA_ERROR_INDICATORS.filter(ind => tl.includes(ind))
  if (errorHits.length >= 2) return { ok: false, reason: 'SPA_ERROR', detail: `Página de erro/SPA: ${errorHits.slice(0,3).join(', ')}` }

  // Verificar se URL é de SPA conhecido
  const isSPADomain = SPA_DOMAINS.some(d => url.toLowerCase().includes(d))

  // Heurística: conteúdo real de imóvel deve ter pelo menos ALGUM dado útil
  const temPreco = /r\$\s*[\d.,]+|[\d.]+,\d{2}|preço|valor/i.test(texto)
  const temArea = /\d+\s*m[²2]|metros?\s*quadrados?/i.test(texto)
  const temQuartos = /\d+\s*(quartos?|dorm|suítes?|qts?)/i.test(texto)
  const temEndereco = /(rua|av|alameda|bairro|cidade|cep)/i.test(texto)
  const sinaisUteis = [temPreco, temArea, temQuartos, temEndereco].filter(Boolean).length

  // SPA domain + poucos sinais = falha quase certa
  if (isSPADomain && sinaisUteis < 2) return { ok: false, reason: 'SPA_DOMAIN', detail: `SPA (${url.split('/')[2]}) com dados insuficientes` }

  // Texto muito longo mas sem dados = provavel HTML/JS bruto
  if (texto.length > 5000 && sinaisUteis === 0) return { ok: false, reason: 'JUNK', detail: 'Conteúdo longo sem dados imobiliários' }

  // Proporção de tags HTML residuais muito alta
  const htmlTags = (texto.match(/<[^>]+>/g) || []).length
  if (htmlTags > 50 && sinaisUteis < 2) return { ok: false, reason: 'HTML_JUNK', detail: 'HTML não processado' }

  return { ok: true, reason: 'OK', detail: `${sinaisUteis} sinais úteis`, sinaisUteis, isSPADomain }
}

export async function scrapeUrlJina(url) {
  const jinaUrl = `https://r.jina.ai/${url}`
  
  // Tentar HTML primeiro para portais (melhor com SPAs renderizados)
  const isSPA = SPA_DOMAINS.some(d => url.toLowerCase().includes(d))
  const formatos = isSPA 
    ? [['text/html', 'html'], ['text/plain', 'markdown'], ['text/plain', 'text']]
    : [['text/plain', 'markdown'], ['text/html', 'html'], ['text/plain', 'text']]
  
  let melhorTexto = ''
  for (const [accept, fmt] of formatos) {
    try {
      const res = await fetch(jinaUrl, {
        headers: { 'Accept': accept, 'X-Return-Format': fmt },
        signal: AbortSignal.timeout(25000)
      })
      if (res.ok) {
        let text = await res.text()
        // Limpar HTML tags se veio como HTML
        if (fmt === 'html') text = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        if (text && text.length > melhorTexto.length) melhorTexto = text
        // Verificar qualidade
        const qualidade = verificarQualidadeScrape(text, url)
        if (qualidade.ok && qualidade.sinaisUteis >= 2) return text // bom o suficiente
      }
    } catch(e) { /* tentar próximo formato */ }
  }

  // Retornar o melhor que conseguiu (mesmo que de baixa qualidade)
  if (melhorTexto.length > 80) return melhorTexto
  throw new Error(`Jina falhou para ${url} — ${isSPA ? 'site SPA não renderizável' : 'timeout ou bloqueio'}`)
}

// ─── EXTRATOR DE CAMPOS VIA REGEX (ZERO CUSTO) ───────────────────────────────
export function extrairCamposTexto(texto, url = '') {
  const t = texto || ''
  const tl = t.toLowerCase()

  // Valor mínimo / lance
  const lancePats = [
    /lance\s+m[ií]nimo[:\s]+r?\$?\s*([\d.,]+)/i,
    /valor\s+m[ií]nimo[:\s]+r?\$?\s*([\d.,]+)/i,
    /m[ií]nimo[:\s]+r?\$?\s*([\d.,]+)/i,
    /lance\s+inicial[:\s]+r?\$?\s*([\d.,]+)/i,
    /r\$\s*([\d.]+,\d{2})\s*(?:lance|m[ií]nimo)/i,
  ]
  const valor_minimo = extrairValorBRL(t, lancePats)

  // Avaliação
  const avalPats = [
    /avalia[çc][ãa]o[:\s]+r?\$?\s*([\d.,]+)/i,
    /valor\s+de\s+avalia[çc][ãa]o[:\s]+r?\$?\s*([\d.,]+)/i,
    /avaliado\s+em\s+r?\$?\s*([\d.,]+)/i,
  ]
  const valor_avaliacao = extrairValorBRL(t, avalPats)

  // Área
  const areaPats = [
    /(\d+[.,]?\d*)\s*m[²2]\s*(?:de\s+)?(?:[áa]rea\s+)?(?:privativa|[úu]til|total|constru[íi]da)/i,
    /[áa]rea\s+(?:privativa|[úu]til|total)[:\s]+(\d+[.,]?\d*)\s*m[²2]/i,
    /(\d+[.,]?\d*)\s*m[²2]/i,
  ]
  let area_m2 = null
  for (const p of areaPats) {
    const m = t.match(p)
    if (m) { area_m2 = parseFloat(m[1].replace(',','.')); break }
  }

  // Quartos
  const quartoPats = [/(\d+)\s*(?:quartos?|dorm[iu]t[oó]rios?)/i, /(\d+)\s*qts?(?:\s|$)/i]
  let quartos = null
  for (const p of quartoPats) {
    const m = t.match(p)
    if (m) { quartos = parseInt(m[1]); break }
  }

  // Suítes
  const suitePats = [/(\d+)\s*su[íi]tes?/i]
  let suites = null
  for (const p of suitePats) { const m = t.match(p); if (m) { suites = parseInt(m[1]); break } }

  // Vagas
  const vagaPats = [/(\d+)\s*vagas?/i, /(\d+)\s*garagens?/i]
  let vagas = null
  for (const p of vagaPats) { const m = t.match(p); if (m) { vagas = parseInt(m[1]); break } }

  // Endereço / bairro / cidade
  const enderecoPat = /(?:rua|av(?:enida)?|alameda|travessa|pra[çc]a)\s+[^\n,]+,?\s*[\d]+/i
  const enderecoMatch = t.match(enderecoPat)
  const endereco = enderecoMatch ? enderecoMatch[0].trim() : null

  const bairroPat = /(?:bairro|localizado\s+(?:em|no|na))[:\s]+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][a-záàãâéêíóôõúç\s]+?)(?:\s*[-,\n])/i
  const bairroMatch = t.match(bairroPat)
  const bairro = bairroMatch ? bairroMatch[1].trim() : extrairBairroDeURL(url)

  const cidadePat = /(?:cidade|município|localizado\s+em)[:\s]+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][a-záàãâéêíóôõúç\s]+?)(?:\s*[-,\/\n])/i
  const cidadeMatch = t.match(cidadePat)
  let cidade = cidadeMatch ? cidadeMatch[1].trim() : null
  if (!cidade) {
    if (tl.includes('belo horizonte') || tl.includes('bh/mg')) cidade = 'Belo Horizonte'
    else if (tl.includes('contagem')) cidade = 'Contagem'
    else if (tl.includes('juiz de fora') || tl.includes('jf/mg')) cidade = 'Juiz de Fora'
    else if (tl.includes('nova lima')) cidade = 'Nova Lima'
    else if (tl.includes('betim')) cidade = 'Betim'
  }

  // Modalidade
  let modalidade_leilao = 'judicial'
  if (tl.includes('extrajudicial') || tl.includes('fiduci')) modalidade_leilao = 'extrajudicial_fiduciario'
  else if (tl.includes('trt') || tl.includes('tribunal regional do trabalho')) modalidade_leilao = 'judicial_trt'
  else if (tl.includes('tjmg') || tl.includes('tribunal de justi')) modalidade_leilao = 'judicial_tjmg'
  else if (tl.includes('caixa econômica') || tl.includes('cef')) modalidade_leilao = 'extrajudicial_caixa'
  else if (tl.includes('federal') || tl.includes('trf')) modalidade_leilao = 'judicial_federal'

  // Leiloeiro
  const leilPats = [/leiloeiro[:\s]+([^\n]+)/i, /leil[ãa]o\s+(?:por|via)[:\s]+([^\n]+)/i]
  let leiloeiro = null
  for (const p of leilPats) { const m = t.match(p); if (m) { leiloeiro = m[1].trim(); break } }

  // Data do leilão
  const dataPats = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g,
    /(\d{1,2}\s+de\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\s+de\s+\d{4})/gi
  ]
  let data_leilao = null
  for (const p of dataPats) { const m = t.match(p); if (m) { data_leilao = m[0]; break } }

  // Ocupação
  let ocupacao = 'incerto'
  if (tl.includes('desocupado') || tl.includes('livre') || tl.includes('imóvel vago')) ocupacao = 'desocupado'
  else if (tl.includes('ocupado') || tl.includes('inquilino') || tl.includes('locatário') || tl.includes('ex-mutuário')) ocupacao = 'ocupado'

  // Financiável
  let financiavel = false
  if (tl.includes('financiável') || tl.includes('aceita financiamento') || tl.includes('financiamento bancário')) financiavel = true

  // FGTS
  let fgts_aceito = false
  if (tl.includes('fgts')) fgts_aceito = true

  // Débitos
  const condoPat = /cond[oô]m[ií]nio[:\s]+r?\$?\s*([\d.,]+)/i
  const condoMatch = t.match(condoPat)
  const debitos_condominio = condoMatch ? `R$ ${condoMatch[1]}` : 'Não informado'

  const iptuPat = /iptu[:\s]+r?\$?\s*([\d.,]+)/i
  const iptuMatch = t.match(iptuPat)
  const debitos_iptu = iptuMatch ? `R$ ${iptuMatch[1]}` : 'Não informado'

  // Processo
  const procPats = [
    /processo[:\s]+n[°º.]*\s*([\d\-\.\/]+)/i,
    /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/,
  ]
  let processo_numero = null
  for (const p of procPats) { const m = t.match(p); if (m) { processo_numero = m[1]; break } }

  // Número do leilão (1º ou 2º)
  let num_leilao = 1
  // Verificar se é 2º leilão pelo título/texto
  if (tl.includes('2º leilão') || tl.includes('segundo leilão') || tl.includes('2o leilão') ||
      tl.includes('2ª praça') || tl.includes('segunda praça') || tl.includes('2a praça')) num_leilao = 2
  // Confirmar pela % do lance: <60% da avaliação → provavelmente 2º leilão
  // (apenas quando ambos os valores são conhecidos e consistentes)
  // Nota: 1º leilão pode ter mínimo de 80%, 75% ou até 60% dependendo do juiz

  // Tipo
  let tipo = 'Apartamento'
  if (tl.includes('casa') && !tl.includes('apart')) tipo = 'Casa'
  else if (tl.includes('cobertura')) tipo = 'Cobertura'
  else if (tl.includes('terreno') || tl.includes('lote')) tipo = 'Terreno'
  else if (tl.includes('sala') || tl.includes('comercial')) tipo = 'Sala Comercial'
  else if (tl.includes('galpão') || tl.includes('galpao')) tipo = 'Galpão'

  // Extrair título da página
  const titleMatch = t.match(/^(?:Title:|#)\s*(.+)/m)
  const titulo = titleMatch ? titleMatch[1].trim().substring(0, 120) : null

  // Processo trabalhista / judicial
  let processos_ativos = ''
  if (tl.includes('trabalhista') || tl.includes('trt')) processos_ativos = 'Processo trabalhista'
  else if (tl.includes('execução') || tl.includes('execucao')) processos_ativos = 'Execução judicial'
  else if (tl.includes('falência') || tl.includes('falencia')) processos_ativos = 'Processo de falência'

  // Condomínio mensal
  const condMensPat = /cond[oô]m[ií]nio\s+mensal[:\s]+r?\$?\s*([\d.,]+)/i
  const condMensMatch = t.match(condMensPat)
  const condominio_mensal = condMensMatch ? parseFloat(condMensMatch[1].replace(/\./g,'').replace(',','.')) : null

  // Andar
  const andarPat = /(\d+)[°º]\s*(?:andar|pavimento)/i
  const andarMatch = t.match(andarPat)
  const andar = andarMatch ? parseInt(andarMatch[1]) : null

  // Atributos do prédio
  const elevador = /elevador/i.test(tl) ? true : /sem elevador|walk[\s-]?up/i.test(tl) ? false : null
  const piscina = /piscina/i.test(tl) ? true : null
  const area_lazer = /[áa]rea\s*(?:de\s*)?lazer|playground|academia|churrasqueira|quadra|espa[çc]o\s*gourmet|sal[ãa]o\s*de\s*jogos/i.test(tl) ? true : null
  const salao_festas = /sal[ãa]o\s*(?:de\s*)?festas|espa[çc]o\s*gourmet|espa[çc]o\s*eventos/i.test(tl) ? true : null
  const portaria_24h = /porteiro|portaria\s*24|seguran[çc]a\s*24/i.test(tl) ? true : null
  // Banheiros
  const banhPat = /(\d+)\s*(?:banheiros?|wc|ba[nñ]os?)/i
  const banhMatch = t.match(banhPat)
  const banheiros = banhMatch ? parseInt(banhMatch[1]) : null

  return {
    titulo, endereco, bairro, cidade, estado: 'MG',
    tipo, area_m2, quartos, suites, vagas, andar, banheiros,
    valor_minimo, valor_avaliacao,
    modalidade_leilao, leiloeiro, data_leilao,
    num_leilao, ocupacao, financiavel, fgts_aceito,
    debitos_condominio, debitos_iptu, condominio_mensal,
    processos_ativos, processo_numero,
    elevador, piscina, area_lazer, salao_festas, portaria_24h,
    desconto_percentual: valor_avaliacao && valor_minimo
      ? parseFloat(((1 - valor_minimo/valor_avaliacao)*100).toFixed(1)) : null,
    _texto_scrapeado: texto?.substring(0, 8000) // para Gemini processar
  }
}

function extrairValorBRL(texto, pats) {
  for (const p of pats) {
    const m = texto.match(p)
    if (m) {
      const v = m[1].replace(/\./g,'').replace(',','.')
      const n = parseFloat(v)
      if (n > 1000) return n
    }
  }
  return null
}

function extrairBairroDeURL(url = '') {
  const partes = url.split(/[-\/]/)
  const bairrosConhecidos = ['dona-clara','savassi','lourdes','buritis','pampulha','serra',
    'barreiro','venda-nova','contagem','europa','barroca','estoril']
  for (const p of partes) {
    const pl = p.toLowerCase()
    const found = bairrosConhecidos.find(b => pl.includes(b.replace('-','')))
    if (found) return found.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase())
  }
  return null
}
