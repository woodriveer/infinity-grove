using UnityEditor;
using UnityEngine;
using UnityEditor.Build.Reporting;
using System.IO;

namespace InfinityGrove.Editor
{
    public static class BuildScript
    {
        [MenuItem("Tools/InfinityGrove/Build Windows")]
        public static void BuildWindows()
        {
            string buildDirectory = "Builds/Windows";
            if (!Directory.Exists(buildDirectory))
            {
                Directory.CreateDirectory(buildDirectory);
            }

            string buildPath = Path.Combine(buildDirectory, "InfinityGrove.exe");
            string[] scenes = new string[]
            {
                "Assets/Scenes/Main Menu.unity",
                "Assets/Scenes/Game Scene.unity"
            };

            BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = buildPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };

            Debug.Log("Starting InfinityGrove Windows Build...");
            BuildReport report = BuildPipeline.BuildPlayer(buildPlayerOptions);
            BuildSummary summary = report.summary;

            if (summary.result == BuildResult.Succeeded)
            {
                Debug.Log($"BUILD_SUCCESS: {summary.totalSize} bytes in {summary.totalTime.TotalSeconds:F1}s at {buildPath}");
            }
            else
            {
                Debug.LogError($"BUILD_FAILED with {summary.totalErrors} error(s)");
                if (Application.isBatchMode)
                {
                    EditorApplication.Exit(1);
                }
            }
        }
    }
}
