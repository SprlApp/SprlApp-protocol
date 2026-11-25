// REGISTER — every external fact is one record with state: stated | absent | unconfirmed.
// Absent / unconfirmed records render inert. The store is read at runtime by every consumer.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export const STATES = ['stated', 'absent', 'unconfirmed'];

export function createRegister() {
  return {
    chain: { state: 'stated', name: 'Solana', cluster: 'mainnet-beta', rpc: 'https://solana-rpc.publicnode.com' },
    ca: { state: 'absent', value: null },
    x: { state: 'stated', url: 'https://x.com/SpiralApp' },
    github: { state: 'absent', url: null },
    market: {
      state: 'stated',
      boosts: 'https://api.dexscreener.com/token-boosts/top/v1',
      tokens: 'https://api.dexscreener.com/tokens/v1/solana/',
    },
    dex: { state: 'stated', latest: 'https://api.dexscreener.com/latest/dex/tokens/', page: 'https://dexscreener.com/solana/' },
    pump: { state: 'stated', coins: 'https://frontend-api.pump.fun/coins/' },
  };
}

export const isStated = (rec) => !!rec && rec.state === 'stated';
export const isCaShape = (v) => typeof v === 'string' && BASE58.test(v);

// LINK RULE: URL is stored, handle derived, no href for unstated records.
export const hrefOf = (rec) => (isStated(rec) && rec.url ? rec.url : null);
export function handleOf(rec) {
  const href = hrefOf(rec);
  if (!href) return null;
  try {
    const seg = new URL(href).pathname.split('/').filter(Boolean)[0];
    return seg || null;
  } catch { return null; }
}

// A CA only counts as stated if it is address-shaped; otherwise it degrades to unconfirmed.
export function normalizeCa(patch) {
  if (patch.state === 'stated' && !isCaShape(patch.value)) return { state: 'unconfirmed', value: patch.value ?? null };
  if (patch.state !== 'stated') return { state: patch.state ?? 'absent', value: patch.value ?? null };
  return { state: 'stated', value: patch.value };
}

export function createStore(register = createRegister()) {
  const subs = new Set();
  return {
    get: () => register,
    record: (name) => register[name],
    set(name, patch) {
      register[name] = name === 'ca' ? normalizeCa(patch) : { ...register[name], ...patch };
      subs.forEach((fn) => fn(name, register));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
