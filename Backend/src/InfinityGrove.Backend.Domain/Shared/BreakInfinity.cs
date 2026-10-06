using System;
using System.Globalization;

namespace BreakInfinity
{
    /// <summary>
    /// Arbitrary-range big-number type for currency and cost math (PRD FR-25/NFR-1,
    /// Architecture AD-7). Represented as a normalized (mantissa, exponent) pair —
    /// value = Mantissa * 10^Exponent — so it survives growth from low hundreds into
    /// indefinite exponential territory without overflow, at the cost of exact
    /// low-order precision (double-precision mantissa only). The backend owns this
    /// file (refactor-unity-to-phaser4 RFR-18). The Phaser client mirrors its
    /// behavior in Client/src/domain/bignum, proven by the vectors VectorGen emits
    /// into shared/test-vectors/ (AD-7/AD-18).
    /// </summary>
    [Serializable]
    public struct BigDouble : IComparable<BigDouble>, IEquatable<BigDouble>, IComparable
    {
        public const double Tolerance = 1e-9;
        private const long ExponentThreshold = 21;

        public double Mantissa;
        public int Exponent;

        public static readonly BigDouble Zero = new BigDouble(0, 0);
        public static readonly BigDouble One = new BigDouble(1, 0);

        public BigDouble(double mantissa, int exponent)
        {
            Mantissa = mantissa;
            Exponent = exponent;
            Normalize();
        }

        /// <summary>Constructs without normalizing. Caller guarantees mantissa is already in [1,10) (or 0).</summary>
        private BigDouble(double mantissa, int exponent, bool _)
        {
            Mantissa = mantissa;
            Exponent = exponent;
        }

        public static BigDouble FromMantissaExponentNoNormalize(double mantissa, int exponent) =>
            new BigDouble(mantissa, exponent, true);

        public static BigDouble FromDouble(double value)
        {
            if (double.IsNaN(value))
            {
                throw new ArgumentException("Cannot represent NaN as a BigDouble.", nameof(value));
            }

            if (value == 0d || double.IsInfinity(value))
            {
                return value > 0
                    ? new BigDouble(1, int.MaxValue, true)
                    : (value < 0 ? new BigDouble(-1, int.MaxValue, true) : Zero);
            }

            var exponent = (int)Math.Floor(Math.Log10(Math.Abs(value)));
            var mantissa = value / Math.Pow(10, exponent);
            return new BigDouble(mantissa, exponent);
        }

        public static implicit operator BigDouble(double value) => FromDouble(value);

        public static BigDouble Parse(string value)
        {
            if (!TryParse(value, out var result))
            {
                throw new FormatException($"'{value}' is not a valid BigDouble.");
            }

            return result;
        }

        public static bool TryParse(string value, out BigDouble result)
        {
            result = Zero;
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            value = value.Trim();
            var eIndex = value.IndexOfAny(new[] { 'e', 'E' });
            if (eIndex >= 0)
            {
                var mantissaPart = value.Substring(0, eIndex);
                var exponentPart = value.Substring(eIndex + 1);
                if (!double.TryParse(mantissaPart, NumberStyles.Float, CultureInfo.InvariantCulture, out var mantissa) ||
                    !int.TryParse(exponentPart, NumberStyles.Integer, CultureInfo.InvariantCulture, out var exponent))
                {
                    return false;
                }

                result = new BigDouble(mantissa, exponent);
                return true;
            }

            if (!double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var plain))
            {
                return false;
            }

            result = FromDouble(plain);
            return true;
        }

        private void Normalize()
        {
            if (Mantissa == 0d)
            {
                Exponent = 0;
                return;
            }

            if (double.IsNaN(Mantissa))
            {
                throw new InvalidOperationException("BigDouble mantissa became NaN.");
            }

            var sign = Math.Sign(Mantissa);
            var absMantissa = Math.Abs(Mantissa);

            var shift = (int)Math.Floor(Math.Log10(absMantissa));
            if (shift != 0)
            {
                absMantissa /= Math.Pow(10, shift);
                Exponent += shift;
            }

            // Guard against log10 rounding landing just outside [1,10) at the boundary.
            while (absMantissa >= 10d)
            {
                absMantissa /= 10d;
                Exponent++;
            }

            while (absMantissa < 1d)
            {
                absMantissa *= 10d;
                Exponent--;
            }

            Mantissa = sign * absMantissa;
        }

        public readonly double ToDouble()
        {
            if (Exponent > 308)
            {
                return Mantissa > 0 ? double.PositiveInfinity : double.NegativeInfinity;
            }

            if (Exponent < -324)
            {
                return 0d;
            }

            return Mantissa * Math.Pow(10, Exponent);
        }

        public readonly BigDouble Abs() => new BigDouble(Math.Abs(Mantissa), Exponent, true);

        public readonly int Sign() => Math.Sign(Mantissa);

        public readonly BigDouble Negate() => new BigDouble(-Mantissa, Exponent, true);

