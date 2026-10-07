import Phaser from 'phaser';
import { enchantBand } from '../../domain/art/Playback';
import { heroLook } from '../../domain/art/HeroLook';
import { Assets, TEST_ASSET_KEYS, type AsepriteKey, type ImageKey } from '../../generated/assets.gen';
import type { AppServices } from '../../services/AppServices';
import type { EffectData } from '../../services/content/schema';
import type { GameState } from '../../services/state/types';
import { colorHex, phaserColor } from '../theme/tokens';
import { FieldHeroView } from './FieldHeroView';

/** A live foe is on the field (the encounter is in its fighting phase). */
function isFighting(s: GameState): boolean {
  const enc = s.stageCombat.encounter;
  return enc !== null && enc.phase === 'fighting' && enc.foe !== null;
}

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
  /** Warning sink for recoverable art problems (a hero sheet that failed to load). */
  log?(message: string): void;
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
  private field: FieldHeroView[] = [];
  private fieldKey = '';
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossTimer!: Phaser.GameObjects.Text;
  private monster!: Phaser.GameObjects.Container;
  private monsterBody!: Phaser.GameObjects.Graphics;
  private fireflies: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private lastAttackCount = 0;
  private lastState: GameState | null = null;
  private unsubscribe: (() => void) | null = null;
  private fieldOrigin = { x: 0, y: 0 };
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
    for (const key of Object.keys(Assets.image) as ImageKey[]) {
      if (key.startsWith('characters/portraits/')) this.load.image(key, Assets.image[key]);
    }
    if (this.opts.audio) this.load.audio('audio/music/menu-forest', Assets.audio['audio/music/menu-forest']);
    const testKeys = new Set<string>(import.meta.env.MODE === 'production' ? TEST_ASSET_KEYS : []);
    for (const key of Object.keys(Assets.aseprite) as AsepriteKey[]) {
      if (testKeys.has(key)) continue;
      this.load.aseprite(key, Assets.aseprite[key].png, Assets.aseprite[key].json);
    }
  }

  create(): void {
    this.menuBg = this.add.image(0, 0, 'ui/backgrounds/menu-bg');
    this.logo = this.add.image(0, 0, 'ui/logo/logo');
    this.menuLayer = this.add.container(0, 0, [this.menuBg, this.logo]);

    this.forestBg = this.add.image(0, 0, 'ui/backgrounds/forest-bg');
    this.gameLayer = this.add.container(0, 0, [this.forestBg]);

    this.createMonster();
    this.createBossHud();

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

  /** Current Krell animation key, for tests and fidelity checks (null when Krell is not in the squad). */
  krellAnimation(): string | null {
    return this.field.find((v) => v.hero.heroId === 'krell')?.animationKey ?? null;
  }

  /** Field state per squad hero, for the dev hook. */
  fieldState(): Array<{
    heroId: string;
    pose: string;
    attacks: number;
    portraitFallback: boolean;
    art: string;
    tag: string | null;
    weaponModel: string | null;
    tint: Record<string, string>;
    enchantBand: number | null;
    effects: string[];
    hits: number;
    attackSpeed: number;
  }> {
    const bands = this.app.content.enchantBands?.bands ?? [];
    return this.field.map((v) => {
      const layered = v.layeredState();
      const look = v.look;
      return {
        heroId: v.hero.heroId,
        pose: v.currentPose,
        attacks: v.attackTotal,
        portraitFallback: v.portraitFallback,
        art: v.artPath,
        tag: layered?.tag ?? null,
        weaponModel: layered?.weaponModel ?? null,
        tint: layered?.tint ?? {},
        enchantBand: look ? (enchantBand(look.enchantLevel, bands)?.minLevel ?? null) : null,
        effects: layered?.effects ?? [],
        hits: layered?.hits ?? 0,
        attackSpeed: layered?.attackSpeed ?? 1,
      };
    });
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

  private createBossHud(): void {
    this.bossBar = this.add.graphics();
    this.bossTimer = this.add.text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '28px', color: colorHex.ink }).setOrigin(0.5, 0).setVisible(false);
    this.gameLayer.add([this.bossBar, this.bossTimer]);
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
    this.fieldOrigin = { x: ox, y: oy };
    this.placeField();
    this.monster.setPosition(ox + 1340, oy + 880);
    this.bossBar.setPosition(ox + 1340, oy + 700);
    this.bossTimer.setPosition(ox + 1340, oy + 650);
    this.fireflies?.setPosition(ox, oy);
    this.cameras.main.setBackgroundColor(colorHex.bgWorld);
  }

  /** Squad heroes stand in a loose line, leader nearest the foe. */
  private placeField(): void {
    const { x, y } = this.fieldOrigin;
    this.field.forEach((v, i) => v.setPosition(x + 1000 - i * 190, y + 880 - (i % 2) * 36));
  }

  private rebuildField(squad: readonly string[]): void {
    for (const v of this.field) v.destroy();
    this.field = squad.map((id) => {
      const hero = this.app.content.hero(id);
      const view = new FieldHeroView(this, hero, this.app.content.animations.find((a) => a.characterId === id) ?? null, this.opts.log);
      this.gameLayer.add(view.root);
      return view;
    });
    this.placeField();
  }

  private sync(s: GameState): void {
    const key = s.activeSquad.join('|');
    if (key !== this.fieldKey || !this.lastState) {
      this.fieldKey = key;
      this.rebuildField(s.activeSquad);
    }
    const enc = s.stageCombat.encounter;
    const fighting = isFighting(s);
    const equipment = s.krellEquipmentId ? this.app.content.equipmentById(s.krellEquipmentId) : null;
    const krellAnim = this.app.content.animations.find((a) => a.characterId === 'krell');
    const krellVariant = krellAnim?.variantByItemId[String(equipment?.animatorItemID ?? 0)] ?? 'empty';
    const items = new Map(this.app.content.items.map((i) => [i.itemId, i]));
    const bands = this.app.content.enchantBands?.bands ?? [];
    for (const view of this.field) {
      if (view.hero.art?.mode === 'layered') {
        const look = heroLook(s.equipment.equippedByHero[view.hero.heroId] ?? {}, items, view.hero.art);
        view.setLook(look);
        const band = enchantBand(look.enchantLevel, bands);
        view.setEnchant(band, this.opts.effects, this.app.content.effects.find((e) => e.effectId === band?.particles) ?? null);
      }
      if (view.hero.heroId === 'krell') view.setVariant(krellVariant);
      else view.setVariant('empty');
      view.sync(enc?.heroes.find((h) => h.heroId === view.hero.heroId), enc, fighting);
    }

    this.monster.setVisible(fighting);
    this.drawBoss(s);

    if (s.stageCombat.clicks !== this.lastAttackCount) {
      this.lastAttackCount = s.stageCombat.clicks;
      if (fighting) this.hitFlash();
    }
    this.lastState = s;
  }

  private drawBoss(s: GameState): void {
    const enc = s.stageCombat.encounter;
    const foe = enc?.phase === 'fighting' ? enc.foe : null;
    const g = this.bossBar;
    g.clear();
    if (!foe?.isBoss) {
      this.bossTimer.setVisible(false);
      return;
    }
    const ratio = Phaser.Math.Clamp(foe.hp / foe.maxHp, 0, 1);
    g.fillStyle(phaserColor('black'), 0.7).fillRect(-200, 0, 400, 22);
    g.fillStyle(phaserColor('dangerMismatch'), 1).fillRect(-200, 0, 400 * ratio, 22);
    const left = enc?.bossStepsLeft;
    this.bossTimer.setVisible(left !== null && left !== undefined);
    if (left !== null && left !== undefined) this.bossTimer.setText(`${Math.ceil(left / 10)} s`);
  }

  private hitFlash(): void {
    this.drawSlime(phaserColor('ink'));
    this.time.delayedCall(80, () => this.drawSlime(phaserColor('heroNature')));
    this.tweens.add({ targets: this.monster, scaleX: 0.92, scaleY: 1.08, duration: 60, yoyo: true });
  }
}
