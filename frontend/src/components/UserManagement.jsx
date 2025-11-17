import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/api";
import { getAllRoles } from "../utils/rbac";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user"
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const roles = getAllRoles();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/users");
      setUsers(data);
      setError("");
    } catch (e) {
      setError("Failed to load users: " + e.message);
    }
    setLoading(false);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name || !formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      await apiPost("/users", formData);
      setSuccess("User created successfully");
      setShowAddModal(false);
      setFormData({ name: "", email: "", password: "", role: "user" });
      loadUsers();
    } catch (e) {
      setError("Failed to create user: " + e.message);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.name || !formData.email) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const updateData = { name: formData.name, email: formData.email, role: formData.role };
      if (formData.password) {
        if (formData.password.length < 6) {
          setError("Password must be at least 6 characters");
          return;
        }
        updateData.password = formData.password;
      }
      await apiPatch(`/users/${editingUser.id}`, updateData);
      setSuccess("User updated successfully");
      setEditingUser(null);
      setFormData({ name: "", email: "", password: "", role: "user" });
      loadUsers();
    } catch (e) {
      setError("Failed to update user: " + e.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiDelete(`/users/${userId}`);
      setSuccess("User deleted successfully");
      loadUsers();
    } catch (e) {
      setError("Failed to delete user: " + e.message);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role
    });
    setError("");
    setSuccess("");
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingUser(null);
    setFormData({ name: "", email: "", password: "", role: "user" });
    setError("");
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      manager: "#9f7aea",
      user: "#4299e1",
      support: "#48bb78",
      viewer: "#718096"
    };
    return colors[role] || "#a0aec0";
  };

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "400px",
        color: "#718096"
      }}>
        <div>
          <div style={{ fontSize: "48px", marginBottom: "16px", textAlign: "center" }}>⏳</div>
          <div>Loading users...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px"
      }}>
        <div>
          <h2 style={{ margin: "0 0 8px 0", color: "#2d3748" }}>User Management</h2>
          <p style={{ margin: 0, color: "#718096", fontSize: "0.95em" }}>
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: "12px 24px",
            background: "#2166e8",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "0.95em",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span style={{ fontSize: "1.2em" }}>+</span> Add User
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div style={{
          padding: "12px 16px",
          background: "#c6f6d5",
          color: "#22543d",
          borderRadius: "8px",
          marginBottom: "16px",
          border: "1px solid #9ae6b4"
        }}>
          ✓ {success}
        </div>
      )}
      {error && !showAddModal && !editingUser && (
        <div style={{
          padding: "12px 16px",
          background: "#fed7d7",
          color: "#742a2a",
          borderRadius: "8px",
          marginBottom: "16px",
          border: "1px solid #fc8181"
        }}>
          ✗ {error}
        </div>
      )}

      {/* Users Table */}
      <div style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        overflow: "hidden"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#f7fafc", borderBottom: "2px solid #e2e8f0" }}>
            <tr>
              <th style={{ padding: "16px", textAlign: "left", fontWeight: "600", color: "#2d3748" }}>
                Name
              </th>
              <th style={{ padding: "16px", textAlign: "left", fontWeight: "600", color: "#2d3748" }}>
                Email
              </th>
              <th style={{ padding: "16px", textAlign: "left", fontWeight: "600", color: "#2d3748" }}>
                Role
              </th>
              <th style={{ padding: "16px", textAlign: "right", fontWeight: "600", color: "#2d3748" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "16px", color: "#2d3748", fontWeight: "600" }}>
                  {user.name}
                </td>
                <td style={{ padding: "16px", color: "#4a5568" }}>
                  {user.email}
                </td>
                <td style={{ padding: "16px" }}>
                  <span style={{
                    padding: "4px 12px",
                    background: getRoleBadgeColor(user.role) + "20",
                    color: getRoleBadgeColor(user.role),
                    borderRadius: "16px",
                    fontSize: "0.85em",
                    fontWeight: "600",
                    textTransform: "capitalize"
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "16px", textAlign: "right" }}>
                  <button
                    onClick={() => openEditModal(user)}
                    style={{
                      padding: "6px 12px",
                      background: "#fff",
                      color: "#4299e1",
                      border: "1px solid #4299e1",
                      borderRadius: "6px",
                      cursor: "pointer",
                      marginRight: "8px",
                      fontWeight: "600",
                      fontSize: "0.85em"
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.name)}
                    style={{
                      padding: "6px 12px",
                      background: "#fff",
                      color: "#f56565",
                      border: "1px solid #f56565",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.85em"
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div style={{
            padding: "40px",
            textAlign: "center",
            color: "#718096"
          }}>
            No users found. Click "Add User" to create one.
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {(showAddModal || editingUser) && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px"
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "24px",
              borderBottom: "1px solid #e2e8f0"
            }}>
              <h3 style={{ margin: 0, color: "#2d3748" }}>
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
            </div>

            {/* Modal Body */}
            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser}>
              <div style={{ padding: "24px" }}>
                {error && (
                  <div style={{
                    padding: "12px 16px",
                    background: "#fed7d7",
                    color: "#742a2a",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    border: "1px solid #fc8181",
                    fontSize: "0.9em"
                  }}>
                    ✗ {error}
                  </div>
                )}

                {/* Name Field */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "600",
                    color: "#2d3748",
                    fontSize: "0.9em"
                  }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #cbd5e0",
                      borderRadius: "6px",
                      fontSize: "0.95em",
                      boxSizing: "border-box"
                    }}
                    required
                  />
                </div>

                {/* Email Field */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "600",
                    color: "#2d3748",
                    fontSize: "0.9em"
                  }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #cbd5e0",
                      borderRadius: "6px",
                      fontSize: "0.95em",
                      boxSizing: "border-box"
                    }}
                    required
                  />
                </div>

                {/* Password Field */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "600",
                    color: "#2d3748",
                    fontSize: "0.9em"
                  }}>
                    Password {editingUser ? "(leave blank to keep current)" : "*"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "••••••••" : "Minimum 6 characters"}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #cbd5e0",
                      borderRadius: "6px",
                      fontSize: "0.95em",
                      boxSizing: "border-box"
                    }}
                    required={!editingUser}
                  />
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8em", color: "#718096" }}>
                    Minimum 6 characters
                  </p>
                </div>

                {/* Role Field */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{
                    display: "block",
                    marginBottom: "6px",
                    fontWeight: "600",
                    color: "#2d3748",
                    fontSize: "0.9em"
                  }}>
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #cbd5e0",
                      borderRadius: "6px",
                      fontSize: "0.95em",
                      boxSizing: "border-box",
                      background: "#fff"
                    }}
                    required
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>
                        {role.label} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px"
              }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: "10px 20px",
                    background: "#fff",
                    color: "#4a5568",
                    border: "1px solid #cbd5e0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.9em"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 20px",
                    background: "#2166e8",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.9em"
                  }}
                >
                  {editingUser ? "Update User" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
