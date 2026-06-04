// Server component — envelope IDs are user-specific and resolved client-side.
// Uses force-dynamic to avoid Firebase SDK initialization during build.
import EnvelopeDetailClient from "./EnvelopeDetailClient";

export const dynamic = "force-dynamic";

export default function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <EnvelopeDetailClient params={params} />;
}
