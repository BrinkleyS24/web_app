type JobFeedEnvironment = { DEV?: boolean; VITE_JOB_FEED_ENABLED?: string };

export function isJobFeedEnabled(env: JobFeedEnvironment = import.meta.env): boolean {
  if (env.VITE_JOB_FEED_ENABLED !== undefined) {
    return env.VITE_JOB_FEED_ENABLED.trim().toLowerCase() === 'true';
  }
  return env.DEV === true;
}
