const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const VERSION = pkg.version || '1.0.0';
const CSC = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

const RELEASE_DIR = path.join(ROOT, 'release');
const STAGE_ROOT = path.join(RELEASE_DIR, '_stage');
const STAGE_APP = path.join(STAGE_ROOT, 'QuestLog');

const EXCLUDED_NODE_MODULES = new Set([
  '.bin',
  '.package-lock.json',
  'electron',
  '@electron-internal',
  'lucide-react',
  '@typescript',
  'typescript',
  '@rolldown',
  'vite',
  '@vitejs',
  '@oxlint',
  'oxlint',
  '@tailwindcss',
  'tailwindcss',
  'lightningcss',
  'lightningcss-win32-x64-msvc',
  'react',
  'react-dom',
  '@types',
  'canvas-confetti',
]);

function copyRecursive(src, dest, filterFn = null) {
  if (filterFn && !filterFn(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry), filterFn);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function buildInstallerStubCs() {
  return `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace QuestLogSetup
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }

    public class SetupForm : Form
    {
        private Label titleLabel;
        private Label subLabel;
        private Label pathLabel;
        private TextBox pathBox;
        private CheckBox desktopShortcutChk;
        private CheckBox startMenuChk;
        private CheckBox launchAfterChk;
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button installBtn;
        private Button cancelBtn;

        public SetupForm()
        {
            this.Text = "QuestLog v${VERSION} — Setup Installer";
            this.Size = new Size(520, 390);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(14, 17, 26);
            this.ForeColor = Color.White;
            try { this.Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location); } catch {}

            titleLabel = new Label {
                Text = "QuestLog v${VERSION}",
                Font = new Font("Segoe UI", 18, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(28, 22),
                AutoSize = true
            };

            subLabel = new Label {
                Text = "Personal Game Backlog & Progress Tracker (100% Standalone)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(30, 58),
                AutoSize = true
            };

            pathLabel = new Label {
                Text = "Folder Instalasi:",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(30, 96),
                AutoSize = true
            };

            string defaultDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs", "QuestLog"
            );

            pathBox = new TextBox {
                Text = defaultDir,
                Font = new Font("Segoe UI", 9.5f),
                BackColor = Color.FromArgb(22, 27, 40),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Location = new Point(30, 120),
                Size = new Size(444, 26)
            };

            desktopShortcutChk = new CheckBox {
                Text = "Buat shortcut QuestLog di Desktop",
                Checked = true,
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(30, 162),
                AutoSize = true
            };

            startMenuChk = new CheckBox {
                Text = "Tambahkan ke Start Menu Windows",
                Checked = true,
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(30, 190),
                AutoSize = true
            };

            launchAfterChk = new CheckBox {
                Text = "Langsung jalankan QuestLog setelah instalasi selesai",
                Checked = true,
                Font = new Font("Segoe UI", 9.5f),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(30, 218),
                AutoSize = true
            };

            statusLabel = new Label {
                Text = "Siap menginstal QuestLog.",
                Font = new Font("Segoe UI", 9f),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(30, 254),
                Size = new Size(444, 20)
            };

            progressBar = new ProgressBar {
                Location = new Point(30, 278),
                Size = new Size(444, 16),
                Minimum = 0,
                Maximum = 100,
                Value = 0
            };

            installBtn = new Button {
                Text = "Install Sekarang",
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                BackColor = Color.FromArgb(56, 189, 248),
                ForeColor = Color.FromArgb(10, 14, 23),
                FlatStyle = FlatStyle.Flat,
                Location = new Point(324, 306),
                Size = new Size(150, 36),
                Cursor = Cursors.Hand
            };
            installBtn.FlatAppearance.BorderSize = 0;
            installBtn.Click += async (s, e) => await RunInstallAsync();

            cancelBtn = new Button {
                Text = "Batal",
                Font = new Font("Segoe UI", 9.5f),
                BackColor = Color.FromArgb(30, 36, 52),
                ForeColor = Color.FromArgb(203, 213, 225),
                FlatStyle = FlatStyle.Flat,
                Location = new Point(220, 306),
                Size = new Size(94, 36),
                Cursor = Cursors.Hand
            };
            cancelBtn.FlatAppearance.BorderSize = 0;
            cancelBtn.Click += (s, e) => this.Close();

            this.Controls.AddRange(new Control[] {
                titleLabel, subLabel, pathLabel, pathBox,
                desktopShortcutChk, startMenuChk, launchAfterChk,
                statusLabel, progressBar, installBtn, cancelBtn
            });
        }

        private async Task RunInstallAsync()
        {
            string targetDir = pathBox.Text.Trim();
            if (string.IsNullOrEmpty(targetDir)) return;

            installBtn.Enabled = false;
            cancelBtn.Enabled = false;
            pathBox.Enabled = false;

            try
            {
                string exePath = Assembly.GetExecutingAssembly().Location;
                await Task.Run(() =>
                {
                    using (var fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                    {
                        if (fs.Length < 16) throw new Exception("Invalid installer payload.");
                        fs.Seek(-16, SeekOrigin.End);
                        byte[] footer = new byte[16];
                        fs.Read(footer, 0, 16);
                        long zipSize = BitConverter.ToInt64(footer, 0);
                        string magic = System.Text.Encoding.ASCII.GetString(footer, 8, 8);
                        if (magic != "QLSETUP1" || zipSize <= 0 || zipSize > fs.Length - 16)
                        {
                            throw new Exception("Payload arsip tidak ditemukan di dalam installer.");
                        }

                        long zipOffset = fs.Length - 16 - zipSize;
                        fs.Seek(zipOffset, SeekOrigin.Begin);

                        Directory.CreateDirectory(targetDir);
                        string tempZip = Path.Combine(Path.GetTempPath(), "questlog_payload_" + Guid.NewGuid().ToString("N") + ".zip");
                        try
                        {
                            using (var outZip = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                            {
                                byte[] buf = new byte[65536];
                                long remaining = zipSize;
                                while (remaining > 0)
                                {
                                    int toRead = (int)Math.Min(buf.Length, remaining);
                                    int read = fs.Read(buf, 0, toRead);
                                    if (read <= 0) break;
                                    outZip.Write(buf, 0, read);
                                    remaining -= read;
                                }
                            }

                            using (var archive = ZipFile.OpenRead(tempZip))
                            {
                                int total = Math.Max(1, archive.Entries.Count);
                                int count = 0;
                                foreach (var entry in archive.Entries)
                                {
                                    count++;
                                    string relPath = entry.FullName;
                                    if (relPath.StartsWith("QuestLog/")) relPath = relPath.Substring("QuestLog/".Length);
                                    else if (relPath.StartsWith("QuestLog\\\\")) relPath = relPath.Substring("QuestLog\\\\".Length);
                                    if (string.IsNullOrEmpty(relPath)) continue;

                                    // Preserve existing user data/games.json if upgrading
                                    string destPath = Path.Combine(targetDir, relPath.Replace('/', Path.DirectorySeparatorChar));
                                    if (relPath.Equals("runtime/resources/app/data/games.json", StringComparison.OrdinalIgnoreCase) && File.Exists(destPath))
                                    {
                                        continue;
                                    }

                                    if (string.IsNullOrEmpty(entry.Name))
                                    {
                                        Directory.CreateDirectory(destPath);
                                        continue;
                                    }

                                    Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                                    entry.ExtractToFile(destPath, true);

                                    if (count % 15 == 0 || count == total)
                                    {
                                        int pct = Math.Min(95, (int)((count * 95.0) / total));
                                        this.Invoke((Action)(() => {
                                            progressBar.Value = pct;
                                            statusLabel.Text = "Mengekstrak file (" + count + " / " + total + ")...";
                                        }));
                                    }
                                }
                            }
                        }
                        finally
                        {
                            try { if (File.Exists(tempZip)) File.Delete(tempZip); } catch {}
                        }
                    }
                });

                string installedExe = Path.Combine(targetDir, "QuestLog.exe");
                string installedIco = Path.Combine(targetDir, @"runtime\resources\app\public\app.ico");

                if (desktopShortcutChk.Checked)
                {
                    string desktopLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "QuestLog.lnk");
                    CreateShortcut(desktopLink, installedExe, targetDir, installedIco);
                }

                if (startMenuChk.Checked)
                {
                    string startMenuLink = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "QuestLog.lnk");
                    CreateShortcut(startMenuLink, installedExe, targetDir, installedIco);
                }

                progressBar.Value = 100;
                statusLabel.Text = "Instalasi selesai!";

                if (launchAfterChk.Checked && File.Exists(installedExe))
                {
                    Process.Start(new ProcessStartInfo {
                        FileName = installedExe,
                        WorkingDirectory = targetDir,
                        UseShellExecute = true
                    });
                }

                MessageBox.Show("QuestLog v${VERSION} berhasil di-install!", "QuestLog Setup", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Gagal menginstal: " + ex.Message, "QuestLog Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                installBtn.Enabled = true;
                cancelBtn.Enabled = true;
                pathBox.Enabled = true;
            }
        }

        private void CreateShortcut(string linkPath, string targetExe, string workDir, string iconPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic shortcut = shell.CreateShortcut(linkPath);
                shortcut.TargetPath = targetExe;
                shortcut.WorkingDirectory = workDir;
                if (File.Exists(iconPath)) shortcut.IconLocation = iconPath;
                shortcut.Description = "QuestLog - Personal Game Backlog & Progress Tracker";
                shortcut.Save();
            }
            catch {}
        }
    }
}
`;
}

function main() {
  console.log('=== Building QuestLog v' + VERSION + ' Release Packages ===');

  // 1. Prepare clean staging directory
  console.log('[1/5] Preparing standalone portable package...');
  if (fs.existsSync(STAGE_ROOT)) {
    fs.rmSync(STAGE_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGE_APP, { recursive: true });

  // 2. Compile QuestLog.exe from Launcher.cs directly into staging (so it succeeds even if QuestLog.exe is open)
  console.log('[2/5] Compiling QuestLog.exe launcher...');
  const stagedLauncherExe = path.join(STAGE_APP, 'QuestLog.exe');
  execFileSync(CSC, [
    '/nologo',
    '/target:winexe',
    '/optimize+',
    `/win32icon:${path.join(ROOT, 'public', 'app.ico')}`,
    `/out:${stagedLauncherExe}`,
    path.join(ROOT, 'Launcher.cs'),
  ], { stdio: 'inherit' });
  try {
    fs.copyFileSync(stagedLauncherExe, path.join(ROOT, 'QuestLog.exe'));
  } catch {}

  // Copy top-level docs
  for (const file of ['LICENSE', 'README.md']) {
    if (fs.existsSync(path.join(ROOT, file))) {
      fs.copyFileSync(path.join(ROOT, file), path.join(STAGE_APP, file));
    }
  }

  // Copy Electron runtime (stripping unused locales & 16MB license html)
  const electronDist = path.join(ROOT, 'node_modules', 'electron', 'dist');
  const stageRuntime = path.join(STAGE_APP, 'runtime');
  copyRecursive(electronDist, stageRuntime, (srcPath) => {
    const base = path.basename(srcPath);
    if (base === 'LICENSES.chromium.html' || base === 'default_app.asar') return false;
    if (path.basename(path.dirname(srcPath)) === 'locales') {
      return base === 'en-US.pak' || base === 'id.pak';
    }
    return true;
  });

  // Populate runtime/resources/app
  const stageResApp = path.join(stageRuntime, 'resources', 'app');
  fs.mkdirSync(stageResApp, { recursive: true });

  for (const f of ['package.json', 'server.js']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(stageResApp, f));
  }
  copyRecursive(path.join(ROOT, 'dist'), path.join(stageResApp, 'dist'));
  copyRecursive(path.join(ROOT, 'public'), path.join(stageResApp, 'public'));
  fs.mkdirSync(path.join(stageResApp, 'electron'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'electron', 'main.cjs'), path.join(stageResApp, 'electron', 'main.cjs'));
  fs.copyFileSync(path.join(ROOT, 'electron', 'preload.cjs'), path.join(stageResApp, 'electron', 'preload.cjs'));

  // Clean empty initial database for end-users
  fs.mkdirSync(path.join(stageResApp, 'data'), { recursive: true });
  fs.writeFileSync(path.join(stageResApp, 'data', 'games.json'), '[]\n', 'utf-8');

  // Copy only runtime node_modules
  const srcModules = path.join(ROOT, 'node_modules');
  const destModules = path.join(stageResApp, 'node_modules');
  fs.mkdirSync(destModules, { recursive: true });
  for (const mod of fs.readdirSync(srcModules)) {
    if (EXCLUDED_NODE_MODULES.has(mod)) continue;
    copyRecursive(path.join(srcModules, mod), path.join(destModules, mod));
  }

  // Add a 1-click shortcut batch script for portable ZIP users
  const shortcutBat = [
    '@echo off',
    'set "APP_DIR=%~dp0"',
    'powershell -NoProfile -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath(\'Desktop\')+\'\\QuestLog.lnk\');$s.TargetPath=\'%APP_DIR%QuestLog.exe\';$s.WorkingDirectory=\'%APP_DIR%\';$s.IconLocation=\'%APP_DIR%runtime\\resources\\app\\public\\app.ico\';$s.Save()"',
    'echo Shortcut QuestLog berhasil dibuat di Desktop!',
    'timeout /t 2 >nul',
  ].join('\r\n');
  fs.writeFileSync(path.join(STAGE_APP, 'Buat-Shortcut-Desktop.bat'), shortcutBat, 'utf-8');

  // 3. Create Portable ZIP using .NET ZipFile
  const zipPath = path.join(RELEASE_DIR, `QuestLog-Portable-v${VERSION}.zip`);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  console.log('[3/5] Compressing QuestLog-Portable-v' + VERSION + '.zip...');
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${STAGE_APP}', '${zipPath}', [System.IO.Compression.CompressionLevel]::Optimal, $true)`,
  ], { stdio: 'inherit' });

  // 4. Compile GUI Setup Installer Stub & append ZIP payload
  console.log('[4/5] Building QuestLog-Setup-v' + VERSION + '.exe installer...');
  const stubCsPath = path.join(STAGE_ROOT, 'InstallerStub.cs');
  const stubExePath = path.join(STAGE_ROOT, 'InstallerStub.exe');
  const finalSetupExe = path.join(RELEASE_DIR, `QuestLog-Setup-v${VERSION}.exe`);

  fs.writeFileSync(stubCsPath, buildInstallerStubCs(), 'utf-8');
  execFileSync(CSC, [
    '/nologo',
    '/target:winexe',
    '/optimize+',
    '/r:System.IO.Compression.dll',
    '/r:System.IO.Compression.FileSystem.dll',
    '/r:System.Windows.Forms.dll',
    '/r:System.Drawing.dll',
    `/win32icon:${path.join(ROOT, 'public', 'app.ico')}`,
    `/out:${stubExePath}`,
    stubCsPath,
  ], { stdio: 'inherit' });

  // Combine StubExe + ZipPayload + 16-byte footer (int64 zipSize + "QLSETUP1")
  const stubBuf = fs.readFileSync(stubExePath);
  const zipStat = fs.statSync(zipPath);
  const footerBuf = Buffer.alloc(16);
  footerBuf.writeBigInt64LE(BigInt(zipStat.size), 0);
  footerBuf.write('QLSETUP1', 8, 'ascii');

  fs.writeFileSync(finalSetupExe, stubBuf);
  const zipStreamBytes = fs.readFileSync(zipPath);
  fs.appendFileSync(finalSetupExe, zipStreamBytes);
  fs.appendFileSync(finalSetupExe, footerBuf);

  // 5. Cleanup staging directory
  console.log('[5/5] Cleaning up staging directory...');
  fs.rmSync(STAGE_ROOT, { recursive: true, force: true });

  const zipSizeMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  const exeSizeMB = (fs.statSync(finalSetupExe).size / (1024 * 1024)).toFixed(1);
  console.log('\n✅ Release build complete!');
  console.log(`   - Installer EXE : ${finalSetupExe} (${exeSizeMB} MB)`);
  console.log(`   - Portable ZIP  : ${zipPath} (${zipSizeMB} MB)`);
}

main();
