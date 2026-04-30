"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, Phone, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

export default function InvitePage({ params }) {
  // Using React.use to unwrap params in Next.js 15+
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  
  const router = useRouter();
  const [inviteData, setInviteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/v2/invites/${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Invalid invitation link.");
        } else {
          setInviteData(data.invite);
        }
      } catch (err) {
        setError("Failed to verify invitation. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/v2/invites/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
      } else {
        setSuccess(true);
        setTimeout(() => {
          const isStaff = inviteData?.group_name?.toUpperCase() === 'FUTURE STUDIO' || inviteData?.group_name?.toUpperCase() === 'STAFF';
          router.push(isStaff ? "/terminal" : "/login");
        }, 2000);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden text-slate-100 font-sans">
      {/* Dynamic Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-600/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <div className="bg-orange-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/20">
              <ShieldCheck className="text-orange-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Join the Platform</h1>
            <p className="text-slate-400 text-sm">
              {inviteData?.program_name ? (
                <>You have been invited to <strong className="text-white">{inviteData.program_name}</strong></>
              ) : (
                "Complete your profile to gain access"
              )}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-center text-green-400"
              >
                <p className="font-medium">Welcome aboard!</p>
                <p className="text-sm opacity-80 mt-1">Redirecting you to login...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!error && !success && inviteData && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number (Optional)"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="password"
                  name="password"
                  placeholder="Create a Password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full mt-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {formLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Join Workspace</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {!inviteData && !error && !loading && (
            <div className="text-center text-slate-500 mt-4">
              <p>Invalid link state. Please contact your admin.</p>
            </div>
          )}
        </div>
        
        <p className="text-center text-slate-500 text-xs mt-6">
          Powered by ImpactOS • Secure Authentication
        </p>
      </motion.div>
    </div>
  );
}
