
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { type SavedOrder, type ExpenseItem, type ReceivableItem, type ProductData, type CustomerData, type InventoryItem, type LegacyIncome, type LegacyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type CategoryData, type FinishingData, type ReportsProps, type OrderItemData } from '../types';
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
];


const LegacyIncomeForm: React.FC<{ data: LegacyIncome | null; onSave: (data: LegacyIncome | null) => void; }> = ({ data, onSave }) => {
    const [amount, setAmount] = useState(data?.amount.toString() || '');
    const [lastDate, setLastDate] = useState(data?.lastDate || '');

    useEffect(() => {
        setAmount(data?.amount.toString() || '');
        setLastDate(data?.lastDate || '');
    }, [data]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ amount: Number(amount), lastDate });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-semibold text-gray-700">Total Pemasukan Data Lama</h4>
            <div>
                <label className="block text-sm font-medium">Tanggal Pemasukan Terakhir</label>
                <input type="date" value={lastDate} onChange={e => setLastDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
            </div>
            <div>
                <label className="block text-sm font-medium">Nominal Pemasukan (Rp)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required placeholder="0" />
            </div>
            <div className="flex space-x-2">
                <button type="submit" className="w-full bg-cyan-600 text-white py-2 rounded-lg font-semibold hover:bg-cyan-700">Simpan</button>
                {data && <button type="button" onClick={() => onSave(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Hapus Data</button>}
            </div>
        </form>
    );
};

const LegacyExpenseForm: React.FC<{ data: LegacyExpense | null; onSave: (data: LegacyExpense | null) => void; }> = ({ data, onSave }) => {
    const [amount, setAmount] = useState(data?.amount.toString() || '');
    const [lastDate, setLastDate] = useState(data?.lastDate || '');
    
     useEffect(() => {
        setAmount(data?.amount.toString() || '');
        setLastDate(data?.lastDate || '');
    }, [data]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ amount: Number(amount), lastDate });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-semibold text-gray-700">Total Pengeluaran Data Lama</h4>
            <div>
                <label className="block text-sm font-medium">Tanggal Pengeluaran Terakhir</label>
                <input type="date" value={lastDate} onChange={e => setLastDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
            </div>
            <div>
                <label className="block text-sm font-medium">Nominal Pengeluaran (Rp)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required placeholder="0"/>
            </div>
            <div className="flex space-x-2">
                <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700">Simpan</button>
                 {data && <button type="button" onClick={() => onSave(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Hapus Data</button>}
            </div>
        </form>
    );
};

const LegacyReceivableForm: React.FC<{
    customers: CustomerData[];
    legacyReceivables: LegacyReceivable[];
    onSave: (data: Omit<LegacyReceivable, 'id'>) => void;
    onEdit: (item: LegacyReceivable) => void;
    onDelete: (id: number) => void;
    onSettle: (item: LegacyReceivable) => void;
}> = ({ customers, legacyReceivables, onSave, onEdit, onDelete, onSettle }) => {
    const [customer, setCustomer] = useState(customers.length > 0 ? customers[0].name : '');
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
    const [amount, setAmount] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ customer, date, amount: Number(amount) });
        setCustomer(customers.length > 0 ? customers[0].name : '');
        setDate(new Date().toISOString().substring(0, 10));
        setAmount('');
    };
    
    const handleDeleteClick = (id: number) => {
        if (window.confirm("Apakah Anda yakin ingin menghapus data piutang lama ini? Tindakan ini tidak akan mempengaruhi pemasukan.")) {
            onDelete(id);
        }
    };
    
    const [editingItem, setEditingItem] = useState<LegacyReceivable | null>(null);

    useEffect(() => {
        if (editingItem) {
            setCustomer(editingItem.customer);
            setDate(editingItem.date);
            setAmount(editingItem.amount.toString());
        } else {
            setAmount('');
        }
    }, [editingItem]);
    
    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            onEdit({ ...editingItem, customer, date, amount: Number(amount) });
            setEditingItem(null);
        }
    };

    const handleSettle = (item: LegacyReceivable) => {
        if (window.confirm(`Anda akan melunasi piutang ${item.customer} sejumlah ${formatCurrency(item.amount)}? Ini akan tercatat sebagai pengeluaran baru.`)) {
            onSettle(item);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                 <form onSubmit={editingItem ? handleEditSubmit : handleSubmit} className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-700">{editingItem ? 'Edit Piutang Lama' : 'Tambah Piutang Pelanggan Lama'}</h4>
                     <div>
                        <label className="block text-sm font-medium">Pelanggan</label>
                        <select value={customer} onChange={e => setCustomer(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md" required>
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Tanggal</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Nominal Piutang (Rp)</label>
                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required placeholder="0"/>
                    </div>
                    <div className="flex space-x-2">
                        <button type="submit" className="w-full bg-amber-500 text-white py-2 rounded-lg font-semibold hover:bg-amber-600">{editingItem ? 'Update' : 'Simpan'}</button>
                        {editingItem && <button type="button" onClick={() => setEditingItem(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>}
                    </div>
                </form>
            </div>
            <div>
                <h4 className="font-semibold text-gray-700 mb-2">Daftar Piutang Lama</h4>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {legacyReceivables.map(item => (
                        <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-gray-800">{item.customer}</p>
                                <p className="text-sm text-red-600 font-bold">{formatCurrency(item.amount)}</p>
                                <p className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString('id-ID')}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => handleSettle(item)} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md hover:bg-green-200">Lunasi</button>
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

const Reports: React.FC<ReportsProps> = (props) => {
    const { 
    allOrders, expenses, receivables, products, customers, inventory, categories, finishings,
    menuPermissions, legacyIncome, legacyExpense, legacyReceivables, assets, debts, notificationSettings,
    onSetLegacyIncome, onSetLegacyExpense, onAddLegacyReceivable, onUpdateLegacyReceivable,
    onDeleteLegacyReceivable, onSettleLegacyReceivable, onAddAsset, onAddDebt
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

    const pnlFilteredOrders = useMemo(() => allOrders.filter(o => o.orderDate >= pnlStartDate && o.orderDate <= pnlEndDate), [allOrders, pnlStartDate, pnlEndDate]);
    const pnlFilteredExpenses = useMemo(() => expenses.filter(e => e.date >= pnlStartDate && e.date <= pnlEndDate), [expenses, pnlStartDate, pnlEndDate]);

    const pnlSummary = useMemo(() => {
        const totalSales = pnlFilteredOrders.reduce((sum, order) => sum + order.totalPrice, 0);
        const totalExpenses = pnlFilteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        return { totalSales, totalExpenses, profit: totalSales - totalExpenses };
    }, [pnlFilteredOrders, pnlFilteredExpenses]);

     const pnlIncomeTableData = useMemo(() => {
        const incomeByCategory = new Map<string, number>();
        const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = { 'End Customer': 'endCustomer', 'Retail': 'retail', 'Grosir': 'grosir', 'Reseller': 'reseller', 'Corporate': 'corporate' };
        
        pnlFilteredOrders.forEach(order => {
            const customerData = customers.find(c => c.name === order.customer);
            const customerLevel = customerData ? customerData.level : 'End Customer';
            const priceKey = priceLevelMap[customerLevel];
            let unroundedTotal = 0;

            const itemPrices = order.orderItems.map(item => {
                if (!item.productId) return { category: 'Lain-lain', price: 0 };
                const productInfo = products.find(p => p.id === item.productId);
                if (!productInfo) return { category: 'Lain-lain', price: 0 };
                const finishingInfo = finishings.find(f => f.name === item.finishing);
                const categoryInfo = categories.find(c => c.name === productInfo.category);
                const isAreaBased = categoryInfo?.unitType === 'Per Luas';
                let materialPrice = (productInfo.price[priceKey] || productInfo.price.endCustomer);
                const finishingPrice = finishingInfo ? finishingInfo.price : 0;
                let priceMultiplier = isAreaBased ? (parseFloat(item.length) || 0) * (parseFloat(item.width) || 0) : 1;
                const itemTotal = (materialPrice * priceMultiplier + finishingPrice) * item.qty;
                unroundedTotal += itemTotal;
                return { category: productInfo.category, price: itemTotal };
            });

            const roundingDifference = order.totalPrice - unroundedTotal;
            itemPrices.forEach(itemPrice => {
                let finalPrice = itemPrice.price;
                if (unroundedTotal > 0) finalPrice += (itemPrice.price / unroundedTotal) * roundingDifference;
                incomeByCategory.set(itemPrice.category, (incomeByCategory.get(itemPrice.category) || 0) + finalPrice);
            });
        });
        
        categories.forEach(cat => { if (!incomeByCategory.has(cat.name)) incomeByCategory.set(cat.name, 0); });
        return Array.from(incomeByCategory.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredOrders, products, categories, customers, finishings]);

    const pnlExpenseTableData = useMemo(() => {
        const data = new Map<string, number>();
        pnlFilteredExpenses.forEach(exp => { data.set(exp.category, (data.get(exp.category) || 0) + exp.amount); });
        return Array.from(data.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredExpenses]);

    const pnlSalesChartData = useMemo(() => {
        if (pnlFilterType === 'month') {
            const daysInMonth = new Date(parseInt(pnlSelectedMonth.slice(0, 4)), parseInt(pnlSelectedMonth.slice(5, 7)), 0).getDate();
            const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({ name: `${i + 1}`, Penjualan: 0 }));
            pnlFilteredOrders.forEach(order => {
                const day = new Date(order.orderDate).getUTCDate() - 1;
                if (dailyData[day]) dailyData[day].Penjualan += order.totalPrice;
            });
            return dailyData;
        } else {
            const monthlyData = [{ name: 'Jan', Penjualan: 0 }, { name: 'Feb', Penjualan: 0 }, { name: 'Mar', Penjualan: 0 }, { name: 'Apr', Penjualan: 0 }, { name: 'Mei', Penjualan: 0 }, { name: 'Jun', Penjualan: 0 }, { name: 'Jul', Penjualan: 0 }, { name: 'Ags', Penjualan: 0 }, { name: 'Sep', Penjualan: 0 }, { name: 'Okt', Penjualan: 0 }, { name: 'Nov', Penjualan: 0 }, { name: 'Des', Penjualan: 0 }];
            pnlFilteredOrders.forEach(order => {
                const month = new Date(order.orderDate).getUTCMonth();
                if (monthlyData[month]) monthlyData[month].Penjualan += order.totalPrice;
            });
            return monthlyData;
        }
    }, [pnlFilterType, pnlSelectedMonth, pnlSelectedYear, pnlFilteredOrders]);
    
    const pnlExpensePieData = useMemo(() => {
        const expenseByCategory = pnlFilteredExpenses.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
    }, [pnlFilteredExpenses]);

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
            const expenseRows = pnlExpenseTableData.map(item => `<tr><td>${item.name}</td><td class="currency">${formatCurrency(item.total)}</td></tr>`).join('');

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
        const totalLegacyIncome = legacyIncome?.amount || 0;
        const totalLegacyExpense = legacyExpense?.amount || 0;
        
        const newSystemIncome = receivables
            .filter(r => r.paymentStatus === 'Lunas')
            .reduce((sum, r) => sum + r.amount - (r.discount || 0), 0);
        
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
        
        const monthlyOrders: { [key: string]: number } = {
            'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'Mei': 0, 'Jun': 0, 
            'Jul': 0, 'Ags': 0, 'Sep': 0, 'Okt': 0, 'Nov': 0, 'Des': 0
        };
        const monthNames = Object.keys(monthlyOrders);
        
        ordersThisYear.forEach(order => {
            const monthName = monthNames[new Date(order.orderDate).getMonth()];
            if (monthName) {
                monthlyOrders[monthName]++;
            }
        });
        
        const chartData = Object.entries(monthlyOrders).map(([name, orders]) => ({ name, 'Total Order': orders }));

        return {
            totalIncome, totalExpense, finalBalance, totalPiutang,
            expensesThisYear, ordersThisYear: ordersThisYear.length,
            receivablesThisYearAmount, totalSalesThisYear,
            chartData
        };
    }, [receivables, expenses, allOrders, legacyIncome, legacyExpense, legacyReceivables, selectedYear]);


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
                     <h4 className="font-bold text-lg mb-2">{`Grafik Order Bulanan (${selectedYear})`}</h4>
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={finalRecapData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="recapGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.5rem' }} />
                            <Area type="monotone" dataKey="Total Order" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#recapGradient)" />
                        </AreaChart>
                    </ResponsiveContainer>
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
    
    const renderLegacyData = () => (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <LegacyIncomeForm data={legacyIncome} onSave={onSetLegacyIncome} />
                <LegacyExpenseForm data={legacyExpense} onSave={onSetLegacyExpense} />
            </div>
            <div className="mt-8 border-t pt-6">
                <LegacyReceivableForm customers={customers} legacyReceivables={legacyReceivables} onSave={onAddLegacyReceivable} onEdit={onUpdateLegacyReceivable} onDelete={onDeleteLegacyReceivable} onSettle={onSettleLegacyReceivable} />
            </div>
        </div>
    );

    const renderAssetsDebts = () => {
        const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
        const totalDebts = debts.reduce((sum, d) => sum + d.value, 0);
        
        const AssetDebtForm: React.FC<{ type: 'asset' | 'debt' }> = ({ type }) => {
            const [name, setName] = useState('');
            const [value, setValue] = useState('');
            const handleSubmit = (e: React.FormEvent) => {
                e.preventDefault();
                if (type === 'asset') onAddAsset({ name, value: Number(value) });
                else onAddDebt({ name, value: Number(value) });
                setName(''); setValue('');
            };
            return (
                <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                    <h4 className="font-semibold">{type === 'asset' ? 'Tambah Aset Baru' : 'Tambah Hutang Baru'}</h4>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Aset/Hutang" className="w-full p-2 border rounded" required />
                    <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="Nilai (Rp)" className="w-full p-2 border rounded" required />
                    <button type="submit" className={`w-full text-white py-2 rounded-lg font-semibold ${type === 'asset' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-red-600 hover:bg-red-700'}`}>Simpan</button>
                </form>
            );
        };

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div><h3 className="font-bold text-lg mb-2">Aset</h3><AssetDebtForm type="asset" /><div className="mt-4 space-y-2">{assets.map(a => (<div key={a.id} className="flex justify-between p-2 border-b"><span>{a.name}</span><span className="font-semibold">{formatCurrency(a.value)}</span></div>))}</div><div className="flex justify-between font-bold p-2 border-t mt-2"><span>Total Aset</span><span>{formatCurrency(totalAssets)}</span></div></div>
                <div><h3 className="font-bold text-lg mb-2">Hutang</h3><AssetDebtForm type="debt" /><div className="mt-4 space-y-2">{debts.map(d => (<div key={d.id} className="flex justify-between p-2 border-b"><span>{d.name}</span><span className="font-semibold">{formatCurrency(d.value)}</span></div>))}</div><div className="flex justify-between font-bold p-2 border-t mt-2"><span>Total Hutang</span><span>{formatCurrency(totalDebts)}</span></div></div>
            </div>
        );
    };
    
    const renderProfitAndLoss = () => {
        const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#d946ef', '#14b8a6'];
        
        return (
            <div className="space-y-8">
                <div className="flex justify-start items-center space-x-4">
                    <div className="flex items-center space-x-2"><input type="radio" id="pnl-month" name="pnl-filter" value="month" checked={pnlFilterType === 'month'} onChange={() => setPnlFilterType('month')} /><label htmlFor="pnl-month">Bulan</label><input type="month" value={pnlSelectedMonth} onChange={e => setPnlSelectedMonth(e.target.value)} disabled={pnlFilterType !== 'month'} className="p-2 border rounded-md text-sm text-gray-600" /></div>
                     <div className="flex items-center space-x-2"><input type="radio" id="pnl-year" name="pnl-filter" value="year" checked={pnlFilterType === 'year'} onChange={() => setPnlFilterType('year')} /><label htmlFor="pnl-year">Tahun</label><input type="number" value={pnlSelectedYear} onChange={e => setPnlSelectedYear(Number(e.target.value))} disabled={pnlFilterType !== 'year'} className="p-2 border rounded-md text-sm text-gray-600 w-28" placeholder="YYYY" /></div>
                </div>
    
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <ReportStatCard icon={<CurrencyDollarIcon />} title="Penjualan" value={formatCurrency(pnlSummary.totalSales)} gradient="bg-gradient-to-br from-green-500 to-emerald-500" />
                     <ReportStatCard icon={<ReceiptTaxIcon />} title="Pengeluaran" value={formatCurrency(pnlSummary.totalExpenses)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                     <ReportStatCard icon={<ChartBarIcon />} title="Laba Rugi" value={formatCurrency(pnlSummary.profit)} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                </div>
    
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-4 rounded-lg border h-96"><h3 className="font-bold text-gray-700 mb-4">Grafik Penjualan</h3><ResponsiveContainer width="100%" height="90%"><AreaChart data={pnlSalesChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><defs><linearGradient id="salesGradientPnl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `Rp${Number(value)/1000000} Jt`}/><Tooltip formatter={(value: number) => formatCurrency(value)}/><Area type="monotone" dataKey="Penjualan" stroke="#22c55e" strokeWidth={2} fill="url(#salesGradientPnl)" /></AreaChart></ResponsiveContainer></div>
                    <div className="bg-white p-4 rounded-lg border h-96"><h3 className="font-bold text-gray-700 mb-4">Kategori Pengeluaran</h3>{pnlExpensePieData.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pnlExpensePieData} cx="50%" cy="45%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} >{pnlExpensePieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><Tooltip formatter={(value: number) => [formatCurrency(value), '']}/></PieChart></ResponsiveContainer>) : (<div className="flex items-center justify-center h-full text-gray-500">Tidak ada data pengeluaran.</div>)}</div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div><h3 className="font-bold text-lg mb-2">Rincian Pendapatan</h3><div className="border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Kategori</th><th className="p-3 text-right">Total</th></tr></thead><tbody className="divide-y">{pnlIncomeTableData.map(item => (<tr key={item.name}><td className="p-3">{item.name}</td><td className="p-3 text-right font-medium">{formatCurrency(item.total)}</td></tr>))}</tbody><tfoot className="bg-gray-50 font-bold"><tr><td className="p-3">TOTAL PENDAPATAN</td><td className="p-3 text-right">{formatCurrency(pnlSummary.totalSales)}</td></tr></tfoot></table></div></div>
                    <div><h3 className="font-bold text-lg mb-2">Rincian Pengeluaran</h3><div className="border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-3 text-left">Kategori</th><th className="p-3 text-right">Total</th></tr></thead><tbody className="divide-y">{pnlExpenseTableData.map(item => (<tr key={item.name}><td className="p-3">{item.name}</td><td className="p-3 text-right font-medium">{formatCurrency(item.total)}</td></tr>))}</tbody><tfoot className="bg-gray-50 font-bold"><tr><td className="p-3">TOTAL PENGELUARAN</td><td className="p-3 text-right">{formatCurrency(pnlSummary.totalExpenses)}</td></tr></tfoot></table></div></div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'finalRecap': return renderFinalRecap();
            case 'profitAndLoss': return renderProfitAndLoss();
            case 'sales': return renderSales();
            case 'receivables': return renderReceivables();
            case 'inventory': return renderInventory();
            case 'assetsDebts': return renderAssetsDebts();
            case 'dataPenjualanLama': return renderLegacyData();
            default: return <div className="text-center py-16 text-gray-500"><p>Laporan untuk tab ini belum tersedia.</p></div>;
        }
    };
    
    const isDateFilterable = ['sales', 'receivables'].includes(activeTab);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <div>
                    <h2 className="text-xl font-bold">Laporan</h2>
                    <p className="text-sm text-gray-500">Analisis data penjualan, piutang, dan lainnya.</p>
                </div>
                <div className="flex space-x-2 no-print">
                    <button 
                        onClick={handleExport}
                        className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={!['sales', 'receivables'].includes(activeTab)}
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" /> <span>Ekspor ke Excel</span>
                    </button>
                    <button 
                        onClick={handlePrintReport}
                        className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={!['sales', 'receivables', 'profitAndLoss'].includes(activeTab)}
                    >
                        <PrinterIcon className="h-4 w-4" /> <span>Unduh PDF</span>
                    </button>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto no-print" aria-label="Tabs">
                    {accessibleTabs.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`${ activeTab === tab.key ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>
            
            {isDateFilterable && (
                 <div className="my-4 p-3 bg-gray-50 rounded-lg no-print">
                    <div className="flex items-center space-x-4">
                        <label className="text-sm font-medium">Periode Laporan:</label>
                        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-600" />
                        <span className="text-gray-500">-</span>
                        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-600" />
                        <div className="flex-grow"></div>
                        <button onClick={() => setIsCustomerReportFilterVisible(!isCustomerReportFilterVisible)} className="flex items-center space-x-2 text-gray-600 bg-white border hover:bg-gray-100 px-3 py-2 rounded-lg text-sm font-semibold">
                            <FilterIcon className="h-4 w-4" /> 
                            <span>Laporan Pelanggan</span>
                            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isCustomerReportFilterVisible ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    {isCustomerReportFilterVisible && (
                        <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="p-2 border rounded-md bg-white text-sm">
                                <option value="">Semua Pelanggan</option>
                                {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="md:col-span-2 flex justify-end">
                                 <button onClick={() => handlePrintCustomerSpecificReport(activeTab as 'sales' | 'receivables')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-300" disabled={!filterCustomer}>
                                    Buat Laporan Pelanggan
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}


            <div className="mt-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default Reports;
