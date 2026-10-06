using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace InfinityGrove.VectorGen;

/// <summary>
/// Writes shared/test-vectors/*.json: { family, source, tolerance, generator, cases[] }.
/// Deterministic: fixed seeds, fixed timestamps, counter-derived GUIDs, so a rerun
/// on any machine produces byte-identical files (CI diffs them).
/// </summary>
public static class Program
{
    public static int Main(string[] args)
    {
        var outDir = "../../../shared/test-vectors";
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--out") outDir = args[i + 1];
        }

        Directory.CreateDirectory(outDir);
        var written = new List<string>();

        foreach (var family in BackendFamilies.All())
        {
            written.Add(Write(outDir, family));
        }

#if UNITY_SOURCES
        foreach (var family in UnityFrozenFamilies.All())
        {
            written.Add(Write(outDir, family));
        }
#else
        Console.WriteLine("VectorGen: Unity sources absent; unity-frozen vector files are left untouched (frozen fixtures).");
#endif

        Console.WriteLine($"VectorGen: wrote {written.Count} vector files to {Path.GetFullPath(outDir)}");
        foreach (var name in written) Console.WriteLine($"  {name}");
        return 0;
    }

    private static string Write(string outDir, VectorFamily family)
    {
        // Header fields indented, one compact case per line: small and diff-friendly.
        var compact = new JsonSerializerOptions(Json.Options) { WriteIndented = false };
        string Str(JsonNode node) => node.ToJsonString(compact);
        var sb = new System.Text.StringBuilder();
        sb.Append("{\n");
        sb.Append($"  \"family\": {Str(JsonValue.Create(family.Name))},\n");
        sb.Append($"  \"source\": {Str(JsonValue.Create(family.Source))},\n");
        sb.Append($"  \"tolerance\": {Str(Tolerances.For(family.Name))},\n");
        sb.Append($"  \"generator\": {Str(JsonValue.Create(family.Generator))},\n");
        sb.Append("  \"cases\": [\n");
        for (var i = 0; i < family.Cases.Count; i++)
        {
            sb.Append("    ").Append(Str(family.Cases[i])).Append(i + 1 < family.Cases.Count ? ",\n" : "\n");
        }
        sb.Append("  ]\n}\n");
        var json = sb.ToString();
        var file = $"{family.Name}.json";
        File.WriteAllText(Path.Combine(outDir, file), json, new System.Text.UTF8Encoding(false));
        return file;
    }
}

public sealed record VectorFamily(string Name, string Source, string Generator, List<JsonNode> Cases);

/// <summary>PRD RFR-21 tolerance table, the single place VectorGen reads it from.</summary>
public static class Tolerances
{
    private static readonly Dictionary<string, double> Relative = new()
    {
        ["offline-accrual"] = 1e-9,
        ["catch-up-equivalence"] = 1e-6,
    };

    public static JsonNode For(string family) =>
        Relative.TryGetValue(family, out var rel)
            ? new JsonObject { ["relative"] = rel }
            : JsonValue.Create("exact");
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        TypeInfoResolver = new System.Text.Json.Serialization.Metadata.DefaultJsonTypeInfoResolver(),
        WriteIndented = true,
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>A double as a JSON value; non-finite values become "Infinity"/"-Infinity"/"NaN" strings.</summary>
    public static JsonNode D(double value) =>
        double.IsFinite(value) ? JsonValue.Create(value) : JsonValue.Create(value.ToString(System.Globalization.CultureInfo.InvariantCulture) switch
        {
            "∞" => "Infinity",
            "-∞" => "-Infinity",
            var s => s,
        });
}
