export type ProjectSummary = { model: string; hasProduct: boolean };
export function validateProject(project: ProjectSummary): string[] {
  const issues: string[] = [];
  if (!project.hasProduct) issues.push('请上传透明 PNG 产品图');
  if (!project.model.trim()) issues.push('请填写产品型号');
  return issues;
}
