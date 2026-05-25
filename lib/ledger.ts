import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

type LedgerDirection = "credit" | "debit" | "commission" | "refund";

type LedgerEntry = {
  userId?: string | null;
  counterpartyUserId?: string | null;
  type: string;
  direction: LedgerDirection;
  amount: number;
  commissionAmount?: number;
  netAmount?: number;
  status: string;
  sourceCollection?: string;
  sourceId?: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export const setLedgerEntry = (
  tx: FirebaseFirestore.Transaction,
  entry: LedgerEntry
) => {
  const ledgerRef = adminDb.collection("ledger").doc();

  tx.set(ledgerRef, {
    userId: entry.userId || null,
    counterpartyUserId: entry.counterpartyUserId || null,
    type: entry.type,
    direction: entry.direction,
    amount: Math.floor(Number(entry.amount || 0)),
    commissionAmount: Math.floor(Number(entry.commissionAmount || 0)),
    netAmount:
      typeof entry.netAmount === "number"
        ? Math.floor(Number(entry.netAmount || 0))
        : null,
    status: entry.status,
    sourceCollection: entry.sourceCollection || null,
    sourceId: entry.sourceId || null,
    createdBy: entry.createdBy || null,
    metadata: entry.metadata || {},
    createdAt: adminFieldValue.serverTimestamp(),
  });
};
