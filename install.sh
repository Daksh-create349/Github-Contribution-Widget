#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# install.sh — GitHub Contribution Widget for Übersicht
# Downloads Übersicht (6 MB), installs the widget, opens it.
# ─────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   GitHub Contribution Widget — Installer     ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

WIDGET_DIR="$HOME/Library/Application Support/Übersicht/widgets"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIDGET_SRC="$SCRIPT_DIR/github-contribution.widget"

# ── 1. Install Übersicht if not present ─────────────────────────
if ! [ -d "/Applications/Übersicht.app" ]; then
  echo -e "${YELLOW}→  Downloading Übersicht (~6 MB)…${NC}"
  TMP=$(mktemp -d)
  curl -L "https://tracesof.net/uebersicht/releases/Uebersicht-1.6.82.app.zip" -o "$TMP/uebersicht.zip" --progress-bar
  unzip -q "$TMP/uebersicht.zip" -d /Applications/
  rm -rf "$TMP"
  echo -e "${GREEN}✓  Übersicht installed${NC}"
else
  echo -e "${GREEN}✓  Übersicht already installed${NC}"
fi

# ── 2. Create widget directory if needed ─────────────────────────
mkdir -p "$WIDGET_DIR"

# ── 3. Copy widget ────────────────────────────────────────────────
echo -e "${YELLOW}→  Installing GitHub widget…${NC}"
rm -rf "$WIDGET_DIR/github-contribution.widget"
cp -r "$WIDGET_SRC" "$WIDGET_DIR/"
echo -e "${GREEN}✓  Widget installed${NC}"

# ── 4. Open Übersicht ─────────────────────────────────────────────
echo -e "${YELLOW}→  Launching Übersicht…${NC}"
open "/Applications/Übersicht.app"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  Done! Your widget is now live on your desktop.        ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  To change username: open github-contribution.widget/     ║${NC}"
echo -e "${GREEN}║  index.jsx and edit the GITHUB_USERNAME variable.         ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  To move the widget: edit POSITION in index.jsx:          ║${NC}"
echo -e "${GREEN}║    "top-right" | "top-left" | "bottom-right" | "bottom-left"║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
