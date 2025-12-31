#!/bin/bash
# Installation script for Jello VSCode Extension

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Extension info
EXTENSION_NAME="jello-lang"
EXTENSION_VERSION="0.1.0"
EXTENSION_DIR="${EXTENSION_NAME}-${EXTENSION_VERSION}"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Jello VSCode Extension Installer     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Detect OS and editor
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
else
    echo -e "${RED}✗ Unsupported operating system: $OSTYPE${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Detected OS: ${BLUE}$OS${NC}"

# Detect editor (Cursor or VSCode)
CURSOR_EXT_DIR=""
VSCODE_EXT_DIR=""

if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CURSOR_EXT_DIR="$HOME/.cursor/extensions"
    VSCODE_EXT_DIR="$HOME/.vscode/extensions"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    CURSOR_EXT_DIR="$USERPROFILE/.cursor/extensions"
    VSCODE_EXT_DIR="$USERPROFILE/.vscode/extensions"
fi

# Check which editor(s) are installed
CURSOR_INSTALLED=false
VSCODE_INSTALLED=false

if [ -d "$CURSOR_EXT_DIR" ]; then
    CURSOR_INSTALLED=true
fi

if [ -d "$VSCODE_EXT_DIR" ]; then
    VSCODE_INSTALLED=true
fi

# Determine installation target
if [ "$CURSOR_INSTALLED" = true ] && [ "$VSCODE_INSTALLED" = true ]; then
    echo ""
    echo -e "${YELLOW}Both Cursor and VSCode detected.${NC}"
    echo -e "  1) Install to Cursor (~/.cursor/extensions)"
    echo -e "  2) Install to VSCode (~/.vscode/extensions)"
    echo -e "  3) Install to both"
    read -p "Choose option (1/2/3): " -n 1 -r
    echo
    case $REPLY in
        1) INSTALL_TO="cursor" ;;
        2) INSTALL_TO="vscode" ;;
        3) INSTALL_TO="both" ;;
        *) echo -e "${RED}✗ Invalid option${NC}"; exit 1 ;;
    esac
elif [ "$CURSOR_INSTALLED" = true ]; then
    INSTALL_TO="cursor"
    echo -e "${GREEN}✓${NC} Detected editor: ${BLUE}Cursor${NC}"
elif [ "$VSCODE_INSTALLED" = true ]; then
    INSTALL_TO="vscode"
    echo -e "${GREEN}✓${NC} Detected editor: ${BLUE}VSCode${NC}"
else
    echo -e "${RED}✗ Neither Cursor nor VSCode extensions directory found${NC}"
    echo -e "${YELLOW}Creating VSCode extensions directory...${NC}"
    mkdir -p "$VSCODE_EXT_DIR"
    INSTALL_TO="vscode"
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo -e "${GREEN}✓${NC} Extension source: ${BLUE}$SCRIPT_DIR${NC}"

# Function to install to a specific directory
install_to_dir() {
    local EXT_DIR=$1
    local EDITOR_NAME=$2
    local TARGET_DIR="$EXT_DIR/$EXTENSION_DIR"

    echo ""
    echo -e "${BLUE}→${NC} Installing to ${YELLOW}$EDITOR_NAME${NC}..."

    # Check if extension is already installed
    if [ -d "$TARGET_DIR" ]; then
        echo -e "${YELLOW}⚠${NC} Extension already installed at: $TARGET_DIR"
        read -p "Do you want to overwrite it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}✗ Installation to $EDITOR_NAME cancelled${NC}"
            return 1
        fi
        echo -e "${YELLOW}⚠${NC} Removing existing installation..."
        rm -rf "$TARGET_DIR"
    fi

    # Create target directory
    mkdir -p "$TARGET_DIR"

    # Copy files
    cp -r "$SCRIPT_DIR"/* "$TARGET_DIR/" 2>/dev/null || {
        echo -e "${RED}✗ Failed to copy extension files to $EDITOR_NAME${NC}"
        return 1
    }

    # Remove the install script from the installed extension
    rm -f "$TARGET_DIR/install.sh" 2>/dev/null || true

    echo -e "${GREEN}✓${NC} Extension files copied to $EDITOR_NAME"

    # Verify installation
    if [ -f "$TARGET_DIR/package.json" ]; then
        echo -e "${GREEN}✓${NC} Installation to $EDITOR_NAME verified"
        echo -e "${GREEN}✓${NC} Location: ${BLUE}$TARGET_DIR${NC}"
        return 0
    else
        echo -e "${RED}✗ Installation to $EDITOR_NAME verification failed${NC}"
        return 1
    fi
}

# Perform installation(s)
case $INSTALL_TO in
    cursor)
        install_to_dir "$CURSOR_EXT_DIR" "Cursor"
        INSTALLED_EDITORS="Cursor"
        ;;
    vscode)
        install_to_dir "$VSCODE_EXT_DIR" "VSCode"
        INSTALLED_EDITORS="VSCode"
        ;;
    both)
        install_to_dir "$CURSOR_EXT_DIR" "Cursor"
        install_to_dir "$VSCODE_EXT_DIR" "VSCode"
        INSTALLED_EDITORS="Cursor and VSCode"
        ;;
esac

# Success message
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Installation Successful! 🎉        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Installed to:${NC} ${BLUE}$INSTALLED_EDITORS${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. ${YELLOW}Reload your editor${NC}"
echo -e "     • Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Win/Linux)"
echo -e "     • Type 'Reload Window' and press Enter"
echo ""
echo -e "  2. ${YELLOW}Test the extension${NC}"
echo -e "     • Open any .jello file"
echo -e "     • Check that syntax highlighting works"
echo -e "     • Try typing 'fn' and pressing Tab for a snippet"
echo ""
echo -e "  3. ${YELLOW}Read the documentation${NC}"
echo -e "     • README_FIRST.md - Quick start guide"
echo -e "     • QUICK_REFERENCE.md - Language syntax"
echo -e "     • THEMES.md - Customize colors"
echo ""
echo -e "${BLUE}Happy coding with Jello! 🚀${NC}"
echo ""

