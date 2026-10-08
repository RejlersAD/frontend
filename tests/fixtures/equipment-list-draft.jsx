import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import EquipmentList from '../../src/pages/Engineering/Process/EquipmentList';
import '../../src/index.css';

createRoot(document.getElementById('equipment-list-test')).render(
  <BrowserRouter><EquipmentList /></BrowserRouter>,
);
