// Minimal UnityEngine surface needed to compile the Unity Domain/Data sources
// outside the editor (AD-18 unity-frozen vectors). Behavior-relevant members
// (Mathf.Clamp/Max) mirror UnityEngine exactly; the rest are inert markers.
using System;

namespace UnityEngine
{
    public class Object
    {
    }

    public class ScriptableObject : Object
    {
        public string name;
        public static T CreateInstance<T>() where T : ScriptableObject, new() => new T();
    }

    public class Sprite : Object
    {
    }

    public static class Mathf
    {
        public static int Max(int a, int b) => a > b ? a : b;
        public static int Clamp(int value, int min, int max) => value < min ? min : (value > max ? max : value);
    }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class CreateAssetMenuAttribute : Attribute
    {
        public string fileName { get; set; }
        public string menuName { get; set; }
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class TooltipAttribute : Attribute
    {
        public TooltipAttribute(string tooltip) { }
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class HeaderAttribute : Attribute
    {
        public HeaderAttribute(string header) { }
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class TextAreaAttribute : Attribute
    {
    }
}
