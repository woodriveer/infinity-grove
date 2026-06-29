# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Infinity Grove** is a clicker incremental RPG set in a forest, built with **Unity 6.0.5.1f1** using the Universal Render Pipeline (URP) 2D. The game features a character named Krell with idle/walk/punch animations.

The project is in early development: assets (sprites, animations, audio) are prepared, but core gameplay systems have not yet been written.

## Unity Project Layout

The Unity project lives inside `InfinityGrove/` at the repo root.

```
InfinityGrove/Assets/
├── Art/
│   ├── Characters/Krell/
│   │   ├── Animations/     # Krell.controller + all .anim clips
│   │   └── Sprites/        # Sprite sheets (empty/dark-claw, walk/punch)
│   ├── Effects/Fireflies/  # Firefly shader graph + texture
│   └── UI/
│       ├── Animations/     # Play.Button.Anim.Controller
│       ├── Backgrounds/    # bg.png variants
│       ├── Buttons/        # buttons.png sprite sheet
│       └── Logo/           # infity_grove.png
├── Audio/
│   ├── Music/              # menu_forest.mp3 (source) + menu_forest_EDITED.wav
│   └── SFX/
├── Fonts/                  # Cinzel Decorative (.ttf + TextMesh Pro SDF)
├── Prefabs/
│   ├── Effects/            # Fireflyes.prefab
│   └── UI/                 # Button.prefab (TMP text, gradient)
├── Scenes/                 # Main Menu.unity, Game Scene.unity, SampleScene.unity
├── Scripts/
│   ├── Editor/             # AudioEditor.cs, WavUtility.cs (editor-only)
│   └── Game/               # Gameplay scripts go here
└── Settings/               # URP renderer and pipeline assets
```

## Development Workflow

Open and run the project through the **Unity Editor** — there are no CLI build or test commands. Use Unity Test Runner (`Window > General > Test Runner`) for any PlayMode/EditMode tests.

IDE setup: `.vscode/launch.json` is configured for "Attach to Unity" debugging via the vstuc debugger. The solution file is `InfinityGrove.slnx`.

## Existing Code

All current code lives in `Assets/Scripts/Editor/` (editor-only, not included in game builds):

- **`AudioEditor.cs`** — Editor window (`Tools/Simblend/Audio Editor`) for trimming and fading audio clips. Exports processed audio as WAV to `Assets/Audio/Music/`.
- **`WavUtility.cs`** — Static helper that converts a Unity `AudioClip` to a WAV byte array (float→int16 PCM, RIFF header).

## Architecture Notes

### Rendering
2D URP configured via `Settings/Renderer2D.asset` and `Settings/UniversalRP.asset`. New scenes should use the `Lit2DSceneTemplate`.

### Input
`InputSystem_Actions.inputactions` defines a **Player** action map using Unity's new Input System (`com.unity.inputsystem@1.19.0`). Actions: Move (Vector2), Look (Vector2), Attack, Interact (Hold), Crouch, Jump, Previous, Next, Sprint. Scenes use `InputSystemUIInputModule` on the EventSystem.

### UI
TextMesh Pro is the text solution. The reusable `Button.prefab` includes TMP text with gradient coloring. Scenes use Screen Space Canvas.

### Character
Krell has an `Animator` using `Krell.controller` with three animation states: Idle, Walk, Punch. Two sprite variants exist (empty and dark-claw).

### Gameplay Scripts (to be created)
Game logic belongs in `Assets/Scripts/`. A `SetCameraRender.cs` is already referenced in the `.csproj` but not yet created. Core systems still needed: player controller, click/tap handler, incremental game manager, save system.

## Key Packages

| Purpose | Package |
|---|---|
| 2D Animation & Sprites | `com.unity.2d.animation@15.1.0`, `com.unity.2d.sprite` |
| Rendering | `com.unity.render-pipelines.universal@17.5.0` |
| Input | `com.unity.inputsystem@1.19.0` |
| UI | `com.unity.ugui@2.5.0`, TextMesh Pro (built-in) |
| Aseprite import | `com.unity.2d.aseprite@5.0.3` |
