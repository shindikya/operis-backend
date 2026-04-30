require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./backend/config/supabase');
const bookingRoutes = require('./backend/routes/booking');
const availabilityRoutes = require('./backend/routes/availability');
const callRoutes = require('./backend/routes/call');
const onboardingRoutes = require('./backend/routes/onboarding');
const provisionRoutes = require('./backend/routes/provision');
const demoRoutes = require('./backend/routes/demo');
const dashboardRoutes = require('./backend/routes/dashboard');
const callsApiRoutes = require('./backend/routes/calls');
const { startReminderCron } = require('./backend/services/reminderService');
const { startWebhookRetryCron } = require('./backend/services/webhookRetryService');
const { startBookingExpiryCron } = require('./backend/services/bookingExpiryService');

const app = express();
app.use(cors());
// Body limit guards against oversized-payload memory DoS. Vapi end-of-call
// reports including transcripts are typically <10KB; 64KB is a safe ceiling.
app.use(express.json({ limit: '64kb' }));

// Root
app.get('/', (req, res) => {
  res.send('Operis backend running');
});

// Health check — verifies DB connection
app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase
      .from('businesses')
      .select('count', { count: 'exact', head: true });

    if (error) throw error;

    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Routes
app.use('/booking', bookingRoutes);
app.use('/availability', availabilityRoutes);
app.use('/call', callRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/provision', provisionRoutes);
app.use('/demo', demoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/calls', callsApiRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderCron();
  startWebhookRetryCron();
  startBookingExpiryCron();
});
