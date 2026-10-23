// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CombinationObjectPanel, QuickInputPanel, WorkbenchHeader, WorkbenchSidebar } from './WorkbenchChrome';

describe('B 方案工作台外壳', () => {
  it('制作要点可收起和展开，编辑下方内容不重置收起状态', async () => {
    const container = document.createElement('div'), root = createRoot(container);
    const notes = { sourcePages: '36–37', points: ['测试制作要点'] };
    const render = async (value: string) => act(async () => root.render(<WorkbenchSidebar notes={notes}><input aria-label="尺寸" defaultValue={value}/></WorkbenchSidebar>));
    try {
      await render('75');
      const card = container.querySelector('details')!;
      expect(card.open).toBe(true);
      await act(async () => card.querySelector('summary')!.click());
      expect(card.open).toBe(false);
      await render('80'); expect(card.open).toBe(false);
      expect(container.querySelector('.contextual-inspector input')).not.toBeNull();
      await act(async () => card.querySelector('summary')!.click());
      expect(card.open).toBe(true); expect(card.textContent).toContain('测试制作要点');
    } finally { await act(async () => root.unmount()); }
  });
  it('单品左栏展示快速填写区', () => {
    const rail = renderToStaticMarkup(<QuickInputPanel><span>上传入口</span></QuickInputPanel>);

    expect(rail).toContain('快速填写');
    expect(rail).not.toContain('备注');
    expect(rail).toContain('上传入口');
    expect(rail).not.toContain('完成度');
  });

  it('组合左栏展示对象列表、组合元素和展开列表', () => {
    const panel = renderToStaticMarkup(<CombinationObjectPanel
      model="PS060-A1"
      mainComplete
      mainSizeInput="260×90×105" onMainSizeChange={() => undefined}
      optionalItems={[
        { id: 'one', title: '规格 1', summary: '240×88×100 · 长', sizeInput: '240×88×100', status: 'complete' },
        { id: 'two', title: '规格 2', summary: '220×88×100 · 长宽', sizeInput: '220×88×100', status: 'pending' },
      ]}
      selectedId="two"
      labelEnabled
      labelSelected={false}
      labelSide="left"
      noteEnabled
      uploadSlot={<span>当前对象上传入口</span>}
      onSelect={() => undefined}
      onAdd={() => undefined}
      onToggleLabel={() => undefined}
      onSetLabelSide={() => undefined}
      onToggleNote={() => undefined}
      onOptionalSizeChange={() => undefined} onOptionalImageChange={() => undefined}
    />);

    expect(panel).toContain('画布对象');
    expect(panel).toContain('主产品');
    expect(panel).toContain('规格 2');
    expect(panel).toContain('组合元素');
    expect(panel).toContain('其他可选尺寸');
    expect(panel).toContain('object-list');
    expect(panel).toContain('当前对象上传入口');
    expect(panel).toContain('主产品尺寸（长×宽×高）');
    expect(panel).toContain('更换规格 1 PNG');
    expect(panel).toContain('>左侧</button>');
    expect(panel).toContain('>右侧</button>');
    expect(panel).toContain('aria-pressed="true"');
    expect(panel).not.toContain('组合模板提示');
    expect(panel).not.toContain('拖动对象可直接微调位置');
    expect(panel).not.toContain('制作步骤');
  });

  it('其他可选尺寸与备注使用相同勾选样式，连续点击可关闭和开启', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onSetLabelSide = vi.fn();
    function Panel() {
      const [enabled, setEnabled] = useState(true);
      return <CombinationObjectPanel model="" mainComplete={false} optionalItems={[]}
        mainSizeInput="" onMainSizeChange={() => undefined}
        labelSelected={false} labelEnabled={enabled} labelSide="left" noteEnabled
        uploadSlot={null} onSelect={() => undefined} onAdd={() => undefined}
        onToggleLabel={() => setEnabled((value) => !value)} onSetLabelSide={onSetLabelSide}
        onToggleNote={() => undefined} onOptionalSizeChange={() => undefined} onOptionalImageChange={() => undefined}/>;
    }
    await act(async () => root.render(<Panel/>));
    const toggle = container.querySelector('.element-select') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.querySelector('.element-icon')?.className).toBe('element-icon check');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.querySelector('.element-icon')?.className).toBe('element-icon check off');
    const right = container.querySelectorAll<HTMLButtonElement>('.label-side-compact-actions button')[1];
    await act(async () => right.click());
    expect(onSetLabelSide).toHaveBeenCalledWith('right');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.querySelector('.element-icon')?.textContent).toBe('✓');
    await act(async () => root.unmount());
  });

  it('组合元素和规格卡片提供互不冲突的独立操作', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onSelect = vi.fn();
    const onToggleLabel = vi.fn();
    const onSetLabelSide = vi.fn();
    const onToggleNote = vi.fn();
    const onOptionalImageChange = vi.fn();
    const onOptionalSizeChange = vi.fn();
    const onMainSizeChange = vi.fn();
    await act(async () => root.render(<CombinationObjectPanel
      model="PS060-A1"
      mainComplete
      mainSizeInput="260×90×105" onMainSizeChange={onMainSizeChange}
      optionalItems={[{ id: 'one', title: '规格 1', summary: '240×88×100 · 长', sizeInput: '240×88×100', status: 'complete' }]}
      labelEnabled
      labelSelected={false}
      labelSide="left"
      noteEnabled
      uploadSlot={<span>上传入口</span>}
      onSelect={onSelect}
      onAdd={() => undefined}
      onToggleLabel={onToggleLabel}
      onSetLabelSide={onSetLabelSide}
      onToggleNote={onToggleNote}
      onOptionalSizeChange={onOptionalSizeChange} onOptionalImageChange={onOptionalImageChange}
    />));

    await act(async () => (container.querySelector('.element-select') as HTMLButtonElement).click());
    const sideButtons = container.querySelectorAll<HTMLButtonElement>('.label-side-compact-actions button');
    await act(async () => sideButtons[1].click());
    await act(async () => (container.querySelector('.object-elements > button[aria-pressed]') as HTMLButtonElement).click());
    await act(async () => (container.querySelector('.optional-object-row .object-row-select') as HTMLButtonElement).click());
    const imageInput = container.querySelector('input[aria-label="更换规格 1 PNG"]') as HTMLInputElement;
    Object.defineProperty(imageInput, 'files', { value: [new File(['png'], 'replacement.png', { type: 'image/png' })] });
    await act(async () => imageInput.dispatchEvent(new Event('change', { bubbles: true })));

    const sizeInput = container.querySelector('input[aria-label="规格 1尺寸（长×宽×高）"]') as HTMLInputElement;
    expect(sizeInput.value).toBe('240×88×100');
    expect(sizeInput.closest('button')).toBeNull();
    await act(async () => {
      sizeInput.click();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(sizeInput, '260×90×105');
      sizeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onOptionalSizeChange).toHaveBeenCalledWith('one', '260×90×105');
    const mainSizeInput = container.querySelector('input[aria-label="主产品尺寸（长×宽×高）"]') as HTMLInputElement;
    expect(mainSizeInput.value).toBe('260×90×105');
    expect(mainSizeInput.closest('button')).toBeNull();
    await act(async () => {
      mainSizeInput.click();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(mainSizeInput, '280×92×110');
      mainSizeInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onMainSizeChange).toHaveBeenCalledWith('280×92×110');
    expect(onOptionalSizeChange).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onToggleLabel).toHaveBeenCalledOnce();
    expect(onSetLabelSide).toHaveBeenCalledWith('right');
    expect(onToggleNote).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('one');
    expect(onOptionalImageChange).toHaveBeenCalledWith('one', expect.anything());
    await act(async () => root.unmount());
  });

  it('页头提供源文件与键盘历史入口', () => {
    const header = renderToStaticMarkup(<WorkbenchHeader
      title="沙发单品 SKU"
      subtitle="单品模板"
      saveStatus="项目源文件已保存"
      projectFileName="A1.skuwork"
      pendingCount={0}
      exportLabel="导出 JPG"
      onBack={() => undefined}
      onExport={() => undefined}
      onOpenProject={() => undefined}
      onSaveProject={() => undefined}
      onSaveProjectAs={() => undefined}
      canUndo
      canRedo={false}
      onUndo={() => undefined}
      onRedo={() => undefined}
    />);

    expect(header).toContain('打开源文件');
    expect(header).toContain('保存源文件');
    expect(header).toContain('另存为');
    expect(header).toContain('A1.skuwork');
    expect(header).toContain('撤销（Ctrl+Z）');
    expect(header).toContain('重做（Ctrl+Y 或 Ctrl+Shift+Z）');
  });
});
