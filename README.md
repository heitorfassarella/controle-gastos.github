# Controle de Gastos Local

Sistema financeiro pessoal em HTML, CSS e JavaScript puro, com salvamento local no navegador via `localStorage` e exportação/importação de backup em JSON.

## Como usar

1. Extraia o arquivo `.zip`.
2. Abra o `index.html` no navegador.
3. Cadastre cartões, dívidas e metas, se necessário.
4. Registre movimentações e contas fixas.
5. Exporte o backup JSON semanalmente.

## Recursos principais

- Dashboard com receitas, gastos, saldo, pendências, dívidas e metas.
- Filtros por mês, trimestre, semestre e ano.
- Gastos por categoria com barras coloridas e gráfico de pizza ampliado com tooltip por fatia.
- Gastos por dia exibindo todos os dias do período, com filtros por data, valor mínimo, valor máximo e ordenação.
- Movimentações em layout compacto de 4 colunas, sem rolagem lateral.
- Menu de ações por ícone: editar, duplicar, pagar/pendente e excluir.
- Categorias fixas com cores próprias.
- Categoria Transporte adicionada.
- Cartões de crédito e cartões VR.
- Pagamento VR exige cartão do tipo VR.
- Cartões exibidos de forma resumida, com histórico aberto por seta.
- Contas fixas com contorno por cor da categoria.
- Dívidas com abatimento por movimentações vinculadas pagas.
- Metas com abatimento/progresso por movimentações e contas fixas vinculadas.
- Backup e restauração por arquivo JSON.

## Categorias e cores

- Alimentação: `#E0CB51`
- Mercado: `#C98A3A`
- Transporte: `#2F80ED`
- Educação: `#4048FF`
- Saúde: `#CCE958`
- Lazer: `#E858E5`
- Assinaturas: `#58E8B9`
- Compras: `#FF7920`
- Cartão: `#AE21FF`
- Investimento: `#52B362`
- Salário: `#00C853`
- Freelancer: `#00ACC1`
- Dívidas: `#B20000`
- Outros: `#4F4F4F`

## Observação

Os dados ficam no navegador/dispositivo em que o sistema é usado. Se limpar os dados do navegador, trocar de aparelho ou usar outro perfil, as informações podem não aparecer. Por isso, use a exportação JSON como backup externo.
