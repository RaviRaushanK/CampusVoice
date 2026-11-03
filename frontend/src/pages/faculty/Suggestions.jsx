import PageHeader from "../../components/common/PageHeader";
import MessageInbox from "../../components/messages/MessageInbox";
import { getReceivedSuggestions } from "../../services/suggestionService";
const Suggestions = () => <div className="message-page sessions-page"><PageHeader title="Private Suggestions" description="Private messages sent only to you. Anonymous senders remain hidden." /><MessageInbox loader={getReceivedSuggestions} title="Received Suggestions" /></div>;
export default Suggestions;
