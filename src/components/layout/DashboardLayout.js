'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Users, LayoutDashboard, Briefcase, Calendar, User,
  MessageSquare, Settings, LogOut, Bell,
  Search, ChevronRight, ChevronDown, TrendingUp,
  FileText, ShieldCheck, Activity, Menu, X, Zap, Rocket, Trash2, Send, Library, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import GlobalToast from '@/components/ui/GlobalToast';
import { prefetchData } from '@/utils/prefetch';

/**
 * IMPACTOS MIDNIGHT EXECUTIVE — GLOBAL LAYOUT
 * Standardized navigation and workspace frame.
 */
const SidebarContent = ({ collapsed, role, user, navItems, openMenus, toggleMenu, pathname, activeTab, onTabChange, setMobileMenuOpen, handleLogout }) => {

  const handleHover = (item) => {
    if (item.href === '/v2/superadmin') prefetchData('/api/v2/superadmin/full-state', 'superadmin_dashboard');
    if (item.href === '/v2/participant') prefetchData(`/api/v2/participant/full-state?email=${user.email}&group_name=${user.group_name}`, 'participant_dashboard');
    if (item.href === '/v2/pm') prefetchData('/api/v2/programs', 'pm_programs_list');
    if (item.href === '/v2/superadmin/communications/contacts') prefetchData('/api/v2/contacts/full-state', 'contacts');
  };

  return (
    <>
      {/* BRAND LOGO */}
      <div className="flex items-center gap-4 px-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-[#FF6600] flex items-center justify-center shadow-lg shadow-[#FF6600]/20">
          <Activity className="text-black w-6 h-6" />
        </div>
        {!collapsed && (
          <div className="animation-reveal">
            <h1 className="text-lg font-black tracking-tighter text-white uppercase leading-none italic">ImpactOS</h1>
            <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest mt-1 opacity-80 italic">{role?.replace(/_/g, ' ')}</p>
          </div>
        )}
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          if (item.subItems) {
            const isChildActive = item.subItems.some(sub => 
              (onTabChange && activeTab === sub.id) || 
              (pathname?.startsWith(sub.href))
            );
            const isOpen = openMenus[item.id] || isChildActive;

            return (
              <div key={item.id} className="space-y-1 px-3">
                <button
                  onClick={() => toggleMenu(item.id)}
                  onMouseEnter={() => handleHover(item)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all font-bold text-sm select-none ${isChildActive ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  title={collapsed ? item.name : undefined}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isChildActive ? 'text-[#0066FF]' : 'text-slate-500'}`} />
                    {!collapsed && <span className="truncate text-left">{item.name}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-[#0066FF]' : 'text-slate-500'}`} />
                  )}
                </button>
                {isOpen && !collapsed && (
                  <div className="pl-7 space-y-1">
                    {item.subItems.map(subItem => {
                      const isSubActive = onTabChange ? (activeTab === subItem.id) : (pathname === subItem.href);
                      return (
                        <Link
                          key={subItem.id || subItem.href}
                          href={subItem.href === '#' && onTabChange ? '#' : subItem.href}
                          onMouseEnter={() => handleHover(subItem)}
                          onClick={(e) => { 
                            if (onTabChange && subItem.id && subItem.href === '#') {
                              e.preventDefault();
                              onTabChange(subItem.id);
                            }
                            setMobileMenuOpen(false); 
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-black text-[13px] text-left select-none uppercase tracking-tighter ${isSubActive ? 'bg-[#0066FF]/10 text-white border border-[#0066FF]/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                        >
                          <span className="truncate">{subItem.name}</span>
                          {isSubActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0066FF] shadow-[0_0_10px_rgba(0,102,255,0.5)]" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = onTabChange && item.id && item.href === '#' ? (activeTab === item.id) : (pathname === item.href);
          return (
            <Link 
                key={item.id || item.href}
                href={item.href}
                onMouseEnter={() => handleHover(item)}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-black text-[11px] uppercase tracking-[0.2em] select-none ${isActive ? 'bg-[#FF6600] text-black shadow-lg shadow-[#FF6600]/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`} />
                {!collapsed && <span className="truncate">{item.name}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#0066FF] shadow-[0_0_10px_rgba(0,102,255,1)]" />
                )}
                {item.glow && !isActive && !collapsed && (
                   <span className="ml-auto px-2 py-0.5 rounded-md bg-[#0066FF] text-[8px] font-black uppercase text-white shadow-[0_0_15px_rgba(0,102,255,0.5)] animate-pulse">New</span>
                )}
              </Link>
          );
        })}
      </nav>

      {/* BOTTOM ACTIONS */}
      <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
        
        {/* PROMINENT LOGOUT ACTION */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 group shadow-lg shadow-rose-500/5"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!collapsed && <span className="animation-reveal font-black uppercase tracking-widest text-[11px]">Logout</span>}
        </button>
      </div>
    </>
  );
};

/**
 * NAVIGATION SCHEMA (Static)
 */
const NAVIGATION_MATRIX = {
  super_admin: [
    { id: 'dashboard', name: 'Dashboard', icon: ShieldCheck, href: '/v2/superadmin' },
    { id: 'programs', name: 'Program Management', icon: Briefcase, subItems: [
        { id: 'list_programs', name: 'All Programs', href: '/v2/superadmin/programs' },
        { id: 'create_program', name: 'Create Program', href: '/v2/superadmin/programs/new' },
    ]},
    { id: 'progress_hub', name: 'Progress Hub', icon: Activity, href: '/v2/superadmin/progress' },
    { id: 'communication', name: 'Communication', icon: Send, subItems: [
        { id: 'campaigns', name: 'Emails & Campaigns', href: '/v2/superadmin/communications/campaigns' },
        { id: 'forms', name: 'Forms', href: '/v2/superadmin/communications/forms' },
        { id: 'all_contacts', name: 'All Contacts', href: '/v2/superadmin/communications/contacts' },
    ]},
    { id: 'knowledge', name: 'Knowledge Bank', icon: Library, href: '/v2/superadmin/knowledge' },
    { id: 'staff', name: 'Future Studio', icon: Users, href: '/v2/superadmin/communications/contacts?role=Future+Studio' },
    { id: 'profile', name: 'My Profile', icon: User, href: '/v2/superadmin/profile' },
  ],
  admin: [
    { id: 'dashboard', name: 'Dashboard', icon: ShieldCheck, href: '/v2/superadmin' },
    { id: 'personnel', name: 'Team Settings', icon: Users, href: '/admin/personnel' },
    { id: 'projects', name: 'Projects', icon: Briefcase, href: '/admin/projects' },
    { id: 'logs', name: 'Activity Logs', icon: FileText, href: '/admin/logs' },
  ],
  program_manager: [
    { id: 'dashboard', name: 'Operations HQ', icon: LayoutDashboard, href: '/v2/pm' },
    { id: 'programs', name: 'Assigned Programs', icon: Briefcase, href: '/v2/pm/programs' },
    { id: 'communication', name: 'Cohort Outreach', icon: MessageSquare, href: '/v2/pm/communications/contacts' },
    { id: 'profile', name: 'Settings', icon: Settings, href: '/v2/pm/profile' },
    { id: 'progress_hub', name: 'Progress Registry', icon: Activity, href: '/v2/pm/progress' },
  ],
  teacher: [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/v2/teacher' },
    { id: 'sessions', name: 'My Sessions', icon: Calendar, href: '/v2/teacher/sessions' },
    { id: 'reviews', name: 'Submissions', icon: FileText, href: '/v2/teacher/reviews' },
    { id: 'profile', name: 'My Profile', icon: User, href: '/v2/teacher/profile' },
  ],
  participant: [
    { id: 'dashboard', name: 'Dashboard', icon: Briefcase, href: '/v2/participant' },
    { id: 'tasks', name: 'Tasks', icon: FileText, href: '#' },
    { id: 'feedback', name: 'Feedback', icon: MessageSquare, href: '#' },
    { id: 'profile', name: 'My Profile', icon: User, href: '/v2/participant/profile' },
  ],
};


export default function DashboardLayout({ children, role = 'admin', activeTab, onTabChange, modals }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const [theme, setTheme] = useState('dark');
  const [lang, setLang] = useState('en');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem('impactos-theme') || 'dark';
    const savedLang = localStorage.getItem('impactos-lang') || 'en';
    setTheme(savedTheme);
    setLang(savedLang);
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('lang', savedLang);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('impactos-theme', newTheme);
  };

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'fr' : 'en';
    setLang(newLang);
    document.documentElement.setAttribute('lang', newLang);
    localStorage.setItem('impactos-lang', newLang);
    window.dispatchEvent(new Event('impactos:languageChange')); // Signal children
  };

  // Optimized State Hydration
  const [user, setUser] = React.useState({});
  const [pmPrograms, setPmPrograms] = React.useState([]);

  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      // If PM, fetch their specific programs to anchor in sidebar
      if (role === 'program_manager') {
         fetch('/api/v2/pm/programs?assigned_pm_id=' + (parsedUser.cid || parsedUser.id))
           .then(res => res.json())
           .then(data => {
              if (data.success) setPmPrograms(data.programs || []);
           })
           .catch(e => console.error(e));
      }
    }
  }, [role]);

  const toggleMenu = React.useCallback((id) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const navItems = React.useMemo(() => {
    const items = [...(NAVIGATION_MATRIX[role] || NAVIGATION_MATRIX.admin)];
    
    // Inject dynamic programs if PM
    if (role === 'program_manager' && pmPrograms.length > 0) {
       const progIndex = items.findIndex(i => i.id === 'programs');
       if (progIndex !== -1) {
          // Clone the item to avoid mutating the original matrix
          items[progIndex] = {
             ...items[progIndex],
             subItems: [
                { id: 'all_programs', name: 'Registry Overview', href: '/v2/pm/programs' },
                ...pmPrograms.map(p => ({
                   id: `prog_${p.id}`,
                   name: p.name,
                   href: `/v2/pm/programs/${p.id}`
                }))
             ]
          };
       }
    }
    
    return items;
  }, [role, pmPrograms]);

  const handleLogout = () => {
    localStorage.removeItem('sa_session');
    localStorage.removeItem('pm_session');
    localStorage.removeItem('part_session');
    localStorage.removeItem('user');
    router.replace('/terminal');
  };

  const commonProps = {
    collapsed, role, user, navItems, openMenus, toggleMenu, pathname, activeTab, onTabChange, setMobileMenuOpen, handleLogout
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080810] text-slate-200 selection:bg-[#0066FF]/30 font-sans">
      <aside
        style={{ width: collapsed ? 80 : 280 }}
        className="hidden md:flex flex-col h-screen sticky top-0 bg-[#0d0d18] border-r border-white/5 p-6 overflow-hidden z-[100] flex-shrink-0 transition-[width] duration-200"
      >
        <SidebarContent {...commonProps} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-[#0066FF] flex items-center justify-center border border-white/10 hover:scale-110 transition-transform shadow-xl shadow-blue-500/20"
        >
          <ChevronRight className={`w-3 h-3 text-white transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* MOBILE TRIGGER */}
      <div className="md:hidden fixed top-4 left-4 z-[200]">
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="p-3 bg-[#0066FF] rounded-xl shadow-lg shadow-blue-600/20"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/80 z-[150]"
          />
          <aside
            className="fixed inset-y-0 left-0 w-[280px] bg-[#0d0d18] border-r border-white/10 p-8 z-[160] overflow-hidden"
          >
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400"
            >
              <X className="w-6 h-6" />
            </button>
            <SidebarContent {...commonProps} />
          </aside>
        </>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* GLOBAL HEADER */}
        <header className="h-[72px] flex items-center justify-between px-8 bg-[#0d0d18]/30 backdrop-blur-xl border-b border-white/5 sticky top-0 z-[50]">
          <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest leading-none">
            <span className="opacity-40">ImpactOS</span>
            <ChevronRight className="w-3 h-3 opacity-20" />
            <span className="text-white animation-reveal lowercase">
              {activeTab || (pathname ? String(pathname).split('/').pop().replace(/-/g, ' ') : 'Dashboard')}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <button 
                 onClick={toggleTheme}
                 className="p-3 rounded-xl bg-white/5 text-slate-500 hover:text-[#FF6600] transition-all border border-transparent hover:border-[#FF6600]/20"
                 title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
               >
                 {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
               </button>
               
               <button 
                 onClick={toggleLang}
                 className="px-4 py-3 rounded-xl bg-white/5 text-slate-500 hover:text-[#0066FF] transition-all border border-transparent hover:border-[#0066FF]/20 font-black text-xs uppercase tracking-widest flex items-center gap-2"
                 title="Toggle Language"
               >
                 <Globe className="w-4 h-4" />
                 {lang}
               </button>
            </div>

            <div className="hidden lg:flex items-center relative group">
              <Search className="absolute left-4 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-white/5 border border-white/5 rounded-full py-2.5 pl-11 pr-6 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all w-[300px]"
              />
              <span className="absolute right-4 px-1.5 py-0.5 rounded border border-white/10 text-[10px] font-bold text-slate-500">⌘K</span>
            </div>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors group"
              >
                <Bell className="w-5 h-5 group-hover:animate-bounce" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]" />
              </button>

              {/* NOTIFICATION BOX DROPDOWN */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-12 w-80 bg-[#0d0d18] border border-white/10 shadow-2xl shadow-black rounded-2xl overflow-hidden z-[200]"
                  >
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest">Notifications</h4>
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded cursor-pointer hover:bg-indigo-500/20">Mark All Read</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
                      <div className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10">
                        <p className="text-[11px] font-bold text-white mb-1"><span className="text-indigo-400">System</span>: Database Engine Sync Complete</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Just now</p>
                      </div>
                      <div className="p-3 rounded-xl bg-transparent hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10">
                        <p className="text-[11px] font-bold text-slate-300 mb-1"><span className="text-slate-400">Security</span>: New login detected from HQ.</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">2 hours ago</p>
                      </div>
                      <div className="p-3 rounded-xl bg-transparent border border-dashed border-white/5 text-center my-2">
                        <p className="text-[10px] font-bold text-slate-500">No further alerts.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-4 pl-6 border-l border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-white leading-none mb-1 uppercase tracking-tight italic">Active Session</p>
                <p className="text-[10px] font-bold text-[#0066FF] uppercase tracking-tighter opacity-80 italic">{role}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#FF6B00] flex items-center justify-center font-black text-xs shadow-lg shadow-orange-500/5">
                {String(role).charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT */}
        <main className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar">
          <div className="max-w-[1600px] mx-auto animation-reveal">
            {children}
          </div>
        </main>
        
        {modals && (
          <>
            {modals}
          </>
        )}
        <GlobalToast />
      </div>
    </div>
  );
}

