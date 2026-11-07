@echo off
chcp 65001 > nul
echo ===================================================
echo   Publicando Projeto no GitHub: Gerador-de-folha
echo   Conta: PotFinanceiro (potfinanceiro.adm@gmail.com)
echo ===================================================
echo.

echo 1. Configurando autor e email...
git config user.name "PotFinanceiro"
git config user.email "potfinanceiro.adm@gmail.com"

echo.
echo 2. Configurando o novo repositorio remoto...
git remote set-url origin https://github.com/PotFinanceiro/Gerador-de-folha.git

echo.
echo 3. Adicionando todos os arquivos...
git add .

echo.
echo 4. Criando commit com a reestruturacao...
git commit -m "feat: reestruturacao completa para Vercel e Supabase com worker desacoplado"

echo.
echo 5. Enviando para o GitHub (branch main)...
git branch -M main
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ===================================================
    echo   [SUCESSO] Codigo enviado com exito para:
    echo   https://github.com/PotFinanceiro/Gerador-de-folha
    echo ===================================================
) else (
    echo ===================================================
    echo   [AVISO] Se o envio pedir autenticacao, faça login
    echo   na janela que abrir ou rode: gh auth login
    echo ===================================================
)
echo.
pause
