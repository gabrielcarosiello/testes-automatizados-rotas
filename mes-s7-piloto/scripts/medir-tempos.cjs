'use strict'

const fs = require('node:fs')
const path = require('node:path')

const intervalos = [
  ['preparacaoDaRota', 'Selecionar local', 'Verificar botão Iniciar'],
  ['preparacaoS7', 'Preparar leitura S7', 'Verificar botão Iniciar'],
  ['verificacaoECliqueIniciar', 'Verificar botão Iniciar', 'Acompanhar saídas S7 desde a partida'],
  ['retornosS7ComEvidencias', 'Acompanhar saídas S7 desde a partida', 'Aguardar iniciado após conferir equipamentos'],
  ['capturaInicial', 'Capturar supervisório', 'Acionar LSH para nível alto'],
  ['acionamentoLsh', 'Acionar LSH para nível alto', 'Aguardar Alm e Nível Alto no MES'],
  ['reacaoNivelAlto', 'Aguardar Alm e Nível Alto no MES', 'Registrar reação ao nível alto'],
  ['evidenciasNivelAlto', 'Registrar reação ao nível alto', 'Restaurar LSH após ensaio'],
  ['restauracaoLsh', 'Restaurar LSH após ensaio', 'Finalizar transferência após as validações'],
]

