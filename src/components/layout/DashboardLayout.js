'use client';

import React, { useState, useEffect } from 'react';
import { Users, LayoutDashboard, Briefcase, Calendar,
  MessageSquare, Settings, LogOut, Bell,
  Search, ChevronRight, ChevronDown, TrendingUp,
  FileText, ShieldCheck, Activity, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

/**
 * IMPACTOS MIDNIGHT EXECUTIVE — GLOBAL LAYOUT
 * Standardized navigation and workspace frame.
 */
export default function DashboardLayout({ children, role = 'admin', activeTab, onTabChange, modals }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({});
  const router = useRouter();
  const pathname = usePathname();

  const toggleMenu = (id) => {
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Navigation Schema
  const navigation = {
    super_admin: [
      { id: 'dashboard', name: 'Command HQ', icon: ShieldCheck, href: '/sa-hq-sp-2026-v1' },
      { id: 'staff', name: 'Staff & Personnel', icon: Users, href: '#' },
      { id: 'participants', name: 'Participants', icon: Users, href: '#' },
      { id: 'programs', name: 'Core Programs', icon: Briefcase, href: '#' },
      { id: 'projects', name: 'Projects', icon: Briefcase, href: '#' },
      { 
        id: 'communications', 
        name: 'Communications', 
        icon: MessageSquare, 
        subItems: [
          { id: 'contacts', name: 'Contacts', href: '/sa-hq-sp-2026-v1/communications/contacts' },
          { id: 'segments', name: 'Segments', href: '/sa-hq-sp-2026-v1/communications/segments' },
          { id: 'campaigns', name: 'Campaigns', href: '/sa-hq-sp-2026-v1/communications/campaigns' },
          { id: 'forms', name: 'Forms', href: '/sa-hq-sp-2026-v1/communications/forms' },
          { id: 'responses', name: 'Responses', href: '/sa-hq-sp-2026-v1/communications/responses' }
        ]
      },
      { id: 'activity', name: 'System Logs', icon: FileText, href: '#' },
      { id: 'recycleBin', name: 'Recycle Bin', icon: Activity, href: '#' },
    ],
    admin: [
      { name: 'Command HQ', icon: ShieldCheck, href: '/sa-hq-sp-2026-v1' },
      { name: 'Staff & Personnel', icon: Users, href: '/admin/personnel' },
      { name: 'Core Initiatives', icon: Briefcase, href: '/admin/projects' },
      { name: 'System Logs', icon: FileText, href: '/admin/logs' },
    ],
    program_manager: [
      { name: 'Work Summary', icon: LayoutDashboard, href: '/pm/dashboard' },
      { name: 'Core Programs', icon: Briefcase, href: '/pm/programs' },
      { name: 'Participants', icon: Users, href: '/pm/participants' },
      { name: 'Live Sessions', icon: Calendar, href: '/pm/sessions' },
      { name: 'Progress Tracking', icon: TrendingUp, href: '/pm/portfolio' },
    ],
    participant: [
      { name: 'My Startup', icon: Briefcase, href: '/startup/profile' },
      { name: 'Tasks & Milestones', icon: FileText, href: '/startup/tasks' },
      { name: 'Feedback Hub', icon: MessageSquare, href: '/startup/feedback' },
    ],
  };

  const navItems = navigation[role] || navigation.admin;

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('sa_session');
    router.push('/sa-hq-sp-2026-v1/login');
  };

  const SidebarContent = () => (
    <>
      {/* BRAND LOGO */}
      <div className="flex items-center gap-4 px-2 mb-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Activity className="text-white w-6 h-6" />
        </div>
        {!collapsed && (
          <div className="animation-reveal">
            <h1 className="text-lg font-black tracking-tighter text-white uppercase leading-none">ImpactOS</h1>
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1 opacity-80">{role.replace(/_/g, ' ')}</p>
          </div>
        )}
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          if (item.subItems) {
            const isChildActive = item.subItems.some(sub => 
              (onTabChange && activeTab === sub.id) || 
              (pathname.startsWith(sub.href))
            );
            const isOpen = openMenus[item.id] || isChildActive;

            return (
              <div key={item.id} className="space-y-1 px-3">
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all font-bold text-sm select-none ${isChildActive ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  title={collapsed ? item.name : undefined}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isChildActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    {!collapsed && <span className="animation-reveal truncate text-left">{item.name}</span>}
                  </div>
                  {!collapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-indigo-400' : 'text-slate-500'}`} />
                  )}
                </button>
                <AnimatePresence>
                  {isOpen && !collapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pl-7 space-y-1"
                    >
                      {item.subItems.map(subItem => {
                        const isSubActive = onTabChange ? (activeTab === subItem.id) : (pathname === subItem.href);
                        return (
                          <Link
                            key={subItem.id || subItem.href}
                            href={subItem.href === '#' && onTabChange ? '#' : subItem.href}
                            onClick={(e) => { 
                              if (onTabChange && subItem.id && subItem.href === '#') {
                                e.preventDefault();
                                onTabChange(subItem.id);
                              }
                              setMobileMenuOpen(false); 
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all font-bold text-[13px] text-left select-none ${isSubActive ? 'bg-indigo-500/10 text-white shadow-inner border border-indigo-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                          >
                            <span className="truncate">{subItem.name}</span>
                            {isSubActive && <motion.div layoutId="nav-glow-sub" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const isActive = onTabChange && item.id && item.href === '#' ? (activeTab === item.id) : (pathname === item.href);
          return (
            <Link
                key={item.id || item.href}
                href={item.href === '#' && onTabChange ? '#' : item.href}
                onClick={(e) => { 
                  if (onTabChange && item.id && item.href === '#') {
                    e.preventDefault();
                    onTabChange(item.id);
                  }
                  setMobileMenuOpen(false); 
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-bold text-sm text-left select-none ${isActive ? 'bg-indigo-500/10 text-white shadow-inner border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                {!collapsed && <span className="animation-reveal truncate">{item.name}</span>}
                {isActive && !collapsed && (
                  <motion.div layoutId="nav-glow" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,1)]" />
                )}
              </Link>
          );
        })}
      </nav>

      {/* BOTTOM ACTIONS */}
      <div className="mt-auto pt-6 border-t border-white/5 space-y-1">
        <button className="sidebar-link group">
          <Settings className="w-5 h-5 flex-shrink-0 group-hover:rotate-45 transition-transform" />
          {!collapsed && <span className="animation-reveal">System Config</span>}
        </button>
        <button 
          onClick={handleLogout}
          className="sidebar-link text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="animation-reveal font-bold">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080810] text-slate-200 selection:bg-indigo-500/30 font-sans bg-mesh">
      
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        style={{ width: collapsed ? 80 : 280 }}
        className="hidden md:flex flex-col h-screen sticky top-0 bg-[#0d0d18]/50 backdrop-blur-3xl border-r border-white/5 p-6 overflow-hidden z-[100] flex-shrink-0"
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center border border-white/10 hover:scale-110 transition-transform shadow-xl"
        >
          <ChevronRight className={`w-3 h-3 text-white transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </motion.aside>

      {/* MOBILE TRIGGER */}
      <div className="md:hidden fixed top-4 left-4 z-[200]">
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#0d0d18] border-r border-white/10 p-8 z-[160] overflow-hidden"
            >
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* GLOBAL HEADER */}
        <header className="h-[72px] flex items-center justify-between px-8 bg-[#0d0d18]/30 backdrop-blur-xl border-b border-white/5 sticky top-0 z-[50]">
          <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest leading-none">
            <span className="opacity-40">ImpactOS</span>
            <ChevronRight className="w-3 h-3 opacity-20" />
            <span className="text-white animation-reveal lowercase">
              {activeTab || String(pathname).split('/').pop().replace(/-/g, ' ')}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center relative group">
              <Search className="absolute left-4 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-white/5 border border-white/5 rounded-full py-2.5 pl-11 pr-6 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all w-[300px]"
              />
              <span className="absolute right-4 px-1.5 py-0.5 rounded border border-white/10 text-[10px] font-bold text-slate-500">⌘K</span>
            </div>

            <button className="relative p-2 text-slate-400 hover:text-white transition-colors group">
              <Bell className="w-5 h-5 group-hover:animate-bounce" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]" />
            </button>

            <div className="flex items-center gap-4 pl-6 border-l border-white/5">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-white leading-none mb-1 uppercase tracking-tight">Active Session</p>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter opacity-80">{role}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center font-black text-xs shadow-lg shadow-orange-500/10">
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
          <div className="absolute inset-0 z-[200] pointer-events-none flex">
            {modals}
          </div>
        )}
      </div>
    </div>
  );
}

