import { describe, expect, it } from 'vitest';
import { CASKS, GIN, MARKET, WAREHOUSE } from '../../data/balance';
import { executeCommand } from '../commands';
import { baseProfile } from '../profile';
import { createInitialState, type GameState } from '../state';
import { runTicks } from '../tick';
import { HOURS_PER_YEAR } from '../time';
import { caskCapacityLpa, caskProfile, caskValue, qualityEstimate, type Cask } from './warehouse';

/** Chai restauré et vidé des fûts hérités, du new make en réserve. */
function cellar(newMake = 2_000): GameState {
  const state = createInitialState(5);
  state.casks = [];
  state.finance.cash = 1_000_000;
  executeCommand(state, { type: 'chooseTerroir', terroir: 'speyside' });
  executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
  state.stocks.newMake.amount = newMake;
  state.stocks.newMake.profile = { ...baseProfile(), quality: 45 };
  return state;
}

const fill = (state: GameState, place: number, caskType: Cask['type'] = 'exBourbon') =>
  executeCommand(state, {
    type: 'fillCask',
    warehouseId: state.warehouses[0]!.id,
    place,
    caskType,
  });

describe('mise en fût', () => {
  it('remplit un fût de 200 L à 63,5 % et paie le fût', () => {
    const state = cellar();
    expect(fill(state, 0).ok).toBe(true);
    const cask = state.casks[0]!;
    expect(cask.lpa).toBe(caskCapacityLpa('exBourbon'));
    expect(cask.lpa).toBe(127);
    expect(state.stocks.newMake.amount).toBe(2_000 - 127);
    expect(state.finance.cash).toBe(1_000_000 - 6_000 - CASKS.types.exBourbon.price);
  });

  it('accepte un fût partiel, mais pas presque vide', () => {
    const state = cellar(60);
    expect(fill(state, 0).ok).toBe(true);
    expect(state.casks[0]!.lpa).toBe(60);
    state.stocks.newMake.amount = 10;
    expect(fill(state, 1)).toEqual({ ok: false, error: 'notEnoughStock' });
  });

  it('refuse une place occupée, hors du chai ou un chai en ruine', () => {
    const state = cellar();
    fill(state, 0);
    expect(fill(state, 0)).toEqual({ ok: false, error: 'placeTaken' });
    expect(fill(state, 40)).toEqual({ ok: false, error: 'placeInvalid' });
    const ruined = createInitialState(1);
    ruined.stocks.newMake.amount = 500;
    expect(
      executeCommand(ruined, {
        type: 'fillCask',
        warehouseId: ruined.warehouses[0]!.id,
        place: 0,
        caskType: 'sherry',
      }),
    ).toEqual({ ok: false, error: 'warehouseRuined' });
  });
});

