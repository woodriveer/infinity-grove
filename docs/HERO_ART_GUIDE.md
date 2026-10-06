# Infinity Grove — Guia de Arte de Heróis

Processo para desenhar um herói novo de forma que **qualquer item do jogo apareça nele sem
redesenhar animações**. Decisão registrada em [`.specs/STATE.md`](../.specs/STATE.md) (AD-005).

> **Status:** estratégia aprovada em 2026-10-06. O ferramental descrito nas seções 7 e 8
> (`art:export`, montagem em tempo de execução) ainda **não existe** no cliente; ele é a feature
> `hero-art-pipeline`, a especificar. Até lá, heróis sem folha usam o retrato como sprite
> (spec `stage-combat`).

---

## 1. A estratégia em uma frase

O **corpo** é animado quadro a quadro em Aseprite **uma vez por herói**; os **itens** não são
desenhados nas animações:

| Peça | Como aparece | Custo por item novo |
|---|---|---|
| Arma | Imagem estática presa a "encaixes" (slices) que acompanham a mão quadro a quadro | **1 desenho** |
| Peitoral, luvas, botas | Camadas da armadura em escala de cinza, tingidas com as cores do item | **0 desenhos** (só cores) |
| Nível de encantamento | Efeito em tempo de execução (brilho, aura, partículas) | **0** |
| Peça marcante (opcional) | Imagem estática extra num encaixe (ombreira, elmo) | 1 desenho, só quando valer a pena |

**Custo por herói:** as animações da seção 4, uma vez. **Custo por item:** um desenho (arma) ou
uma lista de cores (armadura).

---

## 2. Estilo

- **Anime japonês**: line art limpa, sombreamento cel com 2–3 tons por material, olhos e cabelo
  expressivos, proporção de ~6,5–7 cabeças (heróis), silhueta legível em tamanho pequeno.
- Paleta do jogo: verdes-azulados de floresta, dourado e violeta como acentos (tokens do
  `DESIGN.md`). Brilhos mágicos em `accent-glow` (teal).
- **Não é pixel art**: desenhe com antialiasing normal; o jogo renderiza suavizado.
- Cada herói precisa ser identificável pelo **tipo** sem depender só da cor (NFR-3): um elemento
  de silhueta ou acessório ligado ao tipo (Fogo, Água, Natureza, Luz, Trevas).

> ⚠ O `DESIGN.md` do jogo (`.antstack/specs/infinity-grove/`) ainda descreve "painted fantasy
> semi-realista", e os conceitos atuais (Ranger, Druida, Krell) seguem esse estilo. A mudança
> para anime precisa ser refletida lá e nos prompts de `README.md`/`UI_PROMPTS.md`.

---

## 3. Tela, tamanho e posição

| Regra | Valor |
|---|---|
| Canvas de cada quadro | **512 × 512 px** |
| Altura do personagem (pés à cabeça, sem arma) | **~400 px** |
| Linha dos pés (baseline) | **y = 480**, centralizado em **x = 256** |
| Direção | Personagem **olhando para a direita** (o inimigo fica à direita) |
| Fundo | Transparente |
| Espaço livre | Arma e efeitos podem sair do canvas: a arma é desenhada à parte |

Por que esse tamanho: o jogo trabalha num quadro lógico de 1920 × 1080 e mostra até 5 heróis em
campo a ~300–360 px de altura. 400 px desenhados dá nitidez em 1080p e sobra resolução para o
Steam Deck (escala 0,667). Retrato do Roster: **512 × 512**, busto, mesmo estilo (seção 6).

---

## 4. Animações obrigatórias

Nomes de tag **exatamente** como abaixo (o jogo procura por eles). Velocidades em quadros por
segundo; a duração de cada quadro vai no próprio Aseprite.

| Tag | Quadros | Ritmo | Loop | Observações |
|---|---|---|---|---|
| `idle` | 6 | 8 fps | sim | Respiração; mão da arma relativamente estável |
| `attack` | 6–8 | 12 fps (≤ 0,6 s total) | não | Marque o quadro do golpe com a tag extra `hit` (1 quadro). O jogo acelera a reprodução conforme a velocidade de ataque |
| `hurt` | 3 | 12 fps | não | Recuo curto ao levar dano de chefe |
| `ko` | 6 | 10 fps | não | O último quadro fica parado (herói nocauteado) |
| `victory` | 6 | 10 fps | sim | Opcional na primeira versão; usado ao derrotar chefe |

Sem `walk`: o squad luta parado; a progressão é contínua (AD-002).

---

## 5. Estrutura do arquivo Aseprite

Arquivo: `Client/art-src/heroes/<heroId>/<heroId>.aseprite` (o `heroId` é o mesmo do conteúdo,
ex.: `tide-caller`).

### 5.1 Camadas

| Camada | Conteúdo | Cor |
|---|---|---|
| `body` | Pele, cabelo, rosto, roupa base que **não muda** com equipamento | Colorida, final |
| `armor_chest` | Partes do torso que mudam com o peitoral | **Escala de cinza** |
| `armor_gloves` | Mãos/antebraços que mudam com as luvas | **Escala de cinza** |
| `armor_boots` | Pés/canelas que mudam com as botas | **Escala de cinza** |
| `fx` (opcional) | Rastro do golpe, brilho do tipo | Colorida |
| `ref` / `guide` | Rascunhos, guias | **Não exportada** (nome começa com `ref` ou `guide`) |

