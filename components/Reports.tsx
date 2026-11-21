
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { type SavedOrder, type ExpenseItem, type ReceivableItem, type ProductData, type CustomerData, type SupplierData, type PaymentMethod, type InventoryItem, type InventoryCategory, type InventoryCondition, type LegacyMonthlyIncome, type LegacyMonthlyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type CategoryData, type FinishingData, type ReportsProps, type OrderItemData, type SupplierBill, type BankInstallment, type PrivateExpenseItem, type OwnerTransaction, type OwnerMonthlyClosing, type OwnerAllocationBucket } from '../types';
import { CurrencyDollarIcon, ReceiptTaxIcon, ChartBarIcon, ShoppingCartIcon, UsersIcon, CubeIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CreditCardIcon, ArrowDownTrayIcon, PrinterIcon, FilterIcon, ArrowUpTrayIcon, CheckCircleIcon, MagnifyingGlassIcon } from './Icons';
import { exportToExcel, resolveLockedOrderItemTotals, formatSafeDateId, resolveEffectiveProductCost } from './reportUtils';
import { calculateGlobalFinancialRecap, computeStoreCashSnapshot, computeMonthlyAccrualPerformance, type StoreCashSnapshot } from './cashFlowUtils';
import * as XLSX from 'xlsx';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString: string) => formatSafeDateId(dateString);

const getCurrentLocalDateStr = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const getCurrentLocalMonthStr = (): string => getCurrentLocalDateStr().slice(0, 7);

