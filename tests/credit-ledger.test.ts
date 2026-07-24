import { appendFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  consumeLedgerCredit,
  getLedgerCreditBalance,
  grantLedgerCredits,
} from "@/lib/credit-ledger";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("credit ledger", () => {
  let tempDir = "";
  let previousLedgerPath: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "shipwright-ledger-"));
    previousLedgerPath = process.env.CREDIT_LEDGER_PATH;
    process.env.CREDIT_LEDGER_PATH = path.join(tempDir, "credits.jsonl");
  });

  afterEach(async () => {
    if (previousLedgerPath === undefined) {
      process.env.CREDIT_LEDGER_PATH = undefined;
    } else {
      process.env.CREDIT_LEDGER_PATH = previousLedgerPath;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it("applies grants and consumes in balance", async () => {
    await grantLedgerCredits("founder@example.com", 2, "manual_grant");
    const consumed = await consumeLedgerCredit("founder@example.com");

    expect(consumed).toBe(true);
    await expect(getLedgerCreditBalance("founder@example.com")).resolves.toBe(1);
  });

  it("skips malformed ledger lines", async () => {
    await grantLedgerCredits("founder@example.com", 1, "manual_grant");
    await appendFile(path.join(tempDir, "credits.jsonl"), '{"id":', "utf8");

    await expect(getLedgerCreditBalance("founder@example.com")).resolves.toBe(1);
  });
});
