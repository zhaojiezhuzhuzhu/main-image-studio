import type { DraftAccessory, SofaCombinationDraft, WorkbenchDraft } from '../storage/draftStorage';
import { resolveTemplateId } from '../domain/templates';

const MAGIC = 'SKUWORK1';
const HEADER_SIZE = MAGIC.length + 4;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;

type StoredImage = { name: string; assetId: string };
type StoredSingleDraft = Omit<WorkbenchDraft, 'image' | 'accessories'> & {
  image?: StoredImage;
  accessories?: Array<Omit<DraftAccessory, 'image'> & { image?: StoredImage }>;
};
type StoredCombinationDraft = Omit<SofaCombinationDraft, 'mainImage' | 'optionalSizes'> & {
  mainImage?: StoredImage;
  optionalSizes: Array<Omit<SofaCombinationDraft['optionalSizes'][number], 'image'> & { image?: StoredImage }>;
};

type AssetManifest = {
  id: string;
  name: string;
  type: string;
  size: number;
  sha256: string;
};

type ProjectManifest = {
  format: 'skuwork';
  version: 1;
  projectId?: string;
  kind: ProjectKind;
  savedAt: string;
  draft: StoredSingleDraft | StoredCombinationDraft;
  assets: AssetManifest[];
};

export type ProjectDocument =
  | { projectId: string; kind: 'single'; savedAt: string; draft: WorkbenchDraft }
  | { projectId: string; kind: 'combination'; savedAt: string; draft: SofaCombinationDraft };

export type ProjectKind = 'single' | 'combination';

type PendingAsset = AssetManifest & { blob: Blob };

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

async function collectAssets(images: Array<{ name: string; blob: Blob } | undefined>) {
  const byBlob = new Map<Blob, PendingAsset>();
  const refs = new Map<{ name: string; blob: Blob }, StoredImage>();

  for (const image of images) {
    if (!image) continue;
    let asset = byBlob.get(image.blob);
    if (!asset) {
      const id = `asset-${byBlob.size + 1}`;
      asset = {
        id,
        name: image.name,
        type: image.blob.type || 'application/octet-stream',
        size: image.blob.size,
        sha256: await sha256(image.blob),
        blob: image.blob,
      };
      byBlob.set(image.blob, asset);
    }
    refs.set(image, { name: image.name, assetId: asset.id });
  }

  return { assets: [...byBlob.values()], refs };
}

function storedImage(
  image: { name: string; blob: Blob } | undefined,
  assets: PendingAsset[],
): StoredImage | undefined {
  if (!image) return undefined;
  const asset = assets.find((candidate) => candidate.blob === image.blob);
  if (!asset) throw new Error('项目图片资源整理失败');
  return { name: image.name, assetId: asset.id };
}

function assertManifest(value: unknown): asserts value is ProjectManifest {
  if (!value || typeof value !== 'object') throw new Error('项目文件清单无效');
  const manifest = value as Partial<ProjectManifest>;
  if (manifest.format !== 'skuwork' || manifest.version !== 1) throw new Error('不支持的项目文件版本');
  if (manifest.projectId !== undefined && (typeof manifest.projectId !== 'string' || !manifest.projectId.trim())) throw new Error('项目标识无效');
  if (manifest.kind !== 'single' && manifest.kind !== 'combination') throw new Error('项目类型无效');
  if (!manifest.draft || typeof manifest.draft !== 'object' || manifest.draft.version !== 1) throw new Error('项目内容无效');
  resolveTemplateId(manifest.kind, manifest.draft.templateId);
  if (!Array.isArray(manifest.assets)) throw new Error('项目资源清单无效');
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.id !== 'string' || typeof asset.name !== 'string'
      || typeof asset.type !== 'string' || !Number.isSafeInteger(asset.size) || asset.size < 0
      || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new Error('项目资源描述无效');
    }
  }
}

export function createProjectId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function projectDraftSlot(kind: ProjectKind, projectId: string): string {
  return `project:${kind}:${projectId}`;
}

function restoreImage(ref: StoredImage | undefined, assets: Map<string, { name: string; blob: Blob }>) {
  if (!ref) return undefined;
  const asset = assets.get(ref.assetId);
  if (!asset) throw new Error(`项目缺少图片资源：${ref.name}`);
  return { name: ref.name, blob: asset.blob };
}

