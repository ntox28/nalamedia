import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  type SavedOrder,
  type ProductData,
  type CategoryData,
  type FinishingData,
  type ReceivableItem,
  type StoreInfo,
  type LayoutUnit,
  type MediaMode,
  type NestingAlgorithm,
  type ObjectShape,
  type EfficiencySelectionMode,
  type FinishingSpaceRule,
  type LayoutObjectSpec,
  type LayoutPage,
  type PlacedLayoutItem,
  type DeferredObjectItem,
} from '../types';
import {
  OBJECT_COLORS,
  MEDIA_PRESETS,
  mmToUnit,
  unitToMm,
  formatUnitValue,
  formatDimensions,
  findFinishingRule,
  calculateMaxFitPerSheet,
  computeSmartLayout,
  checkPageIssues,
  generatePageSvg,
} from './printLayoutUtils';
import {
  PlusCircleIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ClipboardIcon,
  ExclamationTriangleIcon,
  CheckIcon,
} from './Icons';

interface PrintLayoutProps {
  allOrders: SavedOrder[];
  unprocessedOrders: SavedOrder[];
  receivables: ReceivableItem[];
  products: ProductData[];
  categories: CategoryData[];
  finishings: FinishingData[];
  storeInfo: StoreInfo;
  finishingSpaceRules: FinishingSpaceRule[];
  onSaveFinishingSpaceRules: (rules: FinishingSpaceRule[]) => void;
}

// Smooth decimal-safe numeric input that converts live when switching mm / cm / m
const UnitNumberInput: React.FC<{
  valueMm: number;
  unit: LayoutUnit;
  onChangeMm: (mm: number) => void;
  minMm?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}> = ({ valueMm, unit, onChangeMm, minMm = 0, disabled = false, className = '', placeholder }) => {
  const [text, setText] = useState<string>(() => formatUnitValue(valueMm, unit));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(formatUnitValue(valueMm, unit));
    }
  }, [valueMm, unit, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.');
    setText(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      const mm = unitToMm(parsed, unit);
      onChangeMm(Math.max(minMm, mm));
    } else if (raw === '') {
      onChangeMm(minMm);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(text);
    if (isNaN(parsed) || parsed < 0) {
      setText(formatUnitValue(valueMm, unit));
    } else {
      const clampedMm = Math.max(minMm, unitToMm(parsed, unit));
      onChangeMm(clampedMm);
      setText(formatUnitValue(clampedMm, unit));
    }
  };

  const step = unit === 'mm' ? '1' : unit === 'cm' ? '0.1' : '0.01';

  return (
    <input
      type="number"
      step={step}
      min={mmToUnit(minMm, unit)}
      value={text}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={`tabular-nums ${className}`}
    />
  );
};

