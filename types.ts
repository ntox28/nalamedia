import type React from 'react';

export type MenuKey =
  | 'dashboard'
  | 'cashFlow'
  | 'sales'
  | 'receivables'
  | 'expenses'
  | 'purchases'
  | 'payroll'
  | 'masterData'
  | 'managementData'
  | 'inventory'
  | 'production'
  | 'printLayout'
  | 'reports'
  | 'settings';

export interface TabItem {
  key: string;
  label: string;
}

export interface MenuItem {
  key: MenuKey;
  label: string;
  icon: React.ReactNode;
  tabs?: TabItem[];
}

// Tipe data untuk kartu pesanan di papan produksi
export interface CardData {
  id: string;
  customer: string;
  details: string;
}

// Tipe data untuk setiap kolom di papan produksi
export type ProductionStatus = 'queue' | 'printing' | 'warehouse' | 'delivered';

// Tipe data untuk seluruh papan kanban produksi
export interface KanbanData {
  queue: CardData[];
  printing: CardData[];
  warehouse: CardData[];
  delivered: CardData[];
}

// --- Master Data Types ---
export interface CustomerData {
  id: number;
  name: string;
  contact: string;
  level: 'End Customer' | 'Retail' | 'Grosir' | 'Reseller' | 'Corporate';
  joinDate: string;
}

export interface FinishingData {
  id: number;
  name: string;
  price: number;
  categoryIds?: number[];
}

export interface CategoryData {
  id: number;
  name: string;
  unitType: 'Per Luas' | 'Per Buah';
}

export interface ProductData {
  id: number;
  name: string;
  category: string;
  price: {
    endCustomer: number;
    retail: number;
    grosir: number;
    reseller: number;
    corporate: number;
  };
}

export interface SupplierData {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  specialty: string;
}

export interface EmployeeData {
  id: number;
  name: string;
  contact: string;
  division: 'Kasir' | 'Office' | 'Produksi';
  joinDate: string;
}

export interface SalaryData {
  id: number;
  employeeId: number;
  division: 'Kasir' | 'Office' | 'Produksi';
  regularRate: number;
  overtimeRate: number;
}


// --- Sales & Order Types ---

// Tipe data untuk setiap item dalam order di form penjualan
export interface OrderItemData {
  id: number;
  productId: number | null;
  finishing: string;
  description: string;
  length: string;
  width: string;
  qty: number;
  customPrice?: number; // Field baru untuk harga kustom
}

// Tipe data untuk order yang disimpan di halaman penjualan (sebelum diproses)
// Menyimpan semua detail untuk keperluan edit
export interface SavedOrder {
  id: string;
  customer: string;
  orderDate: string;
  orderItems: OrderItemData[];
  details: string; // Ringkasan untuk tampilan cepat
  totalPrice: number;
}

// Tipe data untuk status pembayaran di halaman piutang
export type PaymentStatus = 'Belum Lunas' | 'Lunas';

// Tipe data untuk status produksi di halaman piutang
export type ProductionStatusDisplay = 'Dalam Antrian' | 'Proses Cetak' | 'Siap Ambil' | 'Telah Dikirim' | 'Data Lama';

// Tipe data untuk setiap transaksi pembayaran
export interface Payment {
  amount: number;
  date: string;
  methodId: string;
  methodName: string;
}

// Tipe data untuk setiap item di halaman piutang
export interface ReceivableItem {
    id: string;
    customer: string;
    amount: number;
    due: string;
    paymentStatus: PaymentStatus;
    productionStatus: ProductionStatusDisplay;
    payments?: Payment[];
    discount?: number;
    deliveryDate?: string;
    deliveryNote?: string;
}

// Tipe data untuk setiap item di halaman pengeluaran
export interface ExpenseItem {
    id: number;
    name: string;
    category: string;
    amount: number;
    date: string;
}

// --- Inventory & Formula Types ---
export interface StockUsageRecord {
  date: string;
  amountUsed: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  stock: number;
  unit: string;
  type: 'Bahan Baku' | 'Barang Jadi';
  usageHistory?: StockUsageRecord[];
}

export type InventoryCategory = 'Bahan Baku' | 'ATK' | 'Kebersihan' | 'Lain-Lain';
export type InventoryCondition = 'Baik' | 'Perlu Restock' | 'Rusak / Perlu Ganti';