export async function encodeProjectFile(draft: WorkbenchDraft, kind?: 'single', projectId?: string): Promise<Blob>;
export async function encodeProjectFile(draft: SofaCombinationDraft, kind: 'combination', projectId?: string): Promise<Blob>;
export async function encodeProjectFile(
  draft: WorkbenchDraft | SofaCombinationDraft,
  kind: ProjectKind = 'single',
  projectId = createProjectId(),
): Promise<Blob> {
  resolveTemplateId(kind, draft.templateId);
  const images = kind === 'single'
    ? [(draft as WorkbenchDraft).image, ...((draft as WorkbenchDraft).accessories?.map((item) => item.image) ?? [])]
    : [
      (draft as SofaCombinationDraft).mainImage,
      ...(draft as SofaCombinationDraft).optionalSizes.map((item) => item.image),
    ];
  const { assets } = await collectAssets(images);
  const { image, accessories, ...single } = draft as WorkbenchDraft;
  const storedDraft: StoredSingleDraft | StoredCombinationDraft = kind === 'single'
    ? {
      ...single,
      image: storedImage(image, assets),
      ...(accessories === undefined ? {} : {
        accessories: accessories.map((item) => ({ ...item, image: storedImage(item.image, assets) })),
      }),
    }
    : {
      ...(draft as SofaCombinationDraft),
      mainImage: storedImage((draft as SofaCombinationDraft).mainImage, assets),
      optionalSizes: (draft as SofaCombinationDraft).optionalSizes.map((item) => ({
        ...item,
        image: storedImage(item.image, assets),
      })),
    };
  const manifest: ProjectManifest = {
    format: 'skuwork',
    version: 1,
    projectId,
    kind,
    savedAt: new Date().toISOString(),
    draft: storedDraft,
    assets: assets.map(({ blob: _blob, ...asset }) => asset),
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.length > MAX_MANIFEST_BYTES) throw new Error('项目数据过大，无法保存');
  const header = new Uint8Array(HEADER_SIZE);
  header.set(new TextEncoder().encode(MAGIC));
  new DataView(header.buffer).setUint32(MAGIC.length, manifestBytes.length, true);
  return new Blob([header, manifestBytes, ...assets.map((asset) => asset.blob)], {
    type: 'application/x-skuwork',
  });
}

export async function decodeProjectFile(file: Blob): Promise<ProjectDocument> {
  if (file.size < HEADER_SIZE) throw new Error('项目文件不完整');
  const header = new Uint8Array(await file.slice(0, HEADER_SIZE).arrayBuffer());
  if (new TextDecoder().decode(header.slice(0, MAGIC.length)) !== MAGIC) throw new Error('这不是有效的 SKU 项目源文件');
  const manifestLength = new DataView(header.buffer).getUint32(MAGIC.length, true);
  if (!manifestLength || manifestLength > MAX_MANIFEST_BYTES || HEADER_SIZE + manifestLength > file.size) {
    throw new Error('项目文件清单已损坏');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.slice(HEADER_SIZE, HEADER_SIZE + manifestLength).text());
  } catch {
    throw new Error('项目文件清单无法读取');
  }
  assertManifest(parsed);
  const manifest = parsed;
  const projectId = manifest.projectId ?? `legacy-${await sha256(file)}`;
  const assets = new Map<string, { name: string; blob: Blob }>();
  let offset = HEADER_SIZE + manifestLength;
  for (const asset of manifest.assets) {
    const end = offset + asset.size;
    if (end > file.size) throw new Error(`项目图片资源不完整：${asset.name}`);
    const blob = file.slice(offset, end, asset.type);
    if (await sha256(blob) !== asset.sha256) throw new Error(`项目图片资源校验失败：${asset.name}`);
    assets.set(asset.id, { name: asset.name, blob });
    offset = end;
  }
  if (offset !== file.size) throw new Error('项目文件包含无法识别的尾部数据');

  if (manifest.kind === 'single') {
    const stored = manifest.draft as StoredSingleDraft;
    const { image, accessories, ...single } = stored;
    return {
      projectId,
      kind: 'single',
      savedAt: manifest.savedAt,
      draft: {
        ...single,
        image: restoreImage(image, assets),
        ...(accessories === undefined ? {} : {
          accessories: accessories.map((item) => ({ ...item, image: restoreImage(item.image, assets) })),
        }),
      },
    };
  }
  const stored = manifest.draft as StoredCombinationDraft;
  return {
    projectId,
    kind: 'combination',
    savedAt: manifest.savedAt,
    draft: {
      ...stored,
      mainImage: restoreImage(stored.mainImage, assets),
      optionalSizes: stored.optionalSizes.map((item) => ({
        ...item,
        image: restoreImage(item.image, assets),
      })),
    },
  };
}

export function suggestedProjectName(model: string, kind: ProjectKind): string {
  const safeModel = model.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || '未命名SKU';
  return `${safeModel}${kind === 'combination' ? '-组合' : ''}.skuwork`;
}
