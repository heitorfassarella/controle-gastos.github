# Controle Local — versão iOS/PWA

Sistema local de controle financeiro em HTML, CSS e JavaScript, adaptado para uso no iPhone como Web App/PWA.

## O que esta versão inclui

- Estrutura original preservada: dashboard, movimentações, contas fixas, cartões, dívidas, metas e backup JSON.
- Salvamento local via `localStorage`.
- Exportação/importação de backup `.json`.
- Manifesto PWA (`manifest.webmanifest`).
- Service Worker (`sw.js`) para cache offline quando publicado em HTTPS.
- Ícones para iOS/Home Screen.
- Metatags Apple para abrir em tela cheia no iPhone.
- Ajustes de layout para área segura do iPhone e teclado mobile.

## Arquivos principais

- `index.html` — tela principal.
- `style.css` — layout e responsividade.
- `app.js` — regras do sistema.
- `manifest.webmanifest` — configuração de instalação como web app.
- `sw.js` — cache offline.
- `icons/` — ícones do app.

## Como testar no computador

Abra a pasta do projeto e rode um servidor local:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

## Como usar no iPhone

Para instalar no iPhone como app, publique a pasta em um endereço HTTPS, por exemplo GitHub Pages, Netlify ou Vercel. Depois:

1. Abra o link no Safari do iPhone.
2. Toque no botão de compartilhar.
3. Toque em **Adicionar à Tela de Início**.
4. Mantenha o nome **Controle Local** ou edite.
5. Toque em **Adicionar**.
6. Abra pelo ícone criado na tela inicial.

## Observações importantes

- Abrir o `index.html` diretamente como arquivo no iPhone não instala como app.
- Para cache offline via Service Worker, use HTTPS.
- Os dados ficam no navegador/app instalado. Exporte backup JSON semanalmente.
- Ao apagar dados do Safari ou remover o web app, os dados locais podem ser perdidos.
