/* ---------------------------------------------------------------------------
 * U / Fmt / Bus — the utility layer. Everything else in EVERDAO depends on this.
 *
 * This module reads NOTHING from S and touches no DOM. It is pure helpers.
 *
 * FORMULAS
 *   hash(str)     FNV-1a 32-bit then an avalanche finaliser, returned unsigned:
 *                   h = 2166136261; per char: h = (h ^ c) * 16777619  (mod 2^32)
 *                   h ^= h>>>16; h *= 2246822507; h ^= h>>>13;
 *                   h *= 3266489909; h ^= h>>>16
 *   rngFrom(seed) mulberry32:
 *                   a = (a + 0x6D2B79F5) mod 2^32 ; t = a
 *                   t = imul(t ^ (t>>>15), t | 1)
 *                   t ^= t + imul(t ^ (t>>>7), t | 61)
 *                   return ((t ^ (t>>>14)) >>> 0) / 2^32          -> [0,1)
 *   Fmt.n(v)      tier = floor(log1000(|v|)) ; s = |v| / 1000^tier
 *                   tier 0 -> round to integer
 *                   tier 1..4 -> K,M,B,T ; tier>=5 -> two letters where
 *                     idx = tier-5, first='a'+floor(idx/26), second='a'+idx%26
 *                     (1e15='aa', 1e18='ab', ... 1e90='az', 1e93='ba')
 *                   3 significant figures: s<10 -> 2dp, s<100 -> 1dp, else 0dp
 *   weekStr(d)    ISO-8601 week, computed on LOCAL dates:
 *                   thu  = local midnight of d, shifted to its week's Thursday
 *                   base = Thursday of the week containing Jan 4 of thu's year
 *                   week = 1 + round((thu - base) / 7 days)
 *   uNameFrom     rng = rngFrom(seed); surname, given, then a 40% epithet roll,
 *                 so the same seed always yields the same name.
 * ------------------------------------------------------------------------ */