// Modal Pengaturan Aturan Default Space Finishing
const FinishingRulesModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  rules: FinishingSpaceRule[];
  masterFinishings: FinishingData[];
  unit: LayoutUnit;
  onSave: (rules: FinishingSpaceRule[]) => void;
}> = ({ isOpen, onClose, rules, masterFinishings, unit, onSave }) => {
  const [draftRules, setDraftRules] = useState<FinishingSpaceRule[]>(rules);
  const [newName, setNewName] = useState('');
  const [newWidthMm, setNewWidthMm] = useState(50);
  const [newHeightMm, setNewHeightMm] = useState(50);

  useEffect(() => {
    if (isOpen) {
      setDraftRules(rules);
    }
  }, [isOpen, rules]);

  if (!isOpen) return null;

  const unregisteredFinishings = masterFinishings.filter(
    (f) => !draftRules.some((r) => r.finishingName.trim().toLowerCase() === f.name.trim().toLowerCase())
  );

  const handleRuleChange = (
    index: number,
    field: 'extraWidthMm' | 'extraHeightMm' | 'note',
    value: number | string
  ) => {
    setDraftRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (draftRules.some((r) => r.finishingName.trim().toLowerCase() === trimmed.toLowerCase())) {
      alert(`Aturan untuk finishing "${trimmed}" sudah ada.`);
      return;
    }
    setDraftRules((prev) => [
      ...prev,
      {
        finishingName: trimmed,
        extraWidthMm: newWidthMm,
        extraHeightMm: newHeightMm,
        note: `Penambahan +${formatUnitValue(newWidthMm, unit)} × +${formatUnitValue(newHeightMm, unit)} ${unit}`,
      },
    ]);
    setNewName('');
  };

  const handleQuickAddMaster = (name: string) => {
    setDraftRules((prev) => [
      ...prev,
      { finishingName: name, extraWidthMm: 0, extraHeightMm: 0, note: 'Diambil dari Master Data' },
    ]);
  };

  const handleDeleteRule = (index: number) => {
    setDraftRules((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Preset Default Space Finishing</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Nilai bawaan saat menarik item dari Order. Anda tetap bisa mengubah space finishing tiap object secara terpisah tanpa memengaruhi object lain.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            Contoh: Order <strong>100 × 200 cm</strong> dengan finishing <strong>SPG</strong> (+5 × +5 cm) otomatis masuk sebagai <strong>105 × 205 cm</strong>, lalu tetap bisa disesuaikan sendiri pada kartu Object tersebut.
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-2">
              <div className="col-span-5">Nama Finishing</div>
              <div className="col-span-3">+ Lebar ({unit})</div>
              <div className="col-span-3">+ Tinggi ({unit})</div>
              <div className="col-span-1 text-right">Hapus</div>
            </div>
            {draftRules.map((rule, idx) => (
              <div
                key={`${rule.finishingName}-${idx}`}
                className="grid grid-cols-12 gap-2 items-center bg-white border border-gray-200 rounded-lg p-2"
              >
                <div className="col-span-5">
                  <p className="text-sm font-semibold text-gray-800 truncate">{rule.finishingName}</p>
                </div>
                <div className="col-span-3">
                  <UnitNumberInput
                    valueMm={rule.extraWidthMm}
                    unit={unit}
                    onChangeMm={(mm) => handleRuleChange(idx, 'extraWidthMm', mm)}
                    className="w-full p-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <UnitNumberInput
                    valueMm={rule.extraHeightMm}
                    unit={unit}
                    onChangeMm={(mm) => handleRuleChange(idx, 'extraHeightMm', mm)}
                    className="w-full p-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(idx)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Hapus aturan"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {unregisteredFinishings.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Finishing dari Data Master yang belum diatur (klik untuk tambahkan):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unregisteredFinishings.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleQuickAddMaster(f.name)}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded-md bg-white hover:bg-pink-50 hover:border-pink-400 hover:text-pink-700 transition-colors"
                  >
                    + {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAddRule} className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700">Tambah Preset Finishing Custom</p>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs text-gray-600 mb-1">Nama Finishing</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Misal: Keling / Selongsong"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">+ Lebar ({unit})</label>
                <UnitNumberInput
                  valueMm={newWidthMm}
                  unit={unit}
                  onChangeMm={setNewWidthMm}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs text-gray-600 mb-1">+ Tinggi ({unit})</label>
                <UnitNumberInput
                  valueMm={newHeightMm}
                  unit={unit}
                  onChangeMm={setNewHeightMm}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-gray-800 text-white rounded-md text-sm font-semibold hover:bg-gray-900"
                >
                  +
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="border-t px-6 py-4 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draftRules);
              onClose();
            }}
            className="px-5 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700"
          >
            Simpan Preset Default
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal Ambil Item dari Order
const ImportOrderItemsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  allOrders: SavedOrder[];
  unprocessedOrders: SavedOrder[];
  receivables: ReceivableItem[];
  products: ProductData[];
  categories: CategoryData[];
  finishingRules: FinishingSpaceRule[];
  unit: LayoutUnit;
  onImportItems: (specs: Omit<LayoutObjectSpec, 'id' | 'color'>[]) => void;
}> = ({
  isOpen,
  onClose,
  allOrders,
  unprocessedOrders,
  receivables,
  products,
  categories,
  finishingRules,
  unit,
  onImportItems,
}) => {
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [applyFinishingSpace, setApplyFinishingSpace] = useState(true);
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelectedItemKeys(new Set());
    }
  }, [isOpen]);

  const orderStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    receivables.forEach((r) => map.set(r.id, r.productionStatus));
    return map;
  }, [receivables]);

  const candidateOrders = useMemo(() => {
    let list: SavedOrder[];
    if (scope === 'active') {
      const unprocessedIds = new Set(unprocessedOrders.map((o) => o.id));
      list = allOrders.filter((o) => {
        const st = orderStatusMap.get(o.id);
        return unprocessedIds.has(o.id) || st === 'Dalam Antrian' || st === 'Proses Cetak';
      });
    } else {
      list = [...allOrders];
    }

    list.sort((a, b) => b.id.localeCompare(a.id));

    if (!search.trim()) return list.slice(0, 60);

    const q = search.trim().toLowerCase();
    return list
      .filter((o) => {
        if (o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q)) return true;
        return o.orderItems.some((it) => {
          const prod = products.find((p) => p.id === it.productId);
          return (
            (it.description || '').toLowerCase().includes(q) ||
            (it.finishing || '').toLowerCase().includes(q) ||
            (prod?.name || '').toLowerCase().includes(q)
          );
        });
      })
      .slice(0, 60);
  }, [scope, search, allOrders, unprocessedOrders, orderStatusMap, products]);

  if (!isOpen) return null;

  const toggleItem = (key: string) => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirmImport = () => {
    const specsToAdd: Omit<LayoutObjectSpec, 'id' | 'color'>[] = [];

    candidateOrders.forEach((order) => {
      order.orderItems.forEach((item, idx) => {
        const key = `${order.id}__${item.id}_${idx}`;
        if (!selectedItemKeys.has(key)) return;

        const product = products.find((p) => p.id === item.productId);
        const rawLengthM = parseFloat(item.length) || 0;
        const rawWidthM = parseFloat(item.width) || 0;

        const baseWidthMm = rawLengthM > 0 ? Math.round(rawLengthM * 1000 * 100) / 100 : 100;
        const baseHeightMm = rawWidthM > 0 ? Math.round(rawWidthM * 1000 * 100) / 100 : 100;

        const rule = applyFinishingSpace
          ? findFinishingRule(item.finishing, finishingRules)
          : undefined;
        const extraW = rule?.extraWidthMm || 0;
        const extraH = rule?.extraHeightMm || 0;

        const finalW = baseWidthMm + extraW;
        const finalH = baseHeightMm + extraH;

        const customerShort = order.customer.split('(')[0].trim();
        const itemTitle = item.description?.trim() || product?.name || `Item #${idx + 1}`;
        const finishingTag =
          item.finishing && item.finishing !== 'Tanpa Finishing' ? ` [${item.finishing}]` : '';

        specsToAdd.push({
          label: `${order.id} · ${customerShort} - ${itemTitle}${finishingTag}`,
          shape: 'rectangle',
          baseWidthMm,
          baseHeightMm,
          extraWidthMm: extraW,
          extraHeightMm: extraH,
          widthMm: finalW,
          heightMm: finalH,
          finishingName: item.finishing,
          qty: Math.max(1, item.qty || 1),
          allowRotate: true,
          sourceOrderId: order.id,
          sourceCustomer: customerShort,
          materialName: product?.name,
        });
      });
    });

    if (specsToAdd.length === 0) {
      alert('Pilih minimal 1 item order terlebih dahulu.');
      return;
    }

    onImportItems(specsToAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Ambil Item dari Order Produksi</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pilih per item untuk digabungkan ke layout (Gang Run). Judul &amp; preset space finishing otomatis terbaca.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari No. Nota, Pelanggan, Judul Item, atau Bahan..."
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              />
            </div>
            <div className="flex p-0.5 bg-gray-200 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScope('active')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  scope === 'active' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Antrian &amp; Proses
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  scope === 'all' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600'
                }`}
              >
                Semua Order
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyFinishingSpace}
              onChange={(e) => setApplyFinishingSpace(e.target.checked)}
              className="rounded text-pink-600 focus:ring-pink-500"
            />
            Terapkan preset Space Finishing otomatis
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {candidateOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Tidak ada order yang cocok dengan pencarian Anda.
            </div>
          ) : (
            candidateOrders.map((order) => {
              const statusLabel = orderStatusMap.get(order.id) || 'Baru / Belum Diproses';
              return (
                <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{order.id}</span>
                      <span className="text-gray-400">·</span>
                      <span className="font-semibold text-gray-700">{order.customer}</span>
                    </div>
                    <div className="text-gray-500">
                      {new Date(order.orderDate).toLocaleDateString('id-ID')} · {statusLabel}
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {order.orderItems.map((item, idx) => {
                      const key = `${order.id}__${item.id}_${idx}`;
                      const checked = selectedItemKeys.has(key);
                      const product = products.find((p) => p.id === item.productId);
                      const category = categories.find((c) => c.name === product?.category);
                      const isArea = category?.unitType === 'Per Luas';

                      const rawL = parseFloat(item.length) || 0;
                      const rawW = parseFloat(item.width) || 0;
                      const hasSize = rawL > 0 && rawW > 0;
                      const baseWMm = hasSize ? rawL * 1000 : 100;
                      const baseHMm = hasSize ? rawW * 1000 : 100;

                      const rule = applyFinishingSpace
                        ? findFinishingRule(item.finishing, finishingRules)
                        : undefined;
                      const extraW = rule?.extraWidthMm || 0;
                      const extraH = rule?.extraHeightMm || 0;
                      const finalWMm = baseWMm + extraW;
                      const finalHMm = baseHMm + extraH;

                      return (
                        <label
                          key={key}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                            checked ? 'bg-pink-50/60' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(key)}
                            className="mt-1 rounded text-pink-600 focus:ring-pink-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap justify-between items-baseline gap-2">
                              <p className="text-sm font-semibold text-gray-800">
                                {item.description || product?.name || `Item #${idx + 1}`}
                              </p>
                              <span className="text-xs font-semibold text-gray-700 tabular-nums">
                                Qty: {item.qty} pcs
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                              <span>{product?.name || 'Produk tidak diketahui'}</span>
                              <span>·</span>
                              <span>
                                Finishing: <strong>{item.finishing || 'Tanpa Finishing'}</strong>
                              </span>
                              <span>·</span>
                              {hasSize ? (
                                <span className="tabular-nums">
                                  Ukuran Order: <strong>{formatDimensions(baseWMm, baseHMm, unit)}</strong>
                                  {(extraW > 0 || extraH > 0) && (
                                    <span className="text-pink-700 font-semibold">
                                      {' '}
                                      → Layout: {formatDimensions(finalWMm, finalHMm, unit)} (+
                                      {formatUnitValue(extraW, unit)}×{formatUnitValue(extraH, unit)} {unit})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-amber-700">
                                  {isArea ? 'Ukuran belum diisi' : 'Non-luas'} (default {formatDimensions(100, 100, unit)})
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t px-6 py-4 flex justify-between items-center bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-600">
            <strong>{selectedItemKeys.size}</strong> item dipilih
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={selectedItemKeys.size === 0}
              className="px-5 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:bg-gray-300"
            >
              Tambahkan ke Layout ({selectedItemKeys.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
const PrintLayout: React.FC<PrintLayoutProps> = ({
  allOrders,
  unprocessedOrders,
  receivables,
  products,
  categories,
  finishings,
  storeInfo,
  finishingSpaceRules,
  onSaveFinishingSpaceRules,
}) => {
  const [unit, setUnit] = useState<LayoutUnit>('cm');

  // Media Configuration
  const [mediaMode, setMediaMode] = useState<MediaMode>('sheet');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('a3-plus-325');
  const [mediaWidthMm, setMediaWidthMm] = useState<number>(325);
  const [mediaHeightMm, setMediaHeightMm] = useState<number>(485);
  const [marginLeftMm, setMarginLeftMm] = useState<number>(5);
  const [marginRightMm, setMarginRightMm] = useState<number>(5);
  const [marginTopMm, setMarginTopMm] = useState<number>(5);
  const [marginBottomMm, setMarginBottomMm] = useState<number>(5);
  const [uniformMargin, setUniformMargin] = useState<boolean>(true);

  // Gap (0 mm = mepet)
  const [gapXMm, setGapXMm] = useState<number>(2);
  const [gapYMm, setGapYMm] = useState<number>(2);
  const [linkGap, setLinkGap] = useState<boolean>(true);

  // Algorithms & Smart Efficiency Selection Mode
  const [algorithm, setAlgorithm] = useState<NestingAlgorithm>('bestFit');
  const [efficiencyMode, setEfficiencyMode] = useState<EfficiencySelectionMode>('all');
  const [minEfficiencyPercent, setMinEfficiencyPercent] = useState<number>(75);
  const [forceIncludedIds, setForceIncludedIds] = useState<Set<string>>(new Set());
  const [manualDeferredIds, setManualDeferredIds] = useState<Set<string>>(new Set());
  const [autoSyncLayout, setAutoSyncLayout] = useState<boolean>(true);

  // SVG Export Options
  const [includeLabels, setIncludeLabels] = useState<boolean>(true);
  const [includeCropMarks, setIncludeCropMarks] = useState<boolean>(false);
  const [includeBaseDesignOutline, setIncludeBaseDesignOutline] = useState<boolean>(true);
  const [includePageHeader, setIncludePageHeader] = useState<boolean>(true);

  // Object Specs List
  const [objectSpecs, setObjectSpecs] = useState<LayoutObjectSpec[]>([
    {
      id: 'obj-1',
      label: 'Object 1',
      shape: 'rectangle',
      baseWidthMm: 90,
      baseHeightMm: 55,
      extraWidthMm: 0,
      extraHeightMm: 0,
      widthMm: 90,
      heightMm: 55,
      qty: 10,
      allowRotate: true,
      color: OBJECT_COLORS[0],
    },
  ]);

  // Layout Output
  const [pages, setPages] = useState<LayoutPage[]>([]);
  const [unplacedItems, setUnplacedItems] = useState<
    { label: string; shape: ObjectShape; widthMm: number; heightMm: number; reason: string }[]
  >([]);
  const [deferredItems, setDeferredItems] = useState<DeferredObjectItem[]>([]);
  const [usedHexCircles, setUsedHexCircles] = useState<boolean>(false);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [hasManualEdits, setHasManualEdits] = useState<boolean>(false);

  // Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isFinishingModalOpen, setIsFinishingModalOpen] = useState(false);

  // Canvas Zoom & Dragging
  const [zoomScale, setZoomScale] = useState<number>(1);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    instanceId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    pxPerMm: number;
  } | null>(null);

  const runAutoLayout = useCallback(() => {
    const result = computeSmartLayout(
      objectSpecs,
      {
        mediaMode,
        mediaWidthMm,
        mediaHeightMm,
        marginLeftMm,
        marginRightMm,
        marginTopMm,
        marginBottomMm,
        gapXMm,
        gapYMm,
        algorithm,
      },
      efficiencyMode,
      minEfficiencyPercent,
      forceIncludedIds,
      manualDeferredIds
    );
    setPages(result.pages);
    setUnplacedItems(result.unplacedItems);
    setDeferredItems(result.deferredItems);
    setUsedHexCircles(Boolean(result.usedHexagonalCircles));
    setHasManualEdits(false);
    setSelectedInstanceId(null);
    setActivePageIndex((prev) =>
      result.pages.length > 0 ? Math.min(prev, result.pages.length - 1) : 0
    );
  }, [
    objectSpecs,
    mediaMode,
    mediaWidthMm,
    mediaHeightMm,
    marginLeftMm,
    marginRightMm,
    marginTopMm,
    marginBottomMm,
    gapXMm,
    gapYMm,
    algorithm,
    efficiencyMode,
    minEfficiencyPercent,
    forceIncludedIds,
    manualDeferredIds,
  ]);

  useEffect(() => {
    if (autoSyncLayout) {
      runAutoLayout();
    }
  }, [autoSyncLayout, runAutoLayout]);

  const activePage: LayoutPage = pages[activePageIndex] || {
    pageNumber: 1,
    widthMm: mediaWidthMm,
    heightMm: mediaHeightMm,
    items: [],
  };

  const basePxPerMm = useMemo(() => {
    const targetW = 680;
    const targetH = 540;
    const w = Math.max(10, activePage.widthMm);
    const h = Math.max(10, activePage.heightMm);
    return Math.min(targetW / w, targetH / h);
  }, [activePage.widthMm, activePage.heightMm]);

  const effectivePxPerMm = basePxPerMm * zoomScale;

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'custom-sheet') {
      setMediaMode('sheet');
      return;
    }
    if (presetId === 'custom-roll') {
      setMediaMode('roll');
      return;
    }
    const preset = MEDIA_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setMediaMode(preset.mode);
    setMediaWidthMm(preset.widthMm);
    setMediaHeightMm(preset.heightMm);
    setMarginLeftMm(preset.defaultMarginMm);
    setMarginRightMm(preset.defaultMarginMm);
    setMarginTopMm(preset.defaultMarginMm);
    setMarginBottomMm(preset.defaultMarginMm);
    setUniformMargin(true);
    setAutoSyncLayout(true);
  };

  // Object CRUD (Each object keeps independent base size + finishing extra space!)
  const handleAddObject = () => {
    const nextIdx = objectSpecs.length + 1;
    const defaultW = unit === 'm' ? 1000 : unit === 'cm' ? 100 : 90;
    const defaultH = unit === 'm' ? 1000 : unit === 'cm' ? 100 : 55;
    setObjectSpecs((prev) => [
      ...prev,
      {
        id: `obj-${Date.now()}-${nextIdx}`,
        label: `Object ${nextIdx}`,
        shape: 'rectangle',
        baseWidthMm: defaultW,
        baseHeightMm: defaultH,
        extraWidthMm: 0,
        extraHeightMm: 0,
        widthMm: defaultW,
        heightMm: defaultH,
        qty: 1,
        allowRotate: true,
        color: OBJECT_COLORS[(nextIdx - 1) % OBJECT_COLORS.length],
      },
    ]);
    setAutoSyncLayout(true);
  };

  const handleImportOrderItems = (newSpecs: Omit<LayoutObjectSpec, 'id' | 'color'>[]) => {
    setObjectSpecs((prev) => {
      const startIndex = prev.length;
      const mapped: LayoutObjectSpec[] = newSpecs.map((spec, i) => ({
        ...spec,
        id: `obj-${Date.now()}-${i}`,
        color: OBJECT_COLORS[(startIndex + i) % OBJECT_COLORS.length],
      }));
      return [...prev, ...mapped];
    });
    setAutoSyncLayout(true);
  };

  const updateObjectGeometry = (
    id: string,
    patch: Partial<
      Pick<
        LayoutObjectSpec,
        'label' | 'shape' | 'baseWidthMm' | 'baseHeightMm' | 'extraWidthMm' | 'extraHeightMm' | 'finishingName' | 'qty' | 'allowRotate'
      >
    >
  ) => {
    setObjectSpecs((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const nextShape = patch.shape ?? s.shape;
        let nextBaseW = patch.baseWidthMm ?? s.baseWidthMm;
        let nextBaseH = patch.baseHeightMm ?? s.baseHeightMm;
        let nextExtraW = patch.extraWidthMm ?? s.extraWidthMm;
        let nextExtraH = patch.extraHeightMm ?? s.extraHeightMm;

        if (nextShape === 'circle') {
          if (patch.shape === 'circle') {
            nextBaseH = nextBaseW;
            nextExtraH = nextExtraW;
          } else {
            if (patch.baseWidthMm !== undefined) nextBaseH = nextBaseW;
            if (patch.extraWidthMm !== undefined) nextExtraH = nextExtraW;
          }
        }

        return {
          ...s,
          ...patch,
          shape: nextShape,
          baseWidthMm: nextBaseW,
          baseHeightMm: nextBaseH,
          extraWidthMm: nextExtraW,
          extraHeightMm: nextExtraH,
          widthMm: Math.max(1, nextBaseW + nextExtraW),
          heightMm: Math.max(1, nextBaseH + nextExtraH),
          allowRotate: nextShape === 'circle' ? false : patch.allowRotate ?? s.allowRotate,
        };
      })
    );
    setAutoSyncLayout(true);
  };

  const handleDeleteSpec = (id: string) => {
    setObjectSpecs((prev) => prev.filter((s) => s.id !== id));
    setForceIncludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setManualDeferredIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setAutoSyncLayout(true);
  };

  const handleFillOneSheet = (spec: LayoutObjectSpec) => {
    if (mediaMode !== 'sheet') {
      alert('Fitur "Isi Penuh 1 Lembar" berlaku untuk mode Lembaran (Sheet).');
      return;
    }
    const bestCount = calculateMaxFitPerSheet(spec, {
      mediaWidthMm,
      mediaHeightMm,
      marginLeftMm,
      marginRightMm,
      marginTopMm,
      marginBottomMm,
      gapXMm,
      gapYMm,
      algorithm,
    });
    if (bestCount <= 0) {
      alert('Ukuran objek lebih besar dari area cetak media saat ini.');
      return;
    }
    updateObjectGeometry(spec.id, { qty: bestCount });
  };

  // Defer / Force Include Handlers
  const handleManualDeferSpec = (id: string) => {
    setForceIncludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setManualDeferredIds((prev) => new Set(prev).add(id));
    setAutoSyncLayout(true);
  };

  const handleForceIncludeSpec = (id: string) => {
    setManualDeferredIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setForceIncludedIds((prev) => new Set(prev).add(id));
    setAutoSyncLayout(true);
  };

  const handleSwitchToDeferredOnly = () => {
    if (deferredItems.length === 0) return;
    const deferredIdSet = new Set(deferredItems.map((d) => d.specId));
    const nextManualDefer = new Set<string>();
    objectSpecs.forEach((s) => {
      if (!deferredIdSet.has(s.id)) {
        nextManualDefer.add(s.id);
      }
    });
    setForceIncludedIds(new Set());
    setManualDeferredIds(nextManualDefer);
    setEfficiencyMode('all');
    setAutoSyncLayout(true);
  };

  // Manual Canvas Dragging
  const handleMouseDownItem = (e: React.MouseEvent, item: PlacedLayoutItem) => {
    e.stopPropagation();
    setSelectedInstanceId(item.instanceId);
    setDragState({
      instanceId: item.instanceId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: item.x,
      origY: item.y,
      pxPerMm: effectivePxPerMm,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dxMm = (e.clientX - dragState.startClientX) / dragState.pxPerMm;
      const dyMm = (e.clientY - dragState.startClientY) / dragState.pxPerMm;

      setPages((prevPages) =>
        prevPages.map((pg, pIdx) => {
          if (pIdx !== activePageIndex) return pg;
          const dragged = pg.items.find((it) => it.instanceId === dragState.instanceId);
          if (!dragged) return pg;

          let nextX = Math.max(0, dragState.origX + dxMm);
          let nextY = Math.max(0, dragState.origY + dyMm);

          const snapDist = Math.max(3, 6 / dragState.pxPerMm);
          const xTargets = [marginLeftMm, pg.widthMm - marginRightMm - dragged.width];
          const yTargets = [marginTopMm, pg.heightMm - marginBottomMm - dragged.height];

          pg.items.forEach((other) => {
            if (other.instanceId === dragged.instanceId) return;
            xTargets.push(
              other.x + other.width + gapXMm,
              other.x - dragged.width - gapXMm,
              other.x,
              other.x + other.width - dragged.width
            );
            yTargets.push(
              other.y + other.height + gapYMm,
              other.y - dragged.height - gapYMm,
              other.y,
              other.y + other.height - dragged.height
            );
          });

          for (const tx of xTargets) {
            if (Math.abs(nextX - tx) <= snapDist) {
              nextX = tx;
              break;
            }
          }
          for (const ty of yTargets) {
            if (Math.abs(nextY - ty) <= snapDist) {
              nextY = ty;
              break;
            }
          }

          nextX = Math.round(nextX * 100) / 100;
          nextY = Math.round(nextY * 100) / 100;

          return {
            ...pg,
            items: pg.items.map((it) =>
              it.instanceId === dragState.instanceId ? { ...it, x: nextX, y: nextY } : it
            ),
          };
        })
      );
      setHasManualEdits(true);
      setAutoSyncLayout(false);
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, activePageIndex, marginLeftMm, marginRightMm, marginTopMm, marginBottomMm, gapXMm, gapYMm]);

  const selectedPlacedItem = useMemo(
    () => activePage.items.find((it) => it.instanceId === selectedInstanceId) || null,
    [activePage.items, selectedInstanceId]
  );

  const handleUpdateSelectedPlacedItem = (patch: Partial<PlacedLayoutItem>) => {
    if (!selectedInstanceId) return;
    setAutoSyncLayout(false);
    setHasManualEdits(true);
    setPages((prev) =>
      prev.map((pg, idx) =>
        idx !== activePageIndex
          ? pg
          : {
              ...pg,
              items: pg.items.map((it) =>
                it.instanceId === selectedInstanceId ? { ...it, ...patch } : it
              ),
            }
      )
    );
  };

  const handleRotateSelectedItem = () => {
    if (!selectedPlacedItem || selectedPlacedItem.shape === 'circle') return;
    handleUpdateSelectedPlacedItem({
      width: selectedPlacedItem.height,
      height: selectedPlacedItem.width,
      rotated: !selectedPlacedItem.rotated,
    });
  };

  const handleRemoveSelectedItemFromCanvas = () => {
    if (!selectedInstanceId) return;
    setAutoSyncLayout(false);
    setHasManualEdits(true);
    setPages((prev) =>
      prev.map((pg, idx) =>
        idx !== activePageIndex
          ? pg
          : { ...pg, items: pg.items.filter((it) => it.instanceId !== selectedInstanceId) }
      )
    );
    setSelectedInstanceId(null);
  };

  const pageIssues = useMemo(
    () =>
      checkPageIssues(activePage, {
        left: marginLeftMm,
        right: marginRightMm,
        top: marginTopMm,
        bottom: marginBottomMm,
      }),
    [activePage, marginLeftMm, marginRightMm, marginTopMm, marginBottomMm]
  );

  const deferredIdSet = useMemo(() => new Set(deferredItems.map((d) => d.specId)), [deferredItems]);

  const metrics = useMemo(() => {
    const activeSpecs = objectSpecs.filter((s) => !deferredIdSet.has(s.id));
    const totalRequestedActive = activeSpecs.reduce((s, sp) => s + Math.max(0, sp.qty), 0);
    const totalPlaced = pages.reduce((s, pg) => s + pg.items.length, 0);

    const activeAreaMm2 = activePage.widthMm * activePage.heightMm;
    const activeItemsAreaMm2 = activePage.items.reduce((s, it) => s + it.width * it.height, 0);
    const activeEfficiency = activeAreaMm2 > 0 ? (activeItemsAreaMm2 / activeAreaMm2) * 100 : 0;

    const totalMediaAreaM2 =
      pages.reduce((s, pg) => s + pg.widthMm * pg.heightMm, 0) / 1_000_000;

    return {
      totalRequestedActive,
      totalPlaced,
      activeEfficiency,
      totalMediaAreaM2,
    };
  }, [objectSpecs, deferredIdSet, pages, activePage]);

  const handleDownloadPageSvg = (pageToExport: LayoutPage) => {
    const svgContent = generatePageSvg(pageToExport, {
      unit,
      marginLeftMm,
      marginRightMm,
      marginTopMm,
      marginBottomMm,
      includeLabels,
      includeCropMarks,
      includeBaseDesignOutline,
      includePageHeader,
      storeName: storeInfo.name,
    });

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const sizeSlug = `${formatUnitValue(pageToExport.widthMm, unit)}x${formatUnitValue(
      pageToExport.heightMm,
      unit
    )}${unit}`;
    const modeSlug = mediaMode === 'roll' ? 'Roll' : `Hal-${pageToExport.pageNumber}`;
    link.href = url;
    link.download = `Template_${modeSlug}_${sizeSlug}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const rulerTicks = useMemo(() => {
    const stepChoicesMm: Record<LayoutUnit, number[]> = {
      mm: [5, 10, 20, 50, 100, 200, 500],
      cm: [10, 20, 50, 100, 200, 500, 1000],
      m: [100, 250, 500, 1000, 2000, 5000],
    };
    const pickStep = (maxMm: number) => {
      const choices = stepChoicesMm[unit];
      for (const c of choices) {
        if (maxMm / c <= 14) return c;
      }
      return choices[choices.length - 1];
    };

    const stepX = pickStep(activePage.widthMm);
    const stepY = pickStep(activePage.heightMm);

    const xTicks: number[] = [];
    for (let x = 0; x <= activePage.widthMm + 0.01; x += stepX) {
      xTicks.push(x);
    }
    const yTicks: number[] = [];
    for (let y = 0; y <= activePage.heightMm + 0.01; y += stepY) {
      yTicks.push(y);
    }
    return { xTicks, yTicks };
  }, [activePage.widthMm, activePage.heightMm, unit]);

  return (
    <div className="space-y-6">
      <ImportOrderItemsModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        allOrders={allOrders}
        unprocessedOrders={unprocessedOrders}
        receivables={receivables}
        products={products}
        categories={categories}
        finishingRules={finishingSpaceRules}
        unit={unit}
        onImportItems={handleImportOrderItems}
      />
      <FinishingRulesModal
        isOpen={isFinishingModalOpen}
        onClose={() => setIsFinishingModalOpen(false)}
        rules={finishingSpaceRules}
        masterFinishings={finishings}
        unit={unit}
        onSave={onSaveFinishingSpaceRules}
      />

      {/* Top Action & Live Unit & Smart Selection Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Unit Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Satuan:</span>
            <div className="inline-flex p-1 bg-gray-100 rounded-lg border border-gray-200">
              {(['mm', 'cm', 'm'] as LayoutUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    unit === u
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {u === 'm' ? 'meter (m)' : u}
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          {/* Nesting Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Susunan:</span>
            <div className="inline-flex p-1 bg-gray-100 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setAlgorithm('bestFit');
                  setAutoSyncLayout(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  algorithm === 'bestFit'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hemat Bahan
              </button>
              <button
                type="button"
                onClick={() => {
                  setAlgorithm('guillotineRow');
                  setAutoSyncLayout(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  algorithm === 'guillotineRow'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sejajar Lurus
              </button>
            </div>
          </div>

          <div className="h-6 w-px bg-gray-200 hidden sm:block" />

          {/* Smart Efficiency Selection Mode */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600">Seleksi Object:</span>
            <div className="inline-flex p-1 bg-gray-100 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setEfficiencyMode('all');
                  setAutoSyncLayout(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  efficiencyMode === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Susun Semua
              </button>
              <button
                type="button"
                onClick={() => {
                  setEfficiencyMode('smart');
                  setAutoSyncLayout(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  efficiencyMode === 'smart'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Susun Efisien
              </button>
            </div>

            {efficiencyMode === 'smart' && (
              <div className="flex items-center gap-1.5 text-xs bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <span className="text-emerald-800 font-medium whitespace-nowrap">Min. Efisiensi:</span>
                <input
                  type="number"
                  min={20}
                  max={98}
                  value={minEfficiencyPercent}
                  onChange={(e) => {
                    const val = Math.min(98, Math.max(20, parseInt(e.target.value, 10) || 75));
                    setMinEfficiencyPercent(val);
                    setAutoSyncLayout(true);
                  }}
                  className="w-12 p-0.5 text-center border border-emerald-300 rounded bg-white text-emerald-900 font-bold tabular-nums"
                />
                <span className="text-emerald-800 font-bold">%</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAutoSyncLayout(true);
              runAutoLayout();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 whitespace-nowrap shrink-0"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {hasManualEdits ? 'Reset & Susun Ulang' : 'Susun Otomatis'}
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPageSvg(activePage)}
            disabled={activePage.items.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:bg-gray-300 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Simpan SVG ({mediaMode === 'roll' ? 'Roll' : `Hal ${activePage.pageNumber}`})
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Media & Objects */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: Media & Margin & Gap */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-gray-800">1. Ukuran Bahan &amp; Jarak</h2>
              <div className="inline-flex p-0.5 bg-gray-100 rounded-md border border-gray-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMediaMode('sheet');
                    setAutoSyncLayout(true);
                  }}
                  className={`px-2.5 py-1 rounded ${
                    mediaMode === 'sheet' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Lembaran
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMediaMode('roll');
                    if (mediaWidthMm < 500) setMediaWidthMm(1000);
                    setAutoSyncLayout(true);
                  }}
                  className={`px-2.5 py-1 rounded ${
                    mediaMode === 'roll' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-600'
                  }`}
                >
                  Roll
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Preset Ukuran Bahan</label>
              <select
                value={selectedPresetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <optgroup label="Lembaran (A3+ / Kertas)">
                  {MEDIA_PRESETS.filter((p) => p.mode === 'sheet').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="custom-sheet">Custom Lembaran</option>
                </optgroup>
                <optgroup label="Roll (Large Format)">
                  {MEDIA_PRESETS.filter((p) => p.mode === 'roll').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="custom-roll">Custom Roll</option>
                </optgroup>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Lebar Media ({unit})
                </label>
                <UnitNumberInput
                  valueMm={mediaWidthMm}
                  unit={unit}
                  minMm={10}
                  onChangeMm={(mm) => {
                    setMediaWidthMm(mm);
                    setSelectedPresetId(mediaMode === 'sheet' ? 'custom-sheet' : 'custom-roll');
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {mediaMode === 'roll' ? `Panjang Roll (${unit})` : `Tinggi Media (${unit})`}
                </label>
                {mediaMode === 'roll' ? (
                  <div className="p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700 font-semibold tabular-nums">
                    Otomatis ({formatUnitValue(activePage.heightMm, unit)} {unit})
                  </div>
                ) : (
                  <UnitNumberInput
                    valueMm={mediaHeightMm}
                    unit={unit}
                    minMm={10}
                    onChangeMm={(mm) => {
                      setMediaHeightMm(mm);
                      setSelectedPresetId('custom-sheet');
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                )}
              </div>
            </div>

            {/* Margin Controls */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Margin Bahan ({unit})</span>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uniformMargin}
                    onChange={(e) => {
                      setUniformMargin(e.target.checked);
                      if (e.target.checked) {
                        setMarginRightMm(marginLeftMm);
                        setMarginTopMm(marginLeftMm);
                        setMarginBottomMm(marginLeftMm);
                      }
                    }}
                    className="rounded text-pink-600"
                  />
                  Seragam
                </label>
              </div>
              {uniformMargin ? (
                <div className="flex items-center gap-2">
                  <UnitNumberInput
                    valueMm={marginLeftMm}
                    unit={unit}
                    onChangeMm={(mm) => {
                      setMarginLeftMm(mm);
                      setMarginRightMm(mm);
                      setMarginTopMm(mm);
                      setMarginBottomMm(mm);
                    }}
                    className="w-full p-1.5 border border-gray-300 rounded-md text-sm"
                  />
                  <div className="flex gap-1">
                    {[0, 5, 10].map((presetMm) => (
                      <button
                        key={presetMm}
                        type="button"
                        onClick={() => {
                          setMarginLeftMm(presetMm);
                          setMarginRightMm(presetMm);
                          setMarginTopMm(presetMm);
                          setMarginBottomMm(presetMm);
                        }}
                        className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 hover:bg-gray-100 whitespace-nowrap"
                      >
                        {formatUnitValue(presetMm, unit)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-500">Kiri</label>
                    <UnitNumberInput
                      valueMm={marginLeftMm}
                      unit={unit}
                      onChangeMm={setMarginLeftMm}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500">Kanan</label>
                    <UnitNumberInput
                      valueMm={marginRightMm}
                      unit={unit}
                      onChangeMm={setMarginRightMm}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500">Atas</label>
                    <UnitNumberInput
                      valueMm={marginTopMm}
                      unit={unit}
                      onChangeMm={setMarginTopMm}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500">Bawah</label>
                    <UnitNumberInput
                      valueMm={marginBottomMm}
                      unit={unit}
                      onChangeMm={setMarginBottomMm}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Object Gap Controls */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">
                  Jarak Antar Object ({unit})
                </span>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkGap}
                    onChange={(e) => {
                      setLinkGap(e.target.checked);
                      if (e.target.checked) setGapYMm(gapXMm);
                    }}
                    className="rounded text-pink-600"
                  />
                  Samakan X &amp; Y
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500">
                    {linkGap ? `Jarak (${unit})` : `Jarak Horizontal (${unit})`}
                  </label>
                  <UnitNumberInput
                    valueMm={gapXMm}
                    unit={unit}
                    onChangeMm={(mm) => {
                      setGapXMm(mm);
                      if (linkGap) setGapYMm(mm);
                    }}
                    className="w-full p-1.5 border border-gray-300 rounded text-sm"
                  />
                </div>
                {!linkGap && (
                  <div>
                    <label className="block text-[11px] text-gray-500">Jarak Vertikal ({unit})</label>
                    <UnitNumberInput
                      valueMm={gapYMm}
                      unit={unit}
                      onChangeMm={setGapYMm}
                      className="w-full p-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: 'Mepet (0)', mm: 0 },
                  { label: '2 mm', mm: 2 },
                  { label: '3 mm', mm: 3 },
                  { label: '5 mm', mm: 5 },
                  { label: '1 cm', mm: 10 },
                ].map((preset) => {
                  const isActive = gapXMm === preset.mm && gapYMm === preset.mm;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setGapXMm(preset.mm);
                        setGapYMm(preset.mm);
                      }}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-pink-50 border-pink-500 text-pink-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Daftar Object with Independent Finishing Space & Shape Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <h2 className="text-base font-bold text-gray-800">
                2. Daftar Object ({objectSpecs.length})
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsFinishingModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 whitespace-nowrap"
                  title="Preset default penambahan ukuran saat menarik Order"
                >
                  <Cog6ToothIcon className="h-3.5 w-3.5" />
                  Preset Finishing
                </button>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-pink-700 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 whitespace-nowrap"
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                  Ambil dari Order
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {objectSpecs.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  Belum ada object. Klik <strong>+ Tambah Object</strong> atau <strong>Ambil dari Order</strong>.
                </div>
              ) : (
                objectSpecs.map((spec, idx) => {
                  const isDeferred = deferredIdSet.has(spec.id);
                  const isForced = forceIncludedIds.has(spec.id);

                  return (
                    <div
                      key={spec.id}
                      className={`border rounded-lg p-3 space-y-2.5 ${
                        isDeferred
                          ? 'border-amber-300 bg-amber-50/40'
                          : 'border-gray-200 bg-gray-50/60'
                      }`}
                    >
                      {/* Row 1: Color, Title, Defer/Delete */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            spec.shape === 'rectangle' ? 'rounded-sm' : 'rounded-full'
                          }`}
                          style={{ backgroundColor: spec.color }}
                        />
                        <input
                          type="text"
                          value={spec.label}
                          onChange={(e) => updateObjectGeometry(spec.id, { label: e.target.value })}
                          placeholder={`Object ${idx + 1}`}
                          className="flex-1 min-w-0 text-sm font-semibold text-gray-800 bg-white border border-gray-200 rounded px-2 py-1 focus:border-pink-500 focus:outline-none"
                        />
                        {!isDeferred ? (
                          <button
                            type="button"
                            onClick={() => handleManualDeferSpec(spec.id)}
                            className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 whitespace-nowrap"
                            title="Sisihkan sementara dari layout"
                          >
                            Sisihkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleForceIncludeSpec(spec.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded hover:bg-emerald-100 whitespace-nowrap"
                          >
                            Masukkan
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSpec(spec.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Hapus object"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Row 2: Shape Selector (Persegi / Lingkaran / Oval) */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-gray-500">Bentuk:</span>
                        <div className="inline-flex p-0.5 bg-gray-200/80 rounded-md text-[11px] font-semibold flex-1">
                          {(
                            [
                              { key: 'rectangle', label: 'Persegi' },
                              { key: 'circle', label: 'Lingkaran' },
                              { key: 'ellipse', label: 'Oval' },
                            ] as { key: ObjectShape; label: string }[]
                          ).map((sh) => (
                            <button
                              key={sh.key}
                              type="button"
                              onClick={() => updateObjectGeometry(spec.id, { shape: sh.key })}
                              className={`flex-1 py-1 rounded transition-colors ${
                                spec.shape === sh.key
                                  ? 'bg-white text-pink-600 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {sh.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Row 3: Design Dimensions + Qty */}
                      {spec.shape === 'circle' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-500">
                              Diameter Desain ({unit})
                            </label>
                            <UnitNumberInput
                              valueMm={spec.baseWidthMm}
                              unit={unit}
                              minMm={1}
                              onChangeMm={(mm) =>
                                updateObjectGeometry(spec.id, {
                                  baseWidthMm: mm,
                                  baseHeightMm: mm,
                                })
                              }
                              className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500">Qty (Pcs)</label>
                            <input
                              type="number"
                              min={1}
                              value={spec.qty}
                              onChange={(e) =>
                                updateObjectGeometry(spec.id, {
                                  qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs font-medium tabular-nums"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] text-gray-500">
                              Lebar Desain ({unit})
                            </label>
                            <UnitNumberInput
                              valueMm={spec.baseWidthMm}
                              unit={unit}
                              minMm={1}
                              onChangeMm={(mm) =>
                                updateObjectGeometry(spec.id, { baseWidthMm: mm })
                              }
                              className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500">
                              Tinggi Desain ({unit})
                            </label>
                            <UnitNumberInput
                              valueMm={spec.baseHeightMm}
                              unit={unit}
                              minMm={1}
                              onChangeMm={(mm) =>
                                updateObjectGeometry(spec.id, { baseHeightMm: mm })
                              }
                              className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500">Qty (Pcs)</label>
                            <input
                              type="number"
                              min={1}
                              value={spec.qty}
                              onChange={(e) =>
                                updateObjectGeometry(spec.id, {
                                  qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              className="w-full p-1.5 bg-white border border-gray-300 rounded text-xs font-medium tabular-nums"
                            />
                          </div>
                        </div>
                      )}

                      {/* Row 4: Independent Per-Object Space Finishing */}
                      <div className="bg-white border border-gray-200 rounded-md p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-gray-600">
                            Space Finishing Khusus Object Ini
                          </span>
                          <select
                            value=""
                            onChange={(e) => {
                              const picked = finishingSpaceRules.find(
                                (r) => r.finishingName === e.target.value
                              );
                              if (!picked) return;
                              updateObjectGeometry(spec.id, {
                                finishingName: picked.finishingName,
                                extraWidthMm: picked.extraWidthMm,
                                extraHeightMm:
                                  spec.shape === 'circle'
                                    ? picked.extraWidthMm
                                    : picked.extraHeightMm,
                              });
                            }}
                            className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-700"
                          >
                            <option value="" disabled>
                              {spec.finishingName ? `Preset: ${spec.finishingName}` : 'Pilih Preset...'}
                            </option>
                            {finishingSpaceRules.map((r) => (
                              <option key={r.finishingName} value={r.finishingName}>
                                {r.finishingName} (+{formatUnitValue(r.extraWidthMm, unit)}×
                                {formatUnitValue(r.extraHeightMm, unit)} {unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {spec.shape === 'circle' ? (
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-gray-500 whitespace-nowrap">
                              + Space Ø ({unit}):
                            </label>
                            <UnitNumberInput
                              valueMm={spec.extraWidthMm}
                              unit={unit}
                              minMm={0}
                              onChangeMm={(mm) =>
                                updateObjectGeometry(spec.id, {
                                  extraWidthMm: mm,
                                  extraHeightMm: mm,
                                })
                              }
                              className="w-24 p-1 border border-gray-300 rounded text-xs"
                            />
                            <span className="text-[11px] font-semibold text-pink-700 tabular-nums ml-auto">
                              Akhir: {formatDimensions(spec.widthMm, spec.heightMm, unit, spec.shape)}
                            </span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 items-end">
                            <div>
                              <label className="block text-[10px] text-gray-500">
                                + Space Lebar ({unit})
                              </label>
                              <UnitNumberInput
                                valueMm={spec.extraWidthMm}
                                unit={unit}
                                minMm={0}
                                onChangeMm={(mm) =>
                                  updateObjectGeometry(spec.id, { extraWidthMm: mm })
                                }
                                className="w-full p-1 border border-gray-300 rounded text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500">
                                + Space Tinggi ({unit})
                              </label>
                              <UnitNumberInput
                                valueMm={spec.extraHeightMm}
                                unit={unit}
                                minMm={0}
                                onChangeMm={(mm) =>
                                  updateObjectGeometry(spec.id, { extraHeightMm: mm })
                                }
                                className="w-full p-1 border border-gray-300 rounded text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {spec.shape !== 'circle' && (
                          <div className="flex justify-between items-center text-[11px] pt-0.5 text-gray-600 tabular-nums">
                            <span>Ukuran Akhir Layout:</span>
                            <strong className="text-pink-700">
                              {formatDimensions(spec.widthMm, spec.heightMm, unit, spec.shape)}
                            </strong>
                          </div>
                        )}
                      </div>

                      {/* Row 5: Rotate & Fill Sheet & Status */}
                      <div className="flex items-center justify-between pt-0.5 text-xs">
                        {spec.shape !== 'circle' ? (
                          <label className="flex items-center gap-1.5 text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={spec.allowRotate}
                              onChange={(e) =>
                                updateObjectGeometry(spec.id, { allowRotate: e.target.checked })
                              }
                              className="rounded text-pink-600"
                            />
                            Boleh putar 90°
                          </label>
                        ) : (
                          <span className="text-[11px] text-gray-500">
                            {isForced ? 'Dipaksa masuk layout' : 'Simetris (360°)'}
                          </span>
                        )}

                        {mediaMode === 'sheet' && !isDeferred && (
                          <button
                            type="button"
                            onClick={() => handleFillOneSheet(spec)}
                            className="text-[11px] font-semibold text-pink-600 hover:underline"
                          >
                            Isi penuh 1 lembar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={handleAddObject}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50/40 transition-colors"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Tambah Object {objectSpecs.length + 1}
            </button>
          </div>
        </div>

        {/* Right Workspace: Metrics, Deferred Pool, Warnings & Interactive Canvas */}
        <div className="lg:col-span-8 space-y-4">
          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3.5">
              <p className="text-xs text-gray-500">
                {mediaMode === 'roll' ? 'Panjang Roll Terpakai' : 'Total Halaman'}
              </p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">
                {mediaMode === 'roll'
                  ? `${formatUnitValue(activePage.heightMm, unit)} ${unit}`
                  : `${pages.length} Lembar`}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5">
              <p className="text-xs text-gray-500">Object Tertata</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">
                {metrics.totalPlaced} / {metrics.totalRequestedActive} pcs
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5">
              <p className="text-xs text-gray-500">Efisiensi Bahan</p>
              <p
                className={`text-lg font-bold tabular-nums mt-0.5 ${
                  metrics.activeEfficiency >= minEfficiencyPercent
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                {metrics.activeEfficiency.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3.5">
              <p className="text-xs text-gray-500">Luas Bahan Total</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">
                {metrics.totalMediaAreaM2.toFixed(2)} m²
              </p>
            </div>
          </div>

          {/* Deferred / Set Aside Items Panel (from Smart Efficiency Mode or manual defer) */}
          {deferredItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-amber-900">
                    Object Disisihkan ({deferredItems.length} Item — Kurang Optimal di Batch Ini)
                  </h3>
                  <p className="text-xs text-amber-800">
                    Item berikut dipisahkan agar efisiensi bahan tetap tinggi. Anda dapat mengganti ukuran media lalu menyusun item ini setelah mengekspor batch utama.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSwitchToDeferredOnly}
                  className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-white border border-amber-400 rounded-lg hover:bg-amber-100 whitespace-nowrap"
                >
                  Tukar: Susun yang Disisihkan Saja
                </button>
              </div>
              <div className="space-y-2">
                {deferredItems.map((def) => (
                  <div
                    key={def.specId}
                    className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800">
                        {def.label}{' '}
                        <span className="font-normal text-gray-600 tabular-nums">
                          ({formatDimensions(def.widthMm, def.heightMm, unit, def.shape)} · {def.qty} pcs)
                        </span>
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">{def.reason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleForceIncludeSpec(def.specId)}
                      className="px-2.5 py-1 text-xs font-semibold text-pink-700 bg-pink-50 border border-pink-200 rounded-md hover:bg-pink-100 whitespace-nowrap"
                    >
                      Paksa Gabung
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unplaced Items Warning */}
          {unplacedItems.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3.5 flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-900 space-y-1">
                <p className="font-bold">
                  {unplacedItems.length} item melebihi ukuran area cetak media:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {unplacedItems.slice(0, 4).map((u, i) => (
                    <li key={i}>
                      <strong>{u.label}</strong> ({formatDimensions(u.widthMm, u.heightMm, unit, u.shape)}) —{' '}
                      {u.reason}
                    </li>
                  ))}
                  {unplacedItems.length > 4 && (
                    <li>...dan {unplacedItems.length - 4} item lainnya.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Overlap / Out of bounds warning after manual drag */}
          {(pageIssues.overlappingIds.size > 0 || pageIssues.outOfBoundsIds.size > 0) && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-2.5 text-xs text-red-800">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span>
                Perhatian: Ada object berwarna merah yang{' '}
                {pageIssues.overlappingIds.size > 0 && 'bertumpuk'}
                {pageIssues.overlappingIds.size > 0 && pageIssues.outOfBoundsIds.size > 0 && ' atau '}
                {pageIssues.outOfBoundsIds.size > 0 && 'keluar dari batas margin area cetak'}.
              </span>
            </div>
          )}

          {/* Visual Canvas Card */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            {/* Canvas Top Toolbar */}
            <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {pages.map((pg, idx) => (
                  <div key={pg.pageNumber} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePageIndex(idx);
                        setSelectedInstanceId(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-l-lg border transition-colors ${
                        activePageIndex === idx
                          ? 'bg-pink-600 text-white border-pink-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {mediaMode === 'roll' ? 'Roll Preview' : `Hal ${pg.pageNumber}`} ({pg.items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPageSvg(pg)}
                      disabled={pg.items.length === 0}
                      title={`Unduh SVG Halaman ${pg.pageNumber}`}
                      className={`px-2 py-1.5 text-xs border-y border-r rounded-r-lg transition-colors ${
                        activePageIndex === idx
                          ? 'bg-pink-700 text-white border-pink-700 hover:bg-pink-800'
                          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                      } disabled:opacity-40`}
                    >
                      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {usedHexCircles && (
                  <span className="ml-2 text-xs font-medium text-emerald-700">
                    Susunan Sarang Lebah Aktif (Lingkaran Optimal)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 mr-1 tabular-nums">
                  {formatDimensions(activePage.widthMm, activePage.heightMm, unit)}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.4, Math.round((z - 0.2) * 10) / 10))}
                  className="px-2 py-1 text-xs font-bold border border-gray-300 rounded bg-white hover:bg-gray-100"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1)}
                  className="px-2.5 py-1 text-xs font-semibold border border-gray-300 rounded bg-white hover:bg-gray-100 tabular-nums"
                >
                  {Math.round(zoomScale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(3, Math.round((z + 0.2) * 10) / 10))}
                  className="px-2 py-1 text-xs font-bold border border-gray-300 rounded bg-white hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            {/* Selected Object Contextual Bar */}
            {selectedPlacedItem && (
              <div className="px-4 py-2.5 border-b bg-pink-50/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-gray-800 truncate max-w-[220px]">
                    {selectedPlacedItem.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">X:</span>
                    <UnitNumberInput
                      valueMm={selectedPlacedItem.x}
                      unit={unit}
                      onChangeMm={(mm) => handleUpdateSelectedPlacedItem({ x: mm })}
                      className="w-16 p-1 bg-white border border-gray-300 rounded text-xs"
                    />
                    <span className="text-gray-600">Y:</span>
                    <UnitNumberInput
                      valueMm={selectedPlacedItem.y}
                      unit={unit}
                      onChangeMm={(mm) => handleUpdateSelectedPlacedItem({ y: mm })}
                      className="w-16 p-1 bg-white border border-gray-300 rounded text-xs"
                    />
                    <span className="text-gray-500 tabular-nums ml-1">
                      ({formatDimensions(selectedPlacedItem.width, selectedPlacedItem.height, unit, selectedPlacedItem.shape)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPlacedItem.shape !== 'circle' && (
                    <button
                      type="button"
                      onClick={handleRotateSelectedItem}
                      className="px-2.5 py-1 bg-white border border-gray-300 rounded font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Putar 90°
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRemoveSelectedItemFromCanvas}
                    className="px-2.5 py-1 bg-white border border-red-200 text-red-600 rounded font-semibold hover:bg-red-50"
                  >
                    Hapus dari Halaman
                  </button>
                </div>
              </div>
            )}

            {/* Artboard Viewport with Rulers */}
            <div
              ref={canvasWrapperRef}
              onClick={() => setSelectedInstanceId(null)}
              className="overflow-auto bg-slate-100 p-6 min-h-[520px] max-h-[680px] flex justify-center items-start select-none"
            >
              <div className="inline-block">
                {/* Top X Ruler */}
                <div className="flex">
                  <div className="w-8 h-6 bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                    {unit}
                  </div>
                  <div
                    className="relative h-6 bg-slate-200 border-y border-r border-slate-300 overflow-hidden"
                    style={{ width: `${activePage.widthMm * effectivePxPerMm}px` }}
                  >
                    {rulerTicks.xTicks.map((tickMm) => (
                      <div
                        key={tickMm}
                        className="absolute top-0 bottom-0 border-l border-slate-400 text-[9px] text-slate-700 pl-0.5 tabular-nums"
                        style={{ left: `${tickMm * effectivePxPerMm}px` }}
                      >
                        {formatUnitValue(tickMm, unit)}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex">
                  {/* Left Y Ruler */}
                  <div
                    className="relative w-8 bg-slate-200 border-x border-b border-slate-300 overflow-hidden flex-shrink-0"
                    style={{ height: `${activePage.heightMm * effectivePxPerMm}px` }}
                  >
                    {rulerTicks.yTicks.map((tickMm) => (
                      <div
                        key={tickMm}
                        className="absolute left-0 right-0 border-t border-slate-400 text-[9px] text-slate-700 px-0.5 tabular-nums"
                        style={{ top: `${tickMm * effectivePxPerMm}px` }}
                      >
                        {formatUnitValue(tickMm, unit)}
                      </div>
                    ))}
                  </div>

                  {/* Physical Media Canvas */}
                  <div
                    className="relative bg-white shadow-md border border-slate-300"
                    style={{
                      width: `${activePage.widthMm * effectivePxPerMm}px`,
                      height: `${activePage.heightMm * effectivePxPerMm}px`,
                      backgroundImage:
                        'linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)',
                      backgroundSize: `${Math.max(12, 20 * effectivePxPerMm)}px ${Math.max(
                        12,
                        20 * effectivePxPerMm
                      )}px`,
                    }}
                  >
                    {/* Margin Printable Guide */}
                    {(marginLeftMm > 0 ||
                      marginRightMm > 0 ||
                      marginTopMm > 0 ||
                      marginBottomMm > 0) && (
                      <div
                        className="absolute border border-dashed border-sky-400 pointer-events-none"
                        style={{
                          left: `${marginLeftMm * effectivePxPerMm}px`,
                          top: `${marginTopMm * effectivePxPerMm}px`,
                          width: `${Math.max(
                            0,
                            (activePage.widthMm - marginLeftMm - marginRightMm) * effectivePxPerMm
                          )}px`,
                          height: `${Math.max(
                            0,
                            (activePage.heightMm - marginTopMm - marginBottomMm) * effectivePxPerMm
                          )}px`,
                        }}
                      />
                    )}

                    {/* Placed Vector Items (Rectangle, Circle, Ellipse) */}
                    {activePage.items.map((item) => {
                      const isSelected = item.instanceId === selectedInstanceId;
                      const isError =
                        pageIssues.overlappingIds.has(item.instanceId) ||
                        pageIssues.outOfBoundsIds.has(item.instanceId);

                      const pxW = item.width * effectivePxPerMm;
                      const pxH = item.height * effectivePxPerMm;
                      const pxX = item.x * effectivePxPerMm;
                      const pxY = item.y * effectivePxPerMm;
                      const isRound = item.shape === 'circle' || item.shape === 'ellipse';

                      const hasFinishingInner =
                        includeBaseDesignOutline &&
                        item.baseWidthMm &&
                        item.baseHeightMm &&
                        (Math.abs((item.rotated ? item.baseHeightMm : item.baseWidthMm) - item.width) > 0.1 ||
                          Math.abs((item.rotated ? item.baseWidthMm : item.baseHeightMm) - item.height) > 0.1);

                      const innerW = hasFinishingInner
                        ? (item.rotated ? item.baseHeightMm! : item.baseWidthMm!) * effectivePxPerMm
                        : 0;
                      const innerH = hasFinishingInner
                        ? (item.rotated ? item.baseWidthMm! : item.baseHeightMm!) * effectivePxPerMm
                        : 0;

                      const showText = pxW > 34 && pxH > 22;

                      return (
                        <div
                          key={item.instanceId}
                          onMouseDown={(e) => handleMouseDownItem(e, item)}
                          onClick={(e) => e.stopPropagation()}
                          title={`${item.label} (${formatDimensions(item.width, item.height, unit, item.shape)})`}
                          className={`absolute cursor-move flex flex-col items-center justify-center text-center overflow-hidden transition-shadow ${
                            isSelected ? 'ring-2 ring-gray-900 z-20 shadow-md' : 'z-10'
                          }`}
                          style={{
                            left: `${pxX}px`,
                            top: `${pxY}px`,
                            width: `${pxW}px`,
                            height: `${pxH}px`,
                            borderRadius: isRound ? '9999px' : '0px',
                            border: `${isSelected ? 2 : 1.5}px solid ${
                              isError ? '#dc2626' : item.color
                            }`,
                            backgroundColor: isError
                              ? 'rgba(220, 38, 38, 0.14)'
                              : `${item.color}18`,
                          }}
                        >
                          {hasFinishingInner && innerW > 0 && innerH > 0 && (
                            <div
                              className="absolute border border-dashed pointer-events-none"
                              style={{
                                width: `${innerW}px`,
                                height: `${innerH}px`,
                                borderRadius: isRound ? '9999px' : '0px',
                                borderColor: item.color,
                                opacity: 0.75,
                              }}
                            />
                          )}

                          {showText && (
                            <div className="px-1.5 pointer-events-none select-none max-w-full">
                              <p
                                className="font-bold leading-tight truncate"
                                style={{
                                  fontSize: `${Math.max(8, Math.min(12, pxW / 12))}px`,
                                  color: isError ? '#991b1b' : item.color,
                                }}
                              >
                                {item.label}
                              </p>
                              {pxH > 32 && (
                                <p className="text-[10px] text-gray-700 font-medium tabular-nums leading-tight truncate">
                                  {formatDimensions(item.width, item.height, unit, item.shape)}
                                  {item.rotated ? ' ↻' : ''}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Export Options Footer inside Canvas Card */}
            <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold text-gray-700">Isi File SVG (CorelDRAW 1:1):</span>
                <label className="flex items-center gap-1.5 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLabels}
                    onChange={(e) => setIncludeLabels(e.target.checked)}
                    className="rounded text-pink-600"
                  />
                  Judul &amp; Ukuran
                </label>
                <label className="flex items-center gap-1.5 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBaseDesignOutline}
                    onChange={(e) => setIncludeBaseDesignOutline(e.target.checked)}
                    className="rounded text-pink-600"
                  />
                  Garis Area Desain (Sebelum Finishing)
                </label>
                <label className="flex items-center gap-1.5 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCropMarks}
                    onChange={(e) => setIncludeCropMarks(e.target.checked)}
                    className="rounded text-pink-600"
                  />
                  Crop Marks (Persegi)
                </label>
                <label className="flex items-center gap-1.5 text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePageHeader}
                    onChange={(e) => setIncludePageHeader(e.target.checked)}
                    className="rounded text-pink-600"
                  />
                  Info Halaman
                </label>
              </div>

              <div className="flex items-center gap-2 text-gray-500">
                <CheckIcon className="h-4 w-4 text-emerald-600" />
                <span>Vektor murni (rect / circle / ellipse) skala 1:1 mm siap di-Import ke CorelDRAW</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintLayout;
