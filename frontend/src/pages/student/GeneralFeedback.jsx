import StudentMessagePage from "../../components/messages/StudentMessagePage";
import { getFeedbackOptions, submitGeneralFeedback, getMyFeedback } from "../../services/generalFeedbackService";
const GeneralFeedback = () => <StudentMessagePage feedback loadOptions={getFeedbackOptions} submitMessage={submitGeneralFeedback} loadHistory={getMyFeedback} />;
export default GeneralFeedback;
