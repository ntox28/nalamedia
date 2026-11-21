import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  type ExpenseItem,
  type ExpenseMetadata,
  type ExpenseFundingSource,
  type SupplierData,
  type SupplierBill,
  type BillPayment,
  type InstallmentFundingSource,
  type DebtItem,
  type BankInstallment,
  type BankInstallmentPayment,
  type PrivateExpenseItem,
  type PrivateFundingSource,
  type PaymentMethod,
  type StoreInfo,
} from '../types';
import {
  MagnifyingGlassIcon,
  PlusCircleIcon,
  TrashIcon,
  EyeIcon,
  CreditCardIcon,
  PencilIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from './Icons';
import Pagination from './Pagination';
import {
  computeSupplierBillPaymentLedger,
  buildSupplierBillStatementHtml,
  exportSupplierBillDetailExcel,
  buildSupplierBillsRecapHtml,
  exportSupplierBillsExcel,
  buildOperationalExpensesHtml,
  exportOperationalExpensesExcel,
  buildBankInstallmentDetailHtml,
  buildBankInstallmentsListHtml,
  exportBankInstallmentDetailExcel,
  exportBankInstallmentsExcel,
  buildPrivateExpensesHtml,
  exportPrivateExpensesExcel,
} from './expenseExportUtils';

const ITEMS_PER_PAGE = 20;

const TABS = [
  { key: 'operational', label: 'Pengeluaran Operasional' },
  { key: 'installments', label: 'Cicilan Bank & Pemasok' },
  { key: 'private', label: 'Pengeluaran Pribadi / Lain-lain' },
];

const OPERATIONAL_CATEGORIES = [
  'Biaya Konsumsi Karyawan',
  'Biaya Operasional',
  'ATK dan Perlengkapan Kantor',
  'Biaya Sponsor atau Iklan',
  'Administrasi dan Umum',
  'Bahan Cetak, Kertas, Tinta, Dll',
  'Listrik, Internet dan PDAM',
  'Gaji Karyawan',
  'Maintenence dan Perawatan Mesin',
  'Lain-lain',
];

const PRIVATE_CATEGORIES = [
  'Perjamuan Klien & Relasi',
  'Akomodasi & Hotel Teknisi/Tamu',
  'Transportasi & Kunjungan Bisnis',
  'Keperluan Pribadi Owner (Prive)',
  'Sumbangan / Sosial',
  'Lain-lain Non-Operasional',
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const getLocalToday = () => {
  return new Date().toISOString().substring(0, 10);
};

interface ExpensesProps {
  expenses: ExpenseItem[];
  expenseMetadata: Record<number, ExpenseMetadata>;
  suppliers: SupplierData[];
  supplierBills: SupplierBill[];
  debts: DebtItem[];
  bankInstallments: BankInstallment[];
  privateExpenses: PrivateExpenseItem[];
  paymentMethods?: PaymentMethod[];
  storeInfo?: StoreInfo;
  menuPermissions: string[];
  onAddExpense: (newExpense: Omit<ExpenseItem, 'id'>, metadata?: ExpenseMetadata) => Promise<void>;
  onUpdateExpense: (updatedExpense: ExpenseItem, metadata?: ExpenseMetadata) => Promise<void>;
  onDeleteExpense: (id: number) => Promise<void>;
  onAddSupplierBill: (bill: Omit<SupplierBill, 'id' | 'payments' | 'status'> & {
    priorPaidAmount?: number;
    priorPaidDate?: string;
    priorPaidNotes?: string;
  }) => Promise<void>;
  onAddSupplierBillsBatch?: (bills: Array<Omit<SupplierBill, 'id' | 'payments' | 'status'> & {
    priorPaidAmount?: number;
    priorPaidDate?: string;
    priorPaidNotes?: string;
  }>) => Promise<void>;
  onUpdateSupplierBill: (bill: SupplierBill) => Promise<void>;
  onPaySupplierBill: (
    billId: string,
    payment: {
      date: string;
      amount: number;
      fundingSource: InstallmentFundingSource;
      fundingAccountId?: string;
      fundingAccountName?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onBulkPaySupplierBills?: (payload: {
    allocations: Array<{ billId: string; amount: number }>;
    date: string;
    fundingSource: InstallmentFundingSource;
    fundingAccountId?: string;
    fundingAccountName?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateSupplierBillPayment: (
    billId: string,
    paymentId: string,
    payment: {
      date: string;
      amount: number;
      fundingSource: InstallmentFundingSource;
      fundingAccountId?: string;
      fundingAccountName?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onDeleteSupplierBillPayment: (billId: string, paymentId: string) => Promise<void>;
  onDeleteSupplierBill: (billId: string) => Promise<void>;
  onAddBankInstallment: (payload: {
    debtId?: number;
    syncToDebts: boolean;
    name: string;
    creditLimit: number;
    remainingPrincipal: number;
    dueDayOfMonth?: number;
    nextDueDate?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateBankInstallment: (updated: BankInstallment) => Promise<void>;
  onPayBankInstallment: (
    installmentId: string,
    payment: {
      date: string;
      totalPaid: number;
      principalPaid: number;
      interestPaid: number;
      fundingSource: InstallmentFundingSource;
      fundingAccountId?: string;
      fundingAccountName?: string;
      nextDueDate?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onUpdateBankInstallmentPayment: (
    installmentId: string,
    paymentId: string,
    payment: {
      date: string;
      totalPaid: number;
      principalPaid: number;
      interestPaid: number;
      fundingSource: InstallmentFundingSource;
      fundingAccountId?: string;
      fundingAccountName?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onDeleteBankInstallmentPayment: (installmentId: string, paymentId: string) => Promise<void>;
  onDeleteBankInstallment: (installmentId: string) => Promise<void>;
  onAddPrivateExpense: (item: Omit<PrivateExpenseItem, 'id'>) => Promise<void>;
  onUpdatePrivateExpense: (item: PrivateExpenseItem) => Promise<void>;
  onToggleReimbursePrivateExpense: (id: string) => Promise<void>;
  onDeletePrivateExpense: (id: string) => Promise<void>;
}

const Expenses: React.FC<ExpensesProps> = ({
  expenses,
  expenseMetadata,
  suppliers,
  supplierBills,
  debts,
  bankInstallments,
  privateExpenses,
  paymentMethods = [],
  storeInfo,
  menuPermissions,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddSupplierBill,
  onAddSupplierBillsBatch,
  onUpdateSupplierBill,
  onPaySupplierBill,
  onBulkPaySupplierBills,
  onUpdateSupplierBillPayment,
  onDeleteSupplierBillPayment,
  onDeleteSupplierBill,
  onAddBankInstallment,
  onUpdateBankInstallment,
  onPayBankInstallment,
  onUpdateBankInstallmentPayment,
  onDeleteBankInstallmentPayment,
  onDeleteBankInstallment,
  onAddPrivateExpense,
  onUpdatePrivateExpense,
  onToggleReimbursePrivateExpense,
  onDeletePrivateExpense,
}) => {
  const today = getLocalToday();
  const nonCashAccounts = useMemo(
    () => paymentMethods.filter(m => m.type !== 'Tunai'),
    [paymentMethods]
  );
  const resolveAccountName = (id?: string) => nonCashAccounts.find(a => a.id === id)?.name;

  // Print Preview Modal (Iframe-safe, no window.open needed)
  const [printPreviewDoc, setPrintPreviewDoc] = useState<{
    title: string;
    html: string;
    onExportExcel?: () => void;
  } | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement>(null);

  const handleOpenPrintPreview = (title: string, html: string, onExportExcel?: () => void) => {
    setPrintPreviewDoc({ title, html, onExportExcel });
  };

  const handleTriggerPrint = () => {
    const win = printIframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  const accessibleTabs = useMemo(() => {
    const hasExplicitSubPerm = menuPermissions.some(p => p.startsWith('expenses/'));
    if (!hasExplicitSubPerm && menuPermissions.includes('expenses')) {
      return TABS.filter(t => t.key === 'operational');
    }
    return TABS.filter(tab => menuPermissions.includes(`expenses/${tab.key}`));
  }, [menuPermissions]);

  const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : 'operational');

  useEffect(() => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
      setActiveTab(accessibleTabs[0].key);
    }
  }, [accessibleTabs, activeTab]);

  // ==========================================
  // 1. STATE: PENGELUARAN OPERASIONAL
  // ==========================================
  const [expenseName, setExpenseName] = useState('');
  const [category, setCategory] = useState(OPERATIONAL_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [opFundingSource, setOpFundingSource] = useState<ExpenseFundingSource>('Kas Laci');
  const [opAccountId, setOpAccountId] = useState<string>('');
  const [opNotes, setOpNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [opStartDate, setOpStartDate] = useState('');
  const [opEndDate, setOpEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Edit Operational Expense Modal State
  const [editingOpExpense, setEditingOpExpense] = useState<ExpenseItem | null>(null);
  const [editOpName, setEditOpName] = useState('');
  const [editOpCategory, setEditOpCategory] = useState(OPERATIONAL_CATEGORIES[0]);
  const [editOpAmount, setEditOpAmount] = useState('');
  const [editOpDate, setEditOpDate] = useState(today);
  const [editOpFunding, setEditOpFunding] = useState<ExpenseFundingSource>('Kas Laci');
  const [editOpAccountId, setEditOpAccountId] = useState('');
  const [editOpNotes, setEditOpNotes] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, opStartDate, opEndDate]);

  const handleOpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseName || !amount) {
      alert('Nama pengeluaran dan jumlah tidak boleh kosong.');
      return;
    }
    const accountName = opFundingSource === 'Transfer Bank' ? resolveAccountName(opAccountId) : undefined;
    await onAddExpense(
      {
        name: expenseName,
        category,
        amount: Number(amount),
        date,
      },
      {
        fundingSource: opFundingSource,
        fundingAccountId: opFundingSource === 'Transfer Bank' && opAccountId ? opAccountId : undefined,
        fundingAccountName: accountName,
        notes: opNotes.trim() || undefined,
      }
    );
    setExpenseName('');
    setCategory(OPERATIONAL_CATEGORIES[0]);
    setAmount('');
    setDate(today);
    setOpNotes('');
  };

  const handleOpenEditOpExpense = (exp: ExpenseItem) => {
    const meta = expenseMetadata[exp.id];
    setEditingOpExpense(exp);
    setEditOpName(exp.name);
    setEditOpCategory(exp.category);
    setEditOpAmount(String(exp.amount));
    setEditOpDate(exp.date);
    setEditOpFunding(meta?.fundingSource || 'Kas Laci');
    setEditOpAccountId(meta?.fundingAccountId || '');
    setEditOpNotes(meta?.notes || '');
  };

  const handleSaveEditOpExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpExpense) return;
    const isPurchaseLinked = Boolean(expenseMetadata[editingOpExpense.id]?.purchaseId);
    const numAmount = isPurchaseLinked ? editingOpExpense.amount : Number(editOpAmount);
    if (!editOpName.trim() || numAmount < 0) {
      alert('Nama pengeluaran dan jumlah harus valid.');
      return;
    }
    const accountName = editOpFunding === 'Transfer Bank' ? resolveAccountName(editOpAccountId) : undefined;
    await onUpdateExpense(
      {
        ...editingOpExpense,
        name: editOpName.trim(),
        category: editOpCategory,
        amount: numAmount,
        date: isPurchaseLinked ? editingOpExpense.date : editOpDate,
      },
      {
        fundingSource: editOpFunding,
        fundingAccountId: editOpFunding === 'Transfer Bank' && editOpAccountId ? editOpAccountId : undefined,
        fundingAccountName: accountName,
        notes: editOpNotes.trim() || undefined,
      }
    );
    setEditingOpExpense(null);
  };

  const filteredExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
    return sorted.filter(e => {
      if (opStartDate && e.date < opStartDate) return false;
      if (opEndDate && e.date > opEndDate) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const metaNotes = expenseMetadata[e.id]?.notes?.toLowerCase() || '';
        return (
          e.name.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          metaNotes.includes(q)
        );
      }
      return true;
    });
  }, [expenses, searchQuery, opStartDate, opEndDate, expenseMetadata]);

  const opFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (opStartDate || opEndDate) {
      parts.push(`Periode: ${opStartDate || 'Awal'} s/d ${opEndDate || 'Sekarang'}`);
    } else {
      parts.push('Semua Periode');
    }
    if (searchQuery) parts.push(`Pencarian: "${searchQuery}"`);
    return parts.join(' | ');
  }, [opStartDate, opEndDate, searchQuery]);

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  // ==========================================
  // 2. STATE: CICILAN BANK & PEMASOK
  // ==========================================
  const [installmentSubTab, setInstallmentSubTab] = useState<'supplier' | 'bank'>('supplier');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');
  const [billStatusFilter, setBillStatusFilter] = useState<'Semua' | 'Belum Lunas' | 'Lunas'>('Semua');
  const [billSearch, setBillSearch] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<number, boolean>>({});
  const [selectedBillIds, setSelectedBillIds] = useState<Record<string, boolean>>({});

  // Modal: Add Manual Supplier Bill (Single & Multi-Nota)
  const [isAddBillOpen, setAddBillOpen] = useState(false);
  const [addBillMode, setAddBillMode] = useState<'single' | 'multi'>('single');
  const [newBillSupplierId, setNewBillSupplierId] = useState('');
  const [newBillInvoice, setNewBillInvoice] = useState('');
  const [newBillDesc, setNewBillDesc] = useState('');
  const [newBillDate, setNewBillDate] = useState(today);
  const [newBillDueDate, setNewBillDueDate] = useState(today);
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillPriorPaid, setNewBillPriorPaid] = useState('');
  const [newBillPriorDate, setNewBillPriorDate] = useState(today);
  const [newBillPriorNotes, setNewBillPriorNotes] = useState('');
  const [multiBillRows, setMultiBillRows] = useState<Array<{
    key: string;
    invoiceNumber: string;
    description: string;
    date: string;
    dueDate: string;
    totalAmount: string;
    priorPaidAmount: string;
    priorPaidNotes: string;
  }>>([]);

  // Modal: Edit Supplier Bill
  const [editingBill, setEditingBill] = useState<SupplierBill | null>(null);
  const [editBillSupplierId, setEditBillSupplierId] = useState('');
  const [editBillInvoice, setEditBillInvoice] = useState('');
  const [editBillDesc, setEditBillDesc] = useState('');
  const [editBillDate, setEditBillDate] = useState(today);
  const [editBillDueDate, setEditBillDueDate] = useState(today);
  const [editBillAmount, setEditBillAmount] = useState('');
  const [editBillNotes, setEditBillNotes] = useState('');

  // Modal: Pay Supplier Bill (Single) & Multi-Nota Payment & Live History
  const [payingBill, setPayingBill] = useState<SupplierBill | null>(null);
  const [billPayDate, setBillPayDate] = useState(today);
  const [billPayAmount, setBillPayAmount] = useState('');
  const [billPayFunding, setBillPayFunding] = useState<InstallmentFundingSource>('Transfer Bank');
  const [billPayAccountId, setBillPayAccountId] = useState<string>('');
  const [billPayNotes, setBillPayNotes] = useState('');

  const [multiPaySupplier, setMultiPaySupplier] = useState<{ supplierId: number; supplierName: string } | null>(null);
  const [multiPayCheckedIds, setMultiPayCheckedIds] = useState<string[]>([]);
  const [multiPayPriority, setMultiPayPriority] = useState<'dueDate' | 'oldestDate' | 'smallestFirst' | 'largestFirst'>('dueDate');
  const [multiPayAmount, setMultiPayAmount] = useState('');
  const [isMultiPayCustomAmount, setIsMultiPayCustomAmount] = useState(false);
  const [multiPayDate, setMultiPayDate] = useState(today);
  const [multiPayFunding, setMultiPayFunding] = useState<InstallmentFundingSource>('Transfer Bank');
  const [multiPayAccountId, setMultiPayAccountId] = useState<string>('');
  const [multiPayNotes, setMultiPayNotes] = useState('');

  const [historyBillId, setHistoryBillId] = useState<string | null>(null);
  const historyBill = useMemo(
    () => supplierBills.find(b => b.id === historyBillId) || null,
    [supplierBills, historyBillId]
  );

  // Modal: Edit Supplier Bill Payment Row
  const [editingBillPayment, setEditingBillPayment] = useState<{ billId: string; payment: BillPayment } | null>(null);
  const [editBillPayDate, setEditBillPayDate] = useState(today);
  const [editBillPayAmount, setEditBillPayAmount] = useState('');
  const [editBillPayFunding, setEditBillPayFunding] = useState<InstallmentFundingSource>('Transfer Bank');
  const [editBillPayAccountId, setEditBillPayAccountId] = useState('');
  const [editBillPayNotes, setEditBillPayNotes] = useState('');

  // Modal: Add Bank Installment
  const [isAddBankOpen, setAddBankOpen] = useState(false);
  const [bankDebtId, setBankDebtId] = useState<string>('');
  const [bankSyncToDebts, setBankSyncToDebts] = useState(true);
  const [bankName, setBankName] = useState('');
  const [bankCreditLimit, setBankCreditLimit] = useState('');
  const [bankRemaining, setBankRemaining] = useState('');
  const [bankNextDue, setBankNextDue] = useState(today);
  const [bankNotes, setBankNotes] = useState('');

  // Modal: Edit Bank Installment
  const [editingBank, setEditingBank] = useState<BankInstallment | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBankLimit, setEditBankLimit] = useState('');
  const [editBankRemaining, setEditBankRemaining] = useState('');
  const [editBankNextDue, setEditBankNextDue] = useState('');
  const [editBankNotes, setEditBankNotes] = useState('');

  // Modal: Pay Bank Installment (Non-Flat) & Live History
  const [payingBank, setPayingBank] = useState<BankInstallment | null>(null);
  const [bankPayDate, setBankPayDate] = useState(today);
  const [bankPayTotal, setBankPayTotal] = useState('');
  const [bankPayPrincipal, setBankPayPrincipal] = useState('');
  const [bankPayFunding, setBankPayFunding] = useState<InstallmentFundingSource>('Transfer Bank');
  const [bankPayAccountId, setBankPayAccountId] = useState<string>('');
  const [bankPayNextDue, setBankPayNextDue] = useState('');
  const [bankPayNotes, setBankPayNotes] = useState('');
  const [historyBankId, setHistoryBankId] = useState<string | null>(null);
  const historyBank = useMemo(
    () => bankInstallments.find(b => b.id === historyBankId) || null,
    [bankInstallments, historyBankId]
  );

  // Modal: Edit Bank Installment Payment Row
  const [editingBankPayment, setEditingBankPayment] = useState<{ installmentId: string; payment: BankInstallmentPayment } | null>(null);
  const [editBankPayDate, setEditBankPayDate] = useState(today);
  const [editBankPayTotal, setEditBankPayTotal] = useState('');
  const [editBankPayPrincipal, setEditBankPayPrincipal] = useState('');
  const [editBankPayFunding, setEditBankPayFunding] = useState<InstallmentFundingSource>('Transfer Bank');
  const [editBankPayAccountId, setEditBankPayAccountId] = useState('');
  const [editBankPayNotes, setEditBankPayNotes] = useState('');

  // Unlinked debts from Aset & Hutang
  const unlinkedDebts = useMemo(() => {
    const linkedIds = new Set(bankInstallments.map(b => b.debtId).filter(Boolean));
    return debts.filter(d => !linkedIds.has(d.id) && d.value > 0);
  }, [debts, bankInstallments]);

  const supplierBillSummaries = useMemo(() => {
    const map = new Map<number, { supplierId: number; supplierName: string; totalBilled: number; totalPaid: number; remaining: number; openBills: number }>();
    supplierBills.forEach(bill => {
      const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
      const rem = Math.max(0, bill.totalAmount - paid);
      const existing = map.get(bill.supplierId) || {
        supplierId: bill.supplierId,
        supplierName: bill.supplierName,
        totalBilled: 0,
        totalPaid: 0,
        remaining: 0,
        openBills: 0,
      };
      existing.totalBilled += bill.totalAmount;
      existing.totalPaid += paid;
      existing.remaining += rem;
      if (bill.status === 'Belum Lunas') existing.openBills += 1;
      map.set(bill.supplierId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.remaining - a.remaining);
  }, [supplierBills]);

  const totalSupplierDebt = useMemo(
    () => supplierBillSummaries.reduce((s, item) => s + item.remaining, 0),
    [supplierBillSummaries]
  );

  const totalBankDebt = useMemo(
    () => bankInstallments.reduce((s, item) => s + Math.max(0, item.remainingPrincipal), 0),
    [bankInstallments]
  );

  const filteredSupplierBills = useMemo(() => {
    return [...supplierBills]
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Belum Lunas' ? -1 : 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .filter(b => {
        if (selectedSupplierFilter !== 'ALL' && b.supplierId !== Number(selectedSupplierFilter)) return false;
        if (billStatusFilter !== 'Semua' && b.status !== billStatusFilter) return false;
        if (billSearch) {
          const q = billSearch.toLowerCase();
          return (
            b.supplierName.toLowerCase().includes(q) ||
            b.invoiceNumber.toLowerCase().includes(q) ||
            b.description.toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [supplierBills, selectedSupplierFilter, billStatusFilter, billSearch]);

  const groupedSupplierBills = useMemo(() => {
    const map = new Map<
      number,
      {
        supplierId: number;
        supplierName: string;
        bills: SupplierBill[];
        totalBilled: number;
        totalPaid: number;
        remaining: number;
        openCount: number;
        paidCount: number;
        nearestDueDate: string | null;
        hasOverdue: boolean;
      }
    >();

    filteredSupplierBills.forEach(bill => {
      const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
      const rem = Math.max(0, bill.totalAmount - paid);
      const isOverdue = bill.status === 'Belum Lunas' && bill.dueDate < today;
      const existing = map.get(bill.supplierId) || {
        supplierId: bill.supplierId,
        supplierName: bill.supplierName,
        bills: [],
        totalBilled: 0,
        totalPaid: 0,
        remaining: 0,
        openCount: 0,
        paidCount: 0,
        nearestDueDate: null,
        hasOverdue: false,
      };
      existing.bills.push(bill);
      existing.totalBilled += bill.totalAmount;
      existing.totalPaid += paid;
      existing.remaining += rem;
      if (bill.status === 'Belum Lunas') {
        existing.openCount += 1;
        if (!existing.nearestDueDate || bill.dueDate < existing.nearestDueDate) {
          existing.nearestDueDate = bill.dueDate;
        }
        if (isOverdue) existing.hasOverdue = true;
      } else {
        existing.paidCount += 1;
      }
      map.set(bill.supplierId, existing);
    });

    return Array.from(map.values()).sort((a, b) => {
      if ((a.remaining > 0) !== (b.remaining > 0)) return a.remaining > 0 ? -1 : 1;
      return b.remaining - a.remaining;
    });
  }, [filteredSupplierBills, today]);

  const isSupplierGroupExpanded = (supplierId: number) => {
    if (expandedSuppliers[supplierId] !== undefined) return expandedSuppliers[supplierId];
    return selectedSupplierFilter !== 'ALL' || Boolean(billSearch.trim()) || groupedSupplierBills.length === 1;
  };

  const toggleSupplierExpand = (supplierId: number) => {
    setExpandedSuppliers(prev => {
      const current = prev[supplierId] !== undefined
        ? prev[supplierId]
        : (selectedSupplierFilter !== 'ALL' || Boolean(billSearch.trim()) || groupedSupplierBills.length === 1);
      return { ...prev, [supplierId]: !current };
    });
  };

  const handleSetAllGroupsExpanded = (expand: boolean) => {
    const next: Record<number, boolean> = {};
    groupedSupplierBills.forEach(g => {
      next[g.supplierId] = expand;
    });
    setExpandedSuppliers(next);
  };

  const toggleBillSelected = (billId: string) => {
    setSelectedBillIds(prev => ({ ...prev, [billId]: !prev[billId] }));
  };

  const toggleSupplierAllOpenSelected = (openBills: SupplierBill[]) => {
    const allSelected = openBills.length > 0 && openBills.every(b => selectedBillIds[b.id]);
    setSelectedBillIds(prev => {
      const next = { ...prev };
      openBills.forEach(b => {
        next[b.id] = !allSelected;
      });
      return next;
    });
  };

  const createEmptyMultiBillRow = (idx: number) => ({
    key: `MROW-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    invoiceNumber: '',
    description: '',
    date: today,
    dueDate: today,
    totalAmount: '',
    priorPaidAmount: '',
    priorPaidNotes: '',
  });

  const handleOpenAddBill = () => {
    const defaultSupId =
      selectedSupplierFilter !== 'ALL'
        ? selectedSupplierFilter
        : suppliers[0]?.id.toString() || '';
    setAddBillMode('single');
    setNewBillSupplierId(defaultSupId);
    setNewBillInvoice('');
    setNewBillDesc('');
    setNewBillDate(today);
    setNewBillDueDate(today);
    setNewBillAmount('');
    setNewBillPriorPaid('');
    setNewBillPriorDate(today);
    setNewBillPriorNotes('');
    setMultiBillRows([createEmptyMultiBillRow(1), createEmptyMultiBillRow(2)]);
    setAddBillOpen(true);
  };

  const handleSaveManualBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find(s => s.id === Number(newBillSupplierId));
    if (!sup) return;

    if (addBillMode === 'single') {
      const totalAmt = Number(newBillAmount);
      const priorAmt = Number(newBillPriorPaid || 0);
      if (!totalAmt || totalAmt <= 0) return;
      if (priorAmt < 0 || priorAmt > totalAmt) {
        alert('Nominal cicilan lama tidak boleh negatif atau melebihi Total Tagihan.');
        return;
      }
      await onAddSupplierBill({
        invoiceNumber: newBillInvoice.trim() || `TAG-${Date.now().toString().slice(-5)}`,
        supplierId: sup.id,
        supplierName: sup.name,
        description: newBillDesc.trim() || 'Tagihan Pemasok Bahan',
        date: newBillDate,
        dueDate: newBillDueDate,
        totalAmount: totalAmt,
        priorPaidAmount: priorAmt > 0 ? priorAmt : undefined,
        priorPaidDate: priorAmt > 0 ? newBillPriorDate : undefined,
        priorPaidNotes: priorAmt > 0 ? newBillPriorNotes.trim() : undefined,
      });
      setAddBillOpen(false);
      return;
    }

    // Multi-Nota Manual Input Mode
    const filledRows = multiBillRows.filter(
      r => r.invoiceNumber.trim() || r.description.trim() || Number(r.totalAmount || 0) > 0
    );
    if (filledRows.length === 0) {
      alert('Isi minimal 1 baris nota tagihan.');
      return;
    }
    const baseTag = Date.now().toString().slice(-5);
    const billsPayload: Array<Omit<SupplierBill, 'id' | 'payments' | 'status'> & {
      priorPaidAmount?: number;
      priorPaidDate?: string;
      priorPaidNotes?: string;
    }> = [];

    for (let i = 0; i < filledRows.length; i++) {
      const row = filledRows[i];
      const totalAmt = Number(row.totalAmount || 0);
      const priorAmt = Number(row.priorPaidAmount || 0);
      if (!totalAmt || totalAmt <= 0) {
        alert(`Baris nota ke-${i + 1}: Total tagihan harus lebih dari 0.`);
        return;
      }
      if (priorAmt < 0 || priorAmt > totalAmt) {
        alert(`Baris nota ke-${i + 1}: Nominal cicilan lama tidak boleh melebihi total tagihan.`);
        return;
      }
      billsPayload.push({
        invoiceNumber: row.invoiceNumber.trim() || `TAG-${baseTag}-${i + 1}`,
        supplierId: sup.id,
        supplierName: sup.name,
        description: row.description.trim() || 'Tagihan Pemasok Bahan',
        date: row.date || today,
        dueDate: row.dueDate || row.date || today,
        totalAmount: totalAmt,
        priorPaidAmount: priorAmt > 0 ? priorAmt : undefined,
        priorPaidDate: priorAmt > 0 ? newBillPriorDate : undefined,
        priorPaidNotes: priorAmt > 0 ? (row.priorPaidNotes.trim() || undefined) : undefined,
      });
    }

    if (onAddSupplierBillsBatch) {
      await onAddSupplierBillsBatch(billsPayload);
    } else {
      for (const b of billsPayload) {
        await onAddSupplierBill(b);
      }
    }
    setAddBillOpen(false);
  };

  const handleOpenMultiPayModal = (supplierId: number, supplierName: string, preselectedIds?: string[]) => {
    const openBills = supplierBills.filter(b => b.supplierId === supplierId && b.status === 'Belum Lunas');
    if (openBills.length === 0) return;

    const checkedIds =
      preselectedIds && preselectedIds.length > 0
        ? preselectedIds.filter(id => openBills.some(b => b.id === id))
        : openBills.map(b => b.id);

    const totalRem = openBills
      .filter(b => checkedIds.includes(b.id))
      .reduce((sum, b) => {
        const paid = b.payments.reduce((s, p) => s + p.amount, 0);
        return sum + Math.max(0, b.totalAmount - paid);
      }, 0);

    setMultiPaySupplier({ supplierId, supplierName });
    setMultiPayCheckedIds(checkedIds);
    setMultiPayPriority('dueDate');
    setMultiPayAmount(totalRem > 0 ? String(totalRem) : '');
    setIsMultiPayCustomAmount(false);
    setMultiPayDate(today);
    setMultiPayFunding('Transfer Bank');
    setMultiPayAccountId(nonCashAccounts.length === 1 ? nonCashAccounts[0].id : '');
    setMultiPayNotes('');
  };

  const multiPayData = useMemo(() => {
    if (!multiPaySupplier) {
      return {
        openBillsSorted: [] as Array<{ bill: SupplierBill; remaining: number }>,
        selectedTotalRemaining: 0,
        allocations: [] as Array<{
          bill: SupplierBill;
          remainingBefore: number;
          allocated: number;
          remainingAfter: number;
          willBePaidOff: boolean;
        }>,
        effectivePaidAmount: 0,
      };
    }

    const openBills = supplierBills
      .filter(b => b.supplierId === multiPaySupplier.supplierId && b.status === 'Belum Lunas')
      .map(bill => {
        const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
        return { bill, remaining: Math.max(0, bill.totalAmount - paid) };
      })
      .filter(item => item.remaining > 0);

    openBills.sort((a, b) => {
      if (multiPayPriority === 'smallestFirst') return a.remaining - b.remaining;
      if (multiPayPriority === 'largestFirst') return b.remaining - a.remaining;
      if (multiPayPriority === 'oldestDate') {
        return new Date(a.bill.date).getTime() - new Date(b.bill.date).getTime();
      }
      return new Date(a.bill.dueDate).getTime() - new Date(b.bill.dueDate).getTime();
    });

    const checkedItems = openBills.filter(item => multiPayCheckedIds.includes(item.bill.id));
    const selectedTotalRemaining = checkedItems.reduce((s, item) => s + item.remaining, 0);
    const rawPay = Number(multiPayAmount || 0);
    const effectivePaidAmount = Math.max(0, Math.min(rawPay, selectedTotalRemaining));

    let pool = effectivePaidAmount;
    const allocations = checkedItems.map(item => {
      const allocated = Math.min(item.remaining, pool);
      pool = Math.max(0, pool - allocated);
      const remainingAfter = Math.max(0, item.remaining - allocated);
      return {
        bill: item.bill,
        remainingBefore: item.remaining,
        allocated,
        remainingAfter,
        willBePaidOff: allocated > 0 && remainingAfter <= 0,
      };
    });

    return {
      openBillsSorted: openBills,
      selectedTotalRemaining,
      allocations,
      effectivePaidAmount,
    };
  }, [multiPaySupplier, supplierBills, multiPayCheckedIds, multiPayPriority, multiPayAmount]);

  const handleToggleMultiPayCheck = (billId: string) => {
    const nextChecked = multiPayCheckedIds.includes(billId)
      ? multiPayCheckedIds.filter(id => id !== billId)
      : [...multiPayCheckedIds, billId];
    setMultiPayCheckedIds(nextChecked);

    if (!isMultiPayCustomAmount && multiPaySupplier) {
      const nextSum = supplierBills
        .filter(b => b.supplierId === multiPaySupplier.supplierId && nextChecked.includes(b.id))
        .reduce((sum, b) => {
          const paid = b.payments.reduce((s, p) => s + p.amount, 0);
          return sum + Math.max(0, b.totalAmount - paid);
        }, 0);
      setMultiPayAmount(nextSum > 0 ? String(nextSum) : '');
    }
  };

  const handleConfirmMultiPayBills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiPaySupplier) return;
    const rawPay = Number(multiPayAmount || 0);
    if (multiPayData.allocations.length === 0) {
      alert('Centang minimal 1 nota tagihan yang akan dibayar.');
      return;
    }
    if (!rawPay || rawPay <= 0) {
      alert('Masukkan nominal pembayaran yang valid.');
      return;
    }
    if (rawPay > multiPayData.selectedTotalRemaining) {
      alert(`Nominal pembayaran melebihi total sisa nota terpilih (${formatCurrency(multiPayData.selectedTotalRemaining)}).`);
      return;
    }

    const allocations = multiPayData.allocations
      .filter(a => a.allocated > 0)
      .map(a => ({ billId: a.bill.id, amount: a.allocated }));
    if (allocations.length === 0) return;

    const accountName = multiPayFunding === 'Transfer Bank' ? resolveAccountName(multiPayAccountId) : undefined;
    if (onBulkPaySupplierBills) {
      await onBulkPaySupplierBills({
        allocations,
        date: multiPayDate,
        fundingSource: multiPayFunding,
        fundingAccountId: multiPayFunding === 'Transfer Bank' && multiPayAccountId ? multiPayAccountId : undefined,
        fundingAccountName: accountName,
        notes: multiPayNotes.trim() || undefined,
      });
    } else {
      for (const a of allocations) {
        await onPaySupplierBill(a.billId, {
          date: multiPayDate,
          amount: a.amount,
          fundingSource: multiPayFunding,
          fundingAccountId: multiPayFunding === 'Transfer Bank' && multiPayAccountId ? multiPayAccountId : undefined,
          fundingAccountName: accountName,
          notes: multiPayNotes.trim() || undefined,
        });
      }
    }

    // Clear checked IDs for paid bills
    setSelectedBillIds(prev => {
      const next = { ...prev };
      multiPayCheckedIds.forEach(id => {
        delete next[id];
      });
      return next;
    });
    setMultiPaySupplier(null);
  };

  const handleOpenPayBill = (bill: SupplierBill) => {
    const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
    const rem = Math.max(0, bill.totalAmount - paid);
    setPayingBill(bill);
    setBillPayDate(today);
    setBillPayAmount(rem.toString());
    setBillPayFunding('Transfer Bank');
    setBillPayAccountId(nonCashAccounts.length === 1 ? nonCashAccounts[0].id : '');
    setBillPayNotes('');
  };

  const handleOpenEditBill = (bill: SupplierBill) => {
    setEditingBill(bill);
    setEditBillSupplierId(String(bill.supplierId));
    setEditBillInvoice(bill.invoiceNumber);
    setEditBillDesc(bill.description);
    setEditBillDate(bill.date);
    setEditBillDueDate(bill.dueDate);
    setEditBillAmount(String(bill.totalAmount));
    setEditBillNotes(bill.notes || '');
  };

  const handleSaveEditBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill) return;
    const isPurchaseLinked = Boolean(editingBill.purchaseId);
    const sup = suppliers.find(s => s.id === Number(editBillSupplierId));
    const totalAmt = isPurchaseLinked ? editingBill.totalAmount : Number(editBillAmount);
    if (!totalAmt || totalAmt <= 0) {
      alert('Total tagihan harus lebih dari 0.');
      return;
    }
    await onUpdateSupplierBill({
      ...editingBill,
      supplierId: isPurchaseLinked ? editingBill.supplierId : (sup ? sup.id : editingBill.supplierId),
      supplierName: isPurchaseLinked ? editingBill.supplierName : (sup ? sup.name : editingBill.supplierName),
      invoiceNumber: editBillInvoice.trim() || editingBill.invoiceNumber,
      description: editBillDesc.trim() || editingBill.description,
      date: isPurchaseLinked ? editingBill.date : editBillDate,
      dueDate: editBillDueDate,
      totalAmount: totalAmt,
      notes: editBillNotes.trim() || undefined,
    });
    setEditingBill(null);
  };

  const handleOpenEditBillPayment = (billId: string, payment: BillPayment) => {
    setEditingBillPayment({ billId, payment });
    setEditBillPayDate(payment.date);
    setEditBillPayAmount(String(payment.amount));
    setEditBillPayFunding(payment.fundingSource);
    setEditBillPayAccountId(payment.fundingAccountId || '');
    setEditBillPayNotes(payment.notes || '');
  };

  const handleSaveEditBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBillPayment) return;
    const num = parseFloat(editBillPayAmount);
    if (!num || num <= 0) {
      alert('Masukkan nominal pembayaran yang valid.');
      return;
    }
    const accountName = editBillPayFunding === 'Transfer Bank' ? resolveAccountName(editBillPayAccountId) : undefined;
    await onUpdateSupplierBillPayment(editingBillPayment.billId, editingBillPayment.payment.id, {
      date: editBillPayDate,
      amount: num,
      fundingSource: editBillPayFunding,
      fundingAccountId: editBillPayFunding === 'Transfer Bank' && editBillPayAccountId ? editBillPayAccountId : undefined,
      fundingAccountName: accountName,
      notes: editBillPayNotes.trim() || undefined,
    });
    setEditingBillPayment(null);
  };

  const handleConfirmPayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    const num = parseFloat(billPayAmount);
    if (!num || num <= 0) {
      alert('Masukkan nominal pembayaran yang valid.');
      return;
    }
    const accountName = billPayFunding === 'Transfer Bank' ? resolveAccountName(billPayAccountId) : undefined;
    await onPaySupplierBill(payingBill.id, {
      date: billPayDate,
      amount: num,
      fundingSource: billPayFunding,
      fundingAccountId: billPayFunding === 'Transfer Bank' && billPayAccountId ? billPayAccountId : undefined,
      fundingAccountName: accountName,
      notes: billPayNotes.trim() || undefined,
    });
    setPayingBill(null);
  };

  const handleOpenAddBank = (prefillDebt?: DebtItem) => {
    if (prefillDebt) {
      setBankDebtId(prefillDebt.id.toString());
      setBankSyncToDebts(true);
      setBankName(prefillDebt.name);
      setBankCreditLimit(prefillDebt.value.toString());
      setBankRemaining(prefillDebt.value.toString());
    } else {
      setBankDebtId('');
      setBankSyncToDebts(true);
      setBankName('');
      setBankCreditLimit('');
      setBankRemaining('');
    }
    setBankNextDue(today);
    setBankNotes('');
    setAddBankOpen(true);
  };

  const handleDebtSelectionChange = (selectedId: string) => {
    setBankDebtId(selectedId);
    if (selectedId) {
      const found = debts.find(d => d.id === Number(selectedId));
      if (found) {
        setBankName(found.name);
        setBankCreditLimit(found.value.toString());
        setBankRemaining(found.value.toString());
        setBankSyncToDebts(true);
      }
    }
  };

  const handleSaveBankInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = parseFloat(bankCreditLimit) || 0;
    const rem = parseFloat(bankRemaining) || limit;
    if (!bankName.trim() || rem <= 0) {
      alert('Nama bank/kredit dan nominal sisa kredit harus valid.');
      return;
    }
    await onAddBankInstallment({
      debtId: bankDebtId ? Number(bankDebtId) : undefined,
      syncToDebts: bankSyncToDebts,
      name: bankName.trim(),
      creditLimit: limit > 0 ? limit : rem,
      remainingPrincipal: rem,
      nextDueDate: bankNextDue,
      notes: bankNotes.trim() || undefined,
    });
    setAddBankOpen(false);
  };

  const handleOpenEditBank = (inst: BankInstallment) => {
    setEditingBank(inst);
    setEditBankName(inst.name);
    setEditBankLimit(String(inst.creditLimit));
    setEditBankRemaining(String(inst.remainingPrincipal));
    setEditBankNextDue(inst.nextDueDate || '');
    setEditBankNotes(inst.notes || '');
  };

  const handleSaveEditBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank) return;
    const limit = parseFloat(editBankLimit) || 0;
    const rem = parseFloat(editBankRemaining);
    if (!editBankName.trim() || isNaN(rem) || rem < 0) {
      alert('Nama cicilan dan sisa pokok harus valid.');
      return;
    }
    await onUpdateBankInstallment({
      ...editingBank,
      name: editBankName.trim(),
      creditLimit: limit > 0 ? limit : rem,
      remainingPrincipal: rem,
      nextDueDate: editBankNextDue || undefined,
      notes: editBankNotes.trim() || undefined,
    });
    setEditingBank(null);
  };

  const handleOpenPayBank = (inst: BankInstallment) => {
    setPayingBank(inst);
    setBankPayDate(today);
    setBankPayTotal('');
    setBankPayPrincipal('');
    setBankPayFunding('Transfer Bank');
    setBankPayAccountId(nonCashAccounts.length === 1 ? nonCashAccounts[0].id : '');
    if (inst.nextDueDate) {
      const next = new Date(inst.nextDueDate);
      next.setMonth(next.getMonth() + 1);
      setBankPayNextDue(next.toISOString().substring(0, 10));
    } else {
      setBankPayNextDue('');
    }
    setBankPayNotes('');
  };

  const handleBankPayTotalChange = (val: string) => {
    const prevSame = bankPayPrincipal === bankPayTotal;
    setBankPayTotal(val);
    if (prevSame || !bankPayPrincipal) {
      setBankPayPrincipal(val);
    }
  };

  const handleConfirmPayBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBank) return;
    const total = parseFloat(bankPayTotal) || 0;
    const principal = parseFloat(bankPayPrincipal) || 0;
    if (total <= 0) {
      alert('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    if (principal < 0 || principal > total) {
      alert('Porsi pengurang pokok tidak boleh negatif atau melebihi total yang dibayar.');
      return;
    }
    const interest = Math.max(0, total - principal);
    const accountName = bankPayFunding === 'Transfer Bank' ? resolveAccountName(bankPayAccountId) : undefined;
    await onPayBankInstallment(payingBank.id, {
      date: bankPayDate,
      totalPaid: total,
      principalPaid: principal,
      interestPaid: interest,
      fundingSource: bankPayFunding,
      fundingAccountId: bankPayFunding === 'Transfer Bank' && bankPayAccountId ? bankPayAccountId : undefined,
      fundingAccountName: accountName,
      nextDueDate: bankPayNextDue || undefined,
      notes: bankPayNotes.trim() || undefined,
    });
    setPayingBank(null);
  };

  const handleOpenEditBankPayment = (installmentId: string, payment: BankInstallmentPayment) => {
    setEditingBankPayment({ installmentId, payment });
    setEditBankPayDate(payment.date);
    setEditBankPayTotal(String(payment.totalPaid));
    setEditBankPayPrincipal(String(payment.principalPaid));
    setEditBankPayFunding(payment.fundingSource);
    setEditBankPayAccountId(payment.fundingAccountId || '');
    setEditBankPayNotes(payment.notes || '');
  };

  const handleSaveEditBankPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankPayment) return;
    const total = parseFloat(editBankPayTotal) || 0;
    const principal = parseFloat(editBankPayPrincipal) || 0;
    if (total <= 0) {
      alert('Nominal pembayaran harus lebih dari 0.');
      return;
    }
    if (principal < 0 || principal > total) {
      alert('Porsi pengurang pokok tidak boleh negatif atau melebihi total yang dibayar.');
      return;
    }
    const interest = Math.max(0, total - principal);
    const accountName = editBankPayFunding === 'Transfer Bank' ? resolveAccountName(editBankPayAccountId) : undefined;
    await onUpdateBankInstallmentPayment(editingBankPayment.installmentId, editingBankPayment.payment.id, {
      date: editBankPayDate,
      totalPaid: total,
      principalPaid: principal,
      interestPaid: interest,
      fundingSource: editBankPayFunding,
      fundingAccountId: editBankPayFunding === 'Transfer Bank' && editBankPayAccountId ? editBankPayAccountId : undefined,
      fundingAccountName: accountName,
      notes: editBankPayNotes.trim() || undefined,
    });
    setEditingBankPayment(null);
  };

  // ==========================================
  // 3. STATE: PENGELUARAN PRIBADI / LAIN-LAIN
  // ==========================================
  const [privName, setPrivName] = useState('');
  const [privCat, setPrivCat] = useState(PRIVATE_CATEGORIES[0]);
  const [privAmount, setPrivAmount] = useState('');
  const [privDate, setPrivDate] = useState(today);
  const [privFunding, setPrivFunding] = useState<PrivateFundingSource>('Uang Pribadi Owner');
  const [privAccountId, setPrivAccountId] = useState<string>('');
  const [privGuest, setPrivGuest] = useState('');
  const [privNeedsReimburse, setPrivNeedsReimburse] = useState(false);
  const [privNotes, setPrivNotes] = useState('');
  const [privSearch, setPrivSearch] = useState('');
  const [privStartDate, setPrivStartDate] = useState('');
  const [privEndDate, setPrivEndDate] = useState('');

  // Modal: Edit Private Expense
  const [editingPrivate, setEditingPrivate] = useState<PrivateExpenseItem | null>(null);
  const [editPrivName, setEditPrivName] = useState('');
  const [editPrivCat, setEditPrivCat] = useState(PRIVATE_CATEGORIES[0]);
  const [editPrivAmount, setEditPrivAmount] = useState('');
  const [editPrivDate, setEditPrivDate] = useState(today);
  const [editPrivFunding, setEditPrivFunding] = useState<PrivateFundingSource>('Uang Pribadi Owner');
  const [editPrivAccountId, setEditPrivAccountId] = useState('');
  const [editPrivGuest, setEditPrivGuest] = useState('');
  const [editPrivNeedsReimburse, setEditPrivNeedsReimburse] = useState(false);
  const [editPrivReimbursed, setEditPrivReimbursed] = useState(false);
  const [editPrivNotes, setEditPrivNotes] = useState('');

  const handleOpenEditPrivate = (item: PrivateExpenseItem) => {
    setEditingPrivate(item);
    setEditPrivName(item.name);
    setEditPrivCat(item.category);
    setEditPrivAmount(String(item.amount));
    setEditPrivDate(item.date);
    setEditPrivFunding(item.fundingSource);
    setEditPrivAccountId(item.fundingAccountId || '');
    setEditPrivGuest(item.guestOrEvent || '');
    setEditPrivNeedsReimburse(Boolean(item.needsReimburse));
    setEditPrivReimbursed(Boolean(item.reimbursed));
    setEditPrivNotes(item.notes || '');
  };

  const handleSaveEditPrivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrivate) return;
    if (!editPrivName.trim() || !editPrivAmount) {
      alert('Nama keperluan dan nominal tidak boleh kosong.');
      return;
    }
    const accountName = editPrivFunding === 'Transfer Bank' ? resolveAccountName(editPrivAccountId) : undefined;
    await onUpdatePrivateExpense({
      ...editingPrivate,
      name: editPrivName.trim(),
      category: editPrivCat,
      amount: Number(editPrivAmount),
      date: editPrivDate,
      fundingSource: editPrivFunding,
      fundingAccountId: editPrivFunding === 'Transfer Bank' && editPrivAccountId ? editPrivAccountId : undefined,
      fundingAccountName: accountName,
      guestOrEvent: editPrivGuest.trim() || undefined,
      needsReimburse: editPrivFunding === 'Uang Pribadi Owner' ? editPrivNeedsReimburse : false,
      reimbursed: editPrivFunding === 'Uang Pribadi Owner' && editPrivNeedsReimburse ? editPrivReimbursed : false,
      notes: editPrivNotes.trim() || undefined,
    });
    setEditingPrivate(null);
  };

  const handlePrivSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privName.trim() || !privAmount) {
      alert('Nama keperluan dan nominal tidak boleh kosong.');
      return;
    }
    const accountName = privFunding === 'Transfer Bank' ? resolveAccountName(privAccountId) : undefined;
    await onAddPrivateExpense({
      name: privName.trim(),
      category: privCat,
      amount: Number(privAmount),
      date: privDate,
      fundingSource: privFunding,
      fundingAccountId: privFunding === 'Transfer Bank' && privAccountId ? privAccountId : undefined,
      fundingAccountName: accountName,
      guestOrEvent: privGuest.trim() || undefined,
      needsReimburse: privFunding === 'Uang Pribadi Owner' ? privNeedsReimburse : false,
      reimbursed: false,
      notes: privNotes.trim() || undefined,
    });
    setPrivName('');
    setPrivAmount('');
    setPrivDate(today);
    setPrivGuest('');
    setPrivNeedsReimburse(false);
    setPrivNotes('');
  };

  const filteredPrivateExpenses = useMemo(() => {
    const sorted = [...privateExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted.filter(p => {
      if (privStartDate && p.date < privStartDate) return false;
      if (privEndDate && p.date > privEndDate) return false;
      if (privSearch) {
        const q = privSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.guestOrEvent || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [privateExpenses, privSearch, privStartDate, privEndDate]);

  const privFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (privStartDate || privEndDate) {
      parts.push(`Periode: ${privStartDate || 'Awal'} s/d ${privEndDate || 'Sekarang'}`);
    } else {
      parts.push('Semua Periode');
    }
    if (privSearch) parts.push(`Pencarian: "${privSearch}"`);
    return parts.join(' | ');
  }, [privStartDate, privEndDate, privSearch]);

  const supplierFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedSupplierFilter !== 'ALL') {
      const supName =
        suppliers.find(s => s.id === Number(selectedSupplierFilter))?.name ||
        supplierBills.find(b => b.supplierId === Number(selectedSupplierFilter))?.supplierName ||
        'Pemasok Terpilih';
      parts.push(`Pemasok: ${supName}`);
    } else {
      parts.push('Semua Pemasok');
    }
    parts.push(`Status: ${billStatusFilter}`);
    if (billSearch) parts.push(`Cari: "${billSearch}"`);
    return parts.join(' | ');
  }, [selectedSupplierFilter, billStatusFilter, billSearch, suppliers, supplierBills]);

  const privateStats = useMemo(() => {
    const total = privateExpenses.reduce((s, p) => s + p.amount, 0);
    const fromStore = privateExpenses.filter(p => p.fundingSource !== 'Uang Pribadi Owner').reduce((s, p) => s + p.amount, 0);
    const pendingReimburse = privateExpenses
      .filter(p => p.fundingSource === 'Uang Pribadi Owner' && p.needsReimburse && !p.reimbursed)
      .reduce((s, p) => s + p.amount, 0);
    return { total, fromStore, pendingReimburse };
  }, [privateExpenses]);

  // ==========================================
  // RENDERERS
  // ==========================================
  const renderOperationalTab = () => {
    let lastDate: string | null = null;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-xl shadow-md h-full border">
            <h2 className="text-xl font-bold mb-1">Catat Pengeluaran Operasional</h2>
            <p className="text-xs text-gray-500 mb-4">Untuk biaya operasional rutin toko & kantor. Masuk ke Laba Rugi usaha.</p>
            <form onSubmit={handleOpSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Pengeluaran</label>
                <input
                  type="text"
                  value={expenseName}
                  onChange={e => setExpenseName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                  placeholder="e.g., Makan Siang Karyawan"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategori</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                >
                  {OPERATIONAL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                    placeholder="50000"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select
                  value={opFundingSource}
                  onChange={e => setOpFundingSource(e.target.value as ExpenseFundingSource)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="Kas Laci">Kas Laci (Tunai) — Memotong Laci</option>
                  <option value="Transfer Bank">Transfer Bank / Non-Laci — Tidak Memotong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                </select>
              </div>
              {opFundingSource === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={opAccountId}
                    onChange={e => setOpAccountId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-md shadow-sm text-sm focus:ring-pink-500 focus:border-pink-500"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan (Opsional)</label>
                <input
                  type="text"
                  value={opNotes}
                  onChange={e => setOpNotes(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm"
                  placeholder="Keterangan tambahan..."
                />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700 transition-colors">
                  Simpan Pengeluaran Operasional
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col border">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">Riwayat Pengeluaran Operasional</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPrintPreview(
                      'Laporan Pengeluaran Operasional',
                      buildOperationalExpensesHtml(filteredExpenses, expenseMetadata, opFilterLabel, storeInfo),
                      () => exportOperationalExpensesExcel(filteredExpenses, expenseMetadata, opFilterLabel)
                    )
                  }
                  disabled={filteredExpenses.length === 0}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-40"
                >
                  <PrinterIcon className="h-4 w-4 mr-1.5 text-pink-600" /> Cetak
                </button>
                <button
                  type="button"
                  onClick={() => exportOperationalExpensesExcel(filteredExpenses, expenseMetadata, opFilterLabel)}
                  disabled={filteredExpenses.length === 0}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Export Excel
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari pengeluaran..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
              <input
                type="date"
                value={opStartDate}
                onChange={e => setOpStartDate(e.target.value)}
                title="Dari Tanggal"
                className="px-2.5 py-2 border rounded-lg text-xs text-gray-700"
              />
              <input
                type="date"
                value={opEndDate}
                onChange={e => setOpEndDate(e.target.value)}
                title="Sampai Tanggal"
                className="px-2.5 py-2 border rounded-lg text-xs text-gray-700"
              />
              {(opStartDate || opEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setOpStartDate('');
                    setOpEndDate('');
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Reset Tgl
                </button>
              )}
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full bg-white text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Kategori & Sumber</th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedExpenses.map(exp => {
                    const showDate = exp.date !== lastDate;
                    lastDate = exp.date;
                    const meta = expenseMetadata[exp.id];
                    const funding = meta?.fundingSource || 'Kas Laci';
                    return (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                          {showDate ? new Date(exp.date).toLocaleDateString('id-ID') : ''}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">{exp.name}</p>
                          {meta?.purchaseId && (
                            <span className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold mt-0.5">
                              Otomatis dari Barang Masuk
                            </span>
                          )}
                          {meta?.ownerTxId && (
                            <span className="inline-block text-[10px] bg-fuchsia-50 text-fuchsia-700 px-1.5 py-0.5 rounded font-semibold mt-0.5">
                              Otomatis dari Owner Dashboard
                            </span>
                          )}
                          {meta?.notes && <p className="text-xs text-gray-400">{meta.notes}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-gray-700">{exp.category}</p>
                          <span
                            className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                              funding === 'Kas Laci'
                                ? 'bg-amber-100 text-amber-800'
                                : funding === 'Kas Dipegang Owner'
                                ? 'bg-fuchsia-100 text-fuchsia-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {funding}{meta?.fundingAccountName ? ` • ${meta.fundingAccountName}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-semibold text-red-600 text-right">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditOpExpense(exp)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit Pengeluaran"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (meta?.purchaseId) {
                                  alert('Pengeluaran ini tercatat otomatis dari menu Pembelian / Barang Masuk. Hapus transaksinya dari menu Pembelian / Barang Masuk agar stok inventori ikut dikembalikan dengan benar.');
                                  return;
                                }
                                if (window.confirm(`Hapus pengeluaran "${exp.name}" sebesar ${formatCurrency(exp.amount)}?`)) {
                                  onDeleteExpense(exp.id);
                                }
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title={meta?.purchaseId ? 'Hapus melalui menu Pembelian / Barang Masuk' : 'Hapus Pengeluaran'}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {paginatedExpenses.length === 0 && (
                <div className="text-center py-12 text-gray-500">Tidak ada data pengeluaran operasional yang cocok.</div>
              )}
            </div>
            <Pagination
              totalItems={filteredExpenses.length}
              itemsPerPage={ITEMS_PER_PAGE}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderInstallmentsTab = () => (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-amber-500 to-orange-600">
          <p className="text-sm font-medium text-white/90">Total Sisa Hutang Pemasok (Supplier)</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalSupplierDebt)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-purple-500 to-indigo-600">
          <p className="text-sm font-medium text-white/90">Total Sisa Pokok Cicilan Bank</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalBankDebt)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-rose-500 to-red-600">
          <p className="text-sm font-medium text-white/90">Total Kewajiban Cicilan Aktif</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalSupplierDebt + totalBankDebt)}</p>
        </div>
      </div>

      {/* Sub-tab switch */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        <button
          onClick={() => setInstallmentSubTab('supplier')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            installmentSubTab === 'supplier'
              ? 'bg-pink-600 text-white shadow'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Hutang & Tagihan Pemasok ({supplierBills.filter(b => b.status === 'Belum Lunas').length} Aktif)
        </button>
        <button
          onClick={() => setInstallmentSubTab('bank')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            installmentSubTab === 'bank'
              ? 'bg-pink-600 text-white shadow'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cicilan Bank / Kredit ({bankInstallments.filter(b => b.status === 'Aktif').length} Aktif)
        </button>
      </div>

      {installmentSubTab === 'supplier' ? (
        <div className="space-y-6">
          {/* Rekap Per Pemasok */}
          {supplierBillSummaries.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Rekap Hutang Per Pemasok (Dari Data Supplier)</h3>
                {selectedSupplierFilter !== 'ALL' && (
                  <button
                    onClick={() => setSelectedSupplierFilter('ALL')}
                    className="text-xs text-pink-600 hover:underline font-semibold"
                  >
                    Tampilkan Semua Pemasok
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {supplierBillSummaries.map(sum => (
                  <div
                    key={sum.supplierId}
                    onClick={() =>
                      setSelectedSupplierFilter(prev =>
                        prev === sum.supplierId.toString() ? 'ALL' : sum.supplierId.toString()
                      )
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedSupplierFilter === sum.supplierId.toString()
                        ? 'border-pink-500 bg-pink-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-pink-300'
                    }`}
                  >
                    <p className="font-bold text-gray-800 truncate">{sum.supplierName}</p>
                    <p className="text-lg font-extrabold text-red-600 mt-1">{formatCurrency(sum.remaining)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sum.openBills} faktur belum lunas &bull; Terbayar {formatCurrency(sum.totalPaid)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daftar Tagihan Pemasok */}
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Daftar Tagihan Pemasok Bahan</h3>
                <p className="text-xs text-gray-500">Terisi otomatis dari menu Pembelian / Barang Masuk (Kredit) atau input manual.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPrintPreview(
                      'Rekap Tagihan & Cicilan Pemasok',
                      buildSupplierBillsRecapHtml(filteredSupplierBills, supplierFilterLabel, storeInfo),
                      () => exportSupplierBillsExcel(filteredSupplierBills, supplierFilterLabel)
                    )
                  }
                  disabled={filteredSupplierBills.length === 0}
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-40"
                >
                  <PrinterIcon className="h-4 w-4 mr-1.5 text-pink-600" /> Cetak Rekap
                </button>
                <button
                  type="button"
                  onClick={() => exportSupplierBillsExcel(filteredSupplierBills, supplierFilterLabel)}
                  disabled={filteredSupplierBills.length === 0}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Export Excel
                </button>
                <button
                  onClick={handleOpenAddBill}
                  disabled={suppliers.length === 0}
                  className="inline-flex items-center bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-pink-700 disabled:bg-gray-300"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1.5" /> Tambah Tagihan Pemasok
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={billSearch}
                  onChange={e => setBillSearch(e.target.value)}
                  placeholder="Cari faktur, supplier, deskripsi..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <select
                value={billStatusFilter}
                onChange={e => setBillStatusFilter(e.target.value as 'Semua' | 'Belum Lunas' | 'Lunas')}
                className="p-2 border rounded-lg text-sm bg-white"
              >
                <option value="Semua">Semua Status</option>
                <option value="Belum Lunas">Belum Lunas</option>
                <option value="Lunas">Lunas</option>
              </select>
              {groupedSupplierBills.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetAllGroupsExpanded(true)}
                    className="px-2.5 py-2 border rounded-lg text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100"
                  >
                    Buka Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllGroupsExpanded(false)}
                    className="px-2.5 py-2 border rounded-lg text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100"
                  >
                    Tutup Semua
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {groupedSupplierBills.map(group => {
                const isExpanded = isSupplierGroupExpanded(group.supplierId);
                const openBills = group.bills.filter(b => b.status === 'Belum Lunas');
                const selectedOpenBills = openBills.filter(b => selectedBillIds[b.id]);
                const selectedOpenTotal = selectedOpenBills.reduce((sum, b) => {
                  const paid = b.payments.reduce((s, p) => s + p.amount, 0);
                  return sum + Math.max(0, b.totalAmount - paid);
                }, 0);
                const allOpenSelected = openBills.length > 0 && selectedOpenBills.length === openBills.length;

                return (
                  <div
                    key={group.supplierId}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      group.remaining > 0 ? 'border-gray-200 bg-white' : 'border-emerald-200 bg-emerald-50/20'
                    }`}
                  >
                    {/* Supplier Group Header (1 row per supplier) */}
                    <div
                      onClick={() => toggleSupplierExpand(group.supplierId)}
                      className={`p-4 flex flex-wrap justify-between items-center gap-3 cursor-pointer select-none transition-colors ${
                        isExpanded ? 'bg-gray-50 border-b border-gray-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`p-1.5 rounded-lg border bg-white text-gray-600 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          <ChevronDownIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-gray-900 text-base truncate">{group.supplierName}</h4>
                            {group.openCount > 0 ? (
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800">
                                {group.openCount} Nota Belum Lunas
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-green-100 text-green-800">
                                Semua Lunas ({group.paidCount} Nota)
                              </span>
                            )}
                            {group.openCount > 0 && group.paidCount > 0 && (
                              <span className="text-[11px] text-gray-500">• {group.paidCount} Lunas</span>
                            )}
                            {group.hasOverdue && (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-red-100 text-red-700">
                                ADA LEWAT JT
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Total Nota: <b>{formatCurrency(group.totalBilled)}</b> &bull; Sudah Dibayar:{' '}
                            <b className="text-emerald-700">{formatCurrency(group.totalPaid)}</b>
                            {group.nearestDueDate && (
                              <> &bull; JT Terdekat: <b>{new Date(group.nearestDueDate).toLocaleDateString('id-ID')}</b></>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 ml-auto" onClick={e => e.stopPropagation()}>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-500 uppercase font-semibold">Sisa Hutang Supplier</p>
                          <p className={`text-lg font-extrabold ${group.remaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {formatCurrency(group.remaining)}
                          </p>
                        </div>

                        {group.openCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenMultiPayModal(
                                group.supplierId,
                                group.supplierName,
                                selectedOpenBills.length > 0 ? selectedOpenBills.map(b => b.id) : undefined
                              )
                            }
                            className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
                          >
                            <CreditCardIcon className="h-4 w-4 mr-1.5" />
                            {selectedOpenBills.length > 0
                              ? `Bayar Terpilih (${selectedOpenBills.length})`
                              : 'Bayar Multi-Nota'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleOpenPrintPreview(
                              `Rekap Tagihan ${group.supplierName}`,
                              buildSupplierBillsRecapHtml(group.bills, `Pemasok: ${group.supplierName} | Status: ${billStatusFilter}`, storeInfo),
                              () => exportSupplierBillsExcel(group.bills, group.supplierName)
                            )
                          }
                          className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          title={`Cetak Rekap Gabungan ${group.supplierName}`}
                        >
                          <PrinterIcon className="h-4 w-4 text-pink-600" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Multi-Nota List for This Supplier */}
                    {isExpanded && (
                      <div className="p-3 bg-white">
                        {selectedOpenBills.length > 0 && (
                          <div className="mb-3 p-3 rounded-lg bg-pink-50 border border-pink-200 flex flex-wrap justify-between items-center gap-2">
                            <div className="text-xs text-pink-900">
                              <b>{selectedOpenBills.length} nota</b> dipilih untuk <b>{group.supplierName}</b> &bull; Total Sisa:{' '}
                              <b className="text-red-600 text-sm">{formatCurrency(selectedOpenTotal)}</b>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedBillIds(prev => {
                                    const next = { ...prev };
                                    openBills.forEach(b => {
                                      delete next[b.id];
                                    });
                                    return next;
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-pink-300 text-pink-700 text-xs font-semibold hover:bg-pink-100"
                              >
                                Batal Pilih
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenMultiPayModal(
                                    group.supplierId,
                                    group.supplierName,
                                    selectedOpenBills.map(b => b.id)
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 shadow-sm"
                              >
                                Bayar / Cicil Nota Terpilih →
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-2.5 px-2.5 text-center w-9">
                                  {openBills.length > 0 && (
                                    <input
                                      type="checkbox"
                                      checked={allOpenSelected}
                                      onChange={() => toggleSupplierAllOpenSelected(openBills)}
                                      title="Pilih semua nota belum lunas milik supplier ini"
                                      className="h-4 w-4 text-pink-600 rounded cursor-pointer"
                                    />
                                  )}
                                </th>
                                <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase">No. Faktur & Tgl</th>
                                <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase">Keterangan</th>
                                <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 uppercase">Jatuh Tempo</th>
                                <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase">Total & Dibayar</th>
                                <th className="py-2.5 px-3 text-right text-xs font-medium text-gray-500 uppercase">Sisa Tagihan</th>
                                <th className="py-2.5 px-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="py-2.5 px-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {group.bills.map(bill => {
                                const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
                                const remaining = Math.max(0, bill.totalAmount - paid);
                                const isOverdue = bill.status === 'Belum Lunas' && bill.dueDate < today;
                                const isChecked = Boolean(selectedBillIds[bill.id]);

                                return (
                                  <tr key={bill.id} className={isChecked ? 'bg-pink-50/60' : 'hover:bg-gray-50'}>
                                    <td className="py-2.5 px-2.5 text-center">
                                      {bill.status === 'Belum Lunas' ? (
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleBillSelected(bill.id)}
                                          className="h-4 w-4 text-pink-600 rounded cursor-pointer"
                                        />
                                      ) : (
                                        <span className="text-gray-300 text-xs">-</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <p className="font-bold text-gray-800">{bill.invoiceNumber}</p>
                                      <p className="text-xs text-gray-500">{new Date(bill.date).toLocaleDateString('id-ID')}</p>
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <p className="text-gray-700 max-w-[220px] truncate">{bill.description}</p>
                                      {bill.purchaseId && (
                                        <span className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold mt-0.5">
                                          Dari Pembelian
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className={`font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                                        {new Date(bill.dueDate).toLocaleDateString('id-ID')}
                                      </span>
                                      {isOverdue && <span className="block text-[10px] text-red-600 font-bold">LEWAT JATUH TEMPO</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                      <p className="font-medium">{formatCurrency(bill.totalAmount)}</p>
                                      <p className="text-[11px] text-green-600">Dibayar: {formatCurrency(paid)}</p>
                                    </td>
                                    <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${remaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                      {formatCurrency(remaining)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                          bill.status === 'Lunas' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        {bill.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                      <div className="inline-flex items-center space-x-1">
                                        {bill.status === 'Belum Lunas' && (
                                          <button
                                            onClick={() => handleOpenPayBill(bill)}
                                            className="bg-emerald-600 text-white px-2.5 py-1 rounded text-xs font-bold hover:bg-emerald-700"
                                          >
                                            Bayar
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOpenPrintPreview(
                                              `Kartu Hutang ${bill.supplierName} (${bill.invoiceNumber})`,
                                              buildSupplierBillStatementHtml(bill, storeInfo),
                                              () => exportSupplierBillDetailExcel(bill)
                                            )
                                          }
                                          className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                                          title="Cetak Bukti & Kartu Hutang Faktur Ini"
                                        >
                                          <PrinterIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => setHistoryBillId(bill.id)}
                                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                          title="Riwayat & Edit Cicilan Pembayaran"
                                        >
                                          <EyeIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleOpenEditBill(bill)}
                                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                                          title="Edit Info Tagihan"
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (bill.purchaseId) {
                                              alert('Tagihan ini dibuat otomatis dari menu Pembelian / Barang Masuk. Hapus transaksinya melalui menu Pembelian / Barang Masuk agar stok inventori ikut dikembalikan.');
                                              return;
                                            }
                                            if (window.confirm(`Hapus tagihan "${bill.invoiceNumber}" dari ${bill.supplierName}?`)) {
                                              onDeleteSupplierBill(bill.id);
                                            }
                                          }}
                                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                                          title={bill.purchaseId ? 'Hapus melalui menu Pembelian / Barang Masuk' : 'Hapus Tagihan'}
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {groupedSupplierBills.length === 0 && (
                <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-xl">
                  Belum ada tagihan pemasok bahan.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SUB-TAB B: CICILAN BANK */
        <div className="space-y-6">
          {/* Import/Link prompt from Aset dan Hutang */}
          {unlinkedDebts.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm">Daftar Hutang dari Menu "Aset dan Hutang" Tersedia untuk Dicicil</h4>
                  <p className="text-xs text-indigo-700">
                    Klik untuk menghubungkan data hutang tersebut agar pembayaran cicilannya otomatis mengurangi sisa hutang di Laporan Aset & Hutang.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {unlinkedDebts.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleOpenAddBank(d)}
                    className="inline-flex items-center bg-white border border-indigo-300 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-100"
                  >
                    + Atur Cicilan: {d.name} ({formatCurrency(d.value)})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-xl shadow-md border">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Daftar Cicilan Bank / Leasing (Angsuran Fleksibel / Non-Flat)</h3>
                <p className="text-xs text-gray-500">
                  Isi jumlah kredit awal dan catat nominal angsuran + tanggal sesuai tagihan bulan berjalan. Tersinkron dengan Aset &amp; Hutang (Owner Dashboard &amp; Laporan Neraca).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPrintPreview(
                      'Rekap Cicilan Bank & Leasing',
                      buildBankInstallmentsListHtml(bankInstallments, storeInfo),
                      () => exportBankInstallmentsExcel(bankInstallments)
                    )
                  }
                  disabled={bankInstallments.length === 0}
                  className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-40"
                >
                  <PrinterIcon className="h-4 w-4 mr-1.5 text-pink-600" /> Cetak Rekap
                </button>
                <button
                  type="button"
                  onClick={() => exportBankInstallmentsExcel(bankInstallments)}
                  disabled={bankInstallments.length === 0}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Export Excel
                </button>
                <button
                  onClick={() => handleOpenAddBank()}
                  className="inline-flex items-center bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-pink-700"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1.5" /> Tambah Cicilan Bank
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankInstallments.map(inst => {
                const totalPaidAll = inst.payments.reduce((s, p) => s + p.totalPaid, 0);
                const totalPrincipalPaid = inst.payments.reduce((s, p) => s + p.principalPaid, 0);
                const totalInterestPaid = inst.payments.reduce((s, p) => s + p.interestPaid, 0);
                const progress = inst.creditLimit > 0 ? Math.min(100, Math.round(((inst.creditLimit - inst.remainingPrincipal) / inst.creditLimit) * 100)) : 0;
                const isOverdue = inst.status === 'Aktif' && inst.nextDueDate && inst.nextDueDate < today;

                return (
                  <div key={inst.id} className="border rounded-xl p-5 bg-gray-50/60 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-lg text-gray-800">{inst.name}</h4>
                            {inst.debtId && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
                                Sinkron Aset & Hutang
                              </span>
                            )}
                          </div>
                          {inst.nextDueDate && (
                            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                              Jatuh Tempo Berikutnya: {new Date(inst.nextDueDate).toLocaleDateString('id-ID')}
                              {isOverdue && ' (LEWAT JATUH TEMPO)'}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                            inst.status === 'Lunas' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                        <div className="bg-white p-2.5 rounded-lg border">
                          <p className="text-xs text-gray-500">Jumlah Kredit Awal</p>
                          <p className="font-bold text-gray-800">{formatCurrency(inst.creditLimit)}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border">
                          <p className="text-xs text-gray-500">Sisa Pokok Kredit</p>
                          <p className="font-bold text-red-600">{formatCurrency(inst.remainingPrincipal)}</p>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Pelunasan Pokok ({progress}%)</span>
                          <span>{inst.payments.length}x angsuran</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-pink-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Total Bayar: <b>{formatCurrency(totalPaidAll)}</b></span>
                        <span>Pokok: <b>{formatCurrency(totalPrincipalPaid)}</b></span>
                        <span>Bunga/Admin: <b>{formatCurrency(totalInterestPaid)}</b></span>
                      </div>
                      {inst.notes && <p className="text-xs text-gray-500 mt-1 italic">{inst.notes}</p>}
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t">
                      <div className="space-x-2">
                        <button
                          onClick={() => setHistoryBankId(inst.id)}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Riwayat & Edit Angsuran ({inst.payments.length})
                        </button>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {inst.status === 'Aktif' && (
                          <button
                            onClick={() => handleOpenPayBank(inst)}
                            className="inline-flex items-center bg-pink-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-pink-700"
                          >
                            <CreditCardIcon className="h-4 w-4 mr-1" /> Bayar Angsuran
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditBank(inst)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Edit Cicilan Bank"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Hapus cicilan bank "${inst.name}"?`)) {
                              onDeleteBankInstallment(inst.id);
                            }
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Hapus Cicilan"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {bankInstallments.length === 0 && (
                <div className="md:col-span-2 text-center py-12 text-gray-500 border-2 border-dashed rounded-xl">
                  Belum ada data cicilan bank. Klik <b>"+ Tambah Cicilan Bank"</b> atau impor dari daftar Hutang di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPrivateTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-slate-600 to-gray-800">
          <p className="text-sm font-medium text-white/90">Total Pengeluaran Pribadi / Non-Opr</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(privateStats.total)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-pink-500 to-rose-600">
          <p className="text-sm font-medium text-white/90">Keluar dari Kas / Rekening Toko</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(privateStats.fromStore)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-teal-500 to-emerald-600">
          <p className="text-sm font-medium text-white/90">Dana Pribadi Owner (Perlu Reimburse)</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(privateStats.pendingReimburse)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white p-6 rounded-xl shadow-md border">
            <h2 className="text-xl font-bold mb-1">Catat Pengeluaran Pribadi / Non-Operasional</h2>
            <p className="text-xs text-gray-500 mb-4">
              Untuk jamuan klien, hotel teknisi/tamu, perjalanan bisnis, atau prive owner. Tidak mengganggu Laba Operasional toko.
            </p>
            <form onSubmit={handlePrivSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Keperluan / Nama Pengeluaran</label>
                <input
                  type="text"
                  value={privName}
                  onChange={e => setPrivName(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="e.g., Hotel Teknisi Mesin & Jamuan Makan"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategori Non-Operasional</label>
                <select
                  value={privCat}
                  onChange={e => setPrivCat(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  {PRIVATE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={privAmount}
                    onChange={e => setPrivAmount(e.target.value)}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                    placeholder="500000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input
                    type="date"
                    value={privDate}
                    onChange={e => setPrivDate(e.target.value)}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select
                  value={privFunding}
                  onChange={e => setPrivFunding(e.target.value as PrivateFundingSource)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="Uang Pribadi Owner">Uang Pribadi Owner (Tidak Potong Kas Toko)</option>
                  <option value="Transfer Bank">Transfer Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                </select>
              </div>
              {privFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={privAccountId}
                    onChange={e => setPrivAccountId(e.target.value)}
                    className="mt-1 w-full p-2 border border-indigo-300 bg-indigo-50/40 rounded-md text-sm"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {privFunding === 'Uang Pribadi Owner' && (
                <label className="flex items-center space-x-2 text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border">
                  <input
                    type="checkbox"
                    checked={privNeedsReimburse}
                    onChange={e => setPrivNeedsReimburse(e.target.checked)}
                    className="h-4 w-4 text-pink-600 rounded"
                  />
                  <span>Tandai perlu Reimburse / diganti dari kas toko nanti</span>
                </label>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Tamu / Klien / Event (Opsional)</label>
                <input
                  type="text"
                  value={privGuest}
                  onChange={e => setPrivGuest(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="e.g., Pak Budi (Teknisi Mimaki)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan Tambahan</label>
                <input
                  type="text"
                  value={privNotes}
                  onChange={e => setPrivNotes(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Keterangan tambahan..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700 transition-colors"
              >
                Simpan Pengeluaran Non-Operasional
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white p-6 rounded-xl shadow-md border h-full flex flex-col">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="text-xl font-bold">Riwayat Pengeluaran Pribadi & Jamuan</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPrintPreview(
                      'Laporan Pengeluaran Pribadi & Non-Operasional',
                      buildPrivateExpensesHtml(filteredPrivateExpenses, privFilterLabel, storeInfo),
                      () => exportPrivateExpensesExcel(filteredPrivateExpenses, privFilterLabel)
                    )
                  }
                  disabled={filteredPrivateExpenses.length === 0}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50 disabled:opacity-40"
                >
                  <PrinterIcon className="h-4 w-4 mr-1.5 text-pink-600" /> Cetak
                </button>
                <button
                  type="button"
                  onClick={() => exportPrivateExpensesExcel(filteredPrivateExpenses, privFilterLabel)}
                  disabled={filteredPrivateExpenses.length === 0}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Export Excel
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari keperluan, kategori, nama tamu..."
                  value={privSearch}
                  onChange={e => setPrivSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
              <input
                type="date"
                value={privStartDate}
                onChange={e => setPrivStartDate(e.target.value)}
                title="Dari Tanggal"
                className="px-2.5 py-2 border rounded-lg text-xs text-gray-700"
              />
              <input
                type="date"
                value={privEndDate}
                onChange={e => setPrivEndDate(e.target.value)}
                title="Sampai Tanggal"
                className="px-2.5 py-2 border rounded-lg text-xs text-gray-700"
              />
              {(privStartDate || privEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setPrivStartDate('');
                    setPrivEndDate('');
                  }}
                  className="px-2.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Reset Tgl
                </button>
              )}
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Keperluan & Tamu</th>
                    <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Sumber Dana</th>
                    <th className="py-3 px-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="py-3 px-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPrivateExpenses.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3 whitespace-nowrap text-gray-500">
                        {new Date(item.date).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.category}
                          {item.guestOrEvent && ` • Tamu: ${item.guestOrEvent}`}
                        </p>
                        {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                            item.fundingSource === 'Kas Laci'
                              ? 'bg-amber-100 text-amber-800'
                              : item.fundingSource === 'Transfer Bank'
                              ? 'bg-indigo-100 text-indigo-800'
                              : item.fundingSource === 'Kas Dipegang Owner'
                              ? 'bg-fuchsia-100 text-fuchsia-800'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                        >
                          {item.fundingSource}{item.fundingAccountName ? ` • ${item.fundingAccountName}` : ''}
                        </span>
                        {item.needsReimburse && (
                          <button
                            onClick={() => onToggleReimbursePrivateExpense(item.id)}
                            className={`block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                              item.reimbursed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            }`}
                          >
                            {item.reimbursed ? 'Sudah Direimburse' : 'Tandai Sudah Reimburse'}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-800 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPrivate(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit Pengeluaran Pribadi"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus catatan "${item.name}"?`)) {
                                onDeletePrivateExpense(item.id);
                              }
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hapus Pengeluaran Pribadi"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPrivateExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        Belum ada catatan pengeluaran pribadi / non-operasional.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Main Tabs */}
      {accessibleTabs.length > 0 ? (
        <>
          <div className="bg-white px-6 pt-4 rounded-xl shadow-md">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                {accessibleTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`${
                      activeTab === tab.key
                        ? 'border-pink-600 text-pink-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {activeTab === 'operational' && renderOperationalTab()}
          {activeTab === 'installments' && renderInstallmentsTab()}
          {activeTab === 'private' && renderPrivateTab()}
        </>
      ) : (
        <div className="bg-white p-8 rounded-xl shadow-md text-center text-gray-500">
          Anda tidak memiliki izin akses untuk tab pengeluaran mana pun.
        </div>
      )}

      {/* MODAL: ADD MANUAL SUPPLIER BILL (SINGLE & MULTI-NOTA) */}
      {isAddBillOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setAddBillOpen(false)}>
          <div
            className={`bg-white rounded-xl shadow-2xl p-6 w-full ${
              addBillMode === 'multi' ? 'max-w-4xl' : 'max-w-md'
            } max-h-[90vh] overflow-y-auto`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold">Tambah Tagihan Pemasok Manual</h3>
                <p className="text-xs text-gray-500">Bisa input 1 faktur atau banyak nota sekaligus untuk 1 supplier.</p>
              </div>
              <button onClick={() => setAddBillOpen(false)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>

            {/* Mode Switch */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => setAddBillMode('single')}
                className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                  addBillMode === 'single' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                1 Faktur (Satuan)
              </button>
              <button
                type="button"
                onClick={() => setAddBillMode('multi')}
                className={`py-1.5 px-3 rounded-md text-xs font-bold transition-all ${
                  addBillMode === 'multi' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Banyak Nota Sekaligus (Multi-Nota)
              </button>
            </div>

            <form onSubmit={handleSaveManualBill} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Pemasok (Supplier)</label>
                <select
                  value={newBillSupplierId}
                  onChange={e => setNewBillSupplierId(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {addBillMode === 'single' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">No. Faktur / Nota</label>
                    <input
                      type="text"
                      value={newBillInvoice}
                      onChange={e => setNewBillInvoice(e.target.value)}
                      className="mt-1 w-full p-2 border rounded-md text-sm"
                      placeholder="Kosongkan untuk auto"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Keterangan Bahan / Tagihan</label>
                    <input
                      type="text"
                      value={newBillDesc}
                      onChange={e => setNewBillDesc(e.target.value)}
                      className="mt-1 w-full p-2 border rounded-md text-sm"
                      placeholder="e.g., Pembelian Bahan Flexi & Tinta"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tanggal Faktur</label>
                      <input type="date" value={newBillDate} onChange={e => setNewBillDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Jatuh Tempo</label>
                      <input type="date" value={newBillDueDate} onChange={e => setNewBillDueDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Tagihan (Rp)</label>
                    <input
                      type="number"
                      min="1"
                      value={newBillAmount}
                      onChange={e => setNewBillAmount(e.target.value)}
                      className="mt-1 w-full p-2 border rounded-md text-sm"
                      placeholder="Misal: 1000000"
                      required
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Sudah Pernah Dicicil Sebelumnya (Sistem Lama) — Opsional</p>
                      <p className="text-[11px] text-slate-500">
                        Isi jika sebagian tagihan sudah dibayar &amp; dicatat di pengeluaran lama agar sisa hutang akurat tanpa memotong kas lagi.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Sudah Dibayar (Rp)</label>
                        <input
                          type="number"
                          min="0"
                          value={newBillPriorPaid}
                          onChange={e => setNewBillPriorPaid(e.target.value)}
                          className="mt-1 w-full p-2 border rounded-md text-sm bg-white"
                          placeholder="0 (Misal: 200000)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Tgl Cicilan Lama</label>
                        <input
                          type="date"
                          value={newBillPriorDate}
                          onChange={e => setNewBillPriorDate(e.target.value)}
                          className="mt-1 w-full p-2 border rounded-md text-sm bg-white"
                        />
                      </div>
                    </div>
                    {Number(newBillPriorPaid || 0) > 0 && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Catatan Cicilan Lama (Opsional)</label>
                          <input
                            type="text"
                            value={newBillPriorNotes}
                            onChange={e => setNewBillPriorNotes(e.target.value)}
                            className="mt-1 w-full p-2 border rounded-md text-sm bg-white"
                            placeholder="Sudah tercatat di pengeluaran sistem lama"
                          />
                        </div>
                        <div className="bg-sky-50 border border-sky-200 rounded p-2 text-xs text-sky-900 space-y-0.5">
                          <div className="flex justify-between font-bold">
                            <span>Sisa Tagihan Tercatat:</span>
                            <span className="text-red-600">
                              {formatCurrency(Math.max(0, (Number(newBillAmount) || 0) - (Number(newBillPriorPaid) || 0)))}
                            </span>
                          </div>
                          <p className="text-[11px] text-sky-800">
                            Sumber dana otomatis <b>Sistem Lama (Sudah Tercatat)</b> — tidak memotong Kas Laci, Rekening, Arus Kas, maupun Laba Rugi.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                /* MULTI-NOTA MANUAL MODE */
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Daftar Nota Tagihan untuk Supplier Ini</p>
                      <p className="text-[11px] text-slate-500">
                        Semua baris akan tersimpan ke 1 grup supplier di atas. Kosongkan &quot;Cicil Lama&quot; jika tagihan masih utuh.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMultiBillRows(prev => [...prev, createEmptyMultiBillRow(prev.length + 1)])}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700"
                    >
                      <PlusCircleIcon className="h-4 w-4 mr-1" /> Tambah Baris Nota
                    </button>
                  </div>

                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-2 px-2 text-left">No. Faktur</th>
                          <th className="py-2 px-2 text-left">Keterangan</th>
                          <th className="py-2 px-2 text-left">Tgl Faktur</th>
                          <th className="py-2 px-2 text-left">Jatuh Tempo</th>
                          <th className="py-2 px-2 text-right">Total Tagihan (Rp)</th>
                          <th className="py-2 px-2 text-right">Cicil Lama (Rp)</th>
                          <th className="py-2 px-2 text-center w-9"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {multiBillRows.map((row, idx) => (
                          <tr key={row.key}>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.invoiceNumber}
                                onChange={e =>
                                  setMultiBillRows(prev =>
                                    prev.map(r => (r.key === row.key ? { ...r, invoiceNumber: e.target.value } : r))
                                  )
                                }
                                placeholder={`INV-000${idx + 1}`}
                                className="w-28 p-1.5 border rounded text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                value={row.description}
                                onChange={e =>
                                  setMultiBillRows(prev =>
                                    prev.map(r => (r.key === row.key ? { ...r, description: e.target.value } : r))
                                  )
                                }
                                placeholder="Bahan / Catatan nota"
                                className="w-40 p-1.5 border rounded text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="date"
                                value={row.date}
                                onChange={e =>
                                  setMultiBillRows(prev =>
                                    prev.map(r => (r.key === row.key ? { ...r, date: e.target.value } : r))
                                  )
                                }
                                className="p-1.5 border rounded text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="date"
                                value={row.dueDate}
                                onChange={e =>
                                  setMultiBillRows(prev =>
                                    prev.map(r => (r.key === row.key ? { ...r, dueDate: e.target.value } : r))
                                  )
                                }
                                className="p-1.5 border rounded text-xs"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                min="0"
                                value={row.totalAmount}
                                onChange={e =>
                                  setMultiBillRows(prev =>
                                    prev.map(r => (r.key === row.key ? { ...r, totalAmount: e.target.value } : r))
                                  )
                                }
                                placeholder="1000000"
                                className="w-28 p-1.5 border rounded text-xs text-right font-semibold"
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="number"
                                min="0"
                                value={row.priorPaidAmount}
                                onChange={e =>
                                  setMultiBillRows(prev =>
                                    prev.map(r => (r.key === row.key ? { ...r, priorPaidAmount: e.target.value } : r))
                                  )
                                }
                                placeholder="0"
                                className="w-24 p-1.5 border rounded text-xs text-right"
                              />
                            </td>
                            <td className="p-1.5 text-center">
                              {multiBillRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setMultiBillRows(prev => prev.filter(r => r.key !== row.key))}
                                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  title="Hapus Baris"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-3 text-xs">
                    <div>
                      Jumlah Nota Diisi:{' '}
                      <b>{multiBillRows.filter(r => Number(r.totalAmount || 0) > 0).length} Nota</b>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <span>
                        Total Tagihan:{' '}
                        <b>{formatCurrency(multiBillRows.reduce((s, r) => s + Number(r.totalAmount || 0), 0))}</b>
                      </span>
                      <span>
                        Total Sisa Hutang:{' '}
                        <b className="text-red-600">
                          {formatCurrency(
                            multiBillRows.reduce(
                              (s, r) => s + Math.max(0, Number(r.totalAmount || 0) - Number(r.priorPaidAmount || 0)),
                              0
                            )
                          )}
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setAddBillOpen(false)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">
                  {addBillMode === 'multi' ? 'Simpan Semua Nota' : 'Simpan Tagihan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MULTI-NOTA SUPPLIER PAYMENT & LUMP-SUM ALLOCATION */}
      {multiPaySupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setMultiPaySupplier(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold">Bayar Multi-Nota Pemasok</h3>
                <p className="text-xs text-gray-500">
                  Supplier: <b>{multiPaySupplier.supplierName}</b> &bull; Centang nota yang ingin dibayar (bisa lunas penuh atau cicilan sebagian).
                </p>
              </div>
              <button onClick={() => setMultiPaySupplier(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>

            <form onSubmit={handleConfirmMultiPayBills} className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase">
                  1. Pilih Nota &amp; Urutan Prioritas Alokasi Cicilan
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={multiPayPriority}
                    onChange={e =>
                      setMultiPayPriority(
                        e.target.value as 'dueDate' | 'oldestDate' | 'smallestFirst' | 'largestFirst'
                      )
                    }
                    className="p-1.5 border rounded-lg text-xs bg-white"
                  >
                    <option value="dueDate">Urutkan: Jatuh Tempo Terdekat</option>
                    <option value="oldestDate">Urutkan: Tanggal Faktur Terlama</option>
                    <option value="smallestFirst">Urutkan: Sisa Terkecil Dahulu</option>
                    <option value="largestFirst">Urutkan: Sisa Terbesar Dahulu</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = multiPayData.openBillsSorted.map(i => i.bill.id);
                      const allChecked = allIds.every(id => multiPayCheckedIds.includes(id));
                      const nextIds = allChecked ? [] : allIds;
                      setMultiPayCheckedIds(nextIds);
                      if (!isMultiPayCustomAmount) {
                        const nextSum = allChecked
                          ? 0
                          : multiPayData.openBillsSorted.reduce((s, i) => s + i.remaining, 0);
                        setMultiPayAmount(nextSum > 0 ? String(nextSum) : '');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700"
                  >
                    {multiPayData.openBillsSorted.every(i => multiPayCheckedIds.includes(i.bill.id))
                      ? 'Kosongkan Centang'
                      : 'Centang Semua'}
                  </button>
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto max-h-56 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-8">Pilih</th>
                      <th className="py-2 px-2.5 text-left">No. Faktur &amp; Tgl</th>
                      <th className="py-2 px-2.5 text-left">Jatuh Tempo</th>
                      <th className="py-2 px-2.5 text-right">Sisa Tagihan</th>
                      <th className="py-2 px-2.5 text-right">Alokasi Bayar</th>
                      <th className="py-2 px-2.5 text-center">Hasil Setelah Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {multiPayData.openBillsSorted.map(({ bill, remaining }) => {
                      const checked = multiPayCheckedIds.includes(bill.id);
                      const allocInfo = multiPayData.allocations.find(a => a.bill.id === bill.id);
                      return (
                        <tr
                          key={bill.id}
                          onClick={() => handleToggleMultiPayCheck(bill.id)}
                          className={`cursor-pointer ${checked ? 'bg-pink-50/70' : 'hover:bg-gray-50 opacity-75'}`}
                        >
                          <td className="py-2 px-2.5 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleMultiPayCheck(bill.id)}
                              className="h-4 w-4 text-pink-600 rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <p className="font-bold text-gray-800">{bill.invoiceNumber}</p>
                            <p className="text-[11px] text-gray-500 truncate max-w-[180px]">
                              {new Date(bill.date).toLocaleDateString('id-ID')} &bull; {bill.description}
                            </p>
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            {new Date(bill.dueDate).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-2 px-2.5 text-right font-semibold text-red-600 whitespace-nowrap">
                            {formatCurrency(remaining)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {checked ? formatCurrency(allocInfo?.allocated || 0) : '-'}
                          </td>
                          <td className="py-2 px-2.5 text-center whitespace-nowrap">
                            {!checked ? (
                              <span className="text-gray-400">Tidak dipilih</span>
                            ) : allocInfo?.willBePaidOff ? (
                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-bold text-[10px]">
                                LUNAS
                              </span>
                            ) : allocInfo && allocInfo.allocated > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                Cicil • Sisa {formatCurrency(allocInfo.remainingAfter)}
                              </span>
                            ) : (
                              <span className="text-gray-400">Belum teralokasi</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-wrap justify-between items-center gap-2 text-sm">
                <div>
                  <span className="text-amber-900">Total Sisa Nota Terpilih ({multiPayCheckedIds.length} Nota):</span>
                </div>
                <span className="font-extrabold text-red-600 text-base">
                  {formatCurrency(multiPayData.selectedTotalRemaining)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nominal Pembayaran (Rp)</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      min="1"
                      max={multiPayData.selectedTotalRemaining || undefined}
                      value={multiPayAmount}
                      onChange={e => {
                        setIsMultiPayCustomAmount(true);
                        setMultiPayAmount(e.target.value);
                      }}
                      className="w-full p-2 border rounded-md text-sm font-bold"
                      placeholder="Masukkan nominal bayar"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiPayCustomAmount(false);
                        setMultiPayAmount(
                          multiPayData.selectedTotalRemaining > 0
                            ? String(multiPayData.selectedTotalRemaining)
                            : ''
                        );
                      }}
                      className="whitespace-nowrap px-3 py-2 rounded-md bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700"
                    >
                      Lunas Terpilih
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Bisa isi penuh untuk melunasi semua nota terpilih, atau isi nominal sebagian untuk alokasi cicilan otomatis sesuai urutan di atas.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Bayar</label>
                  <input
                    type="date"
                    value={multiPayDate}
                    onChange={e => setMultiPayDate(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-md text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                  <select
                    value={multiPayFunding}
                    onChange={e => setMultiPayFunding(e.target.value as InstallmentFundingSource)}
                    className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                  >
                    <option value="Transfer Bank">Transfer Rekening Usaha</option>
                    <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                    <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                    <option value="Dana Owner">Dana Pribadi Owner</option>
                    <option value="Sistem Lama (Sudah Tercatat)">Sistem Lama / Sudah Tercatat (Tidak Potong Kas)</option>
                  </select>
                </div>

                {multiPayFunding === 'Transfer Bank' && nonCashAccounts.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                    <select
                      value={multiPayAccountId}
                      onChange={e => setMultiPayAccountId(e.target.value)}
                      className="mt-1 w-full p-2 border border-indigo-300 rounded-md bg-indigo-50/40 text-sm"
                    >
                      <option value="">-- Rekening Usaha (Umum) --</option>
                      {nonCashAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Catatan Pembayaran</label>
                    <input
                      type="text"
                      value={multiPayNotes}
                      onChange={e => setMultiPayNotes(e.target.value)}
                      className="mt-1 w-full p-2 border rounded-md text-sm"
                      placeholder="Contoh: Transfer pelunasan multi-nota"
                    />
                  </div>
                )}
              </div>

              {multiPayFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Catatan Pembayaran</label>
                  <input
                    type="text"
                    value={multiPayNotes}
                    onChange={e => setMultiPayNotes(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-md text-sm"
                    placeholder="Contoh: Transfer pelunasan multi-nota"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setMultiPaySupplier(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={multiPayData.allocations.length === 0 || Number(multiPayAmount || 0) <= 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:bg-gray-300"
                >
                  Simpan Pembayaran Multi-Nota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY SUPPLIER BILL (SINGLE) */}
      {payingBill && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setPayingBill(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold">Bayar Tagihan Pemasok</h3>
                <p className="text-xs text-gray-500">{payingBill.supplierName} &bull; {payingBill.invoiceNumber}</p>
              </div>
              <button onClick={() => setPayingBill(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleConfirmPayBill} className="space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg text-sm flex justify-between">
                <span className="text-amber-800">Sisa Tagihan Saat Ini:</span>
                <span className="font-bold text-red-600">
                  {formatCurrency(Math.max(0, payingBill.totalAmount - payingBill.payments.reduce((s, p) => s + p.amount, 0)))}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Bayar</label>
                  <input type="date" value={billPayDate} onChange={e => setBillPayDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nominal Bayar (Rp)</label>
                  <input type="number" min="1" value={billPayAmount} onChange={e => setBillPayAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select value={billPayFunding} onChange={e => setBillPayFunding(e.target.value as InstallmentFundingSource)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  <option value="Transfer Bank">Transfer Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                  <option value="Dana Owner">Dana Pribadi Owner</option>
                  <option value="Sistem Lama (Sudah Tercatat)">Sistem Lama / Sudah Tercatat (Tidak Potong Kas)</option>
                </select>
                {billPayFunding === 'Sistem Lama (Sudah Tercatat)' && (
                  <p className="mt-1.5 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded p-2">
                    Khusus cicilan lama yang sudah masuk di pengeluaran sistem lama. Hanya mengurangi sisa hutang tagihan tanpa memotong Kas Laci, Bank, Arus Kas, Laba Rugi, maupun Talangan Owner.
                  </p>
                )}
              </div>
              {billPayFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={billPayAccountId}
                    onChange={e => setBillPayAccountId(e.target.value)}
                    className="mt-1 w-full p-2 border border-indigo-300 rounded-md bg-indigo-50/40 text-sm"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan Pembayaran</label>
                <input type="text" value={billPayNotes} onChange={e => setBillPayNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" placeholder="Cicilan ke-1 / Pelunasan" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setPayingBill(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700">Simpan Pembayaran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SUPPLIER BILL HISTORY (LIVE + EDIT/DELETE PER ROW + CETAK/EXPORT KARTU HUTANG) */}
      {historyBill && (() => {
        const ledger = computeSupplierBillPaymentLedger(historyBill);
        const totalPaid = ledger.reduce((s, r) => s + r.payment.amount, 0);
        const remaining = Math.max(0, historyBill.totalAmount - totalPaid);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setHistoryBillId(null)}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex flex-wrap justify-between items-start gap-3 border-b pb-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold">Riwayat & Kartu Hutang Tagihan Pemasok</h3>
                  <p className="text-xs text-gray-500">
                    {historyBill.supplierName} &bull; {historyBill.invoiceNumber} &bull; Tgl Faktur: {new Date(historyBill.date).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenPrintPreview(
                        `Kartu Hutang ${historyBill.supplierName} (${historyBill.invoiceNumber})`,
                        buildSupplierBillStatementHtml(historyBill, storeInfo),
                        () => exportSupplierBillDetailExcel(historyBill)
                      )
                    }
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50"
                  >
                    <PrinterIcon className="h-4 w-4 mr-1.5 text-pink-600" /> Cetak Kartu Hutang
                  </button>
                  <button
                    type="button"
                    onClick={() => exportSupplierBillDetailExcel(historyBill)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Export Excel
                  </button>
                  <button onClick={() => setHistoryBillId(null)} className="text-2xl text-gray-500 leading-none ml-1">&times;</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-[11px] text-gray-500 font-semibold uppercase">Total Tagihan Awal</p>
                  <p className="text-base font-extrabold text-gray-900 mt-0.5">{formatCurrency(historyBill.totalAmount)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-[11px] text-emerald-700 font-semibold uppercase">Sudah Dibayar ({ledger.length}x)</p>
                  <p className="text-base font-extrabold text-emerald-700 mt-0.5">{formatCurrency(totalPaid)}</p>
                </div>
                <div className={`border rounded-lg p-3 ${remaining > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className={`text-[11px] font-semibold uppercase ${remaining > 0 ? 'text-red-700' : 'text-emerald-700'}`}>Sisa Tagihan Sah</p>
                  <p className={`text-base font-extrabold mt-0.5 ${remaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(remaining)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {ledger.length > 0 ? (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-3 text-left">Tanggal</th>
                        <th className="py-2 px-3 text-left">Sumber Dana</th>
                        <th className="py-2 px-3 text-left">Catatan</th>
                        <th className="py-2 px-3 text-right">Nominal Bayar</th>
                        <th className="py-2 px-3 text-right">Sisa Berjalan</th>
                        <th className="py-2 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ledger.map(({ payment: p, runningBalance }) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3 whitespace-nowrap">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                          <td className="py-2 px-3">
                            {p.fundingSource === 'Sistem Lama (Sudah Tercatat)' ? (
                              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-sky-100 text-sky-800">
                                Sistem Lama (Sudah Tercatat)
                              </span>
                            ) : p.fundingSource === 'Dana Owner' ? (
                              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800">
                                Dana Owner
                              </span>
                            ) : p.fundingSource === 'Kas Dipegang Owner' ? (
                              <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-fuchsia-100 text-fuchsia-800">
                                Kas Dipegang Owner
                              </span>
                            ) : (
                              <span>{p.fundingSource}{p.fundingAccountName ? ` (${p.fundingAccountName})` : ''}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-500">{p.notes || '-'}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(p.amount)}</td>
                          <td className={`py-2 px-3 text-right font-bold whitespace-nowrap ${runningBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {formatCurrency(runningBalance)}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditBillPayment(historyBill.id, p)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit Pembayaran Ini"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Hapus pembayaran tanggal ${new Date(p.date).toLocaleDateString('id-ID')} sebesar ${formatCurrency(p.amount)}?`)) {
                                    onDeleteSupplierBillPayment(historyBill.id, p.id);
                                  }
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Hapus Pembayaran Ini"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-gray-500 py-8">Belum ada pembayaran untuk tagihan ini.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ADD BANK INSTALLMENT */}
      {isAddBankOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setAddBankOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Tambah Cicilan Bank / Kredit</h3>
              <button onClick={() => setAddBankOpen(false)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveBankInstallment} className="space-y-3">
              {debts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Ambil dari Daftar Hutang (Opsional)</label>
                  <select
                    value={bankDebtId}
                    onChange={e => handleDebtSelectionChange(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                  >
                    <option value="">-- Buat Cicilan Baru --</option>
                    {debts.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({formatCurrency(d.value)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Bank / Kredit</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md text-sm"
                  placeholder="e.g., KUR BRI / Leasing Mesin"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jumlah Kredit Awal (Rp)</label>
                  <input
                    type="number"
                    min="1"
                    value={bankCreditLimit}
                    onChange={e => {
                      const prevSame = bankRemaining === bankCreditLimit;
                      setBankCreditLimit(e.target.value);
                      if (prevSame || !bankRemaining) setBankRemaining(e.target.value);
                    }}
                    className="mt-1 w-full p-2 border rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sisa Pokok Saat Ini (Rp)</label>
                  <input
                    type="number"
                    min="1"
                    value={bankRemaining}
                    onChange={e => setBankRemaining(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-md text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tanggal Jatuh Tempo Berikutnya</label>
                <input
                  type="date"
                  value={bankNextDue}
                  onChange={e => setBankNextDue(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan</label>
                <input
                  type="text"
                  value={bankNotes}
                  onChange={e => setBankNotes(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md text-sm"
                  placeholder="e.g., Tenor 24 bulan, bunga efektif"
                />
              </div>
              {!bankDebtId && (
                <label className="flex items-center space-x-2 text-xs text-gray-700 bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                  <input
                    type="checkbox"
                    checked={bankSyncToDebts}
                    onChange={e => setBankSyncToDebts(e.target.checked)}
                    className="h-4 w-4 text-pink-600 rounded"
                  />
                  <span>Otomatis tambahkan ke Laporan <b>Aset dan Hutang</b> (terupdate tiap bayar angsuran)</span>
                </label>
              )}
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setAddBankOpen(false)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Cicilan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PAY BANK INSTALLMENT (NON-FLAT) */}
      {payingBank && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setPayingBank(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold">Bayar Angsuran Bank</h3>
                <p className="text-xs text-gray-500">{payingBank.name}</p>
              </div>
              <button onClick={() => setPayingBank(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleConfirmPayBank} className="space-y-3">
              <div className="bg-purple-50 p-3 rounded-lg text-sm flex justify-between">
                <span className="text-purple-900">Sisa Pokok Kredit:</span>
                <span className="font-bold text-red-600">{formatCurrency(payingBank.remainingPrincipal)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Bayar</label>
                  <input type="date" value={bankPayDate} onChange={e => setBankPayDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jatuh Tempo Berikutnya</label>
                  <input type="date" value={bankPayNextDue} onChange={e => setBankPayNextDue(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Nominal Dibayar Bulan Ini (Rp)</label>
                <input
                  type="number"
                  min="1"
                  value={bankPayTotal}
                  onChange={e => handleBankPayTotalChange(e.target.value)}
                  className="mt-1 w-full p-2 border rounded-md text-sm font-bold"
                  placeholder="Sesuai tagihan angsuran bulan ini"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Porsi Pengurang Pokok (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={bankPayPrincipal}
                    onChange={e => setBankPayPrincipal(e.target.value)}
                    className="mt-1 w-full p-2 border rounded-md text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Bunga / Admin (Otomatis)</label>
                  <p className="mt-1 p-2 bg-gray-100 rounded-md text-sm font-semibold text-gray-700">
                    {formatCurrency(Math.max(0, (parseFloat(bankPayTotal) || 0) - (parseFloat(bankPayPrincipal) || 0)))}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-gray-500">
                *Untuk angsuran non-flat, isi Pokok sesuai rincian bank agar sisa hutang berkurang akurat, atau samakan dengan Total jika tidak dipisah.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select value={bankPayFunding} onChange={e => setBankPayFunding(e.target.value as InstallmentFundingSource)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  <option value="Transfer Bank">Transfer Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                  <option value="Dana Owner">Dana Pribadi Owner</option>
                  <option value="Sistem Lama (Sudah Tercatat)">Sistem Lama / Sudah Tercatat (Tidak Potong Kas)</option>
                </select>
                {bankPayFunding === 'Sistem Lama (Sudah Tercatat)' && (
                  <p className="mt-1.5 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded p-2">
                    Khusus angsuran lama yang sudah tercatat sebelumnya. Mengurangi sisa pokok hutang tanpa memotong Kas Laci, Bank, Arus Kas, maupun Laba Rugi.
                  </p>
                )}
              </div>
              {bankPayFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select
                    value={bankPayAccountId}
                    onChange={e => setBankPayAccountId(e.target.value)}
                    className="mt-1 w-full p-2 border border-indigo-300 rounded-md bg-indigo-50/40 text-sm"
                  >
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan</label>
                <input type="text" value={bankPayNotes} onChange={e => setBankPayNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" placeholder="Angsuran ke-..." />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setPayingBank(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Bayar Angsuran</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BANK INSTALLMENT HISTORY (LIVE + EDIT/DELETE PER ROW) */}
      {historyBank && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setHistoryBankId(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap justify-between items-center gap-2 border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold">Riwayat Angsuran: {historyBank.name}</h3>
                <p className="text-xs text-gray-500">Kredit Awal: {formatCurrency(historyBank.creditLimit)} &bull; Sisa Pokok: {formatCurrency(historyBank.remainingPrincipal)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenPrintPreview(
                      `Kartu Angsuran ${historyBank.name}`,
                      buildBankInstallmentDetailHtml(historyBank, storeInfo),
                      () => exportBankInstallmentDetailExcel(historyBank)
                    )
                  }
                  className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-bold hover:bg-gray-50"
                >
                  <PrinterIcon className="h-4 w-4 mr-1.5 text-pink-600" /> Cetak Kartu
                </button>
                <button
                  type="button"
                  onClick={() => exportBankInstallmentDetailExcel(historyBank)}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Export Excel
                </button>
                <button onClick={() => setHistoryBankId(null)} className="text-2xl text-gray-500 leading-none ml-1">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {historyBank.payments.length > 0 ? (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-3 text-left">Tanggal</th>
                      <th className="py-2 px-3 text-left">Sumber Dana</th>
                      <th className="py-2 px-3 text-right">Pokok</th>
                      <th className="py-2 px-3 text-right">Bunga/Admin</th>
                      <th className="py-2 px-3 text-right">Total Bayar</th>
                      <th className="py-2 px-3 text-left">Catatan</th>
                      <th className="py-2 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historyBank.payments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3 whitespace-nowrap">{new Date(p.date).toLocaleDateString('id-ID')}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {p.fundingSource === 'Sistem Lama (Sudah Tercatat)' ? (
                            <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-sky-100 text-sky-800">
                              Sistem Lama (Sudah Tercatat)
                            </span>
                          ) : p.fundingSource === 'Dana Owner' ? (
                            <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800">
                              Dana Owner
                            </span>
                          ) : p.fundingSource === 'Kas Dipegang Owner' ? (
                            <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-fuchsia-100 text-fuchsia-800">
                              Kas Dipegang Owner
                            </span>
                          ) : (
                            <span>{p.fundingSource}{p.fundingAccountName ? ` (${p.fundingAccountName})` : ''}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">{formatCurrency(p.principalPaid)}</td>
                        <td className="py-2 px-3 text-right text-amber-700">{formatCurrency(p.interestPaid)}</td>
                        <td className="py-2 px-3 text-right font-bold">{formatCurrency(p.totalPaid)}</td>
                        <td className="py-2 px-3 text-gray-500">{p.notes || '-'}</td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditBankPayment(historyBank.id, p)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit Angsuran Ini"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Hapus angsuran tanggal ${new Date(p.date).toLocaleDateString('id-ID')} sebesar ${formatCurrency(p.totalPaid)}? Sisa pokok akan otomatis dikembalikan.`)) {
                                  onDeleteBankInstallmentPayment(historyBank.id, p.id);
                                }
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Hapus Angsuran Ini"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-8">Belum ada riwayat angsuran.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT OPERATIONAL EXPENSE */}
      {editingOpExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setEditingOpExpense(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Edit Pengeluaran Operasional</h3>
              <button onClick={() => setEditingOpExpense(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            {expenseMetadata[editingOpExpense.id]?.purchaseId && (
              <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                Pengeluaran otomatis dari <b>Pembelian / Barang Masuk</b>. Nominal dan tanggal dikunci agar stok gudang tetap sinkron. Anda tetap dapat mengoreksi Sumber Dana, Rekening, Kategori, atau Catatan.
              </div>
            )}
            <form onSubmit={handleSaveEditOpExpense} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Pengeluaran</label>
                <input type="text" value={editOpName} onChange={e => setEditOpName(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategori</label>
                <select value={editOpCategory} onChange={e => setEditOpCategory(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  {!OPERATIONAL_CATEGORIES.includes(editOpCategory) && (
                    <option value={editOpCategory}>{editOpCategory}</option>
                  )}
                  {OPERATIONAL_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={editOpAmount}
                    onChange={e => setEditOpAmount(e.target.value)}
                    disabled={Boolean(expenseMetadata[editingOpExpense.id]?.purchaseId)}
                    className="mt-1 w-full p-2 border rounded-md text-sm disabled:bg-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input
                    type="date"
                    value={editOpDate}
                    onChange={e => setEditOpDate(e.target.value)}
                    disabled={Boolean(expenseMetadata[editingOpExpense.id]?.purchaseId)}
                    className="mt-1 w-full p-2 border rounded-md text-sm disabled:bg-gray-100"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select value={editOpFunding} onChange={e => setEditOpFunding(e.target.value as ExpenseFundingSource)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  <option value="Kas Laci">Kas Laci (Tunai) — Memotong Laci</option>
                  <option value="Transfer Bank">Transfer Bank / Non-Laci — Tidak Memotong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                </select>
              </div>
              {editOpFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select value={editOpAccountId} onChange={e => setEditOpAccountId(e.target.value)} className="mt-1 w-full p-2 border border-indigo-300 bg-indigo-50/40 rounded-md text-sm">
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan</label>
                <input type="text" value={editOpNotes} onChange={e => setEditOpNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingOpExpense(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER BILL */}
      {editingBill && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setEditingBill(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Edit Tagihan Pemasok</h3>
              <button onClick={() => setEditingBill(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            {editingBill.purchaseId && (
              <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                Tagihan ini otomatis dari <b>Pembelian / Barang Masuk</b>. Supplier, tanggal faktur, dan nominal total dikunci agar sinkron dengan stok.
              </div>
            )}
            <form onSubmit={handleSaveEditBill} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Pemasok (Supplier)</label>
                <select
                  value={editBillSupplierId}
                  onChange={e => setEditBillSupplierId(e.target.value)}
                  disabled={Boolean(editingBill.purchaseId)}
                  className="mt-1 w-full p-2 border rounded-md bg-white text-sm disabled:bg-gray-100"
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">No. Faktur / Nota</label>
                <input type="text" value={editBillInvoice} onChange={e => setEditBillInvoice(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Keterangan Bahan / Tagihan</label>
                <input type="text" value={editBillDesc} onChange={e => setEditBillDesc(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Faktur</label>
                  <input type="date" value={editBillDate} onChange={e => setEditBillDate(e.target.value)} disabled={Boolean(editingBill.purchaseId)} className="mt-1 w-full p-2 border rounded-md text-sm disabled:bg-gray-100" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jatuh Tempo</label>
                  <input type="date" value={editBillDueDate} onChange={e => setEditBillDueDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Tagihan (Rp)</label>
                <input type="number" min="1" value={editBillAmount} onChange={e => setEditBillAmount(e.target.value)} disabled={Boolean(editingBill.purchaseId)} className="mt-1 w-full p-2 border rounded-md text-sm disabled:bg-gray-100" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan</label>
                <input type="text" value={editBillNotes} onChange={e => setEditBillNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingBill(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SUPPLIER BILL PAYMENT ROW */}
      {editingBillPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center p-4" onClick={() => setEditingBillPayment(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Edit Riwayat Pembayaran Tagihan</h3>
              <button onClick={() => setEditingBillPayment(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveEditBillPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal Bayar</label>
                  <input type="date" value={editBillPayDate} onChange={e => setEditBillPayDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nominal Bayar (Rp)</label>
                  <input type="number" min="1" value={editBillPayAmount} onChange={e => setEditBillPayAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select value={editBillPayFunding} onChange={e => setEditBillPayFunding(e.target.value as InstallmentFundingSource)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  <option value="Transfer Bank">Transfer Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                  <option value="Dana Owner">Dana Pribadi Owner</option>
                  <option value="Sistem Lama (Sudah Tercatat)">Sistem Lama / Sudah Tercatat (Tidak Potong Kas)</option>
                </select>
                {editBillPayFunding === 'Sistem Lama (Sudah Tercatat)' && (
                  <p className="mt-1.5 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded p-2">
                    Tidak memotong Kas Laci, Rekening Bank, Arus Kas, Laba Rugi, maupun Talangan Owner.
                  </p>
                )}
              </div>
              {editBillPayFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select value={editBillPayAccountId} onChange={e => setEditBillPayAccountId(e.target.value)} className="mt-1 w-full p-2 border border-indigo-300 rounded-md bg-indigo-50/40 text-sm">
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan Pembayaran</label>
                <input type="text" value={editBillPayNotes} onChange={e => setEditBillPayNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingBillPayment(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BANK INSTALLMENT */}
      {editingBank && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setEditingBank(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Edit Cicilan Bank / Kredit</h3>
              <button onClick={() => setEditingBank(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveEditBank} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Bank / Kredit</label>
                <input type="text" value={editBankName} onChange={e => setEditBankName(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jumlah Kredit Awal (Rp)</label>
                  <input type="number" min="0" value={editBankLimit} onChange={e => setEditBankLimit(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sisa Pokok Saat Ini (Rp)</label>
                  <input type="number" min="0" value={editBankRemaining} onChange={e => setEditBankRemaining(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tanggal Jatuh Tempo Berikutnya</label>
                <input type="date" value={editBankNextDue} onChange={e => setEditBankNextDue(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan</label>
                <input type="text" value={editBankNotes} onChange={e => setEditBankNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              {editingBank.debtId && (
                <p className="text-xs text-indigo-700 bg-indigo-50 p-2 rounded border border-indigo-200">
                  Perubahan nama &amp; sisa pokok akan otomatis disinkronkan ke Laporan <b>Aset dan Hutang</b>.
                </p>
              )}
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingBank(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT BANK INSTALLMENT PAYMENT ROW */}
      {editingBankPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center p-4" onClick={() => setEditingBankPayment(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Edit Riwayat Angsuran Bank</h3>
              <button onClick={() => setEditingBankPayment(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveEditBankPayment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tanggal Bayar</label>
                <input type="date" value={editBankPayDate} onChange={e => setEditBankPayDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Total Nominal Dibayar (Rp)</label>
                <input type="number" min="1" value={editBankPayTotal} onChange={e => setEditBankPayTotal(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm font-bold" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Porsi Pengurang Pokok (Rp)</label>
                  <input type="number" min="0" value={editBankPayPrincipal} onChange={e => setEditBankPayPrincipal(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Bunga / Admin (Otomatis)</label>
                  <p className="mt-1 p-2 bg-gray-100 rounded-md text-sm font-semibold text-gray-700">
                    {formatCurrency(Math.max(0, (parseFloat(editBankPayTotal) || 0) - (parseFloat(editBankPayPrincipal) || 0)))}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select value={editBankPayFunding} onChange={e => setEditBankPayFunding(e.target.value as InstallmentFundingSource)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  <option value="Transfer Bank">Transfer Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                  <option value="Dana Owner">Dana Pribadi Owner</option>
                  <option value="Sistem Lama (Sudah Tercatat)">Sistem Lama / Sudah Tercatat (Tidak Potong Kas)</option>
                </select>
                {editBankPayFunding === 'Sistem Lama (Sudah Tercatat)' && (
                  <p className="mt-1.5 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded p-2">
                    Tidak memotong Kas Laci, Rekening Bank, Arus Kas, maupun Laba Rugi.
                  </p>
                )}
              </div>
              {editBankPayFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select value={editBankPayAccountId} onChange={e => setEditBankPayAccountId(e.target.value)} className="mt-1 w-full p-2 border border-indigo-300 rounded-md bg-indigo-50/40 text-sm">
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan</label>
                <input type="text" value={editBankPayNotes} onChange={e => setEditBankPayNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingBankPayment(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRIVATE EXPENSE */}
      {editingPrivate && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={() => setEditingPrivate(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold">Edit Pengeluaran Pribadi / Non-Operasional</h3>
              <button onClick={() => setEditingPrivate(null)} className="text-2xl text-gray-500 leading-none">&times;</button>
            </div>
            <form onSubmit={handleSaveEditPrivate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Keperluan / Nama Pengeluaran</label>
                <input type="text" value={editPrivName} onChange={e => setEditPrivName(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategori Non-Operasional</label>
                <select value={editPrivCat} onChange={e => setEditPrivCat(e.target.value)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  {!PRIVATE_CATEGORIES.includes(editPrivCat) && (
                    <option value={editPrivCat}>{editPrivCat}</option>
                  )}
                  {PRIVATE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                  <input type="number" min="0" value={editPrivAmount} onChange={e => setEditPrivAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tanggal</label>
                  <input type="date" value={editPrivDate} onChange={e => setEditPrivDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                <select value={editPrivFunding} onChange={e => setEditPrivFunding(e.target.value as PrivateFundingSource)} className="mt-1 w-full p-2 border rounded-md bg-white text-sm">
                  <option value="Uang Pribadi Owner">Uang Pribadi Owner (Tidak Potong Kas Toko)</option>
                  <option value="Transfer Bank">Transfer Rekening Usaha</option>
                  <option value="Kas Laci">Kas Laci (Tunai) — Potong Laci</option>
                  <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                </select>
              </div>
              {editPrivFunding === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pilih Rekening / Dompet Non-Tunai</label>
                  <select value={editPrivAccountId} onChange={e => setEditPrivAccountId(e.target.value)} className="mt-1 w-full p-2 border border-indigo-300 bg-indigo-50/40 rounded-md text-sm">
                    <option value="">-- Rekening Usaha (Umum) --</option>
                    {nonCashAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                    ))}
                  </select>
                </div>
              )}
              {editPrivFunding === 'Uang Pribadi Owner' && (
                <div className="space-y-2 bg-gray-50 p-2.5 rounded-lg border">
                  <label className="flex items-center space-x-2 text-sm text-gray-700">
                    <input type="checkbox" checked={editPrivNeedsReimburse} onChange={e => setEditPrivNeedsReimburse(e.target.checked)} className="h-4 w-4 text-pink-600 rounded" />
                    <span>Perlu Reimburse / diganti dari kas toko</span>
                  </label>
                  {editPrivNeedsReimburse && (
                    <label className="flex items-center space-x-2 text-sm text-gray-700">
                      <input type="checkbox" checked={editPrivReimbursed} onChange={e => setEditPrivReimbursed(e.target.checked)} className="h-4 w-4 text-green-600 rounded" />
                      <span>Sudah Direimburse</span>
                    </label>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Tamu / Klien / Event (Opsional)</label>
                <input type="text" value={editPrivGuest} onChange={e => setEditPrivGuest(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan Tambahan</label>
                <input type="text" value={editPrivNotes} onChange={e => setEditPrivNotes(e.target.value)} className="mt-1 w-full p-2 border rounded-md text-sm" />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button type="button" onClick={() => setEditingPrivate(null)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRINT PREVIEW (IFRAME-SAFE, NO WINDOW.OPEN) */}
      {printPreviewDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[70] flex justify-center items-center p-4" onClick={() => setPrintPreviewDoc(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 border-b bg-gray-50">
              <div>
                <h3 className="text-base font-bold text-gray-900">Preview Cetak: {printPreviewDoc.title}</h3>
                <p className="text-xs text-gray-500">Gunakan tombol Cetak / Simpan PDF untuk mencetak ke printer atau simpan sebagai file PDF.</p>
              </div>
              <div className="flex items-center gap-2">
                {printPreviewDoc.onExportExcel && (
                  <button
                    type="button"
                    onClick={printPreviewDoc.onExportExcel}
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" /> Download Excel
                  </button>
                )}
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
                  className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-300"
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-200 p-4 overflow-hidden">
              <iframe
                ref={printIframeRef}
                title={printPreviewDoc.title}
                srcDoc={printPreviewDoc.html}
                className="w-full h-full bg-white rounded-lg shadow border border-gray-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
