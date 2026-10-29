import { TemplateDetail } from "@/components/template-detail";

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main id="main-content" tabIndex={-1}>
      <TemplateDetail id={id} />
    </main>
  );
}
