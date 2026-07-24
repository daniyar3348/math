import { CourseStructure } from "@/components/admin/CourseStructure";

export default async function CourseStructurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseStructure courseId={id} />;
}
