import type { SubjectAdjustment } from '../domain/annotatedProductFit';
import { accountDatabase } from '../desktop/runtime';
import type { DimensionAnnotation } from '../domain/dimensionAnnotations';
import type { DimensionFields } from '../domain/dimensions';
import type { SofaCombinationKind } from '../domain/sofaCombinationLayout';
import type { SoftBedOptions } from '../domain/softBedSingleLayout';
import { resolveTemplateId, type TemplateId } from '../domain/templates';
import { COMBINATION_TEMPLATE_RULES, isCombinationTemplateId, isSingleTemplateId, SINGLE_TEMPLATE_RULES } from '../templates/registry';

const DATABASE_NAME = 'sofa-sku-workbench';
const DATABASE_VERSION = 2;
const STORE_NAME = 'drafts';
const HISTORY_STORE_NAME = 'recovery-history';
const LEGACY_DRAFT_KEY = 'current';
const RECOVERY_HISTORY_LIMIT = 10;

export type DraftSlot = string;
export function createSceneSlot(): DraftSlot { return `scene:${crypto.randomUUID()}`; }

export type DraftAccessory = {
  id: string;
  adjustment: SubjectAdjustment;
  image?: { name: string; blob: Blob };
};

export type WorkbenchDraft = {
  version: 1;
  templateId?: TemplateId;
  model: string;
  modelManuallyEdited: boolean;
  sellingPoints: string[];
  softBed?: SoftBedOptions;
  sizeInput: string;
  dimensionFields: DimensionFields;
  annotations: DimensionAnnotation[];
  subjectAdjustment: SubjectAdjustment;
  image?: { name: string; blob: Blob };
  accessories?: DraftAccessory[];
};

export type SofaCombinationDraft = {
  version: 1;
  templateId?: TemplateId;
  kind: SofaCombinationKind;
  model: string;
  modelManuallyEdited: boolean;
  sizeInput: string;
  dimensionFields: DimensionFields;
  annotations: DimensionAnnotation[];
  subjectAdjustment: SubjectAdjustment;
  mainImage?: { name: string; blob: Blob };
  optionalSizes: Array<{
    id: string;
    sizeInput: string;
    dimensionFields: DimensionFields;
    annotations: DimensionAnnotation[];
    adjustment?: SubjectAdjustment;
    image?: { name: string; blob: Blob };
  }>;
  optionalLabelEnabled?: boolean;
  optionalLabelOffsetY: number;
  optionalLabelSide?: 'left' | 'right';
  noteEnabled: boolean;
  note: string;
};

export type DraftPayload = WorkbenchDraft | SofaCombinationDraft;
type StoredDraft = DraftPayload & { id: DraftSlot | typeof LEGACY_DRAFT_KEY; updatedAt?: number };
type StoredImageReference = { name: string; size: number; type: string };
type LightweightWorkbenchDraft = Omit<WorkbenchDraft, 'image' | 'accessories'> & {
  image?: StoredImageReference;
  accessories?: Array<Omit<DraftAccessory, 'image'> & { image?: StoredImageReference }>;
};
type LightweightCombinationDraft = Omit<SofaCombinationDraft, 'mainImage' | 'optionalSizes'> & {
  mainImage?: StoredImageReference;
  optionalSizes: Array<Omit<SofaCombinationDraft['optionalSizes'][number], 'image'> & { image?: StoredImageReference }>;
};
type LightweightDraft = LightweightWorkbenchDraft | LightweightCombinationDraft;
type StoredRecoveryHistory = { id: DraftSlot; entries: LightweightDraft[] };

function imageReference(image: { name: string; blob: Blob } | undefined): StoredImageReference | undefined {
  return image ? { name: image.name, size: image.blob.size, type: image.blob.type } : undefined;
}

function isSingleDraft(draft: DraftPayload): draft is WorkbenchDraft {
  return 'sellingPoints' in draft;
}

