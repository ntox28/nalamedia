import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  type AssetItem,
  type DebtItem,
  type BankInstallment,
  type SupplierBill,
  type SupplierData,
  type PaymentMethod,
  type LegacyReceivable,
  type OwnerTransaction,
  type OwnerMonthlyClosing,
  type OwnerAllocationBucket,
  type CashTransferRecord,
} from '../types';
import { type StoreCashSnapshot } from './cashFlowUtils';
import {
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  PlusCircleIcon,
} from './Icons';

const COMMON_BANK_PRESETS = [
  'Bank BRI',
  'Bank BCA',
  'Bank Mandiri',
  'Bank BNI',
  'Bank BTN',
  'Bank Jateng',
  'BSI (Bank Syariah Indonesia)',
  'Leasing / Kredit Mesin',
];

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.round(val || 0));

const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getTodayStr = () => new Date().toISOString().slice(0, 10);

interface OwnerAssetsDebtsPanelProps {
  assets: AssetItem[];
  debts: DebtItem[];
  bankInstallments: BankInstallment[];
  supplierBills: SupplierBill[];
  suppliers: SupplierData[];
  paymentMethods: PaymentMethod[];
  cashSnapshot: StoreCashSnapshot;
  cashTransfers: CashTransferRecord[];
  legacyReceivables: LegacyReceivable[];
  ownerTransactions: OwnerTransaction[];
  ownerMonthlyClosings: OwnerMonthlyClosing[];
  ownerName: string;
  onAddCashTransfer: (payload: Omit<CashTransferRecord, 'id' | 'timestamp' | 'createdBy'>) => Promise<void>;
  onAddAsset: (data: Omit<AssetItem, 'id'>) => Promise<void> | void;
  onUpdateAsset: (data: AssetItem) => Promise<void> | void;
  onDeleteAsset: (id: number) => Promise<void> | void;
  onAddDebt: (data: Omit<DebtItem, 'id'>) => Promise<void> | void;
  onUpdateDebt: (data: DebtItem) => Promise<void> | void;
  onDeleteDebt: (id: number) => Promise<void> | void;
}

