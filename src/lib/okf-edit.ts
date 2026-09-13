export function validateOkfEdit(path: string, content: string): string | null {
  if (!path.endsWith(".md")) return "Somente arquivos Markdown podem ser editados.";
  if (!content.trim()) return "O arquivo não pode ficar vazio.";
  if (content.length > 200000) return "O arquivo excede o limite permitido.";
  if (!path.endsWith("index.md") && !/^type\s*:\s*.+$/m.test(content)) {
    return "Conceitos OKF precisam manter o campo type no frontmatter.";
  }
  return null;
}