describe('vieillissement', () => {
  it('donne un whisky cohérent après 3 ans en ex-bourbon', () => {
    const state = cellar();
    fill(state, 1); // hauteur moyenne
    const events = runTicks(state, 3 * HOURS_PER_YEAR);
    const cask = state.casks[0]!;
    const profile = caskProfile(cask);
    // Le bois a apporté du doux, du fruité et du boisé ; la qualité a monté sans plafonner.
    expect(profile.sweet).toBeGreaterThan(25);
    expect(profile.woody).toBeGreaterThan(3);
    expect(profile.quality).toBeGreaterThan(50);
    expect(profile.quality).toBeLessThan(70);
    // Part des anges : 2 % par an.
    expect(cask.lpa).toBeCloseTo(127 * 0.98 ** 3, 1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'caskMatured', caskId: cask.id, years: 3 }),
    );
  });

  it('vieillit plus vite en haut, mieux en bas', () => {
    const state = cellar();
    fill(state, 0); // en bas
    fill(state, 2); // en haut
    runTicks(state, 2 * HOURS_PER_YEAR);
    const [bottom, top] = state.casks;
    expect(top!.maturedHours).toBeGreaterThan(bottom!.maturedHours);
    const quality = (c: Cask) => caskProfile(c).quality;
    expect(Math.abs(quality(bottom!) - quality(top!))).toBeLessThan(10);
  });

  it('marque plus vite en chêne neuf, puis se dégrade passé 8 ans', () => {
    const state = cellar();
    fill(state, 1, 'newOak');
    fill(state, 4, 'exBourbon');
    executeCommand(state, { type: 'debugAgeCasks', years: 2 });
    const [oak, bourbon] = state.casks;
    expect(caskProfile(oak!).woody).toBeGreaterThan(caskProfile(bourbon!).woody);
    const peak = caskProfile(oak!).quality;
    executeCommand(state, { type: 'debugAgeCasks', years: 10 });
    expect(caskProfile(oak!).quality).toBeLessThan(peak);
  });

  it('réduit de moitié l’effet d’un fût de réemploi', () => {
    const state = cellar();
    fill(state, 1);
    fill(state, 4);
    state.casks[1]!.fill = 2;
    executeCommand(state, { type: 'debugAgeCasks', years: 5 });
    const [first, refill] = state.casks;
    const gain = (c: Cask) => caskProfile(c).sweet - c.spirit.sweet;
    expect(gain(refill!)).toBeCloseTo(gain(first!) / 2, 1);
  });

  it('perd moins à Islay (part des anges de 1,5 %)', () => {
    const state = createInitialState(5);
    state.casks = [];
    state.finance.cash = 100_000;
    executeCommand(state, { type: 'chooseTerroir', terroir: 'islay' });
    executeCommand(state, { type: 'restoreWarehouse', warehouseId: state.warehouses[0]!.id });
    state.stocks.newMake.amount = 500;
    fill(state, 0);
    runTicks(state, HOURS_PER_YEAR);
    expect(state.casks[0]!.lpa).toBeCloseTo(127 * 0.985, 1);
  });

  it('estime la qualité à ±15 près sans maître de chai', () => {
    const state = cellar();
    fill(state, 1);
    executeCommand(state, { type: 'debugAgeCasks', years: 3 });
    const cask = state.casks[0]!;
    const { low, high } = qualityEstimate(cask);
    const real = caskProfile(cask).quality;
    expect(high - low).toBeLessThanOrEqual(2 * CASKS.estimateSpread);
    expect(real).toBeGreaterThanOrEqual(low);
    expect(real).toBeLessThanOrEqual(high);
  });
});

describe('chai', () => {
  it('s’agrandit de 20 places, 4 fois au plus', () => {
    const state = cellar();
    const id = state.warehouses[0]!.id;
    for (let i = 0; i < WAREHOUSE.maxExtensions; i++) {
      expect(executeCommand(state, { type: 'extendWarehouse', warehouseId: id }).ok).toBe(true);
    }
    expect(state.warehouses[0]!.places).toBe(120);
    expect(executeCommand(state, { type: 'extendWarehouse', warehouseId: id })).toEqual({
      ok: false,
      error: 'warehouseFull',
    });
  });
});

describe('gin', () => {
  function workshop(): GameState {
    const state = cellar();
    executeCommand(state, { type: 'buySlot', col: 6, level: 0 });
    const slot = state.building.rooms.find((r) => r.col === 6)!;
    executeCommand(state, { type: 'buildRoom', roomId: slot.id, roomType: 'ginWorkshop' });
    return state;
  }

  it('produit 200 bouteilles par jour à partir du new make et des botaniques', () => {
    const state = workshop();
    const gin = state.machines.find((m) => m.kind === 'gin')!;
    executeCommand(state, { type: 'setOrders', roomId: gin.roomId, orders: 2 });
    const cash = state.finance.cash;
    runTicks(state, 48);
    expect(state.stocks.gin).toBe(400);
    expect(state.stocks.newMake.amount).toBeCloseTo(2_000 - 2 * 200 * GIN.lpaPerBottle);
    expect(cash - state.finance.cash).toBe(2 * 200 * GIN.botanicalsPerBottle);
  });

  it('se vend aux cavistes avec l’accise ; inonder le marché fait baisser le prix', () => {
    const state = workshop();
    state.stocks.gin = 1_000;
    const cash = state.finance.cash;
    expect(executeCommand(state, { type: 'sellGin', bottles: 1 }).ok).toBe(true);
    // Première bouteille au prix plein, moins l'accise.
    expect(state.finance.cash - cash).toBeCloseTo(GIN.price - 9, 2);
    executeCommand(state, { type: 'sellGin', bottles: 599 });
    const before = state.finance.cash;
    executeCommand(state, { type: 'sellGin', bottles: 1 });
    // Jauge pleine : −50 %.
    expect(state.finance.cash - before).toBeCloseTo(GIN.price * 0.5 - 9, 2);
    // La demande se reconstitue avec le temps.
    runTicks(state, 30 * 24);
    expect(state.market.saturation.ginRetail).toBeLessThan(600 * 0.97 ** 29);
    expect(MARKET.demand.capacity.ginRetail).toBe(600);
  });
});

