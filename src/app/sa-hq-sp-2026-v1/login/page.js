'use client';

import React, { useState } from 'react';
import { Shield, Lock, Command, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const [keyID, setKeyID] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSALogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (keyID === 'superadmin' && accessCode === '147369') {
      setSuccess(true);
      localStorage.setItem('sa_session', 'prime-2026-active');
      localStorage.setItem('user', JSON.stringify({
        id: 'sa-root-001',
        name: 'Super Admin',
        role: 'super_admin',
        roleLabel: 'Super Administrator'
      }));
      router.push('/sa-hq-sp-2026-v1');
    } else {
      setError('Wrong username or password. Please try again.');
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 50%, #0a0a1a 100%)' }}>
      
      {/* Animated Background Orbs */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      {/* Grid Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', pointerEvents: 'none'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(79,70,229,0.1))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 0 40px rgba(99,102,241,0.2)'
          }}>
            <Shield style={{ color: '#818cf8', width: '36px', height: '36px' }} />
          </div>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 900, color: '#f1f5f9',
            textTransform: 'uppercase', letterSpacing: '-0.03em',
            fontFamily: "'Poppins', sans-serif", marginBottom: '0.5rem'
          }}>
            Office Login
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
            <span style={{ height: '1px', width: '40px', background: 'rgba(99,102,241,0.4)' }} />
            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.25em' }}>
              ImpactOS · Staff Entrance
            </p>
            <span style={{ height: '1px', width: '40px', background: 'rgba(99,102,241,0.4)' }} />
          </div>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '2rem',
          padding: '2.5rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          <form onSubmit={handleSALogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Console Key Field */}
            <div>
              <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.625rem' }}>
                Your Username
              </label>
              <div style={{ position: 'relative' }}>
                <Command style={{ position: 'absolute', left: '1.125rem', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', width: '16px', height: '16px' }} />
                <input
                  type="text"
                  required
                  value={keyID}
                  onChange={(e) => setKeyID(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '0.875rem',
                    padding: '0.875rem 1rem 0.875rem 3rem',
                    fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0',
                    outline: 'none', fontFamily: "'Inter', monospace",
                    letterSpacing: '0.05em',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.2)'}
                />
              </div>
            </div>

            {/* Master Code Field */}
            <div>
              <label style={{ display: 'block', fontSize: '0.625rem', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '0.625rem' }}>
                Access Code
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '1.125rem', top: '50%', transform: 'translateY(-50%)', color: '#4b5563', width: '16px', height: '16px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '0.875rem',
                    padding: '0.875rem 3rem 0.875rem 3rem',
                    fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0',
                    outline: 'none', fontFamily: "'Inter', monospace",
                    letterSpacing: '0.1em',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.2)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '0.25rem' }}
                >
                  {showPassword
                    ? <EyeOff style={{ width: '16px', height: '16px' }} />
                    : <Eye style={{ width: '16px', height: '16px' }} />
                  }
                </button>
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '0.75rem', padding: '0.75rem 1rem'
                  }}
                >
                  <AlertCircle style={{ color: '#f87171', width: '14px', height: '14px', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {error}
                  </p>
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: '0.75rem', padding: '0.75rem 1rem'
                  }}
                >
                  <CheckCircle style={{ color: '#34d399', width: '14px', height: '14px', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Welcome! Sending you to the dashboard...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              style={{
                width: '100%',
                background: loading || success
                  ? 'rgba(99,102,241,0.5)'
                  : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                border: 'none', borderRadius: '0.875rem',
                padding: '1rem 1.5rem',
                color: '#ffffff', fontSize: '0.6875rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.2em',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
                fontFamily: "'Inter', sans-serif"
              }}
              onMouseEnter={e => { if (!loading && !success) e.target.style.boxShadow = '0 12px 32px rgba(99,102,241,0.45)'; }}
              onMouseLeave={e => { e.target.style.boxShadow = '0 8px 24px rgba(99,102,241,0.3)'; }}
            >
              {loading ? '⟳  Signing in...' : success ? '✓  Success!' : 'Log In Now →'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.5625rem', fontWeight: 700, color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
          High Security Clearance Required · FS-HQ-2026
        </p>
      </motion.div>
    </div>
  );
}
