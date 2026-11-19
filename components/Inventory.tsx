import React, { useState, useMemo, useEffect } from 'react';
import {
  type InventoryItem,
  type InventoryCategory,
  type InventoryCondition,
  type InventoryItemMeta,
  type InventoryCheckStatus,
  type NotificationSettings,
  type PurchaseRecord,
} from '../types';
import { MagnifyingGlassIcon, PlusCircleIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, CheckCircleIcon, EyeIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

const INVENTORY_TABS: { key: InventoryCategory | 'Semua'; label: string; hint: string }[] = [
  { key: 'Bahan Baku', label: 'Bahan Baku', hint: 'Flexy, Sticker, Kertas, Tinta, Laminasi' },
  { key: 'ATK', label: 'ATK', hint: 'Bolpoin, Penggaris, Penghapus, Cutter, Lakban' },
  { key: 'Kebersihan', label: 'Kebersihan', hint: 'Sapu Ijuk, Sapu Lidi, Pel, Pembersih' },
  { key: 'Lain-Lain', label: 'Lain-Lain', hint: 'Perlengkapan kantor & produksi lainnya' },
  { key: 'Semua', label: 'Semua', hint: 'Gabungan seluruh kategori' },
];

const CATEGORY_BADGE_CLASS: Record<InventoryCategory, string> = {
  'Bahan Baku': 'bg-cyan-100 text-cyan-800',
  'ATK': 'bg-indigo-100 text-indigo-800',
  'Kebersihan': 'bg-emerald-100 text-emerald-800',
  'Lain-Lain': 'bg-slate-100 text-slate-800',
};

const CONDITION_BADGE_CLASS: Record<InventoryCondition, string> = {
  'Baik': 'bg-emerald-100 text-emerald-800',
  'Perlu Restock': 'bg-amber-100 text-amber-800',
  'Rusak / Perlu Ganti': 'bg-rose-100 text-rose-800',
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

const getDaysDiffFromNow = (iso?: string): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const startToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startTarget = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.floor((startToday - startTarget) / (1000 * 60 * 60 * 24)));
};

const formatDaysAgoLabel = (iso?: string): string => {
  const diff = getDaysDiffFromNow(iso);
  if (diff === null) return 'Belum pernah dicek';
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin (1 hari lalu)';
  return `${diff} hari lalu`;
};

