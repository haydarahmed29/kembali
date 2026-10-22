// Greedy debt-simplification: turns a list of expenses into the minimum set of
// "A transfers Rp X to B" lines, instead of everyone paying everyone back individually.

import type { Expense } from "./types";

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export function settleUp(expenses: Expense[]): Transfer[] {
  const balances = new Map<string, number>(); // positive = is owed money, negative = owes money

  for (const exp of expenses) {
    const share = exp.amount / exp.splitAmong.length;
    for (const uid of exp.splitAmong) {
      balances.set(uid, (balances.get(uid) ?? 0) - share);
    }
    balances.set(exp.paidBy, (balances.get(exp.paidBy) ?? 0) + exp.amount);
  }

  const debtors = [...balances.entries()].filter(([, v]) => v < -0.5).sort((a, b) => a[1] - b[1]);
  const creditors = [...balances.entries()].filter(([, v]) => v > 0.5).sort((a, b) => b[1] - a[1]);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const [debtorUid, debtAmount] = debtors[i];
    const [creditorUid, creditAmount] = creditors[j];
    const amount = Math.min(-debtAmount, creditAmount);
    if (amount > 0.5) transfers.push({ from: debtorUid, to: creditorUid, amount: Math.round(amount) });
    debtors[i] = [debtorUid, debtAmount + amount];
    creditors[j] = [creditorUid, creditAmount - amount];
    if (Math.abs(debtors[i][1]) < 1) i++;
    if (Math.abs(creditors[j][1]) < 1) j++;
  }
  return transfers;
}
