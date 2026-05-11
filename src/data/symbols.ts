export interface SymbolDef {
  id: string;
  glyph: string;
  color: number;
}

export const SYMBOLS: SymbolDef[] = [
  // Low (5)
  { id: '10', glyph: '10', color: 0xe6f0ff },
  { id: 'J', glyph: 'J', color: 0xb8e0ff },
  { id: 'Q', glyph: 'Q', color: 0xffd6a8 },
  { id: 'K', glyph: 'K', color: 0xffc26b },
  { id: 'A', glyph: 'A', color: 0xff9a4a },
  // High (4)
  { id: 'CHERRY', glyph: '🍒', color: 0xff5566 },
  { id: 'LEMON', glyph: '🍋', color: 0xfde047 },
  { id: 'STAR', glyph: '⭐', color: 0xffd700 },
  { id: 'SEVEN', glyph: '7️⃣', color: 0xff3060 },
  // Special (2)
  { id: 'WILD', glyph: 'WILD', color: 0xff44ff },
  { id: 'SCATTER', glyph: 'SCATTER', color: 0x44eaff },
];

const BY_ID: Record<string, SymbolDef> = Object.fromEntries(
  SYMBOLS.map((s) => [s.id, s] as const),
);

export function getSymbol(id: string): SymbolDef {
  const def = BY_ID[id];
  if (!def) throw new Error(`Unknown symbol id: ${id}`);
  return def;
}
