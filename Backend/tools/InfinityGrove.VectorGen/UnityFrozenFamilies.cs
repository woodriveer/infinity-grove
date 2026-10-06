#if UNITY_SOURCES
using System.Text.Json.Nodes;
using InfinityGrove.Domain;

namespace InfinityGrove.VectorGen;

/// <summary>
/// Families whose only truthful reference is the Unity client's C# (AD-18 source:
/// unity-frozen). Generated from InfinityGrove/Assets/Scripts/Game/{Domain,Data}
/// while that tree exists; frozen after the Unity archive. Where a rule's
/// composition lived in a Unity Service class (FusionService.GetPreview,
/// StageService squad power), the few composing lines are mirrored here verbatim
/// and named in the family's generator note.
/// </summary>
public static class UnityFrozenFamilies
{
    public static IEnumerable<VectorFamily> All()
    {
        yield return Damage();
        yield return StageOutcome();
        yield return RosterRules();
        yield return FusionRules();
        yield return Crafting();
        yield return OfflineAccrual();
        yield return LoadoutPresets();
        yield return ReconciliationMessages();
    }

    private static VectorFamily Damage()
    {
        var cases = new List<JsonNode>();
        foreach (var level in new[] { -1, 0, 1, 2, 7, 100 })
        foreach (var perLevel in new[] { 0, 1, 5, 13 })
        foreach (var bonus in new[] { -50, 0, 10, 250 })
        {
            cases.Add(new JsonObject
            {
                ["op"] = "playerDamage", ["level"] = level, ["damagePerLevel"] = perLevel, ["bonusDamage"] = bonus,
                ["result"] = DamageCalculator.CalculatePlayerDamage(level, perLevel, bonus),
            });
        }

        // MonsterEntity.TakeDamage sequences: HP clamps at 0, defeat fires exactly once.
        int[][] hits = { new[] { 10, 10, 10, 10, 10 }, new[] { 49, 1, 5 }, new[] { 100 }, new[] { 0, 0 }, new[] { 25, 30, 1 } };
        foreach (var seq in hits)
        {
            var monster = new MonsterEntity("Slime", null, 50, 7);
            var defeatedCount = 0;
            monster.OnDefeated += () => defeatedCount++;
            var hpAfter = new JsonArray();
            foreach (var h in seq)
            {
                monster.TakeDamage(h);
                hpAfter.Add(monster.CurrentHp);
            }
            cases.Add(new JsonObject
            {
                ["op"] = "monsterHits", ["maxHp"] = 50, ["hits"] = new JsonArray(seq.Select(h => (JsonNode)h).ToArray()),
                ["hpAfter"] = hpAfter, ["defeatedCount"] = defeatedCount,
            });
        }
        return new VectorFamily("damage", "unity-frozen", "DamageCalculator.CalculatePlayerDamage; MonsterEntity.TakeDamage", cases);
    }

    private static VectorFamily StageOutcome()
    {
        var types = Enum.GetValues<HeroType>();
        var cases = new List<JsonNode>();
        HeroType[][] squads =
        {
            Array.Empty<HeroType>(), new[] { HeroType.Fire }, new[] { HeroType.Water, HeroType.Nature },
            new[] { HeroType.Fire, HeroType.Water, HeroType.Nature, HeroType.Light, HeroType.Dark },
            new[] { HeroType.Dark, HeroType.Dark },
        };
        foreach (var favored in types)
        foreach (var squad in squads)
        foreach (var (power, floor) in new[] { (0, 0), (99, 100), (100, 100), (101, 100), (5000, 250) })
        {
            cases.Add(new JsonObject
            {
                ["squadPower"] = power, ["powerFloor"] = floor, ["favoredType"] = favored.ToString(),
                ["squadTypes"] = new JsonArray(squad.Select(t => (JsonNode)t.ToString()).ToArray()),
                ["outcome"] = StageOutcomeClassifier.Classify(power, floor, favored, squad).ToString(),
            });
        }
        return new VectorFamily("stage-outcome", "unity-frozen", "StageOutcomeClassifier.Classify (FR-11 two-way classification)", cases);
    }

