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
  // Portais de mercado direto SPA
  'quintoandar.com.br', 'loft.com.br', '123i.com.br',
  'chavesnamao.com.br', 'lugarcerto.com.br',
  // Sites de leiloeiros com frontend SPA (Jina retorna só menu)
  'marcoantonioleiloeiro.com.br', 'leiloeiro.com.br',
  'zukerman.com.br', 'santanderimentoleiloes.com.br',
  'superbid.net', 'biditalia.com.br', 'leiloesjudicial.com.br',
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
  
  // ── EXTRATOR NATIVO: plataforma suporteleiloes.com.br ──────────────────────
  // Usada por: marcoantonioleiloeiro, zukerman e outros. Retorna "var lote = {...}" no HTML.
  const isSuporteLeiloes = [
    'marcoantonioleiloeiro.com.br', 'zukerman.com.br', 'leiloeiro.com.br',
    'superbid.net', 'biditalia.com.br',
  ].some(d => url.toLowerCase().includes(d))

  if (isSuporteLeiloes) {
    try {
      const res = await fetch(jinaUrl, {
        headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
        signal: AbortSignal.timeout(30000)
      })
      if (res.ok) {
        const html = await res.text()
        // Extrair o objeto JSON "var lote = {...}" do HTML
        const loteMatch = html.match(/var\s+lote\s*=\s*(\{[\s\S]*?\});\s*(?:var|<|\n)/)
        if (loteMatch) {
          try {
            const lote = JSON.parse(loteMatch[1])
            // Construir texto estruturado com os dados do lote para o motor IA
            const descricao = lote.descricao || ''
            const avaliacao = lote.valorAvaliacao || 0
            const lanceMin = lote.valorInicial || lote.valorInicial2 || 0
            const leilao = lote.leilao || {}
            const data1 = leilao.data1?.date?.substring(0, 10) || ''
            const praca = leilao.praca || 1
            const leiloeiro = leilao.leiloeiro?.nome || 'Marco Antônio Leiloeiro'
            const judicial = leilao.judicial ? 'judicial' : 'extrajudicial'
            const codigo = leilao.codigo || ''
            // Extrair fotos do objeto
            // NOTA: leilao.stats.lote.bem é o lote de DESTAQUE do leilão, não o lote atual.
            // As fotos reais do lote são carregadas via JS dinâmico — não extrair aqui.
            const fotos = []
            // Montar texto estruturado
            const textoLote = [
              `Título: ${descricao}`,
              `Valor de avaliação: R$ ${avaliacao.toLocaleString('pt-BR')}`,
              `Lance mínimo (${praca}ª praça): R$ ${lanceMin.toLocaleString('pt-BR')}`,
              `Data do leilão: ${data1}`,
              `Leiloeiro: ${leiloeiro}`,
              `Processo: ${judicial} — código ${codigo}`,
              `Lote: ${lote.numero || ''} | Total de lotes: ${leilao.totalLotes || ''}`,
              fotos.length ? `Foto: ${fotos[0]}` : '',
              `URL: ${url}`,
            ].filter(Boolean).join('\n')
            // Preservar dados estruturados no campo auxiliar
            lote._textoRaw = textoLote
            // Salvar globalmente para o motor usar
            if (typeof globalThis !== 'undefined') globalThis._suporteLeiloesData = lote
            return textoLote
          } catch (_) { /* JSON parse falhou, continuar com fallback */ }
        }
      }
    } catch (_) { /* timeout, continuar */ }
  }
  // ── FIM EXTRATOR SUPORTE LEILOES ───────────────────────────────────────────
  
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
  // Normalizar para ISO YYYY-MM-DD
  if (data_leilao) {
    const brMatch = data_leilao.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
    if (brMatch) {
      data_leilao = `${brMatch[3]}-${brMatch[2].padStart(2,'0')}-${brMatch[1].padStart(2,'0')}`
    } else {
      const parsed = new Date(data_leilao)
      if (!isNaN(parsed.getTime())) data_leilao = parsed.toISOString().split('T')[0]
    }
  }

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

// ─── DETECÇÃO DE PÁGINA DE CONDOMÍNIO (múltiplos imóveis) ────────────────────

/**
 * Detecta se a URL é uma página de condomínio/empreendimento (lista de imóveis)
 * e não um anúncio individual.
 */
export function isCondominioPage(url) {
  if (!url) return false
  const u = url.toLowerCase()
  if (u.includes('quintoandar.com.br/condominio/')) return true
  if (u.includes('/empreendimento/') || u.includes('/residencial/') || u.includes('/lancamento/')) return true
  if (u.includes('#imoveis-disponiveis') || u.includes('#apartamentos')) return true
  return false
}

/**
 * Extrai links individuais de imóveis de uma página de condomínio.
 * Retorna: { condominio, endereco, links[], precoMinimo, cidade, bairro }
 * Se Jina falha (SPA), extrai info da URL e marca para Gemini Grounding.
 */
