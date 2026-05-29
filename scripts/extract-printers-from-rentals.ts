/**
 * Extracts individual printers from Data/rentals.csv and writes Data/printers-import.csv
 * Run: npx tsx scripts/extract-printers-from-rentals.ts
 */
import fs from "fs";
import path from "path";
import Papa from "papaparse";

type PrinterUnit = { brand: string; model: string; count: number };

function slug(text: string, maxLen = 24): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
}

function normalizeModel(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/3IN1/g, "3N1")
    .replace(/4IN1/g, "4N1")
    .replace(/-IN-1/g, "N1");
}

function parseParticulars(particulars: string, totalUnits: number): PrinterUnit[] {
  const text = particulars.trim();
  const results: PrinterUnit[] = [];

  if (/1\s*L121/i.test(text) && /BROTHER\s*3IN1/i.test(text)) {
    return [
      { brand: "EPSON", model: "L121", count: 1 },
      { brand: "BROTHER", model: "3N1", count: 1 },
    ];
  }

  const counted = [
    ...text.matchAll(
      /(\d+)\s*(?:x\s*)?(EPSON|BROTHER|HP|CANON)\s*([A-Z]?\d+[\w]*)/gi
    ),
  ];
  if (counted.length > 0) {
    for (const m of counted) {
      results.push({
        brand: m[2].toUpperCase(),
        model: normalizeModel(m[3]),
        count: parseInt(m[1], 10),
      });
    }
    return results;
  }

  for (const part of text.split(/,\s*/)) {
    const lOnly = part.match(/(\d+)\s*L(\d+)/i);
    if (lOnly) {
      results.push({ brand: "EPSON", model: `L${lOnly[2]}`, count: parseInt(lOnly[1], 10) });
      continue;
    }
    const brotherPart = part.match(/(\d+)\s*BROTHER\s*(3IN1|3N1|4N1|4-IN-1|3-IN-1)/i);
    if (brotherPart) {
      results.push({
        brand: "BROTHER",
        model: normalizeModel(brotherPart[2]),
        count: parseInt(brotherPart[1], 10),
      });
    }
  }
  if (results.length > 0) return results;

  const lOnly = [...text.matchAll(/(\d+)\s*L(\d+)/gi)];
  const brotherCounted = [...text.matchAll(/(\d+)\s*BROTHER\s*(3IN1|3N1|4N1|4-IN-1|3-IN-1)/gi)];
  if (lOnly.length > 0) {
    for (const m of lOnly) {
      results.push({ brand: "EPSON", model: `L${m[2]}`, count: parseInt(m[1], 10) });
    }
  }
  if (brotherCounted.length > 0) {
    for (const m of brotherCounted) {
      results.push({
        brand: "BROTHER",
        model: normalizeModel(m[2]),
        count: parseInt(m[1], 10),
      });
    }
  }
  if (results.length > 0) return results;

  if (/EPSON\/BROTHER|BROTHER\/EPSON/i.test(text)) {
    const jh = text.match(/(\d+)\s*JH/i);
    const sh = text.match(/(\d+)\s*SH/i);
    const brand = text.toUpperCase().includes("BROTHER") ? "BROTHER" : "EPSON";
    if (jh) results.push({ brand, model: "3N1-JH", count: parseInt(jh[1], 10) });
    if (sh) results.push({ brand, model: "3N1-SH", count: parseInt(sh[1], 10) });
    if (results.length > 0) return results;
    results.push({ brand, model: "3N1", count: totalUnits });
    return results;
  }

  const brandModels = [
    ...text.matchAll(/(EPSON|BROTHER|HP|CANON)\s*([A-Z]?\d+[\w]*|L\d+)/gi),
  ];
  if (brandModels.length > 0) {
    if (brandModels.length === 1 && totalUnits > 1) {
      results.push({
        brand: brandModels[0][1].toUpperCase(),
        model: normalizeModel(brandModels[0][2]),
        count: totalUnits,
      });
      return results;
    }
    for (const m of brandModels) {
      results.push({
        brand: m[1].toUpperCase(),
        model: normalizeModel(m[2]),
        count: 1,
      });
    }
    const sum = results.reduce((s, r) => s + r.count, 0);
    if (sum < totalUnits) {
      results[results.length - 1].count += totalUnits - sum;
    }
    return results;
  }

  const brother = text.match(/(BROTHER)\s*(4N1|3N1|3IN1|4-IN-1|3-IN-1)/i);
  if (brother) {
    results.push({
      brand: "BROTHER",
      model: normalizeModel(brother[2]),
      count: totalUnits,
    });
    return results;
  }

  const generic = text.match(/(EPSON|BROTHER)\s*([\w\d]+)/i);
  if (generic) {
    results.push({
      brand: generic[1].toUpperCase(),
      model: normalizeModel(generic[2]),
      count: totalUnits,
    });
    return results;
  }

  results.push({
    brand: "UNKNOWN",
    model: slug(text, 12) || "PRINTER",
    count: totalUnits,
  });
  return results;
}

function makeSerial(
  client: string,
  brand: string,
  model: string,
  index: number
): string {
  return `${slug(client, 18)}-${slug(brand, 8)}-${slug(model, 10)}-${String(index).padStart(3, "0")}`;
}

const csvPath = path.join(process.cwd(), "Data", "rentals.csv");
const outPath = path.join(process.cwd(), "Data", "printers-import.csv");

const raw = fs.readFileSync(csvPath, "utf-8");
const parsed = Papa.parse<Record<string, string>>(raw, {
  header: true,
  skipEmptyLines: true,
});

const rows: Record<string, string>[] = [];
const serialSeen = new Set<string>();
const modelCounters = new Map<string, number>();

for (const row of parsed.data) {
  const clientName =
    row["CLIENT NAME"]?.trim() ||
    row["client name"]?.trim() ||
    row.client_name?.trim();
  const particulars = row["PARTICULARS"]?.trim() || row.particulars?.trim() || "";
  const unitsRaw = row["# UNITS"]?.trim() || row.units?.trim() || "1";
  const totalUnits = Math.max(1, parseInt(unitsRaw.replace(/\D/g, ""), 10) || 1);

  if (!clientName || !particulars) continue;

  const units = parseParticulars(particulars, totalUnits);
  let parsedTotal = units.reduce((s, u) => s + u.count, 0);
  if (parsedTotal !== totalUnits && units.length === 1) {
    units[0].count = totalUnits;
    parsedTotal = totalUnits;
  }

  for (const unit of units) {
    const counterKey = `${slug(clientName)}|${unit.brand}|${unit.model}`;
    for (let i = 0; i < unit.count; i++) {
      const prev = modelCounters.get(counterKey) ?? 0;
      const seq = prev + 1;
      modelCounters.set(counterKey, seq);

      let serial = makeSerial(clientName, unit.brand, unit.model, seq);
      while (serialSeen.has(serial)) {
        modelCounters.set(counterKey, seq + 1);
        serial = makeSerial(clientName, unit.brand, unit.model, seq + 1);
      }
      serialSeen.add(serial);

      rows.push({
        serial_number: serial,
        brand: unit.brand,
        model: unit.model,
        client_name: clientName,
        notes: `From rentals: ${particulars}`,
        status: "RENTED",
      });
    }
  }
}

const csv = Papa.unparse(rows, {
  columns: ["serial_number", "brand", "model", "client_name", "notes", "status"],
});

fs.writeFileSync(outPath, csv, "utf-8");
console.log(`Wrote ${rows.length} printers to ${outPath}`);
