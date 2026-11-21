import * as XLSX from 'xlsx';
import {
    type SavedOrder,
    type ReceivableItem,
    type InventoryItem,
    type ProductData,
    type CategoryData,
    type CustomerData,
    type FinishingData,
    type OrderItemData,
    type InventoryItemMeta,
    type ProductCostMeta,
    type ProductCostGroup,
    type LegacyMonthlyIncome,
    type LegacyMonthlyExpense,
    type LegacyReceivable,
} from '../types';

export interface EffectiveProductCost {
    costPrice: number;
    source: 'group' | 'manual' | 'none';
    group?: ProductCostGroup;
}

export const resolveEffectiveProductCost = (
    productId: number | null | undefined,
    productCostMetadata: Record<number, ProductCostMeta> = {},
    costGroupsMap?: Map<string, ProductCostGroup> | ProductCostGroup[]
): EffectiveProductCost => {
    if (!productId) return { costPrice: 0, source: 'none' };
    const meta = productCostMetadata[productId];
    if (!meta) return { costPrice: 0, source: 'none' };

    if (meta.costGroupId && costGroupsMap) {
        const group = Array.isArray(costGroupsMap)
            ? costGroupsMap.find(g => g.id === meta.costGroupId)
            : costGroupsMap.get(meta.costGroupId);
        if (group && Number(group.costPrice) > 0) {
            return { costPrice: Number(group.costPrice), source: 'group', group };
        }
    }

    const manualCost = Number(meta.costPrice || 0);
    if (manualCost > 0) {
        return { costPrice: manualCost, source: 'manual' };
    }

    return { costPrice: 0, source: 'none' };
};

export interface ReceivableReportData {
    id: string;
    nota_id?: string;
    customer: string;
    amount: number;
    discount?: number;
    paid: number;
    remaining: number;
    paymentStatus: string;
    productionStatus: string;
    due: string;
    type?: 'new' | 'legacy';
    dueStatusLabel?: string;
}

export const formatSafeDateId = (dateString?: string): string => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
    }
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

const getLocalTodaySlug = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const getCustomerLevelForOrder = (
    orderCustomer: string,
    customersMap: Map<string, CustomerData>
): CustomerData['level'] => {
    const match = orderCustomer.match(/\(([^)]+)\)/);
    if (match) {
        const level = match[1] as CustomerData['level'];
        if (['End Customer', 'Retail', 'Grosir', 'Reseller', 'Corporate'].includes(level)) {
            return level;
        }
    }
    const customerData = customersMap.get(orderCustomer);
    return customerData ? customerData.level : 'End Customer';
};

export const hasOrderItemSnapshot = (item: OrderItemData): boolean => {
    return (
        (item.customPrice !== undefined && item.customPrice !== null) ||
        (item.unitPriceSnapshot !== undefined && item.unitPriceSnapshot !== null) ||
        (item.lineTotalSnapshot !== undefined && item.lineTotalSnapshot !== null)
    );
};

export const getMasterOrderItemPrices = (
    item: OrderItemData,
    orderCustomer: string,
    productsMap: Map<number, ProductData>,
    categoriesMap: Map<string, CategoryData>,
    customersMap: Map<string, CustomerData>,
    finishingsMap: Map<string, FinishingData>
): { materialPrice: number; finishingPrice: number; isAreaBased: boolean; priceMultiplier: number; lineTotal: number } => {
    if (!item.productId) {
        return { materialPrice: 0, finishingPrice: 0, isAreaBased: false, priceMultiplier: 1, lineTotal: 0 };
    }

    const productInfo = productsMap.get(item.productId);
    if (!productInfo) {
        return { materialPrice: 0, finishingPrice: 0, isAreaBased: false, priceMultiplier: 1, lineTotal: 0 };
    }

    const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
        'End Customer': 'endCustomer',
        'Retail': 'retail',
        'Grosir': 'grosir',
        'Reseller': 'reseller',
        'Corporate': 'corporate'
    };
    const customerLevel = getCustomerLevelForOrder(orderCustomer, customersMap);
    const priceKey = priceLevelMap[customerLevel];

    const finishingInfo = finishingsMap.get(item.finishing);
    const categoryInfo = categoriesMap.get(productInfo.category);
    const isAreaBased = categoryInfo?.unitType === 'Per Luas';

    const materialPrice = Number(productInfo.price[priceKey] || productInfo.price.endCustomer || 0);
    const finishingPrice = finishingInfo ? Number(finishingInfo.price || 0) : 0;
    let priceMultiplier = 1;

    if (isAreaBased) {
        const length = parseFloat(item.length) || 0;
        const width = parseFloat(item.width) || 0;
        priceMultiplier = length * width;
    }

    const qty = Number(item.qty || 0);
    const lineTotal = materialPrice * priceMultiplier * qty + finishingPrice * qty;
    return { materialPrice, finishingPrice, isAreaBased, priceMultiplier, lineTotal };
};

