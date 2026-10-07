import Phaser from 'phaser';
import { layerOrder, type LayerSlot } from '../../domain/art/LayerOrder';
import { weaponPose, type Point } from '../../domain/art/WeaponPose';
import type { ArmorSlot, HeroLook } from '../../domain/art/HeroLook';
import type { EnchantBand } from '../../domain/content/types';
import { Assets } from '../../generated/assets.gen';
import { parseAsepriteSheet, sliceAt, type SheetInfo } from '../../services/content/AsepriteSheet';
import type { EffectData } from '../../services/content/schema';
import { phaserColor } from '../theme/tokens';

const SCALE = 1.6;
const ARMOR_LAYERS: Readonly<Record<ArmorSlot, LayerSlot>> = {
  Chest: 'armor_chest',
  Gloves: 'armor_gloves',
  Boots: 'armor_boots',
};
const EXTRA_LAYERS = ['armor_boots', 'armor_gloves', 'armor_chest', 'fx'] as const;

interface Layer {
  readonly slot: LayerSlot;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly frames: readonly string[];
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function center(b: { x: number; y: number; w: number; h: number }): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function sheetOf(scene: Phaser.Scene, key: string): SheetInfo | null {
  const json: unknown = scene.cache.json.get(key);
  if (!json) return null;
  try {
    return parseAsepriteSheet(json);
  } catch {
    return null;
  }
}

/**
 * A hero drawn from exported layers: body, armor layers tinted per equipped item, a posed weapon image
 * and an optional fx layer. The body drives the frame of every other layer (ART-05, ART-06).
 */
export class LayeredHeroView {
  readonly root: Phaser.GameObjects.Container;
  /** `hit`: once each time an `attack` pass reaches the first frame of tag `hit`; `complete`: a non-looping tag finished. */
  readonly events = new Phaser.Events.EventEmitter();
  private readonly layers = new Map<LayerSlot, Layer>();
  private weapon: Phaser.GameObjects.Image | null = null;
  private weaponModelKey: string | null = null;
  private weaponInfo: SheetInfo | null = null;
  private behind = false;
  private tagName: string | null = null;
  private tintByLayer = new Map<LayerSlot, number>();
  private darkByLayer = new Map<LayerSlot, number>();
  private rampByLayer = new Map<LayerSlot, Phaser.Filters.ColorMatrix>();
  private lastFrame = -1;
  private glow: Phaser.GameObjects.Image | null = null;
  private aura: Phaser.GameObjects.Sprite | null = null;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  private constructor(
    private readonly scene: Phaser.Scene,
    readonly heroId: string,
    private readonly sheet: SheetInfo,
    layers: readonly Layer[],
  ) {
    this.root = scene.add.container(0, 0);
    this.root.setScale(SCALE);
    for (const l of layers) {
      this.layers.set(l.slot, l);
      this.root.add(l.sprite);
    }
    this.body.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => this.followBody());
    this.body.sprite.on(Phaser.Animations.Events.ANIMATION_START, () => this.followBody());
    this.body.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.events.emit('complete', this.tagName));
  }

  /** Null when the body sheet, its json or any present layer's texture is missing. */
  static create(scene: Phaser.Scene, heroId: string): LayeredHeroView | null {
    const keyOf = (layer: string): string => `heroes/${heroId}/${layer}`;
    const exists = (key: string): boolean => key in Assets.aseprite && scene.textures.exists(key);
    const bodyKey = keyOf('body');
    if (!exists(bodyKey)) return null;
    const sheet = sheetOf(scene, bodyKey);
    if (!sheet) return null;
    const layers: Layer[] = [];
    for (const slot of ['body', ...EXTRA_LAYERS] as const) {
      const key = keyOf(slot);
      if (slot !== 'body' && !(key in Assets.aseprite)) continue;
      if (!exists(key)) return null;
      const info = slot === 'body' ? sheet : sheetOf(scene, key);
      if (!info || info.frameCount !== sheet.frameCount) return null;
      const frames = scene.textures.get(key).getFrameNames(false);
      if (frames.length !== sheet.frameCount) return null;
      layers.push({ slot, sprite: scene.add.sprite(0, 0, key, frames[0]).setOrigin(0.5, 1), frames });
    }
    const view = new LayeredHeroView(scene, heroId, sheet, layers);
    view.createAnimations();
    view.applyOrder();
    return view;
  }

  private get body(): Layer {
    return this.layers.get('body')!;
  }

  /** Tag currently playing on the body, or null before the first `play`. */
  get currentTag(): string | null {
    return this.tagName;
  }

  get weaponModel(): string | null {
    return this.weapon ? this.weaponModelKey : null;
  }

  /** Multiply tint applied to each armor layer, as a number; absent when the layer was not exported. */
  tintOf(slot: ArmorSlot): number | undefined {
    return this.tintByLayer.get(ARMOR_LAYERS[slot]);
  }

  /** Dark end of the two-color ramp of an armor layer, when one is applied. */
  darkOf(slot: ArmorSlot): number | undefined {
    return this.darkByLayer.get(ARMOR_LAYERS[slot]);
  }

  hasTag(tag: string): boolean {
    return this.sheet.tags.has(tag);
  }

  /** Length of one pass of `tag` at speed 1, or 0 for an unknown tag. */
  tagDurationMs(tag: string): number {
    const t = this.sheet.tags.get(tag);
    if (!t) return 0;
    let total = 0;
    for (let i = t.from; i <= t.to; i++) total += this.sheet.durations[i] ?? 100;
    return total;
  }

  /** Starts `tag` on the body at `speed`; the other layers follow its frames. */
  play(tag: string, speed = 1, loop = true): boolean {
    if (!this.sheet.tags.has(tag)) return false;
    this.tagName = tag;
    const { sprite } = this.body;
    sprite.anims.timeScale = speed;
    sprite.play({ key: this.animKey(tag), repeat: loop ? -1 : 0 }, true);
    this.followBody();
    return true;
  }

  /** Applies equipped-item tints and weapon model; missing weapon textures draw nothing. */
  setLook(look: HeroLook): void {
    for (const slot of Object.keys(ARMOR_LAYERS) as ArmorSlot[]) {
      const layer = this.layers.get(ARMOR_LAYERS[slot]);
      if (!layer) continue;
      const color = hexToNumber(look.tint[slot]);
      const dark = look.tintDark[slot];
      this.tintByLayer.set(layer.slot, color);
      if (dark) {
        // Two-color ramp (ART-10): gray 0 -> dark, gray 1 -> light. Needs WebGL filters; otherwise the light color tints alone.
        layer.sprite.clearTint();
        this.setRamp(layer, hexToNumber(dark), color);
      } else {
        layer.sprite.setTint(color);
        this.setRamp(layer, null, color);
      }
    }
    this.setWeapon(look.weaponModel);
    this.followBody();
  }

  private setRamp(layer: Layer, dark: number | null, light: number): void {
    if (dark === null) this.darkByLayer.delete(layer.slot);
    else this.darkByLayer.set(layer.slot, dark);
    let filter = this.rampByLayer.get(layer.slot);
    if (dark === null) {
      if (filter) filter.active = false;
      return;
    }
    if (!filter) {
      layer.sprite.enableFilters();
      filter = layer.sprite.filters?.internal.addColorMatrix();
      if (!filter) {
        layer.sprite.setTint(light);
        return;
      }
      this.rampByLayer.set(layer.slot, filter);
    }
    filter.active = true;
    const ch = (c: number, shift: number): number => ((c >> shift) & 0xff) / 255;
    const row = (shift: number): number[] => [ch(light, shift) - ch(dark, shift), 0, 0, 0, ch(dark, shift)];
    filter.colorMatrix.set([...row(16), ...row(8), ...row(0), 0, 0, 0, 1, 0]);
  }

  /** Enchant effects shown right now; empty when effects are off or no band applies (ART-08). */
  get activeEffects(): string[] {
    const out: string[] = [];
    if (this.glow) out.push('glow');
    if (this.aura) out.push('aura');
    if (this.sparks) out.push('particles');
    return out;
  }

  /** Shows the band's glow (weapon copy), aura (body copy) and particles; no band or `enabled` false clears them. */
  setEnchant(band: EnchantBand | null, enabled: boolean, particles: EffectData | null): void {
    const shown = enabled ? band : null;
    this.setGlow(shown?.glow === true);
    this.setAura(shown?.aura === true);
    this.setSparks(shown?.particles !== undefined ? particles : null);
    this.followBody();
  }

  destroy(): void {
    this.events.removeAllListeners();
    this.root.destroy();
  }

  private setGlow(on: boolean): void {
    if (on === (this.glow !== null)) return;
    this.glow?.destroy();
    this.glow = null;
    if (!on) return;
    this.glow = this.scene.add.image(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD).setTint(phaserColor('accentGlow')).setAlpha(0.6).setVisible(false);
    this.root.add(this.glow);
    this.applyOrder();
  }

  /** The glow is a tinted additive copy of the weapon image; it follows weapon changes. */
  private poseGlow(): void {
    const { glow, weapon } = this;
    if (!glow) return;
    if (!weapon) {
      glow.setVisible(false);
      return;
    }
    if (glow.texture.key !== weapon.texture.key) glow.setTexture(weapon.texture.key, weapon.frame.name);
    glow
      .setOrigin(weapon.originX, weapon.originY)
      .setVisible(weapon.visible)
      .setPosition(weapon.x, weapon.y)
      .setRotation(weapon.rotation)
      .setScale(1.12);
  }

  private setAura(on: boolean): void {
    if (on === (this.aura !== null)) return;
    this.aura?.destroy();
    this.aura = null;
    if (!on) return;
    const body = this.body.sprite;
    this.aura = this.scene.add
      .sprite(0, 0, body.texture.key, body.frame.name)
      .setOrigin(0.5, 1)
      .setScale(1.08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(phaserColor('accentGlow'))
      .setAlpha(0.35);
    this.root.add(this.aura);
    this.applyOrder();
  }

  private setSparks(effect: EffectData | null): void {
    if ((effect === null) === (this.sparks === null)) return;
    this.sparks?.destroy();
    this.sparks = null;
    if (!effect || !this.scene.textures.exists(effect.texture)) return;
    this.sparks = this.scene.add.particles(0, -this.sheet.canvas.h / 2, effect.texture, {
      x: { min: -20, max: 20 },
      lifespan: { min: effect.lifespanMs[0] / 4, max: effect.lifespanMs[1] / 4 },
      speedY: { min: -effect.speed[1] * 3, max: -effect.speed[0] * 3 },
      scale: { start: effect.scale[1], end: effect.scale[0] },
      alpha: { start: effect.alpha[1], end: effect.alpha[0] },
      tint: phaserColor(effect.tint),
      blendMode: Phaser.BlendModes.ADD,
      frequency: Math.max(30, Math.round(effect.lifespanMs[1] / 4 / Math.max(1, effect.count))),
      maxAliveParticles: effect.count,
    });
    this.root.add(this.sparks);
    this.applyOrder();
  }

  private animKey(tag: string): string {
    return `${this.heroId}/body:${tag}`;
  }

  private createAnimations(): void {
    const { frames } = this.body;
    const key = `heroes/${this.heroId}/body`;
    for (const [tag, t] of this.sheet.tags) {
      const animKey = this.animKey(tag);
      if (this.scene.anims.exists(animKey)) continue;
      const list: Phaser.Types.Animations.AnimationFrame[] = [];
      for (let i = t.from; i <= t.to; i++) {
        list.push({ key, frame: frames[i]!, duration: this.sheet.durations[i] ?? 100 });
      }
      this.scene.anims.create({ key: animKey, frames: list });
    }
  }

  private setWeapon(model: string | null): void {
    const key = model === null ? null : `items/weapons/${model}`;
    if (key === this.weaponModelKey && (this.weapon !== null || key === null)) return;
    this.weapon?.destroy();
    this.weapon = null;
    this.weaponInfo = null;
    this.weaponModelKey = key;
    if (key === null || !(key in Assets.aseprite) || !this.scene.textures.exists(key)) return;
    const info = sheetOf(this.scene, key);
    const frame = this.scene.textures.get(key).getFrameNames(false)[0];
    if (!info || frame === undefined) return;
    this.weaponInfo = info;
    const image = this.scene.add.image(0, 0, key, frame);
    const grip = sliceAt(info, 'grip', 0);
    if (grip) {
      const g = center(grip);
      image.setOrigin(g.x / info.canvas.w, g.y / info.canvas.h);
    }
    this.weapon = image;
    this.root.add(image);
    this.applyOrder();
  }

  /** Every non-body layer takes the body's frame; the weapon is re-posed and re-stacked for it. */
  private followBody(): void {
    const body = this.body;
    const name = body.sprite.frame.name;
    const index = body.frames.indexOf(name);
    if (index < 0) return;
    for (const l of this.layers.values()) {
      if (l !== body) l.sprite.setFrame(l.frames[index]!);
    }
    const hit = this.sheet.tags.get('hit');
    if (hit && index === hit.from && index !== this.lastFrame && this.tagName === 'attack') this.events.emit('hit');
    this.lastFrame = index;
    this.aura?.setFrame(body.frames[index]!);
    this.poseWeapon(index);
    this.poseGlow();
  }

  private poseWeapon(frame: number): void {
    const image = this.weapon;
    if (!image) return;
    const grip = sliceAt(this.sheet, 'grip', frame);
    const tip = sliceAt(this.sheet, 'tip', frame);
    const weaponGrip = this.weaponInfo ? sliceAt(this.weaponInfo, 'grip', 0) : null;
    const weaponTip = this.weaponInfo ? sliceAt(this.weaponInfo, 'tip', 0) : null;
    if (!grip || !tip || !weaponGrip || !weaponTip) {
      image.setVisible(false);
      return;
    }
    const { w, h } = this.sheet.canvas;
    const toLocal = (p: Point): Point => ({ x: p.x - w / 2, y: p.y - h });
    const pose = weaponPose(toLocal(center(grip)), toLocal(center(tip)), center(weaponGrip), center(weaponTip));
    image.setVisible(true).setPosition(pose.x, pose.y).setRotation(pose.rotation);
    const behind = sliceAt(this.sheet, 'grip_behind', frame) !== null;
    if (behind !== this.behind) {
      this.behind = behind;
      this.applyOrder();
    }
  }

  private applyOrder(): void {
    let index = 0;
    if (this.aura) this.root.moveTo(this.aura, index++);
    for (const slot of layerOrder(this.behind)) {
      const obj = slot === 'weapon' ? this.weapon : this.layers.get(slot)?.sprite;
      if (obj) this.root.moveTo(obj, index++);
      if (slot === 'weapon' && obj && this.glow) this.root.moveTo(this.glow, index++);
    }
    if (this.sparks) this.root.moveTo(this.sparks, index);
  }
}
