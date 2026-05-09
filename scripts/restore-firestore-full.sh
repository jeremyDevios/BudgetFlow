#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RESTORE_ENV="${RESTORE_ENV:-prod}"
FIREBASE_RESTORE_PROJECT_ID="${FIREBASE_RESTORE_PROJECT_ID:-}"
INPUT_FILE=""
RESTORE_MODE="overwrite"
CONFIRM_FLAG=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/restore-firestore-full.sh --input /path/backup.json [--env prod|dev] [--confirm] [--overwrite|--merge] [--project firebase-project-id]

Description:
  Wrapper de restauration complète de Firestore. Par défaut, il reste en dry-run
  tant que --confirm n'est pas fourni.

Options:
  --input FILE            Fichier backup JSON à restaurer (obligatoire)
  --env prod|dev          Environnement Firebase (défaut: prod)
  --confirm               Active l'écriture réelle
  --overwrite             Remplace complètement les documents existants (défaut)
  --merge                 Fusionne avec les documents existants
  --project PROJECT_ID    Override explicite du projet Firebase
  --help                  Affiche cette aide

Variables d'environnement:
  RESTORE_ENV
  FIREBASE_RESTORE_PROJECT_ID
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      INPUT_FILE="$2"
      shift 2
      ;;
    --env)
      RESTORE_ENV="$2"
      shift 2
      ;;
    --confirm)
      CONFIRM_FLAG="--confirm"
      shift
      ;;
    --overwrite)
      RESTORE_MODE="overwrite"
      shift
      ;;
    --merge)
      RESTORE_MODE="merge"
      shift
      ;;
    --project)
      FIREBASE_RESTORE_PROJECT_ID="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "❌ Argument inconnu : $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${INPUT_FILE}" ]]; then
  echo "❌ --input <fichier.json> est obligatoire." >&2
  usage >&2
  exit 1
fi

COMMAND=(/usr/bin/env node "${SCRIPT_DIR}/restore-firestore.js" --env "${RESTORE_ENV}" --input "${INPUT_FILE}")

if [[ -n "${FIREBASE_RESTORE_PROJECT_ID}" ]]; then
  COMMAND+=(--project "${FIREBASE_RESTORE_PROJECT_ID}")
fi

if [[ -n "${CONFIRM_FLAG}" ]]; then
  COMMAND+=("${CONFIRM_FLAG}" "--${RESTORE_MODE}")
fi

exec "${COMMAND[@]}"
