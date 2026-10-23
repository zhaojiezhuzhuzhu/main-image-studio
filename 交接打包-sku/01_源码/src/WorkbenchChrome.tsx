import type { ChangeEvent, ReactNode } from 'react';
import { InputDetails, InputImage } from './WorkbenchInputCards';
import type { ProductImage } from './project/productImage';
import { FilenameNameNotice } from './FilenameNameNotice';
import { AppMark, FurnitureIcon, type FurnitureIconName } from './ui/FurnitureIcon';
import { SourceFileIcon } from './ui/SourceFileIcon';
import type { TemplateProductionNotes } from './templates/types';

export type WorkbenchStep = {
  id: string;
  label: string;
  mark: string;
};

type WorkbenchHeaderProps = {
  title: string;
  subtitle: string;
  saveStatus: string;
  pendingCount: number;
  exportLabel: string;
  onBack: () => void;
  onExport: () => void;
  projectFileName?: string;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  onSaveProjectAs?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
};

export function WorkbenchHeader({
  title, subtitle, saveStatus, pendingCount, exportLabel, onBack, onExport,
  projectFileName, onOpenProject, onSaveProject, onSaveProjectAs,
  canUndo = false, canRedo = false, onUndo, onRedo,
}: WorkbenchHeaderProps) {
  return <header className="workbench-header">
    <button type="button" className="back-to-templates" onClick={onBack}>← 模板库</button>
    <AppMark/>
    <strong>{title}</strong>
    <span className="workbench-subtitle">{subtitle}</span>
    <div className="header-actions">
      <div className="history-actions" aria-label="编辑历史">
        <button type="button" disabled={!canUndo} onClick={onUndo} title="撤销（Ctrl+Z）" aria-label="撤销">↶</button>
        <button type="button" disabled={!canRedo} onClick={onRedo} title="重做（Ctrl+Y 或 Ctrl+Shift+Z）" aria-label="重做">↷</button>
      </div>
      <div className="project-actions">
        <button type="button" onClick={onOpenProject}><SourceFileIcon />打开源文件</button>
        <button type="button" onClick={onSaveProject}><SourceFileIcon />保存源文件</button>
        <button type="button" onClick={onSaveProjectAs}>另存为</button>
      </div>
      <span className="save-pill" title={projectFileName || saveStatus}>{projectFileName ? <SourceFileIcon /> : <i />}{projectFileName || saveStatus}</span>
      <button type="button" className="header-export" onClick={onExport}><FurnitureIcon name="download"/>{exportLabel}</button>
    </div>
  </header>;
}

type StepRailProps = {
  steps: WorkbenchStep[];
  activeId: string;
  completed: number;
  total: number;
  uploadSlot: ReactNode;
};

export function StepRail({ steps, activeId, completed, total, uploadSlot }: StepRailProps) {
  const percentage = total ? Math.round(completed / total * 100) : 0;
  return <nav className="step-rail" aria-label="制作步骤">
    <span className="step-rail-title">制作步骤</span>
    <div className="step-list">
      {steps.map((step) => <a key={step.id} className={step.id === activeId ? 'active' : ''} href={`#${step.id}`}>
        <span className="step-mark" aria-hidden="true">{step.mark}</span>
        <span>{step.label}</span>
      </a>)}
    </div>
    <div className="rail-bottom">
      {uploadSlot}
      <div className="completion-copy"><strong>{completed}/{total}</strong><span>完成度</span></div>
      <div className="completion-track" aria-label={`完成度 ${percentage}%`}><i style={{ width: `${percentage}%` }} /></div>
    </div>
  </nav>;
}

export function QuickInputPanel({ children }: { children: ReactNode }) {
  return <aside className="object-panel quick-input-panel compact-input-panel" aria-label="快速填写"><div className="object-panel-title"><h2>快速填写</h2></div>{children}</aside>;
}

export function WorkbenchSidebar({ notes, children }: { notes: TemplateProductionNotes; children: ReactNode }) {
  return <div className="workbench-sidebar">
    <details className="production-notes-card" open>
      <summary><h2>制作关键要点</h2><span className="production-notes-toggle" aria-hidden="true"/></summary>
      <p className="production-notes-source">规范 PPT · 第 {notes.sourcePages} 页</p>
      <ul>{notes.points.map((point) => <li key={point}>{point}</li>)}</ul>
    </details>
    <aside className="settings-panel contextual-inspector" aria-label="微调编辑">{children}</aside>
  </div>;
}

export type CombinationObjectItem = {
  id: string;
  title: string;
  summary: string;
  filename?: string;
  image?: ProductImage;
  sizeInput: string;
  status: 'complete' | 'pending' | 'empty';
};

type CombinationObjectPanelProps = {
  productIcon?: FurnitureIconName;
  maxOptionalCount?: number;
  labelControls?: boolean;
  elementControls?: boolean;
  mainFields?: ReactNode;
  optionalActions?: (id: string) => ReactNode;
  noteFields?: ReactNode;
  management?: ReactNode;
  model: string;
  mainComplete: boolean;
  mainSizeInput: string;
  optionalItems: CombinationObjectItem[];
  selectedId?: string;
  labelSelected: boolean;
  labelEnabled: boolean;
  labelSide: 'left' | 'right';
  noteEnabled: boolean;
  uploadSlot: ReactNode;
  onSelect: (id: 'main' | string) => void;
  onAdd: () => void;
  onToggleLabel: () => void;
  onSetLabelSide: (side: 'left' | 'right') => void;
  onToggleNote: () => void;
  onMainSizeChange: (value: string) => void;
  onOptionalSizeChange: (id: string, value: string) => void;
  onOptionalImageChange: (id: string, event: ChangeEvent<HTMLInputElement>) => void;
  optionalImageInputRef?: (id: string, input: HTMLInputElement | null) => void;
  imageImportBusy?: boolean;
};

