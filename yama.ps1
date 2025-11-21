$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cliPath = Join-Path $scriptDir "packages\yama-cli\dist\yama-cli\src\cli.js"
node $cliPath $args

