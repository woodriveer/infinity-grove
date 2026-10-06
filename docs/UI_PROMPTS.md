# Infinity Grove — Prompts de UI (catálogo completo)

Catálogo de prompts de geração de imagem (Gemini / Nano Banana) para **toda a UI** do jogo, derivado de:
[`DESIGN.md`](../.antstack/specs/infinity-grove/DESIGN.md) (tokens, componentes),
[`EXPERIENCE.md`](../.antstack/specs/infinity-grove/EXPERIENCE.md) (telas, fluxos, estados),
[`PRD.md`](../.antstack/specs/infinity-grove/PRD.md) (FR-1…FR-49) e a spec
[`playable-vertical-slice`](../.specs/features/playable-vertical-slice/spec.md).

Os 8 prompts já gerados estão em [`README.md`](./README.md) (#1–#8) e **não se repetem aqui**, exceto onde precisam ser corrigidos (seção A).

---

## Como usar

1. **Anexe referências** a cada geração: `Art/UI/Logo/infity_grove.png` + `Art/UI/Buttons/buttons.png` (e `docs/art/03_rarity_card_frames.jpg` para molduras). O modelo copia estilo muito melhor de imagem do que de texto.
2. **Cole o Style Anchor** abaixo no final de cada prompt (os prompts já assumem isso — não o repetem).
3. **Fundo para recorte:** o Nano Banana não gera transparência. Use:
   - `FLAT-MAGENTA` → peças com borda dura (molduras, botões, painéis): *"isolated on a perfectly flat solid #FF00FF magenta background, no shadow cast on the background"*.
   - `FLAT-BLACK` → peças com brilho/glow (runas, VFX, ícones brilhantes): *"isolated on a perfectly flat pure black #000000 background"* (use blend aditivo ou recorte por luminância no Unity).
4. **Telas completas (seção D) são mockups de referência de layout**, não sprites. O texto sai ilegível — isso é esperado; o texto real vem do TextMesh Pro. Use-as para compor o layout e depois recorte/gere as peças isoladas das seções B/C.
5. **9-slice:** tudo marcado com `[9-SLICE]` deve ter cantos ornamentados e laterais **uniformes e repetíveis**, para configurar Sprite Border no Sprite Editor.

### Style Anchor (colar no fim de todo prompt)

> *Painted fantasy game UI asset for "Infinity Grove", a mystical enchanted-forest idle RPG. Semi-realistic painterly style with soft brushwork (not flat vector, not cartoon-cute). Materials: carved warm wood and engraved gold trim with beveled relief and an inner groove, matching hexagonal-cut gold plaque buttons. Palette: gold #D9A94A, bronze-brown #8A6A3A, deep forest green #12241F, bioluminescent teal glow #7FE0C9, warm off-white #EFE7D8, ceremony violet #3D2A5C. Depth through glow and carved relief, never flat drop shadows. Front-on orthographic view, crisp silhouette, no text, no letters, no numbers, no watermark, no logo.*

### Tokens de referência rápida

| Token | Hex | Uso nos prompts |
|---|---|---|
| accent-gold | `#D9A94A` | botões primários, moedas, trims |
| accent-gold-dim | `#8A6A3A` | secundário/bronze |
| accent-glow | `#7FE0C9` | magia, fusão, estado ativo |
| bg-world | `#12241F` | registro in-world |
| bg-menu | `#3D2A5C` | registro cerimônia (só momentos grandes) |
| success | `#6FBF73` | clear, sucesso |
| danger-power-gate | `#C0532B` | Power Gate (ember) |
| danger-mismatch | `#5B6FD4` | Composition Mismatch (indigo) |
| tier-top | `#A64CA6` | tier máximo |

---

## A. Correções nos assets já gerados

### A1. ⚠️ Ícones de tipo — alinhar com o código
O prompt #4 gerou 6 tipos (Fire/Water/Nature/Storm/Arcane/Stone), mas `Scripts/Game/Domain/HeroType.cs` define **5**: `Fire, Water, Nature, Light, Dark`. Regenerar:

> *A set of five distinct fantasy elemental type emblems arranged in a single row with generous spacing, each a bold engraved gold-metal symbol on a small round bronze medallion: (1) Fire — a three-tongued flame; (2) Water — a single droplet with a curling wave inside; (3) Nature — a leaf wrapped by a vine curl; (4) Light — a radiant sun disc with eight long rays; (5) Dark — a crescent eclipse partially covering a hollow circle, with thin shadow tendrils. Each silhouette must be unmistakable by shape alone in grayscale at 32×32 px; no two icons share an outline. Faint element-tinted rim glow per icon (ember orange, aqua blue, leaf green, pale gold-white, deep purple). Each medallion identical in size and border. FLAT-MAGENTA background.*

### A2. Molduras de card — isoladas e sem sobreposição
A imagem #3 saiu com molduras sobrepostas e fundo de floresta, o que impede o recorte. **Não reutilize o prompt #3**: ele pede "five frames in a row" e isso briga com a instrução de uma moldura só. Use o **prompt-base** abaixo e gere **5 imagens separadas**, uma por família. Em cada geração, troque `[FRAME DESCRIPTION]` pela descrição da família (tabela logo abaixo). Anexe `docs/art/03_rarity_card_frames.jpg` como referência de estilo.

**Prompt-base:**
> *A single ornate fantasy trading-card border frame, carved wood-and-gold engraved style matching a mystical enchanted-forest theme. [FRAME DESCRIPTION]. Only ONE frame, centered, filling 80% of the canvas, portrait 3:4 proportion, perfectly symmetrical left-to-right, flat front-on view, consistent border thickness on all four sides. The empty center window is filled with flat solid #FF00FF magenta, and the background outside the frame is also flat solid #FF00FF magenta, with no shadow cast on the background. No other frames, no card art, no text.*

| # | Família (tiers, ver A3) | `[FRAME DESCRIPTION]` |
|---|---|---|
| 1 | Bone (1–3★) | *Plain bone-gray weathered wood with simple small gold corner studs, minimal ornament, no glow* |
| 2 | Bronze (4–6★) | *Bronze-brown wood #8A6A3A with delicate vine engravings running along the edges and small leaf ornaments at the corners, no glow* |
| 3 | Gold (7–9★) | *Rich gold-trimmed wood #D9A94A with leaf-and-rune engravings and a soft warm gold inner glow along the inner edge* |
| 4 | Teal-rune (10–11★) | *Ornate gold frame with glowing bioluminescent teal #7FE0C9 rune inlay along the inner groove and leafy corner flourishes* |
| 5 | Violet-infinity (12★) | *Deep violet-and-gold frame #3D2A5C with intricate interlaced infinity-symbol knotwork engravings, a strong violet glow and a small tree-of-life-infinity crest at the top center* |

> As 5 imagens devem sair com **o mesmo tamanho de canvas e a mesma janela interna**, para que a arte do herói (F02) encaixe igual em todas. Se uma sair com proporção diferente, regenere antes de recortar.

### A3. ⚠️ Tiers: 5 molduras vs. 12★
O DESIGN.md propõe 5 cores de raridade (1★–5★), mas o PRD FR-6 define **12★ de fusão** e diz que star tier *não é raridade*. Sugestão para reconciliar: **4 famílias de moldura × 3 pips** — Bone (1–3★), Bronze (4–6★), Gold (7–9★), Teal-rune (10–11★), Violet-infinity (12★, máximo). Os prompts C12 (pips) e A2 cobrem isso. **Decisão sua** — ajuste se preferir outra divisão.

---

## B. Chrome base (componentes reutilizáveis)

### UI-B01 · Painel principal (overlay) `[9-SLICE]`
> *A large rectangular fantasy UI panel frame for an overlay window, rounded-rectangle shape with an ornate double border: a thin inner engraved gold line and a thicker outer carved dark-wood frame with gold trim. Small leaf-and-vine gold ornaments only on the four corners; the straight edges are plain uniform repeating carved wood so the frame can be 9-sliced. Interior is a semi-dark translucent-looking deep forest green #12241F parchment-like fill with subtle painterly texture, slightly darker toward the edges. FLAT-MAGENTA background.*

### UI-B02 · Cabeçalho de painel (title plaque)
> *A horizontal ornate title plaque banner to sit on the top edge of a UI panel, hexagonal-cut ends matching the gold plaque buttons, gold-trimmed carved dark wood center, a small tree-of-life-as-infinity-symbol ornament at the top center, short leafy vine flourishes extending from both ends. Empty center for a title text. Wide 5:1 ratio. FLAT-MAGENTA background.*

### UI-B03 · Modal de confirmação (neutro) `[9-SLICE]`
> *A compact fantasy confirmation dialog frame, rounded rectangle, carved bronze-brown wood #8A6A3A border with a thin gold inner line, plain uniform edges for 9-slicing, small gold corner studs, interior warm dark brown with subtle wood-grain texture. Less ornate than a main panel. FLAT-MAGENTA background.*

### UI-B04 · Modal de cerimônia (registro violeta) `[9-SLICE]`
> *An ornate ceremonial dialog frame for big-moment screens, rounded rectangle with a deep violet #3D2A5C interior glowing softly from the center, heavy gold border engraved with interlaced infinity-symbol knotwork on the corners, faint teal #7FE0C9 runes along the inner edge, straight edges uniform for 9-slicing. Majestic and mystical. FLAT-BLACK background.*

### UI-B05 · Botões — estados
Os botões primário (dourado) e secundário (marrom) já existem em `buttons.png`. Faltam os estados **Hover**, **Pressed** e **Disabled**.

**Por que a geração saía errada:** `buttons.png` tem dois botões empilhados, e o modelo copia esse layout da referência. Somado a "three buttons stacked", o resultado vira várias linhas de botões misturados. A correção é gerar **um estado por imagem**, no **modo edição**, partindo de uma referência com um botão só.

**Preparação (uma vez):** recorte de `buttons.png` só o botão dourado de cima e salve como `button_gold_single.png`. Anexe **apenas esse recorte** (sem logo nem outras referências) em cada geração abaixo.

**Prompt-base (modo edição):**
> *Edit the attached image. It shows a single horizontal fantasy UI button: a long gold plaque with hexagonal pointed ends on the left and right, a thick polished gold outer rim, a thin inner gold groove line, and a recessed brushed-wood center panel. Keep EXACTLY the same silhouette, proportions, size, rim thickness and camera angle. Output ONE button only, centered, horizontal, no other buttons or copies. Change only the following: [STATE CHANGE]. Empty center, no text, no icons. Background flat solid #FF00FF magenta, no shadow cast on the background.*

| Estado | `[STATE CHANGE]` |
|---|---|
| Hover | *make the gold rim and center slightly brighter and warmer, add a soft thin teal #7FE0C9 glow hugging the outer edge of the rim, and a faint diagonal light sheen across the center panel* |
| Pressed | *make the whole button about 20% darker, the center panel looks pushed inward with a deeper inner shadow along the top inner edge, the inner groove looks deeper, no glow, no sheen* |
| Disabled | *fully desaturate it into a dull gray stone plaque with matte pewter-gray rim instead of gold, flat lighting, no shine, no glow — clearly inactive and not brown* |

> Confira: o canvas e o tamanho do botão devem bater com o original, para trocar o sprite no `Button` (Transition → Sprite Swap) sem deslocamento. Se o modelo insistir em mudar a forma, escreva no prompt *"pixel-aligned with the original, same bounding box"*.

### UI-B06 · Botão CTA de perigo/irreversível (Fusão)
> *A hexagonal-cut fantasy plaque button, same shape as the gold plaque buttons, but the center is deep violet wood with a glowing teal rune line running along the inner groove and small infinity-knot gold caps at both pointed ends — conveys a powerful, irreversible magical action. Empty center. FLAT-BLACK background.*

### UI-B07 · Botões de ícone redondos (medalhão)
> *A set of three round fantasy icon-button medallions in a row, same diameter: (1) normal — carved bronze ring with gold rim and dark-wood center; (2) hover — same with soft teal glow ring; (3) pressed — darker, recessed center. Empty centers for icons. FLAT-MAGENTA background.*

### UI-B08 · Botão fechar (X)
> *A small round fantasy close button: bronze medallion with gold rim, center engraved with an X formed by two crossed thorny twigs in gold. Readable at 40×40 px. FLAT-MAGENTA background.*

### UI-B09 · Abas (tabs) `[9-SLICE]`
> *Two fantasy UI tab shapes side by side, trapezoid tabs with slightly rounded top corners designed to attach to the top of a panel: (1) ACTIVE — gold-trimmed carved wood, brighter, with a thin teal glow line at the top edge, visually merged with the panel below; (2) INACTIVE — duller bronze-brown wood, slightly shorter, recessed. Empty centers. FLAT-MAGENTA background.*

### UI-B10 · Barra de progresso `[9-SLICE]`
> *A horizontal fantasy progress bar set, shown as three separate stacked pieces: (1) EMPTY TRACK — a long carved dark-wood groove with gold end caps shaped like small leaves; (2) GOLD FILL — a warm molten-gold liquid-like fill strip with subtle shimmer; (3) TEAL FILL — a glowing bioluminescent teal #7FE0C9 fill strip with tiny firefly sparkles. Fills sized to fit exactly inside the track. FLAT-BLACK background.*

### UI-B11 · Arco de progresso de fusão
> *A circular radial progress ring for a fusion UI: an outer engraved gold ring with small runes, an inner empty dark groove, and a separate glowing teal #7FE0C9 energy arc covering 270 degrees of the groove with wispy magical particles at its leading end. Top-down flat view, perfectly circular. FLAT-BLACK background.*

### UI-B12 · Tooltip `[9-SLICE]`
> *A small fantasy tooltip box, rounded rectangle, dark forest green #12241F interior with slight transparency feel, thin gold border line, tiny leaf ornament at each corner, and a small pointed arrow notch centered on the bottom edge. Plain uniform edges. FLAT-MAGENTA background.*

### UI-B13 · Toggle, checkbox, slider (Configurações)
> *A fantasy UI control sheet with isolated elements on a grid: (1) toggle switch OFF — carved wood capsule with a bronze knob on the left; (2) toggle ON — same capsule glowing teal with a gold knob on the right; (3) checkbox empty — small square carved-wood socket with gold rim; (4) checkbox checked — same with a gold leaf-shaped checkmark; (5) slider track — long carved groove with gold end caps; (6) slider handle — small gold acorn-shaped knob. Consistent scale. FLAT-MAGENTA background.*

### UI-B14 · Scrollbar `[9-SLICE]`
> *A vertical fantasy scrollbar: a thin carved dark-wood track with small gold caps at top and bottom, and a separate thumb shaped like a smooth polished gold-trimmed wooden capsule with a vine engraving. FLAT-MAGENTA background.*

### UI-B15 · Divisores ornamentais
> *Three horizontal ornamental divider lines for a fantasy UI, stacked: (1) a thin gold line with a small tree-of-life-infinity emblem at the center; (2) a line of twisting vine with small leaves; (3) a simple thin gold line fading at both ends with a tiny diamond at the center. Very wide ratio. FLAT-MAGENTA background.*

### UI-B16 · Badges
> *A sheet of small fantasy UI badges, isolated on a grid: (1) round red-ember notification dot with gold rim; (2) small oval gold badge (empty, for a duplicate count number); (3) a "new" badge shaped like a glowing teal sprouting leaf; (4) a small teal glowing "fusable" badge shaped like two intertwined leaves forming an infinity loop; (5) a small padlock badge in dull iron with gold rim. Each readable at 24–32 px. FLAT-BLACK background.*

---

## C. Ícones

Todos: medalhão/emblema, legível em 32–64 px, silhueta única, *"high silhouette clarity, reads in grayscale"*.

### UI-C01 · HUD
> *A set of six fantasy HUD icons in a row, engraved gold emblems without medallion backgrounds: (1) Account Power — a clenched fist inside a sprouting-leaf crest; (2) Current Stage — a small flag planted on a path stone; (3) Notification — a gold bell with a leaf clapper; (4) Offline / will sync — a cloud made of leaves with a small circular arrow; (5) Settings — a gear formed by a wooden ring with leaf teeth; (6) Gold per second — a gold coin with a small upward sprouting stem. FLAT-MAGENTA background.*

### UI-C02 · Navegação principal (barra de menus)
> *A set of eight fantasy menu navigation icons, engraved gold on round bronze medallions, all same size: (1) Roster — three hooded hero silhouettes side by side; (2) Fusion — two cards merging into one with an infinity swirl; (3) Equipment — a sword crossed over a chestplate; (4) Crafting — an anvil with a glowing teal rune above it; (5) Loadout Presets — three stacked tabs with a small bookmark leaf; (6) Stage Map — a rolled parchment map with a winding path; (7) Market — a merchant's scale with a coin on one pan; (8) Season Cave — a cave arch framed by roots with a violet glow inside. FLAT-MAGENTA background.*

### UI-C03 · Slots de equipamento (silhuetas vazias)
> *Four fantasy equipment slot icons representing EMPTY slots, drawn as faint engraved outline silhouettes in pale bronze on dark recessed square sockets with rounded corners and gold rims: (1) Weapon — a sword; (2) Chest — a chestplate; (3) Boots — a pair of boots; (4) Gloves — a gauntlet. Hollow, ghostly, clearly "empty". FLAT-MAGENTA background.*

### UI-C04 · Slot de equipamento — molduras de estado `[9-SLICE]`
> *Three square rounded-corner equipment slot frames: (1) EMPTY — recessed dark socket, dull bronze rim; (2) FILLED — raised carved wood frame with bright gold rim; (3) SELECTED — same as filled with a pulsing teal #7FE0C9 outer glow. FLAT-BLACK background.*

### UI-C05 · Ícones de item (placeholder por slot × arquétipo)
Gera 12 itens (4 slots × Strength/Intelligence/Agility), cobrindo o conteúdo mínimo da spec. Um prompt por arquétipo:
> *A set of four fantasy equipment item icons in a row, painted, each centered in its own square with consistent lighting from top-left: a weapon, a chestplate, a pair of boots, and gloves, all belonging to one matching [ARCHETYPE] set. Strength set: heavy iron-and-oak gear with bark textures and ember accents. Intelligence set: a crystal-tipped wand, embroidered violet-green robe vest, soft cloth boots, silk gloves with glowing teal runes. Agility set: a curved short blade, light leather vest, lightweight moss-green boots, fingerless leather gloves with feather details. Use only the set described for [ARCHETYPE]. FLAT-MAGENTA background.*

### UI-C06 · Arquétipos (Loadout Presets)
> *Three fantasy archetype emblems, engraved gold on round bronze medallions: (1) Strength — a bear paw print pressed into an oak shield; (2) Intelligence — an open book with a glowing teal eye rune above it; (3) Agility — a swooping hawk feather crossed with an arrow. Distinct silhouettes. FLAT-MAGENTA background.*

### UI-C07 · Afixos (Crafting)
> *A set of six small fantasy stat/affix icons, engraved gold emblems: (1) Crit Chance — a target with a small star at the bullseye; (2) Attack % — an upward sword with a plus-leaf; (3) Crit Damage — a sword blade with a cracked burst at the tip; (4) Defense — a round wooden shield with an oak leaf; (5) Speed — a winged boot; (6) Precision / Accuracy — an eye with crosshair lines. Readable at 24 px. FLAT-MAGENTA background.*

### UI-C08 · Poções de chefe (FR-14)
> *Four fantasy consumable potion icons, painted glass flasks with cork-and-gold caps, each a different bottle shape so they read by silhouette: (1) Attack % — a round flask with glowing ember-red liquid and a small sword emblem on the label; (2) Attack Speed — a tall slim vial with swirling yellow-gold liquid; (3) Double Attack — a two-chambered twin flask with teal liquid; (4) Double Projectile — a triangular flask with violet liquid and two small arrow sparks rising. Soft inner glow. FLAT-BLACK background.*

### UI-C09 · Barra de poções (slot + cooldown)
> *A horizontal fantasy potion bar holding four empty round sockets, carved dark wood with gold rims, set on a slim ornate bronze bar with leaf end caps. Separately below it: a single round socket overlay showing a dark semi-transparent radial cooldown sweep covering 60% and a thin teal ready-glow ring variant. FLAT-BLACK background.*

### UI-C10 · Nós do mapa de fases
> *Four circular stage map nodes for a fantasy world map, same size, top-down view: (1) LOCKED — dim gray stone disk with a faint carved leaf, no glow, a tiny iron padlock; (2) AVAILABLE — carved wood disk with gold rim; (3) CURRENT — gold disk with a strong warm gold glowing pulse halo; (4) CLEARED — gold-rimmed disk with a small green #6FBF73 leaf-checkmark and a tiny star. Also a fifth BOSS variant: larger disk with thorny crown ornament and red-ember glow. FLAT-BLACK background.*

### UI-C11 · Indicador de risco (FR-46)
> *Three small fantasy risk hint icons for stage select, shape-distinct: (1) Likely Clear — green #6FBF73 upward sprouting leaf in a circle; (2) Power Gate risk — ember #C0532B small closed gate in a square block; (3) Mismatch risk — indigo #5B6FD4 two crossed swords in an angular diamond. Color plus shape plus outline all differ. FLAT-BLACK background.*

### UI-C12 · Pips de estrela (tiers)
> *A sheet of small fantasy star pips for hero tier display, each a five-pointed carved star, shown in five material families in a row: (1) bone-gray, (2) bronze, (3) polished gold, (4) gold with glowing teal core, (5) violet-and-gold with an infinity engraving and violet glow. Plus a sixth: an EMPTY socket star (dark recessed outline). Each 32 px readable. FLAT-BLACK background.*

### UI-C13 · Status de comercialização (FR-48)
> *Three fantasy status icons, clearly different shapes: (1) Tradeable — a gold coin with two small arrows circling it; (2) Consumed by Fusion — a card silhouette dissolving into teal infinity-shaped wisps; (3) Account-bound — a chain link locked around a leaf. Engraved metal style on small round medallions. FLAT-MAGENTA background.*

### UI-C14 · Moeda premium e mercado
> *Two fantasy currency icons: (1) Summoning Stone — a smooth polished teal-green gemstone carved with a tree-of-life-infinity rune, glowing softly, set in a small gold claw mount; (2) Market reference price — a small parchment tag tied with twine to a gold coin. FLAT-BLACK background.*

### UI-C15 · Misc (utilitários)
> *A sheet of small fantasy utility icons, engraved gold: padlock, leaf-shaped checkmark, circular sync arrows made of vines, hourglass with glowing sand, trophy cup with laurel, a scroll (info), an exclamation mark carved as a thorn (warning, calm not alarming), left and right arrow chevrons shaped like leaves. Consistent line weight. FLAT-MAGENTA background.*

---

## D. Telas (mockups de layout, 16:9)

> Todos em **1920×1080, 16:9**. Adicione: *"full game screen UI mockup, readable layout hierarchy, placeholder text blocks allowed"* (aqui texto é tolerado porque é só referência).

### UI-D01 · Main Menu
> *Full 16:9 main menu screen for a painted fantasy idle RPG. Deep violet #3D2A5C backdrop with soft misty depth and floating teal fireflies. Upper center: the game logo (a tree-of-life whose trunks twist into an infinity symbol, glowing runes). Below it, a vertical stack of three hexagonal-cut gold plaque buttons (Continue, New Game, Settings) and a smaller brown plaque (Quit). Faint forest silhouettes framing the left and right edges. Bottom-right small version label area. Calm, mysterious, majestic.*

### UI-D02 · Starter Selection (FR-1)
> *Full 16:9 "Choose Your Hero" screen, violet ceremony register. Title plaque at top center. Four tall ornate hero cards in a row, evenly spaced, each with a portrait area, a name plate, a round element-type badge in the top corner, and a small stats block (role, type, base power) at the bottom. The second card is hovered: raised slightly with a teal glow outline. A large gold plaque confirm button at bottom center. Fireflies drifting, soft vignette.*

### UI-D03 · HUD in-game (combat view)
> *Full 16:9 gameplay screen of a 2D side-view enchanted forest (misty teal-green, deep #12241F shadows, parallax trees, fireflies). Center: a hero character punching a forest monster with a floating damage number burst. UI overlay: top-left a horizontal gold-trimmed readout with a gold coin icon and a large number, and below it an account power readout; top-center a small stage plaque with a stage number and element type badge; top-right a notification bell and a small leaf-cloud offline indicator; bottom-center a slim horizontal bar of round medallion menu buttons (Roster, Fusion, Equipment, Crafting, Presets, Map, Market, Season Cave); bottom-left five small round portraits of the active squad. UI occupies edges only, center kept clear for combat.*

### UI-D04 · HUD com chefe e poções
> *Same forest combat screen as a boss stage: fog and glow intensified, a large boss monster on the right with a long ornate boss health bar across the top center (thorny gold frame, ember-red fill). Bottom-center a potion bar with four glowing potion flasks in round sockets, one showing a cooldown sweep.*

### UI-D05 · Stage Select / Mapa (FR-10, FR-46)
> *Full 16:9 stage select overlay over a painted top-down enchanted forest map with a winding glowing trail. Circular nodes along the trail: cleared nodes with green leaf checks, the current node glowing gold, locked nodes dim gray, each node with a tiny element-type badge. Right side: an ornate carved-wood side panel showing the selected stage details — title plaque, element modifier emblem, a row of five small squad portraits with type badges, a risk hint line with an icon, and a gold "Enter Stage" plaque button.*

### UI-D06 · Roster (FR-3, FR-47)
> *Full 16:9 roster overlay panel with gold-and-wood frame over a dimmed forest background. Top section labeled Active Squad: exactly five large card slots in a row with ornate frames, hero portraits, star pips, and type badges. Lower section labeled Bench: a scrollable grid of smaller hero cards, some with a small gold duplicate-count badge and a teal "fusable" leaf badge. One bench card is selected with a teal glow and the five active slots show a subtle pulsing highlight as swap targets. Close button top-right.*

### UI-D07 · Roster — empty state
> *Same roster overlay but the Bench area is empty: a softly lit illustration of a small sapling growing from a stone in the center, with space for a gentle hint text below. Inviting, not broken-looking.*

### UI-D08 · Fusion (FR-6)
> *Full 16:9 fusion overlay panel. Left: a large hero card with ornate frame and a row of star pips. Center: a circular teal radial progress arc around a glowing infinity rune, showing duplicates owned versus required. Right: an ability preview box with current ability versus next-tier ability, an arrow between them. Bottom: a violet-and-gold rune-lined "Fuse" button. Teal magical particles swirl gently.*

### UI-D09 · Fusion — confirmação irreversível (FR-7)
> *A centered modal dialog over a darkened fusion screen: carved bronze-wood frame, a warning illustration of cards dissolving into teal infinity wisps at the top, space for two lines of plain text, and two buttons at the bottom: a brown secondary plaque (Cancel) on the left and a violet rune-lined plaque (Confirm Fusion) on the right. Serious but calm tone.*

### UI-D10 · Equipment (FR-19, FR-20)
> *Full 16:9 equipment overlay. Left: a column of the five active squad portraits as selectable tabs, one selected. Center: the selected hero's full-body portrait with four equipment slots arranged around it (weapon left, chest upper-right, gloves lower-left, boots bottom), some filled with item icons, one empty with a ghost silhouette. Right: the shared bag as a scrollable grid of square item slots. A small tooltip floating over one bag item showing affix lines.*

### UI-D11 · Crafting (FR-22)
> *Full 16:9 crafting overlay styled like a forest enchanting altar: center a stone-and-root altar with the selected item icon floating above it in teal rune light. Left panel: current affix list rows, each with a small affix icon and a value bar showing the value inside its possible range. Right panel: possible affix range and the re-roll cost with a gold coin icon, and a gold "Re-roll" plaque button.*

### UI-D12 · Loadout Presets (FR-21)
> *Full 16:9 panel with three tabs at the top with emblems (Strength bear paw, Intelligence book, Agility feather). Below, a row of four equipment slots showing the saved preset, a comparison column showing which bag items match, and two buttons: "Save Preset" (brown) and "Apply to Hero" (gold). A small pending-change preview before confirmation.*

### UI-D13 · Card Detail + Market Compare (FR-29, FR-48)
> *A centered card detail overlay: left a large ornate hero card; right an info column with a tradeable-status row (icon plus label), a divider, then two side-by-side compare boxes: "Buy on Market" box with parchment price tag icon, a price and small "updated time" line, plus a Steam-overlay style button; and "Buy Direct" box with a glowing Summoning Stone gem, fixed price and a gold button. Equal visual weight between both boxes.*

### UI-D14 · Summoning Stone — seleção de herói (FR-28, FR-49)
> *A grid of hero portraits grouped by Hero Blocks as horizontal rows with block header plaques; unlocked blocks show bright cards with a price tag, locked blocks are shown only as a single sealed stone door with a padlock and stage requirement (no hero cards visible). Deterministic, transparent feel — no mystery boxes, no chests, no random imagery.*

### UI-D15 · Season Cave (FR-35–FR-39)
> *Full 16:9 Season Cave entry screen in violet ceremony register: a glowing cave entrance of twisted roots shaped like an infinity symbol, violet and teal light pouring out. Left panel: season rules with element buff/penalty emblems. Right panel: a leaderboard list with rank numbers, small portraits and scores, top three with laurel trophy icons. Bottom: an entry requirement bar (unique heroes collected) and an "Enter Cave" violet-gold button. Also a small panel showing power normalized to a fixed baseline.*

### UI-D16 · Falha — Power Gate (FR-11, NFR-3)
> *A wide horizontal failure banner across the center of a dimmed forest combat screen: solid heavy rectangular block shape, ember-rust #C0532B stone-and-iron frame with dead vines, large closed barred gate emblem on the left, space for a plain one-line message, and two buttons below (retry, go farm). Heavy, blocky, grounded — not angular.*

### UI-D17 · Falha — Composition Mismatch (FR-11, NFR-3)
> *A failure banner across the center of a dimmed forest combat screen with an angular, clashing shape: jagged chevron-cut edges, indigo #5B6FD4 crystal-and-steel frame, emblem of two mismatched crossed swords with a cracked puzzle piece on the left, a small element-type badge showing the stage modifier, space for a plain one-line message, and a button to open the roster. Must look completely different in silhouette from a heavy rectangular gate banner.*

### UI-D18 · Stage Clear / Recompensas
> *A victory reward popup over the forest scene: an ornate gold-and-wood panel with a rising green-gold leaf burst behind a title plaque, a row of reward slots showing a gold coin pile, an equipment item icon and a hero card back, each in a square frame. Gentle celebratory glow, fireflies. Gold "Continue" button.*

### UI-D19 · Cerimônia — Novo Herói
> *Full-screen ceremony moment in violet register: darkened forest behind, a hero card floating at center rotating into view, radiant beams of teal and gold light behind it, runes orbiting in a ring, falling leaf-sparkles. Title plaque above, gold button below. Majestic, wondrous.*

### UI-D20 · Cerimônia — Star Tier Up
> *Full-screen fusion ceremony in violet register: a hero card at center with star pips igniting one by one, two ghostly duplicate cards dissolving into teal infinity-shaped energy streams flowing into the main card, bright burst at the moment of merge. Title plaque above, ability-unlocked box below.*

### UI-D21 · Offline Earnings ("Welcome back", FR-41)
> *A centered welcome-back dialog in the forest register: carved wood frame, illustration at top of a sleeping squad around a campfire with an hourglass, a line for time away, a large gold coin number readout, and a gold "Collect" button. Cozy and warm.*

### UI-D22 · Sync Toast (AD-6)
> *A small calm notification toast in the top-right of a game screen: slim rounded bar in neutral warm off-white #EFE7D8 text area with a dark translucent green background, thin gold edge, a small vine sync-arrow icon on the left, space for one line of text and a small "why?" link. Calm, not an error — no red, no warning colors.*

### UI-D23 · Settings / Pause
> *A centered settings overlay: title plaque, tabs (Audio, Video, Gameplay), rows with labels on the left and fantasy toggles and sliders on the right, a wooden dropdown, and two buttons at the bottom (Back, Apply). Forest register.*

### UI-D24 · Loading screen
> *Full 16:9 loading screen: misty forest backdrop, the tree-of-life-infinity emblem centered and softly pulsing, a slim gold-and-teal progress bar at the bottom center, a small parchment strip above it for a lore tip.*

---

## E. Fundos e cenas

### UI-E01 · Fundo Main Menu (sem logo)
> *Wide 16:9 painted fantasy background, deep violet #3D2A5C night sky melting into a silhouetted ancient forest, a faint giant tree-of-life with intertwined trunks in the far distance glowing with teal runes, floating fireflies, mist at the bottom, empty center area for a logo and buttons, darker edges. No UI, no text.*

### UI-E02 · Fundo Season Cave interior
> *Wide 16:9 painted interior of a vast root-woven cave, glowing violet and teal crystals, a winding path of stepping stones going deep, bioluminescent moss, mysterious and competitive atmosphere, darker edges for UI overlay. No UI, no text.*

### UI-E03 · Fundo Crafting (altar)
> *Wide 16:9 painted forest clearing with an ancient stone altar wrapped in roots, soft teal rune glow on the stones, hanging lanterns made of glowing seed pods, misty background, empty space on both sides for UI panels. No UI, no text.*

### UI-E04 · Fundo de cerimônia
> *Wide 16:9 abstract painted ceremony backdrop: deep violet #3D2A5C with radial teal and gold light rays from the center, drifting luminous leaves and rune particles, soft vignette. No UI, no text.*

---

## F. Heróis e card art (spec: 4 starters)

### UI-F01 · Quarto herói original (tipo Light)
Complementa Krell / Ranger / Druid e cobre um `HeroType` ainda sem herói.
> *Painted fantasy game character concept art, full body, front-facing idle pose, a stoic forest paladin-warden in bark-textured armor inlaid with pale gold, carrying a round shield shaped like a sun-disc carved from living wood and a short spear, antler-like crown of branches on the helmet, warm light glowing from runes on the shield, determined kind expression. Semi-realistic painterly illustration, soft brushwork, palette of pale gold, warm white and moss green. Isolated on a plain dark teal background for sprite extraction, no border, no text, no watermark.*

### UI-F02 · Retratos para card (todos os heróis)
Use a arte do herói como referência e gere o recorte de card:
> *Hero card portrait art of [HERO NAME/DESCRIPTION], waist-up three-quarter view, looking slightly toward the viewer, dramatic rim light in [TYPE COLOR], softly blurred enchanted forest background with fireflies, portrait 3:4 composition with the face in the upper third, painterly semi-realistic style. No frame, no text, no watermark.*

Cores de tipo sugeridas: Fire = ember orange, Water = aqua blue, Nature = leaf green, Light = pale gold, Dark = deep purple.

### UI-F03 · Verso de card
> *The back side of a fantasy trading card, portrait 3:4, deep forest green with a central gold-engraved tree-of-life-as-infinity-symbol emblem, radiating subtle teal rune circle around it, ornate gold border, symmetrical. FLAT-MAGENTA background.*

---

## G. VFX de UI (sprites)

### UI-G01 · Burst de hit / dano
> *A sprite sheet of 6 frames in a single row showing a fantasy impact burst animation: gold and teal sparks with small leaf fragments expanding from a center point then fading. Consistent frame size, centered. FLAT-BLACK background.*

### UI-G02 · Coleta de gold
> *A sprite sheet of 6 frames in a single row of a spinning gold coin engraved with a tree-of-life-infinity symbol, rotating from front to edge to back. FLAT-MAGENTA background.*

### UI-G03 · Energia de fusão
> *A sprite sheet of 8 frames in a row showing swirling teal #7FE0C9 magical energy forming an infinity-loop shape, growing brighter and ending in a flash. FLAT-BLACK background.*

### UI-G04 · Raios de cerimônia (loopable)
> *A single radial light-ray burst texture, 12 soft tapered rays of gold and teal light radiating from the exact center, symmetric, designed to be rotated slowly behind a card. FLAT-BLACK background.*

---

## Ordem sugerida de produção (vertical slice primeiro)

1. **A1** (ícones de tipo corrigidos) e **A2** (molduras isoladas) — bloqueiam cards.
2. **B01, B02, B03, B05, B08, B10, B16, C12, F01–F03** — Starter Selection + Roster.
3. **C03–C07, D10–D12** — Equipment, Crafting, Presets.
4. **B06, B11, D08, D09, D20, G03** — Fusion.
5. **C10, C11, D05, D16, D17** — Stage Select e falhas.
6. **D03, C01, C02, D18, D21, G01, G02** — HUD e loop.
7. Fora do escopo do slice (depois): **C08, C09, D04** (chefe/poções), **C13, C14, D13, D14** (Market/Stones), **D15, E02** (Season Cave), **D22** (sync).
