import { useState } from "react";
import { AcademicForm, TextField, StatusField } from "../../components/academic/AcademicFields";
const DepartmentEditor = ({ record, onSave, onCancel }) => {
  const [values, setValues] = useState({ name: record?.name || "", code: record?.code || "", description: record?.description || "", isActive: record?.isActive ?? true });
  const set = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  return <AcademicForm title={record ? "Edit Department" : "Add Department"} values={values} onSave={onSave} onCancel={onCancel}>
    <TextField label="Department name" value={values.name} onChange={event => set("name", event.target.value)} required minLength={2} maxLength={120} />
    <TextField label="Department code" value={values.code} onChange={event => set("code", event.target.value)} required maxLength={20} />
    <TextField label="Description" value={values.description} onChange={event => set("description", event.target.value)} maxLength={1000} wide />
    <StatusField value={values.isActive} onChange={value => set("isActive", value)} />
  </AcademicForm>;
};
export default DepartmentEditor;