export interface InventoryItemMeta {
  category: InventoryCategory;
  condition?: InventoryCondition;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface InventoryTabCheckInfo {
  checkedAt: string;
  checkedBy: string;
}

export interface InventoryCheckStatus {
  lastCheckedAt?: string;
  lastCheckedBy?: string;
  byCategory?: Partial<Record<InventoryCategory, InventoryTabCheckInfo>>;
}

// --- Payroll Types ---
export interface AttendanceData {
  id: number;
  salaryId: number; // Links to SalaryData to get employee and rate info
  date: string;
  shift: 'Pagi' | 'Sore';
  clockIn: string;
  clockOut: string;
  isOvertime: boolean;
  overtimeHours?: number;
  overtimeMinutes?: number;
  overtimeNotes?: string;
}

export interface Deduction {
  amount: number;
  notes: string;
}

export interface Bonus {
  amount: number;
  notes: string;
}

export interface PayrollRecord {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  baseSalary: number;
  overtimePay: number;
  deductions: Deduction[];
  bonuses: Bonus[];
  totalSalary: number;
  processedAttendance: AttendanceData[];
}

// --- User Management Types ---
export type UserLevel = 'Kasir' | 'Office' | 'Produksi' | 'Admin';

// This maps to the `profiles` table in Supabase
export interface Profile {
  id: string; // This is a UUID from auth.users
  name: string;
  level: UserLevel;
}

export type MenuPermissions = Record<UserLevel, string[]>;

// --- Legacy Data Import Types ---

// New types for monthly legacy data
export interface LegacyMonthlyIncome {
  id: number;
  month_date: string;
  amount: number;
  description?: string;
}

export interface LegacyMonthlyExpense {
  id: number;
  month_date: string;
  amount: number;
  description?: string;
}

// Updated type for per-nota legacy receivables
export interface LegacyReceivable {
  id: number;
  nota_id: string;
  customer: string;
  order_date: string;
  description: string;
  length: number | null;
  width: number | null;
  qty: number;
  amount: number;
}


// --- Assets and Debts ---
export interface AssetItem {
  id: number;
  name: string;
  value: number;
}

export interface DebtItem {
  id: number;
  name: string;
  value: number;
}

// --- Settings Types ---
export interface NotificationSettings {
  lowStockAlert: boolean;
  lowStockThreshold: number;
  receivableDueSoonAlert: boolean;
  receivableDueSoonDays: number;
  receivableOverdueAlert: boolean;
  newOrderInQueueAlert: boolean;
  defaultDueDateDays: number;
}

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'Tunai' | 'Transfer Bank' | 'QRIS' | 'E-Wallet';
  details: string;
}

// --- Notification Types ---
// Defines the structure for a notification item, used for display in the header.
export interface NotificationItem {
  id: string;
  icon: React.ReactNode;
  text: string;
  time: string; // ISO String for consistent time calculation
  type: 'warning' | 'info';
  onNavigate?: () => void;
}

// --- Tahap 2: Pembelian / Barang Masuk, Cicilan & Pemisahan Pengeluaran ---
export type ExpenseFundingSource = 'Kas Laci' | 'Transfer Bank' | 'Kas Dipegang Owner';
export type InstallmentFundingSource = 'Kas Laci' | 'Transfer Bank' | 'Kas Dipegang Owner' | 'Dana Owner' | 'Sistem Lama (Sudah Tercatat)';
export type PrivateFundingSource = 'Kas Laci' | 'Transfer Bank' | 'Kas Dipegang Owner' | 'Uang Pribadi Owner';

export interface ExpenseMetadata {
  fundingSource: ExpenseFundingSource;
  fundingAccountId?: string;
  fundingAccountName?: string;
  purchaseId?: string;
  notes?: string;
  createdBy?: string;
}