    private static VectorFamily RosterRules()
    {
        var cases = new List<JsonNode>
        {
            new JsonObject { ["op"] = "capacity", ["activeSquadCapacity"] = InfinityGrove.Domain.RosterRules.ActiveSquadCapacity },
        };
        foreach (var (owned, star) in new[] { (0, 1), (1, 1), (2, 1), (5, 3), (13, 12), (1, 0) })
        {
            var hero = new HeroEntity(NewHero("h"), 4, 9);
            hero.ReconcileTo(owned, star);
            cases.Add(new JsonObject
            {
                ["op"] = "reconcileTo", ["ownedCount"] = owned, ["starTier"] = star,
                ["resultDuplicatesOwned"] = hero.DuplicatesOwned, ["resultStarTier"] = hero.StarTier,
            });
        }
        return new VectorFamily("roster-rules", "unity-frozen", "RosterRules.ActiveSquadCapacity; HeroEntity.ReconcileTo", cases);
    }

    private static VectorFamily FusionRules()
    {
        var cases = new List<JsonNode>();
        var data = NewHero("frozen-hero");
        for (var i = 0; i < 12; i++) data.abilityByStarTier[i] = i % 4 == 3 ? "" : $"Ability {i + 1}";
        for (var tier = 1; tier <= 13; tier++)
        for (var dupes = 0; dupes <= 14; dupes += 1)
        {
            // FusionService.GetPreview, mirrored verbatim (Unity Service layer).
            var hero = new HeroEntity(data, tier, dupes);
            var isMax = hero.StarTier >= InfinityGrove.Domain.FusionRules.MaxStarTier;
            var required = InfinityGrove.Domain.FusionRules.DuplicatesRequiredForNextTier(hero.StarTier);
            var canFuse = !isMax && InfinityGrove.Domain.FusionRules.CanFuse(hero.StarTier, hero.DuplicatesOwned);
            var nextAbility = isMax ? "Max star tier reached." : hero.Data.GetAbilityDescription(hero.StarTier + 1);
            var node = new JsonObject
            {
                ["starTier"] = tier, ["duplicatesOwned"] = dupes,
                ["duplicatesRequired"] = required, ["canFuse"] = canFuse, ["isMaxTier"] = isMax,
                ["nextTierAbilityDescription"] = nextAbility,
            };
            if (canFuse)
            {
                hero.ApplyFusion(required);
                node["afterFuse"] = new JsonObject { ["starTier"] = hero.StarTier, ["duplicatesOwned"] = hero.DuplicatesOwned };
            }
            cases.Add(node);
        }
        return new VectorFamily("fusion-rules", "unity-frozen",
            "FusionRules + HeroData.GetAbilityDescription + FusionService.GetPreview/TryFuse (client star tiers are 1-based); ability table: 'Ability n' except every 4th tier empty",
            cases);
    }

    private static VectorFamily Crafting()
    {
        var cases = new List<JsonNode>();
        foreach (var slot in Enum.GetValues<EquipmentSlot>())
        {
            cases.Add(new JsonObject
            {
                ["op"] = "affixesForSlot", ["slot"] = slot.ToString(),
                ["affixes"] = new JsonArray(CraftingRules.AffixesForSlot(slot).Select(a => (JsonNode)a.ToString()).ToArray()),
            });
        }
        foreach (var affix in Enum.GetValues<AffixType>())
        {
            var (min, max) = CraftingRules.AffixRange(affix);
            cases.Add(new JsonObject { ["op"] = "affixRange", ["affix"] = affix.ToString(), ["min"] = Json.D(min), ["max"] = Json.D(max) });
        }
        cases.Add(new JsonObject { ["op"] = "rerollCost", ["cost"] = CraftingRules.RerollCost });
        return new VectorFamily("crafting-rules", "unity-frozen", "CraftingRules.AffixesForSlot / AffixRange / RerollCost (preview only; rolls are server-side, AD-22)", cases);
    }

