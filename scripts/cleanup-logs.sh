#!/bin/bash

# Script pour nettoyer les logs sensibles en une seule commande

# Importer le logger dans les fichiers requis
echo "Updating imports..."

# login.tsx
sed -i "" 's/import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";/import { Lock, Mail, ArrowRight, Loader2 } from "lucide-react";\nimport { validateEmail, validatePassword } from "@\/lib\/validation";\nimport { logger } from "@\/lib\/logger";/' src/app/\(auth\)/login/page.tsx

# Remplace console.error par logger dans login.tsx (Google auth error)
sed -i "" 's/console\.error(err);/logger.sanitizedError("Google auth error", err);/' src/app/\(auth\)/login/page.tsx | head -1

# Replace toutes les autres occurrences
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/dashboard/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/evolution/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/cashflow/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/envelopes/\[id\]/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/history/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/onboarding/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/\(protected\)/settings/page.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/components/dashboard/TransactionModal.tsx  
sed -i "" 's/console\.error(\([^)]*\));/logger.sanitizedError("\1:");/g' src/app/api/notifications/trigger/route.ts  

sed -i "" 's/console\.warn(\([^)]*\));/logger.warn("\1:");/g' src/app/\(protected\)/dashboard/page.tsx  
sed -i "" 's/console\.warn(\([^)]*\));/logger.warn("\1:");/g' src/context/AuthContext.tsx  

echo "✅ Cleanup done!"
