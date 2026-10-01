import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import ExecutiveDashboard from '../../src/pages/Executive/ExecutiveDashboard';
import '../../src/index.css';

createRoot(document.getElementById('executive-pipeline-test')).render(<BrowserRouter><ExecutiveDashboard /></BrowserRouter>);
