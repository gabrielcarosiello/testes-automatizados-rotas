'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const XLSX = require('xlsx')
const { ler, mapearColunas } = require('./lir-rotas')
const raiz = path.resolve(__dirname, '../..')
const arquivo = path.join(raiz, 'comum', 'fixtures', 'LIR_regressao.xlsx')
const nomeAba = 'Lista de Rotas - Transferências'
const antigos = ['Rev.', 'Local Transferências', 'Nome Transferências', 'ID Rota', 'Origem', 'Destino', 'Rota', 'Teste', 'Nível Alto', 'Resultado', 'Data', 'Falha Identificada']
const novos = [...antigos.slice(0, 6), 'IO Nível Alto', 'ID Digtal LSH', ...antigos.slice(6)]

function abaCabecalho(nomes) {
  const aba = { '!ref': 'A1:Z10' }
  nomes.forEach((v, c) => { aba[XLSX.utils.encode_cell({ c, r: 7 })] = { v } })
  return aba
}

test('resolve Teste/Data/Falha pelos cabeçalhos nas LIR.03 e .04', () => {
  const anterior = mapearColunas(abaCabecalho(antigos))
  const nova = mapearColunas(abaCabecalho(novos))
  assert.deepEqual(['Teste', 'Data', 'Falha Identificada'].map(n => XLSX.utils.encode_col(anterior[n])), ['H', 'K', 'L'])
  assert.deepEqual(['Teste', 'Data', 'Falha Identificada'].map(n => XLSX.utils.encode_col(nova[n])), ['J', 'M', 'N'])
  assert.equal(nova['ID Digital LSH'], 7)
  assert.equal(mapearColunas(abaCabecalho(novos.map(n => n.replace('Digtal', 'Digital'))))['ID Digital LSH'], 7)
})

test('rejeita cabeçalho faltante, duplicado e par de sinal incompleto', () => {
  assert.throws(() => mapearColunas(abaCabecalho(antigos.filter(n => n !== 'Teste'))), /Teste/)
  assert.throws(() => mapearColunas(abaCabecalho([...novos, ' ID Digital LSH '])), /duplicado/)
  assert.throws(() => mapearColunas(abaCabecalho([...antigos, 'IO Nível Alto'])), /dois cabeçalhos/)
})

test('lê a planilha real: 265 rotas, 257 sinais e 2 testes normais pendentes', () => {
  const antes = fs.readFileSync(arquivo)
  const { rotas } = ler(raiz, arquivo)
  assert.equal(rotas.length, 265)
  assert.equal(rotas.filter(r => r.nivelAlto.aplicavel).length, 257)
  assert.deepEqual(rotas.filter(r => r.status === 'NT').map(r => r.codigo).sort(), ['73', '74'])
  assert.equal(rotas.filter(r => r.nivelAlto.aplicavel && r.nivelAlto.status === 'NT').length, 257)
  const rota = rotas.find(r => r.codigo === '91')
  assert.equal(rota.rota, 'RG08->RG18->RG20->RG22->MG14')
  assert.equal(rota.status, 'OK')
  assert.deepEqual(rota.nivelAlto, { io: 'LSH_MG14', idDigital: 31, status: 'NT', aplicavel: true })
  assert.deepEqual(fs.readFileSync(arquivo), antes, 'ler não altera a planilha')
})

function copiaReal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lir-node-'))
  fs.mkdirSync(path.join(dir, 'resultados', 'ensaio'), { recursive: true })
  const copia = path.join(dir, 'lir.xlsx'); fs.copyFileSync(arquivo, copia)
  return { dir, copia }
}

