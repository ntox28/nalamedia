
import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpIcon, CurrencyDollarIcon, ShoppingCartIcon, UsersIcon, ReceiptTaxIcon, WrenchScrewdriverIcon, CubeIcon, HomeIcon } from './Icons';
import { type MenuKey, type CardData, type KanbanData, type SavedOrder, type ExpenseItem, type ReceivableItem, type ProductionStatusDisplay, type ProductData, type LegacyReceivable } from '../types';

const TABS = [
    { key: 'penjualan', label: 'Dasbor Penjualan' },
    { key: 'produksi', label: 'Dasbor Produksi' }
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

const RecentOrderCard: React.FC<{ order: CardData; onClick: () => void }> = ({ order, onClick }) => {
    const detailsToShow = order.details.split('\n');
    const firstLine = detailsToShow[0];
    const displayDetail = detailsToShow.length > 1 ? `${firstLine} ...` : firstLine;

    return (
        <div onClick={onClick} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-pink-50 cursor-pointer transition-colors">
            <div>
                <p className="font-semibold text-sm text-gray-800">{order.id}</p>
                <p className="text-xs text-gray-600">{order.customer}</p>
            </div>
            <p className="text-xs text-right text-gray-500 max-w-[50%] truncate">{displayDetail}</p>
        </div>
    );
};

interface DashboardProps {
    onNavigate: (menu: MenuKey) => void;
    allOrders: SavedOrder[];
    boardData: KanbanData;
    menuPermissions: string[];
    expenses: ExpenseItem[];
    receivables: ReceivableItem[];
    products: ProductData[];
    legacyReceivables: LegacyReceivable[];
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, allOrders, boardData, menuPermissions, expenses, receivables, products, legacyReceivables }) => {
  const accessibleTabs = useMemo(() => TABS.filter(tab => menuPermissions.includes(`dashboard/${tab.key}`)), [menuPermissions]);
  
  const [activeTab, setActiveTab] = useState(accessibleTabs.length > 0 ? accessibleTabs[0].key : '');
  
  useEffect(() => {
    if (accessibleTabs.length > 0 && !accessibleTabs.some(t => t.key === activeTab)) {
        setActiveTab(accessibleTabs[0].key);
    }
  }, [accessibleTabs, activeTab]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  
  // --- Kalkulasi untuk Dasbor Penjualan ---
    const today = new Date().toISOString().substring(0, 10);

    const incomeToday = useMemo(() => {
        return receivables.reduce((total, receivable) => {
            const paymentsToday = receivable.payments?.filter(p => p.date === today) || [];
            const sumOfPayments = paymentsToday.reduce((sum, p) => sum + p.amount, 0);
            return total + sumOfPayments;
        }, 0);
    }, [receivables, today]);

    const transactionsToday = useMemo(() => allOrders.filter(o => o.orderDate === today).length, [allOrders, today]);

    const activeReceivablesAmount = useMemo(() => {
        const newSystemUnpaid = receivables
            .filter(r => r.paymentStatus === 'Belum Lunas')
            .reduce((sum, r) => {
                const totalPaid = r.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                const remaining = r.amount - (r.discount || 0) - totalPaid;
                return sum + (remaining > 0 ? remaining : 0);
            }, 0);

        const legacySystemUnpaid = legacyReceivables.reduce((sum, r) => sum + r.amount, 0);

        return newSystemUnpaid + legacySystemUnpaid;
    }, [receivables, legacyReceivables]);

    const expensesToday = useMemo(() => {
        return expenses
            .filter(e => e.date === today)
            .reduce((sum, e) => sum + e.amount, 0);
    }, [expenses, today]);

    const financialFlowData = useMemo(() => {
        // Total value of orders created today
        const totalRevenueToday = allOrders
            .filter(o => o.orderDate === today)
            .reduce((sum, order) => sum + order.totalPrice, 0);

        // Total outstanding amount for orders created today
        const receivablesToday = allOrders
            .filter(o => o.orderDate === today)
            .reduce((sum, order) => {
                const receivable = receivables.find(r => r.id === order.id);
                if (receivable) { // It has been processed for payment
                    const totalPaid = receivable.payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0;
                    const remaining = receivable.amount - (receivable.discount || 0) - totalPaid;
                    return sum + (remaining > 0 ? remaining : 0);
                } else { // It's an unprocessed order, so full amount is receivable
                    return sum + order.totalPrice;
                }
            }, 0);

        return [
          { name: 'Total Pendapatan', value: totalRevenueToday },
          { name: 'Dibayar', value: incomeToday },
          { name: 'Piutang', value: receivablesToday },
          { name: 'Pengeluaran', value: expensesToday },
        ].filter(item => item.value > 0);
    }, [allOrders, receivables, incomeToday, expensesToday, today]);

    const PIE_COLORS_FINANCE = ['#3b82f6', '#22c55e', '#f97316', '#ef4444']; // Blue, Green, Orange, Red
    
    const recentPayments = useMemo(() => {
        const paymentsToday: any[] = [];
        receivables.forEach(receivable => {
            if (receivable.payments) {
                receivable.payments.forEach(payment => {
                    if (payment.date === today) {
                        const order = allOrders.find(o => o.id === receivable.id);
                        paymentsToday.push({
                            date: payment.date,
                            orderId: receivable.id,
                            customer: receivable.customer,
                            description: order?.details.split('\n')[0] || 'N/A',
                            source: payment.methodName,
                            amount: payment.amount,
                        });
                    }
                });
            }
        });
        return paymentsToday.sort((a, b) => b.orderId.localeCompare(a.orderId)).slice(0, 10);
    }, [receivables, allOrders, today]);

    // --- Kalkulasi untuk Grafik ---
    const salesChartData = useMemo(() => {
        const last30Days: { [key: string]: number } = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().substring(0, 10);
            last30Days[key] = 0;
        }

        allOrders.forEach(order => {
            if (last30Days[order.orderDate] !== undefined) {
                last30Days[order.orderDate] += order.totalPrice;
            }
        });

        return Object.entries(last30Days).map(([date, total]) => ({
            name: new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' }),
            Penjualan: total,
        }));
    }, [allOrders]);

    const productionOrdersChartData = useMemo(() => {
        const last30Days: { [key: string]: number } = {};
        const labels: { [key: string]: string } = {};

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().substring(0, 10);
            last30Days[key] = 0;
            labels[key] = new Date(key).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })
        }
        
        const sortedKeys = Object.keys(last30Days).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
        
        const finalLabels: {[key: string]: string} = {};
        sortedKeys.forEach(key => {
            finalLabels[key] = new Date(key).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
        });

        allOrders.forEach(order => {
             if (last30Days[order.orderDate] !== undefined) {
                last30Days[order.orderDate]++;
            }
        });

        return Object.entries(last30Days).map(([date, count]) => ({
            name: finalLabels[date],
            'Order Masuk': count,
        }));
    }, [allOrders]);


  // --- Kalkulasi untuk Dasbor Produksi ---
  const getItemsCount = (cards: CardData[]): number => {
      return cards.reduce((sum, card) => {
          const order = allOrders.find(o => o.id === card.id);
          return sum + (order?.orderItems.length || 0);
      }, 0);
  };

  const totalItemsToday = allOrders
      .filter(o => o.orderDate === today)
      .reduce((sum, order) => sum + order.orderItems.length, 0);

  const itemsToProcess = getItemsCount(boardData.queue);
  const itemsInPrinting = getItemsCount(boardData.printing);
  const itemsFinished = getItemsCount(boardData.warehouse);

  const itemsDeliveredToday = useMemo(() => {
    const deliveredTodayIds = new Set(
        receivables
            .filter(r => r.productionStatus === 'Telah Dikirim' && r.deliveryDate === today)
            .map(r => r.id)
    );
    return allOrders
        .filter(o => deliveredTodayIds.has(o.id))
        .reduce((sum, order) => sum + order.orderItems.length, 0);
  }, [receivables, allOrders, today]);
  
  const pieChartData = useMemo(() => [
    { name: 'Dalam Antrian', value: itemsToProcess },
    { name: 'Proses Cetak', value: itemsInPrinting },
    { name: 'Siap Ambil', value: itemsFinished },
    { name: 'Terkirim Hari Ini', value: itemsDeliveredToday },
  ].filter(item => item.value > 0), [itemsToProcess, itemsInPrinting, itemsFinished, itemsDeliveredToday]);

  const PIE_COLORS_PRODUCTION = ['#f472b6', '#a78bfa', '#2dd4bf', '#fb7185']; // Pink, Violet, Teal, Rose
  
  const recentProductionActivity = useMemo(() => {
    const todayOrders = allOrders.filter(o => o.orderDate === today);
    const activity: any[] = [];

    todayOrders.forEach(order => {
      const receivable = receivables.find(r => r.id === order.id);
      order.orderItems.forEach(item => {
        activity.push({
          orderId: order.id,
          customer: order.customer,
          description: item.description,
          length: item.length,
          width: item.width,
          qty: item.qty,
          finishing: item.finishing,
          status: receivable?.productionStatus || 'Belum Diproses'
        });
      });
    });
    
    return activity.sort((a, b) => b.orderId.localeCompare(a.orderId)).slice(0, 10);
  }, [allOrders, receivables, today]);

  const getProductionStatusColor = (status: ProductionStatusDisplay | 'Belum Diproses') => {
    switch (status) {
      case 'Telah Dikirim': return 'bg-gray-100 text-gray-800';
      case 'Siap Ambil': return 'bg-teal-100 text-teal-800';
      case 'Proses Cetak': return 'bg-pink-100 text-pink-800';
      case 'Dalam Antrian': return 'bg-fuchsia-100 text-fuchsia-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const TabButton: React.FC<{ label: string; tabKey: string }> = ({ label, tabKey }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 ${
        activeTab === tabKey
          ? 'bg-white border border-gray-200 border-b-0 text-pink-600 shadow-sm'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {accessibleTabs.length > 1 && (
        <div className="flex space-x-2 border-b border-gray-200">
            {accessibleTabs.map(tab => <TabButton key={tab.key} label={tab.label} tabKey={tab.key} />)}
        </div>
      )}

      {activeTab === 'penjualan' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={<CurrencyDollarIcon />} title="Pemasukan Hari Ini" value={formatCurrency(incomeToday)} onClick={() => onNavigate('receivables')} gradient="bg-gradient-to-br from-cyan-500 to-blue-500" />
            <StatCard icon={<ShoppingCartIcon />} title="Jumlah Transaksi" value={`${transactionsToday}`} onClick={() => onNavigate('sales')} gradient="bg-gradient-to-br from-violet-500 to-purple-500" />
            <StatCard icon={<UsersIcon />} title="Piutang Aktif" value={formatCurrency(activeReceivablesAmount)} onClick={() => onNavigate('receivables')} gradient="bg-gradient-to-br from-amber-500 to-orange-500" />
            <StatCard icon={<ReceiptTaxIcon />} title="Pengeluaran Hari Ini" value={formatCurrency(expensesToday)} onClick={() => onNavigate('expenses')} gradient="bg-gradient-to-br from-rose-500 to-red-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md h-96 hover:shadow-lg transition-shadow duration-300">
              <h3 className="font-bold text-lg text-gray-700 mb-4">Grafik Penjualan (30 Hari Terakhir)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={salesChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#6B7280' }} axisLine={{ stroke: '#D1D5DB' }} />
                    <YAxis tickFormatter={(value) => `Rp ${Number(value)/1000000} Jt`} tick={{ fill: '#6B7280' }} axisLine={{ stroke: '#D1D5DB' }} />
                    <Tooltip
                        cursor={{ stroke: '#ec4899', strokeWidth: 1, strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #ddd', borderRadius: '0.5rem', backdropFilter: 'blur(5px)' }}
                        formatter={(value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)}
                    />
                    <Area type="monotone" dataKey="Penjualan" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#salesGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md h-96 hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <h3 className="font-bold text-lg text-gray-700 mb-4 flex items-center"><CurrencyDollarIcon className="mr-2 text-pink-600" />Arus Keuangan Hari Ini</h3>
                {financialFlowData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={financialFlowData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {financialFlowData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS_FINANCE[index % PIE_COLORS_FINANCE.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-gray-500"><p>Belum ada aktivitas keuangan hari ini.</p></div>
                )}
            </div>
          </div>
           <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
             <h3 className="font-bold text-lg text-gray-700 mb-4">Aktivitas Pembayaran Terbaru Hari Ini</h3>
             {recentPayments.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Tanggal</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">No. Nota</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Pelanggan</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Deskripsi</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Sumber Dana</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-600">Jumlah Pembayaran</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {recentPayments.map((payment, index) => (
                                <tr key={index}>
                                    <td className="py-2 px-3">{new Date(payment.date).toLocaleDateString('id-ID')}</td>
                                    <td className="py-2 px-3 font-semibold">{payment.orderId}</td>
                                    <td className="py-2 px-3">{payment.customer}</td>
                                    <td className="py-2 px-3 truncate max-w-xs" title={payment.description}>{payment.description}</td>
                                    <td className="py-2 px-3">{payment.source}</td>
                                    <td className="py-2 px-3 text-right font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             ) : (
                <div className="text-center text-gray-500 py-8"><p>Tidak ada pembayaran yang diterima hari ini.</p></div>
             )}
          </div>
        </div>
      )}

      {activeTab === 'produksi' && (
        <div className="space-y-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={<ShoppingCartIcon />} title="Order Hari Ini" value={`${totalItemsToday} Item`} onClick={() => onNavigate('sales')} gradient="bg-gradient-to-br from-blue-500 to-sky-500" />
            <StatCard icon={<WrenchScrewdriverIcon />} title="Order Perlu Proses" value={`${itemsToProcess} Item`} onClick={() => onNavigate('production')} gradient="bg-gradient-to-br from-amber-500 to-yellow-500" />
            <StatCard icon={<CubeIcon />} title="Item Selesai" value={`${itemsFinished} Item`} onClick={() => onNavigate('production')} gradient="bg-gradient-to-br from-teal-500 to-cyan-500" />
            <StatCard icon={<HomeIcon />} title="Order Delivered Hari Ini" value={`${itemsDeliveredToday} Item`} onClick={() => onNavigate('production')} gradient="bg-gradient-to-br from-pink-500 to-rose-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md h-96 hover:shadow-lg transition-shadow duration-300">
              <h3 className="font-bold text-lg text-gray-700 mb-4">Grafik Order Produksi (30 Hari Terakhir)</h3>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={productionOrdersChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <defs>
                        <linearGradient id="productionGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#6B7280' }} axisLine={{ stroke: '#D1D5DB' }} />
                  <YAxis tickFormatter={(value) => `${value} order`} tick={{ fill: '#6B7280' }} axisLine={{ stroke: '#D1D5DB' }} />
                  <Tooltip
                        cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '3 3' }}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', border: '1px solid #ddd', borderRadius: '0.5rem', backdropFilter: 'blur(5px)' }}
                  />
                  <Area type="monotone" dataKey="Order Masuk" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#productionGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
             <div className="bg-white p-6 rounded-xl shadow-md h-96 hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <h3 className="font-bold text-lg text-gray-700 mb-4">Status Produksi Hari Ini</h3>
                {pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    return (
                                        <text x={x} y={y} fill="#6B7280" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                            {`${pieChartData[index].name} (${(percent * 100).toFixed(0)}%)`}
                                        </text>
                                    );
                                }}
                            >
                                {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS_PRODUCTION[index % PIE_COLORS_PRODUCTION.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${value} item`} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-gray-500"><p>Tidak ada data produksi aktif.</p></div>
                )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300">
             <h3 className="font-bold text-lg text-gray-700 mb-4">Aktivitas Order Terbaru Hari Ini</h3>
             {recentProductionActivity.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">No. Nota</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Pelanggan</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Deskripsi</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Ukuran</th>
                                <th className="py-2 px-3 text-center font-medium text-gray-600">Qty</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Finishing</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-600">Status Produksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {recentProductionActivity.map((activity, index) => (
                                <tr key={index}>
                                    <td className="py-2 px-3 font-semibold">{activity.orderId}</td>
                                    <td className="py-2 px-3">{activity.customer}</td>
                                    <td className="py-2 px-3">{activity.description}</td>
                                    <td className="py-2 px-3">{`${activity.length}x${activity.width}`}</td>
                                    <td className="py-2 px-3 text-center">{activity.qty}</td>
                                    <td className="py-2 px-3">{activity.finishing}</td>
                                    <td className="py-2 px-3">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProductionStatusColor(activity.status)}`}>
                                            {activity.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             ) : (
                <div className="text-center text-gray-500 py-8"><p>Tidak ada aktivitas order baru hari ini.</p></div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
