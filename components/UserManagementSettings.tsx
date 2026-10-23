import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppUser, UserRole, UserPermission, ROLE_DEFINITIONS } from '../types';
import * as userService from '../services/userService';
import {
  Users, UserPlus, Search, Shield, ShieldCheck, Key, Lock, Mail, Building,
  CheckCircle2, XCircle, Edit2, Trash2, Check, X, AlertCircle, RefreshCw,
  FileCode, Copy, Layers, Eye, EyeOff, Sparkles, Filter, ChevronDown, ChevronUp
} from 'lucide-react';

interface UserManagementSettingsProps {
  onUsersChange?: () => void;
}

export const UserManagementSettings: React.FC<UserManagementSettingsProps> = ({ onUsersChange }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [isRoleGuideOpen, setIsRoleGuideOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('custodian');
  const [formPermissions, setFormPermissions] = useState<UserPermission[]>(ROLE_DEFINITIONS.custodian.defaultPermissions);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation modal state
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await userService.getUsers();
      setUsers(list);
    } catch (e) {
      console.error('Failed to load users', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      const matchStatus = selectedStatusFilter === 'all' || u.status === selectedStatusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // KPI stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.status === 'active').length;
    const admins = users.filter(u => u.role === 'admin').length;
    const custodians = users.filter(u => u.role === 'custodian').length;
    const labManagers = users.filter(u => u.role === 'lab_manager').length;
    return { total, active, admins, custodians, labManagers };
  }, [users]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormEmail('');
    setFormDepartment('Science Department');
    setFormPassword('');
    setFormRole('custodian');
    setFormPermissions(ROLE_DEFINITIONS.custodian.defaultPermissions);
    setFormStatus('active');
    setFormError('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: AppUser) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormDepartment(user.department);
    setFormPassword(''); // blank means keep unchanged
    setFormRole(user.role);
    setFormPermissions(user.permissions || ROLE_DEFINITIONS[user.role]?.defaultPermissions || []);
    setFormStatus(user.status);
    setFormError('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  // When role changes in form, apply default permissions
  const handleRoleChange = (newRole: UserRole) => {
    setFormRole(newRole);
    setFormPermissions(ROLE_DEFINITIONS[newRole]?.defaultPermissions || []);
  };

  // Toggle single permission checkbox
  const handleTogglePermission = (perm: UserPermission) => {
    setFormPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  // Submit User Form (Create or Update)
  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!formUsername.trim()) {
      setFormError('Username is required.');
      return;
    }
    const cleanUsername = formUsername.trim().toLowerCase().replace(/\s+/g, '');

    // For new user, password is required
    if (!editingUser && !formPassword) {
      setFormError('Initial password is required for new user.');
      return;
    }

    setIsSaving(true);
    try {
      const userPayload: AppUser = {
        id: editingUser ? editingUser.id : `user-${Date.now()}`,
        username: cleanUsername,
        name: formName.trim(),
        email: formEmail.trim(),
        department: formDepartment.trim() || 'Science Department',
        role: formRole,
        permissions: formPermissions,
        status: formStatus,
        createdAt: editingUser ? editingUser.createdAt : new Date().toISOString(),
        lastLogin: editingUser ? editingUser.lastLogin : undefined,
        password: formPassword.trim() ? formPassword.trim() : (editingUser?.password || 'password123')
      };

      const res = await userService.saveUser(userPayload);
      if (!res.success) {
        setFormError(res.message || 'Failed to save user.');
        return;
      }

      setFeedback({
        type: 'success',
        message: editingUser
          ? `User "${userPayload.name}" updated successfully.`
          : `New user "${userPayload.name}" created with role "${ROLE_DEFINITIONS[userPayload.role].label}".`
      });
      setIsModalOpen(false);
      await loadData();
      onUsersChange?.();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete user
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const res = await userService.deleteUser(userToDelete.id);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.message || 'Failed to delete user.' });
      } else {
        setFeedback({ type: 'success', message: `User "${userToDelete.name}" deleted.` });
      }
      setUserToDelete(null);
      await loadData();
      onUsersChange?.();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete user.' });
    }
  };

  // Toggle user status directly
  const handleToggleStatus = async (user: AppUser) => {
    if (user.username === 'admin') {
      alert('The primary system administrator cannot be suspended.');
      return;
    }
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await userService.saveUser({ ...user, status: newStatus });
    await loadData();
    onUsersChange?.();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('SQL Schema copied to clipboard!');
  };

  // Available permissions catalog grouped by module
  const permissionCategories: { module: string; permissions: { key: UserPermission; label: string; desc: string }[] }[] = [
    {
      module: 'Laboratory Inventory',
      permissions: [
        { key: 'inventory:view', label: 'View Inventory', desc: 'Browse science equipment & consumables' },
        { key: 'inventory:manage', label: 'Manage Inventory', desc: 'Add, edit, delete equipment, boxed stock & units' }
      ]
    },
    {
      module: 'Property Management (PIS)',
      permissions: [
        { key: 'property:view', label: 'View Property Articles', desc: 'Access registered school property and inventory books' },
        { key: 'property:manage', label: 'Manage Property Assets', desc: 'Add/edit property, print PIS stickers, cable tags, & DepEd reports' }
      ]
    },
    {
      module: 'Requests & Lending',
      permissions: [
        { key: 'requests:view', label: 'View Requests', desc: 'Inspect student & teacher equipment reservation requests' },
        { key: 'requests:manage', label: 'Manage Requests', desc: 'Approve, reject, release, and sign borrow permits' },
        { key: 'lending:view', label: 'View Lending Records', desc: 'View active loans, returned units, and loan logs' },
        { key: 'lending:manage', label: 'Process Loans & Returns', desc: 'Issue items, process check-ins, record damages' }
      ]
    },
    {
      module: 'Operations & Administration',
      permissions: [
        { key: 'scanner:use', label: 'Barcode/QR Scanner', desc: 'Use scanner for quick check-in / check-out' },
        { key: 'settings:view', label: 'View Settings', desc: 'Open settings dialog' },
        { key: 'settings:manage', label: 'Manage System Settings', desc: 'Edit branding, app name, categories, and Gmail automation' },
        { key: 'users:manage', label: 'Manage RBAC Users', desc: 'Create, modify, suspend, and delete user accounts' }
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-md flex items-center justify-between text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Total Accounts</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
          <p className="text-[11px] text-gray-500 mt-1">{stats.active} Active • {stats.total - stats.active} Suspended</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Administrators</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-800">{stats.admins}</div>
          <p className="text-[11px] text-gray-500 mt-1">Full system privilege</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Property Custodians</span>
            <Building className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">{stats.custodians}</div>
          <p className="text-[11px] text-gray-500 mt-1">PIS stickers & asset inventory</p>
        </div>

        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Lab Managers</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-800">{stats.labManagers}</div>
          <p className="text-[11px] text-gray-500 mt-1">Equipment borrowing & approvals</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 md:p-6 border-b border-gray-200 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Role-Based Access Control (RBAC) Users
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage authorized school personnel, custodians, lab heads, and granular role permissions.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={() => setIsRoleGuideOpen(!isRoleGuideOpen)}
              className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Shield className="w-3.5 h-3.5 text-gray-500" />
              <span>Roles Guide</span>
              {isRoleGuideOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <FileCode className="w-3.5 h-3.5 text-gray-500" />
              <span>Database SQL</span>
            </button>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Collapsible Roles & Capabilities Guide */}
        {isRoleGuideOpen && (
          <div className="p-5 bg-blue-50/60 border-b border-blue-100 animate-in fade-in duration-150">
            <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              DepEd I-LEMS Role Capabilities & Permissions Matrix
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map(roleKey => {
                const def = ROLE_DEFINITIONS[roleKey];
                return (
                  <div key={roleKey} className="bg-white p-3 rounded-md border border-blue-200/80 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-black border ${def.badgeColor.bg} ${def.badgeColor.text} ${def.badgeColor.border}`}>
                        {def.title}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {def.defaultPermissions.length} permissions
                      </span>
                    </div>
                    <div className="font-bold text-gray-900 text-xs mb-1">{def.label}</div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{def.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, username, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Roles ({users.length})</option>
              {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map(r => (
                <option key={r} value={r}>{ROLE_DEFINITIONS[r].label}</option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Status</option>
              <option value="active">Active Accounts</option>
              <option value="inactive">Suspended Accounts</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 pl-6">Personnel & Username</th>
                <th className="p-3.5">Assigned Role</th>
                <th className="p-3.5">Department / Office</th>
                <th className="p-3.5">Permissions</th>
                <th className="p-3.5 text-center">Account Status</th>
                <th className="p-3.5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500 font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="font-bold text-sm text-gray-700">No users match your criteria</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting the search query or role filter.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleDef = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.custom;
                  const initials = user.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 pl-6 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-black flex items-center justify-center text-xs flex-shrink-0 border border-blue-200">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm leading-tight flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {user.username === 'admin' && (
                                <span className="text-[10px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-xs">
                                  PRIMARY
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500 font-mono text-[11px] flex items-center gap-2 mt-0.5">
                              <span>@{user.username}</span>
                              {user.email && (
                                <>
                                  <span>•</span>
                                  <span>{user.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-black border ${roleDef.badgeColor.bg} ${roleDef.badgeColor.text} ${roleDef.badgeColor.border}`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{roleDef.label}</span>
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-gray-700 font-medium">
                        {user.department}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 border border-gray-300 text-gray-700 rounded-sm text-[11px] font-mono font-bold">
                          {user.permissions?.length || 0} / 12 Permitted
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          title={`Click to ${user.status === 'active' ? 'suspend' : 'activate'} user`}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border transition-all ${
                            user.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                          <span className="uppercase">{user.status}</span>
                        </button>
                      </td>

                      <td className="p-3.5 text-right pr-6 whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            title="Edit User & Permissions"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {user.username !== 'admin' && (
                            <button
                              onClick={() => setUserToDelete(user)}
                              title="Delete User"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-blue-600 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-white/10 rounded-sm">
                  {editingUser ? <Edit2 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-base leading-tight">
                  {editingUser ? `Edit User: ${editingUser.name}` : 'Create Authorized User'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-sm hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitUser} className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/50">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-sm text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Personal Details */}
              <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Account Profile & Credentials
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Full Personnel Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Grace Mendoza"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. jdelacruz"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Official Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. jdelacruz@deped.gov.ph"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Department / Office</label>
                    <input
                      type="text"
                      placeholder="e.g. Science Department"
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1 text-xs">
                    {editingUser ? 'Change Password (Leave blank to keep existing)' : 'Login Password *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={editingUser ? '••••••••' : 'Enter strong password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-sm font-mono text-xs text-gray-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm space-y-4">
                <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Assigned RBAC Role
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((rKey) => {
                    const rDef = ROLE_DEFINITIONS[rKey];
                    const isSelected = formRole === rKey;
                    return (
                      <div
                        key={rKey}
                        onClick={() => handleRoleChange(rKey)}
                        className={`p-3 rounded-md border cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="userRole"
                          checked={isSelected}
                          onChange={() => handleRoleChange(rKey)}
                          className="mt-0.5 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            <span>{rDef.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-black border ${rDef.badgeColor.bg} ${rDef.badgeColor.text} ${rDef.badgeColor.border}`}>
                              {rDef.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                            {rDef.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Granular Permissions Checkbox Grid */}
              <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    Granular Permission Controls ({formPermissions.length} / 12 Enabled)
                  </h4>
                  <div className="space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFormPermissions(ROLE_DEFINITIONS.admin.defaultPermissions)}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      Check All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFormPermissions([])}
                      className="text-gray-500 hover:underline font-bold"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  {permissionCategories.map(cat => (
                    <div key={cat.module}>
                      <div className="font-bold text-gray-700 uppercase text-[10px] tracking-wider mb-2 text-gray-400">
                        {cat.module}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cat.permissions.map(perm => {
                          const isChecked = formPermissions.includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`p-2.5 rounded-sm border cursor-pointer flex items-start gap-2 transition-colors ${
                                isChecked
                                  ? 'bg-blue-50/50 border-blue-300'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(perm.key)}
                                className="mt-0.5 text-blue-600 rounded-sm focus:ring-blue-500"
                              />
                              <div>
                                <div className="font-bold text-gray-900 leading-tight">
                                  {perm.label}
                                </div>
                                <div className="text-[10.5px] text-gray-500 leading-tight mt-0.5">
                                  {perm.desc}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Account Status toggle */}
              <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900 block">Account Status</span>
                  <span className="text-gray-500 text-[11px]">
                    Suspended accounts cannot log in or sign permits
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStatus('active')}
                    className={`px-3 py-1.5 rounded-sm font-bold border transition-all ${
                      formStatus === 'active'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('inactive')}
                    className={`px-3 py-1.5 rounded-sm font-bold border transition-all ${
                      formStatus === 'inactive'
                        ? 'bg-red-600 text-white border-red-700 shadow-xs'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Suspended
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-sm text-xs shadow-md transition-all flex items-center space-x-1.5"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{editingUser ? 'Save User Changes' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* CONFIRM DELETE MODAL */}
      {userToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-md shadow-2xl max-w-md w-full p-6 border border-gray-200 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete User Account</h3>
            <p className="text-xs text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to permanently remove <strong>{userToDelete.name}</strong> (@{userToDelete.username})? This user will no longer be able to access the system.
            </p>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-sm text-xs shadow-md"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SQL DATABASE MIGRATION MODAL */}
      {isSqlModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full p-6 border border-gray-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 text-base">Supabase Cloud Database Schema (app_users)</h3>
              </div>
              <button onClick={() => setIsSqlModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-3">
              To persist users across multiple devices on the cloud, run this script in your Supabase project's SQL Editor. (Local storage fallback is active by default).
            </p>
            <div className="flex-1 overflow-y-auto bg-gray-900 text-emerald-400 p-4 rounded-md font-mono text-xs border border-gray-800">
              <pre className="whitespace-pre-wrap">{userService.SQL_APP_USERS_SCHEMA}</pre>
            </div>
            <div className="pt-4 flex justify-between items-center">
              <span className="text-[11px] text-gray-400">PostgreSQL / Supabase RLS compatible</span>
              <button
                onClick={() => copyCode(userService.SQL_APP_USERS_SCHEMA)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Copy className="w-4 h-4" />
                <span>Copy SQL Snippet</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UserManagementSettings;
