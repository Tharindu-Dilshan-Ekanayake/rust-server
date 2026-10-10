/**
 * Ranks and XP. Every weapon is open to everyone; ranks are for show
 * (insignia, promotions).
 *
 * The server awards XP (it's the one that knows who killed whom); the client
 * keeps the running total and works out the rank. Ranks follow the army ladder
 * from Private up to General.
 */

/** XP needed to *reach* each rank. Index 0 is rank 1. */
export const RANKS = Object.freeze([
  { name: 'Private', short: 'PVT', xp: 0 },
  { name: 'Private First Class', short: 'PFC', xp: 600 },
  { name: 'Corporal', short: 'CPL', xp: 1500 },
  { name: 'Sergeant', short: 'SGT', xp: 2800 },
  { name: 'Staff Sergeant', short: 'SSG', xp: 4500 },
  { name: 'Sergeant First Class', short: 'SFC', xp: 6600 },
  { name: 'Master Sergeant', short: 'MSG', xp: 9200 },
  { name: 'First Sergeant', short: '1SG', xp: 12300 },
  { name: 'Sergeant Major', short: 'SGM', xp: 16000 },
  { name: 'Second Lieutenant', short: '2LT', xp: 20500 },
  { name: 'First Lieutenant', short: '1LT', xp: 25800 },
  { name: 'Captain', short: 'CPT', xp: 32000 },
  { name: 'Major', short: 'MAJ', xp: 39500 },
  { name: 'Lieutenant Colonel', short: 'LTC', xp: 48500 },
  { name: 'Colonel', short: 'COL', xp: 59000 },
  { name: 'General', short: 'GEN', xp: 72000 },
])

/** XP per event. */
export const XP = Object.freeze({
  kill: 100,
  headshot: 50,
  knife: 50,
  longshot: 40,
  revenge: 50,
  /** Every full minute spent in a match. */
  minute: 20,
  matchComplete: 150,
  matchWin: 400,
  mvp: 200,
})

/** Kills from this far (metres) and beyond count as long shots. */
export const LONGSHOT_DISTANCE = 35

export const rankIndexForXp = (xp) => {
  let i = 0
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++
  return i
}

/** { index (0-based), number (1-based), rank, next, progress 0..1 } for an XP total. */
export function rankInfo(xp) {
  const index = rankIndexForXp(Math.max(0, xp || 0))
  const rank = RANKS[index]
  const next = RANKS[index + 1] ?? null
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1
  return { index, number: index + 1, rank, next, progress: Math.max(0, Math.min(1, progress)) }
}
