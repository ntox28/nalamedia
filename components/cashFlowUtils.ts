import {
    type LegacyMonthlyIncome,
    type LegacyMonthlyExpense,
    type ReceivableItem,
    type ExpenseItem,
    type SupplierBill,
    type BankInstallment,
    type PrivateExpenseItem,
    type CashDrawerState,
    type CashDrawerLog,
    type CashTransferRecord,
    type PaymentMethod,
    type AccountBalanceMeta,
    type ExpenseMetadata,
    type PurchaseRecord,
    type SavedOrder,
} from '../types';

export const OWNER_HOLD_ACCOUNT_ID = 'owner-hold-cash';
export const OWNER_HOLD_ACCOUNT_NAME = 'Kas Dipegang Owner (Titipan Toko)';

export const getUtcDateStr = (date: Date = new Date()): string => {
    return date.toISOString().substring(0, 10);
};

export const getUtcMonthDateRange = () => {
    const date = new Date();
    const firstDay = getUtcDateStr(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    const lastDay = getUtcDateStr(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
    return { firstDay, lastDay };
};

export interface GlobalFinancialRecapInput {
    legacyMonthlyIncomes: LegacyMonthlyIncome[];
    legacyMonthlyExpenses: LegacyMonthlyExpense[];
    receivables: ReceivableItem[];
    expenses: ExpenseItem[];
    supplierBills: SupplierBill[];
    bankInstallments: BankInstallment[];
    privateExpenses: PrivateExpenseItem[];
    cashDrawerLogs: CashDrawerLog[];
    cashTransfers: CashTransferRecord[];
}

export interface GlobalFinancialRecapResult {
    legacyIncome: number;
    legacyExpense: number;
    orderIncome: number;
    operationalExpense: number;
    suntikModalIn: number;
    grossEstimatedBalance: number;
    supplierStorePaid: number;
    bankStorePaid: number;
    privateStorePaid: number;
    setorOwnerOut: number;
    tarikOwnerOut: number;
    transferAdminFeeOut: number;
    totalNonOperationalAndOwnerOut: number;
    totalIncomeAll: number;
    totalExpenseAll: number;
    netEstimatedEndingCash: number;
}

/**
 * Perhitungan kumulatif terpadu untuk Final Rekapitulasi & halaman Arus Kas
 * agar Saldo Akhir (Estimasi) selalu 100% sinkron.
 */
export const calculateGlobalFinancialRecap = ({
    legacyMonthlyIncomes,
    legacyMonthlyExpenses,
    receivables,
    expenses,
    supplierBills,
    bankInstallments,
    privateExpenses,
    cashDrawerLogs,
    cashTransfers,
}: GlobalFinancialRecapInput): GlobalFinancialRecapResult => {
    const legacyIncome = legacyMonthlyIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const legacyExpense = legacyMonthlyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const orderIncome = receivables.reduce((sum, r) => {
        const totalPaid = r.payments?.reduce((pSum, p) => pSum + Number(p.amount || 0), 0) || 0;
        return sum + totalPaid;
    }, 0);

    const operationalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const grossEstimatedBalance = (legacyIncome + orderIncome) - (legacyExpense + operationalExpense);

    const isStoreOutflowSource = (src: string) =>
        src === 'Kas Laci' || src === 'Transfer Bank' || src === 'Kas Dipegang Owner';

    const supplierStorePaid = supplierBills.reduce((sum, bill) => {
        return sum + bill.payments
            .filter(p => isStoreOutflowSource(p.fundingSource))
            .reduce((ps, p) => ps + Number(p.amount || 0), 0);
    }, 0);

    const bankStorePaid = bankInstallments.reduce((sum, inst) => {
        return sum + inst.payments
            .filter(p => isStoreOutflowSource(p.fundingSource))
            .reduce((ps, p) => ps + Number(p.totalPaid || 0), 0);
    }, 0);

    const privateStorePaid = privateExpenses
        .filter(pe => pe.fundingSource !== 'Uang Pribadi Owner')
        .reduce((sum, pe) => sum + Number(pe.amount || 0), 0);

    // Setor ke rekening bank toko atau Titipan Owner (owner_hold) adalah pindah kantong internal, bukan uang keluar usaha
    const setorOwnerOut = cashDrawerLogs
        .filter(log => {
            if (log.type !== 'Setor') return false;
            if (log.depositMode === 'owner_hold' || log.depositMode === 'bank_account') return false;
            if (log.depositMode === 'owner_prive') return true;
            return !log.depositToAccountId;
        })
        .reduce((sum, log) => sum + Number(log.depositAmount || 0), 0);

    const tarikOwnerOut = cashTransfers
        .filter(t => t.transferType === 'Tarik Owner')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const transferAdminFeeOut = cashTransfers
        .filter(t => t.transferType === 'Pindah Akun')
        .reduce((sum, t) => sum + Number(t.adminFee || 0), 0);

    const suntikModalIn = cashTransfers
        .filter(t => t.transferType === 'Suntik Modal')
        .reduce((sum, t) => sum + Number(t.netAmount ?? t.amount ?? 0), 0);

    const totalIncomeAll = legacyIncome + orderIncome + suntikModalIn;
    const totalNonOperationalAndOwnerOut =
        supplierStorePaid + bankStorePaid + privateStorePaid + setorOwnerOut + tarikOwnerOut + transferAdminFeeOut;
    const totalExpenseAll = legacyExpense + operationalExpense + totalNonOperationalAndOwnerOut;
    const netEstimatedEndingCash = totalIncomeAll - totalExpenseAll;

    return {
        legacyIncome,
        legacyExpense,
        orderIncome,
        operationalExpense,
        suntikModalIn,
        grossEstimatedBalance,
        supplierStorePaid,
        bankStorePaid,
        privateStorePaid,
        setorOwnerOut,
        tarikOwnerOut,
        transferAdminFeeOut,
        totalNonOperationalAndOwnerOut,
        totalIncomeAll,
        totalExpenseAll,
        netEstimatedEndingCash,
    };
};

export interface StoreCashAccountItem {
    id: string;
    name: string;
    type: string;
    balance: number;
}

export interface StoreCashSnapshot {
    cashDrawerBalance: number;
    ownerHoldBalance: number;
    nonCashAccounts: StoreCashAccountItem[];
    totalBankBalance: number;
    totalStoreLiquidCash: number;
    unpaidSupplierBills: number;
    dueSoonSupplierBills: number;
    activeBankLoans: number;
    unpaidCustomerReceivables: number;
}

export const computeStoreCashSnapshot = ({
    paymentMethods,
    cashDrawerState,
    cashDrawerLogs,
    cashTransfers,
    accountBalancesMeta,
    receivables,
    expenses,
    expenseMetadata,
    supplierBills,
    bankInstallments,
    privateExpenses,
}: {
    paymentMethods: PaymentMethod[];
    cashDrawerState: CashDrawerState;
    cashDrawerLogs: CashDrawerLog[];
    cashTransfers: CashTransferRecord[];
    accountBalancesMeta: Record<string, AccountBalanceMeta>;
    receivables: ReceivableItem[];
    expenses: ExpenseItem[];
    expenseMetadata: Record<number, ExpenseMetadata>;
    supplierBills: SupplierBill[];
    bankInstallments: BankInstallment[];
    privateExpenses: PrivateExpenseItem[];
}): StoreCashSnapshot => {
    const todayLocal = getUtcDateStr();
    const effectiveMethods: PaymentMethod[] = paymentMethods.length > 0
        ? paymentMethods
        : [{ id: 'cash-default', name: 'Tunai', type: 'Tunai', details: 'Pembayaran tunai di kasir' }];
    const cashMethodIds = new Set(effectiveMethods.filter(m => m.type === 'Tunai').map(m => m.id));
    const isCashMethod = (id?: string, name?: string) => {
        if (id && cashMethodIds.has(id)) return true;
        if (name && name.toLowerCase().includes('tunai')) return true;
        return !id && !name;
    };
    const matchPaymentMethodId = (methodId?: string, methodName?: string): string | undefined => {
        if (methodId && effectiveMethods.some(m => m.id === methodId)) return methodId;
        if (methodName) {
            const found = effectiveMethods.find(m => m.name.toLowerCase() === methodName.toLowerCase());
            if (found) return found.id;
        }
        return undefined;
    };

    // 1. Kas Laci Aktif
    const startDate = cashDrawerState?.periodStartDate || todayLocal;
    let rawCashIn = 0;
    receivables.forEach(r => {
        r.payments?.forEach(p => {
            if (p.date >= startDate && p.date <= todayLocal && isCashMethod(p.methodId, p.methodName)) {
                rawCashIn += Number(p.amount || 0);
            }
        });
    });
    let rawCashOut = 0;
    expenses.forEach(e => {
        const funding = expenseMetadata[e.id]?.fundingSource || 'Kas Laci';
        if (funding === 'Kas Laci' && e.date >= startDate && e.date <= todayLocal) rawCashOut += Number(e.amount || 0);
    });
    supplierBills.forEach(b => b.payments.forEach(p => {
        if (p.fundingSource === 'Kas Laci' && p.date >= startDate && p.date <= todayLocal) rawCashOut += Number(p.amount || 0);
    }));
    bankInstallments.forEach(i => i.payments.forEach(p => {
        if (p.fundingSource === 'Kas Laci' && p.date >= startDate && p.date <= todayLocal) rawCashOut += Number(p.totalPaid || 0);
    }));
    privateExpenses.forEach(pe => {
        if (pe.fundingSource === 'Kas Laci' && pe.date >= startDate && pe.date <= todayLocal) rawCashOut += Number(pe.amount || 0);
    });

    let rawTransferIn = 0;
    let rawTransferOut = 0;
    cashTransfers.forEach(t => {
        const toIsCash = !!t.toAccountId && cashMethodIds.has(t.toAccountId);
        const fromIsCash = !!t.fromAccountId && cashMethodIds.has(t.fromAccountId);
        if (t.date >= startDate && t.date <= todayLocal) {
            if (toIsCash) rawTransferIn += Number(t.netAmount || 0);
            if (fromIsCash) rawTransferOut += Number(t.amount || 0);
        }
    });

    const cashIn = Math.max(0, rawCashIn - (cashDrawerState?.settledCashInOnStartDate || 0));
    const cashOut = Math.max(0, rawCashOut - (cashDrawerState?.settledCashOutOnStartDate || 0));
    const transferIn = Math.max(0, rawTransferIn - (cashDrawerState?.settledCashTransferInOnStartDate || 0));
    const transferOut = Math.max(0, rawTransferOut - (cashDrawerState?.settledCashTransferOutOnStartDate || 0));
    const cashDrawerBalance = (cashDrawerState?.openingCash || 0) + cashIn - cashOut + transferIn - transferOut;

    // 2. Non-cash bank accounts + Kas Dipegang Owner
    const nonCashMethods = effectiveMethods.filter(m => m.type !== 'Tunai');
    const trackedIds = [...nonCashMethods.map(m => m.id), OWNER_HOLD_ACCOUNT_ID];
    const balanceMap = new Map<string, number>();
    trackedIds.forEach(id => {
        balanceMap.set(id, Number(accountBalancesMeta[id]?.openingBalance || 0));
    });

    const isAfterCutoff = (id: string, txDate: string) => {
        const openDate = accountBalancesMeta[id]?.openingDate;
        if (!openDate) return true;
        return txDate >= openDate;
    };

    receivables.forEach(r => {
        r.payments?.forEach(p => {
            if (!p.date || !p.amount || p.date > todayLocal) return;
            const matchedId = matchPaymentMethodId(p.methodId, p.methodName);
            if (matchedId && balanceMap.has(matchedId) && isAfterCutoff(matchedId, p.date)) {
                balanceMap.set(matchedId, (balanceMap.get(matchedId) || 0) + Number(p.amount || 0));
            }
        });
    });

    expenses.forEach(e => {
        if (!e.date || !e.amount || e.date > todayLocal) return;
        const meta = expenseMetadata[e.id];
        if (meta?.fundingSource === 'Kas Dipegang Owner' && isAfterCutoff(OWNER_HOLD_ACCOUNT_ID, e.date)) {
            balanceMap.set(OWNER_HOLD_ACCOUNT_ID, (balanceMap.get(OWNER_HOLD_ACCOUNT_ID) || 0) - Number(e.amount || 0));
        } else if (meta?.fundingSource === 'Transfer Bank' && meta.fundingAccountId && balanceMap.has(meta.fundingAccountId) && isAfterCutoff(meta.fundingAccountId, e.date)) {
            balanceMap.set(meta.fundingAccountId, (balanceMap.get(meta.fundingAccountId) || 0) - Number(e.amount || 0));
        }
    });

    supplierBills.forEach(bill => {
        bill.payments.forEach(p => {
            if (!p.date || !p.amount || p.date > todayLocal) return;
            if (p.fundingSource === 'Kas Dipegang Owner' && isAfterCutoff(OWNER_HOLD_ACCOUNT_ID, p.date)) {
                balanceMap.set(OWNER_HOLD_ACCOUNT_ID, (balanceMap.get(OWNER_HOLD_ACCOUNT_ID) || 0) - Number(p.amount || 0));
            } else if (p.fundingSource === 'Transfer Bank' && p.fundingAccountId && balanceMap.has(p.fundingAccountId) && isAfterCutoff(p.fundingAccountId, p.date)) {
                balanceMap.set(p.fundingAccountId, (balanceMap.get(p.fundingAccountId) || 0) - Number(p.amount || 0));
            }
        });
    });

    bankInstallments.forEach(inst => {
        inst.payments.forEach(p => {
            if (!p.date || !p.totalPaid || p.date > todayLocal) return;
            if (p.fundingSource === 'Kas Dipegang Owner' && isAfterCutoff(OWNER_HOLD_ACCOUNT_ID, p.date)) {
                balanceMap.set(OWNER_HOLD_ACCOUNT_ID, (balanceMap.get(OWNER_HOLD_ACCOUNT_ID) || 0) - Number(p.totalPaid || 0));
            } else if (p.fundingSource === 'Transfer Bank' && p.fundingAccountId && balanceMap.has(p.fundingAccountId) && isAfterCutoff(p.fundingAccountId, p.date)) {
                balanceMap.set(p.fundingAccountId, (balanceMap.get(p.fundingAccountId) || 0) - Number(p.totalPaid || 0));
            }
        });
    });

    privateExpenses.forEach(pe => {
        if (!pe.date || !pe.amount || pe.date > todayLocal || pe.fundingSource === 'Uang Pribadi Owner') return;
        if (pe.fundingSource === 'Kas Dipegang Owner' && isAfterCutoff(OWNER_HOLD_ACCOUNT_ID, pe.date)) {
            balanceMap.set(OWNER_HOLD_ACCOUNT_ID, (balanceMap.get(OWNER_HOLD_ACCOUNT_ID) || 0) - Number(pe.amount || 0));
        } else if (pe.fundingSource === 'Transfer Bank' && pe.fundingAccountId && balanceMap.has(pe.fundingAccountId) && isAfterCutoff(pe.fundingAccountId, pe.date)) {
            balanceMap.set(pe.fundingAccountId, (balanceMap.get(pe.fundingAccountId) || 0) - Number(pe.amount || 0));
        }
    });

    cashDrawerLogs.forEach(log => {
        if (log.type !== 'Setor' || !log.depositAmount) return;
        const logDate = log.timestamp ? getUtcDateStr(new Date(log.timestamp)) : log.periodEndDate;
        if (logDate > todayLocal) return;
        const isOwnerHold = log.depositMode === 'owner_hold' || log.depositToAccountId === OWNER_HOLD_ACCOUNT_ID;
        const isToBank = log.depositMode === 'bank_account' || (!isOwnerHold && !!log.depositToAccountId);
        const destId = isOwnerHold ? OWNER_HOLD_ACCOUNT_ID : isToBank ? log.depositToAccountId : undefined;
        if (destId && balanceMap.has(destId) && isAfterCutoff(destId, logDate)) {
            balanceMap.set(destId, (balanceMap.get(destId) || 0) + Number(log.depositAmount || 0));
        }
    });

    cashTransfers.forEach(t => {
        if (!t.date || !t.amount || t.date > todayLocal) return;
        if (t.fromAccountId && balanceMap.has(t.fromAccountId) && isAfterCutoff(t.fromAccountId, t.date)) {
            balanceMap.set(t.fromAccountId, (balanceMap.get(t.fromAccountId) || 0) - Number(t.amount || 0));
        }
        if (t.toAccountId && balanceMap.has(t.toAccountId) && isAfterCutoff(t.toAccountId, t.date)) {
            balanceMap.set(t.toAccountId, (balanceMap.get(t.toAccountId) || 0) + Number(t.netAmount || 0));
        }
    });

    trackedIds.forEach(id => {
        const settledNet = accountBalancesMeta[id]?.settledNetOnOpeningDate || 0;
        if (settledNet) {
            balanceMap.set(id, (balanceMap.get(id) || 0) - settledNet);
        }
    });

    const nonCashAccounts: StoreCashAccountItem[] = nonCashMethods.map(m => ({
        id: m.id,
        name: m.name,
        type: m.type,
        balance: balanceMap.get(m.id) || 0,
    }));
    const ownerHoldBalance = balanceMap.get(OWNER_HOLD_ACCOUNT_ID) || 0;
    const totalBankBalance = nonCashAccounts.reduce((s, a) => s + a.balance, 0);
    const totalStoreLiquidCash = cashDrawerBalance + totalBankBalance + ownerHoldBalance;

    // 3. Kewajiban & Piutang
    const next14Date = getUtcDateStr(new Date(Date.now() + 14 * 86400000));
    let unpaidSupplierBills = 0;
    let dueSoonSupplierBills = 0;
    supplierBills.forEach(bill => {
        const paid = bill.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const rem = Math.max(0, Number(bill.totalAmount || 0) - paid);
        if (rem > 0) {
            unpaidSupplierBills += rem;
            if (bill.dueDate && bill.dueDate <= next14Date) {
                dueSoonSupplierBills += rem;
            }
        }
    });

    const activeBankLoans = bankInstallments
        .filter(i => i.status === 'Aktif')
        .reduce((s, i) => s + Math.max(0, Number(i.remainingPrincipal || 0)), 0);

    const unpaidCustomerReceivables = receivables.reduce((s, r) => {
        if (r.paymentStatus === 'Lunas') return s;
        const paid = r.payments?.reduce((ps, p) => ps + Number(p.amount || 0), 0) || 0;
        const rem = Math.max(0, Number(r.amount || 0) - Number(r.discount || 0) - paid);
        return s + rem;
    }, 0);

    return {
        cashDrawerBalance,
        ownerHoldBalance,
        nonCashAccounts,
        totalBankBalance,
        totalStoreLiquidCash,
        unpaidSupplierBills,
        dueSoonSupplierBills,
        activeBankLoans,
        unpaidCustomerReceivables,
    };
};

export interface MonthlyAccrualPerformance {
    month: string;
    accrualSales: number;
    cashOrderPayments: number;
    lunasMaterialPurchases: number;
    creditSupplierInvoices: number;
    otherOperationalExpenses: number;
    ownerSalaryPaidInExpenses: number;
    ownerSalaryUnpaidAccrued: number;
    bankInterestInMonth: number;
    accrualNetProfit: number;
    cashNetInMonth: number;
}

export const computeMonthlyAccrualPerformance = ({
    month,
    allOrders,
    receivables,
    expenses,
    expenseMetadata,
    purchases,
    supplierBills,
    bankInstallments,
    targetMonthlyOwnerSalary,
    ownerSalaryPaidForMonth,
    ownerSalaryAccruedForMonth,
}: {
    month: string; // YYYY-MM
    allOrders: SavedOrder[];
    receivables: ReceivableItem[];
    expenses: ExpenseItem[];
    expenseMetadata: Record<number, ExpenseMetadata>;
    purchases: PurchaseRecord[];
    supplierBills: SupplierBill[];
    bankInstallments: BankInstallment[];
    targetMonthlyOwnerSalary: number;
    ownerSalaryPaidForMonth: number;
    ownerSalaryAccruedForMonth: number;
}): MonthlyAccrualPerformance => {
    const start = `${month}-01`;
    const end = `${month}-31`;
    const inMonth = (d?: string) => !!d && d >= start && d <= end;

    const discountByOrderId = new Map<string, number>();
    receivables.forEach(r => {
        if (r.discount) discountByOrderId.set(r.id, Number(r.discount));
    });

    // Omzet Akrual: total nilai order yang terbit di bulan ini (Lunas + Tempo) dikurangi diskon
    const accrualSales = allOrders
        .filter(o => inMonth(o.orderDate))
        .reduce((s, o) => s + Math.max(0, Number(o.totalPrice || 0) - (discountByOrderId.get(o.id) || 0)), 0);

    // Kas Masuk Order di bulan ini (untuk perbandingan Basis Kas vs Akrual)
    let cashOrderPayments = 0;
    receivables.forEach(r => {
        r.payments?.forEach(p => {
            if (inMonth(p.date)) cashOrderPayments += Number(p.amount || 0);
        });
    });

    // Pembelian bahan Lunas yang tercatat ke expenses
    const purchaseExpenseIds = new Set<number>();
    purchases.forEach(p => {
        if (p.expenseId) purchaseExpenseIds.add(p.expenseId);
    });

    let lunasMaterialPurchases = 0;
    let ownerSalaryPaidInExpenses = 0;
    let otherOperationalExpenses = 0;

    expenses.forEach(e => {
        if (!inMonth(e.date)) return;
        const meta = expenseMetadata[e.id];
        if (meta?.purchaseId || purchaseExpenseIds.has(e.id)) {
            lunasMaterialPurchases += Number(e.amount || 0);
        } else if (e.category === 'Gaji Owner') {
            ownerSalaryPaidInExpenses += Number(e.amount || 0);
        } else {
            otherOperationalExpenses += Number(e.amount || 0);
        }
    });

    // Faktur Pembelian Kredit/Tempo di bulan ini (nilai total faktur, tidak peduli sudah lunas atau belum)
    const creditSupplierInvoices = supplierBills
        .filter(b => inMonth(b.date))
        .reduce((s, b) => s + Number(b.totalAmount || 0), 0);

    // Bunga Bank bulan ini
    let bankInterestInMonth = 0;
    let supplierCashPaidInMonth = 0;
    let bankCashPaidInMonth = 0;
    const isStoreOut = (src: string) => src === 'Kas Laci' || src === 'Transfer Bank' || src === 'Kas Dipegang Owner';

    supplierBills.forEach(b => {
        b.payments.forEach(p => {
            if (inMonth(p.date) && isStoreOut(p.fundingSource)) {
                supplierCashPaidInMonth += Number(p.amount || 0);
            }
        });
    });

    bankInstallments.forEach(inst => {
        inst.payments.forEach(p => {
            if (inMonth(p.date)) {
                bankInterestInMonth += Number(p.interestPaid || 0);
                if (isStoreOut(p.fundingSource)) {
                    bankCashPaidInMonth += Number(p.totalPaid || 0);
                }
            }
        });
    });

    // Jika ada gaji terhutang untuk bulan ini yang belum dibayar, akui sebagai beban akrual bulan ini
    const accruedTarget = Math.max(ownerSalaryAccruedForMonth, ownerSalaryPaidForMonth > 0 ? ownerSalaryPaidForMonth : targetMonthlyOwnerSalary);
    const ownerSalaryUnpaidAccrued = Math.max(0, ownerSalaryAccruedForMonth - ownerSalaryPaidForMonth);
    const recognizedOwnerSalary = ownerSalaryAccruedForMonth > 0
        ? Math.max(ownerSalaryPaidInExpenses, accruedTarget)
        : ownerSalaryPaidInExpenses;

    const totalAccrualCosts =
        lunasMaterialPurchases +
        creditSupplierInvoices +
        otherOperationalExpenses +
        recognizedOwnerSalary +
        bankInterestInMonth;

    const accrualNetProfit = accrualSales - totalAccrualCosts;

    const totalCashOutInMonth =
        lunasMaterialPurchases +
        otherOperationalExpenses +
        ownerSalaryPaidInExpenses +
        supplierCashPaidInMonth +
        bankCashPaidInMonth;

    const cashNetInMonth = cashOrderPayments - totalCashOutInMonth;

    return {
        month,
        accrualSales,
        cashOrderPayments,
        lunasMaterialPurchases,
        creditSupplierInvoices,
        otherOperationalExpenses,
        ownerSalaryPaidInExpenses,
        ownerSalaryUnpaidAccrued,
        bankInterestInMonth,
        accrualNetProfit,
        cashNetInMonth,
    };
};
