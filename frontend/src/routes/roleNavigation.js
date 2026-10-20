const navigation = (role, items) => [
  { label: "Dashboard", icon: "bi-speedometer2", path: `/${role}/dashboard` },
  ...items.map(([label, icon]) => ({ label, icon, disabled: true })),
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
  ["My Subjects", "bi-book"], ["My Classes", "bi-easel"],
  ["Feedback Sessions", "bi-calendar-check"], ["General Feedback", "bi-clipboard-check"],
  ["Suggestions", "bi-lightbulb"], ["Issues", "bi-exclamation-circle"],
  ["Analytics", "bi-bar-chart"], ["Notifications", "bi-bell"], ["Profile", "bi-person-circle"],
]);
export const studentNavItems = navigation("student", [
  ["Feedback Sessions", "bi-calendar-check"], ["Give Feedback", "bi-pencil-square"],
  ["Suggestions", "bi-lightbulb"], ["Raise Complaint", "bi-plus-circle"],
  ["My Complaints", "bi-chat-left-text"], ["Notifications", "bi-bell"], ["Profile", "bi-person-circle"],
]);
