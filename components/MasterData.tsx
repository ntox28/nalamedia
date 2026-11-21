

import React, { useState, useMemo, useEffect } from 'react';
import { type ProductData, type ProductCostMeta, type ProductCostGroup, type CategoryData, type FinishingData, type CustomerData, type SupplierData, type EmployeeData, type UserLevel } from '../types';
import * as XLSX from 'xlsx';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon } from './Icons';
import Pagination from './Pagination';
import { resolveEffectiveProductCost } from './reportUtils';

const ITEMS_PER_PAGE = 20;

const TABS = [
    { key: 'products', label: 'Produk & Layanan' },
    { key: 'categories', label: 'Kategori' },
    { key: 'finishings', label: 'Finishing' },
    { key: 'customers', label: 'Pelanggan' },
    { key: 'suppliers', label: 'Supplier' },
    { key: 'karyawan', label: 'Karyawan' },
];

interface MasterDataProps {
  products: ProductData[];
  productCostMetadata?: Record<number, ProductCostMeta>;
  productCostGroups?: ProductCostGroup[];
  categories: CategoryData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  suppliers: SupplierData[];
  employees: EmployeeData[];
  menuPermissions: string[];
  userLevel?: UserLevel;
  onAddProduct: (newProduct: Omit<ProductData, 'id'>, costPrice?: number, costGroupId?: string) => void;
  onUpdateProduct: (updatedProduct: ProductData, costPrice?: number, costGroupId?: string) => void;
  onDeleteProduct: (id: number) => void;
  onSaveProductCostGroup?: (group: Omit<ProductCostGroup, 'id' | 'updatedAt' | 'updatedBy'> & { id?: string }) => Promise<void>;
  onDeleteProductCostGroup?: (groupId: string, keepLastPriceAsManual?: boolean) => Promise<void>;
  onBulkUpdateProductCosts?: (updates: Array<{ productId: number; mode: 'group' | 'manual' | 'clear'; costGroupId?: string; costPrice?: number }>) => Promise<void>;
  onAddCategory: (newCategory: Omit<CategoryData, 'id'>) => void;
  onUpdateCategory: (updatedCategory: CategoryData) => void;
  onDeleteCategory: (id: number) => void;
  onAddFinishing: (newFinishing: Omit<FinishingData, 'id'>) => void;
  onUpdateFinishing: (updatedFinishing: FinishingData) => void;
  onDeleteFinishing: (id: number) => void;
  onAddCustomer: (newCustomer: Omit<CustomerData, 'id' | 'joinDate'>) => void;
  onUpdateCustomer: (updatedCustomer: CustomerData) => void;
  onDeleteCustomer: (id: number) => void;
  onAddSupplier: (newSupplier: Omit<SupplierData, 'id'>) => void;
  onUpdateSupplier: (updatedSupplier: SupplierData) => void;
  onDeleteSupplier: (id: number) => void;
  onAddEmployee: (newEmployee: Omit<EmployeeData, 'id' | 'joinDate'>) => void;
  onUpdateEmployee: (updatedEmployee: EmployeeData) => void;
  onDeleteEmployee: (id: number) => void;
}


// Reusable Modal Component
const Modal: React.FC<{ show: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ show, onClose, title, children }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

const ProductForm: React.FC<{
    categories: CategoryData[];
    costGroups: ProductCostGroup[];
    initialData?: ProductData | null;
    initialMeta?: ProductCostMeta;
    onSubmit: (data: any) => void;
}> = ({ categories, costGroups, initialData, initialMeta, onSubmit }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [category, setCategory] = useState(initialData?.category || categories[0]?.name || '');
    const [prices, setPrices] = useState({
        endCustomer: initialData ? String(initialData.price.endCustomer) : '',
        retail: initialData ? String(initialData.price.retail) : '',
        grosir: initialData ? String(initialData.price.grosir) : '',
        reseller: initialData ? String(initialData.price.reseller) : '',
        corporate: initialData ? String(initialData.price.corporate) : '',
    });
    const hasInitialGroup = Boolean(initialMeta?.costGroupId && costGroups.some(g => g.id === initialMeta.costGroupId));
    const [costMode, setCostMode] = useState<'group' | 'manual'>(hasInitialGroup ? 'group' : 'manual');
    const [selectedGroupId, setSelectedGroupId] = useState<string>(hasInitialGroup ? (initialMeta?.costGroupId || '') : '');
    const [costPrice, setCostPrice] = useState(initialMeta?.costPrice && initialMeta.costPrice > 0 ? String(initialMeta.costPrice) : '');

    const selectedCategoryUnit = useMemo(
        () => categories.find(c => c.name === category)?.unitType || 'Per Buah',
        [categories, category]
    );

    const selectedGroup = useMemo(
        () => costGroups.find(g => g.id === selectedGroupId),
        [costGroups, selectedGroupId]
    );

    const sortedGroups = useMemo(() => {
        return [...costGroups].sort((a, b) => {
            const aMatch = a.unitType === selectedCategoryUnit ? 0 : 1;
            const bMatch = b.unitType === selectedCategoryUnit ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
            return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
        });
    }, [costGroups, selectedCategoryUnit]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit({
            ...(initialData ? { id: initialData.id } : {}),
            name,
            category,
            price: {
                endCustomer: Number(prices.endCustomer) || 0,
                retail: Number(prices.retail) || 0,
                grosir: Number(prices.grosir) || 0,
                reseller: Number(prices.reseller) || 0,
                corporate: Number(prices.corporate) || 0,
            },
            costPrice: costMode === 'group' && selectedGroupId
                ? undefined
                : (costPrice.trim() === '' ? 0 : Math.max(0, Number(costPrice) || 0)),
            costGroupId: costMode === 'group' && selectedGroupId ? selectedGroupId : '',
        });
    };

    const commonInputClass = "mt-1 w-full p-2 border border-gray-300 rounded-md";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-600">Nama Produk/Layanan</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama Produk/Layanan" className={commonInputClass} required />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600">Kategori</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className={commonInputClass} required>
                    <option value="" disabled>Pilih Kategori</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </div>
            <div>
              <label className="text-sm font-medium">Harga</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                    <span className="text-[11px] text-gray-500">End Customer</span>
                    <input value={prices.endCustomer} onChange={e => setPrices(p => ({ ...p, endCustomer: e.target.value }))} type="number" placeholder="End Customer" className="w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                <div>
                    <span className="text-[11px] text-gray-500">Retail</span>
                    <input value={prices.retail} onChange={e => setPrices(p => ({ ...p, retail: e.target.value }))} type="number" placeholder="Retail" className="w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                <div>
                    <span className="text-[11px] text-gray-500">Grosir</span>
                    <input value={prices.grosir} onChange={e => setPrices(p => ({ ...p, grosir: e.target.value }))} type="number" placeholder="Grosir" className="w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                <div>
                    <span className="text-[11px] text-gray-500">Reseller</span>
                    <input value={prices.reseller} onChange={e => setPrices(p => ({ ...p, reseller: e.target.value }))} type="number" placeholder="Reseller" className="w-full p-2 border border-gray-300 rounded-md" required />
                </div>
                <div>
                    <span className="text-[11px] text-gray-500">Corporate</span>
                    <input value={prices.corporate} onChange={e => setPrices(p => ({ ...p, corporate: e.target.value }))} type="number" placeholder="Corporate" className="w-full p-2 border border-gray-300 rounded-md" required />
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-gray-700">
                        Estimasi Modal / HPP ({selectedCategoryUnit === 'Per Luas' ? 'per m²' : 'per pcs/unit'})
                    </label>
                    {costGroups.length > 0 && (
                        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-[11px]">
                            <button
                                type="button"
                                onClick={() => setCostMode('group')}
                                className={`px-2 py-0.5 font-medium ${costMode === 'group' ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                            >
                                Ikut Grup
                            </button>
                            <button
                                type="button"
                                onClick={() => setCostMode('manual')}
                                className={`px-2 py-0.5 font-medium ${costMode === 'manual' ? 'bg-pink-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                            >
                                Manual
                            </button>
                        </div>
                    )}
                </div>
                {costMode === 'group' && costGroups.length > 0 ? (
                    <div>
                        <select
                            value={selectedGroupId}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className={`${commonInputClass} bg-white text-sm`}
                        >
                            <option value="">-- Pilih Grup Modal Bahan --</option>
                            {sortedGroups.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.name} — Rp {g.costPrice.toLocaleString('id-ID')}/{g.unitType === 'Per Luas' ? 'm²' : 'pcs'} ({g.unitType})
                                </option>
                            ))}
                        </select>
                        {selectedGroup && selectedGroup.unitType !== selectedCategoryUnit && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                                Perhatian: Kategori produk bertipe <strong>{selectedCategoryUnit}</strong>, sedangkan grup ini bertipe <strong>{selectedGroup.unitType}</strong>.
                            </p>
                        )}
                    </div>
                ) : (
                    <input
                        value={costPrice}
                        onChange={e => setCostPrice(e.target.value)}
                        type="number"
                        min="0"
                        placeholder={`Contoh: 12000 (kosongkan jika belum ada)`}
                        className={commonInputClass}
                    />
                )}
                <p className="text-[11px] text-gray-500">
                    Hanya dipakai untuk estimasi HPP &amp; Margin di Laporan Penjualan per Kategori. Tidak memengaruhi transaksi kasir.
                </p>
            </div>
            <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 mt-4">
                {initialData ? 'Simpan Perubahan' : 'Simpan'}
            </button>
        </form>
    );
}

