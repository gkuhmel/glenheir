import {
  BOTTLING,
  CASKS,
  DEBUG,
  FINANCE,
  GIN,
  MARKET,
  PRODUCTION,
  STAFF,
  TIME,
  WAREHOUSE,
} from '../data/balance';
import type { RoomType } from '../data/content';
import { recordTransaction, roundMoney } from './journal';
import { addToLot, baseProfile, takeFromLot } from './profile';
import { createRng } from './rng';
import type { GameState, Terroir } from './state';
import { canSowAt, harvest, isRipe, seedCost, sow, type BarleyVariety } from './systems/fields';
import { exciseFor } from './systems/finance';
import { barleyPrice, newMakeValue, saleGross } from './systems/market';
import {
  demandKeyOf,
  prepareBottling,
  renownGain,
  whiskyUnitPrice,
  type WhiskyChannel,
} from './systems/bottling';
import type { BottlingMachine } from './systems/production';
import { cellarMaster } from './systems/staff';
import {
  ageAllCasks,
  ageYears,
  caskCapacityLpa,
  caskValue,
  extensionsOf,
  type Cask,
  type CaskType,
} from './systems/warehouse';
import { HOURS_PER_YEAR } from './time';
import {
  syncMachines,
  type Cut,
  type Machine,
  type Orders,
  type PeatLevel,
} from './systems/production';
import { buildCost, isPurchasable, restoreCost, slotCost } from './systems/building';
import { loanPayment, outstandingDebt, salaryOf } from './systems/finance';
import { newEmployee } from './systems/staff';
import type { SimEvent } from './tick';

/** Actions du joueur. L'interface n'écrit jamais directement dans l'état. */
export type Command =
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; loanId: number; amount?: number }
  | { type: 'restoreRoom'; roomId: number }
  | { type: 'buySlot'; col: number; level: number }
  | { type: 'buildRoom'; roomId: number; roomType: RoomType }
  | { type: 'restoreWarehouse'; warehouseId: number }
  | { type: 'chooseTerroir'; terroir: Terroir }
  | { type: 'sowField'; fieldId: number; variety: BarleyVariety }
  | { type: 'harvestField'; fieldId: number }
  | { type: 'buyBarley'; tonnes: number }
  | { type: 'sellNewMake'; lpa: number }
  | { type: 'setOrders'; roomId: number; orders: Orders }
  | { type: 'setPeat'; roomId: number; peat: PeatLevel }
  | { type: 'setLongFermentation'; roomId: number; long: boolean }
  | { type: 'setCut'; roomId: number; cut: Cut }
  | { type: 'restoreStills'; roomId: number }
  | { type: 'buyStills'; roomId: number }
  | { type: 'fillCask'; warehouseId: number; place: number; caskType: CaskType }
  | { type: 'extendWarehouse'; warehouseId: number }
  | { type: 'sellGin'; bottles: number }
  | { type: 'sellCask'; caskId: number }
  | { type: 'sellMalt'; tonnes: number }
  | { type: 'hire'; candidateId: number }
  | { type: 'bottle'; caskIds: number[] }
  | { type: 'sellWhisky'; bottlingId: number; channel: WhiskyChannel; bottles: number }
  | { type: 'debugAddRenown' }
  | { type: 'fire'; employeeId: number }
  | { type: 'train'; employeeId: number }
  | { type: 'giveBonus'; employeeId: number }
  | { type: 'debugAgeCasks'; years: number }
  | { type: 'debugAddCash' };

