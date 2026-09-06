import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import { resolveWindowsShell } from '../utils/shell';
import { resolveAndValidate } from '../utils/ssrfValidator';
import type { SsrfResolvedAddress } from '../utils/ssrfValidatorTypes';

export const BRANCH = 'master';
export const ARCHIVE_URL = `https://github.com/jnPiyush/AgentX/archive/refs/heads/${BRANCH}.zip`;

export function createPinnedLookup(
  approvedAddresses: readonly SsrfResolvedAddress[],
): http.RequestOptions['lookup'] {
  const pinned = approvedAddresses.find((address) => address.family === 4) ?? approvedAddresses[0];
  if (!pinned) {
    return undefined;
  }

  return (_hostname, options, callback) => {
    if (typeof options === 'object' && options.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}
export async function downloadFile(url: string, dest: string, timeoutMs = 60_000): Promise<void> {
  const initialValidation = await resolveAndValidate(url);
  if (!initialValidation.allowed) {
    throw new Error(`Download URL blocked by SSRF policy: ${initialValidation.reason ?? url}`);
  }

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    let done = false;

    const fail = (error: Error) => {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      file.destroy();
      fs.unlink(dest, () => reject(error));
    };

    const timer = setTimeout(() => {
      if (done) { return; }
      fail(new Error(`Download timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    const request = (
      requestUrl: string,
      redirectCount = 0,
      approvedAddresses: readonly SsrfResolvedAddress[] = [],
    ) => {
      if (redirectCount > 5) {
        fail(new Error('Too many redirects'));
        return;
      }

      const transport = requestUrl.startsWith('https') ? https : http;
      const lookup = createPinnedLookup(approvedAddresses);
      transport.get(requestUrl, { lookup }, (response: {
        statusCode?: number;
        headers: { location?: string };
        pipe: (stream: fs.WriteStream) => void;
        resume: () => void;
      }) => {
        if (
          response.statusCode
          && response.statusCode >= 300
          && response.statusCode < 400
          && response.headers.location
        ) {
          response.resume();
          let redirectUrl: string;
          try {
            redirectUrl = new URL(response.headers.location, requestUrl).toString();
          } catch {
            fail(new Error(`Invalid redirect URL: ${response.headers.location}`));
            return;
          }

          resolveAndValidate(redirectUrl)
            .then((validation) => {
              if (!validation.allowed) {
                fail(new Error(`Download redirect blocked by SSRF policy: ${validation.reason ?? redirectUrl}`));
                return;
              }
              request(validation.url, redirectCount + 1, validation.resolvedAddresses);
            })
            .catch((error: Error) => fail(error));
          return;
        }

        if (response.statusCode && response.statusCode !== 200) {
          fail(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          clearTimeout(timer);
          done = true;
          file.close();
          resolve();
        });
      }).on('error', (err: Error) => {
        fail(err);
      });
    };

    request(initialValidation.url, 0, initialValidation.resolvedAddresses);
  });
}
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });

  if (process.platform === 'win32') {
    const resolved = resolveWindowsShell();
    if (!resolved) {
      throw new Error(
        'PowerShell 7.4+ (pwsh) is required. Install it from '
        + 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell.',
      );
    }

    const { execShell: exec } = await import('../utils/shell');
    await exec(
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`,
      path.dirname(zipPath),
      'pwsh',
    );
    return;
  }

  const { execShell: exec } = await import('../utils/shell');
  await exec(
    `unzip -qo "${zipPath}" -d "${destDir}"`,
    path.dirname(zipPath),
    'bash',
  );
}
