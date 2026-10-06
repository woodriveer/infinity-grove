using System.Text.Json;
using System.Text.Json.Nodes;
using BreakInfinity;
using InfinityGrove.Backend.Application.Cards;
using InfinityGrove.Backend.Application.Events;
using InfinityGrove.Backend.Application.Progress;
using InfinityGrove.Backend.Domain.Cards;
using InfinityGrove.Backend.Domain.Events;
using InfinityGrove.Backend.Domain.Progress;

namespace InfinityGrove.VectorGen;

/// <summary>Families whose oracle is the backend's own code (AD-18 source: backend).</summary>
public static class BackendFamilies
{
    public static IEnumerable<VectorFamily> All()
    {
        yield return BigNumWire();
        yield return BigNumArithmetic();
        yield return BigNumCompare();
        yield return BigNumFormat();
        yield return FusionCostCurve();
        yield return EventPayloads();
        yield return EventValidation();
    }

    // ---------- big numbers (BreakInfinity.cs) ----------

    private static JsonObject B(BigDouble v) => new() { ["m"] = Json.D(v.Mantissa), ["e"] = v.Exponent };

    /// <summary>RFR-20 edge values plus seeded random ones, as normalized BigDoubles.</summary>
    internal static List<BigDouble> SampleValues()
    {
        var values = new List<BigDouble>
        {
            BigDouble.Zero, BigDouble.One, -BigDouble.One,
            0.9999999999999999, 1.0000000000000002, 9.999999999999998, 10d, 99.99999999999999, 100d,
            0.1, 0.30000000000000004, 1.5, -2.5, 123456789d, 1e15, 1e21 - 1e5, 1e21, 1e22, 2.5e-7,
            new BigDouble(1, 308), new BigDouble(1.7976931348623157, 308), new BigDouble(9.99, 1000),
            new BigDouble(1, -320), new BigDouble(5, 999_999), new BigDouble(1.23456, -999_999),
            new BigDouble(-7.25, 42), new BigDouble(3, 17), new BigDouble(3, 18),
        };
        var rng = new Random(20260706);
        for (var i = 0; i < 24; i++)
        {
            var mantissa = 1 + rng.NextDouble() * 9;
            if (rng.Next(5) == 0) mantissa = -mantissa;
            values.Add(new BigDouble(mantissa, rng.Next(-60, 400)));
        }
        return values;
    }

    private static VectorFamily BigNumWire()
    {
        var cases = new List<JsonNode>();
        double[] doubles =
        {
            0, -0d, 1, -1, 0.5, 2, 10, 1e-5, 123.456, -987654.321, 1e21, 9.999999999999999e22,
            1.7976931348623157e308, double.PositiveInfinity, double.NegativeInfinity, 0.1 + 0.2, 1e15 + 0.3,
            4.35, 1000, 999.9999999999999, 1e-7, 3.0000000000000004,
        };
        foreach (var d in doubles)
        {
            cases.Add(new JsonObject { ["op"] = "fromDouble", ["input"] = Json.D(d), ["result"] = B(BigDouble.FromDouble(d)) });
        }

        (double m, int e)[] raw =
        {
            (12345.678, 0), (0.000123, 5), (-999.9, -3), (10, 0), (0.1, 0), (9.999999999999998, 2), (1e-300, 300),
            (-0.0, 7), (0, 12), (99.99999999999999, -1), (1e20, 10), (7.5, int.MaxValue - 1), (1, int.MinValue + 1),
        };
        foreach (var (m, e) in raw)
        {
            cases.Add(new JsonObject
            {
                ["op"] = "construct", ["input"] = new JsonObject { ["m"] = Json.D(m), ["e"] = e },
                ["result"] = B(new BigDouble(m, e)),
            });
        }

        string[] texts = { "1e5", "1.5e300", "123456", "  42 ", "-3.2E-7", "0", "abc", "1e", "", "4.2e+21", "1e1000000", "NaN" };
        foreach (var t in texts)
        {
            JsonNode result;
            try
            {
                result = BigDouble.TryParse(t, out var parsed) ? B(parsed) : JsonValue.Create("invalid");
            }
            catch (Exception ex)
            {
                result = JsonValue.Create("error:" + ex.GetType().Name);
            }
            cases.Add(new JsonObject { ["op"] = "parse", ["input"] = t, ["result"] = result });
        }

        foreach (var v in SampleValues())
        {
            cases.Add(new JsonObject { ["op"] = "toDouble", ["input"] = B(v), ["result"] = Json.D(v.ToDouble()) });
        }

        return new VectorFamily("bignum-wire", "backend", "BreakInfinity.BigDouble: FromDouble, ctor normalize, TryParse, ToDouble", cases);
    }

