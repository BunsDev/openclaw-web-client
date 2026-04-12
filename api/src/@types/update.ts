export interface VersionMeta {
  version: string;
  sourceRepo: string;
}

export interface UpdateStatus {
  available: boolean;
  current: string;
  latest: string;
  checkedAt: string | null;
}
