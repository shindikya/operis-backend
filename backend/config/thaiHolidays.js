// Thai public holidays — official list per Bank of Thailand calendar.
// Used by:
//   - AI prompt: agent treats these as "closed by default" unless the
//     business has flagged the holiday as open in their hours_overrides.
//   - bookingController: blocks booking attempts on these dates.
//
// Format: ISO date strings "YYYY-MM-DD" in Asia/Bangkok local time.
// Update this list yearly. When a holiday falls on a weekend, the
// substitute weekday is included separately.

const THAI_HOLIDAYS_2026 = [
  { date: '2026-01-01', name_th: 'วันขึ้นปีใหม่',                name_en: "New Year's Day" },
  { date: '2026-01-02', name_th: 'วันหยุดชดเชยปีใหม่',           name_en: "New Year's Day (substitute)" },
  { date: '2026-02-15', name_th: 'วันมาฆบูชา',                   name_en: 'Makha Bucha Day' },
  { date: '2026-02-16', name_th: 'วันหยุดชดเชยมาฆบูชา',          name_en: 'Makha Bucha (substitute)' },
  { date: '2026-04-06', name_th: 'วันจักรี',                     name_en: 'Chakri Memorial Day' },
  { date: '2026-04-13', name_th: 'วันสงกรานต์',                  name_en: 'Songkran Day' },
  { date: '2026-04-14', name_th: 'วันสงกรานต์',                  name_en: 'Songkran Day' },
  { date: '2026-04-15', name_th: 'วันสงกรานต์',                  name_en: 'Songkran Day' },
  { date: '2026-05-01', name_th: 'วันแรงงานแห่งชาติ',            name_en: 'Labour Day' },
  { date: '2026-05-04', name_th: 'วันฉัตรมงคล',                  name_en: 'Coronation Day' },
  { date: '2026-05-31', name_th: 'วันวิสาขบูชา',                 name_en: 'Visakha Bucha Day' },
  { date: '2026-06-01', name_th: 'วันหยุดชดเชยวิสาขบูชา',         name_en: 'Visakha Bucha (substitute)' },
  { date: '2026-06-03', name_th: 'วันเฉลิมพระชนมพรรษาพระราชินี',  name_en: "Queen's Birthday" },
  { date: '2026-07-29', name_th: 'วันอาสาฬหบูชา',                name_en: 'Asahna Bucha Day' },
  { date: '2026-07-30', name_th: 'วันเข้าพรรษา',                 name_en: 'Buddhist Lent Day' },
  { date: '2026-07-28', name_th: 'วันเฉลิมพระชนมพรรษาในหลวง',     name_en: "King's Birthday" },
  { date: '2026-08-12', name_th: 'วันแม่แห่งชาติ',                name_en: "Mother's Day" },
  { date: '2026-10-13', name_th: 'วันคล้ายวันสวรรคต ร.9',        name_en: 'Passing of King Rama IX' },
  { date: '2026-10-23', name_th: 'วันปิยมหาราช',                 name_en: 'Chulalongkorn Day' },
  { date: '2026-12-05', name_th: 'วันพ่อแห่งชาติ',                name_en: "Father's Day" },
  { date: '2026-12-07', name_th: 'วันหยุดชดเชยวันพ่อ',            name_en: "Father's Day (substitute)" },
  { date: '2026-12-10', name_th: 'วันรัฐธรรมนูญ',                name_en: 'Constitution Day' },
  { date: '2026-12-31', name_th: 'วันสิ้นปี',                    name_en: "New Year's Eve" }
];

// Returns the holiday entry for a given date string, or null.
// `dateStr` should be "YYYY-MM-DD" in Asia/Bangkok.
function lookupHoliday(dateStr) {
  return THAI_HOLIDAYS_2026.find(h => h.date === dateStr) || null;
}

// Returns true if the given UTC ISO timestamp falls on a Thai holiday
// (when converted to Asia/Bangkok local date).
function isHoliday(utcISO) {
  const dateStr = bangkokDateStr(utcISO);
  return !!lookupHoliday(dateStr);
}

// Convert a UTC ISO timestamp to YYYY-MM-DD in Asia/Bangkok.
function bangkokDateStr(utcISO) {
  const d = new Date(new Date(utcISO).getTime() + 7 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Build a prompt-friendly block listing upcoming holidays in the next 90 days.
// Used by the AI to know which dates to refuse by default.
function upcomingHolidaysPromptBlock(language = 'th', daysAhead = 90) {
  const today = bangkokDateStr(new Date().toISOString());
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const cutoffStr = bangkokDateStr(cutoff.toISOString());

  const upcoming = THAI_HOLIDAYS_2026.filter(h => h.date >= today && h.date <= cutoffStr);

  if (upcoming.length === 0) return null;

  return upcoming
    .map(h => `- ${h.date} — ${language === 'th' ? h.name_th : h.name_en}`)
    .join('\n');
}

module.exports = {
  THAI_HOLIDAYS_2026,
  lookupHoliday,
  isHoliday,
  bangkokDateStr,
  upcomingHolidaysPromptBlock
};
