import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { type SavedOrder, type ExpenseItem, type ReceivableItem, type ProductData, type CustomerData, type InventoryItem, type LegacyIncome, type LegacyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type CategoryData, type FinishingData, type ReportsProps } from '../types';
import { CurrencyDollarIcon, ReceiptTaxIcon, ChartBarIcon, ShoppingCartIcon, UsersIcon, CubeIcon, ChevronDownIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CreditCardIcon, ArrowDownTrayIcon, PrinterIcon } from './Icons';
import { exportToExcel } from './reportUtils';

// Helper to get first and last day of the current month
const getMonthDateRange = () => {
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().substring(0, 10);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().substring(0, 10);
  return { firstDay, lastDay };
};

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

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
        if (window.confirm(`L melunasi piutang ${item.customer} sejumlah ${formatCurrency(item.amount)}? Ini akan tercatat sebagai pengeluaran baru.`)) {
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

const Reports: React.FC<ReportsProps> = ({ 
    allOrders, expenses, receivables, products, customers, inventory, categories, finishings,
    menuPermissions, legacyIncome, legacyExpense, legacyReceivables, assets, debts,
    onSetLegacyIncome, onSetLegacyExpense, onAddLegacyReceivable, onUpdateLegacyReceivable,
    onDeleteLegacyReceivable, onSettleLegacyReceivable, onAddAsset, onAddDebt
}) => {
    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`reports/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');

    const { firstDay, lastDay } = getMonthDateRange();
    const [filterStartDate, setFilterStartDate] = useState(firstDay);
    const [filterEndDate, setFilterEndDate] = useState(lastDay);

    useEffect(() => {
        if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
            setActiveTab(accessibleTabs[0].key);
        }
    }, [accessibleTabs, activeTab]);
    
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
    
    // --- FINAL RECAP CALCULATIONS ---
    const finalRecapData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startOfYear = `${currentYear}-01-01`;
        const endOfYear = `${currentYear}-12-31`;

        const totalLegacyIncome = legacyIncome?.amount || 0;
        const totalLegacyExpense = legacyExpense?.amount || 0;
        
        const paidReceivables = receivables.filter(r => r.paymentStatus === 'Lunas');
        const newSystemIncome = paidReceivables.reduce((sum, r) => sum + r.amount - (r.discount || 0), 0);
        
        const newSystemExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

        const totalIncome = totalLegacyIncome + newSystemIncome;
        const totalExpense = totalLegacyExpense + newSystemExpense;
        const finalBalance = totalIncome - totalExpense;
        
        const expensesThisYear = expenses.filter(e => e.date >= startOfYear && e.date <= endOfYear)
                                         .reduce((sum, e) => sum + e.amount, 0);
        const ordersThisYear = allOrders.filter(o => o.orderDate >= startOfYear && o.orderDate <= endOfYear);
        
        const ordersThisYearIds = new Set(ordersThisYear.map(o => o.id));

        const receivablesThisYearAmount = receivables
            .filter(r => ordersThisYearIds.has(r.id) && r.paymentStatus === 'Belum Lunas')
            .reduce((sum, r) => {
                const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - totalPaid;
                return sum + (remaining > 0 ? remaining : 0);
            }, 0);
        
        // Monthly order chart data
        const monthlyOrders: { [key: string]: number } = {
            'Jan': 0, 'Feb': 0, 'Mar': 0, 'Apr': 0, 'Mei': 0, 'Jun': 0, 
            'Jul': 0, 'Ags': 0, 'Sep': 0, 'Okt': 0, 'Nov': 0, 'Des': 0
        };
        const monthNames = Object.keys(monthlyOrders);
        
        allOrders.forEach(order => {
            const orderDate = new Date(order.orderDate);
            if(orderDate.getFullYear() === currentYear) {
                const monthName = monthNames[orderDate.getMonth()];
                if (monthName) {
                    monthlyOrders[monthName]++;
                }
            }
        });
        
        const chartData = Object.entries(monthlyOrders).map(([name, orders]) => ({ name, 'Total Order': orders }));

        return {
            totalIncome, totalExpense, finalBalance,
            totalLegacyIncome, totalLegacyExpense,
            newSystemIncome, newSystemExpense,
            expensesThisYear, ordersThisYear: ordersThisYear.length,
            receivablesThisYearAmount,
            chartData
        };
    }, [receivables, expenses, allOrders, legacyIncome, legacyExpense]);


    // --- FILTERED DATA FOR OTHER TABS ---

    const filteredSalesData = useMemo(() => {
        return allOrders
            .filter(order => order.orderDate >= filterStartDate && order.orderDate <= filterEndDate)
            .map(order => ({...order, totalItems: order.orderItems.reduce((sum, item) => sum + item.qty, 0) }))
            .sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [allOrders, filterStartDate, filterEndDate]);

    const salesByProduct = useMemo(() => {
        const productMap: { [key: number]: { name: string; category: string; quantity: number; totalSales: number } } = {};
        filteredSalesData.forEach(order => {
            order.orderItems.forEach(item => {
                if (item.productId) {
                    if (!productMap[item.productId]) {
                        const productInfo = products.find(p => p.id === item.productId);
                        productMap[item.productId] = { name: productInfo?.name || 'N/A', category: productInfo?.category || 'N/A', quantity: 0, totalSales: 0 };
                    }
                    productMap[item.productId].quantity += item.qty;
                    productMap[item.productId].totalSales += order.totalPrice / order.orderItems.length; // Approximate price
                }
            });
        });
        return Object.values(productMap).sort((a, b) => b.quantity - a.quantity);
    }, [filteredSalesData, products]);

    const salesByCustomer = useMemo(() => {
        const customerMap: { [key: string]: { customer: string; orderCount: number; totalSpent: number } } = {};
        filteredSalesData.forEach(order => {
            if (!customerMap[order.customer]) {
                customerMap[order.customer] = { customer: order.customer, orderCount: 0, totalSpent: 0 };
            }
            customerMap[order.customer].orderCount++;
            customerMap[order.customer].totalSpent += order.totalPrice;
        });
        return Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
    }, [filteredSalesData]);

    const filteredReceivablesData = useMemo(() => {
        return receivables
            .filter(receivable => {
                const order = allOrders.find(o => o.id === receivable.id);
                return order && order.orderDate >= filterStartDate && order.orderDate <= filterEndDate;
            })
            .map(r => {
                const paid = r.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - paid;
                return { ...r, paid, remaining };
            })
            .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime());
    }, [receivables, allOrders, filterStartDate, filterEndDate]);
    
    const filteredInventoryData = useMemo(() => {
        return inventory.map(item => ({
            ...item,
            status: item.stock <= 5 ? 'Stok Menipis' : 'Tersedia'
        }));
    }, [inventory]);

    // --- RENDER METHODS FOR TABS ---

    const renderFinalRecap = () => (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ProminentStatCard icon={<CurrencyDollarIcon />} title="Saldo Akhir (Estimasi)" value={formatCurrency(finalRecapData.finalBalance)} gradient="bg-gradient-to-br from-cyan-500 to-blue-500" />
                <ProminentStatCard icon={<CreditCardIcon />} title="Piutang (Tahun Ini)" value={formatCurrency(finalRecapData.receivablesThisYearAmount)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                <ProminentStatCard icon={<ReceiptTaxIcon />} title="Pengeluaran (Tahun Ini)" value={formatCurrency(finalRecapData.expensesThisYear)} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                <ProminentStatCard icon={<ShoppingCartIcon />} title="Total Order (Tahun Ini)" value={finalRecapData.ordersThisYear.toString()} gradient="bg-gradient-to-br from-violet-500 to-purple-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border">
                        <h4 className="font-bold text-lg mb-2">Rincian Keuangan</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span>Pemasukan (Data Lama)</span><span className="font-semibold">{formatCurrency(finalRecapData.totalLegacyIncome)}</span></div>
                            <div className="flex justify-between"><span>Pemasukan (Sistem Baru)</span><span className="font-semibold">{formatCurrency(finalRecapData.newSystemIncome)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-1"><span>Total Pemasukan</span><span className="text-green-600">{formatCurrency(finalRecapData.totalIncome)}</span></div>
                        </div>
                         <div className="space-y-2 text-sm mt-4">
                            <div className="flex justify-between"><span>Pengeluaran (Data Lama)</span><span className="font-semibold">{formatCurrency(finalRecapData.totalLegacyExpense)}</span></div>
                            <div className="flex justify-between"><span>Pengeluaran (Sistem Baru)</span><span className="font-semibold">{formatCurrency(finalRecapData.newSystemExpense)}</span></div>
                            <div className="flex justify-between font-bold border-t pt-1"><span>Total Pengeluaran</span><span className="text-red-600">{formatCurrency(finalRecapData.totalExpense)}</span></div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-3 h-96">
                     <h4 className="font-bold text-lg mb-2">Grafik Order Bulanan (Tahun Ini)</h4>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={finalRecapData.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '0.5rem' }} />
                            <Bar dataKey="Total Order" fill="#ec4899" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
    
    const renderSales = () => {
        const totalSales = filteredSalesData.reduce((sum, order) => sum + order.totalPrice, 0);
        const totalTransactions = filteredSalesData.length;
        const totalItems = filteredSalesData.reduce((sum, order) => sum + order.totalItems, 0);
        const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
        
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <ReportStatCard icon={<CurrencyDollarIcon />} title="Total Penjualan" value={formatCurrency(totalSales)} gradient="bg-gradient-to-br from-green-500 to-emerald-500" />
                     <ReportStatCard icon={<ShoppingCartIcon />} title="Jumlah Transaksi" value={totalTransactions.toString()} gradient="bg-gradient-to-br from-blue-500 to-sky-500" />
                     <ReportStatCard icon={<CubeIcon />} title="Total Item Terjual" value={totalItems.toString()} gradient="bg-gradient-to-br from-amber-500 to-yellow-500" />
                     <ReportStatCard icon={<ChartBarIcon />} title="Rata-rata/Transaksi" value={formatCurrency(avgTransaction)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                </div>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold mb-2">Rincian Penjualan per Produk</h4>
                        <div className="overflow-y-auto max-h-96 border rounded-lg"><table className="min-w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="py-2 px-3 text-left">Produk</th><th className="py-2 px-3 text-right">Jumlah</th><th className="py-2 px-3 text-right">Total</th></tr></thead><tbody className="divide-y">{salesByProduct.map(p => <tr key={p.name}><td className="py-2 px-3">{p.name}</td><td className="py-2 px-3 text-right">{p.quantity}</td><td className="py-2 px-3 text-right">{formatCurrency(p.totalSales)}</td></tr>)}</tbody></table></div>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Rincian Penjualan per Pelanggan</h4>
                        <div className="overflow-y-auto max-h-96 border rounded-lg"><table className="min-w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="py-2 px-3 text-left">Pelanggan</th><th className="py-2 px-3 text-right">Transaksi</th><th className="py-2 px-3 text-right">Total</th></tr></thead><tbody className="divide-y">{salesByCustomer.map(c => <tr key={c.customer}><td className="py-2 px-3">{c.customer}</td><td className="py-2 px-3 text-right">{c.orderCount}</td><td className="py-2 px-3 text-right">{formatCurrency(c.totalSpent)}</td></tr>)}</tbody></table></div>
                    </div>
                </div>
            </div>
        );
    };

    const renderReceivables = () => {
        const totalReceivables = filteredReceivablesData.reduce((sum, r) => sum + r.amount, 0);
        const totalPaid = filteredReceivablesData.reduce((sum, r) => sum + r.paid, 0);
        const totalRemaining = filteredReceivablesData.reduce((sum, r) => sum + r.remaining, 0);
        const totalOverdue = filteredReceivablesData.filter(r => new Date(r.due) < new Date() && r.paymentStatus === 'Belum Lunas').length;

        return (
            <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <ReportStatCard icon={<CurrencyDollarIcon />} title="Total Piutang" value={formatCurrency(totalReceivables)} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
                     <ReportStatCard icon={<CreditCardIcon />} title="Total Terbayar" value={formatCurrency(totalPaid)} gradient="bg-gradient-to-br from-cyan-500 to-sky-500" />
                     <ReportStatCard icon={<ReceiptTaxIcon />} title="Total Sisa Tagihan" value={formatCurrency(totalRemaining)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title="Piutang Jatuh Tempo" value={totalOverdue.toString()} gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500" />
                 </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Piutang</h4>
                    <div className="overflow-y-auto max-h-96 border rounded-lg"><table className="min-w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="py-2 px-3 text-left">No. Nota</th><th className="py-2 px-3 text-left">Pelanggan</th><th className="py-2 px-3 text-right">Sisa Tagihan</th><th className="py-2 px-3 text-center">Status</th></tr></thead><tbody className="divide-y">{filteredReceivablesData.map(r => <tr key={r.id}><td className="py-2 px-3">{r.id}</td><td className="py-2 px-3">{r.customer}</td><td className="py-2 px-3 text-right font-semibold">{formatCurrency(r.remaining)}</td><td className="py-2 px-3 text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${r.paymentStatus === 'Lunas' ? 'bg-cyan-100 text-cyan-800' : 'bg-yellow-100 text-yellow-800'}`}>{r.paymentStatus}</span></td></tr>)}</tbody></table></div>
                 </div>
            </div>
        );
    };

    const renderInventory = () => {
        const totalItems = filteredInventoryData.length;
        const lowStockItems = filteredInventoryData.filter(i => i.stock <= 5).length;
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <ReportStatCard icon={<CubeIcon />} title="Total Jenis Item" value={totalItems.toString()} gradient="bg-gradient-to-br from-indigo-500 to-violet-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title="Item Stok Menipis" value={lowStockItems.toString()} gradient="bg-gradient-to-br from-red-500 to-rose-500" />
                </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Stok Inventori</h4>
                    <div className="overflow-y-auto max-h-96 border rounded-lg"><table className="min-w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="py-2 px-3 text-left">Nama Item</th><th className="py-2 px-3 text-right">Stok Saat Ini</th><th className="py-2 px-3 text-center">Status</th></tr></thead><tbody className="divide-y">{filteredInventoryData.map(i => <tr key={i.id}><td className="py-2 px-3">{i.name}</td><td className="py-2 px-3 text-right font-semibold">{`${i.stock} ${i.unit}`}</td><td className="py-2 px-3 text-center"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${i.stock <= 5 ? 'bg-red-100 text-red-800' : 'bg-cyan-100 text-cyan-800'}`}>{i.status}</span></td></tr>)}</tbody></table></div>
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

    const renderContent = () => {
        switch (activeTab) {
            case 'finalRecap': return renderFinalRecap();
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
                        className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm font-semibold"
                        disabled={!['sales', 'receivables', 'inventory'].includes(activeTab)}
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" /> <span>Ekspor ke Excel</span>
                    </button>
                    <button 
                        onClick={() => window.print()}
                        className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm font-semibold"
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
                <div className="flex items-center space-x-4 my-4 p-3 bg-gray-50 rounded-lg no-print">
                    <label className="text-sm font-medium">Periode:</label>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-600" />
                    <span className="text-gray-500">-</span>
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-600" />
                </div>
            )}

            <div className="mt-6">
                {renderContent()}
            </div>
        </div>
    );
};

export default Reports;