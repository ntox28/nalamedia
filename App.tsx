import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Receivables from './components/Receivables';
import Expenses from './components/Expenses';
import MasterData from './components/MasterData';
import Management from './components/Management';
import Inventory from './components/Inventory';
import Production from './components/Production';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Header from './components/Header';
import Payroll from './components/Payroll';
import Login from './components/Login';
import { supabase } from './supabaseClient';
import { type Session } from '@supabase/supabase-js';
import { type MenuKey, type KanbanData, type SavedOrder, type ReceivableItem, type ProductionStatus, type ProductionStatusDisplay, type ProductData, type CategoryData, type FinishingData, type Payment, type CustomerData, type ExpenseItem, type InventoryItem, type SupplierData, type EmployeeData, type SalaryData, type AttendanceData, type PayrollRecord, type StockUsageRecord, type MenuPermissions, type LegacyIncome, type LegacyExpense, type LegacyReceivable, type AssetItem, type DebtItem, type NotificationSettings, type Profile, type UserLevel, type PaymentStatus, type Bonus, type Deduction, type StoreInfo, type PaymentMethod, type OrderItemData, type NotificationItem } from './types';
import { MENU_ITEMS, ALL_PERMISSIONS_LIST } from './constants';
import { ShoppingCartIcon, ExclamationTriangleIcon, CreditCardIcon } from './components/Icons';

console.log("Build: Script is being parsed and component is about to be created.");

const DEFAULT_MENU_PERMISSIONS: MenuPermissions = {
    Kasir: ["dashboard", "dashboard/penjualan", "sales", "receivables"],
    Office: ["dashboard", "dashboard/penjualan", "dashboard/produksi", "sales", "receivables", "expenses", "payroll", "payroll/attendance", "payroll/summary", "masterData", "masterData/products", "masterData/categories", "masterData/finishings", "masterData/customers", "masterData/suppliers", "masterData/karyawan", "reports", "reports/sales", "reports/receivables", "reports/inventory", "reports/assetsDebts", "reports/dataPenjualanLama", "reports/finalRecap"],
    Produksi: ["dashboard", "dashboard/produksi", "production", "inventory"],
    Admin: ALL_PERMISSIONS_LIST
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    lowStockAlert: true,
    lowStockThreshold: 10,
    receivableDueSoonAlert: true,
    receivableDueSoonDays: 3,
    receivableOverdueAlert: true,
    newOrderInQueueAlert: false,
    defaultDueDateDays: 7,
};

const DEFAULT_STORE_INFO: StoreInfo = {
    name: "Nala Media Digital Printing",
    address: "Jl. Prof. Moh. Yamin, Cerbonan, Karanganyar",
    phone: "0813-9872-7722",
    email: "nalamedia.kra@gmail.com",
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
    { id: 'cash-default', name: 'Tunai', type: 'Tunai', details: 'Pembayaran tunai di kasir' }
];

