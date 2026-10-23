import type { ProjectFileHandle, ProjectWritable } from './fileAccess';

function decodeHeader(value: string | null): string {
  if (!value) throw new Error('工作台没有收到项目文件名');
  try {
    const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    throw new Error('项目文件名无法读取');
  }
}

async function requestFile(token: string): Promise<File> {
  const response = await fetch(`/__skuwork/project/${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error(response.status === 404 ? '双击打开请求已失效，请重新双击源文件' : '无法读取双击打开的源文件');
  const name = decodeHeader(response.headers.get('x-skuwork-name'));
  return new File([await response.blob()], name, { type: 'application/x-skuwork' });
}

class RelayWritable implements ProjectWritable {
  private contents?: Blob;

  constructor(private readonly token: string) {}

  async write(data: Blob): Promise<void> {
    this.contents = data;
  }

  async close(): Promise<void> {
    if (!this.contents) throw new Error('没有可写入的项目内容');
    const response = await fetch(`/__skuwork/project/${encodeURIComponent(this.token)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/x-skuwork' },
      body: this.contents,
    });
    if (response.status === 409) throw new Error('源文件已被其他窗口修改，请另存为后再继续');
    if (!response.ok) throw new Error('项目源文件写入失败');
  }

  async abort(): Promise<void> {
    this.contents = undefined;
  }
}

export async function openRelayedProject(token: string): Promise<{ file: File; handle: ProjectFileHandle }> {
  const file = await requestFile(token);
  return {
    file,
    handle: {
      name: file.name,
      persistable: false,
      getFile: () => requestFile(token),
      createWritable: async () => new RelayWritable(token),
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
    },
  };
}
