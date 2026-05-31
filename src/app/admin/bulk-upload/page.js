"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Download,
  Users,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function BulkUploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (!selected.name.endsWith(".csv")) {
        setError("Only CSV files are accepted.");
        return;
      }
      setFile(selected);
      setError("");
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/bulk-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.results);
      } else {
        setError(data.error || "Upload failed.");
      }
    } catch (err) {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv =
      "name,email,group_name,role\nJohn Doe,john@example.com,UAT Students,participant\nJane Smith,jane@example.com,STAFF,staff";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
              Administration
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Bulk User Upload
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Upload a CSV file to create multiple user accounts at once. All
            users will be created in <strong>Pending</strong> status.
          </p>
        </div>

        {/* Template download */}
        <div className="card p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                CSV Template
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                Download the template to see the required columns.
              </p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="btn btn-primary text-[10px] px-4 py-2"
          >
            Download Template
          </button>
        </div>

        {/* Upload area */}
        <div className="card p-8">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-primary)] rounded-2xl p-12 text-center cursor-pointer hover:border-[var(--brand-orange)] transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="space-y-3">
                <FileText className="w-12 h-12 text-[var(--brand-orange)] mx-auto" />
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {file.name}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-[10px] text-rose-500 font-bold uppercase hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <UploadCloud className="w-12 h-12 text-[var(--text-secondary)] mx-auto" />
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Click to select CSV file
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  Columns: name, email, group_name (optional), role (optional)
                </p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                <p className="text-[11px] font-bold text-rose-500 uppercase">
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {file && !result && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn btn-primary w-full mt-6 py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading & Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  Upload & Import Users
                </>
              )}
            </button>
          )}

          {/* Results */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-4"
              >
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-500 uppercase">
                    Import Complete
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="card p-4 text-center border-l-4 border-emerald-500">
                    <p className="text-2xl font-black text-emerald-500">
                      {result.created}
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                      Created
                    </p>
                  </div>
                  <div className="card p-4 text-center border-l-4 border-blue-500">
                    <p className="text-2xl font-black text-blue-500">
                      {result.updated}
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                      Updated
                    </p>
                  </div>
                  <div className="card p-4 text-center border-l-4 border-amber-500">
                    <p className="text-2xl font-black text-amber-500">
                      {result.skipped}
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                      Skipped
                    </p>
                  </div>
                  <div className="card p-4 text-center border-l-4 border-rose-500">
                    <p className="text-2xl font-black text-rose-500">
                      {result.errors?.length || 0}
                    </p>
                    <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                      Errors
                    </p>
                  </div>
                </div>

                {result.errors?.length > 0 && (
                  <div className="card p-4">
                    <p className="text-[10px] font-bold text-rose-500 uppercase mb-2">
                      Row Errors
                    </p>
                    {result.errors.slice(0, 10).map((err, i) => (
                      <p
                        key={i}
                        className="text-[10px] text-[var(--text-secondary)] font-mono"
                      >
                        Row {err.row}: {err.error}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="btn w-full py-3 uppercase tracking-widest text-xs"
                >
                  Upload Another File
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info card */}
        <div className="card p-6 border-indigo-500/20">
          <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-3">
            What happens after upload?
          </h3>
          <ul className="space-y-2 text-[11px] text-[var(--text-secondary)]">
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">1.</span>
              All uploaded users are created with{" "}
              <strong className="text-[var(--text-primary)]">
                Pending
              </strong>{" "}
              status.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">2.</span>
              You can review and approve them from the{" "}
              <strong className="text-[var(--text-primary)]">
                Pending Users
              </strong>{" "}
              section.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">3.</span>
              On approval, each user receives a{" "}
              <strong className="text-[var(--text-primary)]">
                password setup email
              </strong>
              .
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">4.</span>
              Duplicate emails are{" "}
              <strong className="text-[var(--text-primary)]">
                updated
              </strong>{" "}
              (not duplicated).
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