Regras das camadas de armadura:

- Desenhe **com valores de cinza** (branco = parte mais clara, preto = sombra). O jogo multiplica
  esses tons pela cor do item, então todo o sombreamento cel continua valendo para qualquer cor.
- Detalhes que **não** devem ser tingidos (fivelas, costuras escuras) podem ficar em `body`, por
  cima ou por baixo, conforme a ordem.
- Um herói sem luvas visíveis (ex.: mãos mágicas) pode deixar `armor_gloves` vazia; o item
  continua dando seus atributos.

### 5.2 Encaixes (slices)

Crie slices com estes nomes e **ajuste a posição em cada quadro** (o Aseprite guarda uma chave
por quadro):

| Slice | Obrigatório | Marca | Como posicionar |
|---|---|---|---|
| `grip` | sim | Ponto onde a mão segura a arma | Slice de 1 × 1 px no centro da empunhadura |
| `tip` | sim | Para onde a arma aponta | Slice de 1 × 1 px na direção da lâmina/cajado; o jogo gira a arma de `grip` para `tip` |
| `head` | não | Elmo/acessório de cabeça | Centro do topo da cabeça |
| `shoulder` | não | Ombreira (lado visível) | Centro do ombro |

Na **user data** do slice `grip`, escreva `behind` nos quadros em que a arma passa **atrás** do
corpo (ex.: braço recolhido); nos demais deixe vazio (arma na frente).

---

## 6. Desenhando itens

### Armas

- Uma imagem por **modelo** de arma (vários itens de status diferentes podem usar o mesmo modelo:
  ~10–15 modelos por tipo de arma cobrem centenas de itens).
- Canvas até **256 × 256 px**, desenhada **apontando para a direita**, com a empunhadura no ponto
  que será alinhado a `grip`.
- Arquivo: `Client/art-src/items/weapons/<modelId>.aseprite`, com um slice `grip` (empunhadura) e
  um `tip` (ponta), no mesmo padrão dos heróis.
- Mesmo estilo e espessura de linha dos heróis.

### Armaduras

- Não se desenha nada: cada item define cores em conteúdo (`content/items/<itemId>.json`):
  uma cor principal por região (`chest`, `gloves`, `boots`) e, se quiser, uma segunda cor para os
  tons escuros (degradê entre as duas).
- Peças marcantes podem ter uma imagem extra para `head` ou `shoulder` (até 256 × 256).

### Encantamento

Definido em conteúdo, não desenhado:

| Nível | Efeito |
|---|---|
| +0 a +6 | Nenhum |
| +7 a +9 | Brilho suave na arma |
| +10 a +14 | Brilho + aura no herói |
| +15 | Brilho + aura + partículas |

### Retrato

- Busto 512 × 512, mesmo personagem e estilo, fundo transparente ou da cor do tipo, usado no
  Roster, Fusão e no drop de herói.

---

## 7. Exportação (alvo do `art:export`)

Comando previsto (feature `hero-art-pipeline`), usando o Aseprite CLI:

```
npm run art:export -- art-src/heroes/tide-caller/tide-caller.aseprite
```

Ele vai gerar, em `Client/assets/heroes/<heroId>/`:

- uma folha PNG + JSON (formato Aseprite **array**, com tags e slices) para **cada camada
  exportável** (`body`, `armor_chest`, `armor_gloves`, `armor_boots`, `fx`), todas com os
  mesmos quadros e durações;
- o retrato em `assets/heroes/<heroId>/portrait.png`.

O CI **não** roda o Aseprite (precisa de licença local): os PNG/JSON exportados são versionados e o
`validate:content` confere tags, slices e camadas.

---

## 8. Como o jogo monta o herói (alvo da implementação)

1. Empilha as camadas na ordem: arma (se `behind`) → `body` → `armor_boots` → `armor_gloves` →
   `armor_chest` → acessórios → arma (se na frente) → `fx`. Todas tocam a mesma animação no
   mesmo quadro.
2. Tinge cada camada de armadura com as cores do item equipado naquele slot (slot vazio: cinza
   neutro definido no conteúdo do herói).
3. Em cada quadro, posiciona a arma no `grip` e a gira na direção de `tip`.
4. Aplica o efeito do nível de encantamento da arma.

---

## 9. Checklist antes de entregar um herói

- [ ] Canvas 512 × 512, pés em y = 480, olhando para a direita.
- [ ] Tags `idle`, `attack` (com `hit`), `hurt`, `ko` presentes; `attack` ≤ 0,6 s.
- [ ] Camadas `body`, `armor_chest`, `armor_gloves`, `armor_boots` com os nomes exatos; armaduras em
      escala de cinza.
- [ ] Slices `grip` e `tip` presentes em **todos** os quadros; `behind` marcado onde a arma passa
      atrás.
- [ ] Testado com 3 cores de armadura bem diferentes (clara, escura, saturada) e 2 armas de tamanhos
      diferentes.
- [ ] Retrato 512 × 512.
- [ ] Exportado com `art:export`, `npm run gen:assets` e `npm run validate:content` sem erros.

---

## 10. Heróis atuais

- **Krell**: folhas antigas (vazio e garra sombria) sem camadas nem encaixes. Continua com as duas
  variantes fixas até ser redesenhado neste padrão.
- **Ranger, Druida e os demais**: só conceito/retrato; serão os primeiros desenhados por este guia.
