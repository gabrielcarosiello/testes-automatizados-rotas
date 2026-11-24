'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { atualizarLir, marcarNivelAltoNaoAplicavel } = require('../../comum/gravar-lir')
const { abrirPacote, gerarZip } = require('../../comum/planilha-xml')
const XLSX = require('xlsx')
const { conferirRotaAtual } = require('./selecao-lir')
const nomeAba = 'Lista de Rotas - Transferências'
const campos = ['local','nome','codigo','origem','destino','rota']
const esperado = ['Local Transferências','Nome Transferências','ID Rota','Origem','Destino','Rota','Teste','Nível Alto','Resultado','Data','Falha Identificada']
const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()

// Piloto 09 (preparação): a LIR.04 acrescentou duas colunas antes de Rota.
// Toda leitura e gravação deve usar o cabeçalho, preservando também a LIR.03.
function mapearColunas(aba) {
  const fim = XLSX.utils.decode_range(aba['!ref']).e.c
  const indices = new Map()
  for (let c = 0; c <= fim; c++) {
    let nome = normalizar(aba[XLSX.utils.encode_cell({ c, r: 7 })]?.v)
    if (nome === 'id digtal lsh') nome = 'id digital lsh'
    if (!nome) continue
    if (indices.has(nome)) throw Error(`Cabeçalho duplicado na linha 8: ${nome}`)
    indices.set(nome, c)
  }
  const colunas = {}
  for (const nome of [...esperado, 'IO Nível Alto', 'ID Digital LSH']) {
    const indice = indices.get(normalizar(nome))
    if (indice === undefined && esperado.includes(nome)) throw Error(`Cabeçalho ausente na linha 8: ${nome}`)
    colunas[nome] = indice
  }
  if ((colunas['IO Nível Alto'] === undefined) !== (colunas['ID Digital LSH'] === undefined)) {
    throw Error('Informe os dois cabeçalhos: IO Nível Alto e ID Digital LSH')
  }
  return colunas
}

function abrir(arquivo) {
  const conteudo = fs.readFileSync(arquivo)
  const pacote = abrirPacote(conteudo)
  const livro = XLSX.read(pacote.reparos.length ? gerarZip(pacote) : conteudo, { type: 'buffer' })
  const aba = livro.Sheets[nomeAba]
  if (!aba?.['!ref']) throw Error(`Aba "${nomeAba}" ausente ou vazia`)
  const cel = (c,r) => String(aba[XLSX.utils.encode_cell({c,r})]?.v ?? '').trim()
  const colunas = mapearColunas(aba)
  const valor = (nome, r) => colunas[nome] === undefined ? '' : cel(colunas[nome], r)
  return { arquivo, conteudo, aba, cel, colunas, valor, reparosNamespace: pacote.reparos }
}

function localizar(root) {
  const pasta = path.join(root, 'planilhas')
  const nomes = fs.readdirSync(pasta, { withFileTypes: true }).filter(item =>
    item.isFile() && /\.xlsx$/i.test(item.name) && !item.name.startsWith('~$')
  ).map(item => item.name).sort()
  const compativeis = []
  const erros = []
  for (const nome of nomes) {
    try {
      compativeis.push(abrir(path.join(pasta, nome)))
    } catch (erro) {
      erros.push(`${nome}: ${erro.message}`)
    }
  }
  if (compativeis.length > 1) {
    const lista = compativeis.map(item => path.basename(item.arquivo)).join(', ')
    throw Error(`Mais de uma LIR compatível em "${pasta}": ${lista}. Deixe apenas a que deseja executar.`)
  }
  if (!compativeis.length) {
    throw Error(`Nenhuma LIR .xlsx compatível em "${pasta}".${erros.length ? ' ' + erros.join(' | ') : ''}`)
  }
  return compativeis[0]
}

