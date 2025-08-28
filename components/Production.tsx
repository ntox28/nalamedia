
import React, { useState, useMemo } from 'react';
import { type KanbanData, type CardData, type ProductionStatus, type SavedOrder, type ProductData, type CategoryData } from '../types';
import { ShoppingCartIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon, MagnifyingGlassIcon } from './Icons';

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

interface ProductionProps {
  boardData: KanbanData;
  allOrders: SavedOrder[];
  products: ProductData[];
  categories: CategoryData[];
  onProductionMove: (orderId: string, from: ProductionStatus, to: ProductionStatus) => void;
  onCancelQueue: (orderId: string) => void;
}

const TABS: { key: ProductionStatus; label: string }[] = [
  { key: 'queue', label: 'Antrian Cetak' },
  { key: 'printing', label: 'Proses Cetak' },
  { key: 'warehouse', label: 'Gudang (Siap Ambil)' },
  { key: 'delivered', label: 'Delivered (Telah Dikirim)' },
];

const Production: React.FC<ProductionProps> = ({ boardData, allOrders, products, categories, onProductionMove, onCancelQueue }) => {
  const [activeTab, setActiveTab] = useState<ProductionStatus>('queue');
  const [modalData, setModalData] = useState<{ title: string; orders: CardData[] } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const getItemsCount = (cards: CardData[]): number => {
      return cards.reduce((sum, card) => {
          const order = allOrders.find(o => o.id === card.id);
          return sum + (order?.orderItems.length || 0);
      }, 0);
  };

  // Stats for cards
  const today = new Date().toISOString().substring(0, 10);
  const totalOrdersToday = allOrders
    .filter(o => o.orderDate === today)
    .reduce((sum, order) => sum + order.orderItems.length, 0);

  const needsProcessingCount = getItemsCount(boardData.queue);
  const finishedInWarehouseCount = getItemsCount(boardData.warehouse);
  const deliveredCount = getItemsCount(boardData.delivered);
  
  const filteredOrdersInTab = useMemo(() => {
    const ordersInTab = boardData[activeTab] || [];
    if (!searchQuery) {
      return ordersInTab;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    return ordersInTab.filter(card => {
        const fullOrder = allOrders.find(o => o.id === card.id);
        return (
            card.id.toLowerCase().includes(lowerCaseQuery) ||
            card.customer.toLowerCase().includes(lowerCaseQuery) ||
            (fullOrder && fullOrder.details.toLowerCase().includes(lowerCaseQuery))
        );
    });
  }, [boardData, activeTab, searchQuery, allOrders]);

  const renderActionButtons = (order: CardData, status: ProductionStatus) => {
    switch (status) {
      case 'queue':
        return (
          <div className="flex flex-col items-start space-y-2">
            <button
              onClick={() => onProductionMove(order.id, 'queue', 'printing')}
              className="bg-pink-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-pink-700 transition-colors w-full text-center"
            >
              Proses
            </button>
            <button
              onClick={() => onCancelQueue(order.id)}
              className="bg-white text-gray-700 border border-gray-300 px-3 py-1 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors w-full text-center"
            >
              Batal Antri
            </button>
          </div>
        );
      case 'printing':
        return (
          <div className="flex flex-col items-start space-y-2">
            <button
              onClick={() => onProductionMove(order.id, 'printing', 'warehouse')}
              className="bg-cyan-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-cyan-700 transition-colors w-full text-center"
            >
              Selesai
            </button>
            <button
              onClick={() => onProductionMove(order.id, 'printing', 'queue')}
              className="bg-white text-gray-700 border border-gray-300 px-3 py-1 rounded-md text-xs font-semibold hover:bg-gray-100 transition-colors w-full text-center"
            >
              Batal Proses
            </button>
          </div>
        );
      case 'warehouse':
        return (
           <button
            onClick={() => onProductionMove(order.id, 'warehouse', 'delivered')}
            className="bg-teal-600 text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-teal-700 transition-colors w-full text-center"
          >
            Serahkan
          </button>
        );
      case 'delivered':
        return null; // No actions
      default:
        return null;
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
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-bold mb-4">Status Produksi / Order</h2>
        
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${
                  activeTab === tab.key
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                {tab.label}
                <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-600'}`}>
                    {boardData[tab.key]?.length || 0}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-6">
          <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                  type="text"
                  placeholder="Cari order..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-1/3 pl-10 pr-4 py-2 border rounded-lg focus:ring-pink-500 focus:border-pink-500"
              />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Nota</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ukuran</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finishing</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrdersInTab.length > 0 ? (
                  filteredOrdersInTab.flatMap(card => {
                    const fullOrder = allOrders.find(o => o.id === card.id);
                    if (!fullOrder) return []; // Should not happen
                    
                    return fullOrder.orderItems.map((item, index) => {
                        const product = products.find(p => p.id === item.productId);
                        const category = categories.find(c => c.name === product?.category);
                        const isAreaBased = category?.unitType === 'Per Luas';
                        const isFirstItem = index === 0;

                        return (
                            <tr key={`${fullOrder.id}-${item.id}`} className="hover:bg-gray-50">
                                {isFirstItem && (
                                    <td rowSpan={fullOrder.orderItems.length} className="py-4 px-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top border-r">{fullOrder.id}</td>
                                )}
                                {isFirstItem && (
                                  <td rowSpan={fullOrder.orderItems.length} className="py-4 px-4 whitespace-nowrap text-sm text-gray-600 align-top border-r">{fullOrder.customer}</td>
                                )}

                                <td className="py-4 px-4 text-sm text-gray-700 max-w-xs">
                                  {item.description ? (
                                      <>
                                          <p className="font-semibold">{item.description}</p>
                                          <p className="text-xs text-gray-500">{product?.name || 'N/A'}</p>
                                      </>
                                  ) : (
                                      <p className="font-semibold">{product?.name || 'N/A'}</p> 
                                  )}
                                </td>
                                <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{isAreaBased ? `${item.length} x ${item.width} m` : '-'}</td>
                                <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{item.qty} Pcs</td>
                                <td className="py-4 px-4 whitespace-nowrap text-sm text-gray-500">{item.finishing}</td>
                                
                                {isFirstItem && (
                                  <td rowSpan={fullOrder.orderItems.length} className="py-4 px-4 whitespace-nowrap text-sm align-top border-l">
                                      {renderActionButtons(card, activeTab)}
                                  </td>
                                )}
                            </tr>
                        );
                    });
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-500">
                      Tidak ada pesanan dalam status ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default Production;
