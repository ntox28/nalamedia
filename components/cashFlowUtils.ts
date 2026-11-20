import {
    type LegacyMonthlyIncome,
    type LegacyMonthlyExpense,
    type ReceivableItem,
    type ExpenseItem,
    type SupplierBill,
    type BankInstallment,
    type PrivateExpenseItem,
    type CashDrawerLog,
    type CashTransferRecord,
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