// Canonical item price formula matching Sales.tsx & Receivables.tsx:
// 1) Custom price takes precedence
// 2) Unit price snapshot + finishing price snapshot (when present) take precedence over master prices
// 3) Line total snapshot fallback (e.g., if product was later deleted or legacy line was frozen)
// 4) Current master prices (legacy orders without snapshots)
export const calculateCanonicalOrderItemPrice = (
    item: OrderItemData,
    orderCustomer: string,
    productsMap: Map<number, ProductData>,
    categoriesMap: Map<string, CategoryData>,
    customersMap: Map<string, CustomerData>,
    finishingsMap: Map<string, FinishingData>
): number => {
    if (item.customPrice !== undefined && item.customPrice !== null) {
        return Number(item.customPrice) || 0;
    }

    const productInfo = item.productId ? productsMap.get(item.productId) : undefined;
    const finishingInfo = finishingsMap.get(item.finishing);
    const qty = Number(item.qty || 0);

    if (item.unitPriceSnapshot !== undefined && item.unitPriceSnapshot !== null) {
        const materialPrice = Number(item.unitPriceSnapshot) || 0;
        const finishingPrice =
            item.finishingPriceSnapshot !== undefined && item.finishingPriceSnapshot !== null
                ? Number(item.finishingPriceSnapshot) || 0
                : (finishingInfo ? Number(finishingInfo.price || 0) : 0);

        let isAreaBased = false;
        if (productInfo) {
            isAreaBased = categoriesMap.get(productInfo.category)?.unitType === 'Per Luas';
        } else if (item.lineTotalSnapshot !== undefined && item.lineTotalSnapshot !== null) {
            return Number(item.lineTotalSnapshot) || 0;
        }

        const priceMultiplier = isAreaBased
            ? (parseFloat(item.length) || 0) * (parseFloat(item.width) || 0)
            : 1;

        return materialPrice * priceMultiplier * qty + finishingPrice * qty;
    }

    if (item.lineTotalSnapshot !== undefined && item.lineTotalSnapshot !== null) {
        return Number(item.lineTotalSnapshot) || 0;
    }

    return getMasterOrderItemPrices(item, orderCustomer, productsMap, categoriesMap, customersMap, finishingsMap).lineTotal;
};

export const calculateOrderTotalFromItems = (
    orderItems: OrderItemData[],
    orderCustomer: string,
    productsMap: Map<number, ProductData>,
    categoriesMap: Map<string, CategoryData>,
    customersMap: Map<string, CustomerData>,
    finishingsMap: Map<string, FinishingData>
): number => {
    const rawTotal = orderItems.reduce(
        (sum, item) => sum + calculateCanonicalOrderItemPrice(item, orderCustomer, productsMap, categoriesMap, customersMap, finishingsMap),
        0
    );
    return Math.ceil(rawTotal / 500) * 500;
};

export const calculateMasterOrderTotal = (
    orderItems: OrderItemData[],
    orderCustomer: string,
    productsMap: Map<number, ProductData>,
    categoriesMap: Map<string, CategoryData>,
    customersMap: Map<string, CustomerData>,
    finishingsMap: Map<string, FinishingData>
): number => {
    const rawTotal = orderItems.reduce(
        (sum, item) => sum + getMasterOrderItemPrices(item, orderCustomer, productsMap, categoriesMap, customersMap, finishingsMap).lineTotal,
        0
    );
    return Math.ceil(rawTotal / 500) * 500;
};

