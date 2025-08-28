
import React, { useState } from 'react';
import { ExclamationTriangleIcon, CreditCardIcon } from './Icons';

const initialNotifications: {id: number, icon: React.ReactNode, text: string, time: string, color: string}[] = [];

const NotificationItem: React.FC<{
    icon: React.ReactNode; 
    text: string; 
    time: string; 
    color: string;
    onDismiss: () => void;
}> = ({icon, text, time, color, onDismiss}) => (
    <div className={`flex items-start p-4 border-l-4 ${color} bg-gray-50 rounded-r-lg relative`}>
        <div className="flex-shrink-0">{icon}</div>
        <div className="ml-3 flex-1">
            <p className="text-sm text-gray-700">{text}</p>
            <p className="text-xs text-gray-500 mt-1">{time}</p>
        </div>
        <button onClick={onDismiss} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" aria-label="Tutup notifikasi">
            &times;
        </button>
    </div>
);


const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState(initialNotifications);

  const handleDismiss = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Notifikasi & Pengingat</h2>
      <div className="space-y-4">
        {notifications.length > 0 ? notifications.map(item => (
            <NotificationItem 
                key={item.id}
                icon={item.icon} 
                text={item.text}
                time={item.time}
                color={item.color}
                onDismiss={() => handleDismiss(item.id)}
            />
        )) : (
            <div className="text-center py-10 text-gray-500">
                <p>Tidak ada notifikasi baru.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
