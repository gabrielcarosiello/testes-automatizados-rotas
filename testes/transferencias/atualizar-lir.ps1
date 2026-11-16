param([Parameter(Mandatory=$true)][string]$Dados)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$d = Get-Content -LiteralPath $Dados -Raw -Encoding UTF8 | ConvertFrom-Json
if ($d.linha -lt 9 -or $d.teste -notin @('OK','NOK')) { throw 'Dados de atualização inválidos' }
$origem = [string]$d.arquivo
$tmp = $origem + '.atualizacao-' + [guid]::NewGuid().ToString('N') + '.tmp'
$backupTroca = $tmp + '.bak'
$entrada = $null; $arquivoZip = $null
try {
  # A abertura exclusiva detecta Excel/LibreOffice aberto e evita sobrescrever uma edição.
  $entrada = [IO.File]::Open($origem,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ([BitConverter]::ToString($sha.ComputeHash($entrada))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
  if ($hash -ne $d.hash) { throw 'A planilha mudou desde a leitura; resultado não sobrescrito' }
  $entrada.Position = 0
  $saida = [IO.File]::Create($tmp)
  try { $entrada.CopyTo($saida) } finally { $saida.Dispose() }
  $arquivoZip = [IO.Compression.ZipFile]::Open($tmp,[IO.Compression.ZipArchiveMode]::Update)
  function LerXml([string]$nome) {
    $entry = $arquivoZip.GetEntry($nome); if (-not $entry) { throw "Parte ausente: $nome" }
    $stream=$entry.Open(); try { $doc=[xml]::new(); $doc.PreserveWhitespace=$true; $doc.Load($stream); return $doc } finally { $stream.Dispose() }
  }
  $workbook=LerXml 'xl/workbook.xml'
  $sheet=$workbook.SelectSingleNode("//*[local-name()='sheet' and @name='Lista de Rotas - Transferências']")
  if (-not $sheet) { throw 'Aba de transferências não encontrada' }
  $rid=$sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $rels=LerXml 'xl/_rels/workbook.xml.rels'
  $rel=$rels.SelectSingleNode("//*[local-name()='Relationship' and @Id='$rid']")
  if (-not $rel) { throw 'Vínculo da aba não encontrado' }
  $target=$rel.GetAttribute('Target').Replace('\','/')
  if ($target.StartsWith('/')) { $parte=$target.TrimStart('/') } else { $parte='xl/'+$target }
  if ($parte -notmatch '^xl/worksheets/sheet[0-9]+\.xml$') { throw 'Caminho da aba inesperado' }
  $doc=LerXml $parte
  $ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  $row=$doc.SelectSingleNode("//*[local-name()='sheetData']/*[local-name()='row' and @r='$($d.linha)']")
  if (-not $row) { throw 'Linha de rota não encontrada' }
  function Celula([string]$col) {
    $ref=$col+[string]$d.linha
    $c=$row.SelectSingleNode("*[local-name()='c' and @r='$ref']")
    if (-not $c) { throw "Célula $ref ausente; documento não alterado" }
    return $c
  }
  function Texto([string]$col,[string]$valor) {
    $c=Celula $col
    while($c.HasChildNodes) { [void]$c.RemoveChild($c.FirstChild) }
    $c.SetAttribute('t','inlineStr')
    $is=$doc.CreateElement('is',$ns); $t=$doc.CreateElement('t',$ns)
    [void]$t.SetAttribute('space','http://www.w3.org/XML/1998/namespace','preserve')
    $t.InnerText=[regex]::Replace($valor,'[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]','')
    [void]$is.AppendChild($t); [void]$c.AppendChild($is)
  }
  Texto 'H' ([string]$d.teste)
  Texto 'L' ([string]$d.falha)
  $data=Celula 'K'; while($data.HasChildNodes) { [void]$data.RemoveChild($data.FirstChild) }
  $data.SetAttribute('t','n'); $valor=$doc.CreateElement('v',$ns)
  $valor.InnerText=[DateTime]::Today.ToOADate().ToString([Globalization.CultureInfo]::InvariantCulture); [void]$data.AppendChild($valor)
  $entry=$arquivoZip.GetEntry($parte); $stream=$entry.Open()
  try { $stream.SetLength(0); $doc.Save($stream) } finally { $stream.Dispose() }
  $arquivoZip.Dispose(); $arquivoZip=$null
  $entrada.Dispose(); $entrada=$null
  # O Replace preserva o arquivo original caso a troca seja rejeitada por bloqueio.
  [IO.File]::Replace($tmp,$origem,$backupTroca)
} finally {
  if ($arquivoZip) { $arquivoZip.Dispose() }
  if ($entrada) { $entrada.Dispose() }
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
  if (Test-Path -LiteralPath $backupTroca) { Remove-Item -LiteralPath $backupTroca -Force }
}