    private static VectorFamily BigNumArithmetic()
    {
        var values = SampleValues();
        var subset = values.Where((_, i) => i % 2 == 0).ToList();
        var cases = new List<JsonNode>();
        foreach (var a in subset)
        {
            foreach (var b in subset)
            {
                cases.Add(Op("add", a, b, () => a + b));
                cases.Add(Op("sub", a, b, () => a - b));
                cases.Add(Op("mul", a, b, () => a * b));
                cases.Add(Op("div", a, b, () => a / b));
            }
        }
        double[] powers = { 0, 1, 2, 3, 0.5, 1.15, -1, 10, 0.3333333333333333 };
        foreach (var a in values)
        {
            foreach (var p in powers)
            {
                JsonNode result;
                try { result = B(a.Pow(p)); }
                catch (Exception ex) { result = JsonValue.Create("error:" + ex.GetType().Name); }
                cases.Add(new JsonObject { ["op"] = "pow", ["a"] = B(a), ["p"] = Json.D(p), ["result"] = result });
            }
            cases.Add(new JsonObject { ["op"] = "negate", ["a"] = B(a), ["result"] = B(-a) });
            cases.Add(new JsonObject { ["op"] = "abs", ["a"] = B(a), ["result"] = B(a.Abs()) });
        }
        return new VectorFamily("bignum-arithmetic", "backend", "BreakInfinity.BigDouble operators + - * / Pow Negate Abs", cases);

        static JsonObject Op(string op, BigDouble a, BigDouble b, Func<BigDouble> f)
        {
            JsonNode result;
            try { result = B(f()); }
            catch (Exception ex) { result = JsonValue.Create("error:" + ex.GetType().Name); }
            return new JsonObject { ["op"] = op, ["a"] = B(a), ["b"] = B(b), ["result"] = result };
        }
    }

    private static VectorFamily BigNumCompare()
    {
        var values = SampleValues();
        values.Add(new BigDouble(1.0000000001, 3));
        values.Add(new BigDouble(1.00000000001, 3));
        values.Add(new BigDouble(1, 3));
        var cases = new List<JsonNode>();
        foreach (var a in values)
        {
            foreach (var b in values)
            {
                cases.Add(new JsonObject
                {
                    ["a"] = B(a), ["b"] = B(b),
                    ["compareTo"] = a.CompareTo(b), ["equals"] = a.Equals(b),
                    ["max"] = B(BigDouble.Max(a, b)), ["min"] = B(BigDouble.Min(a, b)),
                });
            }
        }
        return new VectorFamily("bignum-compare", "backend", "BreakInfinity.BigDouble CompareTo, Equals (1e-9 mantissa tolerance), Max, Min", cases);
    }

    private static VectorFamily BigNumFormat()
    {
        var values = SampleValues();
        double[] extra = { 1.005, 2.675, 1234.5, 0.125, 999.995, 1e20, 123456789012345680000d, 0.001, 7, 1.115 };
        values.AddRange(extra.Select(d => (BigDouble)d));
        var cases = new List<JsonNode>();
        foreach (var v in values)
        {
            cases.Add(new JsonObject
            {
                ["value"] = B(v),
                ["default"] = v.ToString(),
                ["dp0"] = v.ToString(0),
                ["dp4"] = v.ToString(4),
            });
        }
        return new VectorFamily("bignum-format", "backend", "BreakInfinity.BigDouble.ToString(decimalPlaces), parent FR-25 notation", cases);
    }