test('gravação real Node atualiza J/M/N e preserva ID, nível alto, fórmulas e outras células', () => {
  const { dir, copia } = copiaReal()
  try {
    const antes = fs.readFileSync(copia), livro = XLSX.readFile(copia), rota = ler(dir, copia).rotas.find(r => r.codigo === '91')
    assert.throws(() => require('./lir-rotas').registrar(dir, { ...rota, pasta: 'ensaio', resultado: 'Falhou' }, copia), /resultado não sobrescrito/)
    assert.deepEqual(fs.readFileSync(copia), antes)
    const rows = require('./lir-rotas').registrar(dir, { ...rota, pasta: 'ensaio', resultado: 'Falhou', etapa: 'Ensaio local', detalhes: 'A < B & C' }, copia, { rotaInicial: { ...rota, tipoExecucao: 'reteste' } })
    assert.equal(rows.find(r => r.codigo === '91').status, 'NOK')
    assert.equal(rows.find(r => r.codigo === '91').nivelAlto.status, 'NT')
    assert.equal(rows.find(r => r.codigo === '91').nivelAlto.idDigital, rota.nivelAlto.idDigital)
    assert.deepEqual(rows.gravacaoLir.celulas, ['J', 'M', 'N'].map(c => c + rota.linha))
    const final = XLSX.readFile(copia), permitidas = new Set(rows.gravacaoLir.celulas)
    for (const nome of livro.SheetNames) for (const ref of Object.keys(livro.Sheets[nome]).filter(c => !c.startsWith('!'))) {
      if (nome === nomeAba && permitidas.has(ref)) continue
      for (const chave of ['v', 't', 'f', 's', 'z']) assert.deepEqual(final.Sheets[nome][ref]?.[chave], livro.Sheets[nome][ref][chave], nome + '/' + ref + '/' + chave)
    }
    assert.equal(fs.existsSync(rows.gravacaoLir.backups.inicial), true)
    assert.deepEqual(fs.readFileSync(rows.gravacaoLir.backups.inicial), antes)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('Iniciar desabilitado grava equipamento e status do diagnóstico na coluna Falha Identificada', async () => {
  const { diagnosticarInicioDesabilitado } = require('../../comum/impedimento-transferencia')
  const { registrar } = require('./lir-rotas')
  const { dir, copia } = copiaReal()
  try {
    const rota = ler(dir, copia).rotas.find(r => r.codigo === '74')
    const atual = { rota, etapa: 'Verificar botão Iniciar' }
    const eventos = []
    await assert.rejects(diagnosticarInicioDesabilitado({
      atual, pilotoS7: true, capturar: async sufixo => eventos.push(sufixo),
      cy: { task: async (nome, codigo) => {
        assert.equal(codigo, rota.codigo)
        eventos.push(nome)
        return { completo: false, detalhes: 'ME32 (DB1402): Equipamento em emergência (DB1402,X7.2) | ME06 (DB1403): leitura indisponível' }
      } },
    }), /Botão Iniciar desabilitado/)
    assert.deepEqual(eventos, ['iniciar-desabilitado', 'diagnosticarEquipamentosS7'])
    registrar(dir, { ...rota, pasta: 'ensaio', resultado: 'Falhou', etapa: atual.etapa, detalhes: atual.detalhes }, copia)
    const falha = XLSX.readFile(copia).Sheets[nomeAba]['N' + rota.linha].v
    assert.match(falha, /Iniciar desabilitado.*ME32 .*Equipamento em emergência.*ME06 .*leitura indisponível/)
    assert.equal(ler(dir, copia).rotas.find(r => r.codigo === '74').status, 'NOK')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('cópia real da rota NT é gravada em qualquer sistema sem PowerShell', () => {
  const { dir, copia } = copiaReal()
  try {
    const rota = ler(dir, copia).rotas.find(r => r.codigo === '74')
    require('./lir-rotas').registrar(dir, { ...rota, pasta: 'ensaio', resultado: 'Falhou', etapa: 'Ensaio local' }, copia)
    assert.equal(ler(dir, copia).rotas.find(r => r.codigo === '74').status, 'NOK')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('registro real separa normal OK de nível alto NOK sem alterar ID H', () => {
  const { dir, copia } = copiaReal()
  try {
    const rota = ler(dir, copia).rotas.find(r => r.codigo === '91'), antes = fs.readFileSync(copia)
    const input = { ...rota, pasta: 'ensaio', resultado: 'Falhou', resultadoNormal: 'Concluída', nivelAltoExecutado: true, resultadoNivelAlto: 'Falhou' }
    assert.throws(() => require('./lir-rotas').registrar(dir, input, copia, { rotaInicial: { ...rota, tipoExecucao: 'reteste' } }), /não autorizado/)
    assert.deepEqual(fs.readFileSync(copia), antes)
    const rows = require('./lir-rotas').registrar(dir, input, copia, { rotaInicial: { ...rota, tipoExecucao: 'reteste' }, permitirNivelAlto: true })
    const final = rows.find(r => r.codigo === '91')
    assert.equal(final.status, 'OK'); assert.equal(final.nivelAlto.status, 'NOK'); assert.equal(final.nivelAlto.idDigital, 31)
    assert.deepEqual(rows.gravacaoLir.celulas.sort(), ['J', 'K', 'M', 'N'].map(c => c + rota.linha).sort())
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('RG01 sem IO e ID recebe --- no nível alto após o teste normal, sem simular ensaio', () => {
  const { dir, copia } = copiaReal()
  try {
    const { registrar } = require('./lir-rotas')
    const rota = ler(dir, copia).rotas.find(r => r.destino === 'RG01' && r.status === 'OK')
    assert.equal(rota.nivelAlto.aplicavel, false)
    const dados = { ...rota, pasta: 'ensaio', resultado: 'Concluída', resultadoNivelAlto: 'Não aplicável' }
    const opcoes = { rotaInicial: { ...rota, tipoExecucao: 'reteste' }, permitirNivelAlto: true }
    assert.throws(() => registrar(dir, { ...dados, nivelAltoExecutado: true }, copia, opcoes), /não autorizado/)
    const resultado = registrar(dir, dados, copia, opcoes)
    assert.equal(resultado.find(r => r.codigo === rota.codigo).status, 'OK')
    assert.equal(resultado.find(r => r.codigo === rota.codigo).nivelAlto.status, '---')
    assert.ok(resultado.gravacaoLir.celulas.includes('K' + rota.linha))
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('reconciliação de RG01 altera somente Nível Alto e é idempotente', () => {
  const { dir, copia } = copiaReal()
  try {
    const { reconciliarNivelNaoAplicavel } = require('./lir-rotas')
    const antes = ler(dir, copia).rotas
    const alvo = antes.filter(r => r.destino === 'RG01')
    assert.equal(alvo.length, 6)
    const r = reconciliarNivelNaoAplicavel(dir, copia, { destino: 'RG01' })
    assert.deepEqual(r.rotas, alvo.map(rota => rota.codigo))
    assert.deepEqual(r.gravacao.celulas, alvo.map(rota => 'K' + rota.linha))
    const depois = ler(dir, copia).rotas
    assert.deepEqual(depois, antes.map(rota => r.rotas.includes(rota.codigo) ? {
      ...rota, nivelAlto: { ...rota.nivelAlto, status: '---' },
    } : rota))
    assert.deepEqual(reconciliarNivelNaoAplicavel(dir, copia, { destino: 'RG01' }), { rotas: [], gravacao: null })
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('Nível Alto explicitamente --- exclui o ensaio mesmo com IO e ID cadastrados', () => {
  const { dir, copia } = copiaReal()
  try {
    const { marcarNivelAltoNaoAplicavel } = require('../../comum/gravar-lir')
    const leitura = ler(dir, copia)
    const rota = leitura.rotas.find(r => r.codigo === '91')
    marcarNivelAltoNaoAplicavel({ arquivo: copia, hash: leitura.hash, coluna: 'K', linhas: [rota.linha] })
    const atual = ler(dir, copia).rotas.find(r => r.codigo === '91')
    assert.equal(atual.nivelAlto.aplicavel, false)
    assert.equal(atual.nivelAlto.io, rota.nivelAlto.io)
    assert.equal(atual.status, rota.status)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
