import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { AppMark } from '../ui/FurnitureIcon';
import { desktopCall, flushDesktopEditor, setDesktopUser, type DesktopUser } from './runtime';

const AccountContext = createContext<{ user: DesktopUser; open: () => void } | null>(null);

export function DesktopAccountButton() {
  const account = useContext(AccountContext);
  return account ? <button type="button" className="desktop-account-button" onClick={account.open}>{account.user.name} · {account.user.role === 'admin' ? '管理员' : '用户'}</button> : null;
}

function PasswordField({ label, value, onChange, current = false, invalid = false, hint }: { label: string; value: string; onChange: (value: string) => void; current?: boolean; invalid?: boolean; hint: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <div className="desktop-field"><label htmlFor={id}>{label}</label><div className="desktop-password"><input id={id} value={value} type={visible ? 'text' : 'password'} autoComplete={current ? 'current-password' : 'new-password'} aria-invalid={invalid} aria-describedby={hint} onChange={(event) => onChange(event.target.value)}/><button type="button" className="desktop-secondary" aria-label={`${visible ? '隐藏' : '显示'}${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? '隐藏' : '显示'}</button></div></div>;
}

type FormMode = 'setup' | 'login' | 'create' | 'change' | 'reset';
function AccountForm({ mode, target, onDone }: { mode: FormMode; target?: DesktopUser; onDone: (user?: DesktopUser) => void }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const messageId = useId();
  const nameId = useId();
  const needsName = ['setup', 'login', 'create'].includes(mode);
  const labels = { setup: '创建管理员并进入', login: '登录制作台', create: '创建普通用户', change: '修改密码', reset: '确认重置密码' };
  useEffect(() => { if (invalid) formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(); }, [invalid, error]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setInvalid(''); setError('');
    if (needsName && (!name.trim() || name.trim().length > 32)) { setInvalid('name'); setError('账号请填写 1 至 32 个字符'); return; }
    if (mode === 'change' && !current) { setInvalid('current'); setError('请填写当前密码'); return; }
    if (!password || (mode !== 'login' && [...password].length < 8)) { setInvalid('password'); setError(mode === 'login' ? '请填写密码' : '密码至少需要 8 个字符'); return; }
    if (mode !== 'login' && password !== repeat) { setInvalid('repeat'); setError('两次输入的密码不一致，请重新确认'); return; }
    setBusy(true);
    try {
      let user: DesktopUser | undefined;
      if (mode === 'setup' || mode === 'login' || mode === 'create') user = await desktopCall<DesktopUser>({ setup: 'setup_admin', login: 'login', create: 'create_user' }[mode], { name, password });
      else if (mode === 'change') await desktopCall('change_password', { current, next: password });
      else await desktopCall('update_user', { id: target!.id, password });
      setPassword(''); setRepeat(''); setCurrent(''); setName(''); onDone(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作未完成，请重试');
      if (mode === 'login') { setPassword(''); setInvalid('password'); }
    } finally { setBusy(false); }
  }
  return <form className="desktop-form" noValidate onSubmit={(event) => void submit(event)} ref={formRef} onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }}>
    {needsName && <div className="desktop-field"><label htmlFor={nameId}>账号</label><input id={nameId} autoComplete="username" value={name} maxLength={32} aria-invalid={invalid === 'name'} aria-describedby={messageId} onChange={(event) => setName(event.target.value)}/></div>}
    {mode === 'change' && <PasswordField label="当前密码" value={current} onChange={setCurrent} current invalid={invalid === 'current'} hint={messageId}/>}
    <PasswordField label={mode === 'login' || mode === 'setup' || mode === 'create' ? '密码' : '新密码'} value={password} onChange={setPassword} current={mode === 'login'} invalid={invalid === 'password'} hint={messageId}/>
    {mode !== 'login' && <PasswordField label="确认密码" value={repeat} onChange={setRepeat} invalid={invalid === 'repeat'} hint={messageId}/>}
    <p className="desktop-form-message" id={messageId} role={error ? 'alert' : undefined}>{error || (mode === 'login' ? '账号仅在本机有效，忘记密码请联系本机管理员。' : '密码至少 8 个字符，可以粘贴或使用密码管理器。')}</p>
    <button type="submit" disabled={busy} aria-busy={busy}>{busy ? '正在处理…' : labels[mode]}</button>
  </form>;
}

function AccountPanel({ user, onBack, onLogout }: { user: DesktopUser; onBack: () => void; onLogout: () => Promise<void> }) {
  const [users, setUsers] = useState<DesktopUser[]>([]);
  const [action, setAction] = useState<'create' | 'change' | 'reset'>('change');
  const [target, setTarget] = useState<DesktopUser>();
  const [confirmTarget, setConfirmTarget] = useState<DesktopUser>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  async function refresh() {
    if (user.role !== 'admin') return;
    setLoadError('');
    try { setUsers(await desktopCall<DesktopUser[]>('list_users')); }
    catch (error) { setLoadError(error instanceof Error ? error.message : '账号读取失败'); }
  }
  useEffect(() => { void refresh(); }, []);
  async function toggle() {
    if (!confirmTarget || busy) return; setBusy(true); setMessage('');
    try {
      await desktopCall('update_user', { id: confirmTarget.id, enabled: !confirmTarget.enabled });
      setMessage(`已${confirmTarget.enabled ? '停用' : '恢复'}账号 ${confirmTarget.name}`); setConfirmTarget(undefined); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : '账号更新失败'); }
    finally { setBusy(false); }
  }
  return <main className="desktop-account-page"><div className="desktop-account-heading"><div><p>本机账号</p><h1>{user.role === 'admin' ? '账号管理' : '我的账号'}</h1><span>{user.name} · {user.role === 'admin' ? '管理员' : '普通用户'}</span></div><button type="button" className="desktop-secondary" onClick={onBack}>返回制作台</button></div>
    <p className="desktop-account-note">账号只保存在当前 Windows 用户的本机数据目录。制作文件通过 .skuwork 交接，账号不会随文件传递。</p>
    <div className="desktop-account-grid">
      {user.role === 'admin' && <section className="desktop-account-card"><h2>用户列表</h2><p>普通用户可使用全部制作功能，不能管理账号。</p>{loadError ? <div role="alert"><p>{loadError}</p><button type="button" onClick={() => void refresh()}>重试读取</button></div> : <ul className="desktop-user-list">{users.map((item) => <li key={item.id}><div><strong>{item.name}</strong><span>{item.role === 'admin' ? '管理员' : item.enabled ? '普通用户 · 可登录' : '普通用户 · 已停用'}</span></div>{item.role === 'user' && <div className="desktop-user-actions"><button type="button" className="desktop-secondary" onClick={() => { setTarget(item); setAction('reset'); setMessage(''); }}>重置密码</button><button type="button" className="desktop-secondary" onClick={() => setConfirmTarget(item)}>{item.enabled ? '停用' : '恢复'}</button></div>}</li>)}</ul>}
        {confirmTarget && <div className="desktop-confirm" role="group" aria-label="确认账号状态变更"><p>{confirmTarget.enabled ? `停用“${confirmTarget.name}”后，该账号将不能在本机登录。已有制作文件会保留。` : `恢复“${confirmTarget.name}”后，该账号可重新登录。`}</p><div><button type="button" className="desktop-secondary" disabled={busy} onClick={() => setConfirmTarget(undefined)}>取消</button><button type="button" disabled={busy} onClick={() => void toggle()}>确认{confirmTarget.enabled ? '停用' : '恢复'}</button></div></div>}
        <button type="button" onClick={() => { setAction('create'); setTarget(undefined); setMessage(''); }}>新建普通用户</button></section>}
      <section className="desktop-account-card"><div className="desktop-card-heading"><h2>{action === 'create' ? '新建普通用户' : action === 'reset' ? `重置 ${target?.name} 的密码` : '修改我的密码'}</h2>{action !== 'change' && <button type="button" className="desktop-secondary" onClick={() => setAction('change')}>取消</button>}</div><AccountForm key={`${action}:${target?.id ?? ''}`} mode={action} target={target} onDone={() => { setMessage(action === 'create' ? '普通用户已创建' : '密码已更新'); setAction('change'); void refresh(); }}/></section>
    </div><p className="desktop-status" role="status">{message}</p><button type="button" className="desktop-secondary desktop-logout" onClick={() => void onLogout().catch((error) => setMessage(error.message))}>退出当前账号</button>
  </main>;
}

export default function DesktopGate({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<boolean>();
  const [user, setUser] = useState<DesktopUser>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const closing = useRef(false);
  async function load() {
    setError('');
    try {
      const [needsSetup, currentUser] = await Promise.all([desktopCall<boolean>('setup_required'), desktopCall<DesktopUser | null>('current_user')]);
      setSetup(needsSetup);
      if (currentUser) enter(currentUser);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : '本机账号读取失败'); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let disposed = false; let cleanup: (() => void) | undefined;
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const unlisten = await win.onCloseRequested(async (event) => {
        event.preventDefault(); if (closing.current) return; closing.current = true;
        try { await flushDesktopEditor(); await win.destroy(); }
        catch (reason) { setError(`关闭前保存失败，现场已保留：${reason instanceof Error ? reason.message : '请手动保存后重试'}`); }
        finally { closing.current = false; }
      });
      if (disposed) unlisten(); else cleanup = unlisten;
    }).catch(() => setError('关闭保护未能启动，请先保存源文件再关闭软件'));
    return () => { disposed = true; cleanup?.(); };
  }, []);
  function enter(next?: DesktopUser) { if (!next) return; setDesktopUser(next); setUser(next); setSetup(false); setError(''); }
  async function exit() {
    await flushDesktopEditor(); await desktopCall('logout'); setDesktopUser(null); setUser(undefined); setAccountOpen(false);
  }
  if (user) return <AccountContext.Provider value={{ user, open: () => setAccountOpen(true) }}>{error && <div className="desktop-close-error" role="alert">{error}<button type="button" onClick={() => setError('')}>知道了</button></div>}{accountOpen ? <AccountPanel user={user} onBack={() => setAccountOpen(false)} onLogout={exit}/> : children}</AccountContext.Provider>;
  return <main className="desktop-login"><section className="desktop-login-card"><div className="desktop-login-brand"><AppMark/><span>SKU 制作台<small>本地测试版 · 0.1.3</small></span></div><h1>{setup === undefined ? '正在读取本机账号' : setup ? '设置本机管理员' : '欢迎回来'}</h1><p>{setup ? '首次使用，为这台电脑设置管理员账号。之后可在账号管理中创建普通用户。' : '登录后继续制作，图片与源文件保存在本机。'}</p>{error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => void load()}>重新读取</button></div> : setup === undefined ? <p role="status">正在准备…</p> : <AccountForm key={String(setup)} mode={setup ? 'setup' : 'login'} onDone={enter}/>}<p className="desktop-login-footnote">本机独立管理 · 日常使用无需联网</p></section></main>;
}
