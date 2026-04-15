import { baseApi } from '../../shared/api/baseApi';

export interface SkillMissing {
  bins: string[];
  anyBins: string[];
  env: string[];
  config: string[];
  os: string[];
}

export interface SkillInfo {
  name: string;
  description: string;
  emoji: string;
  eligible: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
  homepage?: string;
  missing: SkillMissing;
}

export const skillsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listSkills: build.query<SkillInfo[], void>({
      query: () => '/skill',
      providesTags: ['Skill'],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const { useListSkillsQuery } = skillsApi;
