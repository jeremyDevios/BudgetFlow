import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Masquer les outils de développement (Toast et indicateurs) si non activés explicitement
  devIndicators: process.env.SHOW_DEV_TOOLS === 'true' ? undefined : false,
  
  // Optionnel: Permettre l'accès depuis des domaines spécifiques en mode dev (si bloqué)
  // experimental: {
  //   allowedDevOrigins: ["budget.zikkis.fr"],
  // },
};

export default nextConfig;
