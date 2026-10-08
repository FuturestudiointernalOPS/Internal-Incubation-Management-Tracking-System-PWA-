"use client";

import React, { useState } from 'react';
import { Plus, Send, Settings2, CheckCircle, Search, Rocket, X, Loader2, Trash2, ArrowRight, ChevronRight, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks/useApi';
import { useI18n } from '@/lib/i18n';
import { formatLocaleDate } from '@/lib/constants';
import { useSafeBack } from '@/lib/useSafeBack';
import { useDialogs } from '@/components/ui/DialogProvider';
import CampaignsCreateModal from '@/components/admin/communications/campaigns/CampaignsCreateModal';
import CampaignsDetailsModal from '@/components/admin/communications/campaigns/CampaignsDetailsModal';
import CampaignsList from '@/components/admin/communications/campaigns/CampaignsList';

const GROUP_LABELS = { UNASSIGNED: 'crm.contacts.unassigned' };

const pickCampaigns = (payload) => (payload?.success ? payload.campaigns || [] : []);
const pickContacts = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickForms = (payload) => (payload?.success ? payload.forms || [] : []);
const pickFamilies = (payload) => (payload?.success ? payload.families || [] : []);

export default function CampaignsPage() {
  const { t, lang } = useI18n();
  const { prompt } = useDialogs();
  const goBack = useSafeBack('/admin/crm');

  const { data: campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useApi(
    '/api/campaigns',
    { defaultValue: [], transform: pickCampaigns },
  );
  const { data: contacts, loading: contactsLoading, refresh: refreshContacts } = useApi(
    '/api/contacts',
    { defaultValue: [], transform: pickContacts },
  );
  const { data: forms, loading: formsLoading, refresh: refreshForms } = useApi(
    '/api/forms',
    { defaultValue: [], transform: pickForms },
  );
  const { data: families, loading: familiesLoading, refresh: refreshFamilies } = useApi(
    '/api/families',
    { defaultValue: [], transform: pickFamilies },
  );
  const loading = campaignsLoading || contactsLoading || formsLoading || familiesLoading;
  const refreshAll = () => {
    refreshCampaigns();
    refreshContacts();
    refreshForms();
    refreshFamilies();
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [editingSteps, setEditingSteps] = useState([]);
  const [searchContacts, setSearchContacts] = useState('');

  const [form, setForm] = useState({
    name: '',
    form_id: '',
    cids: [],
    steps: [{
      subject: 'Action Required: {{campaign}}',
      body: 'Hello {{name}},\n\nPlease proceed to your portal to complete the required steps for {{campaign}}.\n\nLink: {{link}}',
      wait_type: 'instant',
      delay_days: 0,
      delay_minutes: 0,
      delay_hours: 0,
      specific_time: '',
      scheduled_date: ''
    }]
  });

  const tabLabels = {
    all: t('crm.campaigns.tabAll'),
    running: t('crm.campaigns.tabRunning'),
    upcoming: t('crm.campaigns.tabUpcoming'),
    completed: t('crm.campaigns.tabCompleted'),
  };
  const waitTypeLabels = {
    instant: t('crm.campaigns.instant'),
    date: t('crm.campaigns.date'),
    days: t('crm.campaigns.days'),
    hours: t('crm.campaigns.hours'),
    minutes: t('crm.campaigns.minutes'),
  };

  const openDetails = async (campaign) => {
    try {
      window.dispatchEvent(new CustomEvent('impactos:notify', {
         detail: { type: 'info', message: t('crm.campaigns.retrievingSetup', { name: campaign.name }), duration: 2000 }
      }));
      const response = await fetch(`/api/campaigns/${campaign.id}`);
      const payload = await response.json();
      if (payload.success) {
        setSelectedCampaign({
          ...payload.campaign,
          cids: (payload.campaign.contacts || []).map(contact => contact.cid)
        });
        setEditingSteps(payload.campaign.steps || []);
        setShowDetailsModal(true);
      }
    } catch (err) {
      console.error(err);
      window.dispatchEvent(new CustomEvent('impactos:notify', {
         detail: { type: 'error', message: t('crm.campaigns.initError') }
      }));
    }
  };

  const updateCampaign = async () => {
    if (!selectedCampaign) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedCampaign.name,
          form_id: selectedCampaign.form_id,
          status: selectedCampaign.status,
          steps: editingSteps,
          cids: selectedCampaign.cids
        })
      });
      const payload = await response.json();
      if (payload.success) {
        refreshAll();
        setShowDetailsModal(false);
        fetch('/api/send-pending').catch(() => {});
        window.dispatchEvent(new CustomEvent('impactos:notify', {
           detail: { type: 'success', message: t('crm.campaigns.savedLive') }
        }));
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const deleteCampaign = async (id) => {
    const password = await prompt({ message: t('crm.campaigns.deletePrompt'), inputType: "password", tone: "danger" });
    if (password !== '147369') {
      window.dispatchEvent(new CustomEvent('impactos:notify', {
         detail: { type: 'error', message: t('crm.campaigns.deleteAborted') }
      }));
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (payload.success) {
        setShowDetailsModal(false);
        refreshAll();
        window.dispatchEvent(new CustomEvent('impactos:notify', {
           detail: { type: 'success', message: t('crm.campaigns.deleted') }
        }));
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const submitCampaign = async (event) => {
    event.preventDefault();
    if (form.cids.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', {
         detail: { type: 'error', message: t('crm.campaigns.pickAtLeastOne') }
      }));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (payload.success) {
        setShowCreateModal(false);
        setForm({ name: '', form_id: '', cids: [], steps: form.steps });
        refreshAll();
        fetch('/api/send-pending').catch(() => {});
        window.dispatchEvent(new CustomEvent('impactos:notify', {
           detail: { type: 'success', message: t('crm.campaigns.launched') }
        }));
      }
    } catch {
        window.dispatchEvent(new CustomEvent('impactos:notify', {
           detail: { type: 'error', message: t('crm.campaigns.launchFailed') }
        }));
    } finally { setIsSubmitting(false); }
  };

  const addStep = (isEditing = false) => {
    const newStep = {
      subject: 'Follow-up: {{campaign}}',
      body: 'Hello {{name}},\n\nJust a reminder to check your portal.\n\nLink: {{link}}',
      wait_type: 'days', delay_days: 3, delay_minutes: 0, delay_hours: 0, specific_time: '', scheduled_date: ''
    };
    if (isEditing) setEditingSteps([...editingSteps, newStep]);
    else setForm(previous => ({ ...previous, steps: [...previous.steps, newStep] }));
  };

  const updateStep = (stepIndex, key, value, isEditing = false) => {
    if (isEditing) setEditingSteps(editingSteps.map((step, index) => index === stepIndex ? { ...step, [key]: value } : step));
    else setForm(previous => ({ ...previous, steps: previous.steps.map((step, index) => index === stepIndex ? { ...step, [key]: value } : step) }));
  };

  const removeStep = (stepIndex, isEditing = false) => {
    if (isEditing) setEditingSteps(editingSteps.filter((_, index) => index !== stepIndex));
    else setForm(previous => ({ ...previous, steps: previous.steps.filter((_, index) => index !== stepIndex) }));
  };

  const toggleContact = (cid) => {
    setForm(prev => ({
      ...prev,
      cids: prev.cids.includes(cid) ? prev.cids.filter(contactId => contactId !== cid) : [...prev.cids, cid]
    }));
  };

  const selectFamily = (familyName, isEditing = false) => {
    const familyCids = contacts
      .filter(
        (contact) =>
          String(contact.group_name || "").trim().toUpperCase() ===
          String(familyName || "").trim().toUpperCase(),
      )
      .map((contact) => contact.cid);
    if (isEditing) {
       const nextCids = [...new Set([...selectedCampaign.cids, ...familyCids])];
       setSelectedCampaign({...selectedCampaign, cids: nextCids});
    } else {
       setForm(prev => ({ ...prev, cids: [...new Set([...prev.cids, ...familyCids])] }));
    }
  };

  const getFilteredCampaigns = () => {
    return campaigns.filter(campaign => {
      const isCompleted = campaign.sent_contacts >= campaign.total_contacts && campaign.total_contacts > 0;
      const isUpcoming = campaign.sent_contacts === 0 && campaign.total_contacts > 0;
      const isRunning = !isCompleted && !isUpcoming;

      if (activeTab === 'completed') return isCompleted;
      if (activeTab === 'upcoming') return isUpcoming;
      if (activeTab === 'running') return isRunning;
      return true;
    }).filter(campaign => {
      if (hideCompleted && campaign.sent_contacts >= campaign.total_contacts) return false;
      return true;
    });
  };

  const filteredCampsList = getFilteredCampaigns();

  return (
    <>
      <div className="space-y-8 min-h-[60vh]">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('crm.backToPrevious')}
          </button>
          <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('crm.backToCrm')}
          </Link>
        </nav>
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">{t('crm.campaigns.title')}</h2>
            <p className="text-slate-400 font-bold tracking-tight">{t('crm.campaigns.subtitle')}</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-prime !py-4 shadow-[#FF6600]/10">
            <Plus className="w-5 h-5 mr-2" /> {t('crm.campaigns.startCampaign')}
          </button>
        </header>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-4">
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {['all', 'running', 'upcoming', 'completed'].map(tab => (
               <button
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#FF6600]/80 text-white shadow-lg shadow-[#FF6600]/80/20' : 'text-slate-500 hover:text-white'}`}
               >
                 {tabLabels[tab]}
               </button>
            ))}
          </div>
          
          <div className="flex items-center gap-4">
             <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={hideCompleted} onChange={event => setHideCompleted(event.target.checked)} className="hidden" />
                <div className={`w-10 h-5 rounded-full border border-white/10 transition-all p-1 flex ${hideCompleted ? 'bg-[#FF6600]/80 justify-end' : 'bg-white/5 justify-start'}`}>
                   <div className="w-3 h-3 bg-white rounded-full shadow-sm shadow-black/20" />
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-400 uppercase tracking-widest transition-colors">{t('crm.campaigns.hideFinished')}</span>
             </label>
             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.itemsCount', { count: filteredCampsList.length })}</p>
          </div>
        </div>

        <CampaignsList
          filteredCampsList={filteredCampsList}
          loading={loading}
          campaigns={campaigns}
          families={families}
          contacts={contacts}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hideCompleted={hideCompleted}
          setHideCompleted={setHideCompleted}
          searchContacts={searchContacts}
          setSearchContacts={setSearchContacts}
          openDetails={openDetails}
          t={t}
          lang={lang}
          formatLocaleDate={formatLocaleDate}
        />

        <CampaignsCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={submitCampaign}
          isSubmitting={isSubmitting}
          form={form}
          setForm={setForm}
          forms={forms}
          families={families}
          contacts={contacts}
          searchContacts={searchContacts}
          setSearchContacts={setSearchContacts}
          addStep={addStep}
          updateStep={updateStep}
          removeStep={removeStep}
          toggleContact={toggleContact}
          selectFamily={selectFamily}
          t={t}
        />

        <CampaignsDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          onSave={updateCampaign}
          onDelete={deleteCampaign}
          isSubmitting={isSubmitting}
          selectedCampaign={selectedCampaign}
          setSelectedCampaign={setSelectedCampaign}
          families={families}
          contacts={contacts}
          forms={forms}
          searchContacts={searchContacts}
          setSearchContacts={setSearchContacts}
          editingSteps={editingSteps}
          setEditingSteps={setEditingSteps}
          updateStep={updateStep}
          removeStep={removeStep}
          selectFamily={selectFamily}
          openDetails={openDetails}
          deleteCampaign={deleteCampaign}
          updateCampaign={updateCampaign}
          t={t}
          lang={lang}
          formatLocaleDate={formatLocaleDate}
        />
      </div>
    </>
  );
}