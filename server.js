require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./backend/config/supabase');
const bookingRoutes = require('./backend/routes/booking');
const availabilityRoutes = require('./backend/routes/availability');
const callRoutes = require('./backend/routes/call');
const onboardingRoutes = require('./backend/routes/onboarding');
const demoRoutes = require('./backend/routes/demo');
const { startReminderCron } = require('./backend/services/reminderService');

const app = express();
app.use(cors());
app.use(express.json());

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
app.use('/demo', demoRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminderCron();
});