// Modal for viewing history
const StockHistoryModal: React.FC<{
  item: InventoryItem;
  purchases: PurchaseRecord[];
  onClose: () => void;
}> = ({ item, purchases, onClose }) => {
  const [tab, setTab] = useState<'in' | 'out'>('out');
  const history = (item.usageHistory || []).slice(-20).reverse();
  const incomingHistory = useMemo(() => {
    const list: { date: string; invoiceNumber: string; supplierName: string; qty: number; unitPrice: number }[] = [];
    purchases.forEach(p => {
      p.items.forEach(pi => {
        if (pi.inventoryId === item.id) {
          list.push({
            date: p.date,
            invoiceNumber: p.invoiceNumber,
            supplierName: p.supplierName,
            qty: pi.qty,
            unitPrice: pi.unitPrice,
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, item.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-800">Riwayat Barang: {item.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex space-x-2 mb-4 border-b pb-2">
          <button
            onClick={() => setTab('out')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'out' ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Pemakaian Keluar ({history.length})
          </button>
          <button
            onClick={() => setTab('in')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'in' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Referensi Pembelian ({incomingHistory.length})
          </button>
        </div>
        {tab === 'in' && (
          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mb-3">
            *Catatan referensi dari menu Pembelian (angka stok fisik tetap dikelola manual).
          </p>
        )}
        <div className="flex-1 overflow-y-auto pr-2">
          {tab === 'in' ? (
            incomingHistory.length > 0 ? (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Pemasok &amp; Faktur</th>
                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Beli</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {incomingHistory.map((rec, index) => (
                    <tr key={index}>
                      <td className="py-2 px-3 text-sm">{new Date(rec.date).toLocaleDateString('id-ID')}</td>
                      <td className="py-2 px-3 text-sm">
                        <p className="font-medium text-gray-800">{rec.supplierName}</p>
                        <p className="text-xs text-gray-500">{rec.invoiceNumber}</p>
                      </td>
                      <td className="py-2 px-3 text-sm font-bold text-emerald-700 text-right">{rec.qty} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-gray-500 py-8">Belum ada riwayat pembelian barang ini.</p>
            )
          ) : history.length > 0 ? (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Pemakaian</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((record, index) => (
                  <tr key={index}>
                    <td className="py-2 px-3 text-sm">{new Date(record.date).toLocaleDateString('id-ID')}</td>
                    <td className="py-2 px-3 text-sm font-semibold text-red-600">-{record.amountUsed} {item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-gray-500 py-8">Belum ada riwayat pemakaian manual.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal for using stock
const UseStockModal: React.FC<{
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (amount: number, usageDate: string) => void;
}> = ({ item, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [usageDate, setUsageDate] = useState(new Date().toISOString().substring(0, 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      onConfirm(numAmount, usageDate);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-5">
          <h3 className="text-xl font-bold text-gray-800">Pakai Stok: {item.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">Stok Saat Ini</p>
            <p className="text-lg font-bold">{item.stock} {item.unit}</p>
          </div>
          <div>
            <label className="block text-sm font-medium">Jumlah Pemakaian</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md"
              required
              min="0.01"
              step="0.01"
              max={item.stock}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Tanggal Pemakaian</label>
            <input
              type="date"
              value={usageDate}
              onChange={e => setUsageDate(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md"
              required
            />
          </div>
          <div className="border-t pt-4 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
            <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal for Adding / Editing Inventory Item (Manual Stock + Condition + Category Tab)
const InventoryFormModal: React.FC<{
  item: InventoryItem | null;
  meta?: InventoryItemMeta;
  defaultCategory: InventoryCategory;
  onClose: () => void;
  onSave: (
    data: InventoryItem | Omit<InventoryItem, 'id'>,
    meta: Partial<InventoryItemMeta>
  ) => Promise<void>;
}> = ({ item, meta, defaultCategory, onClose, onSave }) => {
  const [name, setName] = useState(item?.name || '');
  const [sku, setSku] = useState(item?.sku || '');
  const [stock, setStock] = useState(item ? String(item.stock) : '0');
  const [unit, setUnit] = useState(item?.unit || (defaultCategory === 'Bahan Baku' ? 'Roll' : 'Pcs'));
  const [type, setType] = useState<'Bahan Baku' | 'Barang Jadi'>(item?.type || 'Bahan Baku');
  const [category, setCategory] = useState<InventoryCategory>(meta?.category || defaultCategory);
  const [condition, setCondition] = useState<InventoryCondition>(meta?.condition || 'Baik');
  const [notes, setNotes] = useState(meta?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) return;
    const stockNum = Math.max(0, parseFloat(stock) || 0);
    setIsSaving(true);
    try {
      const payloadBase = {
        name: name.trim(),
        sku: sku.trim() || `INV-${Date.now().toString().slice(-5)}`,
        stock: stockNum,
        unit: unit.trim(),
        type,
        usageHistory: item?.usageHistory || [],
      };
      const metaPayload: Partial<InventoryItemMeta> = {
        category,
        condition,
        notes: notes.trim() || undefined,
      };
      if (item) {
        await onSave({ ...payloadBase, id: item.id }, metaPayload);
      } else {
        await onSave(payloadBase, metaPayload);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-bold text-gray-800">
            {item ? `Update Stok & Kondisi: ${item.name}` : 'Tambah Barang Inventori'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Barang / Bahan</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md text-sm"
              placeholder={
                category === 'ATK'
                  ? 'Contoh: Bolpoin Standard AE7'
                  : category === 'Kebersihan'
                  ? 'Contoh: Sapu Ijuk'
                  : 'Contoh: Flexy 260g 260cm'
              }
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kategori Tab</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as InventoryCategory)}
                className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
              >
                <option value="Bahan Baku">Bahan Baku</option>
                <option value="ATK">ATK</option>
                <option value="Kebersihan">Kebersihan</option>
                <option value="Lain-Lain">Lain-Lain</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Kode / SKU</label>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md text-sm"
                placeholder="Kosongkan utk auto"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Stok Fisik Saat Ini</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={stock}
                onChange={e => setStock(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md text-sm font-bold"
                required
              />
              <p className="text-[11px] text-gray-400 mt-0.5">Mendukung desimal (misal 2.5 atau 120.5)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Satuan</label>
              <input
                type="text"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="mt-1 w-full p-2 border rounded-md text-sm"
                placeholder="Roll / m2 / Pcs / Rim"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Kondisi Barang</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value as InventoryCondition)}
                className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
              >
                <option value="Baik">Baik</option>
                <option value="Perlu Restock">Perlu Restock</option>
                <option value="Rusak / Perlu Ganti">Rusak / Perlu Ganti</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipe Dasar</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'Bahan Baku' | 'Barang Jadi')}
                className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
              >
                <option value="Bahan Baku">Bahan Baku</option>
                <option value="Barang Jadi">Barang Jadi</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Catatan Kondisi (Opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 w-full p-2 border rounded-md text-sm"
              placeholder="Misal: Sisa setengah roll / gagang mulai retak"
            />
          </div>
          <div className="border-t pt-3 flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-semibold">Batal</button>
            <button type="submit" disabled={isSaving} className="bg-pink-600 text-white py-2 px-5 rounded-lg font-bold text-sm hover:bg-pink-700 disabled:bg-pink-300">
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface InventoryProps {
  inventory: InventoryItem[];
  purchases: PurchaseRecord[];
  inventoryMetadata: Record<number, InventoryItemMeta>;
  inventoryCheckStatus: InventoryCheckStatus;
  onUseStock: (itemId: number, amountUsed: number, usageDate: string) => void;
  onAddInventoryItem: (newItem: Omit<InventoryItem, 'id'>, meta?: Partial<InventoryItemMeta>) => Promise<void>;
  onUpdateInventoryItem: (updatedItem: InventoryItem, meta?: Partial<InventoryItemMeta>) => Promise<void>;
  onDeleteInventoryItem: (id: number) => Promise<void>;
  onConfirmInventoryCheck: (category?: InventoryCategory | 'Semua') => Promise<void>;
  notificationSettings: NotificationSettings;
}

const Inventory: React.FC<InventoryProps> = ({
  inventory,
  purchases,
  inventoryMetadata,
  inventoryCheckStatus,
  onUseStock,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  onConfirmInventoryCheck,
  notificationSettings,
}) => {
  const [activeTab, setActiveTab] = useState<InventoryCategory | 'Semua'>('Bahan Baku');
  const [conditionFilter, setConditionFilter] = useState<'Semua' | InventoryCondition>('Semua');
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [useStockItem, setUseStockItem] = useState<InventoryItem | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isConfirmingCheck, setIsConfirmingCheck] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, conditionFilter]);

  const getItemCategory = (item: InventoryItem): InventoryCategory =>
    inventoryMetadata[item.id]?.category || 'Bahan Baku';

  const getItemCondition = (item: InventoryItem): InventoryCondition =>
    inventoryMetadata[item.id]?.condition || 'Baik';

  const categoryCounts = useMemo(() => {
    const counts: Record<InventoryCategory | 'Semua', number> = {
      'Bahan Baku': 0,
      'ATK': 0,
      'Kebersihan': 0,
      'Lain-Lain': 0,
      'Semua': inventory.length,
    };
    inventory.forEach(item => {
      const cat = inventoryMetadata[item.id]?.category || 'Bahan Baku';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [inventory, inventoryMetadata]);

  const handleConfirmUseStock = (item: InventoryItem, amount: number, usageDate: string) => {
    onUseStock(item.id, amount, usageDate);
    setUseStockItem(null);
  };

  const handleConfirmCheckClick = async (category: InventoryCategory | 'Semua') => {
    setIsConfirmingCheck(true);
    try {
      await onConfirmInventoryCheck(category);
    } finally {
      setIsConfirmingCheck(false);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock <= notificationSettings.lowStockThreshold) {
      return { text: 'Stok Menipis', color: 'bg-red-100 text-red-800' };
    }
    return { text: 'Tersedia', color: 'bg-cyan-100 text-cyan-800' };
  };

  const filteredInventory = useMemo(() => {
    const lowerCaseQuery = searchQuery.trim().toLowerCase();
    return inventory.filter(item => {
      const cat = getItemCategory(item);
      const cond = getItemCondition(item);
      if (activeTab !== 'Semua' && cat !== activeTab) return false;
      if (conditionFilter !== 'Semua' && cond !== conditionFilter) return false;
      if (lowerCaseQuery) {
        const notes = (inventoryMetadata[item.id]?.notes || '').toLowerCase();
        return (
          item.name.toLowerCase().includes(lowerCaseQuery) ||
          item.sku.toLowerCase().includes(lowerCaseQuery) ||
          notes.includes(lowerCaseQuery)
        );
      }
      return true;
    });
  }, [inventory, inventoryMetadata, activeTab, conditionFilter, searchQuery]);

  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredInventory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredInventory, currentPage]);

  // Global & active-tab last check banner state
  const globalDiffDays = getDaysDiffFromNow(inventoryCheckStatus.lastCheckedAt);
  const bannerStyle = useMemo(() => {
    if (globalDiffDays === null || globalDiffDays >= 7) {
      return {
        wrapper: 'bg-rose-50 border-rose-300 text-rose-900',
        badge: 'bg-rose-600 text-white',
        label: globalDiffDays === null ? 'Belum Pernah Dicek' : `Terlambat (${globalDiffDays} hari belum dicek)`,
        isWarning: true,
      };
    }
    if (globalDiffDays >= 3) {
      return {
        wrapper: 'bg-amber-50 border-amber-300 text-amber-900',
        badge: 'bg-amber-500 text-white',
        label: `Perlu Cek Ulang (${globalDiffDays} hari lalu)`,
        isWarning: true,
      };
    }
    return {
      wrapper: 'bg-emerald-50 border-emerald-300 text-emerald-900',
      badge: 'bg-emerald-600 text-white',
      label: globalDiffDays === 0 ? 'Sudah Dicek Hari Ini' : `Baru Dicek (${globalDiffDays} hari lalu)`,
      isWarning: false,
    };
  }, [globalDiffDays]);

  return (
    <div className="space-y-4">
      {/* NOTIFIKASI STATUS TERAKHIR DIPERIKSA (DI ATAS SEMUA TAB) */}
      <div className={`p-4 rounded-xl border shadow-sm ${bannerStyle.wrapper}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 flex-shrink-0">
              {bannerStyle.isWarning ? (
                <ExclamationTriangleIcon className="h-6 w-6 text-rose-600" />
              ) : (
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base">Status Pemeriksaan Inventori Kantor &amp; Bahan</h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${bannerStyle.badge}`}>
                  {bannerStyle.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm mt-1">
                Terakhir diperiksa:{' '}
                <b>{formatDateTimeID(inventoryCheckStatus.lastCheckedAt)}</b>
                {inventoryCheckStatus.lastCheckedBy ? (
                  <>
                    {' '}oleh <b>{inventoryCheckStatus.lastCheckedBy}</b>
                  </>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {(['Bahan Baku', 'ATK', 'Kebersihan', 'Lain-Lain'] as InventoryCategory[]).map(cat => {
                  const info = inventoryCheckStatus.byCategory?.[cat];
                  const d = getDaysDiffFromNow(info?.checkedAt);
                  const chipColor =
                    d === null || d >= 7
                      ? 'bg-white/80 border-rose-300 text-rose-800'
                      : d >= 3
                      ? 'bg-white/80 border-amber-300 text-amber-800'
                      : 'bg-white/80 border-emerald-300 text-emerald-800';
                  return (
                    <span
                      key={cat}
                      className={`text-[11px] px-2 py-0.5 rounded border font-medium ${chipColor}`}
                      title={info ? `Dicek ${formatDateTimeID(info.checkedAt)} oleh ${info.checkedBy}` : 'Belum pernah dicek'}
                    >
                      <b>{cat}:</b> {formatDaysAgoLabel(info?.checkedAt)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
            {activeTab !== 'Semua' && (
              <button
                type="button"
                disabled={isConfirmingCheck}
                onClick={() => handleConfirmCheckClick(activeTab)}
                className="px-3.5 py-2 rounded-lg bg-white border border-gray-300 text-gray-800 text-xs font-bold hover:bg-gray-50 shadow-sm disabled:opacity-50"
              >
                Tandai Tab &quot;{activeTab}&quot; Sudah Dicek
              </button>
            )}
            <button
              type="button"
              disabled={isConfirmingCheck}
              onClick={() => handleConfirmCheckClick('Semua')}
              className="px-3.5 py-2 rounded-lg bg-pink-600 text-white text-xs font-bold hover:bg-pink-700 shadow-sm disabled:opacity-50"
            >
              {isConfirmingCheck ? 'Menyimpan...' : 'Konfirmasi Semua Sudah Dicek Hari Ini'}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CARD + MULTI-TAB */}
      <div className="bg-white rounded-xl shadow-md">
        {/* Category Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Manajemen Stok / Inventori</h2>
              <p className="text-xs text-gray-500">
                Stok &amp; kondisi barang dikelola manual sesuai cek fisik (mendukung angka desimal / m² / roll).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center bg-pink-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-pink-700 transition-colors"
            >
              <PlusCircleIcon className="h-5 w-5 mr-1.5" /> Tambah Barang
            </button>
          </div>

          <nav className="-mb-px flex space-x-5 overflow-x-auto" aria-label="Tabs Kategori Inventori">
            {INVENTORY_TABS.map(tab => {
              const isActive = activeTab === tab.key;
              const tabInfo = tab.key !== 'Semua' ? inventoryCheckStatus.byCategory?.[tab.key] : undefined;
              const tabDays = tab.key !== 'Semua' ? getDaysDiffFromNow(tabInfo?.checkedAt) : null;
              const needsAlert = tab.key !== 'Semua' && (tabDays === null || tabDays >= 7);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  title={tab.hint}
                  className={`${
                    isActive
                      ? 'border-pink-600 text-pink-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm flex items-center space-x-1.5 transition-colors`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 text-[11px] rounded-full ${
                      isActive ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {categoryCounts[tab.key]}
                  </span>
                  {needsAlert && (
                    <span
                      className="h-2 w-2 rounded-full bg-rose-500 inline-block"
                      title="Belum dicek atau sudah >= 7 hari"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Filters & Table */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="relative w-full md:w-1/3">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Cari nama barang, SKU, atau catatan..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500 text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Filter Kondisi:</span>
              <select
                value={conditionFilter}
                onChange={e => setConditionFilter(e.target.value as 'Semua' | InventoryCondition)}
                className="p-2 border rounded-lg bg-white text-sm"
              >
                <option value="Semua">Semua Kondisi</option>
                <option value="Baik">Baik</option>
                <option value="Perlu Restock">Perlu Restock</option>
                <option value="Rusak / Perlu Ganti">Rusak / Perlu Ganti</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Barang</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok Fisik</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kondisi &amp; Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update Terakhir</th>
                  <th className="py-3 px-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedInventory.map(item => {
                  const meta = inventoryMetadata[item.id];
                  const category = getItemCategory(item);
                  const condition = getItemCondition(item);
                  const stockBadge = getStockBadge(item.stock);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-gray-800">{item.name}</p>
                        {meta?.notes && <p className="text-xs text-gray-500 italic mt-0.5">{meta.notes}</p>}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-600">{item.sku}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${CATEGORY_BADGE_CLASS[category]}`}>
                          {category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-gray-800">
                        {`${item.stock} ${item.unit}`}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${CONDITION_BADGE_CLASS[condition]}`}>
                            {condition}
                          </span>
                          {item.stock <= notificationSettings.lowStockThreshold && (
                            <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${stockBadge.color}`}>
                              {stockBadge.text}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-gray-500">
                        {meta?.updatedAt ? (
                          <div>
                            <p className="font-medium text-gray-700">{formatDateTimeID(meta.updatedAt)}</p>
                            {meta.updatedBy && <p className="text-[11px] text-gray-400">oleh {meta.updatedBy}</p>}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-xs font-semibold"
                            title="Update Stok Fisik, Kategori & Kondisi"
                          >
                            <PencilIcon className="h-3.5 w-3.5 mr-1" /> Update
                          </button>
                          <button
                            onClick={() => setUseStockItem(item)}
                            className="px-2.5 py-1 bg-pink-50 text-pink-700 hover:bg-pink-100 rounded text-xs font-semibold"
                            title="Catat Pemakaian Stok"
                          >
                            Pakai
                          </button>
                          <button
                            onClick={() => setHistoryItem(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Lihat Riwayat"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus barang "${item.name}" dari Inventori?`)) {
                                onDeleteInventoryItem(item.id);
                              }
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Hapus Barang"
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
            {paginatedInventory.length === 0 && (
              <div className="text-center py-14 text-gray-500">
                <p>
                  Belum ada data barang pada tab <b>{activeTab}</b>
                  {conditionFilter !== 'Semua' ? ` dengan kondisi "${conditionFilter}"` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="mt-3 text-pink-600 font-semibold text-sm hover:underline"
                >
                  + Tambah barang di tab {activeTab === 'Semua' ? 'Bahan Baku' : activeTab}
                </button>
              </div>
            )}
          </div>

          <Pagination
            totalItems={filteredInventory.length}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {historyItem && (
        <StockHistoryModal
          item={historyItem}
          purchases={purchases}
          onClose={() => setHistoryItem(null)}
        />
      )}
      {useStockItem && (
        <UseStockModal
          item={useStockItem}
          onClose={() => setUseStockItem(null)}
          onConfirm={(amount, usageDate) => handleConfirmUseStock(useStockItem, amount, usageDate)}
        />
      )}
      {(isAddOpen || editingItem) && (
        <InventoryFormModal
          item={editingItem}
          meta={editingItem ? inventoryMetadata[editingItem.id] : undefined}
          defaultCategory={activeTab === 'Semua' ? 'Bahan Baku' : activeTab}
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
          onSave={async (data, meta) => {
            if ('id' in data) {
              await onUpdateInventoryItem(data, meta);
            } else {
              await onAddInventoryItem(data, meta);
            }
          }}
        />
      )}
    </div>
  );
};

export default Inventory;
