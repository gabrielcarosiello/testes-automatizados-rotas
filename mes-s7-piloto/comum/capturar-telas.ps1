param([Parameter(Mandatory=$true)][string]$Arquivo)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$area = [System.Windows.Forms.SystemInformation]::VirtualScreen
$imagem = New-Object System.Drawing.Bitmap($area.Width, $area.Height)
$grafico = [System.Drawing.Graphics]::FromImage($imagem)
try {
    $grafico.CopyFromScreen($area.Location, [System.Drawing.Point]::Empty, $area.Size)
    $imagem.Save($Arquivo, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $grafico.Dispose()
    $imagem.Dispose()
}
