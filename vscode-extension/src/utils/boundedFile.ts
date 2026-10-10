import * as fs from 'fs';

/**
 * Reads a UTF-8 file through one descriptor, so the size check and the read
 * see the same file. Returns undefined when the file is missing, or when it is
 * oversized and no oversize error message is given.
 */
export function readBoundedUtf8(filename: string, maxBytes: number, oversizeError?: string): string | undefined {
  let fd: number;
  try {
    fd = fs.openSync(filename, 'r');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') { return undefined; }
    throw error;
  }
  try {
    if (fs.fstatSync(fd).size > maxBytes) {
      if (oversizeError) { throw new Error(oversizeError); }
      return undefined;
    }
    return fs.readFileSync(fd, 'utf8');
  } finally {
    fs.closeSync(fd);
  }
}
