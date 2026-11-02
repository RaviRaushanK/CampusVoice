import { useState } from "react";
import { AcademicForm, TextField, SemesterField, StatusField } from "../../components/academic/AcademicFields";
export const SubjectEditor = ({ record, onSave, onCancel }) => {
  const [values, setValues] = useState({ name: record?.name || "", code: record?.code || "", semester: record?.semester || 1, isActive: record?.isActive ?? true });
  const set = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  return <AcademicForm title={record ? "Edit Subject" : "Add Subject"} values={values} onSave={onSave} onCancel={onCancel}>
    <TextField label="Subject name" value={values.name} required maxLength={200} onChange={event => set("name", event.target.value)} />
    <TextField label="Subject code" value={values.code} required maxLength={30} onChange={event => set("code", event.target.value)} />
    <SemesterField value={values.semester} onChange={value => set("semester", value)} /><StatusField value={values.isActive} onChange={value => set("isActive", value)} />
  </AcademicForm>;
};
export const ClassEditor = ({ record, onSave, onCancel }) => {
  const [values, setValues] = useState({ semester: record?.semester || 1, section: record?.section || "", academicYear: record?.academicYear || "", batch: record?.batch || "", isActive: record?.isActive ?? true });
  const set = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  return <AcademicForm title={record ? "Edit Class Group" : "Add Class Group"} values={values} onSave={onSave} onCancel={onCancel}>
    <SemesterField value={values.semester} onChange={value => set("semester", value)} />
    <TextField label="Section" value={values.section} maxLength={10} onChange={event => set("section", event.target.value)} />
    <TextField label="Academic year" value={values.academicYear} required pattern="20[0-9]{2}-20[0-9]{2}" placeholder="2026-2027" onChange={event => set("academicYear", event.target.value)} />
    <TextField label="Admission batch" value={values.batch} pattern="20[0-9]{2}-20[0-9]{2}" placeholder="2025-2027" onChange={event => set("batch", event.target.value)} />
    <StatusField value={values.isActive} onChange={value => set("isActive", value)} />
  </AcademicForm>;
};