export function hasDraftContent(draft: DraftPayload): boolean {
  const hasText = (value: string | undefined) => Boolean(value?.trim());
  if (hasText(draft.model) || hasText(draft.sizeInput) || Object.values(draft.dimensionFields ?? {}).some(hasText) || draft.annotations?.length) return true;
  if (isSingleDraft(draft)) {
    if (draft.image || draft.accessories?.some((item) => item.image) || draft.sellingPoints.some(hasText)) return true;
    const id = resolveTemplateId('single', draft.templateId);
    if (!isSingleTemplateId(id)) return false;
    const rules = SINGLE_TEMPLATE_RULES[id];
    return rules.hasOptions(rules.restoreOptions(draft));
  }
  if (draft.mainImage || draft.optionalSizes.some((item) => item.image || hasText(item.sizeInput) || Object.values(item.dimensionFields ?? {}).some(hasText) || item.annotations?.length)) return true;
  const id = resolveTemplateId('combination', draft.templateId);
  if (!isCombinationTemplateId(id)) return false;
  const rules = COMBINATION_TEMPLATE_RULES[id];
  return hasText(draft.note) && draft.note !== rules.note.defaultText || rules.hasOptions(rules.restoreOptions(draft));
}

function lightweightDraft(draft: DraftPayload): LightweightDraft {
  if (isSingleDraft(draft)) {
    const { image, accessories, ...single } = draft;
    return {
      ...single,
      image: imageReference(image),
      ...(accessories === undefined ? {} : {
        accessories: accessories.map((item) => ({ ...item, image: imageReference(item.image) })),
      }),
    };
  }
  const combination = draft as SofaCombinationDraft;
  return {
    ...combination,
    mainImage: imageReference(combination.mainImage),
    optionalSizes: combination.optionalSizes.map((item) => ({ ...item, image: imageReference(item.image) })),
  };
}

function recoveryKey(draft: LightweightDraft): string {
  return JSON.stringify(draft);
}

function sameImage(reference: StoredImageReference | undefined, image: { name: string; blob: Blob } | undefined) {
  return !reference && !image || Boolean(reference && image
    && reference.name === image.name && reference.size === image.blob.size && reference.type === image.blob.type);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(accountDatabase(DATABASE_NAME), DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!request.result.objectStoreNames.contains(HISTORY_STORE_NAME)) {
        request.result.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开操作现场存储'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('操作现场存储失败'));
  });
}

export async function saveDraft(draft: WorkbenchDraft, slot?: 'single'): Promise<void>;
export async function saveDraft(draft: WorkbenchDraft, slot: string): Promise<void>;
export async function saveDraft(draft: SofaCombinationDraft, slot: string): Promise<void>;
export async function saveDraft(draft: DraftPayload, slot: DraftSlot = 'single'): Promise<void> {
  if (!hasDraftContent(draft)) { await clearDraft(slot); return; }
  const database = await openDatabase();
  try {
    const transaction = database.transaction([STORE_NAME, HISTORY_STORE_NAME], 'readwrite');
    await requestResult(transaction.objectStore(STORE_NAME).put({ ...draft, id: slot, updatedAt: Date.now() } satisfies StoredDraft));
    const historyStore = transaction.objectStore(HISTORY_STORE_NAME);
    const storedHistory = await requestResult(historyStore.get(slot) as IDBRequest<StoredRecoveryHistory | undefined>);
    const next = lightweightDraft(draft);
    const entries = storedHistory?.entries ?? [];
    const latest = entries[entries.length - 1];
    if (!latest || recoveryKey(latest) !== recoveryKey(next)) {
      await requestResult(historyStore.put({ id: slot, entries: [...entries, next].slice(-RECOVERY_HISTORY_LIMIT) } satisfies StoredRecoveryHistory));
    }
  } finally {
    database.close();
  }
}

