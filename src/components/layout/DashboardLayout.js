'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sun, Moon, Users, LayoutDashboard, Briefcase, Calendar, User,
  MessageSquare, Settings, LogOut, Bell,
  Search, ChevronRight, ChevronDown, TrendingUp,
  FileText, ShieldCheck, Activity, Menu, X, Zap, Rocket, Trash2, Send, Library, Globe, BarChart3 
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import GlobalToast from '@/components/ui/GlobalToast';
import { useI18n } from '@/lib/i18n';

/**
 * IMPACTOS OPERATIONAL CONTROL ÔÇö GLOBAL LAYOUT
 * Simplified, high-performance frame with i18n and theme support.
 */

const SidebarContent = ({ collapsed, role, user, navItems, openMenus, toggleMenu, pathname, setMobileMenuOpen, handleLogout, t }) => {
  return (
    <>
      <div className="flex items-center gap-4 px-3 mb-14 mt-4">
        {collapsed ? (
          <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <img src="/brand/icon_orange.png" alt="FS" className="w-8 h-8 object-contain" />
          </div>
        ) : (
          <img src="/brand/logo_full.png" alt="Future Studio" className="h-8 object-contain animate-in fade-in" />
        )}
      </div>

      {!collapsed && (
        <div className="px-3 mb-4">
           <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-40">Main Operations</p>
        </div>
      )}

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          if (item.subItems) {
            const isChildActive = item.subItems.some(sub => pathname?.startsWith(sub.href));
            const isOpen = openMenus[item.id] || isChildActive;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all font-bold text-[12px] uppercase tracking-wider ${isChildActive ? 'text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-secondary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                >
                  <div className="flex items-center gap-4">
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isChildActive ? 'text-[var(--brand-orange)]' : 'text-[var(--text-secondary)]'}`} />
                    {!collapsed && <span className="truncate">{t(item.id) || item.name}</span>}
                  </div>
                  {!collapsed && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                </button>
                {isOpen && !collapsed && (
                  <div className="pl-8 space-y-1 py-1">
                    {item.subItems.map(subItem => {
                      const isSubActive = pathname === subItem.href;
                      return (
                        <Link
                          key={subItem.id || subItem.href}
                          href={subItem.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wide ${isSubActive ? 'text-[var(--brand-orange)] bg-[var(--bg-tertiary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                        >
                          <span className="truncate">
                            {subItem.id?.startsWith('prog_') ? subItem.name : (t(subItem.id) || subItem.name)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.id || item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-bold text-[12px] uppercase tracking-wider ${isActive ? 'bg-[var(--brand-orange)] text-white border border-orange-600/20 italic' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-black' : 'text-[var(--text-secondary)]'}`} />
              {!collapsed && <span className="truncate">{t(item.id) || item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8 border-t border-[var(--border-secondary)] space-y-3">
        {!collapsed && (
           <p className="px-3 mb-2 text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-30">User Protocol</p>
        )}
        <Link 
          href={`/${role === 'super_admin' ? 'admin' : role === 'program_manager' ? 'pm' : role === 'teacher' ? 'teacher' : 'participant'}/profile`}
          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] ${pathname?.includes('profile') ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{t('profile')}</span>}
        </Link>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-black uppercase tracking-widest text-[10px]"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>{t('logout')}</span>}
        </button>
      </div>
    </>
  );
};

const NAVIGATION_MATRIX = {
  super_admin: [
    { id: 'dashboard', name: 'DASHBOARD', icon: LayoutDashboard, href: '/admin' },
    { id: 'programs', name: 'PROGRAMS', icon: Briefcase, subItems: [
        { id: 'all_programs', name: 'ALL PROGRAMS', href: '/admin/programs' },
        { id: 'create_program', name: 'CREATE PROGRAM', href: '/admin/programs/new' },
    ]},
    { id: 'progress_hub', name: 'PROGRESS', icon: Activity, href: '/admin/progress' },
    { id: 'communication', name: 'COMMUNICATION', icon: Send, subItems: [
        { id: 'campaigns', name: 'CAMPAIGNS', href: '/admin/communications/campaigns' },
        { id: 'forms', name: 'FORMS', href: '/admin/communications/forms' },
        { id: 'all_contacts', name: 'CONTACTS', href: '/admin/communications/contacts' },
    ]},
    { id: 'knowledge', name: 'KNOWLEDGE', icon: Library, href: '/admin/knowledge' },
    { id: 'reports', name: 'REPORTS', icon: BarChart3, subItems: [
        { id: 'report_hub', name: 'REPORTS HUB', href: '/admin/reports' },
        { id: 'report_responses', name: 'REPORT RESPONSES', href: '/admin/reports/responses' },
    ]},
  ],
  admin: [
    { id: 'dashboard', name: 'DASHBOARD', icon: ShieldCheck, href: '/admin' },
    { id: 'personnel', name: 'TEAM SETTINGS', icon: Users, href: '/admin/personnel' },
    { id: 'projects', name: 'PROJECTS', icon: Briefcase, href: '/admin/projects' },
    { id: 'logs', name: 'ACTIVITY LOGS', icon: FileText, href: '/admin/logs' },
    { id: 'reports', name: 'REPORTS', icon: BarChart3, href: '/admin/reports' },
  ],
  program_manager: [
    { id: 'dashboard', name: 'DASHBOARD', icon: LayoutDashboard, href: '/pm' },
    { id: 'programs', name: 'PROGRAMS', icon: Briefcase, href: '/pm/programs' },
    { id: 'communication', name: 'COMMUNICATION', icon: MessageSquare, href: '/pm/communications/contacts' },
    { id: 'progress_hub', name: 'PROGRESS', icon: Activity, href: '/pm/progress' },
    { id: 'knowledge', name: 'KNOWLEDGE', icon: Library, href: '#' },
    { id: 'reports', name: 'REPORTS', icon: BarChart3, subItems: [
        { id: 'legacy_reports', name: 'PROGRAM REPORTS', href: '/admin/reports' },
        { id: 'enhanced_reports', name: 'ENHANCED (WIP)', href: '/v2/teacher/reports-v2' },
    ]},
  ],
  staff: [
    { id: 'dashboard', name: 'DASHBOARD', icon: LayoutDashboard, href: '/staff' },
    { id: 'reports', name: 'REPORTS', icon: BarChart3, subItems: [
        { id: 'legacy_reports', name: 'PROGRAM REPORTS', href: '/admin/reports' },
        { id: 'enhanced_reports', name: 'ENHANCED (WIP)', href: '/v2/teacher/reports-v2' },
    ]},
  ],
  teacher: [
    { id: 'dashboard', name: 'DASHBOARD', icon: LayoutDashboard, href: '/teacher' },
    { id: 'programs', name: 'PROGRAMS', icon: Briefcase, href: '/pm/programs' },
    { id: 'sessions', name: 'SESSIONS', icon: Calendar, href: '/teacher/sessions' },
    { id: 'reviews', name: 'SUBMISSIONS', icon: FileText, href: '/teacher/reviews' },
    { id: 'reports', name: 'REPORTS', icon: BarChart3, subItems: [
        { id: 'legacy_reports', name: 'PROGRAM REPORTS', href: '/admin/reports' },
        { id: 'enhanced_reports', name: 'ENHANCED (WIP)', href: '/v2/teacher/reports-v2' },
    ]},
  ],
  participant: [
    { id: 'dashboard', name: 'DASHBOARD', icon: Briefcase, href: '/participant' },
    { id: 'tasks', name: 'TASKS', icon: FileText, href: '#' },
    { id: 'feedback', name: 'FEEDBACK', icon: MessageSquare, href: '#' },
    { id: 'reports', name: 'REPORTS', icon: BarChart3, href: '/admin/reports' },
  ],
};

export default function DashboardLayout({ children, role = 'admin', modals }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openMenus, setOpenMenus] = useState({});
  const { lang, t, switchLang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const fetchNotifications = useCallback(async () => {
    try {
      const savedUser = localStorage.getItem('user');
      if (!savedUser) return;
      const parsedUser = JSON.parse(savedUser);
      const recipientId = parsedUser.role === 'super_admin' ? 'sa' : (parsedUser.cid || parsedUser.id);
      const res = await fetch(`/api/notifications?recipient_id=${recipientId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount((data.notifications || []).filter(n => !n.read).length);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('impactos_theme', next);
  };

  const [user, setUser] = useState({});
  const [pmPrograms, setPmPrograms] = useState([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (parsedUser.role === 'program_manager' || parsedUser.role === 'super_admin') {
         const url = parsedUser.role === 'super_admin' ? '/api/pm/programs' : '/api/pm/programs?assigned_pm_id=' + (parsedUser.cid || parsedUser.id);
         fetch(url)
           .then(res => res.json())
           .then(data => {
              if (data.success) setPmPrograms(data.programs || []);
           })
           .catch(e => console.error(e));
      }
    }
  }, [role]);

  const toggleMenu = useCallback((id) => {
    if (!id) return;
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const navItems = useMemo(() => {
    // Priority: user.role (from session) > role (from prop) > fallback 'admin'
    const activeRole = user.role || role || 'admin';
    const items = [...(NAVIGATION_MATRIX[activeRole] || NAVIGATION_MATRIX.admin)];
    
    if ((activeRole === 'program_manager' || activeRole === 'super_admin') && pmPrograms.length > 0) {
      const progIndex = items.findIndex(i => i.id === 'programs');
      if (progIndex !== -1) {
        const baseSubItems = activeRole === 'super_admin' ? [
          { id: 'all_programs', name: 'ALL PROGRAMS', href: '/admin/programs' },
          { id: 'create_program', name: 'CREATE PROGRAM', href: '/admin/programs/new' }
        ] : [
          { id: 'all_programs', name: 'OVERVIEW', href: '/pm/programs' }
        ];

        items[progIndex] = {
          ...items[progIndex],
          subItems: [
            ...baseSubItems,
            ...(activeRole === 'super_admin' ? [] : (Array.isArray(pmPrograms) ? pmPrograms : []).map(p => ({ 
              id: `prog_${p.id}`, 
              name: p.name, 
              href: `/pm/programs/${p.id}` 
            })))
          ]
        };
      }
    }
    return items;
  }, [user.role, role, pmPrograms]);

  const handleLogout = () => {
    localStorage.clear();
    router.replace('/login');
  };

  const activeRole = user.role || role || 'admin';
  const commonProps = { collapsed, role: activeRole, user, navItems, openMenus, toggleMenu, pathname, setMobileMenuOpen, handleLogout, t };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <aside
        style={{ width: collapsed ? 64 : 260 }}
        className="hidden md:flex flex-col h-screen sticky top-0 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] p-4 overflow-hidden z-[100] transition-[width] duration-150"
      >
        <SidebarContent {...commonProps} />
      </aside>

      {/* MOBILE TRIGGER */}
      <div className="md:hidden fixed top-3 left-3 z-[200]">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-[var(--brand-orange)] rounded-md">
          <Menu className="w-5 h-5 text-white" />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[150]">
          <div onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-[var(--bg-secondary)] p-6 border-r border-[var(--border-primary)]">
            <SidebarContent {...commonProps} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 flex items-center px-6 border-b border-[var(--border-primary)] relative overflow-hidden group bg-[var(--bg-secondary)]/80 backdrop-blur-xl sticky top-0 z-[100]">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--brand-orange)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] uppercase relative z-10">
            <span>ImpactOS</span>
            <ChevronRight className="w-3 h-3 opacity-30" />
            <span className="text-[var(--text-primary)]">
              {pathname ? pathname.split('/').pop().replace(/-/g, ' ') : 'Dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-4 ml-auto relative z-10">
            <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]">
              <Sun className="w-4 h-4 dark:hidden" />
              <Moon className="w-4 h-4 hidden dark:block" />
            </button>
            <button onClick={() => switchLang(lang === 'en' ? 'fr' : 'en')} className="px-2 py-1 text-[10px] font-bold border border-[var(--border-primary)] rounded uppercase">
              {lang}
            </button>
            
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--brand-orange)] rounded-full" />}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-10 w-72 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 z-[200]">
                  <h4 className="text-[10px] font-bold uppercase mb-3 text-[var(--text-secondary)]">{t('intel_feed')}</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {notifications.length > 0 ? notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                          if (n.type === 'verification' || n.title.includes('ACCESS')) {
                            router.push('/admin/communications/contacts');
                            setShowNotifications(false);
                          }
                        }}
                        className={`p-3 rounded-xl hover:bg-[var(--bg-primary)] transition-all cursor-pointer border border-transparent hover:border-[var(--border-primary)] group ${!n.read ? 'bg-[var(--brand-orange)]/5' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-black text-[10px] uppercase tracking-tight text-[var(--text-primary)]">{n.title}</p>
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />}
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed group-hover:text-[var(--text-primary)] transition-colors">{n.message}</p>
                      </div>
                    )) : <p className="text-[10px] opacity-40 italic py-4 text-center">{t('no_new_intel')}</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-[var(--border-primary)]">
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-bold leading-none">{user?.name || 'User'}</p>
                <p className="text-[9px] text-[var(--brand-blue)] uppercase font-bold mt-1">
                  {(user.role || role || 'admin').replace(/_/g, ' ').replace(/\bteacher\b/gi, 'Staff')}
                </p>
              </div>
              <div className="w-8 h-8 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center font-bold text-xs">
                {String(user?.name || 'U').charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-[var(--bg-primary)]">
          <div className="max-w-[1400px] mx-auto animate-in">
            {children}
          </div>
        </main>
        {modals}
        <GlobalToast />
      </div>
    </div>
  );
}
