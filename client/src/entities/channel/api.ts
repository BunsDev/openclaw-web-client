import { baseApi } from '../../shared/api/baseApi';

export interface ChannelChat {
  id: string;
  provider: string;
  enabled: boolean;
  [key: string]: unknown;
}

export interface ChannelAuth {
  id: string;
  provider: string;
  type: string;
  isExternal: boolean;
}

export interface ChannelsResponse {
  chat: ChannelChat[];
  auth: ChannelAuth[];
}

export const CHANNEL_PROVIDERS = [
  'telegram',
  'discord',
  'slack',
  'whatsapp',
  'signal',
  'matrix',
  'imessage',
  'msteams',
  'mattermost',
  'googlechat',
  'nostr',
  'irc',
  'twitch',
  'line',
  'feishu',
  'bluebubbles',
  'tlon',
  'nextcloud-talk',
  'synology-chat',
  'qqbot',
  'zalo',
] as const;

export type ChannelProvider = typeof CHANNEL_PROVIDERS[number];

export interface ChannelField {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
}

export const CHANNEL_FIELDS: Record<string, ChannelField[]> = {
  telegram: [
    { key: 'token', label: 'Bot Token', required: true, secret: true },
  ],
  discord: [
    { key: 'token', label: 'Bot Token', required: true, secret: true },
  ],
  slack: [
    { key: 'bot-token', label: 'Bot Token (xoxb-...)', required: true, secret: true },
    { key: 'app-token', label: 'App Token (xapp-...)', required: true, secret: true },
  ],
  whatsapp: [
    { key: 'auth-dir', label: 'Auth Directory' },
  ],
  signal: [
    { key: 'signal-number', label: 'Phone Number (E.164)', required: true },
    { key: 'http-url', label: 'Signal HTTP URL' },
  ],
  matrix: [
    { key: 'homeserver', label: 'Homeserver URL', required: true },
    { key: 'user-id', label: 'User ID', required: true },
    { key: 'password', label: 'Password', secret: true },
    { key: 'access-token', label: 'Access Token', secret: true },
  ],
  imessage: [
    { key: 'cli-path', label: 'CLI Path' },
    { key: 'db-path', label: 'Database Path' },
  ],
  msteams: [
    { key: 'token', label: 'Bot Token', required: true, secret: true },
  ],
  mattermost: [
    { key: 'token', label: 'Bot Token', required: true, secret: true },
    { key: 'url', label: 'Server URL', required: true },
  ],
  googlechat: [
    { key: 'webhook-url', label: 'Webhook URL', required: true },
    { key: 'audience', label: 'Audience Value' },
    { key: 'audience-type', label: 'Audience Type (app-url|project-number)' },
  ],
  nostr: [
    { key: 'private-key', label: 'Private Key (nsec...)', required: true, secret: true },
    { key: 'relay-urls', label: 'Relay URLs (comma-separated)' },
  ],
  irc: [
    { key: 'token', label: 'Token', secret: true },
  ],
  twitch: [
    { key: 'token', label: 'OAuth Token', required: true, secret: true },
  ],
  line: [
    { key: 'token', label: 'Channel Access Token', required: true, secret: true },
  ],
  feishu: [
    { key: 'token', label: 'App Token', required: true, secret: true },
  ],
  bluebubbles: [
    { key: 'webhook-path', label: 'Webhook Path', required: true },
  ],
  tlon: [
    { key: 'ship', label: 'Ship (~sampel-palnet)', required: true },
    { key: 'url', label: 'Ship URL', required: true },
    { key: 'code', label: 'Login Code', required: true, secret: true },
  ],
  'nextcloud-talk': [
    { key: 'token', label: 'Token', required: true, secret: true },
    { key: 'url', label: 'Server URL', required: true },
  ],
  'synology-chat': [
    { key: 'token', label: 'Token', required: true, secret: true },
    { key: 'webhook-url', label: 'Webhook URL', required: true },
  ],
  qqbot: [
    { key: 'token', label: 'Bot Token', required: true, secret: true },
  ],
  zalo: [
    { key: 'token', label: 'Token', required: true, secret: true },
  ],
};

export const channelsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listChannels: build.query<ChannelsResponse, void>({
      query: () => '/channel',
      providesTags: ['Channel'],
      keepUnusedDataFor: 600,
    }),
    addChannel: build.mutation<{ ok: boolean }, Record<string, string>>({
      query: (body) => ({
        url: '/channel',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Channel'],
    }),
    removeChannel: build.mutation<{ ok: boolean }, { name: string; account?: string }>({
      query: ({ name, account }) => ({
        url: `/channel/${encodeURIComponent(name)}${account ? `?account=${encodeURIComponent(account)}` : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Channel'],
    }),
  }),
});

export const {
  useListChannelsQuery,
  useAddChannelMutation,
  useRemoveChannelMutation,
} = channelsApi;