export function CombinationObjectPanel({ productIcon = 'sofa', maxOptionalCount = 4, labelControls = true, elementControls = true, model, mainComplete, mainSizeInput, optionalItems, selectedId, labelSelected, labelEnabled, labelSide, noteEnabled, uploadSlot, onSelect, onAdd, onToggleLabel, onSetLabelSide, onToggleNote, onMainSizeChange, onOptionalSizeChange, onOptionalImageChange, optionalImageInputRef, mainFields, optionalActions, noteFields, management, imageImportBusy }: CombinationObjectPanelProps) {
  return <aside className="object-panel quick-input-panel compact-input-panel" aria-label="快速填写">
    <div className="object-panel-title"><h2>画布对象</h2><span>{1 + optionalItems.length} / {1 + maxOptionalCount}</span></div>
    <div className={!selectedId && !labelSelected ? 'object-row main-object-row active' : 'object-row main-object-row'}>
      {uploadSlot}
      <div className="object-details"><button type="button" className="object-row-select" onClick={() => onSelect('main')} title={`${model || '待填写型号'} · ${mainComplete ? '标注完成' : '待完善'}`}><strong>主产品</strong><i className={mainComplete ? 'status-dot complete' : 'status-dot pending'}/></button><input className="object-size-input" aria-label="主产品尺寸（长×宽×高）" value={mainSizeInput} placeholder="长×宽×高" onChange={(event) => onMainSizeChange(event.target.value)}/></div>
      <div className="object-quick-actions input-card-fields">{mainFields}</div>
    </div>
    <div className="object-subtitle"><strong>其他可选尺寸</strong><button type="button" onClick={onAdd} disabled={optionalItems.length >= maxOptionalCount}>＋ 添加</button></div>
    <div className="object-list">
      {optionalItems.map((item) => <div key={item.id} className={selectedId === item.id ? 'object-row optional-object-row active' : 'object-row optional-object-row'}>
        <InputImage image={item.image} icon={productIcon} label={`更换${item.title} PNG`} inputRef={(input) => optionalImageInputRef?.(item.id, input)} onChange={(event) => onOptionalImageChange(item.id, event)} disabled={imageImportBusy}/>
        <div className="object-details"><button type="button" className="object-row-select" onClick={() => onSelect(item.id)} title={item.summary}><strong>{item.title}</strong><i className={`status-dot ${item.status}`}/></button><input className="object-size-input" aria-label={`${item.title}尺寸（长×宽×高）`} value={item.sizeInput} placeholder="长×宽×高" onChange={(event) => onOptionalSizeChange(item.id, event.target.value)}/></div>
        {optionalActions && <div className="object-quick-actions">{optionalActions(item.id)}</div>}
        {item.filename && <div className="object-quick-actions" role="note" aria-label={`${item.title}文件名识别`}><InputDetails title="图片与文件名"><FilenameNameNotice filename={item.filename} policy={{ includeSpecification: true }}/></InputDetails></div>}
      </div>)}
      {!optionalItems.length && <p className="object-empty">还没有其他规格，可从上方添加。</p>}
    </div>
    {(elementControls || noteFields) && <div className="object-elements"><h3>组合元素</h3>{elementControls && <>{labelControls && <div className={labelSelected ? 'label-element-row active' : 'label-element-row'}><button type="button" className="element-select" onClick={onToggleLabel} aria-pressed={labelEnabled}><span className={labelEnabled ? 'element-icon check' : 'element-icon check off'}>{labelEnabled ? '✓' : ''}</span><span>其他可选尺寸</span></button><span className="label-side-compact-actions"><button type="button" className={labelSide === 'left' ? 'active' : ''} aria-pressed={labelSide === 'left'} onClick={() => onSetLabelSide('left')}>左侧</button><button type="button" className={labelSide === 'right' ? 'active' : ''} aria-pressed={labelSide === 'right'} onClick={() => onSetLabelSide('right')}>右侧</button></span></div>}<button type="button" onClick={onToggleNote} aria-pressed={noteEnabled}><span className={noteEnabled ? 'element-icon check' : 'element-icon check off'}>{noteEnabled ? '✓' : ''}</span><span>底部备注</span><strong>{noteEnabled ? '开启' : '关闭'}</strong></button></>}{noteFields && <div className="input-note-fields">{noteFields}</div>}</div>}
    {management}
  </aside>;
}

export function CanvasPanelHeader({ title, status, zoom }: { title: string; status: string; zoom: {
  percent: number; isFit: boolean; canZoomOut: boolean; canZoomIn: boolean;
  onZoomOut: () => void; onZoomIn: () => void; onFit: () => void;
} }) {
  return <div className="canvas-panel-head"><div><strong>{title}</strong><span role="status" aria-live="polite">{status}</span></div>
    <div className="canvas-zoom" aria-label="画布缩放显示" title="画布内按住 Alt 并滚动鼠标滚轮，可放大或缩小查看">
      <button type="button" aria-label="缩小画布" title="缩小画布" disabled={!zoom.canZoomOut} onClick={zoom.onZoomOut}>−</button>
      <button type="button" className="canvas-fit" aria-label="画布自适应" title={`当前 ${zoom.percent}% · 点击恢复自适应`} onClick={zoom.onFit}>{zoom.isFit ? '自适应' : `${zoom.percent}%`}</button>
      <button type="button" aria-label="放大画布" title="放大画布" disabled={!zoom.canZoomIn} onClick={zoom.onZoomIn}>＋</button>
    </div>
  </div>;
}
