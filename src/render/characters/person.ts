import { Container, Graphics } from 'pixi.js';

/** Tenue d'un personnage, selon son rôle. */
export interface Outfit {
  skin: number;
  hair: number;
  shirt: number;
  trousers: number;
  /** Bleu de travail, tablier, gilet… porté par-dessus la chemise. */
  overlay?: number;
  hat?: 'cap' | 'none';
  hatColor?: number;
  kilt?: number;
}

export type Pose = 'idle' | 'walk' | 'work';

/** Dimensions d'un personnage vu de profil (pieds à l'origine). */
const HIP = 34;
const SHOULDER = 64;

/**
 * Personnage articulé vu de profil : jambes et bras pivotent aux hanches et aux
 * épaules pour marcher, travailler ou respirer.
 */
export class Person {
  readonly view = new Container();
  private readonly body = new Container();
  private readonly legBack = new Graphics();
  private readonly legFront = new Graphics();
  private readonly armBack = new Graphics();
  private readonly armFront = new Graphics();
  private phase: number;
  pose: Pose = 'idle';

  /** `phase` décale les animations pour que deux personnages ne bougent pas en même temps. */
  constructor(outfit: Outfit, phase = 0) {
    this.phase = phase;
    const darker = (c: number) => ((c >> 1) & 0x7f7f7f) + 0x101010;
    const leg = (g: Graphics, color: number) => {
      g.roundRect(-5, 0, 10, HIP - 4, 4).fill(color);
      g.roundRect(-5, HIP - 7, 15, 7, 3).fill(0x2a1f17);
      g.position.set(0, -HIP);
    };
    leg(this.legBack, darker(outfit.trousers));
    leg(this.legFront, outfit.trousers);
    const arm = (g: Graphics, color: number) => {
      g.roundRect(-4.5, 0, 9, 28, 4.5).fill(color);
      g.circle(0, 29, 4.5).fill(outfit.skin);
      g.position.set(0, -SHOULDER + 4);
    };
    arm(this.armBack, darker(outfit.shirt));
    arm(this.armFront, outfit.shirt);

    const torso = new Graphics();
    torso.roundRect(-12, -SHOULDER - 2, 24, SHOULDER - HIP + 8, 9).fill(outfit.shirt);
    if (outfit.overlay !== undefined) {
      torso.roundRect(-11, -SHOULDER + 8, 22, SHOULDER - HIP - 2, 5).fill(outfit.overlay);
      torso.rect(-8, -SHOULDER - 1, 3, 12).fill(outfit.overlay);
      torso.rect(5, -SHOULDER - 1, 3, 12).fill(outfit.overlay);
    }
    if (outfit.kilt !== undefined) {
      torso.poly([-13, -HIP - 4, 13, -HIP - 4, 15, -HIP + 14, -15, -HIP + 14]).fill(outfit.kilt);
      for (let x = -11; x < 14; x += 6)
        torso.rect(x, -HIP - 4, 2, 18).fill({ color: 0x000000, alpha: 0.25 });
    }
    const head = new Graphics();
    head.rect(-4, -SHOULDER - 8, 8, 8).fill(outfit.skin);
    head.circle(0, -SHOULDER - 17, 11).fill(outfit.skin);
    head.circle(-2, -SHOULDER - 22, 10).fill(outfit.hair);
    head.circle(5, -SHOULDER - 18, 1.6).fill(0x2a1f17);
    head.circle(9, -SHOULDER - 13, 2).fill({ color: 0xd98a6a, alpha: 0.6 });
    if (outfit.hat === 'cap') {
      head.roundRect(-11, -SHOULDER - 31, 21, 10, 5).fill(outfit.hatColor ?? 0x4a4038);
      head.roundRect(4, -SHOULDER - 25, 13, 4, 2).fill(outfit.hatColor ?? 0x4a4038);
    }

    this.body.addChild(this.armBack, this.legBack, torso, this.legFront, head, this.armFront);
    this.view.addChild(this.body);
  }

  /** Tourne le personnage vers la gauche (-1) ou la droite (1). */
  face(direction: number): void {
    if (direction !== 0) this.view.scale.x = Math.sign(direction) * Math.abs(this.view.scale.x);
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    switch (this.pose) {
      case 'walk': {
        this.phase += dt * 9;
        const swing = Math.sin(this.phase);
        this.legFront.rotation = swing * 0.5;
        this.legBack.rotation = -swing * 0.5;
        this.armFront.rotation = -swing * 0.55;
        this.armBack.rotation = swing * 0.55;
        this.body.y = -Math.abs(Math.cos(this.phase)) * 2.5;
        break;
      }
      case 'work': {
        // Geste répété : pelleter, tourner une vanne, brosser.
        this.phase += dt * 5;
        const stroke = Math.sin(this.phase);
        this.armFront.rotation = -1.1 + stroke * 0.6;
        this.armBack.rotation = -0.9 + stroke * 0.5;
        this.legFront.rotation = 0.12;
        this.legBack.rotation = -0.12;
        this.body.rotation = 0.06 + stroke * 0.04;
        this.body.y = 0;
        break;
      }
      default: {
        this.phase += dt * 2;
        this.legFront.rotation = 0;
        this.legBack.rotation = 0;
        this.armFront.rotation = Math.sin(this.phase) * 0.05;
        this.armBack.rotation = -Math.sin(this.phase) * 0.05;
        this.body.rotation = 0;
        this.body.y = Math.sin(this.phase) * 0.8;
      }
    }
    if (this.pose !== 'work') this.body.rotation = 0;
  }
}

/** Tenues par rôle (les autres rôles arrivent avec le recrutement, étape 6). */
export const OUTFITS = {
  worker: {
    skin: 0xf0c8a0,
    hair: 0x6b4226,
    shirt: 0xd9cfb8,
    trousers: 0x3d5a80,
    overlay: 0x3d5a80,
    hat: 'cap',
    hatColor: 0x5a5148,
  },
  distiller: {
    skin: 0xe8b890,
    hair: 0x2a1f17,
    shirt: 0xf0ebe0,
    trousers: 0x3a3a3a,
    overlay: 0x6b4a2d,
  },
  cellarMaster: {
    skin: 0xf0c8a0,
    hair: 0xb0aaa0,
    shirt: 0xf0ebe0,
    trousers: 0x4a4a42,
    overlay: 0x7a6a4a,
  },
  guide: { skin: 0xd9a77e, hair: 0xa0522d, shirt: 0xf0ebe0, trousers: 0x2f3a2f, kilt: 0x2f4a6b },
} satisfies Record<string, Outfit>;
