import { renderLegalDoc } from "@/lib/render-legal-doc";

export default function RefundPolicyPage() {
  const html = renderLegalDoc("REFUND_POLICY.md");
  return <main className="mx-auto max-w-2xl px-4 py-10" dangerouslySetInnerHTML={{ __html: html }} />;
}
