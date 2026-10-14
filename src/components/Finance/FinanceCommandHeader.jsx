import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Bars3Icon, ChevronDoubleLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import NotificationBell from '../notifications/NotificationBell';
import { USER_DISPLAY_CONFIG } from '../../config/userDisplay.config';
import './FinanceCommandCenter.css';

export default function FinanceCommandHeader({ sidebarOpen, setSidebarOpen, profilePhotoUrl }) {
  const user = useSelector(state => state.auth.user);
  const name = USER_DISPLAY_CONFIG.formatting.getDisplayName(user);
  return <header className="ar-topbar"><nav aria-label="Finance navigation"><button type="button" className="ar-topbar-sidebar" aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'} aria-controls="application-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><Bars3Icon /></button><Link to="/dashboard" className="ar-topbar-back" aria-label="Back to dashboard"><ChevronDoubleLeftIcon /></Link><span>Finance / <strong>Receivables</strong></span></nav><div className="ar-topbar-account"><div className="ar-topbar-notifications"><NotificationBell /></div><details className="ar-account-menu"><summary aria-label={`Account menu for ${name}`}><span className="ar-avatar">{profilePhotoUrl ? <img src={profilePhotoUrl} alt="" /> : USER_DISPLAY_CONFIG.formatting.getUserInitials(user)}</span><span>{name}</span><ChevronDownIcon /></summary><div><Link to="/profile">My profile</Link><Link to="/dashboard">Workspace dashboard</Link></div></details></div></header>;
}
FinanceCommandHeader.propTypes = { sidebarOpen: PropTypes.bool, setSidebarOpen: PropTypes.func.isRequired, profilePhotoUrl: PropTypes.string };
