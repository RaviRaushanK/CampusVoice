const service = require("../services/profileService");

const getProfile = (req, res) => res.json({ success: true, data: service.getProfile(req.user) });

const updateProfile = async (req, res, next) => {
  try { res.json({ success: true, data: await service.updateProfile(req.user, req.profileUpdate) }); }
  catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile };
