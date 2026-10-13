// Kyle requested automatic prospect messages, replies, and follow-ups remain off.
// Research, manual emails, and immediate website-form confirmations stay available.
// Keep this separate from CRON_SECRET: that secret authenticates research jobs
// and must not be interpreted as permission to send automatic outreach.
export const AUTOMATIC_OUTREACH_ENABLED = false;
