import { OFFLINE } from '../data/balance';
import { parseSave, serializeSave, createEnvelope } from '../save/envelope';
import { loadGame, saveGame } from '../save/game-save';
import { openStorage, type SaveStorage } from '../save/storage';
import { executeCommand, type Command, type CommandResult } from '../sim/commands';
import { createInitialState, type GameState } from '../sim/state';
import { summarizeAbsence, type AbsenceSummary } from '../sim/summary';
import { GameLoop } from './loop';

/** Graine d'une nouvelle partie : seul endroit où l'aléatoire vient de l'appareil. */
function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}

const newGame = (): GameState => createInitialState(newSeed());

/** La partie en cours : boucle de simulation, commandes et sauvegarde. */
export class Game {
  private constructor(
    readonly loop: GameLoop,
    readonly storage: SaveStorage,
    /** Message d'erreur si la sauvegarde existante était illisible. */
    readonly loadError: string | null,
    /** Résumé du rattrapage au lancement, s'il mérite d'être affiché. */
    readonly startSummary: AbsenceSummary | null,
  ) {}

  /** Charge la sauvegarde (ou crée une partie) et rattrape le temps écoulé. */
  static async start(): Promise<Game> {
    const storage = await openStorage();
    const result = await loadGame(storage);
    const loop =
      result.status === 'loaded'
        ? new GameLoop(result.save.state, result.save.syncedAtRealMs)
        : new GameLoop(newGame(), Date.now());
    const summary = catchUp(loop);
    return new Game(loop, storage, result.status === 'corrupt' ? result.error : null, summary);
  }

  get state(): GameState {
    return this.loop.state;
  }

  /** Rattrape le temps passé en arrière-plan ; renvoie un résumé si l'absence a été longue. */
  resume(): AbsenceSummary | null {
    return catchUp(this.loop);
  }

  /** Exécute une commande du joueur, prévient l'interface et sauvegarde. */
  execute(command: Command): CommandResult {
    this.loop.update();
    const result = executeCommand(this.loop.state, command);
    if (result.ok) {
      this.loop.changed(result.events);
      this.save().catch((error) => console.error('Sauvegarde impossible', error));
    }
    return result;
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
    this.loop.replace(newGame(), Date.now());
    await this.save();
  }
}

function catchUp(loop: GameLoop): AbsenceSummary | null {
  const fromHour = loop.state.time.hour;
  const { hours, events } = loop.update();
  if (hours < OFFLINE.summaryMinHours) return null;
  return summarizeAbsence(loop.state, fromHour, events);
}
