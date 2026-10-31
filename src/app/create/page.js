"use client";

import { Briefcase, Rocket, Sparkles, UserPlus } from "lucide-react";
import PageHero from "@/components/ui/PageHero";
import SectionHead from "@/components/ui/SectionHead";
import LinkCard from "@/components/ui/LinkCard";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/PermissionProvider";
import { CREATION_ACTIONS } from "@/lib/creationActions";

// Icon names from the shared catalogue resolved to components here, where the
// screen can import lucide without making the pure catalogue depend on React.
const ACTION_ICONS = {
  briefcase: Briefcase,
  rocket: Rocket,
  userPlus: UserPlus,
};

/**
 * CREATE — the hub listing every record this person may create.
 *
 * The list is derived from the capability matrix, so it answers the same
 * question the server answers: a door appears only when its capability is
 * held. Nothing here decides access.
 */
export default function CreateHubPage() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const available = CREATION_ACTIONS.filter((action) =>
    can(action.module, action.capability),
  );

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <PageHero
        kicker={t("creation.kicker")}
        title={t("creation.title")}
        subtitle={t("creation.subtitle")}
      />

      <section className="stf-sec" style={{ borderTop: 0, paddingTop: 0, marginTop: 24 }}>
        <SectionHead
          letter="A"
          icon={Sparkles}
          title={t("creation.section.title")}
          subtitle={t("creation.section.subtitle")}
        />
        <div className="stf-grid">
          {available.map((action) => (
            <LinkCard
              key={action.id}
              icon={ACTION_ICONS[action.icon] || Sparkles}
              href={action.href}
              title={t(action.titleKey)}
              text={t(action.descriptionKey)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
