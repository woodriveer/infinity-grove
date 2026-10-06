import Phaser from 'phaser';
import { Assets, type AsepriteKey, type ImageKey } from '../../generated/assets.gen';
import type { AppServices } from '../../services/AppServices';
import type { AnimationData, EffectData } from '../../services/content/schema';
import type { GameState } from '../../services/state/types';
import { colorHex, phaserColor } from '../theme/tokens';

export const SAFE_W = 1920;
export const SAFE_H = 1080;

export interface WorldOptions {
  effects: boolean;
  reducedMotion: boolean;
  /** Load and allow music (off in test builds). */
  audio: boolean;
  /** When false (manual clock), only the dev hook advances game time. */
  driveTime: boolean;
  advance(elapsedMs: number): void;
}

/**
 * The world canvas (AD-15: backgrounds, characters, effects are always Phaser).
 * One persistent scene: the menu backdrop with the logo, or the forest with Krell
 * and the monster. It reads state from the store and never mutates it; the idle sim
 * keeps running under any overlay (EXPERIENCE).
 */
export class WorldScene extends Phaser.Scene {
  private mode: 'menu' | 'game' = 'menu';
  private menuLayer!: Phaser.GameObjects.Container;
  private gameLayer!: Phaser.GameObjects.Container;
  private menuBg!: Phaser.GameObjects.Image;
  private forestBg!: Phaser.GameObjects.Image;
  private logo!: Phaser.GameObjects.Image;
  private krell = new Map<string, Phaser.GameObjects.Sprite>();
  private krellVariant = 'empty';
  private monster!: Phaser.GameObjects.Container;
  private monsterBody!: Phaser.GameObjects.Graphics;
  private fireflies: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private lastAttackCount = 0;
  private lastState: GameState | null = null;
  private unsubscribe: (() => void) | null = null;
  private created = false;

  constructor(
    private readonly app: AppServices,
    private readonly opts: WorldOptions,
  ) {
    super({ key: 'world' });
  }

  preload(): void {
    const images: ImageKey[] = ['ui/backgrounds/menu-bg', 'ui/backgrounds/forest-bg', 'ui/logo/logo', 'effects/fireflies/diamond'];
    for (const key of images) this.load.image(key, Assets.image[key]);
    if (this.opts.audio) this.load.audio('audio/music/menu-forest', Assets.audio['audio/music/menu-forest']);
    for (const key of Object.keys(Assets.aseprite) as AsepriteKey[]) {
      this.load.aseprite(key, Assets.aseprite[key].png, Assets.aseprite[key].json);
    }
  }

