const LoadingSpinner = ({ label = "Loading content" }) => {
  return (
    <span className="loading-state" role="status" aria-live="polite">
      <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
      <span>{label}</span>
    </span>
  );
};

export default LoadingSpinner;
