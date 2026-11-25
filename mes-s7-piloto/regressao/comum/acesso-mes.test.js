const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const fonte = fs.readFileSync(path.join(__dirname, '../../comum/acesso-mes.js'), 'utf8')
const acesso = { urlMes: 'http://mes.test', usuarioMes: 'SIMULACAO' }

function simular(caminho, senhaMES) {
  const chamadas = []
  const continuacoes = []
  const modulo = { exports: {} }
  const cy = {
    visit: url => chamadas.push(['visit', url]),
    location: () => ({
      should: (_, padrao) => ({
        then: callback => continuacoes.push(() => {
          assert.match(caminho, padrao)
          callback(caminho)
        }),
      }),
    }),
    get: seletor => ({
      should() { return this },
      click: () => chamadas.push(['click', seletor]),
      type: (_, opcoes) => chamadas.push(['type', seletor, opcoes.log, opcoes.parseSpecialCharSequences]),
    }),
    env: (chaves, opcoes) => ({
      then: callback => {
        chamadas.push(['env', chaves[0], opcoes.log])
        callback({ senhaMES })
      },
    }),
  }
  vm.runInNewContext(fonte, { module: modulo, cy })
  return { acessar: modulo.exports.acessarMes, chamadas, executar: () => continuacoes.forEach(fn => fn()) }
}

test('mantém a sessão quando o MES já abre na página inicial', () => {
  const caso = simular('/nexxus-mes/home')
  caso.acessar(acesso)
  caso.executar()
  assert.deepEqual(caso.chamadas, [['visit', acesso.urlMes]])
})

test('autentica quando necessário e mantém a senha fora do Command Log', () => {
  const caso = simular('/nexxus-mes/login', 'senha-{simulada}')
  caso.acessar(acesso)
  caso.executar()
  assert.deepEqual(caso.chamadas, [
    ['visit', acesso.urlMes], ['click', '.form-select'], ['click', '[title="SIMULACAO"]'],
    ['env', 'senhaMES', false], ['type', '[name="loginModel.Password"]', false, false], ['click', '.btn:visible'],
  ])
})

test('informa senha ausente sem enviar o formulário', () => {
  const caso = simular('/nexxus-mes/login')
  caso.acessar({ ...acesso, erroSenhaMes: 'Credencial local ausente.' })
  assert.throws(caso.executar, /Credencial local ausente/)
  assert.equal(caso.chamadas.some(([, seletor]) => seletor === '.btn:visible'), false)
})
