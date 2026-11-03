import "../../styles/notifications.css";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../../context/NotificationContext";
import { getNotifications } from "../../services/notificationService";
import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import AlertMessage from "../../components/common/AlertMessage";
import EmptyState from "../../components/common/EmptyState";
import NotificationItem from "../../components/notifications/NotificationItem";

const emptyStates = {
  all: ["No notifications yet.", "Updates related to your CampusVoice activity will appear here."],
  unread: ["You're all caught up.", "There are no unread notifications."],
  read: ["No read notifications yet.", "Notifications you have read will appear here."],
};
const Notifications = () => {
  const { unreadCount, countError, countLoading, refreshUnreadCount, markRead, markAllRead } = useNotifications();
  const [query, setQuery] = useState({ page: 1, status: "all" });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const pending = useRef(false);
  const active = useRef(true);
  const key = `${query.status}:${query.page}:${attempt}`;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    setLoading(true); setError("");
    refreshUnreadCount();
    getNotifications({ ...query, limit: 20 }, { signal: controller.signal }).then(response => {
      if (!current) return;
      const data = response?.data;
      if (!Array.isArray(data?.notifications) || !data.pagination) throw new Error("Unavailable notifications");
      if (query.page > Math.max(1, data.pagination.totalPages)) {
        setQuery(previous => ({ ...previous, page: Math.max(1, data.pagination.totalPages) })); return;
      }
      setResult({ key, data });
    }).catch(err => {
      if (current && err.name !== "AbortError") setError("Unable to load notifications. Please try again.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [query, attempt, key, refreshUnreadCount]);

  const updateReadState = async id => {
    if (pending.current || (!id && !(unreadCount > 0))) return;
    pending.current = true;
    setAction(id || "all"); setActionError(""); setSuccess("");
    try {
      if (id) await markRead(id); else await markAllRead();
      if (active.current) {
        setSuccess(id ? "Notification marked as read." : "All notifications marked as read.");
        setAttempt(value => value + 1);
      }
    } catch (err) {
      if (active.current && err.name !== "AbortError") setActionError(err.status === 403
        ? "Unable to update notifications. Refresh the page and try again."
        : "Unable to mark notifications as read. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setAction(null);
    }
  };
  const data = result?.key === key ? result.data : null;
  const busy = loading || (!data && !error);
  const pagination = data?.pagination;
  return <div className="notifications-page">
    <PageHeader title="Notifications" description="Stay updated with activity related to your CampusVoice account." />
    <div className="notification-toolbar d-flex flex-wrap justify-content-between gap-3 mb-3">
      <div className="d-flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
        {["all", "unread", "read"].map(status => <button key={status} type="button" className={`btn ${query.status === status ? "btn-primary" : "btn-outline-primary"}`}
          aria-pressed={query.status === status} onClick={() => { setQuery({ page: 1, status }); setActionError(""); setSuccess(""); }}>
          {status[0].toUpperCase() + status.slice(1)}
        </button>)}
      </div>
      <button type="button" className="btn btn-outline-secondary" disabled={Boolean(action) || !(unreadCount > 0)} onClick={() => updateReadState()}>
        {action === "all" ? <LoadingSpinner label="Marking all as read..." /> : "Mark all as read"}
      </button>
    </div>
    {countError && <><AlertMessage type="warning" message={countError} /><button type="button" className="btn btn-outline-secondary mb-3" disabled={countLoading} onClick={() => refreshUnreadCount()}>Retry unread count</button></>}
    <AlertMessage type="danger" message={actionError} />
    <AlertMessage type="success" message={success} />
    {error ? <><AlertMessage type="danger" message={error} /><button type="button" className="btn btn-outline-secondary" onClick={() => setAttempt(value => value + 1)}>Try again</button></>
      : busy ? <LoadingSpinner label="Loading notifications" />
        : data.notifications.length ? <ul className="notification-list">{data.notifications.map(notification => <NotificationItem key={notification.id} notification={notification}
          onMarkRead={updateReadState} pending={action === notification.id} disabled={Boolean(action)} />)}</ul>
          : <EmptyState title={emptyStates[query.status][0]} message={emptyStates[query.status][1]} icon="bi-bell" />}
    {pagination && <nav className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-3" aria-label="Notification pagination">
      <button type="button" className="btn btn-outline-secondary" disabled={busy || Boolean(action) || query.page <= 1 || !pagination.hasPreviousPage} onClick={() => setQuery(previous => ({ ...previous, page: previous.page - 1 }))}>Previous</button>
      <span className="small text-muted">{pagination.totalPages ? `Page ${query.page} of ${pagination.totalPages}` : "No pages to display"}</span>
      <button type="button" className="btn btn-outline-secondary" disabled={busy || Boolean(action) || !pagination.hasNextPage} onClick={() => setQuery(previous => ({ ...previous, page: previous.page + 1 }))}>Next</button>
    </nav>}
  </div>;
};

export default Notifications;
