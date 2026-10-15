import { useEffect, useState } from 'react';
import type {AnalyticsSource} from './analyticsSources';
import {loadOverview} from './manualOverview';
import type { OverviewV3 } from './overviewAnalytics';

/** Shared read-only source and retry handling for comparison/reporting screens. */
export function useRecordedOverview(includeManual:AnalyticsSource|boolean=false) {
  const [data, setData] = useState<OverviewV3 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError(null);
    loadOverview(includeManual, controller.signal).then(next => { if (!controller.signal.aborted) setData(next); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load recorded replay data.'); });
    return () => controller.abort();
  }, [revision,includeManual]);
  return { data, error, reload: () => setRevision(v => v + 1) };
}