  create(): void {
    this.menuBg = this.add.image(0, 0, 'ui/backgrounds/menu-bg');
    this.logo = this.add.image(0, 0, 'ui/logo/logo');
    this.menuLayer = this.add.container(0, 0, [this.menuBg, this.logo]);

    this.forestBg = this.add.image(0, 0, 'ui/backgrounds/forest-bg');
    this.gameLayer = this.add.container(0, 0, [this.forestBg]);

    const anim = this.app.content.animations.find((a) => a.characterId === 'krell');
    if (anim) this.createKrell(anim);
    this.createMonster();

    const effect = this.app.content.effects.find((e) => e.effectId === 'fireflies');
    if (effect && this.opts.effects) this.createFireflies(effect);

    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.layout());
    this.layout();
    this.setMode(this.mode);
    this.unsubscribe = this.app.store.subscribe((s) => this.sync(s));
    this.sync(this.app.store.get());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
    this.created = true;
  }

  /** True once assets are loaded and the world exists (dev hook readiness). */
  isReady(): boolean {
    return this.created;
  }

  override update(_time: number, delta: number): void {
    if (this.opts.driveTime) this.opts.advance(delta);
  }

  setMode(mode: 'menu' | 'game'): void {
    this.mode = mode;
    if (!this.menuLayer) return;
    this.menuLayer.setVisible(mode === 'menu');
    this.gameLayer.setVisible(mode === 'game');
    this.fireflies?.setVisible(mode === 'game');
  }

  /** Current Krell animation key, for tests and fidelity checks. */
  krellAnimation(): string | null {
    return this.krell.get(this.krellVariant)?.anims.currentAnim?.key ?? null;
  }

  private createKrell(anim: AnimationData): void {
    for (const [variant, def] of Object.entries(anim.variants)) {
      const sprite = this.add.sprite(0, 0, def.sheet).setOrigin(0.5, 1).setScale(1.6).setVisible(false);
      sprite.anims.createFromAseprite(def.sheet);
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (a: Phaser.Animations.Animation) => {
        if (a.key === def.states['punch']?.tag) this.playKrellState(this.lastState);
      });
      this.krell.set(variant, sprite);
      this.gameLayer.add(sprite);
    }
  }

  private createMonster(): void {
    this.monsterBody = this.add.graphics();
    this.drawSlime(phaserColor('heroNature'));
    this.monster = this.add.container(0, 0, [this.monsterBody]).setVisible(false);
    this.gameLayer.add(this.monster);
  }

  /** The Unity Slime asset has no sprite (MonsterData.sprite is empty), so the body is drawn. */
  private drawSlime(color: number): void {
    const g = this.monsterBody;
    g.clear();
    g.fillStyle(color, 0.9);
    g.fillEllipse(0, -70, 220, 140);
    g.fillStyle(phaserColor('black'), 0.8);
    g.fillCircle(-40, -90, 12);
    g.fillCircle(40, -90, 12);
  }

  private createFireflies(e: EffectData): void {
    const count = this.opts.reducedMotion ? e.reducedMotionCount : e.count;
    this.fireflies = this.add.particles(0, 0, e.texture, {
      x: { min: 0, max: SAFE_W },
      y: { min: 0, max: SAFE_H },
      lifespan: { min: e.lifespanMs[0], max: e.lifespanMs[1] },
      speed: { min: e.speed[0], max: e.speed[1] },
      scale: { start: e.scale[1], end: e.scale[0] },
      alpha: { start: e.alpha[1], end: e.alpha[0] },
      tint: phaserColor(e.tint),
      blendMode: Phaser.BlendModes.ADD,
      frequency: Math.max(30, Math.round(e.lifespanMs[1] / Math.max(1, count))),
      maxAliveParticles: count,
    });
    this.gameLayer.add(this.fireflies);
  }

  /** Centers the 16:9 safe frame; backgrounds cover the whole (extended) view. */
  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const ox = (width - SAFE_W) / 2;
    const oy = (height - SAFE_H) / 2;
    for (const bg of [this.menuBg, this.forestBg]) {
      bg.setPosition(width / 2, height / 2);
      bg.setScale(Math.max(width / bg.width, height / bg.height));
    }
    this.logo.setPosition(width / 2, oy + 330).setScale(Math.min(1, 900 / this.logo.width));
    for (const sprite of this.krell.values()) sprite.setPosition(ox + 620, oy + 880);
    this.monster.setPosition(ox + 1340, oy + 880);
    this.fireflies?.setPosition(ox, oy);
    this.cameras.main.setBackgroundColor(colorHex.bgWorld);
  }

  private sync(s: GameState): void {
    const equipment = s.krellEquipmentId ? this.app.content.equipmentById(s.krellEquipmentId) : null;
    const anim = this.app.content.animations.find((a) => a.characterId === 'krell');
    const variant = anim?.variantByItemId[String(equipment?.animatorItemID ?? 0)] ?? 'empty';
    if (variant !== this.krellVariant || !this.lastState) {
      this.krellVariant = variant;
      for (const [name, sprite] of this.krell) sprite.setVisible(name === variant);
    }

    const fighting = s.combat.state === 'Fighting' && s.combat.monster !== null;
    this.monster.setVisible(fighting);

    if (s.combat.attackCount !== this.lastAttackCount) {
      this.lastAttackCount = s.combat.attackCount;
      const sprite = this.krell.get(this.krellVariant);
      if (sprite) sprite.play({ key: 'punch', repeat: 0 });
      if (fighting) this.hitFlash();
    } else if (!this.lastState || this.lastState.combat.state !== s.combat.state) {
      this.playKrellState(s);
    }
    this.lastState = s;
  }

  /** Krell.controller parity: walk while searching, idle while facing a monster. */
  private playKrellState(s: GameState | null): void {
    const sprite = this.krell.get(this.krellVariant);
    if (!sprite || !s) return;
    if (sprite.anims.isPlaying && sprite.anims.currentAnim?.key === 'punch') return;
    sprite.play({ key: s.combat.state === 'Walking' ? 'walk' : 'idle', repeat: -1 }, true);
  }

  private hitFlash(): void {
    this.drawSlime(phaserColor('ink'));
    this.time.delayedCall(80, () => this.drawSlime(phaserColor('heroNature')));
    this.tweens.add({ targets: this.monster, scaleX: 0.92, scaleY: 1.08, duration: 60, yoyo: true });
  }
}
