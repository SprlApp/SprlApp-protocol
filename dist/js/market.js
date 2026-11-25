// Live market. Follows the market register record only: the CA record has zero effect here.
import { isStated } from './register.js';
import { num } from './format.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson(url, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Exponential backoff: base * 2^attempt between tries.
export async function withBackoff(fn, { tries = 4, base = 800, sleepFn = sleep } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries - 1) await sleepFn(base * 2 ** i); }
  }
  throw last;
}

export function pickTop(boosts, n = 10) {
  const seen = new Set();
  return (Array.isArray(boosts) ? boosts : [])
    .filter((b) => b && b.chainId === 'solana' && b.tokenAddress)
    .sort((a, b) => (num(b.totalAmount) ?? 0) - (num(a.totalAmount) ?? 0))
    .filter((b) => (seen.has(b.tokenAddress) ? false : seen.add(b.tokenAddress)))
    .slice(0, n);
}

export function bestPair(pairs, addr) {
  const list = (Array.isArray(pairs) ? pairs : []).filter((p) => p && (!p.chainId || p.chainId === 'solana'));
  const base = list.filter((p) => p.baseToken && p.baseToken.address === addr);
  const pool = base.length ? base : list;
  return [...pool].sort((a, b) => (num(b.volume?.h24) ?? 0) - (num(a.volume?.h24) ?? 0))[0] || null;
}

export function toRow(addr, pair, boost = {}) {
  if (!pair) return { address: addr, ok: false, symbol: null, name: null, logos: boost.icon ? [boost.icon] : [] };
  const t = pair.baseToken && pair.baseToken.address === addr ? pair.baseToken : pair.baseToken || {};
  return {
    address: addr,
    ok: true,
    symbol: t.symbol || null,
    name: t.name || null,
    logos: [pair.info?.imageUrl, boost.icon].filter(Boolean),
    price: num(pair.priceUsd),
    change24: num(pair.priceChange?.h24),
    volume24: num(pair.volume?.h24),
    liquidity: num(pair.liquidity?.usd),
    url: pair.url || null,
  };
}

export async function loadMarket(register, { fetchImpl = globalThis.fetch, sleepFn = sleep } = {}) {
  const m = register.market;
  if (!isStated(m)) throw new Error('market source not stated');
  const boosts = await withBackoff(() => fetchJson(m.boosts, fetchImpl), { sleepFn });
  const top = pickTop(boosts, 10);
  if (!top.length) throw new Error('no solana tokens in source');
  const rows = await Promise.all(
    top.map(async (b) => {
      try {
        const pairs = await withBackoff(() => fetchJson(m.tokens + encodeURIComponent(b.tokenAddress), fetchImpl), { tries: 2, base: 600, sleepFn });
        return toRow(b.tokenAddress, bestPair(pairs, b.tokenAddress), b);
      } catch { return toRow(b.tokenAddress, null, b); }
    })
  );
  return rows;
}