export async function loadRecoveryHistory(slot: string, current: WorkbenchDraft): Promise<WorkbenchDraft[]>;
export async function loadRecoveryHistory(slot: string, current: SofaCombinationDraft): Promise<SofaCombinationDraft[]>;
export async function loadRecoveryHistory(slot: DraftSlot, current: DraftPayload): Promise<DraftPayload[]> {
  const database = await openDatabase();
  try {
    const stored = await requestResult(database.transaction(HISTORY_STORE_NAME, 'readonly').objectStore(HISTORY_STORE_NAME).get(slot) as IDBRequest<StoredRecoveryHistory | undefined>);
    if (!stored) return [];
    if (isSingleDraft(current)) {
      const active = current as WorkbenchDraft;
      return (stored.entries as LightweightWorkbenchDraft[]).flatMap(({ accessories, ...entry }) => {
        if (!sameImage(entry.image, active.image)) return [];
        const restoredAccessories = accessories?.map((item) => {
          const activeItem = active.accessories?.find((candidate) => candidate.id === item.id);
          return activeItem && sameImage(item.image, activeItem.image) ? { ...item, image: activeItem.image } : undefined;
        });
        if (restoredAccessories?.some((item) => !item)) return [];
        return [{
          ...entry,
          image: active.image,
          ...(accessories === undefined ? {} : { accessories: restoredAccessories as DraftAccessory[] }),
        }];
      });
    }
    const active = current as SofaCombinationDraft;
    return (stored.entries as LightweightCombinationDraft[]).flatMap((entry) => {
      if (!sameImage(entry.mainImage, active.mainImage)) return [];
      const options = entry.optionalSizes.map((item) => {
        const activeItem = active.optionalSizes.find((candidate) => candidate.id === item.id);
        return sameImage(item.image, activeItem?.image) ? { ...item, image: activeItem?.image } : undefined;
      });
      if (options.some((item) => !item)) return [];
      return [{ ...entry, mainImage: active.mainImage, optionalSizes: options as SofaCombinationDraft['optionalSizes'] }];
    });
  } finally {
    database.close();
  }
}

export async function loadDraft(slot?: 'single'): Promise<WorkbenchDraft | null>;
export async function loadDraft(slot: string): Promise<DraftPayload | null>;
export async function loadDraft(slot: DraftSlot = 'single'): Promise<DraftPayload | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    let stored = await requestResult(store.get(slot) as IDBRequest<StoredDraft | undefined>);
    if (!stored && slot === 'single') {
      stored = await requestResult(store.get(LEGACY_DRAFT_KEY) as IDBRequest<StoredDraft | undefined>);
    }
    if (!stored || stored.version !== 1) return null;
    const { id: _id, updatedAt: _updatedAt, ...draft } = stored;
    return draft;
  } finally {
    database.close();
  }
}

export type DraftSummary = {
  slot: DraftSlot;
  kind: 'single' | 'combination';
  templateId: TemplateId;
  model: string;
  updatedAt: number;
  hasContent: boolean;
};

function draftSummary(stored: StoredDraft): DraftSummary {
  const kind = isSingleDraft(stored) ? 'single' : 'combination';
  return { slot: stored.id === LEGACY_DRAFT_KEY ? 'single' : stored.id, kind, templateId: resolveTemplateId(kind, stored.templateId), model: stored.model, updatedAt: stored.updatedAt ?? 0, hasContent: hasDraftContent(stored) };
}

export async function loadDraftSummaries(): Promise<DraftSummary[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([STORE_NAME, HISTORY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const drafts = await requestResult(store.getAll() as IDBRequest<StoredDraft[]>);
    const summaries: DraftSummary[] = [];
    for (const stored of drafts) {
      if (stored.version !== 1 || stored.id.startsWith('project:')) continue;
      const summary = draftSummary(stored);
      if (!summary.hasContent) {
        await requestResult(store.delete(stored.id));
        await requestResult(transaction.objectStore(HISTORY_STORE_NAME).delete(stored.id));
      } else if (stored.id !== LEGACY_DRAFT_KEY || !drafts.some((item) => item.id === 'single')) {
        summaries.push(summary);
      }
    }
    return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally { database.close(); }
}

export async function loadDraftSummary(slot: string): Promise<DraftSummary | null> {
  const database = await openDatabase();
  try {
    const store = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    let stored = await requestResult(store.get(slot) as IDBRequest<StoredDraft | undefined>);
    if (!stored && slot === 'single') stored = await requestResult(store.get(LEGACY_DRAFT_KEY) as IDBRequest<StoredDraft | undefined>);
    if (!stored || stored.version !== 1) return null;
    return draftSummary(stored);
  } finally {
    database.close();
  }
}

export async function clearDraft(slot: DraftSlot = 'single'): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([STORE_NAME, HISTORY_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    await requestResult(store.delete(slot));
    if (slot === 'single') await requestResult(store.delete(LEGACY_DRAFT_KEY));
    await requestResult(transaction.objectStore(HISTORY_STORE_NAME).delete(slot));
  } finally {
    database.close();
  }
}
