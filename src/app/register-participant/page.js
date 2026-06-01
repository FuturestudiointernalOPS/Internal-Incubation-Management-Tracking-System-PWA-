"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Mail,
  Phone,
  Rocket,
  Briefcase,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  UploadCloud,
  LinkIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BG = "var(--bg-primary)";
const CARD = "var(--surface-1)";
const BORDER = "var(--border-primary)";
const ACCENT = "#818cf8";

export default function PublicParticipantRegistration() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    projectIdea: "",
    programId: "",
    group_id: "", // Unique Registration ID from URL
    cvFile: "",
  });

  const [targetedGroup, setTargetedGroup] = useState(null);

  const [programs, setPrograms] = useState([]);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  useEffect(() => {
    // Extract program/group from URL
    const searchParams = new URLSearchParams(window.location.search);
    const targetGroupId =
      searchParams.get("group_id") ||
      searchParams.get("rid") ||
      searchParams.get("group");

    const fetchAssets = async () => {
      try {
        const [progRes, famRes] = await Promise.all([
          fetch("/api/programs"),
          fetch("/api/families"),
        ]);

        const progData = await progRes.json();
        const active = (progData.programs || []).filter(
          (x) => x.status === "Active",
        );
        setPrograms(active);

        const famData = await famRes.json();
        const allGroups = famData.families || [];

        if (targetGroupId) {
          // 1. Try matching by registration_id (UUID)
          let group = allGroups.find(
            (g) => g.registration_id === targetGroupId,
          );

          // 2. Fallback to name match (legacy)
          if (!group) group = allGroups.find((g) => g.name === targetGroupId);

          if (group) {
            setTargetedGroup(group);
            setFormData((prev) => ({
              ...prev,
              group_id: group.registration_id,
              programId: group.program_id || prev.programId,
            }));
          }
        }
      } catch (e) {
        console.error("Registry Sync Failure:", e);
      }
    };

    fetchAssets();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, cvFile: reader.result }); // Base64 for local dev mock
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.programId) {
      setStatus({
        state: "error",
        message: "You must select a target program.",
      });
      return;
    }

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: "pending",
          role: "participant",
          group_name:
            targetedGroup?.name ||
            programs.find((p) => p.id === formData.programId)?.name ||
            null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus({
          state: "success",
          message:
            "Your application has been submitted for review! Once approved, your login credentials will be activated. You will receive your email and password from the Program Manager.",
        });
      } else {
        setStatus({
          state: "error",
          message: data.error || "Failed to submit application.",
        });
      }
    } catch (err) {
      setStatus({
        state: "error",
        message:
          "An issue occurred saving your application. Please check your network or CV size.",
      });
    }
  };

  if (status.state === "success") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: "2rem",
            padding: "3rem",
            textAlign: "center",
            maxWidth: "500px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(16,185,129,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}
          >
            <CheckCircle
              style={{ color: "#34d399", width: "40px", height: "40px" }}
            />
          </div>
          <h1
            style={{
              color: "var(--text-primary)",
              fontSize: "1.75rem",
              fontWeight: 900,
              marginBottom: "1rem",
            }}
          >
            Application Submitted!
          </h1>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {status.message}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "var(--text-primary)",
        fontFamily: "'Inter', sans-serif",
        padding: "4rem 2rem",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            "radial-gradient(circle at 50% 10%, rgba(99,102,241,0.08) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}
      >
        <header style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              background: "rgba(99,102,241,0.1)",
              padding: "0.5rem 1.25rem",
              borderRadius: "999px",
              border: `1px solid ${BORDER}`,
              marginBottom: "1.5rem",
            }}
          >
            <Rocket style={{ color: ACCENT, width: "16px" }} />
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                color: ACCENT,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Program Intake
            </span>
          </div>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: 900,
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            Participant Application
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem" }}>
            {targetedGroup
              ? `Registering for ${targetedGroup.name.toUpperCase()}`
              : "Register for an upcoming Incubation Program."}
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: "2.5rem",
            padding: "3rem",
            backdropFilter: "blur(20px)",
          }}
        >
          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              marginBottom: "1.5rem",
              color: "var(--text-primary)",
              paddingBottom: "0.5rem",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            Your Details
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: "2rem",
            }}
          >
            <InputGroup
              label="Full Name"
              icon={Users}
              placeholder="e.g. Samuel Adebayo"
              value={formData.fullName}
              onChange={(v) => setFormData({ ...formData, fullName: v })}
              required
            />
            <InputGroup
              label="Email Address"
              icon={Mail}
              placeholder="name@email.com"
              type="email"
              value={formData.email}
              onChange={(v) => setFormData({ ...formData, email: v })}
              required
            />
            <InputGroup
              label="Phone Number"
              icon={Phone}
              placeholder="080XXXXXXXX"
              value={formData.phone}
              onChange={(v) => setFormData({ ...formData, phone: v })}
              required
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <label
                style={{ fontSize: "0.875rem", fontWeight: 700, color: ACCENT }}
              >
                Target Program
              </label>
              <div style={{ position: "relative" }}>
                <Briefcase
                  style={{
                    position: "absolute",
                    left: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "18px",
                    color: "var(--text-secondary)",
                  }}
                />
                <select
                  required
                  disabled={!!targetedGroup?.program_id}
                  value={formData.programId}
                  onChange={(e) =>
                    setFormData({ ...formData, programId: e.target.value })
                  }
                  style={{
                    width: "100%",
                    background: "var(--bg-primary)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "1rem",
                    padding: "1rem 1rem 1rem 2.75rem",
                    color: "var(--text-primary)",
                    outline: "none",
                    appearance: "none",
                    fontSize: "1rem",
                    cursor: targetedGroup?.program_id
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  <option value="" style={{ background: BG }}>
                    -- Select a Target Program --
                  </option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id} style={{ background: BG }}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <h3
            style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              margin: "3rem 0 1.5rem 0",
              color: "var(--text-primary)",
              paddingBottom: "0.5rem",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            Qualification Documents
          </h3>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <label
                style={{ fontSize: "0.875rem", fontWeight: 700, color: ACCENT }}
              >
                Upload your CV or Resume (PDF/Doc)
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  background: "var(--bg-primary)",
                  border: `2px dashed ${BORDER}`,
                  borderRadius: "1rem",
                  padding: "2rem",
                  textAlign: "center",
                  transition: "border 0.2s",
                  cursor: "pointer",
                }}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  required
                  onChange={handleFileUpload}
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: 0,
                    width: "100%",
                    cursor: "pointer",
                  }}
                />
                <UploadCloud
                  style={{
                    margin: "0 auto 1rem",
                    width: "40px",
                    height: "40px",
                    color: ACCENT,
                  }}
                />
                <p style={{ fontWeight: 800, marginBottom: "0.5rem" }}>
                  {formData.cvFile
                    ? "Document Selected"
                    : "Click to Upload Document"}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Max Size: 2MB
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <label
                style={{ fontSize: "0.875rem", fontWeight: 700, color: ACCENT }}
              >
                Your Startup / Idea Description
              </label>
              <div style={{ position: "relative" }}>
                <FileText
                  style={{
                    position: "absolute",
                    left: "1rem",
                    top: "1rem",
                    width: "18px",
                    color: "var(--text-secondary)",
                  }}
                />
                <textarea
                  placeholder="Describe your project, team, and current stage..."
                  required
                  value={formData.projectIdea}
                  onChange={(e) =>
                    setFormData({ ...formData, projectIdea: e.target.value })
                  }
                  style={{
                    width: "100%",
                    background: "var(--bg-primary)",
                    border: `1px solid ${BORDER}`,
                    borderRadius: "1rem",
                    padding: "1rem 1rem 1rem 2.75rem",
                    color: "var(--text-primary)",
                    outline: "none",
                    fontSize: "1rem",
                    minHeight: "100px",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {status.state === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: "2rem",
                  padding: "1.25rem",
                  borderRadius: "1rem",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid #f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                }}
              >
                <AlertCircle style={{ color: "#f87171", flexShrink: 0 }} />
                <p
                  style={{
                    color: "#f87171",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  {status.message}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={status.state === "loading"}
            style={{
              width: "100%",
              marginTop: "3rem",
              padding: "1.25rem",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "none",
              borderRadius: "1.25rem",
              color: "var(--text-primary)",
              fontWeight: 800,
              fontSize: "1.1rem",
              cursor: status.state === "loading" ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              boxShadow: "0 10px 30px rgba(99,102,241,0.3)",
              transition: "transform 0.2s",
            }}
          >
            {status.state === "loading" ? (
              "Encrypting Payload..."
            ) : (
              <>
                Submit Application to PM{" "}
                <ArrowRight style={{ width: "20px" }} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function InputGroup({
  label,
  placeholder,
  type = "text",
  icon: Icon,
  value,
  onChange,
  required,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label style={{ fontSize: "0.875rem", fontWeight: 700, color: ACCENT }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        {Icon && (
          <Icon
            style={{
              position: "absolute",
              left: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              color: "var(--text-secondary)",
            }}
          />
        )}
        <input
          type={type}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            background: "var(--bg-primary)",
            border: `1px solid ${BORDER}`,
            borderRadius: "1rem",
            padding: `1rem ${Icon ? "2.75rem" : "1rem"}`,
            color: "var(--text-primary)",
            outline: "none",
            fontSize: "1rem",
          }}
        />
      </div>
    </div>
  );
}
