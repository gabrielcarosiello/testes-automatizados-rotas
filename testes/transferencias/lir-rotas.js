'use strict'
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const XLSX = require('xlsx')
const nomeAba = 'Lista de Rotas - Transferências'
const arquivoNome = 'CLXXX.00.LIR.00.xlsx'
const campos = ['local','nome','codigo','origem','destino','rota']
const arquivo = root => {
  const pasta = path.join(root, 'planilhas')
  const arquivos = fs.readdirSync(pasta, { withFileTypes: true }).filter(item =>
    item.isFile() && item.name.toLowerCase().endsWith('.xlsx') &&
    item.name.toLowerCase() !== arquivoNome.toLowerCase() && !item.name.startsWith('~$')
  )
  if (arquivos.length !== 1) throw Error('A pasta planilhas deve conter exatamente uma planilha real .xlsx além do modelo; encontradas: ' + arquivos.length)
  return path.join(pasta, arquivos[0].name)
}
function ler(root) {
  const conteudo = fs.readFileSync(arquivo(root))
  const hash = crypto.createHash('sha256').update(conteudo).digest('hex')
  const livro = XLSX.read(conteudo, {type:'buffer'})
  const aba = livro.Sheets[nomeAba]
  if (!aba) throw Error('Aba de transferências não encontrada')
  const cel = (c,r) => String(aba[XLSX.utils.encode_cell({c,r})]?.v ?? '').trim()
  const esperado = ['Local Transferências','Nome Transferências','ID Rota','Origem','Destino','Rota','Teste','Nível Alto','Resultado','Data','Falha Identificada']
  if (!esperado.every((v,i) => cel(i+1,7) === v)) throw Error('Cabeçalho inesperado na linha 8 da aba de transferências')
  const fim = XLSX.utils.decode_range(aba['!ref']).e.r, ids = new Set(), rotas = []
  for (let r=8;r<=fim;r++) {
    const codigo = cel(3,r)
    if (!codigo) continue
    if (!/^\d+$/.test(codigo)) throw Error('ID inválido na linha '+(r+1))
    if (ids.has(codigo)) throw Error('ID duplicado: '+codigo)
    ids.add(codigo)
    const status = cel(7,r).toUpperCase()
    if (!['OK','NOK','NT','---'].includes(status)) throw Error('Teste inválido na linha '+(r+1)+': '+status)
    const rota = {local:cel(1,r),nome:cel(2,r),codigo,origem:cel(4,r),destino:cel(5,r),rota:cel(6,r),status,linha:r+1}
    if (campos.some(k=>!rota[k])) throw Error('Campo obrigatório vazio na linha '+(r+1))
    rotas.push(rota)
  }
  if (!rotas.length) throw Error('Nenhuma rota foi encontrada')
  return {rotas, hash}
}
function registrar(root,dados) {
  if (!['Concluída','Falhou'].includes(dados.resultado)) throw Error('Resultado inválido')
  const atual = ler(root), matches = atual.rotas.filter(r=>campos.every(k=>String(r[k])===String(dados[k])))
  if (matches.length !== 1) throw Error('A rota não corresponde exatamente à planilha atual')
  const rota = matches[0]
  if (!['NT','NOK'].includes(rota.status)) throw Error('O status da rota mudou para '+rota.status+'; resultado não sobrescrito')
  const dadosPasta = path.join(root,'resultados',dados.pasta)
  if (!/^[a-zA-Z0-9_-]+$/.test(dados.pasta || '') || !fs.statSync(dadosPasta).isDirectory()) throw Error('Pasta de execução inválida')
  const tarefa = path.join(dadosPasta, 'atualizacao-lir-'+crypto.randomBytes(8).toString('hex')+'.json')
  const info = {arquivo:arquivo(root),hash:atual.hash,linha:rota.linha,teste:dados.resultado==='Concluída'?'OK':'NOK',falha:dados.resultado==='Falhou' ? [dados.etapa, dados.detalhes].filter(Boolean).join(': ').slice(0,30000) : ''}
  fs.writeFileSync(tarefa,JSON.stringify(info),'utf8')
  try { execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'testes','transferencias','atualizar-lir.ps1'),'-Dados',tarefa],{encoding:'utf8',timeout:30000,windowsHide:true,stdio:['ignore','pipe','pipe']}) }
  finally { try { fs.unlinkSync(tarefa) } catch (_) {} }
  const final=ler(root).rotas.find(r=>r.codigo===rota.codigo)
  if (!final || final.status !== info.teste) throw Error('Não foi possível confirmar a gravação na planilha')
}
module.exports={ler,registrar,arquivoNome}
