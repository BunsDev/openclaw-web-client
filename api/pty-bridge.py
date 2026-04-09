"""
PTY bridge: spawns a command inside a pseudo-terminal and bridges
stdin/stdout so Node.js can communicate with it via pipes.
Handles terminal resize via in-band JSON messages on stdin.

Usage: python3 pty-bridge.py <cols> <rows> <command> [args...]
"""
import sys
import os
import select
import fcntl
import termios
import struct
import json
import errno


def set_nonblocking(fd):
    fl = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)


def set_winsize(fd, rows, cols):
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def main():
    if len(sys.argv) < 4:
        sys.exit(1)

    cols = int(sys.argv[1])
    rows = int(sys.argv[2])
    cmd = sys.argv[3:]

    pid, fd = os.forkpty()

    if pid == 0:
        os.environ['TERM'] = 'xterm-256color'
        os.execvp(cmd[0], cmd)
        sys.exit(127)

    set_winsize(fd, rows, cols)
    set_nonblocking(fd)
    set_nonblocking(sys.stdin.fileno())

    stdin_fd = sys.stdin.fileno()
    stdout_fd = sys.stdout.fileno()
    stdin_buf = b''

    try:
        while True:
            fds = [fd, stdin_fd]
            try:
                readable, _, _ = select.select(fds, [], [], 0.1)
            except (select.error, ValueError):
                break

            if fd in readable:
                try:
                    data = os.read(fd, 65536)
                    if not data:
                        break
                    os.write(stdout_fd, data)
                except OSError as e:
                    if e.errno == errno.EIO:
                        break
                    raise

            if stdin_fd in readable:
                try:
                    data = os.read(stdin_fd, 65536)
                    if not data:
                        break
                except OSError as e:
                    if e.errno in (errno.EIO, errno.EAGAIN):
                        continue
                    break

                stdin_buf += data
                while b'\n' in stdin_buf or len(stdin_buf) > 0:
                    if stdin_buf.startswith(b'{"type":'):
                        nl = stdin_buf.find(b'\n')
                        if nl == -1:
                            break
                        line = stdin_buf[:nl]
                        stdin_buf = stdin_buf[nl + 1:]
                        try:
                            msg = json.loads(line)
                            if msg.get('type') == 'resize':
                                set_winsize(fd, msg['rows'], msg['cols'])
                        except (json.JSONDecodeError, KeyError):
                            os.write(fd, line)
                    else:
                        os.write(fd, stdin_buf)
                        stdin_buf = b''
                        break
    except KeyboardInterrupt:
        pass
    finally:
        try:
            os.close(fd)
        except OSError:
            pass
        _, status = os.waitpid(pid, 0)
        code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1
        sys.exit(code)


if __name__ == '__main__':
    main()