        public static BigDouble operator -(BigDouble value) => value.Negate();

        public static BigDouble operator +(BigDouble a, BigDouble b)
        {
            if (a.Mantissa == 0d) return b;
            if (b.Mantissa == 0d) return a;

            BigDouble larger, smaller;
            if (a.Exponent >= b.Exponent)
            {
                larger = a;
                smaller = b;
            }
            else
            {
                larger = b;
                smaller = a;
            }

            var exponentDiff = larger.Exponent - smaller.Exponent;
            if (exponentDiff > 17)
            {
                // The smaller value cannot influence a double-precision mantissa at this magnitude gap.
                return larger;
            }

            var combinedMantissa = larger.Mantissa + smaller.Mantissa / Math.Pow(10, exponentDiff);
            return new BigDouble(combinedMantissa, larger.Exponent);
        }

        public static BigDouble operator -(BigDouble a, BigDouble b) => a + b.Negate();

        public static BigDouble operator *(BigDouble a, BigDouble b) =>
            new BigDouble(a.Mantissa * b.Mantissa, a.Exponent + b.Exponent);

        public static BigDouble operator /(BigDouble a, BigDouble b)
        {
            if (b.Mantissa == 0d)
            {
                throw new DivideByZeroException("Cannot divide a BigDouble by zero.");
            }

            return new BigDouble(a.Mantissa / b.Mantissa, a.Exponent - b.Exponent);
        }

        /// <summary>Raises this value to an integer/real power via log-space math, valid for positive bases.</summary>
        public readonly BigDouble Pow(double power)
        {
            if (power == 0d) return One;
            if (Mantissa == 0d) return Zero;
            if (Mantissa < 0d)
            {
                throw new InvalidOperationException("Pow is only defined for non-negative BigDouble bases.");
            }

            var log10 = Math.Log10(Mantissa) + Exponent;
            var newLog10 = log10 * power;
            var newExponent = (int)Math.Floor(newLog10);
            var newMantissa = Math.Pow(10, newLog10 - newExponent);
            return new BigDouble(newMantissa, newExponent);
        }

        public static BigDouble Max(BigDouble a, BigDouble b) => a >= b ? a : b;

        public static BigDouble Min(BigDouble a, BigDouble b) => a <= b ? a : b;

        public readonly int CompareTo(BigDouble other)
        {
            if (Mantissa == 0d && other.Mantissa == 0d) return 0;
            if (Mantissa == 0d) return other.Mantissa > 0 ? -1 : 1;
            if (other.Mantissa == 0d) return Mantissa > 0 ? 1 : -1;

            var signA = Math.Sign(Mantissa);
            var signB = Math.Sign(other.Mantissa);
            if (signA != signB) return signA.CompareTo(signB);

            var exponentCompare = Exponent.CompareTo(other.Exponent);
            if (exponentCompare != 0) return signA > 0 ? exponentCompare : -exponentCompare;

            return Mantissa.CompareTo(other.Mantissa);
        }

        public readonly int CompareTo(object? obj)
        {
            if (obj is BigDouble other) return CompareTo(other);
            throw new ArgumentException("Object is not a BigDouble.", nameof(obj));
        }

        public readonly bool Equals(BigDouble other) =>
            Math.Abs(Mantissa - other.Mantissa) < Tolerance && Exponent == other.Exponent;

        public override readonly bool Equals(object? obj) => obj is BigDouble other && Equals(other);

        public override readonly int GetHashCode() => HashCode.Combine(Math.Round(Mantissa, 6), Exponent);

        public static bool operator ==(BigDouble a, BigDouble b) => a.Equals(b);
        public static bool operator !=(BigDouble a, BigDouble b) => !a.Equals(b);
        public static bool operator <(BigDouble a, BigDouble b) => a.CompareTo(b) < 0;
        public static bool operator >(BigDouble a, BigDouble b) => a.CompareTo(b) > 0;
        public static bool operator <=(BigDouble a, BigDouble b) => a.CompareTo(b) <= 0;
        public static bool operator >=(BigDouble a, BigDouble b) => a.CompareTo(b) >= 0;

        /// <summary>
        /// Plain decimal notation below 10^21 (e.g. "1,234,567"), scientific notation
        /// ("1.23e+21") beyond it. NFR-1: no rounding artifact should flip a relative
        /// comparison a player can see on screen.
        /// </summary>
        public override readonly string ToString() => ToString(2);

        public readonly string ToString(int decimalPlaces)
        {
            if (Mantissa == 0d) return "0";

            if (Exponent >= 0 && Exponent < ExponentThreshold)
            {
                var value = ToDouble();
                return value.ToString("N" + decimalPlaces, CultureInfo.InvariantCulture);
            }

            var mantissaText = Mantissa.ToString("F" + decimalPlaces, CultureInfo.InvariantCulture);
            return $"{mantissaText}e{(Exponent >= 0 ? "+" : string.Empty)}{Exponent}";
        }
    }
}
