import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { type ReceivableItem, type ProductionStatusDisplay, type PaymentStatus, type SavedOrder, type KanbanData, type CardData, type ProductData, type FinishingData, type OrderItemData, type Payment, type CustomerData, type CategoryData, type ExpenseItem, type PaymentMethod, type NotificationSettings, type NotificationItem, type LegacyReceivable } from '../types';
import { ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, CurrencyDollarIcon, CreditCardIcon, ChartBarIcon, EllipsisVerticalIcon, FilterIcon, ReceiptTaxIcon, PencilIcon, CheckIcon, BellIcon, ExclamationTriangleIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 20;

type DisplayReceivable = ReceivableItem & { isUnprocessed?: boolean; isLegacy?: boolean; legacyData?: LegacyReceivable };

// --- START: Reusable Components ---

const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
  const [discount, setDiscount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [editedItems, setEditedItems] = useState<OrderItemData[] | null>(fullOrder?.orderItems || null);

  useEffect(() => {
    if (order.discount) {
        setDiscount(order.discount.toString());
    }
  }, [order]);
  
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


  const { totalPaid, totalSetelahDiskon, sisaTagihan } = useMemo(() => {
    const currentTotalPaid = order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const currentDiscount = parseFloat(discount) || 0;
    const currentTotalSetelahDiskon = currentTotalAmount - currentDiscount;
    const currentSisaTagihan = currentTotalSetelahDiskon - currentTotalPaid;
    return {
      totalPaid: currentTotalPaid,
      totalSetelahDiskon: currentTotalSetelahDiskon,
      sisaTagihan: currentSisaTagihan,
    };
  }, [order, discount, currentTotalAmount]);

  const numPaymentAmount = parseFloat(paymentAmount) || 0;
  const kembalian = numPaymentAmount > sisaTagihan ? numPaymentAmount - sisaTagihan : 0;

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
      const finalDiscount = parseFloat(discount) || 0;
      
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

                <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-md">
                        <span className="text-gray-600">Total Tagihan</span>
                        <span className="font-semibold">{formatCurrency(currentTotalAmount)}</span>
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
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onConfirmBulkPayment: (paymentDate: string, paymentMethodId: string) => void;
}> = ({ orders, paymentMethods, onClose, onConfirmBulkPayment }) => {
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
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

// --- START: NEW SUMMARY MODAL ---
const SummaryInfoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'payments' | 'receivables' | 'expenses' | 'finalCash' | 'initialCashInfo';
  data: {
    payments?: { customer: string, orderId: string, methodName: string, amount: number }[];
    receivables?: (ReceivableItem & { remaining: number })[];
    expenses?: ExpenseItem[];
    finalCashBreakdown?: { [key: string]: number };
    finalCashTotal?: number;
  };
}> = ({ isOpen, onClose, title, type, data }) => {
  if (!isOpen) return null;

  const renderContent = () => {
    switch(type) {
      case 'initialCashInfo':
        return (
          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-700">
            <p className="font-semibold">Informasi Kas Awal</p>
            <p className="text-sm mt-1">Ini adalah nominal uang saldo awal harian. Masukan sesuai nominal menggunakan tombol (Kas Awal) di dalam menu Pembayaran sesuai nominal di laci untuk kembalian atau pecahan uang, agar akurat dalam menghitung Kas Akhir!!!</p>
          </div>
        );
      case 'payments':
        return (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left">Pelanggan</th><th className="py-2 px-3 text-left">No Nota</th><th className="py-2 px-3 text-left">Sumber Dana</th><th className="py-2 px-3 text-right">Nominal</th></tr></thead>
            <tbody className="divide-y">{data.payments?.map((p, i) => (<tr key={i}><td className="py-2 px-3">{p.customer}</td><td className="py-2 px-3">{p.orderId}</td><td className="py-2 px-3">{p.methodName}</td><td className="py-2 px-3 text-right">{formatCurrency(p.amount)}</td></tr>))}</tbody>
          </table>
        );
      case 'receivables':
        return (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left">Pelanggan</th><th className="py-2 px-3 text-left">No Nota</th><th className="py-2 px-3 text-left">Status Produksi</th><th className="py-2 px-3 text-right">Sisa Tagihan</th></tr></thead>
            <tbody className="divide-y">{data.receivables?.map(r => (<tr key={r.id}><td className="py-2 px-3">{r.customer}</td><td className="py-2 px-3">{r.id}</td><td className="py-2 px-3">{r.productionStatus}</td><td className="py-2 px-3 text-right">{formatCurrency(r.remaining)}</td></tr>))}</tbody>
          </table>
        );
      case 'expenses':
        return (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="py-2 px-3 text-left">Nama</th><th className="py-2 px-3 text-left">Kategori</th><th className="py-2 px-3 text-right">Jumlah</th></tr></thead>
            <tbody className="divide-y">{data.expenses?.map(e => (<tr key={e.id}><td className="py-2 px-3">{e.name}</td><td className="py-2 px-3">{e.category}</td><td className="py-2 px-3 text-right">{formatCurrency(e.amount)}</td></tr>))}</tbody>
          </table>
        );
      case 'finalCash':
        return (
          <div>
            <div className="p-4 bg-pink-50 rounded-lg text-center mb-4">
              <p className="text-sm text-pink-700">Total Kas Akhir</p>
              <p className="text-3xl font-bold text-pink-600">{formatCurrency(data.finalCashTotal || 0)}</p>
            </div>
            <h4 className="font-semibold mb-2 text-gray-700">Rincian Pemasukan Hari Ini:</h4>
            <div className="space-y-2">
              {data.finalCashBreakdown && Object.entries(data.finalCashBreakdown).map(([method, amount]) => (
                <div key={method} className="flex justify-between text-sm p-2 bg-gray-50 rounded-md">
                  <span className="text-gray-600">{method}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
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
    const [newDueDate, setNewDueDate] = useState(new Date().toISOString().substring(0, 10));

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
  initialCash: number;
  paymentMethods: PaymentMethod[];
  onUpdateInitialCash: (amount: number) => void;
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
    receivables, unprocessedOrders, allOrders, boardData, products, finishings, customers, categories, expenses, initialCash, paymentMethods,
    onProcessPayment, onPayUnprocessedOrder, onBulkProcessPayment, onUpdateInitialCash, onUpdateDueDate, onBulkUpdateDueDate, notificationSettings,
    legacyReceivables, onPayLegacyReceivable
}) => {
  const [modalData, setModalData] = useState<{ title: string; orders: CardData[] } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DisplayReceivable | null>(null);
  const [actionsMenu, setActionsMenu] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isBulkPayModalOpen, setBulkPayModalOpen] = useState(false);
  const [isInitialCashModalOpen, setInitialCashModalOpen] = useState(false);
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

  // Filter states
  const [filterSearch, setFilterSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

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
    return allDisplayItems.filter(item => {
      const order = allOrders.find(o => o.id === item.id);
      const orderDate = item.isLegacy ? item.legacyData!.order_date : order?.orderDate;

      const lowerCaseSearch = filterSearch.toLowerCase();
      if (filterSearch && !item.id.toLowerCase().includes(lowerCaseSearch) && !item.customer.toLowerCase().includes(lowerCaseSearch)) {
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
        // For legacy items, we need a consistent way to sort. Using ID is fine.
        const idA = a.isLegacy ? a.legacyData!.id.toString() : a.id;
        const idB = b.isLegacy ? b.legacyData!.id.toString() : b.id;
        return idB.localeCompare(idA, undefined, { numeric: true });
    });
  }, [allDisplayItems, allOrders, filterSearch, filterCustomer, filterStatus, filterStartDate, filterEndDate]);
  
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


  // Stats for cards
  const today = new Date().toISOString().substring(0, 10);
  
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

  const expensesToday = useMemo(() => {
      return expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, today]);

  const finalCash = initialCash + paymentsToday - expensesToday;

  const totalOrdersToday = allOrders
      .filter(o => o.orderDate === today)
      .reduce((sum, order) => sum + order.orderItems.length, 0);

  const needsProcessingCount = useMemo(() => {
    return unprocessedOrders.reduce((sum, order) => sum + order.orderItems.length, 0);
  }, [unprocessedOrders]);
  
  const getItemsCount = (cards: CardData[]): number => {
      return cards.reduce((sum, card) => {
          const order = allOrders.find(o => o.id === card.id);
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
    return allOrders
        .filter(o => deliveredTodayIds.has(o.id))
        .reduce((sum, order) => sum + order.orderItems.length, 0);
  }, [receivables, allOrders, today]);

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
      const details: { customer: string, orderId: string, methodName: string, amount: number }[] = [];
      receivables.forEach(r => {
          r.payments?.forEach(p => {
              if (p.date === today) {
                  details.push({ customer: r.customer, orderId: r.id, methodName: p.methodName, amount: p.amount });
              }
          });
      });
      return details;
  }, [receivables, today]);

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

  const expensesTodayDetails = useMemo(() => expenses.filter(e => e.date === today), [expenses, today]);

  const finalCashBreakdown = useMemo(() => {
      const breakdown: { [methodName: string]: number } = {};
      paymentsTodayDetails.forEach(p => {
          breakdown[p.methodName] = (breakdown[p.methodName] || 0) + p.amount;
      });
      return breakdown;
  }, [paymentsTodayDetails]);
  // --- END: Data calculations for Summary Modal ---

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
    const remainingAmount = order.amount - (order.discount || 0) - totalPaid;

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

        const tableHeaders = `
            <tr>
                <th>No. Nota</th>
                <th>Deskripsi Item</th>
                <th>Qty</th>
                <th class="currency">Total Tagihan</th>
                <th class="currency">Dibayar</th>
                <th class="currency">Sisa</th>
                <th>Tanggal Jatuh Tempo</th>
            </tr>`;
            
        const tableRows = reportItems.flatMap(receivable => {
            const fullOrder = allOrders.find(o => o.id === receivable.id);
            if (!fullOrder) return [];
    
            const paid = receivable.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
            const remaining = receivable.amount - (receivable.discount || 0) - paid;

            return fullOrder.orderItems.map((item, index) => {
                const product = products.find(p => p.id === item.productId);
                const isFirstItem = index === 0;
    
                return `
                    <tr>
                        ${isFirstItem ? `<td rowSpan="${fullOrder.orderItems.length}">${receivable.id}</td>` : ''}
                        <td>${item.description || product?.name || 'N/A'}</td>
                        <td>${item.qty} Pcs</td>
                        ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(receivable.amount)}</td>` : ''}
                        ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(paid)}</td>` : ''}
                        ${isFirstItem ? `<td class="currency" rowSpan="${fullOrder.orderItems.length}">${formatCurrency(remaining)}</td>` : ''}
                        ${isFirstItem ? `<td rowSpan="${fullOrder.orderItems.length}">${formatDate(receivable.due)}</td>` : ''}
                    </tr>
                `;
            }).join('');
        }).join('');

        const totalSisa = reportItems.reduce((sum, r) => {
            const paid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
            const remaining = r.amount - (r.discount || 0) - paid;
            return sum + remaining;
        }, 0);

        const summaryHtml = `
            <div class="summary-box">
                <table style="width: 250px; float: right; border: none;">
                    <tr><td style="border:none;">Total Sisa Tagihan:</td><td style="border:none;" class="currency"><strong>${formatCurrency(totalSisa)}</strong></td></tr>
                </table>
            </div>`;

        const printContent = `
            <html>
                <head>
                    <title>${reportTitle} - ${filterCustomer}</title>
                    <style>
                        body { font-family: Arial, sans-serif; font-size: 10pt; color: #333; }
                        .page { width: 190mm; min-height: 270mm; padding: 10mm; margin: 5mm auto; background: white; }
                        .header, .customer-info, .summary { display: flex; justify-content: space-between; align-items: flex-start; }
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
                            <strong>${filterCustomer}</strong>
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
            title="Kas Awal" 
            value={formatCurrency(initialCash)}
            gradient="bg-gradient-to-br from-gray-500 to-gray-600"
            onClick={() => setSummaryModal({ type: 'initialCashInfo', title: 'Informasi Kas Awal' })}
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
            title="Pengeluaran Hari Ini" 
            value={formatCurrency(expensesToday)}
            gradient="bg-gradient-to-br from-rose-500 to-red-500"
            onClick={() => setSummaryModal({ type: 'expenses', title: 'Riwayat Pengeluaran Hari Ini' })}
        />
        <StatCard 
            icon={<CurrencyDollarIcon />} 
            title="Kas Akhir" 
            value={formatCurrency(finalCash)}
            gradient="bg-gradient-to-br from-fuchsia-500 to-purple-500"
            onClick={() => setSummaryModal({ type: 'finalCash', title: 'Rincian Kas Akhir' })}
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
                  className="flex items-center space-x-2 text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  <FilterIcon className="h-4 w-4" />
                  <span>Filter</span>
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
                            disabled={!filterCustomer || unpaidFilteredItems.length === 0}
                            title={!filterCustomer ? 'Pilih pelanggan di filter untuk mengaktifkan' : 'Bayar semua nota yang belum lunas untuk pelanggan ini'}
                        >
                            Bayar Langsung ({unpaidFilteredItems.length} Nota)
                        </button>
                        {filterStatus === 'Belum Lunas' && (
                             <button 
                                onClick={() => setBulkDueDateModalOpen(true)}
                                className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 mr-2 disabled:bg-amber-300 disabled:cursor-not-allowed"
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
                const orderDate = item.isLegacy ? new Date(item.legacyData!.order_date).toLocaleDateString('id-ID') : (allOrders.find(o => o.id === item.id) ? new Date(allOrders.find(o => o.id === item.id)!.orderDate).toLocaleDateString('id-ID') : 'N/A');

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
                                      <a href="#" onClick={(e) => { e.preventDefault(); handleSendWhatsApp(item); }} className="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100" role="menuitem">Kirim Whatsapp</a>
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
          fullOrder={allOrders.find(o => o.id === selectedOrder.id)}
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
            currentAmount={initialCash}
            onClose={() => setInitialCashModalOpen(false)}
            onSave={onUpdateInitialCash}
        />
    )}
    {summaryModal.type && (
        <SummaryInfoModal
            isOpen={!!summaryModal.type}
            onClose={() => setSummaryModal({ type: null, title: '' })}
            title={summaryModal.title}
            type={summaryModal.type}
            data={{
                payments: paymentsTodayDetails,
                receivables: receivablesTodayUnpaidDetails,
                expenses: expensesTodayDetails,
                finalCashBreakdown: finalCashBreakdown,
                finalCashTotal: finalCash
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
    </>
  );
};

export default Receivables;