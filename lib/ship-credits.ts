import {
  consumeLedgerCredit,
  getLedgerCreditBalance,
  grantLedgerCredits,
} from "@/lib/credit-ledger";
import { consumeShipCredit, getShipCredits } from "@/lib/stripe";

/**
 * Total one-time ship credits: Stripe PaymentIntent metadata + local append-only ledger
 * (referral grants, manual adjustments).
 */
export async function getTotalShipCredits(customerId: string, email: string): Promise<number> {
  const [stripeCredits, ledgerCredits] = await Promise.all([
    getShipCredits(customerId),
    getLedgerCreditBalance(email),
  ]);
  return stripeCredits + ledgerCredits;
}

/**
 * Consumes one credit after a successful AI ship. Prefers Stripe-backed credits first.
 */
export async function consumeOneShipCredit(customerId: string, email: string): Promise<void> {
  const consumedStripe = await consumeShipCredit(customerId);
  if (consumedStripe) return;
  const consumedLedger = await consumeLedgerCredit(email);
  if (!consumedLedger) {
    throw new Error("No ship credit available to consume");
  }
}

export { grantLedgerCredits };
