const { provisionBusiness } = require('../services/provisionOrchestrator');
const { handleError, OperisError } = require('../utils/errorHandler');
const { requireFields } = require('../utils/validation');

// POST /onboarding/provision
async function provision(req, res) {
  try {
    requireFields(req.body, ['phoneNumber']);

    // SECURITY: businessId sourced from verified session, not client input.
    // The body's businessId (if provided) must match the authenticated user's
    // business — otherwise an authenticated owner could re-provision someone
    // else's business and bind their Vapi agent / phone to it.
    if (req.body.businessId && req.body.businessId !== req.business_id) {
      throw new OperisError('Business not found', 'BUSINESS_NOT_FOUND', 404);
    }
    const businessId = req.business_id;
    const { phoneNumber } = req.body;

    const result = await provisionBusiness({ businessId, phoneNumber });

    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { provision };
