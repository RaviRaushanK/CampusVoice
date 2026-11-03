const academicPaths = { principal: { Departments: "/departments", HODs: "/hods" }, hod: { Faculty: "/faculty", Students: "/students", Subjects: "/subjects", Classes: "/classes", "Faculty Assignments": "/faculty-assignments" }, faculty: { "My Assignments": "/my-assignments", "My Sessions": "/my-sessions" }, student: { "Feedback Sessions": "/feedback-sessions" } };
const navigation = (role, items) => [
  { label: "Dashboard", icon: "bi-speedometer2", path: `/${role}/dashboard` },
  ...items.map(([label, icon]) => ["Profile", "Notifications"].includes(label)
    ? { label, icon, path: label === "Profile" ? "/profile" : "/notifications" }
    : academicPaths[role]?.[label] ? { label, icon, path: academicPaths[role][label] } : { label, icon, disabled: true }),
  { label: "Change password", icon: "bi-key", path: "/change-password" },
  { label: "Logout", icon: "bi-box-arrow-right", action: "logout" },
];
export const principalNavItems = navigation("principal", [
  ["Departments", "bi-building"], ["HODs", "bi-person-badge"],
  ["Complaints", "bi-chat-left-text"], ["Analytics", "bi-bar-chart"],
  ["Notifications", "bi-bell"], ["Profile", "bi-person-circle"],
]);
export const hodNavItems = navigation("hod", [
  ["Faculty", "bi-people"], ["Students", "bi-mortarboard"],
  ["Subjects", "bi-book"], ["Classes", "bi-easel"],
  ["Faculty Assignments", "bi-diagram-3"], ["Academic Feedback", "bi-clipboard-check"],
  ["Complaints", "bi-chat-left-text"], ["Analytics", "bi-bar-chart"],
  ["Notifications", "bi-bell"], ["Profile", "bi-person-circle"],
]);
export const facultyNavItems = navigation("faculty", [
  ["My Assignments", "bi-book"], ["My Classes", "bi-easel"],
  ["My Sessions", "bi-calendar-check"], ["General Feedback", "bi-clipboard-check"],
  ["Suggestions", "bi-lightbulb"], ["Issues", "bi-exclamation-circle"],
  ["Analytics", "bi-bar-chart"], ["Notifications", "bi-bell"], ["Profile", "bi-person-circle"],
]);
export const studentNavItems = navigation("student", [
  ["Feedback Sessions", "bi-calendar-check"], ["Give Feedback", "bi-pencil-square"],
  ["Suggestions", "bi-lightbulb"], ["Raise Complaint", "bi-plus-circle"],
  ["My Complaints", "bi-chat-left-text"], ["Notifications", "bi-bell"], ["Profile", "bi-person-circle"],
]);
