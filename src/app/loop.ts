import { TIME } from '../data/balance';
import { advanceClock } from '../sim/clock';
import type { GameState } from '../sim/state';
import { runTicks, type SimEvent } from '../sim/tick';

/** Plafond de rattrapage exprimé en heures de jeu (8 h réelles = 720 h). */
export const CATCH_UP_CAP_HOURS = TIME.offlineCapRealMs / TIME.realMsPerGameHour;

export type TickListener = (events: SimEvent[], hours: number) => void;

/**
 * Fait avancer la simulation au rythme du temps réel, par pas fixes d'une
 * heure de jeu. Le même calcul sert en jeu, au retour d'arrière-plan et au
 * lancement : on simule tout le temps écoulé depuis `syncedAtRealMs`.
 */
export class GameLoop {
  private speed = 1;
  private frameId: number | null = null;
  private readonly listeners = new Set<TickListener>();

  constructor(
    private currentState: GameState,
    private syncedAtRealMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get state(): GameState {
    return this.currentState;
  }

  /** Instant réel jusqu'auquel la simulation est à jour (à sauvegarder). */
  get syncedAt(): number {
    return this.syncedAtRealMs;
  }

  get currentSpeed(): number {
    return this.speed;
  }

  onTick(listener: TickListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Simule le temps écoulé depuis la dernière mise à jour ; renvoie le nombre d'heures jouées. */
  update(): number {
    const result = advanceClock(
      this.syncedAtRealMs,
      this.now(),
      TIME.realMsPerGameHour / this.speed,
      CATCH_UP_CAP_HOURS,
    );
    this.syncedAtRealMs = result.syncedAtRealMs;
    if (result.hours > 0) this.advance(result.hours);
    return result.hours;
  }

  /** Avance immédiatement de `hours` heures de jeu (debug). */
  advance(hours: number): void {
    const events = runTicks(this.currentState, hours);
    this.notify(events, hours);
  }

  /** Change la vitesse (debug) après avoir réglé le temps dû à l'ancienne vitesse. */
  setSpeed(speed: number): void {
    this.update();
    // Le reste d'heure entamé garde la même fraction d'heure à la nouvelle vitesse.
    const remainder = Math.max(0, this.now() - this.syncedAtRealMs);
    this.syncedAtRealMs = this.now() - (remainder * this.speed) / speed;
    this.speed = speed;
  }

  /** Remplace la partie (import, nouvelle partie). */
  replace(state: GameState, syncedAtRealMs: number): void {
    this.currentState = state;
    this.syncedAtRealMs = syncedAtRealMs;
    this.notify([], 0);
    this.update();
  }

  start(): void {
    if (this.frameId !== null) return;
    const frame = () => {
      this.update();
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private notify(events: SimEvent[], hours: number): void {
    for (const listener of this.listeners) listener(events, hours);
  }
}
