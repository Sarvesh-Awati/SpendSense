import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { updateProfile, changePassword, logoutAllDevices, deleteAccount, exportData } from '../../services/user';
import Avatar from '../../components/common/Avatar';
import { Loader2, Camera, User, Mail, Lock, Download, Trash2, Smartphone, Moon, Sun, Monitor, Bell, Settings, Shield, UserCircle, Globe } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    profilePictureUrl: user?.profilePictureUrl || '',
  });

  const [preferences, setPreferences] = useState({
    preferredCurrency: user?.preferredCurrency || 'USD',
    language: user?.language || 'en',
    dateFormat: user?.dateFormat || 'DD/MM/YYYY',
    timeFormat: user?.timeFormat || '12h',
  });

  const [appearance, setAppearance] = useState({
    theme: user?.theme || 'dark',
  });

  const [notifications, setNotifications] = useState({
    budgetAlerts: user?.budgetAlerts ?? true,
    savingsReminders: user?.savingsReminders ?? true,
    subscriptionRenewals: user?.subscriptionRenewals ?? true,
    receiptScanNotifications: user?.receiptScanNotifications ?? true,
    emailNotifications: user?.emailNotifications ?? true,
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Apply theme dynamically to document
    if (appearance.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (appearance.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [appearance.theme]);

  const handleUpdate = async (section: string, dataToUpdate: any) => {
    setIsLoading(true);
    try {
      await updateProfile(dataToUpdate);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast(`${section} updated successfully`, 'success');
    } catch (err: any) {
      toast(err.response?.data?.message || `Failed to update ${section}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdate('Profile', formData);
  };

  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdate('Preferences', preferences);
  };

  const handleAppearanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdate('Appearance', appearance);
  };

  const handleNotificationsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdate('Notifications', notifications);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }
    setIsPasswordLoading(true);
    try {
      await changePassword({ currentPassword: securityData.currentPassword, newPassword: securityData.newPassword });
      toast('Password changed successfully', 'success');
      setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleLogoutAll = async () => {
    try {
      await logoutAllDevices();
      toast('Logged out from all devices successfully', 'success');
      logout();
    } catch (err: any) {
      toast('Failed to logout from all devices', 'error');
    }
  };

  const handleExportData = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SpendSense_Data.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast('Failed to export data', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
      try {
        await deleteAccount();
        logout();
      } catch (err: any) {
        toast('Failed to delete account', 'error');
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 500;
        canvas.height = 500;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 500, 500);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, profilePictureUrl: base64 }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'preferences', label: 'Preferences', icon: Globe },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'account', label: 'Account', icon: Settings },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in text-left">
      <div>
        <h1 className="font-outfit text-3xl font-bold tracking-tight text-text-primaryLight dark:text-text-primaryDark">Settings</h1>
        <p className="text-sm text-text-secondaryLight dark:text-text-secondaryDark mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-brand-primary text-white shadow-md' 
                      : 'text-text-secondaryLight dark:text-text-secondaryDark hover:bg-slate-100 dark:hover:bg-[#1f2937]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-premium dark:shadow-premium-dark overflow-hidden p-6 sm:p-8 text-text-primaryLight dark:text-text-primaryDark">
          
          {/* PROFILE SECTION */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold">Profile</h2>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Update your photo and personal details.</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <Avatar 
                  firstName={formData.firstName || user?.firstName} 
                  lastName={formData.lastName || user?.lastName} 
                  email={formData.email || user?.email} 
                  imageUrl={formData.profilePictureUrl} 
                  size="xl" 
                />
                <div className="flex-1 space-y-3 text-center sm:text-left w-full">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageUpload} 
                      accept="image/jpeg, image/png, image/webp" 
                      className="hidden" 
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-semibold hover:bg-slate-50 dark:hover:bg-[#111622] transition-colors w-full sm:w-auto flex items-center justify-center gap-2"
                    >
                      <Camera className="w-4 h-4" /> Change Picture
                    </button>
                    {formData.profilePictureUrl && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, profilePictureUrl: '' }))}
                        className="px-4 py-2.5 rounded-xl border border-finance-expense/30 text-finance-expense text-sm font-semibold hover:bg-finance-expense/5 transition-colors w-full sm:w-auto"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark">JPG, PNG or WEBP. Max size of 5MB.</p>
                </div>
              </div>

              <hr className="border-border-light dark:border-border-dark" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">First Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Last Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-100 dark:bg-[#0b0e14] text-text-secondaryLight dark:text-text-secondaryDark text-sm cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-2">Email cannot be changed.</p>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isLoading} className="px-6 py-3 rounded-xl bg-brand-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Save Profile
                </button>
              </div>
            </form>
          )}

          {/* PREFERENCES SECTION */}
          {activeTab === 'preferences' && (
            <form onSubmit={handlePreferencesSubmit} className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold">Preferences</h2>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Manage your regional formatting settings.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Preferred Currency</label>
                  <select
                    value={preferences.preferredCurrency}
                    onChange={e => setPreferences(prev => ({ ...prev, preferredCurrency: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="CNY">CNY (¥)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Language</label>
                  <select
                    value={preferences.language}
                    onChange={e => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none"
                  >
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Date Format</label>
                  <select
                    value={preferences.dateFormat}
                    onChange={e => setPreferences(prev => ({ ...prev, dateFormat: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Time Format</label>
                  <select
                    value={preferences.timeFormat}
                    onChange={e => setPreferences(prev => ({ ...prev, timeFormat: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none"
                  >
                    <option value="12h">12 Hour</option>
                    <option value="24h">24 Hour</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isLoading} className="px-6 py-3 rounded-xl bg-brand-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Save Preferences
                </button>
              </div>
            </form>
          )}

          {/* APPEARANCE SECTION */}
          {activeTab === 'appearance' && (
            <form onSubmit={handleAppearanceSubmit} className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold">Appearance</h2>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Customize the interface theme.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setAppearance({ theme: 'light' })}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${appearance.theme === 'light' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-light dark:border-border-dark hover:border-brand-primary/50'}`}
                >
                  <Sun className={`w-8 h-8 ${appearance.theme === 'light' ? 'text-brand-primary' : 'text-text-secondaryLight dark:text-text-secondaryDark'}`} />
                  <span className="font-semibold text-sm">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppearance({ theme: 'dark' })}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${appearance.theme === 'dark' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-light dark:border-border-dark hover:border-brand-primary/50'}`}
                >
                  <Moon className={`w-8 h-8 ${appearance.theme === 'dark' ? 'text-brand-primary' : 'text-text-secondaryLight dark:text-text-secondaryDark'}`} />
                  <span className="font-semibold text-sm">Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppearance({ theme: 'system' })}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all ${appearance.theme === 'system' ? 'border-brand-primary bg-brand-primary/5' : 'border-border-light dark:border-border-dark hover:border-brand-primary/50'}`}
                >
                  <Monitor className={`w-8 h-8 ${appearance.theme === 'system' ? 'text-brand-primary' : 'text-text-secondaryLight dark:text-text-secondaryDark'}`} />
                  <span className="font-semibold text-sm">System</span>
                </button>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isLoading} className="px-6 py-3 rounded-xl bg-brand-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Save Appearance
                </button>
              </div>
            </form>
          )}

          {/* NOTIFICATIONS SECTION */}
          {activeTab === 'notifications' && (
            <form onSubmit={handleNotificationsSubmit} className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold">Notifications</h2>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Manage how we communicate with you.</p>
              </div>

              <div className="space-y-6">
                {Object.entries({
                  budgetAlerts: 'Budget Alerts',
                  savingsReminders: 'Savings Reminders',
                  subscriptionRenewals: 'Subscription Renewals',
                  receiptScanNotifications: 'Receipt Scan Notifications',
                  emailNotifications: 'Email Notifications',
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-text-primaryLight dark:text-text-primaryDark">{label}</h3>
                      <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">Receive updates about your {label.toLowerCase()}.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={(notifications as any)[key]} 
                        onChange={e => setNotifications(prev => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-primary/20 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isLoading} className="px-6 py-3 rounded-xl bg-brand-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50">
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />} Save Notifications
                </button>
              </div>
            </form>
          )}

          {/* SECURITY SECTION */}
          {activeTab === 'security' && (
            <div className="space-y-10 animate-fade-in">
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold">Security</h2>
                  <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Update your password and secure your account.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Current Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={securityData.currentPassword}
                        onChange={e => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={securityData.newPassword}
                        onChange={e => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondaryLight dark:text-text-secondaryDark mb-2">Confirm New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondaryLight/50 dark:text-text-secondaryDark/40">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={securityData.confirmPassword}
                        onChange={e => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] text-sm focus:outline-none focus:border-brand-primary transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button type="submit" disabled={isPasswordLoading} className="px-6 py-3 rounded-xl bg-brand-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50">
                    {isPasswordLoading && <Loader2 className="w-4 h-4 animate-spin" />} Update Password
                  </button>
                </div>
              </form>

              <hr className="border-border-light dark:border-border-dark" />

              <div>
                <h3 className="text-sm font-bold text-text-primaryLight dark:text-text-primaryDark mb-4">Device Management</h3>
                <div className="flex items-center justify-between p-4 rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primaryLight dark:text-text-primaryDark">Log out from all devices</h4>
                      <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-0.5">This will invalidate all current sessions.</p>
                    </div>
                  </div>
                  <button onClick={handleLogoutAll} className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    Log out all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACCOUNT SECTION */}
          {activeTab === 'account' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-lg font-bold">Account Data</h2>
                <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Manage your personal data and account status.</p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-[#111622] gap-4">
                  <div>
                    <h4 className="text-sm font-bold">Export My Data</h4>
                    <p className="text-xs text-text-secondaryLight dark:text-text-secondaryDark mt-1">Download a copy of your transactions, budgets, goals, and profile data in JSON format.</p>
                  </div>
                  <button onClick={handleExportData} className="px-5 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-primaryLight dark:text-text-primaryDark text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#1f2937] transition-colors whitespace-nowrap">
                    <Download className="w-4 h-4" /> Export JSON
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl border border-finance-expense/30 bg-finance-expense/5 gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-finance-expense">Delete Account</h4>
                    <p className="text-xs text-finance-expense/80 mt-1">Permanently delete your account and all of your content. This action cannot be undone.</p>
                  </div>
                  <button onClick={handleDeleteAccount} className="px-5 py-2.5 rounded-xl bg-finance-expense text-white text-sm font-semibold flex items-center gap-2 hover:bg-red-600 transition-colors whitespace-nowrap">
                    <Trash2 className="w-4 h-4" /> Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Profile;
