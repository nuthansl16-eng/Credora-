import { renderLegalDoc } from "@/lib/render-legal-doc";

export default function AcceptableUsePage() {
  const html = renderLegalDoc("ACCEPTABLE_USE_POLICY.md");
  return <main className="mx-auto max-w-2xl px-4 py-10" dangerouslySetInnerHTML={{ __html: html }} />;
}
