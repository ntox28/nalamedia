
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { type ReceivableItem, type ProductionStatusDisplay, type PaymentStatus, type SavedOrder, type KanbanData, type CardData, type ProductData, type FinishingData, type OrderItemData, type Payment, type CustomerData, type CategoryData, type ExpenseItem, type ExpenseMetadata, type SupplierBill, type BankInstallment, type PrivateExpenseItem, type PaymentMethod, type NotificationSettings, type NotificationItem, type LegacyReceivable, type CashDrawerState, type CashDrawerLog, type CashTransferRecord } from '../types';
import { ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, CurrencyDollarIcon, CreditCardIcon, ChartBarIcon, EllipsisVerticalIcon, FilterIcon, ReceiptTaxIcon, PencilIcon, CheckIcon, BellIcon, ExclamationTriangleIcon, ClipboardIcon, CalendarDaysIcon, ArrowUpTrayIcon, TrashIcon } from './Icons';
import { OWNER_HOLD_ACCOUNT_ID, OWNER_HOLD_ACCOUNT_NAME } from './cashFlowUtils';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

type DisplayReceivable = ReceivableItem & { isUnprocessed?: boolean; isLegacy?: boolean; legacyData?: LegacyReceivable };

// --- START: Reusable Components ---

const getLocalDateString = (date: Date = new Date()): string => {
  return date.toISOString().substring(0, 10);
};

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateTime = (isoString: string) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

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
  order: DisplayReceivable;
  fullOrder: SavedOrder | undefined;
  products: ProductData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  categories: CategoryData[];
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onConfirmPayment: (orderId: string, paymentDetails: Payment, discountAmount: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => void;
}> = ({ order, fullOrder, products, finishings, customers, categories, paymentMethods, onClose, onConfirmPayment }) => {
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  
  // Discount States
  const [discountRp, setDiscountRp] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<string>('');
  const [isDiscountLocked, setIsDiscountLocked] = useState(false);

  const [paymentDate, setPaymentDate] = useState(getLocalDateString());
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [editedItems, setEditedItems] = useState<OrderItemData[] | null>(fullOrder?.orderItems || null);

  const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer',
    'Retail': 'retail',
    'Grosir': 'grosir',
    'Reseller': 'reseller',
    'Corporate': 'corporate'
  };
  
  const calculateItemPrice = (item: OrderItemData): number => {
    // If a custom price is set, use it immediately.
    if (item.customPrice !== undefined && item.customPrice !== null) {
        return item.customPrice;
    }

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
    
    const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
    const itemFinishingTotal = finishingPrice * item.qty;
    return itemMaterialTotal + itemFinishingTotal;
  };
  
  const currentTotalAmount = useMemo(() => {
    if (!editedItems) return order.amount;
    const total = editedItems.reduce((sum, item) => sum + calculateItemPrice(item), 0);
    // Apply rounding
    return Math.ceil(total / 500) * 500;
  }, [editedItems, order.customer, products, finishings, customers, categories, order.amount]);

  // Initialize discount on mount
  useEffect(() => {
    if (order.discount && order.discount > 0) {
        setDiscountRp(order.discount.toString());
        // Auto-calc percent based on current total
        if (currentTotalAmount > 0) {
             const pct = (order.discount / currentTotalAmount) * 100;
             setDiscountPercent(pct.toFixed(2));
        }
        setIsDiscountLocked(true); 
    } else {
        setDiscountRp('');
        setDiscountPercent('');
        setIsDiscountLocked(false);
    }
  }, [order, currentTotalAmount]);

  const { totalPaid, totalSetelahDiskon, sisaTagihan } = useMemo(() => {
    const currentTotalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const currentDiscount = parseFloat(discountRp) || 0;
    const currentTotalSetelahDiskon = Math.max(0, currentTotalAmount - currentDiscount);
    const currentSisaTagihan = Math.max(0, currentTotalSetelahDiskon - currentTotalPaid);
    return {
      totalPaid: currentTotalPaid,
      totalSetelahDiskon: currentTotalSetelahDiskon,
      sisaTagihan: currentSisaTagihan,
    };
  }, [order, discountRp, currentTotalAmount]);

  const numPaymentAmount = parseFloat(paymentAmount) || 0;
  const kembalian = numPaymentAmount > sisaTagihan ? numPaymentAmount - sisaTagihan : 0;

  // --- Handlers for Discount Logic ---
  const handleDiscountPercentChange = (val: string) => {
      setDiscountPercent(val);
      const pct = parseFloat(val);
      if (!isNaN(pct) && currentTotalAmount > 0) {
          const rp = (pct / 100) * currentTotalAmount;
          setDiscountRp(Math.floor(rp).toString());
      } else {
          setDiscountRp('');
      }
  };

  const handleDiscountRpChange = (val: string) => {
      setDiscountRp(val);
      const rp = parseFloat(val);
      if (!isNaN(rp) && currentTotalAmount > 0) {
          const pct = (rp / currentTotalAmount) * 100;
          setDiscountPercent(pct.toFixed(2));
      } else {
          setDiscountPercent('');
      }
  };

  const handleLockDiscount = () => {
      setIsDiscountLocked(true);
  };

  const handleUnlockDiscount = () => {
      setIsDiscountLocked(false);
  };

  const handlePriceOverride = (itemId: number) => {
      const item = editedItems?.find(i => i.id === itemId);
      if (!item) return;

      const currentPrice = calculateItemPrice(item);
      const newPriceStr = window.prompt(`Masukkan harga TOTAL baru untuk item ini:\n${item.description}`, currentPrice.toString());

      if (newPriceStr !== null) {
          const newPrice = parseFloat(newPriceStr);
          if (!isNaN(newPrice) && newPrice >= 0) {
              setEditedItems(prev => prev!.map(i => i.id === itemId ? { ...i, customPrice: newPrice } : i));
          } else {
              alert('Harga yang dimasukkan tidak valid.');
          }
      }
  };


  const handleProcessPayment = () => {
      const amountToPay = numPaymentAmount;
      const finalDiscount = parseFloat(discountRp) || 0;
      
      if (sisaTagihan <= 0 && amountToPay > 0) {
        alert("Tagihan ini sudah lunas. Tidak dapat menambahkan pembayaran baru.");
        return;
      }
      
      if (amountToPay <= 0) {
          alert("Jumlah pembayaran harus lebih dari nol.");
          return;
      }
      
      const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);
      if (!selectedMethod) {
          alert("Silakan pilih metode pembayaran yang valid.");
          return;
      }

      const amountToRecord = Math.min(amountToPay, sisaTagihan);

      onConfirmPayment(order.id, {
        amount: amountToRecord,
        date: paymentDate,
        methodId: selectedMethod.id,
        methodName: selectedMethod.name,
      }, finalDiscount, editedItems || undefined, currentTotalAmount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
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
                                    <th className="py-2 px-3 text-center font-medium text-gray-600">Qty</th>
                                    <th className="py-2 px-3 text-right font-medium text-gray-600">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                               {editedItems ? (
                                   editedItems.map((item, index) => {
                                        const product = products.find(p => p.id === item.productId);
                                        const itemTotal = calculateItemPrice(item);
                                        return (
                                            <tr key={item.id}>
                                                <td className="py-2 px-3">
                                                    <p className="font-semibold">{item.description || '-'}</p>
                                                    <p className="text-xs text-gray-500">{product?.name || 'N/A'}</p>
                                                </td>
                                                <td className="py-2 px-3 text-center">{item.qty} Pcs</td>
                                                <td className="py-2 px-3 text-right font-mono flex items-center justify-end gap-2">
                                                    <span>{new Intl.NumberFormat('id-ID').format(itemTotal)}</span>
                                                    <button onClick={() => handlePriceOverride(item.id)} title="Ubah Harga Item" className="p-1 text-gray-400 hover:text-blue-600">
                                                        <PencilIcon className="h-3 w-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                               ) : (
                                <tr>
                                    <td colSpan={3} className="py-3 px-3 italic text-gray-600">
                                        {order.legacyData?.description || 'Data order lama.'}
                                    </td>
                                </tr>
                               )}
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
                            <p className="text-xs text-gray-500">{p.methodName}</p>
                          </div>
                          <p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between text-md">
                        <span className="text-gray-600">Total Tagihan</span>
                        <span className="font-semibold">{formatCurrency(currentTotalAmount)}</span>
                    </div>
                    
                    {/* Discount Section */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                        <label className="col-span-3 text-sm text-gray-600">Diskon</label>
                        <div className="col-span-3 relative">
                            <input 
                                type="number"
                                value={discountPercent}
                                onChange={e => handleDiscountPercentChange(e.target.value)}
                                disabled={isDiscountLocked}
                                className="w-full p-2 border rounded-md text-right text-sm disabled:bg-gray-200"
                                placeholder="%"
                            />
                            <span className="absolute right-6 top-2 text-xs text-gray-400">%</span>
                        </div>
                        <div className="col-span-4 relative">
                            <input 
                                type="number"
                                value={discountRp}
                                onChange={e => handleDiscountRpChange(e.target.value)}
                                disabled={isDiscountLocked}
                                className="w-full p-2 border rounded-md text-right text-sm font-medium text-green-700 disabled:bg-gray-200"
                                placeholder="Rp"
                            />
                            <span className="absolute left-2 top-2 text-xs text-gray-400">Rp</span>
                        </div>
                        <div className="col-span-2">
                            {isDiscountLocked ? (
                                <button 
                                    type="button" 
                                    onClick={handleUnlockDiscount}
                                    className="w-full bg-yellow-100 text-yellow-700 p-2 rounded-md text-xs font-semibold hover:bg-yellow-200 flex items-center justify-center"
                                    title="Edit Diskon"
                                >
                                    <PencilIcon className="h-4 w-4" />
                                </button>
                            ) : (
                                <button 
                                    type="button" 
                                    onClick={handleLockDiscount}
                                    className="w-full bg-blue-100 text-blue-700 p-2 rounded-md text-xs font-semibold hover:bg-blue-200 flex items-center justify-center"
                                    title="Simpan/Kunci Diskon"
                                >
                                    <CheckIcon className="h-4 w-4 mr-1" />
                                    Simpan
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-between text-md font-semibold border-t border-gray-300 pt-2">
                        <span className="text-gray-800">Total Setelah Diskon</span>
                        <span>{formatCurrency(totalSetelahDiskon)}</span>
                    </div>
                    <div className="flex justify-between text-md">
                        <span className="text-gray-600">Sudah Dibayar</span>
                        <span>{formatCurrency(totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold p-2 bg-white border border-red-100 rounded-lg">
                        <span className="text-red-700">Sisa Tagihan</span>
                        <span className="text-red-700">{formatCurrency(sisaTagihan < 0 ? 0 : sisaTagihan)}</span>
                    </div>
                </div>
                
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Form Input Pembayaran</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Jumlah Pembayaran</label>
                            <div className="flex items-center space-x-2 mt-1">
                                <input 
                                    type="number" 
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    className="w-full p-2 border rounded-md" 
                                    placeholder="0"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setPaymentAmount(sisaTagihan > 0 ? sisaTagihan.toString() : '0')}
                                    className="whitespace-nowrap bg-cyan-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-cyan-600 disabled:bg-cyan-300"
                                    disabled={sisaTagihan <= 0}
                                >
                                    LUNAS
                                </button>
                            </div>
                        </div>
                         <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Tanggal Pembayaran</label>
                            <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
                            <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                {paymentMethods.map(method => (
                                    <option key={method.id} value={method.id}>{method.name}</option>
                                ))}
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
                    disabled={numPaymentAmount <= 0 && sisaTagihan > 0}
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
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onConfirmBulkPayment: (paymentDate: string, paymentMethodId: string) => void;
}> = ({ orders, paymentMethods, onClose, onConfirmBulkPayment }) => {
    const [paymentDate, setPaymentDate] = useState(getLocalDateString());
    const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
    
    const totalAmount = orders.reduce((sum, order) => {
        const paid = order.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
        return sum + (order.amount - (order.discount || 0) - paid);
    }, 0);
    
    const handleConfirm = () => {
        onConfirmBulkPayment(paymentDate, paymentMethodId);
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
                            <label className="block text-sm font-medium text-gray-700">Metode Pembayaran</label>
                            <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md">
                                {paymentMethods.map(method => (
                                    <option key={method.id} value={method.id}>{method.name}</option>
                                ))}
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
  currentStartDate: string;
  today: string;
  expectedCash: number;
  periodNetChange: number;
  rawTodayMetrics: {
    rawCashInToday: number;
    rawCashOutToday: number;
    rawTransferInToday: number;
    rawTransferOutToday: number;
  };
  onClose: () => void;
  onSave: (
    amount: number,
    periodStartDate: string,
    notes?: string,
    settledOverride?: {
      rawCashInToday: number;
      rawCashOutToday: number;
      rawTransferInToday: number;
      rawTransferOutToday: number;
    }
  ) => void;
}> = ({ currentAmount, currentStartDate, today, expectedCash, periodNetChange, rawTodayMetrics, onClose, onSave }) => {
  const [amount, setAmount] = useState(currentAmount.toString());
  const [periodStartDate, setPeriodStartDate] = useState(currentStartDate);
  const [notes, setNotes] = useState('');
  const [syncToPhysicalNow, setSyncToPhysicalNow] = useState(false);

  const numericAmount = parseFloat(amount);
  const validAmount = !isNaN(numericAmount) && numericAmount >= 0 ? numericAmount : 0;

  const projectedEndingCash = syncToPhysicalNow
    ? validAmount
    : periodStartDate === currentStartDate
      ? validAmount + periodNetChange
      : validAmount;

  const handleToggleSyncNow = () => {
    setSyncToPhysicalNow(true);
    setPeriodStartDate(today);
    if (expectedCash < 0 || !amount.trim()) {
      setAmount('0');
    } else {
      setAmount(expectedCash.toString());
    }
    if (!notes.trim()) {
      setNotes(`Samakan saldo laci ke uang fisik real per ${formatDate(today)}`);
    }
  };

  const handleSave = () => {
    if (!isNaN(numericAmount) && numericAmount >= 0 && periodStartDate) {
      onSave(
        numericAmount,
        syncToPhysicalNow ? today : periodStartDate,
        notes.trim() || undefined,
        syncToPhysicalNow ? rawTodayMetrics : undefined
      );
      onClose();
    } else {
      alert('Masukkan jumlah kas awal / uang fisik dan tanggal mulai periode yang valid.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-800">Atur &amp; Koreksi Kas Laci</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="space-y-4">
          <div className={`p-3 rounded-lg border flex justify-between items-center text-sm ${
            expectedCash < 0 ? 'bg-red-50 border-red-300 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-800'
          }`}>
            <div>
              <p className="font-semibold">Kas Akhir (Laci) Sistem Saat Ini</p>
              <p className="text-xs opacity-80">Periode sejak {formatDate(currentStartDate)}</p>
            </div>
            <p className={`text-lg font-bold ${expectedCash < 0 ? 'text-red-700' : 'text-purple-700'}`}>
              {formatCurrency(expectedCash)}
            </p>
          </div>

          <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-sky-900">Koreksi Cepat Jika Laci Minus / Keliru</p>
              {!syncToPhysicalNow ? (
                <button
                  type="button"
                  onClick={handleToggleSyncNow}
                  className="px-3 py-1.5 text-xs font-bold bg-sky-600 text-white rounded-lg hover:bg-sky-700 shadow-sm"
                >
                  Samakan ke Saldo Fisik Sekarang
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSyncToPhysicalNow(false);
                    setAmount(currentAmount.toString());
                    setPeriodStartDate(currentStartDate);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-white text-gray-700 border rounded-md hover:bg-gray-100"
                >
                  Batal Mode Cepat (Ubah Manual)
                </button>
              )}
            </div>
            <p className="text-[11px] text-sky-800">
              {syncToPhysicalNow
                ? 'Mode Koreksi Cepat aktif: masukkan uang fisik yang benar-benar ada di laci saat ini. Transaksi sebelum jam koreksi hari ini otomatis di-offset tanpa menghapus riwayat pengeluaran/pembayaran lama.'
                : 'Klik tombol di atas jika laci terlanjur minus (misal baru mencatat pengeluaran lama) atau salah hitung, agar saldo laci langsung disamakan dengan uang fisik saat ini.'}
            </p>
          </div>

          <div>
            <label htmlFor="initial-cash" className="block text-sm font-medium text-gray-700">
              {syncToPhysicalNow ? 'Uang Fisik Real di Laci Saat Ini (Rp)' : 'Jumlah Kas Awal Laci (Rp)'}
            </label>
            <input
              type="number"
              id="initial-cash"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full p-2.5 border border-gray-300 rounded-md font-semibold"
              placeholder="e.g., 200000"
            />
          </div>
          <div>
            <label htmlFor="period-start-date" className="block text-sm font-medium text-gray-700">Mulai Hitung Akumulasi Dari Tanggal</label>
            <input
              type="date"
              id="period-start-date"
              value={syncToPhysicalNow ? today : periodStartDate}
              max={getLocalDateString()}
              disabled={syncToPhysicalNow}
              onChange={(e) => setPeriodStartDate(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              {syncToPhysicalNow
                ? 'Otomatis memakai tanggal hari ini karena mode Samakan ke Saldo Fisik Sekarang sedang aktif.'
                : 'Ubah tanggal ini jika ingin menghitung ulang akumulasi beberapa hari terakhir yang belum disetor.'}
            </p>
          </div>
          <div>
            <label htmlFor="initial-cash-notes" className="block text-sm font-medium text-gray-700">Keterangan (Opsional)</label>
            <input
              type="text"
              id="initial-cash-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
              placeholder="Contoh: Tambah pecahan kembalian / koreksi saldo fisik laci"
            />
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex justify-between items-center text-xs">
            <span className="font-semibold text-purple-900">Preview Kas Akhir (Laci) Setelah Disimpan:</span>
            <span className={`text-base font-bold ${projectedEndingCash < 0 ? 'text-red-600' : 'text-purple-700'}`}>
              {formatCurrency(projectedEndingCash)}
            </span>
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

// --- START: SETOR KE OWNER MODAL ---
const DepositCashModal: React.FC<{
  periodStartDate: string;
  today: string;
  openingCash: number;
  cashInPeriod: number;
  cashOutPeriod: number;
  cashTransferNetPeriod: number;
  expectedCash: number;
  nonCashTotal: number;
  cashBreakdown: Record<string, number>;
  nonCashBreakdown: Record<string, number>;
  nonCashAccounts: PaymentMethod[];
  currentUserName?: string;
  onClose: () => void;
  onConfirmSetor: (payload: {
    depositAmount: number;
    physicalCash?: number;
    recipient: string;
    depositMode: 'owner_hold' | 'bank_account' | 'owner_prive';
    depositToAccountId?: string;
    depositToAccountName?: string;
    notes?: string;
  }) => Promise<void>;
}> = ({
  periodStartDate,
  today,
  openingCash,
  cashInPeriod,
  cashOutPeriod,
  cashTransferNetPeriod,
  expectedCash,
  nonCashTotal,
  nonCashBreakdown,
  nonCashAccounts,
  currentUserName,
  onClose,
  onConfirmSetor,
}) => {
  const [physicalCashInput, setPhysicalCashInput] = useState('');
  const [depositAmountInput, setDepositAmountInput] = useState(Math.max(0, expectedCash).toString());
  const [recipient, setRecipient] = useState('Owner');
  const [depositMode, setDepositMode] = useState<'owner_hold' | 'bank_account' | 'owner_prive'>('owner_hold');
  const [depositToAccountId, setDepositToAccountId] = useState(nonCashAccounts[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPhysicalCash = physicalCashInput.trim() !== '' && !isNaN(parseFloat(physicalCashInput));
  const physicalCash = hasPhysicalCash ? parseFloat(physicalCashInput) : undefined;
  const discrepancy = physicalCash !== undefined ? physicalCash - expectedCash : undefined;

  const baseCashInDrawer = physicalCash !== undefined ? physicalCash : expectedCash;
  const depositAmount = parseFloat(depositAmountInput) || 0;
  const remainingCash = baseCashInDrawer - depositAmount;

  const handleQuickLeave = (keepAmount: number) => {
    const suggested = Math.max(0, baseCashInDrawer - keepAmount);
    setDepositAmountInput(suggested.toString());
  };

  const handleSubmit = async () => {
    if (isNaN(depositAmount) || depositAmount < 0) {
      alert('Nominal setor tidak valid.');
      return;
    }
    if (remainingCash < 0) {
      alert('Nominal setor melebihi saldo kas yang tersedia di laci.');
      return;
    }
    if (!recipient.trim()) {
      alert('Nama penerima setor harus diisi.');
      return;
    }
    if (depositMode === 'bank_account' && !depositToAccountId) {
      alert('Pilih rekening bank tujuan setoran.');
      return;
    }
    const destAccount = depositMode === 'bank_account'
      ? nonCashAccounts.find(a => a.id === depositToAccountId)
      : undefined;
    setIsSubmitting(true);
    try {
      await onConfirmSetor({
        depositAmount,
        physicalCash,
        recipient: recipient.trim(),
        depositMode,
        depositToAccountId: depositMode === 'owner_hold'
          ? OWNER_HOLD_ACCOUNT_ID
          : destAccount?.id,
        depositToAccountName: depositMode === 'owner_hold'
          ? OWNER_HOLD_ACCOUNT_NAME
          : destAccount?.name,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Setor Dana Kas Laci</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Periode akumulasi: <strong>{formatDate(periodStartDate)}</strong> s/d <strong>{formatDate(today)}</strong>
              {currentUserName ? ` • Operator: ${currentUserName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* System Breakdown */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Kas Awal Periode</span>
              <span className="font-semibold">{formatCurrency(openingCash)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>(+) Pemasukan Tunai Masuk Laci</span>
              <span className="font-semibold">+ {formatCurrency(cashInPeriod)}</span>
            </div>
            <div className="flex justify-between text-rose-700">
              <span>(-) Pengeluaran dari Kas Laci</span>
              <span className="font-semibold">- {formatCurrency(cashOutPeriod)}</span>
            </div>
            {cashTransferNetPeriod !== 0 && (
              <div className={`flex justify-between ${cashTransferNetPeriod >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                <span>({cashTransferNetPeriod >= 0 ? '+' : '-'}) Mutasi Laci / Pindah Akun</span>
                <span className="font-semibold">
                  {cashTransferNetPeriod >= 0 ? `+ ${formatCurrency(cashTransferNetPeriod)}` : `- ${formatCurrency(Math.abs(cashTransferNetPeriod))}`}
                </span>
              </div>
            )}
            <div className="border-t border-purple-200 pt-2 flex justify-between items-center">
              <span className="font-bold text-purple-900">Saldo Seharusnya di Laci (Sistem)</span>
              <span className="text-xl font-bold text-purple-700">{formatCurrency(expectedCash)}</span>
            </div>
          </div>

          {nonCashTotal > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900">
              <div className="flex justify-between font-semibold mb-1">
                <span>Info Pemasukan Non-Tunai Periode Ini (Tidak Masuk Laci Fisik):</span>
                <span>{formatCurrency(nonCashTotal)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-sky-700">
                {Object.entries(nonCashBreakdown).map(([name, amt]) => (
                  <span key={name} className="bg-white/80 px-2 py-0.5 rounded border border-sky-200">
                    {name}: <strong>{formatCurrency(amt as number)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Physical Cash Count */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Hitung Uang Fisik di Laci (Opsional)
              </label>
              <input
                type="number"
                value={physicalCashInput}
                onChange={(e) => setPhysicalCashInput(e.target.value)}
                placeholder={`Default sistem: ${expectedCash}`}
                className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-pink-500 focus:border-pink-500"
              />
              <p className="text-xs text-gray-500 mt-1">Isi jika ingin mencatat selisih kas fisik vs sistem.</p>
            </div>

            <div className="flex flex-col justify-center">
              {discrepancy !== undefined ? (
                <div className={`p-3 rounded-lg border text-sm ${
                  discrepancy === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : discrepancy > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <p className="text-xs font-medium">Selisih (Fisik - Sistem)</p>
                  <p className="text-lg font-bold">
                    {discrepancy === 0
                      ? 'Cocok (Rp 0)'
                      : `${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy)}`}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600">
                  Tanpa input uang fisik, sistem menganggap uang fisik sesuai saldo sistem ({formatCurrency(expectedCash)}).
                </div>
              )}
            </div>
          </div>

          {/* Deposit Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nominal Dana Disetor (Rp)</label>
            <input
              type="number"
              value={depositAmountInput}
              onChange={(e) => setDepositAmountInput(e.target.value)}
              className="mt-1 w-full p-2.5 border border-gray-300 rounded-lg text-lg font-bold text-gray-800 focus:ring-pink-500 focus:border-pink-500"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" onClick={() => handleQuickLeave(0)} className="px-2.5 py-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border">
                Setor Semua
              </button>
              <button type="button" onClick={() => handleQuickLeave(100000)} className="px-2.5 py-1 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-md border border-pink-200">
                Sisakan Rp 100.000
              </button>
              <button type="button" onClick={() => handleQuickLeave(200000)} className="px-2.5 py-1 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-md border border-pink-200">
                Sisakan Rp 200.000
              </button>
              <button type="button" onClick={() => handleQuickLeave(500000)} className="px-2.5 py-1 text-xs font-semibold bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-md border border-pink-200">
                Sisakan Rp 500.000
              </button>
            </div>
          </div>

          <div className={`p-3 rounded-lg border flex justify-between items-center ${remainingCash < 0 ? 'bg-red-50 border-red-300 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            <div>
              <p className="text-sm font-semibold">Sisa Uang di Laci (Menjadi Kas Awal Periode Baru)</p>
              <p className="text-xs opacity-80">Uang kembalian/modal yang tetap tinggal di laci kasir.</p>
            </div>
            <p className="text-xl font-bold">{formatCurrency(remainingCash)}</p>
          </div>

          {/* Deposit Purpose / Destination */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Tujuan / Status Dana Disetor</label>
            <div className="grid grid-cols-1 gap-2">
              <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                depositMode === 'owner_hold' ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-300' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="depositMode"
                  checked={depositMode === 'owner_hold'}
                  onChange={() => setDepositMode('owner_hold')}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">Dibawa / Titip Owner (Masih Uang Toko)</div>
                  <p className="text-gray-600 mt-0.5">
                    Uang sementara dibawa/disimpan owner atau brankas. Saldo berpindah ke kantong <strong>Kas Dipegang Owner</strong> — tetap aset toko (tidak memotong Saldo Usaha) &amp; bisa dipindah ke Rekening Bank kapan saja tanpa menjadi dana talangan.
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                depositMode === 'bank_account' ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="depositMode"
                  checked={depositMode === 'bank_account'}
                  onChange={() => setDepositMode('bank_account')}
                  className="mt-0.5 text-sky-600 focus:ring-sky-500"
                />
                <div className="text-xs flex-1">
                  <div className="font-bold text-gray-900">Langsung Setor ke Rekening Bank Toko</div>
                  <p className="text-gray-600 mt-0.5">
                    Uang laci langsung masuk menambah saldo rekening bank toko di Arus Kas.
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                depositMode === 'owner_prive' ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-300' : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="radio"
                  name="depositMode"
                  checked={depositMode === 'owner_prive'}
                  onChange={() => setDepositMode('owner_prive')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-gray-900">Diambil Permanen Owner (Prive / Keluar Usaha)</div>
                  <p className="text-gray-600 mt-0.5">
                    Uang diambil permanen oleh owner untuk keperluan pribadi. Akan memotong total Saldo Akhir Kas Usaha.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Disetor Kepada</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                placeholder="Owner / Admin Keuangan"
              />
            </div>
            {depositMode === 'bank_account' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Pilih Rekening Bank Tujuan</label>
                <select
                  value={depositToAccountId}
                  onChange={(e) => setDepositToAccountId(e.target.value)}
                  className="mt-1 w-full p-2 border border-sky-300 rounded-md bg-sky-50/40 text-sm"
                >
                  {nonCashAccounts.length === 0 && <option value="">Belum ada rekening non-tunai</option>}
                  {nonCashAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Catatan Setoran (Opsional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                  placeholder={depositMode === 'owner_hold' ? 'Contoh: Dibawa owner malam ini, besok setor BCA' : 'Contoh: Prive owner'}
                />
              </div>
            )}
          </div>
          {depositMode === 'bank_account' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Catatan Setoran (Opsional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                placeholder="Contoh: Setoran laci 4 hari / setor tunai ke BCA"
              />
            </div>
          )}
        </div>

        <div className="border-t pt-4 mt-5 flex justify-end space-x-3">
          <button onClick={onClose} disabled={isSubmitting} className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || remainingCash < 0 || depositAmount < 0}
            className="bg-purple-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-purple-700 disabled:bg-purple-300"
          >
            {isSubmitting ? 'Menyimpan...' : `Konfirmasi Setor (${formatCurrency(depositAmount)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
// --- END: SETOR KE OWNER MODAL ---

// --- START: CASH DRAWER HISTORY MODAL ---
const CashDrawerHistoryModal: React.FC<{
  logs: CashDrawerLog[];
  onClose: () => void;
  onDeleteLog: (logId: string) => Promise<void>;
}> = ({ logs, onClose, onDeleteLog }) => {
  const [filterType, setFilterType] = useState<'Semua' | 'Setor' | 'Penyesuaian Kas Awal'>('Semua');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter(l => filterType === 'Semua' || l.type === filterType);
  }, [logs, filterType]);

  const summary = useMemo(() => {
    const setorLogs = filteredLogs.filter(l => l.type === 'Setor');
    return {
      totalDeposited: setorLogs.reduce((s, l) => s + l.depositAmount, 0),
      totalDiscrepancy: setorLogs.reduce((s, l) => s + (l.discrepancy || 0), 0),
      countSetor: setorLogs.length,
    };
  }, [filteredLogs]);

  const handleDeleteClick = async (e: React.MouseEvent, log: CashDrawerLog) => {
    e.stopPropagation();
    const isLatest = logs[0]?.id === log.id;
    const msg = isLatest
      ? `Batalkan log terbaru (${log.type} - ${formatDateTime(log.timestamp)}) dan kembalikan posisi Kas Akhir (Laci) ke kondisi sebelumnya?`
      : `Hapus catatan riwayat (${log.type} - ${formatDateTime(log.timestamp)}) ini?`;
    if (window.confirm(msg)) {
      await onDeleteLog(log.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Log Kas Laci & Riwayat Setoran</h3>
            <p className="text-xs text-gray-500 mt-0.5">Rekam jejak setor dana (titipan owner / bank / prive) dan penyesuaian kas awal periode.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-xs text-purple-700">Total Disetor</p>
            <p className="text-lg font-bold text-purple-800">{formatCurrency(summary.totalDeposited)}</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">Frekuensi Setor</p>
            <p className="text-lg font-bold text-blue-800">{summary.countSetor} Kali</p>
          </div>
          <div className={`p-3 border rounded-lg ${summary.totalDiscrepancy === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
            <p className="text-xs">Akumulasi Selisih Fisik</p>
            <p className="text-lg font-bold">{summary.totalDiscrepancy >= 0 ? `+${formatCurrency(summary.totalDiscrepancy)}` : formatCurrency(summary.totalDiscrepancy)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="flex space-x-2">
            {(['Semua', 'Setor', 'Penyesuaian Kas Awal'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  filterType === t ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-500">Menampilkan {filteredLogs.length} catatan</span>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-lg">
          {filteredLogs.length > 0 ? (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Waktu</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Tipe & Periode</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600">Saldo Sistem</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600">Disetor</th>
                  <th className="py-2.5 px-3 text-right text-xs font-semibold text-gray-600">Sisa Laci</th>
                  <th className="py-2.5 px-3 text-left text-xs font-semibold text-gray-600">Selisih / Penerima</th>
                  <th className="py-2.5 px-3 text-center text-xs font-semibold text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredLogs.map(log => {
                  const isExpanded = expandedId === log.id;
                  const isLatest = logs[0]?.id === log.id;
                  const isOwnerHold = log.depositMode === 'owner_hold' || log.depositToAccountId === OWNER_HOLD_ACCOUNT_ID;
                  const isBank = (log.depositMode === 'bank_account') || (!isOwnerHold && !!log.depositToAccountId);
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs text-gray-700">
                          <div className="font-semibold">{formatDateTime(log.timestamp)}</div>
                          {log.operator && <div className="text-gray-400">Oleh: {log.operator}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                            log.type === 'Setor' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {log.type}
                          </span>
                          <div className="text-gray-500 mt-1">
                            {formatDate(log.periodStartDate)} – {formatDate(log.periodEndDate)}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap text-xs">
                          <div className="font-semibold text-gray-800">{formatCurrency(log.expectedCash)}</div>
                          {log.physicalCash !== undefined && (
                            <div className="text-gray-500">Fisik: {formatCurrency(log.physicalCash)}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-purple-700">
                          {log.type === 'Setor' ? formatCurrency(log.depositAmount) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-gray-700">
                          {formatCurrency(log.remainingCash)}
                        </td>
                        <td className="py-2.5 px-3 text-xs">
                          {log.type === 'Setor' ? (
                            <>
                              <div className="font-medium text-gray-700">
                                Ke: {log.recipient || 'Owner'}
                                {isOwnerHold ? (
                                  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-semibold">
                                    Titipan Owner (Uang Toko)
                                  </span>
                                ) : isBank && log.depositToAccountName ? (
                                  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-semibold">
                                    → {log.depositToAccountName}
                                  </span>
                                ) : (
                                  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-semibold">
                                    Prive / Keluar Usaha
                                  </span>
                                )}
                              </div>
                              {log.discrepancy !== undefined && log.discrepancy !== 0 && (
                                <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                  log.discrepancy > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  Selisih: {log.discrepancy > 0 ? '+' : ''}{formatCurrency(log.discrepancy)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-600">{log.notes || 'Penyesuaian kas awal'}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, log)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title={isLatest ? 'Batalkan Log Terbaru & Pulihkan Laci' : 'Hapus Catatan Log'}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-4 py-3 text-xs text-gray-700 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div>Kas Awal: <strong>{formatCurrency(log.openingCash)}</strong></div>
                              <div>Tunai Masuk: <strong className="text-emerald-700">+{formatCurrency(log.cashInTotal)}</strong></div>
                              <div>Keluar Laci: <strong className="text-rose-700">-{formatCurrency(log.cashOutTotal)}</strong></div>
                              <div>Non-Tunai: <strong className="text-sky-700">{formatCurrency(log.nonCashTotal)}</strong></div>
                            </div>
                            {log.notes && <p className="text-gray-600">Catatan: <em>{log.notes}</em></p>}
                            {log.breakdownByMethod && Object.keys(log.breakdownByMethod).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {Object.entries(log.breakdownByMethod).map(([m, a]) => (
                                  <span key={m} className="bg-white border px-2 py-0.5 rounded text-[11px]">
                                    {m}: <strong>{formatCurrency(a as number)}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500 text-sm">Belum ada log kas atau riwayat setoran.</div>
          )}
        </div>
      </div>
    </div>
  );
};
// --- END: CASH DRAWER HISTORY MODAL ---

// --- START: NEW SUMMARY MODAL ---
const SummaryInfoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'payments' | 'receivables' | 'expenses' | 'finalCash' | 'initialCashInfo';
  onOpenSetor?: () => void;
  onOpenHistory?: () => void;
  onOpenInitialCash?: () => void;
  data: {
    payments?: { customer: string, orderId: string, methodName: string, amount: number, isCash?: boolean }[];
    receivables?: (ReceivableItem & { remaining: number })[];
    expenses?: ExpenseItem[];
    finalCashBreakdown?: { [key: string]: number };
    nonCashBreakdown?: { [key: string]: number };
    finalCashTotal?: number;
    openingCash?: number;
    cashInPeriod?: number;
    cashOutPeriod?: number;
    cashTransferNetPeriod?: number;
    nonCashTotal?: number;
    periodStartDate?: string;
    periodEndDate?: string;
  };
}> = ({ isOpen, onClose, title, type, data, onOpenSetor, onOpenHistory, onOpenInitialCash }) => {
  if (!isOpen) return null;

  const renderContent = () => {
    switch(type) {
      case 'initialCashInfo':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded-r-lg">
              <p className="font-semibold">Informasi Kas Awal Periode Laci</p>
              <p className="text-sm mt-1">
                Kas Awal sebesar <strong>{formatCurrency(data.openingCash || 0)}</strong> adalah modal/sisa kas di laci sejak tanggal{' '}
                <strong>{data.periodStartDate ? formatDate(data.periodStartDate) : '-'}</strong>. Nilai ini akan terus berakumulasi dengan transaksi tunai harian sampai Anda menekan tombol <strong>Setor Dana</strong>.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              {onOpenHistory && (
                <button onClick={() => { onClose(); onOpenHistory(); }} className="px-4 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">
                  Lihat Log Kas & Setoran
                </button>
              )}
              {onOpenInitialCash && (
                <button onClick={() => { onClose(); onOpenInitialCash(); }} className="px-4 py-2 text-sm font-semibold bg-pink-600 hover:bg-pink-700 text-white rounded-lg">
                  Ubah Kas Awal
                </button>
              )}
            </div>
          </div>
        );
      case 'payments':
        return (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left">Pelanggan</th><th className="py-2 px-3 text-left">No Nota</th><th className="py-2 px-3 text-left">Sumber Dana</th><th className="py-2 px-3 text-right">Nominal</th></tr></thead>
            <tbody className="divide-y">{data.payments?.map((p, i) => (
              <tr key={i}>
                <td className="py-2 px-3">{p.customer}</td>
                <td className="py-2 px-3">{p.orderId}</td>
                <td className="py-2 px-3">
                  <span>{p.methodName}</span>
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${p.isCash ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                    {p.isCash ? 'Tunai (Laci)' : 'Non-Tunai'}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">{formatCurrency(p.amount)}</td>
              </tr>
            ))}</tbody>
          </table>
        );
      case 'receivables':
        return (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left">Pelanggan</th><th className="py-2 px-3 text-left">No Nota</th><th className="py-2 px-3 text-left">Status Produksi</th><th className="py-2 px-3 text-right">Sisa Tagihan</th></tr></thead>
            <tbody className="divide-y">{data.receivables?.map(r => (<tr key={r.id}><td className="py-2 px-3">{r.customer}</td><td className="py-2 px-3">{r.id}</td><td className="py-2 px-3">{r.productionStatus}</td><td className="py-2 px-3 text-right">{formatCurrency(Number(r.remaining))}</td></tr>))}</tbody>
          </table>
        );
      case 'expenses':
        return data.expenses && data.expenses.length > 0 ? (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left">Nama</th><th className="py-2 px-3 text-left">Kategori</th><th className="py-2 px-3 text-right">Jumlah</th></tr></thead>
            <tbody className="divide-y">{data.expenses.map(e => (<tr key={e.id}><td className="py-2 px-3">{e.name}</td><td className="py-2 px-3">{e.category}</td><td className="py-2 px-3 text-right">{formatCurrency(e.amount)}</td></tr>))}</tbody>
          </table>
        ) : <p className="text-center text-gray-500 py-8 text-sm">Belum ada pengeluaran dari Kas Laci hari ini.</p>;
      case 'finalCash':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-br from-fuchsia-50 to-purple-50 border border-purple-200 rounded-xl text-center">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                Akumulasi Periode: {data.periodStartDate ? formatDate(data.periodStartDate) : '-'} s/d {data.periodEndDate ? formatDate(data.periodEndDate) : '-'}
              </p>
              <p className="text-3xl font-bold text-purple-700 mt-1">{formatCurrency(data.finalCashTotal || 0)}</p>
              <p className="text-xs text-purple-600 mt-1">Uang Tunai Seharusnya Ada di Laci Saat Ini</p>
            </div>

            <div className="bg-gray-50 border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Kas Awal / Sisa Setoran Sebelumnya</span>
                <span className="font-semibold text-gray-800">{formatCurrency(data.openingCash || 0)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>(+) Pemasukan Tunai Masuk Laci (Periode)</span>
                <span className="font-semibold">+ {formatCurrency(data.cashInPeriod || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>(-) Pengeluaran dari Kas Laci (Periode)</span>
                <span className="font-semibold">- {formatCurrency(data.cashOutPeriod || 0)}</span>
              </div>
              {(data.cashTransferNetPeriod || 0) !== 0 && (
                <div className={`flex justify-between ${(data.cashTransferNetPeriod || 0) >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                  <span>({(data.cashTransferNetPeriod || 0) >= 0 ? '+' : '-'}) Mutasi Laci / Pindah Akun</span>
                  <span className="font-semibold">
                    {(data.cashTransferNetPeriod || 0) >= 0
                      ? `+ ${formatCurrency(data.cashTransferNetPeriod || 0)}`
                      : `- ${formatCurrency(Math.abs(data.cashTransferNetPeriod || 0))}`}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                <span>Total Kas Akhir Laci</span>
                <span>{formatCurrency(data.finalCashTotal || 0)}</span>
              </div>
            </div>

            {data.finalCashBreakdown && Object.keys(data.finalCashBreakdown).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-sm text-gray-700">Rincian Tunai Masuk (Periode Ini):</h4>
                <div className="space-y-1.5">
                  {Object.entries(data.finalCashBreakdown).map(([method, amount]) => (
                    <div key={method} className="flex justify-between text-sm p-2 bg-emerald-50/60 border border-emerald-100 rounded-md">
                      <span className="text-gray-700">{method}</span>
                      <span className="font-semibold text-emerald-800">{formatCurrency(amount as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2 text-sm text-gray-700">
                Pemasukan Non-Tunai Periode Ini (Masuk Rekening / QRIS, Tidak ke Laci):
              </h4>
              {data.nonCashBreakdown && Object.keys(data.nonCashBreakdown).length > 0 ? (
                <div className="space-y-1.5">
                  {Object.entries(data.nonCashBreakdown).map(([method, amount]) => (
                    <div key={method} className="flex justify-between text-sm p-2 bg-sky-50 border border-sky-100 rounded-md">
                      <span className="text-sky-900">{method}</span>
                      <span className="font-semibold text-sky-800">{formatCurrency(amount as number)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold text-sky-900 px-2 pt-1">
                    <span>Total Non-Tunai Periode Ini</span>
                    <span>{formatCurrency(data.nonCashTotal || 0)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Belum ada pembayaran Non-Tunai pada periode ini.</p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              {onOpenHistory && (
                <button
                  onClick={() => { onClose(); onOpenHistory(); }}
                  className="px-4 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  Log Kas & Setoran
                </button>
              )}
              {onOpenSetor && (
                <button
                  onClick={() => { onClose(); onOpenSetor(); }}
                  className="px-4 py-2 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  Setor Dana
                </button>
              )}
            </div>
          </div>
        );
      default:
        return <p>Tidak ada data untuk ditampilkan.</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
// --- END: NEW SUMMARY MODAL ---

// --- START: RECEIVABLES NOTIFICATION POPUP ---
const ReceivablesNotificationPopup: React.FC<{ 
    notifications: NotificationItem[];
    onDismiss: (id: string) => void;
    onClosePopup: () => void;
}> = ({ notifications, onDismiss, onClosePopup }) => {
    
    const timeAgo = (isoDate: string) => {
        const seconds = Math.floor((new Date().getTime() - new Date(isoDate).getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " tahun lalu";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " bulan lalu";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " hari lalu";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " jam lalu";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " menit lalu";
        return "Baru saja";
    };
    
    return (
    <div 
        className="absolute top-full right-0 mt-2 w-80 max-w-sm bg-white rounded-lg shadow-lg border z-50"
        aria-label="Notification Popup"
    >
        <div className="p-3 border-b">
            <h3 className="font-semibold text-gray-800">Notifikasi Piutang</h3>
        </div>
        <div className="py-2 max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
                notifications.map(item => (
                    <div 
                        key={item.id} 
                        className="px-3 py-1"
                    >
                        <div className={`flex items-start p-2 rounded-md relative group`}>
                            <div className="flex-shrink-0 mt-1">{item.icon}</div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm text-gray-700 leading-tight">{item.text}</p>
                                <p className="text-xs text-gray-500 mt-1">{timeAgo(item.time)}</p>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss(item.id);
                                }} 
                                className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-lg" 
                                aria-label="Tutup notifikasi"
                            >
                                &times;
                            </button>
                        </div>
                    </div>
                ))
            ) : (
                <div className="text-center py-10 text-gray-500">
                    <p>Tidak ada notifikasi piutang.</p>
                </div>
            )}
        </div>
    </div>
)};
// --- END: RECEIVABLES NOTIFICATION POPUP ---

const BulkDueDateModal: React.FC<{
  itemCount: number;
  onClose: () => void;
  onConfirm: (newDueDate: string) => void;
}> = ({ itemCount, onClose, onConfirm }) => {
    const [newDueDate, setNewDueDate] = useState(getLocalDateString());

    const handleConfirm = () => {
        onConfirm(newDueDate);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h3 className="text-xl font-bold text-gray-800">Ubah Jatuh Tempo Massal</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
                </div>

                <div className="space-y-4">
                    <p>Anda akan mengubah tanggal jatuh tempo untuk <strong>{itemCount} nota</strong> yang belum lunas (sesuai filter).</p>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Tanggal Jatuh Tempo Baru</label>
                        <input 
                            type="date" 
                            value={newDueDate} 
                            onChange={e => setNewDueDate(e.target.value)} 
                            className="mt-1 w-full p-2 border rounded-md" 
                        />
                    </div>
                </div>

                <div className="border-t pt-4 mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300">Batal</button>
                    <button onClick={handleConfirm} className="bg-pink-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-700">
                        Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    );
};


interface ReceivablesProps {
  receivables: ReceivableItem[];
  unprocessedOrders: SavedOrder[];
  allOrders: SavedOrder[];
  boardData: KanbanData;
  products: ProductData[];
  finishings: FinishingData[];
  customers: CustomerData[];
  categories: CategoryData[];
  expenses: ExpenseItem[];
  expenseMetadata?: Record<number, ExpenseMetadata>;
  supplierBills?: SupplierBill[];
  bankInstallments?: BankInstallment[];
  privateExpenses?: PrivateExpenseItem[];
  initialCash: number;
  cashDrawerState: CashDrawerState;
  cashDrawerLogs: CashDrawerLog[];
  cashTransfers?: CashTransferRecord[];
  currentUserName?: string;
  paymentMethods: PaymentMethod[];
  onUpdateInitialCash: (amount: number) => void;
  onUpdateCashDrawerInitial: (
    amount: number,
    periodStartDate?: string,
    notes?: string,
    settledOverride?: {
      rawCashInToday: number;
      rawCashOutToday: number;
      rawTransferInToday: number;
      rawTransferOutToday: number;
    }
  ) => Promise<void>;
  onSetorCash: (payload: {
    depositAmount: number;
    physicalCash?: number;
    recipient: string;
    depositMode?: 'owner_hold' | 'bank_account' | 'owner_prive';
    depositToAccountId?: string;
    depositToAccountName?: string;
    notes?: string;
    summary: {
      periodStartDate: string;
      periodEndDate: string;
      openingCash: number;
      cashInTotal: number;
      cashOutTotal: number;
      nonCashTotal: number;
      expectedCash: number;
      rawCashInToday: number;
      rawCashOutToday: number;
      rawTransferInToday: number;
      rawTransferOutToday: number;
      breakdownByMethod: Record<string, number>;
    };
  }) => Promise<void>;
  onDeleteCashDrawerLog: (logId: string) => Promise<void>;
  onProcessPayment: (orderId: string, paymentDetails: Payment, newDiscount?: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => void;
  onPayUnprocessedOrder: (orderId: string, paymentDetails: Payment, newDiscount: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => void;
  onBulkProcessPayment: (orderIds: string[], paymentDate: string, paymentMethodId: string) => void;
  onUpdateDueDate: (orderId: string, newDueDate: string) => void;
  onBulkUpdateDueDate: (orderIds: string[], newDueDate: string) => void;
  notificationSettings: NotificationSettings;
  legacyReceivables: LegacyReceivable[];
  onPayLegacyReceivable: (legacyItem: LegacyReceivable, paymentDetails: Payment, newDiscount: number) => void;
}

const priceLevelMap: Record<CustomerData['level'], keyof ProductData['price']> = {
    'End Customer': 'endCustomer',
    'Retail': 'retail',
    'Grosir': 'grosir',
    'Reseller': 'reseller',
    'Corporate': 'corporate'
};


const Receivables: React.FC<ReceivablesProps> = ({ 
    receivables, unprocessedOrders, allOrders, boardData, products, finishings, customers, categories, expenses, expenseMetadata = {}, supplierBills = [], bankInstallments = [], privateExpenses = [], initialCash, cashDrawerState, cashDrawerLogs, cashTransfers = [], currentUserName, paymentMethods,
    onProcessPayment, onPayUnprocessedOrder, onBulkProcessPayment, onUpdateInitialCash, onUpdateCashDrawerInitial, onSetorCash, onDeleteCashDrawerLog, onUpdateDueDate, onBulkUpdateDueDate, notificationSettings,
    legacyReceivables, onPayLegacyReceivable
}) => {
  const [modalData, setModalData] = useState<{ title: string; orders: CardData[] } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DisplayReceivable | null>(null);
  const [actionsMenu, setActionsMenu] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(true);
  const [isBulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [isInitialCashModalOpen, setInitialCashModalOpen] = useState(false);
  const [isSetorModalOpen, setSetorModalOpen] = useState(false);
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
  const [isBulkDueDateModalOpen, setBulkDueDateModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [summaryModal, setSummaryModal] = useState<{
    type: 'payments' | 'receivables' | 'expenses' | 'finalCash' | 'initialCashInfo' | null;
    title: string;
  }>({ type: null, title: '' });
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  
  // States for local notifications
  const [receivableNotifications, setReceivableNotifications] = useState<NotificationItem[]>([]);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [copyToast, setCopyToast] = useState<{ message: string; phone?: string; customer?: string } | null>(null);

  // Default filter: 30 hari terakhir & status Belum Lunas
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return getLocalDateString(d);
  }, []);

  // Filter states: Default 30 hari terakhir dan status Belum Lunas
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Belum Lunas');
  const [filterStartDate, setFilterStartDate] = useState(defaultStartDate);
  const [filterEndDate, setFilterEndDate] = useState('');

  // Indexed Map untuk lookup order secara instan O(1) tanpa perulangan linier 15.000 data
  const ordersMap = useMemo(() => {
    const map = new Map<string, SavedOrder>();
    for (let i = 0; i < allOrders.length; i++) {
      map.set(allOrders[i].id, allOrders[i]);
    }
    return map;
  }, [allOrders]);

  const allDisplayItems: DisplayReceivable[] = useMemo(() => {
    const processedItems: DisplayReceivable[] = receivables.map(r => ({ ...r, isUnprocessed: false, isLegacy: false }));
    const receivableIds = new Set(receivables.map(r => r.id));

    const unprocessedOnlyItems: DisplayReceivable[] = unprocessedOrders
        .filter(order => !receivableIds.has(order.id))
        .map(order => ({
            id: order.id,
            customer: order.customer,
            amount: order.totalPrice,
            due: order.orderDate,
            paymentStatus: 'Belum Lunas',
            productionStatus: 'Dalam Antrian',
            payments: [],
            discount: 0,
            isUnprocessed: true,
            isLegacy: false,
        }));

    const legacyItems: DisplayReceivable[] = legacyReceivables.map(legacy => ({
        id: `legacy-${legacy.nota_id}`, // Use custom nota_id for display ID
        customer: legacy.customer,
        amount: legacy.amount,
        due: legacy.order_date,
        paymentStatus: 'Belum Lunas',
        productionStatus: 'Data Lama',
        payments: [],
        discount: 0,
        isUnprocessed: false,
        isLegacy: true,
        legacyData: legacy,
    }));

    return [...processedItems, ...unprocessedOnlyItems, ...legacyItems];
  }, [receivables, unprocessedOrders, legacyReceivables]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSearch, filterCustomer, filterStatus, filterStartDate, filterEndDate]);

  const uniqueCustomers = useMemo(() => {
    const customerSet = new Set(allDisplayItems.map(r => r.customer));
    return Array.from(customerSet);
  }, [allDisplayItems]);

  const filteredItems = useMemo(() => {
    const lowerCaseSearch = filterSearch.trim().toLowerCase();

    return allDisplayItems.filter(item => {
      // Lookup O(1) cepat menggunakan Map
      const order = ordersMap.get(item.id);
      const orderDate = item.isLegacy ? item.legacyData?.order_date : (order?.orderDate || item.due);

      if (lowerCaseSearch && !item.id.toLowerCase().includes(lowerCaseSearch) && !item.customer.toLowerCase().includes(lowerCaseSearch)) {
        return false;
      }
      if (filterCustomer && item.customer !== filterCustomer) {
        return false;
      }
      if (filterStatus && item.paymentStatus !== filterStatus) {
        return false;
      }
      if (filterStartDate && orderDate && orderDate < filterStartDate) {
        return false;
      }
      if (filterEndDate && orderDate && orderDate > filterEndDate) {
        return false;
      }
      return true;
    }).sort((a, b) => {
        // Primary sort: non-legacy items first
        if (a.isLegacy && !b.isLegacy) return 1;
        if (!a.isLegacy && b.isLegacy) return -1;
        
        // Secondary sort: by ID (nota number) descending
        const idA = a.isLegacy ? a.legacyData!.id.toString() : a.id;
        const idB = b.isLegacy ? b.legacyData!.id.toString() : b.id;
        return idB.localeCompare(idA, undefined, { numeric: true });
    });
  }, [allDisplayItems, ordersMap, filterSearch, filterCustomer, filterStatus, filterStartDate, filterEndDate]);
  
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const unpaidFilteredItems = useMemo(() => {
    return filteredItems.filter(r => r.paymentStatus === 'Belum Lunas');
  }, [filteredItems]);
  
  const handleResetFilters = () => {
    setFilterSearch('');
    setFilterCustomer('');
    setFilterStatus('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const handleDefaultFilters = () => {
    setFilterSearch('');
    setFilterCustomer('');
    setFilterStatus('Belum Lunas');
    setFilterStartDate(defaultStartDate);
    setFilterEndDate('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenu(null);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Notification Generation for Receivables ---
  useEffect(() => {
    const generateNotifications = () => {
        const newNotifications: NotificationItem[] = [];
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        receivables.forEach(r => {
            if (r.paymentStatus === 'Belum Lunas') {
                const dueDate = new Date(r.due);
                dueDate.setHours(0, 0, 0, 0);
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (notificationSettings.receivableOverdueAlert && diffDays < 0) {
                     newNotifications.push({
                        id: `overdue-${r.id}`,
                        icon: <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />,
                        text: `Piutang '${r.customer}' (${r.id}) telah jatuh tempo.`,
                        time: now.toISOString(),
                        type: 'warning',
                    });
                } 
                else if (notificationSettings.receivableDueSoonAlert && diffDays >= 0 && diffDays <= notificationSettings.receivableDueSoonDays) {
                    newNotifications.push({
                        id: `due-soon-${r.id}`,
                        icon: <CreditCardIcon className="h-5 w-5 text-amber-500" />,
                        text: `Piutang '${r.customer}' (${r.id}) akan jatuh tempo dalam ${diffDays} hari.`,
                        time: now.toISOString(),
                        type: 'info',
                    });
                }
            }
        });
        
        setReceivableNotifications(newNotifications.sort((a,b) => b.time.localeCompare(a.time)));
    };
    generateNotifications();
  }, [receivables, notificationSettings]);

  const handleDismissNotification = useCallback((id: string) => {
      setReceivableNotifications(prev => prev.filter(n => n.id !== id));
  }, []);


  // Stats for cards & cumulative cash drawer
  const today = getLocalDateString();
  const periodStartDate = cashDrawerState.periodStartDate || today;
  const effectiveOpeningCash = cashDrawerState.openingCash ?? initialCash;

  const isCashPayment = useCallback((p: { methodId?: string; methodName?: string }): boolean => {
      if (p.methodId) {
          const matched = paymentMethods.find(m => m.id === p.methodId);
          if (matched) return matched.type === 'Tunai';
      }
      if (p.methodName) {
          const matchedByName = paymentMethods.find(m => m.name.toLowerCase() === p.methodName!.toLowerCase());
          if (matchedByName) return matchedByName.type === 'Tunai';
          const lower = p.methodName.toLowerCase();
          return lower.includes('tunai') || lower.includes('cash');
      }
      return true;
  }, [paymentMethods]);
  
  const paymentsToday = useMemo(() => {
    return receivables.reduce((total, receivable) => {
        const paymentsOnToday = receivable.payments?.filter(p => p.date === today) || [];
        const sumOfPayments = paymentsOnToday.reduce((sum, p) => sum + p.amount, 0);
        return total + sumOfPayments;
    }, 0);
  }, [receivables, today]);

  const receivablesTodayUnpaid = useMemo(() => {
      const todayOrderIds = new Set(allOrders.filter(o => o.orderDate === today).map(o => o.id));
      return allDisplayItems
          .filter(r => todayOrderIds.has(r.id) && r.paymentStatus === 'Belum Lunas')
          .reduce((sum, r) => {
              const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
              const remaining = r.amount - (r.discount || 0) - totalPaid;
              return sum + (remaining > 0 ? remaining : 0);
          }, 0);
  }, [allDisplayItems, allOrders, today]);

  const kasLaciOutflowsAll = useMemo(() => {
      const list: ExpenseItem[] = [];
      expenses.forEach(e => {
          const funding = expenseMetadata[e.id]?.fundingSource || 'Kas Laci';
          if (funding === 'Kas Laci') {
              list.push(e);
          }
      });
      supplierBills.forEach(bill => {
          bill.payments.forEach((p, idx) => {
              if (p.fundingSource === 'Kas Laci') {
                  list.push({
                      id: Number(`91${idx}${bill.supplierId}`) || Date.now() + idx,
                      name: `Bayar Tagihan ${bill.supplierName} (${bill.invoiceNumber})`,
                      category: 'Cicilan Pemasok (Kas Laci)',
                      amount: p.amount,
                      date: p.date,
                  });
              }
          });
      });
      bankInstallments.forEach(inst => {
          inst.payments.forEach((p, idx) => {
              if (p.fundingSource === 'Kas Laci') {
                  list.push({
                      id: Number(`92${idx}`) || Date.now() + idx,
                      name: `Cicilan Bank: ${inst.name}`,
                      category: 'Cicilan Bank (Kas Laci)',
                      amount: p.totalPaid,
                      date: p.date,
                  });
              }
          });
      });
      privateExpenses.forEach((pe, idx) => {
          if (pe.fundingSource === 'Kas Laci') {
              list.push({
                  id: Number(`93${idx}`) || Date.now() + idx,
                  name: pe.name,
                  category: `Pribadi/Lain-lain (Kas Laci)`,
                  amount: pe.amount,
                  date: pe.date,
              });
          }
      });
      return list;
  }, [expenses, expenseMetadata, supplierBills, bankInstallments, privateExpenses]);

  const expensesTodayDetails = useMemo(() => {
      return kasLaciOutflowsAll.filter(e => e.date === today);
  }, [kasLaciOutflowsAll, today]);

  const expensesToday = useMemo(() => {
      return expensesTodayDetails.reduce((sum, e) => sum + e.amount, 0);
  }, [expensesTodayDetails]);

  const cashMethodIds = useMemo(() => {
      const ids = new Set(paymentMethods.filter(m => m.type === 'Tunai').map(m => m.id));
      if (ids.size === 0) ids.add('cash-default');
      return ids;
  }, [paymentMethods]);

  const nonCashAccounts = useMemo(
      () => paymentMethods.filter(m => m.type !== 'Tunai'),
      [paymentMethods]
  );

  const cashDrawerMetrics = useMemo(() => {
      let rawCashInPeriod = 0;
      let rawCashInToday = 0;
      let nonCashPeriodTotal = 0;
      const cashBreakdown: Record<string, number> = {};
      const nonCashBreakdown: Record<string, number> = {};
      const allBreakdown: Record<string, number> = {};

      receivables.forEach(r => {
          r.payments?.forEach(p => {
              const cash = isCashPayment(p);
              if (p.date === today && cash) {
                  rawCashInToday += p.amount;
              }
              if (p.date >= periodStartDate && p.date <= today) {
                  allBreakdown[p.methodName] = (allBreakdown[p.methodName] || 0) + p.amount;
                  if (cash) {
                      rawCashInPeriod += p.amount;
                      cashBreakdown[p.methodName] = (cashBreakdown[p.methodName] || 0) + p.amount;
                  } else {
                      nonCashPeriodTotal += p.amount;
                      nonCashBreakdown[p.methodName] = (nonCashBreakdown[p.methodName] || 0) + p.amount;
                  }
              }
          });
      });

      let rawCashOutPeriod = 0;
      let rawCashOutToday = 0;
      kasLaciOutflowsAll.forEach(e => {
          if (e.date === today) {
              rawCashOutToday += e.amount;
          }
          if (e.date >= periodStartDate && e.date <= today) {
              rawCashOutPeriod += e.amount;
          }
      });

      let rawTransferInPeriod = 0;
      let rawTransferOutPeriod = 0;
      let rawTransferInToday = 0;
      let rawTransferOutToday = 0;
      cashTransfers.forEach(t => {
          const toIsCash = !!t.toAccountId && cashMethodIds.has(t.toAccountId);
          const fromIsCash = !!t.fromAccountId && cashMethodIds.has(t.fromAccountId);
          if (t.date === today) {
              if (toIsCash) rawTransferInToday += t.netAmount;
              if (fromIsCash) rawTransferOutToday += t.amount;
          }
          if (t.date >= periodStartDate && t.date <= today) {
              if (toIsCash) rawTransferInPeriod += t.netAmount;
              if (fromIsCash) rawTransferOutPeriod += t.amount;
          }
      });

      const cashInPeriod = Math.max(0, rawCashInPeriod - (cashDrawerState.settledCashInOnStartDate || 0));
      const cashOutPeriod = Math.max(0, rawCashOutPeriod - (cashDrawerState.settledCashOutOnStartDate || 0));
      const transferInPeriod = Math.max(0, rawTransferInPeriod - (cashDrawerState.settledCashTransferInOnStartDate || 0));
      const transferOutPeriod = Math.max(0, rawTransferOutPeriod - (cashDrawerState.settledCashTransferOutOnStartDate || 0));
      const cashTransferNetPeriod = transferInPeriod - transferOutPeriod;
      const finalCash = effectiveOpeningCash + cashInPeriod - cashOutPeriod + cashTransferNetPeriod;

      return {
          cashInPeriod,
          cashOutPeriod,
          cashTransferNetPeriod,
          rawCashInToday,
          rawCashOutToday,
          rawTransferInToday,
          rawTransferOutToday,
          nonCashPeriodTotal,
          cashBreakdown,
          nonCashBreakdown,
          allBreakdown,
          finalCash,
      };
  }, [receivables, kasLaciOutflowsAll, cashTransfers, cashMethodIds, isCashPayment, periodStartDate, today, cashDrawerState, effectiveOpeningCash]);

  const finalCash = cashDrawerMetrics.finalCash;

  const totalOrdersToday = allOrders
      .filter(o => o.orderDate === today)
      .reduce((sum, order) => sum + order.orderItems.length, 0);

  const needsProcessingCount = useMemo(() => {
    return unprocessedOrders.reduce((sum, order) => sum + order.orderItems.length, 0);
  }, [unprocessedOrders]);
  
  const getItemsCount = (cards: CardData[]): number => {
      return cards.reduce((sum, card) => {
          const order = ordersMap.get(card.id);
          return sum + (order?.orderItems.length || 0);
      }, 0);
  };
  const finishedInWarehouseCount = getItemsCount(boardData.warehouse);

  const deliveredTodayCount = useMemo(() => {
    const deliveredTodayIds = new Set(
        receivables
            .filter(r => r.productionStatus === 'Telah Dikirim' && r.deliveryDate === today)
            .map(r => r.id)
    );
    let count = 0;
    deliveredTodayIds.forEach(id => {
        const order = ordersMap.get(id);
        if (order) count += order.orderItems.length;
    });
    return count;
  }, [receivables, ordersMap, today]);

  const handleOpenPaymentModal = (order: DisplayReceivable) => {
    setSelectedOrder(order);
  };

  const handleClosePaymentModal = () => {
    setSelectedOrder(null);
  };
  
  const handleConfirmPayment = (orderId: string, paymentDetails: Payment, discountAmount: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => {
    if (selectedOrder?.isLegacy && selectedOrder.legacyData) {
        onPayLegacyReceivable(selectedOrder.legacyData, paymentDetails, discountAmount);
    } else if (selectedOrder?.isUnprocessed) {
      onPayUnprocessedOrder(orderId, paymentDetails, discountAmount, updatedItems, newTotalAmount);
    } else {
      onProcessPayment(orderId, paymentDetails, discountAmount, updatedItems, newTotalAmount);
    }
    handleClosePaymentModal();
  };
  
  const handleConfirmBulkPayment = (paymentDate: string, paymentMethodId: string) => {
    const orderIdsToPay = unpaidFilteredItems.map(o => o.id);
    if (orderIdsToPay.length > 0) {
        onBulkProcessPayment(orderIdsToPay, paymentDate, paymentMethodId);
    }
    setBulkPayModalOpen(false);
  };
  
  const handleConfirmBulkDueDateUpdate = (newDueDate: string) => {
    const orderIdsToUpdate = unpaidFilteredItems.map(o => o.id);
    if (orderIdsToUpdate.length > 0) {
        onBulkUpdateDueDate(orderIdsToUpdate, newDueDate);
    }
    setBulkDueDateModalOpen(false);
  };

  // --- START: Data calculations for Summary Modal ---
  const paymentsTodayDetails = useMemo(() => {
      const details: { customer: string, orderId: string, methodName: string, amount: number, isCash: boolean }[] = [];
      receivables.forEach(r => {
          r.payments?.forEach(p => {
              if (p.date === today) {
                  details.push({ customer: r.customer, orderId: r.id, methodName: p.methodName, amount: p.amount, isCash: isCashPayment(p) });
              }
          });
      });
      return details;
  }, [receivables, today, isCashPayment]);

  const receivablesTodayUnpaidDetails = useMemo(() => {
      const todayOrderIds = new Set(allOrders.filter(o => o.orderDate === today).map(o => o.id));
      return receivables
          .filter(r => todayOrderIds.has(r.id) && r.paymentStatus === 'Belum Lunas')
          .map(r => {
              const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
              const remaining = r.amount - (r.discount || 0) - totalPaid;
              return { ...r, remaining };
          })
          .filter(r => r.remaining > 0);
  }, [receivables, allOrders, today]);
  // --- END: Data calculations for Summary Modal ---

  const handlePrintReceipt = (order: ReceivableItem) => {
    const fullOrder = ordersMap.get(order.id);
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
        
        const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
        const itemFinishingTotal = finishingPrice * item.qty;
        const total = itemMaterialTotal + itemFinishingTotal;

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
            detailsParts.push(`${item.length}m X ${item.width}m`);
        }
        detailsParts.push(`${item.qty} Pcs`);

        
        const detailsLine = detailsParts.join(' | ');

        const materialAndFinishing = [
            product?.name || 'N/A',
            (item.finishing && item.finishing !== 'Tanpa Finishing') ? item.finishing : ''
        ].filter(Boolean).join(' | ');

        return `
            <div style="margin-bottom: 4px;">
                <div class="bold">${index + 1}. ${item.description || product?.name || 'N/A'}</div>
                <div class="details-line">&nbsp;&nbsp;&nbsp;${materialAndFinishing}</div>
                <div class="details-line">&nbsp;&nbsp;&nbsp;${detailsLine} = ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(displayTotal)}</div>

            </div>
        `;
    }).join('');
    
    const discountRow = (order.discount || 0) > 0 ? `
        <tr>
            <td class="label">Diskon:</td>
            <td class="value">-${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(order.discount!)}</td>
        </tr>
    ` : '';

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
    padding: 0; /* biar mepet kertas */
    width: 80mm; /* penuh selebar kertas */
    line-height: 1.3;
  }
  .container { width: 100%; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .uppercase { text-transform: uppercase; }
  .h1 { font-size: 40px; font-weight: bold; margin: 0; }
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
                    <div class="center">
                        <p class="address">Jl. Prof. Moh. Yamin Cerbonan, Karanganyar</p>
                        <p>Whatsapp: <b>0813 9872 7722</b></p>
                        <p>Email: nalamedia.kra@gmail.com</p>
                    </div>
                    <div class="divider"></div>
                    <div class="center">
                      <p class="larger-text bold uppercase">${order.customer}</p>
                    </div>
                    <div class="divider"></div>
                    <div>No. Nota : ${order.id}</div>
                    <div>Tanggal : ${new Date(fullOrder.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div>Kasir : Admin</div>
                    <div class="divider"></div>
                    <p class="bold">No. Detail Pesanan</p>
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
                        ${discountRow}
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
                        <p>Komplain lebih dari 1 hari tidak kami layani</p>
                        <p>Pembayaran hanya melalui rekening di atas.</p>
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
    const fullOrder = ordersMap.get(order.id);
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
        
        const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
        const itemFinishingTotal = finishingPrice * item.qty;
        return itemMaterialTotal + itemFinishingTotal;
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

        const materialAndFinishing = [
            product?.name || 'N/A',
            (item.finishing && item.finishing !== 'Tanpa Finishing') ? item.finishing : ''
        ].filter(Boolean).join(' - ');

        return `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td>${item.description || '-'}</td>
                <td>${materialAndFinishing}</td>
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
                            <h1 style="font-size: 18pt; font-weight: bold; margin: 0; padding: 0; line-height: 1.;">
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


  const buildWhatsAppMessage = (order: ReceivableItem) => {
    const fullOrder = ordersMap.get(order.id);
    const customerData = customers.find(c => c.name === order.customer);

    if (!fullOrder) {
        return null;
    }

    let phone = customerData?.contact ? customerData.contact.replace(/\D/g, '') : '';
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
        
        const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
        const itemFinishingTotal = finishingPrice * item.qty;
        return itemMaterialTotal + itemFinishingTotal;
    };
    
    const unroundedTotal = fullOrder.orderItems.reduce((sum, i) => sum + calculateItemPrice(i, order.customer), 0);
    const roundingDifference = order.amount - unroundedTotal;

    const storeInfo = `*Nala Media Digital Printing*\nJl. Prof. Moh. Yamin, Cerbonan, Karanganyar\n(Timur Stadion 45)\nTelp: 0813-9872-7722`;
    const divider = '--------------------------------';
    
    const notaInfo = [
        `No Nota  : *${order.id}*`,
        `Tanggal  : ${new Date(fullOrder.orderDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
        `Kasir    : Admin`,
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
    const remainingAmount = order.amount - (order.discount || 0) - totalPaid;

    const summaryInfo = [
        `Total    : *${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(order.amount)}*`,
        `Bayar    : ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPaid)}`,
        `Sisa     : *${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(remainingAmount)}*`
    ].join('\n');
    
    const thankYou = `Terima kasih atas pesanannya!`;

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

    return { message, phone, customerName: order.customer, contact: customerData?.contact };
  };

  const handleCopyWhatsApp = (order: ReceivableItem) => {
    const res = buildWhatsAppMessage(order);
    if (!res) {
        alert("Detail order tidak ditemukan.");
        return;
    }

    navigator.clipboard.writeText(res.message)
      .then(() => {
        setCopyToast({
            message: `Teks nota ${order.id} berhasil disalin! Silakan beralih ke tab WhatsApp Web dan tekan Ctrl+V (Paste) di chat pelanggan.`,
            phone: res.contact || res.phone,
            customer: res.customerName
        });
        setTimeout(() => setCopyToast(null), 6000);
      })
      .catch((err) => {
        console.error("Gagal menyalin teks: ", err);
        alert("Gagal menyalin ke clipboard.");
      });

    setActionsMenu(null);
  };

  const handleCopyOrderInfo = (order: ReceivableItem) => {
    const fullOrder = ordersMap.get(order.id);
    const customerData = customers.find(c => c.name === order.customer);

    if (!fullOrder) {
      alert("Detail order tidak ditemukan.");
      return;
    }

    // Format rincian item
    const itemsList = fullOrder.orderItems.map((item, idx) => {
      const product = products.find(p => p.id === item.productId);
      const category = categories.find(c => c.name === product?.category);
      const isArea = category?.unitType === 'Per Luas';
      const sizeStr = isArea && parseFloat(item.length) > 0 && parseFloat(item.width) > 0 ? ` (${item.length}x${item.width}m)` : '';
      const name = item.description || product?.name || 'Item Pesanan';
      return `  ${idx + 1}. ${name}${sizeStr} - ${item.qty} Pcs`;
    }).join('\n');

    // Status Produksi & Keterangan
    let statusProduksiText = `*${order.productionStatus}*`;
    let statusKeterangan = '';

    switch (order.productionStatus) {
      case 'Siap Ambil':
        statusProduksiText = '✅ *SIAP DIAMBIL*';
        statusKeterangan = `Pesanan Anda sudah selesai diproses dan siap diambil di workshop Nala Media:\n📍 *Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar (Timur Stadion 45)*\n🕒 Jam Buka: 08.00 - 24.00 WIB\n\nJika ingin diambil oleh kurir/ojol atau ada pertanyaan, silakan hubungi kami.`;
        break;
      case 'Proses Cetak':
        statusProduksiText = '⚙️ *PROSES CETAK & FINISHING*';
        statusKeterangan = `Pesanan Anda saat ini sedang dalam proses cetak & finishing di workshop kami. Kami akan infokan kembali begitu pesanan selesai dan siap diambil.`;
        break;
      case 'Dalam Antrian':
        statusProduksiText = '⏳ *DALAM ANTRIAN CETAK*';
        statusKeterangan = `Pesanan Anda sudah masuk dalam antrian cetak dan akan segera kami proses sesuai jadwal kerja.`;
        break;
      case 'Telah Dikirim':
        statusProduksiText = '📦 *TELAH DIKIRIM / DISERAHKAN*';
        statusKeterangan = `Pesanan Anda sudah diserahkan / dikirimkan. Terima kasih banyak telah mempercayakan kebutuhan cetak Anda di Nala Media!`;
        break;
      default:
        statusProduksiText = `*${order.productionStatus}*`;
        statusKeterangan = `Untuk info lebih lanjut silakan tanyakan kepada Admin kami.`;
        break;
    }

    // Status Pembayaran
    const totalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const remainingAmount = order.amount - (order.discount || 0) - totalPaid;
    let paymentStatusText = '';
    if (remainingAmount <= 0) {
      paymentStatusText = '*LUNAS* ✅';
    } else {
      paymentStatusText = `*Belum Lunas* (Sisa Tagihan: *${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(remainingAmount)}*)`;
    }

    const tglOrder = new Date(fullOrder.orderDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const divider = '--------------------------------';

    const message = [
      `Halo Kak *${order.customer}*,`,
      ``,
      `Update pesanan Anda di *Nala Media Digital Printing*:`,
      divider,
      `No. Nota    : *${order.id}*`,
      `Tgl Order   : ${tglOrder}`,
      `Rincian     :\n${itemsList}`,
      `Status      : ${statusProduksiText}`,
      `Pembayaran  : ${paymentStatusText}`,
      divider,
      statusKeterangan,
      ``,
      `Terima kasih! 🙏`
    ].join('\n');

    navigator.clipboard.writeText(message)
      .then(() => {
        setCopyToast({
          message: `Info order nota ${order.id} untuk ${order.customer} berhasil disalin! Silakan paste (Ctrl+V) di chat WhatsApp pelanggan.`,
          phone: customerData?.contact || undefined,
          customer: order.customer
        });
        setTimeout(() => setCopyToast(null), 6000);
      })
      .catch((err) => {
        console.error("Gagal menyalin teks: ", err);
        alert("Gagal menyalin info order ke clipboard.");
      });

    setActionsMenu(null);
  };

  const handleSendWhatsApp = (order: ReceivableItem) => {
    const res = buildWhatsAppMessage(order);
    if (!res || !res.phone) {
        alert("Informasi pelanggan atau nomor telepon tidak lengkap untuk membuka WhatsApp.");
        return;
    }

    const encodedMessage = encodeURIComponent(res.message);
    const whatsappUrl = `https://api.whatsapp.com/send/?phone=${res.phone}&text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
    setActionsMenu(null);
  };
  
  const handlePreviewInvoice = (order: ReceivableItem) => {
    const fullOrder = ordersMap.get(order.id);
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
    
    const banks = paymentMethods.filter(m => m.type === 'Transfer Bank' || m.type === 'QRIS' || m.type === 'E-Wallet');

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
        const unroundedItemTotal = (baseItemPricePerUnit * priceMultiplier) * item.qty;
        
        const isLastItem = index === fullOrder.orderItems.length - 1;
        const displayJumlah = isLastItem ? unroundedItemTotal + roundingDifference : unroundedItemTotal;
        
        const hargaSatuanFinal = item.qty > 0 ? displayJumlah / item.qty : 0;

        const materialAndFinishing = [
            product.name,
            (item.finishing && item.finishing !== 'Tanpa Finishing') ? item.finishing : ''
        ].filter(Boolean).join(' - ');

        return `
            <tr>
                <td class="p-3 text-center text-gray-600">${index + 1}</td>
                <td class="p-3">
                    <p class="font-medium text-gray-800">${item.description || product.name}</p>
                    <p class="text-xs text-gray-500">${materialAndFinishing}</p>
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
                    <p>Pembayaran resmi hanya melalui rekening yang tertera di bawah ini.</p>
                    <div class="flex gap-4 mt-1">
                        ${banks.map(b => `<p><span class="font-semibold">${b.name}:</span> ${b.details}</p>`).join('')}
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
      case 'Data Lama': return 'bg-indigo-100 text-indigo-800';
      case 'Dalam Antrian':
      default:
        return 'bg-fuchsia-100 text-fuchsia-800';
    }
  };

  const handleStartEditDueDate = (item: ReceivableItem) => {
      setEditingDueDateId(item.id);
      setNewDueDate(item.due);
  };

  const handleSaveDueDate = (orderId: string) => {
      onUpdateDueDate(orderId, newDueDate);
      setEditingDueDateId(null);
  };
    const handlePrintCustomerReport = () => {
        if (!filterCustomer) {
            alert("Silakan pilih pelanggan dari filter terlebih dahulu.");
            return;
        }
        
        const reportPeriod = `Periode: ${filterStartDate ? formatDate(filterStartDate) : '...'} - ${filterEndDate ? formatDate(filterEndDate) : '...'}`;
        const reportTitle = 'Laporan Piutang Pelanggan';
        const reportItems = filteredItems.filter(r => r.customer === filterCustomer);

        const calculateItemPrice = (item: OrderItemData, customerName: string): number => {
            if (item.customPrice !== undefined && item.customPrice !== null) {
                return item.customPrice;
            }

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
            
            const itemMaterialTotal = materialPrice * priceMultiplier * item.qty;
            const itemFinishingTotal = finishingPrice * item.qty;
            return itemMaterialTotal + itemFinishingTotal;
        };

        const invoiceBlocks = reportItems.map(receivable => {
            const fullOrder = ordersMap.get(receivable.id);
            const orderDate = fullOrder ? fullOrder.orderDate : (receivable.isLegacy ? receivable.legacyData?.order_date : new Date().toISOString());
            const displayId = receivable.isLegacy && receivable.legacyData ? receivable.legacyData.nota_id : receivable.id;
            
            const paid = receivable.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
            const remaining = receivable.amount - (receivable.discount || 0) - paid;

            const invoiceHeader = `
                <div style="margin-top: 20px; margin-bottom: 5px; font-weight: bold; font-size: 11pt; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
                    No. Nota : ${displayId} <span style="font-weight: normal; margin-left: 10px;">(Tanggal Order : ${formatDate(orderDate as string)})</span>
                </div>`;

            let itemRows = '';
            
            if (fullOrder) {
                const unroundedTotal = fullOrder.orderItems.reduce((sum, i) => sum + calculateItemPrice(i, receivable.customer), 0);
                const roundingDifference = receivable.amount - unroundedTotal;

                itemRows = fullOrder.orderItems.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const category = categories.find(c => c.name === product?.category);
                    const isArea = category?.unitType === 'Per Luas';
                    
                    let itemTotal = calculateItemPrice(item, receivable.customer);
                    const isLastItem = index === fullOrder.orderItems.length - 1;
                    if (isLastItem) {
                        itemTotal += roundingDifference;
                    }

                    const sizeStr = isArea ? `${item.length}m x ${item.width}m` : '';
                    const finishStr = item.finishing && item.finishing !== 'Tanpa Finishing' ? item.finishing : '';
                    const detailsString = [sizeStr, finishStr].filter(Boolean).join(' | ');
                    
                    const isFirstItem = index === 0;
                    const rowSpan = fullOrder.orderItems.length;

                    return `
                        <tr>
                            <td style="vertical-align: top; padding: 5px;">
                                <div style="font-weight: bold;">${item.description || ''}</div>
                                <div style="font-size: 9pt; color: #555;">${product?.name || 'Item'}</div>
                                <div style="font-size: 9pt; color: #555;">${detailsString || 'Polos'}</div>
                            </td>
                            <td style="text-align:center; vertical-align: top; padding: 5px;">${item.qty}</td>
                            <td class="currency" style="vertical-align: top; padding: 5px;">${formatCurrency(itemTotal)}</td>
                            ${isFirstItem ? `<td class="currency" rowspan="${rowSpan}" style="vertical-align: top; padding: 5px; font-weight: bold; border-left: 1px solid #eee;">${formatCurrency(receivable.amount)}</td>` : ''}
                            ${isFirstItem ? `<td class="currency" rowspan="${rowSpan}" style="vertical-align: top; padding: 5px; font-weight: bold; color: #d32f2f; border-left: 1px solid #eee;">${formatCurrency(remaining)}</td>` : ''}
                        </tr>
                    `;
                }).join('');
            } else if (receivable.isLegacy && receivable.legacyData) {
                 const item = receivable.legacyData;
                 const sizeStr = (item.length && item.width) ? `${item.length}m x ${item.width}m` : '';
                 
                 itemRows = `
                    <tr>
                        <td style="vertical-align: top; padding: 5px;">
                            <div style="font-weight: bold;">${item.description}</div>
                            <div style="font-size: 9pt; color: #555;">Data Lama</div>
                            <div style="font-size: 9pt; color: #555;">${sizeStr}</div>
                        </td>
                        <td style="text-align:center; vertical-align: top; padding: 5px;">${item.qty}</td>
                        <td class="currency" style="vertical-align: top; padding: 5px;">${formatCurrency(item.amount)}</td>
                        <td class="currency" style="vertical-align: top; padding: 5px; font-weight: bold; border-left: 1px solid #eee;">${formatCurrency(item.amount)}</td>
                        <td class="currency" style="vertical-align: top; padding: 5px; font-weight: bold; color: #d32f2f; border-left: 1px solid #eee;">${formatCurrency(remaining)}</td>
                    </tr>
                 `;
            }

            return `
                <div style="margin-bottom: 15px; page-break-inside: avoid;">
                    ${invoiceHeader}
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 1px solid #ddd;">
                        <thead>
                            <tr style="background-color: #f2f2f2; border-bottom: 1px solid #aaa;">
                                <th style="text-align: left; padding: 6px;">Deskripsi item</th>
                                <th style="text-align: center; width: 50px; padding: 6px;">Qty</th>
                                <th class="currency" style="width: 100px; padding: 6px;">Total Per item</th>
                                <th class="currency" style="width: 100px; padding: 6px;">Total Tagihan</th>
                                <th class="currency" style="width: 100px; padding: 6px;">Sisa</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        const totalSisa = reportItems.reduce((sum, r) => {
            const paid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
            const remaining = r.amount - (r.discount || 0) - paid;
            return sum + remaining;
        }, 0);

        const summaryHtml = `
            <div class="summary-box">
                <table style="width: 300px; float: right; border: none;">
                    <tr><td style="border:none; font-size: 12pt;">Total Sisa Tagihan:</td><td style="border:none; font-size: 12pt;" class="currency"><strong>${formatCurrency(totalSisa)}</strong></td></tr>
                </table>
            </div>`;

        const printContent = `
            <html>
                <head>
                    <title>${reportTitle} - ${filterCustomer}</title>
                    <style>
                        body { font-family: Arial, sans-serif; font-size: 9pt; color: #333; }
                        .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                        .header, .customer-info, .summary { display: flex; justify-content: space-between; align-items: flex-start; }
                        .header h1 { font-size: 16pt; margin: 0; } .header h2 { font-size: 12pt; margin: 0; color: #555; }
                        hr { border: 0; border-top: 1px solid #ccc; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 4px; text-align: left; vertical-align: top; border-bottom: 1px solid #eee; }
                        .currency { text-align: right; }
                        .summary-box { text-align: right; margin-top: 20px; padding-top: 10px; border-top: 2px solid #333; clear: both; }
                        small { color: #555; font-size: 8pt; }
                        @media print { .page { margin: 0; border: initial; border-radius: initial; width: initial; min-height: initial; box-shadow: initial; background: initial; page-break-inside: avoid; } }
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
                            <strong>${filterCustomer}</strong>
                            <span>${reportPeriod}</span>
                        </div>
                        <hr>
                        
                        ${invoiceBlocks}

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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard 
            icon={<CurrencyDollarIcon />} 
            title="Kas Awal Periode" 
            value={formatCurrency(effectiveOpeningCash)}
            gradient="bg-gradient-to-br from-gray-500 to-gray-600"
            onClick={() => setSummaryModal({ type: 'initialCashInfo', title: `Kas Awal (Sejak ${formatDate(periodStartDate)})` })}
        />
        <StatCard 
            icon={<CreditCardIcon />} 
            title="Pembayaran Hari Ini" 
            value={formatCurrency(paymentsToday)}
            gradient="bg-gradient-to-br from-green-500 to-emerald-500"
            onClick={() => setSummaryModal({ type: 'payments', title: 'Ringkasan Pembayaran Hari Ini' })}
        />
        <StatCard 
            icon={<ChartBarIcon />} 
            title="Piutang Hari Ini" 
            value={formatCurrency(receivablesTodayUnpaid)}
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
            onClick={() => setSummaryModal({ type: 'receivables', title: 'Piutang Order Hari Ini (Belum Lunas)' })}
        />
        <StatCard 
            icon={<ReceiptTaxIcon />} 
            title="Pengeluaran Laci Hari Ini" 
            value={formatCurrency(expensesToday)}
            gradient="bg-gradient-to-br from-rose-500 to-red-500"
            onClick={() => setSummaryModal({ type: 'expenses', title: 'Pengeluaran dari Kas Laci Hari Ini' })}
        />
        <StatCard 
            icon={<CurrencyDollarIcon />} 
            title="Kas Akhir (Laci)" 
            value={formatCurrency(finalCash)}
            gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500"
            onClick={() => setSummaryModal({ type: 'finalCash', title: 'Rincian Kas Akhir Laci (Akumulatif)' })}
        />
    </div>

      <div className="bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Daftar Pembayaran / Piutang</h2>
            <div className="flex items-center space-x-2">
                <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setNotificationsOpen(prev => !prev)}
                    className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none"
                    aria-label="Notifikasi Piutang"
                    aria-haspopup="true"
                    aria-expanded={isNotificationsOpen}
                  >
                    <BellIcon />
                    {receivableNotifications.length > 0 && (
                      <span className="absolute top-0 right-0 h-2.5 w-2.5 mt-1 mr-1 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                  </button>
                  {isNotificationsOpen && (
                    <ReceivablesNotificationPopup 
                      notifications={receivableNotifications} 
                      onDismiss={handleDismissNotification} 
                      onClosePopup={() => setNotificationsOpen(false)}
                    />
                  )}
                </div>
                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    (filterStatus || filterStartDate || filterEndDate || filterCustomer || filterSearch)
                      ? 'bg-pink-100 text-pink-700 hover:bg-pink-200 border border-pink-300'
                      : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <FilterIcon className="h-4 w-4" />
                  <span>Filter</span>
                  {(filterStatus || filterStartDate) && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-pink-600 text-white rounded-full font-bold">Aktif</span>
                  )}
                </button>
            </div>
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
                <div className="flex flex-wrap justify-between items-center mt-3 gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                         <button 
                            onClick={() => setInitialCashModalOpen(true)}
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700"
                        >
                            Kas Awal
                        </button>
                        <button
                            onClick={() => setSetorModalOpen(true)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-700 flex items-center space-x-1.5 shadow-sm"
                            title="Setor dana kas laci ke owner atau rekening bank dan mulai periode baru"
                        >
                            <ArrowUpTrayIcon className="h-4 w-4" />
                            <span>Setor Dana</span>
                        </button>
                        <button
                            onClick={() => setHistoryModalOpen(true)}
                            className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-100 flex items-center space-x-1.5"
                            title="Lihat riwayat setoran dan penyesuaian kas awal"
                        >
                            <CalendarDaysIcon className="h-4 w-4" />
                            <span>Log Kas & Setoran ({cashDrawerLogs.length})</span>
                        </button>
                        <button 
                            onClick={() => setBulkPayModalOpen(true)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed"
                            disabled={!filterCustomer || unpaidFilteredItems.length === 0}
                            title={!filterCustomer ? 'Pilih pelanggan di filter untuk mengaktifkan' : 'Bayar semua nota yang belum lunas untuk pelanggan ini'}
                        >
                            Bayar Langsung ({unpaidFilteredItems.length} Nota)
                        </button>
                        {filterStatus === 'Belum Lunas' && (
                             <button 
                                onClick={() => setBulkDueDateModalOpen(true)}
                                className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed"
                                disabled={unpaidFilteredItems.length === 0}
                            >
                                Ubah Jatuh Tempo ({unpaidFilteredItems.length} Nota)
                            </button>
                        )}
                        <button 
                            onClick={handlePrintCustomerReport}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                            disabled={!filterCustomer}
                        >
                            Laporan Pelanggan
                        </button>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button onClick={handleDefaultFilters} className="text-xs text-gray-700 hover:text-pink-600 font-medium bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded border">Default (30 Hari Belum Lunas)</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={handleResetFilters} className="text-xs text-pink-600 hover:underline">Tampilkan Semua (Reset)</button>
                    </div>
                </div>
            </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Nota</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Order</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Produksi</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jatuh Tempo</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tagihan</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Bayar</th>
                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedItems.length > 0 ? paginatedItems.map(item => {
                const order = ordersMap.get(item.id);
                const rawDate = item.isLegacy ? item.legacyData?.order_date : (order?.orderDate || item.due);
                const orderDate = rawDate ? new Date(rawDate).toLocaleDateString('id-ID') : 'N/A';

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4 whitespace-nowrap font-medium text-gray-800">{item.id}</td>
                    <td className="py-4 px-4 whitespace-nowrap">{item.customer}</td>
                    <td className="py-4 px-4 whitespace-nowrap text-sm">{orderDate}</td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProductionStatusColor(item.productionStatus)}`}>
                        {item.productionStatus}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-sm">
                      {editingDueDateId === item.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="date"
                            value={newDueDate}
                            onChange={(e) => setNewDueDate(e.target.value)}
                            className="p-1 border rounded-md"
                          />
                          <button onClick={() => handleSaveDueDate(item.id)} className="p-1 text-green-600 hover:bg-green-100 rounded-full"><CheckIcon className="h-4 w-4" /></button>
                          <button onClick={() => setEditingDueDateId(null)} className="p-1 text-red-600 hover:bg-red-100 rounded-full">&times;</button>
                        </div>
                      ) : (
                        <div className={`flex items-center space-x-2 group ${item.paymentStatus === 'Lunas' ? 'text-gray-400' : ''}`}>
                          <span className={item.paymentStatus === 'Lunas' ? 'line-through' : ''}>
                            {new Date(item.due).toLocaleDateString('id-ID')}
                          </span>
                          {item.paymentStatus !== 'Lunas' && (
                            <button onClick={() => handleStartEditDueDate(item)} className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                     <td className="py-4 px-4 whitespace-nowrap text-right font-semibold">{formatCurrency(item.amount)}</td>
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
                              disabled={item.isLegacy}
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
                                      <a href="#" onClick={(e) => { e.preventDefault(); handleCopyWhatsApp(item); }} className="text-emerald-700 font-semibold block px-4 py-2 text-sm hover:bg-emerald-50 flex items-center" role="menuitem">
                                          <ClipboardIcon className="h-4 w-4 mr-2 text-emerald-600" />
                                          Salin Pesan WhatsApp
                                      </a>
                                      <a href="#" onClick={(e) => { e.preventDefault(); handleCopyOrderInfo(item); }} className="text-blue-700 font-semibold block px-4 py-2 text-sm hover:bg-blue-50 flex items-center" role="menuitem">
                                          <BellIcon className="h-4 w-4 mr-2 text-blue-600" />
                                          Salin Info Order
                                      </a>
                                      <a href="#" onClick={(e) => { e.preventDefault(); handleSendWhatsApp(item); }} className="text-gray-500 block px-4 py-1.5 text-xs hover:bg-gray-100" role="menuitem">
                                          Buka WhatsApp (Tab Baru)
                                      </a>
                                      <a href="#" onClick={(e) => { e.preventDefault(); handlePreviewInvoice(item); setActionsMenu(null); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">Lihat & Cetak Invoice</a>
                                  </div>
                              </div>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">Tidak ada data piutang yang cocok dengan filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          totalItems={filteredItems.length}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
      {selectedOrder && (
        <PaymentModal 
          order={selectedOrder}
          fullOrder={ordersMap.get(selectedOrder.id)}
          products={products}
          finishings={finishings}
          customers={customers}
          categories={categories}
          paymentMethods={paymentMethods}
          onClose={handleClosePaymentModal}
          onConfirmPayment={handleConfirmPayment}
        />
      )}
      {isBulkPayModalOpen && (
        <BulkPaymentModal
            orders={unpaidFilteredItems}
            paymentMethods={paymentMethods}
            onClose={() => setBulkPayModalOpen(false)}
            onConfirmBulkPayment={handleConfirmBulkPayment}
        />
      )}
       {isInitialCashModalOpen && (
        <InitialCashModal
            currentAmount={effectiveOpeningCash}
            currentStartDate={periodStartDate}
            today={today}
            expectedCash={finalCash}
            periodNetChange={cashDrawerMetrics.cashInPeriod - cashDrawerMetrics.cashOutPeriod + cashDrawerMetrics.cashTransferNetPeriod}
            rawTodayMetrics={{
              rawCashInToday: cashDrawerMetrics.rawCashInToday,
              rawCashOutToday: cashDrawerMetrics.rawCashOutToday,
              rawTransferInToday: cashDrawerMetrics.rawTransferInToday,
              rawTransferOutToday: cashDrawerMetrics.rawTransferOutToday,
            }}
            onClose={() => setInitialCashModalOpen(false)}
            onSave={(amount, startDate, notes, settledOverride) => {
              onUpdateInitialCash(amount);
              onUpdateCashDrawerInitial(amount, startDate, notes, settledOverride);
            }}
        />
    )}
    {isSetorModalOpen && (
        <DepositCashModal
            periodStartDate={periodStartDate}
            today={today}
            openingCash={effectiveOpeningCash}
            cashInPeriod={cashDrawerMetrics.cashInPeriod}
            cashOutPeriod={cashDrawerMetrics.cashOutPeriod}
            cashTransferNetPeriod={cashDrawerMetrics.cashTransferNetPeriod}
            expectedCash={cashDrawerMetrics.finalCash}
            nonCashTotal={cashDrawerMetrics.nonCashPeriodTotal}
            cashBreakdown={cashDrawerMetrics.cashBreakdown}
            nonCashBreakdown={cashDrawerMetrics.nonCashBreakdown}
            nonCashAccounts={nonCashAccounts}
            currentUserName={currentUserName}
            onClose={() => setSetorModalOpen(false)}
            onConfirmSetor={async ({ depositAmount, physicalCash, recipient, depositMode, depositToAccountId, depositToAccountName, notes }) => {
              await onSetorCash({
                depositAmount,
                physicalCash,
                recipient,
                depositMode,
                depositToAccountId,
                depositToAccountName,
                notes,
                summary: {
                  periodStartDate,
                  periodEndDate: today,
                  openingCash: effectiveOpeningCash,
                  cashInTotal: cashDrawerMetrics.cashInPeriod,
                  cashOutTotal: cashDrawerMetrics.cashOutPeriod,
                  nonCashTotal: cashDrawerMetrics.nonCashPeriodTotal,
                  expectedCash: cashDrawerMetrics.finalCash,
                  rawCashInToday: cashDrawerMetrics.rawCashInToday,
                  rawCashOutToday: cashDrawerMetrics.rawCashOutToday,
                  rawTransferInToday: cashDrawerMetrics.rawTransferInToday,
                  rawTransferOutToday: cashDrawerMetrics.rawTransferOutToday,
                  breakdownByMethod: cashDrawerMetrics.allBreakdown,
                },
              });
            }}
        />
    )}
    {isHistoryModalOpen && (
        <CashDrawerHistoryModal
            logs={cashDrawerLogs}
            onClose={() => setHistoryModalOpen(false)}
            onDeleteLog={onDeleteCashDrawerLog}
        />
    )}
    {summaryModal.type && (
        <SummaryInfoModal
            isOpen={!!summaryModal.type}
            onClose={() => setSummaryModal({ type: null, title: '' })}
            title={summaryModal.title}
            type={summaryModal.type}
            onOpenSetor={() => setSetorModalOpen(true)}
            onOpenHistory={() => setHistoryModalOpen(true)}
            onOpenInitialCash={() => setInitialCashModalOpen(true)}
            data={{
                payments: paymentsTodayDetails,
                receivables: receivablesTodayUnpaidDetails,
                expenses: expensesTodayDetails,
                finalCashBreakdown: cashDrawerMetrics.cashBreakdown,
                nonCashBreakdown: cashDrawerMetrics.nonCashBreakdown,
                finalCashTotal: finalCash,
                openingCash: effectiveOpeningCash,
                cashInPeriod: cashDrawerMetrics.cashInPeriod,
                cashOutPeriod: cashDrawerMetrics.cashOutPeriod,
                cashTransferNetPeriod: cashDrawerMetrics.cashTransferNetPeriod,
                nonCashTotal: cashDrawerMetrics.nonCashPeriodTotal,
                periodStartDate,
                periodEndDate: today,
            }}
        />
    )}
    {isBulkDueDateModalOpen && (
        <BulkDueDateModal
            itemCount={unpaidFilteredItems.length}
            onClose={() => setBulkDueDateModalOpen(false)}
            onConfirm={handleConfirmBulkDueDateUpdate}
        />
    )}
    {copyToast && (
      <div className="fixed bottom-6 right-6 z-50 max-w-md bg-emerald-900 text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-400 flex items-start space-x-3">
        <div className="p-2 bg-emerald-700 rounded-xl flex-shrink-0 mt-0.5">
          <CheckIcon className="h-5 w-5 text-emerald-200" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-bold text-white text-sm">Pesan Berhasil Disalin ke Clipboard!</p>
          <p className="mt-1 text-xs text-emerald-100 leading-relaxed">{copyToast.message}</p>
          {copyToast.phone && (
            <p className="mt-2 text-xs text-emerald-200 bg-black/20 px-2 py-1 rounded inline-block font-mono">
              No. Kontak: <b>{copyToast.phone}</b> ({copyToast.customer})
            </p>
          )}
        </div>
        <button
          onClick={() => setCopyToast(null)}
          className="text-emerald-300 hover:text-white text-lg font-bold leading-none p-1"
          title="Tutup"
        >
          &times;
        </button>
      </div>
    )}
    </>
  );
};

export default Receivables;
