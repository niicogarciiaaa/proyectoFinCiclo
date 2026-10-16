#!/usr/bin/env python3
"""
Conversor sencillo de Markdown a PDF para el registro de mejoras de AutoCareHub.

Uso:
    python3 md_to_pdf.py MEJORAS_AutoCareHub.md MEJORAS_AutoCareHub.pdf

Soporta: títulos (#, ##, ###), listas con viñetas, citas (>), tablas, reglas
horizontales (---), negrita (**...**) y `código` en línea. Pensado para
regenerar el PDF cada vez que se amplía el documento vivo.
"""
import sys
import re
import html

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, ListFlowable, ListItem
)

NARANJA = colors.HexColor("#E8722B")   # color de marca AutoCareHub
AZUL = colors.HexColor("#1976d2")
GRIS = colors.HexColor("#555555")


def fuente_casilla():
    """Registra una fuente con «☐» (casilla vacía) si el sistema la tiene."""
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import os
    for ruta in ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf"):
        if os.path.exists(ruta):
            try:
                pdfmetrics.registerFont(TTFont("Casilla", ruta))
                return '<font name="Casilla" color="#555555" size="12">\u2610</font>'
            except Exception:
                pass
    return '<font name="ZapfDingbats" color="#555555">q</font>'


CASILLA = None


def estilos():
    base = getSampleStyleSheet()
    s = {}
    s["h1"] = ParagraphStyle("h1", parent=base["Heading1"], fontSize=22,
                             textColor=NARANJA, spaceAfter=10, spaceBefore=6)
    s["h2"] = ParagraphStyle("h2", parent=base["Heading2"], fontSize=15,
                             textColor=AZUL, spaceAfter=6, spaceBefore=14)
    s["h3"] = ParagraphStyle("h3", parent=base["Heading3"], fontSize=12,
                             textColor=colors.HexColor("#333333"), spaceAfter=4, spaceBefore=8)
    s["body"] = ParagraphStyle("body", parent=base["BodyText"], fontSize=10,
                               leading=15, spaceAfter=6)
    s["quote"] = ParagraphStyle("quote", parent=s["body"], leftIndent=10,
                                textColor=GRIS, borderColor=NARANJA, borderWidth=0,
                                fontName="Helvetica-Oblique")
    s["bullet"] = ParagraphStyle("bullet", parent=s["body"], spaceAfter=2)
    s["cell"] = ParagraphStyle("cell", parent=s["body"], fontSize=9, leading=12, spaceAfter=0)
    s["cellh"] = ParagraphStyle("cellh", parent=s["cell"], textColor=colors.white,
                                fontName="Helvetica-Bold")
    return s


def inline(text):
    """Convierte negrita, código y enlaces simples de Markdown a marcado de reportlab."""
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`(.+?)`", r'<font face="Courier" color="#b5179e">\1</font>', text)
    text = re.sub(r"(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", text)
    # [texto](url) -> texto (sin enlace activo, solo texto)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r"\1", text)
    # Caracteres que no tiene Helvetica: flecha (fuente Symbol) y marca «web»
    text = text.replace("→", '<font face="Symbol">\u2192</font>')
    text = text.replace("🌐", '<font color="#1d4ed8" size="8"><b>[WEB]</b></font>')
    return text


def parse(md_path, S):
    flow = []
    with open(md_path, encoding="utf-8") as f:
        lines = f.readlines()

    i = 0
    bullets = []

    def flush_bullets():
        nonlocal bullets
        if bullets:
            items = [ListItem(Paragraph(inline(b), S["bullet"]), leftIndent=12) for b in bullets]
            flow.append(ListFlowable(items, bulletType="bullet", start="•",
                                     bulletColor=NARANJA, leftIndent=14))
            flow.append(Spacer(1, 4))
            bullets = []

    while i < len(lines):
        raw = lines[i].rstrip("\n")
        line = raw.strip()

        # Tabla (bloque de líneas que empiezan por |)
        if line.startswith("|"):
            flush_bullets()
            tbl = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not re.match(r"^[-:\s|]+$", lines[i].strip().strip("|")):  # saltar separador ---
                    tbl.append(row)
                i += 1
            if tbl:
                data = []
                for r_idx, row in enumerate(tbl):
                    style = S["cellh"] if r_idx == 0 else S["cell"]
                    data.append([Paragraph(inline(c), style) for c in row])
                t = Table(data, repeatRows=1, hAlign="LEFT")
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), AZUL),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f6fb")]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]))
                flow.append(t)
                flow.append(Spacer(1, 8))
            continue

        if not line:
            flush_bullets()
            i += 1
            continue

        # Casilla de comprobación «- [ ] texto» (con sangría para subniveles)
        casilla = re.match(r"^(\s*)- \[ \] (.*)$", raw)
        if casilla:
            flush_bullets()
            nivel = len(casilla.group(1).replace("\t", "  ")) // 2
            estilo = ParagraphStyle("check", parent=S["bullet"], leftIndent=14 + nivel * 16,
                                    firstLineIndent=-14, spaceAfter=3)
            global CASILLA
            if CASILLA is None:
                CASILLA = fuente_casilla()
            caja = CASILLA + "&nbsp;&nbsp;"
            flow.append(Paragraph(caja + inline(casilla.group(2)), estilo))
            i += 1
            continue

        if line.startswith("### "):
            flush_bullets(); flow.append(Paragraph(inline(line[4:]), S["h3"]))
        elif line.startswith("## "):
            flush_bullets(); flow.append(Paragraph(inline(line[3:]), S["h2"]))
        elif line.startswith("# "):
            flush_bullets(); flow.append(Paragraph(inline(line[2:]), S["h1"]))
        elif line.startswith("---"):
            flush_bullets()
            flow.append(Spacer(1, 4))
            flow.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#dddddd")))
            flow.append(Spacer(1, 4))
        elif line.startswith(">"):
            flush_bullets(); flow.append(Paragraph(inline(line[1:].strip()), S["quote"]))
        elif line.startswith("- ") or line.startswith("* "):
            bullets.append(line[2:])
        else:
            flush_bullets(); flow.append(Paragraph(inline(line), S["body"]))
        i += 1

    flush_bullets()
    return flow


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "MEJORAS_AutoCareHub.md"
    out = sys.argv[2] if len(sys.argv) > 2 else "MEJORAS_AutoCareHub.pdf"
    S = estilos()
    doc = SimpleDocTemplate(out, pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title="AutoCareHub — Registro de Mejoras")
    doc.build(parse(src, S))
    print(f"PDF generado: {out}")


if __name__ == "__main__":
    main()
