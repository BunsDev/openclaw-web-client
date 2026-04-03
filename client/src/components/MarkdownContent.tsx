import { useEffect } from 'react';
import { Box, useTheme } from '@mui/material';
import { getLuminance } from '@mui/material/styles';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import hljsGithubLightUrl from 'highlight.js/styles/github.css?url';
import hljsGithubDarkUrl from 'highlight.js/styles/github-dark.css?url';

let hljsThemeLinkEl: HTMLLinkElement | null = null;

function syncHljsStylesheet(isDarkUi: boolean) {
  if (!hljsThemeLinkEl) {
    hljsThemeLinkEl = document.createElement('link');
    hljsThemeLinkEl.rel = 'stylesheet';
    hljsThemeLinkEl.id = 'openclaw-hljs-theme';
    document.head.appendChild(hljsThemeLinkEl);
  }
  const href = isDarkUi ? hljsGithubDarkUrl : hljsGithubLightUrl;
  if (hljsThemeLinkEl.getAttribute('href') !== href) {
    hljsThemeLinkEl.setAttribute('href', href);
  }
}

const markdownComponents: Partial<Components> = {
  table({ node: _node, children, ...props }) {
    return (
      <Box sx={{ overflowX: 'auto', maxWidth: '100%', mb: 0.75, WebkitOverflowScrolling: 'touch' }}>
        <Box component="table" {...props} sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          {children}
        </Box>
      </Box>
    );
  },
};

export default function MarkdownContent({ children, isStreaming }: { children: string; isStreaming?: boolean }) {
  const theme = useTheme();
  const isDarkUi =
    theme.palette.mode === 'dark' ||
    getLuminance(theme.palette.background.paper) < 0.5;

  const codeBlockBg = isDarkUi ? '#0d1117' : '#f6f8fa';

  useEffect(() => {
    syncHljsStylesheet(isDarkUi);
  }, [isDarkUi]);

  return (
    <Box
      sx={{
        fontSize: '0.875rem',
        lineHeight: 1.65,
        minWidth: 0,
        maxWidth: '100%',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        color: 'text.primary',
        '& p': { m: 0, mb: 0.75, '&:last-child': { mb: 0 } },
        '& h1,& h2,& h3,& h4,& h5,& h6': {
          mt: 1.5, mb: 0.5,
          fontWeight: 600,
          lineHeight: 1.3,
          color: 'text.primary',
          '&:first-of-type': { mt: 0 },
        },
        '& h1': { fontSize: '1.2rem' },
        '& h2': { fontSize: '1.05rem' },
        '& h3': { fontSize: '0.95rem' },
        '& ul,& ol': { pl: 2.5, m: 0, mb: 0.75 },
        '& li': { mb: 0.25 },
        '& li > p': { mb: 0 },
        '& blockquote': {
          m: 0, mb: 0.75,
          pl: 1.5,
          borderLeft: '3px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          fontStyle: 'italic',
        },
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
        },
        '& hr': { border: 'none', borderTop: '1px solid', borderColor: 'divider', my: 1 },
        '& th,& td': {
          border: '1px solid',
          borderColor: 'divider',
          px: 1.5,
          py: 0.75,
          textAlign: 'left',
          wordBreak: 'break-word',
        },
        '& th': { fontWeight: 600, bgcolor: isDarkUi ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
        '& code:not(pre code)': {
          fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
          fontSize: '0.8rem',
          px: 0.6,
          py: 0.15,
          borderRadius: '4px',
          bgcolor: isDarkUi ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
        },
        '& pre': {
          m: 0, mb: 0.75,
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box',
          borderRadius: '8px',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          bgcolor: codeBlockBg,
          border: '1px solid',
          borderColor: 'divider',
          '& code': {
            fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
            fontSize: '0.8rem',
            background: 'none',
            p: 0,
            whiteSpace: 'pre',
            wordBreak: 'normal',
            display: 'block',
          },
          '& .hljs': {
            background: 'transparent !important',
            p: 1.5,
            display: 'block',
          },
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {children}
      </ReactMarkdown>
      {isStreaming && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 6,
            height: 14,
            bgcolor: 'text.secondary',
            ml: 0.3,
            animation: 'blink 1s step-end infinite',
            verticalAlign: 'text-bottom',
            '@keyframes blink': { '50%': { opacity: 0 } },
          }}
        />
      )}
    </Box>
  );
}