function ler(root, caminho) {
  const { arquivo, conteudo, aba, colunas, valor } = caminho ? abrir(caminho) : localizar(root)
  const hash = crypto.createHash('sha256').update(conteudo).digest('hex')
  const fim = XLSX.utils.decode_range(aba['!ref']).e.r, ids = new Set(), rotas = []
  for (let r=8;r<=fim;r++) {
    const codigoLido = valor('ID Rota',r)
    if (!codigoLido) continue
    if (!/^\d+$/.test(codigoLido) || Number(codigoLido) < 1 || Number(codigoLido) > 32767) throw Error('ID inválido na linha '+(r+1)+': '+codigoLido)
    const codigo = String(Number(codigoLido))
    if (ids.has(codigo)) throw Error('ID duplicado: '+codigo)
    ids.add(codigo)
    const status = valor('Teste',r).toUpperCase()
    if (!['OK','NOK','NT','---'].includes(status)) throw Error('Teste inválido na linha '+(r+1)+': '+status)
    const statusNivel = valor('Nível Alto',r).toUpperCase()
    if (!['OK','NOK','NT','---', ''].includes(statusNivel)) throw Error('Nível Alto inválido na linha '+(r+1)+': '+statusNivel)
    const ioLido = valor('IO Nível Alto', r), idLido = valor('ID Digital LSH', r)
    const io = ioLido === '---' ? '' : ioLido, idTexto = idLido === '---' ? '' : idLido
    if (Boolean(io) !== Boolean(idTexto)) throw Error('IO e ID da digital de nível alto devem estar preenchidos juntos na linha '+(r+1))
    if (idTexto && (!/^\d+$/.test(idTexto) || !Number.isSafeInteger(Number(idTexto)))) throw Error('ID da digital inválido na linha '+(r+1))
    const rota = {local:valor('Local Transferências',r),nome:valor('Nome Transferências',r),codigo,origem:valor('Origem',r),destino:valor('Destino',r),rota:valor('Rota',r),status,linha:r+1,
      nivelAlto: { io: io || null, idDigital: idTexto ? Number(idTexto) : null, status: statusNivel || null, aplicavel: Boolean(io) && statusNivel !== '---' }}
    if (campos.some(k=>!rota[k])) throw Error('Campo obrigatório vazio na linha '+(r+1))
    rotas.push(rota)
  }
  if (!rotas.length) throw Error('Nenhuma rota foi encontrada')
  return {rotas, hash, arquivo, colunas}
}
function registrar(root,dados,caminho,opcoes = {}) {
  if (!['Concluída','Falhou'].includes(dados.resultado)) throw Error('Resultado inválido')
  const atual = ler(root, caminho), matches = atual.rotas.filter(r=>campos.every(k=>String(r[k])===String(dados[k])))
  if (matches.length !== 1) throw Error('A rota não corresponde exatamente à planilha atual')
  const rota = matches[0]
  if (opcoes.rotaInicial) conferirRotaAtual(atual.rotas, opcoes.rotaInicial)
  const statusPermitido = ['NT','NOK'].includes(rota.status) || (rota.status === 'OK' && opcoes.rotaInicial?.tipoExecucao === 'reteste')
  if (!statusPermitido) throw Error('O status da rota mudou para '+rota.status+'; resultado não sobrescrito')
  const resultadoNormal = dados.resultadoNormal ?? dados.resultado
  if (!['Concluída', 'Falhou'].includes(resultadoNormal)) throw Error('Resultado normal inválido')
  const gravarNivel = dados.nivelAltoExecutado === true
  if (gravarNivel && (!opcoes.permitirNivelAlto || !rota.nivelAlto.aplicavel || !['Concluída', 'Falhou'].includes(dados.resultadoNivelAlto))) throw Error('Resultado de nível alto não autorizado ou inválido')
  const dadosPasta = path.join(root,'resultados',dados.pasta)
  if (!/^[a-zA-Z0-9_-]+$/.test(dados.pasta || '') || !fs.statSync(dadosPasta).isDirectory()) throw Error('Pasta de execução inválida')
  const nivelAlto = gravarNivel ? (dados.resultadoNivelAlto === 'Concluída' ? 'OK' : 'NOK') :
    (podeMarcarNaoAplicavel(rota, atual.colunas) ? '---' : undefined)
  const colunas = Object.fromEntries(['Teste', 'Data', 'Falha Identificada', ...(nivelAlto !== undefined ? ['Nível Alto'] : [])].map(nome => [nome, XLSX.utils.encode_col(atual.colunas[nome])]))
  const info = {backupDir:path.join(dadosPasta,'backups-lir'),arquivo:atual.arquivo,hash:atual.hash,linha:rota.linha,colunas,teste:resultadoNormal==='Concluída'?'OK':'NOK',nivelAlto,falha:dados.resultado==='Falhou' ? (dados.falhaLir || [dados.etapa, dados.detalhes].filter(Boolean).join(': ')).slice(0,30000) : ''}
  const gravacao = atualizarLir(info)
  const atualizado = ler(root, atual.arquivo)
  const final = atualizado.rotas.find(r=>r.codigo===rota.codigo)
  if (!final || final.status !== info.teste || (nivelAlto !== undefined && final.nivelAlto.status !== nivelAlto)) throw Error('Não foi possível confirmar a gravação na planilha')
  Object.defineProperty(atualizado.rotas, 'gravacaoLir', { value: gravacao, enumerable: false })
  return atualizado.rotas
}
function podeMarcarNaoAplicavel(rota, colunas) {
  return colunas['IO Nível Alto'] !== undefined && colunas['ID Digital LSH'] !== undefined &&
    rota.status !== '---' && !rota.nivelAlto.io && rota.nivelAlto.idDigital === null &&
    [null, 'NT'].includes(rota.nivelAlto.status)
}

function reconciliarNivelNaoAplicavel(root, caminho, { destino, backupDir } = {}) {
  const atual = ler(root, caminho)
  const candidatas = atual.rotas.filter(rota => (!destino || rota.destino === destino) &&
    podeMarcarNaoAplicavel(rota, atual.colunas))
  if (!candidatas.length) return { rotas: [], gravacao: null }
  const gravacao = marcarNivelAltoNaoAplicavel({ arquivo: atual.arquivo, hash: atual.hash, backupDir,
    coluna: XLSX.utils.encode_col(atual.colunas['Nível Alto']), linhas: candidatas.map(rota => rota.linha) })
  const finais = new Map(ler(root, caminho).rotas.map(rota => [rota.codigo, rota]))
  if (candidatas.some(rota => finais.get(rota.codigo)?.nivelAlto.status !== '---' ||
      finais.get(rota.codigo)?.status !== rota.status)) throw new Error('Marcação de nível alto não confirmada na LIR.')
  return { rotas: candidatas.map(rota => rota.codigo), gravacao }
}

function mensagemSemPendencias(rotas) {
  const aplicaveis = rotas.filter(rota => rota.status !== '---')
  if (!aplicaveis.length) return 'Nenhuma rota aplicável na aba de transferências.'
  if (aplicaveis.every(rota => rota.status === 'OK')) {
    const pendentesNivel = rotas.filter(r => r.nivelAlto?.aplicavel && ['NT', 'NOK'].includes(r.nivelAlto.status)).length
    return `Todos os ${aplicaveis.length} testes normais aplicáveis da aba de transferências estão em OK.${pendentesNivel ? ' Nível alto: ' + pendentesNivel + ' ensaios ainda pendentes.' : ''}`
  }
  return null
}

module.exports = { ler, registrar, reconciliarNivelNaoAplicavel, mensagemSemPendencias, mapearColunas }
