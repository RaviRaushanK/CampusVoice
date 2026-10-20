module.exports = (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code });