const U = {

  /* ------------------------------------------------------------ RANDOMNESS */
  /* Float in [min(a,b), max(a,b)). U.rand() -> [0,1) ; U.rand(5) -> [0,5). */
  rand(a, b) {
    let hi = (a === undefined) ? 1 : Number(a);
    let lo = (b === undefined) ? 0 : Number(b);
    if (!Number.isFinite(hi)) hi = 1;
    if (!Number.isFinite(lo)) lo = 0;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    return lo + Math.random() * (hi - lo);
  },
  /* Integer, inclusive of both ends. U.rint(5) -> 0..5 ; U.rint(2,4) -> 2..4. */
  rint(a, b) {
    let lo, hi;
    if (b === undefined) { lo = 0; hi = Number(a); }
    else { lo = Number(a); hi = Number(b); }
    if (!Number.isFinite(lo)) lo = 0;
    if (!Number.isFinite(hi)) hi = 0;
    lo = Math.floor(lo); hi = Math.floor(hi);
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  },
  /* Boolean roll. p is a probability in 0..1; out-of-range is clamped. */
  chance(p) {
    const x = Number(p);
    if (!Number.isFinite(x)) return false;
    if (x <= 0) return false;
    if (x >= 1) return true;
    return Math.random() < x;
  },
  /* Uniform element. Returns null for a missing or empty array. */
  pick(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  },
  /* wfn(item, i) => weight. Negative/NaN weights count as 0.
     If every weight is 0 the pick falls back to uniform. */
  weightedPick(arr, wfn) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (typeof wfn !== 'function') return U.pick(arr);
    const w = new Array(arr.length);
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
      let x = Number(wfn(arr[i], i));
      if (!Number.isFinite(x) || x < 0) x = 0;
      w[i] = x;
      total += x;
    }
    if (total <= 0) return U.pick(arr);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) {
      r -= w[i];
      if (r < 0) return arr[i];
    }
    return arr[arr.length - 1];
  },
  /* Fisher-Yates. Returns a NEW array; the input is never mutated. */
  shuffle(arr) {
    const out = Array.isArray(arr) ? arr.slice() : [];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  },

  /* -------------------------------------------------------------- NUMBERS */

  clamp(v, lo, hi) {
    let x = Number(v);
    const a = Number(lo);
    const b = Number(hi);
    if (!Number.isFinite(x)) x = Number.isFinite(a) ? a : 0;
    if (Number.isFinite(a) && x < a) x = a;
    if (Number.isFinite(b) && x > b) x = b;
    return x;
  },
  /* Sum of an array. Optional fn(item,i) selector. Non-numbers are skipped. */
  sum(arr, fn) {
    if (!Array.isArray(arr)) return 0;
    let t = 0;
    for (let i = 0; i < arr.length; i++) {
      const x = Number(typeof fn === 'function' ? fn(arr[i], i) : arr[i]);
      if (Number.isFinite(x)) t += x;
    }
    return t;
  },
  /* Deterministic unsigned 32-bit hash (FNV-1a + avalanche). Same string in,
     same number out, forever — safe to persist in saves as a seed. */
  hash(str) {
    const s = (str === null || str === undefined) ? '' : String(str);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  },
  /* mulberry32. seed may be a number or any string (it gets hashed).
     Returns a zero-arg function producing floats in [0,1). */
  rngFrom(seed) {
    let a;
    if (typeof seed === 'number' && Number.isFinite(seed)) a = Math.floor(seed) >>> 0;
    else a = U.hash(seed);
    if (a === 0) a = 0x9E3779B9;
    return function everdaoRng() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  /* ----------------------------------------------------------------- TIME */
  /* 'YYYY-MM-DD' in the player's LOCAL timezone (never UTC — daily resets
     must line up with the player's own midnight). */
  todayStr(d) {
    const dt = U._toDate(d);
    return dt.getFullYear() + '-' + U._p2(dt.getMonth() + 1) + '-' + U._p2(dt.getDate());
  },
  /* 'YYYY-Www' — ISO-8601 week number, computed on LOCAL dates.
     Note the year is the ISO week-year, which can differ from the calendar
     year for the first/last days of January/December. */
  weekStr(d) {
    const src = U._toDate(d);
    const thu = new Date(src.getFullYear(), src.getMonth(), src.getDate());
    const dow = (thu.getDay() + 6) % 7;           // Mon=0 .. Sun=6
    thu.setDate(thu.getDate() - dow + 3);         // Thursday of this ISO week
    const isoYear = thu.getFullYear();
    const base = new Date(isoYear, 0, 4);         // Jan 4 is always in week 1
    const bdow = (base.getDay() + 6) % 7;
    base.setDate(base.getDate() - bdow + 3);      // Thursday of week 1
    const week = 1 + Math.round((thu.getTime() - base.getTime()) / 604800000);
    return isoYear + '-W' + U._p2(week);
  },

  /* --------------------------------------------------------------- OBJECTS */
  /* JSON round-trip clone. Primitives pass through. Never throws. */
  deepClone(o) {
    if (o === null || typeof o !== 'object') return o;
    try {
      return JSON.parse(JSON.stringify(o));
    } catch (e) {
      console.warn('[U.deepClone] clone failed, returning empty container', e);
      return Array.isArray(o) ? [] : {};
    }
  },
  /* Short unique string id. Monotonic counter + time + a little noise. */
  id() {
    U._idc = (U._idc + 1) % 2176782336;
    return 'i' + Date.now().toString(36) + '-' +
           U._idc.toString(36) + '-' +
           Math.floor(Math.random() * 46656).toString(36);
  },

  /* -------------------------------------------------------------- private */

  _idc: 0,

  _p2(n) {
    const x = Math.floor(Number(n));
    if (!Number.isFinite(x)) return '00';
    if (x < 0) return '00';
    return x < 10 ? '0' + x : String(x);
  },
  /* Accepts a Date, ms epoch, parseable string, or nothing. Always returns a
     valid Date (falls back to "now" rather than producing Invalid Date). */
  _toDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? new Date() : v;
    if (typeof v === 'number' && Number.isFinite(v)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    if (typeof v === 'string' && v) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  },
};

/* ========================================================================= */

