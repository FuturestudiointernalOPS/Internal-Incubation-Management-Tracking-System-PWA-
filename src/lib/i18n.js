'use client';

import { useState, createContext, useContext, useEffect } from 'react';

const translations = {
  en: {
    dashboard: "Dashboard",
    programs: "Programs",
    teams: "Teams",
    participants: "Participants",
    settings: "Settings",
    profile: "Profile",
    logout: "Logout",
    search: "Search",
    loading: "Loading Systems...",
    error: "System Error",
    save: "Save Changes",
    cancel: "Cancel",
    delete: "Delete",
    active: "Active",
    pending: "Pending",
    completed: "Completed",
    mission_control: "Mission Control",
    program_registry: "Program Registry",
    team_deployment: "Team Deployment",
    intel_feed: "Intelligence Feed",
    operational_status: "Operational Status",
    language: "Language",
    theme: "Theme",
    instructor: "Instructor"
  },
  fr: {
    dashboard: "Tableau de Bord",
    programs: "Programmes",
    teams: "Équipes",
    participants: "Participants",
    settings: "Paramètres",
    profile: "Profil",
    logout: "Déconnexion",
    search: "Rechercher",
    loading: "Chargement des Systèmes...",
    error: "Erreur Système",
    save: "Enregistrer les Modifications",
    cancel: "Annuler",
    delete: "Supprimer",
    active: "Actif",
    pending: "En attente",
    completed: "Terminé",
    mission_control: "Contrôle de Mission",
    program_registry: "Registre des Programmes",
    team_deployment: "Déploiement d'Équipe",
    intel_feed: "Flux d'Intelligence",
    operational_status: "Statut Opérationnel",
    language: "Langue",
    theme: "Thème",
    instructor: "Instructeur"
  }
};

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('impactos_lang');
    if (saved) setLang(saved);
  }, []);

  const t = (key) => {
    return translations[lang][key] || key;
  };

  const switchLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('impactos_lang', newLang);
  };

  return (
    <I18nContext.Provider value={{ lang, t, switchLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
