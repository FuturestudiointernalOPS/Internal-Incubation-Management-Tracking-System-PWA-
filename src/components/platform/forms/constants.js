import {
  Type, AlignLeft, Hash, Mail, PhoneIcon, Calendar, Clock, List, Circle, CheckSquare,
  Grid3X3, Upload, Link, DollarSign, Star, PenTool, Eye,
} from "lucide-react";

export const FIELD_ICONS = {
  text: Type, textarea: AlignLeft, number: Hash, email: Mail, phone: PhoneIcon,
  date: Calendar, time: Clock, select: List, radio: Circle, checkbox: CheckSquare,
  multiselect: Grid3X3, file: Upload, url: Link, currency: DollarSign,
  rating: Star, richtext: PenTool, signature: PenTool, hidden: Eye,
};

export const FIELD_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Phone", icon: PhoneIcon },
  { value: "date", label: "Date", icon: Calendar },
  { value: "time", label: "Time", icon: Clock },
  { value: "select", label: "Dropdown", icon: List },
  { value: "radio", label: "Radio", icon: Circle },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "multiselect", label: "Multi-Select", icon: Grid3X3 },
  { value: "file", label: "File Upload", icon: Upload },
  { value: "url", label: "URL", icon: Link },
  { value: "currency", label: "Currency", icon: DollarSign },
  { value: "rating", label: "Rating", icon: Star },
  { value: "richtext", label: "Rich Text", icon: PenTool },
];

// i18n key suffixes for display-only labels — `value` attributes and stored values stay as-is
export const FIELD_TYPE_KEYS = {
  text: "fieldTypeShortText",
  textarea: "fieldTypeLongText",
  number: "fieldTypeNumber",
  email: "fieldTypeEmail",
  phone: "fieldTypePhone",
  date: "fieldTypeDate",
  time: "fieldTypeTime",
  select: "fieldTypeDropdown",
  radio: "fieldTypeRadio",
  checkbox: "fieldTypeCheckbox",
  multiselect: "fieldTypeMultiSelect",
  file: "fieldTypeFileUpload",
  url: "fieldTypeUrl",
  currency: "fieldTypeCurrency",
  rating: "fieldTypeRating",
  richtext: "fieldTypeRichText",
};

export const FORM_STATUS_KEYS = {
  published: "statusPublished",
  draft: "statusDraft",
  archived: "statusArchived",
};

export const DECISION_DEFAULT_KEYS = {
  approved: "decisionDefaultApprove",
  rejected: "decisionDefaultReject",
  revision_requested: "decisionDefaultRequestRevision",
};

export const WORKFLOW_STATUS_LABEL_KEYS = {
  submitted: "statusDefaultSubmitted",
  approved: "statusDefaultApproved",
  rejected: "statusDefaultRejected",
  revision_requested: "statusDefaultRevision",
  draft: "statusDefaultDraft",
};

export const DEFAULT_AUTOMATION = {
  on_submit: { send_acknowledgement: true },
  on_approve: { send_approval_email: true, create_platform_user: true, send_activation_email: true, enroll_in_program: true, assign_to_group: true },
  on_reject: { send_rejection_email: true },
  auto_approve: false,
  auto_approve_cutoff: 80,
  redirect_after_submit: "",
  success_message: "",
};

export function cn(...classes) { return classes.filter(Boolean).join(" "); }