/** Raison d'un refus, traduite par l'interface (clé `error.<code>`). */
export type CommandError =
  | 'bankrupt'
  | 'loanAmountInvalid'
  | 'loanLimitReached'
  | 'loanNotFound'
  | 'notEnoughCash'
  | 'roomNotFound'
  | 'roomNotRuined'
  | 'slotNotPurchasable'
  | 'slotNotEmpty'
  | 'warehouseNotFound'
  | 'warehouseNotRuined'
  | 'terroirAlreadyChosen'
  | 'fieldNotFound'
  | 'fieldBusy'
  | 'notSowingSeason'
  | 'notRipe'
  | 'amountInvalid'
  | 'notEnoughStock'
  | 'machineNotFound'
  | 'stillsNotRuined'
  | 'stillsPresent'
  | 'roomRuined'
  | 'warehouseRuined'
  | 'placeTaken'
  | 'placeInvalid'
  | 'warehouseFull'
  | 'caskNotFound'
  | 'caskTooYoung'
  | 'brokerCapReached'
  | 'candidateNotFound'
  | 'employeeNotFound'
  | 'maxLevel'
  | 'inTraining'
  | 'noBottlingRoom'
  | 'inheritedCask'
  | 'bottlingBusy'
  | 'needCellarMaster'
  | 'bottlingNotFound'
  | 'renownTooLow';

export type CommandResult = { ok: true; events: SimEvent[] } | { ok: false; error: CommandError };

const fail = (error: CommandError): CommandResult => ({ ok: false, error });

/** Montant encore empruntable sous le plafond d'encours. */
export function loanCapacity(state: GameState): number {
  return Math.max(0, roundMoney(FINANCE.loan.maxOutstanding - outstandingDebt(state)));
}

function takeLoan(state: GameState, amount: number): CommandResult {
  if (!Number.isFinite(amount) || amount < FINANCE.loan.minAmount) return fail('loanAmountInvalid');
  if (amount > loanCapacity(state)) return fail('loanLimitReached');
  const id = state.nextId++;
  const principal = roundMoney(amount);
  state.finance.loans.push({
    id,
    principal,
    monthlyPayment: loanPayment(principal),
    monthsLeft: FINANCE.loan.termMonths,
  });
  recordTransaction(state, principal, 'loanProceeds');
  return {
    ok: true,
    events: [{ type: 'loanTaken', hour: state.time.hour, loanId: id, amount: principal }],
  };
}

/** Remboursement anticipé, sans pénalité ; la mensualité est recalculée sur la durée restante. */
function repayLoan(state: GameState, loanId: number, requested?: number): CommandResult {
  const loan = state.finance.loans.find((l) => l.id === loanId);
  if (!loan) return fail('loanNotFound');
  const amount = roundMoney(Math.min(requested ?? loan.principal, loan.principal));
  if (!Number.isFinite(amount) || amount <= 0) return fail('loanAmountInvalid');
  if (amount > state.finance.cash) return fail('notEnoughCash');
  recordTransaction(state, -amount, 'loanPrincipal');
  loan.principal = roundMoney(loan.principal - amount);
  if (loan.principal <= 0) {
    state.finance.loans = state.finance.loans.filter((l) => l.id !== loanId);
    return { ok: true, events: [{ type: 'loanRepaid', hour: state.time.hour, loanId }] };
  }
  loan.monthlyPayment = loanPayment(loan.principal, loan.monthsLeft);
  return { ok: true, events: [] };
}

/** Paie une dépense s'il y a assez de trésorerie. */
function invest(
  state: GameState,
  cost: number,
  category: 'investment' | 'materials' | 'salaries' = 'investment',
): boolean {
  if (cost > state.finance.cash) return false;
  if (cost > 0) recordTransaction(state, -cost, category);
  return true;
}

function restoreRoom(state: GameState, roomId: number): CommandResult {
  const room = state.building.rooms.find((r) => r.id === roomId);
  if (!room || !room.type) return fail('roomNotFound');
  if (!room.ruined) return fail('roomNotRuined');
  if (!invest(state, restoreCost(room.type))) return fail('notEnoughCash');
  room.ruined = false;
  return { ok: true, events: [{ type: 'roomRestored', hour: state.time.hour, roomId }] };
}

