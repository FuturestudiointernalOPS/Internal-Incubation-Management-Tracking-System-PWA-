"""Generate the non-technical management PDF (--lang fr/en); no application execution."""
from pathlib import Path
import argparse
import cairo

parser = argparse.ArgumentParser()
parser.add_argument("--lang", choices=["fr", "en"], default="fr")
LANG = parser.parse_args().lang
EN = {
    "White Label OS — Séparation des données": "White Label OS — Data Separation",
    "Christelle FAGBEHOURO · Note de présentation": "Christelle FAGBEHOURO · Management brief",
    "Comprendre le principe": "Understanding the principle",
    "Séparer les données,": "Separate data,",
    "partager les fonctionnalités": "shared features",
    "Chaque organisation dispose de son propre espace. Elle utilise les outils proposés par ImpactOS, tout en conservant ses informations à part de celles de Future Studio et des autres clients.": "Each organisation has its own workspace. It uses the tools provided by ImpactOS while keeping its information separate from Future Studio and other clients.",
    "Le principe à retenir": "The guiding principle",
    "Partager les outils ne signifie pas partager les données.": "Sharing tools does not mean sharing data.",
    "Exemple : Future Studio et Epitech": "Example: Future Studio and Epitech",
    "Ses activités internes": "Its internal operations",
    "Epitech (démo)": "Epitech (demo)",
    "Son espace client": "Its client workspace",
    "Ses programmes, ses formations et ses ventures restent rattachés à son espace.": "Its programmes, courses and ventures remain within its own workspace.",
    "Ses programmes, ses cohortes et ses inscriptions restent rattachés à Epitech.": "Its programmes, cohorts and enrollments remain associated with Epitech.",
    "Offre de démonstration : Programmes uniquement.": "Demo offer: Programmes only.",
    "Ce que cela doit permettre": "What this should enable",
    "Créer ou modifier un programme Epitech sans modifier ceux de Future Studio.": "Create or edit an Epitech programme without changing Future Studio programmes.",
    "Consulter uniquement les informations correspondant à son organisation et à ses droits.": "View only the information permitted by the person's organisation and access rights.",
    "Conserver les cohortes des années précédentes sans les remplacer par les nouvelles.": "Keep previous years' cohorts without replacing them when new cohorts are created.",
    "Accès, partage et état d’avancement": "Access, sharing and current progress",
    "Qui peut voir quoi ?": "Who can see what?",
    "Équipe du client": "Client team",
    "Les informations de son organisation, selon les responsabilités attribuées à chaque personne.": "Their organisation's information, according to the responsibilities assigned to each person.",
    "Autres clients": "Other clients",
    "Aucun accès aux données d’Epitech, et réciproquement.": "No access to Epitech data, and vice versa.",
    "Ses propres activités. L’accompagnement d’un client passe par une autorisation explicite, limitée et enregistrée.": "Its own operations. Access to support a client requires explicit, limited authorisation, with access recorded.",
    "Une offre adaptée à chaque client": "An offer tailored to each client",
    "Un client qui choisit Programmes voit uniquement Programmes. Un client qui choisit Venture voit uniquement Venture. Plusieurs modules peuvent être réunis dans une même offre. Chaque utilisateur garde des droits adaptés à son rôle.": "A client choosing Programmes sees only Programmes. A client choosing Venture sees only Venture. Several modules can be combined in one offer. Each user retains access rights suited to their role.",
    "Un partage reste possible s’il est prévu": "Sharing is possible when explicitly authorised",
    "Par exemple, Future Studio peut autoriser un client à utiliser une formation précise. Ce partage explicite ne donne pas accès aux autres formations ni aux informations des autres clients.": "For example, Future Studio may authorise a client to use a specific course. This explicit sharing does not provide access to other courses or other clients' information.",
    "Où en sommes-nous ?": "Where are we now?",
    "Les espaces clients et leurs droits sont en place dans l’environnement de préparation. Epitech est configuré pour Programmes uniquement.": "Client workspaces and access rights are in place in the preparation environment. Epitech is configured for Programmes only.",
    "La vérification complète de la séparation reste à terminer avant une ouverture à de vrais clients. Ce document présente le fonctionnement prévu ; il ne certifie pas encore une isolation totale.": "A full review of data separation must still be completed before opening access to real clients. This document describes the intended approach; it does not yet certify complete isolation.",
}

def translate(value):
    return EN.get(value, value) if LANG == "en" else value

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs/white-label-phase0" / ("White_Label_Data_Separation_EN.pdf" if LANG == "en" else "Separation_des_donnees_White_Label_FR.pdf")
W, H = 595.28, 841.89
NAVY, ORANGE, INK, MUTED = "000060", "FF6600", "16163E", "5A5A9C"
LIGHT, BORDER, WHITE = "F4F5FC", "D6D8F0", "FFFFFF"
surface = cairo.PDFSurface(str(OUTPUT), W, H)
surface.set_metadata(cairo.PDF_METADATA_TITLE, translate("White Label OS — Séparation des données"))
surface.set_metadata(cairo.PDF_METADATA_AUTHOR, "Christelle FAGBEHOURO")
ctx = cairo.Context(surface)


def color(value):
    ctx.set_source_rgb(*(int(value[i:i+2], 16) / 255 for i in (0, 2, 4)))


def box(x, y, w, h, fill, border=None):
    ctx.rectangle(x, y, w, h)
    color(fill)
    ctx.fill_preserve()
    if border:
        color(border)
        ctx.set_line_width(0.7)
        ctx.stroke()
    else:
        ctx.new_path()