export async function extrairLinksCondominio(url, geminiKey = null) {
  const result = { condominio: '', endereco: '', links: [], precoMinimo: 0, cidade: '', bairro: '', _needsGrounding: false }

  // 1. Extrair info básica da própria URL (sempre funciona)
  const urlPath = url.replace(/https?:\/\/[^/]+\//, '').replace(/[?#].*/,'')
  const urlParts = urlPath.replace(/condominio\//,'').split(/[-/]/).filter(Boolean)
  // QuintoAndar: /condominio/conquista-monte-belo-parque-xangri-la-contagem-XXXXX
  const cidadesConhecidas = ['contagem','betim','belo-horizonte','nova-lima','juiz-de-fora','sabara','santa-luzia']
  for (const cid of cidadesConhecidas) {
    if (urlPath.toLowerCase().includes(cid)) {
      result.cidade = cid.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      break
    }
  }
  // Nome do condomínio da URL (remover código hash final)
  const nomeParts = urlParts.filter(p => !cidadesConhecidas.some(c => c.includes(p)) && p.length > 2 && !/^[a-z0-9]{8,}$/.test(p))
  if (nomeParts.length > 0) {
    result.condominio = nomeParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // 2. Tentar Jina para links
  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(25000)
    })
    if (!res.ok) throw new Error(`Jina ${res.status}`)
    const texto = await res.text()

    // Nome do condomínio (se melhor que URL)
    const tituloMatch = texto.match(/(?:^#\s*|Title:\s*)(.+)/m)
    const titJina = tituloMatch?.[1]?.replace(/\s*[-|].*(?:QuintoAndar|Alugue|Compre).*$/i, '').trim()
    if (titJina && titJina.length > result.condominio.length) result.condominio = titJina

    // Endereço e bairro
    const endMatch = texto.match(/(?:Rua|Av|Alameda|R\.)\s+[^,\n]+,\s*\d+[^,\n]*,?\s*([A-ZÀ-Ú][a-zà-ú\s]+)/i)
    if (endMatch) { result.endereco = endMatch[0].trim(); result.bairro = endMatch[1]?.trim() || '' }

    // Cidade do texto
    if (!result.cidade) {
      if (/contagem/i.test(texto)) result.cidade = 'Contagem'
      else if (/belo horizonte|bh/i.test(texto)) result.cidade = 'Belo Horizonte'
    }

    // Preço
    const precoMatch = texto.match(/(?:a partir de|compra|valor)\s*:?\s*R?\$?\s*([\d.,]+)/i)
    if (precoMatch) result.precoMinimo = parseFloat(precoMatch[1].replace(/\./g, '').replace(',', '.'))

    // Links individuais
    const baseUrl = new URL(url).origin
    const qaLinks = texto.match(/\/imovel\/[a-zA-Z0-9_-]+/g) || []
    for (const l of qaLinks) {
      const full = `${baseUrl}${l}`
      if (!result.links.includes(full)) result.links.push(full)
    }
    const vrLinks = texto.match(/https?:\/\/[^\s)"]+\/imovel\/[^\s)"]+/gi) || []
    for (const l of vrLinks) {
      const clean = l.replace(/[)"\s]+$/, '')
      if (!result.links.includes(clean) && !clean.includes('/condominio/')) result.links.push(clean)
    }
  } catch(e) { console.warn('[AXIS] Jina condomínio falhou:', e.message) }

  // 3. Se Jina não encontrou links → usar Gemini Grounding para buscar
  if (result.links.length === 0 && geminiKey) {
    try {
      const prompt = `Preciso encontrar os apartamentos À VENDA (COMPRA) no condomínio "${result.condominio}" em ${result.cidade || 'Minas Gerais'}.

URL da página do condomínio: ${url}

REGRAS IMPORTANTES:
1. Busque APENAS imóveis para COMPRA (não incluir os de aluguel)
2. Se existir um imóvel para ALUGUEL no mesmo condomínio, use o valor como referência de aluguel (campo aluguel_referencia)
3. Para cada apartamento de COMPRA, retorne link individual, preço, área, quartos, vagas
4. Links do QuintoAndar devem estar no formato: quintoandar.com.br/imovel/XXXXX

Retorne APENAS JSON válido:
{
  "condominio": "nome do condomínio",
  "endereco": "endereço completo com rua e número",
  "cidade": "cidade",
  "bairro": "bairro",
  "aluguel_referencia": 1100,
  "condominio_mensal": 275,
  "imoveis": [
    { "link": "https://www.quintoandar.com.br/imovel/XXXXX", "preco": 204000, "area_m2": 42, "quartos": 2, "vagas": 1, "descricao": "breve descrição" }
  ]
}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search_retrieval: { dynamic_retrieval_config: { mode: 'MODE_DYNAMIC', dynamic_threshold: 0.3 } } }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
          }),
          signal: AbortSignal.timeout(60000)
        }
      )
      if (res.ok) {
        const data = await res.json()
        const txt = data.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join('') || ''
        const clean = txt.replace(/```json|```/g, '').trim()
        const jsonMatch = clean.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          if (parsed.condominio) result.condominio = parsed.condominio
          if (parsed.endereco) result.endereco = parsed.endereco
          if (parsed.cidade) result.cidade = parsed.cidade
          if (parsed.bairro) result.bairro = parsed.bairro
          if (parsed.aluguel_referencia) result.aluguelReferencia = parsed.aluguel_referencia
          if (parsed.condominio_mensal) result.condominioMensal = parsed.condominio_mensal
          if (parsed.imoveis?.length) {
            result._imoveis = parsed.imoveis
            for (const im of parsed.imoveis) {
              if (im.link && !result.links.includes(im.link)) result.links.push(im.link)
            }
          }
        }
      }
    } catch(e) { console.warn('[AXIS] Gemini Grounding condomínio falhou:', e.message) }
  }

  result.links = result.links.slice(0, 10)
  result._needsGrounding = result.links.length === 0
  return result
}
