import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import mixpanel from 'mixpanel-browser';
import posthog from 'posthog-js';

// Initialize monitoring services
export const initializeMonitoring = () => {
  // Sentry setup for error tracking
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV,
  });

  // Mixpanel setup for analytics
  mixpanel.init(process.env.VITE_MIXPANEL_TOKEN!, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true,
    persistence: 'localStorage',
  });

  // PostHog setup for product analytics
  posthog.init(process.env.VITE_POSTHOG_KEY!, {
    api_host: process.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage',
  });
};

// Custom error boundary for React components
export const ErrorBoundary = Sentry.ErrorBoundary;

// Performance monitoring
export const startPerformanceMonitoring = () => {
  const metrics = {
    ttfb: 0,
    fcp: 0,
    lcp: 0,
    cls: 0,
    fid: 0,
  };

  // Time to First Byte
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  if (navigationEntry) {
    metrics.ttfb = navigationEntry.responseStart;
  }

  // First Contentful Paint
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    metrics.fcp = entries[entries.length - 1].startTime;
    sendMetrics('FCP', metrics.fcp);
  }).observe({ type: 'paint', buffered: true });

  // Largest Contentful Paint
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    metrics.lcp = entries[entries.length - 1].startTime;
    sendMetrics('LCP', metrics.lcp);
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // Cumulative Layout Shift
  new PerformanceObserver((entryList) => {
    let cumulativeScore = 0;
    for (const entry of entryList.getEntries()) {
      if (!entry.hadRecentInput) {
        cumulativeScore += entry.value;
      }
    }
    metrics.cls = cumulativeScore;
    sendMetrics('CLS', metrics.cls);
  }).observe({ type: 'layout-shift', buffered: true });

  // First Input Delay
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    metrics.fid = entries[0].processingStart - entries[0].startTime;
    sendMetrics('FID', metrics.fid);
  }).observe({ type: 'first-input', buffered: true });

  return metrics;
};

// Send metrics to monitoring services
const sendMetrics = (metricName: string, value: number) => {
  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'performance',
    message: `${metricName}: ${value}`,
    level: 'info',
  });

  // Send to Mixpanel
  mixpanel.track(`Performance_${metricName}`, {
    value,
    timestamp: Date.now(),
  });

  // Send to PostHog
  posthog.capture(`performance_${metricName.toLowerCase()}`, {
    value,
    timestamp: new Date().toISOString(),
  });
};

// User session tracking
export const trackUserSession = (userId: string) => {
  // Identify user in monitoring services
  Sentry.setUser({ id: userId });
  mixpanel.identify(userId);
  posthog.identify(userId);

  // Track session start
  const sessionId = Date.now().toString();
  const sessionData = {
    userId,
    sessionId,
    startTime: new Date().toISOString(),
    userAgent: navigator.userAgent,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    locale: navigator.language,
  };

  mixpanel.track('Session_Start', sessionData);
  posthog.capture('session_start', sessionData);

  // Track session end on window close
  window.addEventListener('beforeunload', () => {
    const endTime = new Date().toISOString();
    const sessionDuration = Date.now() - parseInt(sessionId);

    mixpanel.track('Session_End', {
      ...sessionData,
      endTime,
      duration: sessionDuration,
    });

    posthog.capture('session_end', {
      ...sessionData,
      endTime,
      duration: sessionDuration,
    });
  });
};

// Error tracking
export const trackError = (error: Error, context: Record<string, any> = {}) => {
  // Send to Sentry
  Sentry.captureException(error, {
    extra: context,
  });

  // Send to Mixpanel
  mixpanel.track('Error', {
    error: error.message,
    stack: error.stack,
    ...context,
  });

  // Send to PostHog
  posthog.capture('error', {
    error_message: error.message,
    error_stack: error.stack,
    ...context,
  });
};

// Feature usage tracking
export const trackFeatureUsage = (
  featureName: string,
  metadata: Record<string, any> = {}
) => {
  const eventData = {
    feature: featureName,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  mixpanel.track(`Feature_${featureName}`, eventData);
  posthog.capture(`feature_${featureName.toLowerCase()}`, eventData);
};

// Custom event tracking
export const trackEvent = (
  eventName: string,
  properties: Record<string, any> = {}
) => {
  const eventData = {
    ...properties,
    timestamp: new Date().toISOString(),
  };

  mixpanel.track(eventName, eventData);
  posthog.capture(eventName.toLowerCase(), eventData);
};

// Export monitoring instance for global access
export const monitoring = {
  Sentry,
  mixpanel,
  posthog,
  trackError,
  trackFeatureUsage,
  trackEvent,
  startPerformanceMonitoring,
  trackUserSession,
};
