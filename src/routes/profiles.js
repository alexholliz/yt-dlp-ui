const { Router } = require('express');
const asyncHandler = require('../middleware/async-handler');
const logger = require('../logger');

/**
 * @param {{ db: import('../database') }} services
 */
module.exports = function profilesRouter({ db }) {
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    res.json(db.getAllProfiles());
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const profile = db.getProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { name, output_template, format_selection, merge_output_format, additional_args, verbose, filename_format } = req.body;
    const id = db.addProfile({ name, output_template, format_selection, merge_output_format, additional_args, verbose, filename_format });
    res.json({ id, success: true });
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const { name, output_template, format_selection, merge_output_format, additional_args, verbose, filename_format } = req.body;
    db.updateProfile(req.params.id, { name, output_template, format_selection, merge_output_format, additional_args, verbose, filename_format });
    res.json({ success: true });
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    db.deleteProfile(req.params.id);
    res.json({ success: true });
  }));

  return router;
};