export const stampOrderItemsWithSnapshots = (
    orderItems: OrderItemData[],
    orderCustomer: string,
    productsMap: Map<number, ProductData>,
    categoriesMap: Map<string, CategoryData>,
    customersMap: Map<string, CustomerData>,
    finishingsMap: Map<string, FinishingData>,
    options?: { forceMaster?: boolean; lockedAt?: string }
): OrderItemData[] => {
    const lockedAt = options?.lockedAt || new Date().toISOString();
    const forceMaster = Boolean(options?.forceMaster);

    return orderItems.map(item => {
        const master = getMasterOrderItemPrices(item, orderCustomer, productsMap, categoriesMap, customersMap, finishingsMap);

        if (!forceMaster && item.customPrice !== undefined && item.customPrice !== null) {
            return {
                ...item,
                priceLockedAt: item.priceLockedAt || lockedAt,
            };
        }

        if (!forceMaster && item.unitPriceSnapshot !== undefined && item.unitPriceSnapshot !== null) {
            const finishingSnap =
                item.finishingPriceSnapshot !== undefined && item.finishingPriceSnapshot !== null
                    ? Number(item.finishingPriceSnapshot)
                    : master.finishingPrice;
            const qty = Number(item.qty || 0);
            const recomputedLineTotal = Number(item.unitPriceSnapshot) * master.priceMultiplier * qty + finishingSnap * qty;
            return {
                ...item,
                finishingPriceSnapshot: finishingSnap,
                lineTotalSnapshot: recomputedLineTotal,
                priceLockedAt: item.priceLockedAt || lockedAt,
            };
        }

        if (!forceMaster && item.lineTotalSnapshot !== undefined && item.lineTotalSnapshot !== null) {
            return {
                ...item,
                priceLockedAt: item.priceLockedAt || lockedAt,
            };
        }

        const nextItem: OrderItemData = {
            ...item,
            unitPriceSnapshot: master.materialPrice,
            finishingPriceSnapshot: master.finishingPrice,
            lineTotalSnapshot: master.lineTotal,
            priceLockedAt: lockedAt,
        };
        if (forceMaster && nextItem.customPrice !== undefined) {
            delete nextItem.customPrice;
        }
        return nextItem;
    });
};

export const resolveLockedOrderItemTotals = (
    orderItems: OrderItemData[],
    savedOrderTotal: number,
    orderCustomer: string,
    productsMap: Map<number, ProductData>,
    categoriesMap: Map<string, CategoryData>,
    customersMap: Map<string, CustomerData>,
    finishingsMap: Map<string, FinishingData>
): { itemTotals: number[]; unroundedSum: number; masterTotal: number; hasPriceDrift: boolean } => {
    if (!orderItems || orderItems.length === 0) {
        return { itemTotals: [], unroundedSum: 0, masterTotal: 0, hasPriceDrift: false };
    }

    const rawTotals = orderItems.map(item =>
        calculateCanonicalOrderItemPrice(item, orderCustomer, productsMap, categoriesMap, customersMap, finishingsMap)
    );
    const unroundedSum = rawTotals.reduce((s, v) => s + v, 0);
    const masterTotal = calculateMasterOrderTotal(orderItems, orderCustomer, productsMap, categoriesMap, customersMap, finishingsMap);
    const targetTotal = Number(savedOrderTotal || 0);
    const diff = targetTotal - unroundedSum;
    const hasPriceDrift = targetTotal > 0 && Math.abs(targetTotal - masterTotal) >= 500;

    // Normal rounding-up-to-500 gap (0 <= diff < 500): preserve legacy last-item rounding behavior
    if (diff >= 0 && diff < 500) {
        const itemTotals = [...rawTotals];
        itemTotals[itemTotals.length - 1] += diff;
        return { itemTotals, unroundedSum, masterTotal, hasPriceDrift };
    }

    // Legacy or adjusted order where savedOrderTotal differs significantly from rawTotals:
    // Keep explicitly snapshotted/custom items fixed when possible and proportionally scale unlocked items
    // so itemTotals always sum cleanly to savedOrderTotal without negative values or dumping drift onto 1 item.
    const itemTotals = [...rawTotals];
    const unlockedIndices: number[] = [];
    let lockedSum = 0;

    orderItems.forEach((item, idx) => {
        if (hasOrderItemSnapshot(item)) {
            lockedSum += rawTotals[idx];
        } else {
            unlockedIndices.push(idx);
        }
    });

    if (unlockedIndices.length > 0 && lockedSum <= targetTotal) {
        const remainingForUnlocked = targetTotal - lockedSum;
        const unlockedRawSum = unlockedIndices.reduce((s, idx) => s + rawTotals[idx], 0);
        let allocated = 0;

        unlockedIndices.forEach((idx, pos) => {
            if (pos === unlockedIndices.length - 1) {
                itemTotals[idx] = Math.max(0, remainingForUnlocked - allocated);
            } else {
                const share = unlockedRawSum > 0
                    ? Math.round((rawTotals[idx] / unlockedRawSum) * remainingForUnlocked)
                    : Math.round(remainingForUnlocked / unlockedIndices.length);
                const clampedShare = Math.max(0, Math.min(share, remainingForUnlocked - allocated));
                itemTotals[idx] = clampedShare;
                allocated += clampedShare;
            }
        });
        return { itemTotals, unroundedSum, masterTotal, hasPriceDrift };
    }

    // Fallback: proportionally distribute targetTotal across all items
    let allocated = 0;
    rawTotals.forEach((raw, idx) => {
        if (idx === rawTotals.length - 1) {
            itemTotals[idx] = Math.max(0, targetTotal - allocated);
        } else {
            const share = unroundedSum > 0
                ? Math.round((raw / unroundedSum) * targetTotal)
                : Math.round(targetTotal / rawTotals.length);
            const clampedShare = Math.max(0, Math.min(share, targetTotal - allocated));
            itemTotals[idx] = clampedShare;
            allocated += clampedShare;
        }
    });

    return { itemTotals, unroundedSum, masterTotal, hasPriceDrift };
};

