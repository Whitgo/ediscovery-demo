import React, { useEffect, useState } from "react";
import { apiGet, apiPatch } from "../utils/api";

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    document_uploads_enabled: true,
    exports_enabled: true,
    case_updates_enabled: true,
    only_assigned_cases: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/notifications/preferences");
      setPreferences(data);
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
    setLoading(false);
  };

  const handleToggle = async (field) => {
    const newValue = !preferences[field];
    setPreferences(prev => ({ ...prev, [field]: newValue }));
    
    setSaving(true);
    setMessage("");
    try {
      await apiPatch("/notifications/preferences", {
        [field]: newValue
      });
      setMessage("Preferences saved ✓");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      console.error("Failed to save preferences:", e);
      // Revert on error
      setPreferences(prev => ({ ...prev, [field]: !newValue }));
      setMessage("Failed to save preferences");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "200px",
        color: "#718096"
      }}>
        <div>Loading preferences...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 8px 0", color: "#2d3748" }}>Notification Preferences</h2>
        <p style={{ margin: 0, color: "#718096", fontSize: "0.95em" }}>
          Control which notifications you receive
        </p>
      </div>

      {/* Success Message */}
      {message && (
        <div style={{
          padding: "12px 16px",
          background: message.includes("✓") ? "#c6f6d5" : "#fed7d7",
          color: message.includes("✓") ? "#22543d" : "#742a2a",
          borderRadius: "8px",
          marginBottom: "20px",
          border: message.includes("✓") ? "1px solid #9ae6b4" : "1px solid #fc8181"
        }}>
          {message}
        </div>
      )}

      {/* Preferences Card */}
      <div style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
      }}>
        {/* Case Assignment Filter */}
        <div style={{
          padding: "20px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f7fafc"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: "600",
                color: "#2d3748",
                marginBottom: "4px",
                fontSize: "1.05em"
              }}>
                📋 Only Assigned Cases
              </div>
              <div style={{ color: "#4a5568", fontSize: "0.9em" }}>
                Only receive notifications for cases assigned to you
              </div>
            </div>
            <label style={{
              position: "relative",
              display: "inline-block",
              width: "52px",
              height: "28px",
              marginLeft: "16px"
            }}>
              <input
                type="checkbox"
                checked={preferences.only_assigned_cases}
                onChange={() => handleToggle("only_assigned_cases")}
                disabled={saving}
                style={{ display: "none" }}
              />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: preferences.only_assigned_cases ? "#48bb78" : "#cbd5e0",
                borderRadius: "34px",
                transition: "0.3s"
              }}>
                <span style={{
                  position: "absolute",
                  content: "",
                  height: "20px",
                  width: "20px",
                  left: preferences.only_assigned_cases ? "28px" : "4px",
                  bottom: "4px",
                  background: "#fff",
                  borderRadius: "50%",
                  transition: "0.3s"
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Document Uploads */}
        <div style={{
          padding: "20px",
          borderBottom: "1px solid #e2e8f0"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: "600",
                color: "#2d3748",
                marginBottom: "4px"
              }}>
                📄 Document Uploads
              </div>
              <div style={{ color: "#4a5568", fontSize: "0.9em" }}>
                Get notified when new documents are uploaded to cases
              </div>
            </div>
            <label style={{
              position: "relative",
              display: "inline-block",
              width: "52px",
              height: "28px",
              marginLeft: "16px"
            }}>
              <input
                type="checkbox"
                checked={preferences.document_uploads_enabled}
                onChange={() => handleToggle("document_uploads_enabled")}
                disabled={saving}
                style={{ display: "none" }}
              />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: preferences.document_uploads_enabled ? "#48bb78" : "#cbd5e0",
                borderRadius: "34px",
                transition: "0.3s"
              }}>
                <span style={{
                  position: "absolute",
                  content: "",
                  height: "20px",
                  width: "20px",
                  left: preferences.document_uploads_enabled ? "28px" : "4px",
                  bottom: "4px",
                  background: "#fff",
                  borderRadius: "50%",
                  transition: "0.3s"
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Export Completions */}
        <div style={{
          padding: "20px",
          borderBottom: "1px solid #e2e8f0"
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: "600",
                color: "#2d3748",
                marginBottom: "4px"
              }}>
                📦 Export Completions
              </div>
              <div style={{ color: "#4a5568", fontSize: "0.9em" }}>
                Get notified when your document exports are ready
              </div>
            </div>
            <label style={{
              position: "relative",
              display: "inline-block",
              width: "52px",
              height: "28px",
              marginLeft: "16px"
            }}>
              <input
                type="checkbox"
                checked={preferences.exports_enabled}
                onChange={() => handleToggle("exports_enabled")}
                disabled={saving}
                style={{ display: "none" }}
              />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: preferences.exports_enabled ? "#48bb78" : "#cbd5e0",
                borderRadius: "34px",
                transition: "0.3s"
              }}>
                <span style={{
                  position: "absolute",
                  content: "",
                  height: "20px",
                  width: "20px",
                  left: preferences.exports_enabled ? "28px" : "4px",
                  bottom: "4px",
                  background: "#fff",
                  borderRadius: "50%",
                  transition: "0.3s"
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Case Updates */}
        <div style={{ padding: "20px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: "600",
                color: "#2d3748",
                marginBottom: "4px"
              }}>
                📋 Case Updates
              </div>
              <div style={{ color: "#4a5568", fontSize: "0.9em" }}>
                Get notified when case details or status changes
              </div>
            </div>
            <label style={{
              position: "relative",
              display: "inline-block",
              width: "52px",
              height: "28px",
              marginLeft: "16px"
            }}>
              <input
                type="checkbox"
                checked={preferences.case_updates_enabled}
                onChange={() => handleToggle("case_updates_enabled")}
                disabled={saving}
                style={{ display: "none" }}
              />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: preferences.case_updates_enabled ? "#48bb78" : "#cbd5e0",
                borderRadius: "34px",
                transition: "0.3s"
              }}>
                <span style={{
                  position: "absolute",
                  content: "",
                  height: "20px",
                  width: "20px",
                  left: preferences.case_updates_enabled ? "28px" : "4px",
                  bottom: "4px",
                  background: "#fff",
                  borderRadius: "50%",
                  transition: "0.3s"
                }} />
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: "20px",
        padding: "16px",
        background: "#edf2f7",
        border: "1px solid #cbd5e0",
        borderRadius: "8px",
        fontSize: "0.9em",
        color: "#4a5568"
      }}>
        <strong>💡 Tip:</strong> Enable "Only Assigned Cases" to reduce notification noise and only receive updates for cases you're working on.
      </div>
    </div>
  );
}
