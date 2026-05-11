#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

NODE_BIN="${NODE_BIN:-}"
NVM_DIR="${NVM_DIR:-${HOME:-}/.nvm}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/trigger-notifications-cron.sh [--node /absolute/path/to/node]

Description:
  Wrapper cron-friendly pour déclencher scripts/trigger-notifications.js avec
  un PATH explicite, le bon répertoire de travail et un fallback NVM.

Options:
  --node PATH   Chemin absolu vers le binaire Node.js
  --help        Affiche cette aide

Variables d'environnement utiles:
  NODE_BIN
  NVM_DIR
  CRON_SECRET
  NOTIFICATION_TRIGGER_URL
  NOTIFICATION_TRIGGER_TIMEOUT_MS

Pré-requis:
  - l'application web doit être démarrée (par défaut sur http://127.0.0.1:8095)
  - CRON_SECRET doit être disponible dans .env/.env.local ou dans l'environnement cron
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --node)
      NODE_BIN="$2"
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

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if [[ -z "${NODE_BIN}" && -s "${NVM_DIR}/nvm.sh" ]]; then
  # Supporte les installations Node gérées par nvm dans cron.
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
fi

if [[ -z "${NODE_BIN}" ]]; then
  NODE_BIN="$(command -v node || true)"
fi

if [[ -z "${NODE_BIN}" ]]; then
  echo "❌ Node.js introuvable. Définissez NODE_BIN ou installez node dans PATH." >&2
  exit 1
fi

if [[ ! -x "${NODE_BIN}" ]]; then
  echo "❌ Binaire Node.js non exécutable : ${NODE_BIN}" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🔔 Déclenchement notifications automatiques"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📁 Projet : ${PROJECT_ROOT}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🟢 Node : ${NODE_BIN}"

exec "${NODE_BIN}" "${SCRIPT_DIR}/trigger-notifications.js"
