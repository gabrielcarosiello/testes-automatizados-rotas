-- Piloto 09 — levantamento somente leitura. Execute no banco usado pelo MES.
-- Não calcula DB/endereço a partir do ID e não modifica nenhum cadastro.
-- Envie o resultado para definirmos as consultas com os nomes reais dos campos.
SELECT
    s.name AS esquema,
    t.name AS tabela,
    c.column_id AS ordem,
    c.name AS coluna,
    ty.name AS tipo,
    c.max_length AS tamanho,
    c.is_nullable AS aceita_nulo
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
JOIN sys.columns AS c ON c.object_id = t.object_id
JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
WHERE t.name LIKE '%Digital%'
   OR t.name LIKE '%Alarme%'
   OR t.name LIKE '%Sensor%'
ORDER BY s.name, t.name, c.column_id;
