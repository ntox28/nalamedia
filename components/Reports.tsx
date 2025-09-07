import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { type SavedOrder, type ExpenseItem, type ReceivableItem, type ProductData, type CustomerData, type InventoryItem, type LegacyMonthlyIncome, type LegacyMonthlyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type CategoryData, type FinishingData, type ReportsProps, type OrderItemData } from '../types';
import { CurrencyDollarIcon, ReceiptTaxIcon, ChartBarIcon, ShoppingCartIcon, UsersIcon, CubeIcon, ChevronDownIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CreditCardIcon, ArrowDownTrayIcon, PrinterIcon, FilterIcon } from './Icons';
import { exportToExcel } from './reportUtils';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;


// Helper to get first and last day of the current month
const getMonthDateRange = () => {
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().substring(0, 10);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().substring(0, 10);
  return { firstDay, lastDay };
};

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
    { key: 'receivables', label: 'Piutang' },
    { key: 'inventory', label: 'Stok' },
    { key: 'assetsDebts', label: 'Aset dan Hutang' },
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
                                <p className="font-semibold text-gray-800">{new Date(item.month_date).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
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

    const initialFormState = {
        nota_id: '',
        customer: customers.length > 0 ? customers[0].name : '',
        order_date: new Date().toISOString().substring(0, 10),
        description: '',
        length: '',
        width: '',
        qty: '1',
        amount: '',
    };
    
    const [formState, setFormState] = useState(initialFormState);

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
    }, [editingItem, customers]);
    
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
                        {editingItem && <button type="button" onClick={() => setEditingItem(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>}
                    </div>
                </form>
            </div>
            <div>
                <h4 className="font-semibold text-gray-700 mb-2">Daftar Piutang Lama (Belum Lunas)</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {legacyReceivables.map(item => (
                        <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-800">{item.customer} <span className="text-xs text-gray-500 font-normal">({item.nota_id})</span></p>
                                <p className="text-sm text-red-600 font-bold">{formatCurrency(item.amount)}</p>
                                <p className="text-xs text-gray-500">{new Date(item.order_date).toLocaleDateString('id-ID')}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setEditingItem(item)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4"/></button>
                                <button onClick={() => handleDeleteClick(item.id)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
};

const AssetsAndDebts: React.FC<{
    assets: AssetItem[];
    debts: DebtItem[];
    onAddAsset: (data: Omit<AssetItem, 'id'>) => void;
    onAddDebt: (data: Omit<DebtItem, 'id'>) => void;
}> = ({ assets, debts, onAddAsset, onAddDebt }) => {
    const [assetName, setAssetName] = useState('');
    const [assetValue, setAssetValue] = useState('');
    const [debtName, setDebtName] = useState('');
    const [debtValue, setDebtValue] = useState('');

    const handleAddAssetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddAsset({ name: assetName, value: Number(assetValue) });
        setAssetName('');
        setAssetValue('');
    };

    const handleAddDebtSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddDebt({ name: debtName, value: Number(debtValue) });
        setDebtName('');
        setDebtValue('');
    };

    const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
    const totalDebts = debts.reduce((sum, d) => sum + d.value, 0);
    const netWorth = totalAssets - totalDebts;

    return (
        <div className="space-y-8">
            <div className="bg-gray-50 p-6 rounded-lg border text-center">
                <h3 className="text-lg font-semibold text-gray-600">Total Kekayaan Bersih (Aset - Hutang)</h3>
                <p className={`text-3xl font-bold mt-2 ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netWorth)}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Assets Column */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Aset</h3>
                    <form onSubmit={handleAddAssetSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                        <h4 className="font-semibold text-gray-700">Tambah Aset Baru</h4>
                        <input value={assetName} onChange={e => setAssetName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nama Aset (e.g., Mesin Cetak)" required />
                        <input type="number" value={assetValue} onChange={e => setAssetValue(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nilai Aset (Rp)" required />
                        <button type="submit" className="w-full bg-cyan-600 text-white py-2 rounded-lg font-semibold hover:bg-cyan-700">Tambah Aset</button>
                    </form>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2">
                        {assets.map(item => (
                            <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                                <p className="font-semibold text-gray-800">{item.name}</p>
                                <p className="text-sm text-green-600 font-bold">{formatCurrency(item.value)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between font-bold text-lg p-3 bg-green-50 rounded-lg">
                        <span>Total Aset</span>
                        <span>{formatCurrency(totalAssets)}</span>
                    </div>
                </div>

                {/* Debts Column */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Hutang</h3>
                     <form onSubmit={handleAddDebtSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                        <h4 className="font-semibold text-gray-700">Tambah Hutang Baru</h4>
                        <input value={debtName} onChange={e => setDebtName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nama Hutang (e.g., Cicilan Bank)" required />
                        <input type="number" value={debtValue} onChange={e => setDebtValue(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nilai Hutang (Rp)" required />
                        <button type="submit" className="w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600">Tambah Hutang</button>
                    </form>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2">
                        {debts.map(item => (
                            <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                                <p className="font-semibold text-gray-800">{item.name}</p>
                                <p className="text-sm text-red-600 font-bold">{formatCurrency(item.value)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between font-bold text-lg p-3 bg-red-50 rounded-lg">
                        <span>Total Hutang</span>
                        <span>{formatCurrency(totalDebts)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Reports: React.FC<ReportsProps> = (props) => {
    const { 
    allOrders, expenses, receivables, products, customers, inventory, categories, finishings,
    menuPermissions, legacyMonthlyIncomes, legacyMonthlyExpenses, legacyReceivables, assets, debts, notificationSettings,
    onAddLegacyMonthlyIncome, onUpdateLegacyMonthlyIncome, onDeleteLegacyMonthlyIncome,
    onAddLegacyMonthlyExpense, onUpdateLegacyMonthlyExpense, onDeleteLegacyMonthlyExpense,
    onAddLegacyReceivable, onUpdateLegacyReceivable, onDeleteLegacyReceivable,
    onAddAsset, onAddDebt
    } = props;
    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`reports/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'noNota', order: 'desc' });

    const [isCustomerReportFilterVisible, setIsCustomerReportFilterVisible] = useState(false);
    const [filterCustomer, setFilterCustomer] = useState('');


    const { firstDay, lastDay } = getMonthDateRange();
    const [filterStartDate, setFilterStartDate] = useState(firstDay);
    const [filterEndDate, setFilterEndDate] = useState(lastDay);

    const years = useMemo(() => {
        const orderYears = allOrders.map(order => new Date(order.orderDate).getFullYear());
        return Array.from(new Set(orderYears)).sort((a, b) => b - a);
    }, [allOrders]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

     const uniqueCustomers = useMemo(() => {
        const customerSet = new Set(allOrders.map(o => o.customer));
        return Array.from(customerSet).sort();
    }, [allOrders]);
    
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
        setFilterCustomer('');
        setIsCustomerReportFilterVisible(false);
    }, [activeTab, filterStartDate, filterEndDate, selectedYear, sortConfig]);
    
    const requestSort = (key: string) => {
        let order: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.order === 'asc') {
            order = 'desc';
        }
        setSortConfig({ key, order });
    };

    // --- START P&L LOGIC ---
    const [pnlFilterType, setPnlFilterType] = useState<'month' | 'year'>('month');
    const [pnlSelectedMonth, setPnlSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [pnlSelectedYear, setPnlSelectedYear] = useState(new Date().getFullYear());

    const { pnlStartDate, pnlEndDate } = useMemo(() => {
        if (pnlFilterType === 'year') {
            return { pnlStartDate: `${pnlSelectedYear}-01-01`, pnlEndDate: `${pnlSelectedYear}-12-31` };
        }
        const year = parseInt(pnlSelectedMonth.slice(0, 4));
        const month = parseInt(pnlSelectedMonth.slice(5, 7));
        const firstDay = new Date(year, month - 1, 1).toISOString().slice(0, 10);
        const lastDay = new Date(year, month, 0).toISOString().slice(0, 10);
        return { pnlStartDate: firstDay, pnlEndDate: lastDay };
    }, [pnlFilterType, pnlSelectedMonth, pnlSelectedYear]);
    
    const pnlFilteredReceivables = useMemo(() => receivables.filter(r => r.payments && r.payments.some(p => p.date >= pnlStartDate && p.date <= pnlEndDate)), [receivables, pnlStartDate, pnlEndDate]);
    const pnlFilteredExpenses = useMemo(() => expenses.filter(e => e.date >= pnlStartDate && e.date <= pnlEndDate), [expenses, pnlStartDate, pnlEndDate]);
    const pnlFilteredLegacyIncomes = useMemo(() => legacyMonthlyIncomes.filter(i => i.month_date >= pnlStartDate && i.month_date <= pnlEndDate), [legacyMonthlyIncomes, pnlStartDate, pnlEndDate]);
    const pnlFilteredLegacyExpenses = useMemo(() => legacyMonthlyExpenses.filter(e => e.month_date >= pnlStartDate && e.month_date <= pnlEndDate), [legacyMonthlyExpenses, pnlStartDate, pnlEndDate]);

    const pnlSummary = useMemo(() => {
        const newSystemIncome = pnlFilteredReceivables.reduce((sum, r) => {
            const paymentsInPeriod = r.payments?.filter(p => p.date >= pnlStartDate && p.date <= pnlEndDate) || [];
            return sum + paymentsInPeriod.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);
        const totalLegacyIncome = pnlFilteredLegacyIncomes.reduce((sum, item) => sum + item.amount, 0);
        const totalIncome = newSystemIncome + totalLegacyIncome;
        
        const totalExpenses = pnlFilteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalLegacyExpense = pnlFilteredLegacyExpenses.reduce((sum, item) => sum + item.amount, 0);
        const totalExpense = totalExpenses + totalLegacyExpense;
        
        return { totalSales: totalIncome, totalExpenses: totalExpense, profit: totalIncome - totalExpense };
    }, [pnlFilteredReceivables, pnlFilteredExpenses, pnlFilteredLegacyIncomes, pnlFilteredLegacyExpenses, pnlStartDate, pnlEndDate]);

     const pnlIncomeTableData = useMemo(() => {
        const incomeByCategory = new Map<string, number>();
        const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = { 'End Customer': 'endCustomer', 'Retail': 'retail', 'Grosir': 'grosir', 'Reseller': 'reseller', 'Corporate': 'corporate' };
        
        // This calculation is complex and needs to allocate payments to categories, which is not directly possible.
        // For simplicity, we'll sum up all payments as "Penjualan Sistem Baru".
        const totalNewSystemIncome = pnlFilteredReceivables.reduce((sum, r) => {
             const paymentsInPeriod = r.payments?.filter(p => p.date >= pnlStartDate && p.date <= pnlEndDate) || [];
             return sum + paymentsInPeriod.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);
        if (totalNewSystemIncome > 0) {
            incomeByCategory.set('Penjualan (Sistem Baru)', totalNewSystemIncome);
        }
        
        if(pnlFilteredLegacyIncomes.length > 0){
            const legacySum = pnlFilteredLegacyIncomes.reduce((sum, item) => sum + item.amount, 0);
            incomeByCategory.set('Pemasukan Data Lama', legacySum);
        }
        
        return Array.from(incomeByCategory.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredReceivables, pnlFilteredLegacyIncomes, pnlStartDate, pnlEndDate]);

    const pnlExpenseTableData = useMemo(() => {
        const data = new Map<string, number>();
        pnlFilteredExpenses.forEach(exp => { data.set(exp.category, (data.get(exp.category) || 0) + exp.amount); });
         if(pnlFilteredLegacyExpenses.length > 0){
            const legacySum = pnlFilteredLegacyExpenses.reduce((sum, item) => sum + item.amount, 0);
            data.set('Pengeluaran Data Lama', legacySum);
        }
        return Array.from(data.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredExpenses, pnlFilteredLegacyExpenses]);

    const pnlChartData = useMemo(() => {
        if (pnlFilterType === 'month') {
            const daysInMonth = new Date(parseInt(pnlSelectedMonth.slice(0, 4)), parseInt(pnlSelectedMonth.slice(5, 7)), 0).getDate();
            const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ name: `${i + 1}`, Pendapatan: 0, Pengeluaran: 0 }));
            
            // Pendapatan
            pnlFilteredReceivables.forEach(r => r.payments?.forEach(p => { if (p.date >= pnlStartDate && p.date <= pnlEndDate) { const day = new Date(p.date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pendapatan += p.amount; }}));
            pnlFilteredLegacyIncomes.forEach(i => { const day = new Date(i.month_date).getUTCDate() -1; if(dailyData[day]) dailyData[day].Pendapatan += i.amount; });
            
            // Pengeluaran
            pnlFilteredExpenses.forEach(e => { const day = new Date(e.date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pengeluaran += e.amount; });
            pnlFilteredLegacyExpenses.forEach(e => { const day = new Date(e.month_date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pengeluaran += e.amount; });

            return dailyData;
        } else {
            const monthlyData = Array.from({length: 12}, (_, i) => ({ name: new Date(0, i).toLocaleString('id-ID', {month: 'short'}), Pendapatan: 0, Pengeluaran: 0 }));
            
            // Pendapatan
            pnlFilteredReceivables.forEach(r => r.payments?.forEach(p => { if (p.date >= pnlStartDate && p.date <= pnlEndDate) { const month = new Date(p.date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pendapatan += p.amount; }}));
            pnlFilteredLegacyIncomes.forEach(i => { const month = new Date(i.month_date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pendapatan += i.amount; });

            // Pengeluaran
            pnlFilteredExpenses.forEach(e => { const month = new Date(e.date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pengeluaran += e.amount; });
            pnlFilteredLegacyExpenses.forEach(e => { const month = new Date(e.month_date).getUTCMonth(); if (monthlyData[month]) monthlyData[month].Pengeluaran += e.amount; });

            return monthlyData;
        }
    }, [pnlFilterType, pnlSelectedMonth, pnlSelectedYear, pnlFilteredReceivables, pnlFilteredExpenses, pnlFilteredLegacyIncomes, pnlFilteredLegacyExpenses, pnlStartDate, pnlEndDate]);
    
    // --- END P&L LOGIC ---

    const handleExport = () => {
        const dateRange = { startDate: filterStartDate, endDate: filterEndDate };
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
            case 'receivables':
                exportToExcel('receivables', filteredReceivablesData, dateRange);
                break;
            case 'inventory':
                // Inventory doesn't use date filter, so pass empty
                exportToExcel('inventory', filteredInventoryData, { startDate: '', endDate: '' });
                break;
            default:
                alert('Ekspor tidak tersedia untuk laporan ini.');
        }
    };

    const handlePrintReport = () => {
        if (activeTab !== 'sales' && activeTab !== 'receivables' && activeTab !== 'profitAndLoss') {
            return;
        }

        const reportTitle = 
            activeTab === 'sales' ? 'Laporan Penjualan' : 
            activeTab === 'receivables' ? 'Laporan Piutang' : 
            'Laporan Laba Rugi';
        
        const period = activeTab === 'profitAndLoss' ? 
            (pnlFilterType === 'month' ? `Periode: ${new Date(pnlSelectedMonth + '-02').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}` : `Periode: Tahun ${pnlSelectedYear}`)
            : `Periode: ${new Date(filterStartDate).toLocaleDateString('id-ID')} - ${new Date(filterEndDate).toLocaleDateString('id-ID')}`;

        const headerHtml = `
            <div class="header">
                <div>
                    <h2>Nala Media Digital Printing</h2>
                    <p style="font-size:8pt; margin:0;">Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar</p>
                    <p style="font-size:8pt; margin:0;">Telp/WA: 0813-9872-7722</p>
                </div>
                <h1>${reportTitle}</h1>
            </div>
            <hr>
            <div class="customer-info">
                <strong>&nbsp;</strong>
                <span>${period}</span>
            </div>
            <hr>
        `;

        let tableHtml = '';
        let summaryHtml = '';

        if (activeTab === 'sales') {
            const allDetailedSales = sortedDetailedSalesData.map(item => `
                <tr>
                    <td>${item.no}</td>
                    <td>${item.tanggal}</td>
                    <td>${item.noNota}</td>
                    <td>${item.pelanggan}</td>
                    <td>${item.deskripsi}</td>
                    <td>${item.bahan}</td>
                    <td>${item.p}</td>
                    <td>${item.l}</td>
                    <td>${item.qty}</td>
                    <td class="currency">${formatCurrency(item.total)}</td>
                    <td>${item.status}</td>
                </tr>
            `).join('');

            const totalSales = filteredSalesData.reduce((sum, order) => sum + order.totalPrice, 0);

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
                    <tbody>${allDetailedSales}</tbody>
                </table>
            `;
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 250px; float: right; border: none;">
                        <tr><td style="border:none;">Total Penjualan:</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalSales)}</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'receivables') {
            const tableRows = filteredReceivablesData.map((r, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${r.id}</td>
                    <td>${r.customer}</td>
                    <td class="currency">${formatCurrency(r.amount)}</td>
                    <td class="currency">${formatCurrency(r.paid)}</td>
                    <td class="currency">${formatCurrency(r.remaining)}</td>
                    <td>${r.paymentStatus}</td>
                    <td>${r.productionStatus}</td>
                    <td>${formatDate(r.due)}</td>
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
                            <th>Status Bayar</th>
                            <th>Status Produksi</th>
                            <th>Jatuh Tempo</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            `;
            summaryHtml = `
                 <div class="summary-box">
                    <table style="width: 250px; float: right; border: none;">
                        <tr><td style="border:none;">Total Sisa Tagihan:</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalRemaining)}</strong></td></tr>
                    </table>
                </div>
            `;
        } else if (activeTab === 'profitAndLoss') {
            const incomeRows = pnlIncomeTableData.map(item => `<tr><td>${item.name}</td><td class="currency">${formatCurrency(item.total)}</td></tr>`).join('');
            const expenseRows = pnlExpenseTableData.map(item => `<tr><td>${item.name}</td><td class="currency">(${formatCurrency(item.total)})</td></tr>`).join('');

            tableHtml = `
                <div class="pnl-container">
                    <div class="pnl-column">
                        <h3>Pendapatan</h3>
                        <table>
                            <thead><tr><th>Kategori</th><th class="currency">Total</th></tr></thead>
                            <tbody>${incomeRows}</tbody>
                            <tfoot><tr><th>TOTAL PENDAPATAN</th><th class="currency">${formatCurrency(pnlSummary.totalSales)}</th></tr></tfoot>
                        </table>
                    </div>
                    <div class="pnl-column">
                        <h3>Pengeluaran</h3>
                        <table>
                            <thead><tr><th>Kategori</th><th class="currency">Total</th></tr></thead>
                            <tbody>${expenseRows}</tbody>
                             <tfoot><tr><th>TOTAL PENGELUARAN</th><th class="currency">${formatCurrency(pnlSummary.totalExpenses)}</th></tr></tfoot>
                        </table>
                    </div>
                </div>
            `;
            summaryHtml = `
                <div class="summary-box pnl-summary">
                    <strong>Laba Rugi:</strong>
                    <strong>${formatCurrency(pnlSummary.profit)}</strong>
                </div>
            `;
        }
        
        const printContent = `
            <html>
                <head>
                    <title>${reportTitle}</title>
                    <style>
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
                        .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                        .header, .customer-info { display: flex; justify-content: space-between; align-items: flex-start; }
                        .header h1 { font-size: 16pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #555; }
                        hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; }
                        th, tfoot th { background-color: #f2f2f2; }
                        tfoot { font-weight: bold; }
                        .currency { text-align: right; }
                        .summary-box { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; }
                        .print-button-container { position: fixed; top: 20px; right: 20px; text-align: center; z-index: 100; }
                        .print-button-container button { background-color: #ec4899; color: white; font-weight: bold; padding: 8px 24px; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
                        .pnl-container { display: flex; gap: 20px; align-items: flex-start; }
                        .pnl-column { flex: 1; }
                        .pnl-summary { text-align: center; font-size: 14pt; padding: 10px; background-color: #f2f2f2; display: flex; justify-content: space-between; }
                        @media print { 
                            .page { margin: 0; border: initial; border-radius: initial; width: initial; min-height: initial; box-shadow: initial; background: initial; page-break-after: always; }
                            .print-button-container { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="page">
                        ${headerHtml}
                        ${tableHtml}
                        ${summaryHtml}
                    </div>
                    <div class="print-button-container">
                        <button onclick="window.print()">Cetak atau Simpan PDF</button>
                    </div>
                </body>
            </html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
        }
    };
    
    // --- FINAL RECAP CALCULATIONS ---
    const finalRecapData = useMemo(() => {
        const totalLegacyIncome = legacyMonthlyIncomes.reduce((sum, i) => sum + i.amount, 0);
        const totalLegacyExpense = legacyMonthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
        
        const newSystemIncome = receivables.reduce((sum, r) => {
            const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
            return sum + totalPaid;
        }, 0);
        
        const newSystemExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

        const totalIncome = totalLegacyIncome + newSystemIncome;
        const totalExpense = totalLegacyExpense + newSystemExpense;
        const finalBalance = totalIncome - totalExpense;

        const totalPiutangLegacy = legacyReceivables.reduce((sum, r) => sum + r.amount, 0);
        const totalPiutangNew = receivables
            .filter(r => r.paymentStatus === 'Belum Lunas')
            .reduce((sum, r) => {
                const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - totalPaid;
                return sum + (remaining > 0 ? remaining : 0);
            }, 0);
        const totalPiutang = totalPiutangLegacy + totalPiutangNew;
        
        const ordersThisYear = allOrders.filter(o => new Date(o.orderDate).getFullYear() === selectedYear);
        const expensesThisYear = expenses.filter(e => new Date(e.date).getFullYear() === selectedYear).reduce((sum, e) => sum + e.amount, 0);
        
        const ordersThisYearIds = new Set(ordersThisYear.map(o => o.id));
        const totalSalesThisYear = ordersThisYear.reduce((sum, o) => sum + o.totalPrice, 0);

        const receivablesThisYearAmount = receivables
            .filter(r => ordersThisYearIds.has(r.id) && r.paymentStatus === 'Belum Lunas')
            .reduce((sum, r) => {
                const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - totalPaid;
                return sum + (remaining > 0 ? remaining : 0);
            }, 0);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthlyIncomeData = monthNames.map(name => ({ name, 'Total Pemasukan': 0 }));

        // Sum payments from new system
        receivables.forEach(r => {
            r.payments?.forEach(p => {
                const paymentDate = new Date(p.date);
                if (paymentDate.getFullYear() === selectedYear) {
                    const monthIndex = paymentDate.getMonth();
                    monthlyIncomeData[monthIndex]['Total Pemasukan'] += p.amount;
                }
            });
        });

        // Sum legacy income
        legacyMonthlyIncomes.forEach(i => {
            const incomeDate = new Date(i.month_date);
             if (incomeDate.getFullYear() === selectedYear) {
                const monthIndex = incomeDate.getMonth();
                monthlyIncomeData[monthIndex]['Total Pemasukan'] += i.amount;
            }
        });

        return {
            totalIncome, totalExpense, finalBalance, totalPiutang,
            expensesThisYear, ordersThisYear: ordersThisYear.length,
            receivablesThisYearAmount, totalSalesThisYear,
            chartData: monthlyIncomeData
        };
    }, [receivables, expenses, allOrders, legacyMonthlyIncomes, legacyMonthlyExpenses, legacyReceivables, selectedYear]);


    // --- FILTERED DATA FOR OTHER TABS ---

    const filteredSalesData = useMemo(() => {
        return allOrders
            .filter(order => {
                if (order.orderDate < filterStartDate || order.orderDate > filterEndDate) return false;
                if (filterCustomer && order.customer !== filterCustomer) return false;
                return true;
            });
    }, [allOrders, filterStartDate, filterEndDate, filterCustomer]);
    
    const allDetailedSalesData = useMemo(() => {
        const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
            'End Customer': 'endCustomer', 'Retail': 'retail', 'Grosir': 'grosir', 'Reseller': 'reseller', 'Corporate': 'corporate'
        };
        const calculateItemPrice = (item: OrderItemData, orderCustomer: string): number => {
            const customerData = customers.find(c => c.name === orderCustomer);
            const customerLevel = customerData ? customerData.level : 'End Customer';
            const priceKey = priceLevelMap[customerLevel];
            if (!item.productId) return 0;
            const productInfo = products.find(p => p.id === item.productId);
            const finishingInfo = finishings.find(f => f.name === item.finishing);
            if (!productInfo) return 0;
            const categoryInfo = categories.find(c => c.name === productInfo.category);
            const isAreaBased = categoryInfo?.unitType === 'Per Luas';
            let materialPrice = (productInfo.price[priceKey] || productInfo.price.endCustomer);
            const finishingPrice = finishingInfo ? finishingInfo.price : 0;
            let priceMultiplier = 1;
            if (isAreaBased) {
                const length = parseFloat(item.length) || 0;
                const width = parseFloat(item.width) || 0;
                priceMultiplier = length * width;
            }
            const baseItemPrice = materialPrice + finishingPrice;
            return (baseItemPrice * priceMultiplier) * item.qty;
        };

        return filteredSalesData.flatMap(order => {
            const unroundedOrderTotal = order.orderItems.reduce((sum, item) => sum + calculateItemPrice(item, order.customer), 0);
            const roundingDifference = order.totalPrice - unroundedOrderTotal;

            return order.orderItems.map((item, index) => {
                const product = products.find(p => p.id === item.productId);
                const receivable = receivables.find(r => r.id === order.id);
                let itemTotal = calculateItemPrice(item, order.customer);

                if (index === order.orderItems.length - 1) {
                    itemTotal += roundingDifference;
                }
                
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
                    status: receivable ? receivable.paymentStatus : 'Belum Diproses'
                };
            })
        });
    }, [filteredSalesData, products, categories, customers, finishings, receivables]);
    
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


    const filteredReceivablesData = useMemo(() => {
        return receivables
            .filter(receivable => {
                const order = allOrders.find(o => o.id === receivable.id);
                if (!order || order.orderDate < filterStartDate || order.orderDate > filterEndDate) return false;
                if (filterCustomer && receivable.customer !== filterCustomer) return false;
                return true;
            })
            .map(r => {
                const paid = r.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - paid;
                return { ...r, paid, remaining };
            })
            .sort((a, b) => b.id.localeCompare(a.id));
    }, [receivables, allOrders, filterStartDate, filterEndDate, filterCustomer]);
    
    const paginatedReceivables = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredReceivablesData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredReceivablesData, currentPage]);
    
    const filteredInventoryData = useMemo(() => {
        return inventory.map(item => ({
            ...item,
            status: item.stock <= notificationSettings.lowStockThreshold ? 'Stok Menipis' : 'Tersedia'
        }));
    }, [inventory, notificationSettings]);

    const paginatedInventory = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredInventoryData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredInventoryData, currentPage]);

    const handlePrintCustomerSpecificReport = (reportType: 'sales' | 'receivables') => {
        if (!filterCustomer) {
            alert("Silakan pilih pelanggan terlebih dahulu untuk mencetak laporan.");
            return;
        }

        const reportPeriod = `Periode: ${filterStartDate ? new Date(filterStartDate).toLocaleDateString('id-ID') : '...'} - ${filterEndDate ? new Date(filterEndDate).toLocaleDateString('id-ID') : '...'}`;
        let tableRows = '';
        let summaryHtml = '';
        let reportTitle = '';
        let tableHeaders = '';

        if (reportType === 'sales') {
            reportTitle = 'Laporan Penjualan Pelanggan';
            const reportItems = filteredSalesData;
            const totalNota = reportItems.length;
            const totalItems = reportItems.reduce((sum, order) => sum + order.orderItems.length, 0);
            const totalPenjualan = reportItems.reduce((sum, order) => sum + order.totalPrice, 0);

            tableHeaders = `
                <tr>
                    <th>Total Nota</th>
                    <th>Total Item</th>
                    <th class="currency">Total Penjualan</th>
                </tr>`;
            
            tableRows = `
                <tr>
                    <td>${totalNota} Nota</td>
                    <td>${totalItems} Item</td>
                    <td class="currency">${formatCurrency(totalPenjualan)}</td>
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
                const fullOrder = allOrders.find(o => o.id === receivable.id);
                if (!fullOrder) return [];
        
                return fullOrder.orderItems.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const isFirstItem = index === 0;
        
                    return `
                        <tr>
                            ${isFirstItem ? `<td rowSpan="${fullOrder.orderItems.length}">${receivable.id}</td>` : ''}
                            <td>${item.description || product?.name || 'N/A'}</td>
                            <td>${item.qty} Pcs</td>
                            ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.amount)}</td>` : ''}
                            ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.paid)}</td>` : ''}
                            ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.remaining)}</td>` : ''}
                            ${isFirstItem ? `<td rowSpan="${fullOrder.orderItems.length}">${formatDate(receivable.due)}</td>` : ''}
                        </tr>
                    `;
                }).join('');
            }).join('');

            const totalSisa = reportItems.reduce((sum, r) => sum + r.remaining, 0);
            summaryHtml = `
                <div class="summary-box">
                    <table style="width: 250px; float: right; border: none;">
                        <tr><td style="border:none;">Total Sisa Tagihan:</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalSisa)}</strong></td></tr>
                    </table>
                </div>`;
        }

        const printContent = `
            <html>
                <head>
                    <title>${reportTitle} - ${filterCustomer}</title>
                    <style>
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
                        .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                        .header, .customer-info, .summary { display: flex; justify-content: space-between; align-items: flex-start; }
                        .header h1 { font-size: 16pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #555; }
                        hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; vertical-align: top; }
                        th { background-color: #f2f2f2; }
                        .currency { text-align: right; }
                        .summary-box { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; }
                        @media print { .page { margin: 0; border: initial; border-radius: initial; width: initial; min-height: initial; box-shadow: initial; background: initial; page-break-after: always; } }
                    </style>
                </head>
                <body>
                    <div class="page">
                        <div class="header">
                            <div>
                                <h2>Nala Media Digital Printing</h2>
                                <p style="font-size:8pt; margin:0;">Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar</p>
                                <p style="font-size:8pt; margin:0;">Telp/WA: 0813-9872-7722</p>
                            </div>
                            <h1>${reportTitle}</h1>
                        </div>
                        <hr>
                        <div class="customer-info">
                            <strong>${filterCustomer}</strong>
                            <span>${reportPeriod}</span>
                        </div>
                        <hr>
                        <table>
                            <thead>
                               ${tableHeaders}
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                        ${summaryHtml}
                        <div style="clear: both; margin-top: 40px; font-size: 9pt;">
                            <hr>
                            <strong>Informasi Pembayaran:</strong><br>
                            Transfer Bank ke rekening BCA 0154-361801, BRI 6707-01-02-8864-537, atau BPD JATENG 3142069325 a/n Ariska Prima Diastari.
                        </div>
                    </div>
                </body>
            </html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(printContent);
          printWindow.document.close();
          printWindow.focus();
        }
    };

    // --- RENDER METHODS FOR TABS ---

    const renderFinalRecap = () => (
        <div className="space-y-8">
            <div className="flex justify-end">
                <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="p-2 border rounded-md bg-white text-sm"
                >
                    {years.map(year => <option key={year} value={year}>Tahun {year}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ProminentStatCard icon={<ShoppingCartIcon />} title={`Penjualan (${selectedYear})`} value={formatCurrency(finalRecapData.totalSalesThisYear)} gradient="bg-gradient-to-br from-violet-500 to-purple-500" />
                <ProminentStatCard icon={<CreditCardIcon />} title={`Piutang (${selectedYear})`} value={formatCurrency(finalRecapData.receivablesThisYearAmount)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                <ProminentStatCard icon={<ReceiptTaxIcon />} title={`Pengeluaran (${selectedYear})`} value={formatCurrency(finalRecapData.expensesThisYear)} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                <ProminentStatCard icon={<CurrencyDollarIcon />} title="Saldo Akhir (Estimasi)" value={formatCurrency(finalRecapData.finalBalance)} gradient="bg-gradient-to-br from-cyan-500 to-blue-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border h-full">
                        <h4 className="font-bold text-lg mb-2">Rincian Keuangan (Keseluruhan)</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Total Pemasukan</span><span className="font-semibold text-green-600">{formatCurrency(finalRecapData.totalIncome)}</span></div>
                            <div className="flex justify-between"><span>Total Pengeluaran</span><span className="font-semibold text-red-600">{formatCurrency(finalRecapData.totalExpense)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Saldo</span><span className="text-blue-600">{formatCurrency(finalRecapData.finalBalance)}</span></div>
                        </div>
                         <div className="space-y-2 text-sm mt-4">
                            <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Piutang</span><span className="text-amber-600">{formatCurrency(finalRecapData.totalPiutang)}</span></div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-3 h-96">
                     <h4 className="font-bold text-lg mb-2">{`Grafik Pemasukan Bulanan (${selectedYear})`}</h4>
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={finalRecapData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="recapGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `Rp ${Number(value)/1000000} Jt`}/>
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.5rem' }} formatter={(value: number) => formatCurrency(value)}/>
                            <Area type="monotone" dataKey="Total Pemasukan" stroke="#82ca9d" strokeWidth={2} fillOpacity={1} fill="url(#recapGradient)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
    
    const renderProfitAndLoss = () => (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
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
                </div>
                <ProminentStatCard 
                    icon={<ChartBarIcon />} 
                    title="Laba / Rugi" 
                    value={formatCurrency(pnlSummary.profit)} 
                    gradient={pnlSummary.profit >= 0 ? "bg-gradient-to-br from-green-500 to-emerald-500" : "bg-gradient-to-br from-rose-500 to-red-500"}
                />
            </div>
             <div className="h-96">
                <h4 className="font-bold text-lg mb-2">Grafik Laba Rugi</h4>
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
                    <h4 className="font-bold text-lg mb-2 text-green-700">Rincian Pendapatan</h4>
                    <div className="border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Kategori</th><th className="p-2 text-right">Total</th></tr></thead><tbody className="divide-y">{pnlIncomeTableData.map(item => (<tr key={item.name}>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                    </tr>))}</tbody><tfoot className="bg-gray-100 font-bold"><tr><td className="p-2">Total Pendapatan</td><td className="p-2 text-right">{formatCurrency(pnlSummary.totalSales)}</td></tr></tfoot></table></div>
                </div>
                 <div>
                    <h4 className="font-bold text-lg mb-2 text-red-700">Rincian Pengeluaran</h4>
                    <div className="border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-left">Kategori</th><th className="p-2 text-right">Total</th></tr></thead><tbody className="divide-y">{pnlExpenseTableData.map(item => (<tr key={item.name}>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                    </tr>))}</tbody><tfoot className="bg-gray-100 font-bold"><tr><td className="p-2">Total Pengeluaran</td><td className="p-2 text-right">{formatCurrency(pnlSummary.totalExpenses)}</td></tr></tfoot></table></div>
                </div>
            </div>
        </div>
    );
    
    const renderSales = () => {
        const totalSales = filteredSalesData.reduce((sum, order) => sum + order.totalPrice, 0);
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <ReportStatCard icon={<CurrencyDollarIcon />} title="Total Penjualan" value={formatCurrency(totalSales)} gradient="bg-gradient-to-br from-green-500 to-emerald-500" />
                     <ReportStatCard icon={<ShoppingCartIcon />} title="Jumlah Transaksi" value={totalTransactions.toString()} gradient="bg-gradient-to-br from-blue-500 to-sky-500" />
                     <ReportStatCard icon={<CubeIcon />} title="Total Item Terjual" value={totalItems.toString()} gradient="bg-gradient-to-br from-amber-500 to-yellow-500" />
                     <ReportStatCard icon={<ChartBarIcon />} title="Rata-rata/Transaksi" value={formatCurrency(avgTransaction)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                </div>
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

    const renderReceivables = () => {
        const totalRemaining = filteredReceivablesData.reduce((sum, r) => sum + r.remaining, 0);

        return (
            <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <ReportStatCard icon={<ReceiptTaxIcon />} title="Total Sisa Tagihan" value={formatCurrency(totalRemaining)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title="Jumlah Nota Belum Lunas" value={filteredReceivablesData.filter(r => r.paymentStatus === 'Belum Lunas').length.toString()} gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500" />
                 </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Piutang</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left">No. Nota</th>
                                    <th className="py-2 px-3 text-left">Pelanggan</th>
                                    <th className="py-2 px-3 text-right">Sisa Tagihan</th>
                                    <th className="py-2 px-3 text-center">Status Produksi</th>
                                    <th className="py-2 px-3 text-left">Jatuh Tempo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedReceivables.map(r => (
                                    <tr key={r.id}>
                                        <td className="py-2 px-3">{r.id}</td>
                                        <td className="py-2 px-3">{r.customer}</td>
                                        <td className="py-2 px-3 text-right font-semibold">{formatCurrency(r.remaining)}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full`}>
                                                {r.productionStatus}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3">{formatDate(r.due)}</td>
                                    </tr>
                                ))}
                                 {paginatedReceivables.length === 0 && (
                                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">Tidak ada data piutang pada periode ini.</td></tr>
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
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <ReportStatCard icon={<CubeIcon />} title="Total Jenis Item" value={totalItems.toString()} gradient="bg-gradient-to-br from-indigo-500 to-violet-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title="Item Stok Menipis" value={lowStockItems.toString()} gradient="bg-gradient-to-br from-red-500 to-rose-500" />
                </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Stok Inventori</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left">Nama Item</th>
                                    <th className="py-2 px-3 text-right">Stok Saat Ini</th>
                                    <th className="py-2 px-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {paginatedInventory.map(i => (
                                    <tr key={i.id}>
                                        <td className="py-2 px-3">{i.name}</td>
                                        <td className="py-2 px-3 text-right font-semibold">{`${i.stock} ${i.unit}`}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${i.stock <= notificationSettings.lowStockThreshold ? 'bg-red-100 text-red-800' : 'bg-cyan-100 text-cyan-800'}`}>
                                                {i.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
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
    
    const renderDataPenjualanLama = () => (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <MonthlyLegacyDataForm
                    title="Pemasukan Bulanan Lama"
                    data={legacyMonthlyIncomes}
                    onSave={onAddLegacyMonthlyIncome}
                    onUpdate={onUpdateLegacyMonthlyIncome}
                    onDelete={onDeleteLegacyMonthlyIncome}
                />
                <MonthlyLegacyDataForm
                    title="Pengeluaran Bulanan Lama"
                    data={legacyMonthlyExpenses}
                    onSave={onAddLegacyMonthlyExpense}
                    onUpdate={onUpdateLegacyMonthlyExpense}
                    onDelete={onDeleteLegacyMonthlyExpense}
                />
            </div>
        </div>
    );

    const renderDataPiutangLama = () => (
         <LegacyReceivableForm 
            customers={customers}
            legacyReceivables={legacyReceivables}
            onSave={onAddLegacyReceivable}
            onUpdate={onUpdateLegacyReceivable}
            onDelete={onDeleteLegacyReceivable}
        />
    );
    
    const renderContent = () => {
        switch (activeTab) {
            case 'finalRecap': return renderFinalRecap();
            case 'profitAndLoss': return renderProfitAndLoss();
            case 'sales': return renderSales();
            case 'receivables': return renderReceivables();
            case 'inventory': return renderInventory();
            case 'assetsDebts': return <AssetsAndDebts assets={assets} debts={debts} onAddAsset={onAddAsset} onAddDebt={onAddDebt} />;
            case 'dataPenjualanLama': return renderDataPenjualanLama();
            case 'dataPiutangLama': return renderDataPiutangLama();
            default:
                return <div className="text-center py-16 text-gray-500"><p>Laporan "{TABS.find(t => t.key === activeTab)?.label}" sedang dalam pengembangan.</p></div>;
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Laporan</h2>
                    <div className="flex items-center space-x-2">
                        {['sales', 'receivables', 'inventory', 'profitAndLoss'].includes(activeTab) && (
                            <div className="flex space-x-2">
                                <button 
                                    onClick={handlePrintReport} 
                                    className="flex items-center text-sm bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <PrinterIcon className="h-4 w-4 mr-2" />
                                    Cetak
                                </button>
                                <button 
                                    onClick={handleExport}
                                    className="flex items-center text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                    Ekspor
                                </button>
                            </div>
                        )}
                        {['sales', 'receivables'].includes(activeTab) && (
                             <button 
                                onClick={() => setIsCustomerReportFilterVisible(!isCustomerReportFilterVisible)}
                                className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold"
                            >
                                <FilterIcon className="h-4 w-4" />
                                <span>Filter Laporan</span>
                            </button>
                        )}
                    </div>
                </div>

                 {isCustomerReportFilterVisible && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4 border">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="p-2 border rounded-md bg-white text-sm">
                                <option value="">Pilih Pelanggan</option>
                                {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" />
                            <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" />
                            {filterCustomer && (
                                <button
                                    onClick={() => handlePrintCustomerSpecificReport(activeTab as 'sales' | 'receivables')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 w-full"
                                >
                                    Cetak Laporan Pelanggan
                                </button>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                         {accessibleTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`${ activeTab === tab.key ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                            >
                                {tab.label}
                            </button>
                         ))}
                    </nav>
                </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md">
                {renderContent()}
            </div>
        </div>
    );
};

export default Reports;