const Fmt = {
  /* 1.23K / 12.3M / 123B — always 3 significant figures above 1000,
     plain integers below it. Handles null/undefined/NaN/Infinity as 0. */
  n(v) {
    return Fmt._fmt(v, false);
  },
  /* Same suffix ladder, but always exactly one decimal place. */
  n1(v) {
    return Fmt._fmt(v, true);
  },
  /* 0.125 -> '12.5%' (dp defaults to 1). */
  pct(v, dp) {
    let d = (dp === undefined || dp === null) ? 1 : Math.floor(Number(dp));
    if (!Number.isFinite(d) || d < 0) d = 0;
    if (d > 6) d = 6;
    const x = Fmt._num(v) * 100;
    let s = x.toFixed(d);
    if (parseFloat(s) === 0) s = (0).toFixed(d);   // kill '-0.0%'
    return s + '%';
  },
  /* '3d 4h' / '4h 12m' / '12m 30s' / '30s'. Negatives clamp to 0 -> '0s'.
     The smaller unit is dropped when it is zero ('4h', not '4h 0m'). */
  dur(sec) {
    let s = Math.floor(Fmt._num(sec));
    if (s < 0) s = 0;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (d > 0) return h > 0 ? (d + 'd ' + h + 'h') : (d + 'd');
    if (h > 0) return m > 0 ? (h + 'h ' + m + 'm') : (h + 'h');
    if (m > 0) return ss > 0 ? (m + 'm ' + ss + 's') : (m + 'm');
    return ss + 's';
  },
  /* 'MM:SS', or 'H:MM:SS' once past an hour. Negatives clamp to '00:00'. */
  durShort(sec) {
    let s = Math.floor(Fmt._num(sec));
    if (s < 0) s = 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return h + ':' + Fmt._p2(m) + ':' + Fmt._p2(ss);
    return Fmt._p2(m) + ':' + Fmt._p2(ss);
  },
  /* Local wall-clock 'HH:MM' (24h). Bad input renders '--:--'. */
  time(ms) {
    const t = (ms === undefined || ms === null) ? Date.now() : Number(ms);
    if (!Number.isFinite(t)) return '--:--';
    const d = new Date(t);
    if (isNaN(d.getTime())) return '--:--';
    return Fmt._p2(d.getHours()) + ':' + Fmt._p2(d.getMinutes());
  },
  /* '+12' / '-3' — magnitude runs through Fmt.n so big deltas stay short. */
  sign(v) {
    const x = Fmt._num(v);
    if (x < 0) return '-' + Fmt.n(-x);
    return '+' + Fmt.n(x);
  },

  /* -------------------------------------------------------------- private */
  /* Coerce anything to a finite number; non-finite and junk become 0. */
  _num(v) {
    if (v === null || v === undefined || v === '') return 0;
    const x = (typeof v === 'number') ? v : Number(v);
    if (!Number.isFinite(x)) return 0;
    return x;
  },

  _p2(n) {
    const x = Math.floor(Number(n));
    if (!Number.isFinite(x) || x < 0) return '00';
    return x < 10 ? '0' + x : String(x);
  },
  /* tier 0 -> '' ; 1..4 -> K M B T ; 5+ -> aa, ab, ... az, ba, bb, ...
     Number.MAX_VALUE is only tier ~102, so two letters always suffice. */
  _suffix(t) {
    if (t <= 0) return '';
    if (t === 1) return 'K';
    if (t === 2) return 'M';
    if (t === 3) return 'B';
    if (t === 4) return 'T';
    const idx = t - 5;
    const first = Math.floor(idx / 26);
    const second = idx % 26;
    if (first > 25) return 'e' + (t * 3);
    return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);
  },
  /* Shared engine for n() and n1(). oneDp forces exactly one decimal. */
  _fmt(v, oneDp) {
    const x = Fmt._num(v);
    const neg = x < 0;
    let a = Math.abs(x);

    if (a < 1000) {
      if (oneDp) {
        const s0 = a.toFixed(1);
        if (parseFloat(s0) < 1000) {
          return (neg && parseFloat(s0) !== 0 ? '-' : '') + s0;
        }
        a = 1000;                       // 999.99 rounded up into the next tier
      } else {
        const r = Math.round(a);
        if (r < 1000) return (neg && r !== 0 ? '-' : '') + String(r);
        a = 1000;
      }
    }

    let tier = 0;
    let s = a;
    while (s >= 1000 && tier < 120) { s = s / 1000; tier++; }

    let dp = oneDp ? 1 : (s < 10 ? 2 : (s < 100 ? 1 : 0));
    let str = s.toFixed(dp);
    if (parseFloat(str) >= 1000) {       // e.g. 999.96 -> '1000' : bump a tier
      tier++;
      s = s / 1000;
      dp = oneDp ? 1 : 2;
      str = s.toFixed(dp);
    }
    return (neg ? '-' : '') + str + Fmt._suffix(tier);
  },
};

/* ========================================================================= */