export const exportToExcel = (
    reportType:
        | 'sales'
        | 'receivables'
        | 'inventory'
        | 'cashFlow'
        | 'profitAndLoss'
        | 'categorySales'
        | 'assetsDebts'
        | 'legacySales'
        | 'legacyReceivables',
    data: any,
    dateRange: { startDate: string; endDate: string },
    extraData?: {
        products?: ProductData[];
        categories?: CategoryData[];
        customers?: CustomerData[];
        finishings?: FinishingData[];
        receivables?: ReceivableItem[];
        lowStockThreshold?: number;
        inventoryMetadata?: Record<number, InventoryItemMeta>;
    }
) => {
    const wb = XLSX.utils.book_new();
    const today = getLocalTodaySlug();
    const fileName = `Laporan_${reportType}_${dateRange.startDate || 'awal'}_sampai_${dateRange.endDate || today}.xlsx`;

    if (reportType === 'sales' && data && extraData?.products && extraData.categories && extraData.customers && extraData.finishings && extraData.receivables) {
        const transactions = data.transactions as SavedOrder[];
        const { products, categories, customers, finishings, receivables } = extraData;

        const productsMap = new Map<number, ProductData>(products.map(p => [p.id, p]));
        const categoriesMap = new Map<string, CategoryData>(categories.map(c => [c.name, c]));
        const customersMap = new Map<string, CustomerData>(customers.map(c => [c.name, c]));
        const finishingsMap = new Map<string, FinishingData>(finishings.map(f => [f.name, f]));
        const receivablesMap = new Map<string, ReceivableItem>(receivables.map(r => [r.id, r]));

        let rowNum = 1;
        const flattenedData = transactions.flatMap(order => {
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
            const orderDiscount = receivable?.discount || 0;
            const netOrderTotal = Math.max(0, order.totalPrice - orderDiscount);

            return order.orderItems.map((item, index) => {
                const product = item.productId ? productsMap.get(item.productId) : null;
                const itemTotal = itemTotals[index] ?? 0;

                return {
                    'No.': rowNum++,
                    'Tanggal': formatSafeDateId(order.orderDate),
                    'No. Nota': order.id,
                    'Nama Pelanggan': order.customer,
                    'Deskripsi': item.description,
                    'Bahan': product?.name || 'N/A',
                    'Panjang': isNaN(parseFloat(item.length)) ? item.length : parseFloat(item.length),
                    'Lebar': isNaN(parseFloat(item.width)) ? item.width : parseFloat(item.width),
                    'Qty': item.qty,
                    'Subtotal Item': itemTotal,
                    'Diskon Nota': index === 0 ? orderDiscount : 0,
                    'Total Bersih Nota': index === 0 ? netOrderTotal : '',
                    'Status Pembayaran': receivable ? receivable.paymentStatus : 'Belum Diproses'
                };
            });
        });

        const transactionsSheet = XLSX.utils.json_to_sheet(
            flattenedData.length > 0 ? flattenedData : [{ Info: 'Tidak ada data penjualan pada periode ini.' }]
        );
        XLSX.utils.book_append_sheet(wb, transactionsSheet, 'Data Transaksi');

    } else if (reportType === 'receivables' && Array.isArray(data)) {
        const receivablesData = data as ReceivableReportData[];
        const rows = receivablesData.map((r) => {
            const grossAmount = Number(r.amount || 0);
            const discount = Number(r.discount || 0);
            const netBill = Math.max(0, grossAmount - discount);
            return {
                'No Nota': r.type === 'legacy' && r.nota_id ? r.nota_id : r.id,
                'Sumber': r.type === 'legacy' ? 'Data Lama' : 'Sistem Baru',
                'Pelanggan': r.customer,
                'Tagihan Kotor': grossAmount,
                'Diskon': discount,
                'Tagihan Bersih': netBill,
                'Sudah Dibayar': Number(r.paid || 0),
                'Sisa Tagihan': Number(r.remaining || 0),
                'Status Bayar': r.paymentStatus || 'Belum Lunas',
                'Status Produksi': r.productionStatus || '-',
                'Tanggal Jatuh Tempo': formatSafeDateId(r.due),
                'Status Jatuh Tempo': r.dueStatusLabel || '-',
            };
        });
        const receivablesSheet = XLSX.utils.json_to_sheet(
            rows.length > 0 ? rows : [{ Info: 'Tidak ada data piutang pada periode ini.' }]
        );
        XLSX.utils.book_append_sheet(wb, receivablesSheet, 'Laporan Piutang');

    } else if (reportType === 'inventory' && Array.isArray(data)) {
        const inventoryData = data as InventoryItem[];
        const threshold = extraData?.lowStockThreshold ?? 10;
        const metaMap = extraData?.inventoryMetadata || {};
        const rows = inventoryData.map((i) => {
            const meta = metaMap[i.id];
            return {
                'Nama Item': i.name,
                'SKU': i.sku,
                'Kategori': meta?.category || 'Bahan Baku',
                'Tipe': i.type,
                'Stok Saat Ini': i.stock,
                'Satuan': i.unit,
                'Status Stok': i.stock <= threshold ? 'Stok Menipis' : 'Tersedia',
                'Kondisi': meta?.condition || 'Baik',
                'Catatan': meta?.notes || '-',
            };
        });
        const inventorySheet = XLSX.utils.json_to_sheet(
            rows.length > 0 ? rows : [{ Info: 'Tidak ada data inventori.' }]
        );
        XLSX.utils.book_append_sheet(wb, inventorySheet, 'Laporan Stok');

    } else if (reportType === 'categorySales' && data) {
        const categoryRows = (Array.isArray(data.categories) ? data.categories : []).map((c: any, idx: number) => ({
            'No': idx + 1,
            'Kategori': c.categoryName,
            'Tipe Satuan': c.unitType,
            'Jumlah Nota': Number(c.orderCount || 0),
            'Jumlah Baris Item': Number(c.itemLineCount || 0),
            'Total Qty': Number(c.totalQty || 0),
            'Total Luas (m2)': Number((c.totalAreaM2 || 0).toFixed(2)),
            'Penjualan Kotor (Rp)': Math.round(Number(c.grossSales || 0)),
            'Alokasi Diskon (Rp)': Math.round(Number(c.discountShare || 0)),
            'Penjualan Bersih (Rp)': Math.round(Number(c.netSales || 0)),
            'Estimasi HPP (Rp)': Math.round(Number(c.estimatedCost || 0)),
            'Estimasi Laba Kotor (Rp)': Math.round(Number(c.grossProfit || 0)),
            'Margin (%)': Number((c.marginPercent || 0).toFixed(2)),
            'Kontribusi (%)': Number((c.sharePercent || 0).toFixed(2)),
        }));
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(categoryRows.length > 0 ? categoryRows : [{ Info: 'Tidak ada penjualan kategori pada periode ini.' }]),
            'Penjualan per Kategori'
        );

        const productRows = (Array.isArray(data.topProducts) ? data.topProducts : []).map((p: any, idx: number) => ({
            'No': idx + 1,
            'Produk / Bahan': p.productName,
            'Kategori': p.categoryName,
            'Jumlah Nota': Number(p.orderCount || 0),
            'Total Qty': Number(p.totalQty || 0),
            'Total Luas (m2)': Number((p.totalAreaM2 || 0).toFixed(2)),
            'Penjualan Kotor (Rp)': Math.round(Number(p.grossSales || 0)),
            'Penjualan Bersih (Rp)': Math.round(Number(p.netSales || 0)),
            'Estimasi HPP (Rp)': Math.round(Number(p.estimatedCost || 0)),
            'Estimasi Laba Kotor (Rp)': Math.round(Number(p.grossProfit || 0)),
            'Margin (%)': Number((p.marginPercent || 0).toFixed(2)),
        }));
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(productRows.length > 0 ? productRows : [{ Info: 'Tidak ada data produk pada periode ini.' }]),
            'Produk Terlaris'
        );

    } else if (reportType === 'assetsDebts' && data) {
        const summaryRows = [
            { Komponen: 'Aset Lancar - Kas Laci Aktif', 'Nilai (Rp)': Number(data.cashDrawerBalance || 0) },
            { Komponen: 'Aset Lancar - Rekening Bank / QRIS / E-Wallet', 'Nilai (Rp)': Number(data.totalBankBalance || 0) },
            { Komponen: 'Aset Lancar - Kas Dipegang Owner', 'Nilai (Rp)': Number(data.ownerHoldBalance || 0) },
            { Komponen: 'Aset Lancar - Piutang Pelanggan (Baru + Lama)', 'Nilai (Rp)': Number(data.totalReceivablesAsset || 0) },
            { Komponen: 'Subtotal Aset Lancar', 'Nilai (Rp)': Number(data.totalCurrentAssetsAuto || 0) },
            { Komponen: 'Subtotal Aset Tetap / Inventaris Manual', 'Nilai (Rp)': Number(data.totalFixedAssets || 0) },
            { Komponen: 'TOTAL SEMUA ASET USAHA', 'Nilai (Rp)': Number(data.totalAllAssets || 0) },
            { Komponen: 'Kewajiban - Hutang Bank / Leasing / Manual', 'Nilai (Rp)': Number(data.totalDebts || 0) },
            { Komponen: 'Kewajiban - Hutang Pemasok (Pembelian Kredit)', 'Nilai (Rp)': Number(data.totalSupplierDebt || 0) },
            { Komponen: 'Kewajiban - Gaji Owner Terhutang', 'Nilai (Rp)': Number(data.pendingAccruedSalary || 0) },
            { Komponen: 'Kewajiban - Bonus Owner Siap Cair', 'Nilai (Rp)': Number(data.bonusPayable || 0) },
            { Komponen: 'TOTAL SEMUA HUTANG & KEWAJIBAN', 'Nilai (Rp)': Number(data.totalAllDebts || 0) },
            { Komponen: 'KEKAYAAN BERSIH USAHA (NET WORTH)', 'Nilai (Rp)': Number(data.netWorth || 0) },
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Neraca');

        const assetRows = [
            { Jenis: 'Aset Lancar', Nama: 'Kas Laci Aktif', 'Nilai (Rp)': Number(data.cashDrawerBalance || 0) },
            { Jenis: 'Aset Lancar', Nama: 'Rekening Bank / QRIS / E-Wallet', 'Nilai (Rp)': Number(data.totalBankBalance || 0) },
            { Jenis: 'Aset Lancar', Nama: 'Kas Dipegang Owner', 'Nilai (Rp)': Number(data.ownerHoldBalance || 0) },
            { Jenis: 'Aset Lancar', Nama: 'Piutang Pelanggan Aktif (Baru + Lama)', 'Nilai (Rp)': Number(data.totalReceivablesAsset || 0) },
            ...(Array.isArray(data.fixedAssets) ? data.fixedAssets.map((a: any) => ({
                Jenis: 'Aset Tetap / Manual',
                Nama: a.name,
                'Nilai (Rp)': Number(a.value || 0),
            })) : []),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetRows), 'Rincian Aset');

        const debtRows = [
            ...(Array.isArray(data.supplierDebtGroups) ? data.supplierDebtGroups.map((g: any) => ({
                Kategori: 'Hutang Pemasok (Otomatis)',
                Kreditur: g.supplierName,
                Keterangan: `${g.bills?.length || 0} Nota • Jatuh Tempo: ${g.nearestDueDate ? formatSafeDateId(g.nearestDueDate) : '-'}`,
                'Sisa Kewajiban (Rp)': Number(g.remainingAmount || 0),
            })) : []),
            ...(Number(data.pendingAccruedSalary || 0) > 0 ? [{
                Kategori: 'Kewajiban Owner',
                Kreditur: 'Gaji Owner Terhutang',
                Keterangan: 'Accrual Gaji Belum Dicairkan',
                'Sisa Kewajiban (Rp)': Number(data.pendingAccruedSalary || 0),
            }] : []),
            ...(Number(data.bonusPayable || 0) > 0 ? [{
                Kategori: 'Kewajiban Owner',
                Kreditur: 'Bonus Owner Siap Cair',
                Keterangan: 'Saldo Kantong Bonus Belum Ditarik',
                'Sisa Kewajiban (Rp)': Number(data.bonusPayable || 0),
            }] : []),
            ...(Array.isArray(data.manualDebts) ? data.manualDebts.map((d: any) => ({
                Kategori: 'Hutang Bank / Manual',
                Kreditur: d.name,
                Keterangan: d.isLinkedBank ? 'Tersinkron Cicilan Bank' : 'Manual / Saldo Awal',
                'Sisa Kewajiban (Rp)': Number(d.value || 0),
            })) : []),
        ];
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(debtRows.length > 0 ? debtRows : [{ Info: 'Tidak ada hutang atau kewajiban tercatat.' }]),
            'Rincian Hutang & Kewajiban'
        );

    } else if (reportType === 'legacySales' && data) {
        const incomes = (Array.isArray(data.incomes) ? data.incomes : []) as LegacyMonthlyIncome[];
        const expenses = (Array.isArray(data.expenses) ? data.expenses : []) as LegacyMonthlyExpense[];
        const incomeRows = incomes.map((i, idx) => ({
            'No': idx + 1,
            'Bulan': i.month_date?.slice(0, 7) || '-',
            'Nominal (Rp)': Number(i.amount || 0),
            'Deskripsi': i.description || '-',
        }));
        const expenseRows = expenses.map((e, idx) => ({
            'No': idx + 1,
            'Bulan': e.month_date?.slice(0, 7) || '-',
            'Nominal (Rp)': Number(e.amount || 0),
            'Deskripsi': e.description || '-',
        }));
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(incomeRows.length > 0 ? incomeRows : [{ Info: 'Belum ada data pemasukan lama.' }]),
            'Pemasukan Data Lama'
        );
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(expenseRows.length > 0 ? expenseRows : [{ Info: 'Belum ada data pengeluaran lama.' }]),
            'Pengeluaran Data Lama'
        );

    } else if (reportType === 'legacyReceivables' && Array.isArray(data)) {
        const legacyData = data as LegacyReceivable[];
        const rows = legacyData.map((item, idx) => ({
            'No': idx + 1,
            'Tanggal': formatSafeDateId(item.order_date),
            'No Nota': item.nota_id,
            'Pelanggan': item.customer,
            'Deskripsi': item.description,
            'Panjang (m)': item.length ?? '-',
            'Lebar (m)': item.width ?? '-',
            'Qty': item.qty,
            'Nominal Piutang (Rp)': Number(item.amount || 0),
        }));
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: 'Tidak ada data piutang lama.' }]),
            'Data Piutang Lama'
        );

    } else if (reportType === 'profitAndLoss' && data) {
        const summaryRows: Array<{ Bagian: string; Keterangan: string; 'Nominal (Rp)': number | string }> = [
            { Bagian: 'Info Periode', Keterangan: 'Periode Laporan', 'Nominal (Rp)': data.periodLabel || '-' },
            { Bagian: 'Basis Kas', Keterangan: 'Total Pendapatan Kas Masuk', 'Nominal (Rp)': Number(data.cashSummary?.totalSales || 0) },
            { Bagian: 'Basis Kas', Keterangan: 'Total Pengeluaran Operasional', 'Nominal (Rp)': Number(data.cashSummary?.totalExpenses || 0) },
            { Bagian: 'Basis Kas', Keterangan: 'Laba / Rugi Operasional (Basis Kas)', 'Nominal (Rp)': Number(data.cashSummary?.profit || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: 'Bayar Tagihan Pemasok (Kas Toko)', 'Nominal (Rp)': Number(data.nonOperational?.supplierPaid || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: 'Bayar Cicilan Bank - Total', 'Nominal (Rp)': Number(data.nonOperational?.bankPaid || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: '  - Porsi Pokok Utang', 'Nominal (Rp)': Number(data.nonOperational?.bankPrincipalPaid || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: '  - Porsi Bunga Bank', 'Nominal (Rp)': Number(data.nonOperational?.bankInterestPaid || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: 'Biaya Pribadi / Jamuan (Kas Toko)', 'Nominal (Rp)': Number(data.nonOperational?.privateStorePaid || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: 'Tarik Owner + Setor Prive + Admin Mutasi', 'Nominal (Rp)': Number(data.nonOperational?.ownerOutTotal || 0) },
            { Bagian: 'Non-Operasional & Owner', Keterangan: 'SISA ARUS KAS BERSIH PERIODE', 'Nominal (Rp)': Number(data.nonOperational?.netCashflowAfterAll || 0) },
        ];

        if (data.accrual) {
            summaryRows.push(
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'Omzet Nota Terbit (Bersih Diskon)', 'Nominal (Rp)': Number(data.accrual.accrualSales || 0) },
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'Pembelian Bahan Lunas', 'Nominal (Rp)': Number(data.accrual.lunasMaterialPurchases || 0) },
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'Faktur Pembelian Kredit/Tempo Terbit', 'Nominal (Rp)': Number(data.accrual.creditSupplierInvoices || 0) },
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'Beban Operasional Lainnya', 'Nominal (Rp)': Number(data.accrual.otherOperationalExpenses || 0) },
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'Gaji Owner (Dibayar + Terhutang Diakui)', 'Nominal (Rp)': Number(data.accrual.recognizedOwnerSalary || 0) },
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'Bunga Bank', 'Nominal (Rp)': Number(data.accrual.bankInterestInMonth || 0) },
                { Bagian: 'Basis Nota (Kinerja)', Keterangan: 'LABA / RUGI KINERJA (BASIS NOTA)', 'Nominal (Rp)': Number(data.accrual.accrualNetProfit || 0) },
            );
        }

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Ringkasan Laba Rugi');

        const detailRows: Array<{ Tipe: string; Kategori: string; 'Nominal (Rp)': number }> = [
            ...(Array.isArray(data.incomeRows) ? data.incomeRows.map((r: any) => ({ Tipe: 'Pendapatan (Kas)', Kategori: r.name, 'Nominal (Rp)': Number(r.total || 0) })) : []),
            ...(Array.isArray(data.expenseRows) ? data.expenseRows.map((r: any) => ({ Tipe: 'Pengeluaran Operasional', Kategori: r.name, 'Nominal (Rp)': Number(r.total || 0) })) : []),
        ];
        XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(detailRows.length > 0 ? detailRows : [{ Info: 'Tidak ada rincian pada periode ini.' }]),
            'Rincian Kategori'
        );

        if (Array.isArray(data.chartData) && data.chartData.length > 0) {
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.chartData), 'Tren Periode');
        }

    } else if (reportType === 'cashFlow' && Array.isArray(data)) {
        const cashFlowSheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, cashFlowSheet, 'Arus Kas');
    }

    XLSX.writeFile(wb, fileName);
};