function buySlot(state: GameState, col: number, level: number): CommandResult {
  const { building } = state;
  if (!isPurchasable(building, { col, level })) return fail('slotNotPurchasable');
  if (!invest(state, slotCost(building))) return fail('notEnoughCash');
  const roomId = state.nextId++;
  building.rooms.push({ id: roomId, col, level, type: null, ruined: false });
  building.slotsPurchased += 1;
  return { ok: true, events: [{ type: 'slotPurchased', hour: state.time.hour, roomId }] };
}

function buildRoom(state: GameState, roomId: number, roomType: RoomType): CommandResult {
  const room = state.building.rooms.find((r) => r.id === roomId);
  if (!room) return fail('roomNotFound');
  if (room.type !== null) return fail('slotNotEmpty');
  if (!invest(state, buildCost(roomType))) return fail('notEnoughCash');
  room.type = roomType;
  syncMachines(state);
  return { ok: true, events: [{ type: 'roomBuilt', hour: state.time.hour, roomId, roomType }] };
}

function restoreWarehouse(state: GameState, warehouseId: number): CommandResult {
  const warehouse = state.warehouses.find((w) => w.id === warehouseId);
  if (!warehouse) return fail('warehouseNotFound');
  if (!warehouse.ruined) return fail('warehouseNotRuined');
  if (!invest(state, WAREHOUSE.restoreCost)) return fail('notEnoughCash');
  warehouse.ruined = false;
  return { ok: true, events: [{ type: 'warehouseRestored', hour: state.time.hour, warehouseId }] };
}

const ok = (state: GameState, events: SimEvent[] = []): CommandResult => ({ ok: true, events });

function sowField(state: GameState, fieldId: number, variety: BarleyVariety): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail('fieldNotFound');
  if (field.crop) return fail('fieldBusy');
  if (!canSowAt(state.time.hour)) return fail('notSowingSeason');
  if (!invest(state, seedCost(variety), 'materials')) return fail('notEnoughCash');
  sow(state, field, variety);
  return ok(state, [{ type: 'sown', hour: state.time.hour, fieldId }]);
}

function harvestField(state: GameState, fieldId: number): CommandResult {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return fail('fieldNotFound');
  if (!field.crop || !isRipe(field.crop, state.time.hour)) return fail('notRipe');
  // La météo de l'année est tirée avec le générateur de la partie.
  const rng = createRng(state.rngState);
  const tonnes = harvest(state, field, rng);
  state.rngState = rng.state;
  return ok(state, [{ type: 'harvested', hour: state.time.hour, fieldId, tonnes }]);
}

