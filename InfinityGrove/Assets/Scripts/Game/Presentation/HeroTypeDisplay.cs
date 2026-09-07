using InfinityGrove.Domain;
using UnityEngine;

namespace InfinityGrove.Presentation
{
    /// <summary>
    /// Renders a <see cref="HeroType"/> as a short text tag plus a color, per
    /// NFR-3: type must be distinguishable without relying on color alone, so the
    /// tag text is always shown alongside the color, never color by itself.
    /// </summary>
    public static class HeroTypeDisplay
    {
        public static string Abbreviation(HeroType type)
        {
            switch (type)
            {
                case HeroType.Fire: return "FIR";
                case HeroType.Water: return "WAT";
                case HeroType.Nature: return "NAT";
                case HeroType.Light: return "LIT";
                case HeroType.Dark: return "DRK";
                default: return type.ToString().ToUpperInvariant();
            }
        }

        public static Color Color(HeroType type)
        {
            switch (type)
            {
                case HeroType.Fire: return new Color(0.85f, 0.3f, 0.2f);
                case HeroType.Water: return new Color(0.2f, 0.5f, 0.9f);
                case HeroType.Nature: return new Color(0.3f, 0.75f, 0.3f);
                case HeroType.Light: return new Color(0.95f, 0.85f, 0.4f);
                case HeroType.Dark: return new Color(0.5f, 0.3f, 0.6f);
                default: return UnityEngine.Color.gray;
            }
        }
    }
}