function medir(pasta, limite) {
  const diretorio = path.join(__dirname, '..', 'resultados', pasta)
  let linhasInvalidas = 0
  let eventos = fs.readFileSync(path.join(diretorio, 'eventos.jsonl'), 'utf8').split(/\r?\n/).flatMap(linha => {
    if (!linha.trim()) return []
    try { return [JSON.parse(linha)] } catch { linhasInvalidas++; return [] }
  })
  if (limite !== undefined) {
    let gravados = 0
    const ultimo = eventos.findIndex(e => e.tipo === 'resultado-persistido' && ++gravados === limite)
    if (ultimo < 0) throw new Error('O lote possui menos resultados persistidos que o limite informado.')
    eventos = eventos.slice(0, ultimo + 1)
  }
  const inicio = eventos.find(e => e.tipo === 'inicio')
  if (!inicio) throw new Error('Evento de início ausente.')
  const persistidos = new Map(eventos.filter(e => e.tipo === 'resultado-persistido').map(e => [e.dados.idResultado, e.data]))
  const fasesPorRota = new Map()
  const rotas = []
  for (const e of eventos) {
    const codigo = String(e.dados?.codigo)
    if (e.tipo === 'etapa') {
      if (!fasesPorRota.has(codigo)) fasesPorRota.set(codigo, [])
      fasesPorRota.get(codigo).push(e)
    }
    if (e.tipo === 'resultado-recebido') {
      rotas.push({ ...e, fases: fasesPorRota.get(codigo) ?? [] })
      fasesPorRota.delete(codigo)
    }
  }

  const medidas = new Map()
  const lerMs = valor => typeof valor === 'number' ? valor : Date.parse(valor)
  function medirMs(chave, valor) {
    if (!Number.isFinite(valor) || valor < 0) return
    if (!medidas.has(chave)) medidas.set(chave, [])
    medidas.get(chave).push(valor / 1000)
  }
  function medirSeg(chave, valor) {
    if (valor !== '' && valor != null) medirMs(chave, Number(valor) * 1000)
  }
  const { dados } = rotas[0] ?? {}
  for (const campo of ['loginSeg', 'cardSeg', 'campoSeg']) medirSeg(campo, dados?.[campo])
  let buscas = 0
  let buscasRepetidas = 0
  const selecionadas = inicio.dados.rotas ?? []
  const aprovacoes = new Map()
  const codigosComTentativas = new Set()
  const vistos = new Set()
  for (const rota of rotas) {
    const codigo = String(rota.dados.codigo)
    if (vistos.has(codigo)) codigosComTentativas.add(codigo)
    vistos.add(codigo)
    medirMs('persistencia', lerMs(persistidos.get(rota.id)) - lerMs(rota.data))
    const aprovada = rota.dados.resultado === 'Concluída'
    medirSeg(aprovada ? 'rotaAprovada' : 'rotaFalhou', rota.dados.rotaCompleta)
    if (!aprovada) continue
    if (persistidos.has(rota.id)) aprovacoes.set(codigo, lerMs(rota.data))
    medirSeg('confirmacaoIniciadoMes', rota.dados.inicio)
    medirSeg('encerramentoMes', rota.dados.parada)
    for (const [chave, de, ate] of intervalos) {
      const a = rota.fases.filter(e => e.dados.etapa === de)
      const b = rota.fases.filter(e => e.dados.etapa === ate)
      if (a.length === 1 && b.length === 1) medirMs(chave, lerMs(b[0].data) - lerMs(a[0].data))
    }
    let somaBuscaMs = 0
    let buscasDaRota = 0
    for (const e of rota.fases) {
      const m = /^Busca .+, tentativa (\d+), .+: preencher=(\d+) ms, resultado=(\d+) ms, selecionar=(\d+) ms\.$/.exec(e.dados.etapa)
      if (!m) continue
      buscas++
      buscasDaRota++
      if (Number(m[1]) > 1) buscasRepetidas++
      somaBuscaMs += Number(m[2]) + Number(m[3]) + Number(m[4])
    }
    if (buscasDaRota) medirMs('buscasPorRota', somaBuscaMs)
  }

  let evidenciasInvalidas = 0
  const ultimasEvidencias = new Map()
  for (const nome of fs.readdirSync(diretorio)) {
    const m = /^s7-rota-(\d+)-(\d+)\.json$/.exec(nome)
    if (!m || !aprovacoes.has(m[1]) || Number(m[2]) > aprovacoes.get(m[1]) || codigosComTentativas.has(m[1])) continue
    if (Number(m[2]) > (ultimasEvidencias.get(m[1])?.ms ?? 0)) ultimasEvidencias.set(m[1], { nome, ms: Number(m[2]) })
  }
  for (const { nome } of ultimasEvidencias.values()) {
    let e
    try { e = JSON.parse(fs.readFileSync(path.join(diretorio, nome), 'utf8')) } catch { evidenciasInvalidas++; continue }
    if (e.resultado?.ok) medirMs('amostraDeConfirmacaoS7', lerMs(e.resultado.receivedAt) - lerMs(e.inicio))
    const alto = e.nivelAlto
    if (!alto) continue
    const digital = alto.historico?.find(a => a.confirmacoes?.some(t => t.value === true))
    const silo = alto.historico?.find(a => a.silo?.good === true && a.silo.value === true)
    medirMs('primeiraAmostraAlmOuAviso', lerMs(digital?.receivedAt) - lerMs(alto.inicio))
    medirMs('primeiraAmostraDb11Alto', lerMs(silo?.receivedAt) - lerMs(alto.inicio))
    medirMs('confirmacaoConjuntaNivelAlto', lerMs(alto.confirmadoEm) - lerMs(alto.inicio))
    medirMs('daAmostraPositivaAConfirmacaoConjunta', lerMs(alto.confirmadoEm) - lerMs(digital?.receivedAt))
  }

  const resumo = valores => {
    const v = valores.sort((a, b) => a - b)
    const meio = Math.floor(v.length / 2)
    const arredondar = n => Number(n.toFixed(3))
    return { n: v.length, mediana: arredondar(v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2),
      p90: arredondar(v[Math.ceil(0.9 * v.length) - 1]), max: arredondar(v.at(-1)) }
  }
  return { lote: pasta, piloto: inicio.dados.piloto, corteEm: eventos.at(-1)?.data, selecionadas: selecionadas.length, resultados: rotas.length,
    persistidos: persistidos.size, aprovados: rotas.filter(r => r.dados.resultado === 'Concluída').length,
    falhas: rotas.filter(r => r.dados.resultado === 'Falhou').length, linhasInvalidas, evidenciasInvalidas,
    buscasEmRotasAprovadas: buscas, buscasComTentativaAdicional: buscasRepetidas,
    segundos: Object.fromEntries([...medidas].map(([chave, valores]) => [chave, resumo(valores)])) }
}

const [pasta, quantidade] = process.argv.slice(2)
const limite = quantidade === undefined ? undefined : Number(quantidade)
if (!pasta || !/^Teste_rotas_Rev00_[a-zA-Z0-9_-]+$/.test(pasta) ||
    (limite !== undefined && (!Number.isSafeInteger(limite) || limite < 1))) {
  console.error('Uso: node scripts/medir-tempos.cjs Teste_rotas_Rev00_<identificador> [primeiros-persistidos]')
  process.exitCode = 1
} else {
  try { console.log(JSON.stringify(medir(pasta, limite), null, 2)) } catch {
    console.error('Não foi possível ler e medir os eventos do lote indicado.')
    process.exitCode = 1
  }
}
