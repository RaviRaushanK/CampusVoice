import { useState } from "react";
import { AcademicForm, TextField, SemesterField, StatusField } from "../../components/academic/AcademicFields";
import RecordSelect from "../../components/academic/RecordSelect";
const AccountEditor = ({ record, onSave, onCancel, accountType }) => {
  const isStudent = accountType === "Student";
  const [values, setValues] = useState({ name: record?.name || "", email: record?.email || "", isActive: record?.isActive ?? true,
    ...(!record ? { userCode: "", initialPassword: "" } : {}),
    ...(accountType === "HOD" ? { departmentId: record?.departmentId || "" } : {}),
    ...(isStudent ? { semester: record?.semester || 1, section: record?.section || "", batch: record?.batch || "" } : {}),
  });
  const set = (key, value) => setValues(previous => ({ ...previous, [key]: value }));
  return <AcademicForm title={`${record ? "Edit" : "Add"} ${accountType}`} values={values} onValuesChange={setValues} onSave={onSave} onCancel={onCancel}>
    <TextField label="Name" name="name" value={values.name} onChange={event => set("name", event.target.value)} required minLength={2} maxLength={120} autoComplete="name" />
    <TextField label="Email" name="email" type="email" value={values.email} onChange={event => set("email", event.target.value)} autoComplete="email" />
    {!record && <><TextField label={isStudent ? "USN / User code" : "User code"} name="userCode" value={values.userCode} onChange={event => set("userCode", event.target.value)} required minLength={3} maxLength={50} autoComplete="off" />
      <TextField label="Temporary password" name="initialPassword" type="password" value={values.initialPassword} onChange={event => set("initialPassword", event.target.value)} required minLength={8} autoComplete="new-password" />
      <p className="col-12 text-muted small mb-0">The user must change this password on first login. Use at least 8 characters with uppercase, lowercase, a number and a special character.</p></>}
    {record && <p className="col-12 text-muted mb-0">{isStudent ? "USN" : "User code"}: {isStudent ? record.userCode.toUpperCase() : record.userCode}</p>}
    {accountType === "HOD" && <RecordSelect label="Department" name="departmentId" resource="departments" value={values.departmentId} currentLabel={record?.department?.name}
      onChange={value => set("departmentId", value)} describe={department => `${department.code} — ${department.name}`} />}
    {isStudent && <><SemesterField value={values.semester} onChange={value => set("semester", value)} />
      <TextField label="Section" value={values.section} maxLength={10} onChange={event => set("section", event.target.value)} />
      <TextField label="Admission batch" placeholder="2025-2027" value={values.batch} onChange={event => set("batch", event.target.value)} pattern="20[0-9]{2}-20[0-9]{2}" /></>}
    <StatusField value={values.isActive} onChange={value => set("isActive", value)} />
  </AcademicForm>;
};
export default AccountEditor;
