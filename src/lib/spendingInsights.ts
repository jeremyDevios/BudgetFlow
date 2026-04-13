export interface SpendingInsightTransaction {
  id: string;
  amount: number;
  description: string;
  envelopeId: string;
  date: string;
}

export interface SpendingInsightEnvelope {
  id: string;
  name: string;
  budget: number;
}

export interface ExceptionalSpendingInsight {
  transactionId: string;
  transactionName: string;
  amount: number;
  envelopeId: string;
  envelopeName: string;
  envelopeBudget: number;
  budgetRatio: number;
}

const EXCEPTIONAL_TRANSACTION_RATIO_THRESHOLD = 1;

export function findExceptionalSpendingInsight(params: {
  transactions: SpendingInsightTransaction[];
  envelopes: SpendingInsightEnvelope[];
}): ExceptionalSpendingInsight | null {
  const { transactions, envelopes } = params;

  const envelopeById = new Map(
    envelopes.map((envelope) => [envelope.id, envelope] as const)
  );

  let bestMatch: ExceptionalSpendingInsight | null = null;

  for (const transaction of transactions) {
    const envelope = envelopeById.get(transaction.envelopeId);
    if (!envelope || envelope.budget <= 0 || transaction.amount <= 0) {
      continue;
    }

    const budgetRatio = transaction.amount / envelope.budget;
    if (budgetRatio < EXCEPTIONAL_TRANSACTION_RATIO_THRESHOLD) {
      continue;
    }

    const candidate: ExceptionalSpendingInsight = {
      transactionId: transaction.id,
      transactionName: transaction.description.trim() || "Dépense sans libellé",
      amount: transaction.amount,
      envelopeId: envelope.id,
      envelopeName: envelope.name,
      envelopeBudget: envelope.budget,
      budgetRatio,
    };

    if (
      !bestMatch ||
      candidate.budgetRatio > bestMatch.budgetRatio ||
      (candidate.budgetRatio === bestMatch.budgetRatio &&
        candidate.amount > bestMatch.amount)
    ) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}