    private static VectorFamily OfflineAccrual()
    {
        var epoch = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var cases = new List<JsonNode>();
        long[] elapsedMs = { -5000, 0, 1, 999, 60_000, 3_600_000, 5_400_000, 8 * 3_600_000L, 12 * 3_600_000L, 12 * 3_600_000L + 1, 3 * 86_400_000L };
        int[] powers = { 0, 1, 10, 37, 1200 };
        double[] rates = { 0, 1.0, 2.5, 0.001 };
        double[] capHours = { 12, 8, 0.5 };
        foreach (var ms in elapsedMs)
        foreach (var power in powers)
        foreach (var rate in rates)
        foreach (var cap in capHours)
        {
            if (power == 0 && rate != 1.0) continue;
            var r = OfflineAccrualCalculator.Calculate(epoch, epoch.AddMilliseconds(ms), power, rate, TimeSpan.FromHours(cap));
            cases.Add(new JsonObject
            {
                ["elapsedMs"] = ms, ["activeSquadPower"] = power, ["goldPerSquadPowerPerHour"] = Json.D(rate), ["capHours"] = Json.D(cap),
                ["gold"] = new JsonObject { ["m"] = Json.D(r.GoldAccrued.Mantissa), ["e"] = r.GoldAccrued.Exponent },
                ["elapsedActualMs"] = (long)r.ElapsedActual.TotalMilliseconds,
                ["elapsedCreditedMs"] = (long)r.ElapsedCredited.TotalMilliseconds,
                ["wasCapped"] = r.WasCapped,
            });
        }
        return new VectorFamily("offline-accrual", "unity-frozen", "OfflineAccrualCalculator.Calculate (TimeSpan.TotalHours = ticks / 3.6e10)", cases);
    }

    private static VectorFamily LoadoutPresets()
    {
        var cases = new List<JsonNode>();
        var preset = new LoadoutPreset(Archetype.Agility, "ranger");
        preset.SetSlot(EquipmentSlot.Weapon, "a");
        preset.SetSlot(EquipmentSlot.Boots, "b");
        preset.SetSlot(EquipmentSlot.Weapon, "c");
        var slots = new JsonObject();
        foreach (var slot in Enum.GetValues<EquipmentSlot>())
        {
            slots[slot.ToString()] = preset.TryGetSlot(slot, out var id) ? id : null;
        }
        cases.Add(new JsonObject
        {
            ["archetype"] = preset.Archetype.ToString(), ["heroId"] = preset.HeroId,
            ["writes"] = new JsonArray(new JsonObject { ["Weapon"] = "a" }, new JsonObject { ["Boots"] = "b" }, new JsonObject { ["Weapon"] = "c" }),
            ["slots"] = slots,
        });
        cases.Add(new JsonObject
        {
            ["archetypes"] = new JsonArray(Enum.GetValues<Archetype>().Select(a => (JsonNode)a.ToString()).ToArray()),
            ["slotOrder"] = new JsonArray(Enum.GetValues<EquipmentSlot>().Select(s => (JsonNode)s.ToString()).ToArray()),
        });
        return new VectorFamily("loadout-preset", "unity-frozen", "LoadoutPreset.SetSlot/TryGetSlot (last write wins); Archetype and EquipmentSlot order", cases);
    }

    private static VectorFamily ReconciliationMessages()
    {
        var cases = new List<JsonNode>();
        foreach (var type in Enum.GetValues<PlayerEventType>())
        {
            var c = new ReconciliationCorrection(type, "Insufficient gold: have 5.00, need 10.00.", DateTimeOffset.UnixEpoch);
            cases.Add(new JsonObject { ["eventType"] = type.ToString(), ["reason"] = c.Reason, ["message"] = c.ToPlayerMessage() });
        }
        return new VectorFamily("reconciliation-messages", "unity-frozen", "ReconciliationCorrection.ToPlayerMessage", cases);
    }

    private static HeroData NewHero(string id)
    {
        var data = new HeroData { heroId = id, displayName = id, basePower = 10 };
        return data;
    }
}
#endif
