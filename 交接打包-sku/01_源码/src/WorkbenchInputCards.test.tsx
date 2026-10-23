// @vitest-environment jsdom
import { act, useState } from 'react';
import iconSpriteSource from './ui/furniture-icons.svg?raw';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SofaCombinationWorkbench } from './SofaCombinationWorkbench';
import { InputCard, InputDetails, InputImage, InputToggle, type InputSlots } from './WorkbenchInputCards';
import type { ProductImage } from './project/productImage';
import { SINGLE_TEMPLATE_RULES, COMBINATION_TEMPLATE_RULES, type SingleTemplateId, type CombinationTemplateId } from './templates/registry';

vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));

const iconSprite = new DOMParser().parseFromString(iconSpriteSource, 'image/svg+xml');

function expectUploadIcons(panel: Element) {
  for (const input of panel.querySelectorAll('input[type=file]')) {
    const icon = input.parentElement!.querySelector('svg')!;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const name = icon.querySelector('use')!.getAttribute('href')!.split('#')[1];
    expect(iconSprite.getElementById(name)).not.toBeNull();
  }
}

it.each(Object.keys(SINGLE_TEMPLATE_RULES) as SingleTemplateId[])('%s 的图片与所有填写项均有卡片归属且上传入口不重复', (id) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<SingleWorkbench templateId={id} onBack={() => undefined}/>);
  const panel = container.querySelector('.compact-input-panel')!;
  expectUploadIcons(panel);
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  const slots = rules.accessories?.(options, rules.layout([], options)) ?? [];
  expect(panel.querySelectorAll('input[type=file]')).toHaveLength(1 + slots.length);
  for (const field of panel.querySelectorAll('input, textarea, select')) expect(field.closest('.input-card')).not.toBeNull();
  for (const slot of slots) expect(panel.querySelectorAll(`input[aria-label="上传${slot.label} PNG"]`)).toHaveLength(1);
});

it.each(Object.keys(COMBINATION_TEMPLATE_RULES) as CombinationTemplateId[])('%s 的型号与尺寸同卡，备注与启用控件同卡', (id) => {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(<SofaCombinationWorkbench templateId={id} onBack={() => undefined}/>);
  const panel = container.querySelector('.compact-input-panel')!;
  expectUploadIcons(panel);
  const model = [...panel.querySelectorAll('label')].find((node) => node.textContent === '产品型号')!;
  expect(model.closest('.main-object-row')).not.toBeNull();
  for (const field of panel.querySelectorAll('input, textarea, select')) expect(field.closest('.object-row, .object-elements')).not.toBeNull();
});

it('床体和搭配品使用各自的图标，整组素材与同件第二视图保持图标身份', () => {
  for (const [templateId, expected] of [
    ['wood-bed-multi-combination', ['wood-bed', 'mattress', 'mattress', 'mattress', 'wood-nightstand', 'wood-nightstand']],
    ['soft-bed-multi-combination', ['soft-bed', 'mattress', 'mattress', 'mattress', 'nightstand', 'nightstand']],
    ['standing-desk-combination', ['standing-desk', 'monitor-riser']],
    ['study-desk-combination', ['study-desk', 'study-chair']],
    ['wood-dining-chair-single', ['dining-chair', 'dining-chair']],
    ['wardrobe-combination', ['wardrobe-combination', 'wardrobe-combination']],
    ['computer-chair-single', ['computer-chair', ...Array(5).fill('detail-image')]],
    ['mattress-single', ['mattress', ...Array(3).fill('material-image')]],
  ] as const) {
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<SingleWorkbench templateId={templateId} onBack={() => undefined}/>);
    const names = [...container.querySelectorAll('.input-image use')].map((node) => node.getAttribute('href')!.split('#')[1]);
    expect(names, templateId).toEqual(expected);
  }
});

