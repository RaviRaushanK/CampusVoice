const AlertMessage = ({ type = "info", message }) => {
  if (!message) {
    return null;
  }

  return (
    <div className={`alert alert-${type} d-flex align-items-start gap-2`} role="alert">
      <i className={`bi ${{ success: "bi-check-circle", danger: "bi-exclamation-circle", warning: "bi-exclamation-triangle" }[type] || "bi-info-circle"} mt-1`} aria-hidden="true"></i>
      <span>{message}</span>
    </div>
  );
};

export default AlertMessage;
