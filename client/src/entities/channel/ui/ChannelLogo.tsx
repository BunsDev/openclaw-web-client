import type { ComponentType } from 'react';
import { Box } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import {
  BubbleChart,
  Chat,
  Cloud,
  Dns,
  Forum,
  Groups,
  Lock,
  Message,
  Storage,
} from '@mui/icons-material';
import { ProviderIcon as LobehubProviderIcon } from '@lobehub/icons';
import { SocialIcon } from 'react-social-icons/component';
// Tree-shakable side-effect imports: only the networks actually rendered below
// are bundled. Everything else falls through to an MUI glyph or an emoji.
import 'react-social-icons/telegram';
import 'react-social-icons/discord';
import 'react-social-icons/slack';
import 'react-social-icons/whatsapp';
import 'react-social-icons/matrix';
import 'react-social-icons/twitch';
import 'react-social-icons/line.me';
import 'react-social-icons/reddit';
import 'react-social-icons/facebook';
import 'react-social-icons/google';
import 'react-social-icons/mastodon';
import 'react-social-icons/wechat';
import 'react-social-icons/rss';

const RSI_NETWORK: Record<string, string> = {
  telegram: 'telegram',
  discord: 'discord',
  slack: 'slack',
  whatsapp: 'whatsapp',
  matrix: 'matrix',
  twitch: 'twitch',
  line: 'line.me',
  reddit: 'reddit',
  facebook: 'facebook',
  messenger: 'facebook',
  google: 'google',
  googlechat: 'google',
  nostr: 'mastodon',
  feishu: 'wechat',
  qqbot: 'wechat',
};

interface MuiSpec {
  Icon: ComponentType<SvgIconProps>;
  color: string;
}
const MUI_FALLBACK: Record<string, MuiSpec> = {
  signal: { Icon: Lock, color: '#3A76F0' },
  imessage: { Icon: Message, color: '#34C759' },
  msteams: { Icon: Groups, color: '#5059C9' },
  mattermost: { Icon: Forum, color: '#0058CC' },
  irc: { Icon: Dns, color: '#6B7280' },
  bluebubbles: { Icon: BubbleChart, color: '#3498DB' },
  'nextcloud-talk': { Icon: Cloud, color: '#0082C9' },
  'synology-chat': { Icon: Storage, color: '#2B6CB0' },
  zalo: { Icon: Chat, color: '#0068FF' },
};

const LOBEHUB_PROVIDER: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  groq: 'groq',
  ollama: 'ollama',
};

const EMOJI_FALLBACK: Record<string, string> = {
  tlon: '🌊',
};

interface ChannelLogoProps {
  provider: string | null | undefined;
  size?: number;
  fallback?: string;
}

export default function ChannelLogo({ provider, size = 20, fallback = '📡' }: ChannelLogoProps) {
  const key = provider?.toLowerCase() ?? '';

  const wrapperStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
  };

  const network = RSI_NETWORK[key];
  if (network) {
    return (
      <SocialIcon
        as="span"
        network={network}
        fgColor="#ffffff"
        style={wrapperStyle}
        aria-label={provider ?? undefined}
      />
    );
  }

  const lobehub = LOBEHUB_PROVIDER[key];
  if (lobehub) {
    return (
      <Box
        component="span"
        aria-label={provider ?? undefined}
        sx={{ ...wrapperStyle, lineHeight: 0, '& svg': { display: 'block' } }}
      >
        <LobehubProviderIcon provider={lobehub} size={size} type="avatar" />
      </Box>
    );
  }

  const mui = MUI_FALLBACK[key];
  if (mui) {
    const { Icon, color } = mui;
    return (
      <Box
        component="span"
        aria-label={provider ?? undefined}
        sx={{
          ...wrapperStyle,
          color,
          lineHeight: 0,
        }}
      >
        <Icon sx={{ fontSize: size }} />
      </Box>
    );
  }

  return (
    <span
      aria-label={provider ?? undefined}
      style={{ ...wrapperStyle, fontSize: size * 0.9, lineHeight: 1 }}
    >
      {EMOJI_FALLBACK[key] ?? fallback}
    </span>
  );
}
