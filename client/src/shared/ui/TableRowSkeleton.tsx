import { TableRow, TableCell, Skeleton, Box } from '@mui/material';

interface TableRowSkeletonProps {
  columns: number;
  rows?: number;
  hasActions?: boolean;
}

export default function TableRowSkeleton({
  columns,
  rows = 5,
  hasActions = true,
}: TableRowSkeletonProps) {
  const widths = ['60%', '40%', '50%', '35%', '45%', '55%'];

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: hasActions ? columns - 1 : columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton width={widths[colIndex % widths.length]} />
            </TableCell>
          ))}
          {hasActions && (
            <TableCell align="right">
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="circular" width={24} height={24} />
              </Box>
            </TableCell>
          )}
        </TableRow>
      ))}
    </>
  );
}
