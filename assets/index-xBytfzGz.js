var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const Mat = {
  Space: 0,
  // hard vacuum, infinite gas sink
  Hull: 1,
  // outer armor plating
  Wall: 2,
  // interior partition
  Floor: 3,
  // walkable deck, holds atmosphere
  DoorClosed: 4,
  DoorOpen: 5,
  Machine: 6,
  // occupied by a machine block (see machine overlay for type)
  Rubble: 7,
  // destroyed structure; gas passes, slight fuel content
  Growth: 8,
  // alien organic resin: walkable, breathable, and fire-insulating
  Lattice: 9,
  // weaver void-coral: sealed branching tunnels through vacuum
  Tree: 10,
  // botanic hardwood: blocks movement and sight, very hard to kill
  Vine: 11
  // creeping tendril: walkable undergrowth reaching for the trees
};
const Machine = {
  None: 0,
  Reactor: 1,
  FuelTank: 2,
  CoolantTank: 3,
  O2Gen: 4,
  Munitions: 5,
  Light: 6,
  // wall fixture
  Vent: 7
  // floor fixture, atmosphere outlet of the O2 network
};
const Pipe = {
  Wire: 1,
  Fuel: 2,
  Coolant: 4,
  O2: 8
};
const Liquid = {
  None: 0,
  Fuel: 1,
  Coolant: 2,
  Ichor: 3,
  // what xenos are full of
  Blood: 4
  // what everyone else is full of
};
function gasPassable(m) {
  return m === Mat.Floor || m === Mat.DoorOpen || m === Mat.Rubble || m === Mat.Space || m === Mat.Growth;
}
const W = 128;
const H = 72;
const N = W * H;
class World {
  constructor() {
    __publicField(this, "mat", new Uint8Array(N).fill(Mat.Space));
    __publicField(this, "machine", new Uint8Array(N));
    __publicField(this, "pipe", new Uint8Array(N));
    __publicField(this, "pipeBroken", new Uint8Array(N));
    __publicField(this, "liqType", new Uint8Array(N));
    __publicField(this, "liqAmt", new Float32Array(N));
    __publicField(this, "air", new Float32Array(N));
    __publicField(this, "airNext", new Float32Array(N));
    __publicField(this, "smoke", new Float32Array(N));
    __publicField(this, "smokeNext", new Float32Array(N));
    __publicField(this, "temp", new Float32Array(N).fill(-100));
    __publicField(this, "tempNext", new Float32Array(N));
    __publicField(this, "burn", new Float32Array(N));
    __publicField(this, "solidFuel", new Float32Array(N));
    // burnable matter in the cell besides pooled liquid
    __publicField(this, "roomId", new Int16Array(N).fill(-1));
    __publicField(this, "starfield", new Float32Array(N));
    // precomputed star brightness for space cells
    __publicField(this, "stain", new Float32Array(N));
    // dried blood; the deck remembers every kill
    __publicField(this, "ecto", new Float32Array(N));
    // where a haunt unraveled — spectral residue, the ashen trigger
    __publicField(this, "rooms", []);
    __publicField(this, "reactorCells", []);
    __publicField(this, "ventCells", []);
    __publicField(this, "activeVents", /* @__PURE__ */ new Set());
    __publicField(this, "leaks", []);
    // floor cells hugging each machine block, precomputed at gen
    __publicField(this, "periReactor", []);
    __publicField(this, "periCoolTank", []);
    __publicField(this, "periO2Gen", []);
    __publicField(this, "periFuelTank", []);
    __publicField(this, "munitionsCells", []);
    __publicField(this, "fuelTankCells", []);
    __publicField(this, "cookedOff", /* @__PURE__ */ new Set());
    // machine cells that already detonated
    __publicField(this, "ents", []);
    __publicField(this, "pendingPods", []);
    __publicField(this, "nextPodTick", 5e3);
    // earliest tick an unprompted boarding pod may arrive
    __publicField(this, "nextRecruitTick", 0);
    // scav recruitment is a trickle, not a doubling
    __publicField(this, "brainId", 0);
    // identity of the current official reactor brain (0 = none yet)
    __publicField(this, "nextBrainId", 2);
    // identity mint — colonies and crownings draw from one well
    __publicField(this, "pendingCataclysms", []);
    // chained plant detonations
    __publicField(this, "botanyOff", false);
    // test isolation: silence the green tide
    __publicField(this, "arrivalsOff", false);
    // test isolation: no unbidden castaway crews
    __publicField(this, "news", []);
    // the ship's bulletin wire, newest last
    __publicField(this, "nextSquadId", 1);
    // breacher squads mint identity per pod
    __publicField(this, "nextLineage", 1);
    // hive dynasties mint identity per founding mother
    __publicField(this, "growthCells", 0);
    // resin coverage census (refreshed periodically) — a storyteller signal
    __publicField(this, "builtCells", 0);
    // non-space census: how much ship still exists — a storyteller signal
    __publicField(this, "darkFloorFrac", 0);
    // fraction of deck the lights don't reach — fabrication pressure
    __publicField(this, "lightLevel", new Float32Array(W * H));
    // per-cell illumination from powered fixtures
    __publicField(this, "fireGlow", new Float32Array(W * H));
    // per-tick firelight — flickering, alive
    __publicField(this, "bridgeGlow", new Float32Array(W * H));
    // lightbridge pulse — slow, steady, violet
    __publicField(this, "condGlow", new Float32Array(W * H));
    // conductors carry their own white lamp, radius 2
    __publicField(this, "darkGlow", new Float32Array(W * H));
    // ghast/ashen radiance: the dark that pushes back
    __publicField(this, "wirePowered", new Uint8Array(W * H));
    // snapshot of the live power flood
    __publicField(this, "reactorOwner", new Uint16Array(W * H));
    // brain that raised each reactor cell — no plant is unclaimed
    __publicField(this, "brainHearts", /* @__PURE__ */ new Map());
    // per-brain: one standing heart cell (rebuilt per pulse)
    __publicField(this, "hullCells", []);
    __publicField(this, "lastAlienTick", 0);
    // when the ship last had a living alien
    __publicField(this, "buildPlans", []);
    // concurrent blueprints, team = owning brain
    // cells stampHeart grafted into the blueprint for the CURRENT heart
    // (livability kit, plumbing runs) with their prior values — the next
    // succession reverts them first, or the dream becomes a palimpsest of
    // dead hearts' tanks and the crew builds machine graveyards
    __publicField(this, "blueprintGrafts", []);
    // the original reactor brain's memory of what this ship IS — the crew
    // repairs toward this after fires and battles. Dies with the cataclysm.
    __publicField(this, "blueprint", null);
    __publicField(this, "aggression", 0.25);
    // the brain's temperament: fraction of fabrication that is militors
    __publicField(this, "servitorDebt", 0);
    // dead units owed replacements, two for one
    __publicField(this, "calmTicks", 0);
    // how long the chaos meter has been asleep
    __publicField(this, "lastPour", 0);
    // last tick a blueprint cell was actually built
    __publicField(this, "crewDeaths", []);
    // where the machines died; militors answer
    __publicField(this, "shots", []);
    __publicField(this, "bursts", []);
    // darkburst wavefront cells, amp = radius falloff
    __publicField(this, "rites", []);
    // blood spiraling inward: a drowned birth in progress
    __publicField(this, "lampDim", /* @__PURE__ */ new Map());
    // per-lamp snuff progress 0..1 — haunts drink, lamps recover
    __publicField(this, "fuelReserve", 6e3);
    __publicField(this, "coolantReserve", 3e3);
    __publicField(this, "coolantTankCells", 0);
    // standing condenser cells — the coolant INCOME side
    __publicField(this, "o2Reserve", 2e4);
    __publicField(this, "reactorAlive", true);
    __publicField(this, "coolingActive", true);
    __publicField(this, "melted", false);
    // authoritative meltdown clock: climbs while cooling is severed (~50s to
    // meltdown at 60fps), decays when cooling is restored. The temperature
    // field renders and spreads it, but does not decide it.
    __publicField(this, "coreHeat", 0);
    __publicField(this, "explosions", []);
    __publicField(this, "networksDirty", true);
    // per-tick stats for the chaos meter
    __publicField(this, "ventedThisTick", 0);
    __publicField(this, "burningCells", 0);
    __publicField(this, "leakingCells", 0);
    __publicField(this, "destruction", 0);
    // decaying accumulator of recently destroyed cells
    __publicField(this, "seed", 0);
    __publicField(this, "tick", 0);
  }
  idx(x, y) {
    return y * W + x;
  }
  inBounds(x, y) {
    return x >= 0 && x < W && y >= 0 && y < H;
  }
  pushNews(msg) {
    const last = this.news[this.news.length - 1];
    if (last && last.msg === msg && this.tick - last.t < 600) return;
    this.news.push({ t: this.tick, msg });
    if (this.news.length > 30) this.news.shift();
  }
  breakPipe(i) {
    if (this.pipe[i] !== 0 && !this.pipeBroken[i]) {
      this.pipeBroken[i] = 1;
      this.leaks.push(i);
      this.networksDirty = true;
    }
  }
}
const TUNE = {
  // -- hive
  roamerCap: 300,
  // perf guard only; hunger and marines are the real cap
  hungerBold: 3e3,
  // ticks unfed → commit to attacks, drift shipward
  hungerStarve: 6e3,
  // ticks unfed → wasting away
  royalChance: 0.24,
  // per-lay odds of a royal egg (darkness only)
  grazeTopUp: 1200,
  // resin grazing: survival, pinned at famished
  // -- marines
  podTrigger: 8,
  // infestation signature that summons a pod
  podCapMax: 40,
  // most marines command will field
  squadSize: 6,
  // a pod IS a squad: never less
  squadSizeMajor: 8,
  // blooms ≥20 signature get the big pod
  // -- machine faction
  militorDemote: 1800,
  // ticks of peace before a militor stands down
  militorPinned: 1200,
  // ticks without moving → stand down and dig
  servitorBored: 60,
  // staff-to-work ceiling
  debtHeadroom: 4,
  // death-debt may exceed crew target by this
  restoreCrewCap: 10,
  // hands on the restore plan
  draftCrewCap: 4,
  // hands on a drafted annex
  // -- scavs
  recruitInterval: 600,
  // one new hand per stretch — a boom, not a doubling
  cargoFull: 6,
  // -- storyteller
  chaosNotch: 240,
  // 30% of the bar: the storyteller's target
  calmFuse: 1200,
  // base ticks below the notch before an act
  lightRadius: 8
  // fixture cast distance
};
const EntKind = {
  Brood: 0,
  Egg: 1,
  Roamer: 2,
  Breacher: 3,
  Scav: 4,
  Servitor: 5,
  Weaver: 6,
  Militor: 7,
  Mound: 8,
  Shrub: 9,
  Reaver: 10,
  Haunt: 11,
  Ghast: 12,
  Ashen: 13
};
const FACTION = [0, 0, 0, 1, 2, 3, 4, 3, 5, 5, 3, 6, 6, 6];
const GONE = -424242;
const BRAIN_NAMES = [
  "VULCAN",
  "TALOS",
  "ORACLE",
  "MOTHER",
  "ATHENA",
  "CHARON",
  "LUMEN",
  "ARGUS",
  "PYRRHA",
  "HALCYON",
  "DAEDAL",
  "MERIDIAN"
];
function brainName(id) {
  if (id === void 0 || id <= 0) return "no one";
  return `${BRAIN_NAMES[(id - 1) % BRAIN_NAMES.length]}-${id}`;
}
const Stance = { Ignore: 0, Foe: 1, Prey: 2, Fear: 3 };
const I = Stance.Ignore, F = Stance.Foe, P = Stance.Prey, R = Stance.Fear;
const STANCE = [
  // toward:  xeno marine scav ship vine flora dead
  /* xeno  */
  [I, P, P, P, I, I, R],
  // the living fear the dead
  /* marine*/
  [F, I, F, I, I, I, F],
  // the dead draw fire
  /* scav  */
  [R, R, I, I, I, R, R],
  /* ship  */
  [F, I, I, I, I, I, F],
  /* vine  */
  [I, I, I, I, I, I, I],
  /* flora */
  [I, I, I, I, I, I, I],
  // mound rage is territorial, not doctrinal
  /* dead  */
  [F, F, F, F, I, I, I]
  // the drowned hate ALL the living
];
function stance(viewer, other) {
  let s = STANCE[FACTION[viewer.kind]][FACTION[other.kind]];
  if (viewer.kind === EntKind.Servitor && s === Stance.Foe) s = Stance.Fear;
  if (FACTION[viewer.kind] === 3 && other.kind === EntKind.Scav) s = (other.cargo ?? 0) > 0 && viewer.kind === EntKind.Militor ? Stance.Foe : Stance.Ignore;
  if (viewer.kind === EntKind.Scav && FACTION[other.kind] === 3)
    s = other.kind === EntKind.Militor || other.kind === EntKind.Reaver ? Stance.Fear : Stance.Ignore;
  return s;
}
const isXeno = (o) => FACTION[o.kind] === 0;
const isThief = (o) => o.kind === EntKind.Scav && (o.cargo ?? 0) > 0;
const isMarineTarget = (o) => {
  const f = FACTION[o.kind];
  return STANCE[1][f] === Stance.Foe;
};
const isWarmBody = (o) => STANCE[0][FACTION[o.kind]] === Stance.Prey;
const SCAV_PROBE = { kind: EntKind.Scav };
const isDrowned = (o) => FACTION[o.kind] === 6;
const isScary = (o) => {
  const s = stance(SCAV_PROBE, o);
  return s === Stance.Fear || s === Stance.Foe;
};
const Mode = { Idle: 0, Job: 1, Plan: 2, Survey: 3, Home: 4 };
const CADENCE = [24, 30, 5, 9, 8, 8, 14, 8, 26, 44, 4, 10, 9, 4];
const claimCell = /* @__PURE__ */ new Map();
function rebuildClaims(w) {
  claimCell.clear();
  w.brainHearts.clear();
  for (let i = 0; i < N; i++) {
    if (w.mat[i] !== Mat.Machine || w.machine[i] !== Machine.Reactor) continue;
    const own = w.reactorCells.includes(i) ? w.brainId : w.reactorOwner[i];
    if (own > 0 && !w.brainHearts.has(own)) w.brainHearts.set(own, i);
  }
  for (const o of w.ents) {
    if (o.hp <= 0 || o.tx === void 0 || o.tx < 0) continue;
    if (o.kind !== EntKind.Servitor && o.kind !== EntKind.Militor && o.kind !== EntKind.Scav && o.kind !== EntKind.Breacher) continue;
    claimCell.set(o.ty * W + o.tx, o);
  }
}
function claim(i, e) {
  claimCell.set(i, e);
}
function claimedBy(i, asker) {
  const holder = claimCell.get(i);
  if (!holder || holder === asker) return null;
  if (FACTION[holder.kind] !== FACTION[asker.kind]) return null;
  const askTeam = asker.brain ?? asker.team;
  const holdTeam = holder.brain ?? holder.team;
  if (askTeam !== void 0 && holdTeam !== void 0 && askTeam !== holdTeam) return null;
  return holder;
}
function swearCrew(w) {
  for (const o of w.ents) {
    if ((o.kind === EntKind.Servitor || o.kind === EntKind.Militor) && o.hp > 0) {
      o.brain = w.brainId;
    }
  }
  for (const plan of w.buildPlans) plan.team = w.brainId;
}
function rivalReachable(w, plan) {
  const st = plan.steps.find(
    (s2) => s2.mc === Machine.Reactor && !stepDone(w, s2) && !w.reactorCells.includes(s2.i)
  );
  if (!st) return true;
  const from = w.periReactor.find((c) => entPass(w.mat[c]));
  if (from === void 0) return false;
  return findPath(w, from, st.i) !== null;
}
function attemptSuccession(w) {
  const live = w.reactorCells.filter(
    (c) => w.mat[c] === Mat.Machine && w.machine[c] === Machine.Reactor
  );
  if (w.reactorAlive && live.length >= 3) return;
  const seen = /* @__PURE__ */ new Set();
  const candidates = [];
  for (let i = W; i < N - W; i++) {
    if (seen.has(i)) continue;
    if (w.mat[i] !== Mat.Machine || w.machine[i] !== Machine.Reactor) continue;
    const cluster = [i];
    seen.add(i);
    for (let k = 0; k < cluster.length; k++) {
      const c = cluster[k];
      for (const j of [c - 1, c + 1, c - W, c + W]) {
        if (j >= 0 && j < N && !seen.has(j) && w.mat[j] === Mat.Machine && w.machine[j] === Machine.Reactor) {
          seen.add(j);
          cluster.push(j);
        }
      }
    }
    let underConstruction = false;
    for (const plan of w.buildPlans) {
      for (const st of plan.steps) {
        if (!stepDone(w, st) && cluster.includes(st.i)) {
          underConstruction = true;
          break;
        }
      }
      if (underConstruction) break;
    }
    if (!underConstruction && cluster.length >= 3) candidates.push(cluster);
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => b.length - a.length);
  const crew = w.ents.filter(
    (e) => (e.kind === EntKind.Servitor || e.kind === EntKind.Militor) && e.hp > 0
  );
  let chosen = null;
  for (const cluster of candidates) {
    const perim = perimOf(w, cluster);
    if (perim.length === 0) continue;
    if (crew.length === 0) {
      chosen = cluster;
      break;
    }
    const from = crew[0].y * W + crew[0].x;
    if (findPath(w, from, perim[0]) !== null) {
      chosen = cluster;
      break;
    }
    if (!chosen) chosen = cluster;
  }
  if (!chosen) return;
  w.reactorCells = chosen;
  w.reactorAlive = true;
  if (w.nextBrainId <= w.brainId) w.nextBrainId = w.brainId + 1;
  w.brainId = w.nextBrainId++;
  for (const c of chosen) w.reactorOwner[c] = w.brainId;
  for (let i9 = 0; i9 < N; i9++) {
    if (w.mat[i9] !== Mat.Machine || w.machine[i9] !== Machine.CoolantTank) continue;
    const dd9 = Math.abs(i9 % W - chosen[0] % W) + Math.abs((i9 / W | 0) - (chosen[0] / W | 0));
    if (dd9 <= 12) w.reactorOwner[i9] = w.brainId;
  }
  w.pushNews(`SUCCESSION — ${brainName(w.brainId)} inherits the ship`);
  swearCrew(w);
  w.melted = false;
  w.coreHeat = 0;
  w.periReactor = perimOf(w, chosen);
  w.networksDirty = true;
  if (!w.blueprint) {
    dreamShip(w, (w.seed ^ Math.imul(w.tick, 40503)) >>> 0);
  } else {
    stampHeart(w);
  }
}
function draftGridTap(w, coreCells) {
  const steps = [];
  if (!coreCells.length) return steps;
  const c0 = coreCells[0];
  const cx0 = c0 % W;
  const cy0 = c0 / W | 0;
  const targets = [];
  const cand = [];
  for (let i = 0; i < N; i++) {
    if (!(w.pipe[i] & Pipe.Wire)) continue;
    const d = Math.abs(i % W - cx0) + Math.abs((i / W | 0) - cy0);
    if (d >= 3 && d <= 34) cand.push({ i, d });
  }
  cand.sort((a, b) => a.d - b.d);
  for (const { i } of cand) {
    if (targets.length >= 3) break;
    let far = true;
    for (const t of targets) {
      if (Math.abs(t % W - i % W) + Math.abs((t / W | 0) - (i / W | 0)) < 10) far = false;
    }
    if (far) targets.push(i);
  }
  const booked = /* @__PURE__ */ new Set();
  const perim = [];
  for (const cc of coreCells) {
    for (const j of [cc - 1, cc + 1, cc - W, cc + W]) {
      if (j < 0 || j >= N) continue;
      if (w.mat[j] === Mat.Machine || coreCells.includes(j)) continue;
      if (!perim.includes(j)) perim.push(j);
    }
  }
  for (const tgt of targets) {
    const tx2 = tgt % W;
    const ty2 = tgt / W | 0;
    let start = -1;
    let sd = Infinity;
    for (const p of perim) {
      const d = Math.abs(p % W - tx2) + Math.abs((p / W | 0) - ty2);
      if (d < sd) {
        sd = d;
        start = p;
      }
    }
    if (start < 0) continue;
    let px2 = start % W;
    let py2 = start / W | 0;
    if (!(w.pipe[start] & Pipe.Wire) && !booked.has(start)) {
      booked.add(start);
      steps.push({ i: start, m: Mat.Floor, pp: Pipe.Wire });
    }
    let guard = 0;
    while ((px2 !== tx2 || py2 !== ty2) && guard++ < 60) {
      if (px2 !== tx2) px2 += Math.sign(tx2 - px2);
      else py2 += Math.sign(ty2 - py2);
      const i = py2 * W + px2;
      if (booked.has(i)) continue;
      const m = w.mat[i];
      if (m === Mat.Machine || m === Mat.Hull || m === Mat.Wall || m === Mat.DoorClosed || m === Mat.DoorOpen)
        break;
      if (w.pipe[i] & Pipe.Wire) continue;
      booked.add(i);
      steps.push({
        i,
        m: m === Mat.Floor || m === Mat.Vine || m === Mat.Rubble ? Mat.Floor : Mat.Floor,
        pp: Pipe.Wire
      });
    }
  }
  return steps;
}
function stampHeart(w) {
  const bp = w.blueprint;
  if (!bp) return;
  for (let k = w.blueprintGrafts.length - 1; k >= 0; k--) {
    const g2 = w.blueprintGrafts[k];
    bp.mat[g2.i] = g2.mat;
    bp.machine[g2.i] = g2.machine;
    bp.pipe[g2.i] = g2.pipe;
  }
  w.blueprintGrafts = [];
  const graft = (i2) => {
    w.blueprintGrafts.push({ i: i2, mat: bp.mat[i2], machine: bp.machine[i2], pipe: bp.pipe[i2] });
  };
  const paveApproach = (i2, hx, hy) => {
    let ok = false;
    let best = -1;
    let bestD = Infinity;
    for (const j of [i2 - 1, i2 + 1, i2 - W, i2 + W]) {
      if (j < 0 || j >= N) continue;
      const bm = bp.mat[j];
      if (bm === Mat.Floor || bm === Mat.DoorOpen || bm === Mat.Rubble) {
        ok = true;
        break;
      }
      if (bm === Mat.Space) {
        const dd = Math.abs(j % W - hx) + Math.abs((j / W | 0) - hy);
        if (dd < bestD) {
          bestD = dd;
          best = j;
        }
      }
    }
    if (!ok && best >= 0) {
      graft(best);
      bp.mat[best] = Mat.Floor;
    }
  };
  for (let i = 0; i < bp.mat.length; i++) {
    if (bp.machine[i] === Machine.Reactor && !w.reactorCells.includes(i)) {
      bp.machine[i] = Machine.None;
      bp.mat[i] = Mat.Floor;
    }
  }
  for (const c of w.reactorCells) {
    bp.mat[c] = Mat.Machine;
    bp.machine[c] = Machine.Reactor;
  }
  {
    const rc0 = w.reactorCells[0];
    const rx0 = rc0 % W;
    const ry0 = rc0 / W | 0;
    let hasTank = false;
    let hasLamp = false;
    for (let i = 0; i < bp.machine.length; i++) {
      if (bp.machine[i] === Machine.CoolantTank && Math.abs(i % W - rx0) + Math.abs((i / W | 0) - ry0) <= 30) hasTank = true;
      if (bp.machine[i] === Machine.Light && Math.abs(i % W - rx0) + Math.abs((i / W | 0) - ry0) <= 8) hasLamp = true;
    }
    if (!hasTank || !hasLamp) {
      const ring = [];
      for (let r = 1; r <= 3 && ring.length < 6; r++) {
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const cx2 = rx0 + dx;
            const cy2 = ry0 + dy;
            if (cx2 < 1 || cx2 >= W - 1 || cy2 < 1 || cy2 >= H - 1) continue;
            const i2 = cy2 * W + cx2;
            if (bp.machine[i2] !== 0 || bp.mat[i2] === Mat.Hull || w.reactorCells.includes(i2)) continue;
            ring.push(i2);
          }
      }
      ring.sort((a, b) => (bp.mat[a] === Mat.Space ? 1 : 0) - (bp.mat[b] === Mat.Space ? 1 : 0));
      if (!hasTank && ring.length >= 2) {
        const t2 = ring.shift();
        const s2 = ring.shift();
        graft(t2);
        graft(s2);
        bp.mat[t2] = Mat.Machine;
        bp.machine[t2] = Machine.CoolantTank;
        bp.mat[s2] = Mat.Floor;
        bp.pipe[s2] |= Pipe.Coolant;
        paveApproach(t2, rx0, ry0);
      }
      if (!hasLamp && ring.length >= 1) {
        const l2 = ring.shift();
        graft(l2);
        bp.mat[l2] = Mat.Floor;
        bp.machine[l2] = Machine.Light;
        bp.pipe[l2] |= Pipe.Wire;
        paveApproach(l2, rx0, ry0);
      }
    }
  }
  for (const bit of [Pipe.Wire, Pipe.Coolant, Pipe.Fuel]) {
    let touches = false;
    for (const c of w.reactorCells) {
      for (const j of [c - 1, c + 1, c - W, c + W]) {
        if (j >= 0 && j < N && bp.pipe[j] & bit) touches = true;
      }
    }
    if (touches) continue;
    const rc = w.reactorCells[0];
    const rx = rc % W;
    const ry = rc / W | 0;
    let tgt = -1;
    let td = Infinity;
    for (let i = 0; i < bp.pipe.length; i++) {
      if (!(bp.pipe[i] & bit)) continue;
      const d = Math.abs(i % W - rx) + Math.abs((i / W | 0) - ry);
      if (d < td) {
        td = d;
        tgt = i;
      }
    }
    if (tgt < 0 || td > 60) continue;
    const start = perimOf(w, w.reactorCells)[0];
    if (start === void 0) continue;
    let px2 = start % W;
    let py = start / W | 0;
    const tx = tgt % W;
    const ty = tgt / W | 0;
    let guard = 0;
    while ((px2 !== tx || py !== ty) && guard++ < 80) {
      const i = py * W + px2;
      const m = bp.mat[i];
      if (m !== Mat.Hull && bp.machine[i] === 0) {
        graft(i);
        bp.pipe[i] |= bit;
        if (m === Mat.Space) bp.mat[i] = Mat.Floor;
      }
      if (px2 !== tx) px2 += Math.sign(tx - px2);
      else py += Math.sign(ty - py);
    }
  }
}
function takePlanStep(w, e, rnd2) {
  if (e.sulk && w.tick < e.sulk) return;
  const cellPlan = /* @__PURE__ */ new Map();
  for (const plan of w.buildPlans) {
    for (const st of plan.steps) {
      if (!stepDone(w, st)) cellPlan.set(st.i, plan);
    }
  }
  const crewOf = /* @__PURE__ */ new Map();
  for (const o of w.ents) {
    if (o !== e && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor) && o.hp > 0 && o.tx !== void 0 && o.tx >= 0) {
      const hit = cellPlan.get(o.ty * W + o.tx);
      if (hit) crewOf.set(hit, (crewOf.get(hit) ?? 0) + 1);
    }
  }
  const avoid = e.home ?? -1;
  const ax = avoid >= 0 ? avoid % W : 0;
  const ay = avoid >= 0 ? avoid / W | 0 : 0;
  let rcH = w.reactorAlive && w.reactorCells.length ? w.reactorCells[0] : -1;
  if (e.brain !== void 0 && e.brain !== w.brainId) {
    rcH = w.brainHearts.get(e.brain) ?? -1;
  }
  const headless = rcH < 0;
  if (headless && w.blueprint && (e.brain === void 0 || e.brain === w.brainId)) {
    for (let bi = 0; bi < w.blueprint.machine.length; bi++) {
      if (w.blueprint.machine[bi] === Machine.Reactor) {
        rcH = bi;
        break;
      }
    }
  }
  const rhx = rcH >= 0 ? rcH % W : 0;
  const rhy = rcH >= 0 ? rcH / W | 0 : 0;
  const cohort = e.kind === EntKind.Servitor ? e.cls ?? 0 : 0;
  const RING_PULL = cohort === 0 ? 6 : cohort === 1 ? 2 : cohort === 2 ? 1 : 0;
  const COOL_BONUS = cohort === 1 ? 400 : cohort === 3 ? 0 : 60;
  const POWER_BONUS = cohort === 1 ? 300 : cohort === 3 ? 0 : 40;
  const CROWN_RUSH = 150;
  const bests = [null, null, null];
  const dists = [Infinity, Infinity, Infinity];
  for (const plan of w.buildPlans) {
    if ((crewOf.get(plan) ?? 0) >= (plan.restore ? TUNE.restoreCrewCap : TUNE.draftCrewCap)) continue;
    if (plan.team !== void 0 && e.brain !== void 0 && plan.team !== e.brain) continue;
    const heartPlan = rcH >= 0 && (plan.restore || plan.team !== void 0 && plan.team === e.brain);
    for (const st of plan.steps) {
      if (stepDone(w, st)) continue;
      if (claimedBy(st.i, e)) continue;
      if (avoid >= 0 && Math.abs(st.i % W - ax) + Math.abs((st.i / W | 0) - ay) <= 4) continue;
      const crowning = headless && (st.mc === Machine.Reactor || st.mc === Machine.CoolantTank || st.pp !== void 0 && (st.pp & Pipe.Coolant) !== 0);
      const phase = crowning ? 0 : st.m === Mat.Wall ? 2 : st.m === Mat.Machine ? 1 : 0;
      const d = Math.abs(st.i % W - e.x) + Math.abs((st.i / W | 0) - e.y);
      let cost = d;
      if (heartPlan) {
        const drH = Math.abs(st.i % W - rhx) + Math.abs((st.i / W | 0) - rhy);
        cost += drH * RING_PULL;
        if (st.mc === Machine.CoolantTank || st.pp !== void 0 && (st.pp & Pipe.Coolant) !== 0)
          cost -= COOL_BONUS;
        else if (st.pp !== void 0 && (st.pp & Pipe.Wire) !== 0 || st.mc === Machine.Light)
          cost -= POWER_BONUS;
      }
      if (crowning) cost -= CROWN_RUSH;
      if (cost < dists[phase]) {
        let standable = false;
        for (const nb of [st.i - 1, st.i + 1, st.i - W, st.i + W]) {
          if (nb >= 0 && nb < N && entPass(w.mat[nb])) {
            standable = true;
            break;
          }
        }
        if (!standable) continue;
        dists[phase] = cost;
        bests[phase] = st;
      }
    }
  }
  let cutOff = false;
  for (const cand of [bests[0], bests[1], bests[2]]) {
    if (!cand) continue;
    const pd = Math.abs(cand.i % W - e.x) + Math.abs((cand.i / W | 0) - e.y);
    if (pd <= 20 || findPath(w, e.y * W + e.x, cand.i) !== null) {
      e.tx = cand.i % W;
      e.ty = cand.i / W | 0;
      e.patrol = false;
      e.mode = Mode.Plan;
      claim(cand.i, e);
      return;
    }
    cutOff = true;
  }
  const heartBeats = w.reactorAlive && w.reactorCells.length > 0;
  if (!cutOff && heartBeats) {
    const per = w.periReactor.find((c) => entPass(w.mat[c]));
    if (per === void 0 || findPath(w, e.y * W + e.x, per) === null) cutOff = true;
    if (!cutOff && w.blueprint) return;
  }
  if (cutOff && heartBeats) {
    const cw = draftCauseway(w, e);
    if (cw && cw.length) {
      w.buildPlans.push({ steps: cw, touched: w.tick, team: e.brain });
      const first = cw[0];
      e.tx = first.i % W;
      e.ty = first.i / W | 0;
      e.patrol = false;
      e.mode = Mode.Plan;
      claim(first.i, e);
      return;
    }
  }
  if (!cutOff && heartBeats && w.blueprint) return;
  const steps = draftPlan(w, rnd2, e, cutOff);
  if (steps && steps.length) {
    w.buildPlans.push({ steps, touched: w.tick, team: e.brain });
    let nearest = null;
    let nd = Infinity;
    for (const st of steps) {
      if (st.m === Mat.Wall || stepDone(w, st)) continue;
      const d = Math.abs(st.i % W - e.x) + Math.abs((st.i / W | 0) - e.y);
      if (d < nd) {
        nd = d;
        nearest = st;
      }
    }
    if (nearest) {
      e.tx = nearest.i % W;
      e.ty = nearest.i / W | 0;
      e.mode = Mode.Plan;
      claim(nearest.i, e);
      e.patrol = false;
    }
  }
}
function refreshRestorePlan(w) {
  if (!w.blueprint) return;
  const bp = w.blueprint;
  let rc = w.reactorCells.length ? w.reactorCells[0] : -1;
  if (rc < 0) {
    for (let i = 0; i < bp.machine.length; i++) {
      if (bp.machine[i] === Machine.Reactor) {
        rc = i;
        break;
      }
    }
  }
  const rx = rc >= 0 ? rc % W : W / 2 | 0;
  const ry = rc >= 0 ? rc / W | 0 : H / 2 | 0;
  const found = [];
  for (let i = W; i < N - W && found.length < 1200; i++) {
    const tm = bp.mat[i];
    if (tm === Mat.Space) continue;
    const cm = w.mat[i];
    if (cm === Mat.Growth) continue;
    const doorish = (tm === Mat.DoorClosed || tm === Mat.DoorOpen) && (cm === Mat.DoorClosed || cm === Mat.DoorOpen);
    const matOk = cm === tm || doorish;
    const machOk = bp.machine[i] === 0 || w.machine[i] === bp.machine[i];
    const pipeOk = (w.pipe[i] & bp.pipe[i]) === bp.pipe[i];
    if (matOk && machOk && pipeOk) continue;
    const rivalPlant = cm === Mat.Machine && (w.machine[i] === Machine.Reactor || w.machine[i] === Machine.CoolantTank) && !w.reactorCells.includes(i);
    if (cm === Mat.Space || cm === Mat.Rubble || cm === Mat.Lattice || cm === Mat.Vine || cm === Mat.Tree || cm === Mat.Floor || cm === Mat.DoorOpen || cm === Mat.DoorClosed || matOk || rivalPlant) {
      found.push({
        st: {
          i,
          m: tm,
          mc: bp.machine[i] !== 0 ? bp.machine[i] : void 0,
          pp: bp.pipe[i] !== 0 ? bp.pipe[i] : void 0
        },
        d: Math.abs(i % W - rx) + Math.abs((i / W | 0) - ry)
      });
    }
  }
  if (found.length) {
    found.sort((a, b) => a.d - b.d);
    const steps = found.slice(0, 300).map((f) => f.st);
    w.buildPlans.push({ steps, touched: w.tick, restore: true, team: w.brainId });
  }
}
function stepDone(w, st) {
  if (w.mat[st.i] !== st.m) return false;
  if (st.mc !== void 0 && w.machine[st.i] !== st.mc) return false;
  if (st.pp !== void 0 && !(w.pipe[st.i] & st.pp)) return false;
  return true;
}
function planAt(w, i) {
  for (const plan of w.buildPlans) {
    for (const st of plan.steps) {
      if (st.i === i && !stepDone(w, st)) return { plan, st };
    }
  }
  return null;
}
function planStepAt(w, i) {
  var _a;
  return ((_a = planAt(w, i)) == null ? void 0 : _a.st) ?? null;
}
function afterBuild(w, plan, st) {
  if (st.mc === void 0 && st.pp === void 0) return;
  const rSteps = plan.steps.filter((p2) => p2.mc === Machine.Reactor);
  if (rSteps.length === 0) return;
  if (plan.restore) {
    if (!rSteps.every((p2) => stepDone(w, p2))) return;
  } else {
    const specials = plan.steps.filter((p2) => p2.mc !== void 0 || p2.pp !== void 0);
    if (!specials.every((p2) => stepDone(w, p2))) return;
  }
  if (w.reactorAlive && w.reactorCells.length >= 4) {
    if (w.nextBrainId <= w.brainId) w.nextBrainId = w.brainId + 1;
    const colonyId = w.nextBrainId++;
    w.pushNews(`a COLONY stands — ${brainName(colonyId)} declares itself`);
    const cx = rSteps[0].i % W;
    const cy = rSteps[0].i / W | 0;
    for (const o of w.ents) {
      if (o.kind !== EntKind.Servitor && o.kind !== EntKind.Militor) continue;
      if (o.hp <= 0) continue;
      if (Math.abs(o.x - cx) + Math.abs(o.y - cy) <= 10) o.brain = colonyId;
    }
    for (const p2 of rSteps) w.reactorOwner[p2.i] = colonyId;
    for (const p2 of plan.steps) if (p2.mc === Machine.CoolantTank) w.reactorOwner[p2.i] = colonyId;
    plan.team = colonyId;
    const tap2 = draftGridTap(w, rSteps.map((s2) => s2.i));
    if (tap2.length) w.buildPlans.push({ steps: tap2, touched: w.tick, team: colonyId });
    return;
  }
  w.reactorCells = rSteps.map((p2) => p2.i);
  w.reactorAlive = true;
  w.melted = false;
  w.coreHeat = 0;
  if (w.nextBrainId <= w.brainId) w.nextBrainId = w.brainId + 1;
  w.brainId = w.nextBrainId++;
  for (const c2 of w.reactorCells) w.reactorOwner[c2] = w.brainId;
  w.pushNews(`a heart beats — ${brainName(w.brainId)} takes the crown`);
  swearCrew(w);
  w.periReactor = perimOf(w, w.reactorCells);
  const tSteps = plan.steps.filter((p2) => p2.mc === Machine.CoolantTank);
  for (const p2 of tSteps) w.reactorOwner[p2.i] = w.brainId;
  if (tSteps.length) w.periCoolTank = perimOf(w, tSteps.map((p2) => p2.i));
  if (w.coolantReserve < 1200) w.coolantReserve = 1200;
  w.networksDirty = true;
  if (!w.blueprint) {
    dreamShip(w, (w.seed ^ Math.imul(w.tick, 2654435761)) >>> 0);
  } else {
    stampHeart(w);
  }
  const tap = draftGridTap(w, w.reactorCells);
  if (tap.length) w.buildPlans.push({ steps: tap, touched: w.tick, team: w.brainId });
}
function perimOf(w, cells) {
  const out = /* @__PURE__ */ new Set();
  for (const c of cells) {
    for (const j of [c - 1, c + 1, c - W, c + W]) {
      if (j >= 0 && j < N && entPass(w.mat[j])) out.add(j);
    }
  }
  return [...out];
}
const BUILDABLE = (m) => m === Mat.Space || m === Mat.Rubble || m === Mat.Lattice || m === Mat.Vine || m === Mat.Tree;
function draftCauseway(w, e) {
  if (!w.reactorCells.length) return null;
  const rc = w.reactorCells[0];
  const tx = rc % W;
  const ty = rc / W | 0;
  let x = e.x;
  let y = e.y;
  const steps = [];
  let guard = 0;
  while ((x !== tx || y !== ty) && guard++ < 200) {
    const dx = tx - x;
    const dy = ty - y;
    if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx);
    else y += Math.sign(dy);
    const i = y * W + x;
    if (i < W || i >= N - W) break;
    const m = w.mat[i];
    if (m === Mat.Machine || m === Mat.Hull) break;
    if (m === Mat.DoorClosed || m === Mat.DoorOpen) break;
    if (m === Mat.Wall) {
      const bp = w.blueprint;
      if (bp && bp.mat[i] === Mat.Wall) break;
      steps.push({ i, m: Mat.DoorOpen });
      continue;
    }
    if (entPass(m)) continue;
    steps.push({ i, m: Mat.Floor });
  }
  return steps.length ? steps : null;
}
function draftPlan(w, rnd2, e, sovereign = false) {
  const from = e.y * W + e.x;
  let pathChecks = 0;
  const reachable = (bx, by, sw, sh) => {
    if (pathChecks > 12) return false;
    for (let y = by - 1; y <= by + sh; y++)
      for (let x = bx - 1; x <= bx + sw; x++) {
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const j = y * W + x;
        if (!entPass(w.mat[j])) continue;
        if (Math.abs(x - e.x) + Math.abs(y - e.y) <= 1) return true;
        pathChecks++;
        return findPath(w, from, j) !== null;
      }
    return false;
  };
  if (sovereign || !w.reactorAlive || w.reactorCells.length === 0) {
    for (let tries = 0; tries < 200; tries++) {
      let bx;
      let by;
      if (tries < 150) {
        bx = Math.max(3, Math.min(W - 10, e.x - 8 + (rnd2() * 16 | 0)));
        by = Math.max(3, Math.min(H - 10, e.y - 8 + (rnd2() * 16 | 0)));
      } else {
        bx = 3 + (rnd2() * (W - 10) | 0);
        by = 3 + (rnd2() * (H - 10) | 0);
      }
      let ok = true;
      let nearShip = false;
      for (let y = by - 1; y <= by + 4 && ok; y++)
        for (let x = bx - 1; x <= bx + 4 && ok; x++) {
          const i9 = y * W + x;
          const m = w.mat[i9];
          const rivalPlant = m === Mat.Machine && (w.machine[i9] === Machine.Reactor || w.machine[i9] === Machine.CoolantTank) && w.reactorOwner[i9] !== (e.brain ?? 0);
          if (m === Mat.Machine && !rivalPlant || m === Mat.Hull || m === Mat.Wall || m === Mat.DoorClosed || m === Mat.DoorOpen) ok = false;
          if (m === Mat.Floor || m === Mat.Rubble) nearShip = true;
        }
      if (!ok || !nearShip) continue;
      let overlap = false;
      for (let y = by; y < by + 4 && !overlap; y++)
        for (let x = bx; x < bx + 4 && !overlap; x++) {
          if (planStepAt(w, y * W + x) !== null) overlap = true;
        }
      if (overlap) continue;
      if (!reachable(bx, by, 4, 4)) continue;
      const specials = /* @__PURE__ */ new Map();
      specials.set(by * W + bx, { i: by * W + bx, m: Mat.Machine, mc: Machine.CoolantTank });
      specials.set(by * W + bx + 1, { i: by * W + bx + 1, m: Mat.Floor, pp: Pipe.Coolant });
      for (const [ry, rx] of [[1, 1], [1, 2], [2, 1], [2, 2]]) {
        const ri2 = (by + ry) * W + bx + rx;
        specials.set(ri2, { i: ri2, m: Mat.Machine, mc: Machine.Reactor });
      }
      const wireI = (by + 1) * W + bx + 3;
      const lampI = by * W + bx + 3;
      specials.set(wireI, { i: wireI, m: Mat.Floor, pp: Pipe.Wire });
      specials.set(lampI, { i: lampI, m: Mat.Floor, mc: Machine.Light, pp: Pipe.Wire });
      const steps = [];
      for (let y = by; y < by + 4; y++)
        for (let x = bx; x < bx + 4; x++) {
          const i2 = y * W + x;
          if (!specials.has(i2)) steps.push({ i: i2, m: Mat.Floor });
        }
      steps.push(...specials.values());
      return steps;
    }
    return null;
  }
  const rcRef = w.reactorCells.length ? w.reactorCells[0] : from;
  const rcx = rcRef % W;
  const rcy = rcRef / W | 0;
  const anchors = [];
  const dirs = [1, -1, W, -W];
  for (let i = 0; i < N; i++) {
    if (w.mat[i] !== Mat.Floor) continue;
    for (let k = 0; k < 4; k++) {
      const j = i + dirs[k];
      if (j >= 0 && j < N && BUILDABLE(w.mat[j])) {
        anchors.push({
          i,
          dir: dirs[k],
          d: Math.abs(i % W - rcx) + Math.abs((i / W | 0) - rcy) + Math.abs(i % W - e.x) + Math.abs((i / W | 0) - e.y)
        });
        break;
      }
    }
  }
  for (const a of anchors) {
    const j = a.i + a.dir;
    if (w.mat[j] !== Mat.Rubble) a.d += 30;
  }
  anchors.sort((a, b) => a.d - b.d);
  for (let tries = 0; tries < Math.min(120, anchors.length); tries++) {
    const anchor = anchors[tries];
    const i = anchor.i;
    const dir = anchor.dir;
    const ax = i % W;
    const ay = i / W | 0;
    const rw = 5 + (rnd2() * 3 | 0);
    const rh = 4 + (rnd2() * 3 | 0);
    let x0;
    let y0;
    if (dir === 1) {
      x0 = ax + 1;
      y0 = ay - (rh >> 1);
    } else if (dir === -1) {
      x0 = ax - rw;
      y0 = ay - (rh >> 1);
    } else if (dir === W) {
      x0 = ax - (rw >> 1);
      y0 = ay + 1;
    } else {
      x0 = ax - (rw >> 1);
      y0 = ay - rh;
    }
    if (x0 < 2 || y0 < 2 || x0 + rw >= W - 2 || y0 + rh >= H - 2) continue;
    const steps = [];
    let buildable = 0;
    let overlap = false;
    for (let y = y0; y < y0 + rh && !overlap; y++)
      for (let x = x0; x < x0 + rw; x++) {
        const j = y * W + x;
        if (planStepAt(w, j) !== null) {
          overlap = true;
          break;
        }
        if (!BUILDABLE(w.mat[j])) continue;
        const perimCell = x === x0 || x === x0 + rw - 1 || y === y0 || y === y0 + rh - 1;
        steps.push({ i: j, m: perimCell ? Mat.Wall : Mat.Floor });
        buildable++;
      }
    if (overlap || buildable < 6) continue;
    if (pathChecks > 12) break;
    pathChecks++;
    if (findPath(w, from, i) === null) continue;
    const doorI = dir === 1 ? ay * W + x0 : dir === -1 ? ay * W + (x0 + rw - 1) : dir === W ? y0 * W + ax : (y0 + rh - 1) * W + ax;
    for (const st of steps) if (st.i === doorI) st.m = Mat.DoorOpen;
    const lx = x0 + 1 + ((rw - 2) / 2 | 0);
    const ly = y0 + 1;
    const li = ly * W + lx;
    for (const st of steps) {
      if (st.i === li && st.m === Mat.Floor) {
        st.mc = Machine.Light;
        st.pp = (st.pp ?? 0) | Pipe.Wire;
      }
    }
    const wireCells = [];
    const ddx = doorI % W;
    const ddy = doorI / W | 0;
    let cx2 = lx;
    let cy2 = ly;
    while (cx2 !== ddx) {
      cx2 += Math.sign(ddx - cx2);
      wireCells.push(cy2 * W + cx2);
    }
    while (cy2 !== ddy) {
      cy2 += Math.sign(ddy - cy2);
      wireCells.push(cy2 * W + cx2);
    }
    let tgt = -1;
    let td = Infinity;
    for (let yy = Math.max(1, ddy - 20); yy < Math.min(H - 1, ddy + 20); yy++)
      for (let xx = Math.max(1, ddx - 20); xx < Math.min(W - 1, ddx + 20); xx++) {
        const jj = yy * W + xx;
        if (!(w.pipe[jj] & Pipe.Wire)) continue;
        const dd = Math.abs(xx - ddx) + Math.abs(yy - ddy);
        if (dd < td) {
          td = dd;
          tgt = jj;
        }
      }
    if (tgt >= 0) {
      let px2 = ddx;
      let py = ddy;
      const tx2 = tgt % W;
      const ty2 = tgt / W | 0;
      const runCells = [];
      let okRun = true;
      while ((px2 !== tx2 || py !== ty2) && runCells.length < 60) {
        if (px2 !== tx2) px2 += Math.sign(tx2 - px2);
        else py += Math.sign(ty2 - py);
        const jj = py * W + px2;
        const m2 = w.mat[jj];
        if (m2 === Mat.Wall || m2 === Mat.Hull || m2 === Mat.Machine || m2 === Mat.DoorClosed || m2 === Mat.DoorOpen) {
          okRun = false;
          break;
        }
        runCells.push(jj);
      }
      if (okRun) wireCells.push(...runCells);
    }
    const planned = /* @__PURE__ */ new Map();
    for (const st of steps) planned.set(st.i, st);
    for (const wc of wireCells) {
      const st = planned.get(wc);
      if (st) {
        if (st.m !== Mat.Wall) st.pp = (st.pp ?? 0) | Pipe.Wire;
      } else {
        const st2 = { i: wc, m: Mat.Floor, pp: Pipe.Wire };
        steps.push(st2);
        planned.set(wc, st2);
      }
    }
    const ridx = w.rooms.length;
    w.rooms.push({
      id: w.rooms.length,
      x: x0 + 1,
      y: y0 + 1,
      w: rw - 2,
      h: rh - 2,
      kind: "annex",
      isCorridor: false,
      lit: false,
      lightCell: li
    });
    for (let y = y0 + 1; y < y0 + rh - 1; y++)
      for (let x = x0 + 1; x < x0 + rw - 1; x++) w.roomId[y * W + x] = ridx;
    return steps;
  }
  return null;
}
function surplusReactor(w, i) {
  if (w.mat[i] !== Mat.Machine || w.machine[i] !== Machine.Reactor) return false;
  if (w.reactorCells.includes(i)) return false;
  const x = i % W;
  const y = i / W | 0;
  for (const o of w.ents) {
    if (o.kind !== EntKind.Servitor && o.kind !== EntKind.Militor) continue;
    if (o.hp <= 0 || o.brain === void 0 || o.brain === w.brainId) continue;
    if (Math.abs(o.x - x) + Math.abs(o.y - y) <= 12) return false;
  }
  return true;
}
function hullGap(w, i) {
  if (w.mat[i] !== Mat.Space) return false;
  let hull = 0;
  let deck = false;
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    if (j < 0 || j >= N) continue;
    const m = w.mat[j];
    if (m === Mat.Hull) hull++;
    else if (m === Mat.Floor || m === Mat.Rubble || m === Mat.DoorOpen || m === Mat.DoorClosed)
      deck = true;
  }
  return hull >= 2 && deck;
}
function ventingEdge(w, i) {
  const m = w.mat[i];
  if (!entPass(m) || m === Mat.Lattice) return false;
  if (w.air[i] < 0.2) return false;
  return adjacentSpace(w, i) >= 0;
}
function pickJob(w, e) {
  const sulking = e.sulk !== void 0 && w.tick < e.sulk;
  const avoid = sulking && e.home !== void 0 ? e.home : -1;
  const ax = avoid >= 0 ? avoid % W : 0;
  const ay = avoid >= 0 ? avoid / W | 0 : 0;
  const rc = w.reactorCells.length ? w.reactorCells[0] : -1;
  const rcx2 = rc >= 0 ? rc % W : 0;
  const rcy2 = rc >= 0 ? rc / W | 0 : 0;
  const reactorFlood = floodFromReactor(w);
  floodFromUnit(w, e);
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < N; i++) {
    const onNet = !reactorFlood || bfsSeen[i] !== 0 || bfsSeen[i - 1] !== 0 || bfsSeen[i + 1] !== 0 || i - W >= 0 && bfsSeen[i - W] !== 0 || i + W < N && bfsSeen[i + W] !== 0;
    let v = 0;
    if (w.burn[i] > 0) {
      if (!onNet) continue;
      v = 3;
      if (rc >= 0) {
        const dr = Math.abs(i % W - rcx2) + Math.abs((i / W | 0) - rcy2);
        if (dr < 16) v = 6;
      }
    } else if (ventingEdge(w, i)) {
      if (!onNet) continue;
      v = 2;
    } else if (hullGap(w, i)) {
      if (!onNet) continue;
      v = 1.5;
    } else if (reactorFlood && surplusReactor(w, i) && onNet && bfsSeen[i] === 0) {
      v = 1.2;
    } else if (w.pipe[i] !== 0 && w.pipeBroken[i]) {
      if (rc < 0 || !onNet) continue;
      if ((w.pipe[i] & Pipe.Coolant) !== 0 && !w.coolingActive && w.reactorAlive) {
        v = 5;
      } else if ((w.pipe[i] & (Pipe.Coolant | Pipe.Fuel)) !== 0 && w.liqAmt[i] > 0.1 && (w.pipe[i] & Pipe.Coolant && w.coolantReserve > 0 || w.pipe[i] & Pipe.Fuel && w.fuelReserve > 0)) {
        v = 2.5;
      } else if ((w.pipe[i] & Pipe.Wire) !== 0 && w.reactorAlive) {
        v = 2;
      } else {
        if (w.buildPlans.length > 0) {
          const dr = Math.abs(i % W - rcx2) + Math.abs((i / W | 0) - rcy2);
          if (dr > 26) continue;
        }
        v = 1;
      }
    } else continue;
    if (avoid >= 0 && Math.abs(i % W - ax) + Math.abs((i / W | 0) - ay) <= 5) continue;
    if (claimedBy(i, e)) continue;
    if (!unitReach[i] && !unitReach[i - 1] && !unitReach[i + 1] && !(i - W >= 0 && unitReach[i - W]) && !(i + W < N && unitReach[i + W]))
      continue;
    const d = Math.abs(i % W - e.x) + Math.abs((i / W | 0) - e.y);
    const drH = rc >= 0 ? Math.abs(i % W - rcx2) + Math.abs((i / W | 0) - rcy2) : 0;
    const score = v * 20 - d - drH * 0.9 + (d <= 2 ? 18 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best >= 0) {
    claim(best, e);
    e.mode = Mode.Job;
    e.tx = best % W;
    e.ty = best / W | 0;
  } else {
    e.tx = -1;
  }
}
const occ = new Uint8Array(N);
function markOcc(e, v) {
  occ[e.y * W + e.x] = v;
  if (e.kind === EntKind.Brood) {
    const i = e.y * W + e.x;
    if (e.x + 1 < W) occ[i + 1] = v;
    if (e.y + 1 < H) occ[i + W] = v;
    if (e.x + 1 < W && e.y + 1 < H) occ[i + W + 1] = v;
  }
}
function rebuildOcc(w) {
  occ.fill(0);
  for (const e of w.ents) {
    if (e.hp > 0) markOcc(e, 1);
  }
}
function closeDoorBehind(w, e, fromI) {
  if (e.kind !== EntKind.Servitor && e.kind !== EntKind.Militor) return;
  if (w.mat[fromI] !== Mat.DoorOpen) return;
  const fx = fromI % W;
  const fy = fromI / W | 0;
  for (const o of w.ents) {
    if (o === e || o.hp <= 0) continue;
    if (Math.abs(o.x - fx) + Math.abs(o.y - fy) <= 1) return;
  }
  w.mat[fromI] = Mat.DoorClosed;
}
function entPass(m) {
  return m === Mat.Floor || m === Mat.DoorOpen || m === Mat.Rubble || m === Mat.Growth || m === Mat.Lattice || m === Mat.Vine;
}
function placeAround(w, x, y, count, fn) {
  let placed = 0;
  for (let r = 0; r <= 6 && placed < count; r++) {
    for (let dy = -r; dy <= r && placed < count; dy++)
      for (let dx = -r; dx <= r && placed < count; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
        if (entPass(w.mat[ny * W + nx]) && !occ[ny * W + nx]) {
          fn(nx, ny);
          placed++;
        }
      }
  }
}
function nearestEnt(w, from, want, maxD) {
  let best = null;
  let bestD = Infinity;
  for (const o of w.ents) {
    if (o === from || o.hp <= 0) continue;
    if (!want(o)) continue;
    let d = Math.abs(o.x - from.x) + Math.abs(o.y - from.y);
    if (o.kind === EntKind.Egg) d += 6;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (!best || bestD > maxD) return null;
  return { e: best, d: bestD };
}
function hasLOS(w, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (; ; ) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) return true;
    const m = w.mat[y * W + x];
    if (m === Mat.Wall || m === Mat.Hull || m === Mat.DoorClosed || m === Mat.Machine || m === Mat.Lattice || m === Mat.Tree)
      return false;
    if (w.smoke[y * W + x] > 1.3) return false;
  }
}
function isDark(w, i) {
  return Math.max(w.lightLevel[i], w.fireGlow[i], w.bridgeGlow[i]) < 0.25;
}
function tryMove(w, e, dx, dy) {
  const nx = e.x + dx;
  const ny = e.y + dy;
  if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) return false;
  const m = w.mat[ny * W + nx];
  if (m === Mat.DoorClosed) {
    if (e.kind === EntKind.Breacher) {
      w.mat[ny * W + nx] = Mat.DoorOpen;
      return true;
    }
    if (e.kind === EntKind.Roamer) {
      const bx = nx + dx;
      const by = ny + dy;
      if (bx >= 1 && bx < W - 1 && by >= 1 && by < H - 1 && entPass(w.mat[by * W + bx]) && !occ[by * W + bx] && w.burn[by * W + bx] === 0) {
        occ[e.y * W + e.x] = 0;
        e.x = bx;
        e.y = by;
        occ[e.y * W + e.x] = 1;
        return true;
      }
    }
    return false;
  }
  if (!entPass(m) || occ[ny * W + nx] || w.burn[ny * W + nx] > 0) return false;
  const fromI = e.y * W + e.x;
  occ[fromI] = 0;
  e.x = nx;
  e.y = ny;
  occ[e.y * W + e.x] = 1;
  closeDoorBehind(w, e, fromI);
  return true;
}
function moveToward(w, e, tx, ty, rnd2) {
  const dx = Math.sign(tx - e.x);
  const dy = Math.sign(ty - e.y);
  const firstHorizontal = Math.abs(tx - e.x) > Math.abs(ty - e.y) || dx !== 0 && dy === 0;
  if (firstHorizontal) {
    if (dx !== 0 && tryMove(w, e, dx, 0)) return;
    if (dy !== 0 && tryMove(w, e, 0, dy)) return;
  } else {
    if (dy !== 0 && tryMove(w, e, 0, dy)) return;
    if (dx !== 0 && tryMove(w, e, dx, 0)) return;
  }
  wander(w, e, rnd2);
}
function wander(w, e, rnd2) {
  const start = rnd2() * 4 | 0;
  for (let a = 0; a < 4; a++) {
    const k = start + a & 3;
    if (tryMove(w, e, [1, -1, 0, 0][k], [0, 0, 1, -1][k])) return;
  }
}
function orbit(w, e, tx, ty, rnd2) {
  for (let a = 0; a < 4; a++) {
    const k = rnd2() * 4 | 0;
    const dx = [1, -1, 0, 0][k];
    const dy = [0, 0, 1, -1][k];
    const nd = Math.abs(e.x + dx - tx) + Math.abs(e.y + dy - ty);
    if (nd < 3 || nd > 8) continue;
    if (tryMove(w, e, dx, dy)) return;
  }
}
function splatter(w, e) {
  if (e.departed === true) return;
  const i = e.y * W + e.x;
  const fluid = FACTION[e.kind] === 0 ? Liquid.Ichor : e.kind === EntKind.Breacher || e.kind === EntKind.Scav ? Liquid.Blood : Liquid.None;
  if (fluid !== Liquid.None && (w.liqType[i] === Liquid.None || w.liqType[i] === fluid)) {
    w.liqType[i] = fluid;
    w.liqAmt[i] = Math.min(1.5, w.liqAmt[i] + (e.kind === EntKind.Brood ? 1.2 : 0.5));
  }
  w.stain[i] = Math.min(1.5, w.stain[i] + 1);
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    if (j >= 0 && j < N) w.stain[j] = Math.min(1.5, w.stain[j] + 0.35);
  }
  w.destruction += e.kind === EntKind.Brood ? 6 : 2;
}
function displaceTo(w, ent, r) {
  for (let rad = 1; rad <= r; rad++) {
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const nx = ent.x + dx;
        const ny = ent.y + dy;
        if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
        const j = ny * W + nx;
        if (!entPass(w.mat[j]) || occ[j] || w.burn[j] > 0) continue;
        if (planStepAt(w, j) !== null) continue;
        occ[ent.y * W + ent.x] = 0;
        ent.x = nx;
        ent.y = ny;
        occ[j] = 1;
        ent.path = null;
        return true;
      }
    }
  }
  return false;
}
function tryStepOff(w, e, rnd2) {
  const px2 = e.x;
  const py2 = e.y;
  wander(w, e, rnd2);
  return e.x !== px2 || e.y !== py2;
}
function countKind(w, kind) {
  let n = 0;
  for (const e of w.ents) if (e.kind === kind) n++;
  return n;
}
const bfsPrev = new Int32Array(N);
const bfsSeen = new Uint8Array(N);
const bfsQueue = new Int32Array(N);
function findPath(w, from, to, avoidOcc = false) {
  if (from === to) return [];
  bfsSeen.fill(0);
  let head = 0;
  let tail = 0;
  bfsQueue[tail++] = from;
  bfsSeen[from] = 1;
  bfsPrev[from] = -1;
  while (head < tail) {
    const i = bfsQueue[head++];
    const x = i % W;
    for (let k = 0; k < 4; k++) {
      const j = i + [1, -1, W, -W][k];
      if (j < 0 || j >= N || bfsSeen[j]) continue;
      if (k < 2 && Math.abs(j % W - x) > 1) continue;
      const m = w.mat[j];
      if (!(entPass(m) || m === Mat.DoorClosed) && j !== to) continue;
      if (w.burn[j] > 0 && j !== to) continue;
      if (avoidOcc && occ[j] && j !== to) continue;
      bfsSeen[j] = 1;
      bfsPrev[j] = i;
      if (j === to) {
        const path = [];
        for (let c = to; c !== from; c = bfsPrev[c]) path.push(c);
        path.reverse();
        return path;
      }
      bfsQueue[tail++] = j;
    }
  }
  return null;
}
function moveAlongPath(w, e, gx, gy, rnd2) {
  const goal = gy * W + gx;
  if (!e.path || e.pg !== goal || e.pi >= e.path.length) {
    e.path = findPath(w, e.y * W + e.x, goal);
    e.pi = 0;
    e.pg = goal;
    if (!e.path) {
      e.tx = -1;
      e.pg = -999;
      e.sulk = w.tick + (e.kind === EntKind.Servitor ? 240 : 600);
      if (e.kind === EntKind.Servitor) e.home = goal;
      wander(w, e, rnd2);
      return;
    }
  }
  const next = e.path[e.pi];
  const nx = next % W;
  const ny = next / W | 0;
  if (Math.abs(nx - e.x) + Math.abs(ny - e.y) !== 1) {
    e.path = null;
    return;
  }
  const m = w.mat[next];
  if (m === Mat.DoorClosed) {
    w.mat[next] = Mat.DoorOpen;
    return;
  }
  if (!entPass(m) || w.burn[next] > 0) {
    e.path = null;
    return;
  }
  if (occ[next]) {
    const other = w.ents.find(
      // swap courtesy extends to the whole FACTION: a militor in a
      // servitor file was an unswappable cork that froze entire columns
      (o) => o !== e && o.hp > 0 && o.x === nx && o.y === ny && FACTION[o.kind] === FACTION[e.kind]
    );
    if (other) {
      const otherNext = other.path && other.pi !== void 0 && other.pi < other.path.length ? other.path[other.pi] : -1;
      const headOn = otherNext === e.y * W + e.x;
      const fighter = other.kind === EntKind.Breacher || other.kind === EntKind.Militor;
      const idle = fighter ? otherNext === -1 && other.timer <= w.tick : other.tx === void 0 || other.tx < 0;
      if (headOn || idle) {
        const ox = e.x;
        const oy = e.y;
        e.x = nx;
        e.y = ny;
        other.x = ox;
        other.y = oy;
        other.path = null;
        e.pi++;
        return;
      }
      if (rnd2() < 0.12) {
        e.path = null;
        e.tx = -1;
      }
      return;
    }
    if (rnd2() < 0.3) {
      const detour = findPath(w, e.y * W + e.x, goal, true);
      if (detour) {
        e.path = detour;
        e.pi = 0;
        return;
      }
    }
    const r = rnd2();
    if (r < 0.3) {
      e.path = null;
      wander(w, e, rnd2);
    } else if (r < 0.42) {
      e.path = null;
      e.tx = -1;
    }
    return;
  }
  {
    const fromI = e.y * W + e.x;
    occ[fromI] = 0;
    e.x = nx;
    e.y = ny;
    occ[e.y * W + e.x] = 1;
    closeDoorBehind(w, e, fromI);
  }
  e.pi++;
}
const unitReach = new Uint8Array(N);
const unitReachQ = new Int32Array(N);
function floodFromUnit(w, e) {
  unitReach.fill(0);
  let head = 0;
  let tail = 0;
  const start = e.y * W + e.x;
  unitReach[start] = 1;
  unitReachQ[tail++] = start;
  while (head < tail) {
    const i = unitReachQ[head++];
    const x = i % W;
    for (let k = 0; k < 4; k++) {
      const j = i + [1, -1, W, -W][k];
      if (j < 0 || j >= N || unitReach[j]) continue;
      if (k < 2 && Math.abs(j % W - x) > 1) continue;
      if (!(entPass(w.mat[j]) || w.mat[j] === Mat.DoorClosed)) continue;
      unitReach[j] = 1;
      unitReachQ[tail++] = j;
    }
  }
}
function floodFromReactor(w) {
  if (!w.reactorAlive || w.reactorCells.length === 0) return false;
  bfsSeen.fill(0);
  let head = 0;
  let tail = 0;
  for (const c of w.reactorCells) {
    for (const j of [c - 1, c + 1, c - W, c + W]) {
      if (j >= 0 && j < N && (entPass(w.mat[j]) || w.mat[j] === Mat.DoorClosed) && !bfsSeen[j]) {
        bfsSeen[j] = 1;
        bfsQueue[tail++] = j;
      }
    }
  }
  while (head < tail) {
    const i = bfsQueue[head++];
    const x = i % W;
    for (let k = 0; k < 4; k++) {
      const j = i + [1, -1, W, -W][k];
      if (j < 0 || j >= N || bfsSeen[j]) continue;
      if (k < 2 && Math.abs(j % W - x) > 1) continue;
      if (!(entPass(w.mat[j]) || w.mat[j] === Mat.DoorClosed)) continue;
      bfsSeen[j] = 1;
      bfsQueue[tail++] = j;
    }
  }
  return true;
}
function adjacentSpace(w, i) {
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    if (j >= 0 && j < N && w.mat[j] === Mat.Space) return j;
  }
  return -1;
}
function resetKernel() {
  occ.fill(0);
}
const ROAMER_CAP = TUNE.roamerCap;
function spawnBrood(w, x, y, lin) {
  for (let dy = -1; dy <= 2; dy++)
    for (let dx = -1; dx <= 2; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 1 || cx >= W - 1 || cy < 1 || cy >= H - 1) return false;
      const i = cy * W + cx;
      if (!entPass(w.mat[i])) return false;
      const inBody = dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1;
      if (inBody && occ[i]) return false;
    }
  for (const o of w.ents) {
    if (o.kind !== EntKind.Brood || o.hp <= 0) continue;
    if (Math.abs(o.x - x) <= 2 && Math.abs(o.y - y) <= 2) return false;
  }
  const brood = {
    kind: EntKind.Brood,
    x,
    y,
    hp: 100,
    cd: 0,
    timer: 8,
    flash: -99,
    lin: lin ?? w.nextLineage++
  };
  w.ents.push(brood);
  markOcc(brood, 1);
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) grow(w, x + dx, y + dy);
  return true;
}
function dynastyIncubation(lin) {
  if (lin === void 0) return 18;
  const hsh = (Math.imul(lin, 2654435761) >>> 0) % 6;
  return 12 + hsh * 20;
}
function spawnEgg(w, x, y, hatchSteps, royal = false, lin) {
  w.ents.push({
    kind: EntKind.Egg,
    x,
    y,
    hp: royal ? 3 : 1,
    cd: 0,
    timer: hatchSteps,
    flash: -99,
    cls: royal ? 1 : 0,
    lin,
    fed: w.tick
    // lay time: no instant-hatch factories
  });
}
function alarmHive(w, bx, by) {
  for (const o of w.ents) {
    if (o.kind !== EntKind.Egg || o.hp <= 0) continue;
    if (Math.abs(o.x - bx) + Math.abs(o.y - by) > 20) continue;
    o.timer = 0;
    o.cd = 1;
  }
}
function spawnRoamer(w, x, y, lin) {
  w.ents.push({ kind: EntKind.Roamer, x, y, hp: 4, cd: 0, timer: 0, flash: -99, lin });
  occ[y * W + x] = 1;
}
function grow(w, x, y) {
  if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return;
  const i = y * W + x;
  const m = w.mat[i];
  if (m === Mat.Floor || m === Mat.Rubble || m === Mat.Lattice || m === Mat.DoorOpen) {
    w.mat[i] = Mat.Growth;
    w.solidFuel[i] = 0;
  }
}
function nearGrowth(w, x, y) {
  const i = y * W + x;
  return w.mat[i - 1] === Mat.Growth || w.mat[i + 1] === Mat.Growth || w.mat[i - W] === Mat.Growth || w.mat[i + W] === Mat.Growth;
}
function stepBrood(w, e, rnd2) {
  let clutch = 0;
  for (const o of w.ents) {
    if (o.kind === EntKind.Egg && Math.abs(o.x - e.x) <= 4 && Math.abs(o.y - e.y) <= 4) clutch++;
  }
  if ((e.bored ?? 0) >= 2) e.pg = w.tick + 3e3;
  const crowded = clutch >= 6 || (e.bored ?? 0) >= 2 || (e.pg ?? 0) > w.tick;
  const sprawl = crowded ? 10 : 5;
  const secretions = crowded ? 14 : 3;
  for (let a = 0; a < secretions; a++) {
    const gx = e.x + (rnd2() * (2 * sprawl + 1) | 0) - sprawl;
    const gy = e.y + (rnd2() * (2 * sprawl + 1) | 0) - sprawl;
    if (gx < 1 || gx >= W - 1 || gy < 1 || gy >= H - 1) continue;
    const gm = w.mat[gy * W + gx];
    if ((gm === Mat.Floor || gm === Mat.Rubble || gm === Mat.Lattice) && nearGrowth(w, gx, gy)) {
      grow(w, gx, gy);
    }
  }
  let laid = false;
  if (--e.timer <= 0) {
    {
      const reach = crowded ? 9 : 3;
      for (let a = 0; a < 6; a++) {
        const gx = e.x + (rnd2() * (2 * reach + 1) | 0) - reach;
        const gy = e.y + (rnd2() * (2 * reach + 1) | 0) - reach;
        if (gx < 1 || gx >= W - 1 || gy < 1 || gy >= H - 1) continue;
        if (w.mat[gy * W + gx] !== Mat.Growth) continue;
        let ringOk = true;
        for (let ry = -1; ry <= 1 && ringOk; ry++)
          for (let rx = -1; rx <= 1; rx++) {
            const j = (gy + ry) * W + gx + rx;
            if (!entPass(w.mat[j])) {
              ringOk = false;
              break;
            }
          }
        if (!ringOk) continue;
        if (w.ents.some(
          (o) => o.kind === EntKind.Egg && Math.abs(o.x - gx) <= 1 && Math.abs(o.y - gy) <= 1
        )) continue;
        const royal = rnd2() < TUNE.royalChance && isDark(w, gy * W + gx);
        const incub = dynastyIncubation(e.lin);
        spawnEgg(w, gx, gy, royal ? 90 + (rnd2() * 60 | 0) : incub + (rnd2() * 8 | 0), royal, e.lin);
        e.flash = w.tick;
        laid = true;
        break;
      }
    }
    e.timer = 9 + (rnd2() * 10 | 0);
    if (laid) e.bored = 0;
    else e.bored = (e.bored ?? 0) + 1;
  }
}
function stepRoamer(w, e, rnd2) {
  if (e.fed === void 0) e.fed = w.tick;
  if (e.lin === void 0) {
    const mother = nearestEnt(w, e, (o) => o.kind === EntKind.Brood, 40);
    if (mother) e.lin = mother.e.lin;
  }
  const hunger = w.tick - e.fed;
  const ci0 = e.y * W + e.x;
  if (w.liqType[ci0] === Liquid.Ichor && w.liqAmt[ci0] > 0.15) {
    w.liqAmt[ci0] = Math.max(0, w.liqAmt[ci0] - 0.4);
    if (w.liqAmt[ci0] <= 0.01) w.liqType[ci0] = Liquid.None;
    e.fed = w.tick;
  } else if (w.mat[ci0] === Mat.Growth && rnd2() < 0.05) {
    e.fed = Math.min(w.tick - 2500, e.fed + TUNE.grazeTopUp);
  }
  if (hunger > TUNE.hungerStarve) {
    e.hp -= 1;
    e.flash = w.tick;
    if (e.hp <= 0) return;
  }
  if (rnd2() < 15e-4 && countKind(w, EntKind.Brood) === 0) {
    markOcc(e, 0);
    if (spawnBrood(w, e.x, e.y, e.lin)) {
      e.hp = 0;
      e.departed = true;
      return;
    }
    markOcc(e, 1);
  }
  const prey = nearestEnt(w, e, isWarmBody, 12);
  if (prey) {
    e.tx = prey.e.x;
    e.ty = prey.e.y;
    e.pg = w.tick;
  } else if (!(e.pg && e.pg > 0 && w.tick - e.pg < 300)) {
    for (const o of w.ents) {
      if (o.kind !== EntKind.Roamer || o === e) continue;
      if (Math.abs(o.x - e.x) + Math.abs(o.y - e.y) > 10) continue;
      if (o.pg && o.pg > 0 && w.tick - o.pg < 250) {
        e.tx = o.tx;
        e.ty = o.ty;
        e.pg = o.pg;
        break;
      }
    }
  }
  const fresh = e.pg !== void 0 && e.pg > 0 && w.tick - e.pg < 300 && e.tx !== void 0 && e.tx >= 0;
  if (fresh) {
    if (prey && prey.d <= 1) {
      prey.e.hp -= 2;
      e.flash = w.tick;
      prey.e.flash = w.tick;
      e.rage = true;
      e.fed = w.tick;
      return;
    }
    let pack2 = 0;
    for (const o of w.ents) {
      if (o.kind === EntKind.Roamer && Math.abs(o.x - e.x) + Math.abs(o.y - e.y) <= 6) pack2++;
    }
    const committed = e.rage === true || e.hp < 2 || pack2 >= 2 || hunger > TUNE.hungerBold || prey !== null && prey.e.kind === EntKind.Scav;
    if (!committed && prey && prey.d <= 7) {
      if (!e.timer || e.timer < w.tick - 4e3) e.timer = w.tick + 150;
      if (w.tick >= e.timer) {
        e.rage = true;
      } else {
        orbit(w, e, prey.e.x, prey.e.y, rnd2);
        return;
      }
    }
    moveToward(w, e, e.tx, e.ty, rnd2);
    if (!prey && Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) <= 1) {
      e.pg = 0;
      e.rage = false;
      e.timer = 0;
    }
  } else {
    e.rage = false;
    e.timer = 0;
    let press = 0;
    for (const j of [ci0 - 1, ci0 + 1, ci0 - W, ci0 + W, ci0 - W - 1, ci0 - W + 1, ci0 + W - 1, ci0 + W + 1]) {
      if (j >= 0 && j < N && occ[j]) press++;
    }
    if (press >= 5 && rnd2() < 0.3) {
      for (let a = 0; a < 20; a++) {
        const x = 2 + (rnd2() * (W - 4) | 0);
        const y = 2 + (rnd2() * (H - 4) | 0);
        if (!entPass(w.mat[y * W + x])) continue;
        e.tx = x;
        e.ty = y;
        e.pg = w.tick;
        return;
      }
    }
    const rc = w.reactorCells.length ? w.reactorCells[0] : -1;
    if (hunger > TUNE.hungerBold && rc >= 0 && rnd2() < 0.5) {
      moveToward(w, e, rc % W, rc / W | 0, rnd2);
    } else if (w.mat[e.y * W + e.x] !== Mat.Growth || rnd2() < 0.6) {
      wander(w, e, rnd2);
    }
  }
  const ci = e.y * W + e.x;
  if (w.pipe[ci] !== 0 && !w.pipeBroken[ci] && rnd2() < 0.04) {
    w.breakPipe(ci);
    e.flash = w.tick;
    e.fed = w.tick;
    if (rnd2() < 0.15) w.temp[ci] = Math.min(1500, w.temp[ci] + 460);
  }
}
const isPrey = (o) => FACTION[o.kind] === 0 || FACTION[o.kind] === 6;
function spawnReaver(w, x, y, brain) {
  w.ents.push({ kind: EntKind.Reaver, x, y, hp: 280, cd: 0, timer: 0, flash: -99, brain });
  occ[y * W + x] = 1;
}
function stepReaver(w, e, rnd2) {
  const prey = nearestEnt(w, e, (o) => o.kind === EntKind.Ashen, 40) ?? nearestEnt(w, e, isPrey, 24);
  if (!prey) {
    if (countKind(w, EntKind.Roamer) >= 10) {
      let far = null;
      let fd = Infinity;
      for (const o of w.ents) {
        if (!isPrey(o) || o.hp <= 0) continue;
        const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y);
        if (d < fd) {
          fd = d;
          far = o;
        }
      }
      if (far) {
        moveAlongPath(w, e, far.x, far.y, rnd2);
        return;
      }
    }
    if (countKind(w, EntKind.Roamer) < 10) {
      if (w.reactorCells.length) {
        const rc = w.reactorCells[0];
        const rx = rc % W;
        const ry = rc / W | 0;
        if (Math.abs(e.x - rx) + Math.abs(e.y - ry) <= 3) {
          w.pushNews("the hunt is done — the vault seals");
          e.hp = 0;
          e.departed = true;
          return;
        }
        moveAlongPath(w, e, rx, ry, rnd2);
        return;
      }
      if (rnd2() < 0.02) {
        e.hp = 0;
        e.departed = true;
        return;
      }
    }
    if (rnd2() < 0.5) wander(w, e, rnd2);
    return;
  }
  if (w.tick >= (e.workT ?? 0)) {
    let fired = 0;
    for (const o of w.ents) {
      if (fired >= 2) break;
      if (!isPrey(o) || o.hp <= 0) continue;
      const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y);
      if (d < 2 || d > 3) continue;
      fireGout(w, e.x, e.y, o.x, o.y, rnd2, isPrey, 3);
      fired++;
    }
    if (fired > 0) {
      e.flash = w.tick;
      e.workT = w.tick + 18;
    }
  }
  let swung = false;
  if (w.tick >= e.timer) {
    for (const o of w.ents) {
      if (!isPrey(o) || o.hp <= 0) continue;
      if (Math.abs(o.x - e.x) + Math.abs(o.y - e.y) <= 1) {
        if (FACTION[o.kind] === 6) {
          spectralHit(w, o, 6, rnd2);
        } else {
          o.hp -= 6;
        }
        o.flash = w.tick;
        if (o.kind === EntKind.Brood) alarmHive(w, o.x, o.y);
        if (o.hp <= 0) splatter(w, o);
        swung = true;
      }
    }
    if (swung) {
      e.flash = w.tick;
      e.timer = w.tick + 10;
    }
  }
  if (swung) {
    let packX = 0;
    let packY = 0;
    let packN = 0;
    for (const o of w.ents) {
      if (!isPrey(o) || o.hp <= 0) continue;
      if (Math.abs(o.x - e.x) + Math.abs(o.y - e.y) <= 2) {
        packX += o.x;
        packY += o.y;
        packN++;
      }
    }
    if (packN >= 3) {
      moveToward(w, e, e.x * 2 - Math.round(packX / packN), e.y * 2 - Math.round(packY / packN), rnd2);
    }
    return;
  }
  if (prey.d > 1) moveAlongPath(w, e, prey.e.x, prey.e.y, rnd2);
}
function reaverPulse(w, rnd2) {
  if (w.tick % 900 !== 0) return;
  if (!w.reactorAlive || !w.reactorCells.length) return;
  const roamers = countKind(w, EntKind.Roamer);
  const reavers = countKind(w, EntKind.Reaver);
  if (roamers >= 50 && reavers === 0 && rnd2() < 0.6) {
    for (const j of w.periReactor) {
      if (j >= 0 && j < N && entPass(w.mat[j]) && !occ[j]) {
        w.pushNews("THE VAULT OPENS — a reaver walks");
        spawnReaver(w, j % W, j / W | 0, w.brainId);
        return;
      }
    }
  }
}
const SCAR = 0.15;
function spawnHaunt(w, x, y) {
  w.ents.push({ kind: EntKind.Haunt, x, y, hp: 5, cd: 0, timer: 0, flash: -99, tx: -1, ty: -1, path: null, pi: 0, pg: -1 });
  occ[y * W + x] = 1;
}
function spawnGhast(w, x, y) {
  w.ents.push({ kind: EntKind.Ghast, x, y, hp: 8, cd: 0, timer: 0, flash: -99, tx: -1, ty: -1, path: null, pi: 0, pg: -1 });
  occ[y * W + x] = 1;
}
function grounded(w, x, y) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = ny * W + nx;
      if (w.mat[j] === Mat.Machine && w.machine[j] === Machine.Light) return true;
    }
  return false;
}
function spectralHit(w, t, dmg, rnd2) {
  t.flash = w.tick;
  if (grounded(w, t.x, t.y)) {
    t.hp -= dmg;
    return;
  }
  const phase = t.kind === EntKind.Ashen ? 0.95 : 0.9;
  if (rnd2() < phase) return;
  t.hp -= t.kind === EntKind.Haunt ? 1 : dmg;
}
function ectoSplat(w, x, y) {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const j = (y + dy) * W + x + dx;
    if (j >= 0 && j < N && w.mat[j] !== Mat.Space) w.ecto[j] = Math.min(1, w.ecto[j] + (dx === 0 && dy === 0 ? 0.8 : 0.35));
  }
}
const isLiving = (o) => !isDrowned(o) && o.kind !== EntKind.Egg;
function stepHaunt(w, e, rnd2) {
  const prey = nearestEnt(w, e, isLiving, 1);
  if (prey && w.tick >= e.timer) {
    e.timer = w.tick + 40;
    e.flash = w.tick;
    if (rnd2() < 0.33) {
      prey.e.hp -= 1;
      prey.e.flash = w.tick;
    }
    return;
  }
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const j = (e.y + dy) * W + e.x + dx;
      if (j < 0 || j >= N) continue;
      if (w.mat[j] !== Mat.Machine || w.machine[j] !== Machine.Light) continue;
      if (w.lightLevel[j] <= 0.05 && (w.lampDim.get(j) ?? 0) <= 0) continue;
      const v = (w.lampDim.get(j) ?? 0) + 10 / 90;
      e.flash = w.tick;
      if (v >= 1) {
        w.lampDim.delete(j);
        snuffOut(w, j);
      } else {
        w.lampDim.set(j, v);
        w.networksDirty = true;
      }
      return;
    }
  {
    let lamp = -1;
    let ld = Infinity;
    for (let dy = -8; dy <= 8; dy++)
      for (let dx = -8; dx <= 8; dx++) {
        const j = (e.y + dy) * W + e.x + dx;
        if (j < 0 || j >= N) continue;
        if (w.mat[j] !== Mat.Machine || w.machine[j] !== Machine.Light) continue;
        if (w.lightLevel[j] <= 0.05) continue;
        const dd = Math.abs(dx) + Math.abs(dy);
        if (dd < ld) {
          ld = dd;
          lamp = j;
        }
      }
    if (lamp >= 0) {
      for (const off2 of [1, -1, W, -W]) {
        const nb = lamp + off2;
        if (nb >= 0 && nb < N && entPass(w.mat[nb])) {
          moveAlongPath(w, e, nb % W, nb / W | 0, rnd2);
          return;
        }
      }
    }
  }
  const here = e.y * W + e.x;
  const arrived = e.tx !== void 0 && e.tx >= 0 && Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) <= 1;
  if (e.tx === void 0 || e.tx < 0 || arrived || w.stain[e.ty * W + e.tx] < SCAR) {
    let best = -1;
    for (let a = 0; a < 30; a++) {
      const dx = (rnd2() * 11 | 0) - 5;
      const dy = (rnd2() * 11 | 0) - 5;
      if (Math.abs(dx) + Math.abs(dy) < 2) continue;
      const nx = e.x + dx;
      const ny = e.y + dy;
      if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
      const i = ny * W + nx;
      if (w.stain[i] < SCAR || !entPass(w.mat[i])) continue;
      best = i;
      break;
    }
    if (best >= 0 && best !== here) {
      e.tx = best % W;
      e.ty = best / W | 0;
    } else {
      if (rnd2() < 0.3) wander(w, e, rnd2);
      return;
    }
  }
  moveAlongPath(w, e, e.tx, e.ty, rnd2);
}
function snuffOut(w, lamp, rnd2) {
  const cx = lamp % W;
  const cy = lamp / W | 0;
  w.mat[lamp] = Mat.Floor;
  w.machine[lamp] = 0;
  w.networksDirty = true;
  w.destruction += 1;
  w.pushNews("a lamp is drunk to NOTHING — the dark takes the room back");
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > 2) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
      if (!hasLOS(w, cx, cy, nx, ny)) continue;
      const j = ny * W + nx;
      if (w.mat[j] !== Mat.Space) w.bursts.push({ i: j, amp: 1 - dd / 2.4, t: w.tick });
    }
  for (const o of w.ents) {
    if (o.hp <= 0 || isDrowned(o)) continue;
    const dd = Math.abs(o.x - cx) + Math.abs(o.y - cy);
    if (dd > 2 || !hasLOS(w, cx, cy, o.x, o.y)) continue;
    o.hp -= Math.round(5 * Math.max(0, 1 - dd / 2.5));
    o.flash = w.tick;
  }
}
function lampRecovery(w) {
  if (w.lampDim.size === 0 || w.tick % 3 !== 0) return;
  for (const [cell, v] of w.lampDim) {
    if (w.mat[cell] !== Mat.Machine || w.machine[cell] !== Machine.Light) {
      w.lampDim.delete(cell);
      continue;
    }
    const cx = cell % W;
    const cy = cell / W | 0;
    let held = false;
    for (const o of w.ents) {
      if (o.hp <= 0 || o.kind !== EntKind.Haunt) continue;
      if (Math.abs(o.x - cx) <= 1 && Math.abs(o.y - cy) <= 1) {
        held = true;
        break;
      }
    }
    if (held) continue;
    const nv = v - 3 / 45;
    if (nv <= 0) w.lampDim.delete(cell);
    else w.lampDim.set(cell, nv);
    w.networksDirty = true;
  }
}
function stepGhast(w, e, rnd2) {
  if (e.bored && w.tick < e.bored) return;
  if (e.bored && w.tick >= e.bored) {
    finishAshen(w, e);
    return;
  }
  const here = e.y * W + e.x;
  if (w.ecto[here] > 0.45 && countKind(w, EntKind.Ashen) === 0) {
    beginRite(w, e);
    return;
  }
  const intruder = nearestEnt(w, e, (o) => isLiving(o) && w.stain[o.y * W + o.x] >= SCAR, 9);
  if (intruder) {
    if (intruder.d <= 1) {
      if (w.tick >= e.timer) {
        e.timer = w.tick + 18;
        e.flash = w.tick;
        intruder.e.hp -= 3;
        intruder.e.flash = w.tick;
      }
      return;
    }
    scarStep(w, e, intruder.e.x, intruder.e.y);
    return;
  }
  if (rnd2() < 0.5) scarStep(w, e, e.x + (rnd2() * 7 | 0) - 3, e.y + (rnd2() * 7 | 0) - 3);
}
function scarStep(w, e, gx, gy, rnd2) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dirs.sort((a, b) => Math.abs(gx - (e.x + a[0])) + Math.abs(gy - (e.y + a[1])) - (Math.abs(gx - (e.x + b[0])) + Math.abs(gy - (e.y + b[1]))));
  for (const [dx, dy] of dirs) {
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
    const j = ny * W + nx;
    if (w.stain[j] < SCAR) continue;
    if (!entPass(w.mat[j]) || occ[j]) continue;
    occ[e.y * W + e.x] = 0;
    e.x = nx;
    e.y = ny;
    occ[j] = 1;
    return;
  }
}
function beginRite(w, e) {
  e.bored = w.tick + 60;
  w.rites.push({ x: e.x, y: e.y, t: w.tick });
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const j = (e.y + dy) * W + e.x + dx;
      if (j >= 0 && j < N) w.ecto[j] = 0;
    }
  w.pushNews("the scar begins to KNIT — blood remembers a shape");
}
function finishAshen(w, e) {
  e.kind = EntKind.Ashen;
  e.hp = 20;
  e.bored = 0;
  e.burstT = w.tick + 90;
  w.pushNews("the shape stands — an ASHEN keeps the tomb now");
  if (w.reactorAlive && countKind(w, EntKind.Reaver) === 0) {
    const p = w.periReactor.find((i) => entPass(w.mat[i]) && !occ[i]);
    if (p !== void 0) {
      spawnReaver(w, p % W, p / W | 0, w.brainId);
      w.pushNews(`the vault answers — ${brainName(w.brainId)} looses its REAVER`);
    }
  }
}
function hauntNear(w, x, y) {
  let best = null;
  let bd = Infinity;
  for (const o of w.ents) {
    if (o.hp <= 0 || o.kind !== EntKind.Haunt) continue;
    const dd = Math.abs(o.x - x) + Math.abs(o.y - y);
    if (dd <= 3 && dd < bd) {
      bd = dd;
      best = o;
    }
  }
  return best;
}
function burstReachesLiving(w, h) {
  for (const o of w.ents) {
    if (o.hp <= 0 || isDrowned(o) || o.kind === EntKind.Egg) continue;
    const dd = Math.abs(o.x - h.x) + Math.abs(o.y - h.y);
    if (dd <= 5 && hasLOS(w, h.x, h.y, o.x, o.y)) return true;
  }
  return false;
}
function stepAshen(w, e, rnd2) {
  if ((e.bored ?? 0) > 0) {
    const h = hauntNear(w, e.tx ?? e.x, e.ty ?? e.y);
    if (!h || !hasLOS(w, e.x, e.y, h.x, h.y)) {
      e.bored = 0;
      e.burstT = w.tick + 45;
    } else if (w.tick >= e.bored) {
      e.bored = 0;
      e.burstT = w.tick + 150;
      darkburst(w, h);
      return;
    } else {
      e.tx = h.x;
      e.ty = h.y;
      w.shots.push({ x0: e.x, y0: e.y, x1: h.x, y1: h.y, t: w.tick, k: 3 });
      return;
    }
  }
  if ((e.burstT ?? 0) <= w.tick) {
    const h = nearestEnt(w, e, (o) => o.kind === EntKind.Haunt, 12);
    if (h && hasLOS(w, e.x, e.y, h.e.x, h.e.y) && burstReachesLiving(w, h.e)) {
      e.bored = w.tick + 45;
      e.tx = h.e.x;
      e.ty = h.e.y;
      return;
    }
  }
  const prey = nearestEnt(w, e, isLiving, 20);
  if (prey) {
    if (prey.d <= 1) {
      if (w.tick >= e.timer) {
        e.timer = w.tick + 12;
        e.flash = w.tick;
        prey.e.hp -= 10;
        prey.e.flash = w.tick;
        if (prey.e.hp <= 0) {
          prey.e.departed = true;
          spawnHauntNear(w, prey.e.x, prey.e.y);
        }
      }
      return;
    }
    duskStep(w, e, prey.e.x, prey.e.y);
    return;
  }
  if (rnd2() < 0.4) duskStep(w, e, e.x + (rnd2() * 9 | 0) - 4, e.y + (rnd2() * 9 | 0) - 4);
}
function spawnHauntNear(w, x, y) {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
    if (!entPass(w.mat[ny * W + nx]) || occ[ny * W + nx]) continue;
    spawnHaunt(w, nx, ny);
    return;
  }
}
function duskStep(w, e, gx, gy, rnd2) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dirs.sort((a, b) => Math.abs(gx - (e.x + a[0])) + Math.abs(gy - (e.y + a[1])) - (Math.abs(gx - (e.x + b[0])) + Math.abs(gy - (e.y + b[1]))));
  for (const [dx, dy] of dirs) {
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
    const j = ny * W + nx;
    if (!entPass(w.mat[j]) || occ[j]) continue;
    if (grounded(w, nx, ny)) continue;
    occ[e.y * W + e.x] = 0;
    e.x = nx;
    e.y = ny;
    occ[j] = 1;
    return;
  }
}
function darkburst(w, haunt, rnd2) {
  const cx = haunt.x;
  const cy = haunt.y;
  haunt.hp = 0;
  w.pushNews("DARKBURST — the tomb speaks in blue fire");
  for (let dy = -5; dy <= 5; dy++)
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
      if (!hasLOS(w, cx, cy, nx, ny)) continue;
      const j = ny * W + nx;
      if (w.mat[j] !== Mat.Space) w.bursts.push({ i: j, amp: 1 - d / 5.5, t: w.tick });
      if (w.mat[j] === Mat.Machine && w.machine[j] === Machine.Light) {
        w.mat[j] = Mat.Floor;
        w.machine[j] = 0;
        w.networksDirty = true;
        w.destruction += 1;
      }
    }
  for (const o of w.ents) {
    if (o.hp <= 0 || isDrowned(o)) continue;
    const d = Math.abs(o.x - cx) + Math.abs(o.y - cy);
    if (d > 5 || !hasLOS(w, cx, cy, o.x, o.y)) continue;
    o.hp -= Math.round(20 * Math.max(0, 1 - d / 5.5));
    o.flash = w.tick;
  }
}
function drownedPulse(w, rnd2) {
  if (w.calmTicks < -1e8) return;
  if (w.tick % 600 === 300) {
    if (countKind(w, EntKind.Haunt) < 4) {
      for (let a = 0; a < 60; a++) {
        const i = rnd2() * N | 0;
        if (w.stain[i] < 0.3 || !entPass(w.mat[i]) || occ[i]) continue;
        if (rnd2() < 0.25) {
          spawnHaunt(w, i % W, i / W | 0);
          w.pushNews("something remembers dying here — a HAUNT drifts the deck");
        }
        break;
      }
    }
  }
  if (w.tick % 900 === 450 && countKind(w, EntKind.Ghast) < 2) {
    let start = -1;
    for (let a = 0; a < 25 && start < 0; a++) {
      const i = rnd2() * N | 0;
      if (w.stain[i] >= SCAR && entPass(w.mat[i]) && !occ[i]) start = i;
    }
    if (start < 0) return;
    const seen = /* @__PURE__ */ new Set([start]);
    const q = [start];
    for (let qi = 0; qi < q.length && seen.size <= 80; qi++) {
      for (const j of [q[qi] - 1, q[qi] + 1, q[qi] - W, q[qi] + W]) {
        if (j < 0 || j >= N || seen.has(j) || w.stain[j] < SCAR) continue;
        seen.add(j);
        q.push(j);
      }
    }
    if (seen.size >= 55) {
      spawnGhast(w, start % W, start / W | 0);
      w.rites.push({ x: start % W, y: start / W | 0, t: w.tick });
      w.pushNews("the scar opens its eyes — a GHAST keeps the ground");
    }
  }
}
function spawnBreacher(w, x, y, cls = 0) {
  w.ents.push({
    kind: EntKind.Breacher,
    x,
    y,
    hp: 10,
    cd: 0,
    timer: 0,
    flash: -99,
    tx: -1,
    ty: -1,
    path: null,
    pi: 0,
    pg: -1,
    cls
  });
  occ[y * W + x] = 1;
}
function podLandingSite(w, rnd2) {
  if (w.hullCells.length) return w.hullCells[rnd2() * w.hullCells.length | 0];
  for (let tries = 0; tries < 200; tries++) {
    const i = rnd2() * N | 0;
    if (w.mat[i] !== Mat.Space) return i;
  }
  return -1;
}
function requestPod(w, x, y, count = 4) {
  let best = -1;
  let bestD = Infinity;
  for (const i of w.hullCells) {
    if (w.mat[i] !== Mat.Hull) continue;
    const hx2 = i % W;
    const hy2 = i / W | 0;
    const d = (hx2 - x) * (hx2 - x) + (hy2 - y) * (hy2 - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (best < 0) {
    for (let r = 0; r < 14 && best < 0; r++) {
      for (let dy = -r; dy <= r && best < 0; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cx = x + dx;
          const cy = y + dy;
          if (cx < 1 || cx >= W - 1 || cy < 1 || cy >= H - 1) continue;
          const i = cy * W + cx;
          if (w.mat[i] !== Mat.Space) {
            best = i;
            break;
          }
        }
    }
  }
  if (best < 0) return;
  const hx = best % W;
  const hy = best / W | 0;
  w.explosions.push({ x: hx, y: hy, r: 3, power: 700 });
  w.pendingPods.push({ x: hx, y: hy, count, at: w.tick + 6 });
}
const POD_ROSTER = [2, 0, 0, 1];
function disembark(w, x, y, count) {
  w.pushNews(`a pod slams home — ${count} marines aboard`);
  const squad = w.nextSquadId++;
  let n = 0;
  placeAround(w, x, y, count, (nx, ny) => {
    spawnBreacher(w, nx, ny, POD_ROSTER[n++ % 4]);
    w.ents[w.ents.length - 1].team = squad;
  });
}
function fireGout(w, sx, sy, tx, ty, rnd2, hits, dmg = 3) {
  w.shots.push({ x0: sx, y0: sy, x1: tx, y1: ty, t: w.tick, k: 1 });
  const steps = Math.max(Math.abs(tx - sx), Math.abs(ty - sy));
  for (let s = 1; s <= steps; s++) {
    const x = sx + Math.round((tx - sx) * s / steps);
    const y = sy + Math.round((ty - sy) * s / steps);
    const i = y * W + x;
    if (i < 0 || i >= N) break;
    const mm2 = w.mat[i];
    if (mm2 === Mat.Wall || mm2 === Mat.Hull || mm2 === Mat.DoorClosed || mm2 === Mat.Machine || mm2 === Mat.Tree) {
      w.temp[i] = Math.min(1500, w.temp[i] + 120);
      break;
    }
    if (mm2 === Mat.Space) continue;
    w.temp[i] = Math.min(1500, w.temp[i] + (s === steps ? 250 : 200));
    if (w.mat[i] === Mat.Lattice && rnd2() < 0.4) w.burn[i] = 1;
    for (const j of [i, i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= N) continue;
      if ((w.mat[j] === Mat.Vine || w.mat[j] === Mat.Tree) && w.burn[j] === 0 && rnd2() < 0.55) {
        w.burn[j] = 1;
        if (w.mat[j] === Mat.Tree) w.solidFuel[j] = Math.max(w.solidFuel[j], 1.2);
      }
    }
    for (const o of w.ents) {
      if (o.hp <= 0 || o.x !== x || o.y !== y || !hits(o)) continue;
      if (isDrowned(o)) spectralHit(w, o, dmg, rnd2);
      else {
        o.hp -= dmg;
        o.flash = w.tick;
      }
      if (o.kind === EntKind.Brood) alarmHive(w, o.x, o.y);
    }
  }
}
function stepBreacher(w, e, rnd2) {
  if (e.tx === void 0) {
    e.tx = -1;
    e.ty = -1;
    e.path = null;
    e.pi = 0;
    e.pg = -1;
  }
  if (e.cls === void 0) e.cls = 0;
  if (e.cls === 2) {
    for (const o of w.ents) {
      if (o === e) break;
      if (o.kind === EntKind.Breacher && o.cls === 2 && o.hp > 0 && (e.team === void 0 || o.team === void 0 || o.team === e.team) && Math.abs(o.x - e.x) + Math.abs(o.y - e.y) <= 6) {
        e.cls = 0;
        e.flash = w.tick;
        if (o.team !== void 0) e.team = o.team;
        break;
      }
    }
  }
  const cls = e.cls;
  const posB = e.y * W + e.x;
  if (e.satPos !== posB) {
    e.satPos = posB;
    e.sat = w.tick;
  }
  let target = nearestEnt(w, e, (o) => isMarineTarget(o) && o.kind !== EntKind.Brood, 7);
  if (!target) target = nearestEnt(w, e, isMarineTarget, 16);
  const range2 = cls === 1 ? 2 : 7;
  if (target && target.d <= range2 && (target.d <= 1 || hasLOS(w, e.x, e.y, target.e.x, target.e.y))) {
    e.path = null;
    if (w.tick >= e.timer) {
      const braced = cls === 0 && w.tick - (e.sat ?? w.tick) > 30;
      e.timer = w.tick + (cls === 1 ? 20 : cls === 2 ? 17 : braced ? 7 : 14);
      e.flash = w.tick;
      if (cls === 1) {
        fireGout(w, e.x, e.y, target.e.x, target.e.y, rnd2, isMarineTarget, 3);
      } else {
        const roll = rnd2();
        const rounds = roll < 0.08 ? 1 : roll < 0.3 ? 2 : roll < 0.7 ? 3 : roll < 0.92 ? 4 : 5;
        for (let b = 0; b < rounds; b++) {
          const jx = b === 0 ? 0 : (rnd2() * 3 | 0) - 1;
          const jy = b === 0 ? 0 : (rnd2() * 3 | 0) - 1;
          w.shots.push({ x0: e.x, y0: e.y, x1: target.e.x + jx, y1: target.e.y + jy, t: w.tick + b * 3, k: 0 });
        }
        let acc = cls === 2 ? 0.5 : 0.55;
        if (target.d <= 3) acc = 0.68;
        else if (target.e.kind === EntKind.Roamer && isDark(w, target.e.y * W + target.e.x)) acc *= 0.8;
        if (rnd2() < acc) {
          if (isDrowned(target.e)) spectralHit(w, target.e, braced ? 4 : 2, rnd2);
          else {
            target.e.hp -= braced ? 4 : 2;
            target.e.flash = w.tick;
          }
          if (target.e.kind === EntKind.Brood) alarmHive(w, target.e.x, target.e.y);
        } else if (cls === 0) {
          const sx = target.e.x + (rnd2() * 5 | 0) - 2;
          const sy = target.e.y + (rnd2() * 5 | 0) - 2;
          if (sx >= 1 && sx < W - 1 && sy >= 1 && sy < H - 1) {
            const si = sy * W + sx;
            if (w.mat[si] !== Mat.Space) {
              if (rnd2() < 0.12) w.temp[si] = Math.min(1500, w.temp[si] + 380);
              else if (w.pipe[si] !== 0) w.breakPipe(si);
            }
          }
        }
      }
    } else if (target.d <= 2 && cls !== 1) {
      moveToward(w, e, e.x * 2 - target.e.x, e.y * 2 - target.e.y, rnd2);
    }
    return;
  }
  if (target && cls !== 1) {
    const fp = firingPos(w, e, target.e, range2);
    if (fp >= 0 && fp !== e.y * W + e.x) {
      moveAlongPath(w, e, fp % W, fp / W | 0, rnd2);
      return;
    }
  }
  if (cls === 2) {
    stepLeader(w, e, target, rnd2);
  } else {
    stepTrooper(w, e, target, rnd2);
  }
}
function stepLeader(w, e, target, rnd2) {
  let gx;
  let gy;
  if (target) {
    gx = target.e.x;
    gy = target.e.y;
  } else {
    if (e.tx >= 0 && !objectiveValid(w, e)) e.tx = -1;
    if (e.tx < 0) pickObjective(w, e, rnd2);
    if (e.tx < 0) {
      wander(w, e, rnd2);
      return;
    }
    gx = e.tx;
    gy = e.ty;
    if (Math.abs(gx - e.x) + Math.abs(gy - e.y) <= 1) {
      if (resinNear(w, e, 4) && torcherNear(w, e, 12)) {
        if (rnd2() < 0.08) wander(w, e, rnd2);
        return;
      }
      e.tx = -1;
      return;
    }
  }
  moveAlongPath(w, e, gx, gy, rnd2);
}
const SLOT_OFF = [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [-2, 2], [2, -2]];
function formationGoal(w, e, leader) {
  let idx = 0;
  for (const o of w.ents) {
    if (o === e) break;
    if (o.kind === EntKind.Breacher && o.hp > 0 && o.team === e.team) idx++;
  }
  const off2 = SLOT_OFF[idx % SLOT_OFF.length];
  const gx = leader.x + off2[0];
  const gy = leader.y + off2[1];
  if (gx >= 1 && gx < W - 1 && gy >= 1 && gy < H - 1 && entPass(w.mat[gy * W + gx])) return [gx, gy];
  return [leader.x, leader.y];
}
function stepTrooper(w, e, target, rnd2) {
  if (target) {
    if (e.cls === 0 && target.e.kind === EntKind.Roamer && target.d <= 12 && hasLOS(w, e.x, e.y, target.e.x, target.e.y)) return;
    if (e.cls === 1) {
      const leader2 = nearestLeader(w, e);
      if (leader2 && Math.abs(leader2.x - e.x) + Math.abs(leader2.y - e.y) > 2) {
        moveAlongPath(w, e, leader2.x, leader2.y, rnd2);
        return;
      }
      if (!leader2) {
        moveToward(w, e, e.x * 2 - target.e.x, e.y * 2 - target.e.y, rnd2);
      }
      return;
    }
    moveAlongPath(w, e, target.e.x, target.e.y, rnd2);
    return;
  }
  if (e.cls === 1) {
    if (e.cutI !== void 0 && e.cutI >= 0) {
      const cm = w.mat[e.cutI];
      const cd = Math.abs(e.cutI % W - e.x) + Math.abs((e.cutI / W | 0) - e.y);
      if (cm !== Mat.Wall && cm !== Mat.Hull || cd !== 1) {
        e.cutI = -1;
      } else {
        w.burn[e.cutI] = 1.2;
        if (w.tick >= (e.workT ?? 0)) {
          w.mat[e.cutI] = Mat.Floor;
          w.burn[e.cutI] = 0;
          w.air[e.cutI] = 0;
          w.solidFuel[e.cutI] = 0;
          w.pipeBroken[e.cutI] = w.pipe[e.cutI] !== 0 ? 1 : 0;
          w.networksDirty = true;
          w.destruction += 2;
          w.pushNews("acetylene BREACH — a torcher cuts through the plating");
          e.cutI = -1;
          e.sulk = 0;
          e.path = null;
        }
        return;
      }
    }
    if (e.sulk !== void 0 && w.tick < e.sulk) {
      const officer = nearestLeader(w, e);
      let wantX = -1;
      let wantY = -1;
      if (officer && Math.abs(officer.x - e.x) + Math.abs(officer.y - e.y) > 4) {
        wantX = officer.x;
        wantY = officer.y;
      } else {
        const g = nearestGrowthCell(w, e.x, e.y, 12, e);
        if (g >= 0) {
          wantX = g % W;
          wantY = g / W | 0;
        }
      }
      if (wantX >= 0) {
        let best = -1;
        let bestD = Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx2 = e.x + dx;
          const ny2 = e.y + dy;
          if (nx2 < 1 || nx2 >= W - 1 || ny2 < 1 || ny2 >= H - 1) continue;
          const j = ny2 * W + nx2;
          if (w.mat[j] !== Mat.Wall && w.mat[j] !== Mat.Hull) continue;
          const dd = Math.abs(wantX - nx2) + Math.abs(wantY - ny2);
          if (dd < bestD) {
            bestD = dd;
            best = j;
          }
        }
        if (best >= 0 && bestD < Math.abs(wantX - e.x) + Math.abs(wantY - e.y)) {
          e.cutI = best;
          e.workT = w.tick + (w.mat[best] === Mat.Hull ? 480 : 300);
          return;
        }
        moveToward(w, e, wantX, wantY, rnd2);
        return;
      }
    }
  }
  if (e.cls === 0) {
    const far = nearestEnt(w, e, (o) => isMarineTarget(o) && o.kind !== EntKind.Brood, 28);
    if (far && far.d > 7) {
      if (far.e.kind === EntKind.Roamer && far.d <= 12 && hasLOS(w, e.x, e.y, far.e.x, far.e.y)) {
        return;
      }
      moveAlongPath(w, e, far.e.x, far.e.y, rnd2);
      return;
    }
  }
  let leader = nearestLeader(w, e);
  if (leader && Math.abs(leader.x - e.x) + Math.abs(leader.y - e.y) > 25) {
    leader = null;
  }
  if (leader && e.sulk !== void 0 && w.tick < e.sulk) {
    leader = null;
  }
  if (leader) {
    if (e.cls === 1 && !nearestEnt(w, e, isXeno, 8)) {
      if (torchNear(w, e)) {
        e.tx = -1;
        return;
      }
      const g = nearestGrowthCell(w, e.x, e.y, 8, e);
      if (g >= 0) {
        const gx = g % W;
        const gy = g / W | 0;
        if (Math.abs(gx - leader.x) + Math.abs(gy - leader.y) <= 10) {
          e.tx = gx;
          e.ty = gy;
          claim(g, e);
          moveAlongPath(w, e, gx, gy, rnd2);
          return;
        }
      }
      e.tx = -1;
    }
    const [fx, fy] = formationGoal(w, e, leader);
    const d = Math.abs(fx - e.x) + Math.abs(fy - e.y);
    if (d > 2) {
      moveAlongPath(w, e, fx, fy, rnd2);
      return;
    }
    if (rnd2() < 0.4) wander(w, e, rnd2);
    return;
  }
  if (e.cls === 1 && !nearestEnt(w, e, isXeno, 8)) {
    if (torchNear(w, e)) {
      e.tx = -1;
      return;
    }
    const g = nearestGrowthCell(w, e.x, e.y, 8, e);
    if (g >= 0) {
      e.tx = g % W;
      e.ty = g / W | 0;
      claim(g, e);
      moveAlongPath(w, e, e.tx, e.ty, rnd2);
      return;
    }
  }
  if (e.tx < 0 && w.rooms.length > 0) {
    const room = w.rooms[rnd2() * w.rooms.length | 0];
    e.tx = room.x + (room.w >> 1);
    e.ty = room.y + (room.h >> 1);
    e.patrol = true;
  }
  if (e.tx < 0) {
    wander(w, e, rnd2);
    return;
  }
  if (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) <= 1) {
    e.tx = -1;
    return;
  }
  moveAlongPath(w, e, e.tx, e.ty, rnd2);
}
function objectiveValid(w, e) {
  const i = e.ty * W + e.tx;
  if (w.mat[i] === Mat.Growth) return true;
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    if (j >= 0 && j < N && w.mat[j] === Mat.Growth) return true;
  }
  return e.patrol === true;
}
function pickObjective(w, e, rnd2) {
  if (e.sulk && w.tick < e.sulk) {
    const room2 = w.rooms[rnd2() * w.rooms.length | 0];
    e.tx = room2.x + (room2.w >> 1);
    e.ty = room2.y + (room2.h >> 1);
    e.patrol = true;
    return;
  }
  let best = -1;
  let bestD = Infinity;
  if (torcherNear(w, e, 12)) {
    for (let i = 0; i < N; i++) {
      if (w.mat[i] !== Mat.Growth) continue;
      const d = Math.abs(i % W - e.x) + Math.abs((i / W | 0) - e.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  for (const o of w.ents) {
    if (o.kind !== EntKind.Brood || o.hp <= 0) continue;
    const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y);
    if (d < bestD) {
      bestD = d;
      best = o.y * W + o.x;
    }
  }
  if (best >= 0) {
    e.tx = best % W;
    e.ty = best / W | 0;
    e.patrol = false;
    return;
  }
  if (w.rooms.length === 0) {
    e.tx = -1;
    return;
  }
  const room = w.rooms[rnd2() * w.rooms.length | 0];
  e.tx = room.x + (room.w >> 1);
  e.ty = room.y + (room.h >> 1);
  e.patrol = true;
}
function firingPos(w, e, t, range2) {
  let best = -1;
  let bestD = Infinity;
  for (let dy = -range2; dy <= range2; dy++) {
    const ad = Math.abs(dy);
    for (let dx = -(range2 - ad); dx <= range2 - ad; dx++) {
      const x = t.x + dx;
      const y = t.y + dy;
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
      const i = y * W + x;
      if (!entPass(w.mat[i]) || w.burn[i] > 0) continue;
      if (occ[i] && !(x === e.x && y === e.y)) continue;
      let d = Math.abs(x - e.x) + Math.abs(y - e.y);
      for (const o of w.ents) {
        if (o === e || o.kind !== EntKind.Breacher || o.hp <= 0) continue;
        if (Math.abs(o.x - x) + Math.abs(o.y - y) <= 1) d += 6;
      }
      if (d >= bestD) continue;
      if (!hasLOS(w, x, y, t.x, t.y)) continue;
      bestD = d;
      best = i;
    }
  }
  return best;
}
function nearestLeader(w, e) {
  let best = null;
  let bestD = Infinity;
  let ownBest = null;
  let ownD = Infinity;
  for (const o of w.ents) {
    if (o === e || o.kind !== EntKind.Breacher || o.cls !== 2 || o.hp <= 0) continue;
    const d = Math.abs(o.x - e.x) + Math.abs(o.y - e.y);
    if (e.team !== void 0 && o.team === e.team && d < ownD) {
      ownD = d;
      ownBest = o;
    }
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (ownBest) return ownBest;
  return best;
}
function torcherNear(w, e, r) {
  return w.ents.some(
    (o) => o.kind === EntKind.Breacher && o.cls === 1 && o.hp > 0 && Math.abs(o.x - e.x) + Math.abs(o.y - e.y) <= r
  );
}
function resinNear(w, e, r) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = e.x + dx;
      const y = e.y + dy;
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
      if (w.mat[y * W + x] === Mat.Growth) return true;
    }
  return false;
}
function nearestGrowthCell(w, x, y, r, asker) {
  let best = -1;
  let bestD = Infinity;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
      if (w.mat[ny * W + nx] !== Mat.Growth) continue;
      if (asker && claimedBy(ny * W + nx, asker)) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestD) {
        bestD = d;
        best = ny * W + nx;
      }
    }
  }
  return best;
}
function torchNear(w, e, rnd2) {
  for (let r = 0; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = e.x + dx;
        const y = e.y + dy;
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const i = y * W + x;
        if (w.mat[i] === Mat.Growth) {
          if (w.tick >= e.timer) {
            w.shots.push({ x0: e.x, y0: e.y, x1: x, y1: y, t: w.tick, k: 1 });
            w.mat[i] = Mat.Floor;
            w.solidFuel[i] = 0;
            w.temp[i] = Math.min(1500, w.temp[i] + 180);
            e.timer = w.tick + 12;
            e.flash = w.tick;
          }
          return true;
        }
      }
  }
  return false;
}
function spawnScav(w, x, y, home, cls = 0) {
  w.ents.push({
    kind: EntKind.Scav,
    x,
    y,
    hp: cls === 2 ? 8 : 6,
    cd: 0,
    timer: 0,
    flash: -99,
    tx: -1,
    ty: -1,
    path: null,
    pi: 0,
    pg: -1,
    home,
    cargo: 0,
    cls
  });
  occ[y * W + x] = 1;
}
function dockScavs(w, rnd2, count) {
  let landed = 0;
  for (let tries = 0; tries < 200 && landed < count; tries++) {
    const i = w.hullCells[rnd2() * w.hullCells.length | 0];
    if (i === void 0 || w.mat[i] !== Mat.Hull) continue;
    for (const off2 of [1, -1, W, -W]) {
      const inner = i + off2;
      if (inner < 0 || inner >= N) continue;
      const im = w.mat[inner];
      if (im !== Mat.Floor && im !== Mat.Rubble && im !== Mat.Growth && im !== Mat.DoorOpen) continue;
      w.mat[i] = Mat.DoorClosed;
      const roll = rnd2();
      const cls = roll < 0.55 ? 0 : roll < 0.82 ? 1 : 2;
      placeAround(w, inner % W, inner / W | 0, 1, (x, y) => spawnScav(w, x, y, inner, cls));
      landed++;
      break;
    }
  }
}
function lootValue(w, i) {
  if (w.liqType[i] === Liquid.Ichor && w.liqAmt[i] > 0.2) return 3;
  if (w.pipe[i] !== 0 && !w.pipeBroken[i]) return 2;
  if (w.solidFuel[i] > 0.3 && w.mat[i] === Mat.Floor) return 1;
  return 0;
}
function rustleValue(w, i) {
  if (w.mat[i] !== Mat.Machine) return 0;
  const mc = w.machine[i];
  if (mc === Machine.Reactor) return 5;
  if (mc === Machine.CoolantTank || mc === Machine.O2Gen || mc === Machine.FuelTank) return 4;
  if (mc === Machine.Munitions) return 3;
  return 2;
}
function stepScav(w, e, rnd2) {
  if (e.cargo === void 0) e.cargo = 0;
  if (e.cls === void 0) e.cls = 0;
  if (e.cls === 1) e.cd = Math.max(0, e.cd - 3);
  if (e.cls === 2) {
    const ward = nearestEnt(w, e, (o) => o.kind === EntKind.Scav && o !== e && (o.cargo ?? 0) > 0, 30) ?? nearestEnt(w, e, (o) => o.kind === EntKind.Scav && o !== e, 30);
    if (w.tick >= (e.workT ?? 0)) {
      const ci = e.y * W + e.x;
      for (const j of [ci, ci - 1, ci + 1, ci - W, ci + W]) {
        if (j >= 0 && j < N && w.mat[j] !== Mat.Space) w.smoke[j] = Math.min(2, w.smoke[j] + 1.6);
      }
      e.workT = w.tick + 30;
    }
    if (ward && ward.d > 3) {
      moveAlongPath(w, e, ward.e.x, ward.e.y, rnd2);
      return;
    }
    if (!ward) {
      headHome(w, e, rnd2);
      return;
    }
    if (rnd2() < 0.4) wander(w, e, rnd2);
    return;
  }
  const threat = nearestEnt(w, e, isScary, 7);
  if (threat) {
    if (threat.d <= 1 && w.tick >= e.timer) {
      e.timer = w.tick + 20;
      e.flash = w.tick;
      if (rnd2() < 0.4) {
        threat.e.hp -= 1;
        threat.e.flash = w.tick;
      }
    }
    if (e.hp <= 2) {
      headHome(w, e, rnd2);
      return;
    }
    moveToward(w, e, e.x * 2 - threat.e.x, e.y * 2 - threat.e.y, rnd2);
    return;
  }
  if (e.cargo >= TUNE.cargoFull || e.hp <= 2) {
    if (e.hauling !== true) {
      e.hauling = true;
      e.sulk = 0;
      e.path = null;
    }
    headHome(w, e, rnd2);
    return;
  }
  e.hauling = false;
  let market = true;
  const targetGone = e.cls === 1 ? e.tx === void 0 || e.tx < 0 || rustleValue(w, e.ty * W + e.tx) === 0 : e.tx === void 0 || e.tx < 0 || lootValue(w, e.ty * W + e.tx) === 0;
  if (targetGone) {
    market = pickLoot(w, e);
  }
  if (e.tx === void 0 || e.tx < 0) {
    if (!market) {
      headHome(w, e, rnd2);
      return;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (e.y + dy) * W + e.x + dx;
      if (j >= 0 && j < N && occ[j]) {
        if (tryMove(w, e, -dx, -dy)) return;
      }
    }
    wander(w, e, rnd2);
    return;
  }
  if (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) <= 1) {
    const i = e.ty * W + e.tx;
    if (e.cls === 1 && w.mat[i] === Mat.Machine) {
      const wasReactor = w.machine[i] === Machine.Reactor;
      w.mat[i] = Mat.Floor;
      w.machine[i] = 0;
      w.air[i] = 0;
      w.networksDirty = true;
      w.destruction += wasReactor ? 8 : 3;
      if (wasReactor) {
        const k = w.reactorCells.indexOf(i);
        if (k >= 0) w.reactorCells.splice(k, 1);
        if (w.reactorCells.length === 0) w.reactorAlive = false;
      }
      e.cargo += 3;
      e.flash = w.tick;
      e.tx = -1;
      return;
    }
    if (w.liqType[i] === Liquid.Ichor && w.liqAmt[i] > 0.2) {
      w.liqAmt[i] = 0;
      w.liqType[i] = Liquid.None;
    } else if (w.pipe[i] !== 0) {
      w.pipe[i] = 0;
      w.pipeBroken[i] = 0;
      w.networksDirty = true;
      w.destruction += 1;
    } else if (w.solidFuel[i] > 0.3) {
      w.solidFuel[i] = 0;
    }
    e.cargo++;
    e.flash = w.tick;
    e.tx = -1;
    return;
  }
  moveAlongPath(w, e, e.tx, e.ty, rnd2);
}
function pickLoot(w, e) {
  if (e.sulk && w.tick < (e.sulk ?? 0)) {
    e.tx = -1;
    return true;
  }
  const claimed = /* @__PURE__ */ new Set();
  const claimedList = [];
  for (const o of w.ents) {
    if (o !== e && o.kind === EntKind.Scav && o.hp > 0 && o.tx !== void 0 && o.tx >= 0) {
      const oc = o.ty * W + o.tx;
      claimed.add(oc);
      claimedList.push(oc);
    }
  }
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < N; i++) {
    const v = e.cls === 1 ? rustleValue(w, i) : lootValue(w, i);
    if (v === 0) continue;
    if (claimed.has(i)) continue;
    const x = i % W;
    const y = i / W | 0;
    const d = Math.abs(x - e.x) + Math.abs(y - e.y);
    let crowd = 0;
    for (const c of claimedList) {
      if (Math.abs(c % W - x) + Math.abs((c / W | 0) - y) <= 8) crowd += 30;
    }
    const score = v * 12 - d - crowd;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best >= 0) {
    e.tx = best % W;
    e.ty = best / W | 0;
    return true;
  }
  e.tx = -1;
  return false;
}
function headHome(w, e, rnd2) {
  const homeGone = e.home === void 0 || !entPass(w.mat[e.home]);
  const routeDead = e.sulk !== void 0 && w.tick < e.sulk;
  if (homeGone || routeDead) {
    for (let tries = 0; tries < 40; tries++) {
      const i = w.hullCells[tries * 7919 % Math.max(1, w.hullCells.length) | 0];
      if (i === void 0 || w.mat[i] !== Mat.Hull) continue;
      for (const off2 of [1, -1, W, -W]) {
        const inner = i + off2;
        if (inner >= 0 && inner < N && entPass(w.mat[inner]) && w.mat[inner] !== Mat.Lattice) {
          e.home = inner;
          e.sulk = 0;
          e.path = null;
          break;
        }
      }
      if (e.home !== void 0 && entPass(w.mat[e.home]) && !routeDead) break;
    }
    if (e.home === void 0 || !entPass(w.mat[e.home]) || routeDead) {
      e.hp = 0;
      e.departed = true;
      return;
    }
  }
  const home = e.home;
  const hx = home % W;
  const hy = home / W | 0;
  e.tx = hx;
  e.ty = hy;
  if (Math.abs(hx - e.x) + Math.abs(hy - e.y) <= 1) {
    if ((e.cargo ?? 0) >= TUNE.cargoFull) {
      e.cargo = 0;
      e.tx = -1;
      e.flash = w.tick;
      if (w.tick >= w.nextRecruitTick) {
        w.nextRecruitTick = w.tick + TUNE.recruitInterval;
        placeAround(w, hx, hy, 1, (x, y) => spawnScav(w, x, y, e.home));
      }
      return;
    }
    e.hp = 0;
    e.departed = true;
    return;
  }
  moveAlongPath(w, e, hx, hy, rnd2);
}
function spawnServitor(w, x, y, cohort) {
  w.ents.push({
    kind: EntKind.Servitor,
    x,
    y,
    hp: 8,
    cd: 0,
    timer: 0,
    flash: -99,
    cls: cohort ?? w.ents.length % 4,
    tx: -1,
    ty: -1,
    path: null,
    pi: 0,
    pg: -1
  });
  occ[y * W + x] = 1;
}
function spawnMilitor(w, x, y) {
  w.ents.push({
    kind: EntKind.Militor,
    x,
    y,
    hp: 10,
    cd: 0,
    timer: 0,
    flash: -99,
    tx: -1,
    ty: -1,
    path: null,
    pi: 0,
    pg: -1,
    fought: 0
  });
  occ[y * W + x] = 1;
}
function dockServitors(w, rnd2) {
  for (let tries = 0; tries < 80; tries++) {
    const i = w.hullCells[rnd2() * w.hullCells.length | 0];
    if (i === void 0 || w.mat[i] !== Mat.Hull) continue;
    for (const off2 of [1, -1, W, -W]) {
      const inner = i + off2;
      if (inner < 0 || inner >= N) continue;
      const im = w.mat[inner];
      if (im !== Mat.Floor && im !== Mat.Rubble && im !== Mat.DoorOpen) continue;
      placeAround(w, inner % W, inner / W | 0, 2, (x, y) => spawnServitor(w, x, y));
      return;
    }
  }
  for (let tries = 0; tries < 120; tries++) {
    const i = rnd2() * N | 0;
    if (w.mat[i] !== Mat.Floor && w.mat[i] !== Mat.Rubble) continue;
    placeAround(w, i % W, i / W | 0, 2, (x, y) => spawnServitor(w, x, y));
    return;
  }
}
function stepServitor(w, e, rnd2) {
  if (e.brain === void 0 && w.reactorAlive) e.brain = w.brainId;
  if (e.timer > w.tick + 600) e.workT = w.tick + 30;
  if (e.tx === void 0) {
    e.tx = -1;
    e.ty = -1;
    e.path = null;
    e.pi = 0;
    e.pg = -1;
  }
  const ci = e.y * W + e.x;
  if (w.mat[ci] === Mat.Space) {
    w.mat[ci] = Mat.Floor;
    e.flash = w.tick;
    return;
  }
  const foe = nearestEnt(w, e, (o) => o.kind === EntKind.Roamer, 1);
  if (foe) {
    if (w.tick >= e.timer) {
      foe.e.hp -= 1;
      foe.e.flash = w.tick;
      e.flash = w.tick;
      e.timer = w.tick + 24;
    }
    return;
  }
  for (const j of [e.y * W + e.x, e.y * W + e.x - 1, e.y * W + e.x + 1, (e.y - 1) * W + e.x, (e.y + 1) * W + e.x]) {
    if (j >= 0 && j < N && w.burn[j] > 0) {
      w.burn[j] = 0;
      if (w.temp[j] > 80) w.temp[j] = 80;
      const own = e.y * W + e.x;
      if (w.temp[own] > 120) w.temp[own] = 120;
      w.smoke[j] = Math.min(2, w.smoke[j] + 0.3);
      e.flash = w.tick;
      return;
    }
  }
  if (e.tx >= 0) {
    const i2 = e.ty * W + e.tx;
    const stillFire = w.burn[i2] > 0;
    const stillBroken = w.pipe[i2] !== 0 && w.pipeBroken[i2] === 1;
    const stillBreached = ventingEdge(w, i2) || hullGap(w, i2);
    const stillPlanned = planStepAt(w, i2) !== null;
    const stillSurplus = surplusReactor(w, i2) && w.reactorAlive;
    if (!stillFire && !stillBroken && !stillBreached && !stillPlanned && !stillSurplus && (e.mode ?? Mode.Idle) < Mode.Survey)
      e.tx = -1;
  }
  const reactorDead = !w.reactorAlive || w.reactorCells.length === 0;
  if (e.tx < 0 && reactorDead) {
    takePlanStep(w, e, rnd2);
  }
  if (e.tx < 0) pickJob(w, e);
  if (e.tx < 0) {
    takePlanStep(w, e, rnd2);
  }
  if (e.tx < 0) {
    if (planStepAt(w, e.y * W + e.x) !== null) {
      if (!tryStepOff(w, e, rnd2)) displaceTo(w, e, 3);
      return;
    }
    if (w.tick >= (e.workT ?? 0)) {
      const here = e.y * W + e.x;
      for (const j of [
        here - 1,
        here + 1,
        here - W,
        here + W,
        here - W - 1,
        here - W + 1,
        here + W - 1,
        here + W + 1
      ]) {
        if (j >= 0 && j < N && (w.mat[j] === Mat.Rubble || w.mat[j] === Mat.Lattice || w.mat[j] === Mat.Vine) && !occ[j]) {
          w.mat[j] = Mat.Floor;
          w.solidFuel[j] = 0;
          w.temp[j] = 20;
          e.workT = w.tick + 14;
          e.flash = w.tick;
          return;
        }
      }
      for (const j of [
        here - 1,
        here + 1,
        here - W,
        here + W,
        here - W - 1,
        here - W + 1,
        here + W - 1,
        here + W + 1
      ]) {
        if (j >= 0 && j < N && w.mat[j] === Mat.Space && !occ[j]) {
          w.mat[j] = Mat.Floor;
          w.temp[j] = 20;
          e.workT = w.tick + 14;
          e.flash = w.tick;
          return;
        }
      }
    }
    if (w.tick >= (e.workT ?? 0)) {
      const here2 = e.y * W + e.x;
      for (const j of [
        here2,
        here2 - 1,
        here2 + 1,
        here2 - W,
        here2 + W,
        here2 - W - 1,
        here2 - W + 1,
        here2 + W - 1,
        here2 + W + 1
      ]) {
        if (j < 0 || j >= N) continue;
        if (w.liqAmt[j] <= 0.05 || w.liqType[j] === Liquid.None) continue;
        const take = Math.min(0.6, w.liqAmt[j]);
        if (w.liqType[j] === Liquid.Coolant) w.coolantReserve += take * 0.8;
        w.liqAmt[j] -= take;
        if (w.liqAmt[j] <= 0.03) {
          w.liqAmt[j] = 0;
          w.liqType[j] = Liquid.None;
        }
        e.workT = w.tick + 10;
        e.flash = w.tick;
        return;
      }
    }
    let rcCell = w.reactorAlive && w.reactorCells.length > 0 ? w.reactorCells[0] : -1;
    if (e.brain !== void 0 && e.brain !== w.brainId) rcCell = w.brainHearts.get(e.brain) ?? -1;
    const rcAlive = rcCell >= 0;
    const rcx3 = rcAlive ? rcCell % W : 0;
    const rcy3 = rcAlive ? rcCell / W | 0 : 0;
    let fBest = -1;
    let fScore = Infinity;
    let fD = Infinity;
    let fLocal = -1;
    let fLocalScore = Infinity;
    for (let i2 = W; i2 < N - W; i2++) {
      if (w.mat[i2] !== Mat.Floor) continue;
      if (w.liqAmt[i2] > 0.2 && w.liqType[i2] !== Liquid.None && unitReach[i2]) {
        const dm = Math.abs(i2 % W - e.x) + Math.abs((i2 / W | 0) - e.y);
        if (dm > 1 && dm - 10 < fScore) {
          fScore = dm - 10;
          fBest = i2;
          fD = dm;
        }
        if (dm > 1 && dm <= 20 && dm - 10 < fLocalScore) {
          fLocalScore = dm - 10;
          fLocal = i2;
        }
        continue;
      }
      const m1 = w.mat[i2 - 1];
      const m2 = w.mat[i2 + 1];
      const m3 = w.mat[i2 - W];
      const m4 = w.mat[i2 + W];
      const edge = (m) => m === Mat.Space || m === Mat.Rubble || m === Mat.Lattice || m === Mat.Vine;
      if (!edge(m1) && !edge(m2) && !edge(m3) && !edge(m4)) continue;
      if (planStepAt(w, i2) !== null) continue;
      let taken = false;
      for (const o of w.ents) {
        if (o !== e && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor) && o.hp > 0 && o.tx !== void 0 && o.ty * W + o.tx === i2) {
          taken = true;
          break;
        }
      }
      if (taken) continue;
      const d = Math.abs(i2 % W - e.x) + Math.abs((i2 / W | 0) - e.y);
      if (d <= 1) continue;
      const dr = rcAlive ? Math.abs(i2 % W - rcx3) + Math.abs((i2 / W | 0) - rcy3) : 0;
      const score = d + dr * 2;
      if (score < fScore) {
        fScore = score;
        fBest = i2;
        fD = d;
      }
      if (d <= 20 && score < fLocalScore) {
        fLocalScore = score;
        fLocal = i2;
      }
    }
    if (fBest >= 0 && fD > 20 && findPath(w, e.y * W + e.x, fBest) === null) {
      fBest = fLocal;
      fD = fLocal >= 0 ? 1 : Infinity;
    }
    if (fBest >= 0 && fD < 70) {
      e.tx = fBest % W;
      e.ty = fBest / W | 0;
      e.mode = Mode.Survey;
      e.patrol = true;
      return;
    }
    if (rcAlive) {
      const dHome = Math.abs(e.x - rcx3) + Math.abs(e.y - rcy3);
      if (dHome > 10) {
        for (let a = 0; a < 20; a++) {
          const hx = rcx3 + (rnd2() * 17 | 0) - 8;
          const hy = rcy3 + (rnd2() * 17 | 0) - 8;
          if (hx < 1 || hx >= W - 1 || hy < 1 || hy >= H - 1) continue;
          const hc = hy * W + hx;
          if (!entPass(w.mat[hc]) || planStepAt(w, hc) !== null) continue;
          e.tx = hx;
          e.ty = hy;
          e.mode = Mode.Home;
          e.patrol = true;
          return;
        }
      }
    }
    if (e.kind === EntKind.Servitor) {
      e.bored = (e.bored ?? 0) + 1;
      if (e.bored > TUNE.servitorBored) {
        e.hp = 0;
        e.departed = true;
        return;
      }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (e.y + dy) * W + e.x + dx;
      if (j >= 0 && j < N && occ[j]) {
        if (tryMove(w, e, -dx, -dy)) return;
      }
    }
    if (rnd2() < 0.25) wander(w, e, rnd2);
    return;
  }
  e.bored = 0;
  const i = e.ty * W + e.tx;
  const dPat = Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y);
  if ((e.mode ?? 0) >= Mode.Survey && (dPat === 0 || dPat === 1 && (occ[i] || !entPass(w.mat[i])))) {
    e.patrol = false;
    e.mode = Mode.Idle;
    e.tx = -1;
    return;
  }
  if (Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y) > 1) {
    moveAlongPath(w, e, e.tx, e.ty, rnd2);
    return;
  }
  {
    if (w.pipe[i] !== 0 && w.pipeBroken[i]) {
      const own = e.y * W + e.x;
      for (const j of [i, i - 1, i + 1, i - W, i + W, own]) {
        if (j >= 0 && j < N && w.pipe[j] !== 0 && w.pipeBroken[j]) {
          w.pipeBroken[j] = 0;
        }
      }
      w.networksDirty = true;
      e.flash = w.tick;
      e.tx = -1;
      return;
    }
    if (hullGap(w, i)) {
      if (w.tick >= (e.workT ?? 0) && !occ[i]) {
        w.mat[i] = Mat.Hull;
        w.air[i] = 0;
        w.temp[i] = 20;
        w.networksDirty = true;
        e.workT = w.tick + 16;
        e.flash = w.tick;
      }
      e.tx = -1;
      return;
    }
    if (surplusReactor(w, i)) {
      if (w.tick >= (e.workT ?? 0)) {
        w.mat[i] = Mat.Floor;
        w.machine[i] = 0;
        w.temp[i] = 20;
        w.air[i] = 0;
        w.networksDirty = true;
        e.workT = w.tick + 14;
        e.flash = w.tick;
      }
      e.tx = -1;
      return;
    }
    const hit = planAt(w, i);
    if (hit) {
      const st = hit.st;
      if (st.i === e.y * W + e.x) {
        wander(w, e, rnd2);
        return;
      }
      if (occ[st.i]) {
        const sq = w.ents.find(
          (o) => o !== e && o.hp > 0 && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor) && o.y * W + o.x === st.i
        );
        if (sq) displaceTo(w, sq, 3);
      }
      if (w.tick >= (e.workT ?? 0) && !occ[st.i]) {
        w.lastPour = w.tick;
        hit.plan.touched = w.tick;
        e.home = void 0;
        if (w.mat[st.i] === Mat.Tree) {
          w.mat[st.i] = Mat.Rubble;
          w.solidFuel[st.i] = Math.min(w.solidFuel[st.i] + 0.3, 1);
          e.workT = w.tick + 20;
          e.flash = w.tick;
          return;
        }
        const pm0 = w.mat[st.i];
        if (pm0 === Mat.Machine && w.machine[st.i] !== (st.mc ?? 0)) {
          const mc0 = w.machine[st.i];
          const plant0 = mc0 === Machine.Reactor || mc0 === Machine.CoolantTank;
          if (plant0 && w.reactorOwner[st.i] === (e.brain ?? 0)) {
            e.tx = -1;
            return;
          }
          const k0 = w.reactorCells.indexOf(st.i);
          if (k0 >= 0) {
            w.reactorCells.splice(k0, 1);
            if (w.reactorCells.length === 0) w.reactorAlive = false;
            w.pushNews(`WAR — ${brainName(e.brain ?? 0)} paves over the crown of ${brainName(w.brainId)}`);
          } else if (plant0) {
            w.pushNews(`WAR — ${brainName(e.brain ?? 0)}'s dream paves over a rival plant`);
          }
          w.machine[st.i] = 0;
          w.destruction += mc0 === Machine.Reactor ? 6 : plant0 ? 3 : 1;
        }
        w.mat[st.i] = st.m;
        if (st.m === Mat.Wall || st.m === Mat.Machine) {
          w.air[st.i] = 0;
          w.solidFuel[st.i] = 0;
        }
        if (st.mc !== void 0) w.machine[st.i] = st.mc;
        if (st.mc === Machine.Reactor || st.mc === Machine.CoolantTank) w.reactorOwner[st.i] = hit.plan.team ?? e.brain ?? 0;
        if (st.pp !== void 0) {
          w.pipe[st.i] |= st.pp;
          w.pipeBroken[st.i] = 0;
        }
        w.temp[st.i] = 20;
        if (w.blueprint && w.blueprint.roomId[st.i] >= 0 && w.roomId[st.i] < 0) {
          w.roomId[st.i] = w.blueprint.roomId[st.i];
        }
        w.networksDirty = true;
        e.workT = w.tick + 10;
        e.flash = w.tick;
        afterBuild(w, hit.plan, st);
      }
      e.tx = -1;
      return;
    }
    if (w.tick >= (e.workT ?? 0)) {
      const j = adjacentSpace(w, i);
      if (j >= 0) {
        w.mat[j] = Mat.Wall;
        w.temp[j] = 20;
        w.networksDirty = true;
        e.workT = w.tick + 24;
        e.flash = w.tick;
        return;
      }
    } else if (ventingEdge(w, i)) {
      return;
    }
    e.tx = -1;
    return;
  }
}
function wakeDormantHearts(w, rnd2) {
  if (w.arrivalsOff || !w.reactorAlive) return;
  let crew = 0;
  for (const o of w.ents)
    if (o.hp > 0 && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor)) crew++;
  if (crew > 30) return;
  const seen = new Uint8Array(N);
  for (let i0 = 0; i0 < N; i0++) {
    if (seen[i0] || w.mat[i0] !== Mat.Machine || w.machine[i0] !== Machine.Reactor) continue;
    const cluster = [i0];
    seen[i0] = 1;
    for (let qi = 0; qi < cluster.length; qi++) {
      for (const j of [cluster[qi] - 1, cluster[qi] + 1, cluster[qi] - W, cluster[qi] + W]) {
        if (j >= 0 && j < N && !seen[j] && w.mat[j] === Mat.Machine && w.machine[j] === Machine.Reactor) {
          seen[j] = 1;
          cluster.push(j);
        }
      }
    }
    if (cluster.length < 3) continue;
    if (cluster.some((c) => w.reactorCells.includes(c))) continue;
    let owner = 0;
    for (const c of cluster) {
      if (w.reactorOwner[c] > 0 && w.reactorOwner[c] !== w.brainId) {
        owner = w.reactorOwner[c];
        break;
      }
    }
    if (owner === 0) owner = w.nextBrainId++;
    for (const c of cluster) w.reactorOwner[c] = owner;
    let sworn = false;
    for (const o of w.ents) {
      if (o.hp > 0 && o.brain === owner && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor)) {
        sworn = true;
        break;
      }
    }
    if (sworn) continue;
    let placed = 0;
    placeAround(w, i0 % W, i0 / W | 0, 2, (x, y) => {
      if (placed < 2) {
        spawnServitor(w, x, y);
        w.ents[w.ents.length - 1].brain = owner;
        placed++;
      }
    });
    if (placed > 0) {
      w.pushNews(`a dormant heart stirs — ${brainName(owner)} wakes its hands`);
      return;
    }
  }
}
function stepMilitor(w, e, rnd2) {
  if (e.brain === void 0 && w.reactorAlive) e.brain = w.brainId;
  if (e.fought === void 0) e.fought = w.tick;
  const posNow = e.y * W + e.x;
  if (e.satPos !== posNow) {
    e.satPos = posNow;
    e.sat = w.tick;
  } else if (w.tick - (e.sat ?? w.tick) > TUNE.militorPinned && w.tick - e.fought > 600) {
    e.kind = EntKind.Servitor;
    e.flash = w.tick;
    return;
  }
  let alarm = -1;
  for (let k = w.crewDeaths.length - 1; k >= 0; k--) {
    if (w.tick - w.crewDeaths[k].t < 2400) {
      alarm = w.crewDeaths[k].i;
      break;
    }
  }
  const foe = nearestEnt(w, e, isXeno, 14) ?? nearestEnt(w, e, isThief, 10) ?? nearestEnt(w, e, isDrowned, 10);
  if (foe) {
    const rc = w.reactorCells.length ? w.reactorCells[0] : -1;
    const nearWorks = rc >= 0 && Math.abs(foe.e.x - rc % W) + Math.abs(foe.e.y - (rc / W | 0)) <= 24;
    const nearAlarm = alarm >= 0 && Math.abs(foe.e.x - alarm % W) + Math.abs(foe.e.y - (alarm / W | 0)) <= 20;
    if (nearWorks || nearAlarm || foe.d <= 6) {
      e.fought = w.tick;
      const bw = foe.e.kind === EntKind.Brood ? 2 : 1;
      let reach = Infinity;
      for (let by = 0; by < bw; by++)
        for (let bx = 0; bx < bw; bx++) {
          const dd = Math.abs(foe.e.x + bx - e.x) + Math.abs(foe.e.y + by - e.y);
          if (dd < reach) reach = dd;
        }
      const big = foe.e.hp > 5;
      let spectating = false;
      if (big && reach > 1) {
        const isRing = (ci2) => {
          const cx = ci2 % W;
          const cy = ci2 / W | 0;
          for (let by = 0; by < bw; by++)
            for (let bx = 0; bx < bw; bx++) {
              if (Math.abs(foe.e.x + bx - cx) + Math.abs(foe.e.y + by - cy) === 1) return true;
            }
          return false;
        };
        const curI = e.tx !== void 0 && e.tx >= 0 ? e.ty * W + e.tx : -1;
        let goal = curI >= 0 && isRing(curI) && !claimedBy(curI, e) && entPass(w.mat[curI]) ? curI : -1;
        if (goal < 0) {
          let bestD = Infinity;
          for (let by = -1; by <= bw; by++)
            for (let bx = -1; bx <= bw; bx++) {
              const cx = foe.e.x + bx;
              const cy = foe.e.y + by;
              if (cx < 1 || cx >= W - 1 || cy < 1 || cy >= H - 1) continue;
              const ci2 = cy * W + cx;
              if (!isRing(ci2)) continue;
              if (!entPass(w.mat[ci2]) || w.burn[ci2] > 0) continue;
              if (occ[ci2] && !(cx === e.x && cy === e.y)) continue;
              if (claimedBy(ci2, e)) continue;
              const dd = Math.abs(cx - e.x) + Math.abs(cy - e.y);
              if (dd < bestD) {
                bestD = dd;
                goal = ci2;
              }
            }
        }
        if (goal >= 0) {
          e.tx = goal % W;
          e.ty = goal / W | 0;
          claim(goal, e);
          if (goal !== e.y * W + e.x) moveAlongPath(w, e, e.tx, e.ty, rnd2);
        } else {
          e.tx = -1;
          spectating = true;
        }
      } else if (reach > 2) {
        moveAlongPath(w, e, foe.e.x, foe.e.y, rnd2);
      }
      let reach2 = Infinity;
      for (let by = 0; by < bw; by++)
        for (let bx = 0; bx < bw; bx++) {
          const dd = Math.abs(foe.e.x + bx - e.x) + Math.abs(foe.e.y + by - e.y);
          if (dd < reach2) reach2 = dd;
        }
      if (reach2 <= (big ? 1 : 2) && w.tick >= e.timer) {
        if (isDrowned(foe.e)) spectralHit(w, foe.e, 2, rnd2);
        else {
          foe.e.hp -= 2;
          foe.e.flash = w.tick;
        }
        e.flash = w.tick;
        e.timer = w.tick + 8;
        if (foe.e.kind === EntKind.Brood) alarmHive(w, foe.e.x, foe.e.y);
      }
      if (foe.e.hp > 0 && !big) return;
      if (foe.e.hp <= 0) e.tx = -1;
      if (!spectating || foe.e.hp <= 0) return;
    }
  }
  if (alarm >= 0) {
    const ax = alarm % W;
    const ay = alarm / W | 0;
    const d = Math.abs(ax - e.x) + Math.abs(ay - e.y);
    if (d > 4) {
      moveAlongPath(w, e, ax, ay, rnd2);
      return;
    }
    if (rnd2() < 0.3) wander(w, e, rnd2);
    return;
  }
  if (w.tick - e.fought > TUNE.militorDemote) {
    e.kind = EntKind.Servitor;
    e.flash = w.tick;
    return;
  }
  const t0 = e.workT;
  stepServitor(w, e, rnd2);
  if (e.workT !== t0 && (e.workT ?? 0) > w.tick) e.workT = w.tick + (e.workT - w.tick) * 2;
}
function spawnWeaver(w, x, y, cls = 0) {
  w.ents.push({
    kind: EntKind.Weaver,
    x,
    y,
    hp: cls === 0 ? 12 : 18,
    cd: 0,
    timer: 0,
    flash: -99,
    cls
  });
  occ[y * W + x] = 1;
}
function weaverPass(w, x, y) {
  if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return false;
  const i = y * W + x;
  if (w.burn[i] > 0) return false;
  const m = w.mat[i];
  if (entPass(m)) return true;
  if (m !== Mat.Space) return false;
  for (const j of [i - 1, i + 1, i - W, i + W]) {
    const n = w.mat[j];
    if (n !== Mat.Space && n !== Mat.Floor) return true;
  }
  return false;
}
function stepWeaver(w, e, rnd2) {
  if (e.cls === void 0) e.cls = 0;
  if (e.cls < 2) {
    const mate = nearestEnt(
      w,
      e,
      (o) => o.kind === EntKind.Weaver && o !== e && (o.cls ?? 0) === e.cls && o.hp > 0,
      2
    );
    if (mate) {
      e.bored = (e.bored ?? 0) + 1;
      if (e.bored > 60 && (mate.e.bored ?? 0) > 30) {
        const nx = e.x;
        const ny = e.y;
        const born = e.cls + 1;
        e.hp = 0;
        e.departed = true;
        mate.e.hp = 0;
        mate.e.departed = true;
        w.pushNews(born === 1 ? "the dance ends — a MATRIARCH rises" : "two matriarchs entwine — a CONDUCTOR is born");
        spawnWeaver(w, nx, ny, born);
        w.ents[w.ents.length - 1].flash = w.tick;
        return;
      }
    } else if (e.bored) {
      e.bored--;
    }
  }
  if (e.tx === void 0) {
    e.tx = -1;
    e.ty = -1;
    e.pg = 0;
  }
  if (e.timer > 0) e.timer--;
  if (e.tx >= 0) {
    if (w.tick > (e.sulk ?? 0)) {
      e.tx = -1;
      e.path = null;
    } else {
      const d = Math.abs(e.tx - e.x) + Math.abs(e.ty - e.y);
      if (d > 1) {
        weaverWalk(w, e, rnd2);
        return;
      }
      if (e.timer === 0) {
        e.timer = 5 + (rnd2() * 6 | 0);
        e.flash = w.tick;
        const t = e.ty * W + e.tx;
        let dx0 = 0;
        let dy0 = 0;
        if (w.mat[t] === Mat.Lattice) {
          let n = 0;
          if (w.mat[t - 1] === Mat.Lattice) {
            n++;
            dx0 = 1;
          }
          if (w.mat[t + 1] === Mat.Lattice) {
            n++;
            dx0 = -1;
          }
          if (w.mat[t - W] === Mat.Lattice) {
            n++;
            dy0 = 1;
            dx0 = 0;
          }
          if (w.mat[t + W] === Mat.Lattice) {
            n++;
            dy0 = -1;
            dx0 = 0;
          }
          if (n !== 1) {
            dx0 = 0;
            dy0 = 0;
          }
        }
        growLine(w, e.tx, e.ty, rnd2, dx0, dy0, e.cls ?? 0);
        chooseNextSite(w, e, rnd2);
      }
      return;
    }
  }
  for (let a = 0; a < 4; a++) {
    const k = rnd2() * 4 | 0;
    const dx = [1, -1, 0, 0][k];
    const dy = [0, 0, 1, -1][k];
    if (weaverPass(w, e.x + dx, e.y + dy) && !occ[(e.y + dy) * W + e.x + dx]) {
      occ[e.y * W + e.x] = 0;
      e.x += dx;
      e.y += dy;
      occ[e.y * W + e.x] = 1;
      break;
    }
  }
  if (e.timer === 0) {
    e.timer = 5 + (rnd2() * 6 | 0);
    e.flash = w.tick;
    growLine(w, e.x, e.y, rnd2, 0, 0, e.cls ?? 0);
    chooseNextSite(w, e, rnd2);
  }
}
function weaverWalk(w, e, rnd2) {
  const goal = e.ty * W + e.tx;
  if (!e.path || e.pg !== goal || e.pi >= e.path.length) {
    e.path = findPathWeaver(w, e.y * W + e.x, goal);
    e.pi = 0;
    e.pg = goal;
    if (!e.path) {
      e.tx = -1;
      return;
    }
  }
  const next = e.path[e.pi];
  const nx = next % W;
  const ny = next / W | 0;
  if (Math.abs(nx - e.x) + Math.abs(ny - e.y) !== 1) {
    e.path = null;
    return;
  }
  if (!weaverPass(w, nx, ny)) {
    e.path = null;
    return;
  }
  if (occ[next]) {
    if (rnd2() < 0.5) e.path = null;
    return;
  }
  occ[e.y * W + e.x] = 0;
  e.x = nx;
  e.y = ny;
  occ[e.y * W + e.x] = 1;
  e.pi++;
}
function findPathWeaver(w, from, to) {
  if (from === to) return [];
  bfsSeen.fill(0);
  let head = 0;
  let tail = 0;
  bfsQueue[tail++] = from;
  bfsSeen[from] = 1;
  bfsPrev[from] = -1;
  while (head < tail) {
    const i = bfsQueue[head++];
    const x = i % W;
    for (let k = 0; k < 4; k++) {
      const j = i + [1, -1, W, -W][k];
      if (j < 0 || j >= N || bfsSeen[j]) continue;
      if (k < 2 && Math.abs(j % W - x) > 1) continue;
      const jx = j % W;
      const jy = j / W | 0;
      if (!weaverPass(w, jx, jy)) continue;
      bfsSeen[j] = 1;
      bfsPrev[j] = i;
      if (j === to) {
        const path = [];
        for (let c = to; c !== from; c = bfsPrev[c]) path.push(c);
        path.reverse();
        return path;
      }
      bfsQueue[tail++] = j;
    }
  }
  return null;
}
function chooseNextSite(w, e, rnd2) {
  const tips = [];
  const runs = [];
  const junctions = [];
  for (let i = W; i < N - W; i++) {
    if (w.mat[i] !== Mat.Lattice) continue;
    let n = 0;
    if (w.mat[i - 1] === Mat.Lattice) n++;
    if (w.mat[i + 1] === Mat.Lattice) n++;
    if (w.mat[i - W] === Mat.Lattice) n++;
    if (w.mat[i + W] === Mat.Lattice) n++;
    if (n <= 1) tips.push(i);
    else if (n === 2) runs.push(i);
    else junctions.push(i);
  }
  let t = -1;
  if (rnd2() < 0.8 && tips.length) {
    let bestD = Infinity;
    for (const c of tips) {
      const d = Math.abs(c % W - e.x) + Math.abs((c / W | 0) - e.y);
      if (d < bestD) {
        bestD = d;
        t = c;
      }
    }
  } else {
    const r = rnd2();
    let pool;
    if (r < 0.5) pool = tips.length ? tips : runs.length ? runs : junctions;
    else if (r < 0.7) pool = runs.length ? runs : tips.length ? tips : junctions;
    else if (r < 0.8) pool = junctions.length ? junctions : runs.length ? runs : tips;
    else {
      e.tx = -1;
      return;
    }
    if (pool.length) t = pool[rnd2() * pool.length | 0];
  }
  if (t < 0) {
    e.tx = -1;
    return;
  }
  e.tx = t % W;
  e.ty = t / W | 0;
  e.path = null;
  e.sulk = w.tick + 900;
}
function growLine(w, x, y, rnd2, dx0 = 0, dy0 = 0, cls = 0) {
  let dirX = dx0;
  let dirY = dy0;
  const start = rnd2() * 4 | 0;
  if (dirX !== 0 || dirY !== 0) {
    return growLineFrom(w, x, y, dirX, dirY, rnd2, cls);
  }
  for (let a = 0; a < 4; a++) {
    const k = start + a & 3;
    const dx = [1, -1, 0, 0][k];
    const dy = [0, 0, 1, -1][k];
    const j = (y + dy) * W + x + dx;
    if (j >= 0 && j < N && w.mat[j] === Mat.Space) {
      dirX = dx;
      dirY = dy;
      break;
    }
  }
  if (dirX === 0 && dirY === 0) {
    dirX = [1, -1, 0, 0][start];
    dirY = dirX === 0 ? rnd2() < 0.5 ? 1 : -1 : 0;
  }
  growLineFrom(w, x, y, dirX, dirY, rnd2, cls);
}
function growLineFrom(w, x, y, dirX, dirY, rnd2, cls = 0) {
  let cx = x;
  let cy = y;
  const len = (2 + (rnd2() * 9 | 0)) * (cls === 1 ? 2 : 1);
  for (let st = 0; st < len; st++) {
    if (rnd2() < 0.12) {
      if (dirX !== 0) {
        dirY = rnd2() < 0.5 ? 1 : -1;
        dirX = 0;
      } else {
        dirX = rnd2() < 0.5 ? 1 : -1;
        dirY = 0;
      }
    }
    cx += dirX;
    cy += dirY;
    if (cx < 2 || cx >= W - 2 || cy < 2 || cy >= H - 2) return;
    const i = cy * W + cx;
    const m = w.mat[i];
    if (m === Mat.Space) {
      let n = 0;
      if (w.mat[i - 1] === Mat.Lattice) n++;
      if (w.mat[i + 1] === Mat.Lattice) n++;
      if (w.mat[i - W] === Mat.Lattice) n++;
      if (w.mat[i + W] === Mat.Lattice) n++;
      if (n >= 3 && rnd2() < 0.85) return;
      w.mat[i] = Mat.Lattice;
      if (cls === 2) {
        w.pipe[i] |= Pipe.Wire;
        w.networksDirty = true;
      }
    } else if (m !== Mat.Lattice) {
      if (cls === 0) return;
      if (m === Mat.Hull) return;
      if (cls === 2 && (m === Mat.Floor || m === Mat.Rubble) && w.pipe[i] === 0) {
        w.pipe[i] |= Pipe.Wire;
        w.networksDirty = true;
      }
      continue;
    }
    if (m === Mat.Lattice && cls === 2 && !(w.pipe[i] & Pipe.Wire)) {
      w.pipe[i] |= Pipe.Wire;
      w.networksDirty = true;
    }
  }
}
function seedBrood(w, rnd2) {
  for (let a = 0; a < 60; a++) {
    const x = 2 + (rnd2() * (W - 4) | 0);
    const y = 2 + (rnd2() * (H - 4) | 0);
    if (!entPass(w.mat[y * W + x]) || !isDark(w, y * W + x)) continue;
    if (spawnBrood(w, x, y)) return;
  }
  for (let a = 0; a < 60; a++) {
    const x = 2 + (rnd2() * (W - 4) | 0);
    const y = 2 + (rnd2() * (H - 4) | 0);
    if (!entPass(w.mat[y * W + x])) continue;
    if (spawnBrood(w, x, y)) return;
  }
}
function seedWeaver(w, rnd2) {
  if (!w.hullCells.length) return;
  for (let a = 0; a < 40; a++) {
    const i = w.hullCells[rnd2() * w.hullCells.length | 0];
    for (const off2 of [1, -1, W, -W]) {
      const j = i + off2;
      if (j >= 0 && j < N && w.mat[j] === Mat.Space) {
        spawnWeaver(w, j % W, j / W | 0);
        return;
      }
    }
  }
}
function spawnMound(w, x, y) {
  w.ents.push({
    kind: EntKind.Mound,
    x,
    y,
    hp: 60,
    cd: 0,
    timer: 0,
    flash: -99,
    home: y * W + x
    // the grove: a mound never forgets where it rose
  });
  occ[y * W + x] = 1;
}
const isPlantFoe = (o) => FACTION[o.kind] !== 5;
function spawnShrub(w, x, y) {
  w.ents.push({
    kind: EntKind.Shrub,
    x,
    y,
    hp: 15,
    cd: 0,
    timer: 0,
    flash: -99,
    home: y * W + x
  });
  occ[y * W + x] = 1;
}
function stepShrub(w, e, rnd2) {
  const foe = nearestEnt(w, e, isPlantFoe, 1);
  if (foe && w.tick >= e.timer) {
    foe.e.hp -= 8;
    foe.e.flash = w.tick;
    e.flash = w.tick;
    e.timer = w.tick + 50;
    return;
  }
  if (w.tick >= (e.workT ?? 0)) {
    const ci = e.y * W + e.x;
    for (const j of [ci - 1, ci + 1, ci - W, ci + W]) {
      if (j < 0 || j >= N) continue;
      if ((w.mat[j] === Mat.Floor || w.mat[j] === Mat.Rubble) && rnd2() < 0.3) {
        w.mat[j] = Mat.Vine;
        w.solidFuel[j] = Math.max(w.solidFuel[j], 0.45);
        e.workT = w.tick + 120;
        e.flash = w.tick;
        return;
      }
    }
    e.workT = w.tick + 60;
  }
  const hx = (e.home ?? 0) % W;
  const hy = (e.home ?? 0) / W | 0;
  if (Math.abs(e.x - hx) + Math.abs(e.y - hy) > 12) moveToward(w, e, hx, hy, rnd2);
  else if (rnd2() < 0.5) wander(w, e, rnd2);
}
function stepMound(w, e, rnd2) {
  const enraged = e.hp < 20;
  if (enraged) e.cd = Math.max(0, e.cd - 14);
  const hx = (e.home ?? e.y * W + e.x) % W;
  const hy = (e.home ?? e.y * W + e.x) / W | 0;
  let alarm = null;
  if (!enraged) {
    for (let dy = -8; dy <= 8 && !alarm; dy += 2)
      for (let dx = -8; dx <= 8; dx += 2) {
        const j = (hy + dy) * W + hx + dx;
        if (j < 0 || j >= N || w.burn[j] === 0) continue;
        const near = nearestEnt(w, e, isPlantFoe, 14);
        if (near) alarm = near.e;
        break;
      }
  }
  const prey = nearestEnt(w, e, isPlantFoe, enraged ? 12 : 2);
  if (prey && prey.d <= 1) {
    if (w.tick >= e.timer) {
      prey.e.hp -= 40;
      prey.e.flash = w.tick;
      e.flash = w.tick;
      e.timer = w.tick + (enraged ? 20 : 40);
      if (prey.e.hp <= 0) splatter(w, prey.e);
    }
    return;
  }
  const target = enraged ? (prey == null ? void 0 : prey.e) ?? null : alarm ?? (prey && onGreen(w, prey.e) ? prey.e : null);
  if (target) {
    const leash = enraged ? 40 : 10;
    if (Math.abs(target.x - hx) + Math.abs(target.y - hy) <= leash) {
      moveAlongPath(w, e, target.x, target.y, rnd2);
      return;
    }
  }
  const dHome = Math.abs(e.x - hx) + Math.abs(e.y - hy);
  if (dHome > 6) moveToward(w, e, hx, hy, rnd2);
  else if (rnd2() < 0.15) wander(w, e, rnd2);
}
function onGreen(w, o) {
  const i = o.y * W + o.x;
  for (const j of [i, i - 1, i + 1, i - W, i + W]) {
    if (j >= 0 && j < N && (w.mat[j] === Mat.Vine || w.mat[j] === Mat.Tree)) return true;
  }
  return false;
}
function moundPulse(w, rnd2) {
  if (w.tick % 600 !== 0) return;
  let shrubs = 0;
  for (const o of w.ents) if (o.kind === EntKind.Shrub && o.hp > 0) shrubs++;
  if (shrubs < 8) {
    for (let tries = 0; tries < 40; tries++) {
      const i = rnd2() * N | 0;
      if (w.mat[i] !== Mat.Vine || occ[i]) continue;
      let green = 0;
      const x = i % W;
      const y = i / W | 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = (y + dy) * W + x + dx;
          if (j >= 0 && j < N && (w.mat[j] === Mat.Vine || w.mat[j] === Mat.Tree)) green++;
        }
      if (green >= 8) {
        spawnShrub(w, x, y);
        break;
      }
    }
  }
  let mounds = 0;
  for (const o of w.ents) if (o.kind === EntKind.Mound && o.hp > 0) mounds++;
  if (mounds >= 4) return;
  let bestI = -1;
  let bestGreen = 0;
  for (let tries = 0; tries < 80; tries++) {
    const i = rnd2() * N | 0;
    if (w.mat[i] !== Mat.Vine || occ[i]) continue;
    let green = 0;
    const x = i % W;
    const y = i / W | 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const j = (y + dy) * W + x + dx;
        if (j < 0 || j >= N) continue;
        if (w.mat[j] === Mat.Vine || w.mat[j] === Mat.Tree) green++;
      }
    if (green > bestGreen) {
      bestGreen = green;
      bestI = i;
    }
  }
  if (bestI >= 0 && bestGreen >= 14) {
    w.pushNews("the grove WAKES — a shambling mound rises");
    spawnMound(w, bestI % W, bestI / W | 0);
  }
}
let headlessTicks = 0;
function resetEntityState() {
  resetKernel();
  headlessTicks = 0;
}
function stepEntities(w, rnd2) {
  rebuildOcc(w);
  rebuildClaims(w);
  if (w.pendingPods.length) {
    const due = w.pendingPods.filter((p) => p.at <= w.tick);
    if (due.length) {
      w.pendingPods = w.pendingPods.filter((p) => p.at > w.tick);
      for (const p of due) disembark(w, p.x, p.y, p.count);
    }
  }
  if (w.tick % 300 === 0 && w.tick >= w.nextPodTick) {
    const aliens = countKind(w, EntKind.Roamer) + countKind(w, EntKind.Brood) * 3 + (countKind(w, EntKind.Egg) >> 1);
    const breachers = countKind(w, EntKind.Breacher);
    const capNow = Math.min(TUNE.podCapMax, 8 + (aliens >> 1));
    if (aliens >= TUNE.podTrigger && breachers < capNow) {
      const podSize = aliens >= 20 ? TUNE.squadSizeMajor : TUNE.squadSize;
      const podCount = Math.min(4, 1 + (aliens / 60 | 0));
      for (let p = 0; p < podCount; p++) {
        const i = podLandingSite(w, rnd2);
        if (i >= 0) requestPod(w, i % W, i / W | 0, podSize);
      }
      const interval = aliens >= 24 ? 1500 + (rnd2() * 1500 | 0) : 4e3 + (rnd2() * 4e3 | 0);
      w.nextPodTick = w.tick + interval;
    }
  }
  if (w.shots.length) w.shots = w.shots.filter((sh) => w.tick - sh.t < 9);
  if (w.bursts.length) w.bursts = w.bursts.filter((b) => w.tick - b.t < 30);
  if (w.rites.length) w.rites = w.rites.filter((r2) => w.tick - r2.t < 60);
  lampRecovery(w);
  const chaosNow = w.burningCells * 2 + Math.sqrt(w.ventedThisTick) * 12 + Math.sqrt(w.leakingCells) * 5 + w.destruction * 1.5 + (w.melted ? 150 : 0);
  if (chaosNow < TUNE.chaosNotch) w.calmTicks++;
  else w.calmTicks = 0;
  const urgency = 1 - Math.min(1, chaosNow / 240);
  if (w.calmTicks > TUNE.calmFuse + 300 - urgency * 1200) {
    w.calmTicks = -(1800 - urgency * 1500) | 0;
    let hive = 0;
    let military = 0;
    let servs = 0;
    let weavs = 0;
    let scavs = 0;
    for (const e2 of w.ents) {
      if (e2.hp <= 0) continue;
      if (e2.kind === EntKind.Roamer) hive += 1;
      else if (e2.kind === EntKind.Brood) hive += 3;
      else if (e2.kind === EntKind.Egg) hive += 0.5;
      else if (e2.kind === EntKind.Breacher || e2.kind === EntKind.Militor) military++;
      else if (e2.kind === EntKind.Servitor) servs++;
      else if (e2.kind === EntKind.Weaver) weavs++;
      else if (e2.kind === EntKind.Scav) scavs++;
    }
    let pendingWork = 0;
    for (const plan of w.buildPlans)
      for (const st of plan.steps) if (!stepDone(w, st)) pendingWork++;
    const hiveDef = Math.max(0, (10 - hive) / 10);
    const milDef = hive >= 10 ? Math.max(0, 1 - military / (hive / 5)) : 0;
    const crewDef = servs < 5 && pendingWork > 80 ? 1 : 0;
    const voidFrac = 1 - w.builtCells / N;
    const weavDef = (weavs === 0 ? 1 : weavs < 3 ? 0.5 : 0) * Math.min(0.9, voidFrac);
    const scavDef = scavs === 0 && w.tick > 2500 ? 0.25 : 0;
    const best = Math.max(hiveDef, milDef, crewDef, weavDef, scavDef);
    if (best <= 0) {
      const roll = rnd2();
      if (roll < 0.5) {
        w.pushNews("storyteller: too quiet — a spore is sent to stir the pot");
        seedBrood(w, rnd2);
      } else if (roll < 0.75) {
        w.pushNews("storyteller: too quiet — a scav flotilla is sent to stir the pot");
        dockScavs(w, rnd2, 3);
      } else {
        w.pushNews("storyteller: too quiet — a weaver is sent to stir the pot");
        seedWeaver(w, rnd2);
      }
    } else if (best === crewDef) {
      w.pushNews("storyteller: a wreck with no hands — rescue crews inbound");
      dockServitors(w, rnd2);
    } else if (best === hiveDef) {
      w.pushNews("storyteller: the food web thins — spores drift in");
      const n = 1 + (urgency * 2 | 0);
      for (let k = 0; k < n; k++) seedBrood(w, rnd2);
    } else if (best === milDef) {
      const i = podLandingSite(w, rnd2);
      if (i >= 0) requestPod(w, i % W, i / W | 0, TUNE.squadSize);
    } else if (best === weavDef) {
      w.pushNews("storyteller: the void yawns — a weaver drifts in");
      seedWeaver(w, rnd2);
    } else {
      w.pushNews("storyteller: unclaimed salvage — a scav flotilla clamps on");
      dockScavs(w, rnd2, 3);
    }
  }
  const noReactor = (!w.reactorAlive || w.reactorCells.length === 0) && !w.arrivalsOff;
  const srvCount = countKind(w, EntKind.Servitor);
  if (noReactor) {
    if (w.tick % 600 === 0 && srvCount < 4) {
      for (let a = 0; a < 120; a++) {
        const i = rnd2() * N | 0;
        if ((w.mat[i] === Mat.Rubble || w.mat[i] === Mat.Floor) && !occ[i]) {
          spawnServitor(w, i % W, i / W | 0);
          break;
        }
      }
    }
    if (w.tick % 1500 === 0 && srvCount < 8) dockServitors(w, rnd2);
  } else if (w.tick % 1800 === 0 && srvCount === 0) {
    for (let a = 0; a < 120; a++) {
      const i = rnd2() * N | 0;
      if ((w.mat[i] === Mat.Rubble || w.mat[i] === Mat.Floor) && !occ[i]) {
        spawnServitor(w, i % W, i / W | 0);
        break;
      }
    }
  }
  if (w.reactorAlive && !w.melted) {
    const debtDue = w.tick % 240 === 0 && w.servitorDebt > 0;
    let pendingWork = 0;
    for (const plan of w.buildPlans) {
      for (const st of plan.steps) {
        if (!stepDone(w, st)) pendingWork++;
      }
    }
    const fireCrew = Math.min(6, w.burningCells / 3 | 0);
    const crewTarget = pendingWork === 0 && fireCrew === 0 ? 0 : Math.min(16, 2 + (pendingWork / 30 | 0) + Math.round((w.darkFloorFrac ?? 0) * 8) + fireCrew);
    const crewNow = countKind(w, EntKind.Servitor) + countKind(w, EntKind.Militor);
    const cadence = fireCrew > 0 && crewNow < crewTarget ? 60 : crewNow < crewTarget * 0.7 ? 180 : 600;
    const baseline = w.tick % cadence === 0 && crewNow < crewTarget;
    if (debtDue && crewNow < crewTarget + TUNE.debtHeadroom || baseline) {
      const p = w.periReactor.find((i) => entPass(w.mat[i]) && !occ[i]);
      if (p !== void 0) {
        const threats = countKind(w, EntKind.Roamer) + countKind(w, EntKind.Brood) * 2;
        const milCap = Math.max(2, Math.min(8, 1 + (threats >> 1)));
        const militors = countKind(w, EntKind.Militor);
        if (militors < milCap && rnd2() < w.aggression) spawnMilitor(w, p % W, p / W | 0);
        else spawnServitor(w, p % W, p / W | 0);
        if (w.servitorDebt > 0) w.servitorDebt--;
      }
    }
  }
  moundPulse(w, rnd2);
  reaverPulse(w, rnd2);
  if (w.tick % 1500 === 750) wakeDormantHearts(w);
  drownedPulse(w, rnd2);
  if (!w.reactorAlive || w.reactorCells.length === 0) {
    headlessTicks++;
    if (headlessTicks > 4e3 && headlessTicks % 2e3 === 0) {
      const hands = countKind(w, EntKind.Servitor) + countKind(w, EntKind.Militor);
      const drafts = w.buildPlans.filter((p) => !p.restore).length;
      const restores = w.buildPlans.filter((p) => p.restore).length;
      w.pushNews(`the ship lies HEADLESS — ${hands} hands, resurrection struggling`);
      console.warn(
        `[derelict] headless ${headlessTicks} ticks: hands=${hands} draftPlans=${drafts} restorePlans=${restores} blueprint=${!!w.blueprint} melted=${w.melted}`
      );
    }
  } else {
    headlessTicks = 0;
  }
  if (!w.reactorAlive || w.reactorCells.length === 0) {
    if (w.tick % 60 === 0) attemptSuccession(w);
  } else if (w.tick % 300 === 0) attemptSuccession(w);
  if (w.tick % 600 === 0) {
    w.hullCells.length = 0;
    let gc = 0;
    let bc = 0;
    let fl = 0;
    let dk = 0;
    for (let i = 0; i < N; i++) {
      if (w.mat[i] !== Mat.Space) bc++;
      if (w.mat[i] === Mat.Hull) w.hullCells.push(i);
      else if (w.mat[i] === Mat.Growth) gc++;
      else if (w.mat[i] === Mat.Floor) {
        fl++;
        if (w.lightLevel[i] < 0.25) dk++;
      }
    }
    w.growthCells = gc;
    w.builtCells = bc;
    w.darkFloorFrac = fl > 0 ? dk / fl : 1;
  }
  if (w.tick % 300 === 0) {
    if (w.buildPlans.length > 1) {
      const owner = /* @__PURE__ */ new Set();
      const ordered = [...w.buildPlans].sort((a, b) => a.touched - b.touched);
      for (const plan of ordered) {
        plan.steps = plan.steps.filter((st) => {
          if (owner.has(st.i)) return false;
          owner.add(st.i);
          return true;
        });
      }
      w.buildPlans = w.buildPlans.filter((p) => p.steps.length > 0);
    }
    if (w.buildPlans.length) {
      const heartBeats = w.reactorAlive && w.reactorCells.length > 0;
      w.buildPlans = w.buildPlans.filter(
        (plan) => !plan.restore && plan.steps.some((st) => !stepDone(w, st)) && w.tick - plan.touched < 4e3 && !(heartBeats && // a plan that CONTAINS the beating heart is that heart's own
        // completion — canceling it kills the coolant tank mid-build
        !plan.steps.some((st) => w.reactorCells.includes(st.i)) && plan.steps.some(
          (st) => st.mc === Machine.Reactor && !stepDone(w, st) && !w.reactorCells.includes(st.i)
        ) && // a rival the crew can reach is insubordination; one across
        // an impassable void is a marooned colony — a lifeboat, and
        // the seed of a second brain. Let it live.
        rivalReachable(w, plan))
      );
    }
    refreshRestorePlan(w);
  }
  let alienCount = 0;
  for (const e of w.ents) if (FACTION[e.kind] === 0) alienCount++;
  if (alienCount > 0) {
    w.lastAlienTick = w.tick;
  } else if (w.tick - w.lastAlienTick > 2400) {
    if (w.tick % 90 === 0) {
      const k = w.ents.findIndex((e) => e.kind === EntKind.Breacher);
      if (k >= 0) w.ents.splice(k, 1);
    }
    if (countKind(w, EntKind.Breacher) === 0 && w.tick % 600 === 0 && rnd2() < 0.35) {
      for (let a = 0; a < 30; a++) {
        const x = 2 + (rnd2() * (W - 4) | 0);
        const y = 2 + (rnd2() * (H - 4) | 0);
        if (entPass(w.mat[y * W + x])) {
          spawnBrood(w, x, y);
          break;
        }
      }
    }
  }
  for (const e of w.ents) {
    if (e.hp <= 0) continue;
    if (--e.cd > 0) continue;
    e.cd = CADENCE[e.kind];
    stepOne(w, e, rnd2);
  }
  if (w.ents.some((e) => e.hp <= 0)) {
    for (const e of w.ents) {
      if (e.hp <= 0) {
        if (FACTION[e.kind] === 6) {
          ectoSplat(w, e.x, e.y);
          continue;
        }
        splatter(w, e);
        if ((e.kind === EntKind.Servitor || e.kind === EntKind.Militor) && e.departed !== true) {
          w.servitorDebt += 2;
          if (nearestEnt(w, e, (o) => isXeno(o) || o.kind === EntKind.Scav, 10)) {
            w.crewDeaths.push({ i: e.y * W + e.x, t: w.tick });
            if (w.crewDeaths.length > 8) w.crewDeaths.shift();
          }
        }
      }
    }
    w.ents = w.ents.filter((e) => e.hp > 0);
  }
}
const FLEE_DX = [1, -1, 0, 0];
const FLEE_DY = [0, 0, 1, -1];
function stepOne(w, e, rnd2) {
  const ci = e.y * W + e.x;
  const m = w.mat[ci];
  if (m === Mat.Space && e.kind !== EntKind.Weaver && e.kind !== EntKind.Servitor && e.kind !== EntKind.Militor) {
    e.hp = 0;
    return;
  }
  if (e.kind === EntKind.Servitor || e.kind === EntKind.Militor) {
    if (w.burn[ci] > 0 || w.temp[ci] > 520) e.hp -= 1;
    if (e.hp <= 0) return;
  } else if ((w.burn[ci] > 0 || w.temp[ci] > 240) && FACTION[e.kind] !== 6) {
    e.hp -= FACTION[e.kind] === 0 ? 3 : 2;
    if (e.kind === EntKind.Brood) alarmHive(w, e.x, e.y);
    if (e.hp <= 0) return;
  }
  if (e.kind === EntKind.Breacher && w.air[ci] < 0.1) {
    e.cd += 4;
  }
  const painT = e.kind === EntKind.Servitor || e.kind === EntKind.Militor ? 520 : 240;
  if ((w.burn[ci] > 0 || w.temp[ci] > painT) && e.kind !== EntKind.Egg && e.kind !== EntKind.Brood && FACTION[e.kind] !== 6) {
    let bdx = 0;
    let bdy = 0;
    let bt = Infinity;
    for (let k = 0; k < 4; k++) {
      const dx = FLEE_DX[k];
      const dy = FLEE_DY[k];
      const j = (e.y + dy) * W + e.x + dx;
      if (j < 0 || j >= N) continue;
      if (!entPass(w.mat[j]) || occ[j] || w.burn[j] > 0) continue;
      if (w.temp[j] < bt) {
        bt = w.temp[j];
        bdx = dx;
        bdy = dy;
      }
    }
    if (bt < w.temp[ci] && tryMove(w, e, bdx, bdy)) return;
  }
  switch (e.kind) {
    case EntKind.Brood:
      stepBrood(w, e, rnd2);
      break;
    case EntKind.Egg: {
      const intruder = nearestEnt(w, e, isWarmBody, 6);
      if (intruder) e.timer = 0;
      if (--e.timer <= 0) {
        if (e.cls === 1) {
          markOcc(e, 0);
          if (spawnBrood(w, e.x, e.y, e.lin)) {
            e.hp = 0;
            e.departed = true;
          } else {
            markOcc(e, 1);
            for (const o of w.ents) {
              if (o.kind !== EntKind.Roamer || o.hp <= 0) continue;
              if (Math.abs(o.x - e.x) <= 2 && Math.abs(o.y - e.y) <= 2) displaceTo(w, o, 3);
            }
            let landed = 0;
            placeAround(w, e.x, e.y, 3, (x, y) => {
              spawnRoamer(w, x, y, e.lin);
              landed++;
            });
            if (landed > 0) {
              e.hp = 0;
              e.departed = true;
            } else {
              e.timer = 30;
            }
          }
        } else if (countKind(w, EntKind.Roamer) < ROAMER_CAP) {
          spawnRoamer(w, e.x, e.y, e.lin);
          e.hp = 0;
          e.departed = true;
        } else {
          e.timer = 20;
        }
      }
      break;
    }
    case EntKind.Roamer:
      stepRoamer(w, e, rnd2);
      break;
    case EntKind.Breacher:
      stepBreacher(w, e, rnd2);
      break;
    case EntKind.Scav:
      stepScav(w, e, rnd2);
      break;
    case EntKind.Servitor:
      stepServitor(w, e, rnd2);
      break;
    case EntKind.Weaver:
      stepWeaver(w, e, rnd2);
      break;
    case EntKind.Mound:
      stepMound(w, e, rnd2);
      break;
    case EntKind.Shrub:
      stepShrub(w, e, rnd2);
      break;
    case EntKind.Reaver:
      stepReaver(w, e, rnd2);
      break;
    case EntKind.Militor:
      stepMilitor(w, e, rnd2);
      break;
    case EntKind.Haunt:
      stepHaunt(w, e, rnd2);
      break;
    case EntKind.Ghast:
      stepGhast(w, e, rnd2);
      break;
    case EntKind.Ashen:
      stepAshen(w, e, rnd2);
      break;
  }
}
function describeTask(w, e) {
  switch (e.kind) {
    case EntKind.Mound:
      return e.hp < 20 ? "BLIND RAGE — the green remembers" : "standing guard over the grove";
    case EntKind.Shrub:
      return "gardening, slowly";
    case EntKind.Haunt:
      return "lingering — it remembers dying here";
    case EntKind.Ghast:
      return "keeping the scar";
    case EntKind.Ashen:
      return "keeping the tomb";
    case EntKind.Reaver: {
      const prey2 = nearestEnt(w, e, (o) => FACTION[o.kind] === 0, 24);
      if (prey2) return "reaping the swarm";
      if (countKind(w, EntKind.Roamer) >= 10) {
        return e.sulk && w.tick < e.sulk ? "stalking — the prey is beyond reach" : "stalking distant prey";
      }
      return "returning to the vault";
    }
    case EntKind.Brood:
      return "nesting, laying eggs";
    case EntKind.Egg:
      if (e.cls === 1) return e.timer <= 12 ? "royal egg — a mother stirs within" : "royal egg, slowly ripening";
      return e.timer <= 6 ? "incubating — nearly ripe" : "incubating";
    case EntKind.Roamer: {
      const prey = nearestEnt(w, e, isWarmBody, 12);
      const fresh = e.pg !== void 0 && e.pg > 0 && w.tick - e.pg < 300;
      const hunger = e.fed !== void 0 ? w.tick - e.fed : 0;
      if (prey && prey.d <= 1) return "savaging prey";
      if (e.rage && fresh) return "rushing to the kill";
      if (hunger > 6e3) return "starving — wasting away";
      if (prey) return "stalking, waiting for the pack";
      if (fresh) return "following alarm scent";
      if (hunger > 3e3) return "famished, raiding shipward";
      return "prowling";
    }
    case EntKind.Breacher: {
      const who = ["gunner", "torcher", "squad leader"][e.cls ?? 0];
      const t = nearestEnt(w, e, isMarineTarget, 16);
      if (t && t.d <= 7) return `${who}: weapons free`;
      if (t) return `${who}: advancing on contact`;
      if (e.cls === 2) {
        if (e.sulk && w.tick < e.sulk && e.patrol) return "squad leader: patrolling (route was blocked)";
        if (e.tx !== void 0 && e.tx >= 0)
          return e.patrol ? "squad leader: sweeping the ship" : "squad leader: leading the purge";
        return "squad leader: regrouping";
      }
      const leader = nearestLeader(w, e);
      if (!leader) return `${who}: no squad leader — patrolling`;
      const d = Math.abs(leader.x - e.x) + Math.abs(leader.y - e.y);
      if (d > 4) return `${who}: rejoining the squad`;
      if (e.cls === 1 && e.cutI !== void 0 && e.cutI >= 0) return "cutting through the plating";
      if (e.cls === 1) return "torcher: burning the resin";
      return "gunner: holding formation";
    }
    case EntKind.Scav: {
      const threat = nearestEnt(w, e, isScary, 7);
      const cargo = e.cargo ?? 0;
      if (e.cls === 2) return "laying cover smoke";
      if (e.cls === 1 && e.tx !== void 0 && e.tx >= 0) return `rustling a machine (cargo ${cargo})`;
      if (threat) return "fleeing!";
      if (cargo >= 6) return `hauling loot to the airlock (${cargo} crates)`;
      if (e.hp <= 2) return "limping back to the airlock";
      if (e.tx !== void 0 && e.tx >= 0) return `salvaging (cargo ${cargo}/6)`;
      return `sniffing for loot (cargo ${cargo}/6)`;
    }
    case EntKind.Servitor: {
      if (e.tx !== void 0 && e.tx >= 0) {
        const i = e.ty * W + e.tx;
        if (w.burn[i] > 0) return "fighting a fire";
        const hit2 = planAt(w, i);
        if (hit2) {
          if (hit2.st.mc === Machine.Reactor) return "building a new reactor";
          if (hit2.st.mc === Machine.CoolantTank) return "building a coolant plant";
          if (hit2.plan.restore) return "restoring the ship to spec";
          return "constructing — reclaiming the ruin";
        }
        if (surplusReactor(w, i)) return "decommissioning a surplus reactor";
        if (ventingEdge(w, i) || hullGap(w, i)) return "sealing a hull breach";
        if (w.pipe[i] !== 0 && w.pipeBroken[i]) return "repairing a conduit";
        if (e.mode === 4) return "returning to the heart";
        if (e.mode === 3) return "surveying the frontier";
        return "en route to repairs";
      }
      if (e.sulk && w.tick < e.sulk) return "rerouting around an obstruction";
      return "standing by — ship nominal";
    }
    case EntKind.Weaver: {
      const courting = (e.bored ?? 0) > 10 ? " · courting" : "";
      if (e.cls === 1)
        return (e.tx !== void 0 && e.tx >= 0 ? "striding to the span" : "blasting a bridge over the ship") + courting;
      if (e.cls === 2)
        return e.tx !== void 0 && e.tx >= 0 ? "threading the lightbridge" : "laying conductive strand";
      return (e.tx !== void 0 && e.tx >= 0 ? "crawling to new growth" : "weaving the lattice") + courting;
    }
    case EntKind.Militor: {
      const foe = nearestEnt(w, e, isXeno, 14);
      if (foe) return foe.d <= 2 ? "engaging the hive" : "closing on a contact";
      const thief = nearestEnt(w, e, isThief, 10);
      if (thief) return "culling a looter";
      for (let k = w.crewDeaths.length - 1; k >= 0; k--) {
        if (w.tick - w.crewDeaths[k].t < 2400) return "responding to a crew death";
      }
      if (e.fought !== void 0 && w.tick - e.fought < 1200) return "standing guard, weapons hot";
      return "on watch (will stand down soon)";
    }
  }
  return "";
}
const ENTS = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  EntKind,
  GONE,
  brainName,
  countKind,
  describeTask,
  entPass,
  findPath,
  isDark,
  planAt,
  planStepAt,
  requestPod,
  resetEntityState,
  spawnBreacher,
  spawnBrood,
  spawnEgg,
  spawnGhast,
  spawnHaunt,
  spawnMilitor,
  spawnMound,
  spawnReaver,
  spawnRoamer,
  spawnScav,
  spawnServitor,
  spawnShrub,
  spawnWeaver,
  stepDone,
  stepEntities
}, Symbol.toStringTag, { value: "Module" }));
function mulberry32(seed2) {
  let a = seed2 >>> 0;
  return function() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const HULL = 2;
function generate(seed2) {
  const w = new World();
  w.seed = seed2;
  const rng = mulberry32(seed2);
  const mask = new Uint8Array(W * H);
  const rects = [];
  const mainW = ri(rng, 68, 88);
  const mainH = ri(rng, 40, 52);
  const main = {
    x: ri(rng, 8, 18),
    y: (H - mainH >> 1) + ri(rng, -4, 4),
    w: mainW,
    h: mainH
  };
  rects.push(main);
  const OV = 7;
  const nSec = ri(rng, 2, 3);
  for (let k = 0; k < nSec; k++) {
    const host = rects[rng() * rects.length | 0];
    const side = ri(rng, 0, 3);
    const sw = ri(rng, 18, 36);
    const sh = ri(rng, 16, 30);
    let x;
    let y;
    if (side === 0) {
      x = host.x + host.w - OV;
      y = host.y + ri(rng, -6, host.h - sh + 6);
    } else if (side === 1) {
      x = host.x - sw + OV;
      y = host.y + ri(rng, -6, host.h - sh + 6);
    } else if (side === 2) {
      y = host.y - sh + OV;
      x = host.x + ri(rng, -6, host.w - sw + 6);
    } else {
      y = host.y + host.h - OV;
      x = host.x + ri(rng, -6, host.w - sw + 6);
    }
    x = clamp(x, 3, W - sw - 3);
    y = clamp(y, 3, H - sh - 3);
    const ox = Math.min(x + sw, host.x + host.w) - Math.max(x, host.x);
    const oy = Math.min(y + sh, host.y + host.h) - Math.max(y, host.y);
    if (ox < OV - 1 || oy < OV - 1) continue;
    rects.push({ x, y, w: sw, h: sh });
  }
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) mask[y * W + x] = 1;
  }
  for (let pass = 0; pass < 3; pass++) {
    const cut = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!mask[i]) continue;
        let exposed = 0;
        if (!mask[i - 1]) exposed++;
        if (!mask[i + 1]) exposed++;
        if (!mask[i - W]) exposed++;
        if (!mask[i + W]) exposed++;
        if (exposed >= 2 && rng() < 0.8) cut.push(i);
      }
    for (const c of cut) mask[c] = 0;
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++)
        for (let dx = -2; dx <= 2 && !edge; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || !mask[ny * W + nx]) edge = true;
        }
      w.mat[i] = edge ? Mat.Hull : Mat.Floor;
    }
  }
  const rooms = [];
  for (const r of rects) {
    bsp(w, rng, r.x + HULL, r.y + HULL, r.x + r.w - HULL, r.y + r.h - HULL, 0, rooms);
  }
  w.rooms = rooms;
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        if (w.mat[w.idx(x, y)] === Mat.Floor) w.roomId[w.idx(x, y)] = room.id;
      }
  }
  const leafs = rooms.filter((r) => !r.isCorridor).sort((r1, r2) => r2.w * r2.h - r1.w * r1.h);
  const assign = (idx, kind) => {
    if (leafs[idx]) leafs[idx].kind = kind;
  };
  assign(0, "reactor");
  assign(1, "fuel");
  assign(2, "o2");
  assign(3, "munitions");
  for (let i = 4; i < leafs.length; i++) leafs[i].kind = rng() < 0.5 ? "quarters" : "hold";
  const reactorRoom = leafs[0];
  placeBlock(w, reactorRoom, 4, Machine.Reactor, w.reactorCells);
  const rcx = reactorRoom.x + reactorRoom.w / 2;
  const rcy = reactorRoom.y + reactorRoom.h / 2;
  let coolRoom;
  let coolDist = Infinity;
  for (let i = 4; i < leafs.length; i++) {
    const lr = leafs[i];
    if (lr.w < 5 || lr.h < 5) continue;
    const d = Math.abs(lr.x + lr.w / 2 - rcx) + Math.abs(lr.y + lr.h / 2 - rcy);
    if (d < coolDist) {
      coolDist = d;
      coolRoom = lr;
    }
  }
  if (coolRoom) coolRoom.kind = "coolant";
  placeBlock(w, coolRoom ?? reactorRoom, 2, Machine.CoolantTank, null);
  let coolRoom2;
  let cool2Dist = -Infinity;
  for (let i = 4; i < leafs.length; i++) {
    const lr = leafs[i];
    if (lr === coolRoom || lr.w < 5 || lr.h < 5) continue;
    const d = Math.abs(lr.x + lr.w / 2 - rcx) + Math.abs(lr.y + lr.h / 2 - rcy);
    if (d > cool2Dist) {
      cool2Dist = d;
      coolRoom2 = lr;
    }
  }
  if (coolRoom2) {
    coolRoom2.kind = "coolant";
    placeBlock(w, coolRoom2, 2, Machine.CoolantTank, null);
  }
  if (leafs[1]) placeBlock(w, leafs[1], 3, Machine.FuelTank, w.fuelTankCells);
  if (leafs[2]) placeBlock(w, leafs[2], 2, Machine.O2Gen, null);
  if (leafs[3]) placeBlock(w, leafs[3], 2, Machine.Munitions, w.munitionsCells);
  for (const room of rooms) {
    const lights = [];
    const nx = Math.max(1, Math.round(room.w / 10));
    const ny = Math.max(1, Math.round(room.h / 10));
    for (let ky = 0; ky < ny; ky++)
      for (let kx = 0; kx < nx; kx++) {
        if (rng() < 0.08) continue;
        const tx2 = room.x + Math.min(room.w - 1, Math.round((kx + 0.5) * room.w / nx));
        const ty2 = room.y + Math.min(room.h - 1, Math.round((ky + 0.5) * room.h / ny));
        let lc2 = -1;
        for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (ty2 + oy) * W + tx2 + ox;
          if (j >= 0 && j < w.mat.length && w.mat[j] === Mat.Floor && w.machine[j] === 0) {
            lc2 = j;
            break;
          }
        }
        if (lc2 >= 0) {
          w.machine[lc2] = Machine.Light;
          lights.push(lc2);
        }
      }
    if (lights.length) {
      room.lightCell = lights[0];
      room.lightCells = lights;
    }
    if (!room.isCorridor) {
      const vc = findFloorCell(w, room, "bottom");
      if (vc >= 0) {
        w.machine[vc] = Machine.Vent;
        w.ventCells.push(vc);
      }
    }
  }
  const botRoom = rooms.find((r) => !r.isCorridor && r.kind === "hold" && r.w >= 5 && r.h >= 5);
  if (botRoom) {
    botRoom.kind = "botanics";
    const bcx = botRoom.x + (botRoom.w >> 1);
    const bcy = botRoom.y + (botRoom.h >> 1);
    for (let k = 0; k < 3; k++) {
      const tx2 = bcx + ri(rng, -2, 2);
      const ty2 = bcy + ri(rng, -1, 1);
      const ti2 = ty2 * W + tx2;
      if (w.mat[ti2] === Mat.Floor && w.machine[ti2] === 0) w.mat[ti2] = Mat.Tree;
    }
    for (let a = 0; a < 14; a++) {
      const vx = bcx + ri(rng, -3, 3);
      const vy = bcy + ri(rng, -2, 2);
      const vi = vy * W + vx;
      if (w.mat[vi] === Mat.Floor && w.machine[vi] === 0) {
        w.mat[vi] = Mat.Vine;
        w.solidFuel[vi] = 0.45;
      }
    }
    const pi2 = bcy * W + bcx;
    if (w.mat[pi2] === Mat.Floor || w.mat[pi2] === Mat.Vine) {
      w.liqType[pi2] = Liquid.Coolant;
      w.liqAmt[pi2] = 0.8;
    }
  }
  for (const room of rooms) {
    if (room.kind !== "quarters" && room.kind !== "hold") continue;
    const density = room.kind === "quarters" ? 0.045 : 0.025;
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++) {
        if (rng() >= density) continue;
        const blob = 2 + Math.floor(rng() * 4);
        let cx = x;
        let cy = y;
        for (let b = 0; b < blob; b++) {
          const i = w.idx(cx, cy);
          if (cx > room.x && cx < room.x + room.w - 1 && cy > room.y && cy < room.y + room.h - 1 && w.mat[i] === Mat.Floor && w.machine[i] === Machine.None) {
            w.solidFuel[i] = Math.max(w.solidFuel[i], 0.25 + rng() * 0.55);
          }
          if (rng() < 0.5) cx += rng() < 0.5 ? 1 : -1;
          else cy += rng() < 0.5 ? 1 : -1;
        }
      }
  }
  const reactorAdj = blockPerimeter(w, Machine.Reactor);
  const coolantAdj = blockPerimeter(w, Machine.CoolantTank);
  const fuelAdj = blockPerimeter(w, Machine.FuelTank);
  const o2Adj = blockPerimeter(w, Machine.O2Gen);
  const munAdj = blockPerimeter(w, Machine.Munitions);
  w.periReactor = reactorAdj;
  w.periCoolTank = coolantAdj;
  w.periO2Gen = o2Adj;
  w.periFuelTank = fuelAdj;
  const wireTargets = [];
  for (const room of rooms) {
    const lcs = room.lightCells;
    if (lcs) wireTargets.push(...lcs);
    else {
      const lc = room.lightCell;
      if (lc !== void 0 && lc >= 0) wireTargets.push(lc);
    }
  }
  if (o2Adj.length) wireTargets.push(o2Adj[0]);
  if (munAdj.length) wireTargets.push(munAdj[0]);
  routeTree(w, reactorAdj, wireTargets, Pipe.Wire);
  if (fuelAdj.length && reactorAdj.length) routeTree(w, fuelAdj, [reactorAdj[0]], Pipe.Fuel);
  const rcx2 = reactorRoom.x + (reactorRoom.w >> 1);
  const rcy2 = reactorRoom.y + (reactorRoom.h >> 1);
  const farRooms = rooms.filter((r) => !r.isCorridor && r.w >= 5 && r.h >= 5).sort(
    (a, b) => Math.abs(b.x + b.w / 2 - rcx2) + Math.abs(b.y + b.h / 2 - rcy2) - (Math.abs(a.x + a.w / 2 - rcx2) + Math.abs(a.y + a.h / 2 - rcy2))
  );
  const bayRooms = [coolRoom, coolRoom2].filter((r) => r != null);
  let wpIdx = 0;
  for (const br of bayRooms) {
    const bayAdj = coolantAdj.filter((c) => {
      const x = c % W;
      const y = c / W | 0;
      return x >= br.x - 1 && x <= br.x + br.w && y >= br.y - 1 && y <= br.y + br.h;
    });
    if (!bayAdj.length || !reactorAdj.length) continue;
    const wpRoom = farRooms.length ? farRooms[wpIdx % farRooms.length] : null;
    const wp = wpRoom ? findFloorCell(w, wpRoom, wpIdx % 2 ? "top" : "bottom") : -1;
    wpIdx++;
    if (wp >= 0) {
      routeTree(w, bayAdj, [wp], Pipe.Coolant);
      routeTree(w, [wp], [reactorAdj[0]], Pipe.Coolant);
    } else {
      routeTree(w, bayAdj, [reactorAdj[0]], Pipe.Coolant);
    }
  }
  if (!bayRooms.length && coolantAdj.length && reactorAdj.length) {
    routeTree(w, coolantAdj, [reactorAdj[0]], Pipe.Coolant);
  }
  routeTree(w, o2Adj, w.ventCells, Pipe.O2);
  for (let i = 0; i < w.pipe.length; i++) {
    if (w.pipe[i] & Pipe.Wire && w.mat[i] === Mat.Floor) w.solidFuel[i] += 0.12;
  }
  for (let i = 0; i < w.mat.length; i++) {
    const m = w.mat[i];
    if (m === Mat.Space) {
      w.temp[i] = -100;
      continue;
    }
    w.temp[i] = 18;
    if (m === Mat.Floor || m === Mat.DoorOpen || m === Mat.Rubble) w.air[i] = 1;
  }
  for (const c of w.reactorCells) w.temp[c] = 70;
  const srng = mulberry32(seed2 ^ 2654435769);
  for (let i = 0; i < w.starfield.length; i++) {
    const v = srng();
    if (v < 25e-4) w.starfield[i] = 0.18 + srng() * 0.5;
  }
  for (let i = 0; i < w.mat.length; i++) {
    if (w.mat[i] === Mat.Hull) w.hullCells.push(i);
  }
  w.blueprintGrafts = [];
  w.blueprint = {
    mat: w.mat.slice(),
    machine: w.machine.slice(),
    pipe: w.pipe.slice(),
    roomId: w.roomId.slice()
  };
  w.aggression = 0.1 + rng() * 0.3;
  w.brainId = 1;
  for (const c of w.reactorCells) w.reactorOwner[c] = 1;
  for (let i9 = 0; i9 < N; i9++)
    if (w.mat[i9] === Mat.Machine && w.machine[i9] === Machine.CoolantTank) w.reactorOwner[i9] = 1;
  const habitable = rooms.filter(
    (r) => !r.isCorridor && (r.kind === "quarters" || r.kind === "hold") && r.w >= 6 && r.h >= 6
  );
  shuffle(habitable, rng);
  const nNests = Math.min(habitable.length, ri(rng, 2, 3));
  for (let n = 0; n < nNests; n++) {
    const room = habitable[n];
    const bx = room.x + (room.w >> 1);
    const by = room.y + (room.h >> 1);
    spawnBrood(w, bx, by);
    const nestLin = w.ents.length ? w.ents[w.ents.length - 1].lin : void 0;
    for (let a = 0; a < 30; a++) {
      const gx = bx + ri(rng, -4, 4);
      const gy = by + ri(rng, -3, 3);
      if (!w.inBounds(gx, gy)) continue;
      const gi = gy * W + gx;
      if (w.mat[gi] === Mat.Floor && Math.abs(gx - bx) + Math.abs(gy - by) <= 5) {
        w.mat[gi] = Mat.Growth;
        w.solidFuel[gi] = 0;
      }
    }
    for (let egg = 0; egg < 3; egg++) {
      const gx = bx + ri(rng, -3, 3);
      const gy = by + ri(rng, -2, 2);
      if (w.inBounds(gx, gy) && w.mat[gy * W + gx] === Mat.Growth) {
        spawnEgg(w, gx, gy, ri(rng, 10, 60), false, nestLin);
      }
    }
    for (let r = 0; r < 4; r++) {
      const gx = bx + ri(rng, -3, 3);
      const gy = by + ri(rng, -3, 3);
      if (w.inBounds(gx, gy) && w.mat[gy * W + gx] === Mat.Growth) spawnRoamer(w, gx, gy, nestLin);
    }
  }
  const nSquads = Math.min(Math.max(0, habitable.length - nNests), ri(rng, 1, 2));
  for (let sq = 0; sq < nSquads; sq++) {
    const room = habitable[nNests + sq];
    const bx = room.x + (room.w >> 1);
    const by = room.y + (room.h >> 1);
    let placed = 0;
    const roster = [2, 0, 1];
    for (let dy = -2; dy <= 2 && placed < 3; dy++)
      for (let dx = -2; dx <= 2 && placed < 3; dx++) {
        const gx = bx + dx;
        const gy = by + dy;
        if (!w.inBounds(gx, gy)) continue;
        const m = w.mat[gy * W + gx];
        if (m === Mat.Floor) {
          spawnBreacher(w, gx, gy, roster[placed]);
          placed++;
        }
      }
  }
  for (let sv = 0; sv < 2; sv++) {
    const p = w.periReactor[sv];
    if (p !== void 0 && w.mat[p] === Mat.Floor) spawnServitor(w, p % W, p / W | 0);
  }
  w.networksDirty = true;
  return w;
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng() * (i + 1) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function bsp(w, rng, x0, y0, x1, y1, depth, rooms) {
  const rw = x1 - x0;
  const rh = y1 - y0;
  const MIN = 15;
  if (rw <= MIN && rh <= MIN || depth > 5 || rw < 6 || rh < 6) {
    rooms.push({
      id: rooms.length,
      x: x0,
      y: y0,
      w: rw,
      h: rh,
      isCorridor: false,
      kind: "hold",
      lit: false
    });
    return;
  }
  let vertical;
  if (rw > rh * 1.25) vertical = true;
  else if (rh > rw * 1.25) vertical = false;
  else vertical = rng() < 0.5;
  if (vertical && rw < 14) vertical = false;
  if (!vertical && rh < 14) vertical = true;
  const corridor = depth < 2 && (vertical ? rw : rh) > 30;
  if (vertical) {
    const s = ri(rng, x0 + Math.floor(rw * 0.35), x0 + Math.floor(rw * 0.65));
    if (corridor) {
      for (let y = y0; y < y1; y++)
        for (let x = s - 1; x <= s + 1; x++) w.mat[w.idx(x, y)] = Mat.Floor;
      rooms.push({
        id: rooms.length,
        x: s - 1,
        y: y0,
        w: 3,
        h: rh,
        isCorridor: true,
        kind: "corridor",
        lit: false
      });
      wallLine(w, rng, s - 2, y0, s - 2, y1 - 1);
      wallLine(w, rng, s + 2, y0, s + 2, y1 - 1);
      bsp(w, rng, x0, y0, s - 2, y1, depth + 1, rooms);
      bsp(w, rng, s + 3, y0, x1, y1, depth + 1, rooms);
    } else {
      wallLine(w, rng, s, y0, s, y1 - 1);
      bsp(w, rng, x0, y0, s, y1, depth + 1, rooms);
      bsp(w, rng, s + 1, y0, x1, y1, depth + 1, rooms);
    }
  } else {
    const s = ri(rng, y0 + Math.floor(rh * 0.35), y0 + Math.floor(rh * 0.65));
    if (corridor) {
      for (let x = x0; x < x1; x++)
        for (let y = s - 1; y <= s + 1; y++) w.mat[w.idx(x, y)] = Mat.Floor;
      rooms.push({
        id: rooms.length,
        x: x0,
        y: s - 1,
        w: rw,
        h: 3,
        isCorridor: true,
        kind: "corridor",
        lit: false
      });
      wallLine(w, rng, x0, s - 2, x1 - 1, s - 2);
      wallLine(w, rng, x0, s + 2, x1 - 1, s + 2);
      bsp(w, rng, x0, y0, x1, s - 2, depth + 1, rooms);
      bsp(w, rng, x0, s + 3, x1, y1, depth + 1, rooms);
    } else {
      wallLine(w, rng, x0, s, x1 - 1, s);
      bsp(w, rng, x0, y0, x1, s, depth + 1, rooms);
      bsp(w, rng, x0, s + 1, x1, y1, depth + 1, rooms);
    }
  }
}
function wallLine(w, rng, x0, y0, x1, y1) {
  const horizontal = y0 === y1;
  const len = horizontal ? x1 - x0 + 1 : y1 - y0 + 1;
  if (len <= 0) return;
  const doors = /* @__PURE__ */ new Set();
  let at = ri(rng, 2, 5);
  while (at < len - 3) {
    doors.add(at);
    doors.add(at + 1);
    at += ri(rng, 7, 13);
  }
  if (doors.size === 0 && len > 5) {
    const d = ri(rng, 2, len - 4);
    doors.add(d);
    doors.add(d + 1);
  }
  for (let k = 0; k < len; k++) {
    const x = horizontal ? x0 + k : x0;
    const y = horizontal ? y0 : y0 + k;
    const i = w.idx(x, y);
    if (w.mat[i] !== Mat.Floor) continue;
    if (doors.has(k)) {
      w.mat[i] = rng() < 0.4 ? Mat.DoorOpen : Mat.DoorClosed;
    } else {
      w.mat[i] = Mat.Wall;
    }
  }
}
function placeBlock(w, room, size, type, cellsOut, where) {
  if (!room || room.w < size + 2 || room.h < size + 2) return;
  let bx, by;
  {
    bx = room.x + (room.w - size >> 1);
    by = room.y + (room.h - size >> 1);
  }
  for (let tries = 0; tries < 4; tries++) {
    let clear = true;
    for (let y = by; y < by + size && clear; y++)
      for (let x = bx; x < bx + size && clear; x++) {
        if (w.mat[w.idx(x, y)] !== Mat.Floor) clear = false;
      }
    if (clear) break;
    bx = room.x + 1 + tries * 7 % Math.max(1, room.w - size - 1);
    by = room.y + room.h - size - 1;
  }
  for (let y = by; y < by + size; y++)
    for (let x = bx; x < bx + size; x++) {
      const i = w.idx(x, y);
      if (w.mat[i] !== Mat.Floor) continue;
      w.mat[i] = Mat.Machine;
      w.machine[i] = type;
      w.air[i] = 0;
      cellsOut == null ? void 0 : cellsOut.push(i);
    }
}
function blockPerimeter(w, type) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = w.idx(x, y);
      if (w.mat[i] !== Mat.Machine || w.machine[i] !== type) continue;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (w.mat[j] === Mat.Floor && !seen.has(j)) {
          seen.add(j);
          out.push(j);
        }
      }
    }
  return out;
}
function findFloorCell(w, room, edge) {
  const ys = edge === "top" ? range(room.y, room.y + room.h) : range(room.y + room.h - 1, room.y - 1, -1);
  for (const y of ys) {
    for (let x = room.x + (room.w >> 1), k = 0; k < room.w; k++) {
      const xx = room.x + (x - room.x + k) % room.w;
      const i = w.idx(xx, y);
      if (w.mat[i] === Mat.Floor && w.machine[i] === Machine.None) return i;
    }
  }
  return -1;
}
function range(a, b, step = 1) {
  const out = [];
  for (let v = a; step > 0 ? v < b : v > b; v += step) out.push(v);
  return out;
}
const routeDist = new Float32Array(W * H);
const routePrev = new Int32Array(W * H);
function routeTree(w, srcCells, targets, bit) {
  if (srcCells.length === 0 || targets.length === 0) return;
  const dist = routeDist.fill(Infinity);
  const prev = routePrev.fill(-1);
  const heap = [];
  const push = (cost, cell) => {
    heap.push(cost, cell);
    let i = heap.length / 2 - 1;
    while (i > 0) {
      const p = i - 1 >> 1;
      if (heap[p * 2] <= heap[i * 2]) break;
      swapPairs(heap, i, p);
      i = p;
    }
  };
  const pop = () => {
    const top = [heap[0], heap[1]];
    const n = heap.length / 2 - 1;
    heap[0] = heap[n * 2];
    heap[1] = heap[n * 2 + 1];
    heap.length -= 2;
    let i = 0;
    for (; ; ) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l * 2 < heap.length && heap[l * 2] < heap[m * 2]) m = l;
      if (r * 2 < heap.length && heap[r * 2] < heap[m * 2]) m = r;
      if (m === i) break;
      swapPairs(heap, i, m);
      i = m;
    }
    return top;
  };
  for (const s of srcCells) {
    dist[s] = 0;
    push(0, s);
  }
  while (heap.length) {
    const [c, cell] = pop();
    if (c > dist[cell]) continue;
    const x = cell % W;
    const y = cell / W | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + NBX[k];
      const ny = y + NBY[k];
      if (nx < 1 || nx >= W - 1 || ny < 1 || ny >= H - 1) continue;
      const j = ny * W + nx;
      const m = w.mat[j];
      const walkable = m === Mat.Floor || m === Mat.DoorOpen || m === Mat.DoorClosed || m === Mat.Rubble;
      if (!walkable) continue;
      let step = wallAdjacent(w, nx, ny) ? 1 : 6;
      if (m === Mat.DoorOpen || m === Mat.DoorClosed) step = 2;
      if (w.pipe[j] !== 0 && !(w.pipe[j] & bit)) step += 3;
      const nc = c + step;
      if (nc < dist[j]) {
        dist[j] = nc;
        prev[j] = cell;
        push(nc, j);
      }
    }
  }
  for (const dst of targets) {
    if (dst < 0 || !isFinite(dist[dst])) continue;
    let cur = dst;
    while (cur >= 0 && !(w.pipe[cur] & bit)) {
      w.pipe[cur] |= bit;
      cur = prev[cur];
    }
  }
}
const NBX = [1, -1, 0, 0];
const NBY = [0, 0, 1, -1];
function wallAdjacent(w, x, y) {
  return isSolidAt(w, x - 1, y) || isSolidAt(w, x + 1, y) || isSolidAt(w, x, y - 1) || isSolidAt(w, x, y + 1);
}
function isSolidAt(w, x, y) {
  const m = w.mat[y * W + x];
  return m === Mat.Hull || m === Mat.Wall || m === Mat.Machine;
}
function swapPairs(h, a, b) {
  const c0 = h[a * 2], c1 = h[a * 2 + 1];
  h[a * 2] = h[b * 2];
  h[a * 2 + 1] = h[b * 2 + 1];
  h[b * 2] = c0;
  h[b * 2 + 1] = c1;
}
function dreamShip(w, seed2) {
  if (w.reactorCells.length === 0) return;
  let scratch = null;
  let dx = 0;
  let dy = 0;
  let bestScratch = null;
  let bestDx = 0;
  let bestDy = 0;
  let bestClipped = Infinity;
  for (let attempt = 0; attempt < 8; attempt++) {
    const s2 = seed2 + attempt * 2654435769 >>> 0;
    const cand = generate(s2);
    if (!cand.blueprint || cand.reactorCells.length === 0) continue;
    const src = cand.reactorCells[0];
    const dst = w.reactorCells[0];
    const cdx = dst % W - src % W;
    const cdy = (dst / W | 0) - (src / W | 0);
    let clipped = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (cand.blueprint.mat[y * W + x] === Mat.Space) continue;
        const tx = x + cdx;
        const ty = y + cdy;
        if (tx < 1 || tx >= W - 1 || ty < 1 || ty >= H - 1) clipped++;
      }
    if (clipped === 0) {
      scratch = cand;
      dx = cdx;
      dy = cdy;
      break;
    }
    if (clipped < bestClipped) {
      bestClipped = clipped;
      bestScratch = cand;
      bestDx = cdx;
      bestDy = cdy;
    }
  }
  if (!scratch) {
    scratch = bestScratch;
    dx = bestDx;
    dy = bestDy;
  }
  if (!scratch || !scratch.blueprint) return;
  const bp = {
    mat: new Uint8Array(W * H),
    machine: new Uint8Array(W * H),
    pipe: new Uint8Array(W * H),
    roomId: new Int16Array(W * H).fill(-1)
  };
  const roomIdOffset = w.rooms.length;
  for (let y = 0; y < H; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= H) continue;
    for (let x = 0; x < W; x++) {
      const sx = x - dx;
      if (sx < 0 || sx >= W) continue;
      const si = sy * W + sx;
      const di = y * W + x;
      bp.mat[di] = scratch.blueprint.mat[si];
      bp.machine[di] = scratch.blueprint.machine[si];
      bp.pipe[di] = scratch.blueprint.pipe[si];
      const rid = scratch.blueprint.roomId[si];
      bp.roomId[di] = rid >= 0 ? rid + roomIdOffset : -1;
    }
  }
  for (let i = 0; i < bp.mat.length; i++) {
    if (bp.machine[i] === Machine.Reactor && !w.reactorCells.includes(i)) {
      bp.machine[i] = Machine.None;
      bp.mat[i] = Mat.Floor;
    }
  }
  for (const c of w.reactorCells) {
    bp.mat[c] = Mat.Machine;
    bp.machine[c] = Machine.Reactor;
  }
  for (const r of scratch.rooms) {
    const room = {
      ...r,
      id: r.id + roomIdOffset,
      x: r.x + dx,
      y: r.y + dy,
      lit: false
    };
    const lc = r.lightCell;
    if (lc !== void 0 && lc >= 0) {
      const lx = lc % W + dx;
      const ly = (lc / W | 0) + dy;
      room.lightCell = lx >= 0 && lx < W && ly >= 0 && ly < H ? ly * W + lx : void 0;
    }
    w.rooms.push(room);
  }
  w.blueprintGrafts = [];
  w.blueprint = bp;
  w.aggression = 0.15 + mulberry32((seed2 ^ 2654435769) >>> 0)() * 0.55;
}
const powered = new Uint8Array(N);
const coolReach = new Uint8Array(N);
const o2Reach = new Uint8Array(N);
const fuelReach = new Uint8Array(N);
let liquidScanFlip = false;
const NOFF = [-1, 1, -W, W];
const PASS = new Uint8Array(16);
PASS[Mat.Floor] = 1;
PASS[Mat.DoorOpen] = 1;
PASS[Mat.Rubble] = 1;
PASS[Mat.Space] = 1;
PASS[Mat.Growth] = 1;
PASS[Mat.Vine] = 1;
function simTick(w, rnd2) {
  w.tick++;
  w.ventedThisTick = 0;
  w.leakingCells = 0;
  processExplosions(w);
  if (w.networksDirty) rebuildNetworks(w);
  stepMachines(w);
  stepBotany(w, rnd2);
  stepBridgeGlow(w);
  stepCondGlow(w);
  stepDarkGlow(w);
  stepLeaks(w);
  stepGas(w);
  stepSmoke(w);
  stepHeat(w);
  stepFireAndDamage(w, rnd2);
  stepLiquids(w);
  stepEntities(w, rnd2);
  w.destruction *= 0.99;
}
function processExplosions(w) {
  if (w.explosions.length === 0) return;
  const queue = w.explosions;
  w.explosions = [];
  let destroyed = 0;
  for (const e of queue) {
    const r = e.r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = e.x + dx;
        const y = e.y + dy;
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const f = 1 - d / r;
        const i = y * W + x;
        const m = w.mat[i];
        if (m === Mat.Space) continue;
        w.temp[i] = Math.min(1600, w.temp[i] + e.power * f);
        if (f > 0.25) w.breakPipe(i);
        if (f > 0.6) {
          if (m === Mat.Hull) {
            w.mat[i] = Mat.Space;
            w.roomId[i] = -1;
            w.air[i] = 0;
            destroyed++;
          } else if (e.power > 1e3 && f > 0.82) {
            w.mat[i] = Mat.Space;
            w.roomId[i] = -1;
            w.air[i] = 0;
            clearMachine(w, i);
            destroyed++;
          } else if (m !== Mat.Floor && m !== Mat.Rubble) {
            w.mat[i] = Mat.Rubble;
            w.solidFuel[i] += 0.1;
            clearMachine(w, i);
            destroyed++;
          }
        } else if (f > 0.3) {
          if (m === Mat.Wall || m === Mat.DoorClosed || m === Mat.DoorOpen || m === Mat.Machine) {
            w.mat[i] = Mat.Rubble;
            w.solidFuel[i] += 0.1;
            clearMachine(w, i);
            destroyed++;
          }
        }
        if (gasPassable(w.mat[i]) && w.mat[i] !== Mat.Space) {
          w.smoke[i] = Math.min(2, w.smoke[i] + f * 1.4);
        }
      }
    }
  }
  w.destruction += destroyed;
  w.networksDirty = true;
}
function clearMachine(w, i) {
  if (w.machine[i] === Machine.Reactor) {
    const k = w.reactorCells.indexOf(i);
    if (k >= 0) w.reactorCells.splice(k, 1);
    if (w.reactorCells.length < 6) w.reactorAlive = false;
  }
  w.machine[i] = Machine.None;
}
function rebuildNetworks(w) {
  w.networksDirty = false;
  powered.fill(0);
  coolReach.fill(0);
  o2Reach.fill(0);
  fuelReach.fill(0);
  if (w.reactorAlive && !w.melted) {
    const seeds = [];
    for (const c of w.reactorCells) {
      if (w.machine[c] !== Machine.Reactor) continue;
      for (const j of [c - 1, c + 1, c - W, c + W]) {
        if (j >= 0 && j < N && w.pipe[j] & Pipe.Wire && !w.pipeBroken[j]) seeds.push(j);
      }
    }
    flood(w, Pipe.Wire, seeds, powered);
  }
  w.wirePowered.set(powered);
  for (const room of w.rooms) {
    const lc = room.lightCell;
    room.lit = lc !== void 0 && lc >= 0 && w.machine[lc] === Machine.Light && powered[lc] !== 0 && !w.pipeBroken[lc];
  }
  w.lightLevel.fill(0);
  const LIGHT_R = TUNE.lightRadius;
  for (let li = 0; li < N; li++) {
    const isFixture = w.machine[li] === Machine.Light;
    const isStrand = !isFixture && w.mat[li] === Mat.Lattice && (w.pipe[li] & Pipe.Wire) !== 0 && (li % W + (li / W | 0)) % 2 === 0;
    if (!isFixture && !isStrand) continue;
    if (powered[li] === 0 || w.pipeBroken[li]) continue;
    const dimF = isFixture ? 1 - (w.lampDim.get(li) ?? 0) : 1;
    if (dimF <= 0.02) continue;
    const fixR = LIGHT_R * dimF;
    lightQ[0] = li;
    lightDepth[li] = 1;
    const fx = li % W;
    const fy = li / W | 0;
    let qh = 0;
    let qt = 1;
    while (qh < qt) {
      const c = lightQ[qh++];
      const d = lightDepth[c];
      const ex = c % W - fx;
      const ey = (c / W | 0) - fy;
      const glow = Math.max(0, 1 - Math.sqrt(ex * ex + ey * ey) / (fixR + 1));
      if (glow > w.lightLevel[c]) w.lightLevel[c] = glow;
      if (d > fixR) continue;
      for (const nb of [c - 1, c + 1, c - W, c + W]) {
        if (nb < 0 || nb >= N) continue;
        if (lightDepth[nb] !== 0) continue;
        if (!PASS[w.mat[nb]] && w.mat[nb] !== Mat.Machine) continue;
        lightDepth[nb] = d + 1;
        lightQ[qt++] = nb;
      }
    }
    for (let k = 0; k < qt; k++) lightDepth[lightQ[k]] = 0;
  }
  flood(w, Pipe.Coolant, liveSeeds(w, Pipe.Coolant, Machine.CoolantTank), coolReach);
  let tanks = 0;
  for (let i = 0; i < N; i++) if (w.mat[i] === Mat.Machine && w.machine[i] === Machine.CoolantTank) tanks++;
  w.coolantTankCells = tanks;
  w.coolingActive = w.coolantReserve > 0 && reactorTouches(w, coolReach);
  flood(w, Pipe.Fuel, liveSeeds(w, Pipe.Fuel, Machine.FuelTank), fuelReach);
  const o2Powered = liveTouch(w, Machine.O2Gen, powered);
  w.activeVents.clear();
  if (o2Powered && w.o2Reserve > 0) {
    flood(w, Pipe.O2, liveSeeds(w, Pipe.O2, Machine.O2Gen), o2Reach);
    for (const vc of w.ventCells) {
      if (w.machine[vc] === Machine.Vent && o2Reach[vc] && !w.pipeBroken[vc]) w.activeVents.add(vc);
    }
  }
}
function liveSeeds(w, bit, type) {
  const out = [];
  for (let i = W; i < N - W; i++) {
    if (w.mat[i] !== Mat.Machine || w.machine[i] !== type) continue;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (w.pipe[j] & bit && !w.pipeBroken[j]) out.push(j);
    }
  }
  return out;
}
function reactorTouches(w, reach) {
  for (const c of w.reactorCells) {
    if (w.machine[c] !== Machine.Reactor) continue;
    for (const j of [c - 1, c + 1, c - W, c + W]) {
      if (j >= 0 && j < N && reach[j]) return true;
    }
  }
  return false;
}
function liveTouch(w, type, reach) {
  for (let i = W; i < N - W; i++) {
    if (w.mat[i] !== Mat.Machine || w.machine[i] !== type) continue;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (reach[j]) return true;
    }
  }
  return false;
}
function flood(w, bit, seeds, out) {
  const stack = [...seeds];
  for (const s of seeds) out[s] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    for (let k = 0; k < 4; k++) {
      const j = i + NOFF[k];
      if (j < 0 || j >= N || out[j]) continue;
      if (k < 2 && Math.abs(j % W - x) > 1) continue;
      if (w.pipe[j] & bit && !w.pipeBroken[j]) {
        out[j] = 1;
        stack.push(j);
      }
    }
  }
}
function noise2(x, y, s) {
  let h = x * 374761393 + y * 668265263 + s * 69069 | 0;
  h = (h ^ h >>> 13) >>> 0;
  return (h * 1274126177 >>> 0) / 4294967296;
}
function cataclysm(w, cx, cy) {
  w.pushNews("CATACLYSM — a heart dies, and takes the district with it");
  const R2 = Math.sqrt(W * W + H * H) * 0.26;
  const chained = /* @__PURE__ */ new Set();
  for (let i = 0; i < N; i++) {
    if (w.mat[i] !== Mat.Machine || w.machine[i] !== Machine.Reactor) continue;
    if (Math.hypot(i % W - cx, (i / W | 0) - cy) > R2 * 0.75) continue;
    if (Math.abs(i % W - cx) + Math.abs((i / W | 0) - cy) <= 2) continue;
    let dup = false;
    for (const c of chained) {
      if (Math.abs(c % W - i % W) + Math.abs((c / W | 0) - (i / W | 0)) <= 4) dup = true;
    }
    if (!dup) chained.add(i);
  }
  if (chained.size) w.pushNews("the blast reaches for the next heart — CHAIN DETONATION imminent");
  for (const c of chained) {
    w.pendingCataclysms.push({
      x: c % W,
      y: c / W | 0,
      at: w.tick + 40 + (chained.size + c % 7) * 25
    });
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (w.mat[i] === Mat.Space) continue;
      const d = Math.hypot(x - cx, y - cy);
      const t = Math.min(1, d / R2);
      const n = 0.5 * noise2(x >> 3, y >> 3, w.seed) + 0.3 * noise2(x >> 2, y >> 2, w.seed ^ 7) + 0.2 * noise2(x, y, w.seed ^ 13);
      const keep = t * t * 0.95 + n * 0.5 - 0.32;
      if (keep < 0.2) {
        w.mat[i] = Mat.Space;
        w.roomId[i] = -1;
        w.air[i] = 0;
        w.pipe[i] = 0;
        w.pipeBroken[i] = 0;
        w.machine[i] = 0;
        w.liqAmt[i] = 0;
        w.liqType[i] = 0;
        w.burn[i] = 0;
        w.solidFuel[i] = 0;
        w.smoke[i] = 0;
        w.temp[i] = -100;
      } else if (keep < 0.3) {
        if (w.mat[i] !== Mat.Rubble) {
          w.mat[i] = Mat.Rubble;
          w.solidFuel[i] += 0.1;
        }
        w.breakPipe(i);
        w.machine[i] = 0;
        w.temp[i] = Math.min(1500, w.temp[i] + 700);
        w.smoke[i] = Math.min(2, w.smoke[i] + 1.2);
      } else {
        w.temp[i] = Math.min(1500, w.temp[i] + (1 - t) * 450);
        w.smoke[i] = Math.min(2, w.smoke[i] + (1 - t) * 0.8);
      }
    }
  }
  w.reactorCells.length = 0;
  w.buildPlans = [];
  w.blueprint = null;
  w.blueprintGrafts = [];
  w.destruction += 600;
  w.networksDirty = true;
}
function stepBotany(w, rnd2) {
  if (w.botanyOff) return;
  const lum = (j) => 0.35 + 1.8 * Math.min(1, Math.max(w.lightLevel[j], w.bridgeGlow[j]));
  for (let s2 = 0; s2 < 6; s2++) {
    const i = rnd2() * N | 0;
    const m = w.mat[i];
    if (m === Mat.Vine) {
      let vn = 0;
      let tn = 0;
      for (const j2 of [i - 1, i + 1, i - W, i + W]) {
        if (j2 < 0 || j2 >= N) continue;
        if (w.mat[j2] === Mat.Vine) vn++;
        if (w.mat[j2] === Mat.Tree) tn++;
      }
      if (vn >= 3 && tn === 0 && rnd2() < 0.15 * lum(i)) {
        w.mat[i] = Mat.Tree;
        continue;
      }
      const j = i + NOFF[rnd2() * 4 | 0];
      if (j < 0 || j >= N) continue;
      const mj = w.mat[j];
      const litLattice = mj === Mat.Lattice && Math.max(w.lightLevel[j], w.bridgeGlow[j]) >= 0.25;
      if (mj !== Mat.Floor && mj !== Mat.Rubble && mj !== Mat.Growth && !litLattice) continue;
      const damp = w.liqType[j] === Liquid.Coolant && w.liqAmt[j] > 0.05 || litLattice;
      if (rnd2() < (damp ? 0.25 : 0.02) * lum(j)) {
        w.mat[j] = Mat.Vine;
        w.solidFuel[j] = Math.max(w.solidFuel[j], 0.45);
      }
    } else if ((m === Mat.Floor || m === Mat.Rubble) && w.liqType[i] === Liquid.Coolant && w.liqAmt[i] > 0.3) {
      if (rnd2() < 0.01 * lum(i)) w.mat[i] = Mat.Vine;
    } else if (m === Mat.Growth) {
      if (rnd2() < 4e-3 * lum(i)) w.mat[i] = Mat.Vine;
    }
  }
}
function stepMachines(w) {
  if (w.pendingCataclysms.length) {
    const due = w.pendingCataclysms.filter((p) => p.at <= w.tick);
    if (due.length) {
      w.pendingCataclysms = w.pendingCataclysms.filter((p) => p.at > w.tick);
      for (const p of due) {
        const i = p.y * W + p.x;
        if (w.mat[i] === Mat.Machine && w.machine[i] === Machine.Reactor) {
          w.melted = true;
          w.reactorAlive = false;
          cataclysm(w, p.x, p.y);
        }
      }
    }
  }
  if (w.reactorAlive && !w.melted && w.reactorCells.length) {
    w.coolantReserve = Math.min(3600, w.coolantReserve + Math.min(0.5, w.coolantTankCells * 0.05));
    if (w.coolingActive) {
      w.coreHeat = Math.max(0, w.coreHeat * 0.995 - 0.5);
    } else {
      if (w.coreHeat === 0) w.pushNews("coolant flow LOST — the core is climbing");
      w.coreHeat += 1;
    }
    const target = 70 + w.coreHeat * 0.35;
    for (const c of w.reactorCells) {
      if (w.temp[c] < target) w.temp[c] = Math.min(target, w.temp[c] + 8);
    }
    if (w.coreHeat >= 3e3) {
      w.melted = true;
      w.reactorAlive = false;
      w.networksDirty = true;
      const c = w.reactorCells[w.reactorCells.length / 2 | 0];
      cataclysm(w, c % W, c / W | 0);
    }
  }
  if (w.o2Reserve > 0) {
    for (const vc of w.activeVents) {
      if (w.air[vc] < 1) {
        const d = Math.min(0.035, 1 - w.air[vc]);
        w.air[vc] += d;
        w.o2Reserve -= d;
      }
    }
  }
  for (const i of w.munitionsCells) {
    if (w.machine[i] === Machine.Munitions && w.temp[i] > 300 && !w.cookedOff.has(i)) {
      w.cookedOff.add(i);
      w.explosions.push({ x: i % W, y: i / W | 0, r: 8, power: 1600 });
    }
  }
  for (const i of w.fuelTankCells) {
    if (w.machine[i] === Machine.FuelTank && w.temp[i] > 420 && !w.cookedOff.has(i)) {
      w.cookedOff.add(i);
      w.explosions.push({ x: i % W, y: i / W | 0, r: 7, power: 1300 });
      w.fuelReserve = Math.max(0, w.fuelReserve - 200);
    }
  }
}
function nearReach(i, reach) {
  return reach[i - 1] !== 0 || reach[i + 1] !== 0 || reach[i - W] !== 0 || reach[i + W] !== 0;
}
function stepLeaks(w) {
  for (const i of w.leaks) {
    const bits = w.pipe[i];
    const m = w.mat[i];
    if (!gasPassable(m) || m === Mat.Space) continue;
    let leaking = false;
    if (bits & Pipe.Fuel && w.fuelReserve > 0 && nearReach(i, fuelReach)) {
      if (w.liqType[i] === Liquid.None || w.liqType[i] === Liquid.Fuel) {
        w.liqType[i] = Liquid.Fuel;
        const d = Math.min(0.09, Math.max(0, 1.4 - w.liqAmt[i]));
        w.liqAmt[i] += d;
        w.fuelReserve -= d;
        leaking = true;
      }
    }
    if (bits & Pipe.Coolant && w.coolantReserve > 0 && nearReach(i, coolReach)) {
      if (w.liqType[i] === Liquid.None || w.liqType[i] === Liquid.Coolant) {
        w.liqType[i] = Liquid.Coolant;
        const d = Math.min(0.07, Math.max(0, 1.2 - w.liqAmt[i]));
        w.liqAmt[i] += d;
        w.coolantReserve -= d;
        leaking = true;
      }
    }
    if (bits & Pipe.O2 && w.o2Reserve > 0 && nearReach(i, o2Reach)) {
      const d = Math.min(0.25, Math.max(0, 2 - w.air[i]));
      w.air[i] += d;
      w.o2Reserve -= d;
      leaking = true;
    }
    if (leaking) w.leakingCells++;
  }
}
function stepGas(w) {
  const Wc = W;
  const Hc = H;
  const a = w.air;
  const an = w.airNext;
  const mat = w.mat;
  const K = 0.2;
  let vented = 0;
  for (let y = 1; y < Hc - 1; y++) {
    const row = y * Wc;
    for (let x = 1; x < Wc - 1; x++) {
      const i = row + x;
      const m = mat[i];
      if (m === 0 || PASS[m] === 0) {
        an[i] = 0;
        continue;
      }
      const v = a[i];
      let flux = 0;
      let nm = mat[i - 1];
      if (nm === 0) {
        flux -= v;
        vented += K * v;
      } else if (PASS[nm]) flux += a[i - 1] - v;
      nm = mat[i + 1];
      if (nm === 0) {
        flux -= v;
        vented += K * v;
      } else if (PASS[nm]) flux += a[i + 1] - v;
      nm = mat[i - Wc];
      if (nm === 0) {
        flux -= v;
        vented += K * v;
      } else if (PASS[nm]) flux += a[i - Wc] - v;
      nm = mat[i + Wc];
      if (nm === 0) {
        flux -= v;
        vented += K * v;
      } else if (PASS[nm]) flux += a[i + Wc] - v;
      const nv = v + K * flux;
      an[i] = nv > 0 ? nv : 0;
    }
  }
  w.ventedThisTick += vented;
  w.air = an;
  w.airNext = a;
}
function stepSmoke(w) {
  const Wc = W;
  const Hc = H;
  const s = w.smoke;
  const sn = w.smokeNext;
  sn.fill(0);
  const mat = w.mat;
  const K = 0.16;
  for (let y = 1; y < Hc - 1; y++) {
    const row = y * Wc;
    for (let x = 1; x < Wc - 1; x++) {
      const i = row + x;
      const m = mat[i];
      if (m === 0 || PASS[m] === 0) {
        continue;
      }
      const v = s[i];
      let flux = 0;
      let nm = mat[i - 1];
      if (nm === 0) flux -= v;
      else if (PASS[nm]) flux += s[i - 1] - v;
      nm = mat[i + 1];
      if (nm === 0) flux -= v;
      else if (PASS[nm]) flux += s[i + 1] - v;
      nm = mat[i - Wc];
      if (nm === 0) flux -= v;
      else if (PASS[nm]) flux += s[i - Wc] - v;
      nm = mat[i + Wc];
      if (nm === 0) flux -= v;
      else if (PASS[nm]) flux += s[i + Wc] - v;
      let nv = (v + K * flux) * 0.995;
      if (nv > 0.01) {
        const theta = w.tick * 11e-4;
        const dxDrift = Math.cos(theta) > 0.3 ? 1 : Math.cos(theta) < -0.3 ? -1 : 0;
        const dyDrift = Math.sin(theta) > 0.3 ? 1 : Math.sin(theta) < -0.3 ? -1 : 0;
        const j = i + dxDrift + dyDrift * Wc;
        if ((dxDrift !== 0 || dyDrift !== 0) && j >= 0 && j < sn.length && mat[j] !== 0 && PASS[mat[j]] !== 0) {
          const carried = nv * 0.05;
          nv -= carried;
          sn[j] = (sn[j] || 0) + carried;
        }
      }
      sn[i] = (sn[i] || 0) + (nv > 4e-4 ? nv : 0);
    }
  }
  w.smoke = sn;
  w.smokeNext = s;
}
const INSU = new Uint8Array(16);
INSU[Mat.Wall] = 1;
INSU[Mat.Hull] = 1;
INSU[Mat.DoorClosed] = 1;
INSU[Mat.Machine] = 1;
INSU[Mat.Growth] = 1;
INSU[Mat.Lattice] = 1;
function stepHeat(w) {
  const Wc = W;
  const Hc = H;
  const t = w.temp;
  const tn = w.tempNext;
  const mat = w.mat;
  const K = 0.09;
  const INS = 0.15;
  for (let y = 1; y < Hc - 1; y++) {
    const row = y * Wc;
    for (let x = 1; x < Wc - 1; x++) {
      const i = row + x;
      const m = mat[i];
      if (m === 0) {
        tn[i] = -100;
        continue;
      }
      const v = t[i];
      const ii = INSU[m];
      let flux = 0;
      let nm = mat[i - 1];
      if (nm === 0) flux += (-100 - v) * 0.25;
      else {
        let f = t[i - 1] - v;
        if (ii || INSU[nm]) f *= INS;
        flux += f;
      }
      nm = mat[i + 1];
      if (nm === 0) flux += (-100 - v) * 0.25;
      else {
        let f = t[i + 1] - v;
        if (ii || INSU[nm]) f *= INS;
        flux += f;
      }
      nm = mat[i - Wc];
      if (nm === 0) flux += (-100 - v) * 0.25;
      else {
        let f = t[i - Wc] - v;
        if (ii || INSU[nm]) f *= INS;
        flux += f;
      }
      nm = mat[i + Wc];
      if (nm === 0) flux += (-100 - v) * 0.25;
      else {
        let f = t[i + Wc] - v;
        if (ii || INSU[nm]) f *= INS;
        flux += f;
      }
      tn[i] = v + K * flux + (20 - v) * 3e-3;
    }
  }
  w.temp = tn;
  w.tempNext = t;
}
const lightQ = new Int32Array(W * H);
const lightDepth = new Int32Array(W * H);
const M_DOORC = Mat.DoorClosed;
const M_DOORO = Mat.DoorOpen;
const M_RUBBLE = Mat.Rubble;
const M_GROWTH = Mat.Growth;
const P_WIRE = Pipe.Wire;
function igniteCell(w, j) {
  w.burn[j] = 1;
  if (w.pipe[j] !== 0) w.breakPipe(j);
  if (w.machine[j] === Machine.Light && w.temp[j] < 600) w.temp[j] = 600;
}
const L_NONE = Liquid.None;
const L_FUEL = Liquid.Fuel;
const L_COOL = Liquid.Coolant;
function glowBlocked(w, x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s2 = 1; s2 < steps; s2++) {
    const cx = x0 + Math.round((x1 - x0) * s2 / steps);
    const cy = y0 + Math.round((y1 - y0) * s2 / steps);
    const m = w.mat[cy * W + cx];
    if (m === Mat.Wall || m === Mat.Hull || m === Mat.DoorClosed || m === Mat.Machine || m === Mat.Tree)
      return true;
  }
  return false;
}
function stampFireGlow(w, x, y) {
  const flick = 0.85 + 0.35 * noise2(x, y, w.tick >> 1 ^ 24301);
  const rEff = 3 + 3 * noise2(y, x, w.tick >> 2 ^ 3870);
  const rOut = rEff + 1;
  const r2 = rOut * rOut;
  const ri2 = Math.ceil(rOut);
  for (let gy = -ri2; gy <= ri2; gy++) {
    const ay = y + gy;
    if (ay < 0 || ay >= H) continue;
    for (let gx = -ri2; gx <= ri2; gx++) {
      const dd = gx * gx + gy * gy;
      if (dd > r2) continue;
      const ax = x + gx;
      if (ax < 0 || ax >= W) continue;
      const gl = Math.sqrt(Math.max(0, 1 - Math.sqrt(dd) / rOut)) * flick;
      if (gl <= 0.02) continue;
      if (dd > 2 && glowBlocked(w, x, y, ax, ay)) continue;
      const j2 = ay * W + ax;
      if (gl > w.fireGlow[j2]) w.fireGlow[j2] = gl;
    }
  }
}
function stepDarkGlow(w) {
  w.darkGlow.fill(0);
  for (const e of w.ents) {
    if (e.hp <= 0 || e.kind !== EntKind.Ghast && e.kind !== EntKind.Ashen) continue;
    for (let gy = -5; gy <= 5; gy++) {
      const ay = e.y + gy;
      if (ay < 0 || ay >= H) continue;
      for (let gx = -5; gx <= 5; gx++) {
        const ax = e.x + gx;
        if (ax < 0 || ax >= W) continue;
        const d = Math.sqrt(gx * gx + gy * gy);
        if (d > 5.5) continue;
        const gl = Math.max(0, 1 - d / 5.5);
        const j2 = ay * W + ax;
        if (gl > w.darkGlow[j2]) w.darkGlow[j2] = gl;
      }
    }
  }
}
function stepCondGlow(w) {
  w.condGlow.fill(0);
  for (const e of w.ents) {
    if (e.hp <= 0 || e.kind !== EntKind.Weaver || e.cls !== 2) continue;
    const rOut = 2.5;
    for (let gy = -3; gy <= 3; gy++) {
      const ay = e.y + gy;
      if (ay < 0 || ay >= H) continue;
      for (let gx = -3; gx <= 3; gx++) {
        const ax = e.x + gx;
        if (ax < 0 || ax >= W) continue;
        const d = Math.sqrt(gx * gx + gy * gy);
        if (d > rOut) continue;
        const gl = Math.max(0, 1 - d / rOut);
        const j2 = ay * W + ax;
        if (gl > w.condGlow[j2]) w.condGlow[j2] = gl;
      }
    }
  }
}
function stepBridgeGlow(w) {
  w.bridgeGlow.fill(0);
  const theta = w.tick * Math.PI * 2 / 180;
  for (let i = W; i < N - W; i++) {
    if (w.mat[i] !== Mat.Lattice) continue;
    if (!(w.pipe[i] & Pipe.Wire)) continue;
    const x = i % W;
    const y = i / W | 0;
    const amp = w.wirePowered[i] ? 1 : 0.62;
    const rEff = (3.5 + 1.5 * Math.sin(theta + (x + y) * 0.15)) * amp;
    const rOut = rEff + 1;
    const r2 = rOut * rOut;
    const ri2 = Math.ceil(rOut);
    for (let gy = -ri2; gy <= ri2; gy++) {
      const ay = y + gy;
      if (ay < 0 || ay >= H) continue;
      for (let gx = -ri2; gx <= ri2; gx++) {
        const dd = gx * gx + gy * gy;
        if (dd > r2) continue;
        const ax = x + gx;
        if (ax < 0 || ax >= W) continue;
        const gl = 0.9 * amp * Math.sqrt(Math.max(0, 1 - Math.sqrt(dd) / rOut));
        if (gl <= 0.02) continue;
        const j2 = ay * W + ax;
        if (gl > w.bridgeGlow[j2]) w.bridgeGlow[j2] = gl;
      }
    }
  }
}
function stepFireAndDamage(w, rnd2) {
  const Wc = W;
  const Hc = H;
  w.burningCells = 0;
  w.fireGlow.fill(0);
  for (const sh of w.shots) {
    if (sh.k !== 1) continue;
    const age = w.tick - sh.t;
    if (age >= 9) continue;
    const fade = 1 - age / 9;
    for (const [px2, py2] of [[sh.x0, sh.y0], [sh.x0 + sh.x1 >> 1, sh.y0 + sh.y1 >> 1], [sh.x1, sh.y1]]) {
      const gr = 1 + 2 * noise2(px2, py2, w.tick >> 1 ^ 36887);
      const grOut = gr + 1;
      const gr2 = grOut * grOut;
      const gri = Math.ceil(grOut);
      for (let gy = -gri; gy <= gri; gy++) {
        const ay = py2 + gy;
        if (ay < 0 || ay >= H) continue;
        for (let gx = -gri; gx <= gri; gx++) {
          const dd = gx * gx + gy * gy;
          if (dd > gr2) continue;
          const ax = px2 + gx;
          if (ax < 0 || ax >= W) continue;
          const gl = Math.sqrt(Math.max(0, 1 - Math.sqrt(dd) / grOut)) * fade;
          if (gl <= 0.02) continue;
          if (dd > 2 && glowBlocked(w, px2, py2, ax, ay)) continue;
          const j2 = ay * W + ax;
          if (gl > w.fireGlow[j2]) w.fireGlow[j2] = gl;
        }
      }
    }
  }
  const mat = w.mat;
  const temp = w.temp;
  const burn = w.burn;
  const air = w.air;
  const smoke = w.smoke;
  const liqT = w.liqType;
  const liqA = w.liqAmt;
  const sfuel = w.solidFuel;
  const pipe = w.pipe;
  const pipeBroken = w.pipeBroken;
  for (let y = 1; y < Hc - 1; y++) {
    const row = y * Wc;
    for (let x = 1; x < Wc - 1; x++) {
      const i = row + x;
      const m = mat[i];
      if (m === 0) continue;
      if (m === Mat.Tree) {
        if (burn[i] > 0) {
          w.burningCells++;
          stampFireGlow(w, x, y);
          if (temp[i] < 1100) temp[i] = Math.min(1100, temp[i] + 80);
          smoke[i] = Math.min(2, smoke[i] + 0.15);
          for (let q = 0; q < 4; q++) {
            const j = i + NOFF[q];
            if (j < 0 || j >= N || mat[j] === 0) continue;
            temp[j] = Math.min(1500, temp[j] + 22);
            const mj2 = mat[j];
            if (burn[j] === 0 && (mj2 === Mat.Vine || mj2 === Mat.Tree) && rnd2() < 0.12) {
              burn[j] = 1;
              if (mj2 === Mat.Tree) sfuel[j] = Math.max(sfuel[j], 1.2);
            }
          }
          sfuel[i] -= 6e-3;
          if (sfuel[i] <= 0) {
            burn[i] = 0;
            mat[i] = Mat.Rubble;
            smoke[i] = 2;
          }
        } else if (temp[i] > 380) {
          burn[i] = 1;
          sfuel[i] = Math.max(sfuel[i], 1.2);
        }
        continue;
      }
      if (m === Mat.Lattice) {
        if (burn[i] > 0) {
          w.burningCells++;
          stampFireGlow(w, x, y);
          const roll = rnd2();
          if (roll < 15e-4) {
            burn[i] = 0;
            temp[i] = Math.min(temp[i], 120);
          } else if (roll < 0.014) {
            burn[i] = 0;
            mat[i] = 0;
            w.roomId[i] = -1;
            w.destruction += 1;
          } else if (rnd2() < 0.022) {
            const j = i + NOFF[rnd2() * 4 | 0];
            if (j >= 0 && j < N && mat[j] === Mat.Lattice && burn[j] === 0) {
              burn[j] = 1;
            }
          }
        } else if (temp[i] > 500) {
          burn[i] = 1;
        }
        continue;
      }
      const T = temp[i];
      if (m === Mat.Vine && burn[i] > 0) {
        w.burningCells++;
        stampFireGlow(w, x, y);
        if (temp[i] < 900) temp[i] = Math.min(900, temp[i] + 90);
        for (let q = 0; q < 4; q++) {
          const j = i + NOFF[q];
          if (j < 0 || j >= N) continue;
          const mj2 = mat[j];
          if (burn[j] === 0 && (mj2 === Mat.Vine || mj2 === Mat.Tree) && rnd2() < 0.35) {
            burn[j] = 1;
            if (mj2 === Mat.Tree) sfuel[j] = Math.max(sfuel[j], 1.2);
          }
          if (mj2 !== 0) temp[j] = Math.min(1500, temp[j] + 14);
        }
        sfuel[i] -= 0.025;
        if (sfuel[i] <= 0.02) {
          burn[i] = 0;
          mat[i] = Mat.Rubble;
          smoke[i] = Math.min(2, smoke[i] + 0.8);
        }
        continue;
      }
      if (m === Mat.Vine && burn[i] === 0 && temp[i] > 320) {
        burn[i] = 1;
        continue;
      }
      if (T < 140 && burn[i] === 0) continue;
      if (burn[i] > 0 && liqT[i] === L_COOL && liqA[i] > 0.05) {
        burn[i] = 0;
        if (temp[i] > 120) temp[i] = 120;
        smoke[i] = Math.min(2, smoke[i] + 0.6);
      }
      if (liqT[i] === L_COOL && liqA[i] > 0 && T > 140) {
        const d = Math.min(liqA[i], 0.012);
        liqA[i] -= d;
        temp[i] -= d * 900;
        smoke[i] = Math.min(2, smoke[i] + d * 3);
        if (liqA[i] <= 1e-3) {
          liqA[i] = 0;
          liqT[i] = L_NONE;
        }
      }
      if (pipe[i] !== 0 && !pipeBroken[i] && T > 460) {
        w.breakPipe(i);
      }
      if ((m === M_DOORC || m === M_DOORO) && T > 780) {
        mat[i] = M_RUBBLE;
        w.destruction += 1;
      }
      if (m === M_GROWTH && T > 430) {
        mat[i] = M_RUBBLE;
        smoke[i] = Math.min(2, smoke[i] + 0.4);
        w.destruction += 1;
      }
      const fuelLiq = liqT[i] === L_FUEL ? liqA[i] : 0;
      const avail = fuelLiq + sfuel[i];
      if (burn[i] > 0) {
        if (air[i] < 0.15 || avail <= 2e-3) {
          burn[i] = 0;
        } else {
          w.burningCells++;
          stampFireGlow(w, x, y);
          air[i] = Math.max(0, air[i] - (fuelLiq > 0 || sfuel[i] > 0.25 ? 0.025 : 8e-3));
          if (fuelLiq > 0) {
            liqA[i] = Math.max(0, liqA[i] - 6e-3);
            if (liqA[i] <= 1e-3) {
              liqA[i] = 0;
              liqT[i] = L_NONE;
            }
          } else {
            {
              let dep = sfuel[i] > 0.25 ? 2e-3 : 4e-4;
              if (sfuel[i] <= 0.2 && pipe[i] !== 0 && m !== M_RUBBLE) {
                if (pipe[i] & Pipe.Fuel) dep *= 0.5;
                else if (pipe[i] & (P_WIRE | Pipe.O2)) dep *= 0.2;
              }
              sfuel[i] = Math.max(0, sfuel[i] - dep);
            }
          }
          const cap = fuelLiq > 0.02 ? 1100 : 380 + 480 * (avail > 1 ? 1 : avail);
          if (temp[i] < cap) temp[i] = Math.min(cap, temp[i] + 50);
          smoke[i] = Math.min(2, smoke[i] + 0.05);
          const off2 = NOFF[rnd2() * 4 | 0];
          const j = i + off2;
          const mj = mat[j];
          if (mj !== 0) {
            temp[j] = Math.min(1500, temp[j] + 10);
            if ((mj === M_DOORC || mj === M_DOORO) && pipe[i] & P_WIRE && pipe[j] & P_WIRE) {
              if (w.tick % 5 === 0 && rnd2() < 0.12) {
                let prev = i;
                let cur = j;
                for (let step = 0; step < 4; step++) {
                  let next = -1;
                  let nextDoor = -1;
                  for (let q = 0; q < 4; q++) {
                    const k = cur + NOFF[q];
                    if (k === prev || k < 0 || k >= N) continue;
                    if (!(pipe[k] & P_WIRE)) continue;
                    const mk = mat[k];
                    if (mk === M_DOORC || mk === M_DOORO) {
                      nextDoor = k;
                      continue;
                    }
                    if (mk !== 0 && PASS[mk] !== 0 && burn[k] === 0 && air[k] > 0.15 && sfuel[k] > 0.01) {
                      next = k;
                      break;
                    }
                  }
                  if (next >= 0) {
                    igniteCell(w, next);
                    break;
                  }
                  if (nextDoor < 0) break;
                  prev = cur;
                  cur = nextDoor;
                }
              }
            } else if (mj === Mat.Lattice && burn[j] === 0) {
              if (rnd2() < 0.3) burn[j] = 1;
            } else if (burn[j] === 0 && PASS[mj] !== 0 && air[j] > 0.15) {
              if (liqT[j] === L_COOL && liqA[j] > 0.1) ;
              else {
                const liqF = liqT[j] === L_FUEL ? liqA[j] : 0;
                const sf = sfuel[j];
                const p = liqF > 0.02 ? 0.7 : sf > 0.25 ? 0.3 : sf > 0.01 ? 0.12 : 0;
                let paced = true;
                if (liqF <= 0.02 && pipe[j] !== 0) {
                  if (pipe[j] & Pipe.Fuel) paced = (w.tick & 1) === 0;
                  else if (pipe[j] & (P_WIRE | Pipe.O2)) paced = w.tick % 5 === 0;
                }
                if (paced && p > 0 && rnd2() < p) igniteCell(w, j);
              }
            }
          }
        }
      } else if (avail > 2e-3 && air[i] > 0.15) {
        const ign = fuelLiq > 0.02 ? 240 : 340;
        if (T >= ign) burn[i] = 1;
      }
    }
  }
}
function stepLiquids(w) {
  const Wc = W;
  const Hc = H;
  liquidScanFlip = !liquidScanFlip;
  const mat = w.mat;
  const liqA = w.liqAmt;
  const liqT = w.liqType;
  const startX = liquidScanFlip ? 1 : Wc - 2;
  const stepX = liquidScanFlip ? 1 : -1;
  for (let y = 1; y < Hc - 1; y++) {
    const row = y * Wc;
    for (let k = 0, x = startX; k < Wc - 2; k++, x += stepX) {
      const i = row + x;
      const amt = liqA[i];
      if (amt < 0.05) continue;
      const type = liqT[i];
      const m = mat[i];
      if (m === 0) {
        liqA[i] = 0;
        liqT[i] = L_NONE;
        continue;
      }
      let best = -1;
      let bestAmt = amt;
      for (let n = 0; n < 4; n++) {
        const j = i + NOFF[n];
        const nm = mat[j];
        if (PASS[nm] === 0) continue;
        if (nm === 0) {
          best = j;
          bestAmt = -1;
          break;
        }
        if (liqT[j] !== L_NONE && liqT[j] !== type) continue;
        if (liqA[j] < bestAmt - 0.02) {
          best = j;
          bestAmt = liqA[j];
        }
      }
      if (best < 0) continue;
      if (bestAmt < 0) {
        liqA[i] = Math.max(0, amt - 0.1);
        if (liqA[i] <= 1e-3) liqT[i] = L_NONE;
        continue;
      }
      const d = (amt - bestAmt) * 0.18;
      liqA[i] -= d;
      liqA[best] += d;
      liqT[best] = type;
      if (liqA[i] <= 1e-3) {
        liqA[i] = 0;
        liqT[i] = L_NONE;
      }
    }
  }
}
const RS = 3;
const PW = W * RS;
const PH = H * RS;
const buf = new ArrayBuffer(PW * PH * 4);
const px = new Uint32Array(buf);
const pixels = new Uint8ClampedArray(buf);
function hash(x, y, t) {
  let h = x * 374761393 + y * 668265263 + t * 69069 | 0;
  h = (h ^ h >>> 13) >>> 0;
  return (h * 1274126177 >>> 0) / 4294967296;
}
function pack(r, g, b) {
  return 4278190080 | (b > 255 ? 255 : b < 0 ? 0 : b) << 16 | (g > 255 ? 255 : g < 0 ? 0 : g) << 8 | (r > 255 ? 255 : r < 0 ? 0 : r);
}
const SPR = {
  [EntKind.Egg]: [0, 1, 0, 1, 3, 1, 0, 2, 0],
  [EntKind.Roamer]: [2, 0, 2, 1, 3, 1, 2, 0, 2],
  [EntKind.Breacher]: [0, 3, 0, 1, 1, 1, 2, 0, 2],
  [EntKind.Scav]: [0, 3, 0, 2, 1, 1, 0, 2, 0],
  [EntKind.Servitor]: [1, 1, 1, 1, 3, 1, 1, 2, 1],
  [EntKind.Weaver]: [1, 0, 1, 0, 3, 0, 1, 0, 1],
  // the militor wears TWO red eyes over a black chin — unmistakably armed
  [EntKind.Militor]: [1, 3, 1, 1, 3, 1, 1, 2, 1],
  [EntKind.Mound]: [2, 1, 2, 1, 3, 1, 1, 1, 1],
  [EntKind.Shrub]: [0, 1, 0, 1, 3, 1, 0, 2, 0],
  [EntKind.Reaver]: [1, 1, 1, 1, 3, 1, 1, 2, 1],
  // full red bulk, white eye, black maw
  [EntKind.Haunt]: [1, 1, 1, 2, 1, 2, 1, 2, 1],
  // a skull, if you squint. You will squint.
  [EntKind.Ghast]: [1, 1, 1, 2, 1, 2, 1, 2, 1],
  // the same face, greyer, older
  [EntKind.Ashen]: [1, 1, 1, 3, 1, 3, 1, 2, 1]
  // black bulk, two ember eyes
};
const MATRIARCH_SPR = [1, 1, 1, 2, 3, 2, 1, 1, 1];
const MATRIARCH_PAL = [[88, 48, 132], [14, 16, 20], [186, 130, 255]];
const CONDUCTOR_SPR = [1, 2, 1, 1, 3, 1, 1, 2, 1];
const CONDUCTOR_PAL = [[88, 48, 132], [14, 16, 20], [216, 170, 255]];
const HAT = [
  [86, 148, 255],
  [255, 74, 48],
  [255, 200, 64]
];
const PAL = {
  [EntKind.Egg]: [[196, 180, 136], [140, 124, 88], [232, 222, 184]],
  [EntKind.Roamer]: [[118, 196, 88], [56, 106, 42], [196, 244, 152]],
  [EntKind.Breacher]: [[200, 214, 232], [110, 124, 146], [246, 250, 255]],
  [EntKind.Scav]: [[206, 138, 64], [118, 80, 38], [240, 194, 122]],
  [EntKind.Servitor]: [[226, 232, 236], [150, 158, 165], [14, 16, 20]],
  // black dot: at work
  [EntKind.Weaver]: [[150, 122, 200], [96, 74, 134], [226, 206, 255]],
  [EntKind.Militor]: [[226, 232, 236], [14, 16, 20], [235, 60, 45]],
  // white chassis, black chin, red eyes
  [EntKind.Mound]: [[52, 108, 46], [30, 66, 30], [140, 200, 90]],
  // walking grove
  [EntKind.Shrub]: [[64, 122, 52], [38, 76, 36], [150, 210, 100]],
  // pot-sized wanderer
  [EntKind.Reaver]: [[150, 34, 48], [14, 16, 20], [238, 226, 210]],
  // arterial red, black maw, bone-white eye
  [EntKind.Haunt]: [[232, 238, 244], [10, 12, 16], [232, 238, 244]],
  // bone white on nothing
  [EntKind.Ghast]: [[148, 154, 162], [10, 12, 16], [148, 154, 162]],
  // grave grey
  [EntKind.Ashen]: [[54, 56, 62], [100, 102, 110], [235, 60, 45]]
  // charcoal bulk, ash chin, red eyes
};
const BADGE = [
  [92, 168, 255],
  [255, 208, 72],
  [128, 255, 128],
  [255, 128, 255],
  [88, 232, 232],
  [255, 156, 64],
  [188, 148, 255],
  [240, 244, 160]
];
const BROOD_SPR = [
  0,
  1,
  1,
  1,
  1,
  0,
  1,
  1,
  2,
  2,
  1,
  1,
  1,
  2,
  3,
  3,
  2,
  1,
  1,
  2,
  3,
  3,
  2,
  1,
  1,
  1,
  2,
  2,
  1,
  1,
  0,
  1,
  1,
  1,
  1,
  0
];
const BROOD_PAL = [[132, 58, 142], [96, 38, 104], [238, 132, 250]];
function drawSprite(cx, cy, size, spr, pal, glow, flash) {
  const x0 = cx * RS;
  const y0 = cy * RS;
  for (let sy = 0; sy < size; sy++) {
    const yy = y0 + sy;
    if (yy < 0 || yy >= PH) continue;
    for (let sx = 0; sx < size; sx++) {
      const xx = x0 + sx;
      if (xx < 0 || xx >= PW) continue;
      const v = spr[sy * size + sx];
      if (v === 0) continue;
      let [r, g, b] = pal[v - 1];
      r *= glow;
      g *= glow;
      b *= glow;
      if (flash) {
        r += (255 - r) * 0.7;
        g += (252 - g) * 0.7;
        b += (244 - b) * 0.7;
      }
      px[yy * PW + xx] = pack(r, g, b);
    }
  }
}
function render(w) {
  const tick = w.tick;
  const mat = w.mat;
  const machine = w.machine;
  const pipe = w.pipe;
  const rooms = w.rooms;
  const roomId = w.roomId;
  const temp = w.temp;
  const burn = w.burn;
  const smoke = w.smoke;
  const liqA = w.liqAmt;
  const liqT = w.liqType;
  const sfuel = w.solidFuel;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x;
      const m = mat[i];
      const block = y * RS * PW + x * RS;
      if (m === Mat.Space) {
        const s = w.starfield[i];
        const dark = pack(5, 6, 10);
        for (let sy = 0; sy < RS; sy++) {
          const o = block + sy * PW;
          px[o] = dark;
          px[o + 1] = dark;
          px[o + 2] = dark;
        }
        if (s > 0) {
          const sx = hash(x, y, 1) * RS | 0;
          const sy = hash(x, y, 2) * RS | 0;
          px[block + sy * PW + sx] = pack(150 * s, 160 * s, 175 * s);
        }
        continue;
      }
      const rid = roomId[i];
      let lc0 = Math.max(w.lightLevel[i], w.fireGlow[i], w.bridgeGlow[i], w.condGlow[i]);
      {
        const dg = w.darkGlow[i];
        if (dg > 0.02 && !(w.mat[i] === Mat.Machine && w.machine[i] === Machine.Light)) {
          lc0 = Math.max(lc0 * (1 - 0.8 * (dg > 1 ? 1 : dg)), w.bridgeGlow[i], w.condGlow[i]);
        }
      }
      const lc = lc0 > 1 ? 1 : lc0;
      let light = 0.2 + 0.8 * lc * lc * (3 - 2 * lc) * (0.4 + 0.6 * lc);
      let r = 0, g = 0, b = 0;
      const noise = 0.92 + 0.16 * hash(x, y, 0);
      let grain = 0;
      let smokeFeather = 0;
      let preR = 0, preG = 0, preB = 0;
      switch (m) {
        case Mat.Hull:
          r = 62 * noise;
          g = 68 * noise;
          b = 78 * noise;
          if (light < 0.35) light = 0.35;
          grain = 0.06;
          break;
        case Mat.Wall:
          r = 88 * noise;
          g = 95 * noise;
          b = 105 * noise;
          if (light < 0.28) light = 0.28;
          grain = 0.05;
          break;
        case Mat.DoorClosed:
          r = 138;
          g = 116;
          b = 64;
          if (light < 0.35) light = 0.35;
          break;
        case Mat.DoorOpen:
          r = 90;
          g = 78;
          b = 48;
          if (light < 0.35) light = 0.35;
          break;
        case Mat.Rubble:
          r = 66 * noise;
          g = 60 * noise;
          b = 52 * noise;
          grain = 0.16;
          break;
        case Mat.Lattice: {
          const vein = hash(x * 3, y * 3, 1);
          if (pipe[i] & Pipe.Wire && w.wirePowered[i]) {
            r = 150 + 40 * vein;
            g = 140 + 34 * vein;
            b = 196 + 44 * vein;
          } else if (pipe[i] & Pipe.Wire) {
            r = 122 + 40 * vein;
            g = 116 + 34 * vein;
            b = 162 + 44 * vein;
          } else {
            r = 96 + 50 * vein;
            g = 88 + 40 * vein;
            b = 118 + 56 * vein;
          }
          if (light < 0.42) light = 0.42;
          grain = 0.14;
          break;
        }
        case Mat.Tree: {
          r = 30 * noise;
          g = 26 * noise;
          b = 20 * noise;
          if (light < 0.35) light = 0.35;
          break;
        }
        case Mat.Vine: {
          const vein = hash(x * 3, y * 3, 5);
          r = (30 + 8 * vein) * noise;
          g = (44 + 14 * vein) * noise;
          b = (30 + 8 * vein) * noise;
          grain = 0.1;
          break;
        }
        case Mat.Growth: {
          const vein = hash(x * 3, y * 3, 0);
          r = (62 + 36 * vein) * noise;
          g = (30 + 12 * vein) * noise;
          b = (92 + 52 * vein) * noise;
          if (vein > 0.82) {
            r += 28;
            b += 46;
          }
          const pulse = 0.88 + 0.12 * Math.sin(tick * 0.03 + vein * 12);
          r *= pulse;
          g *= pulse;
          b *= pulse;
          grain = 0.18;
          break;
        }
        case Mat.Machine: {
          const mt2 = machine[i];
          if (mt2 === Machine.Reactor) {
            r = 109 * noise;
            g = 85 * noise;
            b = 200 * noise;
            let gl = (temp[i] - 70) / 1e3;
            if (gl > 0) {
              if (gl > 1) gl = 1;
              r += (255 - r) * gl;
              g += (130 - g) * gl;
              b += (70 - b) * gl;
            }
            const pulse = 0.9 + 0.1 * Math.sin(tick * 0.05 + x + y);
            r *= pulse;
            g *= pulse;
            b *= pulse;
          } else if (mt2 === Machine.FuelTank) {
            r = 151 * noise;
            g = 112 * noise;
            b = 31 * noise;
          } else if (mt2 === Machine.CoolantTank) {
            r = 31 * noise;
            g = 127 * noise;
            b = 151 * noise;
          } else if (mt2 === Machine.O2Gen) {
            r = 127 * noise;
            g = 151 * noise;
            b = 167 * noise;
          } else if (mt2 === Machine.Munitions) {
            r = 143 * noise;
            g = 58 * noise;
            b = 50 * noise;
          } else {
            r = 90 * noise;
            g = 106 * noise;
            b = 90 * noise;
          }
          if (light < 0.45) light = 0.45;
          grain = 0.05;
          break;
        }
        default: {
          if (rid >= 0 && rooms[rid].isCorridor) {
            r = 40;
            g = 45;
            b = 54;
          } else {
            r = 34;
            g = 38;
            b = 45;
          }
          if (((x ^ y) & 3) === 0) {
            r *= 0.9;
            g *= 0.9;
            b *= 0.9;
          }
          const sf = sfuel[i];
          if (sf > 0.15 && pipe[i] === 0) {
            const t = (sf > 1 ? 1 : sf) * 0.8;
            r += (70 - r) * t;
            g += (64 - g) * t;
            b += (50 - b) * t;
            grain = 0.12;
          }
        }
      }
      const mt = machine[i];
      if (mt === Machine.Light) {
        if (rid >= 0 && rooms[rid].lit) {
          r = 255;
          g = 233;
          b = 160;
        } else {
          r = 64;
          g = 64;
          b = 58;
        }
      } else if (mt === Machine.Vent) {
        r += (111 - r) * 0.7;
        g += (127 - g) * 0.7;
        b += (143 - b) * 0.7;
        if (w.activeVents.has(i) && (tick >> 4 & 1) === 0) {
          r += (170 - r) * 0.3;
          g += (190 - g) * 0.3;
          b += (210 - b) * 0.3;
        }
      }
      r *= light;
      g *= light;
      b *= light;
      {
        const fg = w.fireGlow[i];
        if (fg > 0.04) {
          r += 88 * fg;
          g += 34 * fg;
          b += 4 * fg;
        }
      }
      {
        const bg2 = w.bridgeGlow[i];
        if (bg2 > 0.04) {
          r += 14 * bg2;
          g += 52 * bg2;
          b += 22 * bg2;
        }
      }
      {
        const cg = w.condGlow[i];
        if (cg > 0.04) {
          r += 46 * cg;
          g += 48 * cg;
          b += 52 * cg;
        }
      }
      if (m === Mat.Lattice && (pipe[i] & Pipe.Wire) !== 0 && lc < 0.3) {
        const pulse = 0.7 + 0.3 * Math.sin(tick * 0.04 + (x + y) * 0.7);
        r += 6 * pulse;
        g += 30 * pulse;
        b += 12 * pulse;
      }
      const st = w.stain[i];
      if (st > 0.05) {
        const t = Math.min(0.5, st * 0.4);
        r += (96 - r) * t;
        g += (18 - g) * t;
        b += (16 - b) * t;
      }
      const ec = w.ecto[i];
      if (ec > 0.04) {
        const t2 = Math.min(0.4, ec * 0.45);
        const ph = (hash(x, y, 0) * 3 + tick * 0.035) % 3;
        const er = ph < 1 ? 62 : ph < 2 ? 88 : 48;
        const eg = ph < 1 ? 120 : ph < 2 ? 96 : 150;
        const eb = ph < 1 ? 235 : ph < 2 ? 244 : 215;
        r += (er - r) * t2 * 0.5;
        g += (eg - g) * t2 * 0.5;
        b += (eb - b) * t2 * 0.6;
      }
      if (m === Mat.Floor || m === Mat.Rubble || m === Mat.DoorOpen) {
        const a = w.air[i];
        if (a < 0.35) {
          const t = (0.35 - a) / 0.35 * 0.5;
          r += (8 - r) * t;
          g += (10 - g) * t;
          b += (18 - b) * t;
        }
      }
      const la = liqA[i];
      if (la > 0.03) {
        let t = la * 0.65;
        if (t > 0.8) t = 0.8;
        if (liqT[i] === Liquid.Fuel) {
          r += (143 * light - r) * t;
          g += (98 * light - g) * t;
          b += (22 * light - b) * t;
        } else if (liqT[i] === Liquid.Ichor) {
          r += (74 * light - r) * t;
          g += (110 * light - g) * t;
          b += (46 * light - b) * t;
        } else if (liqT[i] === Liquid.Blood) {
          r += (118 * light - r) * t;
          g += (18 * light - g) * t;
          b += (16 * light - b) * t;
        } else {
          r += (40 * light - r) * t;
          g += (167 * light - g) * t;
          b += (189 * light - b) * t;
        }
      }
      const T = temp[i];
      const burning = burn[i] > 0;
      if (T > 350 && !burning) {
        let gl = (T - 350) / 750;
        if (gl > 1) gl = 1;
        gl *= 0.7;
        r += (179 - r) * gl;
        g += (64 - g) * gl;
        b += (15 - b) * gl;
      }
      if (burning) {
        const flick = 0.8 + 0.2 * hash(x, y, tick);
        let heat = T / 1200;
        if (heat > 1) heat = 1;
        let fr, fg, fb;
        if (heat < 0.5) {
          const t2 = heat * 2;
          fr = 179 + (255 - 179) * t2;
          fg = 48 + (122 - 48) * t2;
          fb = 0 + 26 * t2;
        } else {
          const t2 = (heat - 0.5) * 2;
          fr = 255;
          fg = 122 + (224 - 122) * t2;
          fb = 26 + (138 - 26) * t2;
        }
        r += (fr * flick - r) * 0.85;
        g += (fg * flick - g) * 0.85;
        b += (fb * flick - b) * 0.85;
      }
      const sSmoke = smoke[i];
      if (sSmoke > 0.02) {
        preR = r;
        preG = g;
        preB = b;
        let t = sSmoke * 0.45;
        if (t > 0.75) t = 0.75;
        r += (22 - r) * t;
        g += (24 - g) * t;
        b += (28 - b) * t;
        smokeFeather = sSmoke;
      }
      if (m === Mat.Tree && !burning) {
        const vr = hash(x, y, 7);
        const flip = vr > 0.5;
        const breathe = 0.9 + 0.1 * Math.sin(tick * 0.02 + vr * 9);
        const lightB = light * breathe;
        const canopyHi = pack(60 * lightB, 138 * lightB, 62 * lightB);
        const canopy = pack(34 * lightB, 96 * lightB, 44 * lightB);
        const trunk = pack(88 * light, 60 * light, 34 * light);
        const soil = pack(r, g, b);
        px[block] = canopy;
        px[block + 1] = soil;
        px[block + 2] = canopyHi;
        px[block + PW] = flip ? soil : canopy;
        px[block + PW + 1] = canopyHi;
        px[block + PW + 2] = flip ? canopy : soil;
        px[block + 2 * PW] = soil;
        px[block + 2 * PW + 1] = trunk;
        px[block + 2 * PW + 2] = soil;
        continue;
      }
      if (grain > 0) {
        for (let sy = 0; sy < RS; sy++) {
          const o = block + sy * PW;
          for (let sx = 0; sx < RS; sx++) {
            const gn = 1 - grain + 2 * grain * hash(x * RS + sx, y * RS + sy, 3);
            px[o + sx] = pack(r * gn, g * gn, b * gn);
          }
        }
      } else {
        const c = pack(r, g, b);
        for (let sy = 0; sy < RS; sy++) {
          const o = block + sy * PW;
          px[o] = c;
          px[o + 1] = c;
          px[o + 2] = c;
        }
      }
      if (smokeFeather > 0.15) {
        const sL = smoke[i - 1] ?? 0;
        const sR = smoke[i + 1] ?? 0;
        const sU = smoke[i - W] ?? 0;
        const sD = smoke[i + W] ?? 0;
        const corner = (cx2, cy2, nA, nB) => {
          if (Math.min(nA, nB) < smokeFeather * 0.5) {
            let t = smokeFeather * 0.225;
            if (t > 0.4) t = 0.4;
            px[block + cy2 * PW + cx2] = pack(
              preR + (22 - preR) * t,
              preG + (24 - preG) * t,
              preB + (28 - preB) * t
            );
          }
        };
        corner(0, 0, sL, sU);
        corner(2, 0, sR, sU);
        corner(0, 2, sL, sD);
        corner(2, 2, sR, sD);
      }
      if (burning) {
        const fx = hash(x, y, tick >> 1) * RS | 0;
        const fy = hash(y, x, tick >> 1) * RS | 0;
        px[block + fy * PW + fx] = pack(255, 36, 22);
        const fx2 = hash(x + 7, y, tick >> 1) * RS | 0;
        const fy2 = hash(y, x + 7, tick >> 1) * RS | 0;
        if (fx2 !== fx || fy2 !== fy) px[block + fy2 * PW + fx2] = pack(232, 20, 12);
      }
    }
  }
  for (const e of w.ents) {
    const flash = tick - e.flash < 4;
    if (e.kind === EntKind.Brood) {
      const bI = e.y * W + e.x;
      const bLc = Math.max(w.lightLevel[bI], w.fireGlow[bI], w.bridgeGlow[bI], w.condGlow[bI]);
      const pulse = (0.85 + 0.15 * Math.sin(tick * 0.08)) * (0.4 + 0.6 * (bLc > 1 ? 1 : bLc));
      drawSprite(e.x, e.y, 2 * RS, BROOD_SPR, BROOD_PAL, pulse, flash);
      if (e.lin) {
        const c = BADGE[(e.lin - 1) % 8];
        const bx = e.x * RS + ((e.lin - 1) % 2 === 0 ? 0 : 2 * RS - 1);
        const by = e.y * RS + RS - 1;
        if (bx >= 0 && bx < PW && by >= 0 && by < PH) px[by * PW + bx] = pack(c[0], c[1], c[2]);
      }
      continue;
    }
    const eI = e.y * W + e.x;
    const eLc = Math.max(w.lightLevel[eI], w.fireGlow[eI], w.bridgeGlow[eI], w.condGlow[eI]);
    let glow = 0.35 + 0.65 * (eLc > 1 ? 1 : eLc);
    if (e.kind === EntKind.Haunt || e.kind === EntKind.Ghast || e.kind === EntKind.Ashen) {
      glow = Math.max(glow, 0.85);
    }
    let pal = PAL[e.kind];
    let spr = SPR[e.kind];
    if (e.kind === EntKind.Egg) {
      glow *= 0.8 + 0.2 * hash(e.x, e.y, tick >> 4);
      if (e.cls === 1) pal = [[206, 130, 190], [140, 70, 128], [244, 190, 236]];
    } else if (e.kind === EntKind.Breacher) {
      const hat = HAT[e.cls ?? 0];
      pal = [pal[0], pal[1], hat];
    } else if (e.kind === EntKind.Weaver && e.cls === 1) {
      pal = MATRIARCH_PAL;
      spr = MATRIARCH_SPR;
    } else if (e.kind === EntKind.Weaver && e.cls === 2) {
      pal = CONDUCTOR_PAL;
      spr = CONDUCTOR_SPR;
    } else if (e.kind === EntKind.Scav && e.cls === 1) {
      pal = [pal[0], pal[1], [255, 214, 90]];
    } else if (e.kind === EntKind.Scav && e.cls === 2) {
      pal = [[150, 150, 156], [96, 96, 102], [210, 210, 216]];
    }
    drawSprite(e.x, e.y, RS, spr, pal, glow, flash);
    if ((e.kind === EntKind.Servitor || e.kind === EntKind.Militor || e.kind === EntKind.Reaver) && e.brain) {
      const q = (e.brain - 1) % 4;
      const c = BADGE[(e.brain - 1) % 8];
      const bx = e.x * RS + (q === 1 || q === 3 ? RS - 1 : 0);
      const by = e.y * RS + (q >= 2 ? RS - 1 : 0);
      if (bx >= 0 && bx < PW && by >= 0 && by < PH) px[by * PW + bx] = pack(c[0], c[1], c[2]);
    } else if (e.kind === EntKind.Roamer && e.lin) {
      const c = BADGE[(e.lin - 1) % 8];
      const bx = e.x * RS + ((e.lin - 1) % 2 === 0 ? 0 : RS - 1);
      const by = e.y * RS + 1;
      if (bx >= 0 && bx < PW && by >= 0 && by < PH) px[by * PW + bx] = pack(c[0], c[1], c[2]);
    }
  }
  for (const rt of w.rites) {
    const age = (tick - rt.t) / 60;
    if (age > 1) continue;
    for (let k = 0; k < 26; k++) {
      const kh = hash(k, rt.t, 0);
      const ang = k * 2.3999 + age * (4 + 2 * kh);
      const rad = 5.5 * (1 - age) * (0.55 + 0.45 * kh);
      const sx = (rt.x + 0.5 + Math.cos(ang) * rad) * RS | 0;
      const sy = (rt.y + 0.5 + Math.sin(ang) * rad) * RS | 0;
      const pi2 = sy * PW + sx;
      if (sx < 0 || sx >= PW || pi2 < 0 || pi2 >= px.length) continue;
      const hot = hash(k, rt.t, tick >> 2);
      px[pi2] = hot < 0.5 ? pack(150, 28, 24) : hot < 0.85 ? pack(96, 16, 16) : pack(212, 62, 40);
    }
  }
  for (const bu of w.bursts) {
    const age = (tick - bu.t) / 30;
    if (age > 1) continue;
    const d = (1 - bu.amp) * 5.5;
    const ring = age * 6.5;
    if (d > ring || d < ring - 2.2) continue;
    const bright = bu.amp * (1 - age * 0.7);
    if (bright < 0.05) continue;
    const bx2 = bu.i % W;
    const by2 = bu.i / W | 0;
    for (let k = 0; k < 2; k++) {
      const sx = bx2 * RS + (hash(bx2 + k, by2, tick >> 1) * RS | 0);
      const sy = by2 * RS + (hash(by2, bx2 + k, tick >> 1) * RS | 0);
      const pi2 = sy * PW + sx;
      if (pi2 < 0 || pi2 >= px.length) continue;
      px[pi2] = pack(30 + 80 * bright | 0, 70 + 110 * bright | 0, 140 + 100 * bright | 0);
    }
  }
  for (const sh of w.shots) {
    const age = (tick - sh.t) / 8;
    if (age < 0 || age > 1) continue;
    if (sh.k !== 0) {
      for (let k = 0; k < 5; k++) {
        const p = Math.min(1, age * 1.4) * (0.35 + k * 0.16);
        const jx = (hash(sh.x0 + k, sh.y0, tick) - 0.5) * 1.6 * p;
        const jy = (hash(sh.y0, sh.x0 + k, tick) - 0.5) * 1.6 * p;
        const fx = (sh.x0 + (sh.x1 - sh.x0) * p + jx + 0.5) * RS;
        const fy = (sh.y0 + (sh.y1 - sh.y0) * p + jy + 0.5) * RS;
        const fi = (fy | 0) * PW + (fx | 0);
        if (fi < 0 || fi >= px.length) continue;
        const hot = hash(k, sh.t, tick);
        px[fi] = sh.k === 2 ? hot < 0.4 ? pack(60, 120, 255) : hot < 0.8 ? pack(120, 190, 255) : pack(220, 240, 255) : hot < 0.4 ? pack(255, 46, 20) : hot < 0.8 ? pack(255, 140, 30) : pack(255, 220, 120);
      }
    }
  }
}
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== cw) canvas.width = cw;
  if (canvas.height !== ch) canvas.height = ch;
}
window.addEventListener("resize", fitCanvas);
const off = document.createElement("canvas");
off.width = W * RS;
off.height = H * RS;
const octx = off.getContext("2d");
let simTickFn = simTick;
let renderFn = render;
let generateFn = generate;
let spawnBroodFn = spawnBrood;
let requestPodFn = requestPod;
let describeTaskFn = describeTask;
let entsMod = ENTS;
let brainNameFn = brainName;
let img = new ImageData(pixels, W * RS, H * RS);
let world;
let seed = Math.random() * 4294967295 >>> 0;
const rnd = mulberry32(Math.random() * 4294967295 >>> 0);
let paused = false;
const SPEEDS = [1 / 300, 1 / 60, 1 / 12, 1 / 4, 0.5, 1, 2, 4];
const SPEED_LABELS = ["1 tick/5s", "1 tick/s", "5 t/s", "15 t/s", "0.5×", "1×", "2×", "4×"];
let speedIdx = 5;
let frame = 0;
let tool = 0;
let paint = null;
let lastPaintI = -1;
let stroking = false;
let mouseX = -1;
let mouseY = -1;
let mouseClientX = 0;
let mouseClientY = 0;
let chaosDisplay = 0;
const ZOOMS = [1, 2, 3, 4];
let zoomIdx = 0;
let viewX = 0;
let viewY = 0;
let panning = false;
function zoom() {
  return ZOOMS[zoomIdx];
}
function clampView() {
  const z = zoom();
  viewX = Math.max(0, Math.min(W - W / z, viewX));
  viewY = Math.max(0, Math.min(H - H / z, viewY));
}
let splashLeft = 0;
function newShip() {
  world = generateFn(seed);
  splashLeft = 70;
}
splashLeft = 70;
{
  newShip();
}
const listeners = new AbortController();
const sig = { signal: listeners.signal };
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
}
function worldCell(e) {
  const [cx, cy] = canvasPoint(e);
  const z = zoom();
  const x = Math.floor(viewX + cx / z);
  const y = Math.floor(viewY + cy / z);
  return [Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y))];
}
canvas.addEventListener("mousemove", (e) => {
  [mouseX, mouseY] = worldCell(e);
  mouseClientX = e.clientX;
  mouseClientY = e.clientY;
  if (stroking && paint) paintAt(mouseX, mouseY);
  if (panning) {
    const r = canvas.getBoundingClientRect();
    const z = zoom();
    viewX -= e.movementX / r.width * W / z;
    viewY -= e.movementY / r.height * H / z;
    clampView();
  }
}, sig);
canvas.addEventListener("mouseleave", () => {
  mouseX = mouseY = -1;
  panning = false;
  document.getElementById("inspect").style.display = "none";
}, sig);
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    const [x, y] = worldCell(e);
    if (paint) {
      stroking = true;
      lastPaintI = -1;
      paintAt(x, y);
    } else {
      applyTool(x, y);
    }
  } else {
    panning = true;
    e.preventDefault();
  }
}, sig);
window.addEventListener("mouseup", () => {
  panning = false;
  stroking = false;
  lastPaintI = -1;
}, sig);
canvas.addEventListener("contextmenu", (e) => e.preventDefault(), sig);
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const [cx, cy] = canvasPoint(e);
  const z0 = zoom();
  const wx = viewX + cx / z0;
  const wy = viewY + cy / z0;
  zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, zoomIdx + (e.deltaY < 0 ? 1 : -1)));
  const z1 = zoom();
  viewX = wx - cx / z1;
  viewY = wy - cy / z1;
  clampView();
}, { signal: listeners.signal, passive: false });
const TOOL_RADIUS = [4, 2, 2, 2, 1, 2];
function applyTool(x, y) {
  const w = world;
  switch (tool) {
    case 0:
      w.explosions.push({ x, y, r: 4, power: 1e3 });
      break;
    case 1:
      forRadius(x, y, 2, (i) => {
        const m = w.mat[i];
        if (m === Mat.Floor || m === Mat.Rubble) {
          w.solidFuel[i] = Math.max(w.solidFuel[i], 0.5);
          w.temp[i] = Math.min(1500, w.temp[i] + 650);
        } else if (m === Mat.Lattice || m === Mat.Vine || m === Mat.Growth) {
          w.burn[i] = 1;
          w.temp[i] = Math.min(1500, w.temp[i] + 650);
        } else if (m !== Mat.Space) {
          w.temp[i] = Math.min(1500, w.temp[i] + 400);
        }
      });
      break;
    case 2: {
      let cut = -1;
      forRadius(x, y, 2, (i) => {
        if (w.pipe[i] !== 0 && !w.pipeBroken[i]) {
          w.breakPipe(i);
          cut = i;
        }
      });
      if (cut >= 0 && Math.random() < 0.6) {
        w.temp[cut] = Math.min(1500, w.temp[cut] + 480);
      }
      break;
    }
    case 3:
      forRadius(x, y, 2, (i) => {
        if (w.mat[i] !== Mat.Space) {
          w.breakPipe(i);
          w.mat[i] = Mat.Space;
          w.roomId[i] = -1;
          w.machine[i] = 0;
          w.air[i] = 0;
          w.liqAmt[i] = 0;
          w.burn[i] = 0;
          w.destruction += 1;
          w.networksDirty = true;
        }
      });
      break;
    case 4:
      spawnBroodFn(w, x, y);
      break;
    case 5:
      requestPodFn(w, x, y, 5);
      break;
  }
}
function paintAt(x, y) {
  const w = world;
  const i = y * W + x;
  if (i === lastPaintI) return;
  lastPaintI = i;
  const walkable = () => {
    if (w.mat[i] === Mat.Space) {
      w.mat[i] = Mat.Floor;
      w.temp[i] = 20;
    }
  };
  switch (paint) {
    case "brood":
      entsMod.spawnBrood(w, x, y);
      break;
    case "egg":
      walkable();
      entsMod.spawnEgg(w, x, y, 40, false);
      break;
    case "roamer":
      walkable();
      entsMod.spawnRoamer(w, x, y);
      break;
    case "gun":
      walkable();
      entsMod.spawnBreacher(w, x, y, 0);
      break;
    case "torch":
      walkable();
      entsMod.spawnBreacher(w, x, y, 1);
      break;
    case "lead":
      walkable();
      entsMod.spawnBreacher(w, x, y, 2);
      break;
    case "scav":
      walkable();
      entsMod.spawnScav(w, x, y, i, 0);
      break;
    case "rustler":
      walkable();
      entsMod.spawnScav(w, x, y, i, 1);
      break;
    case "smoker":
      walkable();
      entsMod.spawnScav(w, x, y, i, 2);
      break;
    case "servitor":
      walkable();
      entsMod.spawnServitor(w, x, y);
      break;
    case "militor":
      walkable();
      entsMod.spawnMilitor(w, x, y);
      break;
    case "weaver":
      entsMod.spawnWeaver(w, x, y, 0);
      break;
    case "matriarch":
      entsMod.spawnWeaver(w, x, y, 1);
      break;
    case "conductor":
      entsMod.spawnWeaver(w, x, y, 2);
      break;
    case "mound":
      walkable();
      entsMod.spawnMound(w, x, y);
      break;
    case "shrub":
      walkable();
      entsMod.spawnShrub(w, x, y);
      break;
    case "reaver":
      walkable();
      entsMod.spawnReaver(w, x, y, world.brainId);
      break;
    case "haunt":
      walkable();
      entsMod.spawnHaunt(w, x, y);
      break;
    case "ghast":
      walkable();
      entsMod.spawnGhast(w, x, y);
      break;
    case "resin":
      w.mat[i] = Mat.Growth;
      w.solidFuel[i] = 0;
      break;
    case "lattice":
      w.mat[i] = Mat.Lattice;
      break;
    case "door":
      w.mat[i] = Mat.DoorClosed;
      break;
    case "rubble":
      w.mat[i] = Mat.Rubble;
      w.solidFuel[i] += 0.1;
      break;
    case "tree":
      w.mat[i] = Mat.Tree;
      break;
    case "vine":
      walkable();
      w.mat[i] = Mat.Vine;
      w.solidFuel[i] = Math.max(w.solidFuel[i], 0.45);
      break;
    case "wire-power":
      walkable();
      w.pipe[i] |= Pipe.Wire;
      w.pipeBroken[i] = 0;
      break;
    case "wire-fuel":
      walkable();
      w.pipe[i] |= Pipe.Fuel;
      w.pipeBroken[i] = 0;
      break;
    case "wire-coolant":
      walkable();
      w.pipe[i] |= Pipe.Coolant;
      w.pipeBroken[i] = 0;
      break;
    case "wire-o2":
      walkable();
      w.pipe[i] |= Pipe.O2;
      w.pipeBroken[i] = 0;
      break;
    case "liq-fuel":
      w.liqType[i] = Liquid.Fuel;
      w.liqAmt[i] = 1;
      break;
    case "liq-coolant":
      w.liqType[i] = Liquid.Coolant;
      w.liqAmt[i] = 1;
      break;
    case "liq-ichor":
      w.liqType[i] = Liquid.Ichor;
      w.liqAmt[i] = 1;
      break;
    case "liq-blood":
      w.liqType[i] = Liquid.Blood;
      w.liqAmt[i] = 1;
      break;
    case "fire":
      w.burn[i] = 1;
      w.temp[i] = Math.min(1500, w.temp[i] + 650);
      break;
  }
  w.networksDirty = true;
}
function forRadius(cx, cy, r, fn) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
      fn(y * W + x);
    }
}
window.addEventListener("keydown", (e) => {
  const panStep = 24 / zoom();
  if (e.key === " ") {
    paused = !paused;
    e.preventDefault();
  } else if (e.key === "r" || e.key === "R") {
    seed = Math.random() * 4294967295 >>> 0;
    newShip();
    chaosDisplay = 0;
  } else if (e.key === "[") {
    speedIdx = Math.max(0, speedIdx - 1);
  } else if (e.key === "]") {
    speedIdx = Math.min(SPEEDS.length - 1, speedIdx + 1);
  } else if (e.key >= "1" && e.key <= "6") {
    tool = parseInt(e.key) - 1;
    syncToolbar();
  } else if (e.key === "w" || e.key === "ArrowUp") {
    viewY -= panStep;
    clampView();
  } else if (e.key === "s" || e.key === "ArrowDown") {
    viewY += panStep;
    clampView();
  } else if (e.key === "a" || e.key === "ArrowLeft") {
    viewX -= panStep;
    clampView();
  } else if (e.key === "d" || e.key === "ArrowRight") {
    viewX += panStep;
    clampView();
  }
}, sig);
const toolButtons = Array.from(document.querySelectorAll(".tool"));
for (const b of toolButtons) {
  b.addEventListener("click", () => {
    tool = parseInt(b.dataset.tool);
    syncToolbar();
  }, sig);
}
function syncToolbar() {
  for (const b of toolButtons) b.classList.toggle("active", parseInt(b.dataset.tool) === tool);
}
syncToolbar();
function paintLegend() {
  var _a, _b;
  const paint2 = (id, size, spr, pal) => {
    const c = document.getElementById(id);
    if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, size, size);
    for (let sy = 0; sy < size; sy++)
      for (let sx = 0; sx < size; sx++) {
        const v = spr[sy * size + sx];
        if (v === 0) continue;
        const [r, gg, b] = pal[v - 1];
        g.fillStyle = `rgb(${r},${gg},${b})`;
        g.fillRect(sx, sy, 1, 1);
      }
  };
  paint2("sw-brood", 6, BROOD_SPR, BROOD_PAL);
  paint2("sw-egg", 3, SPR[EntKind.Egg], PAL[EntKind.Egg]);
  paint2("sw-roamer", 3, SPR[EntKind.Roamer], PAL[EntKind.Roamer]);
  const bp = PAL[EntKind.Breacher];
  paint2("sw-gunner", 3, SPR[EntKind.Breacher], [bp[0], bp[1], HAT[0]]);
  paint2("sw-torcher", 3, SPR[EntKind.Breacher], [bp[0], bp[1], HAT[1]]);
  paint2("sw-leader", 3, SPR[EntKind.Breacher], [bp[0], bp[1], HAT[2]]);
  paint2("sw-scav", 3, SPR[EntKind.Scav], PAL[EntKind.Scav]);
  const sp = PAL[EntKind.Scav];
  paint2("sw-rustler", 3, SPR[EntKind.Scav], [sp[0], sp[1], [255, 214, 90]]);
  paint2("sw-protector", 3, SPR[EntKind.Scav], [[150, 150, 156], [96, 96, 102], [210, 210, 216]]);
  paint2("sw-servitor", 3, SPR[EntKind.Servitor], PAL[EntKind.Servitor]);
  paint2("sw-militor", 3, SPR[EntKind.Militor], PAL[EntKind.Militor]);
  paint2("sw-weaver", 3, SPR[EntKind.Weaver], PAL[EntKind.Weaver]);
  paint2("sw-matriarch", 3, MATRIARCH_SPR, MATRIARCH_PAL);
  paint2("sw-conductor", 3, CONDUCTOR_SPR, CONDUCTOR_PAL);
  paint2("sw-mound", 3, SPR[EntKind.Mound], PAL[EntKind.Mound]);
  paint2("sw-shrub", 3, SPR[EntKind.Shrub], PAL[EntKind.Shrub]);
  paint2("sw-reaver", 3, SPR[EntKind.Reaver], PAL[EntKind.Reaver]);
  paint2("sw-haunt", 3, SPR[EntKind.Haunt], PAL[EntKind.Haunt]);
  paint2("sw-ghast", 3, SPR[EntKind.Ghast], PAL[EntKind.Ghast]);
  paint2("sw-ashen", 3, SPR[EntKind.Ashen], PAL[EntKind.Ashen]);
  paint2("sw-crewbadge", 3, SPR[EntKind.Servitor], PAL[EntKind.Servitor]);
  paint2("sw-dynbadge", 3, SPR[EntKind.Roamer], PAL[EntKind.Roamer]);
  const gCrew = (_a = document.getElementById("sw-crewbadge")) == null ? void 0 : _a.getContext("2d");
  if (gCrew) {
    const c = BADGE[0];
    gCrew.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    gCrew.fillRect(0, 0, 1, 1);
  }
  const gDyn = (_b = document.getElementById("sw-dynbadge")) == null ? void 0 : _b.getContext("2d");
  if (gDyn) {
    const c = BADGE[1];
    gDyn.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    gDyn.fillRect(0, 1, 1, 1);
  }
}
paintLegend();
const legendEl = document.getElementById("legend");
legendEl.addEventListener("click", (ev) => {
  const li = ev.target.closest("[data-paint]");
  if (!li) return;
  const id = li.dataset.paint;
  const was = paint;
  legendEl.querySelectorAll(".painting").forEach((n) => n.classList.remove("painting"));
  if (was === id) {
    paint = null;
  } else {
    paint = id;
    li.classList.add("painting");
  }
}, sig);
window.addEventListener("keydown", (ev) => {
  if (ev.key === "?") {
    toggleAbout();
    return;
  }
  if (ev.key === "Escape" && !aboutEl.hidden) {
    toggleAbout(false);
    return;
  }
  if (ev.key === "Escape" && paint) {
    paint = null;
    legendEl.querySelectorAll(".painting").forEach((n) => n.classList.remove("painting"));
  }
}, sig);
const aboutEl = document.getElementById("about");
const aboutBtn = document.getElementById("about-btn");
function toggleAbout(force) {
  const show = force ?? aboutEl.hidden;
  aboutEl.hidden = !show;
}
aboutBtn.addEventListener("click", () => toggleAbout(), sig);
aboutEl.addEventListener("click", (ev) => {
  if (ev.target === aboutEl) toggleAbout(false);
}, sig);
const actBtn = document.getElementById("act-btn");
const actMenu = document.getElementById("act-menu");
actBtn.addEventListener("click", (ev) => {
  ev.stopPropagation();
  actMenu.hidden = !actMenu.hidden;
}, sig);
window.addEventListener("click", (ev) => {
  if (!actMenu.hidden && !ev.target.closest("#act-wrap")) {
    actMenu.hidden = true;
  }
}, sig);
actMenu.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-tool]");
  if (!b) return;
  tool = parseInt(b.dataset.tool, 10);
  paint = null;
  legendEl.querySelectorAll(".painting").forEach((n) => n.classList.remove("painting"));
  actMenu.hidden = true;
  actBtn.classList.add("armed");
  actBtn.innerHTML = `<b>⚡</b>${b.textContent.replace(/^\d/, "")}`;
}, sig);
function swatchHtml(id) {
  const c = BADGE[(id - 1) % 8];
  return `<span style="color:rgb(${c[0]},${c[1]},${c[2]})">■</span>`;
}
function teamOf(e) {
  if ((e.kind === EntKind.Servitor || e.kind === EntKind.Militor || e.kind === EntKind.Reaver) && e.brain)
    return { id: e.brain, mate: (o) => o.hp > 0 && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor || o.kind === EntKind.Reaver) && o.brain === e.brain };
  if (e.kind === EntKind.Breacher && e.team)
    return { id: e.team, mate: (o) => o.hp > 0 && o.kind === EntKind.Breacher && o.team === e.team };
  if ((e.kind === EntKind.Brood || e.kind === EntKind.Roamer || e.kind === EntKind.Egg) && e.lin)
    return { id: e.lin, mate: (o) => o.hp > 0 && (o.kind === EntKind.Brood || o.kind === EntKind.Roamer || o.kind === EntKind.Egg) && o.lin === e.lin };
  return null;
}
function chaosScore(w) {
  return w.burningCells * 2 + Math.sqrt(w.ventedThisTick) * 12 + Math.sqrt(w.leakingCells) * 5 + w.destruction * 1.5 + (w.melted ? 150 : 0);
}
const elChaosFill = document.getElementById("chaos-fill");
const elChaosNum = document.getElementById("chaos-num");
const elXeno = document.getElementById("st-xeno");
const elBrch = document.getElementById("st-brch");
const elOther = document.getElementById("st-other");
const elO2 = document.getElementById("st-o2");
const elReactor = document.getElementById("st-reactor");
let reactorHover = false;
elReactor.parentElement.addEventListener("mouseenter", () => {
  reactorHover = true;
});
elReactor.parentElement.addEventListener("mouseleave", () => {
  reactorHover = false;
});
elReactor.parentElement.style.cursor = "help";
const elFps = document.getElementById("st-fps");
const elTick = document.getElementById("st-tick");
const elSpeed = document.getElementById("st-speed");
const elNews = document.getElementById("news-line");
let fps = 60;
let lastT = performance.now();
function updateHud(w) {
  elChaosFill.style.width = `${Math.min(100, chaosDisplay / 8)}%`;
  elChaosNum.textContent = chaosDisplay.toFixed(0);
  let xeno = 0;
  let brch = 0;
  let other = 0;
  for (const e of w.ents) {
    if (e.kind === EntKind.Breacher) brch++;
    else if (e.kind === EntKind.Brood || e.kind === EntKind.Roamer) xeno++;
    else if (e.kind !== EntKind.Egg) other++;
  }
  elXeno.textContent = String(xeno);
  elBrch.textContent = String(brch);
  elOther.textContent = String(other);
  elO2.textContent = Math.max(0, w.o2Reserve).toFixed(0);
  let status;
  let color;
  if (w.melted) {
    status = "MELTED";
    color = "#c9452a";
  } else if (!w.reactorAlive) {
    status = "DEAD";
    color = "#c9452a";
  } else if (!w.coolingActive) {
    status = "OVERHEAT";
    color = "#c98a2a";
  } else {
    let backlog = 0;
    for (const plan of w.buildPlans)
      if (plan.restore) for (const st of plan.steps) backlog++;
    let floors = 0;
    let darkFloors = 0;
    for (let i = 0; i < w.mat.length; i++) {
      if (w.mat[i] !== Mat.Floor) continue;
      floors++;
      if (w.lightLevel[i] < 0.25) darkFloors++;
    }
    const darkFrac = floors ? darkFloors / floors : 0;
    if (backlog > 60 || darkFrac > 0.65 || w.leakingCells > 6) {
      status = "DEGRADED";
      color = "#c98a2a";
    } else if (backlog > 0 || darkFrac > 0.4 || w.leakingCells > 0) {
      status = "WORN";
      color = "#a8a04a";
    } else {
      status = "NOMINAL";
      color = "#5a9a6a";
    }
  }
  elReactor.textContent = status;
  elReactor.style.color = color;
  elTick.textContent = w.tick < 1e4 ? String(w.tick) : `${(w.tick / 1e3).toFixed(w.tick < 1e5 ? 1 : 0)}k`;
  elFps.textContent = fps.toFixed(0);
  elSpeed.textContent = paused ? "paused" : SPEED_LABELS[speedIdx];
  const latest = w.news[w.news.length - 1];
  if (latest) {
    const age = Math.max(0, (w.tick - latest.t) / 60 | 0);
    elNews.innerHTML = `<b>◆</b> ${esc(latest.msg)} <span style="color:#4d545e">· ${age}s</span>`;
  }
}
const elInspect = document.getElementById("inspect");
const MAT_NAMES = ["SPACE", "HULL", "WALL", "DECK", "DOOR (SEALED)", "DOOR (OPEN)", "MACHINE", "RUBBLE", "RESIN", "LATTICE", "TREE", "VINE"];
const MACHINE_NAMES = ["", "REACTOR", "FUEL TANK", "COOLANT TANK", "O2 GENERATOR", "MUNITIONS", "LIGHT", "AIR VENT"];
const ENT_NAMES = ["BROODMOTHER", "EGG", "ROAMER", "BREACHER", "SCAVENGER", "SERVITOR", "WEAVER", "MILITOR", "SHAMBLING MOUND", "SHRUB", "REAVER", "HAUNT", "GHAST", "ASHEN"];
const LIQ_NAMES = ["", "FUEL", "COOLANT", "ICHOR", "BLOOD"];
function esc(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function updateInspector(w) {
  if (mouseX < 0) {
    elInspect.style.display = "none";
    return;
  }
  const i = mouseY * W + mouseX;
  const m = w.mat[i];
  const lines = [];
  let head = MAT_NAMES[m] ?? "?";
  if (m === Mat.Lattice && (w.pipe[i] & Pipe.Wire) !== 0) {
    head = w.wirePowered[i] ? "LIGHTBRIDGE" : "LIGHTBRIDGE (banked charge)";
  }
  let headHtml = "";
  if (m === Mat.Machine) {
    head = MACHINE_NAMES[w.machine[i]] || "MACHINE";
    if (w.machine[i] === Machine.Reactor) {
      if (w.reactorCells.includes(i)) {
        head += ` · ${brainNameFn(w.brainId)}`;
        headHtml = ` ${swatchHtml(w.brainId)}#${w.brainId}`;
      } else {
        const own = w.reactorOwner[i];
        const crewed = own > 0 && w.ents.some(
          (o) => o.hp > 0 && o.brain === own && (o.kind === EntKind.Servitor || o.kind === EntKind.Militor)
        );
        head += own > 0 ? ` · ${brainNameFn(own)} (${crewed ? "rival" : "dormant"})` : " · dormant heart";
        if (own > 0) headHtml = ` ${swatchHtml(own)}#${own}`;
      }
    }
  }
  lines.push(`<span class="hd">${esc(head)}${headHtml}</span>  <span style="color:#565d66">${mouseX},${mouseY}</span>`);
  if (m === Mat.Machine && (w.machine[i] === Machine.Reactor || w.machine[i] === Machine.CoolantTank) && w.reactorAlive) {
    const brew = Math.min(0.5, w.coolantTankCells * 0.05);
    const res = `coolant reserve ${w.coolantReserve | 0} · brewing +${brew.toFixed(2)}/t`;
    lines.push(w.coolingActive ? res : `<span class="bad">flow LOST — core climbing ${w.coreHeat | 0}/3000</span> · ${esc(res)}`);
  }
  const rid = w.roomId[i];
  if (rid >= 0 && m !== Mat.Space) {
    const room = w.rooms[rid];
    const ll = w.lightLevel[i];
    const litLabel = ll >= 0.25 ? `lit ${Math.min(1, ll) * 100 | 0}%` : "dark — no powered light in range";
    lines.push(`${esc(room.isCorridor ? "corridor" : room.kind)} · ${litLabel}`);
  }
  if (m !== Mat.Machine && w.machine[i] === Machine.Light) lines.push("fixture: light");
  if (m !== Mat.Machine && w.machine[i] === Machine.Vent)
    lines.push(`fixture: air vent ${w.activeVents.has(i) ? "(active)" : "(dead)"}`);
  const p = w.pipe[i];
  if (p !== 0) {
    const parts = [];
    if (p & Pipe.Wire) parts.push("wire");
    if (p & Pipe.Fuel) parts.push("fuel line");
    if (p & Pipe.Coolant) parts.push("coolant line");
    if (p & Pipe.O2) parts.push("O2 line");
    lines.push(`conduit: ${parts.join(" + ")}${w.pipeBroken[i] ? ' <span class="bad">CUT</span>' : ""}`);
  }
  if (w.liqType[i] !== Liquid.None && w.liqAmt[i] > 0.02) {
    lines.push(`pooled: ${LIQ_NAMES[w.liqType[i]].toLowerCase()} ${w.liqAmt[i].toFixed(2)}`);
  }
  if (w.solidFuel[i] > 0.03) lines.push(`burnables: ${w.solidFuel[i].toFixed(2)}`);
  if (w.stain[i] > 0.1) lines.push(`<span class="bad">old blood — something died here</span>`);
  if (m !== Mat.Space) {
    const T = w.temp[i];
    const tCls = T > 300 ? "bad" : T > 120 ? "warn" : "";
    const a = w.air[i];
    const aCls = a < 0.15 ? "bad" : a < 0.5 ? "warn" : "";
    lines.push(
      `air <span class="${aCls}">${(a * 100).toFixed(0)}%</span> · temp <span class="${tCls}">${T.toFixed(0)}°</span>` + (w.smoke[i] > 0.1 ? ` · smoke ${w.smoke[i].toFixed(1)}` : "")
    );
    if (w.burn[i] > 0) lines.push(`<span class="bad">ON FIRE</span>`);
  } else {
    lines.push("hard vacuum");
  }
  for (const e of w.ents) {
    const hit = e.kind === EntKind.Brood ? mouseX >= e.x && mouseX <= e.x + 1 && mouseY >= e.y && mouseY <= e.y + 1 : e.x === mouseX && e.y === mouseY;
    if (hit) {
      let nm = ENT_NAMES[e.kind];
      if (e.kind === EntKind.Breacher) nm += ` · ${["GUNNER", "TORCHER", "LEADER"][e.cls ?? 0]}`;
      if (e.kind === EntKind.Egg && e.cls === 1) nm = "ROYAL EGG";
      if (e.kind === EntKind.Scav && e.cls === 1) nm = "RUSTLER";
      if (e.kind === EntKind.Scav && e.cls === 2) nm = "PROTECTOR";
      if (e.kind === EntKind.Weaver && e.cls === 1) nm = "MATRIARCH";
      if (e.kind === EntKind.Weaver && e.cls === 2) nm = "CONDUCTOR";
      if (e.kind === EntKind.Servitor) nm += ` · ${["PIONEER", "TENDER", "WARDEN", "BUILDER"][e.cls ?? 0]}`;
      lines.push(`<span class="ent">${nm}</span> hp ${e.hp}`);
      lines.push(`  ${esc(describeTaskFn(world, e))}`);
      if (e.kind === EntKind.Servitor || e.kind === EntKind.Militor || e.kind === EntKind.Reaver) {
        const b = e.brain;
        const tag = b ? ` ${swatchHtml(b)}#${b}` : "";
        lines.push(`  sworn to ${esc(brainNameFn(b))}${tag}`);
      }
      if (e.kind === EntKind.Breacher && e.team) {
        lines.push(`  squad ${swatchHtml(e.team)}#${e.team}`);
      }
      if ((e.kind === EntKind.Brood || e.kind === EntKind.Roamer) && e.lin) {
        lines.push(`  of dynasty ${swatchHtml(e.lin)}#${e.lin}`);
      }
    }
  }
  elInspect.innerHTML = lines.join("\n");
  elInspect.style.display = "block";
  const bw = elInspect.offsetWidth;
  const bh = elInspect.offsetHeight;
  let px2 = mouseClientX + 16;
  let py = mouseClientY + 16;
  if (px2 + bw > window.innerWidth - 8) px2 = mouseClientX - bw - 12;
  if (py + bh > window.innerHeight - 8) py = mouseClientY - bh - 12;
  elInspect.style.left = `${px2}px`;
  elInspect.style.top = `${py}px`;
}
let simAcc = 0;
window.addEventListener("error", (ev) => {
  var _a;
  return console.error("[derelict] error:", ev.message, (_a = ev.error) == null ? void 0 : _a.stack);
});
window.addEventListener("unhandledrejection", (ev) => console.error("[derelict] rejection:", ev.reason));
let wdSim = 0;
let wdRender = 0;
let wdOverlay = 0;
function loop() {
  const now = performance.now();
  const elapsed = Math.min(100, now - lastT);
  fps = fps * 0.95 + 1e3 / Math.max(1, now - lastT) * 0.05;
  lastT = now;
  frame++;
  const wd0 = performance.now();
  if (!paused) {
    const spd = SPEEDS[speedIdx];
    const tickMs = 1e3 / (60 * spd);
    simAcc += elapsed;
    let done = 0;
    const catchup = Math.max(2, Math.ceil(spd) * 2);
    while (simAcc >= tickMs && done < catchup) {
      simTickFn(world, rnd);
      simAcc -= tickMs;
      done++;
    }
    if (simAcc > tickMs * 4) simAcc = tickMs * 4;
    chaosDisplay += (chaosScore(world) - chaosDisplay) * 0.04;
  }
  const wd1 = performance.now();
  wdSim = wd1 - lastT < 1e4 ? wd1 - wd0 : 0;
  renderFn(world);
  octx.putImageData(img, 0, 0);
  wdRender = performance.now() - wd1;
  const wd2 = performance.now();
  const z = zoom();
  ctx.imageSmoothingEnabled = false;
  fitCanvas();
  const lsx = canvas.width / (W * RS);
  const lsy = canvas.height / (H * RS);
  ctx.setTransform(lsx, 0, 0, lsy, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, viewX * RS, viewY * RS, W / z * RS, H / z * RS, 0, 0, W * RS, H * RS);
  {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cellW = canvas.width * z / W;
    const cellH = canvas.height * z / H;
    const x0 = Math.max(0, Math.floor(viewX));
    const y0 = Math.max(0, Math.floor(viewY));
    const x1 = Math.min(W, Math.ceil(viewX + W / z));
    const y1 = Math.min(H, Math.ceil(viewY + H / z));
    const wmat = world.mat;
    const wl = world.lightLevel;
    const wf = world.fireGlow;
    let litDots = null;
    let darkDots = null;
    for (let cy = y0; cy < y1; cy++) {
      const rowI = cy * W;
      for (let cx = x0; cx < x1; cx++) {
        const mi = wmat[rowI + cx];
        if (mi !== Mat.Floor && mi !== Mat.DoorOpen && mi !== Mat.Rubble && mi !== Mat.Growth && mi !== Mat.Lattice && mi !== Mat.Vine)
          continue;
        const dx = Math.round((cx - viewX + 0.5) * cellW);
        const dy = Math.round((cy - viewY + 0.5) * cellH);
        if (Math.max(wl[rowI + cx], wf[rowI + cx]) >= 0.25) {
          (litDots ?? (litDots = new Path2D())).rect(dx, dy, 1, 1);
        } else {
          (darkDots ?? (darkDots = new Path2D())).rect(dx, dy, 1, 1);
        }
      }
    }
    if (litDots) {
      ctx.fillStyle = "rgba(240, 244, 248, 0.85)";
      ctx.fill(litDots);
    }
    if (darkDots) {
      ctx.fillStyle = "rgba(126, 130, 138, 0.8)";
      ctx.fill(darkDots);
    }
    {
      const wmat2 = world.mat;
      const green = (j) => j >= 0 && j < wmat2.length && (wmat2[j] === Mat.Vine || wmat2[j] === Mat.Tree);
      let vinePath = null;
      for (let cy2 = y0; cy2 < y1; cy2++) {
        const row2 = cy2 * W;
        for (let cx2 = x0; cx2 < x1; cx2++) {
          const i2 = row2 + cx2;
          if (wmat2[i2] !== Mat.Vine) continue;
          const mx = (cx2 - viewX + 0.5) * cellW;
          const my = (cy2 - viewY + 0.5) * cellH;
          const wob = (cx2 * 7 + cy2 * 13) % 5 - 2;
          for (const [oj, ox, oy] of [[i2 + 1, 1, 0], [i2 + W, 0, 1]]) {
            if (!green(oj)) continue;
            const nx2 = (cx2 + ox - viewX + 0.5) * cellW;
            const ny2 = (cy2 + oy - viewY + 0.5) * cellH;
            const p = vinePath ?? (vinePath = new Path2D());
            p.moveTo(mx, my);
            p.quadraticCurveTo(
              (mx + nx2) / 2 + (ox ? 0 : wob),
              (my + ny2) / 2 + (ox ? wob : 0),
              nx2,
              ny2
            );
          }
          if (!green(i2 - 1) && !green(i2 + 1) && !green(i2 - W) && !green(i2 + W)) {
            (vinePath ?? (vinePath = new Path2D())).moveTo(mx - 1, my);
            vinePath.quadraticCurveTo(mx + wob, my - 2, mx + 1, my + 1);
          }
        }
      }
      if (vinePath) {
        ctx.strokeStyle = "rgba(96, 168, 84, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke(vinePath);
      }
    }
    {
      const mats = world.mat;
      const pipes = world.pipe;
      const burns = world.burn;
      const broken = world.pipeBroken;
      const drawn = (j) => j >= 0 && j < pipes.length && pipes[j] !== 0 && mats[j] !== Mat.Machine && mats[j] !== Mat.Hull && mats[j] !== Mat.Wall && burns[j] === 0;
      const connD = (j) => j >= 0 && j < pipes.length && (pipes[j] !== 0 || mats[j] === Mat.Machine);
      const wl2 = world.lightLevel;
      const wf2 = world.fireGlow;
      const slotOf = (j) => {
        const p2 = pipes[j];
        const base = (p2 & Pipe.Fuel ? 0 : p2 & Pipe.Coolant ? 1 : p2 & Pipe.O2 ? 2 : 3) + (broken[j] ? 4 : 0);
        return base + (Math.max(wl2[j], wf2[j]) >= 0.25 ? 0 : 8);
      };
      const paths = new Array(16).fill(null);
      const px0 = (cx2) => Math.round((cx2 - viewX + 0.5) * cellW) + 0.5;
      const py0 = (cy2) => Math.round((cy2 - viewY + 0.5) * cellH) + 0.5;
      for (let cy2 = y0; cy2 < y1; cy2++) {
        const row2 = cy2 * W;
        for (let cx2 = x0; cx2 < x1; cx2++) {
          const i2 = row2 + cx2;
          if (!drawn(i2)) continue;
          const slot = slotOf(i2);
          const prevSame = drawn(i2 - 1) && slotOf(i2 - 1) === slot;
          if (prevSame) continue;
          if (!connD(i2 + 1) && !connD(i2 - 1)) continue;
          let endX = cx2;
          while (endX + 1 < W) {
            const nx = row2 + endX + 1;
            if (drawn(nx) && slotOf(nx) === slot && connD(nx)) endX++;
            else break;
          }
          const stubL = connD(i2 - 1) && !drawn(i2 - 1);
          const stubR = connD(row2 + endX + 1) && !drawn(row2 + endX + 1);
          if (endX === cx2 && !stubL && !stubR) continue;
          const path = paths[slot] ?? (paths[slot] = new Path2D());
          path.moveTo(px0(cx2) - (stubL ? cellW / 2 : 0), py0(cy2));
          path.lineTo(px0(endX) + (stubR ? cellW / 2 : 0), py0(cy2));
        }
      }
      for (let cx2 = x0; cx2 < x1; cx2++) {
        for (let cy2 = y0; cy2 < y1; cy2++) {
          const i2 = cy2 * W + cx2;
          if (!drawn(i2)) continue;
          const slot = slotOf(i2);
          const prevSame = drawn(i2 - W) && slotOf(i2 - W) === slot;
          if (prevSame) continue;
          if (!connD(i2 + W) && !connD(i2 - W)) continue;
          let endY = cy2;
          while (endY + 1 < H) {
            const ny = (endY + 1) * W + cx2;
            if (drawn(ny) && slotOf(ny) === slot && connD(ny)) endY++;
            else break;
          }
          const stubU = connD(i2 - W) && !drawn(i2 - W);
          const stubD = connD((endY + 1) * W + cx2) && !drawn((endY + 1) * W + cx2);
          if (endY === cy2 && !stubU && !stubD) continue;
          const path = paths[slot] ?? (paths[slot] = new Path2D());
          path.moveTo(px0(cx2), py0(cy2) - (stubU ? cellH / 2 : 0));
          path.lineTo(px0(cx2), py0(endY) + (stubD ? cellH / 2 : 0));
        }
      }
      const COND_COLORS = [
        "rgba(196, 118, 30, 0.9)",
        "rgba(40, 168, 196, 0.9)",
        "rgba(200, 214, 222, 0.85)",
        "rgba(220, 178, 48, 0.9)"
      ];
      const COND_DIM = [
        "rgba(196, 118, 30, 0.3)",
        "rgba(40, 168, 196, 0.3)",
        "rgba(200, 214, 222, 0.3)",
        "rgba(220, 178, 48, 0.3)"
      ];
      const dashOn = Math.max(2, cellW * 0.6);
      const dashOff = Math.max(1.5, cellW * 0.4);
      const period = dashOn + dashOff;
      ctx.lineWidth = 1;
      for (let k2 = 0; k2 < 16; k2++) {
        const path = paths[k2];
        if (!path) continue;
        const inDark = k2 >= 8;
        const kk = k2 & 7;
        ctx.globalAlpha = inDark ? 0.3 : 1;
        if (kk >= 4) {
          ctx.strokeStyle = COND_DIM[kk - 4];
          ctx.setLineDash([Math.max(1.5, cellW * 0.25), Math.max(1.5, cellW * 0.35)]);
          ctx.lineDashOffset = 0;
        } else {
          ctx.strokeStyle = COND_COLORS[kk];
          ctx.setLineDash([dashOn, dashOff]);
          ctx.lineDashOffset = -(frame * cellW * 0.01 % period);
        }
        ctx.stroke(path);
      }
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
    if (world.shots.length) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 236, 170, 0.13)";
      ctx.beginPath();
      const heads = [];
      for (const sh of world.shots) {
        if (sh.k !== 0) continue;
        const a = (world.tick - sh.t) / 8;
        if (a < 0 || a > 1) continue;
        const sx0 = (sh.x0 + 0.5 - viewX) * cellW;
        const sy0 = (sh.y0 + 0.5 - viewY) * cellH;
        const sx1 = (sh.x1 + 0.5 - viewX) * cellW;
        const sy1 = (sh.y1 + 0.5 - viewY) * cellH;
        const hx = sx0 + (sx1 - sx0) * a;
        const hy = sy0 + (sy1 - sy0) * a;
        const t0 = Math.max(0, a - 0.3);
        ctx.moveTo(sx0 + (sx1 - sx0) * t0, sy0 + (sy1 - sy0) * t0);
        ctx.lineTo(hx, hy);
        heads.push(hx, hy);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 250, 205, 1)";
      for (let h2 = 0; h2 < heads.length; h2 += 2) {
        ctx.fillRect(Math.round(heads[h2]), Math.round(heads[h2 + 1]), 1, 1);
      }
      for (const sh of world.shots) {
        if (sh.k !== 3) continue;
        const sx0 = (sh.x0 + 0.5 - viewX) * cellW;
        const sy0 = (sh.y0 + 0.5 - viewY) * cellH;
        const sx1 = (sh.x1 + 0.5 - viewX) * cellW;
        const sy1 = (sh.y1 + 0.5 - viewY) * cellH;
        ctx.strokeStyle = "rgba(46, 74, 190, 0.4)";
        ctx.beginPath();
        ctx.moveTo(sx0, sy0);
        ctx.lineTo(sx1, sy1);
        ctx.stroke();
        const p = frame % 22 / 22;
        ctx.fillStyle = "rgba(120, 160, 255, 0.95)";
        ctx.fillRect(Math.round(sx0 + (sx1 - sx0) * p), Math.round(sy0 + (sy1 - sy0) * p), 1, 1);
      }
    }
    const claimA = (0.5 + 0.5 * Math.sin(frame * 0.22) ** 2).toFixed(3);
    const CLAIM_MACHINE = `rgba(109, 85, 200, ${claimA})`;
    const CLAIM_SQUAD = `rgba(255, 200, 64, ${claimA})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    const claimPhase = -(frame * 0.6 % 12);
    ctx.lineDashOffset = claimPhase;
    const claimDrawn = /* @__PURE__ */ new Map();
    for (const e of world.ents) {
      const machineHand = e.kind === EntKind.Servitor || e.kind === EntKind.Militor;
      const squadHand = e.kind === EntKind.Breacher && e.cls === 1 && e.patrol !== true;
      if (!machineHand && !squadHand) continue;
      if (e.hp <= 0 || e.tx === void 0 || e.tx < 0) continue;
      if (machineHand && (e.mode ?? 0) >= 3) continue;
      const dx = (e.tx - viewX) * cellW;
      const dy = (e.ty - viewY) * cellH;
      if (dx < -cellW || dy < -cellH || dx > canvas.width || dy > canvas.height) continue;
      const ci = e.ty * W + e.tx;
      const first = claimDrawn.get(ci);
      if (first === machineHand) continue;
      if (first === void 0) claimDrawn.set(ci, machineHand);
      ctx.lineDashOffset = first === void 0 ? claimPhase : claimPhase + 3;
      ctx.strokeStyle = machineHand ? CLAIM_MACHINE : CLAIM_SQUAD;
      ctx.strokeRect(Math.round(dx) + 0.5, Math.round(dy) + 0.5, Math.round(cellW) - 1, Math.round(cellH) - 1);
      if (machineHand && e.brain) {
        const bc = BADGE[(e.brain - 1) % 8];
        ctx.strokeStyle = `rgba(${bc[0]}, ${bc[1]}, ${bc[2]}, ${claimA})`;
        ctx.strokeRect(Math.round(dx) + 2.5, Math.round(dy) + 2.5, Math.round(cellW) - 5, Math.round(cellH) - 5);
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
  if (reactorHover) {
    const zc = zoom();
    const cs = RS * zc;
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(frame * 0.15));
    ctx.lineWidth = 2;
    for (let i = 0; i < world.mat.length; i++) {
      if (world.mat[i] !== Mat.Machine) continue;
      if (world.machine[i] !== Machine.Reactor) continue;
      const x = i % W;
      const y = i / W | 0;
      const official = world.reactorCells.includes(i);
      ctx.strokeStyle = official ? `rgba(120, 255, 160, ${pulse})` : `rgba(255, 200, 80, ${pulse * 0.7})`;
      const sx = (x - viewX) * cs;
      const sy = (y - viewY) * cs;
      if (world.machine[i - 1] !== Machine.Reactor || world.mat[i - 1] !== Mat.Machine) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + cs);
        ctx.stroke();
      }
      if (world.machine[i + 1] !== Machine.Reactor || world.mat[i + 1] !== Mat.Machine) {
        ctx.beginPath();
        ctx.moveTo(sx + cs, sy);
        ctx.lineTo(sx + cs, sy + cs);
        ctx.stroke();
      }
      if (world.machine[i - W] !== Machine.Reactor || world.mat[i - W] !== Mat.Machine) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + cs, sy);
        ctx.stroke();
      }
      if (world.machine[i + W] !== Machine.Reactor || world.mat[i + W] !== Mat.Machine) {
        ctx.beginPath();
        ctx.moveTo(sx, sy + cs);
        ctx.lineTo(sx + cs, sy + cs);
        ctx.stroke();
      }
    }
  }
  if (mouseX >= 0) {
    const z2 = zoom();
    for (const e of world.ents) {
      const hit = e.kind === EntKind.Brood ? mouseX >= e.x && mouseX <= e.x + 1 && mouseY >= e.y && mouseY <= e.y + 1 : e.x === mouseX && e.y === mouseY;
      if (!hit) continue;
      ctx.fillStyle = "rgba(255, 235, 170, 0.45)";
      if (e.path && e.pi !== void 0) {
        for (let k = e.pi; k < e.path.length; k++) {
          const cx = e.path[k] % W;
          const cy = e.path[k] / W | 0;
          ctx.fillRect(
            ((cx + 0.5 - viewX) * z2 - 0.15) * RS,
            ((cy + 0.5 - viewY) * z2 - 0.15) * RS,
            0.3 * z2 * RS,
            0.3 * z2 * RS
          );
        }
      }
      if (e.tx !== void 0 && e.tx >= 0) {
        ctx.strokeStyle = "rgba(255, 235, 170, 0.8)";
        ctx.lineWidth = 0.8;
        const ox = (e.tx + 0.5 - viewX) * z2 * RS;
        const oy = ((e.ty ?? 0) + 0.5 - viewY) * z2 * RS;
        const s2 = 0.6 * z2 * RS;
        ctx.strokeRect(ox - s2 / 2, oy - s2 / 2, s2, s2);
      }
      {
        const tm = teamOf(e);
        if (tm) {
          const c = BADGE[(tm.id - 1) % 8];
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const cellW = canvas.width * z2 / W;
          const cellH = canvas.height * z2 / H;
          const cx0 = (e.x + (e.kind === EntKind.Brood ? 1 : 0.5) - viewX) * cellW;
          const cy0 = (e.y + (e.kind === EntKind.Brood ? 1 : 0.5) - viewY) * cellH;
          ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.55)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const o of world.ents) {
            if (o === e || !tm.mate(o)) continue;
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(
              (o.x + (o.kind === EntKind.Brood ? 1 : 0.5) - viewX) * cellW,
              (o.y + (o.kind === EntKind.Brood ? 1 : 0.5) - viewY) * cellH
            );
          }
          ctx.stroke();
          if ((e.kind === EntKind.Servitor || e.kind === EntKind.Militor) && e.brain === world.brainId && world.reactorCells.length) {
            const rc = world.reactorCells[0];
            ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.9)`;
            ctx.beginPath();
            ctx.moveTo(cx0, cy0);
            ctx.lineTo(
              (rc % W + 1 - viewX) * cellW,
              ((rc / W | 0) + 1 - viewY) * cellH
            );
            ctx.stroke();
          }
          ctx.restore();
        }
      }
      break;
    }
  }
  if (mouseX >= 0) {
    ctx.strokeStyle = "rgba(255, 220, 150, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(
      (mouseX + 0.5 - viewX) * z * RS,
      (mouseY + 0.5 - viewY) * z * RS,
      (TOOL_RADIUS[tool] + 0.5) * z * RS,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  if (splashLeft > 0) {
    splashLeft--;
    const a = Math.min(1, splashLeft / 15);
    const cw = W * RS;
    const chh = H * RS;
    ctx.fillStyle = `rgba(5, 6, 10, ${0.6 * a})`;
    ctx.fillRect(0, 0, cw, chh);
    ctx.font = "bold 44px monospace";
    ctx.textAlign = "center";
    const cx = cw / 2;
    const cy = chh / 2 + 15;
    const jx = frame * 7 % 5 - 2;
    ctx.fillStyle = `rgba(210, 44, 32, ${0.75 * a})`;
    ctx.fillText("DERELICT", cx + 2 + jx * 0.4, cy);
    ctx.fillStyle = `rgba(48, 170, 210, ${0.75 * a})`;
    ctx.fillText("DERELICT", cx - 2 - jx * 0.4, cy);
    ctx.fillStyle = `rgba(224, 230, 238, ${0.95 * a})`;
    ctx.fillText("DERELICT", cx, cy);
    ctx.fillStyle = `rgba(5, 6, 10, ${0.95 * a})`;
    for (let k = 0; k < 26; k++) {
      const hx = (k * 761 + frame * 13) % (cw + 80) - 40;
      const hy = cy - 36 + k * 53 % 46;
      ctx.fillRect(hx, hy, 6 + k * 29 % 30, 1 + k % 3);
    }
    ctx.textAlign = "left";
  }
  if (paused) {
    ctx.fillStyle = "rgba(200, 210, 220, 0.8)";
    ctx.font = "16px monospace";
    ctx.fillText("PAUSED", 8, 20);
  }
  if (frame % 10 === 0) updateHud(world);
  if (frame % 3 === 0) updateInspector(world);
  wdOverlay = performance.now() - wd2;
  const wdTotal = performance.now() - wd0;
  if (wdTotal > 250) {
    console.warn(
      `[derelict] slow frame: total=${wdTotal.toFixed(0)}ms sim=${wdSim.toFixed(0)}ms render=${wdRender.toFixed(0)}ms overlay+ui=${wdOverlay.toFixed(0)}ms ents=${world.ents.length} plans=${world.buildPlans.length} paused=${paused} zoom=${zoom()}`
    );
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
