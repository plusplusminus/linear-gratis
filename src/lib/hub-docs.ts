import fs from "fs";
import path from "path";

type DocMeta = {
  slug: string;
  title: string;
  description?: string;
  order: number;
};

type DocFull = DocMeta & {
  content: string;
};

const DOCS_DIR = path.join(process.cwd(), "content", "hub-docs");

function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  content: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }
  return { meta, content: match[2] };
}

export async function getHubDocs(): Promise<DocMeta[]> {
  if (!fs.existsSync(DOCS_DIR)) return [];

  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

  const docs: DocMeta[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(DOCS_DIR, file), "utf-8");
    const { meta } = parseFrontmatter(raw);
    return {
      slug: file.replace(/\.md$/, ""),
      title: meta.title || file.replace(/\.md$/, "").replace(/-/g, " "),
      description: meta.description,
      order: meta.order ? parseInt(meta.order, 10) : 99,
    };
  });

  return docs.sort((a, b) => a.order - b.order);
}

export async function getHubDoc(slug: string): Promise<DocFull | null> {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { meta, content } = parseFrontmatter(raw);

  return {
    slug,
    title: meta.title || slug.replace(/-/g, " "),
    description: meta.description,
    order: meta.order ? parseInt(meta.order, 10) : 99,
    content,
  };
}
