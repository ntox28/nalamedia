

import React, { useState, useMemo, useEffect } from 'react';
import { type KanbanData, type CardData, type ProductionStatus, type SavedOrder, type ProductData, type CategoryData, type ReceivableItem } from '../types';
import { ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, MagnifyingGlassIcon } from './Icons';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 10;

// --- START: MODAL COMPONENTS ---

const ReusableModal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; maxWidth?: string }> = ({ title, onClose, children, maxWidth = 'max-w-lg' }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className={`bg-white rounded-xl shadow-2xl p-6 w-full ${maxWidth} max-h-[90vh] flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-5">
                <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">{children}</div>
        </div>
    </div>
);

const OrderDetailModal: React.FC<{ order: SavedOrder; onClose: () => void; }> = ({ order, onClose }) => (
    <ReusableModal title={`Detail Order: ${order.id}`} onClose={onClose} maxWidth="max-w-2xl">
        <div className="space-y-4">
            <div className="flex justify-between text-sm">
                <div><p className="text-gray-500">Pelanggan</p><p className="font-semibold">{order.customer}</p></div>
                <div className="text-right"><p className="text-gray-500">Tanggal Order</p><p className="font-semibold">{new Date(order.orderDate).toLocaleDateString('id-ID')}</p></div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-700 mb-2">Item Pesanan</h4>
                <div className="space-y-2">
                    {order.orderItems.map(item => (
                        <div key={item.id} className="bg-gray-50 p-3 rounded-md border text-sm">
                            <p className="font-semibold">{item.description}</p>
                            <p className="text-xs text-gray-600">Ukuran: {item.length}x{item.width}m | Qty: {item.qty} | Finishing: {item.finishing}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </ReusableModal>
);

const DeliveryNoteModal: React.FC<{ order: CardData; onClose: () => void; onConfirm: (orderId: string, note: string) => void; }> = ({ order, onClose, onConfirm }) => {
    const [note, setNote] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(order.id, note);
    };
    return (
        <ReusableModal title={`Catatan Penyerahan: ${order.id}`} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Catatan</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} className="mt-1 w-full p-2 border rounded-md" placeholder="Contoh: Diambil oleh pelanggan / Dikirim oleh Adnan." required />
                </div>
                <div className="border-t pt-4 flex justify-end">
                    <button type="submit" className="bg-pink-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-pink-700">Konfirmasi Penyerahan</button>
                </div>
            </form>
        </ReusableModal>
    );
};

const DeliveredDetailsModal: React.FC<{ receivable: ReceivableItem; fullOrder?: SavedOrder; onClose: () => void; }> = ({ receivable, fullOrder, onClose }) => (
    <ReusableModal title={`Detail Order: ${receivable.id}`} onClose={onClose} maxWidth="max-w-2xl">
        <div className="space-y-4">
            <div className="flex justify-between text-sm">
                <div><p className="text-gray-500">Pelanggan</p><p className="font-semibold">{receivable.customer}</p></div>
                <div className="text-right"><p className="text-gray-500">Tanggal Diserahkan</p><p className="font-semibold">{new Date(receivable.deliveryDate!).toLocaleDateString('id-ID')}</p></div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-700 mb-2">Item Pesanan</h4>
                <div className="space-y-2">
                    {fullOrder?.orderItems.map(item => (
                        <div key={item.id} className="bg-gray-50 p-3 rounded-md border text-sm">
                            <p className="font-semibold">{item.description}</p>
                            <p className="text-xs text-gray-600">Ukuran: {item.length}x{item.width}m | Qty: {item.qty} | Finishing: {item.finishing}</p>
                        </div>
                    ))}
                </div>
            </div>
            {receivable.deliveryNote && (
                 <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Catatan Penyerahan</h4>
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
                        <p className="text-sm text-amber-800">{receivable.deliveryNote}</p>
                    </div>
                </div>
            )}
        </div>
    </ReusableModal>
);

// --- END: MODAL COMPONENTS ---

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


interface ProductionProps {
  boardData: KanbanData;
  allOrders: SavedOrder[];
  unprocessedOrders: SavedOrder[];
  receivables: ReceivableItem[];
  products: ProductData[];
  categories: CategoryData[];
  onProductionMove: (orderId: string, from: ProductionStatus, to: ProductionStatus) => void;
  onDeliverOrder: (orderId: string, deliveryNote: string) => void;
  onCancelQueue: (orderId: string) => void;
}

const TABS: { key: ProductionStatus; label: string }[] = [
  { key: 'queue', label: 'Antrian Cetak' },
  { key: 'printing', label: 'Proses Cetak' },
  { key: 'warehouse', label: 'Gudang (Siap Ambil)' },
  { key: 'delivered', label: 'Delivered (Telah Dikirim)' },
];

const Production: React.FC<ProductionProps> = ({ boardData, allOrders, unprocessedOrders, receivables, products, categories, onProductionMove, onDeliverOrder, onCancelQueue }) => {
  const [activeTab, setActiveTab] = useState<ProductionStatus>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deliveryModal, setDeliveryModal] = useState<{ isOpen: boolean; order?: CardData }>({ isOpen: false });
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; receivable?: ReceivableItem }>({ isOpen: false });
  const [detailModalOrder, setDetailModalOrder] = useState<SavedOrder | null>(null);

  // Filters for Delivered tab
  const today = new Date().toISOString().substring(0, 10);
  const [filterStartDate, setFilterStartDate] = useState(today);
  const [filterEndDate, setFilterEndDate] = useState(today);

  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
  }, [activeTab]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate]);


  const getItemsCount = (cards: CardData[]): number => {
    return cards.reduce((sum, card) => {
        const order = allOrders.find(o => o.id === card.id);
        return sum + (order?.orderItems.length || 0);
    }, 0);
  };
  
  const unprocessedItemsCount = useMemo(() => {
    return unprocessedOrders.reduce((sum, order) => sum + (order.orderItems.length || 0), 0);
  }, [unprocessedOrders]);

  const handleConfirmDelivery = (orderId: string, note: string) => {
    onDeliverOrder(orderId, note);
    setDeliveryModal({ isOpen: false });
  };

  const filteredData = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    let data: (CardData | ReceivableItem | SavedOrder)[] = [];

    switch(activeTab) {
        case 'queue':
            data = unprocessedOrders.sort((a,b) => b.id.localeCompare(a.id));
            break;
        case 'printing':
            data = boardData.printing;
            break;
        case 'warehouse':
            data = boardData.warehouse;
            break;
        case 'delivered':
            data = receivables.filter(r => 
                r.productionStatus === 'Telah Dikirim' && 
                r.deliveryDate && r.deliveryDate >= filterStartDate && r.deliveryDate <= filterEndDate
            ).sort((a,b) => new Date(b.deliveryDate!).getTime() - new Date(a.deliveryDate!).getTime());
            break;
    }

    if (searchQuery) {
        return data.filter(item => 
            item.id.toLowerCase().includes(lowerCaseQuery) ||
            item.customer.toLowerCase().includes(lowerCaseQuery)
        );
    }
    return data;
  }, [activeTab, searchQuery, boardData, unprocessedOrders, receivables, filterStartDate, filterEndDate]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);


  const renderActionButtons = (order: CardData, status: ProductionStatus) => {
    switch (status) {
      case 'printing':
        return (
          <div className="flex flex-col items-start space-y-2">
            <button onClick={() => onProductionMove(order.id, 'printing', 'warehouse')} className="bg-cyan-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-cyan-700 w-full text-center">Selesai</button>
            <button onClick={() => onProductionMove(order.id, 'printing', 'queue')} className="bg-white text-gray-700 border border-gray-300 px-3 py-1 rounded-md text-xs font-semibold hover:bg-gray-100 w-full text-center">Batal Proses</button>
          </div>
        );
      case 'warehouse':
        return <button onClick={() => setDeliveryModal({ isOpen: true, order })} className="bg-teal-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-teal-700 w-full text-center">Serahkan</button>;
      default:
        return null;
    }
  };

  return (
    <>
      {deliveryModal.isOpen && deliveryModal.order && (
          <DeliveryNoteModal order={deliveryModal.order} onClose={() => setDeliveryModal({ isOpen: false })} onConfirm={handleConfirmDelivery} />
      )}
      {detailsModal.isOpen && detailsModal.receivable && (
          <DeliveredDetailsModal receivable={detailsModal.receivable} fullOrder={allOrders.find(o => o.id === detailsModal.receivable?.id)} onClose={() => setDetailsModal({ isOpen: false })} />
      )}
      {detailModalOrder && <OrderDetailModal order={detailModalOrder} onClose={() => setDetailModalOrder(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
           <StatCard icon={<ShoppingCartIcon />} title="Antrian Cetak" value={`${unprocessedItemsCount} Item`} onClick={() => setActiveTab('queue')} gradient="bg-gradient-to-br from-blue-500 to-sky-500" />
           <StatCard icon={<WrenchScrewdriverIcon />} title="Proses Cetak" value={`${getItemsCount(boardData.printing)} Item`} onClick={() => setActiveTab('printing')} gradient="bg-gradient-to-br from-amber-500 to-yellow-500" />
           <StatCard icon={<CubeIcon />} title="Siap Ambil" value={`${getItemsCount(boardData.warehouse)} Item`} onClick={() => setActiveTab('warehouse')} gradient="bg-gradient-to-br from-teal-500 to-cyan-500" />
           <StatCard icon={<HomeIcon />} title="Terkirim Hari Ini" value={`${receivables.filter(r => r.deliveryDate === today).length} Nota`} onClick={() => setActiveTab('delivered')} gradient="bg-gradient-to-br from-pink-500 to-rose-500" />
      </div>
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold mb-4">Status Produksi / Order</h2>
        
        <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-6" aria-label="Tabs">{TABS.map(tab => (<button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`${ activeTab === tab.key ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300' } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}>{tab.label}</button>))} </nav></div>

        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MagnifyingGlassIcon className="h-5 w-5 text-gray-400" /></div><input type="text" placeholder="Cari order..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-80 pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500" /></div>
              {activeTab === 'delivered' && (
                  <div className="flex items-center space-x-2 text-sm">
                      <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-gray-600"/>
                      <span>-</span>
                      <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-gray-600"/>
                  </div>
              )}
          </div>
          <div className="overflow-x-auto">
            {activeTab === 'queue' ? (
                 <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">No. Nota</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Item</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{paginatedData.length > 0 ? (paginatedData as SavedOrder[]).map(order => (<tr key={order.id} className="hover:bg-gray-50"><td className="py-4 px-4 text-sm">{order.customer}</td><td className="py-4 px-4 text-sm font-medium">{order.id}</td><td className="py-4 px-4 text-sm">{order.orderItems.length} Item</td><td className="py-4 px-4 text-sm"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-fuchsia-100 text-fuchsia-800">Dalam Antrian</span></td><td className="py-4 px-4 text-sm"><button onClick={() => setDetailModalOrder(order)} className="text-blue-600 hover:underline">Lihat Detail</button></td></tr>)) : (<tr><td colSpan={5} className="text-center py-16 text-gray-500">Tidak ada order di antrian.</td></tr>)}</tbody></table>
            ) : activeTab !== 'delivered' ? (
                <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">No. Nota</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Ukuran</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Qty</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Finishing</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{paginatedData.length > 0 ? (paginatedData.flatMap(data => { const fullOrder = allOrders.find(o => o.id === data.id); if (!fullOrder) return []; return fullOrder.orderItems.map((item, index) => { const product = products.find(p => p.id === item.productId); const category = categories.find(c => c.name === product?.category); const isAreaBased = category?.unitType === 'Per Luas'; const isFirstItem = index === 0; return (<tr key={`${fullOrder.id}-${item.id}`} className="hover:bg-gray-50">{isFirstItem && (<td rowSpan={fullOrder.orderItems.length} className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top border-r">{fullOrder.id}</td>)}{isFirstItem && (<td rowSpan={fullOrder.orderItems.length} className="py-4 px-4 whitespace-nowrap text-sm text-gray-600 align-top border-r">{fullOrder.customer}</td>)}<td className="py-4 px-4 text-sm text-gray-700 max-w-xs">{item.description ? (<><p className="font-semibold">{item.description}</p><p className="text-xs text-gray-500">{product?.name || 'N/A'}</p></>) : (<p className="font-semibold">{product?.name || 'N/A'}</p>)}</td><td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{isAreaBased ? `${item.length} x ${item.width} m` : '-'}</td><td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{item.qty} Pcs</td><td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{item.finishing}</td>{isFirstItem && (<td rowSpan={fullOrder.orderItems.length} className="py-4 px-4 whitespace-nowrap text-sm align-top border-l">{renderActionButtons(data as CardData, activeTab)}</td>)}</tr>);});})) : (<tr><td colSpan={7} className="text-center py-16 text-gray-500">Tidak ada pesanan dalam status ini.</td></tr>)}</tbody></table>
            ) : (
                <table className="min-w-full bg-white"><thead className="bg-gray-50"><tr><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">No. Nota</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Jumlah Item</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Tanggal Diserahkan</th><th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th></tr></thead><tbody className="divide-y divide-gray-200">{paginatedData.length > 0 ? ((paginatedData as ReceivableItem[]).map(receivable => { const fullOrder = allOrders.find(o => o.id === receivable.id); return (<tr key={receivable.id} className="hover:bg-gray-50"><td className="py-4 px-4 text-sm">{receivable.customer}</td><td className="py-4 px-4 text-sm font-medium">{receivable.id}</td><td className="py-4 px-4 text-sm">{fullOrder?.orderItems.length || 0} Item</td><td className="py-4 px-4 text-sm">{new Date(receivable.deliveryDate!).toLocaleDateString('id-ID')}</td><td className="py-4 px-4 text-sm"><button onClick={() => setDetailsModal({ isOpen: true, receivable })} className="text-blue-600 hover:underline">Lihat Detail</button></td></tr>);})) : (<tr><td colSpan={5} className="text-center py-16 text-gray-500">Tidak ada data penyerahan pada periode ini.</td></tr>)}</tbody></table>
            )}
          </div>
           <Pagination
            totalItems={filteredData.length}
            itemsPerPage={ITEMS_PER_PAGE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </>
  );
};

export default Production;