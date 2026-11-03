import StudentMessagePage from "../../components/messages/StudentMessagePage";
import { getSuggestionFaculty, submitSuggestion, getSentSuggestions } from "../../services/suggestionService";
const Suggestions = () => <StudentMessagePage loadOptions={getSuggestionFaculty} submitMessage={submitSuggestion} loadHistory={getSentSuggestions} />;
export default Suggestions;
