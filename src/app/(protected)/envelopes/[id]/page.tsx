// Server component — exports generateStaticParams() required for `output: 'export'`.
// Envelope IDs are user-specific and loaded client-side; Firebase Hosting rewrites
// all paths to index.html so the client router resolves the ID at runtime.
import EnvelopeDetailClient from "./EnvelopeDetailClient";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ id: "__placeholder__" }];
}

export default function EnvelopeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <EnvelopeDetailClient params={params} />;
}
