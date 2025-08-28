import React from 'react';
import { MENU_ITEMS, SETTINGS_MENU_ITEM } from '../constants';
import { type MenuKey, type Profile, type MenuPermissions } from '../types';

interface SidebarProps {
  activeMenu: MenuKey;
  onMenuClick: (menu: MenuKey) => void;
  isOpen: boolean;
  currentUser: Profile | null;
  onLogout: () => void;
  menuPermissions: MenuPermissions;
}

const Sidebar: React.FC<SidebarProps> = ({ activeMenu, onMenuClick, isOpen, currentUser, onLogout, menuPermissions }) => {
  const baseTransition = 'transition-all duration-300 ease-in-out';

  if (!currentUser) {
    return null; // Don't render sidebar if no user
  }

  const currentUserLevel = currentUser.level;
  const accessibleMenuKeys = menuPermissions[currentUserLevel] || [];
  const accessibleMenuItems = MENU_ITEMS.filter(item => accessibleMenuKeys.includes(item.key));
  const canSeeSettings = accessibleMenuKeys.includes(SETTINGS_MENU_ITEM.key);


  // Reusable Link Component
  const SidebarLink = ({ item }: { item: typeof MENU_ITEMS[0] }) => (
    <a
      key={item.key}
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onMenuClick(item.key);
      }}
      className={`flex items-center py-2.5 px-4 rounded-lg group ${baseTransition} ${
        activeMenu === item.key
          ? 'bg-pink-600 text-white shadow-md'
          : 'hover:bg-pink-50 hover:text-pink-600'
      } ${!isOpen && 'justify-center'}`}
    >
      <div className="w-6 h-6">{item.icon}</div>
      <span
        className={`ml-4 font-medium ${baseTransition} ${
          !isOpen && 'opacity-0 hidden'
        }`}
      >
        {item.label}
      </span>
    </a>
  );

  return (
    <aside
      id="sidebar"
      className={`bg-white text-gray-700 flex flex-col shadow-lg ${baseTransition} ${
        isOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center flex-shrink-0 ${isOpen ? 'justify-start px-4' : 'justify-center'} h-20 border-b`}>
        <img
          src={isOpen
            ? "https://wqgbkwujfxdwlywxrjup.supabase.co/storage/v1/object/public/publik/nala%20panjang.svg"
            : "https://wqgbkwujfxdwlywxrjup.supabase.co/storage/v1/object/public/publik/nala%20persegi.svg"
          }
          alt="Nala Media Logo"
          className={`transition-all duration-300 ease-in-out ${isOpen ? 'h-12' : 'h-10 w-10'}`}
        />
      </div>

      {/* Main scrollable menu */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {accessibleMenuItems.map((item) => (
          <SidebarLink key={item.key} item={item} />
        ))}
      </nav>

      {/* Bottom fixed items */}
      <div className="flex-shrink-0">
        {/* Settings Link */}
        {canSeeSettings && (
            <div className="px-3 py-4 space-y-2 border-t">
                <SidebarLink item={SETTINGS_MENU_ITEM} />
            </div>
        )}

        {/* User Profile */}
        <div className={`p-4 border-t ${!isOpen && 'hidden'}`}>
          <div className="flex items-center p-3 rounded-lg bg-gray-50">
            <img src="https://picsum.photos/100/100" alt="User" className="w-10 h-10 rounded-full" />
            <div className="ml-3">
              <p className="font-semibold text-sm">{currentUser.name || 'Pengguna'}</p>
              <button onClick={onLogout} className="text-xs text-red-600 hover:underline font-semibold">
                Keluar
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;