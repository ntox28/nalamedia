import * as XLSX from 'xlsx';
import { 
    type SavedOrder, 
    type ReceivableItem, 
    type InventoryItem,
    type ProductData,
    type CategoryData,
    type CustomerData,
    type FinishingData,
    type OrderItemData
} from '../types';

interface ReceivableReportData extends ReceivableItem {
    paid: number;
    remaining: number;
}


const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
});

// Helper function to calculate price for a single order item
const calculateItemPrice = (
    item: OrderItemData,
    orderCustomer: string,
    products: ProductData[],
    categories: CategoryData[],
    customers: CustomerData[],
    finishings: FinishingData[]
): number => {
    const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
        'End Customer': 'endCustomer',
        'Retail': 'retail',
        'Grosir': 'grosir',
        'Reseller': 'reseller',
        'Corporate': 'corporate'
    };
    
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
    
    return (priceMultiplier * materialPrice + finishingPrice) * item.qty;
};

export const exportToExcel = (
    reportType: 'sales' | 'receivables' | 'inventory', 
    data: any,
    dateRange: { startDate: string, endDate: string },
    extraData?: {
        products?: ProductData[];
        categories?: CategoryData[];
        customers?: CustomerData[];
        finishings?: FinishingData[];
        receivables?: ReceivableItem[];
    }
) => {
    const wb = XLSX.utils.book_new();
    const today = new Date().toISOString().split('T')[0];
    const fileName = `Laporan_${reportType}_${dateRange.startDate || 'awal'}_sampai_${dateRange.endDate || today}.xlsx`;

    if (reportType === 'sales' && data && extraData?.products && extraData.categories && extraData.customers && extraData.finishings && extraData.receivables) {
        const transactions = data.transactions as SavedOrder[];
        const { products, categories, customers, finishings, receivables } = extraData;

        let rowNum = 1;
        const flattenedData = transactions.flatMap(order => 
            order.orderItems.map(item => {
                const product = products.find(p => p.id === item.productId);
                const receivable = receivables.find(r => r.id === order.id);
                const itemTotal = calculateItemPrice(item, order.customer, products, categories, customers, finishings);
                
                return {
                    'No.': rowNum++,
                    'Tanggal': formatDate(order.orderDate),
                    'No. Nota': order.id,
                    'Nama Pelanggan': order.customer,
                    'Deskripsi': item.description,
                    'Bahan': product?.name || 'N/A',
                    'Panjang': isNaN(parseFloat(item.length)) ? item.length : parseFloat(item.length),
                    'Lebar': isNaN(parseFloat(item.width)) ? item.width : parseFloat(item.width),
                    'Qty': item.qty,
                    'Total': itemTotal,
                    'Status Pembayaran': receivable ? receivable.paymentStatus : 'Belum Diproses'
                };
            })
        );
        
        const transactionsSheet = XLSX.utils.json_to_sheet(flattenedData);
        XLSX.utils.book_append_sheet(wb, transactionsSheet, 'Data Transaksi');
        
    } else if (reportType === 'receivables' && data) {
        const receivablesData = data as ReceivableReportData[];
        const receivablesSheet = XLSX.utils.json_to_sheet(receivablesData.map((r) => ({
            'No Nota': r.id,
            'Pelanggan': r.customer,
            'Total Tagihan': r.amount,
            'Sudah Dibayar': r.paid,
            'Sisa Tagihan': r.remaining,
            'Status Bayar': r.paymentStatus,
            'Status Produksi': r.productionStatus,
            'Tanggal Jatuh Tempo': formatDate(r.due),
        })));
        XLSX.utils.book_append_sheet(wb, receivablesSheet, 'Laporan Piutang');

    } else if (reportType === 'inventory' && data) {
        const inventoryData = data as InventoryItem[];
        const inventorySheet = XLSX.utils.json_to_sheet(inventoryData.map((i) => ({
            'Nama Item': i.name,
            'SKU': i.sku,
            'Tipe': i.type,
            'Stok Saat Ini': i.stock,
            'Satuan': i.unit,
            'Status': i.stock <= 5 ? 'Stok Menipis' : 'Tersedia',
        })));
        XLSX.utils.book_append_sheet(wb, inventorySheet, 'Laporan Stok');
    }
    
    XLSX.writeFile(wb, fileName);
};
