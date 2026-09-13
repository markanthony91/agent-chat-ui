export type ImportedOkfBundle = {
  name: string;
  files: Record<string, string>;
  paths: string[];
  version: string;
};

const decoder = new TextDecoder("utf-8", { fatal: false });

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function sanitizePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error(`Caminho inválido no ZIP: ${path}`);
  }
  return parts.join("/");
}

function stripCommonRoot(paths: string[]): { paths: string[]; prefix: string } {
  const firstParts = paths.map((path) => path.split("/"));
  if (!firstParts.every((parts) => parts.length > 1)) return { paths, prefix: "" };
  const root = firstParts[0][0];
  if (!firstParts.every((parts) => parts[0] === root)) return { paths, prefix: "" };
  return { paths: paths.map((path) => path.slice(root.length + 1)), prefix: `${root}/` };
}

export async function readOkfZip(file: File): Promise<ImportedOkfBundle> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Selecione um arquivo .zip.");
  if (file.size > 20 * 1024 * 1024) throw new Error("O ZIP excede o limite de 20 MB.");

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const rawEntries: Array<{ path: string; method: number; size: number; localOffset: number }> = [];

  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i += 1) {
    if (u32(view, i) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) throw new Error("ZIP inválido: diretório central não encontrado.");

  const entryCount = u16(view, eocd + 10);
  let cursor = u32(view, eocd + 16);
  for (let i = 0; i < entryCount; i += 1) {
    if (u32(view, cursor) !== 0x02014b50) throw new Error("ZIP inválido: entrada central corrompida.");
    const method = u16(view, cursor + 10);
    const compressedSize = u32(view, cursor + 20);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/") || !name.toLowerCase().endsWith(".md")) continue;
    if (method !== 0 && method !== 8) throw new Error(`Método de compressão não suportado em ${name}.`);
    rawEntries.push({ path: sanitizePath(name), method, size: compressedSize, localOffset });
  }

  if (!rawEntries.length) throw new Error("Nenhum arquivo Markdown encontrado no ZIP.");
  const stripped = stripCommonRoot(rawEntries.map((entry) => entry.path));
  const files: Record<string, string> = {};

  for (let i = 0; i < rawEntries.length; i += 1) {
    const entry = rawEntries[i];
    const local = entry.localOffset;
    if (u32(view, local) !== 0x04034b50) throw new Error(`Entrada local inválida: ${entry.path}`);
    const nameLength = u16(view, local + 26);
    const extraLength = u16(view, local + 28);
    const start = local + 30 + nameLength + extraLength;
    const compressed = bytes.slice(start, start + entry.size);
    const contentBytes = entry.method === 0 ? compressed : await inflateRaw(compressed);
    const path = stripped.paths[i];
    if (!path || !path.toLowerCase().endsWith(".md")) continue;
    files[path] = decoder.decode(contentBytes);
  }

  const paths = Object.keys(files).sort();
  if (!paths.includes("index.md")) throw new Error("Bundle OKF inválido: index.md raiz não encontrado.");
  const rootIndex = files["index.md"];
  const versionMatch = rootIndex.match(/okf_version\s*:\s*["']?([^\s"']+)/i);
  const version = versionMatch?.[1] ?? "não declarada";
  if (version !== "0.2") throw new Error(`Versão OKF esperada: 0.2. Encontrada: ${version}.`);

  for (const path of paths) {
    const content = files[path];
    if (!content.trim()) throw new Error(`Arquivo vazio no bundle: ${path}`);
    if (path.split("/").pop() !== "index.md" && !/^type\s*:\s*.+$/m.test(content)) {
      throw new Error(`Conceito sem campo type: ${path}`);
    }
  }

  return { name: file.name.replace(/\.zip$/i, ""), files, paths, version };
}
