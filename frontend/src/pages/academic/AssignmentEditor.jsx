import { useState } from "react";
import { AcademicForm, TextField, StatusField } from "../../components/academic/AcademicFields";
import RecordSelect from "../../components/academic/RecordSelect";
const AssignmentEditor = ({ record, onSave, onCancel }) => {
  const [values, setValues] = useState(record ? { isActive: record.isActive } : { facultyId: "", subjectId: "", classGroupId: "", academicYear: "", isActive: true });
  const set = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  return <AcademicForm title={record ? "Edit Assignment" : "Add Assignment"} values={values} onSave={onSave} onCancel={onCancel}>
    {record ? <p className="col-12">{record.faculty?.name} — {record.subject?.code} — Semester {record.classGroup?.semester} {record.classGroup?.section} — {record.academicYear}. Teaching relationships are retained for history; create a new assignment to change them.</p> : <>
      <RecordSelect label="Faculty" resource="faculty" value={values.facultyId} onChange={value => set("facultyId", value)} describe={faculty => `${faculty.name} (${faculty.userCode})`} />
      <RecordSelect label="Subject" resource="subjects" value={values.subjectId} onChange={value => set("subjectId", value)} describe={subject => `${subject.code} — ${subject.name} (Semester ${subject.semester})`} />
      <RecordSelect label="Class group" resource="classes" value={values.classGroupId} onChange={value => set("classGroupId", value)} describe={group => `Semester ${group.semester} / ${group.section || "No section"} / ${group.academicYear}`} />
      <TextField label="Academic year" value={values.academicYear} required pattern="20[0-9]{2}-20[0-9]{2}" placeholder="2026-2027" onChange={event => set("academicYear", event.target.value)} />
    </>}
    <StatusField value={values.isActive} onChange={value => set("isActive", value)} />
  </AcademicForm>;
};
export default AssignmentEditor;
