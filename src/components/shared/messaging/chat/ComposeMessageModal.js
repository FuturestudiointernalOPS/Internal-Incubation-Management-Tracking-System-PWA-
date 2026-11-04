"use client";

import { Send, Users, Briefcase, User, X, Paperclip, Loader2 } from "lucide-react";

export default function ComposeMessageModal({
  setShowCompose,
  t,
  sendModes,
  setSendMode,
  sendMode,
  selectedContact,
  setComposeRecipient,
  setContactSearch,
  contactSearch,
  setShowContactDropdown,
  showContactDropdown,
  filteredContacts,
  composeGroupId,
  setComposeGroupId,
  availableGroups,
  composeProgram,
  availablePrograms,
  setComposeProgram,
  setProgramSearch,
  programSearch,
  setShowProgramDropdown,
  showProgramDropdown,
  filteredPrograms,
  composeShowAttachment,
  setComposeShowAttachment,
  handleComposeFile,
  composeUploading,
  composeAttachmentUrl,
  setComposeAttachmentUrl,
  setComposeAttachmentName,
  composeAttachmentName,
  composeBody,
  setComposeBody,
  handleSendNew,
  sending,
  composeRecipient,
}) {
  return (
<div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCompose(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                {t("messaging.composeMessage")}
              </h2>
              <button onClick={() => setShowCompose(false)}>
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Mode selector */}
            {sendModes.length > 1 && (
              <div className="flex gap-2 p-1 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                {sendModes.map((mode) => {
                  const icons = {
                    individual: User,
                    group: Users,
                    program: Briefcase,
                    broadcast: Send,
                  };
                  const labels = {
                    individual: t("messaging.direct"),
                    group: t("messaging.group"),
                    program: t("messaging.program"),
                    broadcast: t("messaging.broadcast"),
                  };
                  const Icon = icons[mode];
                  return (
                    <button
                      key={mode}
                      onClick={() => setSendMode(mode)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                        sendMode === mode
                          ? "bg-[var(--brand-orange)] text-black"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {labels[mode] || mode}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Individual: person picker */}
            {sendMode === "individual" && (
              <div className="relative">
                {selectedContact ? (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {selectedContact.name}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {selectedContact.email}
                    </span>
                    <button
                      onClick={() => {
                        setComposeRecipient("");
                        setContactSearch("");
                      }}
                      className="text-[var(--text-secondary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder={t("messaging.searchPerson")}
                      value={contactSearch}
                      onChange={(event) => {
                        setContactSearch(event.target.value);
                        setShowContactDropdown(true);
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    {showContactDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredContacts.length === 0 ? (
                          <p className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">
                            {t("messaging.noContactsFound")}
                          </p>
                        ) : (
                          filteredContacts.map((contact) => (
                            <button
                              key={contact.cid || contact.id}
                              onClick={() => {
                                setComposeRecipient(contact.cid || contact.id);
                                setContactSearch("");
                                setShowContactDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors border-b border-divider/50 last:border-0"
                            >
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {contact.name}
                              </p>
                              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                                {contact.email}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Group: contact group selector */}
            {sendMode === "group" && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t("messaging.selectGroup")}
                </p>
                <select
                  value={composeGroupId}
                  onChange={(event) => setComposeGroupId(event.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="">
                    {t("messaging.selectGroupPlaceholder")}
                  </option>
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.type === "staff" ? t("messaging.staffGroup") : group.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("messaging.groupMessageInfo")}
                </p>
              </div>
            )}

            {/* Program: program picker */}
            {sendMode === "program" && (
              <div className="relative">
                {composeProgram ? (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {availablePrograms.find((program) => program.id === composeProgram)
                        ?.name || composeProgram}
                    </span>
                    <button
                      onClick={() => {
                        setComposeProgram("");
                        setProgramSearch("");
                      }}
                      className="text-[var(--text-secondary)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder={t("messaging.searchPrograms")}
                      value={programSearch}
                      onChange={(event) => {
                        setProgramSearch(event.target.value);
                        setShowProgramDropdown(true);
                      }}
                      onFocus={() => setShowProgramDropdown(true)}
                      className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    {showProgramDropdown && (
                      <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-xl">
                        {filteredPrograms.length === 0 ? (
                          <p className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">
                            {t("messaging.noProgramsFound")}
                          </p>
                        ) : (
                          filteredPrograms.map((program) => (
                            <button
                              key={program.id}
                              onClick={() => {
                                setComposeProgram(program.id);
                                setProgramSearch("");
                                setShowProgramDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-tertiary transition-colors"
                            >
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {program.name}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Broadcast info */}
            {sendMode === "broadcast" && (
              <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400">
                {t("messaging.broadcastWarning")}
              </div>
            )}

            {/* Attachment section */}
            <div className="space-y-2">
              {!composeShowAttachment && (
                <button
                  onClick={() => setComposeShowAttachment(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {t("messaging.attachFile")}
                </button>
              )}
              {composeShowAttachment && (
                <div className="space-y-2 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      onChange={handleComposeFile}
                      className="flex-1 text-[10px] text-[var(--text-tertiary)] file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[var(--bg-primary)] file:text-[10px] file:font-bold file:uppercase file:tracking-wider file:text-[var(--text-primary)] file:cursor-pointer"
                    />
                    {composeUploading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--brand-orange)] shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t("messaging.attachmentUrlPlaceholder")}
                      value={composeAttachmentUrl}
                      onChange={(event) => setComposeAttachmentUrl(event.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                    />
                    <button
                      onClick={() => {
                        setComposeShowAttachment(false);
                        setComposeAttachmentUrl("");
                        setComposeAttachmentName("");
                      }}
                      className="text-[var(--text-secondary)] hover:text-red-500"
                      title={t("messaging.removeAttachment")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={t("messaging.attachmentNamePlaceholder")}
                    value={composeAttachmentName}
                    onChange={(event) => setComposeAttachmentName(event.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--brand-orange)] transition-all"
                  />
                </div>
              )}
            </div>

            {/* Message body */}
            <textarea
              placeholder={
                sendMode === "individual"
                  ? t("messaging.typeYourMessage")
                  : t("messaging.messagePlaceholder")
              }
              value={composeBody}
              onChange={(event) => setComposeBody(event.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] resize-none"
            />

            <button
              onClick={handleSendNew}
              disabled={
                sending ||
                !composeBody.trim() ||
                (sendMode === "individual" && !composeRecipient) ||
                (sendMode === "group" && !composeGroupId) ||
                (sendMode === "program" && !composeProgram)
              }
              className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> {t("messaging.sendMessage")}
                </>
              )}
            </button>
          </div>
        </div>
  );
}