    // ---------- fusion ----------

    private static VectorFamily FusionCostCurve()
    {
        var cases = new List<JsonNode>();
        for (var tier = 0; tier <= CardFusionCostCurve.MaxStarTier + 1; tier++)
        {
            cases.Add(new JsonObject
            {
                ["currentStarTier"] = tier,
                ["duplicatesRequired"] = CardFusionCostCurve.DuplicatesRequiredForNextTier(tier),
                ["maxStarTier"] = CardFusionCostCurve.MaxStarTier,
            });
        }
        return new VectorFamily("fusion-cost-curve", "backend", "CardFusionCostCurve (backend star tiers are 0-based)", cases);
    }

    // ---------- events ----------

    /// <summary>ASP.NET Core's JSON defaults: what the backend's model binding uses for payload JSON.</summary>
    private static readonly JsonSerializerOptions WebOptions = new(JsonSerializerDefaults.Web);

    internal static Guid G(int n) => new($"00000000-0000-4000-8000-{n:x12}");

    private static VectorFamily EventPayloads()
    {
        var cases = new List<JsonNode>();
        void Add(string type, object payload) => cases.Add(new JsonObject
        {
            ["type"] = type,
            ["json"] = JsonSerializer.Serialize(payload, payload.GetType(), WebOptions),
        });

        foreach (var v in SampleValues().Where(v => v.Sign() > 0).Take(12))
        {
            Add("GoldEarned", new GoldEarnedPayload(v.Mantissa, v.Exponent));
            Add("GoldSpent", new GoldSpentPayload(v.Mantissa, v.Exponent));
        }
        foreach (var s in new[] { 1, 2, 17, 250, 100000 }) Add("StageCleared", new StageClearedPayload(s));
        foreach (var n in new[] { 1, 42, 0xABCDEF }) Add("HeroAcquired", new HeroAcquiredPayload(G(n)));
        Add("ActiveSquadChanged", new ActiveSquadChangedPayload(Array.Empty<Guid>()));
        Add("ActiveSquadChanged", new ActiveSquadChangedPayload(new[] { G(1) }));
        Add("ActiveSquadChanged", new ActiveSquadChangedPayload(new[] { G(1), G(2), G(3), G(4), G(5) }));
        return new VectorFamily("event-payloads", "backend", "System.Text.Json (JsonSerializerDefaults.Web) of Application/Events/EventPayloads.cs records", cases);
    }

    private sealed record EventSpec(string Type, long Seq, JsonObject Payload, int? ClientEventId = null);