const App: React.FC = () => {
  console.log("Render: Component is rendering.");
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuKey>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  
  // All data states
  const [allOrders, setAllOrders] = useState<SavedOrder[]>([]);
  const [unprocessedOrders, setUnprocessedOrders] = useState<SavedOrder[]>([]);
  const [boardData, setBoardData] = useState<KanbanData>({ queue: [], printing: [], warehouse: [], delivered: [] });
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [finishings, setFinishings] = useState<FinishingData[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [salaries, setSalaries] = useState<SalaryData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceData[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [menuPermissions, setMenuPermissions] = useState<MenuPermissions>(DEFAULT_MENU_PERMISSIONS);
  const [legacyIncome, setLegacyIncome] = useState<LegacyIncome | null>(null);
  const [legacyExpense, setLegacyExpense] = useState<LegacyExpense | null>(null);
  const [legacyReceivables, setLegacyReceivables] = useState<LegacyReceivable[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);
  const [noteCounter, setNoteCounter] = useState(1);
  const [notePrefix, setNotePrefix] = useState('INV-');
  const [initialCash, setInitialCash] = useState<number>(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);


  const clearAllData = useCallback(() => {
    console.log("Clearing all application data.");
    setProfile(null);
    setAllOrders([]);
    setUnprocessedOrders([]);
    setBoardData({ queue: [], printing: [], warehouse: [], delivered: [] });
    setReceivables([]);
    setExpenses([]);
    setProducts([]);
    setCategories([]);
    setFinishings([]);
    setCustomers([]);
    setSuppliers([]);
    setEmployees([]);
    setSalaries([]);
    setAttendance([]);
    setPayrollRecords([]);
    setInventory([]);
    setUsers([]);
    setMenuPermissions(DEFAULT_MENU_PERMISSIONS);
    setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
    setStoreInfo(DEFAULT_STORE_INFO);
    setPaymentMethods(DEFAULT_PAYMENT_METHODS);
    setLegacyIncome(null);
    setLegacyExpense(null);
    setLegacyReceivables([]);
    setAssets([]);
    setDebts([]);
    setNoteCounter(1);
    setNotePrefix('INV-');
    setInitialCash(0);
    setNotifications([]);
  }, []);

  const fetchAllData = useCallback(async () => {
    console.log("Fetching all data from Supabase...");
    const tableFetchPromises = {
        orders: supabase.from('orders').select('*'),
        receivables: supabase.from('receivables').select('*'),
        products: supabase.from('products').select('*'),
        categories: supabase.from('categories').select('*'),
        finishings: supabase.from('finishings').select('*'),
        customers: supabase.from('customers').select('*'),
        suppliers: supabase.from('suppliers').select('*'),
        employees: supabase.from('employees').select('*'),
        salaries: supabase.from('salaries').select('*'),
        attendance: supabase.from('attendance').select('*'),
        payroll_records: supabase.from('payroll_records').select('*'),
        inventory: supabase.from('inventory').select('*'),
        expenses: supabase.from('expenses').select('*'),
        profiles: supabase.from('profiles').select('id, uuid, name, level'),
        legacy_receivables: supabase.from('legacy_receivables').select('*'),
        assets: supabase.from('assets').select('*'),
        debts: supabase.from('debts').select('*'),
        app_settings: supabase.from('app_settings').select('*'),
        app_sequences: supabase.from('app_sequences').select('current_value, prefix').eq('name', 'order_nota').single(),
    };

    const results = await Promise.all(Object.values(tableFetchPromises));
    const dataMap: { [key: string]: any } = {};
    Object.keys(tableFetchPromises).forEach((key, index) => {
        const { data, error } = results[index];
        if (error) console.error(`Error fetching ${key}:`, error.message);
        dataMap[key] = data || (Array.isArray(data) ? [] : null);
    });
    
    const allFetchedOrders = dataMap.orders as SavedOrder[];
    const allFetchedReceivables = dataMap.receivables as ReceivableItem[];
    setAllOrders(allFetchedOrders);
    setReceivables(allFetchedReceivables);
    setProducts(dataMap.products);
    setCategories(dataMap.categories);
    setFinishings(dataMap.finishings);
    setCustomers(dataMap.customers);
    setSuppliers(dataMap.suppliers);
    setEmployees(dataMap.employees);
    setSalaries(dataMap.salaries);
    setAttendance(dataMap.attendance);
    setPayrollRecords(dataMap.payroll_records);
    setInventory(dataMap.inventory);
    setExpenses(dataMap.expenses);
    
    if (dataMap.app_sequences) {
        setNoteCounter(dataMap.app_sequences.current_value);
        setNotePrefix(dataMap.app_sequences.prefix || 'INV-');
    }
    
    const profilesFromDB = dataMap.profiles as { id: number, uuid: string | null, name: string, level: UserLevel }[];
    const mappedProfiles: Profile[] = profilesFromDB.map(p => ({
        id: p.uuid || `temp-id-${p.id}`,
        name: p.name,
        level: p.level,
    }));
    setUsers(mappedProfiles);

    setLegacyReceivables(dataMap.legacy_receivables);
    setAssets(dataMap.assets);
    setDebts(dataMap.debts);
    
    // Process settings
    const settings = dataMap.app_settings;
    const menuPermsSetting = settings.find(s => s.key === 'menuPermissions');
    const notifSetting = settings.find(s => s.key === 'notificationSettings');
    const storeInfoSetting = settings.find(s => s.key === 'storeInfo');
    const initialCashSetting = settings.find(s => s.key === 'initialCash');
    const paymentMethodsSetting = settings.find(s => s.key === 'paymentMethods');

    if (menuPermsSetting && menuPermsSetting.value) {
        const dbPermissions = menuPermsSetting.value as MenuPermissions;
        dbPermissions.Admin = ALL_PERMISSIONS_LIST;
        setMenuPermissions(dbPermissions);
    }
    if (notifSetting && notifSetting.value) {
        setNotificationSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...notifSetting.value });
    }
    if (storeInfoSetting) setStoreInfo(storeInfoSetting.value);
    if (paymentMethodsSetting && Array.isArray(paymentMethodsSetting.value)) {
        setPaymentMethods(paymentMethodsSetting.value);
    }
    if (initialCashSetting && typeof initialCashSetting.value === 'number') {
        setInitialCash(initialCashSetting.value);
    } else {
        setInitialCash(0);
    }
    
    const legacyIncomeSetting = settings.find(s => s.key === 'legacyIncome');
    const legacyExpenseSetting = settings.find(s => s.key === 'legacyExpense');
    if(legacyIncomeSetting && legacyIncomeSetting.value.amount > 0) setLegacyIncome(legacyIncomeSetting.value); else setLegacyIncome(null);
    if(legacyExpenseSetting && legacyExpenseSetting.value.amount > 0) setLegacyExpense(legacyExpenseSetting.value); else setLegacyExpense(null);

    // An order is only "processed" when its status is NOT 'Dalam Antrian'.
    // It remains "unprocessed" even if paid (DP), as long as it hasn't been sent to production.
    const processedReceivables = allFetchedReceivables.filter(r => r.productionStatus !== 'Dalam Antrian');
    const processedOrderIds = new Set(processedReceivables.map(r => r.id));
    setUnprocessedOrders(allFetchedOrders.filter(o => !processedOrderIds.has(o.id)));

    const newBoardData: KanbanData = { queue: [], printing: [], warehouse: [], delivered: [] };
    allFetchedReceivables.forEach(r => {
        const order = allFetchedOrders.find(o => o.id === r.id);
        if (order) {
            const cardData: { id: string; customer: string; details: string; } = { id: order.id, customer: order.customer, details: order.details };
            switch (r.productionStatus) {
                case 'Dalam Antrian': newBoardData.queue.push(cardData); break;
                case 'Proses Cetak': newBoardData.printing.push(cardData); break;
                case 'Siap Ambil': newBoardData.warehouse.push(cardData); break;
                case 'Telah Dikirim': newBoardData.delivered.push(cardData); break;
            }
        }
    });
    setBoardData(newBoardData);
    console.log("All data fetched and processed.");
  }, []);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Error getting session, possibly invalid token. Signing out.", sessionError);
          await supabase.auth.signOut();
          clearAllData();
          return;
        }

        setSession(session);
        
        if (session?.user) {
          const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id, uuid, name, level')
            .eq('uuid', session.user.id)
            .single();

          if (profileError || !userProfile) {
            console.error("Profile not found for session, signing out:", profileError?.message);
            await supabase.auth.signOut();
            clearAllData();
          } else {
            const mappedProfile: Profile = {
                id: userProfile.uuid,
                name: userProfile.name,
                level: userProfile.level
            };
            setProfile(mappedProfile);
            await fetchAllData();
          }
        } else {
          clearAllData();
        }
      } catch (error) {
        console.error("Error initializing session:", error);
        clearAllData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed, event:", _event);
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        clearAllData();
      } else if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        initializeSession();
      }
    });

    console.log("End: useEffect for auth has run.");
    
    return () => {
      console.log("Cleaning up auth subscription.");
      subscription.unsubscribe();
    };
  }, [fetchAllData, clearAllData]);

  // --- Real-time Subscription ---
  useEffect(() => {
    if (!profile) return;

    console.log("Setting up real-time subscription...");

    const channel = supabase
        .channel('public-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            (payload) => {
                console.log('Real-time change received!', payload);
                // The simplest and most robust way to ensure all derived state
                // is recalculated correctly is to re-fetch all data.
                fetchAllData();
            }
        )
        .subscribe();

    return () => {
        console.log("Removing real-time subscription.");
        supabase.removeChannel(channel);
    };
  }, [profile, fetchAllData]);

  // --- Notification Generation ---
  // This section generates notifications based on current app state and user settings.
  const navigateTo = useCallback((menu: MenuKey) => setActiveMenu(menu), []);

  useEffect(() => {
      if (!profile) return;

      const generateNotifications = () => {
          const newNotifications: NotificationItem[] = [];
          const now = new Date();

          // 1. Low Stock Alert
          if (notificationSettings.lowStockAlert) {
              inventory.forEach(item => {
                  if (item.stock <= notificationSettings.lowStockThreshold) {
                      newNotifications.push({
                          id: `low-stock-${item.id}`,
                          icon: <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />,
                          text: `Stok '${item.name}' menipis! Sisa ${item.stock} ${item.unit}.`,
                          time: now.toISOString(),
                          type: 'warning',
                          onNavigate: () => navigateTo('inventory'),
                      });
                  }
              });
          }
          
          // 2. Receivables Alerts moved to Receivables.tsx
          
          // 3. New Orders in Queue Alert
          if (notificationSettings.newOrderInQueueAlert && unprocessedOrders.length > 0) {
              newNotifications.push({
                  id: 'new-orders-summary',
                  icon: <ShoppingCartIcon className="h-5 w-5 text-blue-500" />,
                  text: `Ada ${unprocessedOrders.length} order baru di antrian produksi.`,
                  time: now.toISOString(),
                  type: 'info',
                  onNavigate: () => navigateTo('production'),
              });
          }
          
          setNotifications(newNotifications.sort((a,b) => b.time.localeCompare(a.time)));
      };

      generateNotifications();
  }, [inventory, unprocessedOrders, notificationSettings, profile, navigateTo]);

  const handleDismissNotification = useCallback((id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // --- Data Handlers ---
  const handleAddProfile = useCallback(async (newProfileData: { name: string; level: UserLevel }) => {
    const tempUuid = crypto.randomUUID();
    const newProfile = { ...newProfileData, uuid: tempUuid };

    const { data, error } = await supabase.from('profiles').insert(newProfile).select('id, uuid, name, level').single();

    if (error) {
        console.error("Error adding profile:", error);
        alert(`Gagal menambahkan profil: ${error.message}.`);
    } else if (data) {
        const mappedProfile: Profile = {
            id: data.uuid!,
            name: data.name,
            level: data.level,
        };
        setUsers(prev => [...prev, mappedProfile]);
        alert("Profil baru berhasil ditambahkan dengan ID sementara. Silakan perbarui UUID di dasbor Supabase.");
    }
  }, []);

  const handleUpdateUser = useCallback(async (updatedUser: Profile) => {
    const { data, error } = await supabase
        .from('profiles')
        .update({ name: updatedUser.name, level: updatedUser.level })
        .eq('uuid', updatedUser.id)
        .select('id, uuid, name, level')
        .single();

    if (error) {
        console.error("Error updating user profile:", error);
        alert(`Gagal memperbarui profil: ${error.message}`);
    } else if (data) {
        const mappedProfile: Profile = {
            id: data.uuid!,
            name: data.name,
            level: data.level
        };
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? mappedProfile : u));
        
        if (profile?.id === updatedUser.id) {
            setProfile(mappedProfile);
        }
        
        alert("Profil pengguna berhasil diperbarui.");
    }
  }, [profile]);

  const handleUpdateMenuPermissions = useCallback(async (newPermissions: MenuPermissions) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'menuPermissions', value: newPermissions }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating menu permissions:", error);
        alert(`Gagal menyimpan hak akses menu: ${error.message}`);
    } else {
        setMenuPermissions(newPermissions);
        alert("Hak akses menu berhasil diperbarui.");
    }
  }, []);

  const handleUpdateNotificationSettings = useCallback(async (newSettings: NotificationSettings) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'notificationSettings', value: newSettings }, { onConflict: 'key' });
        
    if (error) {
        console.error("Error updating notification settings:", error);
        alert(`Gagal menyimpan pengaturan notifikasi: ${error.message}`);
    } else {
        setNotificationSettings(newSettings);
        alert("Pengaturan notifikasi berhasil diperbarui.");
    }
  }, []);

  const handleUpdateStoreInfo = useCallback(async (newInfo: StoreInfo) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'storeInfo', value: newInfo }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating store info:", error);
        alert(`Gagal menyimpan info toko: ${error.message}`);
    } else {
        setStoreInfo(newInfo);
        alert("Informasi toko berhasil diperbarui.");
    }
  }, []);
  
  const handleUpdatePaymentMethods = useCallback(async (newMethods: PaymentMethod[]) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'paymentMethods', value: newMethods }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating payment methods:", error);
        alert(`Gagal menyimpan metode pembayaran: ${error.message}`);
    } else {
        setPaymentMethods(newMethods);
        alert("Metode pembayaran berhasil diperbarui.");
    }
  }, []);

  const handleUpdateInitialCash = useCallback(async (amount: number) => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'initialCash', value: amount }, { onConflict: 'key' });

    if (error) {
        console.error("Error updating initial cash:", error);
        alert(`Gagal menyimpan kas awal: ${error.message}`);
    } else {
        setInitialCash(amount);
        alert("Kas awal berhasil diperbarui.");
    }
  }, []);

  const handleSaveOrder = useCallback(async (newOrder: SavedOrder) => {
      const { data, error } = await supabase.from('orders').insert(newOrder).select().single();
      if (error || !data) {
          alert(`Gagal menyimpan order: ${error?.message}`); return;
      }
      const { error: seqError } = await supabase.from('app_sequences').update({ current_value: noteCounter + 1 }).eq('name', 'order_nota');
      if (seqError) console.error('Failed to update sequence');

      // State will be updated by real-time subscription, but local update provides instant feedback.
      setAllOrders(prev => [...prev, data]);
      setUnprocessedOrders(prev => [...prev, data]);
      setNoteCounter(prev => prev + 1);
  }, [noteCounter]);

  const handleUpdateOrder = useCallback(async (updatedOrder: SavedOrder) => {
      // First, update the order itself
      const { data: updatedOrderData, error: orderError } = await supabase
        .from('orders')
        .update(updatedOrder)
        .eq('id', updatedOrder.id)
        .select()
        .single();
      
      if (orderError || !updatedOrderData) { 
        alert(`Gagal update order: ${orderError?.message}`); 
        return; 
      }

      // Now, check if a corresponding receivable exists and update its amount and status to sync.
      const existingReceivable = receivables.find(r => r.id === updatedOrder.id);
      if (existingReceivable) {
        // Calculate total amount paid for this receivable.
        const totalPaid = existingReceivable.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const discount = existingReceivable.discount || 0;
        
        // Determine the new payment status based on the updated price.
        const newPaymentStatus: PaymentStatus = (totalPaid + discount >= updatedOrder.totalPrice) ? 'Lunas' : 'Belum Lunas';

        // Prepare the payload to update the receivable.
        const updatePayload = {
            amount: updatedOrder.totalPrice,
            paymentStatus: newPaymentStatus,
        };

        const { error: receivableError } = await supabase
            .from('receivables')
            .update(updatePayload)
            .eq('id', updatedOrder.id);
        
        if (receivableError) {
            alert(`Order berhasil diupdate, tetapi gagal sinkronisasi harga & status ke data pembayaran: ${receivableError.message}`);
        }
      }
      
      // The real-time subscription will handle updating the local state automatically by calling fetchAllData().
      
  }, [receivables]);

  const handleProcessOrder = useCallback(async (orderId: string) => {
    const existingReceivable = receivables.find(r => r.id === orderId);

    if (existingReceivable) {
        const { error } = await supabase
            .from('receivables')
            .update({ productionStatus: 'Proses Cetak' })
            .eq('id', orderId);
        if (error) { alert(`Gagal update status produksi: ${error.message}`); return; }
    } else {
        const order = allOrders.find(o => o.id === orderId);
        if (!order) return;

        const dueDate = new Date(order.orderDate);
        dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
        const newDueDate = dueDate.toISOString().substring(0, 10);

        const newReceivable: Omit<ReceivableItem, 'payments'> = {
            id: order.id,
            customer: order.customer,
            amount: order.totalPrice,
            due: newDueDate,
            paymentStatus: 'Belum Lunas',
            productionStatus: 'Proses Cetak'
        };
        const { error } = await supabase.from('receivables').insert(newReceivable);
        if (error) { alert(`Gagal proses order: ${error.message}`); return; }
    }
  }, [allOrders, receivables, notificationSettings]);

  const handleDeleteOrder = useCallback(async (orderId: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) { alert(`Gagal hapus order: ${error.message}`); return; }
      // State updates will be handled by real-time subscription.
  }, []);

  const handleUpdateNoteSettings = useCallback(async (prefix: string, startNumber: number) => {
    const { error } = await supabase
        .from('app_sequences')
        .update({ prefix, current_value: startNumber })
        .eq('name', 'order_nota');
        
    if (error) { 
        alert(`Gagal update pengaturan nota: ${error.message}`); 
    } else { 
        setNotePrefix(prefix); 
        setNoteCounter(startNumber);
        alert('Pengaturan nomor nota berhasil diperbarui.');
    }
  }, []);
  
  const handleProcessPayment = useCallback(async (orderId: string, paymentDetails: Payment, newDiscount?: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => {
    const receivable = receivables.find(r => r.id === orderId);
    if (!receivable) return;
    
    // Use the passed newTotalAmount if available, otherwise stick to the existing amount.
    const finalTotalAmount = newTotalAmount !== undefined ? newTotalAmount : receivable.amount;
    
    // If there are updated items, sync the main order first.
    if (updatedItems) {
        const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({ orderItems: updatedItems, totalPrice: finalTotalAmount })
            .eq('id', orderId);

        if (orderUpdateError) {
            alert(`Gagal memperbarui detail order: ${orderUpdateError.message}`);
            return; // Stop if the main order sync fails.
        }
    }

    const existingPayments = receivable.payments || [];
    const updatedPayments = [...existingPayments, paymentDetails];
    const totalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    
    const discount = newDiscount !== undefined ? newDiscount : (receivable.discount || 0);
    
    let newPaymentStatus: PaymentStatus = receivable.paymentStatus;
    if (totalPaid + discount >= finalTotalAmount) {
        newPaymentStatus = 'Lunas';
    }
    
    const updatePayload: any = {
        amount: finalTotalAmount, // Sync amount in receivable to the correct total.
        payments: updatedPayments,
        paymentStatus: newPaymentStatus,
    };

    if (newDiscount !== undefined) {
        updatePayload.discount = newDiscount;
    }

    const { data, error } = await supabase.from('receivables').update(updatePayload).eq('id', orderId).select().single();
    
    if (error || !data) { alert(`Gagal proses bayar: ${error?.message}`); return; }
    // State updates will be handled by real-time subscription.
  }, [receivables]);
  
  const handlePayUnprocessedOrder = useCallback(async (orderId: string, paymentDetails: Payment, newDiscount: number, updatedItems?: OrderItemData[], newTotalAmount?: number) => {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) {
        alert('Order tidak ditemukan!');
        return;
    }

    // Use the passed newTotalAmount if available, otherwise stick to the existing order price.
    const finalTotalAmount = newTotalAmount !== undefined ? newTotalAmount : order.totalPrice;
    
    // If there are updated items, sync the main order first.
    if (updatedItems) {
        const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({ orderItems: updatedItems, totalPrice: finalTotalAmount })
            .eq('id', orderId);

        if (orderUpdateError) {
            alert(`Gagal memperbarui detail order: ${orderUpdateError.message}`);
            return;
        }
    }
    
    const totalPaid = paymentDetails.amount;
    let newPaymentStatus: PaymentStatus = 'Belum Lunas';
    if (totalPaid + newDiscount >= finalTotalAmount) {
        newPaymentStatus = 'Lunas';
    }

    const dueDate = new Date(order.orderDate);
    dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
    const newDueDate = dueDate.toISOString().substring(0, 10);

    const newReceivable: ReceivableItem = {
        id: order.id,
        customer: order.customer,
        amount: finalTotalAmount,
        due: newDueDate,
        paymentStatus: newPaymentStatus,
        productionStatus: 'Dalam Antrian',
        payments: [paymentDetails],
        discount: newDiscount,
    };

    const { data, error } = await supabase.from('receivables').insert(newReceivable).select().single();
    if (error || !data) {
        alert(`Gagal memproses pembayaran untuk order baru: ${error?.message}`);
        return;
    }
  }, [allOrders, notificationSettings]);

  const handleUpdateReceivableDueDate = useCallback(async (orderId: string, newDueDate: string) => {
    const { error } = await supabase
        .from('receivables')
        .update({ due: newDueDate })
        .eq('id', orderId);

    if (error) {
        alert(`Gagal memperbarui tanggal jatuh tempo: ${error.message}`);
    }
    // Real-time will handle the update.
  }, []);

  const handleBulkUpdateReceivableDueDate = useCallback(async (orderIds: string[], newDueDate: string) => {
    if (orderIds.length === 0) return;

    const { error } = await supabase
        .from('receivables')
        .update({ due: newDueDate })
        .in('id', orderIds);

    if (error) {
        alert(`Gagal memperbarui tanggal jatuh tempo secara massal: ${error.message}`);
    } else {
        alert(`${orderIds.length} nota berhasil diperbarui tanggal jatuh temponya.`);
    }
    // Real-time will handle the update.
  }, []);


  const handleBulkProcessPayment = useCallback(async (orderIds: string[], paymentDate: string, paymentMethodId: string) => {
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    if (!method) return;

    const receivableIds = new Set(receivables.map(r => r.id));
    // Supabase query builders are "thenable" but not full Promises,
    // causing a TypeScript error. Promise.all can handle an array of thenables.
    const operations: any[] = [];

    orderIds.forEach(id => {
        if (receivableIds.has(id)) {
            const receivable = receivables.find(r => r.id === id)!;
            const totalPaid = receivable.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
            const remainingAmount = receivable.amount - (receivable.discount || 0) - totalPaid;
            if (remainingAmount > 0) {
                const newPayment: Payment = { amount: remainingAmount, date: paymentDate, methodId: method.id, methodName: method.name };
                const updatedPayments = [...(receivable.payments || []), newPayment];
                operations.push(supabase.from('receivables').update({ payments: updatedPayments, paymentStatus: 'Lunas' }).eq('id', id).select());
            }
        } else {
            const order = allOrders.find(o => o.id === id);
            if (order) {
                const payment: Payment = { amount: order.totalPrice, date: paymentDate, methodId: method.id, methodName: method.name };
                
                const dueDate = new Date(order.orderDate);
                dueDate.setDate(dueDate.getDate() + notificationSettings.defaultDueDateDays);
                const newDueDate = dueDate.toISOString().substring(0, 10);

                const newReceivable: ReceivableItem = {
                    id: order.id, customer: order.customer, amount: order.totalPrice,
                    due: newDueDate, paymentStatus: 'Lunas', productionStatus: 'Dalam Antrian',
                    payments: [payment], discount: 0,
                };
                operations.push(supabase.from('receivables').insert(newReceivable).select());
            }
        }
    });

    await Promise.all(operations);
  }, [receivables, allOrders, paymentMethods, notificationSettings]);

  const handleAddExpense = useCallback(async (newExpense: Omit<ExpenseItem, 'id'>) => {
    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single();
    if (error || !data) { alert(`Gagal tambah pengeluaran: ${error?.message}`); return; }
    // State updates will be handled by real-time subscription.
  }, []);
  
  const handleProductionMove = useCallback(async (orderId: string, from: ProductionStatus, to: ProductionStatus) => {
    const statusMap: Record<ProductionStatus, ProductionStatusDisplay> = { queue: 'Dalam Antrian', printing: 'Proses Cetak', warehouse: 'Siap Ambil', delivered: 'Telah Dikirim' };
    const { data, error } = await supabase.from('receivables').update({ productionStatus: statusMap[to] }).eq('id', orderId).select().single();
    if (error || !data) { alert(`Gagal pindah status: ${error.message}`); return; }
    // State updates will be handled by real-time subscription.
  }, []);

  const handleDeliverOrder = useCallback(async (orderId: string, deliveryNote: string) => {
    const updatePayload = {
      productionStatus: 'Telah Dikirim' as ProductionStatusDisplay,
      deliveryDate: new Date().toISOString().substring(0, 10),
      deliveryNote: deliveryNote,
    };
    const { error } = await supabase.from('receivables').update(updatePayload).eq('id', orderId);
    if (error) { alert(`Gagal menyerahkan order: ${error.message}`); return; }
    // State updates handled by real-time.
  }, []);

  const handleCancelQueue = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('receivables').delete().eq('id', orderId);
    if (error) { alert(`Gagal batal antrian: ${error.message}`); return; }
    // State updates will be handled by real-time subscription.
  }, []);

  const handleUseStock = useCallback(async (itemId: number, amountUsed: number, usageDate: string) => {
      const item = inventory.find(i => i.id === itemId);
      if (!item) return;
      const newStock = item.stock - amountUsed;
      const newHistory: StockUsageRecord = { date: usageDate, amountUsed };
      const updatedHistory = [...(item.usageHistory || []), newHistory];
      const { data, error } = await supabase.from('inventory').update({ stock: newStock, usageHistory: updatedHistory }).eq('id', itemId).select().single();
      if (error || !data) { alert(`Gagal update stok: ${error.message}`); return; }
      // State updates will be handled by real-time subscription.
  }, [inventory]);

    const genericAddHandler = useCallback(async <T extends {id: number}>(table: string, newItem: Omit<T, 'id'>, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        const { data, error } = await supabase.from(table).insert(newItem).select().single();
        if (error || !data) { alert(`Gagal menambah data: ${error.message}`); return; }
        // State updates will be handled by real-time subscription.
    }, []);
    
  const handleAddProduct = (p: Omit<ProductData, 'id'>) => genericAddHandler('products', p, setProducts);
  const handleAddCategory = (c: Omit<CategoryData, 'id'>) => genericAddHandler('categories', c, setCategories);
  const handleAddFinishing = (f: Omit<FinishingData, 'id'>) => genericAddHandler('finishings', f, setFinishings);
  const handleAddCustomer = (c: Omit<CustomerData, 'id' | 'joinDate'>) => genericAddHandler('customers', { ...c, joinDate: new Date().toISOString() }, setCustomers);
  const handleAddSupplier = (s: Omit<SupplierData, 'id'>) => genericAddHandler('suppliers', s, setSuppliers);
  const handleAddEmployee = (e: Omit<EmployeeData, 'id' | 'joinDate'>) => genericAddHandler('employees', { ...e, joinDate: new Date().toISOString() }, setEmployees);

  const genericUpdateHandler = useCallback(async <T extends {id: number}>(table: string, updatedItem: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      const { data, error } = await supabase.from(table).update(updatedItem).eq('id', updatedItem.id).select().single();
      if (error || !data) { alert(`Gagal update data: ${error.message}`); return; }
      // State updates will be handled by real-time subscription.
  }, []);

  const genericDeleteHandler = useCallback(async (table: string, id: number, setter: React.Dispatch<React.SetStateAction<{id: number}[]>>) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) { alert(`Gagal hapus data: ${error.message}`); return; }
      // State updates will be handled by real-time subscription.
  }, []);

  const handleUpdateProduct = (p: ProductData) => genericUpdateHandler('products', p, setProducts);
  const handleDeleteProduct = (id: number) => genericDeleteHandler('products', id, setProducts);
  const handleUpdateInventoryItem = (i: InventoryItem) => genericUpdateHandler('inventory', i, setInventory);
  const handleAddInventoryItem = (i: Omit<InventoryItem, 'id'>) => genericAddHandler('inventory', i, setInventory);
  const handleDeleteInventoryItem = (id: number) => genericDeleteHandler('inventory', id, setInventory);
  const handleUpdateCategory = (c: CategoryData) => genericUpdateHandler('categories', c, setCategories);
  const handleDeleteCategory = (id: number) => genericDeleteHandler('categories', id, setCategories);
  const handleUpdateFinishing = (f: FinishingData) => genericUpdateHandler('finishings', f, setFinishings);
  const handleDeleteFinishing = (id: number) => genericDeleteHandler('finishings', id, setFinishings);
  const handleUpdateCustomer = (c: CustomerData) => genericUpdateHandler('customers', c, setCustomers);
  const handleDeleteCustomer = (id: number) => genericDeleteHandler('customers', id, setCustomers);
  const handleUpdateSupplier = (s: SupplierData) => genericUpdateHandler('suppliers', s, setSuppliers);
  const handleDeleteSupplier = (id: number) => genericDeleteHandler('suppliers', id, setSuppliers);
  const handleUpdateExpense = (e: ExpenseItem) => genericUpdateHandler('expenses', e, setExpenses);
  const handleDeleteExpense = (id: number) => genericDeleteHandler('expenses', id, setExpenses);
  const handleUpdateEmployee = (e: EmployeeData) => genericUpdateHandler('employees', e, setEmployees);
  const handleDeleteEmployee = (id: number) => genericDeleteHandler('employees', id, setEmployees);
  const handleAddSalary = (s: Omit<SalaryData, 'id'>) => genericAddHandler('salaries', s, setSalaries);
  const handleUpdateSalary = (s: SalaryData) => genericUpdateHandler('salaries', s, setSalaries);
  const handleDeleteSalary = (id: number) => genericDeleteHandler('salaries', id, setSalaries);

  const handleAddAttendance = (a: Omit<AttendanceData, 'id'>) => genericAddHandler('attendance', a, setAttendance);
  const handleDeleteAttendance = (id: number) => genericDeleteHandler('attendance', id, setAttendance);

  const handleProcessPayroll = useCallback(async (employeeId: number, startDate: string, endDate: string, baseSalary: number, overtimePay: number, bonuses: Bonus[], deductions: Deduction[], processedAttendance: AttendanceData[]) => {
      const totalSalary = baseSalary + overtimePay + bonuses.reduce((s, b) => s + b.amount, 0) - deductions.reduce((s, d) => s + d.amount, 0);
      const newRecord: Omit<PayrollRecord, 'id'> = { employeeId, startDate, endDate, baseSalary, overtimePay, bonuses, deductions, totalSalary, processedAttendance };
      const { data, error } = await supabase.from('payroll_records').insert(newRecord).select().single();
      if (error || !data) { alert(`Gagal proses gaji: ${error?.message}`); return; }
      // State updates will be handled by real-time subscription.
  }, []);
  
  const handleUpdatePayroll = (p: PayrollRecord) => genericUpdateHandler('payroll_records', p, setPayrollRecords);
  const handleRevertPayroll = (id: number) => genericDeleteHandler('payroll_records', id, setPayrollRecords);
  
  const handleSetLegacyIncome = (data: LegacyIncome | null) => { supabase.from('app_settings').upsert({ key: 'legacyIncome', value: data }, { onConflict: 'key' }).then(() => setLegacyIncome(data)); };
  const handleSetLegacyExpense = (data: LegacyExpense | null) => { supabase.from('app_settings').upsert({ key: 'legacyExpense', value: data }, { onConflict: 'key' }).then(() => setLegacyExpense(data)); };
  const handleAddLegacyReceivable = (r: Omit<LegacyReceivable, 'id'>) => genericAddHandler('legacy_receivables', r, setLegacyReceivables);
  const handleUpdateLegacyReceivable = (r: LegacyReceivable) => genericUpdateHandler('legacy_receivables', r, setLegacyReceivables);
  const handleDeleteLegacyReceivable = (id: number) => genericDeleteHandler('legacy_receivables', id, setLegacyReceivables);
  const handleSettleLegacyReceivable = async (item: LegacyReceivable) => {
    const newExpense: Omit<ExpenseItem, 'id'> = { name: `Bayar Piutang Lama: ${item.customer}`, category: "Lain-lain", amount: item.amount, date: new Date().toISOString().substring(0, 10) };
    await handleAddExpense(newExpense);
    await handleDeleteLegacyReceivable(item.id);
  };
  const handleAddAsset = (a: Omit<AssetItem, 'id'>) => genericAddHandler('assets', a, setAssets);
  const handleAddDebt = (d: Omit<DebtItem, 'id'>) => genericAddHandler('debts', d, setDebts);
  
  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);
  const handleMenuClick = (menu: MenuKey) => setActiveMenu(menu);
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    const userPermissions = profile ? menuPermissions[profile.level] : [];
    if (!userPermissions.includes(activeMenu)) {
        const firstAccessible = MENU_ITEMS.find(item => userPermissions.includes(item.key));
        if (firstAccessible) setActiveMenu(firstAccessible.key);
        return <div>Mengalihkan...</div>;
    }
    switch (activeMenu) {
      case 'dashboard': return <Dashboard onNavigate={handleMenuClick} allOrders={allOrders} boardData={boardData} menuPermissions={userPermissions} expenses={expenses} receivables={receivables} products={products} />;
      case 'sales': return <Sales unprocessedOrders={unprocessedOrders} onSaveOrder={handleSaveOrder} onUpdateOrder={handleUpdateOrder} onProcessOrder={handleProcessOrder} onDeleteOrder={handleDeleteOrder} products={products} categories={categories} finishings={finishings} customers={customers} allOrders={allOrders} boardData={boardData} noteCounter={noteCounter} notePrefix={notePrefix} onUpdateNoteSettings={handleUpdateNoteSettings} />;
      case 'receivables': return <Receivables receivables={receivables} unprocessedOrders={unprocessedOrders} allOrders={allOrders} boardData={boardData} products={products} finishings={finishings} customers={customers} categories={categories} onProcessPayment={handleProcessPayment} onPayUnprocessedOrder={handlePayUnprocessedOrder} onBulkProcessPayment={handleBulkProcessPayment} expenses={expenses} initialCash={initialCash} onUpdateInitialCash={handleUpdateInitialCash} paymentMethods={paymentMethods} onUpdateDueDate={handleUpdateReceivableDueDate} onBulkUpdateDueDate={handleBulkUpdateReceivableDueDate} notificationSettings={notificationSettings} />;
      case 'expenses': return <Expenses expenses={expenses} onAddExpense={handleAddExpense} />;
      case 'inventory': return <Inventory inventory={inventory} onUseStock={handleUseStock} notificationSettings={notificationSettings} />;
      case 'production': return <Production boardData={boardData} allOrders={allOrders} unprocessedOrders={unprocessedOrders} receivables={receivables} products={products} categories={categories} onProductionMove={handleProductionMove} onDeliverOrder={handleDeliverOrder} onCancelQueue={handleCancelQueue} />;
      case 'payroll': return <Payroll salaries={salaries} employees={employees} attendance={attendance} payrollRecords={payrollRecords} menuPermissions={userPermissions} onAddAttendance={handleAddAttendance} onDeleteAttendance={handleDeleteAttendance} onProcessPayroll={handleProcessPayroll} onUpdatePayroll={handleUpdatePayroll} onRevertPayroll={handleRevertPayroll} />;
      case 'masterData': return <MasterData products={products} categories={categories} finishings={finishings} customers={customers} suppliers={suppliers} employees={employees} menuPermissions={userPermissions} onAddProduct={handleAddProduct} onAddCategory={handleAddCategory} onAddFinishing={handleAddFinishing} onAddCustomer={handleAddCustomer} onAddSupplier={handleAddSupplier} onAddEmployee={handleAddEmployee} />;
      case 'managementData': return <Management allOrders={allOrders} products={products} finishings={finishings} customers={customers} categories={categories} inventory={inventory} suppliers={suppliers} expenses={expenses} employees={employees} salaries={salaries} menuPermissions={userPermissions} onUpdateOrder={handleUpdateOrder} onDeleteOrder={handleDeleteOrder} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onUpdateCategory={handleUpdateCategory} onDeleteCategory={handleDeleteCategory} onUpdateFinishing={handleUpdateFinishing} onDeleteFinishing={handleDeleteFinishing} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={handleDeleteCustomer} onUpdateSupplier={handleUpdateSupplier} onDeleteSupplier={handleDeleteSupplier} onUpdateExpense={handleUpdateExpense} onDeleteExpense={handleDeleteExpense} onUpdateEmployee={handleUpdateEmployee} onDeleteEmployee={handleDeleteEmployee} onAddSalary={handleAddSalary} onUpdateSalary={handleUpdateSalary} onDeleteSalary={handleDeleteSalary} onAddInventoryItem={handleAddInventoryItem} onUpdateInventoryItem={handleUpdateInventoryItem} onDeleteInventoryItem={handleDeleteInventoryItem} />;
      case 'reports': return <Reports allOrders={allOrders} expenses={expenses} receivables={receivables} products={products} customers={customers} inventory={inventory} categories={categories} finishings={finishings} menuPermissions={userPermissions} legacyIncome={legacyIncome} legacyExpense={legacyExpense} legacyReceivables={legacyReceivables} assets={assets} debts={debts} notificationSettings={notificationSettings} onSetLegacyIncome={handleSetLegacyIncome} onSetLegacyExpense={handleSetLegacyExpense} onAddLegacyReceivable={handleAddLegacyReceivable} onUpdateLegacyReceivable={handleUpdateLegacyReceivable} onDeleteLegacyReceivable={handleDeleteLegacyReceivable} onSettleLegacyReceivable={handleSettleLegacyReceivable} onAddAsset={handleAddAsset} onAddDebt={handleAddDebt} />;
      case 'settings': return <Settings users={users} menuPermissions={menuPermissions} currentUser={profile} currentUserLevel={profile!.level} notificationSettings={notificationSettings} storeInfo={storeInfo} paymentMethods={paymentMethods} onAddUser={handleAddProfile} onUpdateUser={handleUpdateUser} onUpdateMenuPermissions={handleUpdateMenuPermissions} onUpdateNotificationSettings={handleUpdateNotificationSettings} onUpdateStoreInfo={handleUpdateStoreInfo} onUpdatePaymentMethods={handleUpdatePaymentMethods} />;
      default: return <Dashboard onNavigate={handleMenuClick} allOrders={allOrders} boardData={boardData} menuPermissions={userPermissions} expenses={expenses} receivables={receivables} products={products} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <img src="https://wqgbkwujfxdwlywxrjup.supabase.co/storage/v1/object/public/publik/android-chrome-512x512%20cmyk.png" alt="Loading..." className="h-52 w-52 animate-pulse mx-auto" />
          <p className="mt-4 text-gray-600">Sabar Cuk Loading iki . . .</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const activeMenuItem = [...MENU_ITEMS, {key: 'settings', label: 'Pengaturan'}].find(item => item.key === activeMenu) || { label: 'Dashboard' };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar 
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
        isOpen={isSidebarOpen}
        currentUser={profile}
        onLogout={handleLogout}
        menuPermissions={menuPermissions}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={activeMenuItem.label}
          onToggleSidebar={handleToggleSidebar}
          currentUser={profile}
          onLogout={handleLogout}
          onNavigateToSettings={() => setActiveMenu('settings')}
          onNavigateToPage={handleMenuClick}
          allOrders={allOrders}
          customers={customers}
          products={products}
          expenses={expenses}
          employees={employees}
          menuPermissions={profile ? menuPermissions[profile.level] : []}
          notifications={notifications}
          onDismissNotification={handleDismissNotification}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8">
          {profile && renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;