const OwnerAssetsDebtsPanel: React.FC<OwnerAssetsDebtsPanelProps> = ({
  assets,
  debts,
  bankInstallments,
  supplierBills,
  suppliers,
  paymentMethods,
  cashSnapshot,
  cashTransfers,
  legacyReceivables,
  ownerTransactions,
  ownerMonthlyClosings,
  ownerName,
  onAddCashTransfer,
  onAddAsset,
  onUpdateAsset,
  onDeleteAsset,
  onAddDebt,
  onUpdateDebt,
  onDeleteDebt,
}) => {
  // Asset Form State
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState('');

  // Debt Form State
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [debtCategoryMode, setDebtCategoryMode] = useState<'Bank / Leasing' | 'Saldo Awal Pemasok' | 'Lainnya'>('Bank / Leasing');
  const [debtName, setDebtName] = useState('');
  const [debtValue, setDebtValue] = useState('');
  const [isCreditorDropdownOpen, setIsCreditorDropdownOpen] = useState(false);
  const [expandedSupplierKey, setExpandedSupplierKey] = useState<string | null>(null);
  const creditorDropdownRef = useRef<HTMLDivElement | null>(null);

  // Suntik Modal Modal State
  const [isCapitalModalOpen, setIsCapitalModalOpen] = useState(false);
  const [capitalDate, setCapitalDate] = useState(getTodayStr());
  const [capitalAmount, setCapitalAmount] = useState('');
  const [capitalAccountId, setCapitalAccountId] = useState('');
  const [capitalNotes, setCapitalNotes] = useState('');
  const [isSubmittingCapital, setIsSubmittingCapital] = useState(false);
  const [showCapitalHistory, setShowCapitalHistory] = useState(false);

  const effectiveAccounts = useMemo(() => {
    if (paymentMethods.length > 0) return paymentMethods;
    return [{ id: 'cash-default', name: 'Tunai', type: 'Tunai' as const, details: 'Kas Laci' }];
  }, [paymentMethods]);

  useEffect(() => {
    if (editingAsset) {
      setAssetName(editingAsset.name);
      setAssetValue(editingAsset.value.toString());
    } else {
      setAssetName('');
      setAssetValue('');
    }
  }, [editingAsset]);

  useEffect(() => {
    if (editingDebt) {
      setDebtName(editingDebt.name);
      setDebtValue(editingDebt.value.toString());
      const lower = editingDebt.name.toLowerCase();
      if (suppliers.some(s => s.name.toLowerCase() === lower)) {
        setDebtCategoryMode('Saldo Awal Pemasok');
      } else if (
        lower.includes('bank') ||
        lower.includes('kur') ||
        lower.includes('kredit') ||
        lower.includes('leasing') ||
        lower.includes('bri') ||
        lower.includes('bca') ||
        lower.includes('mandiri') ||
        lower.includes('bni')
      ) {
        setDebtCategoryMode('Bank / Leasing');
      } else {
        setDebtCategoryMode('Lainnya');
      }
    } else {
      setDebtName('');
      setDebtValue('');
    }
    setIsCreditorDropdownOpen(false);
  }, [editingDebt, suppliers]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (creditorDropdownRef.current && !creditorDropdownRef.current.contains(event.target as Node)) {
        setIsCreditorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group unpaid supplierBills per supplier (Otomatis dari Pembelian Kredit & Tagihan Pemasok)
  const supplierDebtGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        supplierName: string;
        totalBillAmount: number;
        totalPaidAmount: number;
        remainingAmount: number;
        nearestDueDate: string;
        bills: Array<{
          id: string;
          invoiceNumber: string;
          date: string;
          dueDate: string;
          description: string;
          totalAmount: number;
          paidAmount: number;
          remaining: number;
        }>;
      }
    >();

    supplierBills.forEach(bill => {
      if (bill.status !== 'Belum Lunas') return;
      const paidAmount = bill.payments.reduce((ps, p) => ps + Number(p.amount || 0), 0);
      const remaining = Math.max(0, Number(bill.totalAmount || 0) - paidAmount);
      if (remaining <= 0) return;

      const key = bill.supplierName.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key,
          supplierName: bill.supplierName.trim(),
          totalBillAmount: 0,
          totalPaidAmount: 0,
          remainingAmount: 0,
          nearestDueDate: bill.dueDate || '',
          bills: [],
        });
      }
      const group = map.get(key)!;
      group.totalBillAmount += Number(bill.totalAmount || 0);
      group.totalPaidAmount += paidAmount;
      group.remainingAmount += remaining;
      if (bill.dueDate && (!group.nearestDueDate || bill.dueDate < group.nearestDueDate)) {
        group.nearestDueDate = bill.dueDate;
      }
      group.bills.push({
        id: bill.id,
        invoiceNumber: bill.invoiceNumber,
        date: bill.date,
        dueDate: bill.dueDate,
        description: bill.description,
        totalAmount: Number(bill.totalAmount || 0),
        paidAmount,
        remaining,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [supplierBills]);

  const supplierActiveRemainingByName = useMemo(() => {
    const map = new Map<string, number>();
    supplierDebtGroups.forEach(g => map.set(g.key, g.remainingAmount));
    return map;
  }, [supplierDebtGroups]);

  const bankSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const list: { label: string; subtitle: string }[] = [];

    paymentMethods
      .filter(m => m.type === 'Transfer Bank')
      .forEach(m => {
        const norm = m.name.trim().toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          list.push({ label: m.name.trim(), subtitle: 'Rekening Bank Terdaftar' });
        }
      });

    bankInstallments.forEach(inst => {
      const norm = inst.name.trim().toLowerCase();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        list.push({ label: inst.name.trim(), subtitle: 'Cicilan Bank Aktif' });
      }
    });

    COMMON_BANK_PRESETS.forEach(preset => {
      const norm = preset.toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        list.push({ label: preset, subtitle: 'Referensi Bank / Kredit' });
      }
    });

    return list;
  }, [paymentMethods, bankInstallments]);

  const filteredDropdownOptions = useMemo(() => {
    const q = debtName.trim().toLowerCase();

    const supplierOpts = suppliers
      .filter(s => !q || s.name.toLowerCase().includes(q) || (s.specialty || '').toLowerCase().includes(q))
      .map(s => ({
        kind: 'supplier' as const,
        label: s.name,
        subtitle: s.specialty ? `Supplier • ${s.specialty}` : 'Supplier Master',
        autoBillRemaining: supplierActiveRemainingByName.get(s.name.trim().toLowerCase()) || 0,
      }));

    const bankOpts = bankSuggestions
      .filter(b => !q || b.label.toLowerCase().includes(q) || b.subtitle.toLowerCase().includes(q))
      .map(b => ({
        kind: 'bank' as const,
        label: b.label,
        subtitle: b.subtitle,
        autoBillRemaining: 0,
      }));

    const exactMatchExists =
      supplierOpts.some(o => o.label.toLowerCase() === q) ||
      bankOpts.some(o => o.label.toLowerCase() === q);

    return {
      supplierOpts,
      bankOpts,
      showCustomCreate: q.length > 0 && !exactMatchExists,
    };
  }, [debtName, suppliers, bankSuggestions, supplierActiveRemainingByName]);

  const matchedAutoSupplierDebt = useMemo(() => {
    const q = debtName.trim().toLowerCase();
    if (!q) return 0;
    return supplierActiveRemainingByName.get(q) || 0;
  }, [debtName, supplierActiveRemainingByName]);

  // Modal Owner Stats (Suntik Modal vs Tarik Bonus+Prive)
  const capitalRecords = useMemo(
    () =>
      cashTransfers
        .filter(t => t.transferType === 'Suntik Modal')
        .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp)),
    [cashTransfers]
  );

  const totalCapitalInjected = useMemo(
    () => capitalRecords.reduce((s, t) => s + Number(t.netAmount ?? t.amount ?? 0), 0),
    [capitalRecords]
  );

  const totalOwnerBonusAndPrive = useMemo(
    () =>
      ownerTransactions
        .filter(tx => tx.type === 'bonus_payout' || tx.type === 'prive')
        .reduce((s, tx) => s + Number(tx.amount || 0), 0),
    [ownerTransactions]
  );

  const totalFixedAssets = assets.reduce((sum, a) => sum + Number(a.value || 0), 0);
  const totalLegacyReceivables = useMemo(
    () => legacyReceivables.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    [legacyReceivables]
  );
  const totalReceivablesAsset = cashSnapshot.unpaidCustomerReceivables + totalLegacyReceivables;
  const totalCurrentAssetsAuto = cashSnapshot.totalStoreLiquidCash + totalReceivablesAsset;
  const totalAllAssets = totalCurrentAssetsAuto + totalFixedAssets;

  const ownerBalanceSummary = useMemo(() => {
    const salaryByMonth = new Map<string, { paid: number; accrued: number }>();
    const buckets: Record<OwnerAllocationBucket, { inflow: number; absorbedLoss: number; used: number; balance: number }> = {
      reserve: { inflow: 0, absorbedLoss: 0, used: 0, balance: 0 },
      equipment: { inflow: 0, absorbedLoss: 0, used: 0, balance: 0 },
      bonus: { inflow: 0, absorbedLoss: 0, used: 0, balance: 0 },
      buffer: { inflow: 0, absorbedLoss: 0, used: 0, balance: 0 },
    };

    ownerMonthlyClosings.forEach(c => {
      buckets.reserve.inflow += Number(c.allocations?.reserve || 0);
      buckets.reserve.absorbedLoss += Number(c.absorbedFromReserve || 0);
      buckets.equipment.inflow += Number(c.allocations?.equipment || 0);
      buckets.bonus.inflow += Number(c.allocations?.bonus || 0);
      buckets.buffer.inflow += Number(c.allocations?.buffer || 0);
    });

    ownerTransactions.forEach(tx => {
      const amt = Number(tx.amount || 0);
      if (tx.type === 'salary_paid' || tx.type === 'salary_accrual') {
        const cur = salaryByMonth.get(tx.month) || { paid: 0, accrued: 0 };
        if (tx.type === 'salary_paid') cur.paid += amt;
        else cur.accrued += amt;
        salaryByMonth.set(tx.month, cur);
      } else if (tx.type === 'bonus_payout') {
        buckets.bonus.used += amt;
      } else if (tx.type === 'reserve_usage') {
        const target = tx.bucket || 'reserve';
        buckets[target].used += amt;
      }
    });

    let pendingAccruedSalary = 0;
    salaryByMonth.forEach(v => {
      pendingAccruedSalary += Math.max(0, v.accrued - v.paid);
    });

    buckets.reserve.balance = buckets.reserve.inflow - buckets.reserve.absorbedLoss - buckets.reserve.used;
    buckets.equipment.balance = buckets.equipment.inflow - buckets.equipment.used;
    buckets.bonus.balance = buckets.bonus.inflow - buckets.bonus.used;
    buckets.buffer.balance = buckets.buffer.inflow - buckets.buffer.used;

    const bonusPayable = Math.max(0, buckets.bonus.balance);
    return {
      pendingAccruedSalary,
      bonusPayable,
      totalOwnerObligations: pendingAccruedSalary + bonusPayable,
      reserveBalance: buckets.reserve.balance,
      equipmentBalance: buckets.equipment.balance,
      bufferBalance: buckets.buffer.balance,
    };
  }, [ownerTransactions, ownerMonthlyClosings]);

  const totalDebts = debts.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalSupplierDebt = supplierDebtGroups.reduce((sum, g) => sum + g.remainingAmount, 0);
  const totalAllDebts = totalDebts + totalSupplierDebt + ownerBalanceSummary.totalOwnerObligations;
  const linkedDebtIds = new Set(bankInstallments.map(b => b.debtId).filter(Boolean));
  const supplierNamesLowerSet = useMemo(
    () => new Set(suppliers.map(s => s.name.trim().toLowerCase())),
    [suppliers]
  );
  const netWorth = totalAllAssets - totalAllDebts;

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) return;
    if (editingAsset) {
      await onUpdateAsset({ ...editingAsset, name: assetName.trim(), value: Number(assetValue) });
    } else {
      await onAddAsset({ name: assetName.trim(), value: Number(assetValue) });
    }
    setEditingAsset(null);
    setAssetName('');
    setAssetValue('');
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = debtName.trim();
    if (!trimmedName) {
      alert('Pilih atau ketik nama hutang / kreditur terlebih dahulu.');
      return;
    }
    if (editingDebt) {
      await onUpdateDebt({ ...editingDebt, name: trimmedName, value: Number(debtValue) });
    } else {
      await onAddDebt({ name: trimmedName, value: Number(debtValue) });
    }
    setEditingDebt(null);
    setDebtName('');
    setDebtValue('');
    setIsCreditorDropdownOpen(false);
  };

  const handleDeleteAssetClick = async (asset: AssetItem) => {
    if (window.confirm(`Anda yakin ingin menghapus aset "${asset.name}"?`)) {
      await onDeleteAsset(asset.id);
    }
  };

  const handleDeleteDebtClick = async (debt: DebtItem) => {
    const isLinkedBank = linkedDebtIds.has(debt.id);
    const msg = isLinkedBank
      ? `Hutang "${debt.name}" sedang tersinkron dengan Cicilan Bank di menu Pengeluaran. Menghapusnya di sini akan memutus sinkronisasi dengan Cicilan Bank. Tetap hapus?`
      : `Anda yakin ingin menghapus hutang "${debt.name}"?`;
    if (window.confirm(msg)) {
      await onDeleteDebt(debt.id);
    }
  };

  const openCapitalModal = () => {
    setCapitalDate(getTodayStr());
    setCapitalAmount('');
    setCapitalAccountId(effectiveAccounts[0]?.id || 'cash-default');
    setCapitalNotes('');
    setIsCapitalModalOpen(true);
  };

  const handleCapitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(capitalAmount);
    if (!capitalDate || !numAmt || numAmt <= 0 || !capitalAccountId) {
      alert('Tanggal, rekening tujuan, dan nominal suntik modal harus valid.');
      return;
    }
    const targetAcc = effectiveAccounts.find(a => a.id === capitalAccountId);
    setIsSubmittingCapital(true);
    try {
      await onAddCashTransfer({
        date: capitalDate,
        transferType: 'Suntik Modal',
        fromAccountName: ownerName || 'Owner',
        toAccountId: capitalAccountId,
        toAccountName: targetAcc?.name || 'Rekening Toko',
        amount: numAmt,
        adminFee: 0,
        netAmount: numAmt,
        notes: capitalNotes.trim() || `Suntik Modal dari ${ownerName || 'Owner'}`,
      });
      setIsCapitalModalOpen(false);
    } finally {
      setIsSubmittingCapital(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Panel Modal & Ekuitas Owner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Modal Owner &amp; Kekayaan Bersih Usaha</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau total Suntik Modal yang disetorkan Owner ke toko dibanding total Bonus &amp; Prive yang sudah ditarik, serta posisi Kekayaan Bersih usaha.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {capitalRecords.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCapitalHistory(prev => !prev)}
                className="px-3 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                {showCapitalHistory ? 'Sembunyikan Riwayat Modal' : `Riwayat Suntik Modal (${capitalRecords.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={openCapitalModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Catat Suntik Modal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="border border-sky-200 rounded-xl p-4 bg-sky-50/40">
            <p className="text-xs font-medium text-sky-900">Total Suntik Modal Masuk</p>
            <p className="text-xl font-bold text-sky-700 mt-1 tabular-nums">{formatCurrency(totalCapitalInjected)}</p>
            <p className="text-xs text-slate-500 mt-1">{capitalRecords.length}x setoran modal ke kas/bank toko</p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <p className="text-xs font-medium text-slate-600">Penarikan Owner (Bonus + Prive)</p>
            <p className="text-xl font-bold text-pink-700 mt-1 tabular-nums">{formatCurrency(totalOwnerBonusAndPrive)}</p>
            <p className="text-xs text-slate-500 mt-1">Di luar gaji bulanan operasional</p>
          </div>
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40">
            <p className="text-xs font-medium text-slate-600">Selisih Suntik vs Tarik Owner</p>
            <p
              className={`text-xl font-bold mt-1 tabular-nums ${
                totalCapitalInjected - totalOwnerBonusAndPrive > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(totalCapitalInjected - totalOwnerBonusAndPrive)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {totalCapitalInjected - totalOwnerBonusAndPrive > 0
                ? 'Modal pribadi masih tertanam bersih di usaha'
                : 'Penarikan laba sudah melampaui modal disuntik'}
            </p>
          </div>
          <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/40">
            <p className="text-xs font-semibold text-emerald-900">Kekayaan Bersih Usaha (Net Worth)</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${netWorth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCurrency(netWorth)}
            </p>
            <p className="text-xs text-slate-600 mt-1 tabular-nums">
              Aset {formatCurrency(totalAllAssets)} − Kewajiban {formatCurrency(totalAllDebts)}
            </p>
          </div>
        </div>

        {showCapitalHistory && capitalRecords.length > 0 && (
          <div className="border-t border-slate-200 pt-3 overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-xs text-slate-600 text-left">
                  <th className="py-2 px-3 font-semibold">Tanggal</th>
                  <th className="py-2 px-3 font-semibold">Rekening / Kas Tujuan</th>
                  <th className="py-2 px-3 font-semibold">Catatan</th>
                  <th className="py-2 px-3 font-semibold text-right">Nominal Suntik Modal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {capitalRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600 tabular-nums">{formatDate(rec.date)}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{rec.toAccountName || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{rec.notes || '-'}</td>
                    <td className="py-2 px-3 text-right font-bold text-sky-700 tabular-nums">
                      + {formatCurrency(Number(rec.netAmount ?? rec.amount ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pengelolaan Aset Tetap & Hutang Manual */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">Pengelolaan Induk Aset Tetap &amp; Hutang Usaha</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat data induk Aset Tetap &amp; Hutang Manual. Perubahan di sini otomatis tampil di Laporan Neraca (Read-Only) dan tetap tersinkron dua arah dengan menu Cicilan Bank &amp; Pemasok di Pengeluaran.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* KOLOM KIRI: ASET */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900">Aset Usaha</h4>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(totalAllAssets)}</span>
            </div>

            {/* Blok Aset Lancar Otomatis */}
            <div className="border border-cyan-200 rounded-xl p-3.5 bg-cyan-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wide text-cyan-900">
                  Aset Lancar Toko (Otomatis dari Sistem)
                </h5>
                <span className="text-xs font-bold text-cyan-800 tabular-nums">{formatCurrency(totalCurrentAssetsAuto)}</span>
              </div>
              <div className="space-y-1.5 text-xs bg-white border border-cyan-100 rounded-lg p-2.5 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-600">Kas Laci Aktif</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(cashSnapshot.cashDrawerBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Rekening Bank / QRIS / E-Wallet</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(cashSnapshot.totalBankBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Kas Dipegang Owner (Titipan Toko)</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(cashSnapshot.ownerHoldBalance)}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-slate-600">Piutang Pelanggan Aktif (Baru + Lama)</span>
                  <span className="font-semibold text-amber-700">{formatCurrency(totalReceivablesAsset)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAssetSubmit} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <h5 className="font-semibold text-sm text-slate-800">
                {editingAsset ? 'Edit Aset Tetap / Inventaris' : 'Tambah Aset Tetap / Inventaris Baru'}
              </h5>
              <input
                value={assetName}
                onChange={e => setAssetName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                placeholder="Nama Aset (mis. Mesin Printer Indoor / Komputer Desain)"
                required
              />
              <input
                type="number"
                value={assetValue}
                onChange={e => setAssetValue(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white tabular-nums"
                placeholder="Nilai Aset (Rp)"
                required
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="w-full bg-cyan-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700"
                >
                  {editingAsset ? 'Simpan Perubahan Aset' : 'Tambah Aset Tetap'}
                </button>
                {editingAsset && (
                  <button
                    type="button"
                    onClick={() => setEditingAsset(null)}
                    className="w-full bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Daftar Aset Tetap ({assets.length})
                </span>
                <span className="text-xs font-bold text-emerald-700 tabular-nums">{formatCurrency(totalFixedAssets)}</span>
              </div>
              {assets.length > 0 ? (
                assets.map(item => (
                  <div key={item.id} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                      <p className="text-sm text-emerald-600 font-bold tabular-nums">{formatCurrency(item.value)}</p>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingAsset(item)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded"
                        title="Edit Aset"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAssetClick(item)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded"
                        title="Hapus Aset"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">Belum ada aset tetap yang dicatat.</p>
              )}
            </div>
          </div>

          {/* KOLOM KANAN: HUTANG */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900">Hutang &amp; Kewajiban</h4>
              <span className="text-sm font-bold text-rose-600 tabular-nums">{formatCurrency(totalAllDebts)}</span>
            </div>

            <form onSubmit={handleDebtSubmit} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h5 className="font-semibold text-sm text-slate-800">
                  {editingDebt ? 'Edit Hutang' : 'Tambah Hutang Baru'}
                </h5>
                <span className="text-[11px] text-slate-500">Khusus Bank / Leasing / Saldo Awal Lama</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(['Bank / Leasing', 'Saldo Awal Pemasok', 'Lainnya'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setDebtCategoryMode(mode);
                      setIsCreditorDropdownOpen(true);
                    }}
                    className={`px-2 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                      debtCategoryMode === mode
                        ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="relative" ref={creditorDropdownRef}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nama Kreditur / Hutang (Ketik untuk mencari Supplier atau Bank)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={debtName}
                    onFocus={() => setIsCreditorDropdownOpen(true)}
                    onChange={e => {
                      setDebtName(e.target.value);
                      setIsCreditorDropdownOpen(true);
                    }}
                    className="w-full p-2.5 pr-8 border border-slate-300 rounded-lg bg-white text-sm"
                    placeholder={
                      debtCategoryMode === 'Saldo Awal Pemasok'
                        ? 'Cari nama Supplier dari Data Master...'
                        : debtCategoryMode === 'Bank / Leasing'
                        ? 'Cari / ketik nama Bank atau Kredit (mis. KUR BRI)...'
                        : 'Ketik atau pilih nama kreditur...'
                    }
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setIsCreditorDropdownOpen(prev => !prev)}
                    className="absolute inset-y-0 right-0 px-2 flex items-center text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                    aria-label="Tampilkan daftar kreditur"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                </div>

                {isCreditorDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-300 rounded-lg shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {(debtCategoryMode === 'Saldo Awal Pemasok'
                      ? [
                          { title: 'Daftar Supplier (Data Master)', items: filteredDropdownOptions.supplierOpts },
                          { title: 'Bank / Kredit / Leasing', items: filteredDropdownOptions.bankOpts },
                        ]
                      : [
                          { title: 'Bank / Kredit / Leasing', items: filteredDropdownOptions.bankOpts },
                          { title: 'Daftar Supplier (Data Master)', items: filteredDropdownOptions.supplierOpts },
                        ]
                    ).map(group =>
                      group.items.length > 0 ? (
                        <div key={group.title} className="py-1">
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                            {group.title}
                          </div>
                          {group.items.map(opt => (
                            <button
                              key={`${group.title}-${opt.label}`}
                              type="button"
                              onClick={() => {
                                setDebtName(opt.label);
                                if (opt.kind === 'supplier') setDebtCategoryMode('Saldo Awal Pemasok');
                                else setDebtCategoryMode('Bank / Leasing');
                                setIsCreditorDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-pink-50 flex items-center justify-between gap-2 text-sm"
                            >
                              <div>
                                <p className="font-semibold text-slate-800">{opt.label}</p>
                                <p className="text-[11px] text-slate-500">{opt.subtitle}</p>
                              </div>
                              {opt.autoBillRemaining > 0 && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                                  Otomatis: {formatCurrency(opt.autoBillRemaining)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : null
                    )}

                    {filteredDropdownOptions.showCustomCreate && (
                      <button
                        type="button"
                        onClick={() => setIsCreditorDropdownOpen(false)}
                        className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-pink-50 text-xs font-semibold text-pink-700"
                      >
                        + Gunakan nama manual: &ldquo;{debtName.trim()}&rdquo;
                      </button>
                    )}

                    {filteredDropdownOptions.supplierOpts.length === 0 &&
                      filteredDropdownOptions.bankOpts.length === 0 &&
                      !filteredDropdownOptions.showCustomCreate && (
                        <div className="px-3 py-3 text-xs text-slate-500 text-center">
                          Ketik nama bank, supplier, atau kreditur.
                        </div>
                      )}
                  </div>
                )}
              </div>

              {matchedAutoSupplierDebt > 0 && (
                <div className="p-2.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  <strong>Perhatian Anti-Dobel:</strong> Supplier <strong>{debtName.trim()}</strong> sudah memiliki hutang otomatis sebesar{' '}
                  <strong>{formatCurrency(matchedAutoSupplierDebt)}</strong> dari Pembelian Kredit di bawah. Gunakan form ini{' '}
                  <strong>hanya</strong> untuk saldo hutang lama sebelum sistem agar tidak terhitung ganda.
                </div>
              )}

              <input
                type="number"
                value={debtValue}
                onChange={e => setDebtValue(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm tabular-nums"
                placeholder="Nilai Hutang (Rp)"
                required
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="w-full bg-rose-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-700"
                >
                  {editingDebt ? 'Simpan Perubahan Hutang' : 'Tambah Hutang'}
                </button>
                {editingDebt && (
                  <button
                    type="button"
                    onClick={() => setEditingDebt(null)}
                    className="w-full bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-semibold hover:bg-slate-300"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>

            {/* Daftar 1: Hutang Pemasok Otomatis */}
            <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wide text-amber-900">
                  Hutang Pemasok (Otomatis dari Pembelian Kredit)
                </h5>
                <span className="text-xs font-bold text-amber-800 tabular-nums">{formatCurrency(totalSupplierDebt)}</span>
              </div>
              {supplierDebtGroups.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {supplierDebtGroups.map(group => {
                    const isExpanded = expandedSupplierKey === group.key;
                    return (
                      <div key={group.key} className="bg-white border border-amber-200 rounded-lg p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold text-slate-800 text-sm">{group.supplierName}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                Otomatis • {group.bills.length} Nota
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Tagihan {formatCurrency(group.totalBillAmount)} • Terbayar {formatCurrency(group.totalPaidAmount)}
                              {group.nearestDueDate ? ` • Jatuh tempo: ${formatDate(group.nearestDueDate)}` : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-amber-700 tabular-nums">{formatCurrency(group.remainingAmount)}</p>
                            <button
                              type="button"
                              onClick={() => setExpandedSupplierKey(isExpanded ? null : group.key)}
                              className="text-[11px] text-pink-600 hover:underline font-medium"
                            >
                              {isExpanded ? 'Tutup Rincian' : 'Lihat Rincian Nota'}
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-amber-100 space-y-1.5">
                            {group.bills.map(b => (
                              <div key={b.id} className="flex justify-between items-center text-[11px] bg-amber-50/50 px-2 py-1 rounded">
                                <div>
                                  <span className="font-semibold text-slate-800">{b.invoiceNumber}</span>
                                  <span className="text-slate-500"> • {formatDate(b.date)}</span>
                                  {b.description && <span className="text-slate-500"> — {b.description}</span>}
                                </div>
                                <span className="font-bold text-amber-800 whitespace-nowrap ml-2 tabular-nums">{formatCurrency(b.remaining)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-amber-800/80 py-1">Belum ada pembelian kredit yang belum lunas.</p>
              )}
            </div>

            {/* Daftar 2: Kewajiban ke Owner */}
            <div className="border border-pink-200 rounded-xl p-3 bg-pink-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wide text-pink-900">
                  Kewajiban ke Owner (Otomatis Owner Dashboard)
                </h5>
                <span className="text-xs font-bold text-pink-800 tabular-nums">
                  {formatCurrency(ownerBalanceSummary.totalOwnerObligations)}
                </span>
              </div>
              <div className="space-y-1.5 text-xs bg-white border border-pink-100 rounded-lg p-2.5 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-600">Gaji Owner Terhutang (Accrual)</span>
                  <span className="font-semibold text-pink-700">{formatCurrency(ownerBalanceSummary.pendingAccruedSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Bonus Owner Siap Cair (Belum Ditarik)</span>
                  <span className="font-semibold text-pink-700">{formatCurrency(ownerBalanceSummary.bonusPayable)}</span>
                </div>
                <div className="border-t pt-1.5 mt-1 text-[11px] text-slate-500 flex justify-between">
                  <span>Pos Internal (Cadangan • Mesin • Buffer)</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrency(ownerBalanceSummary.reserveBalance)} / {formatCurrency(ownerBalanceSummary.equipmentBalance)} /{' '}
                    {formatCurrency(ownerBalanceSummary.bufferBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Daftar 3: Hutang Terdaftar Manual / Cicilan Bank */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 border border-slate-200 rounded-xl p-2.5">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  Hutang Terdaftar (Bank / Leasing / Saldo Awal)
                </span>
                <span className="text-xs font-bold text-rose-600 tabular-nums">{formatCurrency(totalDebts)}</span>
              </div>
              {debts.length > 0 ? (
                debts.map(item => {
                  const isSupplierMatch = supplierNamesLowerSet.has(item.name.trim().toLowerCase());
                  const isLinkedBank = linkedDebtIds.has(item.id);
                  return (
                    <div key={item.id} className="bg-white border border-slate-200 p-3 rounded-lg flex justify-between items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                          {isLinkedBank && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                              Tersinkron Cicilan Bank
                            </span>
                          )}
                          {!isLinkedBank && isSupplierMatch && (
                            <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-semibold">
                              Supplier (Saldo Awal / Manual)
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-rose-600 font-bold tabular-nums">{formatCurrency(item.value)}</p>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingDebt(item)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded"
                          title="Edit Hutang"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDebtClick(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded"
                          title="Hapus Hutang"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">Belum ada hutang terdaftar secara manual.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CATAT SUNTIK MODAL OWNER */}
      {isCapitalModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
          onClick={() => setIsCapitalModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Catat Suntik Modal Owner</h3>
                <p className="text-xs text-slate-500">
                  Otomatis tercatat sebagai Suntik Modal di Arus Kas dan menambah saldo akun kas/bank tujuan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCapitalModalOpen(false)}
                className="text-2xl text-slate-400 hover:text-slate-600 leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCapitalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Tanggal Setor Modal</label>
                <input
                  type="date"
                  value={capitalDate}
                  onChange={e => setCapitalDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Masuk ke Akun Kas / Bank Toko</label>
                <select
                  value={capitalAccountId}
                  onChange={e => setCapitalAccountId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  required
                >
                  {effectiveAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nominal Suntik Modal (Rp)</label>
                <input
                  type="number"
                  min={1}
                  value={capitalAmount}
                  onChange={e => setCapitalAmount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold tabular-nums"
                  placeholder="Contoh: 10000000"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={capitalNotes}
                  onChange={e => setCapitalNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Contoh: Tambahan modal beli bahan banner"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCapitalModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCapital}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
                >
                  {isSubmittingCapital ? 'Menyimpan...' : 'Simpan Suntik Modal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerAssetsDebtsPanel;
