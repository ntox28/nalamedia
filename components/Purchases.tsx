import React, { useState, useMemo, useEffect } from 'react';
import {
  type SupplierData,
  type InventoryItem,
  type InventoryCategory,
  type InventoryItemMeta,
  type PurchaseRecord,
  type PurchaseItem,
  type ExpenseFundingSource,
  type PaymentMethod,
} from '../types';
import { MagnifyingGlassIcon, PlusCircleIcon, TrashIcon, EyeIcon, TruckIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 15;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

const getLocalToday = () => {
  return new Date().toISOString().substring(0, 10);
};

interface PurchasesProps {
  purchases: PurchaseRecord[];
  suppliers: SupplierData[];
  inventory: InventoryItem[];
  inventoryMetadata?: Record<number, InventoryItemMeta>;
  paymentMethods?: PaymentMethod[];
  currentUserName?: string;
  onAddPurchase: (payload: {
    invoiceNumber: string;
    date: string;
    supplierId: number;
    supplierName: string;
    items: PurchaseItem[];
    totalAmount: number;
    paymentType: 'Lunas' | 'Kredit';
    fundingSource: ExpenseFundingSource;
    fundingAccountId?: string;
    fundingAccountName?: string;
    dpAmount: number;
    dueDate: string;
    notes: string;
  }) => Promise<boolean>;
  onDeletePurchase: (purchase: PurchaseRecord) => Promise<void>;
  onAddInventoryItem: (newItem: Omit<InventoryItem, 'id'>, meta?: Partial<InventoryItemMeta>) => Promise<void>;
}

const QuickInventoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: Omit<InventoryItem, 'id'>, meta?: Partial<InventoryItemMeta>) => Promise<void>;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('Roll');
  const [type, setType] = useState<'Bahan Baku' | 'Barang Jadi'>('Bahan Baku');
  const [category, setCategory] = useState<InventoryCategory>('Bahan Baku');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(
        {
          name: name.trim(),
          sku: sku.trim() || `BHN-${Date.now().toString().slice(-5)}`,
          stock: 0,
          unit: unit.trim() || 'Pcs',
          type,
          usageHistory: [],
        },
        { category, condition: 'Baik' }
      );
      setName('');
      setSku('');
      setUnit('Roll');
      setType('Bahan Baku');
      setCategory('Bahan Baku');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-bold text-gray-800">Tambah Bahan / Barang Baru</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Bahan / Barang</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
              placeholder="Contoh: Flexi Korea 440gr 3.2m"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kode / SKU</label>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                placeholder="Opsional (otomatis)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Satuan</label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                placeholder="Roll / Liter / Pcs / Rim"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kategori Tab Inventori</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as InventoryCategory)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="Bahan Baku">Bahan Baku</option>
                <option value="ATK">ATK</option>
                <option value="Kebersihan">Kebersihan</option>
                <option value="Lain-Lain">Lain-Lain</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipe Item</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'Bahan Baku' | 'Barang Jadi')}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
              >
                <option value="Bahan Baku">Bahan Baku</option>
                <option value="Barang Jadi">Barang Jadi</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded-md">
            Item baru akan masuk ke daftar <b>Stok / Inventori</b> dengan stok awal <b>0</b> agar bisa dipilih di faktur pembelian. Angka stok fisik tetap dikelola manual di menu Stok / Inventori.
          </p>
          <div className="flex justify-end space-x-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300">
              Batal
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-pink-600 text-white font-bold text-sm hover:bg-pink-700 disabled:bg-pink-300">
              {isSubmitting ? 'Menyimpan...' : 'Simpan Bahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PurchaseDetailModal: React.FC<{
  purchase: PurchaseRecord | null;
  onClose: () => void;
}> = ({ purchase, onClose }) => {
  if (!purchase) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Detail Faktur Barang Masuk</h3>
            <p className="text-sm text-gray-500">{purchase.invoiceNumber} &bull; {purchase.supplierName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-lg text-sm">
            <div>
              <p className="text-gray-500 text-xs">Tanggal Masuk</p>
              <p className="font-semibold">{new Date(purchase.date).toLocaleDateString('id-ID')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Status Pembayaran</p>
              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${purchase.paymentType === 'Lunas' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {purchase.paymentType}
              </span>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Sumber Dana / Tempo</p>
              <p className="font-semibold">
                {purchase.paymentType === 'Lunas'
                  ? `${purchase.fundingSource || 'Kas Laci'}${purchase.fundingAccountName ? ` • ${purchase.fundingAccountName}` : ''}`
                  : `Tempo s/d ${purchase.dueDate ? new Date(purchase.dueDate).toLocaleDateString('id-ID') : '-'}`}
              </p>
            </div>
            {purchase.paymentType === 'Kredit' && (purchase.dpAmount || 0) > 0 && (
              <div>
                <p className="text-gray-500 text-xs">DP / Uang Muka</p>
                <p className="font-semibold text-blue-600">
                  {formatCurrency(purchase.dpAmount || 0)} ({purchase.fundingSource || 'Kas Laci'}
                  {purchase.fundingAccountName ? ` • ${purchase.fundingAccountName}` : ''})
                </p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-xs">Diinput Oleh</p>
              <p className="font-semibold">{purchase.createdBy || '-'}</p>
            </div>
            {purchase.notes && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-gray-500 text-xs">Catatan</p>
                <p className="font-medium text-gray-700">{purchase.notes}</p>
              </div>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Barang / Bahan</th>
                  <th className="py-2 px-3 text-center text-xs font-semibold text-gray-500 uppercase">Qty Masuk</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase">Harga Beli</th>
                  <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchase.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3">
                      <p className="font-medium text-gray-800">{item.itemName}</p>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </td>
                    <td className="py-2 px-3 text-center font-semibold">{item.qty} {item.unit}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 px-3 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right">Total Faktur</td>
                  <td className="py-2.5 px-3 text-right text-pink-600">{formatCurrency(purchase.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DraftItemRow {
  rowId: number;
  inventoryId: string;
  qty: string;
  unitPrice: string;
}

const Purchases: React.FC<PurchasesProps> = ({
  purchases,
  suppliers,
  inventory,
  inventoryMetadata = {},
  paymentMethods = [],
  currentUserName,
  onAddPurchase,
  onDeletePurchase,
  onAddInventoryItem,
}) => {
  const today = getLocalToday();
  const nonCashAccounts = useMemo(
    () => paymentMethods.filter(m => m.type !== 'Tunai'),
    [paymentMethods]
  );
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().substring(0, 10);
  }, []);

  // Form state
  const [date, setDate] = useState(today);
  const [supplierId, setSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentType, setPaymentType] = useState<'Lunas' | 'Kredit'>('Lunas');
  const [fundingSource, setFundingSource] = useState<ExpenseFundingSource>('Transfer Bank');
  const [fundingAccountId, setFundingAccountId] = useState<string>('');
  const [dpAmount, setDpAmount] = useState('0');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItemRow[]>([
    { rowId: Date.now(), inventoryId: '', qty: '1', unitPrice: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // Modals & Filters
  const [isQuickInvOpen, setQuickInvOpen] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState<PurchaseRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Lunas' | 'Kredit'>('Semua');
  const [monthFilter, setMonthFilter] = useState(today.slice(0, 7));
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0].id.toString());
    }
  }, [suppliers, supplierId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, monthFilter]);

  const inventoryMap = useMemo(() => {
    const map = new Map<number, InventoryItem>();
    inventory.forEach(item => map.set(item.id, item));
    return map;
  }, [inventory]);

  const computedItems = useMemo(() => {
    return draftItems.map(row => {
      const inv = row.inventoryId ? inventoryMap.get(Number(row.inventoryId)) : undefined;
      const qty = parseFloat(row.qty) || 0;
      const unitPrice = parseFloat(row.unitPrice) || 0;
      return {
        ...row,
        inv,
        qtyNum: qty,
        unitPriceNum: unitPrice,
        subtotal: qty * unitPrice,
      };
    });
  }, [draftItems, inventoryMap]);

  const grandTotal = useMemo(
    () => computedItems.reduce((sum, item) => sum + item.subtotal, 0),
    [computedItems]
  );

  const handleAddRow = () => {
    setDraftItems(prev => [...prev, { rowId: Date.now() + Math.random(), inventoryId: '', qty: '1', unitPrice: '' }]);
  };

  const handleRemoveRow = (rowId: number) => {
    setDraftItems(prev => (prev.length > 1 ? prev.filter(r => r.rowId !== rowId) : prev));
  };

  const handleRowChange = (rowId: number, field: keyof DraftItemRow, value: string) => {
    setDraftItems(prev => prev.map(r => (r.rowId === rowId ? { ...r, [field]: value } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSupplier = suppliers.find(s => s.id === Number(supplierId));
    if (!selectedSupplier) {
      alert('Pilih Pemasok / Supplier terlebih dahulu.');
      return;
    }

    const validItems: PurchaseItem[] = [];
    for (const row of computedItems) {
      if (!row.inv) {
        alert('Pastikan semua baris memilih item bahan/barang dari inventori.');
        return;
      }
      if (row.qtyNum <= 0 || row.unitPriceNum < 0) {
        alert(`Qty dan harga beli untuk "${row.inv.name}" harus valid.`);
        return;
      }
      validItems.push({
        inventoryId: row.inv.id,
        itemName: row.inv.name,
        sku: row.inv.sku,
        unit: row.inv.unit,
        qty: row.qtyNum,
        unitPrice: row.unitPriceNum,
        subtotal: row.subtotal,
      });
    }

    if (validItems.length === 0 || grandTotal <= 0) {
      alert('Total pembelian harus lebih dari Rp 0.');
      return;
    }

    const dpNum = paymentType === 'Kredit' ? Math.max(0, parseFloat(dpAmount) || 0) : 0;
    if (paymentType === 'Kredit' && dpNum >= grandTotal) {
      alert('Nominal DP sama dengan atau melebihi total faktur. Gunakan metode pembayaran "Lunas" saja.');
      return;
    }

    const finalInvoice = invoiceNumber.trim() || `PB-${date.replace(/-/g, '')}-${String(purchases.length + 1).padStart(3, '0')}`;

    setIsSaving(true);
    try {
      const accountName =
        fundingSource === 'Transfer Bank' && fundingAccountId
          ? nonCashAccounts.find(a => a.id === fundingAccountId)?.name
          : undefined;
      const ok = await onAddPurchase({
        invoiceNumber: finalInvoice,
        date,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        items: validItems,
        totalAmount: grandTotal,
        paymentType,
        fundingSource,
        fundingAccountId: fundingSource === 'Transfer Bank' && fundingAccountId ? fundingAccountId : undefined,
        fundingAccountName: accountName,
        dpAmount: dpNum,
        dueDate: paymentType === 'Kredit' ? dueDate : date,
        notes: notes.trim(),
      });

      if (ok) {
        setInvoiceNumber('');
        setNotes('');
        setDpAmount('0');
        setDraftItems([{ rowId: Date.now(), inventoryId: '', qty: '1', unitPrice: '' }]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Summary metrics
  const monthlyStats = useMemo(() => {
    const inMonth = monthFilter ? purchases.filter(p => p.date.startsWith(monthFilter)) : purchases;
    const total = inMonth.reduce((s, p) => s + p.totalAmount, 0);
    const cashPaid = inMonth.filter(p => p.paymentType === 'Lunas').reduce((s, p) => s + p.totalAmount, 0);
    const creditTotal = inMonth.filter(p => p.paymentType === 'Kredit').reduce((s, p) => s + p.totalAmount, 0);
    return { count: inMonth.length, total, cashPaid, creditTotal };
  }, [purchases, monthFilter]);

  const filteredPurchases = useMemo(() => {
    return [...purchases]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.createdAt.localeCompare(a.createdAt))
      .filter(p => {
        if (monthFilter && !p.date.startsWith(monthFilter)) return false;
        if (statusFilter !== 'Semua' && p.paymentType !== statusFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchInvoice = p.invoiceNumber.toLowerCase().includes(q);
          const matchSupplier = p.supplierName.toLowerCase().includes(q);
          const matchItems = p.items.some(i => i.itemName.toLowerCase().includes(q));
          return matchInvoice || matchSupplier || matchItems;
        }
        return true;
      });
  }, [purchases, monthFilter, statusFilter, searchQuery]);

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPurchases.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPurchases, currentPage]);

  const handleDeleteClick = async (purchase: PurchaseRecord) => {
    const msg =
      purchase.paymentType === 'Lunas'
        ? `Hapus faktur pembelian "${purchase.invoiceNumber}"? Catatan pengeluaran operasional terkait akan ikut dihapus (stok inventori tidak berubah).`
        : `Hapus faktur pembelian "${purchase.invoiceNumber}"? Tagihan pemasok terkait akan ikut dihapus (stok inventori tidak berubah).`;
    if (window.confirm(msg)) {
      await onDeletePurchase(purchase);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-pink-500 to-rose-600">
          <p className="text-sm font-medium text-white/90">Total Pembelian ({monthFilter || 'Semua'})</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(monthlyStats.total)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-emerald-500 to-green-600">
          <p className="text-sm font-medium text-white/90">Pembelian Lunas</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(monthlyStats.cashPaid)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-amber-500 to-orange-600">
          <p className="text-sm font-medium text-white/90">Pembelian Kredit / Tempo</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(monthlyStats.creditTotal)}</p>
        </div>
        <div className="p-5 rounded-xl shadow-md text-white bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90">Total Faktur Masuk</p>
            <p className="text-2xl font-bold mt-1">{monthlyStats.count} Faktur</p>
          </div>
          <div className="p-3 bg-black/20 rounded-full">
            <TruckIcon className="h-7 w-7 text-white" />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Form Input Barang Masuk */}
        <div className="xl:col-span-5 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4 border-b pb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Input Barang Masuk / Pembelian</h2>
              <p className="text-xs text-gray-500">Daftar barang diambil dari Inventori &amp; dicatat ke keuangan (tidak mengubah stok fisik secara otomatis).</p>
            </div>
            <button
              type="button"
              onClick={() => setQuickInvOpen(true)}
              className="text-xs bg-pink-50 text-pink-700 border border-pink-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-pink-100 whitespace-nowrap"
            >
              + Bahan Baru
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tanggal Masuk</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">No. Faktur / Nota Supplier</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Kosongkan untuk auto"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Pemasok (Supplier)</label>
              {suppliers.length > 0 ? (
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.specialty || 'Umum'})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded">
                  Belum ada data Supplier. Silakan tambahkan di menu <b>Data Master → Supplier</b> terlebih dahulu.
                </p>
              )}
            </div>

            {/* Daftar Item Bahan Masuk */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Daftar Barang / Bahan Masuk</label>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center text-xs font-semibold text-pink-600 hover:text-pink-700"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1" /> Tambah Baris
                </button>
              </div>
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {computedItems.map((row, idx) => (
                  <div key={row.rowId} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-500">Item #{idx + 1}</span>
                      {draftItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <select
                      value={row.inventoryId}
                      onChange={e => handleRowChange(row.rowId, 'inventoryId', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm"
                      required
                    >
                      <option value="">-- Pilih Bahan / Barang --</option>
                      {inventory.map(inv => {
                        const cat = inventoryMetadata[inv.id]?.category || 'Bahan Baku';
                        return (
                          <option key={inv.id} value={inv.id}>
                            [{cat}] {inv.name} ({inv.unit})
                          </option>
                        );
                      })}
                    </select>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div>
                        <label className="block text-[11px] text-gray-500">Qty ({row.inv?.unit || 'Unit'})</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={row.qty}
                          onChange={e => handleRowChange(row.rowId, 'qty', e.target.value)}
                          className="w-full p-1.5 border border-gray-300 rounded-md text-sm bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500">Harga Satuan (Rp)</label>
                        <input
                          type="number"
                          min="0"
                          value={row.unitPrice}
                          onChange={e => handleRowChange(row.rowId, 'unitPrice', e.target.value)}
                          className="w-full p-1.5 border border-gray-300 rounded-md text-sm bg-white"
                          placeholder="0"
                          required
                        />
                      </div>
                      <div className="text-right">
                        <label className="block text-[11px] text-gray-500">Subtotal</label>
                        <p className="text-sm font-bold text-gray-800 pt-1">{formatCurrency(row.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center p-3 bg-pink-50 border border-pink-200 rounded-lg">
              <span className="text-sm font-bold text-pink-900">Total Faktur Pembelian</span>
              <span className="text-xl font-extrabold text-pink-600">{formatCurrency(grandTotal)}</span>
            </div>

            {/* Metode Pembayaran */}
            <div className="space-y-3 border-t pt-3">
              <label className="block text-sm font-medium text-gray-700">Status Pembayaran ke Pemasok</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('Lunas')}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-bold transition-colors ${
                    paymentType === 'Lunas'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Bayar Lunas
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('Kredit')}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-bold transition-colors ${
                    paymentType === 'Kredit'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Kredit / Tempo
                </button>
              </div>

              {paymentType === 'Lunas' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
                  <label className="block text-xs font-semibold text-emerald-800">Sumber Dana Pembayaran</label>
                  <select
                    value={fundingSource}
                    onChange={e => setFundingSource(e.target.value as ExpenseFundingSource)}
                    className="w-full p-2 border border-emerald-300 rounded-md bg-white text-sm"
                  >
                    <option value="Transfer Bank">Transfer Bank / Rekening Usaha</option>
                    <option value="Kas Laci">Kas Laci (Tunai)</option>
                    <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                  </select>
                  {fundingSource === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-emerald-800 mb-1">Pilih Rekening / Dompet Non-Tunai</label>
                      <select
                        value={fundingAccountId}
                        onChange={e => setFundingAccountId(e.target.value)}
                        className="w-full p-2 border border-emerald-300 rounded-md bg-white text-sm"
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
                  <p className="text-xs text-emerald-700">
                    Otomatis dicatat ke <b>Pengeluaran Operasional</b> sehingga tidak perlu input ulang.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-amber-900">Jatuh Tempo Tagihan</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        className="mt-1 w-full p-2 border border-amber-300 rounded-md bg-white text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-900">DP / Uang Muka (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        value={dpAmount}
                        onChange={e => setDpAmount(e.target.value)}
                        className="mt-1 w-full p-2 border border-amber-300 rounded-md bg-white text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {(parseFloat(dpAmount) || 0) > 0 && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-semibold text-amber-900">Sumber Dana DP</label>
                        <select
                          value={fundingSource}
                          onChange={e => setFundingSource(e.target.value as ExpenseFundingSource)}
                          className="mt-1 w-full p-2 border border-amber-300 rounded-md bg-white text-sm"
                        >
                          <option value="Transfer Bank">Transfer Bank / Rekening Usaha</option>
                          <option value="Kas Laci">Kas Laci (Tunai)</option>
                          <option value="Kas Dipegang Owner">Kas Dipegang Owner (Titipan Toko)</option>
                        </select>
                      </div>
                      {fundingSource === 'Transfer Bank' && nonCashAccounts.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-amber-900">Pilih Rekening / Dompet DP</label>
                          <select
                            value={fundingAccountId}
                            onChange={e => setFundingAccountId(e.target.value)}
                            className="mt-1 w-full p-2 border border-amber-300 rounded-md bg-white text-sm"
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
                    </div>
                  )}
                  <p className="text-xs text-amber-800">
                    Sisa tagihan <b>{formatCurrency(Math.max(0, grandTotal - (parseFloat(dpAmount) || 0)))}</b> akan otomatis masuk ke menu <b>Pengeluaran → Cicilan Bank & Pemasok</b>.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Catatan (Opsional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                placeholder="Misal: Surat jalan / diantar kurir"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving || suppliers.length === 0}
              className="w-full bg-pink-600 text-white py-2.5 rounded-lg font-bold hover:bg-pink-700 transition-colors disabled:bg-gray-300"
            >
              {isSaving ? 'Memproses...' : 'Simpan Barang Masuk'}
            </button>
          </form>
        </div>

        {/* Log / Riwayat Barang Masuk */}
        <div className="xl:col-span-7 bg-white p-6 rounded-xl shadow-md flex flex-col">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-800">Log Barang Masuk & Pembelian</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="p-2 border rounded-lg text-sm bg-white"
                title="Filter Bulan"
              />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'Semua' | 'Lunas' | 'Kredit')}
                className="p-2 border rounded-lg text-sm bg-white"
              >
                <option value="Semua">Semua Status</option>
                <option value="Lunas">Lunas</option>
                <option value="Kredit">Kredit / Tempo</option>
              </select>
            </div>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cari no. faktur, supplier, atau nama bahan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500 text-sm"
            />
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal / Faktur</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Pemasok</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Item Masuk</th>
                  <th className="py-3 px-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="py-3 px-3 text-center text-xs font-medium text-gray-500 uppercase">Pembayaran</th>
                  <th className="py-3 px-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <p className="font-semibold text-gray-800">{p.invoiceNumber}</p>
                      <p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('id-ID')}</p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-gray-700">{p.supplierName}</td>
                    <td className="py-3 px-3">
                      <p className="text-gray-800 truncate max-w-[200px]">
                        {p.items.map(i => `${i.itemName} (${i.qty} ${i.unit})`).join(', ')}
                      </p>
                      <p className="text-xs text-gray-400">{p.items.length} jenis bahan</p>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-800 whitespace-nowrap">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          p.paymentType === 'Lunas'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.paymentType}
                      </span>
                      {p.paymentType === 'Lunas' && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {p.fundingSource || 'Kas Laci'}{p.fundingAccountName ? ` • ${p.fundingAccountName}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => setDetailPurchase(p)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Lihat Detail Faktur"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Hapus Faktur Pembelian"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedPurchases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      Belum ada catatan barang masuk pada filter yang dipilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={filteredPurchases.length}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <QuickInventoryModal
        isOpen={isQuickInvOpen}
        onClose={() => setQuickInvOpen(false)}
        onSave={onAddInventoryItem}
      />

      <PurchaseDetailModal
        purchase={detailPurchase}
        onClose={() => setDetailPurchase(null)}
      />
    </div>
  );
};

export default Purchases;
