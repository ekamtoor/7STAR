#!/bin/bash

set -e

# Define the source directory
SRC="packages/create-vite/template-react"

# Check if the source directory exists
if [ ! -d "$SRC" ]; then
  echo "Source directory '$SRC' does not exist. Make sure you run this script from your repo root."
  exit 1
fi

echo "Moving files from $SRC to repo root..."

# Move all files and folders (including hidden files, except . and ..) from the template to the root
shopt -s dotglob
mv "$SRC"/* . 2>/dev/null || true
mv "$SRC"/.[!.]* . 2>/dev/null || true
shopt -u dotglob

# Remove the now-empty directories
echo "Cleaning up empty directories..."
rm -rf packages

echo "Done! All files moved to the repo root, and old directories removed."
echo "Next steps:"
echo "1. Run: git status   # to see the changes"
echo "2. Run: git add ."
echo "3. Run: git commit -m 'Move Vite template files to repo root and clean up folders'"
echo "4. Run: git push"
