using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;

namespace QuestLogLauncher
{
    class Program
    {
        [STAThread]
        static void Main()
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;

            // Check if backend server is responsive
            bool isRunning = false;
            try
            {
                using (var client = new HttpClient())
                {
                    client.Timeout = TimeSpan.FromMilliseconds(600);
                    var resp = client.GetAsync("http://localhost:3001/").Result;
                    isRunning = resp.IsSuccessStatusCode;
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
                        FileName = "node",
                        Arguments = "server.js",
                        WorkingDirectory = appDir,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process.Start(srv);
                    Thread.Sleep(1200);
                }
                catch {}
            }

            // Open standalone desktop window in maximized mode
            string edgePath = @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe";
            string chromePath = @"C:\Program Files\Google\Chrome\Application\chrome.exe";

            var psi = new ProcessStartInfo();
            if (File.Exists(edgePath))
            {
                psi.FileName = edgePath;
                psi.Arguments = "--app=http://localhost:3001/ --start-maximized";
            }
            else if (File.Exists(chromePath))
            {
                psi.FileName = chromePath;
                psi.Arguments = "--app=http://localhost:3001/ --start-maximized";
            }
            else
            {
                psi.FileName = "http://localhost:3001/";
                psi.UseShellExecute = true;
            }

            try
            {
                Process.Start(psi);
            }
            catch {}
        }
    }
}