export interface PurchaseItem {
  inventoryId: number;
  itemName: string;
  sku: string;
  unit: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface PurchaseRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  supplierId: number;
  supplierName: string;
  items: PurchaseItem[];
  totalAmount: number;
  paymentType: 'Lunas' | 'Kredit';
  fundingSource?: ExpenseFundingSource;
  fundingAccountId?: string;
  fundingAccountName?: string;
  dpAmount?: number;
  dueDate?: string;
  expenseId?: number;
  supplierBillId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface BillPayment {
  id: string;
  date: string;
  amount: number;
  fundingSource: InstallmentFundingSource;
  fundingAccountId?: string;
  fundingAccountName?: string;
  notes?: string;
  paidBy?: string;
}

export interface SupplierBill {
  id: string;
  purchaseId?: string;
  invoiceNumber: string;
  supplierId: number;
  supplierName: string;
  description: string;
  date: string;
  dueDate: string;
  totalAmount: number;
  payments: BillPayment[];
  status: 'Belum Lunas' | 'Lunas';
  notes?: string;
}

export interface BankInstallmentPayment {
  id: string;
  date: string;
  totalPaid: number;
  principalPaid: number;
  interestPaid: number;
  fundingSource: InstallmentFundingSource;
  fundingAccountId?: string;
  fundingAccountName?: string;
  notes?: string;
  paidBy?: string;
}

export interface BankInstallment {
  id: string;
  debtId?: number;
  name: string;
  creditLimit: number;
  remainingPrincipal: number;
  dueDayOfMonth?: number;
  nextDueDate?: string;
  notes?: string;
  payments: BankInstallmentPayment[];
  status: 'Aktif' | 'Lunas';
}

export interface PrivateExpenseItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  fundingSource: PrivateFundingSource;
  fundingAccountId?: string;
  fundingAccountName?: string;
  guestOrEvent?: string;
  needsReimburse?: boolean;
  reimbursed?: boolean;
  notes?: string;
  createdBy?: string;
}

// --- Tahap 1: Kas Laci Akumulatif, Tombol Setor & Log History ---
export interface CashDrawerState {
  periodStartDate: string;
  periodStartAt: string;
  openingCash: number;
  settledCashInOnStartDate: number;
  settledCashOutOnStartDate: number;
  settledCashTransferInOnStartDate?: number;
  settledCashTransferOutOnStartDate?: number;
}

export interface CashDrawerLog {
  id: string;
  type: 'Setor' | 'Penyesuaian Kas Awal';
  timestamp: string;
  periodStartDate: string;
  periodEndDate: string;
  openingCash: number;
  cashInTotal: number;
  cashOutTotal: number;
  nonCashTotal: number;
  expectedCash: number;
  physicalCash?: number;
  discrepancy?: number;
  depositAmount: number;
  remainingCash: number;
  recipient?: string;
  depositMode?: 'owner_hold' | 'bank_account' | 'owner_prive';
  depositToAccountId?: string;
  depositToAccountName?: string;
  operator?: string;
  notes?: string;
  breakdownByMethod?: Record<string, number>;
  previousState?: CashDrawerState;
}

// --- Mutasi Antar Akun & Rekonsiliasi Saldo Sistem vs Real ---
export type CashTransferType = 'Pindah Akun' | 'Suntik Modal' | 'Tarik Owner';

export interface CashTransferRecord {
  id: string;
  date: string;
  timestamp: string;
  transferType: CashTransferType;
  fromAccountId?: string;
  fromAccountName?: string;
  toAccountId?: string;
  toAccountName?: string;
  amount: number;
  adminFee?: number;
  netAmount: number;
  notes?: string;
  createdBy?: string;
}

export interface AccountBalanceMeta {
  openingBalance: number;
  openingDate: string;
  settledNetOnOpeningDate?: number;
  lastRealBalance?: number;
  lastRealCheckedAt?: string;
  lastRealCheckedBy?: string;
  notes?: string;
}

// --- Component Props ---
export interface CashFlowProps {
  receivables: ReceivableItem[];
  expenses: ExpenseItem[];
  expenseMetadata: Record<number, ExpenseMetadata>;
  supplierBills: SupplierBill[];
  bankInstallments: BankInstallment[];
  privateExpenses: PrivateExpenseItem[];
  paymentMethods: PaymentMethod[];
  cashDrawerState: CashDrawerState;
  cashDrawerLogs: CashDrawerLog[];
  cashTransfers: CashTransferRecord[];
  accountBalancesMeta: Record<string, AccountBalanceMeta>;
  legacyMonthlyIncomes: LegacyMonthlyIncome[];
  legacyMonthlyExpenses: LegacyMonthlyExpense[];
  onAddCashTransfer: (payload: Omit<CashTransferRecord, 'id' | 'timestamp' | 'createdBy'>) => Promise<void>;
  onDeleteCashTransfer: (id: string) => Promise<void>;
  onSaveAccountBalanceMeta: (methodId: string, meta: AccountBalanceMeta) => Promise<void>;
}

