import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  type OwnerFinanceProps,
  type OwnerFinanceConfig,
  type OwnerTransaction,
  type OwnerAllocationBucket,
  type ExpenseFundingSource,
} from '../types';
import {
  computeStoreCashSnapshot,
  computeMonthlyAccrualPerformance,
  OWNER_HOLD_ACCOUNT_ID,
  OWNER_HOLD_ACCOUNT_NAME,
} from './cashFlowUtils';
import OwnerAssetsDebtsPanel from './OwnerAssetsDebtsPanel';
import {
  buildOwnerFinanceReportHtml,
  exportOwnerFinanceExcel,
  type OwnerMonthlyIntakeRow,
  type OwnerReportExportPayload,
} from './ownerExportUtils';
import {
  Cog6ToothIcon,
  PlusCircleIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  BellIcon,
} from './Icons';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.round(val || 0));

const formatMonthLabel = (ym: string) => {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '-';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const getCurrentMonthStr = () => new Date().toISOString().slice(0, 7);
const getTodayStr = () => new Date().toISOString().slice(0, 10);

const BUCKET_LABELS: Record<OwnerAllocationBucket, string> = {
  reserve: 'Cadangan Usaha',
  equipment: 'Investasi Mesin',
  bonus: 'Bonus Owner',
  buffer: 'Buffer Kewajiban & Kas',
};

const DEFAULT_CATEGORY_BY_BUCKET: Record<Exclude<OwnerAllocationBucket, 'bonus'>, string> = {
  reserve: 'Cadangan Usaha',
  equipment: 'Investasi / Pembelian Mesin',
  buffer: 'Buffer Kewajiban & Kas',
};

type OwnerDashboardTabKey = 'summary' | 'closing' | 'assetsDebts' | 'transactions';

const OWNER_DASHBOARD_TABS: { key: OwnerDashboardTabKey; label: string }[] = [
  { key: 'summary', label: 'Ringkasan, Gaji & Bonus' },
  { key: 'closing', label: 'Tutup Buku & Pos Alokasi' },
  { key: 'assetsDebts', label: 'Aset, Modal & Hutang' },
  { key: 'transactions', label: 'Riwayat Transaksi Owner' },
];

const OwnerFinance: React.FC<OwnerFinanceProps> = ({
  config,
  transactions,
  monthlyClosings = [],
  allOrders,
  receivables,
  expenses,
  expenseMetadata,
  purchases,
  supplierBills,
  bankInstallments,
  privateExpenses,
  paymentMethods,
  cashDrawerState,
  cashDrawerLogs,
  cashTransfers,
  accountBalancesMeta,
  payrollRecords = [],
  assets = [],
  debts = [],
  suppliers = [],
  legacyReceivables = [],
  menuPermissions = [],
  storeInfo,
  onSaveConfig,
  onPaySalary,
  onAccrueSalary,
  onCloseMonth,
  onDeleteMonthlyClosing,
  onPayoutBonus,
  onWithdrawPrive,
  onUseAllocationBucket,
  onDeleteTransaction,
  onAddCashTransfer,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
  onAddDebt,
  onUpdateDebt,
  onDeleteDebt,
}) => {
  const accessibleTabs = useMemo(() => {
    const hasExplicitSubPerm = menuPermissions.some(p => p.startsWith('ownerFinance/'));
    if (!hasExplicitSubPerm && (menuPermissions.length === 0 || menuPermissions.includes('ownerFinance'))) {
      return OWNER_DASHBOARD_TABS;
    }
    return OWNER_DASHBOARD_TABS.filter(tab => menuPermissions.includes(`ownerFinance/${tab.key}`));
  }, [menuPermissions]);

  const [activeTab, setActiveTab] = useState<OwnerDashboardTabKey>(() => accessibleTabs[0]?.key || 'summary');

  useEffect(() => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
      setActiveTab(accessibleTabs[0].key);
    }
  }, [accessibleTabs, activeTab]);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [txTypeFilter, setTxTypeFilter] = useState<
    'all' | 'salary_paid' | 'salary_accrual' | 'bonus_payout' | 'prive' | 'reserve_usage'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isClosingMonth, setIsClosingMonth] = useState(false);

  // Paket 3: Cakupan Ringkasan Uang Diterima Owner & Export
  const [reportScope, setReportScope] = useState<
    'all_time' | 'selected_month' | 'selected_year' | 'custom_range'
  >('all_time');
  const [customStartDate, setCustomStartDate] = useState<string>(() => `${new Date().getFullYear()}-01-01`);
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayStr());

  // Print Preview Modal (Iframe-safe, no window.open)
  const [printPreviewDoc, setPrintPreviewDoc] = useState<{ title: string; html: string } | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  // Modal: Pengaturan Owner
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [cfgOwnerName, setCfgOwnerName] = useState(config.ownerName);
  const [cfgMonthlySalary, setCfgMonthlySalary] = useState(String(config.monthlySalary || 0));
  const [cfgSalaryPayDay, setCfgSalaryPayDay] = useState(String(config.salaryPayDay || 1));
  const [cfgReservePct, setCfgReservePct] = useState(String(config.allocationPercents.reserve));
  const [cfgEquipmentPct, setCfgEquipmentPct] = useState(String(config.allocationPercents.equipment));
  const [cfgBonusPct, setCfgBonusPct] = useState(String(config.allocationPercents.bonus));
  const [cfgBufferPct, setCfgBufferPct] = useState(String(config.allocationPercents.buffer));
  const [cfgLossMode, setCfgLossMode] = useState<'carry_forward' | 'absorb_reserve'>(
    config.lossCarryForwardMode || 'carry_forward'
  );
  const [cfgStartPeriod, setCfgStartPeriod] = useState(config.startPeriod || '');

  // Modal: Bayar Gaji Owner
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payMonth, setPayMonth] = useState(getCurrentMonthStr());
  const [payDate, setPayDate] = useState(getTodayStr());
  const [payAmount, setPayAmount] = useState('');
  const [payFunding, setPayFunding] = useState<ExpenseFundingSource>('Transfer Bank');
  const [payAccountId, setPayAccountId] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Modal: Catat Gaji Terhutang (Pending)
  const [isAccrueModalOpen, setIsAccrueModalOpen] = useState(false);
  const [accrueMonth, setAccrueMonth] = useState(getCurrentMonthStr());
  const [accrueDate, setAccrueDate] = useState(getTodayStr());
  const [accrueAmount, setAccrueAmount] = useState('');
  const [accrueNotes, setAccrueNotes] = useState('');
  const [isSubmittingAccrue, setIsSubmittingAccrue] = useState(false);

  // Modal: Cairkan Bonus Owner
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusMonth, setBonusMonth] = useState(getCurrentMonthStr());
  const [bonusDate, setBonusDate] = useState(getTodayStr());
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusFunding, setBonusFunding] = useState<ExpenseFundingSource>('Transfer Bank');
  const [bonusAccountId, setBonusAccountId] = useState('');
  const [bonusNotes, setBonusNotes] = useState('');
  const [bonusGuardrailOverride, setBonusGuardrailOverride] = useState(false);
  const [isSubmittingBonus, setIsSubmittingBonus] = useState(false);

  // Modal: Penarikan Prive Darurat (Paket 3)
  const [isPriveModalOpen, setIsPriveModalOpen] = useState(false);
  const [priveMonth, setPriveMonth] = useState(getCurrentMonthStr());
  const [priveDate, setPriveDate] = useState(getTodayStr());
  const [priveAmount, setPriveAmount] = useState('');
  const [priveFunding, setPriveFunding] = useState<ExpenseFundingSource>('Transfer Bank');
  const [priveAccountId, setPriveAccountId] = useState('');
  const [priveNotes, setPriveNotes] = useState('');
  const [priveGuardrailOverride, setPriveGuardrailOverride] = useState(false);
  const [isSubmittingPrive, setIsSubmittingPrive] = useState(false);

  // Modal: Pakai Pos Alokasi (Cadangan / Investasi Mesin / Buffer)
  const [isUseBucketModalOpen, setIsUseBucketModalOpen] = useState(false);
  const [useBucket, setUseBucket] = useState<Exclude<OwnerAllocationBucket, 'bonus'>>('equipment');
  const [useMonth, setUseMonth] = useState(getCurrentMonthStr());
  const [useDate, setUseDate] = useState(getTodayStr());
  const [useAmount, setUseAmount] = useState('');
  const [useRecordExpense, setUseRecordExpense] = useState(true);
  const [useExpenseName, setUseExpenseName] = useState('');
  const [useExpenseCategory, setUseExpenseCategory] = useState(DEFAULT_CATEGORY_BY_BUCKET.equipment);
  const [useFunding, setUseFunding] = useState<ExpenseFundingSource>('Transfer Bank');
  const [useAccountId, setUseAccountId] = useState('');
  const [useNotes, setUseNotes] = useState('');
  const [useAddFixedAsset, setUseAddFixedAsset] = useState(true);
  const [useAssetName, setUseAssetName] = useState('');
  const [isSubmittingUseBucket, setIsSubmittingUseBucket] = useState(false);

  // Modal: Setor Kas Titipan Owner ke Rekening / Laci Toko
  const [isOwnerHoldTransferModalOpen, setIsOwnerHoldTransferModalOpen] = useState(false);
  const [ownerHoldTransferDate, setOwnerHoldTransferDate] = useState(getTodayStr());
  const [ownerHoldTransferAmount, setOwnerHoldTransferAmount] = useState('');
  const [ownerHoldTransferToAccountId, setOwnerHoldTransferToAccountId] = useState('');
  const [ownerHoldTransferNotes, setOwnerHoldTransferNotes] = useState('');
  const [isSubmittingOwnerHoldTransfer, setIsSubmittingOwnerHoldTransfer] = useState(false);

  useEffect(() => {
    setCfgOwnerName(config.ownerName);
    setCfgMonthlySalary(String(config.monthlySalary || 0));
    setCfgSalaryPayDay(String(config.salaryPayDay || 1));
    setCfgReservePct(String(config.allocationPercents.reserve));
    setCfgEquipmentPct(String(config.allocationPercents.equipment));
    setCfgBonusPct(String(config.allocationPercents.bonus));
    setCfgBufferPct(String(config.allocationPercents.buffer));
    setCfgLossMode(config.lossCarryForwardMode || 'carry_forward');
    setCfgStartPeriod(config.startPeriod || '');
  }, [config]);

  const cashSnapshot = useMemo(
    () =>
      computeStoreCashSnapshot({
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
      }),
    [
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
    ]
  );

  // Rekap gaji per bulan dari ownerTransactions
  const salaryByMonthMap = useMemo(() => {
    const map = new Map<string, { paid: number; accrued: number }>();
    transactions.forEach(tx => {
      if (tx.type !== 'salary_paid' && tx.type !== 'salary_accrual') return;
      const cur = map.get(tx.month) || { paid: 0, accrued: 0 };
      if (tx.type === 'salary_paid') cur.paid += Number(tx.amount || 0);
      if (tx.type === 'salary_accrual') cur.accrued += Number(tx.amount || 0);
      map.set(tx.month, cur);
    });
    return map;
  }, [transactions]);

  const selectedMonthSalaryStats = useMemo(() => {
    const rec = salaryByMonthMap.get(selectedMonth) || { paid: 0, accrued: 0 };
    const effectiveTarget = Math.max(config.monthlySalary || 0, rec.accrued);
    const remaining = Math.max(0, effectiveTarget - rec.paid);
    const unpaidAccrued = Math.max(0, rec.accrued - rec.paid);
    let statusLabel = 'Belum Diatur';
    if (effectiveTarget > 0) {
      if (rec.paid >= effectiveTarget) statusLabel = 'Lunas';
      else if (rec.paid > 0 && unpaidAccrued > 0) statusLabel = 'Sebagian (Sisa Terhutang)';
      else if (rec.paid > 0) statusLabel = 'Dibayar Sebagian';
      else if (unpaidAccrued > 0) statusLabel = 'Dicatat Terhutang';
      else statusLabel = 'Belum Dibayar';
    }
    return {
      target: effectiveTarget,
      paid: rec.paid,
      accrued: rec.accrued,
      unpaidAccrued,
      remaining,
      statusLabel,
    };
  }, [salaryByMonthMap, selectedMonth, config.monthlySalary]);

  // Daftar bulan yang memiliki Gaji Terhutang (salary_accrual > salary_paid)
  const pendingSalaryMonths = useMemo(() => {
    const list: Array<{ month: string; accrued: number; paid: number; remaining: number }> = [];
    salaryByMonthMap.forEach((val, month) => {
      const rem = Math.max(0, val.accrued - val.paid);
      if (rem > 0) {
        list.push({ month, accrued: val.accrued, paid: val.paid, remaining: rem });
      }
    });
    return list.sort((a, b) => a.month.localeCompare(b.month));
  }, [salaryByMonthMap]);

  const totalPendingAccruedSalary = useMemo(
    () => pendingSalaryMonths.reduce((s, item) => s + item.remaining, 0),
    [pendingSalaryMonths]
  );

  // Saldo Kumulatif 4 Pos Alokasi (Paket 2)
  const bucketStats = useMemo(() => {
    const stats = {
      reserve: { inflow: 0, absorbedLoss: 0, used: 0, balance: 0 },
      equipment: { inflow: 0, used: 0, balance: 0 },
      bonus: { inflow: 0, used: 0, balance: 0 },
      buffer: { inflow: 0, used: 0, balance: 0 },
    };

    monthlyClosings.forEach(c => {
      stats.reserve.inflow += Number(c.allocations?.reserve || 0);
      stats.reserve.absorbedLoss += Number(c.absorbedFromReserve || 0);
      stats.equipment.inflow += Number(c.allocations?.equipment || 0);
      stats.bonus.inflow += Number(c.allocations?.bonus || 0);
      stats.buffer.inflow += Number(c.allocations?.buffer || 0);
    });

    transactions.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'bonus_payout') {
        stats.bonus.used += amt;
      } else if (tx.type === 'reserve_usage') {
        const targetBucket = tx.bucket || 'reserve';
        if (targetBucket === 'equipment') stats.equipment.used += amt;
        else if (targetBucket === 'buffer') stats.buffer.used += amt;
        else stats.reserve.used += amt;
      }
    });

    stats.reserve.balance = stats.reserve.inflow - stats.reserve.absorbedLoss - stats.reserve.used;
    stats.equipment.balance = stats.equipment.inflow - stats.equipment.used;
    stats.bonus.balance = stats.bonus.inflow - stats.bonus.used;
    stats.buffer.balance = stats.buffer.inflow - stats.buffer.used;

    return stats;
  }, [monthlyClosings, transactions]);

  // Filter Kas Aman untuk pencairan bonus
  const safeCashForBonus = useMemo(() => {
    const bufferReserve = Math.max(0, bucketStats.buffer.balance);
    return cashSnapshot.totalStoreLiquidCash - cashSnapshot.dueSoonSupplierBills - bufferReserve;
  }, [cashSnapshot.totalStoreLiquidCash, cashSnapshot.dueSoonSupplierBills, bucketStats.buffer.balance]);

  const sortedClosings = useMemo(
    () => [...monthlyClosings].sort((a, b) => b.month.localeCompare(a.month)),
    [monthlyClosings]
  );

  const existingClosingForSelectedMonth = useMemo(
    () => monthlyClosings.find(c => c.month === selectedMonth),
    [monthlyClosings, selectedMonth]
  );

  // Hitung rugi terbawa dari tutup buku bulan-bulan sebelumnya yang belum tertutup laba
  const unrecoveredPriorLoss = useMemo(() => {
    let lossPool = 0;
    [...monthlyClosings]
      .filter(c => c.month < selectedMonth)
      .sort((a, b) => a.month.localeCompare(b.month))
      .forEach(c => {
        if (c.rawProfit < 0 && c.lossHandledMode === 'carry_forward') {
          lossPool += Math.abs(c.rawProfit);
        } else if (c.rawProfit > 0) {
          lossPool = Math.max(0, lossPool - c.rawProfit);
        }
      });
    return lossPool;
  }, [monthlyClosings, selectedMonth]);

  // Kinerja akrual bulan terpilih
  const selectedMonthPerformance = useMemo(
    () =>
      computeMonthlyAccrualPerformance({
        month: selectedMonth,
        allOrders,
        receivables,
        expenses,
        expenseMetadata,
        purchases,
        supplierBills,
        bankInstallments,
        targetMonthlyOwnerSalary: config.monthlySalary || 0,
        ownerSalaryPaidForMonth: selectedMonthSalaryStats.paid,
        ownerSalaryAccruedForMonth: selectedMonthSalaryStats.accrued,
      }),
    [
      selectedMonth,
      allOrders,
      receivables,
      expenses,
      expenseMetadata,
      purchases,
      supplierBills,
      bankInstallments,
      config.monthlySalary,
      selectedMonthSalaryStats.paid,
      selectedMonthSalaryStats.accrued,
    ]
  );

  // Kalkulasi rencana tutup buku bulan terpilih
  const closingPlan = useMemo(() => {
    const rawProfit = selectedMonthPerformance.accrualNetProfit;
    const totalAccrualCosts = selectedMonthPerformance.accrualSales - rawProfit;
    let priorLossApplied = 0;
    let distributableProfit = 0;
    let lossHandledMode: 'none' | 'carry_forward' | 'absorb_reserve' = 'none';
    let absorbedFromReserve = 0;

    if (rawProfit > 0) {
      priorLossApplied = Math.min(unrecoveredPriorLoss, rawProfit);
      distributableProfit = Math.max(0, rawProfit - priorLossApplied);
      lossHandledMode = priorLossApplied > 0 ? 'carry_forward' : 'none';
    } else if (rawProfit < 0) {
      lossHandledMode = config.lossCarryForwardMode || 'carry_forward';
      if (lossHandledMode === 'absorb_reserve') {
        absorbedFromReserve = Math.abs(rawProfit);
      }
    }

    const { reserve, equipment, bonus, buffer } = config.allocationPercents;
    const reserveAmt = Math.round((distributableProfit * reserve) / 100);
    const equipmentAmt = Math.round((distributableProfit * equipment) / 100);
    const bonusAmt = Math.round((distributableProfit * bonus) / 100);
    const pctSum = reserve + equipment + bonus + buffer;
    const bufferAmt =
      distributableProfit > 0 && Math.abs(pctSum - 100) <= 0.01
        ? Math.max(0, distributableProfit - reserveAmt - equipmentAmt - bonusAmt)
        : Math.round((distributableProfit * buffer) / 100);

    return {
      totalAccrualCosts,
      rawProfit,
      priorLossApplied,
      distributableProfit,
      lossHandledMode,
      absorbedFromReserve,
      allocations: {
        reserve: reserveAmt,
        equipment: equipmentAmt,
        bonus: bonusAmt,
        buffer: bufferAmt,
      },
    };
  }, [selectedMonthPerformance, unrecoveredPriorLoss, config.lossCarryForwardMode, config.allocationPercents]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...transactions]
      .filter(tx => {
        if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
        if (!q) return true;
        const mLabel = formatMonthLabel(tx.month).toLowerCase();
        const bLabel = tx.bucket ? BUCKET_LABELS[tx.bucket].toLowerCase() : '';
        return (
          tx.month.toLowerCase().includes(q) ||
          mLabel.includes(q) ||
          bLabel.includes(q) ||
          (tx.notes || '').toLowerCase().includes(q) ||
          (tx.fundingSource || '').toLowerCase().includes(q) ||
          (tx.fundingAccountName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [transactions, txTypeFilter, searchQuery]);

  const getAvailableForFunding = (source: ExpenseFundingSource, accountId: string) => {
    if (source === 'Kas Laci') return cashSnapshot.cashDrawerBalance;
    if (source === 'Kas Dipegang Owner') return cashSnapshot.ownerHoldBalance;
    if (source === 'Transfer Bank') {
      if (accountId) {
        return cashSnapshot.nonCashAccounts.find(a => a.id === accountId)?.balance ?? cashSnapshot.totalBankBalance;
      }
      return cashSnapshot.totalBankBalance;
    }
    return 0;
  };

  const selectedPayFundingAvailable = useMemo(
    () => getAvailableForFunding(payFunding, payAccountId),
    [payFunding, payAccountId, cashSnapshot]
  );

  const selectedBonusFundingAvailable = useMemo(
    () => getAvailableForFunding(bonusFunding, bonusAccountId),
    [bonusFunding, bonusAccountId, cashSnapshot]
  );

  const selectedUseFundingAvailable = useMemo(
    () => getAvailableForFunding(useFunding, useAccountId),
    [useFunding, useAccountId, cashSnapshot]
  );

  const selectedPriveFundingAvailable = useMemo(
    () => getAvailableForFunding(priveFunding, priveAccountId),
    [priveFunding, priveAccountId, cashSnapshot]
  );

  // Pengingat Tanggal Gaji Owner Bulanan
  const paydayReminder = useMemo(() => {
    const salaryTarget = Number(config.monthlySalary || 0);
    if (salaryTarget <= 0) return null;
    const now = new Date();
    const curMonth = getCurrentMonthStr();
    const curDay = now.getDate();
    const payDay = Math.min(28, Math.max(1, Number(config.salaryPayDay || 1)));
    if (curDay < payDay) return null;
    const rec = salaryByMonthMap.get(curMonth) || { paid: 0, accrued: 0 };
    if (rec.paid > 0 || rec.accrued > 0) return null;
    return {
      month: curMonth,
      payDay,
      targetSalary: salaryTarget,
    };
  }, [config.monthlySalary, config.salaryPayDay, salaryByMonthMap]);

  // Checklist Validasi Pra-Tutup Buku untuk selectedMonth
  const preClosingChecklist = useMemo(() => {
    const items: Array<{
      id: string;
      status: 'ok' | 'warn' | 'info';
      title: string;
      detail: string;
      action?: 'pay_salary' | 'accrue_salary' | 'select_prev_month';
      prevMonth?: string;
    }> = [];

    // 1. Gaji Owner
    if ((config.monthlySalary || 0) > 0) {
      if (selectedMonthSalaryStats.paid === 0 && selectedMonthSalaryStats.accrued === 0) {
        items.push({
          id: 'owner_salary',
          status: 'warn',
          title: 'Gaji Owner bulan ini belum dicatat',
          detail: `Target gaji ${formatCurrency(config.monthlySalary)} belum dibayar maupun dicatat terhutang. Sistem tetap menghitung cadangan target gaji di Laba/Rugi akrual, namun sebaiknya dicatat resmi sebelum kunci tutup buku.`,
          action: 'pay_salary',
        });
      } else {
        items.push({
          id: 'owner_salary',
          status: 'ok',
          title: 'Gaji Owner bulan ini sudah tercatat',
          detail: `Dibayar ${formatCurrency(selectedMonthSalaryStats.paid)}${
            selectedMonthSalaryStats.unpaidAccrued > 0
              ? ` · Terhutang ${formatCurrency(selectedMonthSalaryStats.unpaidAccrued)}`
              : ''
          }.`,
        });
      }
    } else {
      items.push({
        id: 'owner_salary',
        status: 'info',
        title: 'Gaji Pokok Owner diset Rp 0',
        detail: 'Tidak ada potongan gaji rutin owner di bulan ini.',
      });
    }

    // 2. Sinkronisasi Gaji Karyawan vs Pengeluaran Operasional
    const monthPayrollTotal = payrollRecords
      .filter(
        r =>
          (r.endDate && r.endDate.startsWith(selectedMonth)) ||
          (r.startDate && r.startDate.startsWith(selectedMonth))
      )
      .reduce((s, r) => s + Number(r.totalSalary || 0), 0);

    const monthEmployeeSalaryExpenses = expenses
      .filter(e => {
        if (!e.date || !e.date.startsWith(selectedMonth)) return false;
        if (e.category === 'Gaji Owner') return false;
        const cat = (e.category || '').toLowerCase();
        const nm = (e.name || '').toLowerCase();
        return cat.includes('gaji') || nm.includes('gaji') || cat.includes('karyawan');
      })
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    if (monthPayrollTotal > 0 && monthEmployeeSalaryExpenses === 0) {
      items.push({
        id: 'employee_payroll',
        status: 'warn',
        title: 'Gaji karyawan belum tercatat di Pengeluaran Operasional',
        detail: `Ditemukan data Absensi & Gaji sebesar ${formatCurrency(monthPayrollTotal)} pada periode ini, namun belum ada beban gaji karyawan di menu Pengeluaran.`,
      });
    } else if (monthPayrollTotal > 0 || monthEmployeeSalaryExpenses > 0) {
      items.push({
        id: 'employee_payroll',
        status: 'ok',
        title: 'Beban gaji karyawan sudah sinkron',
        detail: `Tercatat di Pengeluaran Operasional: ${formatCurrency(monthEmployeeSalaryExpenses)}.`,
      });
    } else {
      items.push({
        id: 'employee_payroll',
        status: 'info',
        title: 'Belum ada transaksi gaji karyawan di periode ini',
        detail: 'Pastikan seluruh gaji staf bulan ini sudah diinput ke Pengeluaran jika ada.',
      });
    }

    // 3. Status Tutup Buku Bulan Sebelumnya
    const [yr, mo] = selectedMonth.split('-').map(Number);
    if (yr && mo) {
      const prevDate = new Date(Date.UTC(yr, mo - 2, 15));
      const prevMonth = prevDate.toISOString().slice(0, 7);
      const isPrevClosed = monthlyClosings.some(c => c.month === prevMonth);
      const isAfterStartPeriod = !config.startPeriod || prevMonth >= config.startPeriod;
      const hasPrevActivity =
        allOrders.some(o => o.tanggal?.startsWith(prevMonth)) ||
        expenses.some(e => e.date?.startsWith(prevMonth));

      if (!isPrevClosed && isAfterStartPeriod && hasPrevActivity) {
        items.push({
          id: 'prev_closing',
          status: 'warn',
          title: `Tutup buku ${formatMonthLabel(prevMonth)} belum dikunci`,
          detail: 'Sebaiknya kunci bulan sebelumnya berurutan agar perhitungan sisa rugi terbawa (carry-forward) selalu tepat.',
          action: 'select_prev_month',
          prevMonth,
        });
      } else {
        items.push({
          id: 'prev_closing',
          status: 'ok',
          title: 'Urutan tutup buku bulan sebelumnya aman',
          detail: isPrevClosed
            ? `Periode ${formatMonthLabel(prevMonth)} sudah terkunci.`
            : 'Tidak ada tunggakan tutup buku bulan sebelumnya.',
        });
      }
    }

    // 4. Status Periode Berjalan
    if (selectedMonth >= getCurrentMonthStr()) {
      items.push({
        id: 'ongoing_month',
        status: 'warn',
        title: `Periode ${formatMonthLabel(selectedMonth)} masih berjalan`,
        detail: 'Tutup buku idealnya dilakukan setelah akhir bulan agar seluruh order & biaya bulan tersebut final.',
      });
    } else {
      items.push({
        id: 'ongoing_month',
        status: 'ok',
        title: `Periode ${formatMonthLabel(selectedMonth)} sudah selesai`,
        detail: 'Data transaksi periode ini siap dikunci.',
      });
    }

    return items;
  }, [
    config.monthlySalary,
    config.startPeriod,
    selectedMonth,
    selectedMonthSalaryStats,
    payrollRecords,
    expenses,
    monthlyClosings,
    allOrders,
  ]);

  // Paket 3: Ringkasan Total Uang Diterima Owner & Rekap Bulanan
  const selectedYear = selectedMonth.slice(0, 4) || String(new Date().getFullYear());

  const reportPeriodInfo = useMemo(() => {
    let label = 'Semua Periode (Kumulatif)';
    if (reportScope === 'selected_month') label = `Bulan ${formatMonthLabel(selectedMonth)}`;
    else if (reportScope === 'selected_year') label = `Tahun ${selectedYear}`;
    else if (reportScope === 'custom_range') {
      label = `${customStartDate || 'Awal'} s/d ${customEndDate || 'Sekarang'}`;
    }

    const matchesTx = (tx: OwnerTransaction) => {
      if (reportScope === 'selected_month') return tx.month === selectedMonth;
      if (reportScope === 'selected_year') return tx.month.startsWith(selectedYear);
      if (reportScope === 'custom_range') {
        if (customStartDate && tx.date < customStartDate) return false;
        if (customEndDate && tx.date > customEndDate) return false;
        return true;
      }
      return true;
    };

    return { label, matchesTx };
  }, [reportScope, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const scopedOwnerTransactions = useMemo(
    () =>
      [...transactions]
        .filter(reportPeriodInfo.matchesTx)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [transactions, reportPeriodInfo]
  );

  const ownerIntakeSummary = useMemo(() => {
    let salaryPaid = 0;
    let bonusPaid = 0;
    let privePaid = 0;

    scopedOwnerTransactions.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'salary_paid') salaryPaid += amt;
      else if (tx.type === 'bonus_payout') bonusPaid += amt;
      else if (tx.type === 'prive') privePaid += amt;
    });

    return {
      salaryPaid,
      bonusPaid,
      privePaid,
      totalReceived: salaryPaid + bonusPaid + privePaid,
    };
  }, [scopedOwnerTransactions]);

  const monthlyIntakeRows = useMemo<OwnerMonthlyIntakeRow[]>(() => {
    const map = new Map<string, OwnerMonthlyIntakeRow>();
    scopedOwnerTransactions.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (
        tx.type !== 'salary_paid' &&
        tx.type !== 'salary_accrual' &&
        tx.type !== 'bonus_payout' &&
        tx.type !== 'prive'
      ) {
        return;
      }
      const existing = map.get(tx.month) || {
        month: tx.month,
        salaryPaid: 0,
        salaryAccruedUnpaid: 0,
        bonusPaid: 0,
        privePaid: 0,
        totalReceived: 0,
      };
      if (tx.type === 'salary_paid') existing.salaryPaid += amt;
      else if (tx.type === 'bonus_payout') existing.bonusPaid += amt;
      else if (tx.type === 'prive') existing.privePaid += amt;
      map.set(tx.month, existing);
    });

    const rows: OwnerMonthlyIntakeRow[] = [];
    map.forEach((row, month) => {
      const salRec = salaryByMonthMap.get(month);
      row.salaryAccruedUnpaid = salRec ? Math.max(0, salRec.accrued - salRec.paid) : 0;
      row.totalReceived = row.salaryPaid + row.bonusPaid + row.privePaid;
      rows.push(row);
    });

    return rows.sort((a, b) => b.month.localeCompare(a.month));
  }, [scopedOwnerTransactions, salaryByMonthMap]);

  const exportReportPayload = useMemo<OwnerReportExportPayload>(
    () => ({
      config,
      storeInfo,
      periodLabel: reportPeriodInfo.label,
      selectedMonth,
      intakeSummary: {
        ...ownerIntakeSummary,
        pendingAccruedSalary: totalPendingAccruedSalary,
        availableBonusBalance: bucketStats.bonus.balance,
      },
      bucketStats,
      cashSummary: {
        totalStoreLiquidCash: cashSnapshot.totalStoreLiquidCash,
        dueSoonSupplierBills: cashSnapshot.dueSoonSupplierBills,
        safeCashForBonus,
      },
      monthlyIntakeRows,
      monthlyClosings: sortedClosings,
      transactions: scopedOwnerTransactions,
    }),
    [
      config,
      storeInfo,
      reportPeriodInfo.label,
      selectedMonth,
      ownerIntakeSummary,
      totalPendingAccruedSalary,
      bucketStats,
      cashSnapshot.totalStoreLiquidCash,
      cashSnapshot.dueSoonSupplierBills,
      safeCashForBonus,
      monthlyIntakeRows,
      sortedClosings,
      scopedOwnerTransactions,
    ]
  );

  const handleOpenPrintReport = () => {
    const html = buildOwnerFinanceReportHtml(exportReportPayload);
    setPrintPreviewDoc({
      title: `Laporan Owner Dashboard (${reportPeriodInfo.label})`,
      html,
    });
  };

  const handleTriggerPrint = () => {
    const win = printIframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  // Helpers buka modal
  const openPaySalaryModal = (
    targetMonth: string,
    defaultAmount: number,
    defaultNotes?: string,
    defaultFunding?: ExpenseFundingSource
  ) => {
    setPayMonth(targetMonth);
    setPayDate(getTodayStr());
    setPayAmount(defaultAmount > 0 ? String(Math.round(defaultAmount)) : '');
    if (defaultFunding) {
      setPayFunding(defaultFunding);
      if (defaultFunding === 'Transfer Bank' && cashSnapshot.nonCashAccounts.length > 0) {
        setPayAccountId(cashSnapshot.nonCashAccounts[0].id);
      } else {
        setPayAccountId('');
      }
    } else if (cashSnapshot.nonCashAccounts.length > 0) {
      setPayFunding('Transfer Bank');
      setPayAccountId(cashSnapshot.nonCashAccounts[0].id);
    } else {
      setPayFunding('Kas Laci');
      setPayAccountId('');
    }
    setPayNotes(defaultNotes || `Gaji Owner ${formatMonthLabel(targetMonth)}`);
    setIsPayModalOpen(true);
  };

  const openOwnerHoldTransferModal = () => {
    const maxHold = Math.max(0, Math.floor(cashSnapshot.ownerHoldBalance));
    setOwnerHoldTransferDate(getTodayStr());
    setOwnerHoldTransferAmount(maxHold > 0 ? String(maxHold) : '');
    setOwnerHoldTransferToAccountId(cashSnapshot.nonCashAccounts[0]?.id || 'cash-drawer');
    setOwnerHoldTransferNotes('Setor Kas Titipan Owner ke Rekening Toko');
    setIsOwnerHoldTransferModalOpen(true);
  };

  const openAccrueSalaryModal = (targetMonth: string) => {
    const rec = salaryByMonthMap.get(targetMonth) || { paid: 0, accrued: 0 };
    const defaultAmt = Math.max(0, (config.monthlySalary || 0) - rec.accrued);
    setAccrueMonth(targetMonth);
    setAccrueDate(getTodayStr());
    setAccrueAmount(defaultAmt > 0 ? String(Math.round(defaultAmt)) : String(config.monthlySalary || ''));
    setAccrueNotes(`Gaji Owner ${formatMonthLabel(targetMonth)} ditunda menunggu piutang cair`);
    setIsAccrueModalOpen(true);
  };

  const openBonusPayoutModal = () => {
    const maxSafe = Math.max(0, safeCashForBonus);
    const availableBonus = Math.max(0, bucketStats.bonus.balance);
    const suggested = availableBonus > 0 ? Math.min(availableBonus, maxSafe > 0 ? maxSafe : availableBonus) : 0;

    setBonusMonth(selectedMonth);
    setBonusDate(getTodayStr());
    setBonusAmount(suggested > 0 ? String(Math.round(suggested)) : '');
    if (cashSnapshot.nonCashAccounts.length > 0) {
      setBonusFunding('Transfer Bank');
      setBonusAccountId(cashSnapshot.nonCashAccounts[0].id);
    } else {
      setBonusFunding('Kas Laci');
      setBonusAccountId('');
    }
    setBonusNotes(`Pencairan Bonus Owner (${formatMonthLabel(selectedMonth)})`);
    setBonusGuardrailOverride(false);
    setIsBonusModalOpen(true);
  };

  const openUseBucketModal = (targetBucket: Exclude<OwnerAllocationBucket, 'bonus'>) => {
    setUseBucket(targetBucket);
    setUseMonth(selectedMonth);
    setUseDate(getTodayStr());
    setUseAmount('');
    setUseRecordExpense(true);
    setUseExpenseCategory(DEFAULT_CATEGORY_BY_BUCKET[targetBucket]);
    setUseExpenseName('');
    setUseAddFixedAsset(targetBucket === 'equipment');
    setUseAssetName('');
    if (cashSnapshot.nonCashAccounts.length > 0) {
      setUseFunding('Transfer Bank');
      setUseAccountId(cashSnapshot.nonCashAccounts[0].id);
    } else {
      setUseFunding('Kas Laci');
      setUseAccountId('');
    }
    setUseNotes('');
    setIsUseBucketModalOpen(true);
  };

  const openPriveModal = () => {
    setPriveMonth(selectedMonth);
    setPriveDate(getTodayStr());
    setPriveAmount('');
    if (cashSnapshot.nonCashAccounts.length > 0) {
      setPriveFunding('Transfer Bank');
      setPriveAccountId(cashSnapshot.nonCashAccounts[0].id);
    } else {
      setPriveFunding('Kas Laci');
      setPriveAccountId('');
    }
    setPriveNotes('');
    setPriveGuardrailOverride(false);
    setIsPriveModalOpen(true);
  };

  const handleSaveConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reserve = Number(cfgReservePct) || 0;
    const equipment = Number(cfgEquipmentPct) || 0;
    const bonus = Number(cfgBonusPct) || 0;
    const buffer = Number(cfgBufferPct) || 0;
    const totalPct = reserve + equipment + bonus + buffer;
    if (Math.abs(totalPct - 100) > 0.01) {
      alert(`Total persentase alokasi laba harus 100% (saat ini ${totalPct}%).`);
      return;
    }
    const salaryNum = Math.max(0, Number(cfgMonthlySalary) || 0);
    const payDayNum = Math.min(28, Math.max(1, Math.round(Number(cfgSalaryPayDay) || 1)));
    const nextCfg: OwnerFinanceConfig = {
      ownerName: cfgOwnerName.trim() || 'Owner',
      monthlySalary: salaryNum,
      salaryPayDay: payDayNum,
      allocationPercents: { reserve, equipment, bonus, buffer },
      lossCarryForwardMode: cfgLossMode,
      startPeriod: cfgStartPeriod.trim() || undefined,
    };
    await onSaveConfig(nextCfg);
    setIsConfigModalOpen(false);
  };

  const handlePaySalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(payAmount);
    if (!payMonth || !payDate || !numAmt || numAmt <= 0) {
      alert('Bulan hak, tanggal bayar, dan nominal gaji harus valid.');
      return;
    }
    const accountObj =
      payFunding === 'Transfer Bank' && payAccountId
        ? cashSnapshot.nonCashAccounts.find(a => a.id === payAccountId)
        : undefined;
    setIsSubmittingPay(true);
    try {
      const ok = await onPaySalary({
        month: payMonth,
        date: payDate,
        amount: numAmt,
        fundingSource: payFunding,
        fundingAccountId: payFunding === 'Transfer Bank' && payAccountId ? payAccountId : undefined,
        fundingAccountName: accountObj?.name,
        notes: payNotes.trim() || undefined,
      });
      if (ok) setIsPayModalOpen(false);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleAccrueSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(accrueAmount);
    if (!accrueMonth || !accrueDate || !numAmt || numAmt <= 0) {
      alert('Bulan hak, tanggal, dan nominal gaji terhutang harus valid.');
      return;
    }
    setIsSubmittingAccrue(true);
    try {
      const ok = await onAccrueSalary({
        month: accrueMonth,
        date: accrueDate,
        amount: numAmt,
        notes: accrueNotes.trim() || undefined,
      });
      if (ok) setIsAccrueModalOpen(false);
    } finally {
      setIsSubmittingAccrue(false);
    }
  };

  const handleCloseMonthAction = async () => {
    if (existingClosingForSelectedMonth) return;
    const confirmMsg =
      closingPlan.rawProfit < 0
        ? `Kinerja ${formatMonthLabel(selectedMonth)} mengalami RUGI ${formatCurrency(closingPlan.rawProfit)}. Mode rugi aktif: ${
            closingPlan.lossHandledMode === 'absorb_reserve'
              ? 'Serap dari Cadangan Usaha'
              : 'Tutup Rugi ke Laba Bulan Berikutnya'
          }. Lanjutkan Tutup Buku?`
        : `Tutup Buku periode ${formatMonthLabel(selectedMonth)}? Laba boleh dibagi sebesar ${formatCurrency(
            closingPlan.distributableProfit
          )} akan dikunci ke 4 Pos Alokasi (Bonus Owner: ${formatCurrency(closingPlan.allocations.bonus)}).`;

    if (!window.confirm(confirmMsg)) return;

    setIsClosingMonth(true);
    try {
      const ok = await onCloseMonth({
        month: selectedMonth,
        accrualSales: selectedMonthPerformance.accrualSales,
        totalAccrualCosts: closingPlan.totalAccrualCosts,
        rawProfit: closingPlan.rawProfit,
        priorLossApplied: closingPlan.priorLossApplied,
        distributableProfit: closingPlan.distributableProfit,
        lossHandledMode: closingPlan.lossHandledMode,
        absorbedFromReserve: closingPlan.absorbedFromReserve,
        percents: { ...config.allocationPercents },
        allocations: { ...closingPlan.allocations },
        cashNetInMonth: selectedMonthPerformance.cashNetInMonth,
        notes: closingNotes.trim() || undefined,
      });
      if (ok) setClosingNotes('');
    } finally {
      setIsClosingMonth(false);
    }
  };

  const handleBonusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(bonusAmount);
    if (!bonusMonth || !bonusDate || !numAmt || numAmt <= 0) {
      alert('Bulan, tanggal, dan nominal pencairan bonus harus valid.');
      return;
    }

    const exceedsBonusBalance = numAmt > Math.max(0, bucketStats.bonus.balance);
    const exceedsSafeCash = numAmt > Math.max(0, safeCashForBonus);
    const exceedsSelectedAccount = numAmt > selectedBonusFundingAvailable;

    if ((exceedsBonusBalance || exceedsSafeCash || exceedsSelectedAccount) && !bonusGuardrailOverride) {
      alert('Centang konfirmasi pengabaian peringatan Filter Kas Aman / Saldo Bonus terlebih dahulu untuk melanjutkan.');
      return;
    }

    const accountObj =
      bonusFunding === 'Transfer Bank' && bonusAccountId
        ? cashSnapshot.nonCashAccounts.find(a => a.id === bonusAccountId)
        : undefined;

    setIsSubmittingBonus(true);
    try {
      const ok = await onPayoutBonus({
        month: bonusMonth,
        date: bonusDate,
        amount: numAmt,
        fundingSource: bonusFunding,
        fundingAccountId: bonusFunding === 'Transfer Bank' && bonusAccountId ? bonusAccountId : undefined,
        fundingAccountName: accountObj?.name,
        notes: bonusNotes.trim() || undefined,
      });
      if (ok) setIsBonusModalOpen(false);
    } finally {
      setIsSubmittingBonus(false);
    }
  };

  const handleUseBucketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(useAmount);
    if (!useMonth || !useDate || !numAmt || numAmt <= 0) {
      alert('Bulan, tanggal, dan nominal pemakaian pos harus valid.');
      return;
    }
    if (useRecordExpense && !useExpenseName.trim()) {
      alert('Masukkan nama/deskripsi pengeluaran operasional (contoh: Beli Mesin Laminasi / Servis Printer).');
      return;
    }

    const shouldCreateAsset = useBucket === 'equipment' && useAddFixedAsset;
    const resolvedAssetName =
      useAssetName.trim() || useExpenseName.trim() || useNotes.trim() || '';
    if (shouldCreateAsset && !resolvedAssetName) {
      alert('Masukkan nama aset tetap mesin/peralatan yang ingin ditambahkan ke Daftar Aset.');
      return;
    }

    const accountObj =
      useRecordExpense && useFunding === 'Transfer Bank' && useAccountId
        ? cashSnapshot.nonCashAccounts.find(a => a.id === useAccountId)
        : undefined;

    setIsSubmittingUseBucket(true);
    try {
      const ok = await onUseAllocationBucket({
        bucket: useBucket,
        month: useMonth,
        date: useDate,
        amount: numAmt,
        recordOperationalExpense: useRecordExpense,
        expenseCategory: useRecordExpense ? useExpenseCategory.trim() || DEFAULT_CATEGORY_BY_BUCKET[useBucket] : undefined,
        expenseName: useRecordExpense ? useExpenseName.trim() : undefined,
        fundingSource: useRecordExpense ? useFunding : undefined,
        fundingAccountId: useRecordExpense && useFunding === 'Transfer Bank' && useAccountId ? useAccountId : undefined,
        fundingAccountName: accountObj?.name,
        notes: useNotes.trim() || undefined,
        addFixedAsset: shouldCreateAsset
          ? { name: resolvedAssetName, value: numAmt }
          : undefined,
      });
      if (ok) setIsUseBucketModalOpen(false);
    } finally {
      setIsSubmittingUseBucket(false);
    }
  };

  const handleOwnerHoldTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(ownerHoldTransferAmount);
    if (!ownerHoldTransferDate || !numAmt || numAmt <= 0) {
      alert('Tanggal dan nominal setor harus valid.');
      return;
    }
    if (!ownerHoldTransferToAccountId) {
      alert('Pilih akun tujuan setor.');
      return;
    }

    const isCashDrawer = ownerHoldTransferToAccountId === 'cash-drawer';
    const targetAcc = isCashDrawer
      ? { id: 'cash-drawer', name: 'Kas Laci (Tunai Kasir)' }
      : cashSnapshot.nonCashAccounts.find(a => a.id === ownerHoldTransferToAccountId);

    if (!targetAcc) {
      alert('Akun tujuan tidak ditemukan.');
      return;
    }

    setIsSubmittingOwnerHoldTransfer(true);
    try {
      await onAddCashTransfer({
        date: ownerHoldTransferDate,
        transferType: 'Pindah Akun',
        fromAccountId: OWNER_HOLD_ACCOUNT_ID,
        fromAccountName: OWNER_HOLD_ACCOUNT_NAME,
        toAccountId: targetAcc.id,
        toAccountName: targetAcc.name,
        amount: numAmt,
        adminFee: 0,
        netAmount: numAmt,
        notes: ownerHoldTransferNotes.trim() || `Setor Kas Titipan Owner ke ${targetAcc.name}`,
      });
      setIsOwnerHoldTransferModalOpen(false);
    } finally {
      setIsSubmittingOwnerHoldTransfer(false);
    }
  };

  const handlePriveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(priveAmount);
    if (!priveMonth || !priveDate || !numAmt || numAmt <= 0) {
      alert('Bulan, tanggal, dan nominal penarikan prive harus valid.');
      return;
    }

    const exceedsSafeCash = numAmt > Math.max(0, safeCashForBonus);
    const exceedsAccount = numAmt > selectedPriveFundingAvailable;

    if ((exceedsSafeCash || exceedsAccount) && !priveGuardrailOverride) {
      alert('Centang konfirmasi pengabaian peringatan Filter Kas Aman / Saldo Akun terlebih dahulu.');
      return;
    }

    const accountObj =
      priveFunding === 'Transfer Bank' && priveAccountId
        ? cashSnapshot.nonCashAccounts.find(a => a.id === priveAccountId)
        : undefined;

    setIsSubmittingPrive(true);
    try {
      const ok = await onWithdrawPrive({
        month: priveMonth,
        date: priveDate,
        amount: numAmt,
        fundingSource: priveFunding,
        fundingAccountId: priveFunding === 'Transfer Bank' && priveAccountId ? priveAccountId : undefined,
        fundingAccountName: accountObj?.name,
        notes: priveNotes.trim() || undefined,
      });
      if (ok) setIsPriveModalOpen(false);
    } finally {
      setIsSubmittingPrive(false);
    }
  };

  const getTxTypeLabel = (tx: OwnerTransaction) => {
    switch (tx.type) {
      case 'salary_paid':
        return 'Gaji Dibayar';
      case 'salary_accrual':
        return 'Gaji Terhutang';
      case 'bonus_payout':
        return 'Pencairan Bonus';
      case 'prive':
        return 'Prive Darurat';
      case 'reserve_usage':
        return `Pakai ${tx.bucket ? BUCKET_LABELS[tx.bucket] : 'Pos Cadangan'}`;
      default:
        return tx.type;
    }
  };

  const pctSumPreview =
    (Number(cfgReservePct) || 0) +
    (Number(cfgEquipmentPct) || 0) +
    (Number(cfgBonusPct) || 0) +
    (Number(cfgBufferPct) || 0);

  const bonusNumInput = Number(bonusAmount || 0);
  const bonusExceedsBalance = bonusNumInput > Math.max(0, bucketStats.bonus.balance);
  const bonusExceedsSafeCash = bonusNumInput > Math.max(0, safeCashForBonus);
  const bonusExceedsAccount = bonusNumInput > selectedBonusFundingAvailable;
  const hasBonusGuardrailWarning = bonusNumInput > 0 && (bonusExceedsBalance || bonusExceedsSafeCash || bonusExceedsAccount);

  const priveNumInput = Number(priveAmount || 0);
  const priveExceedsSafeCash = priveNumInput > Math.max(0, safeCashForBonus);
  const priveExceedsAccount = priveNumInput > selectedPriveFundingAvailable;
  const hasPriveGuardrailWarning = priveNumInput > 0 && (priveExceedsSafeCash || priveExceedsAccount);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Owner Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">
            {config.ownerName} · Jadwal Gaji Tgl {config.salaryPayDay}/bulan · Alokasi{' '}
            {config.allocationPercents.reserve}/{config.allocationPercents.equipment}/{config.allocationPercents.bonus}/{config.allocationPercents.buffer}%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label htmlFor="owner-month-select" className="text-xs font-medium text-slate-600 whitespace-nowrap">
              Periode Bulan:
            </label>
            <input
              id="owner-month-select"
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-800 bg-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <button
            type="button"
            onClick={handleOpenPrintReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <PrinterIcon className="h-4 w-4 text-pink-600" />
            Cetak / PDF
          </button>
          <button
            type="button"
            onClick={() => exportOwnerFinanceExcel(exportReportPayload)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Cog6ToothIcon className="h-4 w-4 text-slate-500" />
            Pengaturan
          </button>
          <button
            type="button"
            onClick={openPriveModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-violet-300 bg-violet-50 text-violet-800 rounded-lg text-sm font-semibold hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0"
          >
            Prive Darurat
          </button>
          <button
            type="button"
            onClick={() =>
              openPaySalaryModal(
                selectedMonth,
                selectedMonthSalaryStats.remaining > 0
                  ? selectedMonthSalaryStats.remaining
                  : config.monthlySalary || 0
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors whitespace-nowrap shrink-0"
          >
            <PlusCircleIcon className="h-4 w-4" />
            Bayar Gaji Owner
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      {accessibleTabs.length === 0 ? (
        <div className="bg-white border border-rose-200 rounded-xl p-6 text-center text-sm text-rose-700">
          Akun Anda tidak memiliki akses ke tab mana pun pada Owner Dashboard. Hubungi Administrator melalui menu Pengaturan → Manajemen Pengguna &amp; Akses.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl px-4">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tab Owner Dashboard">
            {accessibleTabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`${
                  activeTab === tab.key
                    ? 'border-pink-600 text-pink-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                } whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* TAB 1: RINGKASAN, GAJI & BONUS */}
      {accessibleTabs.length > 0 && activeTab === 'summary' && (
        <div className="space-y-6">
          {/* Warning jika Gaji Pokok belum diatur */}
          {(!config.monthlySalary || config.monthlySalary <= 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Nominal Gaji Bulanan Owner belum diatur</p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Silakan atur Gaji Pokok Bulanan dan persentase alokasi laba ({config.allocationPercents.reserve}/{config.allocationPercents.equipment}/{config.allocationPercents.bonus}/{config.allocationPercents.buffer}%) di Pengaturan Owner agar perhitungan gaji &amp; tutup buku berjalan akurat.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 whitespace-nowrap shrink-0"
              >
                Atur Gaji Sekarang
              </button>
            </div>
          )}

          {/* Pengingat Tanggal Gaji Owner */}
          {paydayReminder && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <BellIcon className="h-5 w-5 text-pink-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-pink-950">
                    Pengingat Gaji Owner ({formatMonthLabel(paydayReminder.month)})
                  </p>
                  <p className="text-xs text-pink-800 mt-0.5">
                    Sudah melewati tanggal gajian rutin (tgl {paydayReminder.payDay}/bulan), namun gaji bulan ini sebesar{' '}
                    <strong className="tabular-nums">{formatCurrency(paydayReminder.targetSalary)}</strong> belum dibayar maupun dicatat terhutang.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAccrueSalaryModal(paydayReminder.month)}
                  className="px-3.5 py-2 border border-amber-300 bg-white text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-50 whitespace-nowrap"
                >
                  Catat Terhutang
                </button>
                <button
                  type="button"
                  onClick={() => openPaySalaryModal(paydayReminder.month, paydayReminder.targetSalary)}
                  className="px-3.5 py-2 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 whitespace-nowrap"
                >
                  Bayar Gaji Sekarang
                </button>
              </div>
            </div>
          )}

      {/* 4 Executive Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Gaji Owner ({formatMonthLabel(selectedMonth)})</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(selectedMonthSalaryStats.paid)}
          </p>
          <p
            className={`text-xs font-semibold mt-1.5 flex items-center gap-1 tabular-nums ${
              selectedMonthSalaryStats.statusLabel === 'Lunas'
                ? 'text-emerald-700'
                : selectedMonthSalaryStats.unpaidAccrued > 0
                ? 'text-amber-700'
                : 'text-slate-600'
            }`}
          >
            {selectedMonthSalaryStats.statusLabel === 'Lunas' && (
              <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            Target {formatCurrency(selectedMonthSalaryStats.target)} · {selectedMonthSalaryStats.statusLabel}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Total Gaji Terhutang (Semua Bulan)</p>
          <p
            className={`text-2xl font-bold mt-1 tabular-nums ${
              totalPendingAccruedSalary > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {formatCurrency(totalPendingAccruedSalary)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5">
            {pendingSalaryMonths.length > 0
              ? `${pendingSalaryMonths.length} bulan menunggu pencairan`
              : 'Tidak ada tunggakan gaji owner'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Saldo Bonus Siap Cair ({config.allocationPercents.bonus}%)</p>
            {bucketStats.bonus.balance > 0 && (
              <button
                type="button"
                onClick={openBonusPayoutModal}
                className="text-[11px] font-semibold text-pink-600 hover:underline whitespace-nowrap"
              >
                Cairkan
              </button>
            )}
          </div>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${bucketStats.bonus.balance > 0 ? 'text-pink-700' : 'text-slate-900'}`}>
            {formatCurrency(bucketStats.bonus.balance)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            Batas kas aman: {formatCurrency(Math.max(0, safeCashForBonus))}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Total Kas Toko Riil Saat Ini</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatCurrency(cashSnapshot.totalStoreLiquidCash)}
          </p>
          <p className="text-xs text-slate-500 mt-1.5 truncate tabular-nums">
            Laci {formatCurrency(cashSnapshot.cashDrawerBalance)} · Bank {formatCurrency(cashSnapshot.totalBankBalance)}
          </p>
        </div>
      </div>

      {/* Paket 3: Ringkasan Total Uang Diterima Owner (Gaji + Bonus + Prive) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ringkasan Total Uang Diterima Owner ({reportPeriodInfo.label})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Akumulasi seluruh dana riil yang diterima Owner (Gaji Rutin + Bonus Laba + Prive Darurat) sekaligus siap cetak PDF &amp; Export Excel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all_time', label: 'Semua Periode' },
                  { id: 'selected_month', label: 'Bulan Dipilih' },
                  { id: 'selected_year', label: `Tahun ${selectedYear}` },
                  { id: 'custom_range', label: 'Rentang Tanggal' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setReportScope(opt.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    reportScope === opt.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {reportScope === 'custom_range' && (
              <div className="flex items-center gap-1.5 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <p className="text-xs font-medium text-slate-500">Gaji Bulanan Diterima</p>
            <p className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
              {formatCurrency(ownerIntakeSummary.salaryPaid)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Masuk beban operasional Laba Rugi</p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <p className="text-xs font-medium text-slate-500">Bonus Laba Dicairkan</p>
            <p className="text-xl font-bold text-pink-700 mt-1 tabular-nums">
              {formatCurrency(ownerIntakeSummary.bonusPaid)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Dari kantong bagi laba {config.allocationPercents.bonus}%</p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <p className="text-xs font-medium text-slate-500">Prive Darurat Ditarik</p>
            <p className="text-xl font-bold text-violet-700 mt-1 tabular-nums">
              {formatCurrency(ownerIntakeSummary.privePaid)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Tercatat Tarik Owner di Arus Kas</p>
          </div>
          <div className="border border-pink-200 rounded-xl p-4 bg-pink-50/40">
            <p className="text-xs font-semibold text-pink-900">Total Uang Diterima Owner</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatCurrency(ownerIntakeSummary.totalReceived)}
            </p>
            <p className="text-xs text-pink-800 mt-1 tabular-nums">
              Gaji + Bonus + Prive ({reportPeriodInfo.label})
            </p>
          </div>
        </div>

        {monthlyIntakeRows.length > 0 && (
          <div className="border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-slate-700">
                Rekapitulasi Penerimaan Owner Per Bulan ({reportPeriodInfo.label})
              </p>
              <button
                type="button"
                onClick={openPriveModal}
                className="text-xs font-semibold text-violet-700 hover:underline"
              >
                + Catat Penarikan Prive Darurat
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200 text-xs text-slate-600 text-left">
                    <th className="py-2 px-3 font-semibold">Periode Bulan</th>
                    <th className="py-2 px-3 font-semibold text-right">Gaji Dibayar</th>
                    <th className="py-2 px-3 font-semibold text-right">Bonus Dicairkan</th>
                    <th className="py-2 px-3 font-semibold text-right">Prive Darurat</th>
                    <th className="py-2 px-3 font-semibold text-right">Total Diterima</th>
                    <th className="py-2 px-3 font-semibold text-right">Sisa Gaji Terhutang</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyIntakeRows.map(row => (
                    <tr key={row.month} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedMonth(row.month)}
                          className="hover:text-pink-700 text-left"
                        >
                          {formatMonthLabel(row.month)}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-emerald-700">
                        {formatCurrency(row.salaryPaid)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-pink-700">
                        {formatCurrency(row.bonusPaid)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-violet-700">
                        {formatCurrency(row.privePaid)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">
                        {formatCurrency(row.totalReceived)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-amber-700">
                        {row.salaryAccruedUnpaid > 0 ? formatCurrency(row.salaryAccruedUnpaid) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Panel Gaji Bulanan Owner + Daftar Gaji Terhutang */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Pengelolaan Gaji Bulanan — {formatMonthLabel(selectedMonth)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pembayaran gaji otomatis tercatat di Pengeluaran Operasional (Laba Rugi) &amp; memotong saldo akun terpilih agar tidak perlu input ulang.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAccrueSalaryModal(selectedMonth)}
              className="px-3.5 py-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
            >
              Catat Sebagai Gaji Terhutang
            </button>
            <button
              type="button"
              onClick={() =>
                openPaySalaryModal(
                  selectedMonth,
                  selectedMonthSalaryStats.remaining > 0
                    ? selectedMonthSalaryStats.remaining
                    : config.monthlySalary || 0
                )
              }
              className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              {selectedMonthSalaryStats.remaining > 0 ? 'Bayar Sisa Gaji Bulan Ini' : 'Bayar Gaji / Tambahan'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Target Gaji Bulan Ini</p>
            <p className="font-bold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(selectedMonthSalaryStats.target)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Sudah Dibayar</p>
            <p className="font-bold text-emerald-700 mt-0.5 tabular-nums">{formatCurrency(selectedMonthSalaryStats.paid)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dicatat Terhutang</p>
            <p className="font-bold text-amber-700 mt-0.5 tabular-nums">{formatCurrency(selectedMonthSalaryStats.accrued)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Sisa Hak Bulan Ini</p>
            <p className={`font-bold mt-0.5 tabular-nums ${selectedMonthSalaryStats.remaining > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {formatCurrency(selectedMonthSalaryStats.remaining)}
            </p>
          </div>
        </div>

        {pendingSalaryMonths.length > 0 && (
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-amber-900 mb-2">
              Daftar Bulan dengan Gaji Owner Terhutang (Menunggu Kas / Piutang Cair)
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 text-left">
                    <th className="py-2 pr-4 font-medium">Bulan Hak</th>
                    <th className="py-2 px-3 font-medium text-right">Dicatat Terhutang</th>
                    <th className="py-2 px-3 font-medium text-right">Sudah Dicicil</th>
                    <th className="py-2 px-3 font-medium text-right">Sisa Harus Dibayar</th>
                    <th className="py-2 pl-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingSalaryMonths.map(item => (
                    <tr key={item.month} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-semibold text-slate-800">{formatMonthLabel(item.month)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{formatCurrency(item.accrued)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700">{formatCurrency(item.paid)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-amber-700">{formatCurrency(item.remaining)}</td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            openPaySalaryModal(
                              item.month,
                              item.remaining,
                              `Pelunasan Gaji Owner Terhutang (${formatMonthLabel(item.month)})`
                            )
                          }
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap shrink-0"
                        >
                          Lunasi Sekarang
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Posisi Kas Toko, Kas Titipan Owner & Filter Kas Aman */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Posisi Kas Toko &amp; Filter Kas Aman</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menjaga agar pencairan bonus tidak mengganggu tagihan pemasok atau dana darurat toko, sekaligus kontrol cepat kas titipan di tangan Owner.
            </p>
          </div>
          <button
            type="button"
            onClick={openBonusPayoutModal}
            className="px-3.5 py-2 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition-colors whitespace-nowrap shrink-0"
          >
            Cairkan Bonus Owner
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Kas Laci (Tunai Kasir)</span>
              <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(cashSnapshot.cashDrawerBalance)}</span>
            </div>
            {cashSnapshot.nonCashAccounts.map(acc => (
              <div key={acc.id} className="flex justify-between py-1">
                <span className="text-slate-600">{acc.name} · {acc.type}</span>
                <span className={`font-semibold tabular-nums ${acc.balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-2.5 -mx-2.5 rounded-lg bg-fuchsia-50/70 border border-fuchsia-100">
              <div>
                <span className="text-slate-800 font-medium">Kas Dipegang Owner (Titipan Toko)</span>
                {cashSnapshot.ownerHoldBalance > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={openOwnerHoldTransferModal}
                      className="px-2.5 py-1 bg-white border border-fuchsia-300 text-fuchsia-800 rounded-md text-[11px] font-semibold hover:bg-fuchsia-100 transition-colors"
                    >
                      Setor ke Bank / Laci Toko
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openPaySalaryModal(
                          selectedMonth,
                          selectedMonthSalaryStats.remaining > 0
                            ? Math.min(selectedMonthSalaryStats.remaining, cashSnapshot.ownerHoldBalance)
                            : Math.min(config.monthlySalary || cashSnapshot.ownerHoldBalance, cashSnapshot.ownerHoldBalance),
                          `Gaji Owner (${formatMonthLabel(selectedMonth)}) potong Kas Titipan`,
                          'Kas Dipegang Owner'
                        )
                      }
                      className="px-2.5 py-1 bg-fuchsia-700 text-white rounded-md text-[11px] font-semibold hover:bg-fuchsia-800 transition-colors"
                    >
                      Potong untuk Bayar Gaji
                    </button>
                  </div>
                )}
              </div>
              <span className="font-bold text-fuchsia-700 tabular-nums">{formatCurrency(cashSnapshot.ownerHoldBalance)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
              <span>Total Kas Toko Riil</span>
              <span className="tabular-nums">{formatCurrency(cashSnapshot.totalStoreLiquidCash)}</span>
            </div>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-slate-200 pt-3 lg:pt-0 lg:pl-6 space-y-2 text-xs">
            <p className="font-semibold text-slate-700">Perhitungan Batas Kas Aman Pencairan Bonus:</p>
            <div className="flex justify-between text-slate-600">
              <span>(-) Hutang Pemasok Jatuh Tempo (&le; 14 hari)</span>
              <span className="font-semibold text-rose-700 tabular-nums">{formatCurrency(cashSnapshot.dueSoonSupplierBills)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>(-) Saldo Buffer Kewajiban &amp; Kas</span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(Math.max(0, bucketStats.buffer.balance))}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm">
              <span className="text-slate-800">Batas Kas Aman untuk Bonus</span>
              <span className={`tabular-nums ${safeCashForBonus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(safeCashForBonus)}
              </span>
            </div>
            <div className="pt-2 space-y-1 text-slate-500 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Total Semua Hutang Pemasok Belum Lunas</span>
                <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(cashSnapshot.unpaidSupplierBills)}</span>
              </div>
              <div className="flex justify-between">
                <span>Sisa Pokok Cicilan Bank Aktif</span>
                <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(cashSnapshot.activeBankLoans)}</span>
              </div>
              <div className="flex justify-between">
                <span>Piutang Pelanggan Belum Cair (Tempo)</span>
                <span className="font-medium text-emerald-700 tabular-nums">{formatCurrency(cashSnapshot.unpaidCustomerReceivables)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      )}

      {/* TAB 2: TUTUP BUKU & POS ALOKASI */}
      {accessibleTabs.length > 0 && activeTab === 'closing' && (
        <div className="space-y-6">
          {/* Saldo 4 Kantong Alokasi Laba */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Saldo 4 Kantong Alokasi Laba</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bertambah otomatis setiap kali Anda mengunci Tutup Buku Bulanan dan berkurang saat Bonus dicairkan atau Pos dipakai.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600 tabular-nums">
                {sortedClosings.length} bulan sudah tutup buku
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* 1. Cadangan Usaha */}
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/40">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Cadangan Usaha</p>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{config.allocationPercents.reserve}%</span>
                  </div>
                  <p className={`text-xl font-bold mt-1.5 tabular-nums ${bucketStats.reserve.balance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                    {formatCurrency(bucketStats.reserve.balance)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500 tabular-nums">
                    <div className="flex justify-between">
                      <span>Total Dialokasikan</span>
                      <span className="text-slate-700 font-medium">{formatCurrency(bucketStats.reserve.inflow)}</span>
                    </div>
                    {bucketStats.reserve.absorbedLoss > 0 && (
                      <div className="flex justify-between">
                        <span>Serap Rugi Bulanan</span>
                        <span className="text-rose-600 font-medium">- {formatCurrency(bucketStats.reserve.absorbedLoss)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Sudah Dipakai</span>
                      <span className="text-slate-700 font-medium">- {formatCurrency(bucketStats.reserve.used)}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUseBucketModal('reserve')}
                  className="w-full py-2 px-3 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Pakai Pos Cadangan
                </button>
              </div>

              {/* 2. Investasi Mesin */}
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/40">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Investasi Mesin</p>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{config.allocationPercents.equipment}%</span>
                  </div>
                  <p className={`text-xl font-bold mt-1.5 tabular-nums ${bucketStats.equipment.balance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                    {formatCurrency(bucketStats.equipment.balance)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500 tabular-nums">
                    <div className="flex justify-between">
                      <span>Total Dialokasikan</span>
                      <span className="text-slate-700 font-medium">{formatCurrency(bucketStats.equipment.inflow)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sudah Dipakai</span>
                      <span className="text-slate-700 font-medium">- {formatCurrency(bucketStats.equipment.used)}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUseBucketModal('equipment')}
                  className="w-full py-2 px-3 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Catat Belanja Mesin
                </button>
              </div>

              {/* 3. Bonus Owner */}
              <div className="border border-pink-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-pink-50/30">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-pink-800">Bonus Owner</p>
                    <span className="text-xs font-bold text-pink-700 tabular-nums">{config.allocationPercents.bonus}%</span>
                  </div>
                  <p className={`text-xl font-bold mt-1.5 tabular-nums ${bucketStats.bonus.balance >= 0 ? 'text-pink-700' : 'text-rose-700'}`}>
                    {formatCurrency(bucketStats.bonus.balance)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600 tabular-nums">
                    <div className="flex justify-between">
                      <span>Total Hak Bonus</span>
                      <span className="text-slate-800 font-medium">{formatCurrency(bucketStats.bonus.inflow)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sudah Dicairkan</span>
                      <span className="text-slate-800 font-medium">- {formatCurrency(bucketStats.bonus.used)}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openBonusPayoutModal}
                  className="w-full py-2 px-3 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition-colors"
                >
                  Cairkan Bonus Owner
                </button>
              </div>

              {/* 4. Buffer Kewajiban & Kas */}
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/40">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">Buffer Kewajiban &amp; Kas</p>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{config.allocationPercents.buffer}%</span>
                  </div>
                  <p className={`text-xl font-bold mt-1.5 tabular-nums ${bucketStats.buffer.balance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                    {formatCurrency(bucketStats.buffer.balance)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500 tabular-nums">
                    <div className="flex justify-between">
                      <span>Total Dialokasikan</span>
                      <span className="text-slate-700 font-medium">{formatCurrency(bucketStats.buffer.inflow)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sudah Dipakai</span>
                      <span className="text-slate-700 font-medium">- {formatCurrency(bucketStats.buffer.used)}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUseBucketModal('buffer')}
                  className="w-full py-2 px-3 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Pakai Pos Buffer
                </button>
              </div>
            </div>
          </div>

          {/* Panel Tutup Buku Bulanan & Bagi Laba */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
            {existingClosingForSelectedMonth ? (
              <>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0" />
                        Tutup Buku {formatMonthLabel(selectedMonth)} (Terkunci)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ditutup tgl {new Date(existingClosingForSelectedMonth.closedAt).toLocaleDateString('id-ID')}
                        {existingClosingForSelectedMonth.closedBy ? ` oleh ${existingClosingForSelectedMonth.closedBy}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Buka kembali & hapus Tutup Buku ${formatMonthLabel(
                              selectedMonth
                            )}? Alokasi laba bulan ini akan ditarik dari 4 kantong agar Anda bisa menghitung ulang.`
                          )
                        ) {
                          onDeleteMonthlyClosing(existingClosingForSelectedMonth.id);
                        }
                      }}
                      className="px-3 py-1.5 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-xs font-semibold hover:bg-rose-100 whitespace-nowrap"
                    >
                      Buka Kembali / Hapus
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Omzet Akrual (Terkunci)</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        + {formatCurrency(existingClosingForSelectedMonth.accrualSales)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Total Beban Akrual &amp; Gaji (Terkunci)</span>
                      <span className="font-semibold text-rose-700 tabular-nums">
                        - {formatCurrency(existingClosingForSelectedMonth.totalAccrualCosts)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 font-semibold border-t border-slate-100 pt-2">
                      <span className="text-slate-700">Laba/Rugi Kinerja Bulan Ini</span>
                      <span
                        className={`tabular-nums ${
                          existingClosingForSelectedMonth.rawProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatCurrency(existingClosingForSelectedMonth.rawProfit)}
                      </span>
                    </div>
                    {existingClosingForSelectedMonth.priorLossApplied > 0 && (
                      <div className="flex justify-between py-1 text-xs text-amber-800">
                        <span>Potongan Penutup Rugi Bulan Sebelumnya</span>
                        <span className="font-semibold tabular-nums">
                          - {formatCurrency(existingClosingForSelectedMonth.priorLossApplied)}
                        </span>
                      </div>
                    )}
                    {existingClosingForSelectedMonth.absorbedFromReserve > 0 && (
                      <div className="flex justify-between py-1 text-xs text-rose-700">
                        <span>Rugi Diserap dari Pos Cadangan Usaha</span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(existingClosingForSelectedMonth.absorbedFromReserve)}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                      <span>Laba Bersih Dibagi</span>
                      <span className="tabular-nums text-emerald-700">
                        {formatCurrency(existingClosingForSelectedMonth.distributableProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Arus Kas Riil Bulan Ini (Pembanding)</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(existingClosingForSelectedMonth.cashNetInMonth)}
                      </span>
                    </div>
                    {existingClosingForSelectedMonth.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-2">
                        Catatan: {existingClosingForSelectedMonth.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
                  <p className="font-semibold text-slate-700">
                    Porsi Masuk ke 4 Kantong ({existingClosingForSelectedMonth.percents.reserve}/{existingClosingForSelectedMonth.percents.equipment}/{existingClosingForSelectedMonth.percents.bonus}/{existingClosingForSelectedMonth.percents.buffer}%):
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-slate-600">
                    <div className="flex justify-between">
                      <span>Cadangan Usaha</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(existingClosingForSelectedMonth.allocations.reserve)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Investasi Mesin</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(existingClosingForSelectedMonth.allocations.equipment)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bonus Owner</span>
                      <span className="font-semibold text-pink-700 tabular-nums">
                        {formatCurrency(existingClosingForSelectedMonth.allocations.bonus)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Buffer Kewajiban</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(existingClosingForSelectedMonth.allocations.buffer)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <h3 className="text-base font-bold text-slate-900">
                      Tutup Buku {formatMonthLabel(selectedMonth)} (Belum Dikunci)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Menghitung laba kinerja basis nota (lunas &amp; tempo) lalu membagi ke 4 kantong alokasi saat Anda klik Tutup Buku.
                    </p>
                  </div>

                  {/* Checklist Validasi Pra-Tutup Buku */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800">Checklist Validasi Pra-Tutup Buku</p>
                      <span className="text-[11px] font-medium text-slate-500">
                        {preClosingChecklist.filter(i => i.status === 'warn').length > 0
                          ? `${preClosingChecklist.filter(i => i.status === 'warn').length} hal perlu dicek`
                          : 'Siap ditutup buku'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {preClosingChecklist.map(chk => (
                        <div
                          key={chk.id}
                          className={`rounded-lg border p-2.5 text-xs flex items-start justify-between gap-2 ${
                            chk.status === 'warn'
                              ? 'bg-amber-50 border-amber-200 text-amber-900'
                              : chk.status === 'ok'
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            {chk.status === 'warn' ? (
                              <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <CheckCircleIcon
                                className={`h-4 w-4 shrink-0 mt-0.5 ${
                                  chk.status === 'ok' ? 'text-emerald-600' : 'text-slate-400'
                                }`}
                              />
                            )}
                            <div>
                              <p className="font-semibold leading-snug">{chk.title}</p>
                              <p className="text-[11px] opacity-85 mt-0.5 leading-snug">{chk.detail}</p>
                            </div>
                          </div>
                          {chk.action === 'pay_salary' && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openPaySalaryModal(selectedMonth, config.monthlySalary || 0)}
                                className="px-2 py-1 bg-pink-600 text-white rounded text-[11px] font-semibold hover:bg-pink-700 whitespace-nowrap"
                              >
                                Bayar
                              </button>
                              <button
                                type="button"
                                onClick={() => openAccrueSalaryModal(selectedMonth)}
                                className="px-2 py-1 bg-white border border-amber-300 text-amber-800 rounded text-[11px] font-semibold hover:bg-amber-100 whitespace-nowrap"
                              >
                                Terhutang
                              </button>
                            </div>
                          )}
                          {chk.action === 'select_prev_month' && chk.prevMonth && (
                            <button
                              type="button"
                              onClick={() => setSelectedMonth(chk.prevMonth!)}
                              className="px-2 py-1 bg-white border border-amber-300 text-amber-800 rounded text-[11px] font-semibold hover:bg-amber-100 whitespace-nowrap shrink-0"
                            >
                              Buka {formatMonthLabel(chk.prevMonth)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {config.startPeriod && selectedMonth < config.startPeriod && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600">
                      Catatan: Periode ini lebih awal dari tanggal mulai pembukuan Owner ({formatMonthLabel(config.startPeriod)}).
                    </div>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Omzet Order Bulan Ini (Lunas + Tempo)</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        + {formatCurrency(selectedMonthPerformance.accrualSales)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Pembelian Bahan Lunas + Faktur Tempo Bulan Ini</span>
                      <span className="font-semibold text-rose-700 tabular-nums">
                        - {formatCurrency(selectedMonthPerformance.lunasMaterialPurchases + selectedMonthPerformance.creditSupplierInvoices)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Biaya Operasional Lain + Bunga Bank</span>
                      <span className="font-semibold text-rose-700 tabular-nums">
                        - {formatCurrency(selectedMonthPerformance.otherOperationalExpenses + selectedMonthPerformance.bankInterestInMonth)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Gaji Owner Diakui Bulan Ini</span>
                      <span className="font-semibold text-rose-700 tabular-nums">
                        - {formatCurrency(
                          selectedMonthPerformance.ownerSalaryPaidInExpenses + selectedMonthPerformance.ownerSalaryUnpaidAccrued
                        )}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
                      <span>Laba/Rugi Kinerja Bulan Ini</span>
                      <span className={`tabular-nums ${closingPlan.rawProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(closingPlan.rawProfit)}
                      </span>
                    </div>

                    {closingPlan.priorLossApplied > 0 && (
                      <div className="flex justify-between text-xs text-amber-800">
                        <span>(-) Penutup Rugi Bulan Sebelumnya (Carry-forward)</span>
                        <span className="font-semibold tabular-nums">- {formatCurrency(closingPlan.priorLossApplied)}</span>
                      </div>
                    )}

                    {closingPlan.rawProfit < 0 && (
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800">
                        Bulan ini minus {formatCurrency(Math.abs(closingPlan.rawProfit))}. Kebijakan aktif:{' '}
                        <strong>
                          {closingPlan.lossHandledMode === 'absorb_reserve'
                            ? 'Diserap dari Pos Cadangan Usaha'
                            : 'Dibawa sebagai pengurang laba bulan berikutnya'}
                        </strong>
                        . Pembagian bonus bulan ini Rp 0.
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                      <span>Laba Bersih Boleh Dibagi</span>
                      <span className={`tabular-nums ${closingPlan.distributableProfit > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {formatCurrency(closingPlan.distributableProfit)}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Pembanding Arus Kas Riil Bulan Ini (Uang Masuk − Keluar)</span>
                      <span className={`font-semibold tabular-nums ${selectedMonthPerformance.cashNetInMonth >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>
                        {formatCurrency(selectedMonthPerformance.cashNetInMonth)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600">
                    <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <span>Cadangan ({config.allocationPercents.reserve}%)</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(closingPlan.allocations.reserve)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <span>Mesin ({config.allocationPercents.equipment}%)</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(closingPlan.allocations.equipment)}</span>
                    </div>
                    <div className="flex justify-between bg-pink-50/50 rounded-lg px-3 py-2 border border-pink-200">
                      <span>Bonus ({config.allocationPercents.bonus}%)</span>
                      <span className="font-semibold text-pink-700 tabular-nums">{formatCurrency(closingPlan.allocations.bonus)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      <span>Buffer ({config.allocationPercents.buffer}%)</span>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(closingPlan.allocations.buffer)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <input
                      type="text"
                      value={closingNotes}
                      onChange={e => setClosingNotes(e.target.value)}
                      placeholder="Catatan tutup buku (opsional)..."
                      className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-700"
                    />
                    <button
                      type="button"
                      disabled={isClosingMonth}
                      onClick={handleCloseMonthAction}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isClosingMonth ? 'Mengunci...' : 'Tutup Buku & Kunci Alokasi'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Riwayat Tutup Buku Bulanan */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Arsip Tutup Buku Bulanan</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Snapshot kinerja akrual &amp; distribusi 4 pos alokasi yang sudah dikunci per bulan.
                </p>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">{sortedClosings.length} periode tercatat</span>
            </div>

            {sortedClosings.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl py-8 px-4 text-center space-y-1.5">
                <p className="text-sm font-semibold text-slate-700">Belum ada bulan yang ditutup buku</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Pilih bulan yang sudah selesai di bagian atas lalu klik <strong>Tutup Buku &amp; Kunci Alokasi</strong> untuk mengisi saldo 4 kantong alokasi.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200 text-xs text-slate-600 text-left">
                      <th className="py-2.5 px-3 font-semibold">Periode</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Omzet Akrual</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Laba Kinerja</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Laba Dibagi</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Cadangan</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Mesin</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Bonus</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Buffer</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedClosings.map(c => (
                      <tr key={c.id} className={`hover:bg-slate-50 ${c.month === selectedMonth ? 'bg-pink-50/30' : ''}`}>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedMonth(c.month)}
                            className="font-semibold text-slate-800 hover:text-pink-700 text-left"
                          >
                            {formatMonthLabel(c.month)}
                          </button>
                          {c.priorLossApplied > 0 && (
                            <p className="text-[11px] text-amber-700 tabular-nums">Tutup rugi -{formatCurrency(c.priorLossApplied)}</p>
                          )}
                          {c.absorbedFromReserve > 0 && (
                            <p className="text-[11px] text-rose-700 tabular-nums">Serap cadangan {formatCurrency(c.absorbedFromReserve)}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-700">
                          {formatCurrency(c.accrualSales)}
                        </td>
                        <td className={`py-2.5 px-3 text-right whitespace-nowrap font-semibold tabular-nums ${c.rawProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {formatCurrency(c.rawProfit)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold tabular-nums text-slate-900">
                          {formatCurrency(c.distributableProfit)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-700">
                          {formatCurrency(c.allocations.reserve)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-700">
                          {formatCurrency(c.allocations.equipment)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold tabular-nums text-pink-700">
                          {formatCurrency(c.allocations.bonus)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-700">
                          {formatCurrency(c.allocations.buffer)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus tutup buku ${formatMonthLabel(c.month)}? Saldo 4 kantong akan menyesuaikan.`)) {
                                onDeleteMonthlyClosing(c.id);
                              }
                            }}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"
                            title="Buka Kembali / Hapus Tutup Buku"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ASET, MODAL & HUTANG */}
      {accessibleTabs.length > 0 && activeTab === 'assetsDebts' && (
        <OwnerAssetsDebtsPanel
          assets={assets}
          debts={debts}
          bankInstallments={bankInstallments}
          supplierBills={supplierBills}
          suppliers={suppliers}
          paymentMethods={paymentMethods}
          cashSnapshot={cashSnapshot}
          cashTransfers={cashTransfers}
          legacyReceivables={legacyReceivables}
          ownerTransactions={transactions}
          ownerMonthlyClosings={monthlyClosings}
          ownerName={config.ownerName}
          onAddCashTransfer={onAddCashTransfer}
          onAddAsset={onAddAsset}
          onUpdateAsset={onUpdateAsset}
          onDeleteAsset={onDeleteAsset}
          onAddDebt={onAddDebt}
          onUpdateDebt={onUpdateDebt}
          onDeleteDebt={onDeleteDebt}
        />
      )}

      {/* TAB 4: RIWAYAT TRANSAKSI OWNER */}
      {accessibleTabs.length > 0 && activeTab === 'transactions' && (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Riwayat Transaksi Owner &amp; Pemakaian Pos</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menghapus transaksi akan otomatis menyinkronkan Pengeluaran Operasional atau Mutasi Arus Kas terkait.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Semua' },
                  { id: 'salary_paid', label: 'Gaji Dibayar' },
                  { id: 'salary_accrual', label: 'Gaji Terhutang' },
                  { id: 'bonus_payout', label: 'Pencairan Bonus' },
                  { id: 'prive', label: 'Prive Darurat' },
                  { id: 'reserve_usage', label: 'Pakai Pos' },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxTypeFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    txTypeFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari bulan / pos / catatan..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 w-52 focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl py-10 px-4 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">Belum ada transaksi yang sesuai filter</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Catat gaji bulanan, cairkan bonus dari hasil tutup buku, atau catat pemakaian pos cadangan &amp; investasi mesin.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-xs text-slate-600 text-left">
                  <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                  <th className="py-2.5 px-3 font-semibold">Periode</th>
                  <th className="py-2.5 px-3 font-semibold">Jenis Transaksi</th>
                  <th className="py-2.5 px-3 font-semibold">Sumber Dana &amp; Keterangan</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Nominal</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTransactions.map(tx => {
                  const sourceMeta =
                    tx.type === 'salary_accrual'
                      ? 'Belum memotong kas (Menunggu piutang cair)'
                      : tx.type === 'reserve_usage' && !tx.linkedExpenseId
                      ? 'Hanya memotong saldo pos alokasi (tanpa pengeluaran operasional baru)'
                      : [tx.fundingSource, tx.fundingAccountName].filter(Boolean).join(' · ') || '-';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 tabular-nums">
                        {new Date(tx.date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                        {formatMonthLabel(tx.month)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold text-xs ${
                            tx.type === 'salary_paid'
                              ? 'text-emerald-700'
                              : tx.type === 'salary_accrual'
                              ? 'text-amber-700'
                              : tx.type === 'bonus_payout'
                              ? 'text-pink-700'
                              : tx.type === 'prive'
                              ? 'text-violet-700'
                              : tx.type === 'reserve_usage'
                              ? 'text-indigo-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {getTxTypeLabel(tx)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="text-xs font-medium text-slate-700">{sourceMeta}</p>
                        {tx.notes && <p className="text-xs text-slate-500 mt-0.5">{tx.notes}</p>}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap tabular-nums ${
                          tx.type === 'salary_accrual' ? 'text-amber-700' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            const msg = tx.linkedExpenseId
                              ? 'Hapus transaksi ini? Pengeluaran Operasional terkait di menu Pengeluaran juga akan ikut dihapus otomatis.'
                              : tx.linkedTransferId
                              ? 'Hapus pencairan bonus ini? Catatan Tarik Owner di Arus Kas juga akan ikut dihapus agar saldo akun kembali.'
                              : 'Hapus catatan transaksi Owner ini?';
                            if (window.confirm(msg)) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"
                          title="Hapus / Batalkan"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* MODAL: PENGATURAN OWNER */}
      {isConfigModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Pengaturan Owner Dashboard</h3>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveConfigSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Nama Owner</label>
                  <input
                    type="text"
                    value={cfgOwnerName}
                    onChange={e => setCfgOwnerName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Rutin Gaji (1-28)</label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={cfgSalaryPayDay}
                    onChange={e => setCfgSalaryPayDay(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Gaji Pokok Bulanan Owner (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={cfgMonthlySalary}
                  onChange={e => setCfgMonthlySalary(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold tabular-nums"
                  placeholder="Contoh: 5000000"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Masuk sebagai biaya operasional pengelola di Laba Rugi sebelum perhitungan bagi hasil.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Persentase Alokasi Laba Bersih (Total harus 100%)
                  </label>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      Math.abs(pctSumPreview - 100) <= 0.01 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    Total: {pctSumPreview}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600">Cadangan Usaha (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={cfgReservePct}
                      onChange={e => setCfgReservePct(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600">Investasi Mesin (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={cfgEquipmentPct}
                      onChange={e => setCfgEquipmentPct(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600">Bonus Owner (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={cfgBonusPct}
                      onChange={e => setCfgBonusPct(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600">Buffer Kewajiban &amp; Kas (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={cfgBufferPct}
                      onChange={e => setCfgBufferPct(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Kebijakan Jika Bulan Rugi</label>
                  <select
                    value={cfgLossMode}
                    onChange={e => setCfgLossMode(e.target.value as 'carry_forward' | 'absorb_reserve')}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="carry_forward">Tutup Rugi ke Laba Bulan Depan</option>
                    <option value="absorb_reserve">Serap dari Cadangan Usaha</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Mulai Pembukuan (Opsional)</label>
                  <input
                    type="month"
                    value={cfgStartPeriod}
                    onChange={e => setCfgStartPeriod(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BAYAR GAJI OWNER */}
      {isPayModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsPayModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Bayar Gaji Bulanan Owner</h3>
                <p className="text-xs text-slate-500">
                  Otomatis mencatat Pengeluaran Operasional (kategori Gaji Owner).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handlePaySalarySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Untuk Bulan Hak</label>
                  <input
                    type="month"
                    value={payMonth}
                    onChange={e => setPayMonth(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Bayar</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nominal Dibayar (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Sumber Dana</label>
                <select
                  value={payFunding}
                  onChange={e => setPayFunding(e.target.value as ExpenseFundingSource)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Transfer Bank">Transfer Bank / Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Saldo {formatCurrency(cashSnapshot.cashDrawerBalance)}</option>
                  <option value="Kas Dipegang Owner">
                    Kas Dipegang Owner (Titipan Toko) — Saldo {formatCurrency(cashSnapshot.ownerHoldBalance)}
                  </option>
                </select>
              </div>

              {payFunding === 'Transfer Bank' && cashSnapshot.nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={payAccountId}
                    onChange={e => setPayAccountId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-lg text-sm"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {cashSnapshot.nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type}) — {formatCurrency(acc.balance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {Number(payAmount || 0) > selectedPayFundingAvailable && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                  Nominal melebihi saldo sistem sumber dana terpilih ({formatCurrency(selectedPayFundingAvailable)}). Pertimbangkan memakai <strong>Catat Sebagai Gaji Terhutang</strong> jika kas masih tertahan piutang tempo.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Catatan</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Gaji Bulanan / Cicilan Gaji"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmittingPay ? 'Menyimpan...' : 'Simpan & Bayar Gaji'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CATAT GAJI TERHUTANG */}
      {isAccrueModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsAccrueModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Catat Gaji Terhutang (Pending)</h3>
                <p className="text-xs text-slate-500">
                  Mengakui hak gaji bulan ini tanpa memotong saldo Kas Laci atau Bank dulu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccrueModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAccrueSalarySubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Untuk Bulan Hak</label>
                  <input
                    type="month"
                    value={accrueMonth}
                    onChange={e => setAccrueMonth(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Dicatat</label>
                  <input
                    type="date"
                    value={accrueDate}
                    onChange={e => setAccrueDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nominal Hak Gaji Terhutang (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={accrueAmount}
                  onChange={e => setAccrueAmount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Catatan</label>
                <input
                  type="text"
                  value={accrueNotes}
                  onChange={e => setAccrueNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Ditunda menunggu piutang tempo cair"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAccrueModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAccrue}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                >
                  {isSubmittingAccrue ? 'Menyimpan...' : 'Simpan Gaji Terhutang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAIRKAN BONUS OWNER */}
      {isBonusModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsBonusModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cairkan Bonus Owner</h3>
                <p className="text-xs text-slate-500">
                  Dicatat sebagai Tarik Owner di Arus Kas (bukan beban operasional Laba Rugi).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBonusModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 space-y-1.5 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">Saldo Pos Bonus Owner Tersedia:</span>
                <span className="font-bold text-pink-700">{formatCurrency(bucketStats.bonus.balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Batas Kas Aman (Kas Riil − Hutang &le;14h − Buffer):</span>
                <span className={`font-bold ${safeCashForBonus > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(safeCashForBonus)}
                </span>
              </div>
            </div>

            <form onSubmit={handleBonusSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Periode Pencairan</label>
                  <input
                    type="month"
                    value={bonusMonth}
                    onChange={e => setBonusMonth(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Cair</label>
                  <input
                    type="date"
                    value={bonusDate}
                    onChange={e => setBonusDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Nominal Bonus Dicairkan (Rp)</label>
                  {safeCashForBonus > 0 && bucketStats.bonus.balance > safeCashForBonus && (
                    <button
                      type="button"
                      onClick={() => {
                        setBonusAmount(String(Math.floor(safeCashForBonus)));
                        setBonusGuardrailOverride(false);
                      }}
                      className="text-xs font-semibold text-pink-600 hover:underline"
                    >
                      Sesuaikan ke Kas Aman ({formatCurrency(safeCashForBonus)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  value={bonusAmount}
                  onChange={e => {
                    setBonusAmount(e.target.value);
                    setBonusGuardrailOverride(false);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Sumber Dana</label>
                <select
                  value={bonusFunding}
                  onChange={e => {
                    setBonusFunding(e.target.value as ExpenseFundingSource);
                    setBonusGuardrailOverride(false);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Transfer Bank">Transfer Bank / Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Saldo {formatCurrency(cashSnapshot.cashDrawerBalance)}</option>
                  <option value="Kas Dipegang Owner">
                    Kas Dipegang Owner (Titipan Toko) — Saldo {formatCurrency(cashSnapshot.ownerHoldBalance)}
                  </option>
                </select>
              </div>

              {bonusFunding === 'Transfer Bank' && cashSnapshot.nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={bonusAccountId}
                    onChange={e => {
                      setBonusAccountId(e.target.value);
                      setBonusGuardrailOverride(false);
                    }}
                    className="mt-1 w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-lg text-sm"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {cashSnapshot.nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type}) — {formatCurrency(acc.balance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {hasBonusGuardrailWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-xs text-amber-900">
                  <p className="font-semibold">Peringatan Filter Kas Aman:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {bonusExceedsBalance && (
                      <li>
                        Nominal melebihi Saldo Pos Bonus tersedia ({formatCurrency(Math.max(0, bucketStats.bonus.balance))}).
                      </li>
                    )}
                    {bonusExceedsSafeCash && (
                      <li>
                        Nominal melebihi Batas Kas Aman ({formatCurrency(Math.max(0, safeCashForBonus))}) setelah menyisihkan hutang jatuh tempo &amp; buffer.
                      </li>
                    )}
                    {bonusExceedsAccount && (
                      <li>
                        Nominal melebihi saldo akun terpilih ({formatCurrency(selectedBonusFundingAvailable)}).
                      </li>
                    )}
                  </ul>
                  <label className="flex items-start gap-2 pt-1 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bonusGuardrailOverride}
                      onChange={e => setBonusGuardrailOverride(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-pink-600 focus:ring-pink-500"
                    />
                    <span>Saya paham risikonya dan tetap ingin mencairkan bonus sebesar ini.</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Catatan</label>
                <input
                  type="text"
                  value={bonusNotes}
                  onChange={e => setBonusNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Pencairan Bonus Owner"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBonusModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBonus}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50"
                >
                  {isSubmittingBonus ? 'Menyimpan...' : 'Cairkan Bonus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAKAI POS ALOKASI (CADANGAN / INVESTASI MESIN / BUFFER) */}
      {isUseBucketModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsUseBucketModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Catat Pemakaian Pos Alokasi</h3>
                <p className="text-xs text-slate-500">
                  Gunakan dana Cadangan Usaha, Investasi Mesin, atau Buffer Kewajiban.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUseBucketModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUseBucketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Pilih Pos Alokasi</label>
                <select
                  value={useBucket}
                  onChange={e => {
                    const nextB = e.target.value as Exclude<OwnerAllocationBucket, 'bonus'>;
                    setUseBucket(nextB);
                    setUseExpenseCategory(DEFAULT_CATEGORY_BY_BUCKET[nextB]);
                    setUseAddFixedAsset(nextB === 'equipment');
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="reserve">
                    Cadangan Usaha — Sisa {formatCurrency(bucketStats.reserve.balance)}
                  </option>
                  <option value="equipment">
                    Investasi / Pengembangan Mesin — Sisa {formatCurrency(bucketStats.equipment.balance)}
                  </option>
                  <option value="buffer">
                    Buffer Kewajiban &amp; Kas — Sisa {formatCurrency(bucketStats.buffer.balance)}
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Periode Bulan</label>
                  <input
                    type="month"
                    value={useMonth}
                    onChange={e => setUseMonth(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Pakai</label>
                  <input
                    type="date"
                    value={useDate}
                    onChange={e => setUseDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Nominal Dipakai (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={useAmount}
                  onChange={e => setUseAmount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  placeholder="0"
                  required
                />
                {Number(useAmount || 0) > Math.max(0, bucketStats[useBucket].balance) && (
                  <p className="text-xs text-amber-700 mt-1">
                    Nominal melebihi sisa saldo pos {BUCKET_LABELS[useBucket]} saat ini ({formatCurrency(bucketStats[useBucket].balance)}). Saldo pos akan menjadi minus.
                  </p>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <label className="flex items-start gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useRecordExpense}
                    onChange={e => setUseRecordExpense(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                  />
                  <span>Catat juga sebagai Pengeluaran Operasional &amp; potong kas toko</span>
                </label>
                <p className="text-xs text-slate-500 pl-5">
                  {useRecordExpense
                    ? useBucket === 'equipment'
                      ? 'Centang jika pembelian mesin/peralatan baru belum diinput di Pengeluaran. (Catatan: jika ingin mesin hanya tercatat sebagai Aset Tetap tanpa membebani Laba Rugi 1 bulan penuh, Anda dapat tidak mencentang opsi ini dan mencatat kas keluarnya di Aset Tetap/Arus Kas).'
                      : 'Centang jika ini pembelian/biaya baru yang belum dicatat di menu Pengeluaran atau Barang Masuk.'
                    : 'Tidak dicentang: hanya memotong saldo kantong virtual (aman agar tidak double hitung jika sudah diinput di menu Pengeluaran/Barang Masuk).'}
                </p>
              </div>

              {useBucket === 'equipment' && (
                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-2">
                  <label className="flex items-start gap-2 text-xs font-semibold text-sky-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAddFixedAsset}
                      onChange={e => setUseAddFixedAsset(e.target.checked)}
                      className="mt-0.5 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span>Otomatis tambahkan ke Daftar Aset Tetap (Tab Aset, Modal &amp; Hutang)</span>
                  </label>
                  {useAddFixedAsset && (
                    <div className="pl-5">
                      <label className="block text-[11px] font-semibold text-sky-900">Nama Aset Mesin / Peralatan</label>
                      <input
                        type="text"
                        value={useAssetName}
                        onChange={e => setUseAssetName(e.target.value)}
                        placeholder={useExpenseName.trim() || 'Contoh: Mesin Cutting Roland / Printer Epson'}
                        className="mt-1 w-full px-3 py-1.5 border border-sky-300 bg-white rounded-lg text-xs"
                      />
                      <p className="text-[11px] text-sky-800 mt-1">
                        Jika dikosongkan, nama aset akan otomatis mengikuti Nama Pengeluaran atau Catatan Pemakaian.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {useRecordExpense && (
                <div className="space-y-3 border-t border-slate-200 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Nama Pengeluaran</label>
                      <input
                        type="text"
                        value={useExpenseName}
                        onChange={e => setUseExpenseName(e.target.value)}
                        placeholder="Contoh: Beli Mesin Cutting Baru"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required={useRecordExpense}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Kategori Pengeluaran</label>
                      <input
                        type="text"
                        value={useExpenseCategory}
                        onChange={e => setUseExpenseCategory(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Sumber Dana</label>
                    <select
                      value={useFunding}
                      onChange={e => setUseFunding(e.target.value as ExpenseFundingSource)}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    >
                      <option value="Transfer Bank">Transfer Bank / Rekening Usaha</option>
                      <option value="Kas Laci">Kas Laci (Tunai) — Saldo {formatCurrency(cashSnapshot.cashDrawerBalance)}</option>
                      <option value="Kas Dipegang Owner">
                        Kas Dipegang Owner (Titipan Toko) — Saldo {formatCurrency(cashSnapshot.ownerHoldBalance)}
                      </option>
                    </select>
                  </div>

                  {useFunding === 'Transfer Bank' && cashSnapshot.nonCashAccounts.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Pilih Rekening / Dompet Non-Tunai</label>
                      <select
                        value={useAccountId}
                        onChange={e => setUseAccountId(e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-lg text-sm"
                      >
                        <option value="">-- Rekening Usaha (Umum) --</option>
                        {cashSnapshot.nonCashAccounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.type}) — {formatCurrency(acc.balance)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {Number(useAmount || 0) > selectedUseFundingAvailable && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900">
                      Nominal melebihi saldo sistem sumber dana terpilih ({formatCurrency(selectedUseFundingAvailable)}).
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Catatan Pemakaian</label>
                <input
                  type="text"
                  value={useNotes}
                  onChange={e => setUseNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Keterangan pemakaian pos alokasi"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsUseBucketModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUseBucket}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmittingUseBucket ? 'Menyimpan...' : 'Simpan Pemakaian Pos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PENARIKAN PRIVE DARURAT (PAKET 3) */}
      {isPriveModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsPriveModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Catat Penarikan Prive Darurat</h3>
                <p className="text-xs text-slate-500">
                  Dicatat sebagai Tarik Owner di Arus Kas, TIDAK mengganggu Laba Rugi usaha &amp; alokasi 40/20/20/20.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPriveModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>

            {(bucketStats.bonus.balance > 0 || totalPendingAccruedSalary > 0) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-slate-700 space-y-1 tabular-nums">
                <p className="font-semibold text-slate-900">Pengingat Hak Tersedia Sebelum Tarik Prive:</p>
                {bucketStats.bonus.balance > 0 && (
                  <p>
                    • Bonus Siap Cair: <strong className="text-pink-700">{formatCurrency(bucketStats.bonus.balance)}</strong>
                  </p>
                )}
                {totalPendingAccruedSalary > 0 && (
                  <p>
                    • Gaji Terhutang Belum Dibayar: <strong className="text-amber-700">{formatCurrency(totalPendingAccruedSalary)}</strong>
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handlePriveSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Periode Bulan</label>
                  <input
                    type="month"
                    value={priveMonth}
                    onChange={e => setPriveMonth(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Tanggal Penarikan</label>
                  <input
                    type="date"
                    value={priveDate}
                    onChange={e => setPriveDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">Nominal Prive Darurat (Rp)</label>
                  {safeCashForBonus > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPriveAmount(String(Math.floor(safeCashForBonus)));
                        setPriveGuardrailOverride(false);
                      }}
                      className="text-xs font-semibold text-violet-700 hover:underline tabular-nums"
                    >
                      Batas Kas Aman: {formatCurrency(safeCashForBonus)}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={1}
                  value={priveAmount}
                  onChange={e => {
                    setPriveAmount(e.target.value);
                    setPriveGuardrailOverride(false);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Sumber Dana</label>
                <select
                  value={priveFunding}
                  onChange={e => {
                    setPriveFunding(e.target.value as ExpenseFundingSource);
                    setPriveGuardrailOverride(false);
                  }}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Transfer Bank">Transfer Bank / Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Saldo {formatCurrency(cashSnapshot.cashDrawerBalance)}</option>
                  <option value="Kas Dipegang Owner">
                    Kas Dipegang Owner (Titipan Toko) — Saldo {formatCurrency(cashSnapshot.ownerHoldBalance)}
                  </option>
                </select>
              </div>

              {priveFunding === 'Transfer Bank' && cashSnapshot.nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={priveAccountId}
                    onChange={e => {
                      setPriveAccountId(e.target.value);
                      setPriveGuardrailOverride(false);
                    }}
                    className="mt-1 w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-lg text-sm"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {cashSnapshot.nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type}) — {formatCurrency(acc.balance)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {hasPriveGuardrailWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-xs text-amber-900">
                  <p className="font-semibold">Peringatan Filter Kas Aman:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {priveExceedsSafeCash && (
                      <li>
                        Nominal melebihi Batas Kas Aman ({formatCurrency(Math.max(0, safeCashForBonus))}) setelah menyisihkan hutang pemasok &le;14 hari &amp; pos buffer.
                      </li>
                    )}
                    {priveExceedsAccount && (
                      <li>
                        Nominal melebihi saldo sistem akun terpilih ({formatCurrency(selectedPriveFundingAvailable)}).
                      </li>
                    )}
                  </ul>
                  <label className="flex items-start gap-2 pt-1 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={priveGuardrailOverride}
                      onChange={e => setPriveGuardrailOverride(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-violet-600 focus:ring-violet-500"
                    />
                    <span>Saya paham risikonya dan tetap ingin menarik prive darurat ini.</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Alasan / Catatan Prive</label>
                <input
                  type="text"
                  value={priveNotes}
                  onChange={e => setPriveNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Contoh: Keperluan darurat keluarga"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPriveModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrive}
                  className="px-4 py-2 bg-violet-700 text-white rounded-lg text-sm font-semibold hover:bg-violet-800 disabled:opacity-50"
                >
                  {isSubmittingPrive ? 'Menyimpan...' : 'Simpan Prive Darurat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETOR KAS TITIPAN OWNER KE REKENING / LACI TOKO */}
      {isOwnerHoldTransferModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsOwnerHoldTransferModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Setor Kas Titipan Owner ke Toko</h3>
                <p className="text-xs text-slate-500">
                  Saldo Kas Dipegang Owner saat ini: <strong className="text-fuchsia-700 tabular-nums">{formatCurrency(cashSnapshot.ownerHoldBalance)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOwnerHoldTransferModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleOwnerHoldTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tanggal Setor</label>
                <input
                  type="date"
                  value={ownerHoldTransferDate}
                  onChange={e => setOwnerHoldTransferDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tujuan Setor (Rekening / Laci Toko)</label>
                <select
                  value={ownerHoldTransferToAccountId}
                  onChange={e => setOwnerHoldTransferToAccountId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  required
                >
                  {cashSnapshot.nonCashAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) — Saldo {formatCurrency(acc.balance)}
                    </option>
                  ))}
                  <option value="cash-drawer">
                    Kas Laci (Tunai Kasir) — Saldo {formatCurrency(cashSnapshot.cashDrawerBalance)}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nominal Disetor (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={ownerHoldTransferAmount}
                  onChange={e => setOwnerHoldTransferAmount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  required
                />
                {Number(ownerHoldTransferAmount || 0) > Math.max(0, cashSnapshot.ownerHoldBalance) && (
                  <p className="text-xs text-amber-700 mt-1">
                    Nominal melebihi saldo kas titipan di tangan Owner ({formatCurrency(cashSnapshot.ownerHoldBalance)}).
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Catatan</label>
                <input
                  type="text"
                  value={ownerHoldTransferNotes}
                  onChange={e => setOwnerHoldTransferNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Setor uang titipan toko ke rekening"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsOwnerHoldTransferModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOwnerHoldTransfer}
                  className="px-4 py-2 bg-fuchsia-700 text-white rounded-lg text-sm font-semibold hover:bg-fuchsia-800 disabled:opacity-50"
                >
                  {isSubmittingOwnerHoldTransfer ? 'Menyimpan...' : 'Simpan Setoran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW CETAK PDF (IFRAME-SAFE, NO WINDOW.OPEN) */}
      {printPreviewDoc && (
        <div
          className="fixed inset-0 bg-black/70 z-[70] flex justify-center items-center p-4"
          onClick={() => setPrintPreviewDoc(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-b bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Preview Cetak: {printPreviewDoc.title}</h3>
                <p className="text-xs text-slate-500">
                  Gunakan tombol Cetak / Simpan PDF untuk mencetak ke printer atau simpan sebagai PDF.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportOwnerFinanceExcel(exportReportPayload)}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Download Excel
                </button>
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 shadow"
                >
                  <PrinterIcon className="h-4 w-4 mr-1.5" /> Cetak / Simpan PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPreviewDoc(null)}
                  className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300"
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-200 p-4 overflow-hidden">
              <iframe
                ref={printIframeRef}
                title={printPreviewDoc.title}
                srcDoc={printPreviewDoc.html}
                className="w-full h-full bg-white rounded-lg shadow border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerFinance;
