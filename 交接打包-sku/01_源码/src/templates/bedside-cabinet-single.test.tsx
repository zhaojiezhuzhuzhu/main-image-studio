// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { bedsideCabinetSingleRules as rules } from './bedside-cabinet-single';

it('床头柜数量与卖点表单可独立切换，保存的两项选项同时保留', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const Editor = rules.OptionsEditor!;
  function Harness() {
    const [value, onChange] = useState(rules.createOptions);
    return <><Editor value={value} onChange={onChange}/><output>{JSON.stringify(rules.saveOptions(value))}</output></>;
  }
  try {
    await act(async () => root.render(<Harness/>));
    const quantity = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('输出数量'))!.querySelector('select')!;
    const count = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('卖点数量'))!.querySelector('select')!;
    for (const [select, value] of [[quantity, '2'], [count, '2']] as const) {
      await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
    }
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ bedsideCabinet: { quantity: 2, sellingPointCount: 2 } });
    await act(async () => { quantity.value = '1'; quantity.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(JSON.parse(container.querySelector('output')!.textContent!)).toEqual({ bedsideCabinet: { quantity: 1, sellingPointCount: 2 } });
    expect(container.textContent).toContain('带灯款请上传已展示灯光效果的产品图');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
