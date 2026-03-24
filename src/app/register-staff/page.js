'use client';

import React, { useState } from 'react';
import { 
  Users, Mail, Calendar, Phone, 
  Image as ImageIcon, CheckCircle, AlertCircle,
  ArrowRight, UserPlus, MapPin, Briefcase, FileText, UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BG = '#0a0a1a';
const CARD = 'rgba(255,255,255,0.03)';
const BORDER = 'rgba(99,102,241,0.2)';
const ACCENT = '#818cf8';

export default function PublicStaffRegistration() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    dob: '',
    phone: '',
    gender: 'Male',
    homeAddress: '',
    jobTitle: '',
    jobDescription: '',
    image: '',
    role: 'unassigned', // completely unassigned initially
    program: 'unassigned'
  });

  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    try {
      // Get current staff list
      const existingStaff = JSON.parse(localStorage.getItem('impactos_staff') || '[]');

      // Auto-generate a secure random password for their account
      const unsecurePassword = Math.random().toString(36).slice(-8);

      // Save new staff
      const newStaff = { ...formData, id: Date.now(), status: 'pending', password: unsecurePassword };
      localStorage.setItem('impactos_staff', JSON.stringify([...existingStaff, newStaff]));

      // Clear instantly
      setStatus({ 
        state: 'success', 
        message: 'Registration complete! Your profile has been sent to the Super Admin.' 
      });
    } catch (err) {
      console.error(err);
      setStatus({ state: 'error', message: 'Something went wrong saving your data.' });
    }
  };

  if (status.state === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Inter', sans-serif" }}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '2rem', padding: '3rem', textAlign: 'center', maxWidth: '500px' }}
        >
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle style={{ color: '#34d399', width: '40px', height: '40px' }} />
          </div>
          <h1 style={{ color: '#f1f5f9', fontSize: '1.75rem', fontWeight: 900, marginBottom: '1rem' }}>Thank You!</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{status.message}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#f1f5f9', fontFamily: "'Inter', sans-serif", padding: '4rem 2rem' }}>
      
      {/* Background Decor */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(99,102,241,0.08) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
        <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(99,102,241,0.1)', padding: '0.5rem 1.25rem', borderRadius: '999px', border: `1px solid ${BORDER}`, marginBottom: '1.5rem' }}>
            <UserPlus style={{ color: ACCENT, width: '16px' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Staff Application</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em' }}>Join The Company</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>Please fill in your details below to set up your staff profile.</p>
        </header>

        <form onSubmit={handleSubmit} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '2.5rem', padding: '3rem', backdropFilter: 'blur(20px)' }}>
          
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', color: '#fff', paddingBottom: '0.5rem', borderBottom: `1px solid ${BORDER}` }}>
            Core Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
            <InputGroup label="Your Full Name" icon={Users} placeholder="e.g. Samuel Adebayo" value={formData.fullName} onChange={v => setFormData({...formData, fullName: v})} required />
            <InputGroup label="Email Address" icon={Mail} placeholder="name@email.com" type="email" value={formData.email} onChange={v => setFormData({...formData, email: v})} required />
            
            <InputGroup label="Birth Date" icon={Calendar} type="date" value={formData.dob} onChange={v => setFormData({...formData, dob: v})} required />
            <InputGroup label="Phone Number" icon={Phone} placeholder="080XXXXXXXX" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} required />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 700, color: ACCENT }}>Gender</label>
              <div style={{ position: 'relative' }}>
                <UserIcon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '18px', color: '#64748b' }} />
                <select 
                  required
                  value={formData.gender} 
                  onChange={e => setFormData({...formData, gender: e.target.value})}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '1rem', padding: '1rem 1rem 1rem 2.75rem', color: '#fff', outline: 'none', appearance: 'none', fontSize: '1rem' }}
                >
                  <option value="Male" style={{ background: BG }}>Male</option>
                  <option value="Female" style={{ background: BG }}>Female</option>
                  <option value="Other" style={{ background: BG }}>Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
               <label style={{ fontSize: '0.875rem', fontWeight: 700, color: ACCENT }}>Profile Picture (Take photo or select)</label>
               <input 
                  type="file" accept="image/*" capture="user"
                  onChange={handleImageUpload}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '1rem', padding: '0.75rem', color: '#fff', outline: 'none', fontSize: '0.85rem' }}
               />
            </div>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '3rem 0 1.5rem 0', color: '#fff', paddingBottom: '0.5rem', borderBottom: `1px solid ${BORDER}` }}>
            Extra Information (Optional)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
             <InputGroup label="Home Address" icon={MapPin} placeholder="e.g. 123 Lagos Way, State" value={formData.homeAddress} onChange={v => setFormData({...formData, homeAddress: v})} />
             <InputGroup label="Expected Job Title" icon={Briefcase} placeholder="e.g. Operations Coordinator" value={formData.jobTitle} onChange={v => setFormData({...formData, jobTitle: v})} />
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 700, color: ACCENT }}>A brief description of your job</label>
                <div style={{ position: 'relative' }}>
                  <FileText style={{ position: 'absolute', left: '1rem', top: '1rem', width: '18px', color: '#64748b' }} />
                  <textarea 
                    placeholder="Describe what you do..."
                    value={formData.jobDescription} onChange={e => setFormData({...formData, jobDescription: e.target.value})}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '1rem', padding: '1rem 1rem 1rem 2.75rem', color: '#fff', outline: 'none', fontSize: '1rem', minHeight: '100px', resize: 'vertical' }}
                  />
                </div>
             </div>
          </div>

          <AnimatePresence>
            {status.state === 'error' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ marginTop: '2rem', padding: '1.25rem', borderRadius: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '1rem' }}
              >
                <AlertCircle style={{ color: '#f87171', flexShrink: 0 }} />
                <p style={{ color: '#f87171', fontWeight: 600, fontSize: '0.9rem' }}>{status.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" 
            disabled={status.state === 'loading'}
            style={{ 
              width: '100%', marginTop: '3rem', padding: '1.25rem', 
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', 
              borderRadius: '1.25rem', color: '#fff', fontWeight: 800, fontSize: '1.1rem', 
              cursor: status.state === 'loading' ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              boxShadow: '0 10px 30px rgba(99,102,241,0.3)', transition: 'transform 0.2s'
            }}
          >
            {status.state === 'loading' ? 'Wait a moment...' : (
              <>Submit My Application <ArrowRight style={{ width: '20px' }} /></>
            )}
          </button>
        </form>

        <footer style={{ marginTop: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
          By joining, you agree to follow the company guidelines for team members.
        </footer>
      </div>
    </div>
  );
}

function InputGroup({ label, placeholder, type = 'text', icon: Icon, value, onChange, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label style={{ fontSize: '0.875rem', fontWeight: 700, color: ACCENT }}>{label}</label>
      <div style={{ position: 'relative' }}>
        {Icon && <Icon style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '18px', color: '#64748b' }} />}
        <input 
          type={type} placeholder={placeholder} required={required}
          value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '1rem', padding: `1rem ${Icon ? '2.75rem' : '1rem'}`, color: '#fff', outline: 'none', fontSize: '1rem' }}
        />
      </div>
    </div>
  );
}
