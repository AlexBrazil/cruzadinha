# Guia de configuração do `data.json`

Este guia descreve como preencher o arquivo `data.json`, que concentra todas as configurações usadas pelo app de palavras cruzadas. O arquivo é carregado em `scripts.js` (`novo_projeto/scripts.js:89`) e processado por `prepareState` (`novo_projeto/scripts.js:97`), portanto qualquer ajuste precisa respeitar a estrutura esperada pelo código.

## Estrutura geral

````markdown
```json
{
  "title": "Título da atividade",
  "taskDescription": "<p>Instrução em HTML</p>\n",
  "words": [],
  "behaviour": {},
  "timer": {
    "limitSeconds": 180
  },
  "theme": {},
  "l10n": {},
  "accessibility": {}
}
```
````

Todos os campos são opcionais, mas `title`, `taskDescription` e principalmente `words` precisam conter dados para que a atividade funcione.

## Metadados iniciais

- `title`: texto exibido no cabeçalho (`novo_projeto/scripts.js:104`). Se vazio, o app usa "Cruzadinha" como padrão.
- `taskDescription`: string que aceita HTML simples; o valor é inserido via `innerHTML` (`novo_projeto/scripts.js:105`). Termine linhas HTML com `\n` para preservar quebras.

## Seção `words`

A lista `words` reúne pistas e respostas. O construtor `createWord` (`novo_projeto/scripts.js:152`) valida cada item e a rotina `generateLayout` (`novo_projeto/scripts.js:229`) calcula a grade automaticamente.

### Campos de cada palavra

| Campo | Obrigatório | Descrição |
| ----- | ----------- | --------- |
| `clue` | Sim | Texto apresentado na lista de pistas. Se faltar, o sistema gera "Palavra X". |
| `answer` | Sim | Resposta correta. O script normaliza maiúsculas, acentos e espaços antes de comparar (`novo_projeto/scripts.js:207`). |
| `orientation` | Não | Preferência de orientação: use `"across"` (horizontal) ou `"down"` (vertical). Caso não seja possível, o gerador pode inverter. |
| `fixWord` | Não | Defina `true` para fixar a palavra em uma posição específica. |
| `row` / `column` | Obrigatórios quando `fixWord` é `true` | Coordenadas iniciais em base 1; `toIndex` converte para índice interno (`novo_projeto/scripts.js:198`). Se `fixWord` for `false`, deixe `null` ou remova. |
| `extraImage` | Não | Objeto opcional `{ "path": "./assets/images/...png", "alt": "Descrição" }` ou com `dataUrl`. Exibe botão de pista extra quando presente (`novo_projeto/scripts.js:739`, `novo_projeto/scripts.js:1390`). |

#### Regras importantes

- Cadastre pelo menos duas palavras; com apenas uma o gerador não consegue montar a grade.
- Evite respostas idênticas ou sem letras em comum, pois o algoritmo busca interseções (`novo_projeto/scripts.js:301` em diante).
- Espaços em `answer` viram células vazias fixas. Use hífen (`-`) se quiser manter a palavra composta sem lacuna.
- A validação aceita a resposta digitada sem acentos, mesmo que o texto original tenha acento, graças a `normalizeAnswer` (`novo_projeto/scripts.js:207`).
- Para posicionamento manual (`fixWord: true`), confirme que `row` e `column` não conflitam com outras entradas; se houver conflito, o código ignora a posição fixa (`novo_projeto/scripts.js:461`).
- Garanta que arquivos citados em `extraImage.path` existam em `./assets/images` ou ajuste o caminho.

## Seção `behaviour`

Controla botões da interface:

- `enableSolutionsButton`: quando `false`, oculta "Mostrar solução" (`novo_projeto/scripts.js:130`).
- `enableRetry`: quando `false`, oculta "Tentar novamente" (`novo_projeto/scripts.js:134`).

Outros campos herdados do H5P (`enableInstantFeedback`, `scoreWords`, `applyPenalties`, `keepCorrectAnswers`) ainda não são usados no código atual, mas podem ser mantidos para compatibilidade.

## Seção `timer`

- `limitSeconds`: tempo máximo em segundos. Valor maior que zero ativa contagem regressiva e bloqueia a atividade ao final (`novo_projeto/scripts.js:1321`, `novo_projeto/scripts.js:1339`). Valor nulo, ausente ou menor que 1 mantém contagem progressiva.

## Seção `theme`

Os campos (`backgroundColor`, `gridColor`, etc.) servem como registro, porém o estilo efetivo está definido em `style.css`. Alterar `theme` ainda não muda o visual sem adaptar o CSS.

## Seção `l10n`

Mapeia os textos visíveis. Cada chave ajusta um rótulo ou mensagem configurado em `prepareState` (`novo_projeto/scripts.js:100-116`). Exemplos: `across`/`down` (orientação das pistas), `checkAnswer`/`tryAgain`/`showSolution` (botões) e `extraClue` (botão da pista extra). Mensagens como `couldNotGenerateCrossword` são exibidas se a grade falhar.

Chaves ausentes usam fallback em português definidos por `getText`.

## Seção `accessibility`

Define textos para leitores de tela e feedback de resultado (`novo_projeto/scripts.js:109-117`, `novo_projeto/scripts.js:1390`). Use frases objetivas e mantenha marcadores como `@clue`, `@solution` e `@score`, que são substituídos dinamicamente.

## Passo a passo sugerido

1. Faça uma cópia de `novo_projeto/data.json` antes de editar.
2. Ajuste `title` e `taskDescription`, conferindo a sintaxe JSON.
3. Preencha `words` e valide as pistas: revise texto, confirme caminhos de imagem e teste a geração abrindo `index.html` no navegador.
4. Defina `behaviour` conforme a experiência desejada (permitir soluções e novas tentativas ou não).
5. Configure `timer.limitSeconds` se precisar de limite de tempo e avalie o overlay de timeout.
6. Revise `l10n` e `accessibility` ao mudar idioma ou terminologia.
7. Teste a atividade: preencha palavras corretas e incorretas para verificar pontuação (`novo_projeto/scripts.js:1192`), exibição de soluções (`novo_projeto/scripts.js:1234`) e reset (`novo_projeto/scripts.js:1268`).

## Boas práticas

- Valide o JSON (ou abra `index.html`) para detectar erros de sintaxe rapidamente; a leitura falha em `loadData` (`novo_projeto/scripts.js:89`) quando o arquivo está inválido.
- Use caminhos relativos partindo de `index.html` para quaisquer recursos.
- Prefira pistas curtas para manter a lista legível.
- Documente internamente por que determinadas palavras usam `fixWord` para facilitar manutenção futura.
