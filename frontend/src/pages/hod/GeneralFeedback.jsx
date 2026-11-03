import PageHeader from "../../components/common/PageHeader";
import MessageInbox from "../../components/messages/MessageInbox";
import { getDepartmentFeedback } from "../../services/generalFeedbackService";
const GeneralFeedback = () => <div className="message-page sessions-page"><PageHeader title="Department General Feedback" description="Feedback for Faculty in your Department. Anonymous student identities remain hidden." /><MessageInbox feedback department loader={getDepartmentFeedback} title="Department Feedback" /></div>;
export default GeneralFeedback;
