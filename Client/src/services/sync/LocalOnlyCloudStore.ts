import type { CloudStore } from '../ports';

/** No Steam Cloud (dev, tests, browser): a no-op CloudStore (Unity LocalOnlyCloudStore). */
export class LocalOnlyCloudStore implements CloudStore {
  readonly isAvailable = false;

  async read(): Promise<null> {
    return null;
  }

  async write(): Promise<boolean> {
    return false;
  }
}
