Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Publicando Projeto no GitHub: Gerador-de-folha" -ForegroundColor Cyan
Write-Host "  Conta: PotFinanceiro (potfinanceiro.adm@gmail.com)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Configurando autor e email..." -ForegroundColor Yellow
git config user.name "PotFinanceiro"
git config user.email "potfinanceiro.adm@gmail.com"

Write-Host "2. Configurando o repositório remoto..." -ForegroundColor Yellow
git remote set-url origin https://github.com/PotFinanceiro/Gerador-de-folha.git

Write-Host "3. Adicionando arquivos..." -ForegroundColor Yellow
git add .

Write-Host "4. Criando commit com a reestruturação..." -ForegroundColor Yellow
git commit -m "feat: reestruturacao completa para Vercel e Supabase com worker desacoplado"

Write-Host "5. Enviando para o GitHub..." -ForegroundColor Yellow
git branch -M main
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "  [SUCESSO] Código enviado para o GitHub com êxito!" -ForegroundColor Green
    Write-Host "  URL: https://github.com/PotFinanceiro/Gerador-de-folha" -ForegroundColor Green
    Write-Host "===================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Red
    Write-Host "  [ATENÇÃO] Se pedir autenticação, faça o login na" -ForegroundColor Red
    Write-Host "  janela do navegador que abrir." -ForegroundColor Red
    Write-Host "===================================================" -ForegroundColor Red
}

