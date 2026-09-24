import { renderLegalDoc } from "@/lib/render-legal-doc";

export default function TermsPage() {
  const html = renderLegalDoc("TERMS_OF_SERVICE.md");
  return (
    <main className="mx-auto max-w-2xl px-4 py-10" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
