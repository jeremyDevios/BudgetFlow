#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_ENV="${BACKUP_ENV:-prod}"
BACKUP_OUTPUT_DIR="${BACKUP_OUTPUT_DIR:-}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-15}"
BACKUP_WARN_SIZE_MB="${BACKUP_WARN_SIZE_MB:-512}"
BACKUP_MIN_FREE_SPACE_MB="${BACKUP_MIN_FREE_SPACE_MB:-2048}"
FIREBASE_BACKUP_PROJECT_ID="${FIREBASE_BACKUP_PROJECT_ID:-}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/backup-firestore-daily.sh [--env prod|dev] [--output-dir /path] [--retention-days 30] [--project firebase-project-id]

Description:
  Lance un backup Firestore complet, écrit un fichier horodaté dans backups/daily/<env>/,
  journalise l'exécution et purge les anciens backups selon la rétention configurée.

Options:
  --env prod|dev          Environnement Firebase (défaut: prod)
  --output-dir PATH       Dossier de destination des backups JSON
  --retention-days N      Nombre de jours de rétention (défaut: 15)
  --project PROJECT_ID    Override explicite du projet Firebase
  --help                  Affiche cette aide

Variables d'environnement:
  BACKUP_ENV
  BACKUP_OUTPUT_DIR
  BACKUP_RETENTION_DAYS
  BACKUP_WARN_SIZE_MB        Seuil d'avertissement sur la taille du dossier de
                             backups (défaut: 512 Mo)
  BACKUP_MIN_FREE_SPACE_MB   Seuil d'avertissement sur l'espace disque libre
                             (défaut: 2048 Mo)
  FIREBASE_BACKUP_PROJECT_ID
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      BACKUP_ENV="$2"
      shift 2
      ;;
    --output-dir)
      BACKUP_OUTPUT_DIR="$2"
      shift 2
      ;;
    --retention-days)
      BACKUP_RETENTION_DAYS="$2"
      shift 2
      ;;
    --project)
      FIREBASE_BACKUP_PROJECT_ID="$2"
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

if [[ -z "${BACKUP_OUTPUT_DIR}" ]]; then
  # SEC-25 : les backups contiennent toutes les données utilisateur en clair —
  # sortie par défaut dans le répertoire externe des secrets, hors de l'arbre
  # du projet (surchargeable avec --output-dir ou BACKUP_OUTPUT_DIR).
  BACKUP_OUTPUT_DIR="${BUDGETFLOW_SECRETS_DIR:-$HOME/.config/budgetflow}/backups/daily/${BACKUP_ENV}"
fi

TIMESTAMP="$(date '+%Y-%m-%dT%H-%M-%S')"
BACKUP_FILE="${BACKUP_OUTPUT_DIR}/backup-${TIMESTAMP}_full.json"
LOG_DIR="${BACKUP_OUTPUT_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup-${TIMESTAMP}.log"

mkdir -p "${BACKUP_OUTPUT_DIR}" "${LOG_DIR}"

# ─── Surveillance de l'espace disque ─────────────────────────────────────────
# Prévenir la saturation : vérifie la taille du dossier de backups et l'espace
# libre sur la partition qui l'héberge, et logge un avertissement si un seuil
# est dépassé.
check_disk_space() {
  local backup_size_kb free_kb

  backup_size_kb="$(du -sk "${BACKUP_OUTPUT_DIR}" 2>/dev/null | awk '{print $1}' || true)"
  backup_size_kb="${backup_size_kb:-0}"

  free_kb="$(df -k "${BACKUP_OUTPUT_DIR}" 2>/dev/null | awk 'NR==2 {print $4}' || true)"
  free_kb="${free_kb:-0}"

  if [ "$backup_size_kb" -gt $((BACKUP_WARN_SIZE_MB * 1024)) ]; then
    echo "⚠️  [espace disque] Le dossier de backups occupe $((backup_size_kb / 1024)) Mo (seuil: ${BACKUP_WARN_SIZE_MB} Mo) — purger les anciens backups." | tee -a "${LOG_FILE}"
  fi

  if [ "$free_kb" -lt $((BACKUP_MIN_FREE_SPACE_MB * 1024)) ]; then
    echo "🚨 [espace disque] Seulement $((free_kb / 1024)) Mo libres (seuil: ${BACKUP_MIN_FREE_SPACE_MB} Mo) — risque de saturation du disque." | tee -a "${LOG_FILE}"
  fi
}

COMMAND=(/usr/bin/env node "${SCRIPT_DIR}/backup-firestore.js" --env "${BACKUP_ENV}" --output "${BACKUP_FILE}")

if [[ -n "${FIREBASE_BACKUP_PROJECT_ID}" ]]; then
  COMMAND+=(--project "${FIREBASE_BACKUP_PROJECT_ID}")
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔄 Début backup quotidien Firestore (${BACKUP_ENV})" | tee -a "${LOG_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 Sortie : ${BACKUP_FILE}" | tee -a "${LOG_FILE}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧾 Commande : ${COMMAND[*]}" | tee -a "${LOG_FILE}"

check_disk_space

"${COMMAND[@]}" 2>&1 | tee -a "${LOG_FILE}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🧹 Purge des backups de plus de ${BACKUP_RETENTION_DAYS} jour(s)" | tee -a "${LOG_FILE}"
find "${BACKUP_OUTPUT_DIR}" -maxdepth 1 -type f -name 'backup-*_full.json' -mtime +"${BACKUP_RETENTION_DAYS}" -print -delete | tee -a "${LOG_FILE}" || true

check_disk_space

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup quotidien terminé" | tee -a "${LOG_FILE}"
