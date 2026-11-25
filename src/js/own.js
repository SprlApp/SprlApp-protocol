// Own-token row. Dex + pump.fun are fired together and never wait on each other (rule 6).
import { isStated } from './register.js';
import { fetchJson, bestPair } from './market.js';
import { num } from './format.js';

export async function loadOwn(register, { fetchImpl = globalThis.fetch, fallbackLogo } = {}) {
  if (!isStated(register.ca)) return null;
  const ca = register.ca.value;
  const dexP = fetchJson(register.dex.latest + encodeURIComponent(ca), fetchImpl);   // started
  const pumpP = fetchJson(register.pump.coins + encodeURIComponent(ca), fetchImpl);  // started in parallel
  const [dex, pump] = await Promise.allSettled([dexP, pumpP]);
  const pair = dex.status === 'fulfilled' ? bestPair(dex.value?.pairs, ca) : null;
  const coin = pump.status === 'fulfilled' ? pump.value : null;
  // logo chain: pump.fun image_uri -> DexScreener -> brand/ -> letter tile (final fallback lives in the DOM layer)
  const logos = [coin?.image_uri, pair?.info?.imageUrl, fallbackLogo].filter(Boolean);
  return {
    address: ca,
    own: true,
    ok: !!(pair || coin),
    symbol: pair?.baseToken?.symbol || coin?.symbol || 'SPRL',
    name: pair?.baseToken?.name || coin?.name || 'SPRL',
    logos,
    price: num(pair?.priceUsd),
    change24: num(pair?.priceChange?.h24),
    volume24: num(pair?.volume?.h24),
    liquidity: num(pair?.liquidity?.usd),
    url: register.dex.page + ca,
    sources: { dex: dex.status, pump: pump.status },
  };
}

// Own token is row #1; any duplicate is removed from the trending rows 2-10.
export function composeBoard(own, trending, ca) {
  const rest = trending.filter((r) => !ca || r.address !== ca).slice(0, 9);
  return [own, ...rest];
}
