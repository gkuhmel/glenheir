import { loadGame, saveGame } from '../save/game-save';
import { parseSave, serializeSave, createEnvelope } from '../save/envelope';
import { openStorage, type SaveStorage } from '../save/storage';
import { createInitialState } from '../sim/state';
import { GameLoop } from './loop';

/** La partie en cours : boucle de simulation et accès à la sauvegarde. */
export class Game {
  private constructor(
    readonly loop: GameLoop,
    readonly storage: SaveStorage,
    /** Message d'erreur si la sauvegarde existante était illisible. */
    readonly loadError: string | null,
  ) {}

  /** Charge la sauvegarde (ou crée une partie) et rattrape le temps écoulé. */
  static async start(): Promise<Game> {
    const storage = await openStorage();
    const result = await loadGame(storage);
    const loop =
      result.status === 'loaded'
        ? new GameLoop(result.save.state, result.save.syncedAtRealMs)
        : new GameLoop(createInitialState(), Date.now());
    loop.update();
    return new Game(loop, storage, result.status === 'corrupt' ? result.error : null);
  }

  save(): Promise<void> {
    this.loop.update();
    return saveGame(this.storage, this.loop.state, this.loop.syncedAt);
  }

  exportSave(): string {
    this.loop.update();
    return serializeSave(createEnvelope(this.loop.state, this.loop.syncedAt));
  }

  /** Remplace la partie par une sauvegarde texte ; lève une erreur si elle est invalide. */
  async importSave(text: string): Promise<void> {
    const save = parseSave(text.trim());
    this.loop.replace(save.state, save.syncedAtRealMs);
    await this.save();
  }

  async reset(): Promise<void> {
    this.loop.replace(createInitialState(), Date.now());
    await this.save();
  }
}
