const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

function configurar(s7, rotas = [{ codigo: '91', status: 'NT' }, { codigo: '73', status: 'NT' }]) {
  const tarefas = []
  const mensagens = []
  const origem = fs.readFileSync(path.join(__dirname, '..', 'cypress.config.js'), 'utf8')
  const modulo = { exports: {} }
  vm.runInNewContext(origem, {
    module: modulo,
    __dirname: path.resolve(__dirname, '..'),
    console: { log: texto => mensagens.push(texto) },
    require(id) {
      if (id === 'fs') return {
        existsSync: nome => nome.endsWith('s7.local.json') && s7 !== undefined,
        readFileSync: () => JSON.stringify(s7),
      }
      if (id === 'path') return path
      if (id === 'cypress') return { defineConfig: objeto => objeto }
      if (id === './comum/execucao') return { lerExecucao: () => ({ planilha: null, numTestsKeptInMemory: 5 }) }
      if (id === './comum/credenciais-mes') return { lerSenhaMes: () => ({ erro: 'Senha MES ausente.' }) }
      if (id === './comum/s7/nivel-alto') return require('./s7/nivel-alto')
      if (id === './comum/s7/piloto') return { criarPiloto: () => ({ prepararS7() {}, confirmarS7() {} }) }
      if (id === './cypress.base.config') return { e2e: { setupNodeEvents: (_, config) => config } }
      if (id === './testes/transferencias/config') return {
        e2e: { setupNodeEvents: (_, config, options) => ({ ...config, expose: { rotas: require('../testes/transferencias/selecao-lir').selecionarRotas(rotas, options) } }) },
      }
      throw new Error(id)
    },
  })
  const config = modulo.exports.e2e.setupNodeEvents((tipo, valores) => tarefas.push(...Object.keys(valores)), {
    projectRoot: '/projeto', specPattern: 'testes/**/*.cy.js', env: {},
  })
  return { dados: config.expose.catalogoRev00, tarefas, mensagens }
}

test('S7 ativa por arquivo local, filtra 91 e registra tarefas sem depender de env', () => {
  const { dados, tarefas, mensagens } = configurar({ habilitado: true, codigoRota: 91, monitor: 'http://localhost:3000' })
  assert.equal(dados.execucao.erroSenhaMes, 'Senha MES ausente.')
  assert.equal(dados.pilotoS7, true)
  assert.equal(dados.rotas.length, 1)
  assert.equal(dados.rotas[0].codigo, '91')
  assert.ok(tarefas.includes('prepararS7') && tarefas.includes('confirmarS7'))
  assert.match(mensagens.join(' '), /MES \+ S7/)
})

test('configuração ausente ou sem habilitado impede execução silenciosa só MES', () => {
  assert.match(configurar(undefined).dados.erro, /Configure s7.local/)
  assert.match(configurar({}).dados.erro, /habilitado/)
  assert.match(configurar({ habilitado: true, codigoRota: 99 }).dados.erro, /não foi encontrada/)
})

test('modo MES explícito e seleção null para todas as pendentes', () => {
  const { dados, tarefas } = configurar({ habilitado: false, codigoRota: null })
  assert.equal(dados.pilotoS7, false)
  assert.equal(dados.rotas.length, 2)
  assert.equal(tarefas.length, 0)
  assert.equal(configurar(undefined, []).dados.erro, undefined)
})

test('consulta do botão usa documento atual após rerender e recusa ambiguidade', () => {
  let query
  let documento = { elementos: [{ textContent: 'Iniciar', visivel: true, id: 'antigo' }] }
  const criarColecao = elementos => ({
    length: elementos.length,
    elementos,
    find: () => criarColecao(elementos),
    filter: fn => criarColecao(elementos.filter((elemento, indice) => fn(indice, elemento))),
  })
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'consultas-mes.js'), 'utf8'), {
    require: id => require(id),
    Cypress: {
      Commands: { addQuery: (_, fn) => { query = fn } },
      $: doc => criarColecao(doc.elementos),
      dom: { isVisible: elemento => elemento.visivel },
    },
    cy: { state: () => documento },
  })
  const resolver = query.call({ set() {} }, 'button', 'Iniciar')
  assert.equal(resolver().elementos[0].id, 'antigo')
  documento = { elementos: [{ textContent: 'Iniciar', visivel: true, id: 'novo' }] }
  assert.equal(resolver().elementos[0].id, 'novo')
  documento.elementos.push({ textContent: 'Iniciar', visivel: true })
  assert.throws(resolver, /Mais de um/)
})

test('imports locais dos testes apontam para arquivos presentes no pacote', () => {
  const { createRequire } = require('node:module')
  function conferir(pasta) {
    for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
      const arquivo = path.join(pasta, item.name)
      if (item.isDirectory()) conferir(arquivo)
      else if (arquivo.endsWith('.js')) {
        const resolver = createRequire(arquivo)
        const texto = fs.readFileSync(arquivo, 'utf8')
        for (const match of texto.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
          assert.doesNotThrow(() => resolver.resolve(match[1]), `${arquivo}: ${match[1]}`)
        }
      }
    }
  }
  conferir(path.resolve(__dirname, '..', 'testes'))
})

test('rota explícita já OK entra como reteste; lote continua apenas NT/NOK', () => {
  const linhas = [{ codigo: '91', status: 'OK' }, { codigo: '73', status: 'NT' }]
  const explicita = configurar({ habilitado: true, codigoRota: 91 }, linhas).dados
  assert.equal(explicita.erro, undefined)
  assert.equal(explicita.rotas[0].tipoExecucao, 'reteste')
  assert.equal(explicita.rotas[0].statusInicial, 'OK')
  const lote = configurar({ habilitado: true, codigoRota: null }, linhas).dados
  assert.deepEqual(lote.rotas.map(r => r.codigo), ['73'])
})
