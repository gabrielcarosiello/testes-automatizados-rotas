const { test } = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), XLSX = require('xlsx')
const { abrirPacote, corrigirNamespaces, validarXml, xmlParte, tags } = require('../../comum/planilha-xml')
const { atualizarLir, recuperarCopia, serialData } = require('../../comum/gravar-lir')
const base = path.join(__dirname, '../fixtures/LIR_base_10_3.xlsx')
const hash = b => crypto.createHash('sha256').update(b).digest('hex')
function ambiente(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xml-lir-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const arquivo = path.join(dir, 'lir.xlsx'); fs.copyFileSync(base, arquivo)
  const info = { arquivo, hash: hash(fs.readFileSync(arquivo)), linha: 9, colunas: { Teste: 'J', Data: 'M', 'Falha Identificada': 'N' }, teste: 'NOK', falha: '  Teste A < B & C 😀\nlinha 2  ', backupDir: path.join(dir, 'backups') }
  return { dir, arquivo, info }
}
function conteudos(buffer) {
  const c = XLSX.CFB.read(buffer, { type: 'buffer' })
  return new Map(c.FullPaths.map((nome, i) => [nome.slice(c.FullPaths[0].length), c.FileIndex[i]]).filter(([n, e]) => e.type === 2 && !n.startsWith('\x01')).map(([n, e]) => [n, Buffer.from(e.content)]))
}
test('reproduz o XML inválido real e recupera 501 declarações sem apagar células, 340 fórmulas e calcChain', t => {
  const { dir, arquivo } = ambiente(t), original = fs.readFileSync(arquivo)
  assert.throws(() => abrirPacote(original, { normalizar: false }), /xml namespace.*another prefix/)
  const out = path.join(dir, 'recuperada.xlsx'), resultado = recuperarCopia(arquivo, out)
  assert.equal(resultado.reparos.reduce((n, r) => n + r.declaracoes, 0), 501)
  assert.equal(resultado.originalPreservado, true)
  const antes = conteudos(original), depois = conteudos(fs.readFileSync(out)), pacote = abrirPacote(fs.readFileSync(out), { normalizar: false })
  assert.equal(antes.size, depois.size); assert.equal(pacote.partes.size, 43)
  for (const [nome, dados] of antes) if (!['xl/worksheets/sheet3.xml', 'xl/workbook.xml'].includes(nome)) assert.deepEqual(depois.get(nome), dados, nome)
  assert.deepEqual(depois.get('xl/calcChain.xml'), antes.get('xl/calcChain.xml'))
  let formulas = 0
  for (const [nome] of pacote.partes) if (/^xl\/worksheets\/.*\.xml$/.test(nome)) formulas += tags(xmlParte(pacote, nome)).filter(t => t.local === 'f' && !t.fecha).length
  assert.equal(formulas, 340)
  assert.equal(tags(xmlParte(pacote, 'xl/worksheets/sheet3.xml')).filter(t => t.local === 'f' && !t.fecha).length, 271)
  const old = XLSX.read(original, { type: 'buffer', cellStyles: true }), novo = XLSX.readFile(out, { cellStyles: true })
  assert.deepEqual(novo.SheetNames, old.SheetNames)
  for (const nome of old.SheetNames) for (const ref of Object.keys(old.Sheets[nome]).filter(k => !k.startsWith('!'))) for (const chave of ['v', 't', 'f', 'z', 's']) assert.deepEqual(novo.Sheets[nome][ref]?.[chave], old.Sheets[nome][ref][chave], nome + '/' + ref + '/' + chave)
  assert.equal(fs.readFileSync(arquivo).equals(original), true)
})
test('normalização não toca texto literal, CDATA ou valores de atributos e recusa prefixo de significado misto', () => {
  const ns = 'http://www.w3.org/XML/1998/namespace'
  const xml = `<r><t d:space="preserve" xmlns:d="${ns}">texto d:space="preserve" <![CDATA[d:space="x" <d:t/>]]></t></r>`
  const fixed = corrigirNamespaces(xml).xml
  validarXml(fixed, 'teste')
  assert.match(fixed, /<t xml:space="preserve">texto d:space="preserve"/)
  assert.match(fixed, /CDATA\[d:space="x" <d:t\/>/)
  assert.throws(() => corrigirNamespaces(`<r><a xmlns:d="${ns}" d:space="preserve"/><b xmlns:d="outro"/></r>`), /mais de um namespace/)
  assert.throws(() => validarXml('<r><x></r>', 'ruim'), /XML inválido/)
})
test('gravação real usa xml:space válido e preserva fórmulas/estilos após vários registros; backups são limitados', t => {
  const { arquivo, info } = ambiente(t), inicial = fs.readFileSync(arquivo)
  const um = atualizarLir(info), primeiro = fs.readFileSync(arquivo)
  abrirPacote(primeiro, { normalizar: false })
  const book = XLSX.readFile(arquivo, { cellStyles: true }), aba = book.Sheets['Lista de Rotas - Transferências']
  assert.equal(aba.J9.v, 'NOK'); assert.equal(aba.N9.v, info.falha)
  assert.equal(aba.H9?.v, XLSX.read(inicial, { type: 'buffer' }).Sheets['Lista de Rotas - Transferências'].H9?.v)
  const dois = atualizarLir({ ...info, hash: hash(primeiro), teste: 'OK', falha: '' })
  assert.equal(fs.readFileSync(dois.backups.inicial).equals(inicial), true)
  assert.equal(fs.readFileSync(dois.backups.anterior).equals(primeiro), true)
  assert.equal(fs.readdirSync(info.backupDir).length, 2)
  assert.deepEqual(xmlParte(abrirPacote(fs.readFileSync(arquivo)), 'xl/calcChain.xml'), xmlParte(abrirPacote(inicial), 'xl/calcChain.xml'))
})
test('hash divergente, Excel aberto, fórmula-alvo e rename bloqueado deixam original intacto', t => {
  const { arquivo, info } = ambiente(t), antes = fs.readFileSync(arquivo)
  assert.throws(() => atualizarLir({ ...info, hash: 'errado' }), /mudou/)
  const excelLock = path.join(path.dirname(arquivo), '~$' + path.basename(arquivo)); fs.writeFileSync(excelLock, '')
  assert.throws(() => atualizarLir(info), /Feche Excel/); fs.unlinkSync(excelLock)
  assert.throws(() => atualizarLir({ ...info, colunas: { ...info.colunas, Teste: 'L' } }), /contém fórmula/)
  assert.throws(() => atualizarLir(info, { renomear: () => { throw Object.assign(new Error('arquivo bloqueado'), { code: 'EPERM' }) } }), /bloqueado/)
  assert.deepEqual(fs.readFileSync(arquivo), antes)
  assert.equal(fs.existsSync(arquivo + '.gravacao.lock'), false)
  assert.equal(fs.readdirSync(path.dirname(arquivo)).some(n => n.endsWith('.tmp')), false)
})
test('edição concorrente e lock de outro processo não são sobrescritos', t => {
  const { arquivo, info } = ambiente(t), antes = fs.readFileSync(arquivo)
  fs.writeFileSync(arquivo + '.gravacao.lock', 'outro')
  assert.throws(() => atualizarLir(info), /gravação.*pendente/)
  assert.equal(fs.readFileSync(arquivo + '.gravacao.lock', 'utf8'), 'outro'); fs.unlinkSync(arquivo + '.gravacao.lock')
  const editado = Buffer.concat([antes, Buffer.from('edicao-concorrente')])
  assert.throws(() => atualizarLir(info, { agora: () => { fs.writeFileSync(arquivo, editado); return new Date() } }), /mudou durante/)
  assert.deepEqual(fs.readFileSync(arquivo), editado)
})
test('datas respeitam o sistema 1900/1904 sem depender do fuso para o dia', () => {
  assert.equal(serialData(new Date(2026, 10, 19), false), 46345)
  assert.equal(serialData(new Date(1904, 0, 1), true), 0)
})
