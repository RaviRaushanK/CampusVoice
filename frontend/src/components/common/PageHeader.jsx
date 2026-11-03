const PageHeader = ({ title, description, action, eyebrow }) => {
  return (
    <div className="page-header">
      <div className="cv-break">
        {eyebrow && <p className="cv-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </div>
  );
};

export default PageHeader;
