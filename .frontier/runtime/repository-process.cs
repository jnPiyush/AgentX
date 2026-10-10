using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

#nullable enable
namespace Frontier.RepositoryContext {
    public sealed class ProcessOutputV1 {
        public int ExitCode;
        public string Output = "";
        public string Error = "";
    }

    public static class BoundedProcessV1 {
        static async Task<string> ReadAsync(StreamReader reader, int maximum, CancellationToken token) {
            var text = new StringBuilder();
            var buffer = new char[4096];
            int count;
            while ((count = await reader.ReadAsync(buffer.AsMemory(0, buffer.Length), token).ConfigureAwait(false)) != 0) {
                if (text.Length + count > maximum)
                    throw new InvalidDataException("Repository parser output exceeded its limit.");
                text.Append(buffer, 0, count);
            }
            return text.ToString();
        }

        public static ProcessOutputV1 Run(ProcessStartInfo start, string input, int seconds, int maximum) {
            using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(seconds));
            using var process = Process.Start(start);
            if (process == null) throw new IOException("Repository parser process did not start.");
            var token = cancellation.Token;
            try {
                var output = ReadAsync(process.StandardOutput, maximum, token);
                var error = ReadAsync(process.StandardError, 65536, token);
                output.ContinueWith(_ => cancellation.Cancel(),
                    CancellationToken.None, TaskContinuationOptions.OnlyOnFaulted, TaskScheduler.Default);
                error.ContinueWith(_ => cancellation.Cancel(),
                    CancellationToken.None, TaskContinuationOptions.OnlyOnFaulted, TaskScheduler.Default);
                process.StandardInput.WriteAsync(input.AsMemory(), token).GetAwaiter().GetResult();
                process.StandardInput.Close();
                process.WaitForExitAsync(token).GetAwaiter().GetResult();
                return new ProcessOutputV1 {
                    ExitCode = process.ExitCode,
                    Output = output.GetAwaiter().GetResult(),
                    Error = error.GetAwaiter().GetResult()
                };
            } catch (OperationCanceledException) {
                throw new IOException("Repository parser timed out or exceeded its output limit.");
            } finally {
                cancellation.Cancel();
                if (!process.HasExited) {
                    process.Kill(true);
                    if (!process.WaitForExit(5000))
                        throw new IOException("Repository parser termination was not confirmed.");
                }
            }
        }
    }
}
