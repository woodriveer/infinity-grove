import Phaser from 'phaser';
import type { Encounter, FieldHero } from '../../domain/combat/CombatRules';
import type { HeroData } from '../../domain/content/types';
import type { AnimationData } from '../../services/content/schema';
import { HeroTypeDisplay } from '../HeroTypeDisplay';
import { phaserColor } from '../theme/tokens';

export type FieldPose = 'walk' | 'idle' | 'attack';

/** Attacks a hero has made in this encounter: animation cadence only (AD-007), never damage. */
export function attackCount(hero: FieldHero, enc: Encounter): number {
  return hero.alive ? Math.floor(enc.elapsedMs / hero.attackIntervalMs) : 0;
}

const BAR_W = 120;
const BAR_H = 12;
const PORTRAIT_H = 240;

/**
 * One squad hero on the field: the Aseprite sheet when the hero has an `animations` entry,
 * otherwise the portrait (or a type-colored block) with a short forward tween per attack.
 */
export class FieldHeroView {
  readonly root: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Sprite | null = null;
  private readonly still: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null = null;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly variantSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private variant = 'empty';
  private pose: FieldPose = 'walk';
  private lastAttacks = 0;
  private attacks = 0;
  private busyUntilIdle = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly hero: HeroData,
    private readonly animation: AnimationData | null,
  ) {
    this.root = scene.add.container(0, 0);
    if (animation) {
      for (const [name, def] of Object.entries(animation.variants)) {
        const sprite = scene.add.sprite(0, 0, def.sheet).setOrigin(0.5, 1).setScale(1.6).setVisible(false);
        sprite.anims.createFromAseprite(def.sheet);
        sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (a: Phaser.Animations.Animation) => {
          if (a.key === def.states['punch']?.tag) {
            this.busyUntilIdle = false;
            this.play(this.pose);
          }
        });
        this.variantSprites.set(name, sprite);
        this.root.add(sprite);
      }
    } else if (hero.portrait && scene.textures.exists(hero.portrait)) {
      const img = scene.add.image(0, 0, hero.portrait).setOrigin(0.5, 1);
      img.setScale(PORTRAIT_H / img.height);
      this.still = img;
      this.root.add(img);
    } else {
      this.still = scene.add.rectangle(0, 0, 120, PORTRAIT_H, phaserColor(HeroTypeDisplay.color(hero.heroType)), 0.9).setOrigin(0.5, 1);
      this.root.add(this.still);
    }
    this.bar = scene.add.graphics();
    this.root.add(this.bar);
  }

  /** True when the hero is drawn from a portrait instead of an Aseprite sheet. */
  get portraitFallback(): boolean {
    return this.animation === null;
  }

  get currentPose(): FieldPose {
    return this.pose;
  }

  get attackTotal(): number {
    return this.attacks;
  }

  /** Aseprite animation currently playing (null for portrait heroes). */
  get animationKey(): string | null {
    return this.variantSprites.get(this.variant)?.anims.currentAnim?.key ?? null;
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  /** Weapon variant (Krell's equipped item); ignored when the hero has no such variant. */
  setVariant(variant: string): void {
    if (!this.animation || !this.variantSprites.has(variant)) variant = 'empty';
    if (variant === this.variant && this.variantSprites.get(variant)?.visible) return;
    this.variant = variant;
    for (const [name, sprite] of this.variantSprites) sprite.setVisible(name === variant);
    this.play(this.pose);
  }

  sync(live: FieldHero | undefined, enc: Encounter | null, fighting: boolean): void {
    const alive = live?.alive ?? true;
    this.root.setAlpha(alive ? 1 : 0.35);
    this.drawBar(live);
    const pose: FieldPose = fighting ? 'idle' : 'walk';
    if (pose !== this.pose || this.animationKey === null) {
      this.pose = pose;
      this.play(pose);
    }
    if (live && enc && fighting) {
      const n = attackCount(live, enc);
      if (n > this.lastAttacks) {
        this.attacks += n - this.lastAttacks;
        this.attack();
      }
      this.lastAttacks = n;
    } else {
      this.lastAttacks = 0;
    }
  }

  destroy(): void {
    this.root.destroy();
  }

  private attack(): void {
    const sprite = this.variantSprites.get(this.variant);
    if (sprite) {
      this.busyUntilIdle = true;
      sprite.play({ key: 'punch', repeat: 0 }, true);
      return;
    }
    if (this.still) {
      this.scene.tweens.add({ targets: this.still, x: 24, duration: 60, yoyo: true });
    }
  }

  private play(pose: FieldPose): void {
    const sprite = this.variantSprites.get(this.variant);
    if (!sprite || this.busyUntilIdle) return;
    sprite.play({ key: pose === 'walk' ? 'walk' : 'idle', repeat: -1 }, true);
  }

  private drawBar(live: FieldHero | undefined): void {
    const g = this.bar;
    g.clear();
    if (!live) return;
    const ratio = Phaser.Math.Clamp(live.hp / live.maxHp, 0, 1);
    g.fillStyle(phaserColor('black'), 0.7).fillRect(-BAR_W / 2, 16, BAR_W, BAR_H);
    g.fillStyle(phaserColor(ratio > 0.3 ? 'success' : 'dangerPowerGate'), 1).fillRect(-BAR_W / 2, 16, BAR_W * ratio, BAR_H);
  }
}
