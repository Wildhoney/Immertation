import { createRoot } from 'react-dom/client';
import People from './components/people';

const root = createRoot(document.getElementById('root')!);
root.render(<People />);
