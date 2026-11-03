export default function AuthIntro({ password = false }) {
  return <aside className="auth-intro" aria-label="About CampusVoice">
    <div className="auth-intro-brand"><span className="brand-mark" aria-hidden="true">CV</span><span>CampusVoice<small>COLLEGE COMMUNICATION PLATFORM</small></span></div>
    <div className="auth-intro-content"><p className="auth-kicker">A connected campus starts here</p><h2>{password ? "A fresh start.\nA safer account." : "Your feedback.\nA better campus."}</h2><p className="auth-intro-copy">One thoughtful space for academic feedback, private suggestions and concerns that deserve to be heard.</p>
      <div className="auth-features">{[["bi-chat-square-text", "Share your perspective", "Feedback that supports better learning."], ["bi-shield-check", "Know who can see it", "Clear privacy choices for every submission."], ["bi-diagram-3", "Follow the progress", "Concerns reach the responsible authority."]].map(([icon, title, description]) => <div key={title}><i className={`bi ${icon}`} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span></div>)}</div>
    </div>
    <p className="auth-intro-footer"><i className="bi bi-mortarboard me-2" aria-hidden="true" />Built around your college community.</p>
  </aside>;
}
