import { createRoot } from 'react-dom/client';
import App from './App';
import { isDesktop } from './desktop/runtime';
import DesktopGate from './desktop/DesktopGate';
import './styles.css';
import './ui-b.css';
import './ui-moonstone.css';
createRoot(document.getElementById('root')!).render(isDesktop() ? <DesktopGate><App /></DesktopGate> : <App />);
