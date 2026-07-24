import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type LedgerEntryType = "grant" | "consume";

export interface CreditLedgerEntry {
  id: string;
  timestamp: string;
  type: LedgerEntryType;
  email: string;
  amount: number;
  reason: string;
  metadata?: Record<string, string>;
}

function parseLedgerLine(line: string): CreditLedgerEntry | null {
  try {
    const parsed = JSON.parse(line) as Partial<CreditLedgerEntry>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.timestamp !== "string" ||
      (parsed.type !== "grant" && parsed.type !== "consume") ||
      typeof parsed.email !== "string" ||
      typeof parsed.amount !== "number" ||
      typeof parsed.reason !== "string"
    ) {
      return null;
    }
    return parsed as CreditLedgerEntry;
  } catch {
    return null;
  }
}

export function getLedgerPath(): string {
  return (
    process.env.CREDIT_LEDGER_PATH || path.join(process.cwd(), ".data", "ledger", "credits.jsonl")
  );
}

async function ensureLedgerFile(): Promise<string> {
  const filePath = getLedgerPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  return filePath;
}

export async function appendLedgerEntry(
  entry: Omit<CreditLedgerEntry, "id" | "timestamp">
): Promise<void> {
  const filePath = await ensureLedgerFile();
  const full: CreditLedgerEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  await appendFile(filePath, `${JSON.stringify(full)}\n`, "utf8");
}

export async function readLedgerEntries(): Promise<CreditLedgerEntry[]> {
  try {
    const contents = await readFile(getLedgerPath(), "utf8");
    return contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => parseLedgerLine(line))
      .filter((entry): entry is CreditLedgerEntry => Boolean(entry));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Net ledger balance for email (grants positive, consumes negative).
 */
export async function getLedgerCreditBalance(email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const entries = await readLedgerEntries();
  let balance = 0;
  for (const e of entries) {
    if (e.email.trim().toLowerCase() !== normalized) continue;
    if (e.type === "grant") balance += e.amount;
    else if (e.type === "consume") balance -= e.amount;
  }
  return Math.max(0, balance);
}

export async function consumeLedgerCredit(email: string): Promise<boolean> {
  const balance = await getLedgerCreditBalance(email);
  if (balance < 1) return false;
  await appendLedgerEntry({
    type: "consume",
    email,
    amount: 1,
    reason: "ship_credit_consumed",
  });
  return true;
}

export async function grantLedgerCredits(
  email: string,
  amount: number,
  reason: string,
  metadata?: Record<string, string>
): Promise<void> {
  if (amount <= 0) return;
  await appendLedgerEntry({
    type: "grant",
    email,
    amount,
    reason,
    metadata,
  });
}
