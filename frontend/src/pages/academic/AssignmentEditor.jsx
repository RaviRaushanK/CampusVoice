import { useState } from "react";
import { AcademicForm, SelectField, StatusField } from "../../components/academic/AcademicFields";
import RecordSelect from "../../components/academic/RecordSelect";
import useAcademicOptions from "../../components/academic/useAcademicOptions";
import AlertMessage from "../../components/common/AlertMessage";
const AssignmentEditor = ({ record, onSave, onCancel }) => {
  const [values, setValues] = useState(record ? { isActive: record.isActive } : { facultyId: "", subjectId: "", classGroupId: "", academicYear: "", isActive: true });
  const set = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  const options = useAcademicOptions("classes", "active", !record);
  return <AcademicForm title={record ? "Edit Assignment" : "Add Assignment"} values={values} onSave={onSave} onCancel={onCancel}>
    {record ? <p className="col-12">{record.faculty?.name} — {record.subject?.code} — Semester {record.classGroup?.semester} {record.classGroup?.section} — {record.academicYear}. Teaching relationships are retained for history; create a new assignment to change them.</p> : <>
      <RecordSelect label="Faculty" resource="faculty" value={values.facultyId} onChange={value => set("facultyId", value)} describe={faculty => `${faculty.name} (${faculty.userCode})`} />
      <RecordSelect label="Subject" resource="subjects" value={values.subjectId} onChange={value => set("subjectId", value)} describe={subject => `${subject.code} — ${subject.name} (Semester ${subject.semester})`} />
      <SelectField label="Academic year" name="academicYear" value={values.academicYear} required disabled={options.loading} onChange={event => setValues(previous => ({ ...previous, academicYear: event.target.value, classGroupId: "" }))}>
        <option value="">{options.loading ? "Loading academic years..." : "Choose academic year"}</option>
        {options.academicYears.map(year => <option key={year} value={year}>{year}</option>)}
      </SelectField>
      <RecordSelect key={values.academicYear} label="Class group" resource="classes" value={values.classGroupId} academicYear={values.academicYear} disabled={!values.academicYear} onChange={value => set("classGroupId", value)} describe={group => `Semester ${group.semester} / ${group.section || "No section"} / ${group.academicYear}`} />
      <div className="col-12"><AlertMessage type="danger" message={options.error} />
        {options.error && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={options.refresh}>Retry academic years</button>}
        {!options.loading && !options.error && !options.academicYears.length && <p className="form-text">Create an active class group with its academic year in Classes first.</p>}
        <p className="form-text">Choose an academic year first. Class groups are limited to that year.</p>
      </div>
    </>}
    <StatusField value={values.isActive} onChange={value => set("isActive", value)} />
  </AcademicForm>;
};
export default AssignmentEditor;
