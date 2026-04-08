const { provisionBusiness } = require('../services/provisionOrchestrator');
const { handleError } = require('../utils/errorHandler');
const { requireFields } = require('../utils/validation');

// POST /onboarding/provision
async function provision(req, res) {
  try {
    requireFields(req.body, ['businessId', 'phoneNumber']);

    const { businessId, phoneNumber } = req.body;

    const result = await provisionBusiness({ businessId, phoneNumber });

    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { provision };
