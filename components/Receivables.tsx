

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { type ReceivableItem, type ProductionStatusDisplay, type PaymentStatus, type SavedOrder, type KanbanData, type CardData, type ProductData, type FinishingData, type OrderItemData, type Payment, type CustomerData, type CategoryData, type ExpenseItem } from '../types';
import { ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, CurrencyDollarIcon, CreditCardIcon, ChartBarIcon, EllipsisVerticalIcon, FilterIcon, ReceiptTaxIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

// --- START: Reusable Components ---

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

interface StatCardProps {
  icon: React.ReactElement<{ className?: string }>;
  title: string;
  value: string;
  onClick?: () => void;
  gradient: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, onClick, gradient }) => (
  <div 
    className={`p-6 rounded-xl shadow-lg text-white ${gradient} ${onClick ? 'transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1' : ''}`}
    onClick={onClick}
  >
    <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-medium text-white/90 truncate">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate" title={value}>{value}</p>
        </div>
        <div className="p-3 rounded-full bg-black/20 flex-shrink-0">
          {React.cloneElement(icon, { className: "h-7 w-7 text-white" })}
        </div>
    </div>
  </div>
);


// Modal Component for listing orders
const OrderListModal: React.FC<{
  title: string;
  orders: CardData[];
  allOrders: SavedOrder[];
  onClose: () => void;
}> = ({ title, orders, allOrders, onClose }) => {
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


// New Payment Modal
const PaymentModal: React.FC<{
  order: ReceivableItem;
  fullOrder: SavedOrder | undefined;
  products: ProductData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  categories: CategoryData[];
  onClose: () => void;
  onConfirmPayment: (orderId: string, paymentDetails: Payment, discountAmount: number) => void;
}> = ({ order, fullOrder, products, finishings, customers, categories, onClose, onConfirmPayment }) => {
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentSource, setPaymentSource] = useState('Tunai');

  useEffect(() => {
    if (order.discount) {
        setDiscount(order.discount.toString());
    }
  }, [order]);
  
  const { totalPaid, totalSetelahDiskon, sisaTagihan } = useMemo(() => {
    const currentTotalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const currentDiscount = parseFloat(discount) || 0;
    const currentTotalSetelahDiskon = order.amount - currentDiscount;
    const currentSisaTagihan = currentTotalSetelahDiskon - currentTotalPaid;
    return {
      totalPaid: currentTotalPaid,
      totalSetelahDiskon: currentTotalSetelahDiskon,
      sisaTagihan: currentSisaTagihan,
    };
  }, [order, discount]);

  const numPaymentAmount = parseFloat(paymentAmount) || 0;
  const kembalian = numPaymentAmount > sisaTagihan ? numPaymentAmount - sisaTagihan : 0;
  
  const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer',
    'Retail': 'retail',
    'Grosir': 'grosir',
    'Reseller': 'reseller',
    'Corporate': 'corporate'
  };
  
  const calculateItemPrice = (item: OrderItemData): number => {
    const customerData = customers.find(c => c.name === order.customer);
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

  const handleProcessPayment = () => {
      const amountToPay = numPaymentAmount;
      const finalDiscount = parseFloat(discount) || 0;
      
      if (sisaTagihan <= 0 && amountToPay > 0) {
        alert("Tagihan ini sudah lunas. Tidak dapat menambahkan pembayaran baru.");
        return;
      }
      
      if (amountToPay <= 0) {
          alert("Jumlah pembayaran harus lebih dari nol.");
          return;
      }

      const amountToRecord = Math.min(amountToPay, sisaTagihan);

      onConfirmPayment(order.id, {
        amount: amountToRecord,
        date: paymentDate,
        source: paymentSource,
      }, finalDiscount);
  };

  const unroundedTotal = fullOrder?.orderItems.reduce((sum, item) => sum + calculateItemPrice(item), 0) || 0;
  const roundingDifference = order.amount - unroundedTotal;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="text-xl font-bold text-gray-800">Proses Pembayaran</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="flex justify-between text-sm">
                    <div>
                        <p className="text-gray-500">Pelanggan</p>
                        <p className="font-semibold text-gray-800">{order.customer}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-500">No. Nota</p>
                        <p className="font-semibold text-gray-800">{order.id}</p>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Detail Pesanan</h4>
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-2 px-3 text-left font-medium text-gray-600">Deskripsi</th>
                                    <th className="py-2 px-3 text-left font-medium text-gray-600">Bahan</th>
                                    <th className="py-2 px-3 text-left font-medium text-gray-600">Ukuran</th>
                                    <th className="py-2 px-3 text-center font-medium text-gray-600">Qty</th>
                                    <th className="py-2 px-3 text-right font-medium text-gray-600">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {fullOrder?.orderItems.map((item, index) => {
                                    const product = products.find(p => p.id === item.productId);
                                    const category = categories.find(c => c.name === product?.category);
                                    const isArea = category?.unitType === 'Per Luas';
                                    let itemTotal = calculateItemPrice(item);
                                    if (fullOrder && index === fullOrder.orderItems.length - 1) {
                                        itemTotal += roundingDifference;
                                    }
                                    return (
                                        <tr key={item.id}>
                                            <td className="py-2 px-3">{item.description || '-'}</td>
                                            <td className="py-2 px-3">{product?.name || 'N/A'}</td>
                                            <td className="py-2 px-3">{isArea ? `${item.length}x${item.width}` : '-'}</td>
                                            <td className="py-2 px-3 text-center">{item.qty} Pcs</td>
                                            <td className="py-2 px-3 text-right font-mono">{new Intl.NumberFormat('id-ID').format(itemTotal)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {order.payments && order.payments.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Riwayat Pembayaran (DP)</h4>
                    <div className="border rounded-lg p-3 space-y-2 bg-gray-50 max-h-32 overflow-y-auto">
                      {order.payments.map((p, index) => (
                        <div key={index} className="flex justify-between items-center text-sm border-b last:border-b-0 pb-2 last:pb-0">
                          <div>
                            <p className="font-semibold text-gray-800">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.amount)}</p>
                            <p className="text-xs text-gray-500">{p.source}</p>
                          </div>
                          <p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-md">
                        <span className="text-gray-600">Total Tagihan</span>
                        <span className="font-semibold">{formatCurrency(order.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-md">
                        <span className="text-gray-600">Diskon (Rp.)</span>
                        <input 
                            type="number"
                            value={discount}
                            onChange={e => setDiscount(e.target.value)}
                            className="w-32 p-1 border rounded-md text-right font-semibold text-green-600 bg-green-50"
                            placeholder="0"
                        />
                    </div>
                    <div className="flex justify-between text-md font-semibold border-t pt-2">
                        <span className="text-gray-800">Total Setelah Diskon</span>
                        <span>{formatCurrency(totalSetelahDiskon)}</span>
                    </div>
                    <div className="flex justify-between text-md">
                        <span className="text-gray-600">Sudah Dibayar</span>
                        <span>{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold p-2 bg-red-50 rounded-lg">
                        <span className="text-red-700">Sisa Tagihan</span>
                        <span className="text-red-700">{formatCurrency(sisaTagihan < 0 ? 0 : sisaTagihan)}</span>
                    </div>
                </div>
                
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Form Input Pembayaran</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Jumlah Pembayaran</label>
                            <input 
                                type="number" 
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                className="mt-1 w-full p-2 border rounded-md" 
                                placeholder="0"
                            />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-700">Tanggal Pembayaran</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                            <select value={paymentSource} onChange={e => setPaymentSource(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                <option>Tunai</option>
                                <option>Transfer Bank</option>
                                <option>QRIS</option>
                                <option>Lainnya</option>
                            </select>
                        </div>
                    </div>
                </div>

                {kembalian > 0 && (
                    <div className="text-right bg-green-50 p-3 rounded-lg">
                        <p className="text-gray-500">Kembalian</p>
                        <p className="font-bold text-2xl text-green-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(kembalian)}</p>
                    </div>
                )}
            </div>

            <div className="border-t pt-4 mt-4 flex justify-end space-x-3">
                <button onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>
                <button 
                    onClick={handleProcessPayment} 
                    className="bg-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-700 disabled:bg-pink-300"
                    disabled={numPaymentAmount <= 0}
                >
                    Proses Pembayaran
                </button>
            </div>
        </div>
    </div>
  );
};

// New Bulk Payment Modal
const BulkPaymentModal: React.FC<{
  orders: ReceivableItem[];
  onClose: () => void;
  onConfirmBulkPayment: (paymentDate: string, paymentSource: string) => void;
}> = ({ orders, onClose, onConfirmBulkPayment }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
    const [paymentSource, setPaymentSource] = useState('Tunai');
    
    const totalAmount = orders.reduce((sum, order) => {
        const paid = order.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
        return sum + (order.amount - paid);
    }, 0);
    
    const handleConfirm = () => {
        onConfirmBulkPayment(paymentDate, paymentSource);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Proses Bayar Massal</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>
                
                <div className="space-y-4">
                    <p>Anda akan memproses pembayaran untuk <strong>{orders.length} nota</strong> yang belum lunas (sesuai filter).</p>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <p className="text-gray-500">Total Tagihan</p>
                        <p className="font-bold text-2xl text-red-600">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalAmount)}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Tanggal Pembayaran</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Sumber Dana</label>
                            <select value={paymentSource} onChange={e => setPaymentSource(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                <option>Tunai</option>
                                <option>Transfer Bank</option>
                                <option>QRIS</option>
                                <option>Lainnya</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="border-t pt-4 mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>
                    <button onClick={handleConfirm} className="bg-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-700">
                        Proses Pembayaran Massal
                    </button>
                </div>
            </div>
        </div>
    );
};

const InitialCashModal: React.FC<{
  currentAmount: number;
  onClose: () => void;
  onSave: (amount: number) => void;
}> = ({ currentAmount, onClose, onSave }) => {
  const [amount, setAmount] = useState(currentAmount.toString());

  const handleSave = () => {
    const numericAmount = parseFloat(amount);
    if (!isNaN(numericAmount)) {
      onSave(numericAmount);
      onClose();
    } else {
      alert('Masukkan jumlah yang valid.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-800">Atur Kas Awal Harian</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Masukkan jumlah modal atau uang kembalian yang tersedia di laci pada awal hari. Nilai ini akan digunakan untuk perhitungan kas akhir hari ini.</p>
          <div>
            <label htmlFor="initial-cash" className="block text-sm font-medium text-gray-700">Jumlah Kas Awal (Rp)</label>
            <input
              type="number"
              id="initial-cash"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md"
              placeholder="e.g., 100000"
            />
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


interface ReceivablesProps {
  receivables: ReceivableItem[];
  allOrders: SavedOrder[];
  boardData: KanbanData;
  products: ProductData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  categories: CategoryData[];
  expenses: ExpenseItem[];
  initialCash: number;
  onUpdateInitialCash: (amount: number) => void;
  onProcessPayment: (orderId: string, paymentDetails: Payment, newDiscount?: number) => void;
  onBulkProcessPayment: (orderIds: string[], paymentDate: string, paymentSource: string) => void;
}

const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer',
    'Retail': 'retail',
    'Grosir': 'grosir',
    'Reseller': 'reseller',
    'Corporate': 'corporate'
};


const Receivables: React.FC<ReceivablesProps> = ({ 
    receivables, allOrders, boardData, products, finishings, customers, categories, expenses, initialCash,
    onProcessPayment, onBulkProcessPayment, onUpdateInitialCash 
}) => {
  const [modalData, setModalData] = useState<{ title: string; orders: CardData[] } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ReceivableItem | null>(null);
  const [actionsMenu, setActionsMenu] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isBulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [isInitialCashModalOpen, setInitialCashModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter states
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSearch, filterCustomer, filterStatus, filterStartDate, filterEndDate]);

  const uniqueCustomers = useMemo(() => {
    const customers = new Set(receivables.map(r => r.customer));
    return Array.from(customers);
  }, [receivables]);

  const filteredReceivables = useMemo(() => {
    return receivables.filter(receivable => {
      const order = allOrders.find(o => o.id === receivable.id);
      if (!order) return false;

      // Filter by Search Query (Nota or Customer)
      const lowerCaseSearch = filterSearch.toLowerCase();
      if (filterSearch && !receivable.id.toLowerCase().includes(lowerCaseSearch) && !receivable.customer.toLowerCase().includes(lowerCaseSearch)) {
        return false;
      }
      // Filter by Customer
      if (filterCustomer && receivable.customer !== filterCustomer) {
        return false;
      }
      // Filter by Payment Status
      if (filterStatus && receivable.paymentStatus !== filterStatus) {
        return false;
      }
      // Filter by Date Range
      const orderDate = order.orderDate;
      if (filterStartDate && orderDate < filterStartDate) {
        return false;
      }
      if (filterEndDate && orderDate > filterEndDate) {
        return false;
      }
      return true;
    }).sort((a, b) => b.id.localeCompare(a.id));
  }, [receivables, allOrders, filterSearch, filterCustomer, filterStatus, filterStartDate, filterEndDate]);
  
  const paginatedReceivables = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReceivables.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReceivables, currentPage]);

  const unpaidFilteredReceivables = useMemo(() => {
    return filteredReceivables.filter(r => r.paymentStatus === 'Belum Lunas');
  }, [filteredReceivables]);
  
  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterCustomer('');
    setFilterStatus('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  // Stats for cards
  const today = new Date().toISOString().substring(0, 10);
  
  const getItemsCount = (cards: CardData[]): number => {
      return cards.reduce((sum, card) => {
          const order = allOrders.find(o => o.id === card.id);
          return sum + (order?.orderItems.length || 0);
      }, 0);
  };

  const paymentsToday = useMemo(() => {
    return receivables.reduce((total, receivable) => {
        const paymentsOnToday = receivable.payments?.filter(p => p.date === today) || [];
        const sumOfPayments = paymentsOnToday.reduce((sum, p) => sum + p.amount, 0);
        return total + sumOfPayments;
    }, 0);
  }, [receivables, today]);

  const receivablesTodayUnpaid = useMemo(() => {
      const todayOrderIds = new Set(allOrders.filter(o => o.orderDate === today).map(o => o.id));
      return receivables
          .filter(r => todayOrderIds.has(r.id) && r.paymentStatus === 'Belum Lunas')
          .reduce((sum, r) => {
              const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
              const remaining = r.amount - (r.discount || 0) - totalPaid;
              return sum + (remaining > 0 ? remaining : 0);
          }, 0);
  }, [receivables, allOrders, today]);

  const expensesToday = useMemo(() => {
      return expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, today]);

  const finalCash = initialCash + paymentsToday - expensesToday;

  const totalOrdersToday = allOrders
      .filter(o => o.orderDate === today)
      .reduce((sum, order) => sum + order.orderItems.length, 0);
  const needsProcessingCount = getItemsCount(boardData.queue);
  const finishedInWarehouseCount = getItemsCount(boardData.warehouse);
  const deliveredCount = getItemsCount(boardData.delivered);

  const handleOpenPaymentModal = (order: ReceivableItem) => {
    setSelectedOrder(order);
  };

  const handleClosePaymentModal = () => {
    setSelectedOrder(null);
  };
  
  const handleConfirmPayment = (orderId: string, paymentDetails: Payment, discountAmount: number) => {
    onProcessPayment(orderId, paymentDetails, discountAmount);
    handleClosePaymentModal();
  };
  
  const handleConfirmBulkPayment = (paymentDate: string, paymentSource: string) => {
    const orderIdsToPay = unpaidFilteredReceivables.map(o => o.id);
    if (orderIdsToPay.length > 0) {
        onBulkProcessPayment(orderIdsToPay, paymentDate, paymentSource);
    }
    setBulkPayModalOpen(false);
  };

  const handlePrintReceipt = (order: ReceivableItem) => {
    const fullOrder = allOrders.find(o => o.id === order.id);
    if (!fullOrder) {
        alert("Detail order tidak ditemukan!");
        return;
    }

    const totalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const subtotal = order.amount;
    const remainingAmount = subtotal - (order.discount || 0) - totalPaid;

    const calculateItemPrice = (item: OrderItemData, customerName: string): { total: number, perUnit: number } => {
        const customerData = customers.find(c => c.name === customerName);
        const customerLevel = customerData ? customerData.level : 'End Customer';
        const priceKey = priceLevelMap[customerLevel];
        
        if (!item.productId) return { total: 0, perUnit: 0 };
        const productInfo = products.find(p => p.id === item.productId);
        const finishingInfo = finishings.find(f => f.name === item.finishing);
        if (!productInfo) return { total: 0, perUnit: 0 };

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
        const total = (baseItemPrice * priceMultiplier) * item.qty;
        const perUnit = item.qty > 0 ? total / item.qty : 0;
        return { total, perUnit };
    };
    
    const unroundedTotal = fullOrder.orderItems.reduce((sum, i) => sum + calculateItemPrice(i, order.customer).total, 0);
    const roundingDifference = subtotal - unroundedTotal;

    const itemsHtml = fullOrder.orderItems.map((item, index) => {
        const product = products.find(p => p.id === item.productId);
        const category = categories.find(c => c.name === product?.category);
        const isArea = category?.unitType === 'Per Luas';
        const prices = calculateItemPrice(item, order.customer);
        
        const isLastItem = index === fullOrder.orderItems.length - 1;
        const displayTotal = isLastItem ? prices.total + roundingDifference : prices.total;

        const detailsParts = [];
        if (isArea && parseFloat(item.length) > 0 && parseFloat(item.width) > 0) {
            detailsParts.push(`${item.length}x${item.width}m`);
        }
        detailsParts.push(`${item.qty} Pcs`);

        
        const detailsLine = detailsParts.join(' // ');

        return `
            <div style="margin-bottom: 4px;">
                <div class="bold">${index + 1}. ${item.description || product?.name || 'N/A'}</div>
                <div class="details-line">&nbsp;&nbsp;&nbsp;${detailsLine} = ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(displayTotal)}</div>

            </div>
        `;
    }).join('');

    const printContent = `
        <html>
            <head>
                <title>Struk ${order.id}</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body {
                        font-family: sans-serif;
                        font-size: 12px;
                        color: #000;
                        margin: 0;
                        padding: 5mm;
                        width: 70mm; /* Content width */
                        line-height: 1.3;
                    }
                    .container { width: 100%; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .h1 { font-size: 20px; font-weight: bold; margin: 0; }
                    .larger-text { font-size: 14px; }
                    .address { font-size: 11px; }
                    .divider { border: 0; border-top: 1px dashed black; margin: 5px 0; }
                    .details-line { line-height: 1.2; }
                    .summary-table { width: 100%; }
                    .summary-table td { padding: 1px 0; }
                    .summary-table .label { text-align: left; }
                    .summary-table .value { text-align: right; }
                    p, div { margin: 0; padding: 0; word-wrap: break-word; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="center">
                        <div class="h1">NALAMEDIA</div>
                    </div>
                    <div class="divider"></div>
                    <div class="center">
                        <p class="address">Jl. Prof. Moh. Yamin Cerbonan, Karanganyar</p>
                        <p>Whatsapp: 0813-9872-7722</p>
                        <p>Email: nalamedia.kra@gmail.com</p>
                    </div>
                    <div class="divider"></div>
                    <div class="center">
                        <p class="larger-text bold">${order.customer}</p>
                        <p class="bold">${order.id}</p>
                        <p>${new Date(fullOrder.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div class="divider"></div>
                    <p>No. Detail Pesanan</p>
                    <div class="divider"></div>
                    ${itemsHtml}
                    <div class="divider"></div>
                    <table class="summary-table">
                        <tr>
                            <td class="label bold">Subtotal:</td>
                            <td class="value bold">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(subtotal)}</td>
                        </tr>
                    </table>
                    <div class="divider"></div>
                    <table class="summary-table">
                        <tr>
                            <td class="label">Bayar:</td>
                            <td class="value">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPaid)}</td>
                        </tr>
                        <tr>
                            <td class="label bold">Sisa:</td>
                            <td class="value bold">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(remainingAmount)}</td>
                        </tr>
                    </table>
                    <div class="divider"></div>
                    <div class="center">
                        <p class="bold">Pembayaran Via Transfer</p>
                        <p>BRI: 6707-01-02-8864-537</p>
                        <p>BCA: 0154-361801</p>
                        <p>BPD JATENG: 3142-069325</p>
                        <p class="bold">a/n Ariska Prima Diastari</p>
                    </div>
                    <div class="divider"></div>
                    <div class="center">
                        <p class="bold">PERHATIAN</p>
                        <p>Komplain lebih dari</p>
                        <p>1 hari tidak kami layani</p>
                        <p class="bold">Terima Kasih</p>
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
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }
  };
  
    const handlePrintDotMatrixNota = (order: ReceivableItem) => {
    const fullOrder = allOrders.find(o => o.id === order.id);
    if (!fullOrder) {
        alert("Detail order tidak ditemukan!");
        return;
    }

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const totalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const remainingAmount = order.amount - (order.discount || 0) - totalPaid;

    const calculateItemPrice = (item: OrderItemData, customerName: string): number => {
        const customerData = customers.find(c => c.name === customerName);
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
    
    const unroundedTotal = fullOrder.orderItems.reduce((sum, i) => sum + calculateItemPrice(i, order.customer), 0);
    const roundingDifference = order.amount - unroundedTotal;

    const itemsHtml = fullOrder.orderItems.map((item, index) => {
        const product = products.find(p => p.id === item.productId);
        const category = categories.find(c => c.name === product?.category);
        const isArea = category?.unitType === 'Per Luas';
        
        let itemTotal = calculateItemPrice(item, order.customer);
        const isLastItem = index === fullOrder.orderItems.length - 1;
        if (isLastItem) {
            itemTotal += roundingDifference;
        }

        return `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${item.description || '-'}</td>
                <td>${product?.name || 'N/A'}</td>
                <td>${isArea ? `${item.length}x${item.width}` : '-'}</td>
                <td style="text-align: center;">${item.qty}</td>
                <td class="currency">${new Intl.NumberFormat('id-ID').format(itemTotal)}</td>
            </tr>
        `;
    }).join('');

    const printContent = `
        <html>
            <head>
                <title>&nbsp;</title>
                <style>
                    @page {
                        size: 241mm 279mm;
                        margin: 0;
                    }
                    body {
                        font-family: sans-serif;
                        font-size: 9pt;
                        color: #000;
                        line-height: 1.2;
                    }
                    .nota-container {
                        width: 100%;
                        max-width: 220mm;
                        margin: auto;
                    }
                    .sub-header, .footer, .signatures {
                        display: flex;
                        justify-content: space-between;
                    }
                    .divider {
                        border: 0;
                        border-top: 1px dashed black;
                        margin: 0;
                    }
                    .sub-header { font-size: 8pt; }
                    .sub-header .nota-no {
                        font-weight: bold;
                        text-align: right;
                    }
                    table { margin-top: 0;
                        width: 100%;
                        border-collapse: collapse;
                        margin: 8px 0;
                        font-size: 8pt;
                    }
                    th {
                        border: 1px solid #555;
                        padding: 3px 4px;
                        text-align: left;
                        vertical-align: top;
                        background-color: #f0f0f0;
                    }
                    td {
                        border: 1px solid transparent;
                        padding: 3px 4px;
                        text-align: left;
                        vertical-align: top;
                    }
                    td.currency { text-align: right; }
                    .footer {
                        align-items: flex-end;
                        margin-top: 0;
                    }
                    .divider {
                        border: 0;
                        border-top: 1px dashed black;
                        margin: 0;
                    }
                    .footer-left {
                        font-size: 7pt;
                        max-width: 60%;
                    }
                    .footer-left p { margin: 0; }
                    .footer-right {
                        text-align: right;
                        font-size: 8pt;
                        min-width: 150px;
                    }
                    .summary-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 1px;
                    }
                    .summary-divider {
                        border-top: 1px solid black;
                        margin: 4px 0;
                        width: 100%;
                    }
                    .signatures {
                        margin-top: 0;
                        display: flex;
                        justify-content: space-around;
                        text-align: center;
                        font-size: 8pt;
                    }
                </style>
            </head>
            <body>
                <div class="nota-container">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 1px dashed black;">
                        <div style="width: 60%;">
                            <h1 style="font-size: 18pt; font-weight: bold; margin: 0; padding: 0; line-height: 1;">
                                <span style="color: #000000;">NALA</span>
                                <span style="color: #000000;">MEDIA</span>
                                <span style="font-size: 10pt; font-weight: normal; color: #000000;"> Digital Printing</span>
                            </h1>
                            <p style="font-size: 8pt; margin-top: 4px; line-height: 1.2; margin: 0;">
                                Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar<br/>
                                Email: nalamedia.kra@gmail.com | Telp/WA: 0813-9872-7722
                            </p>
                        </div>
                        <div style="width: 40%; text-align: right; font-size: 10pt; line-height: 1.4;">
                            <p style="margin: 0;">Tanggal: ${formatDate(fullOrder.orderDate)}</p>
                            <p style="margin: 4px 0 0 0;">Kepada Yth,</p>
                            <p style="font-weight: bold; margin: 0; color: #000000;">${order.customer}</p>
                        </div>
                    </div>
                    <div class="sub-header">
                        <div class="kasir-info">
                            <p>NOTA :</p>
                        </div>
                        <div class="nota-no">
                            <p>${order.id}</p>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="text-align: center;">No</th>
                                <th>Deskripsi</th>
                                <th>Bahan</th>
                                <th>Ukuran</th>
                                <th style="text-align: center;">Qty</th>
                                <th class="currency">Total</th>
                            </tr>
                        </thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <div class="summary-divider"></div>
                    <div class="footer">
                        <div class="footer-left">
                            <p><strong>PERHATIAN:</strong></p>
                            <p>Pembayaran Resmi hanya melalui Bank A/n Ariska Prima Diastari</p>
                            <p><strong>BRI:</strong> 670-70-10-28864537 | <strong>BCA:</strong> 0154361801 | <strong>BPD JATENG:</strong> 3142069325</p>
                            <p>Pembayaran selain Nomor Rekening di atas bukan tanggung jawab kami.</p>
                        </div>
                        <div class="footer-right">
                            <div class="summary-item"><span>Sub Total :</span><span>${new Intl.NumberFormat('id-ID').format(order.amount)}</span></div>
                             ${(order.discount || 0) > 0 ? `<div class="summary-item"><span>Diskon :</span><span>-${new Intl.NumberFormat('id-ID').format(order.discount!)}</span></div>` : ''}
                            <div class="summary-item"><span>Bayar :</span><span>${new Intl.NumberFormat('id-ID').format(totalPaid)}</span></div>
                            <div class="summary-divider"></div>
                            <div class="summary-item"><span>Sisa :</span><span>${new Intl.NumberFormat('id-ID').format(remainingAmount)}</span></div>
                        </div>
                    </div>
                    <div class="signatures">
                        <div>Hormat Kami,</div>
                        <div>Penerima,</div>
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
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    }
  };


  const handlePrintCustomerReport = () => {
    const customerName = filterCustomer || 'Semua Pelanggan (Sesuai Filter)';
    const reportPeriod = (filterStartDate || filterEndDate) ? 
      `Periode: ${filterStartDate ? new Date(filterStartDate).toLocaleDateString('id-ID') : '...'} - ${filterEndDate ? new Date(filterEndDate).toLocaleDateString('id-ID') : '...'}` :
      'Periode: Semua Waktu';

    const reportItems = filteredReceivables
        .sort((a, b) => {
            const dateA = allOrders.find(o => o.id === a.id)?.orderDate || '';
            const dateB = allOrders.find(o => o.id === b.id)?.orderDate || '';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        });

    let totalTagihan = 0;
    let totalSisa = 0;

    const tableRows = reportItems.map((receivable, index) => {
        const fullOrder = allOrders.find(o => o.id === receivable.id);
        if (!fullOrder) return '';
        const firstItem = fullOrder.orderItems[0];
        const product = products.find(p => p.id === firstItem.productId);
        const category = categories.find(c => c.name === product?.category);
        const isArea = category?.unitType === 'Per Luas';

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${receivable.id}</td>
                <td>${firstItem.description || product?.name || 'N/A'}${fullOrder.orderItems.length > 1 ? ' (dan lainnya)' : ''}</td>
                <td>${isArea ? `${firstItem.length}x${firstItem.width}` : '-'}</td>
                <td>${firstItem.qty} Pcs</td>
                <td>${receivable.paymentStatus}</td>
                <td class="currency">${new Intl.NumberFormat('id-ID').format(receivable.amount)}</td>
            </tr>
        `;
    }).join('');
    
    const dpHistory = reportItems.filter(r => r.payments && r.payments.length > 0)
        .flatMap(r => 
            r.payments!.map(p => `
                <div class="dp-item">
                    <span>${new Date(p.date).toLocaleDateString('id-ID')} (Nota ${r.id}):</span>
                    <span>${p.source}</span>
                    <span class="currency">${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.amount)}</span>
                </div>
            `)
        ).join('');

    reportItems.forEach(r => {
        totalTagihan += r.amount;
        const paid = r.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        if (r.paymentStatus === 'Belum Lunas') {
            totalSisa += (r.amount - paid);
        }
    });

    const printContent = `
        <html>
            <head>
                <title>Laporan Pelanggan - ${customerName}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
                    .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                    .header, .customer-info, .summary { display: flex; justify-content: space-between; align-items: flex-start; }
                    .header h1 { font-size: 16pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #555; }
                    hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; }
                    th { background-color: #f2f2f2; }
                    .currency { text-align: right; }
                    .summary-box { text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ccc; }
                    .dp-history { margin-top: 15px; padding: 10px; border: 1px solid #eee; border-radius: 5px; background: #f9f9f9; font-size: 9pt; }
                    .dp-history h3 { margin: 0 0 10px 0; font-size: 10pt; } .dp-item { display: flex; justify-content: space-between; margin-bottom: 5px; }
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
                        <h1>Laporan Pelanggan</h1>
                    </div>
                    <hr>
                    <div class="customer-info">
                        <strong>${customerName}</strong>
                        <span>${reportPeriod}</span>
                    </div>
                    <hr>
                    <table>
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>No. Nota</th>
                                <th>Deskripsi</th>
                                <th>Ukuran</th>
                                <th>Qty</th>
                                <th>Status</th>
                                <th class="currency">Total (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    
                    ${dpHistory ? `<div class="dp-history"><h3>Riwayat Pembayaran (DP)</h3>${dpHistory}</div>` : ''}

                    <div class="summary-box">
                        <table style="width: 250px; float: right; border: none;">
                            <tr><td style="border:none;">Total Tagihan:</td><td style="border:none;" class="currency"><strong>${new Intl.NumberFormat('id-ID').format(totalTagihan)}</strong></td></tr>
                            <tr><td style="border:none;">Sisa Tagihan:</td><td style="border:none;" class="currency"><strong>${new Intl.NumberFormat('id-ID').format(totalSisa)}</strong></td></tr>
                        </table>
                    </div>
                    <div style="clear: both; margin-top: 40px; font-size: 9pt;">
                        <hr>
                        <strong>Informasi Pembayaran:</strong><br>
                        Transfer Bank ke rekening BCA 0154-361801, BRI 6707-01-02-8864-537, atau BPD JATENG 3142-069325 a/n Ariska Prima Diastari.
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
  
    const handleSendWhatsApp = (order: ReceivableItem) => {
    const fullOrder = allOrders.find(o => o.id === order.id);
    const customerData = customers.find(c => c.name === order.customer);

    if (!fullOrder || !customerData || !customerData.contact) {
        alert("Informasi pelanggan atau order tidak lengkap untuk mengirim WhatsApp.");
        return;
    }

    let phone = customerData.contact.replace(/\D/g, '');
    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }

    const calculateItemPrice = (item: OrderItemData, customerName: string): number => {
        const custData = customers.find(c => c.name === customerName);
        const customerLevel = custData ? custData.level : 'End Customer';
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
    
    const unroundedTotal = fullOrder.orderItems.reduce((sum, i) => sum + calculateItemPrice(i, order.customer), 0);
    const roundingDifference = order.amount - unroundedTotal;

    const storeInfo = `*Nala Media Digital Printing*\nJl. Prof. Moh. Yamin, Cerbonan, Karanganyar\n(Timur Stadion 45)\nTelp: 0813-9872-7722`;
    const divider = '--------------------------------';
    
    const notaInfo = [
        `No Nota  : *${order.id}*`,
        `Tanggal  : ${new Date(fullOrder.orderDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        `Kasir    : -`,
        `Pelanggan: ${order.customer}`
    ].join('\n');

    const itemsInfo = fullOrder.orderItems.map((item, index) => {
        const product = products.find(p => p.id === item.productId);
        const category = categories.find(c => c.name === product?.category);
        const isArea = category?.unitType === 'Per Luas';
        
        let itemTotal = calculateItemPrice(item, order.customer);
        const isLastItem = index === fullOrder.orderItems.length - 1;
        if (isLastItem) {
            itemTotal += roundingDifference;
        }

        const pricePerUnit = item.qty > 0 ? itemTotal / item.qty : 0;

        const description = item.description || product?.name || 'Item';
        const size = isArea && parseFloat(item.length) > 0 && parseFloat(item.width) > 0 ? `${item.length}m x ${item.width}m\n` : '';
        const calculation = `  ${item.qty} x ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(pricePerUnit)} = ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(itemTotal)}`;
        
        return `${description}\n${size}${calculation}`;
    }).join(`\n${divider}\n`);
    
    const totalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const remainingAmount = order.amount - totalPaid;

    const summaryInfo = [
        `Total    : *${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(order.amount)}*`,
        `Bayar    : ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPaid)}`,
        `Sisa     : *${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(remainingAmount)}*`
    ].join('\n');
    
    const thankYou = `Terima kasih!`;

    const message = [
        storeInfo,
        divider,
        notaInfo,
        divider,
        itemsInfo,
        divider,
        summaryInfo,
        divider,
        thankYou
    ].join('\n');

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=${phone}&text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
    setActionsMenu(null);
  };
  
    const handlePreviewInvoice = (order: ReceivableItem) => {
    const fullOrder = allOrders.find(o => o.id === order.id);
    const customer = customers.find(c => c.name === order.customer);

    if (!fullOrder || !customer) {
        alert("Data order atau pelanggan tidak lengkap.");
        return;
    }

    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const totalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalTagihan = order.amount;
    const sisaTagihan = totalTagihan - (order.discount || 0) - totalPaid;

    const getPriceForCustomer = (product: ProductData, customerLevel: CustomerData['level']) => {
        const priceKey = priceLevelMap[customerLevel];
        return product.price[priceKey] || product.price.endCustomer;
    };
    
    const banks = [
      { id: 1, name: 'BRI', account_number: '6707-01-02-8864-537' },
      { id: 2, name: 'BCA', account_number: '0154-361801' },
      { id: 3, name: 'BPD JATENG', account_number: '3142-069325' }
    ];

    const unroundedTotal = fullOrder.orderItems.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId);
        if (!product || !customer) return sum;

        const category = categories.find(c => c.name === product.category);
        const isAreaBased = category?.unitType === 'Per Luas';
        const finishingInfo = finishings.find(f => f.name === item.finishing);
        const finishingPrice = finishingInfo ? finishingInfo.price : 0;
        const materialPrice = getPriceForCustomer(product, customer.level);
        const baseItemPricePerUnit = materialPrice + finishingPrice;
        const priceMultiplier = isAreaBased ? (parseFloat(item.length) || 1) * (parseFloat(item.width) || 1) : 1;
        const hargaSatuanFinal = baseItemPricePerUnit * priceMultiplier;
        const jumlah = hargaSatuanFinal * item.qty;
        return sum + jumlah;
    }, 0);
    const roundingDifference = totalTagihan - unroundedTotal;

    const itemsHtml = fullOrder.orderItems.map((item, index) => {
        const product = products.find(p => p.id === item.productId);
        if (!product || !customer) return '';

        const category = categories.find(c => c.name === product.category);
        const isAreaBased = category?.unitType === 'Per Luas';
        
        const finishingInfo = finishings.find(f => f.name === item.finishing);
        const finishingPrice = finishingInfo ? finishingInfo.price : 0;
        
        const materialPrice = getPriceForCustomer(product, customer.level);
        const baseItemPricePerUnit = materialPrice + finishingPrice;
        
        const priceMultiplier = isAreaBased ? (parseFloat(item.length) || 1) * (parseFloat(item.width) || 1) : 1;
        const hargaSatuanFinal = baseItemPricePerUnit * priceMultiplier;
        const jumlah = hargaSatuanFinal * item.qty;
        
        const isLastItem = index === fullOrder.orderItems.length - 1;
        const displayJumlah = isLastItem ? jumlah + roundingDifference : jumlah;

        return `
            <tr>
                <td class="p-3 text-center text-gray-600">${index + 1}</td>
                <td class="p-3">
                    <p class="font-medium text-gray-800">${item.description || product.name}</p>
                    <p class="text-xs text-gray-500">${product.name}</p>
                </td>
                <td class="p-3 text-center text-gray-600">${isAreaBased ? `${item.length}x${item.width} m` : '-'}</td>
                <td class="p-3 text-center text-gray-600">${item.qty}</td>
                <td class="p-3 text-right text-gray-600">${formatCurrency(hargaSatuanFinal)}</td>
                <td class="p-3 text-right font-medium text-gray-800">${formatCurrency(displayJumlah)}</td>
            </tr>
        `;
    }).join('');

    const discountRow = (order.discount || 0) > 0 ? `
        <div class="flex justify-between py-2 border-b border-gray-200">
            <span class="text-gray-600">Diskon</span>
            <span class="font-medium text-red-500">-${formatCurrency(order.discount!)}</span>
        </div>
    ` : '';
    
    const printContent = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice ${order.id}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            </style>
        </head>
        <body class="bg-gray-100 flex flex-col items-center p-4">
            <div class="w-full max-w-4xl bg-white text-gray-800 p-8 font-sans shadow-lg" style="width: 800px;">
                <header class="flex justify-between items-start pb-4 border-b-2 border-gray-200">
                    <div class="w-1/2">
                        <h1 class="text-3xl font-bold">
                            <span class="text-pink-500">NALA</span><span class="text-black">MEDIA</span>
                            <span class="text-black text-sm font-normal ml-2">Digital Printing</span>
                        </h1>
                        <p class="text-xs mt-2 text-gray-500">
                            Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar<br/>
                            Email: nalamedia.kra@gmail.com | Telp/WA: 0813-9872-7722
                        </p>
                    </div>
                    <div class="w-1/2 text-right">
                        <h2 class="text-3xl font-bold text-gray-800 uppercase">INVOICE</h2>
                        <p class="text-sm text-gray-500 mt-1">${order.id}</p>
                    </div>
                </header>

                <section class="flex justify-between mt-4 text-sm">
                    <div>
                        <p class="font-bold text-gray-600">Ditagihkan kepada:</p>
                        <p class="font-semibold text-gray-800">${customer?.name || 'N/A'}</p>
                        <div class="text-xs mt-0 text-gray-500">${customer?.contact || ''}</div>
                    </div>
                    <div class="text-right">
                        <p><span class="font-bold text-gray-600">Tanggal,</span> ${formatDate(fullOrder.orderDate)}</p>
                    </div>
                </section>

                <section class="mt-6">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="p-3 font-semibold text-gray-600 w-1/12 text-center">No.</th>
                                <th class="p-3 font-semibold text-gray-600 w-5/12">Deskripsi</th>
                                <th class="p-3 font-semibold text-gray-600 w-2/12 text-center">Ukuran</th>
                                <th class="p-3 font-semibold text-gray-600 w-1/12 text-center">Qty</th>
                                <th class="p-3 font-semibold text-gray-600 w-1/12 text-right">Harga Satuan</th>
                                <th class="p-3 font-semibold text-gray-600 w-2/12 text-right">Jumlah</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            ${itemsHtml}
                        </tbody>
                    </table>
                </section>

                <section class="flex justify-end mt-4">
                    <div class="w-full max-w-sm text-sm">
                        <div class="flex justify-between py-2 border-b border-gray-200">
                            <span class="text-gray-600">Subtotal</span>
                            <span class="font-medium text-gray-800">${formatCurrency(totalTagihan)}</span>
                        </div>
                        ${discountRow}
                        <div class="flex justify-between py-2 border-b border-gray-200">
                            <span class="text-gray-600">Sudah Dibayar</span>
                            <span class="font-medium text-green-500">${formatCurrency(totalPaid)}</span>
                        </div>
                        <div class="flex justify-between py-3 bg-gray-50 px-3 rounded-md mt-2">
                            <span class="font-bold text-lg text-gray-800">Sisa Tagihan</span>
                            <span class="font-bold text-lg text-pink-500">${formatCurrency(sisaTagihan)}</span>
                        </div>
                    </div>
                </section>

                <footer class="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-500">
                    <p class="font-bold">Informasi Pembayaran:</p>
                    <p>Pembayaran resmi hanya melalui rekening a/n <span class="font-semibold">Ariska Prima Diastari</span>.</p>
                    <div class="flex gap-4 mt-1">
                        ${banks.map(b => `<p><span class="font-semibold">${b.name}:</span> ${b.account_number}</p>`).join('')}
                    </div>
                </footer>
            </div>
            <div class="no-print mt-4 text-center">
                <button onclick="window.print()" class="bg-pink-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-pink-700">Cetak atau Simpan PDF</button>
            </div>
        </body>
        </html>
    `;

    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
        previewWindow.document.write(printContent);
        previewWindow.document.close();
        previewWindow.focus();
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'Lunas': return 'bg-cyan-100 text-cyan-800';
      case 'Belum Lunas':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getProductionStatusColor = (status: ProductionStatusDisplay) => {
    switch (status) {
      case 'Telah Dikirim': return 'bg-gray-100 text-gray-800';
      case 'Siap Ambil': return 'bg-teal-100 text-teal-800';
      case 'Proses Cetak': return 'bg-pink-100 text-pink-800';
      case 'Dalam Antrian':
      default:
        return 'bg-fuchsia-100 text-fuchsia-800';
    }
  };

  return (
    <>
      {modalData && (
          <OrderListModal 
              title={modalData.title} 
              orders={modalData.orders} 
              onClose={() => setModalData(null)}
              allOrders={allOrders}
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
                    .map(o => ({ id: o.id, customer: o.customer, details: o.details }));
                setModalData({ title: "Daftar Order Hari Ini", orders: ordersToday });
            }}
            gradient="bg-gradient-to-br from-blue-500 to-sky-500"
          />
          <StatCard 
            icon={<WrenchScrewdriverIcon />} 
            title="Item Perlu Proses" 
            value={`${needsProcessingCount}`}
            onClick={() => setModalData({ title: "Daftar Order Perlu Proses", orders: boardData.queue })}
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
            title="Item Terkirim" 
            value={`${deliveredCount}`}
            onClick={() => setModalData({ title: "Daftar Order Telah Terkirim", orders: boardData.delivered })}
            gradient="bg-gradient-to-br from-pink-500 to-rose-500"
          />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard 
            icon={<CurrencyDollarIcon />} 
            title="Kas Awal" 
            value={formatCurrency(initialCash)}
            gradient="bg-gradient-to-br from-gray-500 to-gray-600"
        />
        <StatCard 
            icon={<CreditCardIcon />} 
            title="Pembayaran Hari Ini" 
            value={formatCurrency(paymentsToday)}
            gradient="bg-gradient-to-br from-green-500 to-emerald-500"
        />
        <StatCard 
            icon={<ChartBarIcon />} 
            title="Piutang Hari Ini" 
            value={formatCurrency(receivablesTodayUnpaid)}
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
        />
        <StatCard 
            icon={<ReceiptTaxIcon />} 
            title="Pengeluaran Hari Ini" 
            value={formatCurrency(expensesToday)}
            gradient="bg-gradient-to-br from-rose-500 to-red-500"
        />
        <StatCard 
            icon={<CurrencyDollarIcon />} 
            title="Kas Akhir" 
            value={formatCurrency(finalCash)}
            gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500"
        />
    </div>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Daftar Pembayaran / Piutang</h2>
            <button 
              onClick={() => setIsFilterVisible(!isFilterVisible)}
              className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              <FilterIcon className="h-4 w-4" />
              <span>Filter</span>
            </button>
        </div>

        {isFilterVisible && (
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <input type="text" placeholder="Cari nota atau pelanggan..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="p-2 border rounded-md text-sm md:col-span-1" />
                    <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="p-2 border rounded-md bg-white text-sm">
                        <option value="">Semua Pelanggan</option>
                        {uniqueCustomers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="p-2 border rounded-md bg-white text-sm">
                        <option value="">Semua Status</option>
                        <option value="Lunas">Lunas</option>
                        <option value="Belum Lunas">Belum Lunas</option>
                    </select>
                    <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" />
                    <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm text-gray-500" />
                </div>
                <div className="flex justify-between items-center mt-3">
                    <div>
                         <button 
                            onClick={() => setInitialCashModalOpen(true)}
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 mr-2"
                        >
                            Kas Awal
                        </button>
                        <button 
                            onClick={() => setBulkPayModalOpen(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 mr-2 disabled:bg-green-300 disabled:cursor-not-allowed"
                            disabled={unpaidFilteredReceivables.length === 0}
                        >
                            Bayar Langsung
                        </button>
                        <button 
                            onClick={handlePrintCustomerReport}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            disabled={filteredReceivables.length === 0}
                        >
                            Laporan Pelanggan
                        </button>
                    </div>
                    <button onClick={handleResetFilters} className="text-sm text-pink-600 hover:underline">Reset Filter</button>
                </div>
            </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Nota</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Produksi</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Bayar</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedReceivables.length > 0 ? paginatedReceivables.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-4 px-4 whitespace-nowrap font-medium text-gray-800">{item.id}</td>
                  <td className="py-4 px-4 whitespace-nowrap">{item.customer}</td>
                  <td className="py-4 px-4 whitespace-nowrap">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.amount)}</td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProductionStatusColor(item.productionStatus)}`}>
                      {item.productionStatus}
                    </span>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                     <div className="flex items-center space-x-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(item.paymentStatus)}`}>
                          {item.paymentStatus}
                        </span>
                        {item.paymentStatus === 'Belum Lunas' && (
                            <button onClick={() => handleOpenPaymentModal(item)} className="text-pink-600 hover:text-pink-900 font-semibold text-xs px-2 py-1 rounded-md hover:bg-pink-50">Bayar</button>
                        )}
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap text-right text-sm font-medium">
                     <div className="relative inline-block text-left">
                        <button
                            type="button"
                            onClick={() => setActionsMenu(actionsMenu === item.id ? null : item.id)}
                            className="p-1.5 text-gray-500 rounded-full hover:bg-gray-200 focus:outline-none"
                            aria-haspopup="true"
                            aria-expanded={actionsMenu === item.id}
                        >
                            <span className="sr-only">Opsi</span>
                            <EllipsisVerticalIcon className="h-5 w-5" />
                        </button>

                        {actionsMenu === item.id && (
                            <div
                                ref={actionsMenuRef}
                                className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
                                role="menu"
                                aria-orientation="vertical"
                            >
                                <div className="py-1" role="none">
                                    <a href="#" onClick={(e) => { e.preventDefault(); handlePrintReceipt(item); setActionsMenu(null); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">Cetak Struk</a>
                                    <a href="#" onClick={(e) => { e.preventDefault(); handlePrintDotMatrixNota(item); setActionsMenu(null); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">Cetak Nota (dot matrix)</a>
                                    <a href="#" onClick={(e) => { e.preventDefault(); handleSendWhatsApp(item); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">Kirim Whatsapp</a>
                                    <a href="#" onClick={(e) => { e.preventDefault(); handlePreviewInvoice(item); setActionsMenu(null); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">Lihat & Cetak Invoice</a>
                                </div>
                            </div>
                        )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">Tidak ada data piutang yang cocok dengan filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredReceivables.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
      {selectedOrder && (
        <PaymentModal 
          order={selectedOrder}
          fullOrder={allOrders.find(o => o.id === selectedOrder.id)}
          products={products}
          finishings={finishings}
          customers={customers}
          categories={categories}
          onClose={handleClosePaymentModal}
          onConfirmPayment={handleConfirmPayment}
        />
      )}
      {isBulkPayModalOpen && (
        <BulkPaymentModal
            orders={unpaidFilteredReceivables}
            onClose={() => setBulkPayModalOpen(false)}
            onConfirmBulkPayment={handleConfirmBulkPayment}
        />
      )}
       {isInitialCashModalOpen && (
        <InitialCashModal
            currentAmount={initialCash}
            onClose={() => setInitialCashModalOpen(false)}
            onSave={onUpdateInitialCash}
        />
    )}
    </>
  );
};

export default Receivables;
