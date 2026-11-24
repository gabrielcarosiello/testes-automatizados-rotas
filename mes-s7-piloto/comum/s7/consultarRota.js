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

async function consultarBanco(consulta) {
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
    return await consulta(pool.request())
  } finally {
    await pool.close()
  }
}

async function consultarRota(codigoRota) {
  if (!Number.isInteger(codigoRota) || codigoRota < 1 || codigoRota > 32767) {
    throw new Error('Informe um código de rota inteiro entre 1 e 32767.')
  }
  return consultarBanco(async request => {
    const { recordset } = await request
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
  })
}

async function consultarSilo(destino) {
  const nome = destino.toUpperCase().replace(/[- ]/g, '')
  return consultarBanco(async request => {
    const { recordset } = await request.input('Destino', sql.NVarChar(128), nome).query(`
      SELECT TOP (2) cod_silo, nom_silo, num_silo_clp, des_string_conexao
      FROM dbo.Silo
      WHERE REPLACE(REPLACE(UPPER(nom_silo), '-', ''), ' ', '') = @Destino
      ORDER BY cod_silo
    `)
    return recordset
  })
}

async function consultarRecebimentoNoSilo({ ordem, codigoRota, destino, codigoProduto }) {
  return consultarBanco(async request => {
    const { recordset } = await request
      .input('Ordem', sql.Int, Number(ordem))
      .input('Rota', sql.SmallInt, Number(codigoRota))
      .input('Destino', sql.NVarChar(128), destino)
      .input('Produto', sql.NVarChar(128), codigoProduto)
      .query(`
        SELECT TOP (1) v.num_item AS item, v.val_peso AS pesoRecebido, v.dat_final_ordem AS finalizadoEm, s.val_peso_estoque AS saldoSilo
        FROM dbo.[Recebimento.Ordem.Valor] AS v
        JOIN dbo.[Ordem.Recebimento.Produto] AS i ON i.cod_ordem_recebimento = v.cod_ordem_recebimento AND i.num_item = v.num_item
        JOIN dbo.Produto AS p ON p.cod_produto = i.cod_produto
        JOIN dbo.Silo AS s ON s.cod_silo = v.cod_destino AND s.cod_produto = i.cod_produto
        WHERE v.cod_ordem_recebimento = @Ordem AND v.cod_rota = @Rota
        AND s.nom_silo = @Destino AND p.nom_sigla_produto = @Produto
        AND v.dat_final_ordem IS NOT NULL AND v.val_peso > 0 AND s.val_peso_estoque > 0 AND i.tip_situacao = 4
        AND NOT EXISTS (SELECT 1 FROM dbo.Recebimento AS r WHERE r.cod_ordem_recebimento = @Ordem)
        ORDER BY v.dat_final_ordem DESC
      `)
    return recordset[0] ?? null
  })
}

async function consultarRecebimentoEnsacados({ numero, codigoProduto }) {
  return consultarBanco(async request => {
    const { recordset } = await request
      .input('Ordem', sql.Int, Number(numero))
      .input('Produto', sql.NVarChar(128), codigoProduto)
      .query(`
        SELECT i.num_item AS item, e.val_quantidade AS quantidadeRecebida, e.val_peso AS pesoRecebido,
               e.cod_armazem_destino AS armazem, e.dat_atualizacao AS recebidoEm
        FROM dbo.[Ordem.Recebimento] AS o
        JOIN dbo.[Ordem.Recebimento.Produto] AS i ON i.cod_ordem_recebimento = o.cod_ordem_recebimento
        JOIN dbo.Produto AS p ON p.cod_produto = i.cod_produto
        JOIN dbo.[Unidade.Carga.Estoque.Log] AS e ON e.num_primario = o.cod_ordem_recebimento AND e.num_secundario = i.num_item
        WHERE o.cod_ordem_recebimento = @Ordem AND o.tip_ensacados = 1
          AND p.nom_sigla_produto = @Produto AND i.tip_situacao = 4
          AND e.tip_lote = 1 AND e.tip_operacao = 1 AND e.val_quantidade > 0 AND e.val_peso > 0
          AND NOT EXISTS (
            SELECT 1 FROM dbo.[Ordem.Recebimento.Produto] AS pendente
            WHERE pendente.cod_ordem_recebimento = o.cod_ordem_recebimento
              AND (ISNULL(pendente.tip_situacao, 0) <> 4 OR ISNULL(pendente.val_quantidade_disponivel, 0) > 0)
          )
        ORDER BY e.dat_atualizacao DESC
      `)
    return recordset[0] ?? null
  })
}

module.exports = { consultarRota, consultarSilo, consultarRecebimentoNoSilo, consultarRecebimentoEnsacados }
