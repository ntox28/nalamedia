
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { type SavedOrder, type ExpenseItem, type ReceivableItem, type ProductData, type CustomerData, type InventoryItem, type LegacyMonthlyIncome, type LegacyMonthlyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type CategoryData, type FinishingData, type ReportsProps, type OrderItemData } from '../types';
import { CurrencyDollarIcon, ReceiptTaxIcon, ChartBarIcon, ShoppingCartIcon, UsersIcon, CubeIcon, ChevronDownIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CreditCardIcon, ArrowDownTrayIcon, PrinterIcon, FilterIcon, ArrowUpTrayIcon } from './Icons';
import { exportToExcel } from './reportUtils';
import * as XLSX from 'xlsx';
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
    { key: 'categorySales', label: 'Penjualan per Kategori' },
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

    const initialFormState = useMemo(() => ({
        nota_id: '',
        customer: customers.length > 0 ? customers[0].name : '',
        order_date: new Date().toISOString().substring(0, 10),
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
                                <p className="text-xs text-gray-500">{new Date(item.order_date).toLocaleDateString('id-ID')}</p>
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
    onAddAsset: (data: Omit<AssetItem, 'id'>) => void;
    onUpdateAsset: (data: AssetItem) => void;
    onDeleteAsset: (id: number) => void;
    onAddDebt: (data: Omit<DebtItem, 'id'>) => void;
    onUpdateDebt: (data: DebtItem) => void;
    onDeleteDebt: (id: number) => void;
}> = ({ assets, debts, onAddAsset, onUpdateAsset, onDeleteAsset, onAddDebt, onUpdateDebt, onDeleteDebt }) => {
    const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
    const [assetName, setAssetName] = useState('');
    const [assetValue, setAssetValue] = useState('');

    const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
    const [debtName, setDebtName] = useState('');
    const [debtValue, setDebtValue] = useState('');

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
        } else {
            setDebtName('');
            setDebtValue('');
        }
    }, [editingDebt]);

    const handleAssetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingAsset) {
            onUpdateAsset({ ...editingAsset, name: assetName, value: Number(assetValue) });
        } else {
            onAddAsset({ name: assetName, value: Number(assetValue) });
        }
        setEditingAsset(null);
    };

    const handleDebtSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDebt) {
            onUpdateDebt({ ...editingDebt, name: debtName, value: Number(debtValue) });
        } else {
            onAddDebt({ name: debtName, value: Number(debtValue) });
        }
        setEditingDebt(null);
    };

    const handleDeleteAssetClick = (asset: AssetItem) => {
        if (window.confirm(`Anda yakin ingin menghapus aset "${asset.name}"?`)) {
            onDeleteAsset(asset.id);
        }
    };

    const handleDeleteDebtClick = (debt: DebtItem) => {
        if (window.confirm(`Anda yakin ingin menghapus hutang "${debt.name}"?`)) {
            onDeleteDebt(debt.id);
        }
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
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Aset</h3>
                    <form onSubmit={handleAssetSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                        <h4 className="font-semibold text-gray-700">{editingAsset ? 'Edit Aset' : 'Tambah Aset Baru'}</h4>
                        <input value={assetName} onChange={e => setAssetName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nama Aset (e.g., Mesin Cetak)" required />
                        <input type="number" value={assetValue} onChange={e => setAssetValue(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nilai Aset (Rp)" required />
                        <div className="flex space-x-2">
                            <button type="submit" className="w-full bg-cyan-600 text-white py-2 rounded-lg font-semibold hover:bg-cyan-700">{editingAsset ? 'Update' : 'Tambah Aset'}</button>
                            {editingAsset && <button type="button" onClick={() => setEditingAsset(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>}
                        </div>
                    </form>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2">
                        {assets.map(item => (
                            <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-800">{item.name}</p>
                                    <p className="text-sm text-green-600 font-bold">{formatCurrency(item.value)}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setEditingAsset(item)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4" /></button>
                                    <button onClick={() => handleDeleteAssetClick(item)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between font-bold text-lg p-3 bg-green-50 rounded-lg">
                        <span>Total Aset</span>
                        <span>{formatCurrency(totalAssets)}</span>
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Hutang</h3>
                    <form onSubmit={handleDebtSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                        <h4 className="font-semibold text-gray-700">{editingDebt ? 'Edit Hutang' : 'Tambah Hutang Baru'}</h4>
                        <input value={debtName} onChange={e => setDebtName(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nama Hutang (e.g., Cicilan Bank)" required />
                        <input type="number" value={debtValue} onChange={e => setDebtValue(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Nilai Hutang (Rp)" required />
                        <div className="flex space-x-2">
                            <button type="submit" className="w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600">{editingDebt ? 'Update' : 'Tambah Hutang'}</button>
                            {editingDebt && <button type="button" onClick={() => setEditingDebt(null)} className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>}
                        </div>
                    </form>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 border rounded-lg p-2">
                        {debts.map(item => (
                            <div key={item.id} className="bg-white border p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-800">{item.name}</p>
                                    <p className="text-sm text-red-600 font-bold">{formatCurrency(item.value)}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setEditingDebt(item)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="h-4 w-4" /></button>
                                    <button onClick={() => handleDeleteDebtClick(item)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                </div>
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
        XLSX.utils.book_append_sheet(wb, ws, "Laporan_Piutang_Lama.xlsx");
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
                        order_date: row['Tanggal'] instanceof Date ? row['Tanggal'].toISOString().substring(0,10) : new Date().toISOString().substring(0,10),
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
    allOrders, expenses, receivables, products, customers, inventory, categories, finishings,
    menuPermissions, legacyMonthlyIncomes, legacyMonthlyExpenses, legacyReceivables, assets, debts, notificationSettings,
    onAddLegacyMonthlyIncome, onUpdateLegacyMonthlyIncome, onDeleteLegacyMonthlyIncome,
    onAddLegacyMonthlyExpense, onUpdateLegacyMonthlyExpense, onDeleteLegacyMonthlyExpense,
    onAddLegacyReceivable, onUpdateLegacyReceivable, onDeleteLegacyReceivable,
    onAddAsset, onUpdateAsset, onDeleteAsset, onAddDebt, onUpdateDebt, onDeleteDebt
    } = props;
    const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`reports/${tab.key}`)), [menuPermissions]);
    const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: 'noNota', order: 'desc' });
    
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { firstDay, lastDay } = getMonthDateRange();
    
    // States for sales report
    const [salesMonth, setSalesMonth] = useState(currentMonth);
    const [salesCustomer, setSalesCustomer] = useState('');
    const [isSalesCustomerDropdownOpen, setIsSalesCustomerDropdownOpen] = useState(false);


    // States for receivables report
    const [receivablesFilterType, setReceivablesFilterType] = useState<'date' | 'month' | 'year'>('month');
    const [receivablesStartDate, setReceivablesStartDate] = useState(firstDay);
    const [receivablesEndDate, setReceivablesEndDate] = useState(lastDay);
    const [receivablesMonth, setReceivablesMonth] = useState(currentMonth);
    const [receivablesYear, setReceivablesYear] = useState(new Date().getFullYear());
    const [receivablesCustomer, setReceivablesCustomer] = useState('');
    const [isReceivablesCustomerDropdownOpen, setIsReceivablesCustomerDropdownOpen] = useState(false);
    
    const [categoryReportStartDate, setCategoryReportStartDate] = useState(firstDay);
    const [categoryReportEndDate, setCategoryReportEndDate] = useState(lastDay);

    const years = useMemo(() => {
        const orderYears = allOrders.map(order => new Date(order.orderDate).getFullYear());
        return Array.from(new Set(orderYears)).sort((a, b) => b - a);
    }, [allOrders]);
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
        setReceivablesFilterType('month');
        setReceivablesMonth(currentMonth);
        setReceivablesStartDate(firstDay);
        setReceivablesEndDate(lastDay);
        setReceivablesYear(new Date().getFullYear());
        setReceivablesCustomer('');
    };

    const handleResetCategoryFilters = () => {
        setCategoryReportStartDate(firstDay);
        setCategoryReportEndDate(lastDay);
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
    }, [activeTab, selectedYear, sortConfig, salesMonth, salesCustomer, receivablesMonth, receivablesCustomer, receivablesFilterType, receivablesStartDate, receivablesEndDate, receivablesYear]);
    
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
        const data = new Map<string, number>();
        pnlFilteredExpenses.forEach(exp => { data.set(exp.category, (data.get(exp.category) || 0) + exp.amount); });
         if(pnlFilteredLegacyExpenses.length > 0){
            const legacySum = pnlFilteredLegacyExpenses.reduce((sum, item) => sum + item.amount, 0);
            data.set('Pengeluaran Data Lama', legacySum);
        }
        return Array.from(data.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => a.name.localeCompare(b.name));
    }, [pnlFilteredExpenses, pnlFilteredLegacyExpenses]);

    const pnlSummary = useMemo(() => {
        const totalIncome = pnlIncomeTableData.reduce((sum, item) => sum + item.total, 0);
        const totalExpense = pnlExpenseTableData.reduce((sum, item) => sum + item.total, 0);
        return { totalSales: totalIncome, totalExpenses: totalExpense, profit: totalIncome - totalExpense };
    }, [pnlIncomeTableData, pnlExpenseTableData]);


    const pnlChartData = useMemo(() => {
        if (pnlFilterType === 'month') {
            const daysInMonth = new Date(parseInt(pnlSelectedMonth.slice(0, 4)), parseInt(pnlSelectedMonth.slice(5, 7)), 0).getDate();
            const dailyData: { name: string; Pendapatan: number; Pengeluaran: number }[] = Array.from({ length: daysInMonth }, (_, i) => ({ name: `${i + 1}`, Pendapatan: 0, Pengeluaran: 0 }));
            
            // Pendapatan
            pnlFilteredReceivables.forEach(r => r.payments?.forEach(p => { if (p.date >= pnlStartDate && p.date <= pnlEndDate) { const day = new Date(p.date).getUTCDate() - 1; if (dailyData[day]) dailyData[day].Pendapatan += p.amount; }}));
            pnlFilteredLegacyIncomes.forEach(i => { const day = new Date(i.month_date).getUTCDate() -1; if(dailyData[day]) dailyData[day].Pendapatan += Number(i.amount); });
            
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

    const handleExport = () => {
        let dateRange: { startDate: string, endDate: string };
        if (activeTab === 'sales') {
            const { startDate, endDate } = getSalesDateRange();
            dateRange = { startDate, endDate };
        } else if (activeTab === 'receivables') {
            const { startDate, endDate } = getReceivablesDateRange();
            dateRange = { startDate, endDate };
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
            case 'receivables':
                 // Use a different data structure for receivables export
                const receivablesToExport = filteredReceivablesData.map(r => ({
                    'No Nota': r.type === 'legacy' ? r.nota_id : r.id,
                    'Pelanggan': r.customer,
                    'Total Tagihan': r.amount,
                    'Sudah Dibayar': r.paid,
                    'Sisa Tagihan': r.remaining,
                    'Status Produksi': r.productionStatus,
                    'Jatuh Tempo': formatDate(r.due),
                }));
                exportToExcel('receivables', receivablesToExport, dateRange);
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
            activeTab === 'receivables' ? 'Laporan Piutang (Belum Lunas)' : 
            'Laporan Laba Rugi';
        
        const { startDate: salesStartDate, endDate: salesEndDate } = getSalesDateRange();
        const { startDate: receivablesStartDate, endDate: receivablesEndDate } = getReceivablesDateRange();
        
        const period = activeTab === 'profitAndLoss' ? 
            (pnlFilterType === 'month' ? `Periode: ${new Date(pnlSelectedMonth + '-02').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}` : `Periode: Tahun ${pnlSelectedYear}`)
            : activeTab === 'sales' ? `Periode: ${new Date(salesStartDate).toLocaleDateString('id-ID')} - ${new Date(salesEndDate).toLocaleDateString('id-ID')}`
            : `Periode: ${new Date(receivablesStartDate).toLocaleDateString('id-ID')} - ${new Date(receivablesEndDate).toLocaleDateString('id-ID')}`;

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
                    <td>${r.type === 'legacy' ? r.nota_id : r.id}</td>
                    <td>${r.customer}</td>
                    <td class="currency">${formatCurrency(r.amount)}</td>
                    <td class="currency">${formatCurrency(r.paid)}</td>
                    <td class="currency">${formatCurrency(r.remaining)}</td>
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
    const getSalesDateRange = useCallback(() => {
        if (!salesMonth) return { startDate: '', endDate: '' };
        const year = parseInt(salesMonth.slice(0, 4));
        const month = parseInt(salesMonth.slice(5, 7));
        const firstDay = new Date(year, month - 1, 1).toISOString().slice(0, 10);
        const lastDay = new Date(year, month, 0).toISOString().slice(0, 10);
        return { startDate: firstDay, endDate: lastDay };
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

    const getReceivablesDateRange = useCallback(() => {
        if (receivablesFilterType === 'date') {
            return { startDate: receivablesStartDate, endDate: receivablesEndDate };
        }
        if (receivablesFilterType === 'year') {
            return { startDate: `${receivablesYear}-01-01`, endDate: `${receivablesYear}-12-31` };
        }
        
        // Default is 'month'
        if (!receivablesMonth) return { startDate: '', endDate: '' };
        const year = parseInt(receivablesMonth.slice(0, 4));
        const month = parseInt(receivablesMonth.slice(5, 7));
        const first = new Date(year, month - 1, 1).toISOString().slice(0, 10);
        const last = new Date(year, month, 0).toISOString().slice(0, 10);
        return { startDate: first, endDate: last };
    }, [receivablesFilterType, receivablesMonth, receivablesStartDate, receivablesEndDate, receivablesYear]);

    const filteredReceivablesCustomers = useMemo(() => {
        if (!receivablesCustomer) return [];
        const lowerCaseQuery = receivablesCustomer.toLowerCase();
        return customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
    }, [receivablesCustomer, customers]);

    const filteredReceivablesData = useMemo(() => {
        const { startDate, endDate } = getReceivablesDateRange();
        if (!startDate || !endDate) return [];
        
        const unpaidNewSystem = receivables
            .filter(r => {
                const order = allOrders.find(o => o.id === r.id);
                if (!order) return false; // Ensure order data exists
                if (order.orderDate < startDate || order.orderDate > endDate) return false;
                if (receivablesCustomer && !r.customer.toLowerCase().includes(receivablesCustomer.toLowerCase())) return false;
                return r.paymentStatus === 'Belum Lunas';
            })
            .map(r => {
                const paid = r.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - paid;
                return { ...r, paid, remaining, type: 'new' as const };
            });

        const unpaidLegacy = legacyReceivables
            .filter(r => {
                if (r.order_date < startDate || r.order_date > endDate) return false;
                if (receivablesCustomer && !r.customer.toLowerCase().includes(receivablesCustomer.toLowerCase())) return false;
                return true;
            })
            .map(r => {
                return {
                    id: `legacy-${r.id}`,
                    nota_id: r.nota_id,
                    customer: r.customer,
                    amount: r.amount,
                    paid: 0,
                    remaining: r.amount,
                    paymentStatus: 'Belum Lunas' as const,
                    productionStatus: 'Data Lama' as const,
                    due: r.order_date,
                    type: 'legacy' as const
                };
            });

        return [...unpaidNewSystem, ...unpaidLegacy]
            .filter(item => item.remaining > 0)
            .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime());
    }, [receivables, legacyReceivables, allOrders, getReceivablesDateRange, receivablesCustomer]);
    
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
        const customerFilter = reportType === 'sales' ? salesCustomer : receivablesCustomer;
        const { startDate, endDate } = reportType === 'sales' ? getSalesDateRange() : getReceivablesDateRange();
        
        if (!customerFilter) {
            alert("Silakan ketik nama pelanggan di filter terlebih dahulu untuk mencetak laporan.");
            return;
        }

        const reportPeriod = `Periode: ${startDate ? new Date(startDate).toLocaleDateString('id-ID') : '...'} - ${endDate ? new Date(endDate).toLocaleDateString('id-ID') : '...'}`;
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
                    <title>${reportTitle} - ${customerFilter}</title>
                    <style>
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
                        .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                        .header, .customer-info { display: flex; justify-content: space-between; align-items: flex-start; }
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
                            <strong>${customerFilter}</strong>
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
        const totalUnpaidNotes = filteredReceivablesData.length;

        return (
            <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Tipe Filter</label>
                            <select 
                                value={receivablesFilterType} 
                                onChange={e => setReceivablesFilterType(e.target.value as any)} 
                                className="p-2 w-full mt-1 border rounded-md text-sm bg-white"
                            >
                                <option value="month">Per Bulan</option>
                                <option value="date">Per Tanggal</option>
                                <option value="year">Per Tahun</option>
                            </select>
                        </div>
                        
                        {receivablesFilterType === 'date' ? (
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Dari Tanggal</label>
                                    <input type="date" value={receivablesStartDate} onChange={e => setReceivablesStartDate(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700">Sampai Tanggal</label>
                                    <input type="date" value={receivablesEndDate} onChange={e => setReceivablesEndDate(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm" />
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
                                <input type="month" value={receivablesMonth} onChange={e => setReceivablesMonth(e.target.value)} className="p-2 w-full mt-1 border rounded-md text-sm text-gray-500" />
                            </div>
                        )}

                        <div className="md:col-span-1 relative">
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
                                className="p-2 w-full mt-1 border rounded-md text-sm"
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
                        <div>
                            {receivablesCustomer ? (
                                <button
                                    onClick={() => handlePrintCustomerSpecificReport('receivables')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 w-full"
                                >
                                    Cetak Laporan Pelanggan
                                </button>
                            ) : <div/>}
                        </div>
                    </div>
                     <div className="flex justify-end items-center mt-3">
                        <button onClick={handleResetReceivablesFilters} className="text-sm text-pink-600 hover:underline">Reset Filter</button>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <ReportStatCard icon={<UsersIcon />} title="Total Piutang Aktif (Global)" value={formatCurrency(globalActiveReceivables)} gradient="bg-gradient-to-br from-indigo-500 to-blue-500" />
                     <ReportStatCard icon={<ReceiptTaxIcon />} title="Total Sisa Tagihan (Filter)" value={formatCurrency(totalRemaining)} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
                     <ReportStatCard icon={<ExclamationTriangleIcon />} title="Jumlah Nota Belum Lunas" value={totalUnpaidNotes.toString()} gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500" />
                 </div>
                 <div>
                    <h4 className="font-semibold mb-2">Daftar Piutang (Belum Lunas)</h4>
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
                                        <td className="py-2 px-3 font-semibold">{r.type === 'legacy' ? r.nota_id : r.id}</td>
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

    const renderDataPiutangLama = () => {
        const filteredLegacyData = legacyReceivables.filter(item => {
            if (legacyFilterCustomer && item.customer !== legacyFilterCustomer) return false;
            if (legacyFilterStartDate && item.order_date < legacyFilterStartDate) return false;
            if (legacyFilterEndDate && item.order_date > legacyFilterEndDate) return false;
            return true;
        }).sort((a,b) => b.nota_id.localeCompare(a.nota_id));

        const totalLegacyPiutang = filteredLegacyData.reduce((sum, item) => sum + item.amount, 0);

        const handlePrintLegacyReceivables = () => {
            const groupedByMonth = filteredLegacyData.reduce((acc, item) => {
                const month = item.order_date.substring(0, 7);
                if (!acc[month]) acc[month] = [];
                acc[month].push(item);
                return acc;
            }, {} as Record<string, LegacyReceivable[]>);

            const sortedMonths = Object.keys(groupedByMonth).sort().reverse();
            let tableHtml = '';
            let itemCounter = 1;

            for (const month of sortedMonths) {
                const monthName = new Date(`${month}-02`).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                tableHtml += `<h3 class="month-header">${monthName}</h3>`;
                const tableRows = groupedByMonth[month].map(item => `
                    <tr><td>${itemCounter++}</td><td>${item.nota_id}</td><td>${item.customer}</td><td>${item.description}</td><td>${item.length || '-'}</td><td>${item.width || '-'}</td><td>${item.qty}</td><td class="currency">${formatCurrency(item.amount)}</td></tr>`
                ).join('');
                tableHtml += `<table><thead><tr><th>No</th><th>No Nota</th><th>Pelanggan</th><th>Deskripsi</th><th>Panjang (m)</th><th>Lebar (m)</th><th>Qty</th><th class="currency">Nominal Piutang (Rp)</th></tr></thead><tbody>${tableRows}</tbody></table>`;
            }

            const summaryHtml = `<div class="summary-box"><strong>Total Piutang Lama: ${formatCurrency(totalLegacyPiutang)}</strong></div>`;

            const printContent = `<html><head><title>Laporan Piutang Lama</title><style>body{font-family:sans-serif;font-size:10pt}@media print{.print-button-container{display:none}}.page{width:190mm;margin:auto}.header h1{font-size:16pt}.header h2{font-size:12pt}hr{border:0;border-top:1px solid #ccc}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background-color:#f2f2f2}.currency{text-align:right}.month-header{margin-top:20px;font-size:12pt;font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:5px}.summary-box{text-align:right;margin-top:20px;font-size:12pt}.print-button-container{position:fixed;top:20px;right:20px;text-align:center;z-index:100}.print-button-container button{background-color:#ec4899;color:white;font-weight:bold;padding:8px 24px;border-radius:8px;border:none;cursor:pointer}</style></head><body><div class="print-button-container"><button onclick="window.print()">Cetak atau Simpan PDF</button></div><div class="page"><div class="header"><div><h2>Nala Media Digital Printing</h2></div><h1>Laporan Piutang Lama</h1></div><hr>${tableHtml}${summaryHtml}</div></body></html>`;
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.focus();
            }
        };

        return (
            <div>
                {isLegacyImportExportModalOpen && <LegacyReceivableImportExportModal show={isLegacyImportExportModalOpen} onClose={() => setIsLegacyImportExportModalOpen(false)} filteredData={filteredLegacyData} onAddLegacyReceivable={onAddLegacyReceivable} />}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                        <button onClick={handlePrintLegacyReceivables} className="flex items-center text-sm bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"><PrinterIcon className="h-4 w-4 mr-2" />Cetak</button>
                        <button onClick={() => setIsLegacyImportExportModalOpen(true)} className="flex items-center text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"><ArrowDownTrayIcon className="h-4 w-4 mr-2" />Impor/Ekspor</button>
                    </div>
                    <button onClick={() => setIsLegacyFilterVisible(!isLegacyFilterVisible)} className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold"><FilterIcon className="h-4 w-4" />Filter</button>
                </div>
                {isLegacyFilterVisible && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4 border">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <select value={legacyFilterCustomer} onChange={e => setLegacyFilterCustomer(e.target.value)} className="p-2 border rounded-md bg-white text-sm"><option value="">Semua Pelanggan</option>{customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>
                            <input type="date" value={legacyFilterStartDate} onChange={e => setLegacyFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" />
                            <input type="date" value={legacyFilterEndDate} onChange={e => setLegacyFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" />
                        </div>
                         <div className="flex justify-end mt-3">
                            <button onClick={handleResetLegacyFilters} className="text-sm text-pink-600 hover:underline">Reset Filter</button>
                        </div>
                    </div>
                )}
                 <div className="bg-amber-50 p-4 rounded-lg my-4 text-center">
                    <h4 className="font-semibold text-amber-800">Total Piutang Lama (Sesuai Filter)</h4>
                    <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalLegacyPiutang)}</p>
                </div>
                <LegacyReceivableForm 
                    customers={customers}
                    legacyReceivables={filteredLegacyData}
                    onSave={onAddLegacyReceivable}
                    onUpdate={onUpdateLegacyReceivable}
                    onDelete={onDeleteLegacyReceivable}
                />
            </div>
        );
    };
    
    // --- New Category Sales Report ---
    const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
        'End Customer': 'endCustomer', 'Retail': 'retail', 'Grosir': 'grosir', 'Reseller': 'reseller', 'Corporate': 'corporate'
    };

    const categorySalesData = useMemo(() => {
        const categoryMap: Map<number, { name: string; totalItems: number; totalTurnover: number }> = new Map();

        categories.forEach(cat => {
            categoryMap.set(cat.id, { name: cat.name, totalItems: 0, totalTurnover: 0 });
        });

        const relevantOrders = allOrders.filter(order => order.orderDate >= categoryReportStartDate && order.orderDate <= categoryReportEndDate);

        for (const order of relevantOrders) {
            const customerData = customers.find(c => c.name === order.customer);
            const customerLevel = customerData ? customerData.level : 'End Customer';
            const priceKey = priceLevelMap[customerLevel];

            for (const item of order.orderItems) {
                if (!item.productId) continue;
                
                const productInfo = products.find(p => p.id === item.productId);
                if (!productInfo) continue;

                const categoryInfo = categories.find(c => c.name === productInfo.category);
                if (!categoryInfo) continue;
                
                const finishingInfo = finishings.find(f => f.name === item.finishing);

                const isAreaBased = categoryInfo.unitType === 'Per Luas';
                let materialPrice = (productInfo.price[priceKey] || productInfo.price.endCustomer);
                const finishingPrice = finishingInfo ? finishingInfo.price : 0;
                let priceMultiplier = 1;

                if (isAreaBased) {
                    const length = parseFloat(item.length) || 0;
                    const width = parseFloat(item.width) || 0;
                    priceMultiplier = length * width;
                }
                
                const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
                const itemFinishingTotal = finishingPrice * item.qty;
                const itemTotalTurnover = itemMaterialTotal + itemFinishingTotal;

                const currentCategoryData = categoryMap.get(categoryInfo.id)!;
                currentCategoryData.totalItems += item.qty;
                currentCategoryData.totalTurnover += itemTotalTurnover;
            }
        }
        
        return Array.from(categoryMap.values())
            .filter(d => d.totalItems > 0)
            .sort((a, b) => b.totalTurnover - a.totalTurnover);

    }, [allOrders, products, categories, customers, finishings, categoryReportStartDate, categoryReportEndDate]);
    
    const renderCategorySalesReport = () => {
        const totalTurnover = categorySalesData.reduce((sum, cat) => sum + cat.totalTurnover, 0);
        const totalItemsSold = categorySalesData.reduce((sum, cat) => sum + cat.totalItems, 0);
        const topCategory = categorySalesData[0] ? categorySalesData[0].name : 'N/A';
        const PIE_COLORS = ['#ec4899', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e'];
        
        return (
            <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div><label className="text-sm font-medium text-gray-700">Tanggal Mulai</label><input type="date" value={categoryReportStartDate} onChange={e => setCategoryReportStartDate(e.target.value)} className="p-2 w-full border rounded-md text-sm text-gray-500 mt-1" /></div>
                        <div><label className="text-sm font-medium text-gray-700">Tanggal Akhir</label><input type="date" value={categoryReportEndDate} onChange={e => setCategoryReportEndDate(e.target.value)} className="p-2 w-full border rounded-md text-sm text-gray-500 mt-1" /></div>
                    </div>
                     <div className="flex justify-end mt-3">
                        <button onClick={handleResetCategoryFilters} className="text-sm text-pink-600 hover:underline">Reset Filter</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <ReportStatCard icon={<CurrencyDollarIcon />} title="Total Omset" value={formatCurrency(totalTurnover)} gradient="bg-gradient-to-br from-green-500 to-emerald-500" />
                    <ReportStatCard icon={<ShoppingCartIcon />} title="Total Item Terjual" value={totalItemsSold.toLocaleString('id-ID')} gradient="bg-gradient-to-br from-blue-500 to-sky-500" />
                    <ReportStatCard icon={<ChartBarIcon />} title="Kategori Terlaris" value={topCategory} gradient="bg-gradient-to-br from-violet-500 to-purple-500" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-96">
                        <h4 className="font-semibold mb-2">Distribusi Omset per Kategori</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={categorySalesData} dataKey="totalTurnover" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                    {categorySalesData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Rincian per Kategori</h4>
                        <div className="overflow-auto border rounded-lg max-h-96">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="py-2 px-3 text-left">Nama Kategori</th>
                                        <th className="py-2 px-3 text-right">Jumlah Item</th>
                                        <th className="py-2 px-3 text-right">Total Omset</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {categorySalesData.map(cat => (
                                        <tr key={cat.name}>
                                            <td className="py-2 px-3 font-medium">{cat.name}</td>
                                            <td className="py-2 px-3 text-right">{cat.totalItems.toLocaleString('id-ID')}</td>
                                            <td className="py-2 px-3 text-right font-semibold">{formatCurrency(cat.totalTurnover)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'finalRecap': return renderFinalRecap();
            case 'profitAndLoss': return renderProfitAndLoss();
            case 'sales': return renderSales();
            case 'categorySales': return renderCategorySalesReport();
            case 'receivables': return renderReceivables();
            case 'inventory': return renderInventory();
            case 'assetsDebts': return <AssetsAndDebts assets={assets} debts={debts} onAddAsset={onAddAsset} onUpdateAsset={onUpdateAsset} onDeleteAsset={onDeleteAsset} onAddDebt={onAddDebt} onUpdateDebt={onUpdateDebt} onDeleteDebt={onDeleteDebt} />;
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
                    </div>
                </div>
                
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                         {accessibleTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`${ activeTab.startsWith(tab.key) ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
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
