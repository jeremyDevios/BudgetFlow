// Server component — envelope IDs are user-specific and resolved client-side.
// Firebase SDK now uses lazy init (Proxy) so prerendering is safe.
import EnvelopeDetailClient from "./EnvelopeDetailClient";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <EnvelopeDetailClient params={params} />;
}
