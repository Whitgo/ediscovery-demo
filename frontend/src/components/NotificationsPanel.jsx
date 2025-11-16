import React, { useEffect, useState } from "react";
import { apiGet, apiPatch, apiDelete } from "../utils/api";

export default function NotificationsPanel({ onClose, onNavigateToCase, onOpenSettings }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/notifications");
      setNotifications(data);
    } catch (e) {
      console.error("Failed to load notifications:", e);
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiPatch(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (e) {
      console.error("Failed to mark as read:", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiPatch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error("Failed to mark all as read:", e);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiDelete(`/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (e) {
      console.error("Failed to delete notification:", e);
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    if (notification.case_id && onNavigateToCase) {
      onNavigateToCase(notification.case_id);
      onClose();
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      document_uploaded: "📄",
      export_completed: "📦",
      case_updated: "📋",
      default: "🔔"
    };
    return icons[type] || icons.default;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      bottom: 0,
      width: "400px",
      background: "#fff",
      boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.15)",
      zIndex: 1000,
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{
        padding: "20px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h3 style={{ margin: 0, color: "#2d3748" }}>
          Notifications
          {unreadCount > 0 && (
            <span style={{
              marginLeft: "8px",
              padding: "2px 8px",
              background: "#f56565",
              color: "#fff",
              borderRadius: "12px",
              fontSize: "0.75em",
              fontWeight: "600"
            }}>
              {unreadCount}
            </span>
          )}
        </h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            color: "#718096",
            padding: "0",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ×
        </button>
      </div>

      {/* Actions */}
      {unreadCount > 0 && (
        <div style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f7fafc",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <button
            onClick={markAllAsRead}
            style={{
              background: "none",
              border: "none",
              color: "#4299e1",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.85em",
              padding: "0"
            }}
          >
            Mark all as read
          </button>
          <button
            onClick={() => {
              onClose();
              if (onOpenSettings) onOpenSettings();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#718096",
              cursor: "pointer",
              fontSize: "1.2em",
              padding: "0",
              display: "flex",
              alignItems: "center"
            }}
            title="Notification Settings"
          >
            ⚙️
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div style={{
        flex: 1,
        overflowY: "auto"
      }}>
        {loading ? (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
            color: "#718096"
          }}>
            <div>Loading...</div>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
            color: "#718096",
            padding: "20px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔔</div>
            <div style={{ fontWeight: "600", marginBottom: "4px" }}>No notifications</div>
            <div style={{ fontSize: "0.9em" }}>You're all caught up!</div>
          </div>
        ) : (
          <div>
            {notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  background: notification.read ? "#fff" : "#edf2f7",
                  cursor: notification.case_id ? "pointer" : "default",
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (notification.case_id) {
                    e.currentTarget.style.background = notification.read ? "#f7fafc" : "#e2e8f0";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notification.read ? "#fff" : "#edf2f7";
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "8px"
                }}>
                  <div style={{
                    display: "flex",
                    gap: "12px",
                    flex: 1
                  }}>
                    <span style={{ fontSize: "24px" }}>
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: notification.read ? "400" : "700",
                        color: "#2d3748",
                        marginBottom: "4px",
                        fontSize: "0.95em"
                      }}>
                        {notification.title}
                      </div>
                      <div style={{
                        color: "#4a5568",
                        fontSize: "0.85em",
                        lineHeight: "1.4"
                      }}>
                        {notification.message}
                      </div>
                      <div style={{
                        color: "#718096",
                        fontSize: "0.75em",
                        marginTop: "6px"
                      }}>
                        {formatTimestamp(notification.created_at)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#cbd5e0",
                      cursor: "pointer",
                      fontSize: "18px",
                      padding: "0",
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#f56565";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#cbd5e0";
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
