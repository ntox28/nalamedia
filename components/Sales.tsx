import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Cog6ToothIcon, PlusCircleIcon, TrashIcon, PencilIcon, PrinterIcon, PlayIcon, ClipboardIcon, ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, MagnifyingGlassIcon, CurrencyDollarIcon } from './Icons';
import { type SavedOrder, type OrderItemData, type ProductData, type FinishingData, type CategoryData, type KanbanData, type CardData, type CustomerData, type ReceivableItem } from '../types';

const getInitialState = () => ({
  orderItems: [{ 
    id: Date.now(), 
    productId: null, 
    finishing: 'Tanpa Finishing', 
    description: '', 
    length: '1', 
    width: '1', 
    qty: 1 
  }],
  customer: '',
  orderDate: new Date().toISOString().substring(0, 10),
});

const SIMULATION_CUSTOMERS = [
  'Pelanggan (End Customer)',
  'Pelanggan (Retail)',
  'Pelanggan (Grosir)',
  'Pelanggan (Reseller)',
  'Pelanggan (Corporate)'
];


interface StatCardProps {
  icon: React.ReactElement<{ className?: string }>;
  title: string;
  value: string;
  onClick: () => void;
  gradient: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, onClick, gradient }) => (
  <div 
    className={`p-6 rounded-xl shadow-lg text-white ${gradient} transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1`}
    onClick={onClick}
  >
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

// --- START: Simulation Modal Component ---
const SimulationModal: React.FC<{
  result: SavedOrder;
  onClose: () => void;
  products: ProductData[];
  categories: CategoryData[];
  customers: CustomerData[];
  finishings: FinishingData[];
}> = ({ result, onClose, products, categories, customers, finishings }) => {

  const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer', 'Retail': 'retail', 'Grosir': 'grosir', 'Reseller': 'reseller', 'Corporate': 'corporate'
  };

  const getCustomerLevel = (customerName: string): CustomerData['level'] => {
    const match = customerName.match(/\(([^)]+)\)/);
    if (match) {
        const level = match[1] as CustomerData['level'];
        if (['End Customer', 'Retail', 'Grosir', 'Reseller', 'Corporate'].includes(level)) {
            return level;
        }
    }
    const customerData = customers.find(c => c.name === customerName);
    return customerData ? customerData.level : 'End Customer';
  };

  const calculateItemPrice = (item: OrderItemData): number => {
    const customerLevel = getCustomerLevel(result.customer);
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
    const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
    const itemFinishingTotal = finishingPrice * item.qty;
    return itemMaterialTotal + itemFinishingTotal;
  };
  
  const handlePrint = () => {
    const displayCustomerName = result.customer.split('(')[0].trim();

    const itemsHtml = result.orderItems.map((item, index) => {
        const product = products.find(p => p.id === item.productId);
        const category = categories.find(c => c.name === product?.category);
        const isAreaBased = category?.unitType === 'Per Luas';
        const sizeDisplay = isAreaBased ? `${item.length}x${item.width}m` : '-';
        const itemSubtotal = calculateItemPrice(item);
        const pricePerUnit = item.qty > 0 ? itemSubtotal / item.qty : 0;
        return `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                    <b>${item.description || 'N/A'}</b><br>
                    <span style="font-size: 12px; color: #555;">${product?.name || 'N/A'}</span>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${sizeDisplay}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${new Intl.NumberFormat('id-ID').format(pricePerUnit)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${new Intl.NumberFormat('id-ID').format(itemSubtotal)}</td>
            </tr>
        `;
    }).join('');

    const printContent = `
        <html>
            <head><title>Simulasi Harga</title>
            <style>
                body { font-family: sans-serif; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; }
                th { background-color: #f2f2f2; padding: 10px; text-align: left; }
                .total-row { font-weight: bold; font-size: 1.2em; }
            </style>
            </head>
            <body>
                <h1 style="text-align:center;">Estimasi Biaya Cetak</h1>
                <p><strong>Pelanggan:</strong> ${displayCustomerName}</p>
                <p><strong>Tanggal:</strong> ${new Date(result.orderDate).toLocaleDateString('id-ID')}</p>
                <hr>
                <table>
                    <thead><tr><th>No.</th><th>Deskripsi</th><th style="text-align:center;">Ukuran</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Harga Satuan</th><th style="text-align:right;">Subtotal</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <hr>
                <div style="text-align: right; margin-top: 20px;">
                    <h2 class="total-row">Total Estimasi: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(result.totalPrice)}</h2>
                </div>
                <p style="margin-top: 30px; font-size: 12px; text-align: center; color: #777;"><i>*Ini adalah estimasi. Harga final dapat berbeda.</i></p>
            </body>
        </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
  };
  
  const displayCustomerName = result.customer.split('(')[0].trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="text-xl font-bold text-gray-800">Rincian Simulasi Harga</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
                <div className="flex justify-between text-sm mb-4">
                    <div><p className="text-gray-500">Pelanggan</p><p className="font-semibold">{displayCustomerName}</p></div>
                    <div className="text-right"><p className="text-gray-500">Tanggal</p><p className="font-semibold">{new Date(result.orderDate).toLocaleDateString('id-ID')}</p></div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Deskripsi</th>
                                <th className="py-2 px-3 text-center font-medium text-gray-600">Ukuran</th>
                                <th className="py-2 px-3 text-center font-medium text-gray-600">Qty</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-600">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {result.orderItems.map(item => {
                                const product = products.find(p => p.id === item.productId);
                                const category = categories.find(c => c.name === product?.category);
                                const isAreaBased = category?.unitType === 'Per Luas';
                                const sizeDisplay = isAreaBased ? `${item.length}x${item.width}m` : '-';

                                return (
                                <tr key={item.id}>
                                    <td className="py-2 px-3">{item.description}</td>
                                    <td className="py-2 px-3 text-center">{sizeDisplay}</td>
                                    <td className="py-2 px-3 text-center">{item.qty}</td>
                                    <td className="py-2 px-3 text-right font-mono">{new Intl.NumberFormat('id-ID').format(calculateItemPrice(item))}</td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 text-right bg-pink-50 p-4 rounded-lg">
                    <p className="text-gray-600">Total Estimasi</p>
                    <p className="font-bold text-2xl text-pink-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(result.totalPrice)}</p>
                </div>
            </div>
            <div className="border-t pt-4 mt-4 flex justify-end space-x-3">
                <button onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300">Tutup</button>
                <button onClick={handlePrint} className="flex items-center bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-900">
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    Cetak
                </button>
            </div>
        </div>
    </div>
  );
};
// --- END: Simulation Modal Component ---

const OrderListModal: React.FC<{
  title: string;
  orders: CardData[];
  allOrders: SavedOrder[];
  onClose: () => void;
  onEdit: (order: SavedOrder) => void;
  onCopy: (order: SavedOrder) => void;
  onPrintSPK: (order: SavedOrder) => void;
  onDelete: (orderId: string) => void;
}> = ({ title, orders, allOrders, onClose, onEdit, onCopy, onPrintSPK, onDelete }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto space-y-3 pr-2">
          {orders.length > 0 ? (
            orders.map(orderCard => {
              const fullOrder = allOrders.find(o => o.id === orderCard.id);
              if (!fullOrder) return null;

              return (
                <div key={orderCard.id} className="bg-gray-50 p-3 rounded-md border">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-bold text-purple-700">{orderCard.customer}</p>
                    <p className="text-xs font-semibold text-gray-500">{orderCard.id}</p>
                  </div>
                  <div className="text-sm text-gray-600">
                    {orderCard.details.split('\n').map((detail, idx) => (
                      <p key={idx} className="truncate">{detail}</p>
                    ))}
                  </div>
                  <div className="flex items-center justify-end space-x-2 mt-2 border-t pt-2">
                      <button onClick={() => { onEdit(fullOrder); onClose(); }} className="p-2 text-gray-500 hover:text-blue-600" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                      <button onClick={() => onCopy(fullOrder)} className="p-2 text-gray-500 hover:text-green-600" title="Salin Info"><ClipboardIcon className="h-4 w-4" /></button>
                      <button onClick={() => onPrintSPK(fullOrder)} className="p-2 text-gray-500 hover:text-gray-800" title="Cetak SPK"><PrinterIcon className="h-4 w-4" /></button>
                      <button onClick={() => onDelete(fullOrder.id)} className="p-2 text-gray-500 hover:text-red-600" title="Hapus"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-gray-500 py-8">Tidak ada order dalam kategori ini.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// New modal component for Nota settings
const NotaSettingsModal: React.FC<{
  show: boolean;
  onClose: () => void;
  onSave: (prefix: string, startNumber: string) => void;
  currentPrefix: string;
  currentStartNumber: string;
}> = ({ show, onClose, onSave, currentPrefix, currentStartNumber }) => {
  const [prefix, setPrefix] = useState(currentPrefix);
  const [startNumber, setStartNumber] = useState(currentStartNumber);

  useEffect(() => {
    setPrefix(currentPrefix);
    setStartNumber(currentStartNumber);
  }, [currentPrefix, currentStartNumber]);

  const handleSave = () => {
    onSave(prefix, startNumber);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Pengaturan Nomor Nota</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="nota-prefix" className="block text-sm font-medium text-gray-700">Kode Nota (Prefix)</label>
            <input
              type="text"
              id="nota-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="nota-start" className="block text-sm font-medium text-gray-700">Mulai Nomor</label>
            <input
              type="number"
              id="nota-start"
              value={startNumber}
              onChange={(e) => setStartNumber(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              placeholder="e.g., 124"
            />
            <p className="text-xs text-gray-500 mt-1">Masukkan nomor nota berikutnya yang akan digunakan.</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm font-medium text-gray-600">Contoh nomor nota berikutnya:</p>
            <p className="text-lg font-bold text-pink-600 mt-1">{prefix}{startNumber.padStart(5, '0')}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
          <button onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300">
            Batal
          </button>
          <button onClick={handleSave} className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-pink-700">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};


interface SalesProps {
  unprocessedOrders: SavedOrder[];
  onSaveOrder: (newOrder: SavedOrder) => void;
  onUpdateOrder: (updatedOrder: SavedOrder) => void;
  onProcessOrder: (orderId: string) => void;
  onDeleteOrder: (orderId: string) => void;
  products: ProductData[];
  categories: CategoryData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  allOrders: SavedOrder[];
  boardData: KanbanData;
  noteCounter: number;
  notePrefix: string;
  onUpdateNoteSettings: (prefix: string, startNumber: number) => void;
  receivables: ReceivableItem[];
}

const Sales: React.FC<SalesProps> = ({ 
  unprocessedOrders, onSaveOrder, onUpdateOrder, onProcessOrder, onDeleteOrder, 
  products, categories, finishings, customers,
  allOrders, boardData, noteCounter, notePrefix, onUpdateNoteSettings,
  receivables
}) => {
  const [orderItems, setOrderItems] = useState<OrderItemData[]>(getInitialState().orderItems);
  const [customer, setCustomer] = useState(getInitialState().customer);
  const [orderDate, setOrderDate] = useState(getInitialState().orderDate);
  const [totalPrice, setTotalPrice] = useState(0);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ title: string; orders: CardData[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotaSettingsOpen, setIsNotaSettingsOpen] = useState(false);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SavedOrder | null>(null);

  // State for customer combobox
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const today = new Date().toISOString().substring(0, 10);
  
  const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer',
    'Retail': 'retail',
    'Grosir': 'grosir',
    'Reseller': 'reseller',
    'Corporate': 'corporate'
  };
  
  const getItemsCount = (cards: CardData[]): number => {
      return cards.reduce((sum, card) => {
          const order = allOrders.find(o => o.id === card.id);
          return sum + (order?.orderItems.length || 0);
      }, 0);
  };

  const totalOrdersToday = allOrders
    .filter(o => o.orderDate === today)
    .reduce((sum, order) => sum + order.orderItems.length, 0);
    
  const needsProcessingCount = useMemo(() => {
    return unprocessedOrders.reduce((sum, order) => sum + order.orderItems.length, 0);
  }, [unprocessedOrders]);

  const finishedInWarehouseCount = getItemsCount(boardData.warehouse);
  
  const deliveredTodayCount = useMemo(() => {
    const deliveredTodayIds = new Set(
        receivables
            .filter(r => r.productionStatus === 'Telah Dikirim' && r.deliveryDate === today)
            .map(r => r.id)
    );
    return allOrders
        .filter(o => deliveredTodayIds.has(o.id))
        .reduce((sum, order) => sum + order.orderItems.length, 0);
  }, [receivables, allOrders, today]);

  const handleSaveNotaSettings = (newPrefix: string, newStartNumberStr: string) => {
    const newStartNumber = parseInt(newStartNumberStr, 10);
    if (isNaN(newStartNumber) || newStartNumber < 1) {
        alert("Nomor awal harus berupa angka positif.");
        return;
    }

    const confirmMessage = `Anda akan mengubah pengaturan nota menjadi:\nPrefix: ${newPrefix}\nNomor Selanjutnya: ${newStartNumber}\n\nPerubahan ini akan mempengaruhi penomoran nota selanjutnya dan tidak dapat diurungkan. Lanjutkan?`;
    
    if (window.confirm(confirmMessage)) {
        onUpdateNoteSettings(newPrefix, newStartNumber);
        setIsNotaSettingsOpen(false);
    }
  };

  const getNextNotaNumber = () => {
    return `${notePrefix}${noteCounter.toString().padStart(5, '0')}`;
  };

  const filteredOrders = useMemo(() => {
    const sortedOrders = [...unprocessedOrders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    
    if (!searchQuery) {
      return sortedOrders;
    }
    
    const lowerCaseQuery = searchQuery.toLowerCase();
    return sortedOrders.filter(order =>
      order.id.toLowerCase().includes(lowerCaseQuery) ||
      order.customer.toLowerCase().includes(lowerCaseQuery)
    );
  }, [unprocessedOrders, searchQuery]);
  
  // --- Customer Combobox Logic ---
  const filteredCustomerList = useMemo(() => {
    if (!customerInputValue) {
        return [];
    }
    const lowerCaseQuery = customerInputValue.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(lowerCaseQuery));
  }, [customerInputValue, customers]);

  const handleCustomerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerInputValue(e.target.value);
    setIsCustomerDropdownOpen(true);
  };

  const handleCustomerSelect = (selectedCustomerName: string) => {
    setCustomer(selectedCustomerName);
    setCustomerInputValue(selectedCustomerName);
    setIsCustomerDropdownOpen(false);
  };

  const handleCustomerInputFocus = () => {
    if (customerInputValue) {
        setIsCustomerDropdownOpen(true);
    }
  };

  const handleCustomerBlur = () => {
    // Timeout to allow onMouseDown to fire before closing dropdown
    setTimeout(() => {
      setIsCustomerDropdownOpen(false);
      // Snap back to the officially selected customer if the input is invalid
      setCustomerInputValue(customer);
    }, 150);
  };
  // --- End Customer Combobox Logic ---

  const getCustomerLevel = useCallback((customerName: string): CustomerData['level'] => {
      const match = customerName.match(/\(([^)]+)\)/);
      if (match) {
          const level = match[1] as CustomerData['level'];
          if (['End Customer', 'Retail', 'Grosir', 'Reseller', 'Corporate'].includes(level)) {
              return level;
          }
      }
      const realCustomer = customers.find(c => c.name === customerName);
      return realCustomer ? realCustomer.level : 'End Customer';
  }, [customers]);

  useEffect(() => {
    const calculateTotal = () => {
      if (!customer) {
        setTotalPrice(0);
        return;
      }

      const ROUNDING_AMOUNT = 500;
      const roundUpToNearest = (num: number, nearest: number) => {
          if (nearest <= 0) return num;
          return Math.ceil(num / nearest) * nearest;
      };
      
      const customerLevel = getCustomerLevel(customer);
      const priceKey = priceLevelMap[customerLevel];
      
      let total = 0;
      orderItems.forEach(item => {
        if (!item.productId) return;
        
        const productInfo = products.find(p => p.id === item.productId);
        const finishingInfo = finishings.find(f => f.name === item.finishing);
        
        if (!productInfo) return;
        
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
        
        const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
        const itemFinishingTotal = finishingPrice * item.qty; // Finishing price is always per item quantity, not affected by area.
        total += itemMaterialTotal + itemFinishingTotal;
      });

      const roundedTotal = roundUpToNearest(total, ROUNDING_AMOUNT);
      setTotalPrice(roundedTotal);
    };
    calculateTotal();
  }, [orderItems, customer, products, finishings, customers, categories, getCustomerLevel]);

  const handleItemChange = (id: number, field: keyof Omit<OrderItemData, 'id'>, value: string | number) => {
    let newItems = orderItems.map(item => item.id === id ? { ...item, [field]: value } : item);
    
    if (field === 'productId') {
        const changedItem = newItems.find(item => item.id === id);
        if (!changedItem) return;

        const selectedProduct = products.find(p => p.id === value);
        const categoryInfo = categories.find(c => c.name === selectedProduct?.category);
        const isAreaBased = categoryInfo?.unitType === 'Per Luas';
        
        // Reset length/width for non-area products
        if (!isAreaBased) {
            changedItem.length = '1';
            changedItem.width = '1';
        }

        // Filter and Validate Finishing
        const productCategoryName = selectedProduct?.category;
        const productCategory = categories.find(c => c.name === productCategoryName);
        const categoryId = productCategory?.id;

        const availableFinishings = finishings.filter(f => 
            !f.categoryIds || f.categoryIds.length === 0 || (categoryId && f.categoryIds.includes(categoryId))
        );
        
        const isCurrentFinishingValid = availableFinishings.some(f => f.name === changedItem.finishing);

        if (!isCurrentFinishingValid) {
            // Reset to the default "Tanpa Finishing" if it's available, otherwise to the first option
            const defaultFinishing = availableFinishings.find(f => f.name === 'Tanpa Finishing') || availableFinishings[0];
            if (defaultFinishing) {
                changedItem.finishing = defaultFinishing.name;
            }
        }
    }
    setOrderItems(newItems);
  };

  const addItem = () => setOrderItems([...orderItems, { 
      id: Date.now(), 
      productId: null, 
      finishing: 'Tanpa Finishing', 
      description: '', 
      length: '1', 
      width: '1', 
      qty: 1 
  }]);
  const removeItem = (id: number) => { if (orderItems.length > 1) setOrderItems(orderItems.filter(item => item.id !== id)); };
  
  const resetForm = useCallback(() => {
    setOrderItems(getInitialState().orderItems);
    setCustomer(getInitialState().customer);
    setCustomerInputValue(getInitialState().customer);
    setOrderDate(getInitialState().orderDate);
    setEditingOrderId(null);
  }, []);

  const handleModeChange = (isSim: boolean) => {
    setIsSimulationMode(isSim);
    if (isSim) {
        if (!SIMULATION_CUSTOMERS.includes(customer)) {
            setCustomer(SIMULATION_CUSTOMERS[0]);
        }
    } else {
        if (editingOrderId) {
            resetForm();
        } else if (SIMULATION_CUSTOMERS.includes(customer)) {
            setCustomer('');
            setCustomerInputValue('');
        }
    }
  };

  const handleNewOrder = () => { resetForm(); alert("Formulir dibersihkan."); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- Validation ---
    if (!customer) {
        alert("Silakan pilih pelanggan terlebih dahulu.");
        return;
    }
    const hasIncompleteItem = orderItems.some(item => !item.productId || !item.description.trim());
    if (hasIncompleteItem) {
        alert("Setiap item pesanan harus memiliki Bahan dan Deskripsi yang valid (tidak boleh kosong).");
        return;
    }

    const orderDetails = orderItems
      .map(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return '';

          const categoryInfo = categories.find(c => c.name === product.category);
          const isArea = categoryInfo?.unitType === 'Per Luas';

          const description = item.description || 'Tanpa deskripsi';
          const material = product.name;
          const size = isArea ? `${item.length}X${item.width}` : '-';
          const quantity = `${item.qty} Pcs`;

          return `${description} - ${material} - ${size} - ${quantity}`;
      })
      .filter(Boolean)
      .join('\n');

    const orderData: SavedOrder = {
        id: editingOrderId || getNextNotaNumber(),
        customer,
        orderDate,
        orderItems,
        details: orderDetails || 'Tidak ada detail',
        totalPrice,
    };

    if (isSimulationMode) {
      setSimulationResult(orderData);
    } else {
        if (editingOrderId) {
            onUpdateOrder({ ...orderData, id: editingOrderId });
            alert(`Order ${editingOrderId} berhasil diperbarui!`);
        } else {
            const notaNumber = getNextNotaNumber();
            onSaveOrder({ ...orderData, id: notaNumber });
            alert(`Order ${notaNumber} berhasil disimpan di 'Order Hari Ini'.`);
        }
        resetForm();
    }
  };
  
  const handleEdit = (order: SavedOrder) => {
      handleModeChange(false); // Switch to order mode when editing
      setEditingOrderId(order.id);
      setCustomer(order.customer);
      setCustomerInputValue(order.customer);
      setOrderDate(order.orderDate);
      setOrderItems(order.orderItems);
  };

  const handleDelete = (orderId: string) => {
      if (window.confirm(`Apakah Anda yakin ingin menghapus order ${orderId}?`)) {
          onDeleteOrder(orderId);
      }
  };

  const handleCopy = (order: SavedOrder) => {
    const textToCopy = order.orderItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      const category = categories.find(c => c.name === product?.category);
      const isAreaBased = category?.unitType === 'Per Luas';

      const customerName = order.customer.toUpperCase();
      const orderId = order.id.toUpperCase();
      const material = (product?.name || 'PRODUK TIDAK DIKENALI').toUpperCase();
      const description = (item.description || '-').toUpperCase();
      
      const size = isAreaBased && parseFloat(item.length) > 0 && parseFloat(item.width) > 0 
        ? `${item.length}X${item.width}`.toUpperCase() 
        : '-';
      
      const quantity = `${item.qty}PCS`.toUpperCase();
      const finishing = (item.finishing || 'TANPA FINISHING').toUpperCase();

      // Format: Nama pelanggan//No. Nota//Bahan//Deskripsi//Ukuran//Qty//finishing
      return `${customerName}//${orderId}//${material}//${description}//${size}//${quantity}//${finishing}`;
    }).join('\n');

    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        alert('Informasi order berhasil disalin!');
      })
      .catch(err => {
        console.error('Gagal menyalin teks: ', err);
        alert('Gagal menyalin informasi order.');
      });
  };
  
  const handlePrintSPK = (order: SavedOrder) => {
      const totalItems = order.orderItems.reduce((sum, item) => sum + item.qty, 0);
      const printContent = `
        <html>
  <head>
    <title>SPK ${order.id}</title>
    <style>
      @page {
        size: 58mm auto;
        margin: 0;
      }
      body {
        font-family: sans-serif;
        font-size: 10px;
        color: #000;
        margin: 0;
        padding: 0; /* biar full-bleed */
        line-height: 1.2;
      }
      .spk-container {
        width: 58mm;   /* isi penuh selebar kertas */
        margin: 0;     
        padding: 0;    
      }
      p, div {
        margin: 0;
        padding: 0;
        word-wrap: break-word;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .uppercase { text-transform: uppercase; }
      .divider {
        border: 0;
        border-top: 1px dashed black;
        margin: 4px 0;
      }
      .customer-name {
        font-size: 14px;      /* lebih besar dari default */
        font-weight: bold;
        text-transform: uppercase;
      }
      .item-details {
        padding-left: 14px;
        text-indent: -14px;
      }
      .attention-box {
        border: 1px solid transparent;
        padding: 4px;
        margin-top: 5px;
        text-align: center;
      }
      .attention-small {
        font-size: 10px;
        line-height: 1.1;
      }
    </style>
  </head>
  <body>
    <div class="spk-container">
      <div class="center bold">** SPK PRODUKSI **</div>
      <div class="divider"></div>
      <div class="center customer-name">${order.customer}</div> <!-- Nama customer besar & kapital -->
      <div class="divider"></div>
      <div>No. Nota : ${order.id}</div>
      <div>Tanggal : ${new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="divider"></div>
      <div>No.&nbsp;&nbsp;Detail Pesanan</div>
      <div class="divider"></div>
      
      ${order.orderItems.map((item, index) => {
          const product = products.find(p => p.id === item.productId);
          const category = categories.find(c => c.name === product?.category);
          const isAreaBased = category?.unitType === 'Per Luas';

          const detailsParts = [];
          if (isAreaBased && parseFloat(item.length) > 0 && parseFloat(item.width) > 0) {
              detailsParts.push(`${item.length}m X ${item.width}m`);
          }
          detailsParts.push(`${item.qty} Pcs`);
          if (item.finishing && item.finishing !== 'Tanpa Finishing') {
              detailsParts.push(item.finishing);
          }
          
          const detailsLine = detailsParts.join(' | ');

          return `
              <div style="margin-bottom: 4px;">
                  <div class="item-details"><span class="bold uppercase">${index + 1}. ${item.description || 'Tanpa deskripsi'}</span></div>
                  <div class="item-details">&nbsp;&nbsp;&nbsp;&nbsp;${product?.name || 'N/A'}</div>
                  <div class="item-details">&nbsp;&nbsp;&nbsp;&nbsp;${detailsLine}</div>
              </div>
          `;
      }).join('')}

      <div class="divider"></div>
      <div class="center customer-name">JUMLAH ITEM : ${totalItems}</div>
      <div class="attention-box">
        <div class="center bold">PERHATIAN</div>
        <div class="attention-small center">- - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <div class="attention-small center">Cek data pekerjaan sebelum cetak.</div>
        <div class="attention-small center">Pastikan semua data benar.</div>
        <div class="attention-small center">Tempel struk ini Ke Barang.</div>
        <div class="attention-small center">- - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <div class="attention-small center bold">PASTIKAN ISI DATA</div>
        <div class="attention-small center bold">SERAH TERIMA DI APLIKASI!!!</div>
        <div class="attention-small center">- - - - - - - - - - - - - - - - - - - - - - - - -</div>
      </div>
    </div>
  </body>
</html>
      `;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        // Use a timeout to allow content to render before printing
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
  };

  return (
    <>
      <NotaSettingsModal
        show={isNotaSettingsOpen}
        onClose={() => setIsNotaSettingsOpen(false)}
        onSave={handleSaveNotaSettings}
        currentPrefix={notePrefix}
        currentStartNumber={noteCounter.toString()}
      />
      {modalData && (
          <OrderListModal 
              title={modalData.title} 
              orders={modalData.orders} 
              onClose={() => setModalData(null)}
              allOrders={allOrders}
              onEdit={handleEdit}
              onCopy={handleCopy}
              onPrintSPK={handlePrintSPK}
              onDelete={handleDelete}
          />
      )}
      {simulationResult && (
          <SimulationModal
              result={simulationResult}
              onClose={() => setSimulationResult(null)}
              products={products}
              categories={categories}
              customers={customers}
              finishings={finishings}
          />
      )}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            icon={<ShoppingCartIcon />} 
            title="Total Item Order Hari Ini" 
            value={`${totalOrdersToday}`}
            onClick={() => {
                const ordersToday = allOrders
                    .filter(o => o.orderDate === today)
                    .sort((a, b) => b.id.localeCompare(a.id)) // Sort descending by ID (nota number)
                    .map(o => ({ id: o.id, customer: o.customer, details: o.details }));
                setModalData({ title: "Daftar Order Hari Ini", orders: ordersToday });
            }}
            gradient="bg-gradient-to-br from-blue-500 to-sky-500"
          />
          <StatCard 
            icon={<WrenchScrewdriverIcon />} 
            title="Item Perlu Proses" 
            value={`${needsProcessingCount}`}
            onClick={() => {
                const unprocessedOrdersAsCards = unprocessedOrders
                    .sort((a, b) => b.id.localeCompare(a.id))
                    .map(o => ({ id: o.id, customer: o.customer, details: o.details }));
                setModalData({ title: "Daftar Order Perlu Diproses", orders: unprocessedOrdersAsCards });
            }}
            gradient="bg-gradient-to-br from-amber-500 to-yellow-500"
          />
          <StatCard 
            icon={<CubeIcon />} 
            title="Item Selesai" 
            value={`${finishedInWarehouseCount}`}
            onClick={() => setModalData({ title: "Daftar Order Selesai (di Gudang)", orders: boardData.warehouse })}
            gradient="bg-gradient-to-br from-teal-500 to-cyan-500"
          />
          <StatCard 
            icon={<HomeIcon />} 
            title="Item Terkirim Hari Ini" 
            value={`${deliveredTodayCount}`}
            onClick={() => {
                const deliveredTodayIds = new Set(
                    receivables
                        .filter(r => r.productionStatus === 'Telah Dikirim' && r.deliveryDate === today)
                        .map(r => r.id)
                );
                const deliveredTodayOrders = allOrders
                    .filter(o => deliveredTodayIds.has(o.id))
                    .map(o => ({ id: o.id, customer: o.customer, details: o.details }));
                setModalData({ title: "Daftar Order Terkirim Hari Ini", orders: deliveredTodayOrders });
            }}
            gradient="bg-gradient-to-br from-pink-500 to-rose-500"
          />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-4 border-b pb-4">
            <h2 className="text-xl font-bold">{isSimulationMode ? 'Simulasi Harga Cetak' : (editingOrderId ? `Edit Order ${editingOrderId}` : 'Tambah Order Baru')}</h2>
            {!isSimulationMode && <button onClick={handleNewOrder} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300">Buat Baru</button>}
          </div>
          
           <div className="flex mb-6 border border-gray-200 rounded-lg p-1 bg-gray-100 max-w-sm">
              <button type="button" onClick={() => handleModeChange(false)} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${!isSimulationMode ? 'bg-white text-pink-600 shadow' : 'text-gray-600'}`}>
                  Buat Order
              </button>
              <button type="button" onClick={() => handleModeChange(true)} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${isSimulationMode ? 'bg-white text-blue-600 shadow' : 'text-gray-600'}`}>
                  Simulasi Harga
              </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">No. Nota (Otomatis)</label>
                <div className="flex items-center mt-1">
                  <input type="text" readOnly value={isSimulationMode ? 'SIMULASI' : (editingOrderId || getNextNotaNumber())} className="w-full p-2 border rounded-md bg-gray-100" />
                  {!isSimulationMode && <button type="button" onClick={() => setIsNotaSettingsOpen(true)} className="ml-2 p-2 text-gray-500 hover:text-pink-600 transition-colors"><Cog6ToothIcon /></button>}
                </div>
              </div>
              <div>
                <label htmlFor="order-date" className="block text-sm font-medium">Tanggal</label>
                <input type="date" id="order-date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
              </div>
              
              {isSimulationMode ? (
                 <div>
                    <label htmlFor="sim-customer" className="block text-sm font-medium">Tipe Pelanggan</label>
                    <select
                        id="sim-customer"
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                        className="mt-1 w-full p-2 border bg-white rounded-md"
                        required
                    >
                        {SIMULATION_CUSTOMERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
              ) : (
                <div>
                  <label htmlFor="customer-input" className="block text-sm font-medium">Pelanggan</label>
                  <div className="relative mt-1">
                      <input
                          id="customer-input"
                          type="text"
                          value={customerInputValue}
                          onChange={handleCustomerInputChange}
                          onFocus={handleCustomerInputFocus}
                          onBlur={handleCustomerBlur}
                          className="w-full p-2 border rounded-md"
                          required
                          autoComplete="off"
                          placeholder="Ketik untuk mencari pelanggan..."
                      />
                      {isCustomerDropdownOpen && filteredCustomerList.length > 0 && (
                          <ul className="absolute z-20 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                              {filteredCustomerList.map(c => (
                                  <li
                                      key={c.id}
                                      className="px-3 py-2 cursor-pointer hover:bg-pink-100"
                                      onMouseDown={() => handleCustomerSelect(c.name)}
                                  >
                                      {c.name}
                                  </li>
                              ))}
                          </ul>
                      )}
                  </div>
                </div>
              )}
            </div>
            {orderItems.map((item, index) => {
              const selectedProduct = products.find(p => p.id === item.productId);
              const productCategory = categories.find(c => c.name === selectedProduct?.category);
              const isAreaBased = productCategory?.unitType === 'Per Luas';
              
              const categoryId = productCategory?.id;
              
              const filteredFinishings = finishings.filter(f => 
                  !f.categoryIds || f.categoryIds.length === 0 || (categoryId && f.categoryIds.includes(categoryId))
              );

              return (
                <div key={item.id} className="border-t pt-6 space-y-4 relative">
                  <h3 className="font-semibold">Detail Pesanan #{index + 1}</h3>
                  {orderItems.length > 1 && (<button type="button" onClick={() => removeItem(item.id)} className="absolute top-4 right-0 text-red-500"><TrashIcon /></button>)}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Bahan</label>
                      <select value={item.productId ?? ''} onChange={(e) => handleItemChange(item.id, 'productId', parseInt(e.target.value))} className="mt-1 w-full p-2 border bg-white rounded-md" required>
                        <option value="" disabled>Pilih Bahan</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Finishing</label>
                      <select value={item.finishing} onChange={(e) => handleItemChange(item.id, 'finishing', e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                        {filteredFinishings.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium">Deskripsi Pesanan</label><textarea value={item.description} onChange={(e) => handleItemChange(item.id, 'description', e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded-md" placeholder="e.g., Cetak full color..." required></textarea></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium">Panjang (m)</label><input type="number" value={item.length} onChange={(e) => handleItemChange(item.id, 'length', e.target.value)} placeholder="-" className={`mt-1 w-full p-2 border rounded-md ${!isAreaBased && 'bg-gray-100'}`} step="0.01" min="0" disabled={!isAreaBased}/></div>
                    <div><label className="block text-sm font-medium">Lebar (m)</label><input type="number" value={item.width} onChange={(e) => handleItemChange(item.id, 'width', e.target.value)} placeholder="-" className={`mt-1 w-full p-2 border rounded-md ${!isAreaBased && 'bg-gray-100'}`} step="0.01" min="0" disabled={!isAreaBased}/></div>
                    <div><label className="block text-sm font-medium">Qty</label><input type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', parseInt(e.target.value, 10) || 1)} className="mt-1 w-full p-2 border rounded-md" min="1" /></div>
                  </div>
                </div>
              )
            })}
            <div><button type="button" onClick={addItem} className="w-full flex items-center justify-center py-2 px-4 border-2 border-dashed rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"><PlusCircleIcon className="mr-2"/>Tambah Item</button></div>
            <div className="border-t pt-6 flex justify-between items-center">
              <div><p className="text-sm">Estimasi Total</p><p className="text-2xl font-bold text-pink-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPrice)}</p></div>
              <button type="submit" className={`text-white py-3 px-8 rounded-lg font-bold ${isSimulationMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-pink-600 hover:bg-pink-700'}`}>
                {isSimulationMode ? 'Lihat Rincian Simulasi' : (editingOrderId ? 'Update Order' : 'Simpan Order')}
              </button>
            </div>
          </form>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
          {isSimulationMode ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 bg-blue-50 rounded-lg">
                <CurrencyDollarIcon className="h-16 w-16 text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold text-blue-800">Mode Simulasi Harga</h3>
                <p className="mt-2 text-sm max-w-sm">
                  Isi formulir di sebelah kiri untuk menghitung estimasi harga bagi pelanggan.
                  Hasil simulasi tidak akan disimpan dan tidak akan masuk ke antrian produksi.
                </p>
              </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-4 border-b pb-4">Order Hari Ini</h2>
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Cari nota atau pelanggan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <div key={order.id} className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-purple-700">{order.customer}</h3>
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-fuchsia-100 text-fuchsia-800">
                            Dalam Antrian
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-500">{order.id}</p>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        {order.orderItems.map(item => {
                            const product = products.find(p => p.id === item.productId);
                            const category = categories.find(c => c.name === product?.category);
                            const isAreaBased = category?.unitType === 'Per Luas';
                            
                            const description = item.description || 'Tanpa deskripsi';
                            const material = product?.name || 'N/A';
                            const size = isAreaBased ? `${item.length}X${item.width}` : '-';
                            const quantity = `${item.qty} Pcs`;

                            const detailsString = `${description} - ${material} - ${size} - ${quantity}`;

                            return (
                              <p key={item.id} className="text-sm text-gray-700">{detailsString}</p>
                            );
                        })}
                      </div>

                      <div className="flex items-center justify-end space-x-2 mt-3 border-t pt-3">
                          <button onClick={() => handleEdit(order)} className="p-2 text-gray-500 hover:text-blue-600" title="Edit"><PencilIcon className="h-4 w-4" /></button>
                          <button onClick={() => handleCopy(order)} className="p-2 text-gray-500 hover:text-green-600" title="Salin Info"><ClipboardIcon className="h-4 w-4" /></button>
                          <button onClick={() => handlePrintSPK(order)} className="p-2 text-gray-500 hover:text-gray-800" title="Cetak SPK"><PrinterIcon className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(order.id)} className="p-2 text-gray-500 hover:text-red-600" title="Hapus"><TrashIcon className="h-4 w-4" /></button>
                          <button onClick={() => onProcessOrder(order.id)} className="flex items-center bg-cyan-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-cyan-600">
                            <PlayIcon className="h-4 w-4 mr-1" />
                            Proses Pesanan
                          </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-center text-gray-500 min-h-[20rem]"><p>Belum ada order baru.</p></div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Sales;
