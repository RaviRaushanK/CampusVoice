import { useState } from "react";
import { QUESTION_LABELS } from "./feedbackFields";
const QuestionBuilder = ({ questions, onChange }) => {
  const [type, setType] = useState("SINGLE_CHOICE");
  const edit = (index, fields) => onChange(questions.map((question, position) => position === index ? { ...question, ...fields } : question));
  const move = (index, delta) => { const next = [...questions]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next); };
  return <section aria-label="Question builder">
    <h3 className="h5">Questions ({questions.length}/50)</h3><p>Drafts can be saved without questions. Question order is saved as shown.</p>
    {questions.map((question, index) => <fieldset className="panel mb-3 question-card" key={question.key || question.id}>
      <legend className="h6">Question {index + 1} · {QUESTION_LABELS[question.type]}</legend>
      <label className="form-label" htmlFor={`prompt-${index}`}>Question {index + 1} prompt</label>
      <textarea id={`prompt-${index}`} className="form-control mb-3" maxLength={1000} rows={2} value={question.prompt} onChange={event => edit(index, { prompt: event.target.value })} />
      {question.options && <div className="mb-3">{question.options.map((option, position) => <div className="mb-2" key={position}>
        <label className="form-label" htmlFor={`option-${index}-${position}`}>Question {index + 1} option {position + 1}</label>
        <div className="option-controls"><input id={`option-${index}-${position}`} className="form-control" maxLength={200} value={option} onChange={event => edit(index, { options: question.options.map((value, optionIndex) => optionIndex === position ? event.target.value : value) })} /><button type="button" className="btn btn-outline-danger" aria-label={`Remove question ${index + 1} option ${position + 1}`} disabled={question.options.length <= 2} onClick={() => edit(index, { options: question.options.filter((_, optionIndex) => optionIndex !== position) })}>Remove option</button></div>
      </div>)}<button type="button" className="btn btn-outline-secondary" disabled={question.options.length >= 20} onClick={() => edit(index, { options: [...question.options, ""] })}>Add Option to question {index + 1}</button></div>}
      {question.type === "RATING" && <p>Scale: 1 to 5</p>}
      <label className="d-flex gap-2 mb-3"><input type="checkbox" checked={question.required} onChange={event => edit(index, { required: event.target.checked })} />Question {index + 1} required</label>
      <div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-outline-secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move question ${index + 1} up`}>Move Up</button><button type="button" className="btn btn-outline-secondary" disabled={index === questions.length - 1} onClick={() => move(index, 1)} aria-label={`Move question ${index + 1} down`}>Move Down</button><button type="button" className="btn btn-outline-danger" aria-label={`Remove question ${index + 1}`} onClick={() => onChange(questions.filter((_, position) => position !== index))}>Remove Question</button></div>
    </fieldset>)}
    <label className="form-label" htmlFor="new-question-type">New question type</label>
    <select id="new-question-type" className="form-select mb-2" value={type} onChange={event => setType(event.target.value)}>{Object.entries(QUESTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <button type="button" className="btn btn-outline-primary mb-3" disabled={questions.length >= 50} onClick={() => onChange([...questions, { key: crypto.randomUUID(), type, prompt: "", required: true, ...(["SINGLE_CHOICE", "MULTI_SELECT"].includes(type) ? { options: ["", ""] } : {}), ...(type === "RATING" ? { ratingMin: 1, ratingMax: 5 } : {}) }])}>Add Question</button>
  </section>;
};
export default QuestionBuilder;
