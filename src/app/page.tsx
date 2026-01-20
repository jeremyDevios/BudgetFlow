import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-4">
      <div className="max-w-3xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-600 sm:text-7xl">
          Maîtrisez votre budget avec BudgetFlow
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-400">
          La méthode des enveloppes, modernisée. Suivez vos dépenses, définissez vos limites et atteignez vos objectifs financiers sans effort.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="group flex items-center gap-2 rounded-full bg-amber-500 px-8 py-4 text-lg font-semibold text-white transition hover:bg-amber-600"
          >
            Commencer maintenant
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </main>
  );
}
