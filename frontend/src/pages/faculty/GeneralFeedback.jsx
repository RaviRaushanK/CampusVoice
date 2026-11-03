import PageHeader from "../../components/common/PageHeader";
import MessageInbox from "../../components/messages/MessageInbox";
import { getReceivedFeedback } from "../../services/generalFeedbackService";
const GeneralFeedback = () => <div className="message-page sessions-page"><PageHeader title="General Feedback" description="Feedback directed to you, with student identity shown only for Named submissions." /><MessageInbox feedback loader={getReceivedFeedback} title="Received Feedback" /></div>;
export default GeneralFeedback;
