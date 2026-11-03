const ACADEMIC_TYPES = Object.freeze(["DEPARTMENT", "HOD", "FACULTY", "STUDENT", "SUBJECT", "CLASS", "FACULTY_ASSIGNMENT"]);
const AUTH_ACTIONS = Object.freeze(["AUTH_LOGIN_SUCCESS", "AUTH_LOGIN_FAILURE", "AUTH_LOGOUT", "PASSWORD_CHANGED"]);
const COMPLAINT_ACTIONS = Object.freeze({ acknowledge: "COMPLAINT_STATUS_CHANGED", start: "COMPLAINT_STATUS_CHANGED", "escalation-request": "COMPLAINT_ESCALATION_REQUESTED", escalate: "COMPLAINT_ESCALATED", priority: "COMPLAINT_PRIORITY_CHANGED", resolve: "COMPLAINT_RESOLVED", close: "COMPLAINT_CLOSED" });
const PUBLIC_ACTIONS = Object.freeze([...AUTH_ACTIONS, ...ACADEMIC_TYPES.flatMap(type => ["CREATED", "UPDATED", "STATUS_CHANGED"].map(verb => `${type}_${verb}`))]);
const ACTIONS = Object.freeze([...new Set([...PUBLIC_ACTIONS, "COMPLAINT_CREATED", ...Object.values(COMPLAINT_ACTIONS)])]);
const PUBLIC_RESOURCES = Object.freeze(["AUTH", ...ACADEMIC_TYPES]);
const SAFE_FIELDS = Object.freeze(["name", "code", "description", "isActive", "departmentId", "semester", "section", "batch", "academicYear", "facultyId", "subjectId", "classGroupId"]);
module.exports = { ACADEMIC_TYPES, AUTH_ACTIONS, COMPLAINT_ACTIONS, PUBLIC_ACTIONS, ACTIONS, PUBLIC_RESOURCES, SAFE_FIELDS };
