import { useState, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Visibility, PostAdd } from '@mui/icons-material';
import { MarkdownContent } from '../../../shared/ui';
import {
  useGetWorkspaceMetaQuery,
  useGetWorkspaceFileQuery,
  useSaveWorkspaceFileMutation,
  WORKSPACE_TAB_FILES,
} from '../../../entities/agent';

export default function WorkspaceFileTabs({ agentId }: { agentId: string }) {
  const { data: meta } = useGetWorkspaceMetaQuery(agentId);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState(false);

  const {
    data: fileData,
    isFetching,
    isError,
  } = useGetWorkspaceFileQuery({ agentId, filename: selectedFile! }, { skip: !selectedFile });

  const [saveFile, { isLoading: saving }] = useSaveWorkspaceFileMutation();

  const prevFileKey = useRef<string | null>(null);
  const fileKey = selectedFile
    ? `${fileData?.path ?? ''}|${fileData?.content ?? ''}|${fileData?.exists ?? ''}`
    : null;

  if (fileKey !== prevFileKey.current) {
    prevFileKey.current = fileKey;
    if (!selectedFile) {
      setDraft('');
    } else if (fileData !== undefined) {
      setDraft(fileData.content);
    }
  }

  const existsMap = new Map((meta?.files ?? []).map((f) => [f.name, f.exists]));

  const handleTabClick = (file: string) => {
    setSelectedFile((prev) => (prev === file ? null : file));
    setPreview(false);
  };

  const handleReset = () => {
    if (fileData !== undefined) setDraft(fileData.content);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      await saveFile({ agentId, filename: selectedFile, content: draft }).unwrap();
    } catch (e) {
      console.error('Save workspace file failed:', e);
    }
  };

  const dirty = fileData !== undefined && draft !== fileData.content;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: { xs: 'block', sm: 'none' },
          fontWeight: 600,
          mb: 0.35,
        }}
      >
        Workspace
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 0.5,
          overflowX: 'auto',
          overflowY: 'hidden',
          py: 0.25,
          pb: 0.5,
          mx: { xs: -0.25, sm: 0 },
          px: { xs: 0.25, sm: 0 },
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          overscrollBehaviorX: 'contain',
          '&::-webkit-scrollbar': { height: 5 },
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: { xs: 'none', sm: 'block' },
            flexShrink: 0,
            fontWeight: 600,
            mr: 0.25,
            pb: 0.35,
          }}
        >
          Workspace
        </Typography>
        {WORKSPACE_TAB_FILES.map(({ label, file }) => {
          const exists = existsMap.get(file) ?? false;
          const active = selectedFile === file;
          return (
            <Button
              key={file}
              size="small"
              disableRipple
              onClick={() => handleTabClick(file)}
              sx={{
                flexShrink: 0,
                textTransform: 'uppercase',
                fontWeight: 700,
                fontSize: '0.62rem',
                letterSpacing: '0.04em',
                minWidth: 'auto',
                px: 0.75,
                py: 0.35,
                lineHeight: 1.2,
                borderRadius: 0,
                bgcolor: 'transparent',
                color: active ? 'primary.main' : 'text.secondary',
                border: 'none',
                borderBottom: '2px solid',
                borderColor: active ? 'primary.main' : 'transparent',
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: active ? 'primary.main' : 'divider',
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.35,
                }}
              >
                {label}
                {!exists && (
                  <Tooltip title="Not created on disk yet — save to create">
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        lineHeight: 0,
                      }}
                    >
                      <PostAdd sx={{ fontSize: '0.95rem', color: 'warning.main', opacity: 0.95 }} />
                    </Box>
                  </Tooltip>
                )}
              </Box>
            </Button>
          );
        })}
      </Box>

      {selectedFile && (
        <Box
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            mt: 0.75,
            pt: { xs: 1.25, sm: 1 },
            px: { xs: 1, sm: 0.5 },
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: { xs: 1, sm: 1 },
              mb: 1,
              minWidth: 0,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{
                flex: { sm: 1 },
                minWidth: 0,
                fontFamily: 'ui-monospace, monospace',
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                lineHeight: 1.35,
                whiteSpace: { xs: 'normal', sm: 'nowrap' },
                wordBreak: { xs: 'break-all', sm: 'normal' },
                overflow: { sm: 'hidden' },
                textOverflow: { sm: 'ellipsis' },
              }}
            >
              {fileData?.path ?? '…'}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
                gap: { xs: 0.75, sm: 0.5 },
                flexShrink: 0,
                minWidth: 0,
              }}
            >
              {isFetching && <CircularProgress size={16} sx={{ flexShrink: 0 }} />}
              <Tooltip title={preview ? 'Edit' : 'Preview'}>
                <IconButton
                  size="small"
                  onClick={() => setPreview(!preview)}
                  color={preview ? 'primary' : 'default'}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 0.75,
                    flexShrink: 0,
                    width: { xs: 40, sm: 28 },
                    height: { xs: 40, sm: 28 },
                  }}
                >
                  <Visibility sx={{ fontSize: { xs: 18, sm: 15 } }} />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                onClick={handleReset}
                disabled={saving || isFetching || !dirty}
                sx={{
                  flex: { xs: 1, sm: 'none' },
                  minHeight: { xs: 40, sm: 26 },
                  py: { xs: 0.75, sm: 0.15 },
                  px: { xs: 1, sm: 0.9 },
                  fontSize: { xs: '0.8rem', sm: '0.7rem' },
                  textTransform: 'none',
                }}
              >
                Reset
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSave}
                disabled={saving || isFetching || !dirty}
                sx={{
                  flex: { xs: 1, sm: 'none' },
                  minHeight: { xs: 40, sm: 26 },
                  py: { xs: 0.75, sm: 0.15 },
                  px: { xs: 1, sm: 1 },
                  fontSize: { xs: '0.8rem', sm: '0.7rem' },
                  textTransform: 'none',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Content
          </Typography>
          {isError ? (
            <Typography color="error" variant="body2">
              Could not load this file. Check that the API server and OpenClaw CLI are running.
            </Typography>
          ) : preview ? (
            <Box
              sx={{
                maxHeight: { xs: 'min(32vh, 220px)', sm: '36vh', md: '320px' },
                overflow: 'auto',
                p: { xs: 1.25, sm: 1.5 },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <MarkdownContent>{draft || '*Nothing to preview*'}</MarkdownContent>
            </Box>
          ) : (
            <TextField
              multiline
              fullWidth
              minRows={5}
              maxRows={18}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isFetching || saving}
              placeholder="Markdown content…"
              slotProps={{
                input: {
                  sx: {
                    minHeight: { xs: 120, sm: 'unset' },
                  },
                },
                htmlInput: {
                  sx: {
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    fontSize: { xs: '0.78rem', sm: '0.8rem' },
                    lineHeight: 1.5,
                  },
                },
              }}
              sx={{
                maxHeight: { xs: 'min(35vh, 260px)', sm: '42vh', md: '380px' },
                '& .MuiInputBase-root': { alignItems: 'flex-start', py: { xs: 0.75, sm: 0 } },
              }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
