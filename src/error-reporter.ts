import * as Sentry from "@sentry/node";

let enabled = false;

export function initExceptionHandler(tunnelAddress: string) {
  if (process.env.SENTRY_DSN) {
    enabled = true;
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      serverName: tunnelAddress
    });
    console.log("ERROR-REPORTER: reporting enabled");
  }
}

export function captureException(error: any) {
  if (!enabled) {
    console.error(error);

    return;
  }

  Sentry.captureException(error);
}