export interface ReportsProps {
  allOrders: SavedOrder[];
  expenses: ExpenseItem[];
  supplierBills: SupplierBill[];
  bankInstallments: BankInstallment[];
  privateExpenses: PrivateExpenseItem[];
  cashDrawerLogs: CashDrawerLog[];
  cashTransfers: CashTransferRecord[];
  receivables: ReceivableItem[];
  products: ProductData[];
  customers: CustomerData[];
  suppliers: SupplierData[];
  paymentMethods: PaymentMethod[];
  inventory: InventoryItem[];
  categories: CategoryData[];
  finishings: FinishingData[];
  menuPermissions: string[];
  legacyMonthlyIncomes: LegacyMonthlyIncome[];
  legacyMonthlyExpenses: LegacyMonthlyExpense[];
  legacyReceivables: LegacyReceivable[];
  assets: AssetItem[];
  debts: DebtItem[];
  notificationSettings: NotificationSettings;
  onAddLegacyMonthlyIncome: (data: Omit<LegacyMonthlyIncome, 'id'>) => void;
  onUpdateLegacyMonthlyIncome: (data: LegacyMonthlyIncome) => void;
  onDeleteLegacyMonthlyIncome: (id: number) => void;
  onAddLegacyMonthlyExpense: (data: Omit<LegacyMonthlyExpense, 'id'>) => void;
  onUpdateLegacyMonthlyExpense: (data: LegacyMonthlyExpense) => void;
  onDeleteLegacyMonthlyExpense: (id: number) => void;
  onAddLegacyReceivable: (data: Omit<LegacyReceivable, 'id'>) => void;
  onUpdateLegacyReceivable: (data: LegacyReceivable) => void;
  onDeleteLegacyReceivable: (id: number) => void;
  onAddAsset: (data: Omit<AssetItem, 'id'>) => void;
  onUpdateAsset: (data: AssetItem) => void;
  onDeleteAsset: (id: number) => void;
  onAddDebt: (data: Omit<DebtItem, 'id'>) => void;
  onUpdateDebt: (data: DebtItem) => void;
  onDeleteDebt: (id: number) => void;
}

// --- Print Layout Template Generator Types ---
export type LayoutUnit = 'mm' | 'cm' | 'm';
export type MediaMode = 'sheet' | 'roll';
export type NestingAlgorithm = 'bestFit' | 'guillotineRow';
export type ObjectShape = 'rectangle' | 'circle' | 'ellipse';
export type EfficiencySelectionMode = 'all' | 'smart';

export interface FinishingSpaceRule {
  finishingName: string;
  extraWidthMm: number;
  extraHeightMm: number;
  note?: string;
}

export interface LayoutObjectSpec {
  id: string;
  label: string;
  shape: ObjectShape;
  baseWidthMm: number;
  baseHeightMm: number;
  extraWidthMm: number;
  extraHeightMm: number;
  widthMm: number;
  heightMm: number;
  finishingName?: string;
  qty: number;
  allowRotate: boolean;
  color: string;
  sourceOrderId?: string;
  sourceCustomer?: string;
  materialName?: string;
}

export interface PlacedLayoutItem {
  instanceId: string;
  specId: string;
  copyIndex: number;
  label: string;
  shape: ObjectShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  color: string;
  baseWidthMm?: number;
  baseHeightMm?: number;
  finishingName?: string;
  sourceOrderId?: string;
  sourceCustomer?: string;
}

export interface LayoutPage {
  pageNumber: number;
  widthMm: number;
  heightMm: number;
  items: PlacedLayoutItem[];
}

export interface DeferredObjectItem {
  specId: string;
  label: string;
  shape: ObjectShape;
  widthMm: number;
  heightMm: number;
  qty: number;
  reason: string;
}