def text(value, x, y, size=11, tone=INK, bold=False):
    value = translate(value)
    ctx.select_font_face("DejaVu Sans", cairo.FONT_SLANT_NORMAL,
                         cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)
    color(tone)
    ctx.move_to(x, y)
    ctx.show_text(value)


def paragraph(value, x, y, width=499, size=10.5, tone=INK, bold=False, leading=None):
    value = translate(value)
    leading = leading or size * 1.55
    line = ""
    for word in value.split():
        candidate = f"{line} {word}".strip()
        ctx.select_font_face("DejaVu Sans", cairo.FONT_SLANT_NORMAL,
                             cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(size)
        if line and ctx.text_extents(candidate).x_advance > width:
            text(line, x, y, size, tone, bold)
            y += leading
            line = word
        else:
            line = candidate
    if line:
        text(line, x, y, size, tone, bold)
    return y + leading


def bullet(value, y, width=477):
    box(50, y-5, 4, 4, ORANGE)
    return paragraph(value, 64, y, width) + 6


def page(number, subtitle):
    box(0, 0, W, H, WHITE)
    box(0, 0, W, 8, ORANGE)
    text("IMPACTOS", 48, 42, 12, NAVY, True)
    text("WHITE LABEL OS", 399, 42, 10, MUTED, True)
    text(subtitle, 48, 69, 9, MUTED)
    box(48, 785, 499, 0.8, BORDER)
    text("Christelle FAGBEHOURO · Note de présentation", 48, 806, 8, MUTED)
    date = "20 November 2026" if LANG == "en" else "20 novembre 2026"
    text(f"{date}  |  {number} / 2", 406, 806, 8, MUTED)


page(1, "Comprendre le principe")
text("Séparer les données,", 48, 119, 26, NAVY, True)
text("partager les fonctionnalités", 48, 153, 26, NAVY, True)
paragraph("Chaque organisation dispose de son propre espace. Elle utilise les outils proposés par ImpactOS, tout en conservant ses informations à part de celles de Future Studio et des autres clients.", 48, 190)

box(48, 265, 499, 65, NAVY)
text("Le principe à retenir", 65, 289, 11, WHITE, True)
paragraph("Partager les outils ne signifie pas partager les données.", 65, 312, 465, 11, WHITE)

text("Exemple : Future Studio et Epitech", 48, 371, 16, NAVY, True)
for x, name, caption in [(48, "Future Studio", "Ses activités internes"),
                         (308, "Epitech (démo)", "Son espace client")]:
    box(x, 390, 239, 184, LIGHT, BORDER)
    box(x, 390, 239, 4, ORANGE if x == 308 else NAVY)
    text(name, x+16, 422, 14, NAVY, True)
    text(caption, x+16, 444, 10, MUTED)
paragraph("Ses programmes, ses formations et ses ventures restent rattachés à son espace.", 64, 475, 205, 10.5)
paragraph("Ses programmes, ses cohortes et ses inscriptions restent rattachés à Epitech.", 324, 475, 205, 10.5)
paragraph("Offre de démonstration : Programmes uniquement.", 324, 540, 205, 9, MUTED, True)

text("Ce que cela doit permettre", 48, 614, 16, NAVY, True)
y = bullet("Créer ou modifier un programme Epitech sans modifier ceux de Future Studio.", 646)
y = bullet("Consulter uniquement les informations correspondant à son organisation et à ses droits.", y)
bullet("Conserver les cohortes des années précédentes sans les remplacer par les nouvelles.", y)
surface.show_page()

page(2, "Accès, partage et état d’avancement")
text("Qui peut voir quoi ?", 48, 119, 25, NAVY, True)
rows = [
    ("Équipe du client", "Les informations de son organisation, selon les responsabilités attribuées à chaque personne."),
    ("Autres clients", "Aucun accès aux données d’Epitech, et réciproquement."),
    ("Future Studio", "Ses propres activités. L’accompagnement d’un client passe par une autorisation explicite, limitée et enregistrée."),
]
y = 148
for title, body in rows:
    box(48, y, 499, 74, LIGHT, BORDER)
    text(title, 62, y+25, 11, NAVY, True)
    paragraph(body, 200, y+24, 330, 10)
    y += 82

text("Une offre adaptée à chaque client", 48, 430, 16, NAVY, True)
paragraph("Un client qui choisit Programmes voit uniquement Programmes. Un client qui choisit Venture voit uniquement Venture. Plusieurs modules peuvent être réunis dans une même offre. Chaque utilisateur garde des droits adaptés à son rôle.", 48, 455)

text("Un partage reste possible s’il est prévu", 48, 544, 14, NAVY, True)
paragraph("Par exemple, Future Studio peut autoriser un client à utiliser une formation précise. Ce partage explicite ne donne pas accès aux autres formations ni aux informations des autres clients.", 48, 568)

box(48, 632, 499, 128, LIGHT, BORDER)
box(48, 632, 4, 128, ORANGE)
text("Où en sommes-nous ?", 64, 658, 13, NAVY, True)
paragraph("Les espaces clients et leurs droits sont en place dans l’environnement de préparation. Epitech est configuré pour Programmes uniquement.", 64, 683, 465, 10)
paragraph("La vérification complète de la séparation reste à terminer avant une ouverture à de vrais clients. Ce document présente le fonctionnement prévu ; il ne certifie pas encore une isolation totale.", 64, 723, 465, 9.5, MUTED)
surface.finish()
print(OUTPUT)
