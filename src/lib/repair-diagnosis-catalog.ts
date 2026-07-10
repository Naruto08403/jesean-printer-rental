export type DiagnosisCatalogEntry = {
  id: string;
  name: string;
  price: number;
};

export function parseDiagnosisString(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatDiagnosisString(items: string[]): string {
  return items.join(", ");
}

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

export function calculateDiagnosisTotal(
  selectedNames: string[],
  catalog: DiagnosisCatalogEntry[]
): { total: number; matchedNames: string[]; unknownNames: string[] } {
  const byName = new Map(catalog.map((entry) => [normalizeName(entry.name), entry]));
  let total = 0;
  const matchedNames: string[] = [];
  const unknownNames: string[] = [];

  for (const name of selectedNames) {
    const entry = byName.get(normalizeName(name));
    if (!entry) {
      unknownNames.push(name);
      continue;
    }
    matchedNames.push(entry.name);
    total += entry.price;
  }

  return { total, matchedNames, unknownNames };
}

export function selectedNamesFromDiagnosisString(
  raw: string | null | undefined,
  catalog: DiagnosisCatalogEntry[]
): string[] {
  const parsed = parseDiagnosisString(raw);
  const byName = new Map(catalog.map((entry) => [normalizeName(entry.name), entry.name]));
  return parsed
    .map((name) => byName.get(normalizeName(name)) ?? name)
    .filter(Boolean);
}

export const DEFAULT_REPAIR_DIAGNOSES: { name: string; price: number; sortOrder: number }[] = [
  { name: "Reset Ink Pad", price: 350, sortOrder: 1 },
  { name: "Replace Purge Gear", price: 450, sortOrder: 2 },
  { name: "Recover Print Head", price: 650, sortOrder: 3 },
  { name: "Replace Flex ASSY", price: 550, sortOrder: 4 },
  { name: "Replace Cartridge Magenta", price: 400, sortOrder: 5 },
  { name: "Replace Cartridge Yellow", price: 400, sortOrder: 6 },
  { name: "Replace Cartridge Cyan", price: 400, sortOrder: 7 },
  { name: "Replace Cartridge Black", price: 400, sortOrder: 8 },
  { name: "Labor", price: 350, sortOrder: 9 },
];