describe('fûts hérités du grand-oncle', () => {
  const total = (state: GameState) =>
    state.casks.reduce((sum, c) => sum + caskValue(c, state.time.hour), 0);

  it('attendent dans un coin du chai en ruine, pour environ £30 000 chez le courtier', () => {
    const state = createInitialState(5);
    expect(state.casks).toHaveLength(5);
    expect(state.casks.every((c) => c.inherited && c.warehouseId === state.warehouses[0]!.id)).toBe(
      true,
    );
    expect(total(state)).toBeGreaterThan(28_000);
    expect(total(state)).toBeLessThan(35_000);
  });

  it('fuient sous le toit percé, et prennent de la valeur une fois le chai restauré', () => {
    const ruined = createInitialState(5);
    const before = total(ruined);
    const sherry = ruined.casks.find((c) => c.type === 'sherry')!;
    const lpa = sherry.lpa;
    runTicks(ruined, HOURS_PER_YEAR);
    expect(sherry.lpa).toBeCloseTo(lpa * (1 - WAREHOUSE.ruinedAngelsShare), 1);
    // En ruine, l'âge compense à peine la fuite.
    expect(total(ruined) / before).toBeLessThan(1.01);

    const restored = createInitialState(5);
    restored.finance.cash = 100_000;
    executeCommand(restored, {
      type: 'restoreWarehouse',
      warehouseId: restored.warehouses[0]!.id,
    });
    const start = total(restored);
    runTicks(restored, HOURS_PER_YEAR);
    // Restauré : +9 % d'âge, −2 % de part des anges.
    expect(total(restored) / start).toBeCloseTo(1.09 * 0.98, 2);
  });
});

describe('courtier en fûts', () => {
  it('achète un fût par mois, sans accise, au prix de son âge', () => {
    const state = createInitialState(5);
    const [first, second] = state.casks;
    const cash = state.finance.cash;
    const value = caskValue(first!, state.time.hour);
    expect(executeCommand(state, { type: 'sellCask', caskId: first!.id }).ok).toBe(true);
    expect(state.finance.cash).toBeCloseTo(cash + value, 2);
    expect(state.casks).toHaveLength(4);
    expect(executeCommand(state, { type: 'sellCask', caskId: second!.id })).toEqual({
      ok: false,
      error: 'brokerCapReached',
    });
    // Le mois suivant, il revient.
    runTicks(state, 24 * 30);
    expect(executeCommand(state, { type: 'sellCask', caskId: second!.id }).ok).toBe(true);
  });

  it('ne prend pas un fût de moins de 3 ans', () => {
    const state = cellar();
    fill(state, 0);
    const caskId = state.casks[0]!.id;
    expect(executeCommand(state, { type: 'sellCask', caskId })).toEqual({
      ok: false,
      error: 'caskTooYoung',
    });
    executeCommand(state, { type: 'debugAgeCasks', years: 3 });
    expect(executeCommand(state, { type: 'sellCask', caskId }).ok).toBe(true);
  });

  it('paie le LPA £27 à 8 ans, +9 % par an, et 20 % de plus pour le sherry', () => {
    const state = createInitialState(5);
    const bourbon = state.casks.find((c) => c.type === 'exBourbon')!;
    expect(caskValue(bourbon, state.time.hour)).toBeCloseTo(
      bourbon.lpa * MARKET.caskBroker.pricePerLpaAt8Years,
      0,
    );
    const sherry = state.casks.find((c) => c.type === 'sherry')!;
    expect(caskValue(sherry, state.time.hour)).toBeCloseTo(sherry.lpa * 27 * 1.09 ** 10 * 1.2, 0);
  });
});