const Bus = {
  /* evt -> [fn]. Null-prototype so event names like 'constructor' are safe. */
  _m: Object.create(null),
  /* Subscribe. Returns an idempotent unsubscribe function.
     Listeners on '*' receive (evt, data) instead of just (data). */
  on(evt, fn) {
    if (typeof evt !== 'string' || typeof fn !== 'function') {
      console.warn('[Bus.on] ignored bad subscription', evt);
      return function noopUnsub() {};
    }
    let list = Bus._m[evt];
    if (!list) { list = []; Bus._m[evt] = list; }
    list.push(fn);
    let done = false;
    return function busUnsub() {
      if (done) return;
      done = true;
      const l = Bus._m[evt];
      if (!l) return;
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    };
  },
  /* Manual unsubscribe, for callers that kept the fn instead of the unsub. */
  off(evt, fn) {
    if (typeof evt !== 'string') return;
    const l = Bus._m[evt];
    if (!l) return;
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  },
  /* Drop every listener for one event, or all events when evt is omitted. */
  clear(evt) {
    if (typeof evt === 'string') { delete Bus._m[evt]; return; }
    Bus._m = Object.create(null);
  },
  /* Fire. data is normalised to an object. A throwing listener is warned
     about and skipped — one bad listener must never break the game loop. */
  emit(evt, data) {
    if (typeof evt !== 'string') return;
    const payload = (data === null || data === undefined) ? {} : data;

    const list = Bus._m[evt];
    if (list && list.length) {
      const copy = list.slice();          // snapshot: listeners may unsubscribe
      for (let i = 0; i < copy.length; i++) {
        try {
          copy[i](payload);
        } catch (e) {
          console.warn('[Bus] listener for "' + evt + '" threw', e);
        }
      }
    }

    if (evt !== '*') {
      const wild = Bus._m['*'];
      if (wild && wild.length) {
        const wcopy = wild.slice();
        for (let i = 0; i < wcopy.length; i++) {
          try {
            wcopy[i](evt, payload);
          } catch (e) {
            console.warn('[Bus] wildcard listener threw on "' + evt + '"', e);
          }
        }
      }
    }
  },
};

/* ========================================================================= */

/* Deterministic cultivator name — the same seed always yields the same string,
   so a duel ladder can be regenerated from a seed instead of being saved.
   Pass DATA.names.surnames / .givens / .epithets; each argument is optional and
   falls back to a built-in list, so this never throws during early boot.
   Epithets are joined with a plain space because DATA.names.epithets already
   carry their own connector ('the Unswept', 'of the Late Frost', 'Nine-Cup').
   Shape: 'Shen Qingzhi' or 'Shen Qingzhi of the Late Frost'. The epithet slot
   is drawn uniformly from (epithets.length + 1) options — one of which is "no
   epithet" — so with the shipped 20 x 24 x 16 tables all 480 x 17 = 8160 names
   are equally likely. It is still a hash, not a bijection: a caller minting a
   large roster (duel ladder) must dedupe and re-seed on collision. */
function uNameFrom(seed, surnames, givens, epithets) {
  const sList = (Array.isArray(surnames) && surnames.length)
    ? surnames
    : ['Shen', 'Yun', 'Bai', 'Mo', 'Luo', 'Xie', 'Gu', 'Wen'];
  const gList = (Array.isArray(givens) && givens.length)
    ? givens
    : ['Qingzhi', 'Wanyu', 'Beiran', 'Yizhen', 'Muxue', 'Anluo', 'Jiuyin', 'Suqing'];
  const eList = Array.isArray(epithets) ? epithets : [];

  const rng = U.rngFrom(seed);
  const sur = String(sList[Math.floor(rng() * sList.length) % sList.length] || 'Shen');
  const giv = String(gList[Math.floor(rng() * gList.length) % gList.length] || 'Qingzhi');
  const slot = Math.floor(rng() * (eList.length + 1)) - 1;   // -1 => no epithet

  let name = sur + ' ' + giv;
  if (slot >= 0 && slot < eList.length) {
    const ep = String(eList[slot] || '').trim();
    if (ep) name = name + ' ' + ep;
  }
  return name;
}

/* Roman numerals I..XX, used for realm phase display (phase is 1..9).
   0 or below renders ''; anything above XX falls back to the plain number. */
function uRomanize(n) {
  const T = uRomanize._t || (uRomanize._t = [
    '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  ]);
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return '';
  if (x <= 0) return '';
  if (x <= 20) return T[x];
  return String(x);
}
