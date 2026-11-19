const sql = require('mssql')
const { existsSync, readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { join, resolve } = require('node:path')
const { createSecureContext } = require('node:tls')

const pastaNexxus = join(process.env.LOCALAPPDATA || homedir(), 'Nexxus')
const pastaAtual = join(pastaNexxus, 'cypress-clp')
const pastaAnterior = join(pastaNexxus, 'CypressCLP')
const pastaLocal = !existsSync(join(pastaAtual, 'sql.local.json')) &&
  existsSync(join(pastaAnterior, 'sql.local.json')) ? pastaAnterior : pastaAtual

function lerConfiguracaoLocal() {
  try {
    return JSON.parse(readFileSync(join(pastaLocal, 'sql.local.json'), 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw new Error(`Confira o formato e a leitura de ${join(pastaLocal, 'sql.local.json')}.`)
  }
}

async function consultarRota(codigoRota) {
  if (!Number.isInteger(codigoRota) || codigoRota < 1 || codigoRota > 32767) {
    throw new Error('Informe um código de rota inteiro entre 1 e 32767.')
  }

  const local = lerConfiguracaoLocal()
  const user = process.env.FMS_SQL_USER || local.user
  const password = process.env.FMS_SQL_PASSWORD || local.password
  if (!user || !password) {
    throw new Error(`Informe user e password em ${join(pastaLocal, 'sql.local.json')}.`)
  }

  const valorPorta = process.env.FMS_SQL_PORT || local.port
  const port = valorPorta == null || valorPorta === '' ? null : Number(valorPorta)
  if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    throw new Error('A porta TCP do SQL Server deve ser um número válido.')
  }

  if (local.trustServerCertificate !== undefined && typeof local.trustServerCertificate !== 'boolean') {
    throw new Error('Use true ou false, sem aspas, em trustServerCertificate no sql.local.json.')
  }
  const trustServerCertificate = local.trustServerCertificate === true
  let ca
  if (!trustServerCertificate && local.caFile) {
    try {
      ca = readFileSync(resolve(pastaLocal, local.caFile))
      if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw new Error('PEM esperado')
      createSecureContext({ ca })
    } catch {
      throw new Error(`Confira o certificado PEM configurado em caFile, relativo a ${pastaLocal}.`)
    }
  }

  const pool = new sql.ConnectionPool({
    server: process.env.FMS_SQL_HOST || local.server || 'CL529PR1C1',
    database: process.env.FMS_SQL_DATABASE || local.database || 'NEXXUS-MES',
    user,
    password,
    ...(port === null ? {} : { port }),
    options: {
      encrypt: true,
      trustServerCertificate,
      ...(ca ? { cryptoCredentialsDetails: { ca } } : {}),
      ...(port === null ? { instanceName: process.env.FMS_SQL_INSTANCE || local.instance || 'SQLEXPRESS' } : {}),
    },
    connectionTimeout: 15000,
    requestTimeout: 20000,
  })

  try {
    await pool.connect()
    const { recordset } = await pool.request()
      .input('CodRota', sql.SmallInt, codigoRota)
      .query(`
        SELECT rse.cod_rota, rse.cod_segmento,
               rse.cod_rota_segmento_equipamento AS id_vinculo,
               rse.num_ordem_equipamento, rse.cod_equipamento, e.des_tag,
               e.tip_equipamento, e.nom_equipamento, e.des_equipamento,
               e.des_string_conexao_espelho_entrada1 AS entrada1,
               e.des_string_conexao_espelho_entrada2 AS entrada2,
               rse.val_comando, rse.tip_fonte, rse.tip_intersecao
        FROM dbo.[Rota.Segmento.Equipamento] AS rse
        LEFT JOIN dbo.[Equipamento] AS e
          ON e.cod_equipamento = rse.cod_equipamento
        WHERE rse.cod_rota = @CodRota
        ORDER BY rse.cod_segmento, rse.num_ordem_equipamento,
                 rse.cod_rota_segmento_equipamento
      `)
    return recordset.map(({ entrada1, entrada2, ...vinculo }) => ({
      ...vinculo,
      espelhos_entrada: [entrada1?.trim() ?? '', entrada2?.trim() ?? ''],
    }))
  } finally {
    await pool.close()
  }
}

module.exports = { consultarRota }
