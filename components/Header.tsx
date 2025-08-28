import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, UserCircleIcon, ExclamationTriangleIcon, CreditCardIcon } from './Icons';
import { type Profile, type MenuKey, type SavedOrder, type CustomerData, type ProductData, type ExpenseItem, type EmployeeData } from '../types';
import CommandPalette from './CommandPalette';

// --- Start of Notification Pop-up Components & Data ---

const initialNotificationsData: {id: number, icon: React.ReactNode, text: string, time: string}[] = [];

const NotificationsPopup: React.FC<{ 
    notifications: typeof initialNotificationsData;
    onDismiss: (id: number) => void;
}> = ({ notifications, onDismiss }) => (
    <div 
        className="absolute top-full right-0 mt-2 w-80 max-w-sm bg-white rounded-lg shadow-lg border z-50"
    >
        <div className="p-3 border-b">
            <h3 className="font-semibold text-gray-800">Notifikasi</h3>
        </div>
        <div className="py-2 max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
                notifications.map(item => (
                    <div key={item.id} className="px-3 py-1">
                        <div className="flex items-start p-2 hover:bg-gray-100 rounded-md relative group">
                            <div className="flex-shrink-0 mt-1">{item.icon}</div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm text-gray-700 leading-tight">{item.text}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.time}</p>
                            </div>
                            <button 
                                onClick={() => onDismiss(item.id)} 
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
                    <p>Tidak ada notifikasi baru.</p>
                </div>
            )}
        </div>
    </div>
);
// --- End of Notification Pop-up Components & Data ---


interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
  currentUser: Profile | null;
  onLogout: () => void;
  onNavigateToSettings: () => void;
  onNavigateToPage: (menu: MenuKey) => void;
  allOrders: SavedOrder[];
  customers: CustomerData[];
  products: ProductData[];
  expenses: ExpenseItem[];
  employees: EmployeeData[];
  menuPermissions: string[];
}

const Header: React.FC<HeaderProps> = ({ 
    title, onToggleSidebar, currentUser, onLogout, onNavigateToSettings, 
    onNavigateToPage, allOrders, customers, products, expenses, employees, menuPermissions 
}) => {
  const [notifications, setNotifications] = useState(initialNotificationsData);
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleDismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

   // Keyboard shortcut for Command Palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!currentUser) return null;

  return (
    <>
    <header id="header" className="h-20 bg-white border-b flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0">
      <div className="flex items-center">
         <button onClick={onToggleSidebar} className="text-gray-500 hover:text-gray-700 focus:outline-none mr-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">{title}</h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="relative hidden md:block w-64">
            <button
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full pl-4 pr-2 py-2 border rounded-full text-sm text-left text-gray-500 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent flex justify-between items-center"
                aria-label="Buka pencarian"
            >
                Cari nota, pelanggan...
                <kbd className="text-xs border rounded-md px-1.5 py-0.5 bg-white shadow-sm font-sans">Ctrl+K</kbd>
            </button>
        </div>

        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setNotificationsOpen(prev => !prev)}
            className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none"
            aria-label="Notifikasi"
          >
            <BellIcon />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 h-2 w-2 mt-1 mr-1 bg-red-500 rounded-full"></span>
            )}
          </button>
          {isNotificationsOpen && (
            <NotificationsPopup notifications={notifications} onDismiss={handleDismissNotification} />
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setProfileOpen(prev => !prev)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full focus:outline-none"
            aria-label="Profil Pengguna"
          >
            <UserCircleIcon />
          </button>
          {isProfileOpen && currentUser && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg border z-50">
              <div className="p-3 border-b">
                  <p className="font-semibold text-gray-800 truncate">{currentUser.name}</p>
                  <p className="text-sm text-gray-500">{currentUser.level}</p>
              </div>
              <div className="py-1">
                  <a
                      href="#"
                      onClick={(e) => {
                          e.preventDefault();
                          onNavigateToSettings();
                          setProfileOpen(false);
                      }}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                      Profil Saya
                  </a>
                  <a
                      href="#"
                      onClick={(e) => {
                          e.preventDefault();
                          onLogout();
                          setProfileOpen(false);
                      }}
                      className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                      Keluar
                  </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
    <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={onNavigateToPage}
        currentUser={currentUser}
        allOrders={allOrders}
        customers={customers}
        products={products}
        expenses={expenses}
        employees={employees}
        menuPermissions={menuPermissions}
      />
    </>
  );
};

export default Header;