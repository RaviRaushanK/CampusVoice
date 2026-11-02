import ManagementPage from "../../components/academic/ManagementPage";
import DepartmentEditor from "./DepartmentEditor";
import AccountEditor from "./AccountEditor";
import { SubjectEditor, ClassEditor } from "./CurriculumEditors";
import AssignmentEditor from "./AssignmentEditor";
const accountColumns = [
  { label: "Name", render: record => record.name }, { label: "User code", render: record => record.userCode }, { label: "Email", render: record => record.email },
];
const assignmentColumns = [
  { label: "Faculty", render: record => record.faculty?.name },
  { label: "Subject", render: record => record.subject ? `${record.subject.code} — ${record.subject.name}` : "Unavailable" },
  { label: "Class", render: record => record.classGroup ? `Semester ${record.classGroup.semester} / ${record.classGroup.section || "Not assigned"}` : "Unavailable" },
  { label: "Academic year", render: record => record.academicYear },
];
const HodEditor = props => <AccountEditor {...props} accountType="HOD" />;
const FacultyEditor = props => <AccountEditor {...props} accountType="Faculty" />;
const StudentEditor = props => <AccountEditor {...props} accountType="Student" />;
export const Departments = () => <ManagementPage title="Departments" singular="Department" resource="departments" Editor={DepartmentEditor} columns={[
  { label: "Code", render: record => record.code }, { label: "Department", render: record => record.name }, { label: "Description", render: record => record.description || "Not provided" },
]} />;
export const Hods = () => <ManagementPage title="HOD Management" singular="HOD" resource="hods" Editor={HodEditor} columns={[...accountColumns, { label: "Department", render: record => record.department?.code }]} />;
export const Faculty = () => <ManagementPage title="Faculty Management" singular="Faculty" resource="faculty" Editor={FacultyEditor} columns={accountColumns} />;
export const Students = () => <ManagementPage title="Student Management" singular="Student" resource="students" Editor={StudentEditor} semesterFilter sectionFilter columns={[
  { label: "USN", render: record => record.userCode.toUpperCase() }, { label: "Name", render: record => record.name }, { label: "Email", render: record => record.email }, { label: "Semester", render: record => record.semester }, { label: "Section", render: record => record.section || "Not assigned" }, { label: "Batch", render: record => record.batch || "Not provided" },
]} />;
export const Subjects = () => <ManagementPage title="Subjects" singular="Subject" resource="subjects" Editor={SubjectEditor} semesterFilter columns={[
  { label: "Code", render: record => record.code }, { label: "Subject", render: record => record.name }, { label: "Semester", render: record => record.semester },
]} />;
export const Classes = () => <ManagementPage title="Class Groups" singular="Class Group" resource="classes" Editor={ClassEditor} semesterFilter classFilters columns={[
  { label: "Semester", render: record => record.semester }, { label: "Section", render: record => record.section || "Not assigned" }, { label: "Academic year", render: record => record.academicYear }, { label: "Batch", render: record => record.batch || "Not provided" },
]} />;
export const FacultyAssignments = () => <ManagementPage title="Faculty Assignments" singular="Assignment" resource="faculty-assignments" Editor={AssignmentEditor} columns={assignmentColumns} searchable={false} yearFilter />;
export const MyAssignments = () => <ManagementPage title="My Teaching Assignments" resource="faculty-assignments/mine" readOnly columns={assignmentColumns} searchable={false} yearFilter />;
