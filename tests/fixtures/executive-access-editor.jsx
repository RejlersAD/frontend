import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import RoleAccessEditor from '../../src/pages/Admin/RoleAccessEditor';
import UserPermissionEditor from '../../src/pages/Admin/UserPermissionEditor';
import ExecutiveTabAssignment from '../../src/pages/Admin/ExecutiveTabAssignment';
import '../../src/pages/Admin/RoleManagement.css';

const modules = [{ id: 'executive', code: 'executive_dashboard', name: 'Executive overview' }];
const groups = [{ id: 'workspace', label: 'Workspace', moduleCodes: ['executive_dashboard'] }];
const role = { id: 'test-role', name: 'Test reader', code: 'test-reader', modules, permissions: [{ id: 'read' }], user_count: 1 };
const user = { id: 'test-user', user: { email: 'reader@example.test' } };
const noop = () => {};
function Fixture() {
  const [tab, setTab] = useState('modules');
  if (new URLSearchParams(location.search).has('assign')) return <div className="roles-access"><div className="ra-workspace"><ExecutiveTabAssignment canAssign /></div></div>;
  return new URLSearchParams(location.search).has('user')
    ? <UserPermissionEditor user={user} modules={modules} groups={groups} onClose={noop} />
    : <RoleAccessEditor role={role} modules={modules} groups={groups} users={[]} isSuperAdmin tab={tab} setTab={setTab} onSaved={noop} onDirtyChange={noop} onDelete={noop} onReload={noop} />;
}
createRoot(document.getElementById('root')).render(<Fixture />);