function buyBarley(state: GameState, tonnes: number): CommandResult {
  if (!Number.isFinite(tonnes) || tonnes <= 0) return fail('amountInvalid');
  const cost = roundMoney(tonnes * barleyPrice(state.time.hour));
  if (!invest(state, cost, 'materials')) return fail('notEnoughCash');
  // Orge du marché : profil de base, sans bonus de variété.
  addToLot(state.stocks.barley, tonnes, baseProfile());
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

function sellNewMake(state: GameState, lpa: number): CommandResult {
  if (!Number.isFinite(lpa) || lpa <= 0) return fail('amountInvalid');
  if (lpa > state.stocks.newMake.amount + 1e-6) return fail('notEnoughStock');
  const sold = takeFromLot(state.stocks.newMake, lpa);
  recordTransaction(state, newMakeValue(sold.amount), 'sales', {
    product: 'newMake',
    channel: 'bulk',
  });
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

function withMachine<K extends Machine['kind']>(
  state: GameState,
  roomId: number,
  kinds: readonly K[],
  apply: (machine: Extract<Machine, { kind: K }>) => CommandResult,
): CommandResult {
  const machine = state.machines.find((m) => m.roomId === roomId);
  if (!machine || !(kinds as readonly string[]).includes(machine.kind))
    return fail('machineNotFound');
  return apply(machine as Extract<Machine, { kind: K }>);
}

const changed = (state: GameState, roomId: number): CommandResult =>
  ok(state, [{ type: 'machineChanged', hour: state.time.hour, roomId }]);

function restoreStills(state: GameState, roomId: number): CommandResult {
  return withMachine(state, roomId, ['distillation'] as const, (machine) => {
    if (machine.stills !== 'ruined') return fail('stillsNotRuined');
    const room = state.building.rooms.find((r) => r.id === roomId);
    if (room?.ruined) return fail('roomRuined');
    if (!invest(state, PRODUCTION.distillation.restoreOldStillsCost)) return fail('notEnoughCash');
    machine.stills = 'small';
    return ok(state, [{ type: 'stillsReady', hour: state.time.hour, roomId }]);
  });
}

function buyStills(state: GameState, roomId: number): CommandResult {
  return withMachine(state, roomId, ['distillation'] as const, (machine) => {
    if (machine.stills !== 'none') return fail('stillsPresent');
    if (!invest(state, PRODUCTION.distillation.stills.small.cost)) return fail('notEnoughCash');
    machine.stills = 'small';
    return ok(state, [{ type: 'stillsReady', hour: state.time.hour, roomId }]);
  });
}

function fillCask(
  state: GameState,
  warehouseId: number,
  place: number,
  caskType: CaskType,
): CommandResult {
  const warehouse = state.warehouses.find((w) => w.id === warehouseId);
  if (!warehouse) return fail('warehouseNotFound');
  if (warehouse.ruined) return fail('warehouseRuined');
  if (!Number.isInteger(place) || place < 0 || place >= warehouse.places)
    return fail('placeInvalid');
  if (state.casks.some((c) => c.warehouseId === warehouseId && c.place === place))
    return fail('placeTaken');
  const capacity = caskCapacityLpa(caskType);
  // Un fût peut être rempli en partie, mais pas presque vide.
  if (state.stocks.newMake.amount < capacity * CASKS.minFillShare) return fail('notEnoughStock');
  if (!invest(state, CASKS.types[caskType].price, 'materials')) return fail('notEnoughCash');
  const spirit = takeFromLot(state.stocks.newMake, capacity);
  const rng = createRng(state.rngState);
  const hint = Math.round(rng.range(-CASKS.estimateSpread, CASKS.estimateSpread));
  state.rngState = rng.state;
  const id = state.nextId++;
  state.casks.push({
    id,
    warehouseId,
    place,
    type: caskType,
    fill: 1,
    filledHour: state.time.hour,
    maturedHours: 0,
    lpa: spirit.amount,
    initialLpa: spirit.amount,
    spirit: spirit.profile,
    hint,
  });
  return ok(state, [{ type: 'caskFilled', hour: state.time.hour, caskId: id }]);
}

function extendWarehouse(state: GameState, warehouseId: number): CommandResult {
  const warehouse = state.warehouses.find((w) => w.id === warehouseId);
  if (!warehouse) return fail('warehouseNotFound');
  if (warehouse.ruined) return fail('warehouseRuined');
  if (extensionsOf(warehouse) >= WAREHOUSE.maxExtensions) return fail('warehouseFull');
  if (!invest(state, WAREHOUSE.extensionCost)) return fail('notEnoughCash');
  warehouse.places += WAREHOUSE.extensionPlaces;
  return ok(state, [{ type: 'warehouseExtended', hour: state.time.hour, warehouseId }]);
}

/** Fût entier vendu au courtier : un par mois, whisky de 3 ans et plus, sans accise. */
function sellCask(state: GameState, caskId: number): CommandResult {
  const index = state.casks.findIndex((c) => c.id === caskId);
  const cask = state.casks[index];
  if (!cask) return fail('caskNotFound');
  if (ageYears(cask, state.time.hour) < MARKET.caskBroker.minYears) return fail('caskTooYoung');
  if (state.market.casksSoldThisMonth >= MARKET.caskBroker.casksPerMonth)
    return fail('brokerCapReached');
  recordTransaction(state, caskValue(cask, state.time.hour), 'sales', {
    product: 'cask',
    channel: 'bulk',
  });
  state.casks.splice(index, 1);
  state.market.casksSoldThisMonth += 1;
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

/** Embauche d'un candidat du mois : un mois de salaire à la signature. */
function hire(state: GameState, candidateId: number): CommandResult {
  const index = state.candidates.findIndex((c) => c.id === candidateId);
  const candidate = state.candidates[index];
  if (!candidate) return fail('candidateNotFound');
  const cost = salaryOf(candidate) * STAFF.hiring.salaryMonths;
  if (!invest(state, cost, 'salaries')) return fail('notEnoughCash');
  state.candidates.splice(index, 1);
  // Le candidat garde son identifiant : il devient l'employé.
  state.staff.push(newEmployee(candidate.id, candidate));
  return ok(state, [{ type: 'hired', hour: state.time.hour, employeeId: candidate.id }]);
}

/** Licenciement : un mois de salaire d'indemnité. */
function fire(state: GameState, employeeId: number): CommandResult {
  const index = state.staff.findIndex((e) => e.id === employeeId);
  const employee = state.staff[index];
  if (!employee) return fail('employeeNotFound');
  const cost = salaryOf(employee) * STAFF.hiring.severanceMonths;
  if (!invest(state, cost, 'salaries')) return fail('notEnoughCash');
  state.staff.splice(index, 1);
  return ok(state, [{ type: 'employeeLeft', hour: state.time.hour, employeeId }]);
}

/** Formation : deux mois de salaire, absent dix jours, un niveau de plus au retour. */
function train(state: GameState, employeeId: number): CommandResult {
  const employee = state.staff.find((e) => e.id === employeeId);
  if (!employee) return fail('employeeNotFound');
  if (employee.trainingUntil !== null) return fail('inTraining');
  if (employee.level >= STAFF.maxLevel) return fail('maxLevel');
  const cost = salaryOf(employee) * STAFF.training.salaryMonths;
  if (!invest(state, cost, 'salaries')) return fail('notEnoughCash');
  employee.trainingUntil = state.time.hour + STAFF.training.days * TIME.hoursPerDay;
  employee.roomId = null;
  employee.working = false;
  return ok(state);
}

/** Prime : un demi-mois de salaire pour remonter le moral. */
function giveBonus(state: GameState, employeeId: number): CommandResult {
  const employee = state.staff.find((e) => e.id === employeeId);
  if (!employee) return fail('employeeNotFound');
  const cost = roundMoney(salaryOf(employee) * STAFF.morale.bonusSalaryShare);
  if (!invest(state, cost, 'salaries')) return fail('notEnoughCash');
  employee.morale = Math.min(100, employee.morale + STAFF.morale.bonus);
  employee.despairHours = 0;
  return ok(state);
}

/** Malt vendu à la distillerie voisine, au prix fixe de la tonne. */
function sellMalt(state: GameState, tonnes: number): CommandResult {
  if (!Number.isFinite(tonnes) || tonnes <= 0) return fail('amountInvalid');
  if (tonnes > state.stocks.malt.amount + 1e-6) return fail('notEnoughStock');
  const sold = takeFromLot(state.stocks.malt, tonnes);
  recordTransaction(state, roundMoney(sold.amount * MARKET.maltPricePerTonne), 'sales', {
    product: 'malt',
    channel: 'bulk',
  });
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

/** Gin vendu aux cavistes britanniques : accise due, prix en baisse si on inonde le marché. */
function sellGin(state: GameState, bottles: number): CommandResult {
  if (!Number.isInteger(bottles) || bottles <= 0) return fail('amountInvalid');
  if (bottles > state.stocks.gin) return fail('notEnoughStock');
  const gross = saleGross(state.market.saturation, 'ginRetail', GIN.price, bottles);
  state.stocks.gin -= bottles;
  state.market.saturation.ginRetail += bottles;
  recordTransaction(state, gross, 'sales', { product: 'gin', channel: 'retail' });
  recordTransaction(state, -exciseFor('retail', bottles), 'excise', {
    product: 'gin',
    channel: 'retail',
  });
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

/**
 * Mise en bouteille d'un fût, ou d'un assemblage de fûts (maître de chai requis).
 * Les fûts quittent le chai ; la chaîne d'embouteillage les traite ensuite.
 */
function bottle(state: GameState, caskIds: readonly number[]): CommandResult {
  if (caskIds.length === 0 || new Set(caskIds).size !== caskIds.length)
    return fail('amountInvalid');
  const machine = state.machines.find(
    (m): m is BottlingMachine =>
      m.kind === 'bottling' && !state.building.rooms.find((r) => r.id === m.roomId)?.ruined,
  );
  if (!machine) return fail('noBottlingRoom');
  if (machine.run) return fail('bottlingBusy');
  const casks: Cask[] = [];
  for (const id of caskIds) {
    const cask = state.casks.find((c) => c.id === id);
    if (!cask) return fail('caskNotFound');
    if (ageYears(cask, state.time.hour) < BOTTLING.minAgeYears) return fail('caskTooYoung');
    // Le grand-oncle avait promis ses fûts au courtier : on ne peut que les lui vendre.
    if (cask.inherited) return fail('inheritedCask');
    casks.push(cask);
  }
  if (casks.length > 1 && !cellarMaster(state)) return fail('needCellarMaster');
  const prepared = prepareBottling(state, casks);
  if (prepared.bottled <= 0) return fail('notEnoughStock');
  if (!invest(state, prepared.bottled * BOTTLING.costPerBottle, 'materials'))
    return fail('notEnoughCash');
  const rng = createRng(state.rngState);
  const noteSeed = rng.int(1, 1_000_000);
  state.rngState = rng.state;
  state.casks = state.casks.filter((c) => !caskIds.includes(c.id));
  machine.run = { ...prepared, id: state.nextId++, bottledHour: state.time.hour, noteSeed };
  machine.batch = {
    amount: prepared.bottled,
    profile: prepared.profile,
    elapsed: 0,
    duration: Math.ceil((prepared.bottled / BOTTLING.bottlesPerDay) * TIME.hoursPerDay),
  };
  return ok(state, [
    {
      type: 'bottlingStarted',
      hour: state.time.hour,
      roomId: machine.roomId,
      bottles: prepared.bottled,
    },
  ]);
}

/**
 * Whisky vendu aux cavistes (accise due) ou à l'export (70 % du prix, sans accise,
 * renommée 30 requise). Le prix baisse à mesure qu'on sature le canal ; un bon
 * whisky fait monter la renommée.
 */
function sellWhisky(
  state: GameState,
  bottlingId: number,
  channel: WhiskyChannel,
  bottles: number,
): CommandResult {
  if (!Number.isInteger(bottles) || bottles <= 0) return fail('amountInvalid');
  const bottling = state.bottlings.find((b) => b.id === bottlingId);
  if (!bottling) return fail('bottlingNotFound');
  if (bottles > bottling.stock) return fail('notEnoughStock');
  if (channel === 'export' && state.renown < MARKET.export.minRenown) return fail('renownTooLow');
  const key = demandKeyOf(channel);
  const gross = saleGross(
    state.market.saturation,
    key,
    whiskyUnitPrice(state, bottling, channel),
    bottles,
  );
  bottling.stock -= bottles;
  state.market.saturation[key] += bottles;
  recordTransaction(state, gross, 'sales', { product: 'whisky', channel });
  const excise = exciseFor(channel, bottles);
  if (excise > 0) recordTransaction(state, -excise, 'excise', { product: 'whisky', channel });
  state.renown = Math.min(
    BOTTLING.renown.max,
    state.renown + renownGain(bottling.profile.quality, bottles, channel),
  );
  if (bottling.stock === 0) state.bottlings = state.bottlings.filter((b) => b.id !== bottlingId);
  return ok(state, [{ type: 'traded', hour: state.time.hour }]);
}

/** Valide puis applique une commande du joueur. */
export function executeCommand(state: GameState, command: Command): CommandResult {
  if (state.finance.bankrupt) return fail('bankrupt');
  switch (command.type) {
    case 'takeLoan':
      return takeLoan(state, command.amount);
    case 'repayLoan':
      return repayLoan(state, command.loanId, command.amount);
    case 'restoreRoom':
      return restoreRoom(state, command.roomId);
    case 'buySlot':
      return buySlot(state, command.col, command.level);
    case 'buildRoom':
      return buildRoom(state, command.roomId, command.roomType);
    case 'restoreWarehouse':
      return restoreWarehouse(state, command.warehouseId);
    case 'chooseTerroir':
      if (state.terroirChosen) return fail('terroirAlreadyChosen');
      state.terroir = command.terroir;
      state.terroirChosen = true;
      return ok(state, [{ type: 'terroirChosen', hour: state.time.hour }]);
    case 'sowField':
      return sowField(state, command.fieldId, command.variety);
    case 'harvestField':
      return harvestField(state, command.fieldId);
    case 'buyBarley':
      return buyBarley(state, command.tonnes);
    case 'sellNewMake':
      return sellNewMake(state, command.lpa);
    case 'setOrders': {
      const orders = command.orders;
      if (orders !== 'continuous' && (!Number.isInteger(orders) || orders < 0))
        return fail('amountInvalid');
      return withMachine(
        state,
        command.roomId,
        ['malting', 'mashing', 'distillation', 'gin'] as const,
        (m) => {
          m.orders = orders;
          return changed(state, command.roomId);
        },
      );
    }
    case 'setPeat':
      return withMachine(state, command.roomId, ['malting'] as const, (m) => {
        m.peat = command.peat;
        return changed(state, command.roomId);
      });
    case 'setLongFermentation':
      return withMachine(state, command.roomId, ['fermentation'] as const, (m) => {
        m.long = command.long;
        return changed(state, command.roomId);
      });
    case 'setCut':
      return withMachine(state, command.roomId, ['distillation'] as const, (m) => {
        m.cut = command.cut;
        return changed(state, command.roomId);
      });
    case 'restoreStills':
      return restoreStills(state, command.roomId);
    case 'buyStills':
      return buyStills(state, command.roomId);
    case 'fillCask':
      return fillCask(state, command.warehouseId, command.place, command.caskType);
    case 'extendWarehouse':
      return extendWarehouse(state, command.warehouseId);
    case 'sellGin':
      return sellGin(state, command.bottles);
    case 'sellCask':
      return sellCask(state, command.caskId);
    case 'sellMalt':
      return sellMalt(state, command.tonnes);
    case 'hire':
      return hire(state, command.candidateId);
    case 'bottle':
      return bottle(state, command.caskIds);
    case 'sellWhisky':
      return sellWhisky(state, command.bottlingId, command.channel, command.bottles);
    case 'debugAddRenown':
      state.renown = Math.min(BOTTLING.renown.max, state.renown + DEBUG.renownGift);
      return ok(state);
    case 'fire':
      return fire(state, command.employeeId);
    case 'train':
      return train(state, command.employeeId);
    case 'giveBonus':
      return giveBonus(state, command.employeeId);
    case 'debugAgeCasks':
      ageAllCasks(state, Math.round(command.years * HOURS_PER_YEAR));
      return ok(state);
    case 'debugAddCash':
      recordTransaction(state, DEBUG.cashGift, 'debug');
      return { ok: true, events: [] };
  }
}
