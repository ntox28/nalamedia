
import React, { useState, useEffect, useMemo } from 'react';
import { Cog6ToothIcon, PlusCircleIcon, TrashIcon, PencilIcon, PrinterIcon, PlayIcon, ClipboardIcon, ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, MagnifyingGlassIcon } from './Icons';
import { type SavedOrder, type OrderItemData, type ProductData, type FinishingData, type CategoryData, type KanbanData, type CardData, type CustomerData } from '../types';

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


// Modal Component
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
              type="text"
              id="nota-start"
              value={startNumber}
              onChange={(e) => setStartNumber(e.target.value)}
              className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-gray-100"
              placeholder="e.g., 00001"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Nomor awal akan berjalan otomatis dari database. Anda hanya dapat mengubah prefix.</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-sm font-medium text-gray-600">Contoh nomor nota berikutnya:</p>
            <p className="text-lg font-bold text-pink-600 mt-1">{prefix}{startNumber}</p>
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
  onUpdateNoteSettings: (prefix: string) => void;
}

const Sales: React.FC<SalesProps> = ({ 
  unprocessedOrders, onSaveOrder, onUpdateOrder, onProcessOrder, onDeleteOrder, 
  products, categories, finishings, customers,
  allOrders, boardData, noteCounter, notePrefix, onUpdateNoteSettings
}) => {
  const [orderItems, setOrderItems] = useState<OrderItemData[]>(getInitialState().orderItems);
  const [customer, setCustomer] = useState(getInitialState().customer);
  const [orderDate, setOrderDate] = useState(getInitialState().orderDate);
  const [totalPrice, setTotalPrice] = useState(0);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ title: string; orders: CardData[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // New state for nota settings
  const [noteStartNumberStr, setNoteStartNumberStr] = useState('00001'); // This determines padding
  const [isNotaSettingsOpen, setIsNotaSettingsOpen] = useState(false);

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
    
  const needsProcessingCount = getItemsCount(boardData.queue);
  const finishedInWarehouseCount = getItemsCount(boardData.warehouse);
  const deliveredCount = getItemsCount(boardData.delivered);

  const handleSaveNotaSettings = (newPrefix: string) => {
    onUpdateNoteSettings(newPrefix);
    setIsNotaSettingsOpen(false);
  };

  const getNextNotaNumber = () => {
    const paddingLength = noteStartNumberStr.length > 0 ? noteStartNumberStr.length : 5;
    return `${notePrefix}${noteCounter.toString().padStart(paddingLength, '0')}`;
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

  useEffect(() => {
    const calculateTotal = () => {
      if (!customer) {
        setTotalPrice(0);
        return;
      }
      
      const currentCustomerData = customers.find(c => c.name === customer);
      const customerLevel = currentCustomerData ? currentCustomerData.level : 'End Customer';
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
        
        total += (priceMultiplier * materialPrice + finishingPrice) * item.qty;
      });
      setTotalPrice(total);
    };
    calculateTotal();
  }, [orderItems, customer, products, finishings, customers, categories]);

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
  
  const resetForm = () => {
    setOrderItems(getInitialState().orderItems);
    setCustomer(getInitialState().customer);
    setOrderDate(getInitialState().orderDate);
    setEditingOrderId(null);
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

    const orderData: Omit<SavedOrder, 'id'> = {
        customer,
        orderDate,
        orderItems,
        details: orderDetails || 'Tidak ada detail',
        totalPrice,
    };

    if (editingOrderId) {
        onUpdateOrder({ ...orderData, id: editingOrderId });
        alert(`Order ${editingOrderId} berhasil diperbarui!`);
    } else {
        const notaNumber = getNextNotaNumber();
        onSaveOrder({ ...orderData, id: notaNumber });
        alert(`Order ${notaNumber} berhasil disimpan di 'Order Hari Ini'.`);
    }
    resetForm();
  };
  
  const handleEdit = (order: SavedOrder) => {
      setEditingOrderId(order.id);
      setCustomer(order.customer);
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
                padding: 5px 0;
                line-height: 1.2;
              }
              .spk-container {
                width: 170px;
                margin: 0 auto;
              }
              p, div {
                margin: 0;
                padding: 0;
                word-wrap: break-word;
              }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider {
                border: 0;
                border-top: 1px dashed black;
                margin: 4px 0;
              }
              .customer-name {
                  font-size: 12px;
                  font-weight: bold;
              }
              .item-details {
                  padding-left: 14px;
                  text-indent: -14px;
              }
              .attention-box {
                  border: 1px solid #000;
                  padding: 4px;
                  margin-top: 5px;
                  text-align: center;
              }
              .attention-small {
                  font-size: 8px;
                  line-height: 1.1;
              }
            </style>
          </head>
          <body>
            <div class="spk-container">
                <div class="center bold">** SPK PRODUKSI **</div>
                <div class="divider"></div>
                <div class="center bold">${order.customer}</div>
                <div class="center bold">${order.id}</div>
                <div class="center">${new Date(order.orderDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div class="divider"></div>
                <div>No.&nbsp;&nbsp;Detail Pesanan</div>
                <div class="divider"></div>
                
                ${order.orderItems.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    const category = categories.find(c => c.name === product?.category);
                    const isAreaBased = category?.unitType === 'Per Luas';

                    const detailsParts = [];
                    if (isAreaBased && parseFloat(item.length) > 0 && parseFloat(item.width) > 0) {
                        detailsParts.push(`${item.length}x${item.width}m`);
                    }
                    detailsParts.push(`${item.qty} Pcs`);
                    if (item.finishing && item.finishing !== 'Tanpa Finishing') {
                        detailsParts.push(item.finishing);
                    }
                    
                    const detailsLine = detailsParts.join(' - ');

                    return `
                        <div style="margin-bottom: 4px;">
                            <div class="item-details"><span class="bold">${index + 1}. ${item.description || 'Tanpa deskripsi'}</span></div>
                            <div class="item-details">&nbsp;&nbsp;&nbsp;${product?.name || 'N/A'}</div>
                            <div class="item-details">&nbsp;&nbsp;&nbsp;${detailsLine}</div>
                        </div>
                    `;
                }).join('')}

                <div class="divider"></div>
                <div class="attention-box">
                    <div class="center bold">PERHATIAN</div>
                    <div class="attention-small center">Cek data pekerjaan sebelum cetak.</div>
                    <div class="attention-small center">Pastikan semua data benar.</div>
                    <div class="attention-small center">Tempel struk ini Ke Barang.</div>
                    <div class="attention-small center">Jika Sudah Selesai Semua.</div>
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
        currentStartNumber={getNextNotaNumber().replace(notePrefix, '')}
      />
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
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-bold">{editingOrderId ? `Edit Order ${editingOrderId}` : 'Tambah Order Baru'}</h2>
            <button onClick={handleNewOrder} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-300">Buat Baru</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">No. Nota (Otomatis)</label>
                <div className="flex items-center mt-1">
                  <input type="text" readOnly value={editingOrderId || getNextNotaNumber()} className="w-full p-2 border rounded-md bg-gray-100" />
                  <button type="button" onClick={() => setIsNotaSettingsOpen(true)} className="ml-2 p-2 text-gray-500 hover:text-pink-600 transition-colors"><Cog6ToothIcon /></button>
                </div>
              </div>
              <div>
                <label htmlFor="order-date" className="block text-sm font-medium">Tanggal</label>
                <input type="date" id="order-date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
              </div>
              <div>
                <label htmlFor="customer" className="block text-sm font-medium">Pelanggan</label>
                <select id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1 w-full p-2 border bg-white rounded-md" required>
                  <option value="" disabled>Pilih Pelanggan</option>
                  {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
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
              <button type="submit" className="bg-pink-600 text-white py-3 px-8 rounded-lg font-bold hover:bg-pink-700">{editingOrderId ? 'Update Order' : 'Simpan Order'}</button>
            </div>
          </form>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
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
                    <h3 className="font-bold text-purple-700">{order.customer}</h3>
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
        </div>
      </div>
    </>
  );
};

export default Sales;
