
import React from 'react';
import { type MenuItem } from './types';
import { 
  HomeIcon, ShoppingCartIcon, CreditCardIcon, ReceiptTaxIcon, CircleStackIcon, CubeIcon, 
  WrenchScrewdriverIcon, ChartBarIcon, Cog6ToothIcon, TableCellsIcon, CalendarDaysIcon
} from './components/Icons';

export const MENU_ITEMS: MenuItem[] = [
  { 
    key: 'dashboard', 
    label: 'Dashboard', 
    icon: <HomeIcon />,
    tabs: [
      { key: 'penjualan', label: 'Dasbor Penjualan' },
      { key: 'produksi', label: 'Dasbor Produksi' },
    ]
  },
  { key: 'sales', label: 'Order', icon: <ShoppingCartIcon /> },
  { key: 'production', label: 'Produksi / Status Order', icon: <WrenchScrewdriverIcon /> },
  { key: 'receivables', label: 'Pembayaran', icon: <CreditCardIcon /> },
  { key: 'expenses', label: 'Pengeluaran', icon: <ReceiptTaxIcon /> },
  { key: 'inventory', label: 'Stok / Inventori', icon: <CubeIcon /> },
  { 
    key: 'payroll', 
    label: 'Absensi dan Gaji', 
    icon: <CalendarDaysIcon />,
    tabs: [
      { key: 'attendance', label: 'Absensi Kerja' },
      { key: 'summary', label: 'Ringkasan Gaji' },
    ]
  },
  { 
    key: 'masterData', 
    label: 'Data Master', 
    icon: <CircleStackIcon />,
    tabs: [
        { key: 'products', label: 'Produk & Layanan' },
        { key: 'categories', label: 'Kategori' },
        { key: 'finishings', label: 'Finishing' },
        { key: 'customers', label: 'Pelanggan' },
        { key: 'suppliers', label: 'Supplier' },
        { key: 'karyawan', label: 'Karyawan' },
    ]
  },
  { 
    key: 'reports', 
    label: 'Laporan', 
    icon: <ChartBarIcon />,
    tabs: [
      { key: 'finalRecap', label: 'Final Rekapitulasi' },
      { key: 'profitAndLoss', label: 'Laba Rugi' },
      { key: 'sales', label: 'Penjualan' },
      { key: 'categorySales', label: 'Penjualan per Kategori' },
      { key: 'receivables', label: 'Piutang' },
      { key: 'inventory', label: 'Stok' },
      { key: 'assetsDebts', label: 'Aset dan Hutang' },
      { key: 'dataPenjualanLama', label: 'Data Penjualan Lama' },
      { key: 'dataPiutangLama', label: 'Data Piutang Lama' },
    ]
  },
  { 
    key: 'managementData', 
    label: 'Manajemen Data', 
    icon: <TableCellsIcon />,
    tabs: [
        { key: 'penjualan', label: 'Order' },
        { key: 'produk', label: 'Produk' },
        { key: 'stok', label: 'Stok' },
        { key: 'kategori', label: 'Kategori' },
        { key: 'finishing', label: 'Finishing' },
        { key: 'pelanggan', label: 'Pelanggan' },
        { key: 'supplier', label: 'Supplier' },
        { key: 'pengeluaran', label: 'Pengeluaran' },
        { key: 'karyawan', label: 'Karyawan' },
        { key: 'gaji', label: 'Gaji' },
    ]
  },
];

export const SETTINGS_MENU_ITEM: MenuItem = { 
    key: 'settings', 
    label: 'Pengaturan', 
    icon: <Cog6ToothIcon />,
    tabs: [
        { key: 'storeInfo', label: 'Informasi Toko' },
        { key: 'paymentMethods', label: 'Metode Pembayaran' },
        { key: 'userManagement', label: 'Manajemen Pengguna & Akses' },
        { key: 'notifications', label: 'Notifikasi' },
    ]
};

export const ALL_MENU_ITEMS = [...MENU_ITEMS, SETTINGS_MENU_ITEM];

export const ALL_PERMISSIONS_LIST: string[] = ALL_MENU_ITEMS.flatMap(item => {
    const mainKey = item.key;
    const tabKeys = item.tabs ? item.tabs.map(tab => `${mainKey}/${tab.key}`) : [];
    return [mainKey, ...tabKeys];
});