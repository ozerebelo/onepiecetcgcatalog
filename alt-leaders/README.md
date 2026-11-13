# Alt Leaders — página da coleção

Página estática (HTML/JS, sem backend) que mostra a coleção de alt leaders do One Piece TCG a partir da
Google Sheet **“Alt Leaders”**. Publicada no GitHub Pages em
`https://ozerebelo.github.io/onepiecetcgcatalog/`.

- Grelha com a imagem de cada carta; as que tenho em cor, com moldura e selo dourados; as que faltam
  mais apagadas.
- Filtros por set (com “tenho/total” de cada set) e por Todas / Tenho / Faltam, pesquisa e ordenação
  (folha, preço EN, preço JP, nome). Os filtros ficam no endereço (`?set=OP-09&estado=tenho`), por isso
  dá para guardar ou partilhar uma vista.
- No topo: progresso (X de 67), valor total EN e JP (com quanto já tenho e quanto falta) e total pago.
- Clicar numa carta abre o detalhe (imagem grande, preços, preço de compra, notas, link de pesquisa no
  Cardmarket).

## Pôr a funcionar (uma vez)

1. **Publicar a folha.** Na Google Sheet: *Ficheiro → Partilhar → Publicar na Web* → separador
   **Alt Leaders** → formato **Valores separados por vírgulas (.csv)** → *Publicar*. Deixa ligada a
   opção de republicar automaticamente quando houver alterações.
2. **Colar o link** que a Google mostra em `PUBLISHED_CSV_URL`, no ficheiro [`config.js`](config.js).
   (Se ficar vazio, a página usa o endereço público da folha pelo ID, que também funciona depois de a
   publicares.)
3. **Ligar o GitHub Pages.** No repositório: *Settings → Pages → Build and deployment → Source:*
   **GitHub Actions**.
4. Fazer merge para `main`. O workflow [`alt-leaders-pages.yml`](../.github/workflows/alt-leaders-pages.yml)
   corre os testes, constrói o site e publica-o. Também corre todos os dias e pode ser lançado à mão
   em *Actions → Alt Leaders site → Run workflow*.

Depois disso não há mais nada a fazer: alteras a folha e a página mostra as alterações quando é aberta
(a Google demora até ~5 minutos a atualizar o CSV publicado).

## Como funciona

| Ficheiro            | O quê                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| `index.html`        | Estrutura da página.                                                                    |
| `styles.css`        | Tema escuro, dourado `#F5C542` só para o que tenho e para o progresso.                  |
| `app.js`            | Lê os dados, desenha a página, filtros e detalhe.                                       |
| `lib.js`            | Funções puras: ler CSV, euros (`4 319,97 €`), checkboxes, totais, filtros. Com testes.  |
| `config.js`         | Link da folha.                                                                          |
| `data/…csv`         | Cópia de segurança dos dados (o build substitui-a pela versão mais recente da folha).   |
| `scripts/build.js`  | Gera `dist/`: copia os ficheiros, guarda a cópia da folha e as imagens.                 |

- **Leitura da folha.** O cabeçalho é encontrado pelos nomes das colunas (hoje está na linha 5), por isso
  as linhas de resumo por cima são ignoradas e as colunas podem mudar de ordem. Colunas usadas: Set,
  Código, Leader, Tenho, Cardmarket EN…, Cardmarket JP…, Preço de compra, Notas. Os totais são
  calculados pela página (não lidos das linhas 1–4). A nota “Preços Cardmarket: …” da linha 1 aparece
  por baixo dos totais.
- **Se a Google não responder**, a página usa a cópia guardada no site e diz isso num aviso.
- **Imagens.** O site oficial recusa imagens embebidas noutros sites (já aconteceu com a app — ver
  `packages/ingest/src/mirror.ts`). Por isso o build descarrega cada imagem de
  `https://en.onepiece-cardgame.com/images/cardlist/card/{Código}.png` **uma vez** (pedido normal e
  identificado), reduz para WebP de 480 px (~60 KB em vez de ~220 KB) e publica-a com o site. As cópias
  ficam em cache entre execuções, por isso cada imagem só é descarregada uma vez. Uma carta nova
  acrescentada à folha mostra a imagem oficial até ao próximo build (no máximo um dia) e, se essa
  falhar, um quadro com o código.

## Desenvolver localmente

```bash
cd alt-leaders
node --test                      # testes
node scripts/build.js            # gera dist/ (precisa de rede; sharp vem de `pnpm install` na raiz)
node scripts/build.js --offline  # sem rede: usa data/alt-leaders.csv e as imagens oficiais
python3 -m http.server -d dist 8000
```

Para experimentar outro CSV sem mexer na configuração: `http://localhost:8000/?csv=teste.csv`.

## Próximo passo: preços do Cardmarket automáticos

As regras atuais (linha 1 da folha): **média das 5 ofertas mais baratas, NM ou melhor, no idioma da
coluna** (EN e JP). Isto só se calcula a partir da **lista de ofertas** de cada carta, filtrada por idioma
e estado — não chega um “preço médio” genérico. Caminhos possíveis:

1. **API oficial do Cardmarket** (o caminho limpo). O pedido de ofertas de um produto aceita filtros de
   idioma e estado mínimo, que é exatamente o que as regras pedem. Um GitHub Action semanal calcularia
   a média das 5 mais baratas para EN e JP e escreveria nas colunas da folha (com uma conta de serviço
   Google). Falta confirmar se consegues obter acesso à API na tua conta (*Account → API*); pelo que sei,
   o Cardmarket deixou de dar acesso a novas contas particulares.
2. **Ficheiros públicos de preços do Cardmarket** (price guide diário em JSON). Não precisam de conta,
   mas trazem médias/tendências por produto, **sem separar idioma nem estado** — não cumprem as regras,
   serviriam só como referência.
3. **Ler as páginas do Cardmarket automaticamente** (scraping): não recomendo — os termos do site
   proíbem-no e o site bloqueia acessos automáticos.

Até lá, os preços continuam a ser atualizados na folha e a página mostra-os.