    private static VectorFamily EventValidation()
    {
        static JsonObject Gold(double m, int e) => new() { ["goldMantissa"] = m, ["goldExponent"] = e };
        static JsonObject Stage(int n) => new() { ["stageNumber"] = n };
        static JsonObject Hero(int n) => new() { ["heroDefinitionId"] = G(n).ToString() };
        static JsonObject Squad(params int[] ns) => new() { ["heroDefinitionIds"] = new JsonArray(ns.Select(n => (JsonNode)G(n).ToString()).ToArray()) };

        var scenarios = new List<(string name, List<List<EventSpec>> batches)>
        {
            ("earn-and-spend", new() { new() {
                new("GoldEarned", 1, Gold(5, 1)), new("GoldSpent", 2, Gold(2.5, 1)), new("GoldSpent", 3, Gold(1, 2)),
                new("GoldEarned", 4, Gold(1.5, 300)), new("GoldSpent", 5, Gold(1, 300)) } }),
            ("negative-gold", new() { new() { new("GoldEarned", 1, Gold(-3, 0)), new("GoldSpent", 2, Gold(-1, 0)) } }),
            ("stages-in-order", new() { new() {
                new("StageCleared", 1, Stage(1)), new("StageCleared", 2, Stage(3)), new("StageCleared", 3, Stage(2)),
                new("StageCleared", 4, Stage(1)), new("StageCleared", 5, Stage(0)), new("StageCleared", 6, Stage(3)) } }),
            ("roster-and-squad", new() { new() {
                new("HeroAcquired", 1, Hero(1)), new("HeroAcquired", 2, Hero(1)), new("HeroAcquired", 3, Hero(2)),
                new("ActiveSquadChanged", 4, Squad(1, 2)), new("ActiveSquadChanged", 5, Squad(1, 3)),
                new("ActiveSquadChanged", 6, Squad(1, 1)), new("ActiveSquadChanged", 7, Squad()) } }),
            ("squad-cap", new() { new() {
                new("HeroAcquired", 1, Hero(1)), new("HeroAcquired", 2, Hero(2)), new("HeroAcquired", 3, Hero(3)),
                new("HeroAcquired", 4, Hero(4)), new("HeroAcquired", 5, Hero(5)), new("HeroAcquired", 6, Hero(6)),
                new("ActiveSquadChanged", 7, Squad(1, 2, 3, 4, 5)), new("ActiveSquadChanged", 8, Squad(1, 2, 3, 4, 5, 6)) } }),
            ("malformed-payloads", new() { new() {
                new("StageCleared", 1, new JsonObject()), new("GoldEarned", 2, new JsonObject()),
                new("ActiveSquadChanged", 3, new JsonObject()), new("GoldEarned", 4, new JsonObject { ["goldMantissa"] = "x" }) } }),
            ("out-of-order-sequence", new() { new() {
                new("GoldEarned", 3, Gold(3, 0)), new("GoldEarned", 1, Gold(1, 0)), new("GoldSpent", 2, Gold(2, 0)) } }),
            ("resend-and-stale", new()
            {
                new() { new("GoldEarned", 1, Gold(1, 1), 501), new("GoldSpent", 2, Gold(5, 1), 502) },
                new() { new("GoldEarned", 1, Gold(1, 1), 501), new("GoldSpent", 2, Gold(5, 1), 502), new("GoldEarned", 1, Gold(9, 9), 503), new("GoldEarned", 3, Gold(2, 0), 504) },
            }),
        };

        var cases = new List<JsonNode>();
        foreach (var (name, batches) in scenarios)
        {
            cases.Add(RunScenario(name, batches));
        }
        return new VectorFamily("event-validation", "backend", "PlayerEventIngestionService.IngestAsync over in-memory repositories (real PlayerProgress rules)", cases);
    }

    private static JsonObject RunScenario(string name, List<List<EventSpec>> batches)
    {
        var accountId = G(999_999);
        var progressRepo = new InMemoryProgressRepository();
        var eventRepo = new InMemoryEventRepository();
        var service = new PlayerEventIngestionService(progressRepo, eventRepo, new InMemoryCardRepository(), new FixedTimeProvider());
        var batchNodes = new JsonArray();
        var autoId = 1;
        foreach (var batch in batches)
        {
            var commands = batch.Select(e =>
            {
                var id = e.ClientEventId ?? autoId++;
                var payloadJson = e.Payload.ToJsonString();
                using var doc = JsonDocument.Parse(payloadJson);
                return new IngestEventCommand(
                    G(id), e.Seq, Enum.Parse<PlayerEventType>(e.Type), FixedTimeProvider.Epoch, doc.RootElement.Clone());
            }).ToList();
            var result = service.IngestAsync(accountId, commands, CancellationToken.None).GetAwaiter().GetResult();
            batchNodes.Add(new JsonObject
            {
                ["events"] = new JsonArray(commands.Select((c, i) => (JsonNode)new JsonObject
                {
                    ["clientEventId"] = c.ClientEventId.ToString(),
                    ["sequenceNumber"] = c.SequenceNumber,
                    ["type"] = c.Type.ToString(),
                    ["payload"] = JsonNode.Parse(c.Payload.GetRawText()),
                }).ToArray()),
                ["results"] = new JsonArray(result.Results.Select(r => (JsonNode)new JsonObject
                {
                    ["clientEventId"] = r.ClientEventId.ToString(),
                    ["status"] = r.Status.ToString(),
                    ["rejectionReason"] = r.RejectionReason,
                }).ToArray()),
                ["state"] = Snapshot(result.CanonicalState),
            });
        }
        return new JsonObject { ["scenario"] = name, ["batches"] = batchNodes };
    }