// --- Kelola Grup Modal Bahan (HPP) ---
const CostGroupsModal: React.FC<{
  show: boolean;
  onClose: () => void;
  groups: ProductCostGroup[];
  productCostMetadata: Record<number, ProductCostMeta>;
  onSaveGroup: (group: Omit<ProductCostGroup, 'id' | 'updatedAt' | 'updatedBy'> & { id?: string }) => Promise<void>;
  onDeleteGroup: (groupId: string, keepLastPriceAsManual?: boolean) => Promise<void>;
}> = ({ show, onClose, groups, productCostMetadata, onSaveGroup, onDeleteGroup }) => {
  const [editingGroup, setEditingGroup] = useState<ProductCostGroup | null>(null);
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState<'Per Luas' | 'Per Buah'>('Per Luas');
  const [costPrice, setCostPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const usageCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    (Object.values(productCostMetadata) as ProductCostMeta[]).forEach(meta => {
      if (meta?.costGroupId) {
        counts.set(meta.costGroupId, (counts.get(meta.costGroupId) || 0) + 1);
      }
    });
    return counts;
  }, [productCostMetadata]);

  useEffect(() => {
    if (!show) {
      setEditingGroup(null);
      setName('');
      setUnitType('Per Luas');
      setCostPrice('');
      setNotes('');
    }
  }, [show]);

  if (!show) return null;

  const handleStartEdit = (g: ProductCostGroup) => {
    setEditingGroup(g);
    setName(g.name);
    setUnitType(g.unitType);
    setCostPrice(String(g.costPrice));
    setNotes(g.notes || '');
  };

  const handleResetForm = () => {
    setEditingGroup(null);
    setName('');
    setUnitType('Per Luas');
    setCostPrice('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericCost = Number(costPrice);
    if (!name.trim() || !numericCost || numericCost <= 0) {
      alert('Isi nama grup dan nominal HPP lebih dari 0.');
      return;
    }
    setIsSaving(true);
    try {
      await onSaveGroup({
        ...(editingGroup ? { id: editingGroup.id } : {}),
        name: name.trim(),
        unitType,
        costPrice: numericCost,
        notes: notes.trim() || undefined,
      });
      handleResetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (g: ProductCostGroup) => {
    const linkedCount = usageCountByGroup.get(g.id) || 0;
    const msg = linkedCount > 0
      ? `Grup "${g.name}" sedang dipakai oleh ${linkedCount} produk.\n\nJika dihapus, ke-${linkedCount} produk tersebut akan otomatis menyimpan nilai terakhir (Rp ${g.costPrice.toLocaleString('id-ID')}) sebagai HPP manual agar laporan margin tidak mendadak nol.\n\nLanjutkan hapus grup?`
      : `Hapus grup modal bahan "${g.name}"?`;
    if (!window.confirm(msg)) return;
    await onDeleteGroup(g.id, true);
    if (editingGroup?.id === g.id) handleResetForm();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Kelola Grup Modal Bahan (HPP Bersama)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ubah harga modal di sini sekali saja, maka semua produk yang tertaut otomatis ikut ter-update.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          <form onSubmit={handleSubmit} className="p-4 border border-indigo-200 rounded-lg bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm text-indigo-900">
                {editingGroup ? `Edit Grup: ${editingGroup.name}` : 'Tambah Grup Modal Bahan Baru'}
              </h4>
              {editingGroup && (
                <button type="button" onClick={handleResetForm} className="text-xs text-gray-600 hover:underline">
                  Batal Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Nama Bahan / Grup</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Flexy 280gr"
                  className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Tipe Satuan</label>
                <select
                  value={unitType}
                  onChange={e => setUnitType(e.target.value as 'Per Luas' | 'Per Buah')}
                  className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                >
                  <option value="Per Luas">Per Luas (m²)</option>
                  <option value="Per Buah">Per Buah (pcs)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Est. HPP / {unitType === 'Per Luas' ? 'm²' : 'pcs'} (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  value={costPrice}
                  onChange={e => setCostPrice(e.target.value)}
                  placeholder="8500"
                  className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700">Catatan (Opsional)</label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Misal: Bahan + tinta standar"
                  className="mt-1 w-full p-2 border rounded-md bg-white text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-indigo-600 text-white px-5 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 whitespace-nowrap"
              >
                {isSaving ? 'Menyimpan...' : editingGroup ? 'Update Grup' : '+ Simpan Grup'}
              </button>
            </div>
          </form>

          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Grup Bahan</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Satuan</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600 uppercase">Est. HPP</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600 uppercase">Produk Terhubung</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {groups.map(g => {
                  const count = usageCountByGroup.get(g.id) || 0;
                  return (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-gray-800">{g.name}</p>
                        {g.notes && <p className="text-[11px] text-gray-500">{g.notes}</p>}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">{g.unitType}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(g.costPrice)}/{g.unitType === 'Per Luas' ? 'm²' : 'pcs'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${count > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>
                          {count} produk
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                        <button type="button" onClick={() => handleStartEdit(g)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit Grup">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(g)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Hapus Grup">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                      Belum ada Grup Modal Bahan. Buat grup pertama di form atas (misal: <strong>Flexy 280gr</strong>).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Modal Atur HPP Massal ---
const BulkCostAssignModal: React.FC<{
  show: boolean;
  onClose: () => void;
  products: ProductData[];
  categories: CategoryData[];
  productCostMetadata: Record<number, ProductCostMeta>;
  costGroups: ProductCostGroup[];
  onBulkApply: (updates: Array<{ productId: number; mode: 'group' | 'manual' | 'clear'; costGroupId?: string; costPrice?: number }>) => Promise<void>;
  onOpenCostGroupsModal: () => void;
}> = ({ show, onClose, products, categories, productCostMetadata, costGroups, onBulkApply, onOpenCostGroupsModal }) => {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unset' | 'set' | 'group' | 'manual'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [applyMode, setApplyMode] = useState<'group' | 'manual' | 'clear'>(costGroups.length > 0 ? 'group' : 'manual');
  const [targetGroupId, setTargetGroupId] = useState<string>(costGroups[0]?.id || '');
  const [manualCostInput, setManualCostInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (show) {
      setSuccessMsg('');
      if (costGroups.length > 0 && !costGroups.some(g => g.id === targetGroupId)) {
        setTargetGroupId(costGroups[0].id);
      }
      if (costGroups.length === 0 && applyMode === 'group') {
        setApplyMode('manual');
      }
    } else {
      setSelectedIds(new Set());
      setSearchText('');
      setCategoryFilter('ALL');
      setStatusFilter('all');
      setSuccessMsg('');
    }
  }, [show, costGroups]);

  const categoryUnitMap = useMemo(
    () => new Map<string, 'Per Luas' | 'Per Buah'>(categories.map(c => [c.name, c.unitType])),
    [categories]
  );

  const costGroupsMap = useMemo(
    () => new Map<string, ProductCostGroup>(costGroups.map(g => [g.id, g])),
    [costGroups]
  );

  const filteredProducts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return products.filter(p => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;

      const eff = resolveEffectiveProductCost(p.id, productCostMetadata, costGroupsMap);
      if (statusFilter === 'unset' && eff.source !== 'none') return false;
      if (statusFilter === 'set' && eff.source === 'none') return false;
      if (statusFilter === 'group' && eff.source !== 'group') return false;
      if (statusFilter === 'manual' && eff.source !== 'manual') return false;
      return true;
    });
  }, [products, searchText, categoryFilter, statusFilter, productCostMetadata, costGroupsMap]);

  const selectedGroupObj = costGroupsMap.get(targetGroupId);
  const mismatchedSelectedCount = useMemo(() => {
    if (applyMode !== 'group' || !selectedGroupObj) return 0;
    let count = 0;
    selectedIds.forEach(pid => {
      const prod = products.find(p => p.id === pid);
      if (prod) {
        const uType = categoryUnitMap.get(prod.category) || 'Per Buah';
        if (uType !== selectedGroupObj.unitType) count += 1;
      }
    });
    return count;
  }, [applyMode, selectedGroupObj, selectedIds, products, categoryUnitMap]);

  if (!show) return null;

  const toggleOne = (id: number) => {
    setSuccessMsg('');
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSuccessMsg('');
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredProducts.forEach(p => next.add(p.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      alert('Pilih minimal 1 produk terlebih dahulu.');
      return;
    }
    if (applyMode === 'group' && !targetGroupId) {
      alert('Pilih Grup Modal Bahan terlebih dahulu.');
      return;
    }
    if (applyMode === 'manual') {
      const num = Number(manualCostInput);
      if (!num || num <= 0) {
        alert('Masukkan nominal HPP manual lebih dari 0.');
        return;
      }
    }
    if (applyMode === 'clear' && !window.confirm(`Kosongkan HPP pada ${selectedIds.size} produk terpilih?`)) {
      return;
    }

    setIsApplying(true);
    try {
      const updates = Array.from(selectedIds).map(productId => ({
        productId,
        mode: applyMode,
        ...(applyMode === 'group' ? { costGroupId: targetGroupId } : {}),
        ...(applyMode === 'manual' ? { costPrice: Number(manualCostInput) } : {}),
      }));
      await onBulkApply(updates);
      setSuccessMsg(`Berhasil menerapkan perubahan HPP ke ${selectedIds.size} produk.`);
      setSelectedIds(new Set());
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Atur HPP Massal Produk</h3>
            <p className="text-xs text-gray-500 mt-0.5">Cari varian sejenis (misal &ldquo;flexy 280&rdquo;), centang sekaligus, lalu tautkan ke 1 Grup Bahan atau isi nominal HPP.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Cari produk (misal: flexy 280)..."
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="p-2 border rounded-md text-sm bg-white"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name} ({c.unitType})</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="p-2 border rounded-md text-sm bg-white"
          >
            <option value="all">Semua Status HPP</option>
            <option value="unset">Belum Ada HPP</option>
            <option value="set">Sudah Ada HPP</option>
            <option value="group">Pakai Grup Bahan</option>
            <option value="manual">Pakai HPP Manual</option>
          </select>
        </div>

        {/* Selection Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSelectAllVisible} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded font-semibold text-gray-700">
              Pilih Semua yang Tampil ({filteredProducts.length})
            </button>
            {selectedIds.size > 0 && (
              <button type="button" onClick={handleClearSelection} className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600">
                Batal Pilih
              </button>
            )}
          </div>
          <span className="font-semibold text-pink-700">
            {selectedIds.size} produk dipilih
          </span>
        </div>

        {/* Product Checklist */}
        <div className="flex-1 overflow-y-auto border rounded-lg mb-4 min-h-[180px]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3 w-10 text-center">✓</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Nama Produk</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase">Kategori</th>
                <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase">HPP Saat Ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map(p => {
                const isChecked = selectedIds.has(p.id);
                const eff = resolveEffectiveProductCost(p.id, productCostMetadata, costGroupsMap);
                const uType = categoryUnitMap.get(p.category) || 'Per Buah';
                const uLabel = uType === 'Per Luas' ? 'm²' : 'pcs';
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggleOne(p.id)}
                    className={`cursor-pointer hover:bg-pink-50/50 ${isChecked ? 'bg-pink-50' : ''}`}
                  >
                    <td className="py-2 px-3 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(p.id)}
                        className="h-4 w-4 text-pink-600 rounded"
                      />
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-800">{p.name}</td>
                    <td className="py-2 px-3 text-xs text-gray-600">{p.category} ({uLabel})</td>
                    <td className="py-2 px-3 text-right text-xs">
                      {eff.source === 'group' && eff.group ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="font-semibold text-amber-700">Rp {eff.costPrice.toLocaleString('id-ID')}/{uLabel}</span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">{eff.group.name}</span>
                        </span>
                      ) : eff.source === 'manual' ? (
                        <span className="font-semibold text-amber-700">Rp {eff.costPrice.toLocaleString('id-ID')}/{uLabel} <span className="text-gray-400 font-normal">(Manual)</span></span>
                      ) : (
                        <span className="text-gray-400 italic">Belum diisi</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">Tidak ada produk yang cocok dengan filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {successMsg && (
          <div className="mb-3 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
            {successMsg}
          </div>
        )}

        {/* Action Panel */}
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setApplyMode('group')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${applyMode === 'group' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                Tautkan ke Grup Bahan
              </button>
              <button
                type="button"
                onClick={() => setApplyMode('manual')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${applyMode === 'manual' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                Isi HPP Manual Sekaligus
              </button>
              <button
                type="button"
                onClick={() => setApplyMode('clear')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold border ${applyMode === 'clear' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                Kosongkan HPP
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenCostGroupsModal}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              + Kelola / Buat Grup Bahan
            </button>
          </div>

          {applyMode === 'group' && (
            <div className="space-y-1.5">
              {costGroups.length > 0 ? (
                <select
                  value={targetGroupId}
                  onChange={e => setTargetGroupId(e.target.value)}
                  className="w-full p-2 border rounded-md bg-white text-sm"
                >
                  <option value="">-- Pilih Grup Modal Bahan --</option>
                  {costGroups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} — Rp {g.costPrice.toLocaleString('id-ID')}/{g.unitType === 'Per Luas' ? 'm²' : 'pcs'} ({g.unitType})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Belum ada Grup Modal Bahan. Klik <strong>&ldquo;+ Kelola / Buat Grup Bahan&rdquo;</strong> di kanan atas untuk membuat grup terlebih dahulu.
                </p>
              )}
              {mismatchedSelectedCount > 0 && selectedGroupObj && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                  Perhatian: Ada <strong>{mismatchedSelectedCount} produk terpilih</strong> yang tipe satuannya berbeda dengan satuan grup <strong>{selectedGroupObj.unitType}</strong>. Pastikan satuannya sudah benar sebelum menerapkan.
                </p>
              )}
            </div>
          )}

          {applyMode === 'manual' && (
            <input
              type="number"
              min="1"
              value={manualCostInput}
              onChange={e => setManualCostInput(e.target.value)}
              placeholder="Masukkan nominal Est. HPP (Rp) per m² / pcs..."
              className="w-full p-2 border rounded-md bg-white text-sm"
            />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
              Tutup
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || selectedIds.size === 0 || (applyMode === 'group' && costGroups.length === 0)}
              className="px-5 py-2 rounded-lg text-sm font-bold bg-pink-600 text-white hover:bg-pink-700 disabled:bg-pink-300"
            >
              {isApplying ? 'Menerapkan...' : `Terapkan ke ${selectedIds.size} Produk`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Import/Export Modal ---
const ImportExportModal: React.FC<{
  show: boolean;
  onClose: () => void;
  products: ProductData[];
  productCostMetadata?: Record<number, ProductCostMeta>;
  productCostGroups?: ProductCostGroup[];
  categories: CategoryData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  suppliers: SupplierData[];
  employees: EmployeeData[];
  onAddProduct: (newProduct: Omit<ProductData, 'id'>, costPrice?: number, costGroupId?: string) => void;
  onAddCategory: (newCategory: Omit<CategoryData, 'id'>) => void;
  onAddFinishing: (newFinishing: Omit<FinishingData, 'id'>) => void;
  onAddCustomer: (newCustomer: Omit<CustomerData, 'id' | 'joinDate'>) => void;
  onAddSupplier: (newSupplier: Omit<SupplierData, 'id'>) => void;
  onAddEmployee: (newEmployee: Omit<EmployeeData, 'id' | 'joinDate'>) => void;
}> = ({ show, onClose, products, productCostMetadata = {}, productCostGroups = [], categories, finishings, customers, suppliers, employees, onAddProduct, onAddCategory, onAddFinishing, onAddCustomer, onAddSupplier, onAddEmployee }) => {
    
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setUploadedFile(event.target.files[0]);
        }
    };
    
    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Contoh Produk", kategori: "Cetak Kertas", harga_end_customer: 50000, harga_retail: 45000, harga_grosir: 42000, harga_reseller: 40000, harga_corporate: 38000, hpp_modal: 25000 }]), "Produk & Layanan");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Cetak Kertas", tipe_satuan: "Per Buah" }]), "Kategori");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Laminasi Doff", harga: 5000 }]), "Finishing");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Pelanggan Baru", kontak: "08123456789", level: "End Customer" }]), "Pelanggan");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Supplier Kertas", kontak_person: "Bapak Budi", telepon: "021-555-123", spesialisasi: "Kertas" }]), "Supplier");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ nama: "Andi", kontak: "08987654321", divisi: "Produksi" }]), "Karyawan");
        XLSX.writeFile(wb, "Template_Import_Data_Master.xlsx");
    };

    const handleExportData = () => {
        try {
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(products.map(p => {
                const eff = resolveEffectiveProductCost(p.id, productCostMetadata, productCostGroups);
                return { nama: p.name, kategori: p.category, harga_end_customer: p.price.endCustomer, harga_retail: p.price.retail, harga_grosir: p.price.grosir, harga_reseller: p.price.reseller, harga_corporate: p.price.corporate, hpp_modal: eff.costPrice || 0, grup_hpp: eff.group?.name || '' };
            })), "Produk & Layanan");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories.map(c => ({ nama: c.name, tipe_satuan: c.unitType }))), "Kategori");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finishings.map(f => ({ nama: f.name, harga: f.price }))), "Finishing");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customers.map(c => ({ nama: c.name, kontak: c.contact, level: c.level }))), "Pelanggan");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppliers.map(s => ({ nama: s.name, kontak_person: s.contactPerson, telepon: s.phone, spesialisasi: s.specialty }))), "Supplier");
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees.map(e => ({ nama: e.name, kontak: e.contact, divisi: e.division }))), "Karyawan");
            XLSX.writeFile(wb, "Data_Master_NalaMedia.xlsx");
        } catch (error) {
            console.error("Error exporting data:", error);
            alert("Terjadi kesalahan saat mengekspor data.");
        }
    };
    
    const handleImportData = () => {
        if (!uploadedFile) return;
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'array' });
                let summaryParts: string[] = [];
                
                const newItems: {
                    categories: Omit<CategoryData, 'id'>[],
                    finishings: Omit<FinishingData, 'id'>[],
                    customers: Omit<CustomerData, 'id'|'joinDate'>[],
                    suppliers: Omit<SupplierData, 'id'>[],
                    employees: Omit<EmployeeData, 'id'|'joinDate'>[],
                    products: { data: Omit<ProductData, 'id'>; costPrice?: number }[]
                } = { categories: [], finishings: [], customers: [], suppliers: [], employees: [], products: [] };

                const failedProducts: string[] = [];

                const extractFromSheet = <T, U>(sheetName: string, existingData: T[], targetArray: U[], transform: (row: any) => U | null, nameKey: keyof U, importNameKey: string) => {
                    const ws = wb.Sheets[sheetName];
                    if (!ws) return;
                    const importedData: any[] = XLSX.utils.sheet_to_json(ws);
                    importedData.forEach(row => {
                        const rowName = row[importNameKey];
                        if (!rowName) return;

                        const nameStr = (rowName as any).toString().trim().toLowerCase();
                        const existsInOriginal = existingData.some(item => ((item as any)[nameKey] as string).trim().toLowerCase() === nameStr);
                        const existsInNew = targetArray.some(item => ((item as any)[nameKey] as string).trim().toLowerCase() === nameStr);

                        if (!existsInOriginal && !existsInNew) {
                            const newItem = transform(row);
                            if (newItem) targetArray.push(newItem);
                        }
                    });
                };

                // --- Stage 1: Extract all data into local arrays, maintaining dependency order ---
                extractFromSheet("Kategori", categories, newItems.categories, row => ({ name: row.nama, unitType: (row.tipe_satuan === 'Per Luas' || row.tipe_satuan === 'Per Buah') ? row.tipe_satuan : 'Per Buah' }), 'name', 'nama' );
                extractFromSheet("Finishing", finishings, newItems.finishings, row => ({ name: row.nama, price: Number(row.harga) || 0 }), 'name', 'nama' );
                extractFromSheet("Pelanggan", customers, newItems.customers, row => ({ name: row.nama, contact: String(row.kontak), level: row.level || 'End Customer' }), 'name', 'nama' );
                extractFromSheet("Supplier", suppliers, newItems.suppliers, row => ({ name: row.nama, contactPerson: row.kontak_person, phone: String(row.telepon), specialty: row.spesialisasi }), 'name', 'nama' );
                extractFromSheet("Karyawan", employees, newItems.employees, row => ({ name: row.nama, contact: String(row.kontak), division: row.divisi || 'Produksi' }), 'name', 'nama' );

                // Special handling for products to check against existing AND newly added categories
                const allAvailableCategories = [...categories, ...newItems.categories];
                const allProducts = [...products];
                const wsProducts = wb.Sheets["Produk & Layanan"];
                if (wsProducts) {
                    const importedProducts: any[] = XLSX.utils.sheet_to_json(wsProducts);
                    importedProducts.forEach(row => {
                        const rowName = row.nama;
                        if (!rowName || !row.kategori) return;

                        const nameStr = rowName.toString().trim().toLowerCase();
                        const productExists =
                            allProducts.some(p => p.name.trim().toLowerCase() === nameStr) ||
                            newItems.products.some(p => p.data.name.trim().toLowerCase() === nameStr);
                        
                        if (!productExists) {
                            const categoryStr = row.kategori.toString().trim().toLowerCase();
                            const categoryExists = allAvailableCategories.some(c => c.name.trim().toLowerCase() === categoryStr);
                            
                            if (categoryExists) {
                                newItems.products.push({
                                    data: {
                                        name: row.nama, category: row.kategori,
                                        price: { 
                                            endCustomer: Number(row.harga_end_customer) || 0, retail: Number(row.harga_retail) || 0,
                                            grosir: Number(row.harga_grosir) || 0, reseller: Number(row.harga_reseller) || 0,
                                            corporate: Number(row.harga_corporate) || 0
                                        }
                                    },
                                    costPrice: Math.max(0, Number(row.hpp_modal) || 0),
                                });
                            } else {
                                failedProducts.push(row.nama);
                            }
                        }
                    });
                }
                
                // --- Stage 2: Call onAdd props in dependency order ---
                if (newItems.categories.length > 0) { newItems.categories.forEach(onAddCategory); summaryParts.push(`${newItems.categories.length} kategori baru`); }
                if (newItems.finishings.length > 0) { newItems.finishings.forEach(onAddFinishing); summaryParts.push(`${newItems.finishings.length} finishing baru`); }
                if (newItems.customers.length > 0) { newItems.customers.forEach(onAddCustomer); summaryParts.push(`${newItems.customers.length} pelanggan baru`); }
                if (newItems.suppliers.length > 0) { newItems.suppliers.forEach(onAddSupplier); summaryParts.push(`${newItems.suppliers.length} supplier baru`); }
                if (newItems.employees.length > 0) { newItems.employees.forEach(onAddEmployee); summaryParts.push(`${newItems.employees.length} karyawan baru`); }
                if (newItems.products.length > 0) { newItems.products.forEach(item => onAddProduct(item.data, item.costPrice)); summaryParts.push(`${newItems.products.length} produk baru`); }

                let alertMessage = `Impor Selesai!\nRingkasan: ${summaryParts.join(', ') || "Tidak ada data baru yang ditambahkan."}`;
                if (failedProducts.length > 0) {
                    alertMessage += `\n\nProduk berikut gagal diimpor karena kategorinya tidak ditemukan: ${failedProducts.join(', ')}`;
                }
                alert(alertMessage);
                onClose();

            } catch (error) {
                console.error("Error importing data:", error);
                alert("Gagal mengimpor file. Pastikan format dan nama sheet (misal: 'Produk & Layanan') sudah benar sesuai template.");
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
                    <h3 className="text-xl font-bold text-gray-800">Impor dan Ekspor Data Master</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Impor Section */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h4 className="font-bold text-lg text-gray-700">Impor dari Excel</h4>
                        <p className="text-sm text-gray-600">Tambah data baru secara massal. Data dengan nama yang sama persis akan diabaikan.</p>
                        
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">1</div>
                            <div>
                                <h5 className="font-semibold">Unduh Template</h5>
                                <p className="text-xs text-gray-500 mb-2">Dapatkan file Excel dengan format kolom yang benar.</p>
                                <button onClick={handleDownloadTemplate} className="flex items-center text-sm bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300">
                                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                                    Unduh Template
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">2</div>
                            <div>
                                <h5 className="font-semibold">Isi & Unggah File</h5>
                                <p className="text-xs text-gray-500 mb-2">Salin data Anda ke template, simpan, lalu unggah di sini.</p>
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="text-sm file:mr-4 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100" />
                                {uploadedFile && <p className="text-xs text-green-600 mt-1">File dipilih: {uploadedFile.name}</p>}
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-600 text-white flex items-center justify-center font-bold text-sm">3</div>
                            <div>
                                <h5 className="font-semibold">Impor Data</h5>
                                <p className="text-xs text-gray-500 mb-2">Klik untuk memulai proses penambahan data baru ke sistem.</p>
                                <button onClick={handleImportData} disabled={!uploadedFile || isLoading} className="flex items-center text-sm bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 disabled:bg-pink-300">
                                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                                    {isLoading ? 'Memproses...' : 'Impor Data'}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Ekspor Section */}
                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <h4 className="font-bold text-lg text-gray-700">Ekspor ke Excel</h4>
                        <p className="text-sm text-gray-600">Unduh semua data master yang ada saat ini ke dalam satu file Excel. File ini bisa digunakan sebagai backup atau sebagai template untuk impor selanjutnya.</p>
                        <button onClick={handleExportData} className="flex items-center text-sm bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700">
                           <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                            Unduh Master Data (Excel)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const MasterData: React.FC<MasterDataProps> = ({ 
    products, productCostMetadata = {}, productCostGroups = [], categories, finishings, customers, suppliers, employees, menuPermissions, userLevel,
    onAddProduct, onUpdateProduct, onDeleteProduct,
    onSaveProductCostGroup, onDeleteProductCostGroup, onBulkUpdateProductCosts,
    onAddCategory, onUpdateCategory, onDeleteCategory,
    onAddFinishing, onUpdateFinishing, onDeleteFinishing,
    onAddCustomer, onUpdateCustomer, onDeleteCustomer,
    onAddSupplier, onUpdateSupplier, onDeleteSupplier,
    onAddEmployee, onUpdateEmployee, onDeleteEmployee
}) => {
  const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`masterData/${tab.key}`)), [menuPermissions]);
  const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isCostGroupsModalOpen, setIsCostGroupsModalOpen] = useState(false);
  const [isBulkCostModalOpen, setIsBulkCostModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const canEdit = userLevel === 'Admin' || userLevel === 'Office' || menuPermissions.some(p => p.startsWith('managementData/'));
  const canDelete = userLevel === 'Admin' || menuPermissions.some(p => p.startsWith('managementData/'));
  
  useEffect(() => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
        setActiveTab(accessibleTabs[0].key);
    }
  }, [accessibleTabs, activeTab]);

  useEffect(() => {
      setSearchQuery('');
      setCurrentPage(1);
      setEditingItem(null);
      setIsModalOpen(false);
  }, [activeTab]);
  
  useEffect(() => {
      setCurrentPage(1);
  }, [searchQuery]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSaveData = (data: any) => {
    const isEditing = Boolean(editingItem && editingItem.id !== undefined);
    switch (activeTab) {
      case 'products': {
        const productPayload = {
          name: data.name,
          category: data.category,
          price: {
            endCustomer: Number(data.price.endCustomer),
            retail: Number(data.price.retail),
            grosir: Number(data.price.grosir),
            reseller: Number(data.price.reseller),
            corporate: Number(data.price.corporate),
          }
        };
        if (isEditing) {
          onUpdateProduct({ ...editingItem, ...productPayload }, data.costPrice, data.costGroupId);
        } else {
          onAddProduct(productPayload, data.costPrice, data.costGroupId);
        }
        break;
      }
      case 'categories':
        if (isEditing) {
          onUpdateCategory({ ...editingItem, name: data.name, unitType: data.unitType });
        } else {
          onAddCategory({ name: data.name, unitType: data.unitType });
        }
        break;
      case 'finishings':
        if (isEditing) {
          onUpdateFinishing({ ...editingItem, name: data.name, price: Number(data.price), categoryIds: data.categoryIds });
        } else {
          onAddFinishing({ name: data.name, price: Number(data.price), categoryIds: data.categoryIds });
        }
        break;
      case 'customers':
        if (isEditing) {
          onUpdateCustomer({ ...editingItem, name: data.name, contact: data.contact, level: data.level });
        } else {
          onAddCustomer({ name: data.name, contact: data.contact, level: data.level });
        }
        break;
      case 'suppliers':
        if (isEditing) {
          onUpdateSupplier({ ...editingItem, name: data.name, contactPerson: data.contactPerson, phone: data.phone, specialty: data.specialty });
        } else {
          onAddSupplier(data);
        }
        break;
      case 'karyawan':
        if (isEditing) {
          onUpdateEmployee({ ...editingItem, name: data.name, contact: data.contact, division: data.division });
        } else {
          onAddEmployee({ name: data.name, contact: data.contact, division: data.division });
        }
        break;
    }
    handleCloseModal();
  };

  const handleDeleteRow = (id: number, label: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus "${label}"?`)) return;
    switch (activeTab) {
      case 'products': onDeleteProduct(id); break;
      case 'categories': onDeleteCategory(id); break;
      case 'finishings': onDeleteFinishing(id); break;
      case 'customers': onDeleteCustomer(id); break;
      case 'suppliers': onDeleteSupplier(id); break;
      case 'karyawan': onDeleteEmployee(id); break;
    }
  };
  
  const renderModalContent = () => {
    const commonSubmitButton = (
      <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded-lg font-semibold hover:bg-pink-700 mt-4">
        {editingItem ? 'Simpan Perubahan' : 'Simpan'}
      </button>
    );
    const commonInputClass = "mt-1 w-full p-2 border border-gray-300 rounded-md";
    const modalFormKey = `${activeTab}-${editingItem?.id ?? 'new'}`;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: any = {};

        if (activeTab === 'finishings') {
            const categoryIds = formData.getAll('categoryIds').map(id => Number(id));
            data.categoryIds = categoryIds;
        }

        formData.forEach((value, key) => {
            if (key === 'categoryIds') return;

            if (key.includes('.')) {
                const [parent, child] = key.split('.');
                if (!data[parent]) data[parent] = {};
                data[parent][child] = value;
            } else {
                data[key] = value;
            }
        });
        handleSaveData(data);
    };

    switch (activeTab) {
        case 'products':
            return <ProductForm key={modalFormKey} categories={categories} costGroups={productCostGroups} initialData={editingItem} initialMeta={editingItem?.id ? productCostMetadata[editingItem.id] : undefined} onSubmit={handleSaveData} />;
        case 'categories':
            return (
                <form key={modalFormKey} onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Nama Kategori</label>
                        <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Kategori Baru" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Tipe Satuan</label>
                        <select name="unitType" defaultValue={editingItem?.unitType || 'Per Buah'} className={`${commonInputClass} bg-white`} required>
                          <option value="Per Buah">Per Buah (Contoh: pcs, box, rim)</option>
                          <option value="Per Luas">Per Luas (Contoh: m²)</option>
                        </select>
                    </div>
                    {commonSubmitButton}
                </form>
            );
         case 'finishings':
            return (
                <form key={modalFormKey} onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Nama Finishing</label>
                        <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Finishing" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Harga</label>
                        <input name="price" type="number" defaultValue={editingItem?.price ?? ''} placeholder="Harga" className={commonInputClass} required min="0" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Kategori Terkait (opsional)</label>
                        <p className="text-xs text-gray-500 mb-1">Centang kategori spesifik. Kosongkan untuk semua kategori.</p>
                        <div className="border rounded-md p-2 max-h-36 overflow-y-auto space-y-1 bg-gray-50">
                            {categories.map(c => (
                                <label key={c.id} className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="categoryIds"
                                        value={c.id}
                                        defaultChecked={Array.isArray(editingItem?.categoryIds) && editingItem.categoryIds.includes(c.id)}
                                        className="h-4 w-4 text-pink-600 rounded"
                                    />
                                    <span>{c.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {commonSubmitButton}
                </form>
            );
        case 'customers': 
            return (
                <form key={modalFormKey} onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Nama Pelanggan</label>
                        <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Pelanggan" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Kontak</label>
                        <input name="contact" defaultValue={editingItem?.contact || ''} placeholder="Kontak" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Level Harga</label>
                        <select name="level" defaultValue={editingItem?.level || 'End Customer'} className={commonInputClass} required>
                            <option value="End Customer">End Customer</option>
                            <option value="Retail">Retail</option>
                            <option value="Grosir">Grosir</option>
                            <option value="Reseller">Reseller</option>
                            <option value="Corporate">Corporate</option>
                        </select>
                    </div>
                    {commonSubmitButton}
                </form> 
            );
        case 'suppliers':
            return (
                <form key={modalFormKey} onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Nama Supplier</label>
                        <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Supplier" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Narahubung</label>
                        <input name="contactPerson" defaultValue={editingItem?.contactPerson || ''} placeholder="Narahubung" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Telepon</label>
                        <input name="phone" defaultValue={editingItem?.phone || ''} placeholder="Telepon" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Spesialisasi</label>
                        <input name="specialty" defaultValue={editingItem?.specialty || ''} placeholder="Spesialisasi" className={commonInputClass} required />
                    </div>
                    {commonSubmitButton}
                </form>
            );
        case 'karyawan':
            return (
                <form key={modalFormKey} onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Nama Karyawan</label>
                        <input name="name" defaultValue={editingItem?.name || ''} placeholder="Nama Karyawan" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Kontak</label>
                        <input name="contact" defaultValue={editingItem?.contact || ''} placeholder="Kontak" className={commonInputClass} required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600">Divisi</label>
                        <select name="division" defaultValue={editingItem?.division || 'Kasir'} className={commonInputClass} required>
                            <option value="Kasir">Kasir</option>
                            <option value="Office">Office</option>
                            <option value="Produksi">Produksi</option>
                        </select>
                    </div>
                    {commonSubmitButton}
                </form> 
            );
        default: return null;
    }
  };

  const { paginatedData, totalItems } = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    let data: { name: string, [key: string]: any }[] = [];

    switch (activeTab) {
        case 'products':
            data = products.filter(p => p.name.toLowerCase().includes(lowerCaseQuery) || p.category.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'categories':
            data = categories.filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'finishings':
            data = finishings.filter(f => f.name.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'customers':
            data = customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery) || c.contact.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'suppliers':
            data = suppliers.filter(s => s.name.toLowerCase().includes(lowerCaseQuery) || s.contactPerson.toLowerCase().includes(lowerCaseQuery));
            break;
        case 'karyawan':
            data = employees.filter(e => e.name.toLowerCase().includes(lowerCaseQuery) || e.contact.toLowerCase().includes(lowerCaseQuery));
            break;
    }

    // Sort the filtered data alphabetically by name
    data.sort((a, b) => a.name.localeCompare(b.name, 'id-ID', { sensitivity: 'base' }));

    return {
      paginatedData: data.slice(startIndex, startIndex + ITEMS_PER_PAGE),
      totalItems: data.length,
    };
  }, [activeTab, searchQuery, currentPage, products, categories, finishings, customers, suppliers, employees]);
  
  const renderActionButtons = (item: any, label: string) => {
    if (!canEdit && !canDelete) return null;
    return (
      <td className="py-4 px-4 whitespace-nowrap text-sm text-right">
        <div className="inline-flex items-center space-x-1.5">
          {canEdit && (
            <button
              type="button"
              onClick={() => handleOpenEditModal(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              title={`Edit ${label}`}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDeleteRow(item.id, label)}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
              title={`Hapus ${label}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    );
  };

  const renderContent = () => {
    const showActions = canEdit || canDelete;
    const Table: React.FC<{headers: string[], children: React.ReactNode}> = ({headers, children}) => (
        <div className="overflow-x-auto"><table className="min-w-full bg-white"><thead className="bg-gray-100"><tr>{headers.map(h => (<th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider ${h === 'Aksi' ? 'text-right' : 'text-left'}`}>{h}</th>))}</tr></thead><tbody className="divide-y divide-gray-200">{children}</tbody></table></div>
    );
    const Td: React.FC<{children:React.ReactNode, className?: string}> = ({children, className}) => (<td className={`py-4 px-4 whitespace-nowrap text-sm ${className}`}>{children}</td>);

    switch (activeTab) {
      case 'products':
        return (
            <Table headers={[...( ["Nama Layanan/Produk", "Kategori", "Harga (EC/R/G/S/C)", "Est. HPP"] ), ...(showActions ? ["Aksi"] : [])]}>
            {(paginatedData as ProductData[]).map((product) => {
                const effective = resolveEffectiveProductCost(product.id, productCostMetadata, productCostGroups);
                const catUnit = categories.find(c => c.name === product.category)?.unitType === 'Per Luas' ? 'm²' : 'pcs';
                return (
                    <tr key={product.id} className="hover:bg-gray-50">
                        <Td className="font-medium text-gray-900">{product.name}</Td>
                        <Td className="text-gray-500">{product.category}</Td>
                        <Td className="text-gray-500 text-xs">{`${product.price.endCustomer/1000}k / ${product.price.retail/1000}k / ${product.price.grosir/1000}k / ${product.price.reseller/1000}k / ${product.price.corporate/1000}k`}</Td>
                        <Td className="text-xs">
                            {effective.costPrice > 0 ? (
                                <div>
                                    <span className="font-semibold text-amber-700">
                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(effective.costPrice)}/{catUnit}
                                    </span>
                                    {effective.source === 'group' && effective.group ? (
                                        <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-700 font-medium">
                                            Grup: {effective.group.name}
                                        </span>
                                    ) : (
                                        <span className="ml-1 text-[10px] text-gray-400">(Manual)</span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-gray-400 italic">Belum diisi</span>
                            )}
                        </Td>
                        {renderActionButtons(product, product.name)}
                    </tr>
                );
            })}
            </Table>
        );
      case 'categories':
        return (
          <Table headers={[...( ["Nama Kategori", "Tipe Satuan"] ), ...(showActions ? ["Aksi"] : [])]}>
              {(paginatedData as CategoryData[]).map((cat) => (<tr key={cat.id} className="hover:bg-gray-50"><Td className="font-medium text-gray-900">{cat.name}</Td><Td className="text-gray-500">{cat.unitType}</Td>{renderActionButtons(cat, cat.name)}</tr>))}
          </Table>
      );
      case 'finishings':
        return (
            <Table headers={[...( ["Nama Finishing", "Harga", "Kategori Terkait"] ), ...(showActions ? ["Aksi"] : [])]}>
                {(paginatedData as FinishingData[]).map((f) => {
                    const relatedCategories = f.categoryIds && f.categoryIds.length > 0
                        ? f.categoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(', ')
                        : <span className="text-gray-400 italic">Semua Kategori</span>;

                    return (
                        <tr key={f.id} className="hover:bg-gray-50">
                            <Td className="font-medium text-gray-900">{f.name}</Td>
                            <Td className="text-gray-500">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(f.price)}</Td>
                            <Td className="text-gray-500 text-xs">{relatedCategories}</Td>
                            {renderActionButtons(f, f.name)}
                        </tr>
                    );
                })}
            </Table>
      );
      case 'customers':
        return (
            <Table headers={[...( ["Nama Pelanggan", "Kontak", "Level Harga", "Tanggal Bergabung"] ), ...(showActions ? ["Aksi"] : [])]}>
                {(paginatedData as CustomerData[]).map((c) => (<tr key={c.id} className="hover:bg-gray-50"><Td className="font-medium text-gray-900">{c.name}</Td><Td className="text-gray-500">{c.contact}</Td><Td className="text-gray-500"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    c.level === 'Corporate' ? 'bg-cyan-100 text-cyan-800' :
                    c.level === 'Reseller' ? 'bg-teal-100 text-teal-800' :
                    c.level === 'Grosir' ? 'bg-yellow-100 text-yellow-800' :
                    c.level === 'Retail' ? 'bg-fuchsia-100 text-fuchsia-800' :
                    'bg-pink-100 text-pink-800'
                }`}>{c.level}</span></Td><Td className="text-gray-500">{new Date(c.joinDate).toLocaleDateString('id-ID')}</Td>{renderActionButtons(c, c.name)}</tr>))}
            </Table>
      );
      case 'suppliers':
        return (
            <Table headers={[...( ["Nama Supplier", "Narahubung", "Telepon", "Spesialisasi"] ), ...(showActions ? ["Aksi"] : [])]}>
              {(paginatedData as SupplierData[]).map((s) => (<tr key={s.id} className="hover:bg-gray-50"><Td className="font-medium text-gray-900">{s.name}</Td><Td className="text-gray-500">{s.contactPerson}</Td><Td className="text-gray-500">{s.phone}</Td><Td className="text-gray-500">{s.specialty}</Td>{renderActionButtons(s, s.name)}</tr>))}
            </Table>
        );
      case 'karyawan':
        return (
            <Table headers={[...( ["Nama Karyawan", "Kontak", "Devisi", "Tanggal Bergabung"] ), ...(showActions ? ["Aksi"] : [])]}>
                {(paginatedData as EmployeeData[]).map((e) => (<tr key={e.id} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">{e.name}</Td>
                    <Td className="text-gray-500">{e.contact}</Td>
                    <Td className="text-gray-500">{e.division}</Td>
                    <Td className="text-gray-500">{new Date(e.joinDate).toLocaleDateString('id-ID')}</Td>
                    {renderActionButtons(e, e.name)}
                </tr>))}
            </Table>
        );
    }
  };

  const TabButton: React.FC<{tabKey: string; label: string}> = ({ tabKey, label }) => (
    <button onClick={() => setActiveTab(tabKey)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${ activeTab === tabKey ? 'bg-pink-600 text-white shadow' : 'text-gray-600 hover:bg-gray-200' }`}>{label}</button>
  );
  
  const getModalTitle = () => {
      const prefix = editingItem ? 'Edit' : 'Tambah';
      const suffix = editingItem ? '' : ' Baru';
      switch (activeTab) {
          case 'products': return `${prefix} Produk${suffix}`;
          case 'categories': return `${prefix} Kategori${suffix}`;
          case 'finishings': return `${prefix} Finishing${suffix}`;
          case 'customers': return `${prefix} Pelanggan${suffix}`;
          case 'suppliers': return `${prefix} Supplier${suffix}`;
          case 'karyawan': return `${prefix} Karyawan${suffix}`;
          default: return `${prefix} Data`;
      }
  }

  const getSearchPlaceholder = () => {
      switch(activeTab) {
          case 'products': return 'Cari produk atau kategori...';
          case 'customers': return 'Cari nama atau kontak pelanggan...';
          case 'suppliers': return 'Cari nama atau narahubung supplier...';
          case 'karyawan': return 'Cari nama atau kontak karyawan...';
          default: return 'Cari...';
      }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
      <div className="flex flex-wrap gap-2 justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Manajemen Data Master</h2>
        <div className="flex flex-wrap gap-2">
            {activeTab === 'products' && canEdit && onSaveProductCostGroup && onDeleteProductCostGroup && (
              <button
                onClick={() => setIsCostGroupsModalOpen(true)}
                className="bg-indigo-600 text-white px-3.5 py-2 rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors"
              >
                Grup Modal Bahan{productCostGroups.length > 0 ? ` (${productCostGroups.length})` : ''}
              </button>
            )}
            {activeTab === 'products' && canEdit && onBulkUpdateProductCosts && (
              <button
                onClick={() => setIsBulkCostModalOpen(true)}
                className="bg-amber-600 text-white px-3.5 py-2 rounded-lg font-semibold text-sm hover:bg-amber-700 transition-colors"
              >
                Atur HPP Massal
              </button>
            )}
            <button onClick={() => setIsImportExportModalOpen(true)} className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-700 transition-colors">Impor dan Ekspor Data</button>
            <button onClick={handleOpenAddModal} className="bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-pink-700 transition-colors">+ Tambah Baru</button>
        </div>
      </div>
      
      <div className="flex space-x-2 border-b mb-4 flex-wrap">
        {accessibleTabs.map(tab => <TabButton key={tab.key} tabKey={tab.key} label={tab.label} />)}
      </div>

      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
            type="text"
            placeholder={getSearchPlaceholder()}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-1/2 pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500"
        />
      </div>

      <div className="p-1 sm:p-4 bg-gray-50 rounded-lg min-h-[20rem] flex-1">
        {renderContent()}
      </div>

      <Pagination
        totalItems={totalItems}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />

      <Modal show={isModalOpen} onClose={handleCloseModal} title={getModalTitle()}>
        {renderModalContent()}
      </Modal>

      {onBulkUpdateProductCosts && (
        <BulkCostAssignModal
          show={isBulkCostModalOpen}
          onClose={() => setIsBulkCostModalOpen(false)}
          products={products}
          categories={categories}
          productCostMetadata={productCostMetadata}
          costGroups={productCostGroups}
          onBulkApply={onBulkUpdateProductCosts}
          onOpenCostGroupsModal={() => setIsCostGroupsModalOpen(true)}
        />
      )}

      {onSaveProductCostGroup && onDeleteProductCostGroup && (
        <CostGroupsModal
          show={isCostGroupsModalOpen}
          onClose={() => setIsCostGroupsModalOpen(false)}
          groups={productCostGroups}
          productCostMetadata={productCostMetadata}
          onSaveGroup={onSaveProductCostGroup}
          onDeleteGroup={onDeleteProductCostGroup}
        />
      )}

      <ImportExportModal
        show={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        products={products}
        productCostMetadata={productCostMetadata}
        productCostGroups={productCostGroups}
        categories={categories}
        finishings={finishings}
        customers={customers}
        suppliers={suppliers}
        employees={employees}
        onAddProduct={onAddProduct}
        onAddCategory={onAddCategory}
        onAddFinishing={onAddFinishing}
        onAddCustomer={onAddCustomer}
        onAddSupplier={onAddSupplier}
        onAddEmployee={onAddEmployee}
       />
    </div>
  );
};

export default MasterData;