const getMonthStartEnd = (ym: string): { startDate: string; endDate: string } => {
    if (!ym || !/^\d{4}-\d{2}/.test(ym)) return { startDate: '', endDate: '' };
    const year = parseInt(ym.slice(0, 4), 10);
    const month = parseInt(ym.slice(5, 7), 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return { startDate: '', endDate: '' };
    const lastDayNum = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    return {
        startDate: `${year}-${mm}-01`,
        endDate: `${year}-${mm}-${String(lastDayNum).padStart(2, '0')}`,
    };
};

const formatMonthLabel = (ymOrDate: string): string => {
    if (!ymOrDate || !/^\d{4}-\d{2}/.test(ymOrDate)) return ymOrDate || '-';
    const year = parseInt(ymOrDate.slice(0, 4), 10);
    const month = parseInt(ymOrDate.slice(5, 7), 10);
    if (isNaN(year) || isNaN(month)) return ymOrDate;
    return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
};

const escapeHtml = (raw?: string | number | null): string => {
    const s = raw === undefined || raw === null ? '' : String(raw);
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const parseExcelDateToYmd = (raw: unknown): string => {
    if (raw instanceof Date && !isNaN(raw.getTime())) {
        // Shift +12h before UTC ISO slice to avoid midnight -1 day shift from SheetJS cellDates
        const adjusted = new Date(raw.getTime() + 12 * 3600 * 1000);
        return adjusted.toISOString().slice(0, 10);
    }
    if (typeof raw === 'number' && !isNaN(raw)) {
        const parsed = XLSX.SSF.parse_date_code(raw);
        if (parsed && parsed.y && parsed.m && parsed.d) {
            return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
        }
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        // YYYY-MM-DD or YYYY/MM/DD
        const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch) {
            return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
        }
        // DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
            return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        }
        const fallbackParsed = new Date(trimmed);
        if (!isNaN(fallbackParsed.getTime())) {
            const y = fallbackParsed.getFullYear();
            const m = String(fallbackParsed.getMonth() + 1).padStart(2, '0');
            const d = String(fallbackParsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }
    return getCurrentLocalDateStr();
};

const diffDaysFromYmd = (targetYmd?: string, baseYmd?: string): number | null => {
    const tMatch = targetYmd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const bMatch = baseYmd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!tMatch || !bMatch) return null;
    const targetUtc = Date.UTC(parseInt(tMatch[1], 10), parseInt(tMatch[2], 10) - 1, parseInt(tMatch[3], 10));
    const baseUtc = Date.UTC(parseInt(bMatch[1], 10), parseInt(bMatch[2], 10) - 1, parseInt(bMatch[3], 10));
    return Math.round((targetUtc - baseUtc) / (1000 * 60 * 60 * 24));
};

const formatDateTimeID = (iso?: string): string => {
    if (!iso) return 'Belum pernah';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Belum pernah';
    return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getIsoDaysDiffFromNow = (iso?: string): number | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const startToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const startTarget = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.max(0, Math.floor((startToday - startTarget) / (1000 * 60 * 60 * 24)));
};

const formatDaysAgoLabel = (iso?: string): string => {
    const diff = getIsoDaysDiffFromNow(iso);
    if (diff === null) return 'Belum pernah dicek';
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin (1 hari lalu)';
    return `${diff} hari lalu`;
};

const ProminentStatCard: React.FC<{ icon: React.ReactElement<{ className?: string }>; title: string; value: string; gradient: string; }> = ({ icon, title, value, gradient }) => (
  <div className={`p-6 rounded-xl shadow-lg text-white ${gradient} transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}>
    <div className="flex justify-between items-start">
        <div>
          <p className="text-lg font-medium text-white/90">{title}</p>
          <p className="text-3xl lg:text-4xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="p-3 rounded-full bg-black/20">
          {React.cloneElement(icon, { className: "h-7 w-7 text-white" })}
        </div>
    </div>
  </div>
);

const ReportStatCard = ProminentStatCard;

const TABS = [
    { key: 'finalRecap', label: 'Final Rekapitulasi' },
    { key: 'profitAndLoss', label: 'Laba Rugi' },
    { key: 'sales', label: 'Penjualan' },
    { key: 'categorySales', label: 'Penjualan per Kategori' },
    { key: 'receivables', label: 'Piutang' },
    { key: 'inventory', label: 'Stok' },
    { key: 'assetsDebts', label: 'Neraca (Aset & Hutang)' },
    { key: 'dataPenjualanLama', label: 'Data Penjualan Lama' },
    { key: 'dataPiutangLama', label: 'Data Piutang Lama' },
];

// Reusable component for managing monthly legacy data
const MonthlyLegacyDataForm: React.FC<{
    title: string;
    data: (LegacyMonthlyIncome | LegacyMonthlyExpense)[];
    onSave: (item: Omit<LegacyMonthlyIncome, 'id'> | Omit<LegacyMonthlyExpense, 'id'>) => void;
    onUpdate: (item: LegacyMonthlyIncome | LegacyMonthlyExpense) => void;
    onDelete: (id: number) => void;
}> = ({ title, data, onSave, onUpdate, onDelete }) => {
    const [editingItem, setEditingItem] = useState<(LegacyMonthlyIncome | LegacyMonthlyExpense | null)>(null);
    const [monthDate, setMonthDate] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (editingItem) {
            setMonthDate(editingItem.month_date.substring(0, 7)); // YYYY-MM format for month input
            setAmount(editingItem.amount.toString());
            setDescription(editingItem.description || '');
        } else {
            setMonthDate('');
            setAmount('');
            setDescription('');
        }
    }, [editingItem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dateForDb = `${monthDate}-01`; // Store as the first day of the month

        if (editingItem) {
            onUpdate({ ...editingItem, month_date: dateForDb, amount: Number(amount), description });
        } else {
            onSave({ month_date: dateForDb, amount: Number(amount), description });
        }
        setEditingItem(null);
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                <h4 className="font-semibold text-gray-700">{editingItem ? `Edit ${title}` : `Tambah ${title}`}</h4>
                <div>
                    <label className="block text-sm font-medium">Bulan & Tahun</label>
                    <input type="month" value={monthDate} onChange={e => setMonthDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
                </div>
                <div>
                    <label className="block text-sm font-medium">Nominal (Rp)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required placeholder="0" />
                </div>
                <div>
                    <label className="block text-sm font-medium">Deskripsi (Opsional)</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., Pemasukan total Januari 2023" />
                </div>
                <div className="flex space-x-2">
                    <button type="submit" className="w-full bg-cyan-600 text-white py-2 rounded-lg font-semibold hover:bg-cyan-700">{editingItem ? 'Update' : 'Simpan'}</button>
                    {editingItem && <button type="button" onClick={() => setEditingItem(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>}
                </div>
            </form>
            <div>
                <h4 className="font-semibold text-gray-700 mb-2">Daftar {title}</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {data.sort((a,b) => new Date(b.month_date).getTime() - new Date(a.month_date).getTime()).map(item => (
                        <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-800">{formatMonthLabel(item.month_date)}</p>
                                <p className="text-sm text-green-600 font-bold">{formatCurrency(item.amount)}</p>
                                {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setEditingItem(item)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4"/></button>
                                <button onClick={() => onDelete(item.id)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


const LegacyReceivableForm: React.FC<{
    customers: CustomerData[];
    legacyReceivables: LegacyReceivable[];
    onSave: (data: Omit<LegacyReceivable, 'id'>) => void;
    onUpdate: (item: LegacyReceivable) => void;
    onDelete: (id: number) => void;
}> = ({ customers, legacyReceivables, onSave, onUpdate, onDelete }) => {
    const [editingItem, setEditingItem] = useState<LegacyReceivable | null>(null);

    const initialFormState = useMemo(() => ({
        nota_id: '',
        customer: customers.length > 0 ? customers[0].name : '',
        order_date: getCurrentLocalDateStr(),
        description: '',
        length: '',
        width: '',
        qty: '1',
        amount: '',
    }), [customers]);
    
    const [formState, setFormState] = useState(initialFormState);
    
    // Pagination state for the list
    const [currentPage, setCurrentPage] = useState(1);
    const paginatedReceivables = useMemo(() => {
        const startIndex = (currentPage - 1) * 10; // Use smaller page size here
        return legacyReceivables.slice(startIndex, startIndex + 10);
    }, [legacyReceivables, currentPage]);

    useEffect(() => {
        const totalPages = Math.ceil(legacyReceivables.length / 10);
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [legacyReceivables, currentPage]);


    useEffect(() => {
        if (editingItem) {
            setFormState({
                nota_id: editingItem.nota_id,
                customer: editingItem.customer,
                order_date: editingItem.order_date,
                description: editingItem.description,
                length: editingItem.length?.toString() || '',
                width: editingItem.width?.toString() || '',
                qty: editingItem.qty.toString(),
                amount: editingItem.amount.toString(),
            });
        } else {
            setFormState(initialFormState);
        }
    }, [editingItem, initialFormState]);
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSubmit = {
            nota_id: formState.nota_id,
            customer: formState.customer,
            order_date: formState.order_date,
            description: formState.description,
            length: formState.length ? Number(formState.length) : null,
            width: formState.width ? Number(formState.width) : null,
            qty: Number(formState.qty),
            amount: Number(formState.amount),
        };
        
        if (editingItem) {
            onUpdate({ ...dataToSubmit, id: editingItem.id });
        } else {
            onSave(dataToSubmit);
        }
        setEditingItem(null);
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
    };

    const handleDeleteClick = (id: number) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus data piutang lama ini?")) {
            onDelete(id);
        }
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                 <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-700">{editingItem ? 'Edit Piutang Lama' : 'Tambah Piutang Pelanggan Lama'}</h4>
                    <input name="nota_id" value={formState.nota_id} onChange={handleInputChange} className="w-full p-2 border rounded-md" placeholder="No. Nota Lama" required />
                    <select name="customer" value={formState.customer} onChange={handleInputChange} className="w-full p-2 border bg-white rounded-md" required>
                        {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <input name="order_date" type="date" value={formState.order_date} onChange={handleInputChange} className="w-full p-2 border rounded-md" required />
                    <textarea name="description" value={formState.description} onChange={handleInputChange} className="w-full p-2 border rounded-md" placeholder="Deskripsi order..." required rows={2}></textarea>
                    <div className="grid grid-cols-2 gap-2">
                        <input name="length" type="number" value={formState.length} onChange={handleInputChange} className="w-full p-2 border rounded-md" placeholder="Panjang (m)" step="0.01" />
                        <input name="width" type="number" value={formState.width} onChange={handleInputChange} className="w-full p-2 border rounded-md" placeholder="Lebar (m)" step="0.01" />
                    </div>
                     <input name="qty" type="number" value={formState.qty} onChange={handleInputChange} className="w-full p-2 border rounded-md" placeholder="Qty" required min="1" />
                    <input name="amount" type="number" value={formState.amount} onChange={handleInputChange} className="w-full p-2 border rounded-md" placeholder="Nominal Piutang (Rp)" required />
                    <div className="flex space-x-2">
                        <button type="submit" className="w-full bg-amber-500 text-white py-2 rounded-lg font-semibold hover:bg-amber-600">{editingItem ? 'Update' : 'Simpan'}</button>
                        {editingItem && <button type="button" onClick={handleCancelEdit} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>}
                    </div>
                </form>
            </div>
            <div>
                <h4 className="font-semibold text-gray-700 mb-2">Daftar Piutang Lama (Belum Lunas)</h4>
                <div className="space-y-2">
                    {paginatedReceivables.map(item => (
                        <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-800">{item.customer} <span className="text-xs text-gray-500 font-normal">({item.nota_id})</span></p>
                                <p className="text-sm text-red-600 font-bold">{formatCurrency(item.amount)}</p>
                                <p className="text-xs text-gray-500">{formatDate(item.order_date)}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setEditingItem(item)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4"/></button>
                                <button onClick={() => handleDeleteClick(item.id)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
                 <Pagination
                    totalItems={legacyReceivables.length}
                    itemsPerPage={10}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    )
};

const AssetsAndDebts: React.FC<{
    assets: AssetItem[];
    debts: DebtItem[];
    bankInstallments: BankInstallment[];
    supplierBills: SupplierBill[];
    suppliers: SupplierData[];
    cashSnapshot: StoreCashSnapshot;
    legacyReceivables: LegacyReceivable[];
    ownerTransactions: OwnerTransaction[];
    ownerMonthlyClosings: OwnerMonthlyClosing[];
}> = ({
    assets,
    debts,
    bankInstallments,
    supplierBills,
    suppliers,
    cashSnapshot,
    legacyReceivables,
    ownerTransactions,
    ownerMonthlyClosings,
}) => {
    const [expandedSupplierKey, setExpandedSupplierKey] = useState<string | null>(null);

    // Group unpaid supplierBills per supplier (Otomatis dari Pembelian Kredit & Tagihan Pemasok)
    const supplierDebtGroups = useMemo(() => {
        const map = new Map<string, {
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
        }>();

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

    const totalFixedAssets = assets.reduce((sum, a) => sum + a.value, 0);
    const totalLegacyReceivables = useMemo(
        () => legacyReceivables.reduce((sum, r) => sum + Number(r.amount || 0), 0),
        [legacyReceivables]
    );
    const totalReceivablesAsset = cashSnapshot.unpaidCustomerReceivables + totalLegacyReceivables;
    const totalCurrentAssetsAuto = cashSnapshot.totalStoreLiquidCash + totalReceivablesAsset;
    const totalAllAssets = totalCurrentAssetsAuto + totalFixedAssets;

    // Hitung Kewajiban ke Owner (Gaji Terhutang + Bonus Siap Cair) & Pos Alokasi Internal
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

    const totalDebts = debts.reduce((sum, d) => sum + d.value, 0);
    const totalSupplierDebt = supplierDebtGroups.reduce((sum, g) => sum + g.remainingAmount, 0);
    const totalAllDebts = totalDebts + totalSupplierDebt + ownerBalanceSummary.totalOwnerObligations;
    const linkedDebtIds = new Set(bankInstallments.map(b => b.debtId).filter(Boolean));
    const supplierNamesLowerSet = useMemo(
        () => new Set(suppliers.map(s => s.name.trim().toLowerCase())),
        [suppliers]
    );
    const netWorth = totalAllAssets - totalAllDebts;

    return (
        <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                    <strong>Laporan Neraca Posisi Keuangan (Read-Only):</strong> Data dirangkum otomatis dari transaksi sistem.
                    Pengelolaan &amp; input <strong>Aset Tetap</strong> serta <strong>Hutang Manual</strong> dilakukan di menu{' '}
                    <strong>Owner Dashboard → Aset, Modal &amp; Hutang</strong>.
                </span>
                <span className="font-semibold text-slate-500">Siap Cetak PDF &amp; Export Excel di bagian bawah</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-5 rounded-lg border text-center">
                    <h3 className="text-sm font-semibold text-gray-600">Total Kekayaan Bersih (Total Aset - Semua Kewajiban)</h3>
                    <p className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(netWorth)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Aset Lancar + Tetap dikurangi Hutang &amp; Hak Owner
                    </p>
                </div>
                <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-200 text-center">
                    <h3 className="text-sm font-semibold text-emerald-800">Total Aset Usaha</h3>
                    <p className="text-2xl font-bold mt-1 text-emerald-700">{formatCurrency(totalAllAssets)}</p>
                    <p className="text-[11px] text-emerald-700/80 mt-1">
                        Lancar {formatCurrency(totalCurrentAssetsAuto)} + Tetap {formatCurrency(totalFixedAssets)}
                    </p>
                </div>
                <div className="bg-red-50 p-5 rounded-lg border border-red-200 text-center">
                    <h3 className="text-sm font-semibold text-red-700">Total Hutang &amp; Kewajiban</h3>
                    <p className="text-2xl font-bold mt-1 text-red-600">{formatCurrency(totalAllDebts)}</p>
                    <p className="text-[11px] text-red-700/80 mt-1">
                        Bank/Manual {formatCurrency(totalDebts)} • Pemasok {formatCurrency(totalSupplierDebt)} • Owner {formatCurrency(ownerBalanceSummary.totalOwnerObligations)}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Aktiva (Aset Usaha)</h3>
                    {/* Blok Aset Lancar Otomatis */}
                    <div className="border border-cyan-200 rounded-lg p-3.5 bg-cyan-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-cyan-900">
                                Aset Lancar Toko (Otomatis dari Sistem)
                            </h4>
                            <span className="text-xs font-bold text-cyan-800">{formatCurrency(totalCurrentAssetsAuto)}</span>
                        </div>
                        <div className="space-y-1.5 text-xs bg-white border border-cyan-100 rounded-md p-2.5">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Kas Laci Aktif</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(cashSnapshot.cashDrawerBalance)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Rekening Bank / QRIS / E-Wallet</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(cashSnapshot.totalBankBalance)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Kas Dipegang Owner (Titipan Toko)</span>
                                <span className="font-semibold text-gray-800">{formatCurrency(cashSnapshot.ownerHoldBalance)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-1">
                                <span className="text-gray-600">Piutang Pelanggan Aktif (Baru + Lama)</span>
                                <span className="font-semibold text-amber-700">{formatCurrency(totalReceivablesAsset)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2 border rounded-lg p-3 bg-gray-50/40">
                        <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-200">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
                                Aset Tetap / Inventaris ({assets.length} item)
                            </span>
                            <span className="text-xs font-bold text-green-700">{formatCurrency(totalFixedAssets)}</span>
                        </div>
                        {assets.length > 0 ? assets.map(item => (
                            <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                                <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
                                <p className="text-sm text-green-600 font-bold tabular-nums">{formatCurrency(item.value)}</p>
                            </div>
                        )) : (
                            <p className="text-xs text-gray-500 text-center py-4">Belum ada aset tetap yang dicatat.</p>
                        )}
                    </div>

                    <div className="p-3.5 bg-green-50 border border-green-200 rounded-lg space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                            <span>Aset Lancar (Kas Riil + Piutang)</span>
                            <span>{formatCurrency(totalCurrentAssetsAuto)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                            <span>Aset Tetap / Inventaris</span>
                            <span>{formatCurrency(totalFixedAssets)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-green-900 border-t border-green-200 pt-1">
                            <span>Total Semua Aset</span>
                            <span>{formatCurrency(totalAllAssets)}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Pasiva (Hutang &amp; Kewajiban)</h3>

                    {/* Daftar 1: Hutang Pemasok Otomatis (Rekap per Supplier dari Pembelian Kredit) */}
                    <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-amber-900">
                                Hutang Pemasok (Otomatis dari Pembelian Kredit)
                            </h4>
                            <span className="text-xs font-bold text-amber-800">{formatCurrency(totalSupplierDebt)}</span>
                        </div>
                        {supplierDebtGroups.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {supplierDebtGroups.map(group => {
                                    const isExpanded = expandedSupplierKey === group.key;
                                    return (
                                        <div key={group.key} className="bg-white border border-amber-200 rounded-lg p-2.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <p className="font-semibold text-gray-800 text-sm">{group.supplierName}</p>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                                            Otomatis • {group.bills.length} Nota
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                        Tagihan {formatCurrency(group.totalBillAmount)} • Terbayar {formatCurrency(group.totalPaidAmount)}
                                                        {group.nearestDueDate ? ` • Jatuh tempo: ${formatDate(group.nearestDueDate)}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-bold text-amber-700">{formatCurrency(group.remainingAmount)}</p>
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
                                                                <span className="font-semibold text-gray-800">{b.invoiceNumber}</span>
                                                                <span className="text-gray-500"> • {formatDate(b.date)}</span>
                                                                {b.description && <span className="text-gray-500"> — {b.description}</span>}
                                                            </div>
                                                            <span className="font-bold text-amber-800 whitespace-nowrap ml-2">{formatCurrency(b.remaining)}</span>
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

                    {/* Daftar 2: Kewajiban ke Owner (Otomatis Owner Dashboard) */}
                    <div className="border border-pink-200 rounded-lg p-3 bg-pink-50/40 space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wide text-pink-900">
                                Kewajiban ke Owner (Otomatis Owner Dashboard)
                            </h4>
                            <span className="text-xs font-bold text-pink-800">{formatCurrency(ownerBalanceSummary.totalOwnerObligations)}</span>
                        </div>
                        <div className="space-y-1.5 text-xs bg-white border border-pink-100 rounded-md p-2.5">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Gaji Owner Terhutang (Accrual)</span>
                                <span className="font-semibold text-pink-700">{formatCurrency(ownerBalanceSummary.pendingAccruedSalary)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Bonus Owner Siap Cair (Belum Ditarik)</span>
                                <span className="font-semibold text-pink-700">{formatCurrency(ownerBalanceSummary.bonusPayable)}</span>
                            </div>
                            <div className="border-t pt-1.5 mt-1 text-[11px] text-gray-500 space-y-0.5">
                                <p className="font-semibold text-gray-600">Info Saldo Pos Internal Toko (Bukan Hutang):</p>
                                <div className="flex justify-between">
                                    <span>Cadangan Usaha • Investasi Mesin • Buffer</span>
                                    <span className="font-medium text-gray-700">
                                        {formatCurrency(ownerBalanceSummary.reserveBalance)} / {formatCurrency(ownerBalanceSummary.equipmentBalance)} / {formatCurrency(ownerBalanceSummary.bufferBalance)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Daftar 3: Hutang Terdaftar / Cicilan Bank */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2 border rounded-lg p-3 bg-gray-50/40">
                        <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-200">
                            <span className="text-xs font-bold uppercase tracking-wide text-gray-600">
                                Hutang Terdaftar (Bank / Leasing / Saldo Awal)
                            </span>
                            <span className="text-xs font-bold text-red-600">{formatCurrency(totalDebts)}</span>
                        </div>
                        {debts.length > 0 ? debts.map(item => {
                            const isSupplierMatch = supplierNamesLowerSet.has(item.name.trim().toLowerCase());
                            const isLinkedBank = linkedDebtIds.has(item.id);
                            return (
                                <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="font-semibold text-gray-800 text-sm">{item.name}</p>
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
                                    <p className="text-sm text-red-600 font-bold tabular-nums whitespace-nowrap">{formatCurrency(item.value)}</p>
                                </div>
                            );
                        }) : (
                            <p className="text-xs text-gray-500 text-center py-4">Belum ada hutang bank/manual yang terdaftar.</p>
                        )}
                    </div>

                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                            <span>Hutang Bank / Umum / Saldo Awal</span>
                            <span>{formatCurrency(totalDebts)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-amber-800">
                            <span>Hutang Pemasok (Otomatis Pembelian)</span>
                            <span>{formatCurrency(totalSupplierDebt)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-pink-800">
                            <span>Kewajiban ke Owner (Gaji Terhutang + Bonus)</span>
                            <span>{formatCurrency(ownerBalanceSummary.totalOwnerObligations)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-red-800 border-t border-red-200 pt-1">
                            <span>Total Semua Hutang &amp; Kewajiban</span>
                            <span>{formatCurrency(totalAllDebts)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LegacyReceivableImportExportModal: React.FC<{
  show: boolean;
  onClose: () => void;
  filteredData: LegacyReceivable[];
  onAddLegacyReceivable: (newItem: Omit<LegacyReceivable, 'id'>) => void;
}> = ({ show, onClose, filteredData, onAddLegacyReceivable }) => {
    
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setUploadedFile(event.target.files[0]);
        }
    };
    
    const handleDownloadTemplate = () => {
        const templateData = [{
            'Tanggal': '2023-01-15',
            'No Nota': '12345',
            'Pelanggan': 'Contoh Pelanggan',
            'Deskripsi': 'Cetak Banner',
            'Panjang (m)': 2,
            'Lebar (m)': 1,
            'Qty': 1,
            'Nominal Piutang (Rp)': 50000
        }];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Piutang Lama");
        XLSX.writeFile(wb, "Template_Import_Piutang_Lama.xlsx");
    };

    const handleExportData = () => {
        const dataToExport = filteredData.map((item, index) => ({
            'No': index + 1,
            'Tanggal': item.order_date,
            'No Nota': item.nota_id,
            'Pelanggan': item.customer,
            'Deskripsi': item.description,
            'Panjang (m)': item.length,
            'Lebar (m)': item.width,
            'Qty': item.qty,
            'Nominal Piutang (Rp)': item.amount,
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data Piutang Lama");
        XLSX.writeFile(wb, "Laporan_Piutang_Lama.xlsx");
    };
    
    const handleImportData = () => {
        if (!uploadedFile) return;
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'array', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const jsonData: any[] = XLSX.utils.sheet_to_json(ws);
                let successCount = 0;

                jsonData.forEach(row => {
                    const newReceivable: Omit<LegacyReceivable, 'id'> = {
                        order_date: parseExcelDateToYmd(row['Tanggal']),
                        nota_id: String(row['No Nota'] || ''),
                        customer: String(row['Pelanggan'] || ''),
                        description: String(row['Deskripsi'] || ''),
                        length: row['Panjang (m)'] ? Number(row['Panjang (m)']) : null,
                        width: row['Lebar (m)'] ? Number(row['Lebar (m)']) : null,
                        qty: Number(row['Qty'] || 1),
                        amount: Number(row['Nominal Piutang (Rp)'] || 0),
                    };
                    if (newReceivable.nota_id && newReceivable.customer && newReceivable.amount > 0) {
                        onAddLegacyReceivable(newReceivable);
                        successCount++;
                    }
                });
                alert(`Impor selesai. ${successCount} data berhasil ditambahkan.`);
                onClose();
            } catch (error) {
                console.error("Error importing data:", error);
                alert("Gagal mengimpor file. Pastikan format sudah benar sesuai template.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-5">
                    <h3 className="text-xl font-bold text-gray-800">Impor dan Ekspor Piutang Lama</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-bold text-lg text-gray-700">Impor dari Excel</h4>
                        <div className="flex items-start space-x-3"><div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">1</div><div><h5 className="font-semibold">Unduh Template</h5><p className="text-xs text-gray-500 mb-2">Dapatkan file Excel dengan format kolom yang benar.</p><button onClick={handleDownloadTemplate} className="flex items-center text-sm bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300"><ArrowDownTrayIcon className="h-4 w-4 mr-2" />Unduh Template</button></div></div>
                        <div className="flex items-start space-x-3"><div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">2</div><div><h5 className="font-semibold">Unggah File</h5><p className="text-xs text-gray-500 mb-2">Pilih file template yang sudah Anda isi.</p><input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="text-sm file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" /></div></div>
                        <div className="flex items-start space-x-3"><div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">3</div><div><h5 className="font-semibold">Impor Data</h5><button onClick={handleImportData} disabled={!uploadedFile || isLoading} className="flex items-center text-sm bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 disabled:bg-pink-300"><ArrowUpTrayIcon className="h-4 w-4 mr-2" />{isLoading ? 'Memproses...' : 'Impor Data'}</button></div></div>
                    </div>
                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-bold text-lg text-gray-700">Ekspor ke Excel</h4>
                        <p className="text-sm text-gray-600">Unduh data piutang lama yang saat ini ditampilkan (sesuai filter) ke dalam file Excel.</p>
                        <button onClick={handleExportData} className="flex items-center text-sm bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700"><ArrowDownTrayIcon className="h-4 w-4 mr-2" />Unduh Data (Excel)</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const Reports: React.FC<ReportsProps> = (props) => {
    const { 
    allOrders, expenses, expenseMetadata = {}, purchases = [], inventoryMetadata = {}, inventoryCheckStatus = {}, productCostMetadata = {}, productCostGroups = [], supplierBills, bankInstallments, privateExpenses, cashDrawerState, cashDrawerLogs = [], cashTransfers = [], accountBalancesMeta = {}, ownerFinanceConfig, ownerTransactions = [], ownerMonthlyClosings = [], receivables, products, customers, suppliers = [], paymentMethods = [], inventory, categories, finishings,
    menuPermissions, legacyMonthlyIncomes, legacyMonthlyExpenses, legacyReceivables, assets, debts, notificationSettings, storeInfo,
    onAddLegacyMonthlyIncome, onUpdateLegacyMonthlyIncome, onDeleteLegacyMonthlyIncome,
    onAddLegacyMonthlyExpense, onUpdateLegacyMonthlyExpense, onDeleteLegacyMonthlyExpense,
    onAddLegacyReceivable, onUpdateLegacyReceivable, onDeleteLegacyReceivable,
    } = props;

    const [printPreviewDoc, setPrintPreviewDoc] = useState<{ title: string; html: string; canExportExcel?: boolean } | null>(null);
    const printIframeRef = useRef<HTMLIFrameElement>(null);

    const storeCashSnapshot = useMemo(
        () =>
            computeStoreCashSnapshot({
                paymentMethods,
                cashDrawerState: cashDrawerState || {
                    periodStartDate: getCurrentLocalDateStr(),
                    periodStartAt: new Date().toISOString(),
                    openingCash: 0,
                    settledCashInOnStartDate: 0,
                    settledCashOutOnStartDate: 0,
                },
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

    // Indexed Maps untuk pencarian instan O(1) tanpa perulangan linier 15.000 data
    const ordersMap = useMemo(() => {
        const map = new Map<string, SavedOrder>();
        for (let i = 0; i < allOrders.length; i++) {
            map.set(allOrders[i].id, allOrders[i]);
        }
        return map;
    }, [allOrders]);

    const receivablesMap = useMemo(() => {
        const map = new Map<string, ReceivableItem>();
        for (let i = 0; i < receivables.length; i++) {
            map.set(receivables[i].id, receivables[i]);
        }
        return map;
    }, [receivables]);

    const productsMap = useMemo(() => {
        const map = new Map<number, ProductData>();
        for (let i = 0; i < products.length; i++) {
            map.set(products[i].id, products[i]);
        }
        return map;
    }, [products]);

    const categoriesMap = useMemo(() => {
        const map = new Map<string, CategoryData>();
        for (let i = 0; i < categories.length; i++) {
            map.set(categories[i].name, categories[i]);
        }
        return map;
    }, [categories]);

    const customersMap = useMemo(() => {
        const map = new Map<string, CustomerData>();
        for (let i = 0; i < customers.length; i++) {
            map.set(customers[i].name, customers[i]);
        }
        return map;
    }, [customers]);

    const finishingsMap = useMemo(() => {
        const map = new Map<string, FinishingData>();
        for (let i = 0; i < finishings.length; i++) {
            map.set(finishings[i].name, finishings[i]);
        }
        return map;
    }, [finishings]);

    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`reports/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'noNota', order: 'desc' });
    
    const currentMonth = getCurrentLocalMonthStr(); // YYYY-MM
    const { startDate: firstDay, endDate: lastDay } = getMonthStartEnd(currentMonth);
    
    // States for sales report
    const [salesMonth, setSalesMonth] = useState(currentMonth);
    const [salesCustomer, setSalesCustomer] = useState('');
    const [isSalesCustomerDropdownOpen, setIsSalesCustomerDropdownOpen] = useState(false);


    // States for receivables report
    const [receivablesFilterType, setReceivablesFilterType] = useState<'all' | 'date' | 'month' | 'year'>('all');
    const [receivablesDueStatusFilter, setReceivablesDueStatusFilter] = useState<'all' | 'overdue' | 'due_soon' | 'active'>('all');
    const [receivablesStartDate, setReceivablesStartDate] = useState(firstDay);
    const [receivablesEndDate, setReceivablesEndDate] = useState(lastDay);
    const [receivablesMonth, setReceivablesMonth] = useState(currentMonth);
    const [receivablesYear, setReceivablesYear] = useState(new Date().getFullYear());
    const [receivablesCustomer, setReceivablesCustomer] = useState('');
    const [isReceivablesCustomerDropdownOpen, setIsReceivablesCustomerDropdownOpen] = useState(false);

    // States for category sales report
    const [categoryReportStartDate, setCategoryReportStartDate] = useState(firstDay);
    const [categoryReportEndDate, setCategoryReportEndDate] = useState(lastDay);
    const [categoryReportCustomer, setCategoryReportCustomer] = useState('');

    // States for inventory report
    const [inventorySearch, setInventorySearch] = useState('');
    const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<'Semua' | InventoryCategory>('Semua');
    const [inventoryConditionFilter, setInventoryConditionFilter] = useState<'Semua' | InventoryCondition>('Semua');
    const [inventoryStockStatusFilter, setInventoryStockStatusFilter] = useState<'Semua' | 'Stok Menipis' | 'Tersedia'>('Semua');

    const years = useMemo(() => {
        const yearSet = new Set<number>([new Date().getFullYear()]);
        const addYearFromDate = (dateStr?: string) => {
            const rawYear = dateStr?.substring(0, 4);
            if (rawYear) {
                const y = parseInt(rawYear, 10);
                if (!isNaN(y) && y > 1990 && y < 2100) yearSet.add(y);
            }
        };
        allOrders.forEach(o => addYearFromDate(o.orderDate));
        expenses.forEach(e => addYearFromDate(e.date));
        receivables.forEach(r => {
            addYearFromDate(r.due);
            r.payments?.forEach(p => addYearFromDate(p.date));
        });
        legacyMonthlyIncomes.forEach(i => addYearFromDate(i.month_date));
        legacyMonthlyExpenses.forEach(e => addYearFromDate(e.month_date));
        legacyReceivables.forEach(r => addYearFromDate(r.order_date));
        supplierBills.forEach(b => {
            addYearFromDate(b.date);
            b.payments.forEach(p => addYearFromDate(p.date));
        });
        bankInstallments.forEach(bi => bi.payments.forEach(p => addYearFromDate(p.date)));
        privateExpenses.forEach(pe => addYearFromDate(pe.date));
        return Array.from(yearSet).sort((a, b) => b - a);
    }, [allOrders, expenses, receivables, legacyMonthlyIncomes, legacyMonthlyExpenses, legacyReceivables, supplierBills, bankInstallments, privateExpenses]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    
    // States for legacy receivables tab
    const [legacyFilterCustomer, setLegacyFilterCustomer] = useState('');
    const [legacyFilterStartDate, setLegacyFilterStartDate] = useState('');
    const [legacyFilterEndDate, setLegacyFilterEndDate] = useState('');
    const [isLegacyFilterVisible, setIsLegacyFilterVisible] = useState(false);
    const [isLegacyImportExportModalOpen, setIsLegacyImportExportModalOpen] = useState(false);
    
    const handleResetSalesFilters = () => {
        setSalesMonth(currentMonth);
        setSalesCustomer('');
    };

    const handleResetReceivablesFilters = () => {
        setReceivablesFilterType('all');
        setReceivablesDueStatusFilter('all');
        setReceivablesMonth(currentMonth);
        setReceivablesStartDate(firstDay);
        setReceivablesEndDate(lastDay);
        setReceivablesYear(new Date().getFullYear());
        setReceivablesCustomer('');
    };

    const handleResetCategoryFilters = () => {
        setCategoryReportStartDate(firstDay);
        setCategoryReportEndDate(lastDay);
        setCategoryReportCustomer('');
    };

    const handleResetInventoryFilters = () => {
        setInventorySearch('');
        setInventoryCategoryFilter('Semua');
        setInventoryConditionFilter('Semua');
        setInventoryStockStatusFilter('Semua');
    };

    const handleResetLegacyFilters = () => {
        setLegacyFilterCustomer('');
        setLegacyFilterStartDate('');
        setLegacyFilterEndDate('');
    };


    useEffect(() => {
        if (years.length > 0 && !years.includes(selectedYear)) {
            setSelectedYear(years[0]);
        }
    }, [years, selectedYear]);

    useEffect(() => {
        if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
            setActiveTab(accessibleTabs[0].key);
        }
    }, [accessibleTabs, activeTab]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [
        activeTab,
        selectedYear,
        sortConfig,
        salesMonth,
        salesCustomer,
        receivablesMonth,
        receivablesCustomer,
        receivablesFilterType,
        receivablesDueStatusFilter,
        receivablesStartDate,
        receivablesEndDate,
        receivablesYear,
        inventorySearch,
        inventoryCategoryFilter,
        inventoryConditionFilter,
        inventoryStockStatusFilter,
    ]);
    
    const requestSort = (key: string) => {
        let order: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.order === 'asc') {
            order = 'desc';
        }
        setSortConfig({ key, order });
    };

    // --- START P&L LOGIC ---
    const [pnlMode, setPnlMode] = useState<'cash' | 'accrual'>('cash');
    const [pnlFilterType, setPnlFilterType] = useState<'month' | 'year'>('month');
    const [pnlSelectedMonth, setPnlSelectedMonth] = useState(getCurrentLocalMonthStr()); // YYYY-MM
    const [pnlSelectedYear, setPnlSelectedYear] = useState(new Date().getFullYear());

    const { pnlStartDate, pnlEndDate } = useMemo(() => {
        if (pnlFilterType === 'year') {
            return { pnlStartDate: `${pnlSelectedYear}-01-01`, pnlEndDate: `${pnlSelectedYear}-12-31` };
        }
        const { startDate, endDate } = getMonthStartEnd(pnlSelectedMonth);
        return { pnlStartDate: startDate, pnlEndDate: endDate };
    }, [pnlFilterType, pnlSelectedMonth, pnlSelectedYear]);
    
    const pnlFilteredReceivables = useMemo(() => receivables.filter(r => r.payments && r.payments.some(p => p.date >= pnlStartDate && p.date <= pnlEndDate)), [receivables, pnlStartDate, pnlEndDate]);
    const pnlFilteredExpenses = useMemo(() => expenses.filter(e => e.date >= pnlStartDate && e.date <= pnlEndDate), [expenses, pnlStartDate, pnlEndDate]);
    const pnlFilteredLegacyIncomes = useMemo(() => legacyMonthlyIncomes.filter(i => i.month_date >= pnlStartDate && i.month_date <= pnlEndDate), [legacyMonthlyIncomes, pnlStartDate, pnlEndDate]);
    const pnlFilteredLegacyExpenses = useMemo(() => legacyMonthlyExpenses.filter(e => e.month_date >= pnlStartDate && e.month_date <= pnlEndDate), [legacyMonthlyExpenses, pnlStartDate, pnlEndDate]);

    const pnlIncomeTableData = useMemo(() => {
        const incomeByCategory = new Map<string, number>();

        const incomeFromNewSystem = { regular: 0, fromLegacy: 0 };
        pnlFilteredReceivables.forEach(r => {
            const paymentsInPeriod = r.payments?.filter(p => p.date >= pnlStartDate && p.date <= pnlEndDate) || [];
            const totalPayments = paymentsInPeriod.reduce((pSum, p) => pSum + p.amount, 0);
            // Paid legacy receivables are converted to new receivables with 'Nota-' prefix
            if (r.id.startsWith('Nota-')) {
                incomeFromNewSystem.fromLegacy += totalPayments;
            } else {
                incomeFromNewSystem.regular += totalPayments;
            }
        });

        if (incomeFromNewSystem.regular > 0) {
            incomeByCategory.set('Penjualan Sistem Baru (Regular)', incomeFromNewSystem.regular);
        }
        if (incomeFromNewSystem.fromLegacy > 0) {
            incomeByCategory.set('Pembayaran Piutang Lama', incomeFromNewSystem.fromLegacy);
        }

        if(pnlFilteredLegacyIncomes.length > 0){
            const legacySum = pnlFilteredLegacyIncomes.reduce((sum, item) => sum + item.amount, 0);
            incomeByCategory.set('Pemasukan Data Lama (Bulanan)', legacySum);
        }
        
        return Array.from(incomeByCategory.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredReceivables, pnlFilteredLegacyIncomes, pnlStartDate, pnlEndDate]);

    const pnlExpenseTableData = useMemo(() => {
        const data = new Map<string, { total: number; allocationAmount: number }>();
        pnlFilteredExpenses.forEach(exp => {
            const cur = data.get(exp.category) || { total: 0, allocationAmount: 0 };
            cur.total += exp.amount;
            if (expenseMetadata[exp.id]?.ownerTxId) {
                cur.allocationAmount += exp.amount;
            }
            data.set(exp.category, cur);
        });
        if (pnlFilteredLegacyExpenses.length > 0) {
            const legacySum = pnlFilteredLegacyExpenses.reduce((sum, item) => sum + item.amount, 0);
            data.set('Pengeluaran Data Lama', { total: legacySum, allocationAmount: 0 });
        }
        return Array.from(data.entries())
            .map(([name, val]) => ({ name, total: val.total, allocationAmount: val.allocationAmount }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredExpenses, pnlFilteredLegacyExpenses, expenseMetadata]);

    const pnlSummary = useMemo(() => {
        const totalIncome = pnlIncomeTableData.reduce((sum, item) => sum + item.total, 0);
        const totalExpense = pnlExpenseTableData.reduce((sum, item) => sum + item.total, 0);
        return { totalSales: totalIncome, totalExpenses: totalExpense, profit: totalIncome - totalExpense };
    }, [pnlIncomeTableData, pnlExpenseTableData]);

    const pnlOwnerSalaryInfo = useMemo(() => {
        const monthPrefix = pnlFilterType === 'month' ? pnlSelectedMonth : `${pnlSelectedYear}-`;
        let paid = 0;
        let accrued = 0;
        ownerTransactions.forEach(tx => {
            if (!tx.month.startsWith(monthPrefix)) return;
            if (tx.type === 'salary_paid') paid += Number(tx.amount || 0);
            if (tx.type === 'salary_accrual') accrued += Number(tx.amount || 0);
        });
        return { paid, accrued, unpaidAccrued: Math.max(0, accrued - paid) };
    }, [ownerTransactions, pnlFilterType, pnlSelectedMonth, pnlSelectedYear]);

    const pnlNonOperational = useMemo(() => {
        const isStoreFund = (src: string) => src === 'Kas Laci' || src === 'Transfer Bank' || src === 'Kas Dipegang Owner';
        const supplierPaid = supplierBills.reduce((sum, bill) => {
            const inPeriod = bill.payments.filter(
                p => p.date >= pnlStartDate && p.date <= pnlEndDate && isStoreFund(p.fundingSource)
            );
            return sum + inPeriod.reduce((ps, p) => ps + p.amount, 0);
        }, 0);

        let bankPaid = 0;
        let bankPrincipalPaid = 0;
        let bankInterestPaid = 0;
        bankInstallments.forEach(inst => {
            inst.payments.forEach(p => {
                if (p.date >= pnlStartDate && p.date <= pnlEndDate && isStoreFund(p.fundingSource)) {
                    bankPaid += Number(p.totalPaid || 0);
                    bankPrincipalPaid += Number(p.principalPaid || 0);
                    bankInterestPaid += Number(p.interestPaid || 0);
                }
            });
        });

        const privateStorePaid = privateExpenses
            .filter(pe => pe.date >= pnlStartDate && pe.date <= pnlEndDate && pe.fundingSource !== 'Uang Pribadi Owner')
            .reduce((sum, pe) => sum + pe.amount, 0);
        const privateOwnerPaid = privateExpenses
            .filter(pe => pe.date >= pnlStartDate && pe.date <= pnlEndDate && pe.fundingSource === 'Uang Pribadi Owner')
            .reduce((sum, pe) => sum + pe.amount, 0);

        const ownerModuleLinkedTransferIds = new Set(
            ownerTransactions
                .filter(tx => (tx.type === 'bonus_payout' || tx.type === 'prive') && tx.linkedTransferId)
                .map(tx => tx.linkedTransferId!)
        );

        const setorOwnerOut = cashDrawerLogs
            .filter(log => {
                if (log.type !== 'Setor') return false;
                if (log.depositMode === 'owner_hold' || log.depositMode === 'bank_account') return false;
                const isPrive = log.depositMode === 'owner_prive' || !log.depositToAccountId;
                if (!isPrive) return false;
                const logDate = log.timestamp ? log.timestamp.slice(0, 10) : log.periodEndDate;
                return logDate >= pnlStartDate && logDate <= pnlEndDate;
            })
            .reduce((sum, log) => sum + Number(log.depositAmount || 0), 0);

        let ownerBonusPriveTransferOut = 0;
        let manualTarikOwnerOut = 0;
        let transferAdminFeeOut = 0;
        cashTransfers.forEach(t => {
            if (!t.date || t.date < pnlStartDate || t.date > pnlEndDate) return;
            if (t.transferType === 'Tarik Owner') {
                if (ownerModuleLinkedTransferIds.has(t.id)) {
                    ownerBonusPriveTransferOut += Number(t.amount || 0);
                } else {
                    manualTarikOwnerOut += Number(t.amount || 0);
                }
            } else if (t.transferType === 'Pindah Akun') {
                transferAdminFeeOut += Number(t.adminFee || 0);
            }
        });

        const tarikOwnerOut = ownerBonusPriveTransferOut + manualTarikOwnerOut;
        const ownerOutTotal = setorOwnerOut + tarikOwnerOut + transferAdminFeeOut;
        const netCashflowAfterAll = pnlSummary.profit - supplierPaid - bankPaid - privateStorePaid - ownerOutTotal;

        return {
            supplierPaid,
            bankPaid,
            bankPrincipalPaid,
            bankInterestPaid,
            privateStorePaid,
            privateOwnerPaid,
            setorOwnerOut,
            ownerBonusPriveTransferOut,
            manualTarikOwnerOut,
            tarikOwnerOut,
            transferAdminFeeOut,
            ownerOutTotal,
            netCashflowAfterAll,
        };
    }, [supplierBills, bankInstallments, privateExpenses, cashDrawerLogs, cashTransfers, ownerTransactions, pnlStartDate, pnlEndDate, pnlSummary.profit]);

    // Kinerja Basis Nota (Akrual) selaras dengan Tutup Buku Keuangan Owner
    const pnlAccrualPerformance = useMemo(() => {
        const targetSalary = ownerFinanceConfig?.monthlySalary || 0;
        const salaryByMonth = new Map<string, { paid: number; accrued: number }>();
        ownerTransactions.forEach(tx => {
            if (tx.type !== 'salary_paid' && tx.type !== 'salary_accrual') return;
            const cur = salaryByMonth.get(tx.month) || { paid: 0, accrued: 0 };
            if (tx.type === 'salary_paid') cur.paid += Number(tx.amount || 0);
            else cur.accrued += Number(tx.amount || 0);
            salaryByMonth.set(tx.month, cur);
        });

        if (pnlFilterType === 'month') {
            const sal = salaryByMonth.get(pnlSelectedMonth) || { paid: 0, accrued: 0 };
            const perf = computeMonthlyAccrualPerformance({
                month: pnlSelectedMonth,
                allOrders,
                receivables,
                expenses,
                expenseMetadata,
                purchases,
                supplierBills,
                bankInstallments,
                targetMonthlyOwnerSalary: targetSalary,
                ownerSalaryPaidForMonth: sal.paid,
                ownerSalaryAccruedForMonth: sal.accrued,
            });
            const recognizedOwnerSalary =
                sal.accrued > 0
                    ? Math.max(perf.ownerSalaryPaidInExpenses, Math.max(sal.accrued, sal.paid > 0 ? sal.paid : targetSalary))
                    : perf.ownerSalaryPaidInExpenses;
            const isClosed = ownerMonthlyClosings.some(c => c.month === pnlSelectedMonth);
            return { ...perf, recognizedOwnerSalary, isClosed, closedMonthsCount: isClosed ? 1 : 0 };
        }

        // Per Tahun: agregasi 12 bulan
        let accrualSales = 0;
        let cashOrderPayments = 0;
        let lunasMaterialPurchases = 0;
        let creditSupplierInvoices = 0;
        let otherOperationalExpenses = 0;
        let ownerSalaryPaidInExpenses = 0;
        let ownerSalaryUnpaidAccrued = 0;
        let recognizedOwnerSalary = 0;
        let bankInterestInMonth = 0;
        let accrualNetProfit = 0;
        let cashNetInMonth = 0;
        let closedMonthsCount = 0;

        for (let m = 1; m <= 12; m++) {
            const ym = `${pnlSelectedYear}-${String(m).padStart(2, '0')}`;
            const sal = salaryByMonth.get(ym) || { paid: 0, accrued: 0 };
            const perf = computeMonthlyAccrualPerformance({
                month: ym,
                allOrders,
                receivables,
                expenses,
                expenseMetadata,
                purchases,
                supplierBills,
                bankInstallments,
                targetMonthlyOwnerSalary: targetSalary,
                ownerSalaryPaidForMonth: sal.paid,
                ownerSalaryAccruedForMonth: sal.accrued,
            });
            accrualSales += perf.accrualSales;
            cashOrderPayments += perf.cashOrderPayments;
            lunasMaterialPurchases += perf.lunasMaterialPurchases;
            creditSupplierInvoices += perf.creditSupplierInvoices;
            otherOperationalExpenses += perf.otherOperationalExpenses;
            ownerSalaryPaidInExpenses += perf.ownerSalaryPaidInExpenses;
            ownerSalaryUnpaidAccrued += perf.ownerSalaryUnpaidAccrued;
            recognizedOwnerSalary +=
                sal.accrued > 0
                    ? Math.max(perf.ownerSalaryPaidInExpenses, Math.max(sal.accrued, sal.paid > 0 ? sal.paid : targetSalary))
                    : perf.ownerSalaryPaidInExpenses;
            bankInterestInMonth += perf.bankInterestInMonth;
            accrualNetProfit += perf.accrualNetProfit;
            cashNetInMonth += perf.cashNetInMonth;
            if (ownerMonthlyClosings.some(c => c.month === ym)) closedMonthsCount++;
        }

        return {
            month: String(pnlSelectedYear),
            accrualSales,
            cashOrderPayments,
            lunasMaterialPurchases,
            creditSupplierInvoices,
            otherOperationalExpenses,
            ownerSalaryPaidInExpenses,
            ownerSalaryUnpaidAccrued,
            recognizedOwnerSalary,
            bankInterestInMonth,
            accrualNetProfit,
            cashNetInMonth,
            isClosed: closedMonthsCount === 12,
            closedMonthsCount,
        };
    }, [
        pnlFilterType,
        pnlSelectedMonth,
        pnlSelectedYear,
        allOrders,
        receivables,
        expenses,
        expenseMetadata,
        purchases,
        supplierBills,
        bankInstallments,
        ownerFinanceConfig,
        ownerTransactions,
        ownerMonthlyClosings,
    ]);

    const pnlChartData = useMemo(() => {
        if (pnlFilterType === 'month') {
            const daysInMonth = new Date(parseInt(pnlSelectedMonth.slice(0, 4)), parseInt(pnlSelectedMonth.slice(5, 7)), 0).getDate();
            const dailyData: { name: string; Pendapatan: number; Pengeluaran: number }[] = Array.from({ length: daysInMonth }, (_, i) => ({ name: `${i + 1}`, Pendapatan: 0, Pengeluaran: 0 }));
            
            // Pendapatan
            pnlFilteredReceivables.forEach(r => r.payments?.forEach(p => { if (p.date >= pnlStartDate && p.date <= pnlEndDate) { const day = new Date(p.date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pendapatan += p.amount; }}));
            pnlFilteredLegacyIncomes.forEach(i => { const day = new Date(i.month_date).getUTCDate() - 1; if(dailyData[day]) dailyData[day].Pendapatan += Number(i.amount); });
            
            // Pengeluaran
            pnlFilteredExpenses.forEach(e => { const day = new Date(e.date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pengeluaran += e.amount; });
            pnlFilteredLegacyExpenses.forEach(e => { const day = new Date(e.month_date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pengeluaran += Number(e.amount); });

            return dailyData;
        } else {
            const monthlyData = Array.from({length: 12}, (_, i) => ({ name: new Date(0, i).toLocaleString('id-ID', {month: 'short'}), Pendapatan: 0, Pengeluaran: 0 }));
            
            // Pendapatan
            pnlFilteredReceivables.forEach(r => r.payments?.forEach(p => { if (p.date >= pnlStartDate && p.date <= pnlEndDate) { const month = new Date(p.date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pendapatan += p.amount; }}));
            pnlFilteredLegacyIncomes.forEach(i => { const month = new Date(i.month_date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pendapatan += Number(i.amount); });

            // Pengeluaran
            pnlFilteredExpenses.forEach(e => { const month = new Date(e.date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pengeluaran += e.amount; });
            pnlFilteredLegacyExpenses.forEach(e => { const month = new Date(e.month_date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pengeluaran += Number(e.amount); });

            return monthlyData;
        }
    }, [pnlFilterType, pnlSelectedMonth, pnlSelectedYear, pnlFilteredReceivables, pnlFilteredExpenses, pnlFilteredLegacyIncomes, pnlFilteredLegacyExpenses, pnlStartDate, pnlEndDate]);
    
    // --- END P&L LOGIC ---

    // Perhitungan kumulatif terpadu (dibagi bersama halaman Arus Kas agar Saldo Akhir Estimasi selalu 100% sama)
    const globalFinancialRecap = useMemo(
        () =>
            calculateGlobalFinancialRecap({
                legacyMonthlyIncomes,
                legacyMonthlyExpenses,
                receivables,
                expenses,
                supplierBills,
                bankInstallments,
                privateExpenses,
                cashDrawerLogs,
                cashTransfers,
            }),
        [
            legacyMonthlyIncomes,
            legacyMonthlyExpenses,
            receivables,
            expenses,
            supplierBills,
            bankInstallments,
            privateExpenses,
            cashDrawerLogs,
            cashTransfers,
        ]
    );

    // Ringkasan Neraca Aset & Hutang terpadu (untuk Excel & Print)
    const assetsDebtsExportData = useMemo(() => {
        const totalFixedAssets = assets.reduce((sum, a) => sum + Number(a.value || 0), 0);
        const totalLegacyReceivables = legacyReceivables.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const totalReceivablesAsset = storeCashSnapshot.unpaidCustomerReceivables + totalLegacyReceivables;
        const totalCurrentAssetsAuto = storeCashSnapshot.totalStoreLiquidCash + totalReceivablesAsset;
        const totalAllAssets = totalCurrentAssetsAuto + totalFixedAssets;

        const supplierMap = new Map<string, {
            supplierName: string;
            remainingAmount: number;
            nearestDueDate: string;
            bills: SupplierBill[];
        }>();
        supplierBills.forEach(bill => {
            if (bill.status !== 'Belum Lunas') return;
            const paidAmount = bill.payments.reduce((ps, p) => ps + Number(p.amount || 0), 0);
            const remaining = Math.max(0, Number(bill.totalAmount || 0) - paidAmount);
            if (remaining <= 0) return;
            const key = bill.supplierName.trim().toLowerCase();
            if (!supplierMap.has(key)) {
                supplierMap.set(key, {
                    supplierName: bill.supplierName.trim(),
                    remainingAmount: 0,
                    nearestDueDate: bill.dueDate || '',
                    bills: [],
                });
            }
            const g = supplierMap.get(key)!;
            g.remainingAmount += remaining;
            if (bill.dueDate && (!g.nearestDueDate || bill.dueDate < g.nearestDueDate)) {
                g.nearestDueDate = bill.dueDate;
            }
            g.bills.push(bill);
        });
        const supplierDebtGroups = Array.from(supplierMap.values()).sort((a, b) => b.remainingAmount - a.remainingAmount);
        const totalSupplierDebt = supplierDebtGroups.reduce((s, g) => s + g.remainingAmount, 0);

        const salaryByMonth = new Map<string, { paid: number; accrued: number }>();
        let bonusIn = 0;
        let bonusOut = 0;
        ownerMonthlyClosings.forEach(c => {
            bonusIn += Number(c.allocations?.bonus || 0);
        });
        ownerTransactions.forEach(tx => {
            const amt = Number(tx.amount || 0);
            if (tx.type === 'salary_paid' || tx.type === 'salary_accrual') {
                const cur = salaryByMonth.get(tx.month) || { paid: 0, accrued: 0 };
                if (tx.type === 'salary_paid') cur.paid += amt;
                else cur.accrued += amt;
                salaryByMonth.set(tx.month, cur);
            } else if (tx.type === 'bonus_payout') {
                bonusOut += amt;
            }
        });
        let pendingAccruedSalary = 0;
        salaryByMonth.forEach(v => {
            pendingAccruedSalary += Math.max(0, v.accrued - v.paid);
        });
        const bonusPayable = Math.max(0, bonusIn - bonusOut);
        const totalOwnerObligations = pendingAccruedSalary + bonusPayable;

        const linkedDebtIds = new Set(bankInstallments.map(b => b.debtId).filter(Boolean));
        const totalDebts = debts.reduce((sum, d) => sum + Number(d.value || 0), 0);
        const totalAllDebts = totalDebts + totalSupplierDebt + totalOwnerObligations;
        const netWorth = totalAllAssets - totalAllDebts;

        return {
            cashDrawerBalance: storeCashSnapshot.cashDrawerBalance,
            totalBankBalance: storeCashSnapshot.totalBankBalance,
            ownerHoldBalance: storeCashSnapshot.ownerHoldBalance,
            totalReceivablesAsset,
            totalCurrentAssetsAuto,
            totalFixedAssets,
            totalAllAssets,
            fixedAssets: assets,
            supplierDebtGroups,
            totalSupplierDebt,
            pendingAccruedSalary,
            bonusPayable,
            totalOwnerObligations,
            manualDebts: debts.map(d => ({ ...d, isLinkedBank: linkedDebtIds.has(d.id) })),
            totalDebts,
            totalAllDebts,
            netWorth,
        };
    }, [assets, debts, bankInstallments, supplierBills, storeCashSnapshot, legacyReceivables, ownerTransactions, ownerMonthlyClosings]);

    // Data terfilter untuk Data Piutang Lama
    const filteredLegacyReceivables = useMemo(() => {
        const q = legacyFilterCustomer.trim().toLowerCase();
        return legacyReceivables.filter(item => {
            if (q && !item.customer.toLowerCase().includes(q) && !item.nota_id.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
                return false;
            }
            if (legacyFilterStartDate && item.order_date < legacyFilterStartDate) return false;
            if (legacyFilterEndDate && item.order_date > legacyFilterEndDate) return false;
            return true;
        });
    }, [legacyReceivables, legacyFilterCustomer, legacyFilterStartDate, legacyFilterEndDate]);

    const handleExport = () => {
        let dateRange: { startDate: string, endDate: string };
        if (activeTab === 'sales') {
            const { startDate, endDate } = getSalesDateRange();
            dateRange = { startDate, endDate };
        } else if (activeTab === 'receivables') {
            const { startDate, endDate } = getReceivablesDateRange();
            dateRange = { startDate, endDate };
        } else if (activeTab === 'categorySales') {
            dateRange = { startDate: categoryReportStartDate, endDate: categoryReportEndDate };
        } else {
            dateRange = { startDate: '', endDate: '' };
        }
        
        switch(activeTab) {
            case 'sales':
                exportToExcel(
                    'sales', 
                    { 
                        transactions: filteredSalesData,
                    },
                    dateRange,
                    {
                        products,
                        categories,
                        customers,
                        finishings,
                        receivables
                    }
                );
                break;
            case 'categorySales':
                exportToExcel(
                    'categorySales',
                    {
                        categories: categorySalesReport.categories,
                        topProducts: categorySalesReport.topProducts,
                    },
                    dateRange
                );
                break;
            case 'receivables':
                exportToExcel(
                    'receivables',
                    filteredReceivablesData.map(r => ({
                        id: r.type === 'legacy' ? r.nota_id : r.id,
                        nota_id: r.type === 'legacy' ? r.nota_id : undefined,
                        customer: r.customer,
                        amount: r.amount,
                        discount: r.discount || 0,
                        paid: r.paid,
                        remaining: r.remaining,
                        paymentStatus: r.paymentStatus,
                        productionStatus: r.productionStatus,
                        due: r.due,
                        type: r.type,
                        dueStatusLabel: r.dueStatusLabel,
                    })),
                    dateRange
                );
                break;
            case 'inventory':
                exportToExcel('inventory', filteredInventoryData, { startDate: '', endDate: '' }, {
                    lowStockThreshold: notificationSettings.lowStockThreshold,
                    inventoryMetadata,
                });
                break;
            case 'profitAndLoss':
                exportToExcel(
                    'profitAndLoss',
                    {
                        periodLabel:
                            pnlFilterType === 'month'
                                ? formatMonthLabel(pnlSelectedMonth)
                                : `Tahun ${pnlSelectedYear}`,
                        cashSummary: pnlSummary,
                        incomeRows: pnlIncomeTableData,
                        expenseRows: pnlExpenseTableData,
                        nonOperational: pnlNonOperational,
                        accrual: pnlAccrualPerformance,
                        chartData: pnlChartData,
                    },
                    { startDate: pnlStartDate, endDate: pnlEndDate }
                );
                break;
            case 'assetsDebts':
                exportToExcel('assetsDebts', assetsDebtsExportData, { startDate: '', endDate: '' });
                break;
            case 'dataPenjualanLama':
                exportToExcel(
                    'legacySales',
                    { incomes: legacyMonthlyIncomes, expenses: legacyMonthlyExpenses },
                    { startDate: '', endDate: '' }
                );
                break;
            case 'dataPiutangLama':
                exportToExcel(
                    'legacyReceivables',
                    filteredLegacyReceivables,
                    { startDate: legacyFilterStartDate, endDate: legacyFilterEndDate }
                );
                break;
            default:
                alert('Ekspor tidak tersedia untuk laporan ini.');
        }
    };

    const storeDisplayName = storeInfo?.name?.trim() || 'Nala Media Digital Printing';
    const storeDisplayAddress = storeInfo?.address?.trim() || '';
    const storeDisplayContact = [storeInfo?.phone?.trim(), storeInfo?.email?.trim()].filter(Boolean).join(' • ');

    const handleTriggerPrint = () => {
        const win = printIframeRef.current?.contentWindow;
        if (win) {
            win.focus();
            win.print();
        }
    };

    const handlePrintReport = () => {
        const printableTabs = ['sales', 'categorySales', 'receivables', 'profitAndLoss', 'inventory', 'assetsDebts', 'dataPenjualanLama', 'dataPiutangLama'];
        if (!printableTabs.includes(activeTab)) {
            return;
        }

        const reportTitle =
            activeTab === 'sales' ? 'Laporan Penjualan' :
            activeTab === 'categorySales' ? 'Laporan Penjualan per Kategori' :
            activeTab === 'receivables' ? 'Laporan Piutang (Belum Lunas)' :
            activeTab === 'inventory' ? 'Laporan Stok Inventori' :
            activeTab === 'assetsDebts' ? 'Laporan Neraca Aset & Hutang Usaha' :
            activeTab === 'dataPenjualanLama' ? 'Rekap Data Penjualan & Pengeluaran Lama' :
            activeTab === 'dataPiutangLama' ? 'Daftar Piutang Pelanggan Lama' :
            'Laporan Laba Rugi';

        const { startDate: salesStartDate, endDate: salesEndDate } = getSalesDateRange();
        const { startDate: receivablesStartDate, endDate: receivablesEndDate } = getReceivablesDateRange();

        const period = activeTab === 'profitAndLoss'
            ? (pnlFilterType === 'month' ? `Periode: ${formatMonthLabel(pnlSelectedMonth)}` : `Periode: Tahun ${pnlSelectedYear}`)
            : activeTab === 'sales'
            ? `Periode: ${formatDate(salesStartDate)} - ${formatDate(salesEndDate)}`
            : activeTab === 'categorySales'
            ? `Periode: ${categoryReportStartDate ? formatDate(categoryReportStartDate) : 'Awal'} - ${categoryReportEndDate ? formatDate(categoryReportEndDate) : 'Sekarang'}`
            : activeTab === 'receivables'
            ? (receivablesFilterType === 'all'
                ? 'Periode: Semua Waktu (Lintas Tahun)'
                : `Periode: ${formatDate(receivablesStartDate)} - ${formatDate(receivablesEndDate)}`)
            : activeTab === 'dataPiutangLama' && (legacyFilterStartDate || legacyFilterEndDate)
            ? `Periode: ${legacyFilterStartDate ? formatDate(legacyFilterStartDate) : 'Awal'} - ${legacyFilterEndDate ? formatDate(legacyFilterEndDate) : 'Sekarang'}`
            : `Tanggal Cetak: ${formatDate(getCurrentLocalDateStr())}`;

        const headerHtml = `
            <div class="header">
                <div>
                    <h2>${escapeHtml(storeDisplayName)}</h2>
                    ${storeDisplayAddress ? `<p style="font-size:8pt; margin:0;">${escapeHtml(storeDisplayAddress)}</p>` : ''}
                    ${storeDisplayContact ? `<p style="font-size:8pt; margin:0;">${escapeHtml(storeDisplayContact)}</p>` : ''}
                </div>
                <h1>${escapeHtml(reportTitle)}</h1>
            </div>
            <hr>
            <div class="customer-info">
                <strong>${
                    activeTab === 'sales' && salesCustomer ? `Pelanggan: ${escapeHtml(salesCustomer)}` :
                    activeTab === 'categorySales' && categoryReportCustomer ? `Pelanggan: ${escapeHtml(categoryReportCustomer)}` :
                    activeTab === 'receivables' && receivablesCustomer ? `Pelanggan: ${escapeHtml(receivablesCustomer)}` :
                    activeTab === 'dataPiutangLama' && legacyFilterCustomer ? `Filter: ${escapeHtml(legacyFilterCustomer)}` :
                    '&nbsp;'
                }</strong>
                <span>${escapeHtml(period)}</span>
            </div>
            <hr>
        `;

        let tableHtml = '';
        let summaryHtml = '';

        if (activeTab === 'sales') {
            const allDetailedSales = sortedDetailedSalesData.map(item => `
                <tr>
                    <td>${item.no}</td>
                    <td>${escapeHtml(formatDate(item.tanggal))}</td>
                    <td>${escapeHtml(item.noNota)}</td>
                    <td>${escapeHtml(item.pelanggan)}</td>
                    <td>${escapeHtml(item.deskripsi)}</td>
                    <td>${escapeHtml(item.bahan)}</td>
                    <td>${escapeHtml(item.p)}</td>
                    <td>${escapeHtml(item.l)}</td>
                    <td>${item.qty}</td>
                    <td class="currency">${formatCurrency(item.total)}</td>
                    <td>${escapeHtml(item.status)}</td>
                </tr>
            `).join('');

            const grossSales = filteredSalesData.reduce((sum, order) => sum + order.totalPrice, 0);
            const totalDiscount = filteredSalesData.reduce((sum, order) => sum + (receivablesMap.get(order.id)?.discount || 0), 0);
            const netSales = Math.max(0, grossSales - totalDiscount);

            tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Tanggal</th>
                            <th>No. Nota</th>
                            <th>Pelanggan</th>
                            <th>Deskripsi</th>
                            <th>Bahan</th>
                            <th>P</th>
                            <th>L</th>
                            <th>Qty</th>
                            <th class="currency">Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${allDetailedSales || '<tr><td colspan="11" style="text-align:center;">Tidak ada data penjualan pada periode ini.</td></tr>'}</tbody>
                </table>
            `;
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 300px; float: right; border: none;">
                        ${totalDiscount > 0 ? `
                            <tr><td style="border:none;">Penjualan Kotor:</td><td style="border:none;" class="currency">${formatCurrency(grossSales)}</td></tr>
                            <tr><td style="border:none;">Total Diskon Nota:</td><td style="border:none;" class="currency">- ${formatCurrency(totalDiscount)}</td></tr>
                        ` : ''}
                        <tr><td style="border:none;">Total Penjualan Bersih:</td><td style="border:none;" class="currency"><strong>${formatCurrency(netSales)}</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'categorySales') {
            const catRows = categorySalesReport.categories.map((c, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(c.categoryName)}</td>
                    <td>${escapeHtml(c.unitType)}</td>
                    <td class="currency">${c.orderCount}</td>
                    <td class="currency">${c.totalQty}</td>
                    <td class="currency">${c.unitType === 'Per Luas' ? `${c.totalAreaM2.toFixed(2)} m²` : '-'}</td>
                    <td class="currency">${formatCurrency(Math.round(c.grossSales))}</td>
                    <td class="currency"><strong>${formatCurrency(Math.round(c.netSales))}</strong></td>
                    <td class="currency">${formatCurrency(Math.round(c.estimatedCost))}</td>
                    <td class="currency"><strong>${formatCurrency(Math.round(c.grossProfit))}</strong></td>
                    <td class="currency">${c.marginPercent.toFixed(1)}%</td>
                    <td class="currency">${c.sharePercent.toFixed(1)}%</td>
                </tr>
            `).join('');

            const prodRows = categorySalesReport.topProducts.slice(0, 15).map((p, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(p.productName)}</td>
                    <td>${escapeHtml(p.categoryName)}</td>
                    <td class="currency">${p.totalQty}</td>
                    <td class="currency">${p.totalAreaM2 > 0 ? `${p.totalAreaM2.toFixed(2)} m²` : '-'}</td>
                    <td class="currency"><strong>${formatCurrency(Math.round(p.netSales))}</strong></td>
                    <td class="currency">${p.hasCost ? formatCurrency(Math.round(p.estimatedCost)) : '-'}</td>
                    <td class="currency">${formatCurrency(Math.round(p.grossProfit))}</td>
                    <td class="currency">${p.marginPercent.toFixed(1)}%</td>
                </tr>
            `).join('');

            tableHtml = `
                <h3>Ringkasan per Kategori</h3>
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Kategori</th>
                            <th>Satuan</th>
                            <th class="currency">Nota</th>
                            <th class="currency">Qty</th>
                            <th class="currency">Luas (m²)</th>
                            <th class="currency">Kotor</th>
                            <th class="currency">Bersih</th>
                            <th class="currency">Est. HPP</th>
                            <th class="currency">Laba Kotor</th>
                            <th class="currency">Margin</th>
                            <th class="currency">Porsi</th>
                        </tr>
                    </thead>
                    <tbody>${catRows || '<tr><td colspan="12" style="text-align:center;">Tidak ada data penjualan pada periode ini.</td></tr>'}</tbody>
                </table>
                ${categorySalesReport.topProducts.length > 0 ? `
                    <h3 style="margin-top:16px;">Produk / Bahan Terlaris (Top 15)</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Produk / Bahan</th>
                                <th>Kategori</th>
                                <th class="currency">Qty</th>
                                <th class="currency">Luas</th>
                                <th class="currency">Penjualan Bersih</th>
                                <th class="currency">Est. HPP</th>
                                <th class="currency">Laba Kotor</th>
                                <th class="currency">Margin</th>
                            </tr>
                        </thead>
                        <tbody>${prodRows}</tbody>
                    </table>
                ` : ''}
            `;
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 340px; float: right; border: none;">
                        <tr><td style="border:none;">Total Penjualan Kotor:</td><td style="border:none;" class="currency">${formatCurrency(Math.round(categorySalesReport.totalGrossSales))}</td></tr>
                        ${categorySalesReport.totalDiscount > 0 ? `<tr><td style="border:none;">Total Diskon Nota:</td><td style="border:none;" class="currency">- ${formatCurrency(Math.round(categorySalesReport.totalDiscount))}</td></tr>` : ''}
                        <tr><td style="border:none;">Total Penjualan Bersih:</td><td style="border:none;" class="currency"><strong>${formatCurrency(Math.round(categorySalesReport.totalNetSales))}</strong></td></tr>
                        <tr><td style="border:none;">Total Estimasi HPP (Modal):</td><td style="border:none;" class="currency">${formatCurrency(Math.round(categorySalesReport.totalEstimatedCost))}</td></tr>
                        <tr><td style="border:none;">Estimasi Laba Kotor:</td><td style="border:none;" class="currency"><strong>${formatCurrency(Math.round(categorySalesReport.totalGrossProfit))} (${categorySalesReport.totalMarginPercent.toFixed(1)}%)</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'receivables') {
            const tableRows = filteredReceivablesData.map((r, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(r.type === 'legacy' ? r.nota_id : r.id)} ${r.type === 'legacy' ? '<small>(Lama)</small>' : ''}</td>
                    <td>${escapeHtml(r.customer)}</td>
                    <td class="currency">${formatCurrency(r.amount)}</td>
                    <td class="currency">${formatCurrency(r.paid)}</td>
                    <td class="currency">${formatCurrency(r.remaining)}</td>
                    <td>${escapeHtml(r.productionStatus)}</td>
                    <td>${escapeHtml(formatDate(r.due))}<br><small style="color:${r.dueCategory === 'overdue' ? '#b91c1c' : '#555'};">${escapeHtml(r.dueStatusLabel)}</small></td>
                </tr>
            `).join('');

            const totalRemaining = filteredReceivablesData.reduce((sum, r) => sum + r.remaining, 0);

            tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>No. Nota</th>
                            <th>Pelanggan</th>
                            <th class="currency">Total Tagihan</th>
                            <th class="currency">Dibayar</th>
                            <th class="currency">Sisa</th>
                            <th>Status Produksi</th>
                            <th>Jatuh Tempo</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows || '<tr><td colspan="8" style="text-align:center;">Tidak ada data piutang pada periode/filter ini.</td></tr>'}</tbody>
                </table>
            `;
            summaryHtml = `
                 <div class="summary-box">
                    <table style="width: 320px; float: right; border: none;">
                        <tr><td style="border:none;">Jumlah Nota (Filter):</td><td style="border:none;" class="currency"><strong>${filteredReceivablesData.length} Nota</strong></td></tr>
                        <tr><td style="border:none;">Total Sisa Tagihan (Filter):</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalRemaining)}</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'inventory') {
            const tableRows = filteredInventoryData.map((item, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(item.sku || '-')}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.category)}</td>
                    <td>${escapeHtml(item.type)}</td>
                    <td class="currency">${item.stock} ${escapeHtml(item.unit)}</td>
                    <td style="color: ${item.status === 'Stok Menipis' ? '#b91c1c' : '#15803d'}; font-weight: bold;">${escapeHtml(item.status)}</td>
                    <td>${escapeHtml(item.condition)}</td>
                    <td>${escapeHtml(item.notes || '-')}</td>
                </tr>
            `).join('');

            const totalItemsCount = filteredInventoryData.length;
            const lowStockCount = filteredInventoryData.filter(i => i.stock <= notificationSettings.lowStockThreshold).length;

            tableHtml = `
                <p style="font-size:8.5pt; color:#444; margin:4px 0 8px 0;">
                    Terakhir Diperiksa Fisik: <strong>${escapeHtml(formatDateTimeID(inventoryCheckStatus.lastCheckedAt))}</strong>
                    ${inventoryCheckStatus.lastCheckedBy ? ` oleh <strong>${escapeHtml(inventoryCheckStatus.lastCheckedBy)}</strong>` : ''}
                </p>
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>SKU</th>
                            <th>Nama Item</th>
                            <th>Kategori</th>
                            <th>Tipe</th>
                            <th class="currency">Stok Saat Ini</th>
                            <th>Status Stok</th>
                            <th>Kondisi</th>
                            <th>Catatan</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows || '<tr><td colspan="9" style="text-align:center;">Belum ada data stok inventori.</td></tr>'}</tbody>
                </table>
            `;
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 320px; float: right; border: none;">
                        <tr><td style="border:none;">Total Jenis Item:</td><td style="border:none;" class="currency"><strong>${totalItemsCount} Item</strong></td></tr>
                        <tr><td style="border:none;">Item Stok Menipis (&le; ${notificationSettings.lowStockThreshold}):</td><td style="border:none;" class="currency"><strong style="color:#b91c1c;">${lowStockCount} Item</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'assetsDebts') {
            const d = assetsDebtsExportData;
            const fixedRows = d.fixedAssets.map(a => `<tr><td>Aset Tetap / Manual</td><td>${escapeHtml(a.name)}</td><td class="currency">${formatCurrency(a.value)}</td></tr>`).join('');
            const supRows = d.supplierDebtGroups.map(g => `<tr><td>Hutang Pemasok (Otomatis)</td><td>${escapeHtml(g.supplierName)} (${g.bills.length} Nota)</td><td class="currency">${formatCurrency(g.remainingAmount)}</td></tr>`).join('');
            const manualDebtRows = d.manualDebts.map(item => `<tr><td>${item.isLinkedBank ? 'Cicilan Bank' : 'Manual / Saldo Awal'}</td><td>${escapeHtml(item.name)}</td><td class="currency">${formatCurrency(item.value)}</td></tr>`).join('');

            tableHtml = `
                <div class="pnl-container">
                    <div class="pnl-column">
                        <h3>Rincian Aset Usaha</h3>
                        <table>
                            <thead><tr><th>Jenis</th><th>Nama Aset</th><th class="currency">Nilai</th></tr></thead>
                            <tbody>
                                <tr><td>Aset Lancar</td><td>Kas Laci Aktif</td><td class="currency">${formatCurrency(d.cashDrawerBalance)}</td></tr>
                                <tr><td>Aset Lancar</td><td>Rekening Bank / QRIS / E-Wallet</td><td class="currency">${formatCurrency(d.totalBankBalance)}</td></tr>
                                <tr><td>Aset Lancar</td><td>Kas Dipegang Owner</td><td class="currency">${formatCurrency(d.ownerHoldBalance)}</td></tr>
                                <tr><td>Aset Lancar</td><td>Piutang Pelanggan (Baru + Lama)</td><td class="currency">${formatCurrency(d.totalReceivablesAsset)}</td></tr>
                                ${fixedRows}
                            </tbody>
                            <tfoot><tr><th colspan="2">TOTAL SEMUA ASET</th><th class="currency">${formatCurrency(d.totalAllAssets)}</th></tr></tfoot>
                        </table>
                    </div>
                    <div class="pnl-column">
                        <h3>Rincian Hutang &amp; Kewajiban</h3>
                        <table>
                            <thead><tr><th>Kategori</th><th>Kreditur</th><th class="currency">Nominal</th></tr></thead>
                            <tbody>
                                ${supRows}
                                ${d.pendingAccruedSalary > 0 ? `<tr><td>Kewajiban Owner</td><td>Gaji Owner Terhutang</td><td class="currency">${formatCurrency(d.pendingAccruedSalary)}</td></tr>` : ''}
                                ${d.bonusPayable > 0 ? `<tr><td>Kewajiban Owner</td><td>Bonus Owner Siap Cair</td><td class="currency">${formatCurrency(d.bonusPayable)}</td></tr>` : ''}
                                ${manualDebtRows}
                                ${!supRows && d.pendingAccruedSalary <= 0 && d.bonusPayable <= 0 && !manualDebtRows ? '<tr><td colspan="3" style="text-align:center;">Tidak ada hutang tercatat.</td></tr>' : ''}
                            </tbody>
                            <tfoot><tr><th colspan="2">TOTAL KEWAJIBAN</th><th class="currency">${formatCurrency(d.totalAllDebts)}</th></tr></tfoot>
                        </table>
                    </div>
                </div>
            `;
            summaryHtml = `
                <div class="summary-box pnl-summary">
                    <strong>Total Kekayaan Bersih (Total Aset - Total Kewajiban):</strong>
                    <strong>${formatCurrency(d.netWorth)}</strong>
                </div>
            `;
        } else if (activeTab === 'dataPenjualanLama') {
            const totalIn = legacyMonthlyIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
            const totalOut = legacyMonthlyExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
            const inRows = [...legacyMonthlyIncomes]
                .sort((a, b) => b.month_date.localeCompare(a.month_date))
                .map(i => `<tr><td>${escapeHtml(formatMonthLabel(i.month_date))}</td><td>${escapeHtml(i.description || '-')}</td><td class="currency">${formatCurrency(i.amount)}</td></tr>`).join('');
            const outRows = [...legacyMonthlyExpenses]
                .sort((a, b) => b.month_date.localeCompare(a.month_date))
                .map(e => `<tr><td>${escapeHtml(formatMonthLabel(e.month_date))}</td><td>${escapeHtml(e.description || '-')}</td><td class="currency">${formatCurrency(e.amount)}</td></tr>`).join('');

            tableHtml = `
                <div class="pnl-container">
                    <div class="pnl-column">
                        <h3>Pemasukan Data Lama (Bulanan)</h3>
                        <table>
                            <thead><tr><th>Bulan</th><th>Deskripsi</th><th class="currency">Nominal</th></tr></thead>
                            <tbody>${inRows || '<tr><td colspan="3" style="text-align:center;">Belum ada data pemasukan lama.</td></tr>'}</tbody>
                            <tfoot><tr><th colspan="2">TOTAL PEMASUKAN</th><th class="currency">${formatCurrency(totalIn)}</th></tr></tfoot>
                        </table>
                    </div>
                    <div class="pnl-column">
                        <h3>Pengeluaran Data Lama (Bulanan)</h3>
                        <table>
                            <thead><tr><th>Bulan</th><th>Deskripsi</th><th class="currency">Nominal</th></tr></thead>
                            <tbody>${outRows || '<tr><td colspan="3" style="text-align:center;">Belum ada data pengeluaran lama.</td></tr>'}</tbody>
                            <tfoot><tr><th colspan="2">TOTAL PENGELUARAN</th><th class="currency">${formatCurrency(totalOut)}</th></tr></tfoot>
                        </table>
                    </div>
                </div>
            `;
            summaryHtml = `
                <div class="summary-box pnl-summary">
                    <strong>Selisih Bersih Data Lama:</strong>
                    <strong>${formatCurrency(totalIn - totalOut)}</strong>
                </div>
            `;
        } else if (activeTab === 'dataPiutangLama') {
            const totalAmt = filteredLegacyReceivables.reduce((s, r) => s + Number(r.amount || 0), 0);
            const rows = filteredLegacyReceivables.map((item, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(formatDate(item.order_date))}</td>
                    <td>${escapeHtml(item.nota_id)}</td>
                    <td>${escapeHtml(item.customer)}</td>
                    <td>${escapeHtml(item.description)}</td>
                    <td class="currency">${item.qty}</td>
                    <td class="currency">${formatCurrency(item.amount)}</td>
                </tr>
            `).join('');

            tableHtml = `
                <table>
                    <thead>
                        <tr>
                            <th>No</th>
                            <th>Tanggal</th>
                            <th>No. Nota</th>
                            <th>Pelanggan</th>
                            <th>Deskripsi</th>
                            <th class="currency">Qty</th>
                            <th class="currency">Nominal Piutang</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="7" style="text-align:center;">Tidak ada data piutang lama sesuai filter.</td></tr>'}</tbody>
                </table>
            `;
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 320px; float: right; border: none;">
                        <tr><td style="border:none;">Jumlah Nota Lama:</td><td style="border:none;" class="currency"><strong>${filteredLegacyReceivables.length} Nota</strong></td></tr>
                        <tr><td style="border:none;">Total Piutang Lama:</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalAmt)}</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'profitAndLoss') {
            const incomeRows = pnlIncomeTableData.map(item => `<tr><td>${escapeHtml(item.name)}</td><td class="currency">${formatCurrency(item.total)}</td></tr>`).join('');
            const expenseRows = pnlExpenseTableData.map(item => `<tr><td>${escapeHtml(item.name)}${item.allocationAmount > 0 ? `<br><small style="color:#666;">Termasuk Pos Alokasi: ${formatCurrency(item.allocationAmount)}</small>` : ''}</td><td class="currency">(${formatCurrency(item.total)})</td></tr>`).join('');

            tableHtml = `
                <div class="pnl-container">
                    <div class="pnl-column">
                        <h3>Pendapatan (Basis Kas)</h3>
                        <table>
                            <thead><tr><th>Kategori</th><th class="currency">Total</th></tr></thead>
                            <tbody>${incomeRows || '<tr><td colspan="2" style="text-align:center;">Tidak ada pendapatan kas masuk.</td></tr>'}</tbody>
                            <tfoot><tr><th>TOTAL PENDAPATAN</th><th class="currency">${formatCurrency(pnlSummary.totalSales)}</th></tr></tfoot>
                        </table>
                    </div>
                    <div class="pnl-column">
                        <h3>Pengeluaran Operasional</h3>
                        <table>
                            <thead><tr><th>Kategori</th><th class="currency">Total</th></tr></thead>
                            <tbody>${expenseRows || '<tr><td colspan="2" style="text-align:center;">Tidak ada pengeluaran operasional.</td></tr>'}</tbody>
                            <tfoot><tr><th>TOTAL PENGELUARAN</th><th class="currency">${formatCurrency(pnlSummary.totalExpenses)}</th></tr></tfoot>
                        </table>
                    </div>
                </div>
                <div style="margin-top: 14px;">
                    <h3>Arus Kas Non-Operasional &amp; Kewajiban</h3>
                    <table>
                        <tbody>
                            <tr><td>Bayar Tagihan Pemasok (Kas Toko)</td><td class="currency">-${formatCurrency(pnlNonOperational.supplierPaid)}</td></tr>
                            <tr><td>Bayar Cicilan Bank (Pokok ${formatCurrency(pnlNonOperational.bankPrincipalPaid)} + Bunga ${formatCurrency(pnlNonOperational.bankInterestPaid)})</td><td class="currency">-${formatCurrency(pnlNonOperational.bankPaid)}</td></tr>
                            <tr><td>Biaya Pribadi / Jamuan (Kas Toko)</td><td class="currency">-${formatCurrency(pnlNonOperational.privateStorePaid)}</td></tr>
                            <tr><td>Tarik Owner, Setor Prive &amp; Admin Mutasi</td><td class="currency">-${formatCurrency(pnlNonOperational.ownerOutTotal)}</td></tr>
                        </tbody>
                        <tfoot>
                            <tr><th>SISA ARUS KAS BERSIH PERIODE</th><th class="currency">${formatCurrency(pnlNonOperational.netCashflowAfterAll)}</th></tr>
                        </tfoot>
                    </table>
                </div>
                <div style="margin-top: 14px;">
                    <h3>Pembanding: Laba Kinerja / Basis Nota (Akrual)</h3>
                    <table>
                        <tbody>
                            <tr><td>Omzet Nota Terbit (Bersih Diskon)</td><td class="currency">${formatCurrency(pnlAccrualPerformance.accrualSales)}</td></tr>
                            <tr><td>Beban Akrual (Bahan Lunas + Faktur Kredit + Opr Lain + Gaji Owner + Bunga Bank)</td><td class="currency">(${formatCurrency(pnlAccrualPerformance.accrualSales - pnlAccrualPerformance.accrualNetProfit)})</td></tr>
                        </tbody>
                        <tfoot>
                            <tr><th>LABA / RUGI KINERJA (BASIS NOTA)</th><th class="currency">${formatCurrency(pnlAccrualPerformance.accrualNetProfit)}</th></tr>
                        </tfoot>
                    </table>
                </div>
            `;
            summaryHtml = `
                <div class="summary-box pnl-summary">
                    <strong>Laba / Rugi Operasional (Basis Kas):</strong>
                    <strong>${formatCurrency(pnlSummary.profit)}</strong>
                </div>
            `;
        }

        const printContent = `<!DOCTYPE html>
            <html lang="id">
                <head>
                    <meta charset="UTF-8" />
                    <title>${escapeHtml(reportTitle)}</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm; }
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; margin: 0; padding: 12px; background: white; }
                        .page { width: 100%; background: white; }
                        .header, .customer-info { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
                        .header h1 { font-size: 15pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #111; }
                        hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; }
                        th, tfoot th { background-color: #f2f2f2; }
                        tfoot { font-weight: bold; }
                        .currency { text-align: right; }
                        .summary-box { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; overflow: hidden; }
                        .pnl-container { display: flex; gap: 20px; align-items: flex-start; }
                        .pnl-column { flex: 1; }
                        .pnl-summary { text-align: center; font-size: 13pt; padding: 10px; background-color: #f2f2f2; display: flex; justify-content: space-between; }
                        @media print {
                            body { padding: 0; }
                            tr { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="page">
                        ${headerHtml}
                        ${tableHtml}
                        ${summaryHtml}
                    </div>
                </body>
            </html>`;

        setPrintPreviewDoc({
            title: reportTitle,
            html: printContent,
            canExportExcel: true,
        });
    };
    
    // --- FINAL RECAP CALCULATIONS ---
    const finalRecapData = useMemo(() => {
        const totalIncome = globalFinancialRecap.totalIncomeAll;
        const totalExpense = globalFinancialRecap.totalExpenseAll;
        const finalBalance = globalFinancialRecap.netEstimatedEndingCash;

        const totalPiutangLegacy = legacyReceivables.reduce((sum, r) => sum + r.amount, 0);
        const totalPiutangNew = receivables
            .filter(r => r.paymentStatus === 'Belum Lunas')
            .reduce((sum, r) => {
                const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - totalPaid;
                return sum + (remaining > 0 ? remaining : 0);
            }, 0);
        const totalPiutang = totalPiutangLegacy + totalPiutangNew;
        
        const selectedYearStr = selectedYear.toString();
        const ordersThisYear = allOrders.filter(o => o.orderDate?.startsWith(selectedYearStr));
        const expensesThisYear = expenses.filter(e => e.date?.startsWith(selectedYearStr)).reduce((sum, e) => sum + e.amount, 0);

        const isStoreOut = (src: string) => src === 'Kas Laci' || src === 'Transfer Bank' || src === 'Kas Dipegang Owner';
        const supplierPaidThisYear = supplierBills.reduce((sum, b) => {
            return sum + b.payments.filter(p => p.date?.startsWith(selectedYearStr) && isStoreOut(p.fundingSource)).reduce((ps, p) => ps + Number(p.amount || 0), 0);
        }, 0);
        const bankPaidThisYear = bankInstallments.reduce((sum, i) => {
            return sum + i.payments.filter(p => p.date?.startsWith(selectedYearStr) && isStoreOut(p.fundingSource)).reduce((ps, p) => ps + Number(p.totalPaid || 0), 0);
        }, 0);
        const privateStorePaidThisYear = privateExpenses
            .filter(pe => pe.date?.startsWith(selectedYearStr) && pe.fundingSource !== 'Uang Pribadi Owner')
            .reduce((sum, pe) => sum + Number(pe.amount || 0), 0);
        const setorOwnerThisYear = cashDrawerLogs
            .filter(log => {
                if (log.type !== 'Setor') return false;
                if (log.depositMode === 'owner_hold' || log.depositMode === 'bank_account') return false;
                const isPrive = log.depositMode === 'owner_prive' || !log.depositToAccountId;
                if (!isPrive) return false;
                const logDate = log.timestamp ? log.timestamp.slice(0, 10) : log.periodEndDate;
                return logDate?.startsWith(selectedYearStr);
            })
            .reduce((sum, log) => sum + Number(log.depositAmount || 0), 0);
        const tarikOwnerThisYear = cashTransfers
            .filter(t => t.date?.startsWith(selectedYearStr) && t.transferType === 'Tarik Owner')
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const transferAdminThisYear = cashTransfers
            .filter(t => t.date?.startsWith(selectedYearStr) && t.transferType === 'Pindah Akun')
            .reduce((sum, t) => sum + Number(t.adminFee || 0), 0);

        const nonOperationalAndOwnerOutThisYear =
            supplierPaidThisYear +
            bankPaidThisYear +
            privateStorePaidThisYear +
            setorOwnerThisYear +
            tarikOwnerThisYear +
            transferAdminThisYear;
        const totalCashOutThisYear = expensesThisYear + nonOperationalAndOwnerOutThisYear;

        // Rincian Tarik Owner Keseluruhan: dari modul Keuangan Owner vs Manual
        const ownerModuleLinkedIds = new Set(
            ownerTransactions
                .filter(tx => (tx.type === 'bonus_payout' || tx.type === 'prive') && tx.linkedTransferId)
                .map(tx => tx.linkedTransferId!)
        );
        const ownerModuleTarikAll = cashTransfers
            .filter(t => t.transferType === 'Tarik Owner' && ownerModuleLinkedIds.has(t.id))
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const manualTarikAll = Math.max(0, globalFinancialRecap.tarikOwnerOut - ownerModuleTarikAll);
        
        const ordersThisYearIds = new Set(ordersThisYear.map(o => o.id));
        const totalSalesThisYear = ordersThisYear.reduce((sum, o) => {
            const discount = receivablesMap.get(o.id)?.discount || 0;
            return sum + Math.max(0, o.totalPrice - discount);
        }, 0);

        const receivablesThisYearAmount = receivables
            .filter(r => ordersThisYearIds.has(r.id) && r.paymentStatus === 'Belum Lunas')
            .reduce((sum, r) => {
                const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - totalPaid;
                return sum + (remaining > 0 ? remaining : 0);
            }, 0);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyIncomeData = monthNames.map(name => ({
            name,
            'Kas Masuk Order & Lama': 0,
            'Suntik Modal Owner': 0,
        }));

        // Sum payments from new system
        receivables.forEach(r => {
            r.payments?.forEach(p => {
                if (p.date?.startsWith(selectedYearStr)) {
                    const monthIndex = parseInt(p.date.substring(5, 7), 10) - 1;
                    if (monthIndex >= 0 && monthIndex < 12) {
                        monthlyIncomeData[monthIndex]['Kas Masuk Order & Lama'] += p.amount;
                    }
                }
            });
        });

        // Sum legacy income
        legacyMonthlyIncomes.forEach(i => {
            if (i.month_date?.startsWith(selectedYearStr)) {
                const monthIndex = parseInt(i.month_date.substring(5, 7), 10) - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthlyIncomeData[monthIndex]['Kas Masuk Order & Lama'] += i.amount;
                }
            }
        });

        // Sum suntik modal
        cashTransfers.forEach(t => {
            if (t.transferType === 'Suntik Modal' && t.date?.startsWith(selectedYearStr)) {
                const monthIndex = parseInt(t.date.substring(5, 7), 10) - 1;
                if (monthIndex >= 0 && monthIndex < 12) {
                    monthlyIncomeData[monthIndex]['Suntik Modal Owner'] += Number(t.netAmount ?? t.amount ?? 0);
                }
            }
        });

        return {
            totalIncome, totalExpense, finalBalance, totalPiutang,
            expensesThisYear, nonOperationalAndOwnerOutThisYear, totalCashOutThisYear,
            ownerModuleTarikAll, manualTarikAll,
            ordersThisYear: ordersThisYear.length,
            receivablesThisYearAmount, totalSalesThisYear,
            chartData: monthlyIncomeData
        };
    }, [globalFinancialRecap, receivables, receivablesMap, expenses, supplierBills, bankInstallments, privateExpenses, cashDrawerLogs, cashTransfers, ownerTransactions, allOrders, legacyMonthlyIncomes, legacyReceivables, selectedYear]);


    // --- FILTERED DATA FOR OTHER TABS ---
    const getSalesDateRange = useCallback(() => {
        return getMonthStartEnd(salesMonth);
    }, [salesMonth]);

    const filteredSalesCustomers = useMemo(() => {
        if (!salesCustomer) return [];
        const lowerCaseQuery = salesCustomer.toLowerCase();
        return customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
    }, [salesCustomer, customers]);

    const filteredSalesData = useMemo(() => {
        const { startDate, endDate } = getSalesDateRange();
        if (!startDate || !endDate) return [];
        return allOrders
            .filter(order => {
                if (order.orderDate < startDate || order.orderDate > endDate) return false;
                if (salesCustomer && !order.customer.toLowerCase().includes(salesCustomer.toLowerCase())) return false;
                return true;
            });
    }, [allOrders, getSalesDateRange, salesCustomer]);
    
    const allDetailedSalesData = useMemo(() => {
        return filteredSalesData.flatMap(order => {
            const { itemTotals } = resolveLockedOrderItemTotals(
                order.orderItems,
                order.totalPrice,
                order.customer,
                productsMap,
                categoriesMap,
                customersMap,
                finishingsMap
            );
            const receivable = receivablesMap.get(order.id);
            const status = receivable ? receivable.paymentStatus : 'Belum Diproses';

            return order.orderItems.map((item, index) => {
                const product = item.productId ? productsMap.get(item.productId) : null;
                const itemTotal = itemTotals[index] ?? 0;
                
                return {
                    key: `${order.id}-${item.id}`,
                    no: 0, // Will be recalculated after sort
                    tanggal: order.orderDate,
                    noNota: order.id,
                    pelanggan: order.customer,
                    deskripsi: item.description,
                    bahan: product?.name || 'N/A',
                    p: item.length,
                    l: item.width,
                    qty: item.qty,
                    total: itemTotal,
                    status
                };
            });
        });
    }, [filteredSalesData, productsMap, categoriesMap, customersMap, finishingsMap, receivablesMap]);
    
    const sortedDetailedSalesData = useMemo(() => {
        let sortableItems = [...allDetailedSalesData];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key as keyof typeof a;
                const aValue = a[key];
                const bValue = b[key];
                
                if (aValue === null || bValue === null) return 0;

                const order = sortConfig.order === 'asc' ? 1 : -1;

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return (aValue - bValue) * order;
                }
                
                return String(aValue).localeCompare(String(bValue), 'id-ID', { numeric: true }) * order;
            });
        }
        // Recalculate row number after sorting
        return sortableItems.map((item, index) => ({ ...item, no: index + 1 }));
    }, [allDetailedSalesData, sortConfig]);

    const paginatedSalesData = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedDetailedSalesData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedDetailedSalesData, currentPage]);

    // --- CATEGORY SALES REPORT LOGIC ---
    const categorySalesReport = useMemo(() => {
        const filteredOrders = allOrders.filter(order => {
            if (categoryReportStartDate && order.orderDate < categoryReportStartDate) return false;
            if (categoryReportEndDate && order.orderDate > categoryReportEndDate) return false;
            if (categoryReportCustomer && !order.customer.toLowerCase().includes(categoryReportCustomer.toLowerCase())) return false;
            return true;
        });

        const catMap = new Map<string, {
            categoryName: string;
            unitType: string;
            orderIds: Set<string>;
            itemLineCount: number;
            totalQty: number;
            totalAreaM2: number;
            grossSales: number;
            discountShare: number;
            netSales: number;
            estimatedCost: number;
            missingCostItems: number;
        }>();

        const prodMap = new Map<string, {
            productName: string;
            categoryName: string;
            orderIds: Set<string>;
            totalQty: number;
            totalAreaM2: number;
            grossSales: number;
            netSales: number;
            estimatedCost: number;
            hasCost: boolean;
        }>();

        const missingCostProducts = new Set<string>();
        let totalGrossSales = 0;
        let totalDiscount = 0;
        let totalNetSales = 0;
        let totalEstimatedCost = 0;
        let totalQty = 0;
        let missingCostItemCount = 0;
        let totalItemLineCount = 0;

        filteredOrders.forEach(order => {
            const { itemTotals } = resolveLockedOrderItemTotals(
                order.orderItems,
                order.totalPrice,
                order.customer,
                productsMap,
                categoriesMap,
                customersMap,
                finishingsMap
            );
            const orderDiscount = receivablesMap.get(order.id)?.discount || 0;
            const netOrderTotal = Math.max(0, order.totalPrice - orderDiscount);
            const netFactor = order.totalPrice > 0 ? netOrderTotal / order.totalPrice : 1;

            totalGrossSales += order.totalPrice;
            totalDiscount += orderDiscount;
            totalNetSales += netOrderTotal;

            order.orderItems.forEach((item, index) => {
                const itemGross = itemTotals[index] ?? 0;
                const itemNet = itemGross * netFactor;
                const itemDiscount = Math.max(0, itemGross - itemNet);

                const product = item.productId ? productsMap.get(item.productId) : null;
                const catName = product?.category || 'Lainnya / Custom';
                const catInfo = categoriesMap.get(catName);
                const unitType = catInfo?.unitType || 'Per Buah';
                const qty = Number(item.qty || 0);
                const len = parseFloat(item.length) || 0;
                const wid = parseFloat(item.width) || 0;
                const areaM2 = unitType === 'Per Luas' ? len * wid * qty : 0;

                const costUnit = resolveEffectiveProductCost(item.productId, productCostMetadata, productCostGroups).costPrice;
                const itemEstimatedCost = costUnit > 0
                    ? (unitType === 'Per Luas' ? costUnit * len * wid * qty : costUnit * qty)
                    : 0;

                totalQty += qty;
                totalEstimatedCost += itemEstimatedCost;
                totalItemLineCount += 1;

                const prodName = product?.name || item.description || 'Item Custom';
                if (costUnit <= 0) {
                    missingCostItemCount += 1;
                    missingCostProducts.add(prodName);
                }

                if (!catMap.has(catName)) {
                    catMap.set(catName, {
                        categoryName: catName,
                        unitType,
                        orderIds: new Set<string>(),
                        itemLineCount: 0,
                        totalQty: 0,
                        totalAreaM2: 0,
                        grossSales: 0,
                        discountShare: 0,
                        netSales: 0,
                        estimatedCost: 0,
                        missingCostItems: 0,
                    });
                }
                const cEntry = catMap.get(catName)!;
                cEntry.orderIds.add(order.id);
                cEntry.itemLineCount += 1;
                cEntry.totalQty += qty;
                cEntry.totalAreaM2 += areaM2;
                cEntry.grossSales += itemGross;
                cEntry.discountShare += itemDiscount;
                cEntry.netSales += itemNet;
                cEntry.estimatedCost += itemEstimatedCost;
                if (costUnit <= 0) cEntry.missingCostItems += 1;

                const prodKey = `${catName}::${prodName}`;
                if (!prodMap.has(prodKey)) {
                    prodMap.set(prodKey, {
                        productName: prodName,
                        categoryName: catName,
                        orderIds: new Set<string>(),
                        totalQty: 0,
                        totalAreaM2: 0,
                        grossSales: 0,
                        netSales: 0,
                        estimatedCost: 0,
                        hasCost: costUnit > 0,
                    });
                }
                const pEntry = prodMap.get(prodKey)!;
                pEntry.orderIds.add(order.id);
                pEntry.totalQty += qty;
                pEntry.totalAreaM2 += areaM2;
                pEntry.grossSales += itemGross;
                pEntry.netSales += itemNet;
                pEntry.estimatedCost += itemEstimatedCost;
                if (costUnit > 0) pEntry.hasCost = true;
            });
        });

        const categoriesList = Array.from(catMap.values())
            .map(c => {
                const grossProfit = c.netSales - c.estimatedCost;
                const marginPercent = c.netSales > 0 ? (grossProfit / c.netSales) * 100 : 0;
                return {
                    categoryName: c.categoryName,
                    unitType: c.unitType,
                    orderCount: c.orderIds.size,
                    itemLineCount: c.itemLineCount,
                    totalQty: c.totalQty,
                    totalAreaM2: c.totalAreaM2,
                    grossSales: c.grossSales,
                    discountShare: c.discountShare,
                    netSales: c.netSales,
                    estimatedCost: c.estimatedCost,
                    grossProfit,
                    marginPercent,
                    missingCostItems: c.missingCostItems,
                    sharePercent: totalNetSales > 0 ? (c.netSales / totalNetSales) * 100 : 0,
                };
            })
            .sort((a, b) => b.netSales - a.netSales);

        const topProducts = Array.from(prodMap.values())
            .map(p => {
                const grossProfit = p.netSales - p.estimatedCost;
                const marginPercent = p.netSales > 0 ? (grossProfit / p.netSales) * 100 : 0;
                return {
                    productName: p.productName,
                    categoryName: p.categoryName,
                    orderCount: p.orderIds.size,
                    totalQty: p.totalQty,
                    totalAreaM2: p.totalAreaM2,
                    grossSales: p.grossSales,
                    netSales: p.netSales,
                    estimatedCost: p.estimatedCost,
                    grossProfit,
                    marginPercent,
                    hasCost: p.hasCost,
                };
            })
            .sort((a, b) => b.netSales - a.netSales);

        const totalGrossProfit = totalNetSales - totalEstimatedCost;
        const totalMarginPercent = totalNetSales > 0 ? (totalGrossProfit / totalNetSales) * 100 : 0;

        return {
            totalOrders: filteredOrders.length,
            totalQty,
            totalGrossSales,
            totalDiscount,
            totalNetSales,
            totalEstimatedCost,
            totalGrossProfit,
            totalMarginPercent,
            missingCostProducts: Array.from(missingCostProducts),
            missingCostItemCount,
            totalItemLineCount,
            categories: categoriesList,
            topProducts,
        };
    }, [allOrders, categoryReportStartDate, categoryReportEndDate, categoryReportCustomer, productsMap, categoriesMap, customersMap, finishingsMap, receivablesMap, productCostMetadata, productCostGroups]);

    const getReceivablesDateRange = useCallback(() => {
        if (receivablesFilterType === 'all') {
            return { startDate: '', endDate: '' };
        }
        if (receivablesFilterType === 'date') {
            return { startDate: receivablesStartDate, endDate: receivablesEndDate };
        }
        if (receivablesFilterType === 'year') {
            return { startDate: `${receivablesYear}-01-01`, endDate: `${receivablesYear}-12-31` };
        }
        
        // Default is 'month'
        return getMonthStartEnd(receivablesMonth);
    }, [receivablesFilterType, receivablesMonth, receivablesStartDate, receivablesEndDate, receivablesYear]);

    const filteredReceivablesCustomers = useMemo(() => {
        if (!receivablesCustomer) return [];
        const lowerCaseQuery = receivablesCustomer.toLowerCase();
        return customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
    }, [receivablesCustomer, customers]);

    const filteredReceivablesData = useMemo(() => {
        const { startDate, endDate } = getReceivablesDateRange();
        if (receivablesFilterType !== 'all' && (!startDate || !endDate)) return [];

        const todayYmd = getCurrentLocalDateStr();
        const dueSoonDays = notificationSettings.receivableDueSoonDays ?? 7;

        const classifyDue = (dueYmd: string): { dueCategory: 'overdue' | 'due_soon' | 'active'; dueStatusLabel: string; daysDiff: number } => {
            const diff = diffDaysFromYmd(dueYmd, todayYmd);
            if (diff === null) return { dueCategory: 'active', dueStatusLabel: 'Aktif', daysDiff: 0 };
            if (diff < 0) {
                const late = Math.abs(diff);
                return { dueCategory: 'overdue', dueStatusLabel: `Jatuh Tempo (${late} hari lalu)`, daysDiff: diff };
            }
            if (diff === 0) {
                return { dueCategory: 'due_soon', dueStatusLabel: 'Jatuh Tempo Hari Ini', daysDiff: 0 };
            }
            if (diff <= dueSoonDays) {
                return { dueCategory: 'due_soon', dueStatusLabel: `Segera (H-${diff})`, daysDiff: diff };
            }
            return { dueCategory: 'active', dueStatusLabel: `Aktif (H-${diff})`, daysDiff: diff };
        };

        const unpaidNewSystem = receivables
            .filter(r => {
                if (r.paymentStatus !== 'Belum Lunas') return false;
                const order = ordersMap.get(r.id);
                const refDate = order?.orderDate || r.due;
                if (receivablesFilterType !== 'all' && (refDate < startDate || refDate > endDate)) return false;
                if (receivablesCustomer && !r.customer.toLowerCase().includes(receivablesCustomer.toLowerCase())) return false;
                return true;
            })
            .map(r => {
                const paid = r.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - paid;
                const dueInfo = classifyDue(r.due);
                return { ...r, discount: r.discount || 0, paid, remaining, type: 'new' as const, ...dueInfo };
            });

        const unpaidLegacy = legacyReceivables
            .filter(r => {
                if (receivablesFilterType !== 'all' && (r.order_date < startDate || r.order_date > endDate)) return false;
                if (receivablesCustomer && !r.customer.toLowerCase().includes(receivablesCustomer.toLowerCase())) return false;
                return true;
            })
            .map(r => {
                const dueInfo = classifyDue(r.order_date);
                return {
                    id: `legacy-${r.id}`,
                    legacyNumericId: r.id,
                    nota_id: r.nota_id,
                    customer: r.customer,
                    description: r.description,
                    qty: r.qty,
                    amount: r.amount,
                    discount: 0,
                    paid: 0,
                    remaining: r.amount,
                    paymentStatus: 'Belum Lunas' as const,
                    productionStatus: 'Data Lama' as const,
                    due: r.order_date,
                    type: 'legacy' as const,
                    ...dueInfo,
                };
            });

        return [...unpaidNewSystem, ...unpaidLegacy]
            .filter(item => item.remaining > 0)
            .filter(item => receivablesDueStatusFilter === 'all' || item.dueCategory === receivablesDueStatusFilter)
            .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime());
    }, [receivables, legacyReceivables, ordersMap, getReceivablesDateRange, receivablesFilterType, receivablesCustomer, receivablesDueStatusFilter, notificationSettings.receivableDueSoonDays]);
    
    const paginatedReceivables = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredReceivablesData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredReceivablesData, currentPage]);
    
    const globalActiveReceivables = useMemo(() => {
        const newSystem = receivables.reduce((sum, r) => {
            if (r.paymentStatus === 'Lunas') return sum;
            const paid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
            const remaining = r.amount - (r.discount || 0) - paid;
            return sum + (remaining > 0 ? remaining : 0);
        }, 0);
        const legacySystem = legacyReceivables.reduce((sum, r) => sum + r.amount, 0);
        return newSystem + legacySystem;
    }, [receivables, legacyReceivables]);

    const filteredInventoryData = useMemo(() => {
        const q = inventorySearch.trim().toLowerCase();
        return inventory
            .map(item => {
                const meta = inventoryMetadata[item.id];
                const category: InventoryCategory = meta?.category || 'Bahan Baku';
                const condition: InventoryCondition = meta?.condition || 'Baik';
                const notes = meta?.notes || '';
                const status: 'Stok Menipis' | 'Tersedia' =
                    item.stock <= notificationSettings.lowStockThreshold ? 'Stok Menipis' : 'Tersedia';
                return {
                    ...item,
                    category,
                    condition,
                    notes,
                    status,
                };
            })
            .filter(item => {
                if (inventoryCategoryFilter !== 'Semua' && item.category !== inventoryCategoryFilter) return false;
                if (inventoryConditionFilter !== 'Semua' && item.condition !== inventoryConditionFilter) return false;
                if (inventoryStockStatusFilter !== 'Semua' && item.status !== inventoryStockStatusFilter) return false;
                if (q) {
                    return (
                        item.name.toLowerCase().includes(q) ||
                        item.sku.toLowerCase().includes(q) ||
                        item.notes.toLowerCase().includes(q)
                    );
                }
                return true;
            });
    }, [inventory, inventoryMetadata, notificationSettings.lowStockThreshold, inventorySearch, inventoryCategoryFilter, inventoryConditionFilter, inventoryStockStatusFilter]);

    const paginatedInventory = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredInventoryData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredInventoryData, currentPage]);

    const handlePrintCustomerSpecificReport = (reportType: 'sales' | 'receivables') => {
        const customerFilter = reportType === 'sales' ? salesCustomer : receivablesCustomer;
        const { startDate, endDate } = reportType === 'sales' ? getSalesDateRange() : getReceivablesDateRange();
        
        if (!customerFilter) {
            alert("Silakan ketik nama pelanggan di filter terlebih dahulu untuk mencetak laporan.");
            return;
        }

        const reportPeriod =
            reportType === 'receivables' && receivablesFilterType === 'all'
                ? 'Periode: Semua Waktu (Lintas Tahun)'
                : `Periode: ${startDate ? formatDate(startDate) : '...'} - ${endDate ? formatDate(endDate) : '...'}`;
        let tableRows = '';
        let summaryHtml = '';
        let reportTitle = '';
        let tableHeaders = '';

        if (reportType === 'sales') {
            reportTitle = 'Laporan Penjualan Pelanggan';
            const reportItems = filteredSalesData;
            const totalNota = reportItems.length;
            const totalItems = reportItems.reduce((sum, order) => sum + order.orderItems.length, 0);
            const grossPenjualan = reportItems.reduce((sum, order) => sum + order.totalPrice, 0);
            const totalDiskon = reportItems.reduce((sum, order) => sum + (receivablesMap.get(order.id)?.discount || 0), 0);
            const totalPenjualan = Math.max(0, grossPenjualan - totalDiskon);

            tableHeaders = `
                <tr>
                    <th>Total Nota</th>
                    <th>Total Item</th>
                    ${totalDiskon > 0 ? '<th class="currency">Penjualan Kotor</th><th class="currency">Diskon</th>' : ''}
                    <th class="currency">Total Penjualan Bersih</th>
                </tr>`;
            
            tableRows = `
                <tr>
                    <td>${totalNota} Nota</td>
                    <td>${totalItems} Item</td>
                    ${totalDiskon > 0 ? `<td class="currency">${formatCurrency(grossPenjualan)}</td><td class="currency">- ${formatCurrency(totalDiskon)}</td>` : ''}
                    <td class="currency"><strong>${formatCurrency(totalPenjualan)}</strong></td>
                </tr>`;

        } else { // receivables
            reportTitle = 'Laporan Piutang Pelanggan';
            const reportItems = filteredReceivablesData;
            
            tableHeaders = `
                <tr>
                    <th>No. Nota</th>
                    <th>Deskripsi Item</th>
                    <th>Qty</th>
                    <th class="currency">Total Tagihan</th>
                    <th class="currency">Dibayar</th>
                    <th class="currency">Sisa</th>
                    <th>Tanggal Jatuh Tempo</th>
                </tr>`;
                
            tableRows = reportItems.flatMap(receivable => {
                if (receivable.type === 'legacy') {
                    return [
                        `<tr>
                            <td>${escapeHtml(receivable.nota_id)} <span style="font-size:8pt;color:#666;">(Lama)</span></td>
                            <td>${escapeHtml(receivable.description || '-')}</td>
                            <td>${receivable.qty || 1} Pcs</td>
                            <td class="currency">${formatCurrency(receivable.amount)}</td>
                            <td class="currency">${formatCurrency(receivable.paid)}</td>
                            <td class="currency">${formatCurrency(receivable.remaining)}</td>
                            <td>${escapeHtml(formatDate(receivable.due))}</td>
                        </tr>`
                    ];
                }

                const fullOrder = ordersMap.get(receivable.id);
                if (!fullOrder) {
                    return [
                        `<tr>
                            <td>${escapeHtml(receivable.id)}</td>
                            <td>-</td>
                            <td>-</td>
                            <td class="currency">${formatCurrency(receivable.amount)}</td>
                            <td class="currency">${formatCurrency(receivable.paid)}</td>
                            <td class="currency">${formatCurrency(receivable.remaining)}</td>
                            <td>${escapeHtml(formatDate(receivable.due))}</td>
                        </tr>`
                    ];
                }
        
                return fullOrder.orderItems.map((item, index) => {
                    const product = item.productId ? productsMap.get(item.productId) : null;
                    const isFirstItem = index === 0;
        
                    return `
                        <tr>
                            ${isFirstItem ? `<td rowSpan="${fullOrder.orderItems.length}">${escapeHtml(receivable.id)}</td>` : ''}
                            <td>${escapeHtml(item.description || product?.name || 'N/A')}</td>
                            <td>${item.qty} Pcs</td>
                            ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.amount)}</td>` : ''}
                            ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.paid)}</td>` : ''}
                            ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.remaining)}</td>` : ''}
                            ${isFirstItem ? `<td rowSpan="${fullOrder.orderItems.length}">${escapeHtml(formatDate(receivable.due))}</td>` : ''}
                        </tr>
                    `;
                });
            }).join('');

            const totalSisa = reportItems.reduce((sum, r) => sum + r.remaining, 0);
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 260px; float: right; border: none;">
                        <tr><td style="border:none;">Total Sisa Tagihan:</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalSisa)}</strong></td></tr>
                    </table>
                </div>`;
        }

        const nonCashPaymentLines = paymentMethods
            .filter(m => m.type !== 'Tunai' && (m.details || m.name))
            .map(m => `${escapeHtml(m.name)}${m.details ? ` (${escapeHtml(m.details)})` : ''}`);

        const paymentFooterHtml = reportType === 'receivables' && nonCashPaymentLines.length > 0
            ? `<div style="clear: both; margin-top: 32px; font-size: 9pt;">
                    <hr>
                    <strong>Informasi Pembayaran:</strong><br>
                    ${nonCashPaymentLines.join(' • ')}
               </div>`
            : '';

        const printContent = `<!DOCTYPE html>
            <html lang="id">
                <head>
                    <meta charset="UTF-8" />
                    <title>${escapeHtml(reportTitle)} - ${escapeHtml(customerFilter)}</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm; }
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; margin: 0; padding: 12px; background: white; }
                        .page { width: 100%; background: white; }
                        .header, .customer-info { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
                        .header h1 { font-size: 15pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #111; }
                        hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; vertical-align: top; }
                        th { background-color: #f2f2f2; }
                        .currency { text-align: right; }
                        .summary-box { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; overflow: hidden; }
                        @media print { body { padding: 0; } tr { page-break-inside: avoid; } }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <div class="header">
                            <div>
                                <h2>${escapeHtml(storeDisplayName)}</h2>
                                ${storeDisplayAddress ? `<p style="font-size:8pt; margin:0;">${escapeHtml(storeDisplayAddress)}</p>` : ''}
                                ${storeDisplayContact ? `<p style="font-size:8pt; margin:0;">${escapeHtml(storeDisplayContact)}</p>` : ''}
                            </div>
                            <h1>${escapeHtml(reportTitle)}</h1>
                        </div>
                        <hr>
                        <div class="customer-info">
                            <strong>${escapeHtml(customerFilter)}</strong>
                            <span>${escapeHtml(reportPeriod)}</span>
                        </div>
                        <hr>
                        <table>
                            <thead>
                               ${tableHeaders}
                            </thead>
                            <tbody>${tableRows || '<tr><td colspan="7" style="text-align:center;">Tidak ada data untuk pelanggan ini pada periode terpilih.</td></tr>'}</tbody>
                        </table>
                        ${summaryHtml}
                        ${paymentFooterHtml}
                    </div>
                </body>
            </html>`;

        setPrintPreviewDoc({
            title: `${reportTitle} - ${customerFilter}`,
            html: printContent,
            canExportExcel: true,
        });
    };

    // --- RENDER METHODS FOR TABS ---

    const renderFinalRecap = () => {
        const cashDiffVsEst = storeCashSnapshot.totalStoreLiquidCash - finalRecapData.finalBalance;
        return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-bold text-gray-800">Ringkasan Kinerja Tahun {selectedYear}</h3>
                    <p className="text-xs text-gray-500">
                        4 kartu atas menampilkan kinerja periode tahun <strong>{selectedYear}</strong> &amp; saldo kumulatif; rincian lengkap semua periode berada di kolom kiri bawah.
                    </p>
                </div>
                <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="p-2 border rounded-md bg-white text-sm font-semibold"
                >
                    {years.map(year => <option key={year} value={year}>Tahun {year}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ProminentStatCard icon={<ShoppingCartIcon />} title={`Penjualan Bersih (${selectedYear})`} value={formatCurrency(finalRecapData.totalSalesThisYear)} gradient="bg-gradient-to-br from-violet-500 to-purple-500" />
                <ProminentStatCard icon={<CreditCardIcon />} title={`Piutang Nota (${selectedYear})`} value={formatCurrency(finalRecapData.receivablesThisYearAmount)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                <ProminentStatCard icon={<ReceiptTaxIcon />} title={`Total Uang Keluar (${selectedYear})`} value={formatCurrency(finalRecapData.totalCashOutThisYear)} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                <ProminentStatCard icon={<CurrencyDollarIcon />} title="Kas Riil Toko Saat Ini" value={formatCurrency(storeCashSnapshot.totalStoreLiquidCash)} gradient="bg-gradient-to-br from-cyan-500 to-blue-500" />
            </div>
            <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2 flex flex-wrap justify-between gap-2">
                <span>
                    Rincian Uang Keluar {selectedYear}: Operasional <strong>{formatCurrency(finalRecapData.expensesThisYear)}</strong> + Non-Opr &amp; Owner <strong>{formatCurrency(finalRecapData.nonOperationalAndOwnerOutThisYear)}</strong>
                </span>
                <span>
                    Estimasi Kas Kumulatif Sistem: <strong className="text-blue-700">{formatCurrency(finalRecapData.finalBalance)}</strong>
                </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border h-full flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-lg mb-3">Rincian Keuangan (Kumulatif Semua Waktu)</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Pemasukan Order &amp; Data Lama</span>
                                    <span className="font-semibold text-green-600">+ {formatCurrency(globalFinancialRecap.legacyIncome + globalFinancialRecap.orderIncome)}</span>
                                </div>
                                {globalFinancialRecap.suntikModalIn > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Suntik Modal Owner</span>
                                        <span className="font-semibold text-green-600">+ {formatCurrency(globalFinancialRecap.suntikModalIn)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Pengeluaran Operasional &amp; Data Lama</span>
                                    <span className="font-semibold text-red-600">- {formatCurrency(globalFinancialRecap.legacyExpense + globalFinancialRecap.operationalExpense)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 border-t pt-1.5">
                                    <span>Subtotal Saldo Operasional (Klasik)</span>
                                    <span className="font-semibold">{formatCurrency(globalFinancialRecap.grossEstimatedBalance)}</span>
                                </div>
                                <div className="pt-2 border-t space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Bayar Tagihan Pemasok (Kas Toko)</span>
                                        <span className="font-semibold text-amber-700">- {formatCurrency(globalFinancialRecap.supplierStorePaid)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Bayar Cicilan Bank (Kas Toko)</span>
                                        <span className="font-semibold text-purple-700">- {formatCurrency(globalFinancialRecap.bankStorePaid)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Pribadi / Jamuan (Kas Toko)</span>
                                        <span className="font-semibold text-rose-700">- {formatCurrency(globalFinancialRecap.privateStorePaid)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Setor Prive Kasir</span>
                                        <span className="font-semibold text-fuchsia-700">- {formatCurrency(globalFinancialRecap.setorOwnerOut)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tarik Owner (Bonus &amp; Prive Owner Dashboard)</span>
                                        <span className="font-semibold text-fuchsia-700">- {formatCurrency(finalRecapData.ownerModuleTarikAll)}</span>
                                    </div>
                                    {finalRecapData.manualTarikAll > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Tarik Owner Manual (Arus Kas)</span>
                                            <span className="font-semibold text-fuchsia-700">- {formatCurrency(finalRecapData.manualTarikAll)}</span>
                                        </div>
                                    )}
                                    {globalFinancialRecap.transferAdminFeeOut > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Biaya Admin Mutasi Antar Akun</span>
                                            <span className="font-semibold text-gray-600">- {formatCurrency(globalFinancialRecap.transferAdminFeeOut)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between font-bold text-base border-t pt-2.5 mt-2">
                                    <span>Saldo Akhir (Estimasi Arus Kas)</span>
                                    <span className="text-blue-600">{formatCurrency(finalRecapData.finalBalance)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t space-y-2 text-xs">
                            <p className="font-bold text-gray-700 uppercase tracking-wide text-[11px]">
                                Posisi Kas Riil Toko Saat Ini (Per Akun)
                            </p>
                            <div className="bg-white border rounded-md p-2.5 space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Kas Laci Aktif</span>
                                    <span className="font-semibold">{formatCurrency(storeCashSnapshot.cashDrawerBalance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Rekening Bank / QRIS / E-Wallet</span>
                                    <span className="font-semibold">{formatCurrency(storeCashSnapshot.totalBankBalance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Kas Dipegang Owner (Titipan)</span>
                                    <span className="font-semibold">{formatCurrency(storeCashSnapshot.ownerHoldBalance)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-sm border-t pt-1.5 text-cyan-700">
                                    <span>Total Kas Riil Toko</span>
                                    <span>{formatCurrency(storeCashSnapshot.totalStoreLiquidCash)}</span>
                                </div>
                            </div>
                            {Math.abs(cashDiffVsEst) >= 1 && (
                                <p className="text-[11px] text-gray-500">
                                    Selisih kas riil vs estimasi ({cashDiffVsEst >= 0 ? '+' : ''}{formatCurrency(cashDiffVsEst)}) berasal dari saldo awal masing-masing rekening/laci sebelum pencatatan sistem.
                                </p>
                            )}
                            <div className="flex justify-between font-bold text-sm border-t pt-2">
                                <span>Total Piutang Aktif (Semua Tahun)</span>
                                <span className="text-amber-600">{formatCurrency(finalRecapData.totalPiutang)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-3 h-96">
                     <h4 className="font-bold text-lg mb-1">{`Grafik Kas Masuk Bulanan (${selectedYear})`}</h4>
                     <p className="text-xs text-gray-500 mb-2">Menampilkan uang tunai/transfer masuk dari pembayaran order, pemasukan lama, dan suntik modal owner (bukan nilai omzet nota).</p>
                     <ResponsiveContainer width="100%" height="90%">
                        <AreaChart data={finalRecapData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="recapGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="suntikGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.7}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `Rp ${Number(value)/1000000} Jt`}/>
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '0.5rem' }} formatter={(value: number) => formatCurrency(value)}/>
                            <Legend />
                            <Area type="monotone" dataKey="Kas Masuk Order & Lama" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#recapGradient)" />
                            <Area type="monotone" dataKey="Suntik Modal Owner" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#suntikGradient)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
    };
    
    const renderProfitAndLoss = () => {
        const activeHeadlineProfit = pnlMode === 'cash' ? pnlSummary.profit : pnlAccrualPerformance.accrualNetProfit;
        const activeHeadlineTitle = pnlMode === 'cash' ? 'Laba / Rugi Operasional (Basis Kas)' : 'Laba / Rugi Kinerja (Basis Nota)';
        const totalAccrualCosts = pnlAccrualPerformance.accrualSales - pnlAccrualPerformance.accrualNetProfit;

        return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <select value={pnlFilterType} onChange={e => setPnlFilterType(e.target.value as 'month' | 'year')} className="p-2 border rounded-md bg-white text-sm">
                            <option value="month">Per Bulan</option>
                            <option value="year">Per Tahun</option>
                        </select>
                        {pnlFilterType === 'month' ? (
                            <input type="month" value={pnlSelectedMonth} onChange={e => setPnlSelectedMonth(e.target.value)} className="p-2 border rounded-md bg-white text-sm" />
                        ) : (
                            <select value={pnlSelectedYear} onChange={e => setPnlSelectedYear(Number(e.target.value))} className="p-2 border rounded-md bg-white text-sm">
                                {years.map(year => <option key={year} value={year}>{year}</option>)}
                            </select>
                        )}
                        <div className="inline-flex rounded-md border bg-gray-100 p-0.5">
                            <button
                                type="button"
                                onClick={() => setPnlMode('cash')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${pnlMode === 'cash' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Basis Kas (Arus Uang)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPnlMode('accrual')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${pnlMode === 'accrual' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                            >
                                Basis Nota / Kinerja (Akrual)
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        {pnlMode === 'cash'
                            ? 'Basis Kas menghitung uang masuk & keluar riil pada periode terpilih.'
                            : 'Basis Nota menghitung omzet order terbit (Lunas + Tempo) dikurangi beban periode termasuk faktur pembelian kredit & bunga bank — selaras dengan Tutup Buku Owner Dashboard.'}
                    </p>
                </div>
                <ProminentStatCard 
                    icon={<ChartBarIcon />} 
                    title={activeHeadlineTitle}
                    value={formatCurrency(activeHeadlineProfit)} 
                    gradient={activeHeadlineProfit >= 0 ? "bg-gradient-to-br from-green-500 to-emerald-500" : "bg-gradient-to-br from-rose-500 to-red-500"}
                />
            </div>

            {pnlMode === 'accrual' ? (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm">
                        <div>
                            <p className="font-bold text-indigo-900">
                                Pembanding Basis Nota vs Basis Kas ({pnlFilterType === 'month' ? formatMonthLabel(pnlSelectedMonth) : `Tahun ${pnlSelectedYear}`})
                            </p>
                            <p className="text-xs text-indigo-700 mt-0.5">
                                Selisih terjadi karena order tempo belum lunas atau pembelian kredit pemasok belum jatuh tempo/dibayar di periode ini.
                            </p>
                        </div>
                        <span className={`px-3 py-1 rounded-md text-xs font-bold ${pnlAccrualPerformance.isClosed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {pnlFilterType === 'month'
                                ? (pnlAccrualPerformance.isClosed ? 'Sudah Tutup Buku di Owner Dashboard' : 'Belum Tutup Buku di Owner Dashboard')
                                : `${pnlAccrualPerformance.closedMonthsCount} / 12 Bulan Sudah Tutup Buku`}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border rounded-xl overflow-hidden bg-white">
                            <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100">
                                <h4 className="font-bold text-emerald-900">Pendapatan Kinerja (Basis Nota Terbit)</h4>
                            </div>
                            <table className="w-full text-sm">
                                <tbody className="divide-y">
                                    <tr>
                                        <td className="p-3">Omzet Order Terbit (Lunas + Tempo, Bersih Diskon)</td>
                                        <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(pnlAccrualPerformance.accrualSales)}</td>
                                    </tr>
                                    <tr className="bg-gray-50/70">
                                        <td className="p-3 text-xs text-gray-600">Pembanding: Uang Masuk Pembayaran Order di Periode</td>
                                        <td className="p-3 text-right text-xs font-semibold text-gray-700">{formatCurrency(pnlAccrualPerformance.cashOrderPayments)}</td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-emerald-100/60 font-bold">
                                    <tr>
                                        <td className="p-3">Total Omzet Kinerja</td>
                                        <td className="p-3 text-right text-emerald-900">{formatCurrency(pnlAccrualPerformance.accrualSales)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="border rounded-xl overflow-hidden bg-white">
                            <div className="bg-rose-50 px-4 py-3 border-b border-rose-100">
                                <h4 className="font-bold text-rose-900">Beban Kinerja (Basis Akrual)</h4>
                            </div>
                            <table className="w-full text-sm">
                                <tbody className="divide-y">
                                    <tr>
                                        <td className="p-3">Pembelian Bahan Lunas</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(pnlAccrualPerformance.lunasMaterialPurchases)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Faktur Pembelian Bahan Kredit / Tempo Terbit</td>
                                        <td className="p-3 text-right font-semibold text-amber-700">{formatCurrency(pnlAccrualPerformance.creditSupplierInvoices)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Pengeluaran Operasional Lainnya</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(pnlAccrualPerformance.otherOperationalExpenses)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">
                                            Gaji Owner Diakui
                                            {pnlAccrualPerformance.ownerSalaryUnpaidAccrued > 0 && (
                                                <span className="block text-[11px] text-amber-700">Termasuk gaji terhutang: {formatCurrency(pnlAccrualPerformance.ownerSalaryUnpaidAccrued)}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(pnlAccrualPerformance.recognizedOwnerSalary)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3">Bunga Bank (Porsi Bunga Cicilan)</td>
                                        <td className="p-3 text-right font-semibold">{formatCurrency(pnlAccrualPerformance.bankInterestInMonth)}</td>
                                    </tr>
                                </tbody>
                                <tfoot className="bg-rose-100/60 font-bold">
                                    <tr>
                                        <td className="p-3">Total Beban Kinerja</td>
                                        <td className="p-3 text-right text-rose-900">{formatCurrency(totalAccrualCosts)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="p-4 rounded-xl border bg-white">
                            <p className="text-xs text-gray-500">Laba Kinerja (Basis Nota / Tutup Buku)</p>
                            <p className={`text-xl font-extrabold mt-1 ${pnlAccrualPerformance.accrualNetProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {formatCurrency(pnlAccrualPerformance.accrualNetProfit)}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl border bg-white">
                            <p className="text-xs text-gray-500">Laba Operasional (Basis Kas Masuk - Opr)</p>
                            <p className={`text-xl font-extrabold mt-1 ${pnlSummary.profit >= 0 ? 'text-cyan-700' : 'text-red-600'}`}>
                                {formatCurrency(pnlSummary.profit)}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl border bg-white">
                            <p className="text-xs text-gray-500">Sisa Arus Kas Bersih (Stlh Cicilan &amp; Tarik Owner)</p>
                            <p className={`text-xl font-extrabold mt-1 ${pnlNonOperational.netCashflowAfterAll >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                                {formatCurrency(pnlNonOperational.netCashflowAfterAll)}
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="h-96">
                        <h4 className="font-bold text-lg mb-2">Grafik Laba Rugi (Basis Kas)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={pnlChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient>
                                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `Rp ${Number(value)/1000000} Jt`}/>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Area type="monotone" dataKey="Pendapatan" stroke="#22c55e" strokeWidth={2} fill="url(#incomeGradient)" />
                                <Area type="monotone" dataKey="Pengeluaran" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-lg mb-2 text-green-700">Rincian Pendapatan (Kas Masuk)</h4>
                            <div className="border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Kategori</th><th className="p-2 text-right">Total</th></tr></thead><tbody className="divide-y">{pnlIncomeTableData.map(item => (<tr key={item.name}>
                                <td className="p-2">{item.name}</td>
                                <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                            </tr>))}</tbody><tfoot className="bg-gray-100 font-bold"><tr><td className="p-2">Total Pendapatan</td><td className="p-2 text-right">{formatCurrency(pnlSummary.totalSales)}</td></tr></tfoot></table></div>
                        </div>
                        <div>
                            <h4 className="font-bold text-lg mb-2 text-red-700">Rincian Pengeluaran Operasional</h4>
                            <div className="border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Kategori</th><th className="p-2 text-right">Total</th></tr></thead><tbody className="divide-y">{pnlExpenseTableData.map(item => (<tr key={item.name}>
                                <td className="p-2">
                                    <span>{item.name}</span>
                                    {item.allocationAmount > 0 && (
                                        <span className="block text-[11px] text-indigo-700">
                                            Termasuk dari Pos Alokasi Owner: {formatCurrency(item.allocationAmount)}
                                        </span>
                                    )}
                                </td>
                                <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                            </tr>))}</tbody><tfoot className="bg-gray-100 font-bold"><tr><td className="p-2">Total Pengeluaran Operasional</td><td className="p-2 text-right">{formatCurrency(pnlSummary.totalExpenses)}</td></tr></tfoot></table></div>
                            {pnlOwnerSalaryInfo.unpaidAccrued > 0 && (
                                <p className="text-xs text-amber-700 mt-2">
                                    Catatan: Terdapat Gaji Owner Terhutang sebesar <strong>{formatCurrency(pnlOwnerSalaryInfo.unpaidAccrued)}</strong> pada periode ini (belum memotong kas, sudah dihitung pada mode Basis Nota).
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}

            <div className="bg-gray-50 border rounded-xl p-5">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                    <h4 className="font-bold text-base text-gray-800">Ringkasan Arus Kas Non-Operasional, Cicilan &amp; Tarik Owner</h4>
                    <span className="text-xs text-gray-500">Pembanding Basis Nota: <strong>{formatCurrency(pnlAccrualPerformance.accrualNetProfit)}</strong></span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                    <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-gray-500">Bayar Tagihan Pemasok</p>
                        <p className="font-bold text-amber-700 mt-1">{formatCurrency(pnlNonOperational.supplierPaid)}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-gray-500">Bayar Cicilan Bank</p>
                        <p className="font-bold text-purple-700 mt-1">{formatCurrency(pnlNonOperational.bankPaid)}</p>
                        {pnlNonOperational.bankPaid > 0 && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                Pokok: {formatCurrency(pnlNonOperational.bankPrincipalPaid)} • Bunga: {formatCurrency(pnlNonOperational.bankInterestPaid)}
                            </p>
                        )}
                    </div>
                    <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-gray-500">Pribadi / Jamuan (Kas Toko)</p>
                        <p className="font-bold text-rose-700 mt-1">{formatCurrency(pnlNonOperational.privateStorePaid)}</p>
                        {pnlNonOperational.privateOwnerPaid > 0 && (
                            <p className="text-[11px] text-gray-400 mt-0.5">+ Dana Pribadi Owner: {formatCurrency(pnlNonOperational.privateOwnerPaid)}</p>
                        )}
                    </div>
                    <div className="bg-white p-3 rounded-lg border">
                        <p className="text-xs text-gray-500">Tarik Owner &amp; Setor Prive</p>
                        <p className="font-bold text-fuchsia-700 mt-1">{formatCurrency(pnlNonOperational.ownerOutTotal)}</p>
                        {pnlNonOperational.ownerOutTotal > 0 && (
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                Bonus/Prive {formatCurrency(pnlNonOperational.ownerBonusPriveTransferOut)} • Setor/Manual {formatCurrency(pnlNonOperational.setorOwnerOut + pnlNonOperational.manualTarikOwnerOut + pnlNonOperational.transferAdminFeeOut)}
                            </p>
                        )}
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-blue-200">
                        <p className="text-xs text-gray-500">Sisa Arus Kas Bersih Periode</p>
                        <p className={`font-extrabold mt-1 ${pnlNonOperational.netCashflowAfterAll >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {formatCurrency(pnlNonOperational.netCashflowAfterAll)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
        );
    };
    
    const renderSales = () => {
        const grossSales = filteredSalesData.reduce((sum, order) => sum + order.totalPrice, 0);
        const totalSalesDiscount = filteredSalesData.reduce((sum, order) => sum + (receivablesMap.get(order.id)?.discount || 0), 0);
        const totalSales = Math.max(0, grossSales - totalSalesDiscount);
        const totalTransactions = filteredSalesData.length;
        const totalItems = filteredSalesData.reduce((sum, order) => sum + order.orderItems.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
        const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
        
        const SortableHeader: React.FC<{ label: string; sortKey: string; className?: string }> = ({ label, sortKey, className }) => {
            const isSorted = sortConfig?.key === sortKey;
            const sortIcon = isSorted ? (sortConfig.order === 'asc' ? '▲' : '▼') : '';
            return (
                <th className={`py-2 px-3 text-left cursor-pointer select-none hover:bg-gray-100 ${className || ''}`} onClick={() => requestSort(sortKey)}>
                    <div className="flex items-center">
                        <span>{label}</span>
                        {sortIcon && <span className="ml-1 text-xs text-gray-700">{sortIcon}</span>}
                    </div>
                </th>
            );
        };

        return (
            <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Bulan</label>
                            <input type="month" value={salesMonth} onChange={e => setSalesMonth(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm text-gray-500" />
                        </div>
                        <div className="md:col-span-1 relative">
                            <label className="text-sm font-medium text-gray-700">Pelanggan (Opsional)</label>
                            <input
                                type="text"
                                value={salesCustomer}
                                onChange={e => {
                                    setSalesCustomer(e.target.value);
                                    setIsSalesCustomerDropdownOpen(true);
                                }}
                                onBlur={() => setTimeout(() => setIsSalesCustomerDropdownOpen(false), 150)}
                                placeholder="Ketik untuk mencari nama pelanggan..."
                                className="p-2 w-full mt-1 border rounded-md text-sm"
                                autoComplete="off"
                            />
                            {isSalesCustomerDropdownOpen && filteredSalesCustomers.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                                    {filteredSalesCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            className="px-3 py-2 cursor-pointer hover:bg-pink-100"
                                            onMouseDown={() => {
                                                setSalesCustomer(c.name);
                                                setIsSalesCustomerDropdownOpen(false);
                                            }}
                                        >
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            {salesCustomer ? (
                                <button
                                    onClick={() => handlePrintCustomerSpecificReport('sales')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 w-full"
                                >
                                    Cetak Laporan Pelanggan
                                </button>
                            ) : <div/>}
                        </div>
                    </div>
                    <div className="flex justify-end items-center mt-3">
                        <button onClick={handleResetSalesFilters} className="text-sm text-pink-600 hover:underline">Reset Filter</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <ReportStatCard icon={<CurrencyDollarIcon />} title={totalSalesDiscount > 0 ? "Penjualan Bersih (Stlh Diskon)" : "Total Penjualan"} value={formatCurrency(totalSales)} gradient="bg-gradient-to-br from-green-500 to-emerald-500" />
                     <ReportStatCard icon={<ShoppingCartIcon />} title="Jumlah Transaksi" value={totalTransactions.toString()} gradient="bg-gradient-to-br from-blue-500 to-sky-500" />
                     <ReportStatCard icon={<CubeIcon />} title="Total Item Terjual" value={totalItems.toString()} gradient="bg-gradient-to-br from-amber-500 to-yellow-500" />
                     <ReportStatCard icon={<ChartBarIcon />} title="Rata-rata/Transaksi" value={formatCurrency(avgTransaction)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                </div>
                {totalSalesDiscount > 0 && (
                    <div className="text-xs text-gray-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        Penjualan kotor periode ini: <strong>{formatCurrency(grossSales)}</strong> • Total diskon nota: <strong className="text-red-600">- {formatCurrency(totalSalesDiscount)}</strong> • Penjualan bersih: <strong className="text-emerald-700">{formatCurrency(totalSales)}</strong>
                    </div>
                )}
                <div>
                    <h4 className="font-semibold mb-2">Rincian Penjualan</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left">No</th>
                                    <SortableHeader label="Tanggal" sortKey="tanggal" />
                                    <SortableHeader label="No. Nota" sortKey="noNota" />
                                    <SortableHeader label="Pelanggan" sortKey="pelanggan" />
                                    <th className="py-2 px-3 text-left">Deskripsi</th>
                                    <th className="py-2 px-3 text-left">Bahan</th>
                                    <th className="py-2 px-3 text-center">P</th>
                                    <th className="py-2 px-3 text-center">L</th>
                                    <th className="py-2 px-3 text-center">Qty</th>
                                    <SortableHeader label="Total" sortKey="total" className="text-right" />
                                    <SortableHeader label="Status" sortKey="status" />
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedSalesData.map(item => (
                                    <tr key={item.key}>
                                        <td className="py-2 px-3">{item.no}</td>
                                        <td className="py-2 px-3">{item.tanggal}</td>
                                        <td className="py-2 px-3">{item.noNota}</td>
                                        <td className="py-2 px-3">{item.pelanggan}</td>
                                        <td className="py-2 px-3">{item.deskripsi}</td>
                                        <td className="py-2 px-3">{item.bahan}</td>
                                        <td className="py-2 px-3 text-center">{item.p}</td>
                                        <td className="py-2 px-3 text-center">{item.l}</td>
                                        <td className="py-2 px-3 text-center">{item.qty}</td>
                                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(item.total)}</td>
                                        <td className="py-2 px-3">{item.status}</td>
                                    </tr>
                                ))}
                                {paginatedSalesData.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="text-center py-8 text-gray-500">Tidak ada data penjualan pada periode ini.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                     <Pagination
                        totalItems={sortedDetailedSalesData.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>
        );
    };

    const renderCategorySales = () => {
        const topCategory = categorySalesReport.categories[0];
        return (
            <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Dari Tanggal</label>
                            <input
                                type="date"
                                value={categoryReportStartDate}
                                onChange={e => setCategoryReportStartDate(e.target.value)}
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={categoryReportEndDate}
                                onChange={e => setCategoryReportEndDate(e.target.value)}
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700">Pelanggan (Opsional)</label>
                            <input
                                type="text"
                                value={categoryReportCustomer}
                                onChange={e => setCategoryReportCustomer(e.target.value)}
                                placeholder="Filter nama pelanggan..."
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={handleResetCategoryFilters} className="text-sm text-pink-600 hover:underline font-medium py-2">
                                Reset Filter
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ReportStatCard
                        icon={<CurrencyDollarIcon />}
                        title="Penjualan Bersih Periode"
                        value={formatCurrency(Math.round(categorySalesReport.totalNetSales))}
                        gradient="bg-gradient-to-br from-emerald-500 to-green-600"
                    />
                    <ReportStatCard
                        icon={<CubeIcon />}
                        title="Estimasi HPP (Modal)"
                        value={formatCurrency(Math.round(categorySalesReport.totalEstimatedCost))}
                        gradient="bg-gradient-to-br from-amber-500 to-orange-500"
                    />
                    <ReportStatCard
                        icon={<ChartBarIcon />}
                        title="Estimasi Laba Kotor"
                        value={formatCurrency(Math.round(categorySalesReport.totalGrossProfit))}
                        gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
                    />
                    <ReportStatCard
                        icon={<ShoppingCartIcon />}
                        title="Margin Laba Kotor"
                        value={`${categorySalesReport.totalMarginPercent.toFixed(1)}%`}
                        gradient="bg-gradient-to-br from-pink-500 to-rose-600"
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2">
                    <div>
                        Kategori Aktif: <strong>{categorySalesReport.categories.length} Kategori</strong> • Total Qty: <strong>{categorySalesReport.totalQty.toLocaleString('id-ID')}</strong> • Terlaris: <strong className="text-pink-700">{topCategory ? topCategory.categoryName : '-'}</strong>
                    </div>
                    {categorySalesReport.totalDiscount > 0 && (
                        <div>
                            Penjualan kotor: <strong>{formatCurrency(Math.round(categorySalesReport.totalGrossSales))}</strong> • Alokasi diskon nota: <strong className="text-red-600">- {formatCurrency(Math.round(categorySalesReport.totalDiscount))}</strong> • Bersih: <strong className="text-emerald-700">{formatCurrency(Math.round(categorySalesReport.totalNetSales))}</strong>
                        </div>
                    )}
                </div>

                {categorySalesReport.missingCostProducts.length > 0 && (
                    <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                        <strong>Catatan Estimasi HPP:</strong> Terdapat <strong>{categorySalesReport.missingCostProducts.length} produk</strong> yang terjual pada periode ini belum diisi Estimasi Modal/HPP di Data Master ({categorySalesReport.missingCostProducts.slice(0, 5).join(', ')}{categorySalesReport.missingCostProducts.length > 5 ? `, +${categorySalesReport.missingCostProducts.length - 5} lainnya` : ''}). HPP item tersebut dihitung Rp 0 sampai Anda mengisinya di <strong>Data Master → Produk &amp; Layanan</strong>.
                    </div>
                )}

                {categorySalesReport.categories.length > 0 && (
                    <div className="bg-white border rounded-xl p-4">
                        <h4 className="font-bold text-gray-800 mb-3">Grafik Penjualan Bersih &amp; Estimasi Laba Kotor per Kategori</h4>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categorySalesReport.categories.map(c => ({ name: c.categoryName, 'Penjualan Bersih': Math.round(c.netSales), 'Estimasi Laba Kotor': Math.round(c.grossProfit) }))} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `Rp ${(Number(v) / 1000000).toFixed(1)} Jt`} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                    <Legend />
                                    <Bar dataKey="Penjualan Bersih" fill="#ec4899" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="Estimasi Laba Kotor" fill="#10b981" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div>
                    <h4 className="font-semibold mb-2">Rincian Penjualan &amp; Estimasi Margin per Kategori</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left">No</th>
                                    <th className="py-2 px-3 text-left">Kategori</th>
                                    <th className="py-2 px-3 text-left">Tipe Satuan</th>
                                    <th className="py-2 px-3 text-right">Nota</th>
                                    <th className="py-2 px-3 text-right">Total Qty</th>
                                    <th className="py-2 px-3 text-right">Total Luas</th>
                                    <th className="py-2 px-3 text-right">Penjualan Kotor</th>
                                    <th className="py-2 px-3 text-right">Penjualan Bersih</th>
                                    <th className="py-2 px-3 text-right">Est. HPP</th>
                                    <th className="py-2 px-3 text-right">Est. Laba Kotor</th>
                                    <th className="py-2 px-3 text-right">Margin</th>
                                    <th className="py-2 px-3 text-right">Kontribusi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {categorySalesReport.categories.map((c, idx) => (
                                    <tr key={c.categoryName} className="hover:bg-gray-50">
                                        <td className="py-2 px-3">{idx + 1}</td>
                                        <td className="py-2 px-3 font-semibold text-gray-800">{c.categoryName}</td>
                                        <td className="py-2 px-3 text-xs text-gray-600">{c.unitType}</td>
                                        <td className="py-2 px-3 text-right">{c.orderCount}</td>
                                        <td className="py-2 px-3 text-right">{c.totalQty.toLocaleString('id-ID')}</td>
                                        <td className="py-2 px-3 text-right">{c.unitType === 'Per Luas' ? `${c.totalAreaM2.toFixed(2)} m²` : '-'}</td>
                                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(Math.round(c.grossSales))}</td>
                                        <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatCurrency(Math.round(c.netSales))}</td>
                                        <td className="py-2 px-3 text-right text-amber-700">{formatCurrency(Math.round(c.estimatedCost))}</td>
                                        <td className={`py-2 px-3 text-right font-bold ${c.grossProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                                            {formatCurrency(Math.round(c.grossProfit))}
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.marginPercent >= 40 ? 'bg-emerald-100 text-emerald-800' : c.marginPercent >= 20 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                                                {c.marginPercent.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 bg-gray-200 rounded-full h-1.5 hidden sm:block">
                                                    <div className="bg-pink-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, c.sharePercent)}%` }} />
                                                </div>
                                                <span className="font-semibold text-xs">{c.sharePercent.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {categorySalesReport.categories.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="text-center py-8 text-gray-500">Tidak ada penjualan pada rentang tanggal ini.</td>
                                    </tr>
                                )}
                            </tbody>
                            {categorySalesReport.categories.length > 0 && (
                                <tfoot className="bg-gray-100 font-bold">
                                    <tr>
                                        <td colSpan={3} className="py-2 px-3">TOTAL</td>
                                        <td className="py-2 px-3 text-right">{categorySalesReport.totalOrders} Nota</td>
                                        <td className="py-2 px-3 text-right">{categorySalesReport.totalQty.toLocaleString('id-ID')}</td>
                                        <td className="py-2 px-3 text-right">-</td>
                                        <td className="py-2 px-3 text-right">{formatCurrency(Math.round(categorySalesReport.totalGrossSales))}</td>
                                        <td className="py-2 px-3 text-right text-emerald-800">{formatCurrency(Math.round(categorySalesReport.totalNetSales))}</td>
                                        <td className="py-2 px-3 text-right text-amber-800">{formatCurrency(Math.round(categorySalesReport.totalEstimatedCost))}</td>
                                        <td className="py-2 px-3 text-right text-indigo-800">{formatCurrency(Math.round(categorySalesReport.totalGrossProfit))}</td>
                                        <td className="py-2 px-3 text-right">{categorySalesReport.totalMarginPercent.toFixed(1)}%</td>
                                        <td className="py-2 px-3 text-right">100%</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {categorySalesReport.topProducts.length > 0 && (
                    <div>
                        <h4 className="font-semibold mb-2">Top 10 Produk / Bahan Terlaris &amp; Estimasi Margin</h4>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="py-2 px-3 text-left">No</th>
                                        <th className="py-2 px-3 text-left">Produk / Bahan</th>
                                        <th className="py-2 px-3 text-left">Kategori</th>
                                        <th className="py-2 px-3 text-right">Nota</th>
                                        <th className="py-2 px-3 text-right">Qty</th>
                                        <th className="py-2 px-3 text-right">Luas</th>
                                        <th className="py-2 px-3 text-right">Penjualan Bersih</th>
                                        <th className="py-2 px-3 text-right">Est. HPP</th>
                                        <th className="py-2 px-3 text-right">Est. Laba Kotor</th>
                                        <th className="py-2 px-3 text-right">Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {categorySalesReport.topProducts.slice(0, 10).map((p, idx) => (
                                        <tr key={`${p.categoryName}-${p.productName}-${idx}`} className="hover:bg-gray-50">
                                            <td className="py-2 px-3">{idx + 1}</td>
                                            <td className="py-2 px-3 font-medium text-gray-800">{p.productName}</td>
                                            <td className="py-2 px-3 text-xs text-gray-600">{p.categoryName}</td>
                                            <td className="py-2 px-3 text-right">{p.orderCount}</td>
                                            <td className="py-2 px-3 text-right">{p.totalQty.toLocaleString('id-ID')}</td>
                                            <td className="py-2 px-3 text-right">{p.totalAreaM2 > 0 ? `${p.totalAreaM2.toFixed(2)} m²` : '-'}</td>
                                            <td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatCurrency(Math.round(p.netSales))}</td>
                                            <td className="py-2 px-3 text-right text-xs">
                                                {p.hasCost ? (
                                                    <span className="text-amber-700 font-medium">{formatCurrency(Math.round(p.estimatedCost))}</span>
                                                ) : (
                                                    <span className="text-gray-400 italic">HPP belum diisi</span>
                                                )}
                                            </td>
                                            <td className={`py-2 px-3 text-right font-semibold ${p.grossProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                                                {formatCurrency(Math.round(p.grossProfit))}
                                            </td>
                                            <td className="py-2 px-3 text-right text-xs font-bold">{p.marginPercent.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderReceivables = () => {
        const totalRemaining = filteredReceivablesData.reduce((sum, r) => sum + r.remaining, 0);
        const totalUnpaidNotes = filteredReceivablesData.length;
        const overdueItems = filteredReceivablesData.filter(r => r.dueCategory === 'overdue');
        const overdueAmount = overdueItems.reduce((sum, r) => sum + r.remaining, 0);

        return (
            <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Tipe Filter Periode</label>
                            <select 
                                value={receivablesFilterType} 
                                onChange={e => setReceivablesFilterType(e.target.value as any)} 
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            >
                                <option value="all">Semua Waktu (Lintas Tahun)</option>
                                <option value="month">Per Bulan</option>
                                <option value="date">Per Tanggal</option>
                                <option value="year">Per Tahun</option>
                            </select>
                        </div>
                        
                        {receivablesFilterType === 'all' ? (
                            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-md text-xs text-indigo-800">
                                Menampilkan seluruh piutang aktif lintas bulan &amp; tahun (baru + lama).
                            </div>
                        ) : receivablesFilterType === 'date' ? (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Dari Tanggal</label>
                                    <input type="date" value={receivablesStartDate} onChange={e => setReceivablesStartDate(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm bg-white" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Sampai Tanggal</label>
                                    <input type="date" value={receivablesEndDate} onChange={e => setReceivablesEndDate(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm bg-white" />
                                </div>
                            </div>
                        ) : receivablesFilterType === 'year' ? (
                            <div>
                                <label className="text-sm font-medium text-gray-700">Tahun</label>
                                <select 
                                    value={receivablesYear} 
                                    onChange={e => setReceivablesYear(Number(e.target.value))}
                                    className="p-2 w-full mt-1 border rounded-md bg-white text-sm"
                                >
                                    {years.map(year => <option key={year} value={year}>{year}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="text-sm font-medium text-gray-700">Bulan</label>
                                <input type="month" value={receivablesMonth} onChange={e => setReceivablesMonth(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm text-gray-700 bg-white" />
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium text-gray-700">Status Jatuh Tempo</label>
                            <select
                                value={receivablesDueStatusFilter}
                                onChange={e => setReceivablesDueStatusFilter(e.target.value as any)}
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            >
                                <option value="all">Semua Status</option>
                                <option value="overdue">Jatuh Tempo (Overdue)</option>
                                <option value="due_soon">Segera Jatuh Tempo (&le; H+{notificationSettings.receivableDueSoonDays ?? 7})</option>
                                <option value="active">Belum Jatuh Tempo</option>
                            </select>
                        </div>

                        <div className="relative">
                            <label className="text-sm font-medium text-gray-700">Pelanggan (Opsional)</label>
                             <input 
                                type="text" 
                                value={receivablesCustomer} 
                                onChange={e => {
                                    setReceivablesCustomer(e.target.value);
                                    setIsReceivablesCustomerDropdownOpen(true);
                                }} 
                                onBlur={() => setTimeout(() => setIsReceivablesCustomerDropdownOpen(false), 150)}
                                placeholder="Ketik untuk mencari nama pelanggan..."
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                                autoComplete="off"
                            />
                            {isReceivablesCustomerDropdownOpen && filteredReceivablesCustomers.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                                    {filteredReceivablesCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            className="px-3 py-2 cursor-pointer hover:bg-pink-100"
                                            onMouseDown={() => {
                                                setReceivablesCustomer(c.name);
                                                setIsReceivablesCustomerDropdownOpen(false);
                                            }}
                                        >
                                            {c.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                     <div className="flex flex-wrap justify-between items-center mt-3 gap-2">
                        {receivablesCustomer ? (
                            <button
                                onClick={() => handlePrintCustomerSpecificReport('receivables')}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700"
                            >
                                Cetak Tagihan Pelanggan: {receivablesCustomer}
                            </button>
                        ) : <div />}
                        <button onClick={handleResetReceivablesFilters} className="text-sm text-pink-600 hover:underline">Reset Filter</button>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                     <ReportStatCard icon={<UsersIcon />} title="Total Piutang Aktif (Global)" value={formatCurrency(globalActiveReceivables)} gradient="bg-gradient-to-br from-indigo-500 to-blue-500" />
                     <ReportStatCard icon={<ReceiptTaxIcon />} title="Sisa Tagihan (Filter)" value={formatCurrency(totalRemaining)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title={`Overdue (${overdueItems.length} Nota)`} value={formatCurrency(overdueAmount)} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
                     <ReportStatCard icon={<CreditCardIcon />} title="Nota Belum Lunas (Filter)" value={totalUnpaidNotes.toString()} gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500" />
                 </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Piutang (Belum Lunas)</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left">No. Nota</th>
                                    <th className="py-2 px-3 text-left">Pelanggan</th>
                                    <th className="py-2 px-3 text-right">Total Tagihan</th>
                                    <th className="py-2 px-3 text-right">Dibayar</th>
                                    <th className="py-2 px-3 text-right">Sisa Tagihan</th>
                                    <th className="py-2 px-3 text-center">Status Produksi</th>
                                    <th className="py-2 px-3 text-left">Jatuh Tempo &amp; Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedReceivables.map(r => (
                                    <tr key={r.id} className={r.dueCategory === 'overdue' ? 'bg-red-50/40' : ''}>
                                        <td className="py-2 px-3 font-semibold">
                                            {r.type === 'legacy' ? r.nota_id : r.id}
                                            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-semibold ${r.type === 'legacy' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {r.type === 'legacy' ? 'Lama' : 'Baru'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">{r.customer}</td>
                                        <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(Math.max(0, r.amount - (r.discount || 0)))}</td>
                                        <td className="py-2 px-3 text-right text-emerald-700">{formatCurrency(r.paid)}</td>
                                        <td className="py-2 px-3 text-right font-bold text-red-600">{formatCurrency(r.remaining)}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                {r.productionStatus}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">
                                            <div className="text-xs font-medium text-gray-800">{formatDate(r.due)}</div>
                                            <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                r.dueCategory === 'overdue'
                                                    ? 'bg-red-100 text-red-800'
                                                    : r.dueCategory === 'due_soon'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-emerald-100 text-emerald-800'
                                            }`}>
                                                {r.dueStatusLabel}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                 {paginatedReceivables.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-500">Tidak ada data piutang pada filter ini.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        totalItems={filteredReceivablesData.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                 </div>
            </div>
        );
    };

    const renderInventory = () => {
        const totalItems = filteredInventoryData.length;
        const lowStockItems = filteredInventoryData.filter(i => i.stock <= notificationSettings.lowStockThreshold).length;
        const needsAttentionCount = filteredInventoryData.filter(i => i.condition !== 'Baik').length;
        const checkDiffDays = getIsoDaysDiffFromNow(inventoryCheckStatus.lastCheckedAt);
        const checkBannerClass =
            checkDiffDays === null || checkDiffDays >= 7
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : checkDiffDays >= 3
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900';

        return (
            <div className="space-y-6">
                <div className={`p-4 rounded-xl border ${checkBannerClass}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {checkDiffDays !== null && checkDiffDays < 3 ? (
                                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                            ) : (
                                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                            )}
                            <div>
                                <p className="text-sm font-bold">
                                    Status Pemeriksaan Fisik Inventori: {formatDaysAgoLabel(inventoryCheckStatus.lastCheckedAt)}
                                </p>
                                <p className="text-xs">
                                    Terakhir dicek: <strong>{formatDateTimeID(inventoryCheckStatus.lastCheckedAt)}</strong>
                                    {inventoryCheckStatus.lastCheckedBy ? ` oleh ${inventoryCheckStatus.lastCheckedBy}` : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {(['Bahan Baku', 'ATK', 'Kebersihan', 'Lain-Lain'] as InventoryCategory[]).map(cat => {
                                const info = inventoryCheckStatus.byCategory?.[cat];
                                return (
                                    <span key={cat} className="text-[11px] bg-white/80 border px-2 py-0.5 rounded font-medium">
                                        <b>{cat}:</b> {formatDaysAgoLabel(info?.checkedAt)}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                            <label className="text-xs font-semibold text-gray-600">Cari Item / SKU / Catatan</label>
                            <div className="relative mt-1">
                                <input
                                    type="text"
                                    value={inventorySearch}
                                    onChange={e => setInventorySearch(e.target.value)}
                                    placeholder="Ketik nama, SKU, catatan..."
                                    className="p-2 pl-8 w-full border rounded-md text-sm bg-white"
                                />
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600">Kategori Inventori</label>
                            <select
                                value={inventoryCategoryFilter}
                                onChange={e => setInventoryCategoryFilter(e.target.value as any)}
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            >
                                <option value="Semua">Semua Kategori</option>
                                <option value="Bahan Baku">Bahan Baku</option>
                                <option value="ATK">ATK</option>
                                <option value="Kebersihan">Kebersihan</option>
                                <option value="Lain-Lain">Lain-Lain</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600">Kondisi Barang</label>
                            <select
                                value={inventoryConditionFilter}
                                onChange={e => setInventoryConditionFilter(e.target.value as any)}
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            >
                                <option value="Semua">Semua Kondisi</option>
                                <option value="Baik">Baik</option>
                                <option value="Perlu Restock">Perlu Restock</option>
                                <option value="Rusak / Perlu Ganti">Rusak / Perlu Ganti</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-600">Status Stok</label>
                            <select
                                value={inventoryStockStatusFilter}
                                onChange={e => setInventoryStockStatusFilter(e.target.value as any)}
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            >
                                <option value="Semua">Semua Status</option>
                                <option value="Stok Menipis">Stok Menipis (&le; {notificationSettings.lowStockThreshold})</option>
                                <option value="Tersedia">Tersedia</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end mt-2">
                        <button onClick={handleResetInventoryFilters} className="text-xs text-pink-600 hover:underline font-medium">
                            Reset Filter Stok
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <ReportStatCard icon={<CubeIcon />} title="Total Jenis Item (Filter)" value={totalItems.toString()} gradient="bg-gradient-to-br from-indigo-500 to-violet-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title="Item Stok Menipis" value={lowStockItems.toString()} gradient="bg-gradient-to-br from-red-500 to-rose-500" />
                     <ReportStatCard icon={<CheckCircleIcon />} title="Perlu Restock / Rusak" value={needsAttentionCount.toString()} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Stok Inventori</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left">SKU</th>
                                    <th className="py-2 px-3 text-left">Nama Item</th>
                                    <th className="py-2 px-3 text-left">Kategori</th>
                                    <th className="py-2 px-3 text-left">Tipe</th>
                                    <th className="py-2 px-3 text-right">Stok Saat Ini</th>
                                    <th className="py-2 px-3 text-center">Status Stok</th>
                                    <th className="py-2 px-3 text-center">Kondisi</th>
                                    <th className="py-2 px-3 text-left">Catatan</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedInventory.map(i => (
                                    <tr key={i.id}>
                                        <td className="py-2 px-3 text-xs text-gray-500">{i.sku || '-'}</td>
                                        <td className="py-2 px-3 font-medium text-gray-800">{i.name}</td>
                                        <td className="py-2 px-3">
                                            <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-slate-100 text-slate-700">
                                                {i.category}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-xs text-gray-600">{i.type}</td>
                                        <td className="py-2 px-3 text-right font-semibold">{`${i.stock} ${i.unit}`}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${i.status === 'Stok Menipis' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                {i.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${
                                                i.condition === 'Baik'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : i.condition === 'Perlu Restock'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {i.condition}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-xs text-gray-600 max-w-xs truncate" title={i.notes || ''}>
                                            {i.notes || '-'}
                                        </td>
                                    </tr>
                                ))}
                                {paginatedInventory.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8 text-gray-500">Tidak ada item inventori yang cocok dengan filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        totalItems={filteredInventoryData.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                    />
                 </div>
            </div>
        );
    };

    const TabButton: React.FC<{ tabKey: string; label: string }> = ({ tabKey, label }) => (
        <button
            onClick={() => setActiveTab(tabKey)}
            className={`${ activeTab === tabKey ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
        >
            {label}
        </button>
    );

    const legacyIncomeTotal = legacyMonthlyIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    const legacyExpenseTotal = legacyMonthlyExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const legacyReceivableAllTotal = legacyReceivables.reduce((s, r) => s + Number(r.amount || 0), 0);
    const legacyReceivableFilteredTotal = filteredLegacyReceivables.reduce((s, r) => s + Number(r.amount || 0), 0);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4">Laporan</h2>
            {accessibleTabs.length > 1 && (
                <div className="border-b border-gray-200 mb-6">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                        {accessibleTabs.map(tab => <TabButton key={tab.key} tabKey={tab.key} label={tab.label} />)}
                    </nav>
                </div>
            )}

            <div className="flex-1 overflow-y-auto min-h-[50vh] pr-2 pb-20">
                {activeTab === 'finalRecap' && renderFinalRecap()}
                {activeTab === 'profitAndLoss' && renderProfitAndLoss()}
                {activeTab === 'sales' && renderSales()}
                {activeTab === 'categorySales' && renderCategorySales()}
                {activeTab === 'receivables' && renderReceivables()}
                {activeTab === 'inventory' && renderInventory()}
                {activeTab === 'assetsDebts' && (
                    <AssetsAndDebts 
                        assets={assets} debts={debts}
                        bankInstallments={bankInstallments}
                        supplierBills={supplierBills}
                        suppliers={suppliers}
                        cashSnapshot={storeCashSnapshot}
                        legacyReceivables={legacyReceivables}
                        ownerTransactions={ownerTransactions}
                        ownerMonthlyClosings={ownerMonthlyClosings}
                    />
                )}
                {activeTab === 'dataPenjualanLama' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ReportStatCard
                                icon={<CurrencyDollarIcon />}
                                title="Total Pemasukan Data Lama"
                                value={formatCurrency(legacyIncomeTotal)}
                                gradient="bg-gradient-to-br from-emerald-500 to-green-600"
                            />
                            <ReportStatCard
                                icon={<ReceiptTaxIcon />}
                                title="Total Pengeluaran Data Lama"
                                value={formatCurrency(legacyExpenseTotal)}
                                gradient="bg-gradient-to-br from-rose-500 to-red-600"
                            />
                            <ReportStatCard
                                icon={<ChartBarIcon />}
                                title="Selisih Bersih Data Lama"
                                value={formatCurrency(legacyIncomeTotal - legacyExpenseTotal)}
                                gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
                            />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <MonthlyLegacyDataForm 
                                title="Pemasukan Data Lama (Bulanan)"
                                data={legacyMonthlyIncomes}
                                onSave={onAddLegacyMonthlyIncome}
                                onUpdate={onUpdateLegacyMonthlyIncome}
                                onDelete={onDeleteLegacyMonthlyIncome}
                            />
                            <MonthlyLegacyDataForm 
                                title="Pengeluaran Data Lama (Bulanan)"
                                data={legacyMonthlyExpenses}
                                onSave={onAddLegacyMonthlyExpense}
                                onUpdate={onUpdateLegacyMonthlyExpense}
                                onDelete={onDeleteLegacyMonthlyExpense}
                            />
                        </div>
                    </div>
                )}
                {activeTab === 'dataPiutangLama' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ReportStatCard
                                icon={<ReceiptTaxIcon />}
                                title="Total Piutang Lama (Semua)"
                                value={formatCurrency(legacyReceivableAllTotal)}
                                gradient="bg-gradient-to-br from-amber-500 to-orange-600"
                            />
                            <ReportStatCard
                                icon={<CurrencyDollarIcon />}
                                title="Nominal Sesuai Filter"
                                value={formatCurrency(legacyReceivableFilteredTotal)}
                                gradient="bg-gradient-to-br from-rose-500 to-red-600"
                            />
                            <ReportStatCard
                                icon={<UsersIcon />}
                                title="Jumlah Nota Lama (Filter)"
                                value={`${filteredLegacyReceivables.length} Nota`}
                                gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
                            />
                        </div>

                        <div className="flex flex-wrap justify-between items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsLegacyFilterVisible(prev => !prev)}
                                className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 border"
                            >
                                <FilterIcon className="h-4 w-4" />
                                {isLegacyFilterVisible ? 'Sembunyikan Filter' : 'Filter Piutang Lama'}
                            </button>
                            <button
                                onClick={() => setIsLegacyImportExportModalOpen(true)}
                                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-700 transition-colors"
                            >
                                Impor / Ekspor Excel
                            </button>
                        </div>

                        {isLegacyFilterVisible && (
                            <div className="bg-gray-50 p-4 rounded-lg border grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                <div>
                                    <label className="text-xs font-semibold text-gray-600">Cari Pelanggan / Nota / Deskripsi</label>
                                    <input
                                        type="text"
                                        value={legacyFilterCustomer}
                                        onChange={e => setLegacyFilterCustomer(e.target.value)}
                                        placeholder="Ketik kata kunci..."
                                        className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600">Dari Tanggal</label>
                                    <input
                                        type="date"
                                        value={legacyFilterStartDate}
                                        onChange={e => setLegacyFilterStartDate(e.target.value)}
                                        className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600">Sampai Tanggal</label>
                                    <input
                                        type="date"
                                        value={legacyFilterEndDate}
                                        onChange={e => setLegacyFilterEndDate(e.target.value)}
                                        className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={handleResetLegacyFilters} className="text-sm text-pink-600 hover:underline py-2">
                                        Reset Filter
                                    </button>
                                </div>
                            </div>
                        )}

                        <LegacyReceivableForm 
                            customers={customers}
                            legacyReceivables={filteredLegacyReceivables}
                            onSave={onAddLegacyReceivable}
                            onUpdate={onUpdateLegacyReceivable}
                            onDelete={onDeleteLegacyReceivable}
                        />
                        <LegacyReceivableImportExportModal 
                            show={isLegacyImportExportModalOpen}
                            onClose={() => setIsLegacyImportExportModalOpen(false)}
                            filteredData={filteredLegacyReceivables}
                            onAddLegacyReceivable={onAddLegacyReceivable}
                        />
                    </div>
                )}
            </div>
            
            {(activeTab === 'sales' || activeTab === 'categorySales' || activeTab === 'receivables' || activeTab === 'profitAndLoss' || activeTab === 'inventory' || activeTab === 'assetsDebts' || activeTab === 'dataPenjualanLama' || activeTab === 'dataPiutangLama') && (
                <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-10">
                    <button 
                        onClick={handlePrintReport} 
                        className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-110"
                        title="Preview & Cetak Laporan"
                    >
                        <PrinterIcon className="h-6 w-6" />
                    </button>
                    <button 
                        onClick={handleExport} 
                        className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-transform hover:scale-110"
                        title="Ekspor Excel"
                    >
                        <ArrowDownTrayIcon className="h-6 w-6" />
                    </button>
                </div>
            )}

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
                                {printPreviewDoc.canExportExcel && (
                                    <button
                                        type="button"
                                        onClick={handleExport}
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

export default Reports;
