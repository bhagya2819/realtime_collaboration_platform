import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { Notification } from '../../types';
import { useSocket } from '../../hooks/useSocket';

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { subscribe } = useSocket();

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    const unsub = subscribe('notification', () => {
      fetchNotifications();
    });
    return () => unsub();
  }, []);

  const handleMarkAllRead = async () => {
    await api.patch('/notifications/read-all');
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b flex justify-between items-center">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-gray-400 text-xs text-center py-6">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer text-sm ${
                    !n.isRead ? 'bg-blue-50' : ''
                  }`}
                >
                  <p className="text-gray-800">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