it('上传后用真实缩略图替换图标，换图入口仍能触发且移除图片后恢复图标', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:product-preview');
    static revokeObjectURL = vi.fn();
  });
  const container = document.createElement('div'), root = createRoot(container), onChange = vi.fn();
  const image = { blob: new Blob(['image'], { type: 'image/png' }), name: 'test.png' } as ProductImage;
  try {
    await act(async () => root.render(<InputImage icon="mattress" label="上传床垫 PNG" onChange={onChange}/>));
    expect(container.querySelector('use')!.getAttribute('href')).toMatch(/#mattress$/);
    await act(async () => root.render(<InputImage image={image} icon="mattress" label="上传床垫 PNG" onChange={onChange}/>));
    expect(container.querySelector('img')!.getAttribute('src')).toBe('blob:product-preview');
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('label > span')!.textContent).toBe('换图');
    await act(async () => container.querySelector('input')!.dispatchEvent(new Event('change', { bubbles: true })));
    expect(onChange).toHaveBeenCalledOnce();
    await act(async () => root.render(<InputImage icon="mattress" label="上传床垫 PNG" onChange={onChange}/>));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('use')!.getAttribute('href')).toMatch(/#mattress$/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:product-preview');
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});

it('多组合的床垫资料始终留在对应卡片，减少款数再恢复不丢数据', async () => {
  const rules = SINGLE_TEMPLATE_RULES['wood-bed-multi-combination'], Editor = rules.OptionsEditor!;
  const slots: InputSlots = { main: (fields) => <InputCard title="床体">{fields}</InputCard>, accessory: (id, fields) => <InputCard key={id} title={id}>{fields}</InputCard> };
  function Harness() { const [value, onChange] = useState(rules.createOptions); return <><Editor value={value} onChange={onChange} input={slots}/><output>{JSON.stringify(rules.saveOptions(value))}</output></>; }
  const container = document.createElement('div'), root = createRoot(container);
  try {
    await act(async () => root.render(<Harness/>));
    const count = container.querySelector<HTMLSelectElement>('[aria-label="床垫款数"]')!;
    await act(async () => { count.value = '3'; count.dispatchEvent(new Event('change', { bubbles: true })); });
    const field = container.querySelector<HTMLInputElement>('[aria-label="床垫3型号"]')!;
    expect(field.closest('section')?.getAttribute('aria-label')).toBe('wood-bed-multi-mattress-3资料');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '测试床垫三'); field.dispatchEvent(new Event('input', { bubbles: true })); });
    for (const value of ['2', '3']) await act(async () => { count.value = value; count.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelector<HTMLInputElement>('[aria-label="床垫3型号"]')!.value).toBe('测试床垫三');
    expect(container.querySelector('output')!.textContent).toContain('测试床垫三');
  } finally { await act(async () => root.unmount()); }
});

it('折叠和关闭只改变可见区域，重新开启保留文案，编辑字段不会误选卡片', async () => {
  const onSelect = vi.fn();
  function Harness() {
    const [enabled, setEnabled] = useState(true), [text, setText] = useState('原有说明');
    return <InputCard title="测试产品" onSelect={onSelect}><InputToggle title="功能标注" checked={enabled} onChange={setEnabled}><InputDetails title="位置与说明" open><label>说明<input value={text} onChange={(event) => setText(event.target.value)}/></label></InputDetails></InputToggle></InputCard>;
  }
  const container = document.createElement('div'), root = createRoot(container);
  try {
    await act(async () => root.render(<Harness/>));
    const input = container.querySelector<HTMLInputElement>('input:not([type=checkbox])')!;
    await act(async () => { input.click(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '已编辑说明'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => (container.querySelector('summary') as HTMLElement).click());
    expect(container.querySelector('details')!.open).toBe(false);
    expect(container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true);
    for (let i = 0; i < 2; i++) await act(async () => container.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
    expect(container.querySelector<HTMLInputElement>('input:not([type=checkbox])')!.value).toBe('已编辑说明');
    expect(onSelect).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
