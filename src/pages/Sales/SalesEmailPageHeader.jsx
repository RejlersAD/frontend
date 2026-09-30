import PropTypes from "prop-types";

export default function SalesEmailPageHeader({ children }) {
  return <header className="sales-email-page-header">
    <h1>Email Intake</h1>
    {children}
  </header>;
}

SalesEmailPageHeader.propTypes = { children: PropTypes.node };