    private static JsonObject Snapshot(PlayerProgressSnapshot s) => new()
    {
        ["goldMantissa"] = Json.D(s.GoldMantissa),
        ["goldExponent"] = s.GoldExponent,
        ["furthestStageCleared"] = s.FurthestStageCleared,
        ["lastAppliedSequence"] = s.LastAppliedSequence,
        ["roster"] = new JsonArray(s.Roster.Select(r => (JsonNode)new JsonObject
        {
            ["heroDefinitionId"] = r.HeroDefinitionId.ToString(),
            ["ownedCount"] = r.OwnedCount,
            ["starTier"] = r.StarTier,
        }).ToArray()),
        ["activeSquadHeroIds"] = new JsonArray(s.ActiveSquadHeroIds.Select(g => (JsonNode)g.ToString()).ToArray()),
    };

    private sealed class FixedTimeProvider : TimeProvider
    {
        public static readonly DateTimeOffset Epoch = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Epoch;
    }

    private sealed class InMemoryProgressRepository : IPlayerProgressRepository
    {
        private readonly Dictionary<Guid, PlayerProgress> _rows = new();
        public Task<PlayerProgress> GetByAccountIdAsync(Guid accountId, CancellationToken cancellationToken) =>
            Task.FromResult(_rows.GetValueOrDefault(accountId));
        public Task AddAsync(PlayerProgress progress, CancellationToken cancellationToken)
        {
            _rows[progress.AccountId] = progress;
            return Task.CompletedTask;
        }
        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class InMemoryEventRepository : IPlayerEventRepository
    {
        private readonly List<PlayerEvent> _events = new();
        public Task<PlayerEvent> FindByClientEventIdAsync(Guid accountId, Guid clientEventId, CancellationToken cancellationToken) =>
            Task.FromResult(_events.FirstOrDefault(e => e.AccountId == accountId && e.ClientEventId == clientEventId));
        public Task AddRangeAsync(IEnumerable<PlayerEvent> events, CancellationToken cancellationToken)
        {
            _events.AddRange(events);
            return Task.CompletedTask;
        }
        public Task<IReadOnlyList<AccountEventCount>> CountEventsByAccountSinceAsync(
            PlayerEventType type, DateTimeOffset sinceUtc, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<AccountEventCount>>(Array.Empty<AccountEventCount>());
    }

    private sealed class InMemoryCardRepository : ICardInstanceRepository
    {
        private readonly List<CardInstance> _cards = new();
        public Task<CardInstance> GetByIdAsync(Guid cardInstanceId, CancellationToken cancellationToken) =>
            Task.FromResult(_cards.FirstOrDefault(c => c.Id == cardInstanceId));
        public Task<List<CardInstance>> GetOwnedByHeroAsync(Guid accountId, Guid heroDefinitionId, int take, CancellationToken cancellationToken) =>
            Task.FromResult(_cards.Where(c => c.AccountId == accountId && c.HeroDefinitionId == heroDefinitionId).Take(take).ToList());
        public Task<List<CardInstance>> GetByAccountAsync(Guid accountId, CancellationToken cancellationToken) =>
            Task.FromResult(_cards.Where(c => c.AccountId == accountId).ToList());
        public Task AddAsync(CardInstance cardInstance, CancellationToken cancellationToken)
        {
            _cards.Add(cardInstance);
            return Task.CompletedTask;
        }
        public Task SaveChangesAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
