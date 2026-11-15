using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

namespace QuestLogLauncher
{
    class Program
    {
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;

            // Resolve node executable path
            string nodePath = @"C:\Program Files\nodejs\node.exe";
            if (!File.Exists(nodePath))
            {
                nodePath = "node";
            }

            // Check if backend server is running on port 3001
            bool isRunning = false;
            try
            {
                using (var tcp = new TcpClient())
                {
                    var ar = tcp.BeginConnect("127.0.0.1", 3001, null, null);
                    isRunning = ar.AsyncWaitHandle.WaitOne(300);
                }
            }
            catch
            {
                isRunning = false;
            }

            // Start backend server if not running
            if (!isRunning)
            {
                try
                {
                    var srv = new ProcessStartInfo
                    {
                        FileName = nodePath,
                        Arguments = "server.js",
                        WorkingDirectory = appDir,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process.Start(srv);
                    Thread.Sleep(800);
                }
                catch {}
            }

            // Launch Frameless Native Electron Window (Zero OS Title Bar, like Antigravity IDE)
            string electronCli = Path.Combine(appDir, @"node_modules\electron\cli.js");

            var psi = new ProcessStartInfo();
            if (File.Exists(electronCli))
            {
                psi.FileName = nodePath;
                psi.Arguments = "\"" + electronCli + "\" .";
                psi.WorkingDirectory = appDir;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
            }
            else
            {
                // Fallback to Edge app mode if Electron is ever missing
                string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
                if (File.Exists(edgePath))
                {
                    psi.FileName = edgePath;
                    psi.Arguments = "--app=http://localhost:3001/ --start-maximized";
                }
                else
                {
                    psi.FileName = "http://localhost:3001/";
                    psi.UseShellExecute = true;
                }
            }

            try
            {
                var proc = Process.Start(psi);
                if (proc != null)
                {
                    proc.WaitForExit();
                }
            }
            catch {}
        }
    }
}
