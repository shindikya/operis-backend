const supabase = require('../config/supabase');
const { provisionBusiness } = require('../services/provisionOrchestrator');
const { handleError, OperisError } = require('../utils/errorHandler');
const { requireFields, validatePhone } = require('../utils/validation');

// POST /provision
// Accepts { businessName, ownerPhone, language }
// Creates the business row, then provisions Vapi agent + phone number
async function provisionNew(req, res) {
  try {
    requireFields(req.body, ['businessName', 'ownerPhone']);

    const { businessName, ownerPhone, language = 'th' } = req.body;
    validatePhone(ownerPhone);

    // 1. Create business row
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .insert({
        name:          businessName,
        owner_name:    businessName,
        phone:         ownerPhone,
        timezone:      'Asia/Bangkok',
        profession:    'service',
        slot_duration_min: 30,
        buffer_min:    0,
        onboarding_complete: false
      })
      .select('id')
      .single();

    if (bizErr) throw new OperisError(bizErr.message, 'DB_ERROR', 500);

    // 2. Provision Vapi agent + phone_numbers row
    const phoneNumber = ownerPhone;
    // TODO: replace ownerPhone with an allocated Twilio number from the number pool before going to production.

    const result = await provisionBusiness({
      businessId:  business.id,
      phoneNumber,
      language
    });

    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = { provisionNew };
