import type Phaser from 'phaser';
import { Assets } from '../../generated/assets.gen';

/**
 * Music (RFR-47): the menu track plays on the main menu, as in the Unity Main Menu
 * scene, and stops in the game. Volume is a 0–100 setting persisted per player by
 * the app (a convenience, not progress).
 */
export class MusicController {
  private music: Phaser.Sound.BaseSound | null = null;

  constructor(
    private readonly game: Phaser.Game,
    private readonly volume: () => number,
  ) {}

  static readonly KEY = 'audio/music/menu-forest';
  static readonly URL = Assets.audio['audio/music/menu-forest'];

  playMenu(): void {
    if (this.game.sound.locked || !this.game.cache.audio.exists(MusicController.KEY)) {
      this.game.sound.once('unlocked', () => this.playMenu());
      return;
    }
    if (this.music?.isPlaying) return;
    this.music = this.game.sound.add(MusicController.KEY, { loop: true, volume: this.volume() / 100 });
    this.music.play();
  }

  stop(): void {
    this.music?.stop();
  }

  applyVolume(): void {
    const m = this.music as (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void }) | null;
    m?.setVolume?.(this.volume() / 100);
  }
}
